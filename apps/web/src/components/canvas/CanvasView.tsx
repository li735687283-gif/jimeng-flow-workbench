import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  ChangeEvent,
  DragEvent as ReactDragEvent,
  RefObject,
} from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Position,
  getBezierPath,
  useReactFlow,
  useStore,
  SelectionMode,
} from '@xyflow/react'
import type {
  Node,
  Edge,
  Connection,
  OnConnectEnd,
  OnConnectStart,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useCanvasStore } from '../../state/canvasStore'
import { useAssetStore } from '../../state/assetStore'
import { uploadAsset } from '../../api/assets'
import { nodeTypes } from '../../nodes/registry'
import type { BaseNodeData, FlowNodeType } from '../../types/nodeTypes'
import { CutEdge } from './CutEdge'
import { ContextMenu, type ContextMenuState } from '../menus/ContextMenu'
import { AddNodeMenu, type AddNodeMenuState } from '../menus/AddNodeMenu'
import {
  ReferenceNodeMenu,
  type ReferenceNodeMenuState,
} from '../menus/ReferenceNodeMenu'
import { SelectionToolbar } from './SelectionToolbar'

const edgeTypes = { cut: CutEdge }
const REFERENCE_MENU_WIDTH = 330
const REFERENCE_MENU_HEIGHT = 356
const MENU_VIEWPORT_PADDING = 12
const FALLBACK_NODE_WIDTH = 200
const FALLBACK_NODE_HEIGHT = 150
const INTERACTION_HANDLE_OFFSET = 8
const UPLOAD_STAGGER = 34
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'])

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getPointerClientPosition(event: MouseEvent | TouchEvent): {
  x: number
  y: number
} {
  const touchEvent = event as TouchEvent
  if (touchEvent.changedTouches?.[0]) {
    return {
      x: touchEvent.changedTouches[0].clientX,
      y: touchEvent.changedTouches[0].clientY,
    }
  }
  const mouseEvent = event as MouseEvent
  return { x: mouseEvent.clientX, y: mouseEvent.clientY }
}

function isBlankCanvasTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('.react-flow__handle')) return false
  if (target.closest('.react-flow__node')) return false
  return !!target.closest('.react-flow')
}

function getFileExtension(file: File): string {
  const name = file.name.toLowerCase()
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(dotIndex + 1) : ''
}

function getUploadNodeType(file: File): FlowNodeType | null {
  const mimeType = file.type.toLowerCase()
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'

  const extension = getFileExtension(file)
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  return null
}

function hasFileTransfer(dataTransfer: DataTransfer): boolean {
  if (dataTransfer.types.includes('Files')) return true
  return Array.from(dataTransfer.items).some((item) => item.kind === 'file')
}

function getReferenceMenuPosition(pointer: { x: number; y: number }): {
  x: number
  y: number
} {
  return {
    x: clamp(
      pointer.x,
      MENU_VIEWPORT_PADDING,
      window.innerWidth - REFERENCE_MENU_WIDTH - MENU_VIEWPORT_PADDING,
    ),
    y: clamp(
      pointer.y,
      MENU_VIEWPORT_PADDING,
      window.innerHeight - REFERENCE_MENU_HEIGHT - MENU_VIEWPORT_PADDING,
    ),
  }
}

function getNodeSize(node: Node): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? FALLBACK_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? FALLBACK_NODE_HEIGHT,
  }
}

function getNodeEdgePoint(node: Node, position: Position): { x: number; y: number } {
  const { width, height } = getNodeSize(node)
  return {
    x: position === Position.Left ? node.position.x : node.position.x + width,
    y: node.position.y + height / 2,
  }
}

function getInteractionHandlePoint(
  node: Node,
  position: Position,
): { x: number; y: number } {
  const edgePoint = getNodeEdgePoint(node, position)
  return {
    x:
      edgePoint.x +
      (position === Position.Left
        ? -INTERACTION_HANDLE_OFFSET
        : INTERACTION_HANDLE_OFFSET),
    y: edgePoint.y,
  }
}

function PendingReferenceLine({
  containerRef,
  nodes,
  state,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  nodes: Node[]
  state: ReferenceNodeMenuState
}) {
  const transform = useStore((s) => s.transform)
  const { flowToScreenPosition } = useReactFlow()
  const sourceNode = nodes.find((node) => node.id === state.sourceNodeId)
  const containerRect = containerRef.current?.getBoundingClientRect()
  if (!sourceNode || !containerRect) return null

  const sourcePosition =
    state.sourceHandleType === 'target' ? Position.Left : Position.Right
  const sourcePoint = getInteractionHandlePoint(sourceNode, sourcePosition)
  const targetPosition =
    state.flowPosition.x >= sourcePoint.x ? Position.Left : Position.Right
  const sourceScreen = flowToScreenPosition(sourcePoint)
  const targetScreen = flowToScreenPosition(state.flowPosition)
  const sourceLocal = {
    x: sourceScreen.x - containerRect.left,
    y: sourceScreen.y - containerRect.top,
  }
  const targetLocal = {
    x: targetScreen.x - containerRect.left,
    y: targetScreen.y - containerRect.top,
  }
  const [path] = getBezierPath({
    sourceX: sourceLocal.x,
    sourceY: sourceLocal.y,
    sourcePosition,
    targetX: targetLocal.x,
    targetY: targetLocal.y,
    targetPosition,
  })

  return (
    <svg
      className="pending-reference-line-layer"
      data-transform={`${transform[0]},${transform[1]},${transform[2]}`}
      aria-hidden="true"
    >
      <path className="pending-reference-line" d={path} />
      <path className="pending-reference-line-flow" d={path} />
    </svg>
  )
}

export function CanvasView() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange)
  const onConnect = useCanvasStore((s) => s.onConnect)
  const onNodesDelete = useCanvasStore((s) => s.onNodesDelete)
  const onEdgesDelete = useCanvasStore((s) => s.onEdgesDelete)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const addNode = useCanvasStore((s) => s.addNode)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const setAsset = useAssetStore((s) => s.setAsset)
  const zoom = useStore((s) => s.transform[2])
  const connectionRadius = Math.round(clamp(28 * zoom, 16, 56))

  const { screenToFlowPosition } = useReactFlow()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [addMenu, setAddMenu] = useState<AddNodeMenuState | null>(null)
  const [referenceMenu, setReferenceMenu] =
    useState<ReferenceNodeMenuState | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [fileDragActive, setFileDragActive] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const connectionStartRef = useRef<{
    nodeId: string
    handleId: string | null
    handleType: 'source' | 'target' | null
  } | null>(null)
  const pendingUploadPosRef = useRef<{ x: number; y: number }>({
    x: 400,
    y: 300,
  })

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode],
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedNodeIds([])
    setContextMenu(null)
    setAddMenu(null)
    setReferenceMenu(null)
  }, [setSelectedNode])

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Node[] }) => {
      setSelectedNodeIds(nodes.map((n) => n.id))
    },
    [],
  )

  const handlePaneContextMenu = useCallback(
    (event: ReactMouseEvent | MouseEvent) => {
      event.preventDefault()
      const clientX = event.clientX
      const clientY = event.clientY
      setContextMenu({
        x: clientX,
        y: clientY,
        flowPosition: screenToFlowPosition({ x: clientX, y: clientY }),
      })
      setReferenceMenu(null)
    },
    [screenToFlowPosition],
  )

  const triggerUpload = useCallback(
    (position: { x: number; y: number }) => {
      pendingUploadPosRef.current = position
      fileInputRef.current?.click()
    },
    [],
  )

  const createUploadedNode = useCallback(
    async (file: File, position: { x: number; y: number }) => {
      const nodeType = getUploadNodeType(file)
      if (!nodeType) return

      const nodeId = addNode(nodeType, position)
      let localPreviewUrl: string | undefined
      if (nodeType === 'image') {
        localPreviewUrl = URL.createObjectURL(file)
        updateNodeData(nodeId, {
          title: file.name,
          localPreviewUrl,
          status: 'running',
        } as Partial<BaseNodeData>)
      } else {
        updateNodeData(nodeId, {
          title: file.name,
          status: 'running',
        } as Partial<BaseNodeData>)
      }

      try {
        const asset = await uploadAsset(file)
        setAsset(asset)
        updateNodeData(nodeId, {
          status: 'success',
          ...(nodeType === 'video'
            ? {
                assetIds: [asset.id],
                inputImageAssetIds: [],
              }
            : {
                assetId: asset.id,
                localPreviewUrl: undefined,
              }),
        } as Partial<BaseNodeData>)
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
      } catch (err) {
        console.error('[CanvasView] 上传资产失败:', err)
        updateNodeData(nodeId, {
          status: 'error',
          error: err instanceof Error ? err.message : '上传资产失败',
        } as Partial<BaseNodeData>)
      }
    },
    [addNode, updateNodeData, setAsset],
  )

  const createUploadedNodes = useCallback(
    (files: FileList | File[], position: { x: number; y: number }) => {
      Array.from(files)
        .filter((file) => getUploadNodeType(file) !== null)
        .forEach((file, index) => {
          void createUploadedNode(file, {
            x: position.x + index * UPLOAD_STAGGER,
            y: position.y + index * UPLOAD_STAGGER,
          })
        })
    },
    [createUploadedNode],
  )

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files || files.length === 0) return
      createUploadedNodes(files, pendingUploadPosRef.current)
      event.target.value = ''
    },
    [createUploadedNodes],
  )

  const handleCreateNode = useCallback(
    (type: FlowNodeType, position: { x: number; y: number }) => {
      addNode(type, position)
    },
    [addNode],
  )

  const handleConnectStart = useCallback<OnConnectStart>(
    (_event, params) => {
      if (!params.nodeId) {
        connectionStartRef.current = null
        return
      }
      connectionStartRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId,
        handleType:
          params.handleType === 'source' || params.handleType === 'target'
            ? params.handleType
            : null,
      }
      setContextMenu(null)
      setAddMenu(null)
      setReferenceMenu(null)
    },
    [],
  )

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      const connectionStart = connectionStartRef.current
      connectionStartRef.current = null
      if (!connectionStart || connectionState.toNode) return
      if (!isBlankCanvasTarget(event.target)) return

      const pointer = getPointerClientPosition(event)
      const menuPosition = getReferenceMenuPosition(pointer)
      setContextMenu(null)
      setAddMenu(null)
      setReferenceMenu({
        x: menuPosition.x,
        y: menuPosition.y,
        flowPosition: screenToFlowPosition(pointer),
        sourceNodeId: connectionStart.nodeId,
        sourceHandleId: connectionStart.handleId,
        sourceHandleType: connectionStart.handleType,
      })
    },
    [screenToFlowPosition],
  )

  const handleCreateReferenceNode = useCallback(
    (type: FlowNodeType, menu: ReferenceNodeMenuState) => {
      const newNodeId = addNode(type, menu.flowPosition)
      if (!newNodeId) return

      const connection: Connection =
        menu.sourceHandleType === 'target'
          ? {
              source: newNodeId,
              sourceHandle: null,
              target: menu.sourceNodeId,
              targetHandle: menu.sourceHandleId,
            }
          : {
              source: menu.sourceNodeId,
              sourceHandle: menu.sourceHandleId,
              target: newNodeId,
              targetHandle: null,
            }

      onConnect(connection)
    },
    [addNode, onConnect],
  )

  const handleCanvasDragEnter = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!hasFileTransfer(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      setFileDragActive(true)
    },
    [],
  )

  const handleCanvasDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!hasFileTransfer(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      setFileDragActive(true)
    },
    [],
  )

  const handleCanvasDragLeave = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const relatedTarget = event.relatedTarget
      if (
        relatedTarget instanceof window.Node &&
        event.currentTarget.contains(relatedTarget)
      ) {
        return
      }
      setFileDragActive(false)
    },
    [],
  )

  const handleCanvasDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!hasFileTransfer(event.dataTransfer)) return
      event.preventDefault()
      setFileDragActive(false)

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      createUploadedNodes(event.dataTransfer.files, flowPosition)
    },
    [createUploadedNodes, screenToFlowPosition],
  )

  // 在容器捕获阶段监听双击，只在画布 pane 上触发添加节点菜单
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleDblClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      // 仅当双击目标为 React Flow 的画布 pane 时才打开菜单
      if (
        target.classList.contains('react-flow__pane') ||
        target.classList.contains('react-flow__renderer')
      ) {
        event.preventDefault()
        event.stopPropagation()
        window.getSelection()?.removeAllRanges()
        setAddMenu({
          x: event.clientX,
          y: event.clientY,
          flowPosition: screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        })
      }
    }
    el.addEventListener('dblclick', handleDblClick, true)
    return () => {
      el.removeEventListener('dblclick', handleDblClick, true)
    }
  }, [screenToFlowPosition])

  return (
    <div
      ref={containerRef}
      className={`canvas-container${fileDragActive ? ' file-drag-active' : ''}`}
      onDragEnterCapture={handleCanvasDragEnter}
      onDragOverCapture={handleCanvasDragOver}
      onDragLeaveCapture={handleCanvasDragLeave}
      onDropCapture={handleCanvasDrop}
    >
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1]}
        zoomOnDoubleClick={false}
        connectionRadius={connectionRadius}
        deleteKeyCode={['Delete', 'Backspace']}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.5}
          color="#2a2a2a"
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="canvas-empty-state">
          <button
            type="button"
            className="canvas-empty-plus"
            onClick={() => handleCreateNode('text', screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            }))}
            title="添加文本节点"
          >
            <Plus size={28} strokeWidth={1.5} />
          </button>
          <div className="canvas-empty-title">双击画布开始创作</div>
          <div className="canvas-empty-subtitle">或使用底部按钮添加节点</div>
        </div>
      )}

      <SelectionToolbar selectedNodeIds={selectedNodeIds} />

      {referenceMenu && (
        <PendingReferenceLine
          containerRef={containerRef}
          nodes={nodes as Node[]}
          state={referenceMenu}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onAddNode={() => {
            setAddMenu({
              x: contextMenu.x,
              y: contextMenu.y,
              flowPosition: contextMenu.flowPosition,
            })
          }}
          onUpload={() => triggerUpload(contextMenu.flowPosition)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {addMenu && (
        <AddNodeMenu
          state={addMenu}
          onSelect={(type) => handleCreateNode(type, addMenu.flowPosition)}
          onUpload={() => triggerUpload(addMenu.flowPosition)}
          onClose={() => setAddMenu(null)}
        />
      )}

      {referenceMenu && (
        <ReferenceNodeMenu
          state={referenceMenu}
          onSelect={(type) => handleCreateReferenceNode(type, referenceMenu)}
          onUpload={() => triggerUpload(referenceMenu.flowPosition)}
          onClose={() => setReferenceMenu(null)}
        />
      )}
    </div>
  )
}
