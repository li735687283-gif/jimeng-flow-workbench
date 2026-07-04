import type { NodeProps } from '@xyflow/react'
import { StickyNote } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import type { BaseNodeData } from '../types/nodeTypes'

export function NoteNode({ data, selected }: NodeProps) {
  const nodeData = data as BaseNodeData
  return (
    <NodeWrapper
      icon={StickyNote}
      title={nodeData.title}
      status={nodeData.status}
      selected={selected}
    >
      <div className="node-stub-content">
        <StickyNote size={20} strokeWidth={1.5} className="node-placeholder-icon" />
        <span className="node-placeholder">备注节点（占位）</span>
      </div>
    </NodeWrapper>
  )
}
