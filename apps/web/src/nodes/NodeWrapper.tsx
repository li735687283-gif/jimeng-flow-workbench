import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { Handle, Position, useStore } from '@xyflow/react'
import type { LucideIcon } from 'lucide-react'
import type { NodeStatus } from '../types/nodeTypes'

interface NodeWrapperProps {
  icon: LucideIcon
  title: string
  status?: NodeStatus
  selected?: boolean
  nodeId?: string
  nodeType?: string
  children?: ReactNode
}

interface MagneticHandleProps {
  type: 'target' | 'source'
  position: Position
  className: string
}

const MAGNET_RADIUS_FLOW = 30
const MAGNET_PULL_FLOW = 10

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function MagneticHandle({ type, position, className }: MagneticHandleProps) {
  const zoom = useStore((state) => state.transform[2])
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)

  const reset = useCallback(() => {
    setActive(false)
    setOffset({ x: 0, y: 0 })
  }, [])

  const updateMagnet = useCallback((clientX: number, clientY: number) => {
    const zone = zoneRef.current
    if (!zone) return
    const rect = zone.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = clientX - centerX
    const dy = clientY - centerY
    const distance = Math.hypot(dx, dy)
    const radius = clamp(MAGNET_RADIUS_FLOW * zoom, 24, 86)

    if (distance > radius) {
      reset()
      return
    }

    const maxPull = clamp(MAGNET_PULL_FLOW * zoom, 9, 26)
    const pull = distance === 0 ? 0 : Math.min(distance, maxPull)
    const strength = 1 - distance / radius
    const easedPull = pull * (0.55 + strength * 0.45)

    setActive(true)
    setOffset({
      x: distance === 0 ? 0 : (dx / distance) * easedPull,
      y: distance === 0 ? 0 : (dy / distance) * easedPull,
    })
  }, [reset, zoom])

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    updateMagnet(event.clientX, event.clientY)
  }

  useEffect(() => {
    if (!active) return
    const handleWindowPointerMove = (event: globalThis.PointerEvent) => {
      updateMagnet(event.clientX, event.clientY)
    }
    window.addEventListener('pointermove', handleWindowPointerMove)
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
    }
  }, [active, updateMagnet])

  return (
    <div
      ref={zoneRef}
      className={`node-handle-zone nodrag nopan ${className}${active ? ' magnetic' : ''}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      style={
        {
          '--magnet-x': `${offset.x}px`,
          '--magnet-y': `${offset.y}px`,
          '--magnet-radius': `${clamp(MAGNET_RADIUS_FLOW * zoom, 24, 86)}px`,
        } as CSSProperties
      }
    >
      <Handle type={type} position={position} className="node-handle">
        <span className="node-handle-dot" />
      </Handle>
    </div>
  )
}

export function NodeWrapper({
  icon: Icon,
  title,
  status = 'idle',
  selected = false,
  nodeId,
  nodeType,
  children,
}: NodeWrapperProps) {
  return (
    <div
      className={`node-wrapper status-${status}${selected ? ' selected' : ''}`}
      data-flow-node-id={nodeId}
      data-flow-node-type={nodeType}
    >
      <div className="node-title">
        <Icon size={12} strokeWidth={1.8} />
        <span>{title}</span>
        {status === 'running' && <span className="node-status-spinner" />}
        {status === 'success' && <span className="node-status-dot success" />}
        {status === 'error' && <span className="node-status-dot error" />}
      </div>
      <div className="node-card">
        <MagneticHandle
          type="target"
          position={Position.Left}
          className="node-handle-left"
        />
        <div className="node-body">{children}</div>
        <MagneticHandle
          type="source"
          position={Position.Right}
          className="node-handle-right"
        />
      </div>
    </div>
  )
}
