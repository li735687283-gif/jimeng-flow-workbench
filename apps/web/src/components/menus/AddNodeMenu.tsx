import type { FlowNodeType } from '../../types/nodeTypes'
import { NODE_MENU_ITEMS, type NodeMenuItem } from './nodeMenuItems'
import { ViewportMenuPortal } from './ViewportMenuPortal'

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
    <ViewportMenuPortal
      anchorPoint={{ x: state.x, y: state.y }}
      open
      onClose={onClose}
      className="add-node-menu"
      gap={0}
      minWidth={180}
      ariaLabel="添加节点"
    >
      <AddNodeMenuContent
        onSelect={onSelect}
        onUpload={onUpload}
        onClose={onClose}
      />
    </ViewportMenuPortal>
  )
}

export function AddNodeMenuContent({
  onSelect,
  onUpload,
  onClose,
}: Omit<AddNodeMenuProps, 'state'>) {
  return (
    <>
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
      role="menuitem"
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
