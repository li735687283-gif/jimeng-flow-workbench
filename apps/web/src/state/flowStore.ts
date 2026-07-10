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
  /** 确保当前画布绑定到一个工作流，不清空已有节点 */
  ensureCurrentFlow: () => Promise<string>
  /** 保存当前画布到后端（PUT） */
  saveCurrent: () => Promise<void>
  /** 更新当前工作流名称（本地 + 后端） */
  updateFlowName: (name: string) => Promise<void>
  /** 重命名指定工作流 */
  renameFlow: (id: string, name: string) => Promise<void>
  /** 复制指定工作流 */
  duplicateFlow: (id: string) => Promise<void>
  /** 删除指定工作流 */
  deleteFlow: (id: string) => Promise<void>
  /** 清除错误 */
  clearError: () => void
}

const normalizeFlowName = (name: string): string =>
  name === '未命名工作流' ? '无限画布' : name

export const useFlowStore = create<FlowState>((set, get) => ({
  currentFlowId: null,
  currentFlowName: '无限画布',
  loading: false,
  saving: false,
  lastSavedAt: null,
  flowList: [],
  error: null,

  loadFlowList: async () => {
    set({ loading: true, error: null })
    try {
      const list = await flowsApi.listFlows()
      const normalized = list.map((f) => ({ ...f, name: normalizeFlowName(f.name) }))
      set({ flowList: normalized, loading: false })
      return normalized
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
      // 回填文本节点的上游图片引用，保证识图反推 UI 能读到
      const { syncAllTextNodeImageRefs } = await import(
        '../utils/syncTextNodeImageRefs'
      )
      const nodes = syncAllTextNodeImageRefs(flow.nodes, flow.edges)
      // 把 nodes / edges 写入画布
      useCanvasStore.setState({
        nodes,
        edges: flow.edges,
        deletedNodeIds: [],
        selectedNodeId: null,
      })
      set({
        currentFlowId: flow.id,
        currentFlowName: normalizeFlowName(flow.name),
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
        deletedNodeIds: [],
        selectedNodeId: null,
      })
      set({
        currentFlowId: flow.id,
        currentFlowName: normalizeFlowName(flow.name),
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

  ensureCurrentFlow: async () => {
    const existingFlowId = get().currentFlowId
    if (existingFlowId) return existingFlowId

    set({ saving: true, error: null })
    try {
      const { nodes, edges, clearDeletedNodeIds } = useCanvasStore.getState()
      const flow = await flowsApi.createFlow({
        name: get().currentFlowName,
      })
      const updated = await flowsApi.updateFlow(flow.id, {
        nodes,
        edges,
      })
      clearDeletedNodeIds()
      set({
        currentFlowId: updated.id,
        currentFlowName: normalizeFlowName(updated.name),
        lastSavedAt: Date.now(),
        saving: false,
        loading: false,
      })
      return updated.id
    } catch (err) {
      set({
        saving: false,
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
      const { nodes, edges, deletedNodeIds, clearDeletedNodeIds } =
        useCanvasStore.getState()
      const updated = await flowsApi.updateFlow(currentFlowId, {
        nodes,
        edges,
        ...(deletedNodeIds.length > 0 ? { deletedNodeIds } : {}),
      })
      clearDeletedNodeIds()
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
    const { currentFlowId, currentFlowName: oldName } = get()
    if (!currentFlowId) return
    set({ currentFlowName: name, error: null })
    try {
      const updated = await flowsApi.updateFlow(currentFlowId, { name })
      set({ currentFlowName: normalizeFlowName(updated.name), lastSavedAt: Date.now() })
      await get().loadFlowList()
    } catch (err) {
      set({
        currentFlowName: oldName,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  renameFlow: async (id, name) => {
    set({ error: null })
    try {
      await flowsApi.renameFlow(id, name)
      if (get().currentFlowId === id) {
        set({ currentFlowName: normalizeFlowName(name) })
      }
      await get().loadFlowList()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  },

  duplicateFlow: async (id) => {
    set({ error: null })
    try {
      await flowsApi.duplicateFlow(id)
      await get().loadFlowList()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  },

  deleteFlow: async (id) => {
    set({ error: null })
    try {
      await flowsApi.deleteFlow(id)
      if (get().currentFlowId === id) {
        set({ currentFlowId: null, currentFlowName: '无限画布' })
        useCanvasStore.setState({
          nodes: [],
          edges: [],
          deletedNodeIds: [],
          selectedNodeId: null,
        })
      }
      await get().loadFlowList()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))

/** 便于非组件代码读取当前 flow id */
export function getCurrentFlowId(): string | null {
  return useFlowStore.getState().currentFlowId
}
