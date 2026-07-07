import {
  ChevronDown,
  Grid2X2,
  ListChecks,
  Menu,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Asset } from '@jimeng-flow/shared/asset'
import { getAssetFileUrl, listAssets } from '../api/assets'

interface AssetLibraryModalProps {
  open: boolean
  onClose: () => void
  onSelectAsset?: (asset: Asset) => void
  initialAssets?: Asset[]
  initialFilter?: AssetFilter
}

const topTabs = [
  { label: '素材库', active: true },
  { label: '画布资产' },
  { label: '图片工具', badge: '外部' },
  { label: '视频工具', badge: '外部' },
]

const filters = ['全部', '图片', '视频', '音频', '文本'] as const
type AssetFilter = (typeof filters)[number]

function assetLabel(asset: Asset): string {
  return asset.prompt?.trim() || (asset.type === 'video' ? '视频生成' : '图片生成')
}

export function AssetLibraryModal({
  open,
  onClose,
  onSelectAsset,
  initialAssets,
  initialFilter = '全部',
}: AssetLibraryModalProps) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets ?? [])
  const [activeFilter, setActiveFilter] = useState<AssetFilter>(initialFilter)
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

  const filteredAssets = assets.filter((asset) => {
    if (activeFilter === '全部') return true
    if (activeFilter === '图片') return asset.type === 'image'
    if (activeFilter === '视频') return asset.type === 'video'
    return false
  })

  return (
    <div className="asset-library-layer" role="dialog" aria-modal="true">
      <section className="asset-library-panel" aria-label="资产库">
        <header className="asset-library-header">
          <div className="asset-library-nav">
            <h2 className="asset-library-title">资产库</h2>
            <nav className="asset-library-tabs" aria-label="资产库标签">
              {topTabs.map((tab) => (
                <button
                  key={tab.label}
                  type="button"
                  className={`asset-tab${tab.active ? ' active' : ''}`}
                >
                  <span>{tab.label}</span>
                  {tab.badge && <span className="asset-tab-badge">{tab.badge}</span>}
                </button>
              ))}
            </nav>
          </div>

          <div className="asset-library-actions">
            <button type="button" className="asset-icon-button" aria-label="网格视图">
              <Grid2X2 size={18} strokeWidth={1.7} />
            </button>
            <div className="asset-size-control" aria-hidden="true">
              <SlidersHorizontal size={15} strokeWidth={1.7} />
              <span className="asset-size-track">
                <span className="asset-size-thumb" />
              </span>
            </div>
            <button
              type="button"
              className="asset-preview-toggle"
              aria-label="实时预览开关"
            >
              <span className="asset-toggle-thumb" />
            </button>
            <span className="asset-preview-label">实时预览</span>
            <span className="asset-action-divider" aria-hidden="true" />
            <button type="button" className="asset-batch-button">
              <Menu size={18} strokeWidth={1.8} />
              <span>批量选择</span>
            </button>
            <button
              type="button"
              className="asset-close-button"
              aria-label="关闭素材库"
              onClick={onClose}
            >
              <X size={22} strokeWidth={1.7} />
            </button>
          </div>
        </header>

        <div className="asset-library-filterbar">
          <button type="button" className="asset-category-button">
            <span>全部分类</span>
            <ChevronDown size={16} strokeWidth={1.7} />
          </button>
          <div className="asset-filter-tabs" aria-label="素材类型">
            {filters.map((filter) => (
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
          ) : assets.length > 0 ? (
            <div className="asset-empty-text">当前分类暂无素材</div>
          ) : (
            <button type="button" className="asset-preview-card">
              <span className="asset-preview-thumb" aria-hidden="true">
                <ListChecks size={34} strokeWidth={1.45} />
              </span>
              <span className="asset-preview-caption">图片生成</span>
            </button>
          )}
        </main>
      </section>
    </div>
  )
}
