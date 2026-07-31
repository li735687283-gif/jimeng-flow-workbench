import { CircleCheck, Eye, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Asset } from '@jimeng-flow/shared/asset'
import {
  getAssetFileUrl,
  getAssetThumbUrl,
  listAssets,
  listLibraryAssets,
} from '../api/assets'
import { useVideoPlayerStore } from '../state/videoPlayerStore'
import {
  ASSET_LIBRARY_FILTERS,
  assetLabel,
  filterAssetLibraryAssets,
  getAssetCategory,
  type AssetFilter,
  type AssetLibraryMode,
} from '../utils/assetLibraryFiltering'

interface AssetLibraryModalProps {
  open: boolean
  onClose: () => void
  initialAssets?: Asset[]
  initialFilter?: AssetFilter
  mode?: AssetLibraryMode
  projectId?: string | null
  acceptedTypes?: readonly Asset['type'][]
  onApplyAsset?: (asset: Asset) => void
}

export function AssetLibraryModal({
  open,
  onClose,
  initialAssets,
  initialFilter = '全部',
  mode = 'library',
  projectId,
  acceptedTypes,
  onApplyAsset,
}: AssetLibraryModalProps) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets ?? [])
  const [activeFilter, setActiveFilter] = useState<AssetFilter>(initialFilter)
  const [query, setQuery] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const openVideoPlayer = useVideoPlayerStore((state) => state.openPlayer)

  useEffect(() => {
    if (!open) return
    if (initialAssets) {
      setAssets(initialAssets)
      return
    }
    let cancelled = false
    setLoadError(null)
    const load = mode === 'library' ? listLibraryAssets : listAssets
    load()
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
  }, [open, initialAssets, mode])

  useEffect(() => {
    if (!open) {
      setPreviewAsset(null)
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (previewAsset) {
        setPreviewAsset(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open, previewAsset])

  if (!open) return null

  const isHistory = mode === 'history'
  const title = onApplyAsset ? '选择参考图片' : isHistory ? '历史记录' : '素材库'
  const filteredAssets = filterAssetLibraryAssets(assets, {
    filter: activeFilter,
    query,
    mode,
    projectId,
  }).filter(
    (asset) => !acceptedTypes || acceptedTypes.includes(asset.type),
  )

  const handleViewAsset = (asset: Asset) => {
    const label = assetLabel(asset)
    if (asset.type === 'video') {
      openVideoPlayer(getAssetFileUrl(asset.id), label)
      return
    }
    setPreviewAsset(asset)
  }

  return (
    <>
      <div
        className="asset-library-layer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
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
            {!isHistory && (
              <label className="asset-library-search">
                <Search size={17} strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  aria-label="搜索素材"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            )}
            <div className="asset-filter-tabs" aria-label="资产分类">
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
                {filteredAssets.map((asset) => {
                  const label = assetLabel(asset)
                  return (
                    <article
                      key={asset.id}
                      className="asset-preview-card"
                      title={label}
                      data-source-node-id={asset.sourceNodeId}
                      aria-label={label}
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
                          <img src={getAssetThumbUrl(asset.id, 320)} alt={label} loading="lazy" />
                        )}
                        <span className="asset-preview-actions">
                          <button
                            type="button"
                            aria-label={`查看素材：${label}`}
                            title="查看"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleViewAsset(asset)
                            }}
                          >
                            <Eye size={20} strokeWidth={1.8} aria-hidden="true" />
                            <span>查看</span>
                          </button>
                          {onApplyAsset ? (
                            <button
                              type="button"
                              aria-label={`应用素材：${label}`}
                              title="应用"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                onApplyAsset(asset)
                              }}
                            >
                              <CircleCheck size={20} strokeWidth={1.8} aria-hidden="true" />
                              <span>应用</span>
                            </button>
                          ) : null}
                        </span>
                      </span>
                      <span className="asset-preview-caption">{label}</span>
                      <span className="asset-preview-category">{getAssetCategory(asset)}</span>
                    </article>
                  )
                })}
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

      {previewAsset?.type === 'image' ? (
        <div
          className="asset-image-preview-layer"
          role="dialog"
          aria-modal="true"
          aria-label={`查看素材：${assetLabel(previewAsset)}`}
          onClick={() => setPreviewAsset(null)}
        >
          <header className="asset-image-preview-header">
            <span>{assetLabel(previewAsset)}</span>
            <button
              type="button"
              aria-label="关闭素材预览"
              title="关闭"
              onClick={() => setPreviewAsset(null)}
            >
              <X size={21} strokeWidth={1.8} />
            </button>
          </header>
          <img
            src={getAssetFileUrl(previewAsset.id)}
            alt={assetLabel(previewAsset)}
            draggable={false}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  )
}
