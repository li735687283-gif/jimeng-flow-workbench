// 即梦 Flow 前端 - 文本节点调用状态 store
// 管理 per-node 的 LLM 调用状态（loading/error/lastRequest），支持重试。
// 参考 PRD 8.9、12.2、7.6。

import { create } from 'zustand'
import type { LlmOutputFormat } from '@jimeng-flow/shared/textNode'

/** 单个文本节点的调用状态 */
export interface TextNodeCallState {
  loading: boolean
  error?: string
  /** 最近一次请求参数，用于失败后重试 */
  lastRequest?: {
    model: string
    message: string
    outputFormat?: LlmOutputFormat
  }
}

interface TextNodeStore {
  states: Record<string, TextNodeCallState>
  /** 标记某节点开始/结束调用 */
  setLoading: (nodeId: string, loading: boolean) => void
  /** 设置某节点的错误（undefined 清空错误） */
  setError: (nodeId: string, error?: string) => void
  /** 记录最近一次请求参数（用于重试） */
  setLastRequest: (
    nodeId: string,
    request: { model: string; message: string; outputFormat?: LlmOutputFormat },
  ) => void
  /** 获取某节点状态（不存在时返回 idle 状态） */
  get: (nodeId: string) => TextNodeCallState
  /** 重置某节点状态 */
  reset: (nodeId: string) => void
}

const IDLE_STATE: TextNodeCallState = { loading: false }

export const useTextNodeStore = create<TextNodeStore>((set, get) => ({
  states: {},

  setLoading: (nodeId, loading) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: { ...state.states[nodeId], loading },
      },
    })),

  setError: (nodeId, error) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: { ...state.states[nodeId], error, loading: false },
      },
    })),

  setLastRequest: (nodeId, request) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: { ...state.states[nodeId], lastRequest: request },
      },
    })),

  get: (nodeId) => get().states[nodeId] ?? IDLE_STATE,

  reset: (nodeId) =>
    set((state) => {
      const next = { ...state.states }
      delete next[nodeId]
      return { states: next }
    }),
}))
