import { Crosshair, Folder, History, Plus, Settings } from 'lucide-react'

interface CanvasBottomToolbarProps {
  onAddNode: () => void
  onOpenAssetLibrary: () => void
  onOpenHistory: () => void
  onLocateNodes: () => void
  onOpenSettings: () => void
}

export function CanvasBottomToolbar({
  onAddNode,
  onOpenAssetLibrary,
  onOpenHistory,
  onLocateNodes,
  onOpenSettings,
}: CanvasBottomToolbarProps) {
  return (
    <div className="canvas-bottom-dock" aria-label="画布工具栏">
      <button
        type="button"
        className="dock-primary"
        onClick={onAddNode}
        title="添加节点"
        aria-label="添加节点"
      >
        <Plus size={28} strokeWidth={1.8} />
      </button>
      <span className="dock-separator" aria-hidden="true" />
      <button
        type="button"
        className="dock-icon-btn"
        onClick={onOpenAssetLibrary}
        title="素材库"
        aria-label="素材库"
      >
        <Folder size={23} strokeWidth={1.7} />
      </button>
      <button
        type="button"
        className="dock-icon-btn"
        onClick={onOpenHistory}
        title="历史记录"
        aria-label="历史记录"
      >
        <History size={22} strokeWidth={1.7} />
      </button>
      <button
        type="button"
        className="dock-icon-btn"
        onClick={onLocateNodes}
        title="节点定位"
        aria-label="节点定位"
      >
        <Crosshair size={22} strokeWidth={1.7} />
      </button>
      <span className="dock-separator" aria-hidden="true" />
      <button
        type="button"
        className="dock-icon-btn"
        onClick={onOpenSettings}
        title="设置"
        aria-label="设置"
      >
        <Settings size={23} strokeWidth={1.7} />
      </button>
    </div>
  )
}
