import type { FlowNodeType } from '../../types/nodeTypes'
import { NODE_MENU_ITEMS, type NodeMenuItem } from './nodeMenuItems'

export interface AddNodeMenuState {
  x: number
  y: number
  flowPosition: { x: number; y: number }
}

interface AddNodeMenuProps {
  state: AddNodeMenuState
  onSelect: (type: FlowNodeType) => void
  onUpload: () => void
  onClose: () => void
}

export function AddNodeMenu({
  state,
  onSelect,
  onUpload,
  onClose,
}: AddNodeMenuProps) {
  return (
    <>
      <div className="menu-overlay" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="add-node-menu"
        style={{ left: state.x, top: state.y }}
      >
        <div className="add-node-menu-title">添加节点</div>
        <div className="add-node-menu-list">
          {NODE_MENU_ITEMS.map((item) => (
            <AddNodeMenuButton
              key={item.key}
              item={item}
              onSelect={onSelect}
              onUpload={onUpload}
              onClose={onClose}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function AddNodeMenuButton({
  item,
  onSelect,
  onUpload,
  onClose,
}: {
  item: NodeMenuItem
  onSelect: (type: FlowNodeType) => void
  onUpload: () => void
  onClose: () => void
}) {
  const Icon = item.icon

  return (
    <button
      type="button"
      className="add-node-menu-item"
      disabled={item.disabled}
      onClick={() => {
        if (item.action === 'upload') {
          onUpload()
          onClose()
          return
        }
        if (!item.nodeType) return
        onSelect(item.nodeType)
        onClose()
      }}
    >
      <Icon size={21} strokeWidth={1.9} />
      <span className="add-node-menu-label">{item.label}</span>
    </button>
  )
}
