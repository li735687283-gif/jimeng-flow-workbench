import { useRef, useState } from 'react'
import { EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { Scissors } from 'lucide-react'
import { useCanvasStore } from '../../state/canvasStore'

const EDGE_COLOR_DEFAULT = '#6f7278'
const EDGE_COLOR_ACTIVE = '#e2e2e4'

export function CutEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const removeEdge = useCanvasStore((s) => s.removeEdge)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isActive = hovered || selected
  const showButton = hovered || selected

  const cancelLeave = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }

  const handleEnter = () => {
    cancelLeave()
    setHovered(true)
  }

  const handleLeave = () => {
    cancelLeave()
    leaveTimerRef.current = setTimeout(() => setHovered(false), 120)
  }

  return (
    <>
      {/* 可见细贝塞尔曲线 */}
      <path
        d={edgePath}
        fill="none"
        stroke={isActive ? EDGE_COLOR_ACTIVE : EDGE_COLOR_DEFAULT}
        strokeWidth={2.4}
        strokeLinecap="round"
        style={{ opacity: isActive ? 0.95 : 0.82, pointerEvents: 'none' }}
        className="cut-edge-visible"
      />
      <path
        d={edgePath}
        fill="none"
        stroke={EDGE_COLOR_ACTIVE}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeDasharray="16 44"
        style={{ opacity: isActive ? 0.42 : 0.16, pointerEvents: 'none' }}
        className="cut-edge-flow"
      />
      {/* 透明加粗命中热区 */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        className="cut-edge-hit"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      />
      <EdgeLabelRenderer>
        {showButton && (
          <div
            className="cut-edge-button-wrap"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              position: 'absolute',
              pointerEvents: 'all',
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <button
              type="button"
              className="cut-edge-button"
              title="断开连线"
              onClick={(e) => {
                e.stopPropagation()
                removeEdge(id)
              }}
            >
              <Scissors size={12} />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
