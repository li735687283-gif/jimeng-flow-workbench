import {
  AlignJustify,
  AudioLines,
  Image as ImageIcon,
  Upload,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FlowNodeType } from '../../types/nodeTypes'

export interface NodeMenuItem {
  key: string
  label: string
  icon: LucideIcon
  nodeType?: FlowNodeType
  action?: 'upload'
  disabled?: boolean
}

export const NODE_MENU_ITEMS: NodeMenuItem[] = [
  { key: 'text', label: '文本', icon: AlignJustify, nodeType: 'text' },
  { key: 'image', label: '图片', icon: ImageIcon, nodeType: 'image' },
  { key: 'video', label: '视频', icon: Video, nodeType: 'video' },
  { key: 'audio', label: '音频', icon: AudioLines, disabled: true },
  { key: 'upload', label: '上传', icon: Upload, action: 'upload' },
]
