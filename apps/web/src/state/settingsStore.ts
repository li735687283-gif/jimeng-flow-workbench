// 即梦 Flow 前端 - Settings Zustand store
// 管理 settings 数据、加载状态、派生的"是否已配置"标志。
//
// 注：未配置时"生成按钮置灰"的 UI 由 Task 4 的画布组件实现，
// 这里只提供 isJimengConfigured / isLlmConfigured 派生值供其读取。

import { create } from 'zustand'
import type { Settings } from '@jimeng-flow/shared'
import { getSettings, saveSettings as apiSaveSettings } from '../api/settings'

interface SettingsState {
  settings: Settings | null
  loading: boolean
  error: string | null
  /** 派生：dreamina CLI 路径非空（生成相关链路可用） */
  isJimengConfigured: boolean
  /** 派生：任一 API Provider 配置完整（LLM 文本节点可用） */
  isLlmConfigured: boolean
  /** 拉取最新 settings 并更新派生值 */
  loadSettings: () => Promise<void>
  /** 部分更新 settings（写入后端并同步本地） */
  saveSettings: (partial: Partial<Settings>) => Promise<void>
}

function deriveJimengConfigured(s: Settings | null): boolean {
  return (
    !!s &&
    typeof s.dreaminaPath === 'string' &&
    s.dreaminaPath.trim().length > 0
  )
}

function deriveLlmConfigured(s: Settings | null): boolean {
  if (!s) return false
  const configured = (baseUrl: string, apiKey: string) =>
    baseUrl.trim().length > 0 && apiKey.trim().length > 0
  return (
    configured(s.llmBaseUrl, s.llmApiKey) ||
    configured(s.kimiBaseUrl, s.kimiApiKey) ||
    configured(s.kimiCodingBaseUrl, s.kimiCodingApiKey) ||
    configured(s.deepseekBaseUrl, s.deepseekApiKey)
  )
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,
  error: null,
  isJimengConfigured: false,
  isLlmConfigured: false,

  loadSettings: async () => {
    set({ loading: true, error: null })
    try {
      const settings = await getSettings()
      set({
        settings,
        loading: false,
        isJimengConfigured: deriveJimengConfigured(settings),
        isLlmConfigured: deriveLlmConfigured(settings),
      })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  saveSettings: async (partial) => {
    set({ loading: true, error: null })
    try {
      const settings = await apiSaveSettings(partial)
      set({
        settings,
        loading: false,
        isJimengConfigured: deriveJimengConfigured(settings),
        isLlmConfigured: deriveLlmConfigured(settings),
      })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },
}))

/** 便于非组件代码读取当前 settings */
export function getCurrentSettings(): Settings | null {
  return useSettingsStore.getState().settings
}
