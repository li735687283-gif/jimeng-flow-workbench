export const MIN_VIDEO_TRIM_DURATION_SECONDS = 1
export const MAX_VIDEO_TRIM_DURATION_SECONDS = 4

export interface VideoTrimRequest {
  startSeconds: number
  durationSeconds: number
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000
}

export function normalizeVideoTrimRequest(
  value: unknown,
): VideoTrimRequest | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<VideoTrimRequest>
  const startSeconds = Number(candidate.startSeconds)
  const durationSeconds = Number(candidate.durationSeconds)
  if (
    !Number.isFinite(startSeconds) ||
    startSeconds < 0 ||
    startSeconds > 86_400 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < MIN_VIDEO_TRIM_DURATION_SECONDS ||
    durationSeconds > MAX_VIDEO_TRIM_DURATION_SECONDS
  ) {
    return null
  }
  return {
    startSeconds: roundMilliseconds(startSeconds),
    durationSeconds: roundMilliseconds(durationSeconds),
  }
}
