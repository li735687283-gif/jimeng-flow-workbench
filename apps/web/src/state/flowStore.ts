// 即梦 Flow 前端 - flowStore（Zustand）
// 管理当前工作流状态：id / name / 加载保存状态 / 历史列表。
// 通过 useCanvasStore.getState() / setState 读写画布的 nodes / edges，
// 实现"工作流元数据"与"画布数据"的解耦联动。
// 参考 PRD 10.2、11.1、8.5。

import { create } from 'zustand'
import type { FlowSummary } from '@jimeng-flow/shared/flow'
import * as flowsApi from '../api/flows'
import { useCanvasStore } from './canvasStore'

interface FlowState {
  /** 当前工作流 id（null 表示尚未加载/新建） */
  currentFlowId: string | null
  /** 当前工作流名称 */
  currentFlowName: string
  /** 列表加载中 */
  loading: boolean
  /** 保存中 */
  saving: boolean
  /** 最近一次保存成功的时间戳（ms） */
  lastSavedAt: number | null
  /** 历史工作流摘要列表 */
  flowList: FlowSummary[]
  /** 错误信息（最近一次） */
  error: string | null

  /** 拉取工作流列表 */
  loadFlowList: () => Promise<FlowSummary[]>
  /** 加载某个工作流到画布 */
  loadFlow: (id: string) => Promise<void>
  /** 新建空白工作流并清空画布 */
  createFlow: () => Promise<void>
  /** 保存当前画布到后端（PUT） */
  saveCurrent: () => Promise<void>
  /** 更新当前工作流名称（本地 + 后端） */
  updateFlowName: (name: string) => Promise<void>
  /** 清除错误 */
  clearError: () => void
}

export const useFlowStore = create<FlowState>((set, get) => ({
  currentFlowId: null,
  currentFlowName: '未命名工作流',
  loading: false,
  saving: false,
  lastSavedAt: null,
  flowList: [],
  error: null,

  loadFlowList: async () => {
    set({ loading: true, error: null })
    try {
      const list = await flowsApi.listFlows()
      set({ flowList: list, loading: false })
      return list
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  loadFlow: async (id) => {
    set({ loading: true, error: null })
    try {
      const flow = await flowsApi.getFlow(id)
      // 把 nodes / edges 写入画布
      useCanvasStore.setState({
        nodes: flow.nodes,
        edges: flow.edges,
        selectedNodeId: null,
      })
      set({
        currentFlowId: flow.id,
        currentFlowName: flow.name,
        lastSavedAt: Date.now(),
        loading: false,
      })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  createFlow: async () => {
    set({ loading: true, error: null })
    try {
      const flow = await flowsApi.createFlow({})
      // 清空画布
      useCanvasStore.setState({
        nodes: [],
        edges: [],
        selectedNodeId: null,
      })
      set({
        currentFlowId: flow.id,
        currentFlowName: flow.name,
        lastSavedAt: Date.now(),
        loading: false,
      })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  saveCurrent: async () => {
    const { currentFlowId } = get()
    if (!currentFlowId) return
    set({ saving: true, error: null })
    try {
      const { nodes, edges } = useCanvasStore.getState()
      const updated = await flowsApi.updateFlow(currentFlowId, {
        nodes,
        edges,
      })
      set({
        currentFlowName: updated.name,
        lastSavedAt: Date.now(),
        saving: false,
      })
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  updateFlowName: async (name) => {
    const { currentFlowId } = get()
    if (!currentFlowId) return
    set({ currentFlowName: name, error: null })
    try {
      const updated = await flowsApi.updateFlow(currentFlowId, { name })
      set({ currentFlowName: updated.name, lastSavedAt: Date.now() })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))

/** 便于非组件代码读取当前 flow id */
export function getCurrentFlowId(): string | null {
  return useFlowStore.getState().currentFlowId
}
