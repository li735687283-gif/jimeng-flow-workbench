// 即梦 Flow 后端 - Dreamina CLI client
// 通过即梦官方 dreamina CLI 调用图片/视频生成能力，不依赖火山引擎 API Key。

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import type {
  GenerationRequest,
  GenerationResult,
} from '@jimeng-flow/shared/generateNode'
import type {
  VideoGenerationRequest,
  VideoReferenceRole,
} from '@jimeng-flow/shared/videoNode'
import {
  buildVideoReferencesFromInputImages,
  getVideoReferenceInputs,
  normalizeVideoReferences,
} from '@jimeng-flow/shared/videoNode'
import { DEFAULT_SETTINGS } from '@jimeng-flow/shared'
import type { AuthMode, Settings } from '@jimeng-flow/shared'
import { getProjectRoot } from '../../config'
import { getSettings } from '../settings'
import { getAsset, getAssetFilePath } from '../assets'

const execFileAsync = promisify(execFile)
const CLI_MAX_BUFFER = 10 * 1024 * 1024
const QUERY_INTERVAL_MS = 5_000

/** jimeng client 错误码（前端可据此区分配置错误与调用错误） */
export type JimengErrorCode =
  | 'JIMENG_NOT_CONFIGURED'
  | 'JIMENG_AUTH_MISSING'
  | 'JIMENG_HTTP_ERROR'
  | 'JIMENG_BAD_RESPONSE'
  | 'JIMENG_TIMEOUT'
  | 'JIMENG_UNKNOWN'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'

export class JimengError extends Error {
  code: JimengErrorCode
  statusCode: number
  constructor(
    code: JimengErrorCode,
    message: string,
    statusCode = 502,
  ) {
    super(message)
    this.name = 'JimengError'
    this.code = code
    this.statusCode = statusCode
  }
}

/** jimeng 调用参数：基于 GenerationRequest，附超时设置 */
export interface JimengGenerateParams extends GenerationRequest {
  timeoutMs?: number
}

/** jimeng 视频调用参数：基于 VideoGenerationRequest，附超时设置 */
export interface JimengGenerateVideoParams extends VideoGenerationRequest {
  timeoutMs?: number
}

export interface JimengResolvedVideoInput {
  path: string
  role?: VideoReferenceRole
}

interface CliRunResult {
  stdout: string
  stderr: string
}

type MediaType = 'image' | 'video'

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
])

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.avi',
  '.mkv',
  '.m4v',
])

function getDreaminaPath(settings: Partial<Settings>): string {
  return settings.dreaminaPath?.trim() || 'dreamina'
}

function summarizeOutput(stdout: string, stderr: string): string {
  const text = [stdout, stderr].filter(Boolean).join('\n').trim()
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text
}

async function runDreamina(
  args: string[],
  timeoutMs: number,
  settings?: Settings,
): Promise<CliRunResult> {
  const resolvedSettings = settings ?? await getSettings()
  const bin = getDreaminaPath(resolvedSettings)
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: getProjectRoot(),
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: CLI_MAX_BUFFER,
    })
    return { stdout: stdout ?? '', stderr: stderr ?? '' }
  } catch (err) {
    const e = err as Error & {
      code?: string | number
      stdout?: string
      stderr?: string
      killed?: boolean
      signal?: string
    }
    const stdout = e.stdout ?? ''
    const stderr = e.stderr ?? ''
    if (e.killed || e.signal === 'SIGTERM') {
      throw new JimengError(
        'JIMENG_TIMEOUT',
        `dreamina 命令超时：dreamina ${args.join(' ')}`,
        504,
      )
    }
    if (e.code === 'ENOENT') {
      throw new JimengError(
        'JIMENG_NOT_CONFIGURED',
        `未找到 dreamina CLI：${bin}。请安装即梦 CLI，或在设置中填写 dreamina.exe 的完整路径。`,
        400,
      )
    }
    const detail = summarizeOutput(stdout, stderr) || e.message
    throw new JimengError(
      'JIMENG_BAD_RESPONSE',
      `dreamina 命令执行失败：${detail}`,
      502,
    )
  }
}

function parseSubmitId(text: string): string | null {
  const patterns = [
    /"submit_id"\s*:\s*"([^"]+)"/i,
    /submit[_\s-]*id["'\s:=：]+([A-Za-z0-9_-]+)/i,
    /submitId["'\s:=：]+([A-Za-z0-9_-]+)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function parseMediaUrls(text: string, mediaType: MediaType): string[] {
  const urls = text.match(/https?:\/\/[^\s"'<>，。)）]+/g) ?? []
  const exts = mediaType === 'image' ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS
  return Array.from(new Set(urls.filter((url) => {
    const lower = url.split('?')[0].split('#')[0].toLowerCase()
    return Array.from(exts).some((ext) => lower.endsWith(ext))
  })))
}

function hasFailed(text: string): boolean {
  return /失败|failed|error|AigcComplianceConfirmationRequired/i.test(text)
}

function isTransientQueryError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const message = err.message
  return (
    /download\s+(image|video)/i.test(message) &&
    /EOF|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket hang up|network|timeout/i.test(message)
  ) || (
    err instanceof JimengError &&
    err.code === 'JIMENG_TIMEOUT'
  )
}

async function waitBeforeNextQuery(remaining: number): Promise<void> {
  await new Promise((resolveDelay) => {
    setTimeout(resolveDelay, Math.min(QUERY_INTERVAL_MS, Math.max(remaining, 0)))
  })
}

function getResolutionType(width: number, height: number): string {
  const maxSide = Math.max(width, height)
  return maxSide >= 3000 ? '4k' : '2k'
}

function getImageModelVersion(model: string): string | null {
  const match = model.match(/(\d+(?:\.\d+)?)/)
  return match?.[1] ?? null
}

function getClosestRatio(width: number, height: number): string {
  const current = width / height
  const supported = ['21:9', '16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16']
  return supported.reduce((best, ratio) => {
    const [w, h] = ratio.split(':').map(Number)
    const value = w / h
    const [bestW, bestH] = best.split(':').map(Number)
    const bestValue = bestW / bestH
    return Math.abs(value - current) < Math.abs(bestValue - current)
      ? ratio
      : best
  }, '1:1')
}

function getVideoModelVersion(model: string): string {
  const map: Record<string, string> = {
    'seedance-2.0': 'seedance2.0',
    'seedance-2.0-fast': 'seedance2.0fast',
    'seedance-2.0-vip': 'seedance2.0_vip',
    'seedance-2.0-fast-vip': 'seedance2.0fast_vip',
    'seedance-2.0-mini': 'seedance2.0mini',
    seedance2: 'seedance2.0',
    seedance20: 'seedance2.0',
    seedance2fast: 'seedance2.0fast',
  }
  return map[model] ?? model.replaceAll('-', '')
}

function getVideoResolution(resolution: string): string | null {
  const normalized = resolution.toLowerCase()
  if (normalized === '1080p' || normalized === '4k' || normalized === '720p') {
    return normalized
  }
  return null
}

function appendVideoModelResolutionArgs(
  args: string[],
  modelVersion: string,
  resolution: string | null,
): void {
  args.push(`--model_version=${modelVersion}`)
  if (resolution) args.push(`--video_resolution=${resolution}`)
}

async function resolveInputPaths(inputImages: string[] | undefined): Promise<string[]> {
  const paths: string[] = []
  for (const input of inputImages ?? []) {
    if (!input) continue
    if (input.startsWith('asset_')) {
      const asset = await getAsset(input)
      if (!asset) {
        throw new JimengError(
          'INVALID_INPUT',
          `找不到参考图 Asset：${input}`,
          400,
        )
      }
      paths.push(getAssetFilePath(asset))
    } else {
      paths.push(resolve(getProjectRoot(), input))
    }
  }
  return paths
}

async function listDownloadedFiles(
  dir: string,
  mediaType: MediaType,
): Promise<string[]> {
  const exts = mediaType === 'image' ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS
  const files: string[] = []

  async function walk(current: string): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      const lower = entry.name.toLowerCase()
      const ext = lower.slice(lower.lastIndexOf('.'))
      if (!exts.has(ext)) continue
      const info = await stat(full)
      if (info.size > 0) files.push(full)
    }
  }

  await walk(dir)
  return Array.from(new Set(files))
}

async function waitForResults(
  submitId: string,
  mediaType: MediaType,
  downloadDir: string,
  timeoutMs: number,
  settings: Settings,
): Promise<GenerationResult[]> {
  const started = Date.now()
  let lastOutput = ''

  while (Date.now() - started < timeoutMs) {
    const remaining = timeoutMs - (Date.now() - started)
    let query: CliRunResult
    try {
      query = await runDreamina(
        [
          'query_result',
          `--submit_id=${submitId}`,
          `--download_dir=${downloadDir}`,
        ],
        Math.min(Math.max(remaining, 1_000), 60_000),
        settings,
      )
    } catch (err) {
      lastOutput = err instanceof Error ? err.message : String(err)
      const downloaded = await listDownloadedFiles(downloadDir, mediaType)
      if (downloaded.length > 0) {
        return downloaded.map((localPath) => ({ localPath }))
      }
      if (isTransientQueryError(err)) {
        await waitBeforeNextQuery(remaining)
        continue
      }
      throw err
    }
    lastOutput = summarizeOutput(query.stdout, query.stderr)
    const downloaded = await listDownloadedFiles(downloadDir, mediaType)
    if (downloaded.length > 0) {
      return downloaded.map((localPath) => ({ localPath }))
    }

    const urls = parseMediaUrls(`${query.stdout}\n${query.stderr}`, mediaType)
    if (urls.length > 0) {
      return urls.map((remoteUrl) => ({ remoteUrl }))
    }

    if (hasFailed(lastOutput)) {
      throw new JimengError(
        'JIMENG_BAD_RESPONSE',
        `dreamina 任务失败：${lastOutput}`,
        502,
      )
    }

    await waitBeforeNextQuery(remaining)
  }

  throw new JimengError(
    'JIMENG_TIMEOUT',
    `dreamina 任务仍未完成，请稍后用 submit_id 查询：${submitId}${lastOutput ? `。最近输出：${lastOutput}` : ''}`,
    504,
  )
}

async function submitAndCollect(
  args: string[],
  mediaType: MediaType,
  timeoutMs: number,
): Promise<GenerationResult[]> {
  const settings = await getSettings()
  const downloadDir = await mkdtemp(join(tmpdir(), 'dreamina-flow-'))
  const submit = await runDreamina([...args, '--poll=0'], 60_000, settings)
  const output = `${submit.stdout}\n${submit.stderr}`

  const submitId = parseSubmitId(output)
  const directUrls = parseMediaUrls(output, mediaType)
  if (directUrls.length > 0 && !submitId) {
    return directUrls.map((remoteUrl) => ({ remoteUrl }))
  }
  if (!submitId) {
    throw new JimengError(
      'JIMENG_BAD_RESPONSE',
      `dreamina 未返回 submit_id：${summarizeOutput(submit.stdout, submit.stderr)}`,
      502,
    )
  }

  return waitForResults(
    submitId,
    mediaType,
    downloadDir,
    Math.max(timeoutMs - 60_000, 30_000),
    settings,
  )
}

export async function generateImage(
  params: JimengGenerateParams,
): Promise<GenerationResult[]> {
  const inputPaths = await resolveInputPaths(params.inputImages)
  const command = inputPaths.length > 0 ? 'image2image' : 'text2image'
  const args = [
    command,
    `--prompt=${params.prompt}`,
    `--ratio=${getClosestRatio(params.width, params.height)}`,
    `--resolution_type=${getResolutionType(params.width, params.height)}`,
    `--generate_num=${Math.max(1, Math.min(params.count ?? 1, 10))}`,
  ]

  const modelVersion = getImageModelVersion(params.model)
  if (modelVersion) args.push(`--model_version=${modelVersion}`)
  if (inputPaths.length > 0) {
    args.push(`--images=${inputPaths.join(',')}`)
  }

  return submitAndCollect(args, 'image', params.timeoutMs ?? 300_000)
}

export async function generateVideo(
  params: JimengGenerateVideoParams,
): Promise<GenerationResult[]> {
  const references = normalizeVideoReferences(params.references)
  const effectiveReferences =
    references.length > 0
      ? references
      : buildVideoReferencesFromInputImages(params.mode, params.inputImages)
  const referenceInputs = getVideoReferenceInputs(effectiveReferences)
  const inputPaths = await resolveInputPaths(referenceInputs)
  const resolvedInputs = inputPaths.map((path, index) => ({
    path,
    role: effectiveReferences[index]?.role,
  }))
  const args = buildJimengVideoArgs(params, resolvedInputs)

  return submitAndCollect(args, 'video', params.timeoutMs ?? 900_000)
}

export function buildJimengVideoArgs(
  params: JimengGenerateVideoParams,
  inputs: JimengResolvedVideoInput[],
): string[] {
  const inputPaths = inputs.map((input) => input.path)
  const modelVersion = getVideoModelVersion(params.model)
  const requestedResolution = getVideoResolution(params.resolution)
  const resolution =
    modelVersion === 'seedance2.0_vip'
      ? requestedResolution
      : requestedResolution === '720p'
        ? requestedResolution
        : null
  const ratio = params.aspectRatio === 'Auto' ? null : params.aspectRatio

  const firstFrame = inputs.find((input) => input.role === 'first_frame')
  const lastFrame = inputs.find((input) => input.role === 'last_frame')

  if (params.mode === 'all_reference' || params.mode === 'action_mimic') {
    if (inputPaths.length === 0) {
      throw new JimengError(
        'INVALID_INPUT',
        '全能参考/动作模仿模式至少需要一个上游图片',
        400,
      )
    }
    const args = [
      'multimodal2video',
      `--prompt=${params.prompt}`,
      `--duration=${params.durationSeconds}`,
      `--model_version=${modelVersion}`,
    ]
    inputPaths.forEach((path) => args.push(`--image=${path}`))
    if (ratio) args.push(`--ratio=${ratio}`)
    if (resolution) args.push(`--video_resolution=${resolution}`)
    return args
  }

  if (params.mode === 'image_reference' && inputPaths.length === 0) {
    throw new JimengError(
      'INVALID_INPUT',
      '多图参考模式至少需要一个上游图片',
      400,
    )
  }

  if (firstFrame && lastFrame) {
    const args = [
      'frames2video',
      `--first=${firstFrame.path}`,
      `--last=${lastFrame.path}`,
      `--prompt=${params.prompt}`,
      `--duration=${params.durationSeconds}`,
    ]
    appendVideoModelResolutionArgs(args, modelVersion, resolution)
    return args
  }

  if (inputPaths.length >= 2 || params.mode === 'first_last_frame') {
    return [
      'multiframe2video',
      `--images=${inputPaths.join(',')}`,
      `--prompt=${params.prompt}`,
      `--duration=${params.durationSeconds}`,
    ]
  }

  if (inputPaths.length === 1) {
    const args = [
      'image2video',
      `--image=${inputPaths[0]}`,
      `--prompt=${params.prompt}`,
      `--duration=${params.durationSeconds}`,
      `--model_version=${modelVersion}`,
    ]
    if (resolution) args.push(`--video_resolution=${resolution}`)
    return args
  }

  const args = [
    'text2video',
    `--prompt=${params.prompt}`,
    `--duration=${params.durationSeconds}`,
    `--model_version=${modelVersion}`,
  ]
  if (ratio) args.push(`--ratio=${ratio}`)
  if (resolution) args.push(`--video_resolution=${resolution}`)
  return args
}

export interface RemoveBgParams {
  inputImage: string
  timeoutMs?: number
}

export interface UpscaleImageParams {
  inputImage: string
  resolutionType?: '2k' | '4k' | '8k'
  timeoutMs?: number
}

export async function upscaleImage(
  params: UpscaleImageParams,
): Promise<GenerationResult[]> {
  const inputPaths = await resolveInputPaths([params.inputImage])
  if (inputPaths.length === 0) {
    throw new JimengError('INVALID_INPUT', '缺少输入图片', 400)
  }
  const resolutionType = params.resolutionType ?? '2k'
  if (!['2k', '4k', '8k'].includes(resolutionType)) {
    throw new JimengError('INVALID_INPUT', '高清倍率仅支持 2k、4k、8k', 400)
  }
  return submitAndCollect(
    [
      'image_upscale',
      `--image=${inputPaths[0]}`,
      `--resolution_type=${resolutionType}`,
    ],
    'image',
    params.timeoutMs ?? 300_000,
  )
}

export async function removeBackground(
  params: RemoveBgParams,
): Promise<GenerationResult[]> {
  const inputPaths = await resolveInputPaths([params.inputImage])
  if (inputPaths.length === 0) {
    throw new JimengError('INVALID_INPUT', '缺少输入图片', 400)
  }
  const outputDir = await mkdtemp(join(tmpdir(), 'dreamina-rembg-'))
  const outputPath = join(outputDir, 'output.png')
  try {
    await execFileAsync('rembg', ['i', inputPaths[0], outputPath], { timeout: params.timeoutMs ?? 60_000 })
    return [{ localPath: outputPath }]
  } catch (err) {
    throw new JimengError('JIMENG_BAD_RESPONSE', `rembg 执行失败：${err instanceof Error ? err.message : String(err)}`, 502)
  }
}

/** jimeng 连接测试选项 */
export interface JimengTestOptions {
  jimengBaseUrl?: string
  authMode?: AuthMode
  apiKey?: string
  dreaminaPath?: string
}

export async function testJimengConnection(
  opts: JimengTestOptions,
): Promise<{ ok: boolean; message?: string }> {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    dreaminaPath: opts.dreaminaPath || DEFAULT_SETTINGS.dreaminaPath,
  }
  try {
    const result = await runDreamina(['version'], 10_000, settings)
    const output = summarizeOutput(result.stdout, result.stderr)
    return {
      ok: true,
      message: output ? `dreamina CLI 可用：${output}` : 'dreamina CLI 可用',
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
