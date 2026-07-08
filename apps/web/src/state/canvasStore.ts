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
import { buildVideoReferencesFromInputImages } from '@jimeng-flow/shared/videoNode'
import type { VideoMode } from '@jimeng-flow/shared/videoNode'
import { nodeRegistry } from '../nodes/registry'
import type { FlowNodeType, BaseNodeData } from '../types/nodeTypes'
import { useGenerationDefaultsStore } from './generationDefaultsStore'

const ARRANGE_GAP = 40
const UPSCALE_NODE_GAP = 120
const UPSCALE_NODE_STACK_GAP = 40
const CONNECTABLE_IMAGE_TARGETS = new Set<FlowNodeType>([
  'image',
  'generate',
  'video',
])
const VIDEO_MODES = new Set<VideoMode>([
  'text_to_video',
  'image_to_video',
  'all_reference',
  'action_mimic',
  'first_last_frame',
  'image_reference',
])

type UpscaleResolution = '2k' | '4k' | '8k'

function getAssetId(node: Node | undefined): string | null {
  const assetId = (node?.data as BaseNodeData | undefined)?.assetId
  return typeof assetId === 'string' && assetId ? assetId : null
}

function getNodeModel(node: Node | undefined): string {
  const model = (node?.data as BaseNodeData | undefined)?.model
  return typeof model === 'string' && model.trim() ? model.trim() : ''
}

function getRememberedModel(type: FlowNodeType): string {
  const state = useGenerationDefaultsStore.getState()
  if (type === 'image') return state.image?.model?.trim() ?? ''
  if (type === 'video') return state.video?.model?.trim() ?? ''
  return ''
}

function applyRememberedNodeDefaults(node: Node, type: FlowNodeType): Node {
  const model = getRememberedModel(type)
  if (!model) return node
  return {
    ...node,
    data: {
      ...node.data,
      model,
    },
  }
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

  return cleanupImageAssetReferences(nodes, removalsByTarget)
}

function cleanupImageAssetReferences(
  nodes: Node[],
  removalsByTarget: Map<string, Set<string>>,
): Node[] {
  if (removalsByTarget.size === 0) return nodes

  return nodes.map((node) => {
    const removals = removalsByTarget.get(node.id)
    if (!removals) return node

    const data = node.data as BaseNodeData
    const inputImageAssetIds = data.inputImageAssetIds
    const references = data.references
    const nextInputImageAssetIds = Array.isArray(inputImageAssetIds)
      ? (inputImageAssetIds.filter(
          (assetId): assetId is string =>
            typeof assetId === 'string' && !removals.has(assetId),
        ) as string[])
      : null
    const nextReferences = Array.isArray(references)
      ? (references.filter((reference) => {
          if (!reference || typeof reference !== 'object') return true
          const assetId = (reference as { assetId?: unknown }).assetId
          return typeof assetId !== 'string' || !removals.has(assetId)
        }) as unknown[])
      : null

    const inputChanged =
      Array.isArray(inputImageAssetIds) &&
      nextInputImageAssetIds !== null &&
      nextInputImageAssetIds.length !== inputImageAssetIds.length
    const referencesChanged =
      Array.isArray(references) &&
      nextReferences !== null &&
      nextReferences.length !== references.length
    if (!inputChanged && !referencesChanged) return node

    if (node.type === 'video') {
      const nextInputs = nextInputImageAssetIds ?? stringArray(inputImageAssetIds)
      const mode = syncVideoModeForConnectedImages(data.mode, nextInputs)

      return {
        ...node,
        data: {
          ...node.data,
          ...(inputChanged ? { inputImageAssetIds: nextInputs } : {}),
          mode,
          references: buildVideoReferencesFromInputImages(mode, nextInputs),
        },
      }
    }

    return {
      ...node,
      data: {
        ...node.data,
        ...(inputChanged ? { inputImageAssetIds: nextInputImageAssetIds } : {}),
        ...(referencesChanged ? { references: nextReferences } : {}),
      },
    }
  })
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item)
    : []
}

function videoMode(value: unknown): VideoMode {
  return typeof value === 'string' && VIDEO_MODES.has(value as VideoMode)
    ? (value as VideoMode)
    : 'text_to_video'
}

function syncVideoModeForConnectedImages(
  value: unknown,
  inputImages: string[],
): VideoMode {
  const mode = videoMode(value)
  if (
    inputImages.length > 0 &&
    (mode === 'all_reference' ||
      mode === 'action_mimic' ||
      mode === 'image_reference')
  ) {
    return mode
  }
  if (inputImages.length >= 2) return 'first_last_frame'
  if (inputImages.length === 1) return 'image_to_video'
  return 'text_to_video'
}

function syncConnectedImageReference(
  nodes: Node[],
  connection: Connection,
): Node[] {
  const sourceId = connection.source
  const targetId = connection.target
  if (!sourceId || !targetId || sourceId === targetId) return nodes

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const source = nodesById.get(sourceId)
  const target = nodesById.get(targetId)
  const assetId = getAssetId(source)
  const sourceModel = getNodeModel(source)
  if (!target || !CONNECTABLE_IMAGE_TARGETS.has(target.type as FlowNodeType)) {
    return nodes
  }
  if (!assetId && !(target.type === 'image' && sourceModel)) {
    return nodes
  }

  return nodes.map((node) => {
    if (node.id !== targetId) return node

    const data = node.data as BaseNodeData
    const inputImageAssetIds = stringArray(data.inputImageAssetIds)
    const nextInputImageAssetIds = !assetId || inputImageAssetIds.includes(assetId)
      ? inputImageAssetIds
      : [...inputImageAssetIds, assetId]
    const inputChanged =
      nextInputImageAssetIds.length !== inputImageAssetIds.length ||
      !Array.isArray(data.inputImageAssetIds)

    if (node.type !== 'video') {
      return {
        ...node,
        data: {
          ...node.data,
          ...(inputChanged ? { inputImageAssetIds: nextInputImageAssetIds } : {}),
          ...(node.type === 'image' && sourceModel ? { model: sourceModel } : {}),
        },
      }
    }

    const mode = syncVideoModeForConnectedImages(data.mode, nextInputImageAssetIds)
    const references = buildVideoReferencesFromInputImages(
      mode,
      nextInputImageAssetIds,
    )

    return {
      ...node,
      data: {
        ...node.data,
        inputImageAssetIds: nextInputImageAssetIds,
        mode,
        references,
      },
    }
  })
}

interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  deletedNodeIds: string[]
  selectedNodeId: string | null
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  onNodesDelete: (nodes: Node[]) => void
  onEdgesDelete: (edges: Edge[]) => void
  addNode: (type: FlowNodeType, position: { x: number; y: number }) => string
  createUpscaleImageNode: (
    sourceId: string,
    resolution: UpscaleResolution,
  ) => string
  removeNode: (id: string) => void
  clearDeletedNodeIds: () => void
  removeEdge: (id: string) => void
  removeIncomingImageReference: (targetNodeId: string, assetId: string) => void
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
  deletedNodeIds: [],
  selectedNodeId: null,

  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) })
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) })
  },

  onConnect: (connection: Connection) => {
    set((state) => ({
      nodes: syncConnectedImageReference(state.nodes, connection),
      edges: addEdge({ ...connection, type: 'cut' }, state.edges),
    }))
  },

  onNodesDelete: (nodes: Node[]) => {
    const ids = new Set(nodes.map((n) => n.id))
    set((state) => ({
      nodes: cleanupRemovedEdgeReferences(
        state.nodes,
        state.edges.filter((edge) => ids.has(edge.source)),
      ).filter((n) => !ids.has(n.id)),
      deletedNodeIds: Array.from(
        new Set([...state.deletedNodeIds, ...ids]),
      ),
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
    const node = applyRememberedNodeDefaults(
      def.create(position, sameTypeCount),
      type,
    )
    set({
      nodes: [...nodes, node],
      selectedNodeId: node.id,
    })
    return node.id
  },

  createUpscaleImageNode: (sourceId, resolution) => {
    const nodes = get().nodes
    const source = nodes.find((node) => node.id === sourceId)
    const def = nodeRegistry.image
    if (!source || !def) return ''

    const sourceSize = getNodeSize(source)
    const sourceData = source.data as BaseNodeData
    const assetId = getAssetId(source)
    const existingUpscaleCount = nodes.filter((node) => {
      const data = node.data as BaseNodeData
      return node.type === 'image' && data.upscaleSourceNodeId === sourceId
    }).length
    const sameTypeCount = nodes.filter((node) => node.type === 'image').length + 1
    const node = def.create(
      {
        x: source.position.x + sourceSize.width + UPSCALE_NODE_GAP,
        y:
          source.position.y +
          existingUpscaleCount * (sourceSize.height + UPSCALE_NODE_STACK_GAP),
      },
      sameTypeCount,
    )
    const nextData: BaseNodeData = {
      ...node.data,
      title: `${sourceData.title ?? '图片'} 高清`,
      status: 'running',
      inputImageAssetIds: assetId ? [assetId] : [],
      upscaleSourceNodeId: sourceId,
      upscaleResolution: resolution,
      width: sourceData.width,
      height: sourceData.height,
      ratio: sourceData.ratio,
    }
    const derivedNode: Node = {
      ...node,
      data: nextData,
    }

    set((state) => ({
      nodes: [...state.nodes, derivedNode],
      edges: addEdge(
        {
          source: sourceId,
          target: derivedNode.id,
          sourceHandle: null,
          targetHandle: null,
          type: 'cut',
        },
        state.edges,
      ),
      selectedNodeId: derivedNode.id,
    }))
    return derivedNode.id
  },

  removeNode: (id) => {
    set((state) => ({
      deletedNodeIds: state.deletedNodeIds.includes(id)
        ? state.deletedNodeIds
        : [...state.deletedNodeIds, id],
      nodes: cleanupRemovedEdgeReferences(
        state.nodes,
        state.edges.filter((edge) => edge.source === id),
      ).filter((n) => n.id !== id),
      edges: state.edges.filter(
        (e) => e.source !== id && e.target !== id,
      ),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }))
  },

  clearDeletedNodeIds: () => set({ deletedNodeIds: [] }),

  removeEdge: (id) => {
    set((state) => ({
      nodes: cleanupRemovedEdgeReferences(
        state.nodes,
        state.edges.filter((e) => e.id === id),
      ),
      edges: state.edges.filter((e) => e.id !== id),
    }))
  },

  removeIncomingImageReference: (targetNodeId, assetId) => {
    if (!targetNodeId || !assetId) return
    set((state) => {
      const nodesById = new Map(state.nodes.map((node) => [node.id, node]))
      const removedEdges = state.edges.filter(
        (edge) =>
          edge.target === targetNodeId &&
          getAssetId(nodesById.get(edge.source)) === assetId,
      )
      const removedEdgeIds = new Set(removedEdges.map((edge) => edge.id))
      const removalsByTarget = new Map([[targetNodeId, new Set([assetId])]])

      return {
        nodes:
          removedEdges.length > 0
            ? cleanupRemovedEdgeReferences(state.nodes, removedEdges)
            : cleanupImageAssetReferences(state.nodes, removalsByTarget),
        edges:
          removedEdges.length > 0
            ? state.edges.filter((edge) => !removedEdgeIds.has(edge.id))
            : state.edges,
      }
    })
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
