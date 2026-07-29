import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import type { VideoCompressionTargetHeight } from '@jimeng-flow/shared/videoCompression'
import {
  formatVideoCompressionPixels,
  getVideoCompressionOptions,
  getVideoCompressionPlan,
} from '../utils/videoCompressionPlan'

interface VideoCompressionOverlayProps {
  open: boolean
  videoUrl: string
  sourceWidth?: number
  sourceHeight?: number
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (
    targetHeight: VideoCompressionTargetHeight,
    outputWidth: number,
    outputHeight: number,
  ) => void
}

export function VideoCompressionOverlay({
  open,
  videoUrl,
  sourceWidth = 0,
  sourceHeight = 0,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: VideoCompressionOverlayProps) {
  const [sourceSize, setSourceSize] = useState({
    width: sourceWidth,
    height: sourceHeight,
  })
  const options = useMemo(
    () => getVideoCompressionOptions(sourceSize.width, sourceSize.height),
    [sourceSize.height, sourceSize.width],
  )
  const [targetHeight, setTargetHeight] =
    useState<VideoCompressionTargetHeight | null>(options[0]?.height ?? null)

  useEffect(() => {
    if (!open) return
    setSourceSize({ width: sourceWidth, height: sourceHeight })
  }, [open, sourceHeight, sourceWidth])

  useEffect(() => {
    const nextOptions = getVideoCompressionOptions(
      sourceSize.width,
      sourceSize.height,
    )
    setTargetHeight((current) =>
      current && nextOptions.some((option) => option.height === current)
        ? current
        : (nextOptions[0]?.height ?? null),
    )
  }, [sourceSize.height, sourceSize.width])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, open])

  if (!open) return null

  const outputPlan = targetHeight
    ? getVideoCompressionPlan(
        sourceSize.width,
        sourceSize.height,
        targetHeight,
      )
    : null
  const sourceKnown = sourceSize.width > 0 && sourceSize.height > 0
  const content = (
    <div
      className="video-compression-overlay"
      role="dialog"
      aria-label="视频压缩"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="video-compression-dialog">
        <header className="video-compression-header">
          <h2>视频压缩</h2>
          <button
            type="button"
            className="video-compression-close"
            aria-label="关闭视频压缩"
            onClick={onCancel}
          >
            <X size={26} strokeWidth={1.8} />
          </button>
        </header>

        <div className="video-compression-content">
          <div className="video-compression-preview">
            <video
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              className="video-compression-preview-media"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  setSourceSize({
                    width: video.videoWidth,
                    height: video.videoHeight,
                  })
                }
              }}
            />
          </div>

          <aside className="video-compression-panel">
            <section className="video-compression-source">
              <h3>源分辨率</h3>
              <div className="video-compression-source-value">
                <strong>
                  {sourceKnown
                    ? `${sourceSize.width} × ${sourceSize.height}`
                    : '读取中…'}
                </strong>
                {sourceKnown ? (
                  <span>
                    {formatVideoCompressionPixels(
                      sourceSize.width,
                      sourceSize.height,
                    )}
                  </span>
                ) : null}
              </div>
            </section>

            <section className="video-compression-target">
              <h3>目标分辨率</h3>
              {options.length > 0 ? (
                <div
                  className="video-compression-options"
                  role="radiogroup"
                  aria-label="目标分辨率"
                >
                  {options.map((option) => {
                    const active = option.height === targetHeight
                    return (
                      <button
                        key={option.height}
                        type="button"
                        className={`video-compression-option${active ? ' active' : ''}`}
                        role="radio"
                        aria-checked={active}
                        disabled={busy}
                        onClick={() => setTargetHeight(option.height)}
                      >
                        <span>{option.height}P</span>
                        <span>
                          {option.width} × {option.height}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="video-compression-empty">
                  {sourceKnown
                    ? '当前视频已不高于 360P'
                    : '正在读取视频分辨率'}
                </p>
              )}
            </section>

            <section className="video-compression-output" aria-live="polite">
              <h3>输出</h3>
              {outputPlan ? (
                <>
                  <strong>
                    {outputPlan.width} × {outputPlan.height}
                  </strong>
                  <div className="video-compression-output-meta">
                    <span>
                      {formatVideoCompressionPixels(
                        outputPlan.width,
                        outputPlan.height,
                      )}
                    </span>
                    <span>约 {Math.round(outputPlan.scale * 100)}%</span>
                    <span className="video-compression-safe">
                      <Check size={15} strokeWidth={2} />
                      仅缩小
                    </span>
                  </div>
                  <p>按原视频比例缩小，保留音频，不裁切画面。</p>
                </>
              ) : (
                <p>请选择可用的目标分辨率。</p>
              )}
            </section>

            {error ? (
              <div className="video-compression-error" role="alert">
                {error}
              </div>
            ) : null}
          </aside>
        </div>

        <footer className="video-compression-footer">
          <button
            type="button"
            className="video-compression-cancel"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="video-compression-confirm"
            disabled={busy || !outputPlan}
            onClick={() => {
              if (!outputPlan) return
              onConfirm(
                outputPlan.height,
                outputPlan.width,
                outputPlan.height,
              )
            }}
          >
            {busy ? '压缩中…' : '确认压缩'}
          </button>
        </footer>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
