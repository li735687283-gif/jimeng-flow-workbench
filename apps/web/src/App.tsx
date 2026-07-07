import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft } from 'lucide-react'
import { CanvasView } from './components/canvas/CanvasView'
import { CanvasBottomToolbar } from './components/canvas/CanvasBottomToolbar'
import { AssetLibraryModal } from './components/AssetLibraryModal'
import { AgentPanel } from './components/AgentPanel'
import { FlowsHistoryModal } from './components/FlowsHistoryModal'
import { SettingsModal } from './components/SettingsModal'
import { useCanvasStore } from './state/canvasStore'
import { useSettingsStore } from './state/settingsStore'
import { useAutoSave } from './hooks/useAutoSave'
import {
  buildAssetInsertPatch,
  buildAssetRestorePatch,
  resolveAssetSourceNodeId,
} from './utils/assetLibrarySelection'
import type { Asset } from '@jimeng-flow/shared/asset'
import type { FlowNodeType } from './types/nodeTypes'
import agentAvatarUrl from '../../../image/agent-avatar-black.png'
import './App.css'

function AppInner() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openModalOpen, setOpenModalOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(true)
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false)

  const addNode = useCanvasStore((s) => s.addNode)
  const nodes = useCanvasStore((s) => s.nodes)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const { fitView, screenToFlowPosition } = useReactFlow()

  // 启用自动保存（首次挂载时若无 currentFlowId 会自动新建空工作流）
  useAutoSave()

  useEffect(() => {
    loadSettings().catch((err: unknown) => {
      console.error('[App] 加载设置失败:', err)
    })
  }, [loadSettings])

  const getCanvasCenterPosition = useCallback(() => {
    const canvasEl = document.querySelector('.react-flow') as HTMLElement | null
    if (!canvasEl) return { x: 250, y: 200 }

    const rect = canvasEl.getBoundingClientRect()
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }, [screenToFlowPosition])

  const handleSelectFromLibrary = useCallback(
    (type: FlowNodeType) => {
      addNode(type, getCanvasCenterPosition())
    },
    [addNode, getCanvasCenterPosition],
  )

  const handleLocateNodes = useCallback(() => {
    void fitView({ padding: 0.2, duration: 320 })
  }, [fitView])

  const handleSelectAsset = useCallback(
    (asset: Asset) => {
      const sourceNodeId = resolveAssetSourceNodeId(
        asset,
        nodes.map((node) => node.id),
      )

      if (sourceNodeId) {
        const sourceNode = nodes.find((node) => node.id === sourceNodeId)
        if (!sourceNode) return

        const patch = buildAssetRestorePatch(asset, sourceNode)
        if (patch) updateNodeData(sourceNodeId, patch)

        setSelectedNode(sourceNodeId)
        setAssetLibraryOpen(false)
        void fitView({
          nodes: [{ id: sourceNodeId }],
          padding: 0.45,
          duration: 320,
          maxZoom: 1,
        })
        return
      }

      const nodeId = addNode(asset.type, getCanvasCenterPosition())
      const patch = buildAssetInsertPatch(asset)
      if (nodeId && patch) updateNodeData(nodeId, patch)
      setAssetLibraryOpen(false)
      if (nodeId) {
        void fitView({
          nodes: [{ id: nodeId }],
          padding: 0.45,
          duration: 320,
          maxZoom: 1,
        })
      }
    },
    [
      addNode,
      fitView,
      getCanvasCenterPosition,
      nodes,
      setSelectedNode,
      updateNodeData,
    ],
  )

  return (
    <div className="app-layout mature-layout">
      <main className="canvas-stage">
        <CanvasView />

        <div className="canvas-topbar canvas-topbar-left">
          <button type="button" className="ghost-pill">
            <ArrowLeft size={14} />
            <span>返回</span>
          </button>
        </div>

        <CanvasBottomToolbar
          onAddNode={() => handleSelectFromLibrary('text')}
          onOpenAssetLibrary={() => setAssetLibraryOpen(true)}
          onOpenHistory={() => setOpenModalOpen(true)}
          onLocateNodes={handleLocateNodes}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </main>

      {agentOpen ? (
        <AgentPanel onClose={() => setAgentOpen(false)} />
      ) : (
        <button
          type="button"
          className="agent-launcher"
          onClick={() => setAgentOpen(true)}
          title="打开 Agent"
          aria-label="打开 Agent"
        >
          <img
            className="agent-launcher-avatar"
            src={agentAvatarUrl}
            alt=""
            aria-hidden="true"
          />
        </button>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AssetLibraryModal
        open={assetLibraryOpen}
        onClose={() => setAssetLibraryOpen(false)}
        onSelectAsset={handleSelectAsset}
      />

      <FlowsHistoryModal
        open={openModalOpen}
        onClose={() => setOpenModalOpen(false)}
      />
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}

export default App
