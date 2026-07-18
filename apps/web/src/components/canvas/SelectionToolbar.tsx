import { useMemo, useState, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  LayoutGrid,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  ChevronUp,
} from 'lucide-react'
import { useCanvasStore } from '../../state/canvasStore'

interface SelectionToolbarProps {
  selectedNodeIds: string[]
}

const TOOLBAR_OFFSET = 12

function getNodeSize(node: {
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
}): { width: number; height: number } {
  const width = node.measured?.width ?? node.width ?? 200
  const height = node.measured?.height ?? node.height ?? 150
  return { width, height }
}

export function SelectionToolbar({
  selectedNodeIds,
}: SelectionToolbarProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const arrangeGrid = useCanvasStore((s) => s.arrangeGrid)
  const arrangeHorizontal = useCanvasStore((s) => s.arrangeHorizontal)
  const arrangeVertical = useCanvasStore((s) => s.arrangeVertical)
  const { flowToScreenPosition } = useReactFlow()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const position = useMemo(() => {
    if (selectedNodeIds.length < 2) return null
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
    if (selected.length === 0) return null

    const minX = Math.min(...selected.map((n) => n.position.x))
    const minY = Math.min(...selected.map((n) => n.position.y))
    const sizes = selected.map(getNodeSize)
    const maxX = Math.max(
      ...selected.map((n, i) => n.position.x + sizes[i].width),
    )
    const centerX = (minX + maxX) / 2
    return flowToScreenPosition({ x: centerX, y: minY })
  }, [nodes, selectedNodeIds, flowToScreenPosition])

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  if (!position) return null

  const handleArrange = (action: () => void) => {
    action()
    setMenuOpen(false)
  }

  return (
    <>
      <style>{`
        .selection-toolbar {
          position: fixed;
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transform: translate(-50%, -100%);
        }
        .selection-toolbar-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--menu-control-bg);
          color: var(--menu-item-text);
          border: 1px solid var(--menu-control-border);
          border-radius: var(--menu-item-radius);
          box-shadow: var(--menu-surface-shadow);
          cursor: pointer;
          font-size: 12px;
          font-family: inherit;
          transition: background 0.12s, color 0.12s;
        }
        .selection-toolbar-trigger:hover {
          background: #303030;
          color: #fff;
        }
        .selection-toolbar-menu {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: var(--menu-surface-padding);
          background: var(--menu-surface-bg);
          border: 1px solid var(--menu-surface-border);
          border-radius: var(--menu-surface-radius);
          box-shadow: var(--menu-surface-shadow);
          backdrop-filter: var(--menu-surface-blur);
          min-width: 140px;
        }
        .selection-toolbar-item {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: var(--menu-item-min-height);
          padding: var(--menu-item-padding);
          background: transparent;
          color: var(--menu-item-text);
          border: none;
          border-radius: var(--menu-item-radius);
          cursor: pointer;
          font-size: 12.5px;
          font-family: inherit;
          width: 100%;
          text-align: left;
          transition: background 0.12s, color 0.12s;
        }
        .selection-toolbar-item:hover {
          background: var(--menu-item-hover-bg);
          color: #fff;
          transform: translateX(2px);
        }
      `}</style>
      <div
        ref={containerRef}
        className="selection-toolbar"
        style={{ left: position.x, top: position.y - TOOLBAR_OFFSET }}
      >
        {menuOpen && (
          <div className="selection-toolbar-menu">
            <button
              type="button"
              className="selection-toolbar-item"
              onClick={() => handleArrange(() => arrangeGrid(selectedNodeIds))}
            >
              <LayoutGrid size={14} strokeWidth={1.6} />
              <span>宫格排列</span>
            </button>
            <button
              type="button"
              className="selection-toolbar-item"
              onClick={() =>
                handleArrange(() => arrangeHorizontal(selectedNodeIds))
              }
            >
              <AlignHorizontalDistributeCenter size={14} strokeWidth={1.6} />
              <span>水平排列</span>
            </button>
            <button
              type="button"
              className="selection-toolbar-item"
              onClick={() =>
                handleArrange(() => arrangeVertical(selectedNodeIds))
              }
            >
              <AlignVerticalDistributeCenter size={14} strokeWidth={1.6} />
              <span>垂直排列</span>
            </button>
          </div>
        )}
        <button
          type="button"
          className="selection-toolbar-trigger"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <LayoutGrid size={14} strokeWidth={1.6} />
          <span>排列</span>
          <ChevronUp
            size={12}
            strokeWidth={1.6}
            style={{
              transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}
          />
        </button>
      </div>
    </>
  )
}
