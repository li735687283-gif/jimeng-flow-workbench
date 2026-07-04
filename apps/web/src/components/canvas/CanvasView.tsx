import { useCallback, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ChangeEvent } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
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

const edgeTypes = { cut: CutEdge }

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

  const { screenToFlowPosition } = useReactFlow()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [addMenu, setAddMenu] = useState<AddNodeMenuState | null>(null)
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
    setContextMenu(null)
    setAddMenu(null)
  }, [setSelectedNode])

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

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      const target = event.target as HTMLElement
      if (target.classList.contains('react-flow__pane')) {
        setAddMenu({
          x: event.clientX,
          y: event.clientY,
          flowPosition: screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        })
      }
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

  return (
    <div className="canvas-container" onDoubleClick={handleDoubleClick}>
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
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
