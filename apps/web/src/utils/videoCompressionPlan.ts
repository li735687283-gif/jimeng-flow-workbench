import type { VideoCompressionTargetHeight } from '@jimeng-flow/shared/videoCompression'

export interface VideoCompressionPlan {
  width: number
  height: VideoCompressionTargetHeight
  scale: number
}

export const VIDEO_COMPRESSION_TARGETS = [480, 360] as const

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/** 保持比例并把宽度收敛为偶数，兼容 H.264 yuv420p。 */
export function getVideoCompressionPlan(
  sourceWidth: number,
  sourceHeight: number,
  targetHeight: VideoCompressionTargetHeight,
): VideoCompressionPlan | null {
  if (!isPositiveFinite(sourceWidth) || !isPositiveFinite(sourceHeight)) {
    return null
  }
  if (targetHeight >= sourceHeight) return null
  const width = Math.max(
    2,
    Math.round((sourceWidth * targetHeight) / sourceHeight / 2) * 2,
  )
  return {
    width,
    height: targetHeight,
    scale: targetHeight / sourceHeight,
  }
}

export function getVideoCompressionOptions(
  sourceWidth: number,
  sourceHeight: number,
): VideoCompressionPlan[] {
  return VIDEO_COMPRESSION_TARGETS.flatMap((targetHeight) => {
    const plan = getVideoCompressionPlan(sourceWidth, sourceHeight, targetHeight)
    return plan ? [plan] : []
  })
}

export function formatVideoCompressionPixels(
  width: number,
  height: number,
): string {
  if (!isPositiveFinite(width) || !isPositiveFinite(height)) return '未知'
  return `${Math.round((width * height) / 10_000)} 万像素`
}
