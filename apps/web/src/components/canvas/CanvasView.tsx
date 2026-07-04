import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ChangeEvent } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
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
import { useCanvasStore } from '../../state/canvasStore'
import { useAssetStore } from '../../state/assetStore'
import { uploadAsset } from '../../api/assets'
import { nodeTypes } from '../../nodes/registry'
import type { FlowNodeType } from '../../types/nodeTypes'
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
  const connectionRadius = Math.round(clamp(42 * zoom, 22, 84))

  const { screenToFlowPosition } = useReactFlow()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [addMenu, setAddMenu] = useState<AddNodeMenuState | null>(null)
  const [referenceMenu, setReferenceMenu] =
    useState<ReferenceNodeMenuState | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
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

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      const nodeType: FlowNodeType = file.type.startsWith('video/')
        ? 'video'
        : 'image'
      const position = pendingUploadPosRef.current
      // 先创建节点，让用户立即看到占位
      const nodeId = addNode(nodeType, position)
      // 上传资产并回填 assetId
      try {
        const asset = await uploadAsset(file)
        setAsset(asset)
        updateNodeData(nodeId, {
          assetId: asset.id,
          ...(nodeType === 'video'
            ? { inputImageAssetIds: [] }
            : null),
        } as never)
      } catch (err) {
        console.error('[CanvasView] 上传资产失败:', err)
        updateNodeData(nodeId, { status: 'error' } as never)
      }
      event.target.value = ''
    },
    [addNode, updateNodeData, setAsset],
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
    <div ref={containerRef} className="canvas-container">
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
        connectionRadius={connectionRadius}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.5}
          color="#262830"
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      <SelectionToolbar selectedNodeIds={selectedNodeIds} />

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
          sourceType={
            nodes.find((node) => node.id === referenceMenu.sourceNodeId)?.type
          }
          onSelect={(type) => handleCreateReferenceNode(type, referenceMenu)}
          onClose={() => setReferenceMenu(null)}
        />
      )}
    </div>
  )
}
