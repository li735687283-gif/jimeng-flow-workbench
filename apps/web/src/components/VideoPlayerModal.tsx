import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Maximize2,
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
  const [showControls, setShowControls] = useState(true)

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
    setShowControls(true)
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    hideControlsTimer.current = setTimeout(() => {
      const video = videoRef.current
      if (video && !video.paused && !showVolume && !showSpeed && !isDraggingRef.current) {
        setShowControls(false)
      }
    }, 2500)
  }, [showVolume, showSpeed])

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    scheduleHideControls()
  }, [scheduleHideControls])

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
  }, [performSeek, scheduleHideControls])

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
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
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
      className="video-player-overlay"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        const video = videoRef.current
        if (video && !video.paused) setShowControls(false)
      }}
    >
      <div
        ref={containerRef}
        className={`video-player-container${isFullscreen ? ' fullscreen' : ''}`}
      >
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

        <div
          className={`video-player-top-bar${showControls ? ' visible' : ''}`}
        >
          <button
            type="button"
            className="video-player-icon-btn"
            onClick={onClose}
            title="返回"
          >
            <ArrowLeft size={20} />
          </button>
          {title && <span className="video-player-title">{title}</span>}
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
                >
                  {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
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
                    orient="vertical"
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
              >
                <Repeat size={16} />
              </button>

              <div className="video-player-speed-group" ref={speedPopoverRef}>
                <button
                  type="button"
                  className="video-player-speed-btn"
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
                className="video-player-icon-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? '退出全屏' : '全屏'}
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
