import { create } from 'zustand'

export type VideoCaptureHandler = (
  video: HTMLVideoElement,
) => void | Promise<void>

export interface VideoPlayerRequest {
  src: string
  title?: string
  onCaptureFrame?: VideoCaptureHandler
}

interface VideoPlayerStore {
  player: VideoPlayerRequest | null
  openPlayer: (
    src: string,
    title?: string,
    onCaptureFrame?: VideoCaptureHandler,
  ) => void
  closePlayer: () => void
}

/** 首页与画布共用 App 层唯一的播放器实例。 */
export const useVideoPlayerStore = create<VideoPlayerStore>((set, get) => ({
  player: null,
  openPlayer: (src, title, onCaptureFrame) => {
    const normalized = src.trim()
    if (!normalized) return
    set({
      player: {
        src: normalized,
        title: title?.trim() || undefined,
        onCaptureFrame,
      },
    })
  },
  closePlayer: () => {
    if (get().player === null) return
    set({ player: null })
  },
}))