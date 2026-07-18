import { useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Download, Maximize2, Minimize2 } from 'lucide-react'
import { getAssetFileUrl } from '../api/assets'

export interface ImageResultGalleryProps {
  assetIds: string[]
  primaryAssetId: string
  title?: string
  onSetPrimary: (assetId: string) => void
  onDownload: (assetId: string) => void
  onPrimaryImageLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
}

export function getImageResultAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const assetIds: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const assetId = item.trim()
    if (!assetId || seen.has(assetId)) continue
    seen.add(assetId)
    assetIds.push(assetId)
  }
  return assetIds
}

export function ImageResultGallery({
  assetIds,
  primaryAssetId,
  title = '图片结果',
  onSetPrimary,
  onDownload,
  onPrimaryImageLoad,
}: ImageResultGalleryProps) {
  const normalizedAssetIds = useMemo(() => getImageResultAssetIds(assetIds), [assetIds])
  const [expanded, setExpanded] = useState(false)

  if (normalizedAssetIds.length === 0) return null

  const activePrimaryAssetId = normalizedAssetIds.includes(primaryAssetId)
    ? primaryAssetId
    : normalizedAssetIds[0]

  const renderImage = (assetId: string, className: string) => (
    <img
      className={className}
      src={getAssetFileUrl(assetId)}
      alt={title}
      draggable={false}
      onLoad={assetId === activePrimaryAssetId ? onPrimaryImageLoad : undefined}
    />
  )

  if (normalizedAssetIds.length === 1) {
    return renderImage(activePrimaryAssetId, 'image-result-gallery-single-image')
  }

  if (!expanded) {
    return (
      <div className="image-result-gallery image-result-gallery-collapsed" aria-label={`${normalizedAssetIds.length}张图片`}>
        {normalizedAssetIds.slice(1).map((assetId, index) => (
          <div
            className="image-result-gallery-stack-card"
            key={assetId}
            style={{ transform: `translate(${(index + 1) * 8}px, ${(index + 1) * 10}px) rotate(${(index % 2 ? 0.8 : -0.6) * (index + 1)}deg)` }}
            aria-hidden="true"
          >
            {renderImage(assetId, 'image-result-gallery-stack-image')}
          </div>
        ))}
        <div className="image-result-gallery-stack-card image-result-gallery-stack-card-primary">
          {renderImage(activePrimaryAssetId, 'image-result-gallery-stack-image')}
        </div>
        <button
          type="button"
          className="image-result-gallery-expand nodrag nopan"
          aria-label={`展开${normalizedAssetIds.length}张图片`}
          title={`展开${normalizedAssetIds.length}张图片`}
          onClick={(event) => {
            event.stopPropagation()
            setExpanded(true)
          }}
        >
          <Maximize2 size={14} strokeWidth={2} />
          <span>{normalizedAssetIds.length}张</span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="image-result-gallery-expanded-shell nodrag nopan"
      aria-label={`展开的${normalizedAssetIds.length}张图片`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="image-result-gallery image-result-gallery-expanded">
        <div className="image-result-gallery-grid">
        {normalizedAssetIds.map((assetId) => {
          return (
            <article className="image-result-gallery-tile" key={assetId}>
              {renderImage(assetId, 'image-result-gallery-tile-image')}
              <div className="image-result-gallery-tile-actions">
                <button
                  type="button"
                  className="image-result-gallery-tile-button"
                  aria-label={`下载第${normalizedAssetIds.indexOf(assetId) + 1}张图片`}
                  title="下载"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDownload(assetId)
                  }}
                >
                  <Download size={14} strokeWidth={2} />
                  <span>下载</span>
                </button>
                <button
                  type="button"
                  className="image-result-gallery-tile-button"
                  aria-label={'\u8bbe\u4e3a\u4e3b\u56fe'}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSetPrimary(assetId)
                  }}
                >
                  <span>{'\u8bbe\u4e3a\u4e3b\u56fe'}</span>
                </button>
              </div>
            </article>
          )
        })}
        </div>
      </div>
      <button
        type="button"
        className="image-result-gallery-collapse"
        aria-label="收起图片结果"
        title="收起"
        onClick={() => setExpanded(false)}
      >
        <Minimize2 size={14} strokeWidth={2} />
        <span>收起</span>
      </button>
    </div>
  )
}
