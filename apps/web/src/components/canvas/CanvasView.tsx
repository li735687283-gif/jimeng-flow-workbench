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
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../../state/canvasStore'
import { useAssetStore } from '../../state/assetStore'
import { uploadAsset } from '../../api/assets'
import { nodeTypes } from '../../nodes/registry'
import type { FlowNodeType } from '../../types/nodeTypes'
import { CutEdge } from './CutEdge'
import { ContextMenu, type ContextMenuState } from '../menus/ContextMenu'
import { AddNodeMenu, type AddNodeMenuState } from '../menus/AddNodeMenu'
import { SelectionToolbar } from './SelectionToolbar'

const edgeTypes = { cut: CutEdge }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    </div>
  )
}
