import {
  AlignJustify,
  AudioLines,
  Image as ImageIcon,
  Upload,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FlowNodeType } from '../../types/nodeTypes'

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

interface AddNodeMenuItem {
  key: string
  label: string
  icon: LucideIcon
  nodeType?: FlowNodeType
  action?: 'upload'
  disabled?: boolean
}

const nodeItems: AddNodeMenuItem[] = [
  { key: 'text', label: '文本', icon: AlignJustify, nodeType: 'text' },
  { key: 'image', label: '图片', icon: ImageIcon, nodeType: 'image' },
  { key: 'video', label: '视频', icon: Video, nodeType: 'video' },
  { key: 'audio', label: '音频', icon: AudioLines, disabled: true },
  { key: 'upload', label: '上传', icon: Upload, action: 'upload' },
]

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
          {nodeItems.map((item) => (
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
  item: AddNodeMenuItem
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
