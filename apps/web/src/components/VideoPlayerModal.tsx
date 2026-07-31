import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  LoaderCircle,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react'

export interface VideoPlayerModalProps {
  open: boolean
  src: string
  title?: string
  onClose: () => void
  onCaptureFrame?: (video: HTMLVideoElement) => void | Promise<void>
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 首页和画布共用的全视口播放器。
 * 顶栏、媒体舞台和底部控制栏彼此独立，任何操作都不会覆盖视频画面。
 */
export function VideoPlayerModal({
  open,
  src,
  title,
  onClose,
  onCaptureFrame,
}: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const durationRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureError, setCaptureError] = useState('')

  const closeModal = useCallback(() => {
    const video = videoRef.current
    if (video) {
      try {
        video.pause()
      } catch {
        // ignore
      }
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined)
    }
    document.body.style.overflow = ''
    onCloseRef.current()
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }, [])

  const changeVolume = useCallback((value: number) => {
    const video = videoRef.current
    if (!video) return
    const nextVolume = Math.max(0, Math.min(1, value))
    video.volume = nextVolume
    video.muted = nextVolume === 0
    setVolume(nextVolume)
    setMuted(nextVolume === 0)
  }, [])

  const toggleLoop = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.loop = !video.loop
    setIsLooping(video.loop)
  }, [])

  const handleCaptureFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || !onCaptureFrame || isCapturing) return
    setIsCapturing(true)
    setCaptureError('')
    try {
      await onCaptureFrame(video)
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : '截取当前帧失败')
    } finally {
      setIsCapturing(false)
    }
  }, [isCapturing, onCaptureFrame])

  const performSeek = useCallback((clientX: number) => {
    const video = videoRef.current
    const bar = progressRef.current
    const videoDuration = durationRef.current
    if (!video || !bar || !videoDuration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const targetTime = ratio * videoDuration
    video.currentTime = targetTime
    setCurrentTime(targetTime)
  }, [])

  const handleProgressMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      isDraggingRef.current = true
      setIsDragging(true)
      performSeek(event.clientX)

      const handleWindowMouseMove = (moveEvent: MouseEvent) => {
        if (rafRef.current !== null) return
        rafRef.current = requestAnimationFrame(() => {
          performSeek(moveEvent.clientX)
          rafRef.current = null
        })
      }

      const handleWindowMouseUp = () => {
        isDraggingRef.current = false
        setIsDragging(false)
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        window.removeEventListener('mousemove', handleWindowMouseMove)
        window.removeEventListener('mouseup', handleWindowMouseUp)
      }

      window.addEventListener('mousemove', handleWindowMouseMove)
      window.addEventListener('mouseup', handleWindowMouseUp)
    },
    [performSeek],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeModal()
        return
      }
      if (event.key === ' ' || event.key === 'k') {
        event.preventDefault()
        togglePlay()
      } else if (event.key === 'ArrowLeft') {
        const video = videoRef.current
        if (video) video.currentTime = Math.max(0, video.currentTime - 5)
      } else if (event.key === 'ArrowRight') {
        const video = videoRef.current
        if (video) {
          video.currentTime = Math.min(durationRef.current, video.currentTime + 5)
        }
      } else if (event.key === 'm') {
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [closeModal, open, toggleMute, togglePlay])

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = ''
      return
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined)
    }
    document.body.style.overflow = 'hidden'
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setBuffered(0)
    setIsLooping(false)
    setCaptureError('')
    const timer = window.setTimeout(() => {
      const video = videoRef.current
      if (video) void video.play().catch(() => undefined)
    }, 50)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = ''
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [open, src])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    durationRef.current = video.duration
    setDuration(video.duration)
    setVolume(video.volume)
    setMuted(video.muted)
  }, [])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || isDraggingRef.current) return
    setCurrentTime(video.currentTime)
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1))
    }
  }, [])

  const handleProgress = useCallback(() => {
    const video = videoRef.current
    if (video && video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1))
    }
  }, [])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0

  if (!open) return null

  return (
    <div
      className="video-player-overlay is-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label="视频播放器"
      data-player-mode="fullscreen"
    >
      <div className="video-player-container is-fullscreen">
        <div className="video-player-top-bar visible">
          <button
            type="button"
            className="video-player-control-btn"
            onClick={closeModal}
            title="返回"
            aria-label="返回"
          >
            <ArrowLeft size={20} />
          </button>
          {title ? <span className="video-player-title">{title}</span> : null}
        </div>

        <div className="video-player-stage">
          <video
            ref={videoRef}
            className="video-player-video"
            src={src}
            playsInline
            preload="auto"
            onClick={togglePlay}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onProgress={handleProgress}
          />
        </div>

        <div className="video-player-controls visible">
          {captureError ? (
            <div className="video-player-capture-error" role="alert">
              {captureError}
            </div>
          ) : null}

          <div
            ref={progressRef}
            className={`video-player-progress${isDragging ? ' dragging' : ''}`}
            onMouseDown={handleProgressMouseDown}
          >
            <div className="video-player-progress-track" />
            <div
              className="video-player-progress-buffered"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="video-player-progress-filled"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="video-player-progress-thumb"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <div className="video-player-controls-row">
            <div className="video-player-controls-left">
              <button
                type="button"
                className="video-player-control-btn"
                onClick={togglePlay}
                title={isPlaying ? '暂停' : '播放'}
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <div className="video-player-volume-group">
                <button
                  type="button"
                  className="video-player-control-btn"
                  onClick={toggleMute}
                  title={muted ? '取消静音' : '静音'}
                  aria-label={muted ? '取消静音' : '静音'}
                >
                  {muted || volume === 0 ? (
                    <VolumeX size={18} />
                  ) : (
                    <Volume2 size={18} />
                  )}
                </button>
                <input
                  type="range"
                  className="video-player-volume-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                  aria-label="音量调节"
                />
              </div>

              <span className="video-player-time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="video-player-controls-right">
              {onCaptureFrame ? (
                <button
                  type="button"
                  className="video-player-capture-btn"
                  onClick={() => void handleCaptureFrame()}
                  disabled={isCapturing}
                  title="截取当前帧并放到画布右侧"
                  aria-label="截取当前帧"
                >
                  {isCapturing ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Camera size={15} />
                  )}
                  <span>{isCapturing ? '截取中' : '截取当前帧'}</span>
                </button>
              ) : null}
              <button
                type="button"
                className={`video-player-control-btn${isLooping ? ' active' : ''}`}
                onClick={toggleLoop}
                title="循环播放"
                aria-label="循环播放"
              >
                <Repeat size={16} />
              </button>
              <button
                type="button"
                className="video-player-control-btn"
                onClick={closeModal}
                title="退出放大"
                aria-label="退出放大"
              >
                <Minimize2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}