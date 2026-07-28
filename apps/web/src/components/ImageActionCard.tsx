import {
  Download,
  Grid3x3,
  Maximize2,
  ShieldCheck,
  Slice,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type ValidationStatus = 'idle' | 'checking' | 'success' | 'error'
type UpscaleResolution = '2k' | '4k' | '8k'
type GridGeneratePreset = '2x2' | '3x3' | '4x4'

/** 宫格生成菜单展示顺序：默认 3×3 在最前 */
const GRID_GENERATE_MENU_OPTIONS: GridGeneratePreset[] = ['3x3', '2x2', '4x4']

interface ImageActionCardProps {
  validationStatus?: ValidationStatus
  validationLabel?: string
  validationAriaLabel?: string
  upscaleResolution: UpscaleResolution
  busy?: boolean
  gridBusy?: boolean
  gridDisabled?: boolean
  closing?: boolean
  onUpscale: (resolution: UpscaleResolution) => void
  onUpscaleResolutionChange: (resolution: UpscaleResolution) => void
  onValidate: () => void
  onDownload: () => void
  onOpenFullSize: () => void
  onGridGenerate?: (grid: GridGeneratePreset) => void
  onGridCrop?: () => void
}

export function ImageActionCard({
  validationStatus = 'idle',
  validationLabel = '校验',
  validationAriaLabel = '校验当前图片模型',
  upscaleResolution,
  busy = false,
  gridBusy = false,
  gridDisabled = false,
  closing = false,
  onUpscale,
  onUpscaleResolutionChange,
  onValidate,
  onDownload,
  onOpenFullSize,
  onGridGenerate,
  onGridCrop,
}: ImageActionCardProps) {
  const [upscaleMenuOpen, setUpscaleMenuOpen] = useState(false)
  const [gridMenuOpen, setGridMenuOpen] = useState(false)
  const [draftResolution, setDraftResolution] =
    useState<UpscaleResolution>(upscaleResolution)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!upscaleMenuOpen) {
      setDraftResolution(upscaleResolution)
    }
  }, [upscaleMenuOpen, upscaleResolution])

  // 菜单统一支持点外部关闭、Escape 关闭
  useEffect(() => {
    if (!upscaleMenuOpen && !gridMenuOpen) return

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const card = cardRef.current
      if (card && event.target instanceof Node && card.contains(event.target)) {
        return
      }
      setUpscaleMenuOpen(false)
      setGridMenuOpen(false)
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUpscaleMenuOpen(false)
        setGridMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [gridMenuOpen, upscaleMenuOpen])

  const confirmUpscale = () => {
    onUpscaleResolutionChange(draftResolution)
    onUpscale(draftResolution)
    setUpscaleMenuOpen(false)
  }

  const gridActionsDisabled = busy || gridBusy || gridDisabled

  return (
    <div
      ref={cardRef}
      className={`image-action-card nodrag nopan${closing ? ' closing' : ''}`}
      role="toolbar"
      aria-label="图片工具"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="image-upscale-control">
        <button
          type="button"
          className="image-action-button"
          onClick={() => {
            setUpscaleMenuOpen((open) => !open)
            setGridMenuOpen(false)
          }}
          disabled={busy}
          aria-label="图片高清"
          aria-haspopup="menu"
          aria-expanded={upscaleMenuOpen}
        >
          <Sparkles size={17} strokeWidth={1.7} />
          <span>高清</span>
        </button>
        {upscaleMenuOpen ? (
          <div className="image-upscale-menu" role="menu" aria-label="高清参数">
            <div className="image-upscale-options">
              {(['2k', '4k', '8k'] as const).map((resolution) => (
                <button
                  key={resolution}
                  type="button"
                  className={`image-upscale-option${
                    draftResolution === resolution ? ' active' : ''
                  }`}
                  onClick={() => {
                    setDraftResolution(resolution)
                  }}
                  disabled={busy}
                  role="menuitemradio"
                  aria-checked={draftResolution === resolution}
                >
                  {resolution.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="image-upscale-confirm"
              onClick={confirmUpscale}
              disabled={busy}
            >
              确定
            </button>
          </div>
        ) : null}
      </div>
      {onGridGenerate ? (
        <div className="image-upscale-control">
          <button
            type="button"
            className="image-action-button icon-only"
            onClick={() => {
              setGridMenuOpen((open) => !open)
              setUpscaleMenuOpen(false)
            }}
            disabled={gridActionsDisabled}
            aria-label="宫格生成"
            title="宫格生成"
            aria-haspopup="menu"
            aria-expanded={gridMenuOpen}
          >
            <Grid3x3 size={17} strokeWidth={1.7} />
          </button>
          {gridMenuOpen ? (
            <div
              className="image-upscale-menu"
              role="menu"
              aria-label="宫格生成规格"
            >
              <div className="image-upscale-options">
                {GRID_GENERATE_MENU_OPTIONS.map((grid) => (
                  <button
                    key={grid}
                    type="button"
                    className="image-upscale-option"
                    onClick={() => {
                      setGridMenuOpen(false)
                      onGridGenerate(grid)
                    }}
                    disabled={gridActionsDisabled}
                    role="menuitem"
                  >
                    {grid.replace('x', '×')}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {onGridCrop ? (
        <button
          type="button"
          className="image-action-button icon-only"
          onClick={onGridCrop}
          disabled={gridActionsDisabled}
          aria-label="宫格切分"
          title="宫格切分"
        >
          <Slice size={17} strokeWidth={1.7} />
        </button>
      ) : null}
      <button
        type="button"
        className={`image-action-button validation-${validationStatus}`}
        onClick={onValidate}
        disabled={busy}
        aria-label={validationAriaLabel}
      >
        <ShieldCheck size={17} strokeWidth={1.7} />
        <span>{validationLabel}</span>
      </button>
      <span className="image-action-divider" aria-hidden="true" />
      <button
        type="button"
        className="image-action-button icon-only"
        onClick={onDownload}
        disabled={busy}
        aria-label="下载图片到本地"
        title="下载"
      >
        <Download size={17} strokeWidth={1.7} />
        <span>下载</span>
      </button>
      <button
        type="button"
        className="image-action-button icon-only"
        onClick={onOpenFullSize}
        disabled={busy}
        aria-label="放大查看图片"
        title="放大"
      >
        <Maximize2 size={17} strokeWidth={1.7} />
      </button>
    </div>
  )
}
