export const MIN_PREVIEW_SCALE = 0.05
export const MAX_PREVIEW_SCALE = 4

export function clampPreviewScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, scale))
}

export function formatPreviewZoom(scale: number): string {
  return `${Math.round(clampPreviewScale(scale) * 100)}%`
}
