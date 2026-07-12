import type { Asset } from '@jimeng-flow/shared/asset'

export const ASSET_LIBRARY_FILTERS = ['全部', '图片', '视频'] as const

export type AssetFilter = (typeof ASSET_LIBRARY_FILTERS)[number]
export type AssetLibraryMode = 'library' | 'history'

export function assetLabel(asset: Asset): string {
  return asset.prompt?.trim() || (asset.type === 'video' ? '视频生成' : '图片生成')
}

export function filterAssetLibraryAssets(
  assets: Asset[],
  options: {
    filter: AssetFilter
    query: string
    mode: AssetLibraryMode
  },
): Asset[] {
  const query = options.query.trim().toLocaleLowerCase()

  return assets.filter((asset) => {
    if (options.mode === 'history' && !asset.provider?.trim()) return false
    if (options.filter === '图片' && asset.type !== 'image') return false
    if (options.filter === '视频' && asset.type !== 'video') return false
    if (!query) return true

    const searchableText = [assetLabel(asset), asset.id, asset.provider, asset.path]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()

    return searchableText.includes(query)
  })
}
