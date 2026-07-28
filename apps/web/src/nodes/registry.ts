import type { ComponentType } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import type { LucideIcon } from 'lucide-react'
import { FileText, Image as ImageIcon, Video, Bot, StickyNote } from 'lucide-react'
import type { FlowNodeType, NodeStatus, BaseNodeData } from '../types/nodeTypes'
import { TextNode } from './TextNode'
import { ImageNode } from './ImageNode'
import { VideoNode } from './VideoNode'
import { AgentPromptNode } from './AgentPromptNode'
import { NoteNode } from './NoteNode'
import { GroupFrameNode } from './GroupFrameNode'

export interface NodeDefinition {
  type: FlowNodeType
  label: string // 短名称（用于菜单）
  defaultTitle: string // 节点标题前缀（不含序号）
  icon: LucideIcon
  create: (position: { x: number; y: number }, index: number) => Node
  Component: ComponentType<NodeProps>
}

function makeCreate(
  type: FlowNodeType,
  defaultTitle: string,
): NodeDefinition['create'] {
  return (position, index) => ({
    id: `${type}-${crypto.randomUUID()}`,
    type,
    position,
    data: {
      title: `${defaultTitle} ${index}`,
      status: 'idle' as NodeStatus,
    } satisfies BaseNodeData,
  })
}

export const nodeRegistry: Record<FlowNodeType, NodeDefinition> = {
  text: {
    type: 'text',
    label: '文本',
    defaultTitle: '文本',
    icon: FileText,
    create: makeCreate('text', '文本'),
    Component: TextNode,
  },
  image: {
    type: 'image',
    label: '图片',
    defaultTitle: '图片',
    icon: ImageIcon,
    create: makeCreate('image', '图片'),
    Component: ImageNode,
  },
  video: {
    type: 'video',
    label: '视频',
    defaultTitle: '视频',
    icon: Video,
    create: makeCreate('video', '视频'),
    Component: VideoNode,
  },
  agentPrompt: {
    type: 'agentPrompt',
    label: 'Agent Prompt',
    defaultTitle: 'Agent Prompt',
    icon: Bot,
    create: makeCreate('agentPrompt', 'Agent Prompt'),
    Component: AgentPromptNode,
  },
  note: {
    type: 'note',
    label: '备注',
    defaultTitle: '备注',
    icon: StickyNote,
    create: makeCreate('note', '备注'),
    Component: NoteNode,
  },
  // 画框组：不出现在添加节点菜单，由多选工具栏“打组”创建
  groupFrame: {
    type: 'groupFrame',
    label: '组',
    defaultTitle: '组',
    icon: StickyNote,
    create: makeCreate('groupFrame', '组'),
    Component: GroupFrameNode,
  },
}

export const nodeRegistryList = Object.values(nodeRegistry)

export const nodeTypes = Object.fromEntries(
  nodeRegistryList.map((def) => [def.type, def.Component]),
) as Record<string, ComponentType<NodeProps>>

// 向后兼容：旧版本的 'generate' 节点使用 ImageNode 渲染
nodeTypes['generate'] = ImageNode
