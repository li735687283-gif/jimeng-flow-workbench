import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

export interface VideoPlayerModalProps {
  open: boolean
  src: string
  title?: string
  onClose: () => void
  variant?: 'default' | 'compact'
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function VideoPlayerModal({ open, src, title, onClose, variant = 'default' }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const volumePopoverRef = useRef<HTMLDivElement>(null)
  const speedPopoverRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const durationRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [showSpeed, setShowSpeed] = useState(false)

  const isCompact = variant === 'compact'

  const resetState = useCallback(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    durationRef.current = 0
    setBuffered(0)
    setVolume(1)
    setMuted(false)
    setPlaybackRate(1)
    setIsLooping(false)
    isDraggingRef.current = false
    setIsDragging(false)
    setShowVolume(false)
    setShowSpeed(false)
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) {
      void video.play()
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

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.()
    } else {
      void document.exitFullscreen?.()
    }
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

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    setIsDragging(true)
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
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
  }, [performSeek])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          void document.exitFullscreen()
        } else {
          onClose()
        }
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowLeft') {
        const video = videoRef.current
        if (video) video.currentTime = Math.max(0, video.currentTime - 5)
      } else if (e.key === 'ArrowRight') {
        const video = videoRef.current
        if (video) video.currentTime = Math.min(durationRef.current, video.currentTime + 5)
      } else if (e.key === 'f') {
        toggleFullscreen()
      } else if (e.key === 'm') {
        toggleMute()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, togglePlay, toggleMute, toggleFullscreen])

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        volumePopoverRef.current &&
        !volumePopoverRef.current.contains(e.target as Node)
      ) {
        setShowVolume(false)
      }
      if (
        speedPopoverRef.current &&
        !speedPopoverRef.current.contains(e.target as Node)
      ) {
        setShowSpeed(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) {
      const video = videoRef.current
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      resetState()
    } else {
      resetState()
    }
  }, [open, resetState])

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
    if (!video) return
    if (isDraggingRef.current) return
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

  const handleVideoClick = useCallback(() => {
    togglePlay()
  }, [togglePlay])

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
  }, [])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (isCompact && e.target === e.currentTarget) {
      onClose()
    }
  }, [isCompact, onClose])

  if (!open) return null

  const iconSize = isCompact ? 18 : 20
  const smallIconSize = isCompact ? 16 : 18

  return (
    <div
      className={`video-player-overlay${isCompact ? ' is-compact' : ''}`}
      onClick={handleOverlayClick}
    >
      <div
        ref={containerRef}
        className={`video-player-wrapper${isFullscreen ? ' fullscreen' : ''}${isCompact ? ' compact' : ''}`}
      >
        <div className={`video-player-header${isCompact ? ' compact' : ''}`}>
          {isCompact ? (
            <>
              {title && <span className="video-player-title-external">{title}</span>}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="video-player-close-btn"
                onClick={onClose}
                title="关闭"
              >
                <X size={20} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="video-player-back-btn"
                onClick={onClose}
                title="返回"
              >
                <ArrowLeft size={22} />
                <span>返回</span>
              </button>
              {title && <span className="video-player-title-external">{title}</span>}
              <div style={{ flex: 1 }} />
            </>
          )}
        </div>

        <div className="video-player-stage">
          <video
            ref={videoRef}
            className="video-player-video"
            src={src}
            playsInline
            preload="auto"
            onClick={handleVideoClick}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onProgress={handleProgress}
          />
        </div>

        <div className={`video-player-controls-external${isCompact ? ' compact' : ''}`}>
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
                className={`video-player-control-btn${isCompact ? ' compact' : ''}`}
                onClick={togglePlay}
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause size={iconSize} /> : <Play size={iconSize} />}
              </button>

              <div className="video-player-volume-group" ref={volumePopoverRef}>
                <button
                  type="button"
                  className={`video-player-control-btn${isCompact ? ' compact' : ''}`}
                  onClick={() => {
                    if (muted || volume === 0) {
                      changeVolume(volume > 0 ? volume : 0.7)
                    } else {
                      setShowVolume((v) => !v)
                    }
                  }}
                  title="音量"
                >
                  {muted || volume === 0 ? <VolumeX size={iconSize} /> : <Volume2 size={iconSize} />}
                </button>
                <div
                  className={`video-player-volume-popover${showVolume ? ' visible' : ''}`}
                >
                  <input
                    type="range"
                    className="video-player-volume-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                  />
                </div>
              </div>

              <span className={`video-player-time${isCompact ? ' compact' : ''}`}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="video-player-controls-right">
              <button
                type="button"
                className={`video-player-control-btn${isCompact ? ' compact' : ''}${isLooping ? ' active' : ''}`}
                onClick={toggleLoop}
                title="循环播放"
              >
                <Repeat size={smallIconSize} />
              </button>

              <div className="video-player-speed-group" ref={speedPopoverRef}>
                <button
                  type="button"
                  className={`video-player-speed-btn${isCompact ? ' compact' : ''}`}
                  onClick={() => setShowSpeed((v) => !v)}
                >
                  {playbackRate}x
                </button>
                <div
                  className={`video-player-speed-popover${showSpeed ? ' visible' : ''}`}
                >
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      className={`video-player-speed-option${rate === playbackRate ? ' active' : ''}`}
                      onClick={() => changePlaybackRate(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className={`video-player-control-btn${isCompact ? ' compact' : ''}`}
                onClick={toggleFullscreen}
                title={isFullscreen ? '退出全屏' : '全屏'}
              >
                <Maximize2 size={iconSize} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
