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

const ARRANGE_GAP = 40

function getAssetId(node: Node | undefined): string | null {
  const assetId = (node?.data as BaseNodeData | undefined)?.assetId
  return typeof assetId === 'string' && assetId ? assetId : null
}

function getNodeSize(node: Node): { width: number; height: number } {
  const measured = node.measured
  const width = measured?.width ?? node.width ?? 200
  const height = measured?.height ?? node.height ?? 150
  return { width, height }
}

function cleanupRemovedEdgeReferences(
  nodes: Node[],
  removedEdges: Edge[],
): Node[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const removalsByTarget = new Map<string, Set<string>>()

  removedEdges.forEach((edge) => {
    const assetId = getAssetId(nodesById.get(edge.source))
    if (!assetId) return
    const removals = removalsByTarget.get(edge.target) ?? new Set<string>()
    removals.add(assetId)
    removalsByTarget.set(edge.target, removals)
  })

  if (removalsByTarget.size === 0) return nodes

  return nodes.map((node) => {
    const removals = removalsByTarget.get(node.id)
    const inputImageAssetIds = (node.data as BaseNodeData).inputImageAssetIds
    if (!removals || !Array.isArray(inputImageAssetIds)) return node

    const nextInputImageAssetIds = inputImageAssetIds.filter(
      (assetId): assetId is string =>
        typeof assetId === 'string' && !removals.has(assetId),
    )
    if (nextInputImageAssetIds.length === inputImageAssetIds.length) return node

    return {
      ...node,
      data: {
        ...node.data,
        inputImageAssetIds: nextInputImageAssetIds,
      },
    }
  })
}

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
  arrangeGrid: (nodeIds: string[]) => void
  arrangeHorizontal: (nodeIds: string[]) => void
  arrangeVertical: (nodeIds: string[]) => void
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
      nodes: cleanupRemovedEdgeReferences(state.nodes, edges),
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
      nodes: cleanupRemovedEdgeReferences(
        state.nodes,
        state.edges.filter((e) => e.id === id),
      ),
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

  arrangeGrid: (nodeIds) => {
    const { nodes } = get()
    const selected = nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node => !!n)
    if (selected.length < 2) return

    const minX = Math.min(...selected.map((n) => n.position.x))
    const minY = Math.min(...selected.map((n) => n.position.y))
    const sizes = selected.map(getNodeSize)
    const maxW = Math.max(...sizes.map((s) => s.width))
    const maxH = Math.max(...sizes.map((s) => s.height))
    const cols = Math.ceil(Math.sqrt(selected.length))

    const nextPositions = new Map<string, { x: number; y: number }>()
    selected.forEach((node, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      nextPositions.set(node.id, {
        x: minX + col * (maxW + ARRANGE_GAP),
        y: minY + row * (maxH + ARRANGE_GAP),
      })
    })

    set((state) => ({
      nodes: state.nodes.map((n) =>
        nextPositions.has(n.id)
          ? { ...n, position: nextPositions.get(n.id)! }
          : n,
      ),
    }))
  },

  arrangeHorizontal: (nodeIds) => {
    const { nodes } = get()
    const selected = nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node => !!n)
      .sort((a, b) => a.position.x - b.position.x)
    if (selected.length < 2) return

    const sizes = selected.map(getNodeSize)
    const avgY =
      selected.reduce((sum, n) => sum + n.position.y, 0) / selected.length

    const nextPositions = new Map<string, { x: number; y: number }>()
    let currentX = selected[0].position.x
    selected.forEach((node, i) => {
      nextPositions.set(node.id, { x: currentX, y: avgY })
      currentX += sizes[i].width + ARRANGE_GAP
    })

    set((state) => ({
      nodes: state.nodes.map((n) =>
        nextPositions.has(n.id)
          ? { ...n, position: nextPositions.get(n.id)! }
          : n,
      ),
    }))
  },

  arrangeVertical: (nodeIds) => {
    const { nodes } = get()
    const selected = nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node => !!n)
      .sort((a, b) => a.position.y - b.position.y)
    if (selected.length < 2) return

    const sizes = selected.map(getNodeSize)
    const avgX =
      selected.reduce((sum, n) => sum + n.position.x, 0) / selected.length

    const nextPositions = new Map<string, { x: number; y: number }>()
    let currentY = selected[0].position.y
    selected.forEach((node, i) => {
      nextPositions.set(node.id, { x: avgX, y: currentY })
      currentY += sizes[i].height + ARRANGE_GAP
    })

    set((state) => ({
      nodes: state.nodes.map((n) =>
        nextPositions.has(n.id)
          ? { ...n, position: nextPositions.get(n.id)! }
          : n,
      ),
    }))
  },

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
