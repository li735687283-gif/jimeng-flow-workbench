import { X } from 'lucide-react'
import { getAssetFileUrl } from '../api/assets'

interface ReferenceAssetStripProps {
  assetIds: string[]
  onRemove?: (assetId: string) => void
}

export function ReferenceAssetStrip({
  assetIds,
  onRemove,
}: ReferenceAssetStripProps) {
  const references = Array.from(
    new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean)),
  )
  if (references.length === 0) return null

  return (
    <div
      className="reference-asset-strip"
      aria-label={`已引用 ${references.length} 张图片`}
    >
      {references.map((assetId, index) => {
        const assetUrl = getAssetFileUrl(assetId)
        return (
          <span
            key={assetId}
            className="reference-asset-thumb"
            title={`引用图 ${index + 1}`}
          >
            <img src={assetUrl} alt="" draggable={false} />
            <span className="reference-asset-preview" aria-hidden="true">
              <img src={assetUrl} alt="" draggable={false} />
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
    </div>
  )
}

export default ReferenceAssetStrip
