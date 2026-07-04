// 本地节点类型定义（不修改 packages/shared）
import type { Node } from '@xyflow/react'

export type NodeStatus = 'idle' | 'running' | 'success' | 'error'

export type FlowNodeType =
  | 'text'
  | 'image'
  | 'video'
  | 'generate'
  | 'agentPrompt'
  | 'note'

export interface BaseNodeData {
  title: string
  status: NodeStatus
  content?: string
  [key: string]: unknown
}

export type FlowNode = Node<BaseNodeData, FlowNodeType>
