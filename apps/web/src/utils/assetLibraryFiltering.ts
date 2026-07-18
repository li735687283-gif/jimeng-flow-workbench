import type { Asset, AssetCategory } from '@jimeng-flow/shared/asset'

export const ASSET_LIBRARY_FILTERS = ['全部', '角色', '场景', '道具'] as const

export type AssetFilter = (typeof ASSET_LIBRARY_FILTERS)[number]
export type AssetLibraryMode = 'library' | 'history'

export function assetLabel(asset: Asset): string {
  return asset.prompt?.trim() || (asset.type === 'video' ? '视频生成' : '图片生成')
}

/** 前端兜底分类，兼容旧的已入库 metadata。 */
export function getAssetCategory(asset: Asset): AssetCategory {
  if (asset.category) return asset.category
  const text = [asset.prompt, asset.path, asset.provider]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
  if (/(角色|人物|人像|肖像|少年|少女|男孩|女孩|男人|女人|character|portrait|person|human|man|woman)/i.test(text)) {
    return '角色'
  }
  if (/(道具|物品|武器|装备|家具|车辆|汽车|prop|object|item|weapon|tool|furniture|vehicle)/i.test(text)) {
    return '道具'
  }
  return '场景'
}

export function filterAssetLibraryAssets(
  assets: Asset[],
  options: {
    filter: AssetFilter
    query: string
    mode: AssetLibraryMode
    projectId?: string | null
  },
): Asset[] {
  const query = options.query.trim().toLocaleLowerCase()
  const projectId = options.projectId?.trim()

  return assets.filter((asset) => {
    if (options.mode === 'history') {
      if (!asset.provider?.trim()) return false
      const assetProjectId =
        typeof asset.params?.flowId === 'string' ? asset.params.flowId.trim() : ''
      if (!projectId || assetProjectId !== projectId) return false
    }
    if (options.filter !== '全部' && getAssetCategory(asset) !== options.filter) {
      return false
    }
    if (!query) return true

    const searchableText = [
      assetLabel(asset),
      getAssetCategory(asset),
      asset.id,
      asset.provider,
      asset.path,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()

    return searchableText.includes(query)
  })
}
