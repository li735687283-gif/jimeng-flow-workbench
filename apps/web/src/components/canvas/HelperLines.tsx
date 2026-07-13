import { useStore } from '@xyflow/react'
import type { HelperLinesState } from '../../utils/helperLines'

interface HelperLinesProps {
  lines: HelperLinesState | null
}

/**
 * 对齐辅助线：在屏幕坐标系绘制，避免 ViewportPortal + 超大坐标导致画布发黑/卡顿。
 */
export function HelperLines({ lines }: HelperLinesProps) {
  const width = useStore((s) => s.width)
  const height = useStore((s) => s.height)
  const [tx, ty, zoom] = useStore((s) => s.transform)

  if (!lines) return null
  const { verticals, horizontals } = lines
  if (verticals.length === 0 && horizontals.length === 0) return null
  if (!width || !height) return null

  const toScreenX = (flowX: number) => flowX * zoom + tx
  const toScreenY = (flowY: number) => flowY * zoom + ty

  return (
    <svg
      className="helper-lines-layer"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {verticals.map((x) => {
        const sx = toScreenX(x)
        return (
          <line
            key={`v-${x}`}
            className="helper-line helper-line-vertical"
            x1={sx}
            y1={0}
            x2={sx}
            y2={height}
          />
        )
      })}
      {horizontals.map((y) => {
        const sy = toScreenY(y)
        return (
          <line
            key={`h-${y}`}
            className="helper-line helper-line-horizontal"
            x1={0}
            y1={sy}
            x2={width}
            y2={sy}
          />
        )
      })}
    </svg>
  )
}
