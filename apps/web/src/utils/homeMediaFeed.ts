import type { Asset } from '@jimeng-flow/shared/asset'

export const HOME_MEDIA_PAGE_SIZE = 12

export function getHomeMediaColumnCount(viewportWidth?: number): number {
  if (viewportWidth !== undefined && viewportWidth <= 640) return 2
  if (viewportWidth !== undefined && viewportWidth <= 960) return 3
  return 5
}

export function distributeHomeMediaAssets(
  assets: Asset[],
  columnCount: number,
): Asset[][] {
  const normalizedColumnCount = Math.max(1, Math.floor(columnCount))
  const columns = Array.from({ length: normalizedColumnCount }, () => [] as Asset[])
  assets.forEach((asset, index) => columns[index % normalizedColumnCount].push(asset))
  return columns
}

export function getHomeMediaLayoutKey(assets: Asset[]): string {
  return assets.map((asset) => asset.id).join('|')
}

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
