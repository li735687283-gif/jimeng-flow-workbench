import type { Asset } from '@jimeng-flow/shared/asset'

export const HOME_MEDIA_PAGE_SIZE = 12

export function filterCanvasGeneratedAssets(assets: Asset[]): Asset[] {
  return assets
    .filter((asset) => {
      if (asset.params?.origin === 'upload') return false
      return typeof asset.sourceNodeId === 'string' && asset.sourceNodeId.trim().length > 0
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function getNextHomeMediaVisibleCount(
  current: number,
  total: number,
  pageSize: number = HOME_MEDIA_PAGE_SIZE,
): number {
  const normalizedTotal = Math.max(0, Math.floor(total))
  const normalizedCurrent = Math.max(0, Math.floor(current))
  const normalizedPageSize = Math.max(1, Math.floor(pageSize))
  return Math.min(
    normalizedTotal,
    Math.max(normalizedPageSize, normalizedCurrent + normalizedPageSize),
  )
}
