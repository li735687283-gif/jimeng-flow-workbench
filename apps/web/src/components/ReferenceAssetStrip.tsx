import { Plus, X } from 'lucide-react'
import { getAssetThumbUrl } from '../api/assets'

interface ReferenceAssetStripProps {
  assetIds: string[]
  onRemove?: (assetId: string) => void
  onAdd?: () => void
  maxAssets?: number
}

export function ReferenceAssetStrip({
  assetIds,
  onRemove,
  onAdd,
  maxAssets,
}: ReferenceAssetStripProps) {
  const references = Array.from(
    new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean)),
  )
  const normalizedMaxAssets =
    typeof maxAssets === 'number' && Number.isFinite(maxAssets)
      ? Math.max(0, Math.floor(maxAssets))
      : undefined
  const addDisabled =
    normalizedMaxAssets !== undefined && references.length >= normalizedMaxAssets
  if (references.length === 0 && !onAdd) return null

  return (
    <div
      className="reference-asset-strip"
      aria-label={`已引用 ${references.length} 张图片`}
    >
      {references.map((assetId, index) => {
        const thumbnailUrl = getAssetThumbUrl(assetId, 320)
        const previewUrl = getAssetThumbUrl(assetId, 640)
        return (
          <span
            key={assetId}
            className="reference-asset-thumb"
            title={`引用图 ${index + 1}`}
          >
            <img src={thumbnailUrl} alt="" draggable={false} loading="lazy" />
            <span className="reference-asset-preview" aria-hidden="true">
              <img src={previewUrl} alt="" draggable={false} loading="lazy" />
            </span>
            {onRemove ? (
              <button
                type="button"
                className="reference-asset-remove"
                aria-label={`取消引用图 ${index + 1}`}
                title="取消引用"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(assetId)
                }}
              >
                <X size={12} strokeWidth={2.2} />
              </button>
            ) : null}
          </span>
        )
      })}
      {onAdd ? (
        <button
          type="button"
          className="reference-asset-add"
          aria-label={addDisabled ? `参考图片已达上限 ${normalizedMaxAssets} 张` : '从素材库添加参考图片'}
          title={addDisabled ? `最多引用 ${normalizedMaxAssets} 张图片` : '从素材库添加参考图片'}
          disabled={addDisabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            if (!addDisabled) onAdd()
          }}
        >
          <Plus size={24} strokeWidth={1.7} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export default ReferenceAssetStrip
