// Real-ESRGAN 高清放大引擎：调用本地 realesrgan-ncnn-vulkan.exe 做固定 4x 保真放大，
// 再按 resolutionType 用 jimp 等比收敛到目标长边。
// 二进制由 scripts/fetch-realesrgan.mjs 下载到 vendor/realesrgan/（dev），
// 打包版随 electron-builder extraResources 放到 resources/realesrgan/（prod）。

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Jimp } from 'jimp'
import type { GenerationResult } from '@jimeng-flow/shared/generateNode'
import type { UpscaleResolutionType } from '@jimeng-flow/shared/upscale'
import { getProjectRoot } from '../../config'
import { resolveInputPaths } from '../jimeng'
import {
  cleanupOwnedTempDirectory,
  createOwnedTempDirectory,
  handoffOwnedTempDirectory,
} from '../ownedTempDirectories'

const execFileAsync = promisify(execFile)
const CLI_MAX_BUFFER = 10 * 1024 * 1024
const EXE_NAME = 'realesrgan-ncnn-vulkan.exe'
const DEFAULT_MODEL = 'realesrgan-x4plus'
const DEFAULT_TIMEOUT_MS = 300_000

/** resolutionType → 目标长边像素 */
const TARGET_LONG_EDGE: Record<UpscaleResolutionType, number> = {
  '2k': 2048,
  '4k': 4096,
  '8k': 8192,
}

export type RealEsrganErrorCode =
  | 'REALESRGAN_NOT_INSTALLED'
  | 'REALESRGAN_TIMEOUT'
  | 'REALESRGAN_EXEC_FAILED'
  | 'INVALID_INPUT'

export class RealEsrganError extends Error {
  code: RealEsrganErrorCode
  statusCode: number
  constructor(code: RealEsrganErrorCode, message: string, statusCode = 502) {
    super(message)
    this.name = 'RealEsrganError'
    this.code = code
    this.statusCode = statusCode
  }
}

export interface RealEsrganUpscaleParams {
  inputImage: string
  resolutionType?: UpscaleResolutionType
  timeoutMs?: number
}

type ExecFileLike = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>

/** 依赖注入：测试用假 exec / 假文件探测替换真实进程与磁盘 */
export interface RealEsrganDeps {
  env?: NodeJS.ProcessEnv
  fileExists?: (path: string) => Promise<boolean>
  execFileImpl?: ExecFileLike
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/**
 * 二进制路径解析优先级：
 * 1. 环境变量 MOK_REALESRGAN_PATH（完整 exe 路径，调试/自定义安装用）
 * 2. 环境变量 MOK_RESOURCES_DIR（Electron 打包版的 resources 目录，desktop 端注入）
 * 3. 仓库 vendor/realesrgan/（dev，由 npm run fetch:realesrgan 下载）
 */
export async function resolveRealEsrganBinary(
  deps: Pick<RealEsrganDeps, 'env' | 'fileExists'> = {},
): Promise<string> {
  const env = deps.env ?? process.env
  const fileExists = deps.fileExists ?? defaultFileExists

  const configured = env.MOK_REALESRGAN_PATH?.trim()
  if (configured) {
    if (await fileExists(configured)) return configured
    throw new RealEsrganError(
      'REALESRGAN_NOT_INSTALLED',
      `MOK_REALESRGAN_PATH 指向的文件不存在：${configured}`,
      400,
    )
  }

  const resourcesDir = env.MOK_RESOURCES_DIR?.trim()
  if (resourcesDir) {
    const bundled = join(resourcesDir, 'realesrgan', EXE_NAME)
    if (await fileExists(bundled)) return bundled
  }

  const vendored = resolve(getProjectRoot(), 'vendor', 'realesrgan', EXE_NAME)
  if (await fileExists(vendored)) return vendored

  throw new RealEsrganError(
    'REALESRGAN_NOT_INSTALLED',
    'Real-ESRGAN 未安装，请运行 npm run fetch:realesrgan',
    400,
  )
}

/** 构造 exe 调用参数：-m 显式指向 exe 旁的 models 目录，避免依赖 cwd */
export function buildRealEsrganArgs(
  binaryPath: string,
  inputPath: string,
  outputPath: string,
): string[] {
  return [
    '-i', inputPath,
    '-o', outputPath,
    '-n', DEFAULT_MODEL,
    '-s', '4',
    '-m', join(dirname(binaryPath), 'models'),
  ]
}

/**
 * 按 resolutionType 收敛 4x 结果：
 * 长边超过目标 → jimp 等比缩到目标长边；不足目标 → 保留 4x 原样（不强行放大），
 * 由调用方通过结果的 width/height 得知实际尺寸。
 */
export async function scaleToTargetLongEdge(
  imagePath: string,
  resolutionType: UpscaleResolutionType,
): Promise<{ width: number; height: number }> {
  const target = TARGET_LONG_EDGE[resolutionType]
  const image = await Jimp.read(imagePath)
  const longEdge = Math.max(image.width, image.height)
  if (longEdge > target) {
    image.scaleToFit({ w: target, h: target })
    await image.write(imagePath as `${string}.${string}`)
  }
  return { width: image.width, height: image.height }
}

export async function upscaleWithRealEsrgan(
  params: RealEsrganUpscaleParams,
  deps: RealEsrganDeps = {},
): Promise<GenerationResult[]> {
  const inputPaths = await resolveInputPaths([params.inputImage])
  if (inputPaths.length === 0) {
    throw new RealEsrganError('INVALID_INPUT', '缺少输入图片', 400)
  }
  const resolutionType = params.resolutionType ?? '2k'
  if (!(resolutionType in TARGET_LONG_EDGE)) {
    throw new RealEsrganError('INVALID_INPUT', '高清倍率仅支持 2k、4k、8k', 400)
  }
  const binaryPath = await resolveRealEsrganBinary(deps)
  const execImpl = deps.execFileImpl ?? execFileAsync

  const outputOwner = await createOwnedTempDirectory(tmpdir(), 'mok-realesrgan-')
  const outputPath = join(outputOwner.path, 'output.png')
  let handedOff = false
  try {
    try {
      await execImpl(binaryPath, buildRealEsrganArgs(binaryPath, inputPaths[0], outputPath), {
        timeout: params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: CLI_MAX_BUFFER,
      })
    } catch (err) {
      const e = err as Error & { code?: string | number; killed?: boolean; signal?: string }
      if (e.killed || e.signal === 'SIGTERM') {
        throw new RealEsrganError(
          'REALESRGAN_TIMEOUT',
          'Real-ESRGAN 执行超时，请换更小的图或稍后重试',
          504,
        )
      }
      if (e.code === 'ENOENT') {
        throw new RealEsrganError(
          'REALESRGAN_NOT_INSTALLED',
          'Real-ESRGAN 未安装，请运行 npm run fetch:realesrgan',
          400,
        )
      }
      throw new RealEsrganError(
        'REALESRGAN_EXEC_FAILED',
        `Real-ESRGAN 执行失败：${e.message}`,
        502,
      )
    }
    if (!(await (deps.fileExists ?? defaultFileExists)(outputPath))) {
      throw new RealEsrganError(
        'REALESRGAN_EXEC_FAILED',
        'Real-ESRGAN 未产出结果文件',
        502,
      )
    }

    const { width, height } = await scaleToTargetLongEdge(outputPath, resolutionType)
    const results: GenerationResult[] = [{ localPath: outputPath, width, height }]
    handedOff = handoffOwnedTempDirectory(results, outputOwner)
    return results
  } finally {
    if (!handedOff) await cleanupOwnedTempDirectory(outputOwner)
  }
}
