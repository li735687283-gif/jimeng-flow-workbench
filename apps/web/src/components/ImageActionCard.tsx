import {
  Download,
  Grid3x3,
  Maximize2,
  ShieldCheck,
  Slice,
  Sparkles,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { ViewportMenuPortal } from './menus/ViewportMenuPortal'

type ValidationStatus = 'idle' | 'checking' | 'success' | 'error'
type GridGeneratePreset = '2x2' | '3x3' | '4x4'

/** 宫格生成菜单展示顺序：默认 3×3 在最前 */
const GRID_GENERATE_MENU_OPTIONS: GridGeneratePreset[] = ['3x3', '2x2', '4x4']

interface ImageActionCardProps {
  validationStatus?: ValidationStatus
  validationLabel?: string
  validationAriaLabel?: string
  validationTitle?: string
  busy?: boolean
  gridBusy?: boolean
  gridDisabled?: boolean
  closing?: boolean
  /** 点击「高清」打开高清配置界面（UpscaleOverlay） */
  onUpscale: () => void
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
  validationTitle,
  busy = false,
  gridBusy = false,
  gridDisabled = false,
  closing = false,
  onUpscale,
  onValidate,
  onDownload,
  onOpenFullSize,
  onGridGenerate,
  onGridCrop,
}: ImageActionCardProps) {
  const [gridMenuOpen, setGridMenuOpen] = useState(false)
  const gridMenuAnchorRef = useRef<HTMLDivElement | null>(null)

  const gridActionsDisabled = busy || gridBusy || gridDisabled

  return (
    <div
      className={`image-action-card nodrag nopan${closing ? ' closing' : ''}`}
      role="toolbar"
      aria-label="图片工具"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="image-action-button"
        onClick={onUpscale}
        disabled={busy}
        aria-label="图片高清"
        title="高清增强配置"
      >
        <Sparkles size={17} strokeWidth={1.7} />
        <span>高清</span>
      </button>
      {onGridGenerate ? (
        <div ref={gridMenuAnchorRef} className="image-upscale-control">
          <button
            type="button"
            className="image-action-button icon-only"
            onClick={() => {
              setGridMenuOpen((open) => !open)
            }}
            disabled={gridActionsDisabled}
            aria-label="宫格生成"
            title="宫格生成"
            aria-haspopup="menu"
            aria-expanded={gridMenuOpen}
          >
            <Grid3x3 size={17} strokeWidth={1.7} />
          </button>
          <ViewportMenuPortal
            anchorRef={gridMenuAnchorRef}
            open={gridMenuOpen}
            onClose={() => setGridMenuOpen(false)}
            className="image-upscale-menu"
            ariaLabel="宫格生成规格"
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
          </ViewportMenuPortal>
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
        title={validationTitle}
      >
        <span className="validation-icon">
          <ShieldCheck size={17} strokeWidth={1.7} />
          {validationStatus === 'checking' ? (
            <span className="validation-spinner" aria-hidden="true" />
          ) : null}
        </span>
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
