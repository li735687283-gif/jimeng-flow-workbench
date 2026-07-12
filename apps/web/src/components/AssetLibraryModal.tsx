import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Asset } from '@jimeng-flow/shared/asset'
import { getAssetFileUrl, listAssets } from '../api/assets'
import {
  ASSET_LIBRARY_FILTERS,
  assetLabel,
  filterAssetLibraryAssets,
  type AssetFilter,
  type AssetLibraryMode,
} from '../utils/assetLibraryFiltering'

interface AssetLibraryModalProps {
  open: boolean
  onClose: () => void
  onSelectAsset?: (asset: Asset) => void
  initialAssets?: Asset[]
  initialFilter?: AssetFilter
  mode?: AssetLibraryMode
}

export function AssetLibraryModal({
  open,
  onClose,
  onSelectAsset,
  initialAssets,
  initialFilter = '全部',
  mode = 'library',
}: AssetLibraryModalProps) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets ?? [])
  const [activeFilter, setActiveFilter] = useState<AssetFilter>(initialFilter)
  const [query, setQuery] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initialAssets) {
      setAssets(initialAssets)
      return
    }
    let cancelled = false
    setLoadError(null)
    listAssets()
      .then((items) => {
        if (!cancelled) setAssets(items)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, initialAssets])

  if (!open) return null

  const isHistory = mode === 'history'
  const title = isHistory ? '历史记录' : '素材库'
  const searchLabel = isHistory ? '搜索历史记录' : '搜索素材'
  const filteredAssets = filterAssetLibraryAssets(assets, {
    filter: activeFilter,
    query,
    mode,
  })

  return (
    <div className="asset-library-layer" role="dialog" aria-modal="true">
      <section className="asset-library-panel" aria-label={title}>
        <header className="asset-library-header">
          <h2 className="asset-library-title">{title}</h2>
          <button
            type="button"
            className="asset-close-button"
            aria-label={`关闭${title}`}
            onClick={onClose}
          >
            <X size={22} strokeWidth={1.7} />
          </button>
        </header>

        <div className="asset-library-filterbar">
          <label className="asset-library-search">
            <Search size={17} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder={searchLabel}
              aria-label={searchLabel}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="asset-filter-tabs" aria-label="素材类型">
            {ASSET_LIBRARY_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`asset-filter${filter === activeFilter ? ' active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <main className="asset-library-content">
          {loadError && <div className="asset-empty-text">素材加载失败：{loadError}</div>}
          {filteredAssets.length > 0 ? (
            <div className="asset-preview-grid">
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="asset-preview-card"
                  title={assetLabel(asset)}
                  data-source-node-id={asset.sourceNodeId}
                  onClick={() => onSelectAsset?.(asset)}
                >
                  <span className="asset-preview-thumb asset-media-thumb">
                    {asset.type === 'video' ? (
                      <video
                        src={getAssetFileUrl(asset.id)}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img src={getAssetFileUrl(asset.id)} alt={assetLabel(asset)} />
                    )}
                  </span>
                  <span className="asset-preview-caption">{assetLabel(asset)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="asset-empty-text">
              {query || assets.length > 0
                ? isHistory
                  ? '没有匹配的历史记录'
                  : '没有匹配的素材'
                : isHistory
                  ? '暂无生成记录'
                  : '暂无素材'}
            </div>
          )}
        </main>
      </section>
    </div>
  )
}
