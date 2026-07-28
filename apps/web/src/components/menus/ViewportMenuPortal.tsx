import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { getFloatingMenuPlacement } from '../../utils/floatingMenuPlacement'

interface ViewportMenuPortalProps {
  anchorRef?: RefObject<HTMLElement | null>
  anchorPoint?: { x: number; y: number }
  children: ReactNode
  className: string
  open: boolean
  onClose: () => void
  align?: 'start' | 'end'
  gap?: number
  margin?: number
  minWidth?: number
  style?: CSSProperties
  id?: string
  role?: string
  ariaLabel?: string
}

const HIDDEN_STYLE: CSSProperties = {
  position: 'fixed',
  top: -10000,
  left: -10000,
  visibility: 'hidden',
}

export function ViewportMenuPortal({
  anchorRef,
  anchorPoint,
  children,
  className,
  open,
  onClose,
  align = 'start',
  gap = 6,
  margin = 8,
  minWidth = 148,
  style,
  id,
  role = 'menu',
  ariaLabel,
}: ViewportMenuPortalProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [placementStyle, setPlacementStyle] = useState<CSSProperties>(HIDDEN_STYLE)
  const [placement, setPlacement] = useState<'up' | 'down'>('down')

  useLayoutEffect(() => {
    if (!open) return

    const updatePlacement = () => {
      const anchor = anchorRef?.current
      const menu = menuRef.current
      if ((!anchor && !anchorPoint) || !menu) return

      const anchorRect = anchor
        ? anchor.getBoundingClientRect()
        : {
            left: anchorPoint?.x ?? 0,
            right: anchorPoint?.x ?? 0,
            top: anchorPoint?.y ?? 0,
            bottom: anchorPoint?.y ?? 0,
            width: 0,
          }
      const next = getFloatingMenuPlacement({
        triggerLeft: anchorRect.left,
        triggerRight: anchorRect.right,
        triggerTop: anchorRect.top,
        triggerBottom: anchorRect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        menuWidth: menu.scrollWidth,
        menuHeight: menu.scrollHeight,
        align,
        gap,
        margin,
      })

      setPlacement(next.direction)
      setPlacementStyle({
        position: 'fixed',
        top: next.top,
        left: next.left,
        minWidth: Math.max(anchorRect.width, minWidth),
        maxHeight: next.maxHeight,
        visibility: 'visible',
      })
    }

    updatePlacement()
    const frame = window.requestAnimationFrame(updatePlacement)
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updatePlacement)
    if (anchorRef?.current) observer?.observe(anchorRef.current)
    if (menuRef.current) observer?.observe(menuRef.current)
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [align, anchorPoint, anchorRef, gap, margin, minWidth, open])

  useEffect(() => {
    if (!open) return

    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !anchorRef?.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        onClose()
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [anchorRef, onClose, open])

  if (!open) return null

  const menu = (
    <div
      ref={menuRef}
      id={id}
      className={`viewport-menu-layer ${className}`.trim()}
      style={{ ...style, ...placementStyle }}
      data-placement={placement}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )

  return typeof document === 'undefined' ? menu : createPortal(menu, document.body)
}
