import type { FlowNodeType } from '../../types/nodeTypes'
import { NODE_MENU_ITEMS } from './nodeMenuItems'

export interface ReferenceNodeMenuState {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  sourceNodeId: string
  sourceHandleId: string | null
  sourceHandleType: 'source' | 'target' | null
}

interface ReferenceNodeMenuProps {
  state: ReferenceNodeMenuState
  onSelect: (type: FlowNodeType) => void
  onUpload: () => void
  onClose: () => void
}

export function ReferenceNodeMenu({
  state,
  onSelect,
  onUpload,
  onClose,
}: ReferenceNodeMenuProps) {
  return (
    <>
      <div
        className="menu-overlay"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
      />
      <div
        className="add-node-menu"
        style={{ left: state.x, top: state.y }}
      >
        <div className="add-node-menu-title">添加节点</div>
        <div className="add-node-menu-list">
          {NODE_MENU_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
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
          })}
        </div>
      </div>
    </>
  )
}
