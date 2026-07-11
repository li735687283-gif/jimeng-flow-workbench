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
    defaultTitle: '文本节点',
    icon: FileText,
    create: makeCreate('text', '文本节点'),
    Component: TextNode,
  },
  image: {
    type: 'image',
    label: '图片',
    defaultTitle: '图片节点',
    icon: ImageIcon,
    create: makeCreate('image', '图片节点'),
    Component: ImageNode,
  },
  video: {
    type: 'video',
    label: '视频',
    defaultTitle: '视频节点',
    icon: Video,
    create: makeCreate('video', '视频节点'),
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
    defaultTitle: '备注节点',
    icon: StickyNote,
    create: makeCreate('note', '备注节点'),
    Component: NoteNode,
  },
}

export const nodeRegistryList = Object.values(nodeRegistry)

export const nodeTypes = Object.fromEntries(
  nodeRegistryList.map((def) => [def.type, def.Component]),
) as Record<string, ComponentType<NodeProps>>

// 向后兼容：旧版本的 'generate' 节点使用 ImageNode 渲染
nodeTypes['generate'] = ImageNode
