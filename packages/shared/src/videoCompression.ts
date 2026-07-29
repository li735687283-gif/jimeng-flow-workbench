/** 视频压缩只允许向下输出 480P 或 360P。 */
export type VideoCompressionTargetHeight = 480 | 360

export interface VideoCompressionRequest {
  targetHeight: VideoCompressionTargetHeight
}

export function normalizeVideoCompressionTargetHeight(
  value: unknown,
): VideoCompressionTargetHeight | null {
  return value === 480 || value === 360 ? value : null
}
