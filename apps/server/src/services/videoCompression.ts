import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Asset } from '@jimeng-flow/shared/asset'
import type { VideoCompressionTargetHeight } from '@jimeng-flow/shared/videoCompression'
import { getAssetFilePath, saveLocalAssetFile } from './assets'
import {
  cleanupOwnedTempDirectory,
  createOwnedTempDirectory,
} from './ownedTempDirectories'

export class VideoCompressionError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
    readonly code = 'VIDEO_COMPRESSION_FAILED',
  ) {
    super(message)
    this.name = 'VideoCompressionError'
  }
}

export type RunFfmpeg = (command: string, args: string[]) => Promise<void>

export function resolveFfmpegExecutable(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const explicitPath = env.MOK_FFMPEG_PATH?.trim()
  if (explicitPath) return resolve(explicitPath)
  const resourcesDir = env.MOK_RESOURCES_DIR?.trim()
  if (resourcesDir) {
    return resolve(
      resourcesDir,
      'ffmpeg',
      platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    )
  }
  return 'ffmpeg'
}

export function buildVideoCompressionArgs(
  inputPath: string,
  outputPath: string,
  targetHeight: VideoCompressionTargetHeight,
): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    `scale=-2:${targetHeight}`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputPath,
  ]
}

export const runFfmpeg: RunFfmpeg = (command, args) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-8_000)
    })
    child.once('error', (error) => {
      reject(
        new VideoCompressionError(
          error.message.includes('ENOENT')
            ? '未找到视频压缩组件，请重新安装 MO.K'
            : `无法启动视频压缩：${error.message}`,
          500,
          'FFMPEG_UNAVAILABLE',
        ),
      )
    })
    child.once('close', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(
        new VideoCompressionError(
          stderr.trim()
            ? `视频压缩失败：${stderr.trim()}`
            : `视频压缩失败：FFmpeg 退出码 ${code ?? 'unknown'}`,
          500,
        ),
      )
    })
  })

export async function compressVideoAsset(
  params: {
    sourceAsset: Asset
    targetHeight: VideoCompressionTargetHeight
  },
  deps: { runFfmpeg?: RunFfmpeg } = {},
): Promise<Asset> {
  if (params.sourceAsset.type !== 'video') {
    throw new VideoCompressionError('只有视频资产可以压缩', 400, 'INVALID_ASSET_TYPE')
  }
  const tempDirectory = await createOwnedTempDirectory(
    tmpdir(),
    'mok-video-compression-',
  )
  const outputPath = join(
    tempDirectory.path,
    `compressed-${params.targetHeight}p.mp4`,
  )

  try {
    await (deps.runFfmpeg ?? runFfmpeg)(
      resolveFfmpegExecutable(),
      buildVideoCompressionArgs(
        getAssetFilePath(params.sourceAsset),
        outputPath,
        params.targetHeight,
      ),
    )
    return await saveLocalAssetFile({
      sourcePath: outputPath,
      originalName: `compressed-${params.sourceAsset.id}-${params.targetHeight}p.mp4`,
      mimeType: 'video/mp4',
      inputAssetIds: [params.sourceAsset.id],
      provider: 'local-ffmpeg',
      params: {
        flowId:
          typeof params.sourceAsset.params?.flowId === 'string'
            ? params.sourceAsset.params.flowId
            : null,
        operation: 'video_compression',
        targetHeight: params.targetHeight,
        videoCodec: 'h264',
        audioCodec: 'aac',
      },
    })
  } finally {
    await cleanupOwnedTempDirectory(tempDirectory)
  }
}
