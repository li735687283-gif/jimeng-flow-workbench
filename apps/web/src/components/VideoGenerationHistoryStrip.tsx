import { History } from 'lucide-react'
import type { CSSProperties } from 'react'
import { getAssetFileUrl } from '../api/assets'
import {
  getVideoGenerationHistoryPreviewScale,
  type VideoGenerationHistoryItem,
} from '../utils/videoGenerationHistory'

interface VideoGenerationHistoryStripProps {
  items: VideoGenerationHistoryItem[]
  currentAssetId?: string
  onSelect: (item: VideoGenerationHistoryItem) => void
}

export function VideoGenerationHistoryStrip({
  items,
  currentAssetId,
  onSelect,
}: VideoGenerationHistoryStripProps) {
  if (items.length === 0) return null

  return (
    <div className="video-generation-history">
      <div className="video-generation-history-head">
        <History size={12} strokeWidth={1.7} />
        <span>历史版本</span>
      </div>
      <div className="video-generation-history-list">
        {items.map((item) => {
          const isCurrent = item.assetId === currentAssetId
          return (
            <button
              key={`${item.run.generationId}:${item.assetIndex}:${item.assetId}`}
              type="button"
              className={`video-generation-history-item${isCurrent ? ' current' : ''}`}
              style={
                {
                  '--history-preview-scale': String(
                    getVideoGenerationHistoryPreviewScale(),
                  ),
                } as CSSProperties
              }
              onClick={() => onSelect(item)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label="恢复视频历史版本"
            >
              <video
                className="video-generation-history-thumb"
                src={getAssetFileUrl(item.assetId)}
                muted
                playsInline
                preload="metadata"
              />
              <span className="video-generation-history-preview" aria-hidden>
                <video
                  src={getAssetFileUrl(item.assetId)}
                  muted
                  playsInline
                  preload="metadata"
                />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
