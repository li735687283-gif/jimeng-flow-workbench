import { useRef, useState } from 'react'
import { EdgeLabelRenderer, Position, getBezierPath } from '@xyflow/react'
import type { EdgeProps, Node } from '@xyflow/react'
import { Scissors } from 'lucide-react'
import { useCanvasStore } from '../../state/canvasStore'

const EDGE_COLOR_DEFAULT = '#737373'
const EDGE_COLOR_ACTIVE = '#e3e3e3'
const FALLBACK_NODE_WIDTH = 200
const FALLBACK_NODE_HEIGHT = 150

function getNodeSize(node: Node): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? FALLBACK_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? FALLBACK_NODE_HEIGHT,
  }
}

function getCardEdgePoint(
  node: Node | undefined,
  fallback: { x: number; y: number },
  position: Position,
): { x: number; y: number } {
  if (!node) return fallback

  const { width, height } = getNodeSize(node)
  const left = node.position.x
  const right = node.position.x + width
  const top = node.position.y
  const bottom = node.position.y + height

  if (position === Position.Left || position === Position.Right) {
    return {
      x: position === Position.Left ? left : right,
      y: Math.min(bottom, Math.max(top, fallback.y)),
    }
  }

  return {
    x: Math.min(right, Math.max(left, fallback.x)),
    y: position === Position.Top ? top : bottom,
  }
}

export function CutEdge({
  id,
  source,
  sourceX,
  sourceY,
  target,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodes = useCanvasStore((s) => s.nodes)
  const removeEdge = useCanvasStore((s) => s.removeEdge)
  const sourceNode = nodes.find((node) => node.id === source)
  const targetNode = nodes.find((node) => node.id === target)
  const sourcePoint = getCardEdgePoint(
    sourceNode,
    { x: sourceX, y: sourceY },
    sourcePosition,
  )
  const targetPoint = getCardEdgePoint(
    targetNode,
    { x: targetX, y: targetY },
    targetPosition,
  )

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
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
