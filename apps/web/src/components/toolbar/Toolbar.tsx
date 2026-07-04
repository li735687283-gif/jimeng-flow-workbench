import { FilePlus, Save, FolderOpen, Settings, Circle } from 'lucide-react'

export type RunStatus = 'idle' | 'running' | 'error'

interface ToolbarProps {
  onNew: () => void
  onSave: () => void
  onOpen: () => void
  onSettings: () => void
  runStatus?: RunStatus
}

export function Toolbar({
  onNew,
  onSave,
  onOpen,
  onSettings,
  runStatus = 'idle',
}: ToolbarProps) {
  const statusLabel =
    runStatus === 'running' ? '运行中' : runStatus === 'error' ? '错误' : '空闲'
  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-title">即梦 Flow 工作台</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="toolbar-btn" onClick={onNew}>
          <FilePlus size={14} />
          <span>新建</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onSave}>
          <Save size={14} />
          <span>保存</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onOpen}>
          <FolderOpen size={14} />
          <span>打开</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onSettings}>
          <Settings size={14} />
          <span>设置</span>
        </button>
        <div className="run-status">
          <Circle
            size={8}
            className={`status-dot ${runStatus}`}
          />
          <span className="status-label">{statusLabel}</span>
        </div>
      </div>
    </header>
  )
}
