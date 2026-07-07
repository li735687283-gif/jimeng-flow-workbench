import type { GenerationResult } from '@jimeng-flow/shared/generateNode'
import type {
  VideoGenerationRequest,
  VideoMediaReference,
} from '@jimeng-flow/shared/videoNode'
import type { Settings } from '@jimeng-flow/shared/settings'
import {
  buildVideoReferencesFromInputImages,
  normalizeVideoReferences,
} from '@jimeng-flow/shared/videoNode'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { getProjectRoot } from '../config'
import { getAsset, getAssetFilePath } from './assets'
import { getSettings } from './settings'

interface OpenAiVideoDeps {
  settings?: Pick<Settings, 'llmBaseUrl' | 'llmApiKey'>
  fetchImpl?: typeof fetch
  timeoutMs?: number
  pollIntervalMs?: number
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (!isObject(current)) return undefined
    current = current[key]
  }
  return current
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)))
}

function getVersionlessBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v[0-9]+$/i, '')
}

function getVideoSubmitUrls(baseUrl: string): string[] {
  const root = getVersionlessBaseUrl(baseUrl)
  return uniqueUrls([
    `${baseUrl}/videos`,
    `${baseUrl}/videos/generations`,
    `${root}/v1/videos`,
    `${root}/v1/videos/generations`,
    `${root}/v2/videos/generations`,
  ])
}

function isAssetId(value: string): boolean {
  return /^asset_[A-Za-z0-9_-]+$/.test(value)
}

function isDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]'
}

function extractLocalAssetIdFromUrl(value: string): string | null {
  let pathname = ''
  if (value.startsWith('/')) {
    pathname = value
  } else {
    try {
      const url = new URL(value)
      if (!isLocalHost(url.hostname)) return null
      pathname = url.pathname
    } catch {
      return null
    }
  }

  const match = pathname.match(/^\/api\/assets\/([^/]+)\/(?:file|download)$/)
  if (!match) return null
  return decodeURIComponent(match[1])
}

function imageMimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.bmp') return 'image/bmp'
  return 'image/png'
}

async function resolveInputImageFilePath(value: string): Promise<string> {
  const localAssetId = extractLocalAssetIdFromUrl(value)
  if (localAssetId) {
    const asset = await getAsset(localAssetId)
    if (!asset) {
      throw new Error(`找不到参考图 Asset：${localAssetId}`)
    }
    return getAssetFilePath(asset)
  }
  if (isAssetId(value)) {
    const asset = await getAsset(value)
    if (!asset) {
      throw new Error(`找不到参考图 Asset：${value}`)
    }
    return getAssetFilePath(asset)
  }
  return resolve(getProjectRoot(), value)
}

async function resolveInputImageDataUrl(input: string): Promise<string | null> {
  const value = input.trim()
  if (!value) return null
  if (isDataUrl(value) || isRemoteUrl(value)) return value

  const filePath = await resolveInputImageFilePath(value)
  const buffer = await readFile(filePath)
  return `data:${imageMimeFromPath(filePath)};base64,${buffer.toString('base64')}`
}

function referencesFromRequest(
  req: VideoGenerationRequest,
): VideoMediaReference[] {
  const references = normalizeVideoReferences(req.references)
  return references.length > 0
    ? references
    : buildVideoReferencesFromInputImages(req.mode, req.inputImages)
}

async function resolveReferenceUrls(
  references: VideoMediaReference[],
): Promise<string[]> {
  const urls: string[] = []
  for (const ref of references) {
    const raw = ref.url ?? ref.assetId
    if (!raw) continue
    const url = await resolveInputImageDataUrl(raw)
    if (url) urls.push(url)
  }
  return urls
}

function getReferenceUrl(ref: VideoMediaReference): string | null {
  return ref.url ?? ref.assetId ?? null
}

export function getOpenAiCompatibleVideoPayload(
  req: VideoGenerationRequest,
  resolvedReferenceUrls?: string[],
): Record<string, unknown> {
  const references = referencesFromRequest(req)
  const imageUrls =
    resolvedReferenceUrls ??
    references
      .map((ref) => getReferenceUrl(ref))
      .filter((url): url is string => !!url)

  const payload: Record<string, unknown> = {
    model: req.model,
    prompt: req.prompt,
    duration: req.durationSeconds,
    aspect_ratio: req.aspectRatio,
    resolution: req.resolution,
    n: Math.max(1, Math.min(req.count ?? 1, 4)),
    generate_audio: req.generateAudio,
  }

  if (imageUrls.length > 0) {
    payload.image_urls = imageUrls
    payload.image_with_roles = references
      .map((ref, index) => ({
        url: imageUrls[index],
        role: ref.role,
      }))
      .filter((item) => !!item.url)

    if (req.mode === 'first_last_frame' && imageUrls.length >= 2) {
      payload.generation_type = 'frame'
    } else if (
      req.mode === 'all_reference' ||
      req.mode === 'image_reference' ||
      imageUrls.length > 1
    ) {
      payload.generation_type = 'reference'
    }
  }

  return payload
}

function isVideoResultString(value: string): boolean {
  const text = value.trim()
  if (!text) return false
  return (
    text.startsWith('/assets/') ||
    text.startsWith('/output/') ||
    text.startsWith('data:video/') ||
    /^https?:\/\//i.test(text)
  )
}

function collectVideoResultsFromValue(
  value: unknown,
  results: GenerationResult[],
): void {
  if (typeof value === 'string') {
    if (isVideoResultString(value)) results.push({ remoteUrl: value.trim() })
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectVideoResultsFromValue(item, results))
    return
  }
  if (!isObject(value)) return

  for (const key of [
    'url',
    'video_url',
    'videoUrl',
    'remoteUrl',
    'output_url',
    'outputUrl',
  ]) {
    collectVideoResultsFromValue(value[key], results)
  }
}

export function extractOpenAiVideoResults(value: unknown): GenerationResult[] {
  const results: GenerationResult[] = []
  for (const path of [
    ['data'],
    ['data', 'result', 'videos'],
    ['result', 'videos'],
    ['videos'],
    ['output_videos'],
    ['outputVideos'],
    ['data', 'output_videos'],
  ]) {
    collectVideoResultsFromValue(getPath(value, path), results)
  }

  const seen = new Set<string>()
  return results.filter((result) => {
    const key = result.remoteUrl
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function extractOpenAiVideoTaskId(value: unknown): string | null {
  const candidates = [
    getPath(value, ['task_id']),
    getPath(value, ['id']),
    getPath(value, ['data', 'task_id']),
    getPath(value, ['data', 'id']),
  ]
  const data = getPath(value, ['data'])
  if (Array.isArray(data)) {
    for (const item of data) {
      candidates.push(getPath(item, ['task_id']), getPath(item, ['id']))
    }
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return null
}

function extractTaskStatus(value: unknown): string {
  const candidate =
    getPath(value, ['data', 'status']) ??
    getPath(value, ['status']) ??
    getPath(value, ['state'])
  return typeof candidate === 'string' ? candidate.toLowerCase() : ''
}

function extractTaskError(value: unknown): string {
  const candidates = [
    getPath(value, ['data', 'error', 'message']),
    getPath(value, ['data', 'error']),
    getPath(value, ['error', 'message']),
    getPath(value, ['error']),
    getPath(value, ['message']),
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return '第三方视频任务失败'
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text }
  }
}

async function pollOpenAiVideoTask({
  taskId,
  baseUrl,
  apiKey,
  fetchImpl,
  signal,
  timeoutMs,
  pollIntervalMs,
  submitUrl,
}: {
  taskId: string
  baseUrl: string
  apiKey: string
  fetchImpl: typeof fetch
  signal: AbortSignal
  timeoutMs: number
  pollIntervalMs: number
  submitUrl?: string
}): Promise<GenerationResult[]> {
  const deadline = Date.now() + timeoutMs
  const root = getVersionlessBaseUrl(baseUrl)
  const urls = [
    submitUrl ? `${submitUrl}/${encodeURIComponent(taskId)}` : '',
    `${baseUrl}/videos/${encodeURIComponent(taskId)}`,
    `${baseUrl}/videos/generations/${encodeURIComponent(taskId)}`,
    `${baseUrl}/tasks/${encodeURIComponent(taskId)}?language=en`,
    `${root}/v1/videos/generations/${encodeURIComponent(taskId)}`,
    `${root}/v2/videos/generations/${encodeURIComponent(taskId)}`,
  ].filter(Boolean)

  while (Date.now() < deadline) {
    let lastJson: unknown = {}
    let sawReachableEndpoint = false

    for (const url of urls) {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      })
      const json = await readJsonResponse(res)
      lastJson = json
      if (!res.ok) {
        if (res.status === 404 || res.status === 405) continue
        throw new Error(
          `第三方视频任务查询失败：HTTP ${res.status} ${res.statusText} - ${extractTaskError(json)}`,
        )
      }
      sawReachableEndpoint = true

      const results = extractOpenAiVideoResults(json)
      if (results.length > 0) return results

      const status = extractTaskStatus(json)
      if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(status)) {
        throw new Error(extractTaskError(json))
      }
      break
    }

    if (!sawReachableEndpoint) {
      throw new Error(`第三方视频任务查询端点不可用：${extractTaskError(lastJson)}`)
    }
    await delay(pollIntervalMs)
  }

  throw new Error(`第三方视频任务查询超时（${timeoutMs / 1000}s）`)
}

export async function generateOpenAiCompatibleVideo(
  req: VideoGenerationRequest,
  deps: OpenAiVideoDeps = {},
): Promise<GenerationResult[]> {
  const settings = deps.settings ?? await getSettings()
  const baseUrl = normalizeBaseUrl(settings.llmBaseUrl ?? '')
  const apiKey = settings.llmApiKey ?? ''
  const fetchImpl = deps.fetchImpl ?? fetch

  if (!baseUrl) {
    throw new Error('第三方视频 API Base URL 未配置，请先在设置中配置 LLM Provider')
  }
  if (!apiKey) {
    throw new Error('第三方视频 API Key 未配置，请先在设置中配置 LLM Provider')
  }

  const controller = new AbortController()
  const timeoutMs = deps.timeoutMs ?? 300_000
  const pollIntervalMs = deps.pollIntervalMs ?? 2_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const references = referencesFromRequest(req)
    const referenceUrls = await resolveReferenceUrls(references)
    const body = JSON.stringify(getOpenAiCompatibleVideoPayload(req, referenceUrls))
    let json: unknown = {}
    let submitUrl = ''
    let lastSubmitError = '第三方视频 API 调用失败'

    for (const candidateUrl of getVideoSubmitUrls(baseUrl)) {
      const res = await fetchImpl(candidateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: controller.signal,
      })

      json = await readJsonResponse(res)
      if (res.ok) {
        submitUrl = candidateUrl
        break
      }

      lastSubmitError = `第三方视频 API 调用失败：HTTP ${res.status} ${res.statusText} - ${extractTaskError(json)}`
      if (res.status !== 404 && res.status !== 405) {
        throw new Error(lastSubmitError)
      }
    }

    if (!submitUrl) {
      throw new Error(lastSubmitError)
    }

    const results = extractOpenAiVideoResults(json)
    if (results.length > 0) return results

    const taskId = extractOpenAiVideoTaskId(json)
    if (taskId) {
      return pollOpenAiVideoTask({
        taskId,
        baseUrl,
        apiKey,
        fetchImpl,
        signal: controller.signal,
        timeoutMs,
        pollIntervalMs,
        submitUrl,
      })
    }

    throw new Error('第三方视频 API 没有返回可用视频')
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`第三方视频 API 调用超时（${timeoutMs / 1000}s）`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
