import {
  Download,
  Maximize2,
  ShieldCheck,
} from 'lucide-react'

type ValidationStatus = 'idle' | 'checking' | 'success' | 'error'

interface VideoActionCardProps {
  validationStatus?: ValidationStatus
  validationLabel?: string
  validationAriaLabel?: string
  busy?: boolean
  closing?: boolean
  onValidate: () => void
  onDownload: () => void
  onOpenFullSize: () => void
}

export function VideoActionCard({
  validationStatus = 'idle',
  validationLabel = '校验',
  validationAriaLabel = '校验视频模型',
  busy = false,
  closing = false,
  onValidate,
  onDownload,
  onOpenFullSize,
}: VideoActionCardProps) {
  return (
    <div
      className={`image-action-card nodrag nopan${closing ? ' closing' : ''}`}
      role="toolbar"
      aria-label="视频工具"
      onClick={(event) => event.stopPropagation()}
    >
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
        aria-label="下载视频到本地"
        title="下载"
      >
        <Download size={17} strokeWidth={1.7} />
        <span>下载</span>
      </button>
      <button
        type="button"
        className="image-action-button icon-only"
        onPointerDown={(event) => {
          // 阻止画布/节点指针逻辑抢焦点，保证放大能打开
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
          onOpenFullSize()
        }}
        disabled={busy}
        aria-label="放大查看视频"
        title="放大"
      >
        <Maximize2 size={17} strokeWidth={1.7} />
      </button>
    </div>
  )
}
