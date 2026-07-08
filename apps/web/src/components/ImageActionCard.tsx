import {
  Download,
  Maximize2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'

type ValidationStatus = 'idle' | 'checking' | 'success' | 'error'
type UpscaleResolution = '2k' | '4k' | '8k'

interface ImageActionCardProps {
  validationStatus?: ValidationStatus
  validationLabel?: string
  validationAriaLabel?: string
  upscaleResolution: UpscaleResolution
  busy?: boolean
  closing?: boolean
  onUpscale: (resolution: UpscaleResolution) => void
  onUpscaleResolutionChange: (resolution: UpscaleResolution) => void
  onValidate: () => void
  onDownload: () => void
  onOpenFullSize: () => void
}

export function ImageActionCard({
  validationStatus = 'idle',
  validationLabel = '校验',
  validationAriaLabel = '校验当前图片模型',
  upscaleResolution,
  busy = false,
  closing = false,
  onUpscale,
  onUpscaleResolutionChange,
  onValidate,
  onDownload,
  onOpenFullSize,
}: ImageActionCardProps) {
  const [upscaleMenuOpen, setUpscaleMenuOpen] = useState(false)
  const [draftResolution, setDraftResolution] =
    useState<UpscaleResolution>(upscaleResolution)

  useEffect(() => {
    if (!upscaleMenuOpen) {
      setDraftResolution(upscaleResolution)
    }
  }, [upscaleMenuOpen, upscaleResolution])

  const confirmUpscale = () => {
    onUpscaleResolutionChange(draftResolution)
    onUpscale(draftResolution)
    setUpscaleMenuOpen(false)
  }

  return (
    <div
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
