import { create } from 'zustand'

export interface VideoPlayerRequest {
  src: string
  title?: string
}

interface VideoPlayerStore {
  player: VideoPlayerRequest | null
  openPlayer: (src: string, title?: string) => void
  closePlayer: () => void
}

/**
 * 全局视频播放器状态。
 * 首页与画布视频节点共用 App 层的 VideoPlayerModal，保证样式与弹出行为一致。
 */
export const useVideoPlayerStore = create<VideoPlayerStore>((set, get) => ({
  player: null,
  openPlayer: (src, title) => {
    const normalized = src.trim()
    if (!normalized) return
    set({
      player: {
        src: normalized,
        title: title?.trim() || undefined,
      },
    })
  },
  closePlayer: () => {
    // 幂等关闭，避免重复点击/Esc 竞态
    if (get().player === null) return
    set({ player: null })
  },
}))
