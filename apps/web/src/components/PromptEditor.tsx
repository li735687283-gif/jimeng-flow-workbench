import { Maximize2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent,
} from 'react'
import { createPortal } from 'react-dom'

interface PromptEditorProps {
  value: string
  placeholder: string
  disabled?: boolean
  autoFocus?: boolean
  onChange: (value: string) => void
}

export function PromptEditor({
  value,
  placeholder,
  disabled = false,
  autoFocus = false,
  onChange,
}: PromptEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const handleWheel = useCallback((event: WheelEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
  }, [])

  useEffect(() => {
    if (!autoFocus || disabled || expanded) return
    const frame = window.requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const end = el.value.length
      el.setSelectionRange(end, end)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [autoFocus, disabled, expanded])

  useEffect(() => {
    if (!expanded) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expanded])

  const textarea = (
    <textarea
      ref={textareaRef}
      className="image-editor-prompt nodrag nopan nowheel"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onWheelCapture={handleWheel}
      onKeyDown={(event) => event.stopPropagation()}
      onPaste={(event) => event.stopPropagation()}
      placeholder={placeholder}
      disabled={disabled}
    />
  )

  return (
    <>
      <div className="prompt-editor-shell nodrag nopan">
        {textarea}
        <button
          type="button"
          className="prompt-editor-expand nodrag nopan"
          onClick={() => setExpanded(true)}
          aria-label="放大提示词"
          title="放大提示词"
        >
          <Maximize2 size={19} strokeWidth={1.9} />
        </button>
      </div>

      {expanded && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="prompt-editor-modal-backdrop nodrag nopan"
              onClick={() => setExpanded(false)}
              onWheel={(event) => event.stopPropagation()}
            >
              <div
                className="prompt-editor-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <textarea
                  className="image-editor-prompt prompt-editor-modal-textarea"
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  onWheelCapture={handleWheel}
                  placeholder={placeholder}
                  disabled={disabled}
                  autoFocus
                />
                <button
                  type="button"
                  className="prompt-editor-expand prompt-editor-modal-toggle"
                  onClick={() => setExpanded(false)}
                  aria-label="收起提示词"
                  title="收起提示词"
                >
                  <Maximize2 size={20} strokeWidth={1.9} />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
