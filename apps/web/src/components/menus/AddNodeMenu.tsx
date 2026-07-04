import type { FlowNodeType } from '../../types/nodeTypes'
import { nodeRegistryList } from '../../nodes/registry'

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
        {nodeRegistryList.map((def) => {
          const Icon = def.icon
          return (
            <button
              key={def.type}
              type="button"
              className="menu-item"
              onClick={() => {
                onSelect(def.type)
                onClose()
              }}
            >
              <Icon size={14} strokeWidth={1.6} />
              <span>{def.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            onUpload()
            onClose()
          }}
        >
          上传
        </button>
        <button type="button" className="menu-item" disabled>
          从生成历史选择
        </button>
      </div>
    </>
  )
}
