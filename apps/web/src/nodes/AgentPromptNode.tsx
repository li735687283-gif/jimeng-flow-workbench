import type { NodeProps } from '@xyflow/react'
import { Bot } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import type { BaseNodeData } from '../types/nodeTypes'

export function AgentPromptNode({ id, data, selected }: NodeProps) {
  const nodeData = data as BaseNodeData
  return (
    <NodeWrapper
      icon={Bot}
      title={nodeData.title}
      status={nodeData.status}
      selected={selected}
      nodeId={id}
    >
      <div className="node-stub-content">
        <Bot size={20} strokeWidth={1.5} className="node-placeholder-icon" />
        <span className="node-placeholder">Agent Prompt（占位）</span>
      </div>
    </NodeWrapper>
  )
}
