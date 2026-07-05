import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft,
  FilePlus,
  FolderOpen,
  Plus,
  Save,
  Settings,
} from 'lucide-react'
import { CanvasView } from './components/canvas/CanvasView'
import { AgentPanel } from './components/AgentPanel'
import { FlowsHistoryModal } from './components/FlowsHistoryModal'
import { SettingsModal } from './components/SettingsModal'
import { useCanvasStore } from './state/canvasStore'
import { useFlowStore } from './state/flowStore'
import { useSettingsStore } from './state/settingsStore'
import { useAutoSave } from './hooks/useAutoSave'
import type { FlowNodeType } from './types/nodeTypes'
import agentAvatarUrl from '../../../image/agent-avatar-black.png'
import './App.css'

function AppInner() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openModalOpen, setOpenModalOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(true)

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
    <div className="app-layout mature-layout">
      <main className="canvas-stage">
        <CanvasView />

        <div className="canvas-topbar canvas-topbar-left">
          <button type="button" className="ghost-pill">
            <ArrowLeft size={14} />
            <span>返回</span>
          </button>
        </div>

        <div className="canvas-topbar canvas-topbar-right">
          <button
            type="button"
            className="ghost-icon-btn"
            onClick={handleNew}
            title="新建工作流"
          >
            <FilePlus size={15} />
          </button>
          <button
            type="button"
            className="ghost-icon-btn"
            onClick={handleSave}
            title="保存"
          >
            <Save size={15} />
          </button>
          <button
            type="button"
            className="ghost-icon-btn"
            onClick={() => setOpenModalOpen(true)}
            title="打开"
          >
            <FolderOpen size={15} />
          </button>
          <button
            type="button"
            className="ghost-icon-btn"
            onClick={() => setSettingsOpen(true)}
            title="设置"
          >
            <Settings size={15} />
          </button>
        </div>

        <div className="canvas-bottom-dock">
          <button
            type="button"
            className="dock-primary"
            onClick={() => handleSelectFromLibrary('text')}
            title="添加文本节点"
          >
            <Plus size={20} />
          </button>
          <button
            type="button"
            className="dock-btn"
            onClick={() => handleSelectFromLibrary('image')}
            title="添加图片节点"
          >
            图片
          </button>
          <button
            type="button"
            className="dock-btn"
            onClick={() => handleSelectFromLibrary('video')}
            title="添加视频节点"
          >
            视频
          </button>
          <button
            type="button"
            className="dock-btn"
            onClick={() => handleSelectFromLibrary('generate')}
            title="添加即梦生成节点"
          >
            生成
          </button>
        </div>
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
