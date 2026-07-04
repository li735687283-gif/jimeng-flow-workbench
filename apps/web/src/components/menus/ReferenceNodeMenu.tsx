import {
  AudioLines,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Layers,
  Link,
  Scissors,
  Type,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FlowNodeType } from '../../types/nodeTypes'

export interface ReferenceNodeMenuState {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  sourceNodeId: string
  sourceHandleId: string | null
  sourceHandleType: 'source' | 'target' | null
}

type ReferenceActionKey =
  | 'text'
  | 'image'
  | 'video'
  | 'videoMix'
  | 'director'
  | 'audio'
  | 'script'
  | 'reference'

interface ReferenceMenuItem {
  key: ReferenceActionKey
  label: string
  icon: LucideIcon
  nodeType?: FlowNodeType
  disabled?: boolean
  badge?: 'Beta' | 'NEW'
  chevron?: boolean
}

interface ReferenceNodeMenuProps {
  state: ReferenceNodeMenuState
  sourceType?: string
  onSelect: (type: FlowNodeType) => void
  onClose: () => void
}

export function ReferenceNodeMenu({
  state,
  sourceType,
  onSelect,
  onClose,
}: ReferenceNodeMenuProps) {
  const items: ReferenceMenuItem[] = [
    { key: 'text', label: '文本', icon: Type, nodeType: 'text' },
    {
      key: 'image',
      label: '图片',
      icon: ImageIcon,
      nodeType: 'image',
      disabled: sourceType === 'video',
    },
    { key: 'video', label: '视频', icon: Video, nodeType: 'video' },
    {
      key: 'videoMix',
      label: '视频合成',
      icon: Scissors,
      disabled: true,
      badge: 'Beta',
    },
    {
      key: 'director',
      label: '导演台',
      icon: Layers,
      disabled: true,
      badge: 'NEW',
    },
    { key: 'audio', label: '音频', icon: AudioLines, disabled: true },
    {
      key: 'script',
      label: '脚本',
      icon: FileText,
      nodeType: 'text',
      chevron: true,
    },
    { key: 'reference', label: '参考节点', icon: Link, disabled: true },
  ]

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
        className="reference-node-menu"
        style={{ left: state.x, top: state.y }}
      >
        <div className="reference-menu-title">引用该节点生成</div>
        <div className="reference-menu-list">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                className="reference-menu-item"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.nodeType) return
                  onSelect(item.nodeType)
                  onClose()
                }}
              >
                <Icon size={19} strokeWidth={1.9} />
                <span className="reference-menu-label">{item.label}</span>
                {item.badge && (
                  <span className="reference-menu-badge">{item.badge}</span>
                )}
                {item.chevron && (
                  <ChevronRight
                    className="reference-menu-chevron"
                    size={18}
                    strokeWidth={1.9}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
