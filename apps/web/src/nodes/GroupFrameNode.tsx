import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Group } from 'lucide-react'
import { useCanvasStore } from '../state/canvasStore'
import { DEFAULT_GROUP_COLOR } from '../utils/nodeGroup'
import { EditableNodeTitle } from './EditableNodeTitle'

/**
 * 画框组：一个有固定边界的框。拖动框内空白（即框本身）移动整组；
 * 角/边手柄只改变框的大小，成员节点不动；成员拖出框自动脱离、外部节点拖入自动加入。
 */
export const GroupFrameNode = memo(function GroupFrameNode({
  id,
  data,
  selected,
}: NodeProps) {
  // 任一成员被选中时框也进入“选中态”（填充加深到约 30%）
  const memberSelected = useCanvasStore((s) =>
    s.nodes.some((n) => n.id !== id && n.data?.groupId === id && n.selected),
  )
  const active = Boolean(selected) || memberSelected
  const color = typeof data?.color === 'string' && data.color ? data.color : DEFAULT_GROUP_COLOR
  const title = typeof data?.title === 'string' && data.title ? data.title : '组'

  return (
    <div
      className={`group-frame${active ? ' active' : ''}`}
      style={{ ['--group-frame-color' as string]: color }}
    >
      <NodeResizer
        isVisible={Boolean(selected)}
        minWidth={120}
        minHeight={90}
        lineClassName="group-frame-resize-line"
        handleClassName="group-frame-resize-handle"
      />
      <EditableNodeTitle icon={Group} title={title} nodeId={id} />
    </div>
  )
})
