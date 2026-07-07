import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import {
  Download,
  Info,
  RotateCcw,
  RotateCw,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { clampPreviewScale, formatPreviewZoom } from '../utils/imageFullscreenPreview'

interface ImageFullscreenViewerProps {
  imageSrc: string
  title: string
  imageInfo: string
  scale: number
  rotation: number
  offset: { x: number; y: number }
  isPanning: boolean
  onClose: () => void
  onDownload: () => void
  onRename: (title: string) => void
  onReset: () => void
  onRotateClockwise: () => void
  onRotateCounterClockwise: () => void
  onPanStart: (point: { x: number; y: number }) => void
  onPanMove: (point: { x: number; y: number }) => void
  onPanEnd: () => void
  onScaleChange: (scale: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onWheelZoom: (deltaY: number) => void
}

export function ImageFullscreenViewer({
  imageSrc,
  title,
  imageInfo,
  scale,
  rotation,
  offset,
  isPanning,
  onClose,
  onDownload,
  onRename,
  onReset,
  onRotateClockwise,
  onRotateCounterClockwise,
  onPanStart,
  onPanMove,
  onPanEnd,
  onScaleChange,
  onZoomIn,
  onZoomOut,
  onWheelZoom,
}: ImageFullscreenViewerProps) {
  const [controlsVisible, setControlsVisible] = useState(false)
  const [infoVisible, setInfoVisible] = useState(false)
  const didDragRef = useRef(false)
  const stagePointerDownRef = useRef(false)
  const clampedScale = clampPreviewScale(scale)
  const zoomPercent = Math.round(clampedScale * 100)
  const titleWidth = Math.max(96, Math.min(420, [...title].length * 14 + 36))

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.stopPropagation()
    onWheelZoom(event.deltaY)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    setControlsVisible(true)
    const target = event.target
    setInfoVisible(
      target instanceof Element && !!target.closest('.image-fullscreen-info'),
    )
    if (!stagePointerDownRef.current) return
    didDragRef.current = true
    onPanMove({ x: event.clientX, y: event.clientY })
  }

  const handlePanStart = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 && event.button !== 2) return
    event.stopPropagation()
    stagePointerDownRef.current = true
    didDragRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    onPanStart({ x: event.clientX, y: event.clientY })
  }

  const handlePanEnd = () => {
    if (!stagePointerDownRef.current) return
    stagePointerDownRef.current = false
    onPanEnd()
  }

  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (didDragRef.current) {
      event.stopPropagation()
      didDragRef.current = false
    }
  }

  return (
    <div
      className={`image-fullscreen-viewer nodrag nopan${
        controlsVisible ? ' controls-visible' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="放大查看图片"
      onClick={onClose}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePanEnd}
      onPointerLeave={() => {
        setControlsVisible(false)
        setInfoVisible(false)
      }}
    >
      <div className="image-fullscreen-topbar image-fullscreen-left">
        <div
          className={`image-fullscreen-info${infoVisible ? ' show-info' : ''}`}
          onPointerEnter={() => setInfoVisible(true)}
          onPointerLeave={() => setInfoVisible(false)}
        >
          <button type="button" className="image-fullscreen-icon" aria-label="图片信息">
            <Info size={17} strokeWidth={1.8} />
          </button>
          <div className="image-fullscreen-info-popover" role="tooltip">
            {imageInfo}
          </div>
        </div>
        <input
          className="image-fullscreen-title-input"
          aria-label="编辑图片名称"
          value={title}
          style={{ width: `${titleWidth}px` } as CSSProperties}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onRename(event.currentTarget.value)}
        />
      </div>

      <div className="image-fullscreen-topbar image-fullscreen-zoom">
        <button
          type="button"
          className="image-fullscreen-icon"
          onClick={(event) => {
            event.stopPropagation()
            onZoomOut()
          }}
          aria-label="缩小图片"
        >
          <ZoomOut size={17} strokeWidth={1.8} />
        </button>
        <span className="image-fullscreen-percent">{formatPreviewZoom(clampedScale)}</span>
        <input
          className="image-fullscreen-range"
          type="range"
          min={5}
          max={400}
          value={zoomPercent}
          aria-label="图片缩放比例"
          aria-valuemin={5}
          aria-valuemax={400}
          aria-valuenow={zoomPercent}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onScaleChange(Number(event.currentTarget.value) / 100)}
        />
        <button
          type="button"
          className="image-fullscreen-icon"
          onClick={(event) => {
            event.stopPropagation()
            onZoomIn()
          }}
          aria-label="放大图片"
        >
          <ZoomIn size={17} strokeWidth={1.8} />
        </button>
      </div>

      <div className="image-fullscreen-topbar image-fullscreen-right">
        <button
          type="button"
          className="image-fullscreen-icon"
          onClick={(event) => {
            event.stopPropagation()
            onReset()
          }}
          aria-label="重置预览"
        >
          <RefreshCw size={17} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="image-fullscreen-icon"
          onClick={(event) => {
            event.stopPropagation()
            onDownload()
          }}
          aria-label="下载放大图片"
        >
          <Download size={17} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="image-fullscreen-icon"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
          aria-label="关闭放大预览"
        >
          <X size={17} strokeWidth={1.8} />
        </button>
      </div>

      <div
        className={`image-fullscreen-stage${isPanning ? ' is-panning' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePanStart}
        onClick={handleStageClick}
        onContextMenu={(event) => event.preventDefault()}
      >
        <img
          src={imageSrc}
          alt={title}
          draggable={false}
          onPointerDown={handlePanStart}
          onClick={(event) => event.stopPropagation()}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${clampedScale}) rotate(${rotation}deg)`,
          }}
        />
      </div>

      <div className="image-fullscreen-rotate">
        <button
          type="button"
          className="image-fullscreen-icon"
          onClick={(event) => {
            event.stopPropagation()
            onRotateCounterClockwise()
          }}
          aria-label="逆时针旋转"
        >
          <RotateCcw size={18} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="image-fullscreen-icon"
          onClick={(event) => {
            event.stopPropagation()
            onRotateClockwise()
          }}
          aria-label="顺时针旋转"
        >
          <RotateCw size={18} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
