// 即梦 Flow 前端 - 资产状态缓存
// 轻量缓存已加载的 Asset metadata，避免 Inspector 等位置重复请求。
// 参考 PRD 9.3、11.2。M0 可选模块。

import { create } from 'zustand'
import type { Asset } from '@jimeng-flow/shared/asset'
import { getAsset as fetchAssetFromApi } from '../api/assets'

interface AssetState {
  /** id → Asset 缓存 */
  assets: Record<string, Asset>
  /** 同步读取缓存（不触发请求） */
  getCached: (id: string) => Asset | undefined
  /** 读取并缓存；命中缓存则直接返回 */
  fetchAsset: (id: string) => Promise<Asset | undefined>
  /** 写入/覆盖一条缓存（例如上传完成后回填） */
  setAsset: (asset: Asset) => void
  /** 清空缓存 */
  invalidate: () => void
}

export const useAssetStore = create<AssetState>((set, get) => ({
  assets: {},
  getCached: (id) => get().assets[id],
  fetchAsset: async (id) => {
    const cached = get().assets[id]
    if (cached) return cached
    try {
      const asset = await fetchAssetFromApi(id)
      set((state) => ({ assets: { ...state.assets, [id]: asset } }))
      return asset
    } catch {
      return undefined
    }
  },
  setAsset: (asset) =>
    set((state) => ({ assets: { ...state.assets, [asset.id]: asset } })),
  invalidate: () => set({ assets: {} }),
}))
