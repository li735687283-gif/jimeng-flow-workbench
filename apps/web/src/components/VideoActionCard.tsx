import {
  Download,
  Maximize2,
  Minimize2,
  Scissors,
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
  onTrim: () => void
  onCompress: () => void
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
  onTrim,
  onCompress,
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
        className="image-action-button"
        onClick={onTrim}
        disabled={busy}
        aria-label="裁切视频长度"
        title="长度裁切"
      >
        <Scissors size={17} strokeWidth={1.7} />
        <span>长度裁切</span>
      </button>
      <button
        type="button"
        className="image-action-button"
        onClick={onCompress}
        disabled={busy}
        aria-label="压缩视频"
        title="视频压缩"
      >
        <Minimize2 size={17} strokeWidth={1.7} />
        <span>视频压缩</span>
      </button>
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
        onClick={(event) => {
          event.stopPropagation()
          onOpenFullSize()
        }}
        aria-label="放大查看视频"
        title="放大"
      >
        <Maximize2 size={17} strokeWidth={1.7} />
      </button>
    </div>
  )
}
