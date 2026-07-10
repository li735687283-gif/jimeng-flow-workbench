import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Maximize2,
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
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 两级播放体验（首页 / 画布共用）：
 * 1. 双击或工具条放大 → 居中「小播放器」弹层（非全屏）
 * 2. 小播放器内再点放大 → 全屏（浏览器 Fullscreen，失败则 CSS 铺满）
 */
export function VideoPlayerModal({ open, src, title, onClose }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const volumePopoverRef = useRef<HTMLDivElement>(null)
  const speedPopoverRef = useRef<HTMLDivElement>(null)
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const [playbackRate, setPlaybackRate] = useState(1)
  /** 仅二级全屏为 true；打开弹层时必须为 false */
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [showSpeed, setShowSpeed] = useState(false)
  const [showControls, setShowControls] = useState(true)

  const clearHideTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current)
      hideControlsTimer.current = null
    }
  }, [])

  const scheduleHideControls = useCallback(() => {
    clearHideTimer()
    hideControlsTimer.current = setTimeout(() => {
      const video = videoRef.current
      if (
        video &&
        !video.paused &&
        !showVolume &&
        !showSpeed &&
        !isDraggingRef.current
      ) {
        setShowControls(false)
      }
    }, 2500)
  }, [clearHideTimer, showVolume, showSpeed])

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    scheduleHideControls()
  }, [scheduleHideControls])

  const exitFullscreenOnly = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined)
    }
    setIsFullscreen(false)
  }, [])

  const closeModal = useCallback(() => {
    clearHideTimer()
    const video = videoRef.current
    if (video) {
      try {
        video.pause()
      } catch {
        // ignore
      }
    }
    exitFullscreenOnly()
    document.body.style.overflow = ''
    onCloseRef.current()
  }, [clearHideTimer, exitFullscreenOnly])

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
    const v = Math.max(0, Math.min(1, value))
    video.volume = v
    video.muted = v === 0
    setVolume(v)
    setMuted(v === 0)
  }, [])

  /**
   * 二级：仅播放器内「全屏」按钮进入全屏。
   * 双击 / 打开弹层时绝不调用。
   * 使用应用内铺满（CSS），不自动 requestFullscreen，避免误进系统全屏。
   */
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined)
      setIsFullscreen(false)
      return
    }
    setIsFullscreen((prev) => !prev)
  }, [])

  const changePlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
    setPlaybackRate(rate)
    setShowSpeed(false)
  }, [])

  const toggleLoop = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.loop = !video.loop
    setIsLooping(video.loop)
  }, [])

  const performSeek = useCallback((clientX: number) => {
    const video = videoRef.current
    const bar = progressRef.current
    const dur = durationRef.current
    if (!video || !bar || !dur) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const targetTime = ratio * dur
    video.currentTime = targetTime
    setCurrentTime(targetTime)
  }, [])

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      isDraggingRef.current = true
      setIsDragging(true)
      setShowControls(true)
      performSeek(e.clientX)

      const handleWindowMouseMove = (ev: MouseEvent) => {
        if (rafRef.current !== null) return
        rafRef.current = requestAnimationFrame(() => {
          performSeek(ev.clientX)
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
        scheduleHideControls()
      }

      window.addEventListener('mousemove', handleWindowMouseMove)
      window.addEventListener('mouseup', handleWindowMouseUp)
    },
    [performSeek, scheduleHideControls],
  )

  // Esc：全屏时先退回小播放器；小播放器再 Esc 才关闭
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (document.fullscreenElement || isFullscreen) {
          exitFullscreenOnly()
        } else {
          closeModal()
        }
        return
      }
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowLeft') {
        const video = videoRef.current
        if (video) video.currentTime = Math.max(0, video.currentTime - 5)
      } else if (e.key === 'ArrowRight') {
        const video = videoRef.current
        if (video)
          video.currentTime = Math.min(durationRef.current, video.currentTime + 5)
      } else if (e.key === 'f') {
        toggleFullscreen()
      } else if (e.key === 'm') {
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [
    open,
    closeModal,
    exitFullscreenOnly,
    isFullscreen,
    togglePlay,
    toggleFullscreen,
    toggleMute,
  ])

  useEffect(() => {
    // 应用内全屏不依赖 Fullscreen API；若外部进了系统全屏则退出并保持 windowed
    const onFs = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined)
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (volumePopoverRef.current && !volumePopoverRef.current.contains(t)) {
        setShowVolume(false)
      }
      if (speedPopoverRef.current && !speedPopoverRef.current.contains(t)) {
        setShowSpeed(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  // 打开 = 一级小播放器（windowed）；关闭时清理。绝不全屏打开。
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = ''
      setIsFullscreen(false)
      return
    }
    // 强制非全屏打开：清掉任何残留系统全屏 + CSS 全屏态
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined)
    }
    setIsFullscreen(false)
    document.body.style.overflow = 'hidden'
    setShowControls(true)
    setShowVolume(false)
    setShowSpeed(false)
    const t = window.setTimeout(() => {
      // 再保险：下一帧仍保持 windowed
      setIsFullscreen(false)
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined)
      }
      const video = videoRef.current
      if (!video) return
      void video.play().catch(() => undefined)
    }, 50)
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = ''
      clearHideTimer()
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined)
      }
      setIsFullscreen(false)
    }
  }, [open, src, clearHideTimer])

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

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    scheduleHideControls()
  }, [scheduleHideControls])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
    setShowControls(true)
  }, [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    setShowControls(true)
  }, [])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0

  if (!open) return null

  return (
    <div
      className={`video-player-overlay${isFullscreen ? ' is-fullscreen' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="视频小播放器"
      data-player-mode={isFullscreen ? 'fullscreen' : 'windowed'}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        const video = videoRef.current
        if (video && !video.paused) setShowControls(false)
      }}
      onClick={() => {
        // 全屏时点遮罩不关；小播放器点遮罩关闭
        if (!isFullscreen) closeModal()
      }}
    >
      {/* 一级：居中小播放器（默认） / 二级：全屏铺满 */}
      <div
        ref={containerRef}
        className={`video-player-container${isFullscreen ? ' is-fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          className="video-player-video"
          src={src}
          playsInline
          preload="auto"
          onClick={togglePlay}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onProgress={handleProgress}
        />

        <div className="video-player-top-bar visible">
          <button
            type="button"
            className="video-player-icon-btn"
            onClick={() => {
              if (isFullscreen) {
                exitFullscreenOnly()
              } else {
                closeModal()
              }
            }}
            title={isFullscreen ? '退出全屏' : '关闭播放器'}
            aria-label={isFullscreen ? '退出全屏' : '关闭播放器'}
          >
            <ArrowLeft size={20} />
          </button>
          {title ? <span className="video-player-title">{title}</span> : null}
          <div style={{ flex: 1 }} />
        </div>

        <div
          className={`video-player-controls${showControls ? ' visible' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
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
                className="video-player-icon-btn"
                onClick={togglePlay}
                title={isPlaying ? '暂停' : '播放'}
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <div className="video-player-volume-group" ref={volumePopoverRef}>
                <button
                  type="button"
                  className="video-player-icon-btn"
                  onClick={() => {
                    if (muted || volume === 0) {
                      changeVolume(volume > 0 ? volume : 0.7)
                    } else {
                      setShowVolume((v) => !v)
                    }
                  }}
                  title="音量"
                  aria-label="音量"
                >
                  {muted || volume === 0 ? (
                    <VolumeX size={18} />
                  ) : (
                    <Volume2 size={18} />
                  )}
                </button>
                <div
                  className={`video-player-volume-popover${
                    showVolume ? ' visible' : ''
                  }`}
                >
                  <input
                    type="range"
                    className="video-player-volume-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    aria-label="音量调节"
                  />
                </div>
              </div>

              <span className="video-player-time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="video-player-controls-right">
              <button
                type="button"
                className={`video-player-icon-btn${isLooping ? ' active' : ''}`}
                onClick={toggleLoop}
                title="循环播放"
                aria-label="循环播放"
              >
                <Repeat size={16} />
              </button>

              <div className="video-player-speed-group" ref={speedPopoverRef}>
                <button
                  type="button"
                  className="video-player-speed-btn"
                  onClick={() => setShowSpeed((v) => !v)}
                  aria-label="播放速度"
                >
                  {playbackRate}x
                </button>
                <div
                  className={`video-player-speed-popover${
                    showSpeed ? ' visible' : ''
                  }`}
                >
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      className={`video-player-speed-option${
                        rate === playbackRate ? ' active' : ''
                      }`}
                      onClick={() => changePlaybackRate(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* 仅此处进入 / 退出全屏；打开时不会走到这里 */}
              <button
                type="button"
                className="video-player-icon-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? '退出全屏' : '全屏'}
                aria-label={isFullscreen ? '退出全屏' : '全屏'}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
