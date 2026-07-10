import { Panel, useReactFlow } from '@xyflow/react'
import { Magnet, Maximize2, Minus, Plus } from 'lucide-react'

interface CanvasZoomControlsProps {
  snapAlignEnabled: boolean
  onToggleSnapAlign: () => void
}

/**
 * 画布左下角控件：放大 / 缩小 / 适应 / 对齐吸附开关。
 * 自绘一套，避免 React Flow 默认 Controls 对 lucide 描边图标的 fill 样式冲突导致「看不见」。
 */
export function CanvasZoomControls({
  snapAlignEnabled,
  onToggleSnapAlign,
}: CanvasZoomControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <Panel
      position="bottom-left"
      className="canvas-zoom-controls nodrag nopan"
      aria-label="画布缩放与吸附"
    >
      <button
        type="button"
        className="canvas-zoom-btn"
        onClick={() => void zoomIn({ duration: 180 })}
        title="放大"
        aria-label="放大"
      >
        <Plus size={16} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className="canvas-zoom-btn"
        onClick={() => void zoomOut({ duration: 180 })}
        title="缩小"
        aria-label="缩小"
      >
        <Minus size={16} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className="canvas-zoom-btn"
        onClick={() => void fitView({ padding: 0.22, duration: 260 })}
        title="适应画布"
        aria-label="适应画布"
      >
        <Maximize2 size={15} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className={`canvas-zoom-btn canvas-snap-btn${
          snapAlignEnabled ? ' is-active' : ''
        }`}
        onClick={onToggleSnapAlign}
        title={snapAlignEnabled ? '关闭对齐吸附' : '开启对齐吸附'}
        aria-label={snapAlignEnabled ? '关闭对齐吸附' : '开启对齐吸附'}
        aria-pressed={snapAlignEnabled}
      >
        <Magnet size={15} strokeWidth={2.2} />
      </button>
    </Panel>
  )
}
