import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Toolbar, type RunStatus } from './components/toolbar/Toolbar'
import { NodeLibrary } from './components/sidebar/NodeLibrary'
import { CanvasView } from './components/canvas/CanvasView'
import { Inspector } from './components/inspector/Inspector'
import { BottomPanel } from './components/inspector/BottomPanel'
import { FlowsHistoryModal } from './components/FlowsHistoryModal'
import { SettingsModal } from './components/SettingsModal'
import { useCanvasStore } from './state/canvasStore'
import { useFlowStore } from './state/flowStore'
import { useSettingsStore } from './state/settingsStore'
import { useAutoSave } from './hooks/useAutoSave'
import type { FlowNodeType } from './types/nodeTypes'
import './App.css'

function AppInner() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openModalOpen, setOpenModalOpen] = useState(false)
  const [runStatus] = useState<RunStatus>('idle')

  const addNode = useCanvasStore((s) => s.addNode)
  const createFlow = useFlowStore((s) => s.createFlow)
  const saveCurrent = useFlowStore((s) => s.saveCurrent)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const { screenToFlowPosition } = useReactFlow()

  // 启用自动保存（首次挂载时若无 currentFlowId 会自动新建空工作流）
  useAutoSave()

  useEffect(() => {
    loadSettings().catch((err: unknown) => {
      console.error('[App] 加载设置失败:', err)
    })
  }, [loadSettings])

  const handleNew = useCallback(() => {
    void createFlow().catch((err: unknown) => {
      console.error('[App] 新建工作流失败:', err)
    })
  }, [createFlow])

  const handleSave = useCallback(() => {
    void saveCurrent().catch((err: unknown) => {
      console.error('[App] 保存工作流失败:', err)
    })
  }, [saveCurrent])

  const handleSelectFromLibrary = useCallback(
    (type: FlowNodeType) => {
      // 在画布中央创建节点
      const canvasEl = document.querySelector(
        '.react-flow',
      ) as HTMLElement | null
      let position = { x: 250, y: 200 }
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect()
        position = screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      }
      addNode(type, position)
    },
    [addNode, screenToFlowPosition],
  )

  return (
    <div className="app-layout">
      <Toolbar
        onNew={handleNew}
        onSave={handleSave}
        onOpen={() => setOpenModalOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        runStatus={runStatus}
      />
      <div className="app-body">
        <NodeLibrary onSelect={handleSelectFromLibrary} />
        <CanvasView />
        <Inspector />
      </div>
      <BottomPanel />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
