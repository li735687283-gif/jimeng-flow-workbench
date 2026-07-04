// 即梦 Flow 前端 - Generate 节点调用状态 store
// 管理 per-node 的生成任务状态（status/error/lastRequest/generationId）。
// 支持 cancelWaiting(nodeId) 取消前端等待（不真正 abort 后端）。
// 参考 PRD 8.3（生成任务状态）、12.2、textNodeStore 模式。

import { create } from 'zustand'
import type {
  GenerationRequest,
  GenerationStatus,
} from '@jimeng-flow/shared/generateNode'

/** 单个 Generate 节点的调用状态 */
export interface GenerateCallState {
  status: GenerationStatus
  error?: string
  /** 最近一次请求参数（用于失败后重试） */
  lastRequest?: GenerationRequest
  /** 后端分配的生成任务 id */
  generationId?: string
}

/** idle 状态常量（供组件 selector fallback 使用，确保类型推断为 GenerateCallState） */
export const IDLE_CALL_STATE: GenerateCallState = { status: 'idle' }

interface GenerateStore {
  states: Record<string, GenerateCallState>
  /** 设置节点状态 */
  setStatus: (nodeId: string, status: GenerationStatus) => void
  /** 设置节点错误（undefined 清空错误） */
  setError: (nodeId: string, error?: string) => void
  /** 记录最近一次请求参数（用于重试） */
  setLastRequest: (nodeId: string, request: GenerationRequest) => void
  /** 记录后端分配的生成任务 id */
  setGenerationId: (nodeId: string, generationId?: string) => void
  /** 一次性更新多个字段（合并） */
  patch: (
    nodeId: string,
    patch: Partial<GenerateCallState>,
  ) => void
  /** 获取某节点状态（不存在时返回 idle 状态） */
  get: (nodeId: string) => GenerateCallState
  /** 取消前端等待：把状态重置为 idle，不真正 abort 后端任务（参考 PRD 8.3） */
  cancelWaiting: (nodeId: string) => void
  /** 重置某节点状态 */
  reset: (nodeId: string) => void
}

const IDLE_STATE: GenerateCallState = { status: 'idle' }

export const useGenerateStore = create<GenerateStore>((set, get) => ({
  states: {},

  setStatus: (nodeId, status) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: { ...state.states[nodeId], status },
      },
    })),

  setError: (nodeId, error) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: {
          ...state.states[nodeId],
          error,
          status: error ? 'error' : state.states[nodeId]?.status,
        },
      },
    })),

  setLastRequest: (nodeId, request) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: { ...state.states[nodeId], lastRequest: request },
      },
    })),

  setGenerationId: (nodeId, generationId) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: { ...state.states[nodeId], generationId },
      },
    })),

  patch: (nodeId, p) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: { ...state.states[nodeId], ...p },
      },
    })),

  get: (nodeId) => get().states[nodeId] ?? IDLE_STATE,

  cancelWaiting: (nodeId) =>
    set((state) => ({
      states: {
        ...state.states,
        [nodeId]: {
          ...state.states[nodeId],
          status: 'idle',
          // 保留 error / lastRequest 以便查看历史与重试
        },
      },
    })),

  reset: (nodeId) =>
    set((state) => {
      const next = { ...state.states }
      delete next[nodeId]
      return { states: next }
    }),
}))
