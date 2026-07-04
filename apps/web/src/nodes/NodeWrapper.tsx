import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { LucideIcon } from 'lucide-react'
import type { NodeStatus } from '../types/nodeTypes'

interface NodeWrapperProps {
  icon: LucideIcon
  title: string
  status?: NodeStatus
  selected?: boolean
  children?: ReactNode
}

export function NodeWrapper({
  icon: Icon,
  title,
  status = 'idle',
  selected = false,
  children,
}: NodeWrapperProps) {
  return (
    <div
      className={`node-wrapper status-${status}${selected ? ' selected' : ''}`}
    >
      <div className="node-title">
        <Icon size={12} strokeWidth={1.8} />
        <span>{title}</span>
        {status === 'running' && <span className="node-status-spinner" />}
        {status === 'success' && <span className="node-status-dot success" />}
        {status === 'error' && <span className="node-status-dot error" />}
      </div>
      <div className="node-card">
        <Handle
          type="target"
          position={Position.Left}
          className="node-handle node-handle-left"
        />
        <div className="node-body">{children}</div>
        <Handle
          type="source"
          position={Position.Right}
          className="node-handle node-handle-right"
        />
      </div>
    </div>
  )
}
