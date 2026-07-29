import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Asset } from '@jimeng-flow/shared/asset'
import type { VideoTrimRequest } from '@jimeng-flow/shared/videoTrim'
import { getAssetFilePath, saveLocalAssetFile } from './assets'
import {
  runFfmpeg,
  resolveFfmpegExecutable,
  VideoCompressionError,
  type RunFfmpeg,
} from './videoCompression'
import {
  cleanupOwnedTempDirectory,
  createOwnedTempDirectory,
} from './ownedTempDirectories'

export class VideoTrimError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
    readonly code = 'VIDEO_TRIM_FAILED',
  ) {
    super(message)
    this.name = 'VideoTrimError'
  }
}

function formatFfmpegSeconds(value: number): string {
  return value.toFixed(3)
}

export function buildVideoTrimArgs(
  inputPath: string,
  outputPath: string,
  trim: VideoTrimRequest,
): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-ss',
    formatFfmpegSeconds(trim.startSeconds),
    '-t',
    formatFfmpegSeconds(trim.durationSeconds),
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    '-avoid_negative_ts',
    'make_zero',
    outputPath,
  ]
}

export async function trimVideoAsset(
  params: {
    sourceAsset: Asset
    trim: VideoTrimRequest
  },
  deps: { runFfmpeg?: RunFfmpeg } = {},
): Promise<Asset> {
  if (params.sourceAsset.type !== 'video') {
    throw new VideoTrimError('只有视频资产可以裁切', 400, 'INVALID_ASSET_TYPE')
  }
  const tempDirectory = await createOwnedTempDirectory(
    tmpdir(),
    'mok-video-trim-',
  )
  const outputPath = join(tempDirectory.path, 'trimmed.mp4')

  try {
    try {
      await (deps.runFfmpeg ?? runFfmpeg)(
        resolveFfmpegExecutable(),
        buildVideoTrimArgs(
          getAssetFilePath(params.sourceAsset),
          outputPath,
          params.trim,
        ),
      )
    } catch (error) {
      if (error instanceof VideoCompressionError) {
        throw new VideoTrimError(
          error.message.replaceAll('视频压缩', '视频裁切'),
          error.statusCode,
          error.code,
        )
      }
      throw error
    }

    return await saveLocalAssetFile({
      sourcePath: outputPath,
      originalName: `trimmed-${params.sourceAsset.id}-${params.trim.startSeconds}s-${params.trim.durationSeconds}s.mp4`,
      mimeType: 'video/mp4',
      inputAssetIds: [params.sourceAsset.id],
      provider: 'local-ffmpeg',
      params: {
        flowId:
          typeof params.sourceAsset.params?.flowId === 'string'
            ? params.sourceAsset.params.flowId
            : null,
        operation: 'video_trim',
        startSeconds: params.trim.startSeconds,
        durationSeconds: params.trim.durationSeconds,
        videoCodec: 'h264',
        audioCodec: 'aac',
      },
    })
  } finally {
    await cleanupOwnedTempDirectory(tempDirectory)
  }
}
