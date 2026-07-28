import type { FlowNodeType } from '../../types/nodeTypes'
import { AddNodeMenuContent } from './AddNodeMenu'
import { ViewportMenuPortal } from './ViewportMenuPortal'

export interface ReferenceNodeMenuState {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  sourceNodeId: string
  sourceHandleId: string | null
  sourceHandleType: 'source' | 'target' | null
}

interface ReferenceNodeMenuProps {
  state: ReferenceNodeMenuState
  onSelect: (type: FlowNodeType) => void
  onUpload: () => void
  onClose: () => void
}

export function ReferenceNodeMenu({
  state,
  onSelect,
  onUpload,
  onClose,
}: ReferenceNodeMenuProps) {
  return (
    <ViewportMenuPortal
      anchorPoint={{ x: state.x, y: state.y }}
      open
      onClose={onClose}
      className="add-node-menu"
      gap={0}
      minWidth={180}
      ariaLabel="连接并添加节点"
    >
      <AddNodeMenuContent
        onSelect={onSelect}
        onUpload={onUpload}
        onClose={onClose}
      />
    </ViewportMenuPortal>
  )
}
