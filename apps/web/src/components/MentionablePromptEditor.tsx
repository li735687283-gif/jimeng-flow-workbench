import { Maximize2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type UIEvent,
  type WheelEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { getAssetThumbUrl } from '../api/assets'

export interface MentionImage {
  assetId: string
  label: string
  displayName?: string
}

interface MentionablePromptEditorProps {
  value: string
  disabled?: boolean
  mentionImages?: MentionImage[]
  onChange: (value: string) => void
}

interface ActiveMention {
  query: string
  start: number
}

interface PreviewPosition {
  left: number
  top: number
}

const MENTION_REGEX = /@([^@\s]*)$/
const MENTION_PREVIEW_WIDTH = 240
const MENTION_PREVIEW_HEIGHT = 190
const MENTION_PREVIEW_GAP = 10
const MENTION_PREVIEW_MARGIN = 12

function detectMention(value: string, caret: number): ActiveMention | null {
  const upToCaret = value.slice(0, caret)
  const match = upToCaret.match(MENTION_REGEX)
  if (!match) return null
  return { query: match[1], start: caret - match[0].length }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function MentionToken({ image }: { image: MentionImage }) {
  const tokenRef = useRef<HTMLSpanElement | null>(null)
  const [previewPosition, setPreviewPosition] = useState<PreviewPosition | null>(
    null,
  )
  const displayName = image.displayName?.trim() || image.label

  const showPreview = useCallback(() => {
    const token = tokenRef.current
    if (!token || typeof window === 'undefined') return
    const rect = token.getBoundingClientRect()
    const left = Math.min(
      Math.max(MENTION_PREVIEW_MARGIN, rect.left),
      Math.max(
        MENTION_PREVIEW_MARGIN,
        window.innerWidth - MENTION_PREVIEW_WIDTH - MENTION_PREVIEW_MARGIN,
      ),
    )
    const roomBelow =
      rect.bottom + MENTION_PREVIEW_GAP + MENTION_PREVIEW_HEIGHT <=
      window.innerHeight - MENTION_PREVIEW_MARGIN
    const top = roomBelow
      ? rect.bottom + MENTION_PREVIEW_GAP
      : Math.max(
          MENTION_PREVIEW_MARGIN,
          rect.top - MENTION_PREVIEW_HEIGHT - MENTION_PREVIEW_GAP,
        )
    setPreviewPosition({ left, top })
  }, [])

  return (
    <span
      ref={tokenRef}
      className="mention-token"
      title={displayName}
      onMouseEnter={showPreview}
      onMouseLeave={() => setPreviewPosition(null)}
      onClick={showPreview}
    >
      <img
        src={getAssetThumbUrl(image.assetId, 320)}
        alt=""
        className="mention-token-thumb"
        draggable={false}
      />
      <span className="mention-token-label">{displayName}</span>
      {previewPosition && typeof document !== 'undefined'
        ? createPortal(
            <span
              className="mention-token-preview"
              style={previewPosition}
              aria-hidden="true"
            >
              <img
                src={getAssetThumbUrl(image.assetId, 640)}
                alt=""
                draggable={false}
              />
              <span>{displayName}</span>
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}

function renderHighlightedText(
  text: string,
  regex: RegExp | null,
  mentionImages: MentionImage[],
): ReactNode {
  if (!regex || !text) return text
  const imagesByLabel = new Map(
    mentionImages.map((image) => [image.label, image]),
  )
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match
  regex.lastIndex = 0
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const image = imagesByLabel.get(match[0].slice(1))
    parts.push(
      image ? (
        <MentionToken key={`m-${key++}`} image={image} />
      ) : (
        <span key={`m-${key++}`} className="mention-token mention-token-text">
          {match[0]}
        </span>
      ),
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  if (text.endsWith('\n')) {
    parts.push('\u200b')
  }
  return parts
}

export function MentionablePromptEditor({
  value,
  disabled = false,
  mentionImages = [],
  onChange,
}: MentionablePromptEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const expandedTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const expandedHighlightRef = useRef<HTMLDivElement | null>(null)

  const mentionHighlightRegex = useMemo(() => {
    if (mentionImages.length === 0) return null
    const escaped = mentionImages.map((img) => escapeRegExp(img.label))
    return new RegExp(`@(?:${escaped.join('|')})`, 'g')
  }, [mentionImages])

  const filteredImages = useMemo(() => {
    if (!activeMention) return []
    const query = activeMention.query.toLowerCase()
    if (!query) return mentionImages
    return mentionImages.filter(
      (img) =>
        img.label.toLowerCase().includes(query) ||
        img.displayName?.toLowerCase().includes(query) ||
        img.assetId.toLowerCase().includes(query),
    )
  }, [activeMention, mentionImages])

  useEffect(() => {
    if (activeMention && filteredImages.length > 0) {
      setHighlightedIndex((prev) =>
        prev >= filteredImages.length ? 0 : prev,
      )
    }
  }, [activeMention, filteredImages.length])

  const getCurrentTextarea = useCallback(() => {
    return expanded ? expandedTextareaRef.current : textareaRef.current
  }, [expanded])

  const getCurrentHighlight = useCallback(() => {
    return expanded ? expandedHighlightRef.current : highlightRef.current
  }, [expanded])

  // Read value from the DOM to avoid stale closure issues
  const updateMentionFromCaret = useCallback(() => {
    const textarea = getCurrentTextarea()
    if (!textarea) {
      setActiveMention(null)
      return
    }
    const caret = textarea.selectionStart ?? 0
    const mention = detectMention(textarea.value, caret)
    setActiveMention(mention)
  }, [getCurrentTextarea])

  // Synchronous mention detection from a specific textarea element — used in
  // onChange where requestAnimationFrame would capture stale selectionStart.
  const detectMentionFromTextarea = useCallback(
    (textarea: HTMLTextAreaElement) => {
      const caret = textarea.selectionStart ?? 0
      const mention = detectMention(textarea.value, caret)
      setActiveMention(mention)
    },
    [],
  )

  const syncScroll = useCallback(() => {
    const textarea = getCurrentTextarea()
    const highlight = getCurrentHighlight()
    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop
      highlight.scrollLeft = textarea.scrollLeft
    }
  }, [getCurrentTextarea, getCurrentHighlight])

  const handleSelect = useCallback(
    (image: MentionImage) => {
      const textarea = getCurrentTextarea()
      if (!textarea || !activeMention) return
      const caret = textarea.selectionStart ?? 0
      const currentText = textarea.value
      const before = currentText.slice(0, activeMention.start)
      const insertText = `@${image.label} `
      const after = currentText.slice(caret)
      const nextValue = `${before}${insertText}${after}`
      onChange(nextValue)
      setActiveMention(null)
      const newCaret = (before + insertText).length
      requestAnimationFrame(() => {
        const target = getCurrentTextarea()
        if (target) {
          target.focus()
          target.setSelectionRange(newCaret, newCaret)
          syncScroll()
        }
      })
    },
    [activeMention, getCurrentTextarea, onChange, syncScroll],
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (!activeMention || filteredImages.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightedIndex((prev) =>
          prev + 1 >= filteredImages.length ? 0 : prev + 1,
        )
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightedIndex((prev) =>
          prev <= 0 ? filteredImages.length - 1 : prev - 1,
        )
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selected = filteredImages[highlightedIndex]
        if (selected) handleSelect(selected)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setActiveMention(null)
      }
    },
    [activeMention, filteredImages, handleSelect, highlightedIndex],
  )

  const handleWheel = useCallback((event: WheelEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
  }, [])

  const handleExpandedWheel = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      event.stopPropagation()
    },
    [],
  )

  useEffect(() => {
    if (!expanded) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !activeMention) setExpanded(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expanded, activeMention])

  const showMentionPopup = !!activeMention && filteredImages.length > 0
  const hasHighlight = useMemo(
    () => mentionImages.some((image) => value.includes(`@${image.label}`)),
    [mentionImages, value],
  )

  const renderTextarea = (isExpanded: boolean) => {
    const ref = isExpanded ? expandedTextareaRef : textareaRef
    return (
      <textarea
        ref={ref}
        className={`image-editor-prompt${isExpanded ? ' prompt-editor-modal-textarea' : ''}${hasHighlight ? ' mention-textarea' : ''}`}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          detectMentionFromTextarea(event.target)
        }}
        onKeyUp={updateMentionFromCaret}
        onClick={updateMentionFromCaret}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        onWheelCapture={handleWheel}
        disabled={disabled}
        autoFocus={isExpanded}
      />
    )
  }

  const renderHighlight = (isExpanded: boolean) => {
    if (!hasHighlight) return null
    const ref = isExpanded ? expandedHighlightRef : highlightRef
    return (
      <div
        ref={ref}
        className={`prompt-editor-highlight${isExpanded ? ' prompt-editor-highlight-modal' : ''}`}
        aria-hidden="true"
      >
        {renderHighlightedText(value, mentionHighlightRegex, mentionImages) || null}
      </div>
    )
  }

  const renderMentionPopup = () => {
    if (!showMentionPopup) return null
    return (
      <div className="mention-popup nodrag nopan">
        <div className="mention-popup-label">上游图片</div>
        <div className="mention-popup-grid">
          {filteredImages.map((image, index) => (
            <button
              type="button"
              key={image.assetId}
              className={`mention-popup-item${
                index === highlightedIndex ? ' highlighted' : ''
              }`}
              onClick={() => handleSelect(image)}
              onPointerEnter={() => setHighlightedIndex(index)}
            >
              <img
                src={getAssetThumbUrl(image.assetId, 320)}
                alt={image.displayName || image.label}
                className="mention-popup-thumb"
                draggable={false}
              />
              <span className="mention-popup-name">
                {image.displayName || image.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="prompt-editor-shell">
        {renderHighlight(false)}
        {renderTextarea(false)}
        {renderMentionPopup()}
        <button
          type="button"
          className="prompt-editor-expand"
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
              onClick={() => {
                if (!activeMention) setExpanded(false)
              }}
              onWheel={handleExpandedWheel}
            >
              <div
                className="prompt-editor-modal"
                onClick={(event) => event.stopPropagation()}
              >
                {renderHighlight(true)}
                {renderTextarea(true)}
                {renderMentionPopup()}
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
