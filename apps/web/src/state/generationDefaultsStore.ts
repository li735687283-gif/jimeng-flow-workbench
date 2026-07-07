import { create } from 'zustand'
import type {
  RememberedImageGenerationDefaults,
  RememberedVideoGenerationDefaults,
} from '../utils/generationDefaults'

const STORAGE_KEY = 'jimeng-flow:last-generation-defaults'

interface GenerationDefaultsSnapshot {
  image: RememberedImageGenerationDefaults | null
  video: RememberedVideoGenerationDefaults | null
}

interface GenerationDefaultsState extends GenerationDefaultsSnapshot {
  rememberImageDefaults: (defaults: RememberedImageGenerationDefaults) => void
  rememberVideoDefaults: (defaults: RememberedVideoGenerationDefaults) => void
}

function loadSnapshot(): GenerationDefaultsSnapshot {
  if (typeof localStorage === 'undefined') return { image: null, video: null }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { image: null, video: null }
    const parsed = JSON.parse(raw) as Partial<GenerationDefaultsSnapshot>
    return {
      image: parsed.image ?? null,
      video: parsed.video ?? null,
    }
  } catch {
    return { image: null, video: null }
  }
}

function saveSnapshot(snapshot: GenerationDefaultsSnapshot): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // 本地存储不可用时只保留当前会话内的 Zustand 状态。
  }
}

export const useGenerationDefaultsStore = create<GenerationDefaultsState>(
  (set, get) => ({
    ...loadSnapshot(),
    rememberImageDefaults: (defaults) => {
      const snapshot = { image: defaults, video: get().video }
      saveSnapshot(snapshot)
      set(snapshot)
    },
    rememberVideoDefaults: (defaults) => {
      const snapshot = { image: get().image, video: defaults }
      saveSnapshot(snapshot)
      set(snapshot)
    },
  }),
)
