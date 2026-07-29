import {
  MAX_VIDEO_TRIM_DURATION_SECONDS,
  MIN_VIDEO_TRIM_DURATION_SECONDS,
} from '@jimeng-flow/shared/videoTrim'

export interface VideoTrimRange {
  startSeconds: number
  endSeconds: number
}

function roundTenths(value: number): number {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function createInitialVideoTrimRange(
  sourceDuration: number,
): VideoTrimRange | null {
  if (
    !Number.isFinite(sourceDuration) ||
    sourceDuration < MIN_VIDEO_TRIM_DURATION_SECONDS
  ) {
    return null
  }
  return {
    startSeconds: 0,
    endSeconds: roundTenths(
      Math.min(sourceDuration, MAX_VIDEO_TRIM_DURATION_SECONDS),
    ),
  }
}

export function moveVideoTrimStart(
  range: VideoTrimRange,
  proposedStart: number,
): VideoTrimRange {
  const startSeconds = roundTenths(
    clamp(
      proposedStart,
      Math.max(0, range.endSeconds - MAX_VIDEO_TRIM_DURATION_SECONDS),
      range.endSeconds - MIN_VIDEO_TRIM_DURATION_SECONDS,
    ),
  )
  return { ...range, startSeconds }
}

export function moveVideoTrimEnd(
  range: VideoTrimRange,
  proposedEnd: number,
  sourceDuration: number,
): VideoTrimRange {
  const endSeconds = roundTenths(
    clamp(
      proposedEnd,
      range.startSeconds + MIN_VIDEO_TRIM_DURATION_SECONDS,
      Math.min(
        sourceDuration,
        range.startSeconds + MAX_VIDEO_TRIM_DURATION_SECONDS,
      ),
    ),
  )
  return { ...range, endSeconds }
}

export function moveVideoTrimWindow(
  range: VideoTrimRange,
  proposedStart: number,
  sourceDuration: number,
): VideoTrimRange {
  const duration = range.endSeconds - range.startSeconds
  const startSeconds = roundTenths(
    clamp(proposedStart, 0, Math.max(0, sourceDuration - duration)),
  )
  return {
    startSeconds,
    endSeconds: roundTenths(startSeconds + duration),
  }
}

export function getVideoTrimDuration(range: VideoTrimRange): number {
  return roundTenths(range.endSeconds - range.startSeconds)
}

export function formatVideoTrimTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = (safeSeconds - minutes * 60).toFixed(1).padStart(4, '0')
  return `${minutes}:${remainder}`
}
