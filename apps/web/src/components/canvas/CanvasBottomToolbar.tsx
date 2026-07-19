import { useState } from 'react'
import { Crosshair, Folder, History, Plus, Settings } from 'lucide-react'
import type { FlowNodeType } from '../../types/nodeTypes'
import { AddNodeMenuContent } from '../menus/AddNodeMenu'

interface CanvasBottomToolbarProps {
  onAddNode: (type: FlowNodeType) => void
  onUpload: () => void
  onOpenAssetLibrary: () => void
  onOpenHistory: () => void
  onLocateNodes: () => void
  onOpenSettings: () => void
}

export function CanvasBottomToolbar({
  onAddNode,
  onUpload,
  onOpenAssetLibrary,
  onOpenHistory,
  onLocateNodes,
  onOpenSettings,
}: CanvasBottomToolbarProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  return (
    <div className="canvas-bottom-dock" aria-label="画布工具栏">
      <div
        className={`dock-add-control${addMenuOpen ? ' is-open' : ''}`}
        onMouseEnter={() => setAddMenuOpen(true)}
        onMouseLeave={() => setAddMenuOpen(false)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setAddMenuOpen(false)
          }
        }}
      >
        <button
          type="button"
          className="dock-primary"
          title="添加节点"
          aria-label="添加节点"
          aria-haspopup="menu"
          aria-expanded={addMenuOpen}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowUp') {
              event.preventDefault()
              setAddMenuOpen(true)
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setAddMenuOpen(false)
            }
          }}
        >
          <Plus className="dock-primary-icon" size={28} strokeWidth={1.8} />
        </button>
        <div
          className={`dock-add-menu-shell${addMenuOpen ? ' is-open' : ''}`}
          aria-hidden={!addMenuOpen}
        >
          <div className="add-node-menu dock-add-menu" role="menu" aria-label="添加节点">
            <AddNodeMenuContent
              onSelect={onAddNode}
              onUpload={onUpload}
              onClose={() => setAddMenuOpen(false)}
            />
          </div>
        </div>
      </div>
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
