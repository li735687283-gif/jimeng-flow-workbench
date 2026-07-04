import { create } from 'zustand'
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react'
import { nodeRegistry } from '../nodes/registry'
import type { FlowNodeType, BaseNodeData } from '../types/nodeTypes'

interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  onNodesDelete: (nodes: Node[]) => void
  onEdgesDelete: (edges: Edge[]) => void
  addNode: (type: FlowNodeType, position: { x: number; y: number }) => string
  removeNode: (id: string) => void
  removeEdge: (id: string) => void
  updateNodeData: (id: string, data: Partial<BaseNodeData>) => void
  setSelectedNode: (id: string | null) => void
  saveFlow: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) })
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) })
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge({ ...connection, type: 'cut' }, get().edges),
    })
  },

  onNodesDelete: (nodes: Node[]) => {
    const ids = new Set(nodes.map((n) => n.id))
    set((state) => ({
      edges: state.edges.filter(
        (e) => !ids.has(e.source) && !ids.has(e.target),
      ),
      selectedNodeId:
        state.selectedNodeId && ids.has(state.selectedNodeId)
          ? null
          : state.selectedNodeId,
    }))
  },

  onEdgesDelete: (edges: Edge[]) => {
    const ids = new Set(edges.map((e) => e.id))
    set((state) => ({
      edges: state.edges.filter((e) => !ids.has(e.id)),
    }))
  },

  addNode: (type, position) => {
    const def = nodeRegistry[type]
    if (!def) {
      console.warn('[canvasStore] unknown node type:', type)
      return ''
    }
    const nodes = get().nodes
    const sameTypeCount = nodes.filter((n) => n.type === type).length + 1
    const node = def.create(position, sameTypeCount)
    set({
      nodes: [...nodes, node],
      selectedNodeId: node.id,
    })
    return node.id
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter(
        (e) => e.source !== id && e.target !== id,
      ),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }))
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    }))
  },

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    }))
  },

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  saveFlow: () => {
    // 节流保存（stub）—— TODO: 由 Task 3 接入真实持久化
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const { nodes, edges } = get()
      console.log('[canvasStore] saveFlow stub', {
        nodesCount: nodes.length,
        edgesCount: edges.length,
      })
    }, 1500)
  },
}))
