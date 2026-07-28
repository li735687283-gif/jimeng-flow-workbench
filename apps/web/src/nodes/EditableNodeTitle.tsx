import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { NodeStatus } from '../types/nodeTypes'
import { useCanvasStore } from '../state/canvasStore'

interface EditableNodeTitleProps {
  icon: LucideIcon
  title: string
  nodeId?: string
  status?: NodeStatus
  showStatusDot?: boolean
}

/** 节点左上外侧标题：双击进入重命名，Enter/失焦提交，Esc 取消 */
export function EditableNodeTitle({
  icon: Icon,
  title,
  nodeId,
  status = 'idle',
  showStatusDot = false,
}: EditableNodeTitleProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const cancel = () => {
    setDraft(title)
    setEditing(false)
  }
  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (nodeId && next && next !== title) {
      updateNodeData(nodeId, { title: next })
    } else {
      setDraft(title)
    }
  }

  if (editing && nodeId) {
    return (
      <div className="node-title editing">
        <Icon size={12} strokeWidth={1.8} />
        <input
          ref={inputRef}
          className="node-title-input nodrag"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') cancel()
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        />
      </div>
    )
  }

  return (
    <div
      className="node-title"
      title={nodeId ? '双击重命名' : undefined}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (!nodeId) return
        setDraft(title)
        setEditing(true)
      }}
    >
      <Icon size={12} strokeWidth={1.8} />
      <span>{title}</span>
      {showStatusDot && status === 'success' && (
        <span className="node-status-dot success" />
      )}
      {showStatusDot && status === 'error' && (
        <span className="node-status-dot error" />
      )}
    </div>
  )
}
