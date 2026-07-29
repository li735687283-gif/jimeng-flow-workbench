import { Maximize2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ViewportMenuPortal } from './menus/ViewportMenuPortal'
import { deleteSelection, insertTextAtSelection } from '../utils/textEditActions'

interface PromptEditorProps {
  value: string
  disabled?: boolean
  autoFocus?: boolean
  onChange: (value: string) => void
}

export function PromptEditor({
  value,
  disabled = false,
  autoFocus = false,
  onChange,
}: PromptEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [editMenu, setEditMenu] = useState<{ x: number; y: number } | null>(null)
  const [editMenuError, setEditMenuError] = useState<string | null>(null)
  const editSelectionRef = useRef({ start: 0, end: 0 })
  const editTargetRef = useRef<HTMLTextAreaElement | null>(null)

  const handleWheel = useCallback((event: WheelEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
  }, [])

  /** Electron 壳没有原生输入框右键菜单，这里自绘一套统一深色菜单。 */
  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLTextAreaElement>) => {
      if (disabled) return
      event.preventDefault()
      event.stopPropagation()
      const target = event.currentTarget
      editTargetRef.current = target
      editSelectionRef.current = {
        start: target.selectionStart ?? target.value.length,
        end: target.selectionEnd ?? target.value.length,
      }
      setEditMenuError(null)
      setEditMenu({ x: event.clientX, y: event.clientY })
    },
    [disabled],
  )

  const restoreCaret = useCallback((caret: number) => {
    window.requestAnimationFrame(() => {
      const el = editTargetRef.current ?? textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }, [])

  const handleMenuPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        setEditMenuError('剪贴板里没有可粘贴的文本')
        return
      }
      const { start, end } = editSelectionRef.current
      const next = insertTextAtSelection(value, start, end, text)
      onChange(next.value)
      setEditMenu(null)
      restoreCaret(next.caret)
    } catch {
      setEditMenuError('读取剪贴板失败，请按 Ctrl+V 粘贴')
    }
  }, [onChange, restoreCaret, value])

  const selectedText = useCallback(() => {
    const { start, end } = editSelectionRef.current
    return value.slice(start, end)
  }, [value])

  const handleMenuCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedText())
      setEditMenu(null)
    } catch {
      setEditMenuError('写入剪贴板失败，请按 Ctrl+C 复制')
    }
  }, [selectedText])

  const handleMenuCut = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedText())
    } catch {
      setEditMenuError('写入剪贴板失败，请按 Ctrl+X 剪切')
      return
    }
    const { start, end } = editSelectionRef.current
    const next = deleteSelection(value, start, end)
    onChange(next.value)
    setEditMenu(null)
    restoreCaret(next.caret)
  }, [onChange, restoreCaret, selectedText, value])

  const handleMenuSelectAll = useCallback(() => {
    const el = editTargetRef.current ?? textareaRef.current
    if (el) {
      el.focus()
      el.setSelectionRange(0, el.value.length)
    }
    setEditMenu(null)
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
      onContextMenu={handleContextMenu}
      disabled={disabled}
    />
  )

  const hasSelection =
    editSelectionRef.current.end > editSelectionRef.current.start

  const editMenuLayer = editMenu ? (
    <ViewportMenuPortal
      anchorPoint={{ x: editMenu.x, y: editMenu.y }}
      open
      onClose={() => setEditMenu(null)}
      className="context-menu"
      gap={0}
      minWidth={160}
      ariaLabel="提示词编辑菜单"
    >
      <button
        type="button"
        className="menu-item"
        onClick={() => void handleMenuPaste()}
      >
        粘贴
      </button>
      <button
        type="button"
        className="menu-item"
        disabled={!hasSelection}
        onClick={() => void handleMenuCopy()}
      >
        复制
      </button>
      <button
        type="button"
        className="menu-item"
        disabled={!hasSelection}
        onClick={() => void handleMenuCut()}
      >
        剪切
      </button>
      <div className="menu-divider" aria-hidden="true" />
      <button type="button" className="menu-item" onClick={handleMenuSelectAll}>
        全选
      </button>
      {editMenuError ? (
        <div className="menu-item" role="alert" aria-disabled="true">
          {editMenuError}
        </div>
      ) : null}
    </ViewportMenuPortal>
  ) : null

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
                  onContextMenu={handleContextMenu}
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

      {editMenuLayer}
    </>
  )
}
