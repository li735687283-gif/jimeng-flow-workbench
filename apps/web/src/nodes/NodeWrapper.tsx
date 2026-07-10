import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { Handle, Position, useStore, useUpdateNodeInternals } from '@xyflow/react'
import type { LucideIcon } from 'lucide-react'
import type { NodeStatus } from '../types/nodeTypes'

interface NodeWrapperProps {
  icon: LucideIcon
  title: string
  status?: NodeStatus
  selected?: boolean
  nodeId?: string
  nodeType?: string
  mediaDisplay?: boolean
  hideTitle?: boolean
  /** 透传到外层 wrapper，便于节点设置 CSS 变量（如文本框颜色） */
  style?: CSSProperties
  children?: ReactNode
}

interface MagneticHandleProps {
  type: 'target' | 'source'
  position: Position
  className: string
  nodeId?: string
}

const MAGNET_RADIUS_FLOW = 30
const MAGNET_PULL_FLOW = 10

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function MagneticHandle({ type, position, className, nodeId }: MagneticHandleProps) {
  const zoom = useStore((state) => state.transform[2])
  const updateNodeInternals = useUpdateNodeInternals()
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const measureFrameRef = useRef<number | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)
  const [captured, setCaptured] = useState(false)

  const requestHandleMeasure = useCallback(() => {
    if (!nodeId || measureFrameRef.current !== null) return
    measureFrameRef.current = window.requestAnimationFrame(() => {
      measureFrameRef.current = null
      updateNodeInternals(nodeId)
    })
  }, [nodeId, updateNodeInternals])

  const reset = useCallback(() => {
    setActive(false)
    setOffset({ x: 0, y: 0 })
    requestHandleMeasure()
  }, [requestHandleMeasure])

  const updateMagnet = useCallback((clientX: number, clientY: number, keepAttached = false) => {
    const zone = zoneRef.current
    if (!zone) return
    const rect = zone.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = clientX - centerX
    const dy = clientY - centerY
    const distance = Math.hypot(dx, dy)
    const radius = clamp(MAGNET_RADIUS_FLOW * zoom, 24, 86)

    if (distance > radius && !keepAttached) {
      reset()
      return
    }

    const maxPull = clamp(MAGNET_PULL_FLOW * zoom, 9, 26)
    const pull = distance === 0 ? 0 : Math.min(distance, maxPull)
    const strength = Math.max(0, 1 - distance / radius)
    const easedPull = pull * (0.55 + strength * 0.45)

    setActive(true)
    setOffset({
      x: distance === 0 ? 0 : (dx / distance) * easedPull,
      y: distance === 0 ? 0 : (dy / distance) * easedPull,
    })
    requestHandleMeasure()
  }, [requestHandleMeasure, reset, zoom])

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    updateMagnet(event.clientX, event.clientY, captured)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setCaptured(true)
    updateMagnet(event.clientX, event.clientY, true)
  }

  const handlePointerLeave = () => {
    if (!captured) reset()
  }

  useEffect(() => {
    if (!active && !captured) return
    const handleWindowPointerMove = (event: globalThis.PointerEvent) => {
      updateMagnet(event.clientX, event.clientY, captured)
    }
    const handleWindowPointerUp = () => {
      setCaptured(false)
      reset()
    }
    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
    }
  }, [active, captured, reset, updateMagnet])

  useEffect(() => {
    return () => {
      if (measureFrameRef.current !== null) {
        window.cancelAnimationFrame(measureFrameRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={zoneRef}
      className={`node-handle-zone nodrag nopan ${className}${active ? ' magnetic' : ''}${captured ? ' captured' : ''}`}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
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
  mediaDisplay = false,
  hideTitle = false,
  style,
  children,
}: NodeWrapperProps) {
  return (
    <div
      className={`node-wrapper status-${status}${selected ? ' selected' : ''}${mediaDisplay ? ' media-display' : ''}`}
      data-flow-node-id={nodeId}
      data-flow-node-type={nodeType}
      style={style}
    >
      {!hideTitle && (
        <div className="node-title">
          <Icon size={12} strokeWidth={1.8} />
          <span>{title}</span>
          {!mediaDisplay && status === 'success' && (
            <span className="node-status-dot success" />
          )}
          {!mediaDisplay && status === 'error' && (
            <span className="node-status-dot error" />
          )}
        </div>
      )}
      <div className="node-card">
        <MagneticHandle
          type="target"
          position={Position.Left}
          className="node-handle-left"
          nodeId={nodeId}
        />
        <div className="node-body">{children}</div>
        <MagneticHandle
          type="source"
          position={Position.Right}
          className="node-handle-right"
          nodeId={nodeId}
        />
      </div>
    </div>
  )
}
