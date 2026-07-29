import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  GripVertical,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  X,
} from 'lucide-react'
import {
  createInitialVideoTrimRange,
  formatVideoTrimTime,
  getVideoTrimDuration,
  moveVideoTrimEnd,
  moveVideoTrimStart,
  moveVideoTrimWindow,
  type VideoTrimRange,
} from '../utils/videoTrimRange'

interface VideoTrimOverlayProps {
  open: boolean
  videoUrl: string
  sourceWidth?: number
  sourceHeight?: number
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (startSeconds: number, durationSeconds: number) => void
}

type DragMode = 'start' | 'end' | 'window'

interface DragState {
  mode: DragMode
  offsetSeconds: number
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: 'loadeddata' | 'seeked',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error(`等待视频事件超时：${eventName}`))
    }, 5_000)
    const cleanup = () => {
      window.clearTimeout(timeoutId)
      video.removeEventListener(eventName, handleEvent)
      video.removeEventListener('error', handleError)
    }
    const handleEvent = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('视频缩略图读取失败'))
    }
    video.addEventListener(eventName, handleEvent, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

async function createTimelineThumbnails(
  videoUrl: string,
  durationSeconds: number,
  count: number,
): Promise<string[]> {
  const video = document.createElement('video')
  video.src = videoUrl
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  const loadedData = waitForVideoEvent(video, 'loadeddata')
  video.load()
  await loadedData

  const canvas = document.createElement('canvas')
  canvas.width = 180
  canvas.height = 100
  const context = canvas.getContext('2d')
  if (!context) return []

  const thumbnails: string[] = []
  for (let index = 0; index < count; index += 1) {
    const sampleTime = Math.min(
      Math.max(0, durationSeconds - 0.04),
      ((index + 0.5) / count) * durationSeconds,
    )
    const seeked = waitForVideoEvent(video, 'seeked')
    video.currentTime = sampleTime
    await seeked
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    thumbnails.push(canvas.toDataURL('image/jpeg', 0.72))
  }
  video.removeAttribute('src')
  video.load()
  return thumbnails
}

export function VideoTrimOverlay({
  open,
  videoUrl,
  sourceWidth = 0,
  sourceHeight = 0,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: VideoTrimOverlayProps) {
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [sourceDuration, setSourceDuration] = useState(0)
  const [sourceSize, setSourceSize] = useState({
    width: sourceWidth,
    height: sourceHeight,
  })
  const [range, setRange] = useState<VideoTrimRange | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [thumbnails, setThumbnails] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setSourceDuration(0)
    setSourceSize({ width: sourceWidth, height: sourceHeight })
    setRange(null)
    setCurrentTime(0)
    setPlaying(false)
    setThumbnails([])
  }, [open, sourceHeight, sourceWidth, videoUrl])

  useEffect(() => {
    if (!open || sourceDuration <= 0 || typeof document === 'undefined') return
    let cancelled = false
    void createTimelineThumbnails(videoUrl, sourceDuration, 8)
      .then((items) => {
        if (!cancelled) setThumbnails(items)
      })
      .catch(() => {
        if (!cancelled) setThumbnails([])
      })
    return () => {
      cancelled = true
    }
  }, [open, sourceDuration, videoUrl])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
      if (event.code === 'Space' && event.target === document.body) {
        event.preventDefault()
        const video = previewRef.current
        if (video?.paused) {
          void video.play()
        } else {
          video?.pause()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, open])

  const getPointerSeconds = useCallback(
    (clientX: number) => {
      const bounds = timelineRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0 || sourceDuration <= 0) return 0
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - bounds.left) / bounds.width),
      )
      return ratio * sourceDuration
    },
    [sourceDuration],
  )

  useEffect(() => {
    if (!open) return
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || !range) return
      const pointerSeconds = getPointerSeconds(event.clientX)
      setRange((current) => {
        if (!current) return current
        if (drag.mode === 'start') {
          return moveVideoTrimStart(current, pointerSeconds)
        }
        if (drag.mode === 'end') {
          return moveVideoTrimEnd(current, pointerSeconds, sourceDuration)
        }
        return moveVideoTrimWindow(
          current,
          pointerSeconds - drag.offsetSeconds,
          sourceDuration,
        )
      })
    }
    const handlePointerUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [getPointerSeconds, open, range, sourceDuration])

  useEffect(() => {
    if (!range || !previewRef.current) return
    previewRef.current.currentTime = range.startSeconds
    setCurrentTime(range.startSeconds)
  }, [range])

  const selectionDuration = range ? getVideoTrimDuration(range) : 0
  const selectionStyle = useMemo(() => {
    if (!range || sourceDuration <= 0) return undefined
    return {
      left: `${(range.startSeconds / sourceDuration) * 100}%`,
      width: `${(selectionDuration / sourceDuration) * 100}%`,
    }
  }, [range, selectionDuration, sourceDuration])

  const beginDrag = (
    mode: DragMode,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!range || busy) return
    event.preventDefault()
    event.stopPropagation()
    const pointerSeconds = getPointerSeconds(event.clientX)
    dragRef.current = {
      mode,
      offsetSeconds:
        mode === 'window' ? pointerSeconds - range.startSeconds : 0,
    }
  }

  const handleTogglePlayback = async () => {
    const video = previewRef.current
    if (!video || !range) return
    if (!video.paused) {
      video.pause()
      return
    }
    if (
      video.currentTime < range.startSeconds ||
      video.currentTime >= range.endSeconds - 0.02
    ) {
      video.currentTime = range.startSeconds
    }
    await video.play()
  }

  const handleReset = () => {
    const initial = createInitialVideoTrimRange(sourceDuration)
    setRange(initial)
  }

  if (!open) return null

  const content = (
    <div
      className="video-trim-overlay"
      role="dialog"
      aria-label="长度裁切"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="video-trim-dialog">
        <header className="video-trim-header">
          <h2>长度裁切</h2>
          <div className="video-trim-header-actions">
            <div className="video-trim-limit" aria-live="polite">
              <span>已选</span>
              <strong>{formatVideoTrimTime(selectionDuration)}</strong>
              <span>· 限 0:01.0 ~ 0:04.0</span>
            </div>
            <button
              type="button"
              className="video-trim-close"
              aria-label="关闭长度裁切"
              onClick={onCancel}
            >
              <X size={25} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <main className="video-trim-content">
          <div className="video-trim-preview">
            <video
              ref={previewRef}
              src={videoUrl}
              playsInline
              preload="metadata"
              className="video-trim-preview-media"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget
                const duration = Number.isFinite(video.duration)
                  ? video.duration
                  : 0
                setSourceDuration(duration)
                setRange(createInitialVideoTrimRange(duration))
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  setSourceSize({
                    width: video.videoWidth,
                    height: video.videoHeight,
                  })
                }
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(event) => {
                const video = event.currentTarget
                if (range && video.currentTime >= range.endSeconds - 0.01) {
                  video.pause()
                  video.currentTime = range.endSeconds
                }
                setCurrentTime(video.currentTime)
              }}
            />
            <button
              type="button"
              className="video-trim-preview-play"
              aria-label={playing ? '暂停预览' : '播放选中片段'}
              onClick={() => void handleTogglePlayback()}
              disabled={!range}
            >
              {playing ? (
                <Pause size={31} fill="currentColor" />
              ) : (
                <Play size={31} fill="currentColor" />
              )}
            </button>
          </div>

          <div className="video-trim-transport">
            <button
              type="button"
              className="video-trim-play-button"
              aria-label={playing ? '暂停' : '播放'}
              onClick={() => void handleTogglePlayback()}
              disabled={!range}
            >
              {playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>
            <div className="video-trim-time-readout">
              <strong>{formatVideoTrimTime(currentTime)}</strong>
              <span>/ {formatVideoTrimTime(sourceDuration)}</span>
            </div>
            {sourceSize.width > 0 && sourceSize.height > 0 ? (
              <div className="video-trim-resolution">
                {sourceSize.width} × {sourceSize.height}
                <span>裁切后保持原分辨率</span>
              </div>
            ) : null}
          </div>

          <div className="video-trim-points">
            <div className="video-trim-point">
              <span>入点</span>
              <button
                type="button"
                aria-label="入点后退 0.1 秒"
                disabled={!range || busy}
                onClick={() =>
                  setRange((current) =>
                    current
                      ? moveVideoTrimStart(
                          current,
                          current.startSeconds - 0.1,
                        )
                      : current,
                  )
                }
              >
                <Minus size={15} />
              </button>
              <strong>
                {formatVideoTrimTime(range?.startSeconds ?? 0)}
              </strong>
              <button
                type="button"
                aria-label="入点前进 0.1 秒"
                disabled={!range || busy}
                onClick={() =>
                  setRange((current) =>
                    current
                      ? moveVideoTrimStart(
                          current,
                          current.startSeconds + 0.1,
                        )
                      : current,
                  )
                }
              >
                <Plus size={15} />
              </button>
            </div>

            <output className="video-trim-selected-duration">
              {formatVideoTrimTime(selectionDuration)}
            </output>

            <div className="video-trim-point">
              <span>出点</span>
              <button
                type="button"
                aria-label="出点后退 0.1 秒"
                disabled={!range || busy}
                onClick={() =>
                  setRange((current) =>
                    current
                      ? moveVideoTrimEnd(
                          current,
                          current.endSeconds - 0.1,
                          sourceDuration,
                        )
                      : current,
                  )
                }
              >
                <Minus size={15} />
              </button>
              <strong>{formatVideoTrimTime(range?.endSeconds ?? 0)}</strong>
              <button
                type="button"
                aria-label="出点前进 0.1 秒"
                disabled={!range || busy}
                onClick={() =>
                  setRange((current) =>
                    current
                      ? moveVideoTrimEnd(
                          current,
                          current.endSeconds + 0.1,
                          sourceDuration,
                        )
                      : current,
                  )
                }
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          <div
            ref={timelineRef}
            className="video-trim-timeline"
            aria-label="视频裁切时间轴"
            onPointerDown={(event) => {
              if (!range || event.target !== event.currentTarget) return
              const pointerSeconds = getPointerSeconds(event.clientX)
              setRange(
                moveVideoTrimWindow(
                  range,
                  pointerSeconds - selectionDuration / 2,
                  sourceDuration,
                ),
              )
            }}
          >
            <div className="video-trim-thumbnails" aria-hidden="true">
              {thumbnails.length > 0
                ? thumbnails.map((thumbnail, index) => (
                    <img
                      key={`${thumbnail.slice(-20)}-${index}`}
                      src={thumbnail}
                      alt=""
                    />
                  ))
                : Array.from({ length: 8 }, (_, index) => (
                    <span key={index} />
                  ))}
            </div>
            {selectionStyle ? (
              <div
                className="video-trim-selection"
                style={selectionStyle}
                onPointerDown={(event) => beginDrag('window', event)}
              >
                <button
                  type="button"
                  className="video-trim-handle start"
                  aria-label="拖动入点"
                  onPointerDown={(event) => beginDrag('start', event)}
                >
                  <GripVertical size={15} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="video-trim-handle end"
                  aria-label="拖动出点"
                  onPointerDown={(event) => beginDrag('end', event)}
                >
                  <GripVertical size={15} strokeWidth={2.2} />
                </button>
              </div>
            ) : null}
          </div>

          {sourceDuration > 0 && !range ? (
            <p className="video-trim-short-video" role="alert">
              视频不足 1 秒，无法进行长度裁切。
            </p>
          ) : null}
          {error ? (
            <div className="video-trim-error" role="alert">
              {error}
            </div>
          ) : null}
        </main>

        <footer className="video-trim-footer">
          <button
            type="button"
            className="video-trim-reset"
            disabled={!range || busy}
            onClick={handleReset}
          >
            <RotateCcw size={17} />
            重置
          </button>
          <span className="video-trim-shortcut">
            空格播放 · 拖动黄色区域移动片段
          </span>
          <div className="video-trim-footer-actions">
            <button
              type="button"
              className="video-trim-cancel"
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="button"
              className="video-trim-confirm"
              disabled={busy || !range}
              onClick={() => {
                if (!range) return
                onConfirm(range.startSeconds, selectionDuration)
              }}
            >
              <Scissors size={18} />
              {busy ? '裁切中…' : '确认裁切'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
