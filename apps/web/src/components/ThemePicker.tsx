import { useRef, type KeyboardEvent } from 'react'
import { Check, Palette } from 'lucide-react'
import type { CanvasTheme } from '@jimeng-flow/shared'

import { CANVAS_THEME_OPTIONS } from '../utils/canvasTheme'

const previewImages: Partial<Record<CanvasTheme, string>> = {
  'starry-night': new URL('../assets/themes/starry-night.jpg', import.meta.url).href,
  'turner-mist': new URL('../assets/themes/turner-mist.jpg', import.meta.url).href,
  'hokusai-indigo': new URL('../assets/themes/hokusai-indigo.jpg', import.meta.url).href,
  'monet-lilac': new URL('../assets/themes/monet-lilac.jpg', import.meta.url).href,
}

interface ThemePickerProps {
  value: CanvasTheme
  onChange: (theme: CanvasTheme) => void
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % CANVAS_THEME_OPTIONS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + CANVAS_THEME_OPTIONS.length) % CANVAS_THEME_OPTIONS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = CANVAS_THEME_OPTIONS.length - 1
    }

    if (nextIndex === null) return
    event.preventDefault()
    onChange(CANVAS_THEME_OPTIONS[nextIndex].id)
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <section className="settings-theme-section">
      <div className="settings-theme-heading">
        <span className="settings-theme-heading-icon" aria-hidden="true">
          <Palette size={16} strokeWidth={1.8} />
        </span>
        <span>
          <strong>全局皮肤</strong>
          <small>选中后立即预览，点击底部“确认”保存</small>
        </span>
      </div>

      <div className="settings-theme-grid" role="radiogroup" aria-label="全局皮肤">
        {CANVAS_THEME_OPTIONS.map((option, index) => {
          const selected = option.id === value
          const image = previewImages[option.id]
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              data-theme-option={option.id}
              className={`settings-theme-card${selected ? ' is-selected' : ''}`}
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className="settings-theme-preview" data-theme-preview={option.id}>
                {image ? <img src={image} alt="" aria-hidden="true" /> : null}
                <span className="settings-theme-preview-tint" aria-hidden="true" />
              </span>
              <span className="settings-theme-copy">
                <strong>{option.name}</strong>
                <small>{option.description}</small>
              </span>
              <span className="settings-theme-check" aria-hidden="true">
                {selected ? <Check size={14} strokeWidth={2.2} /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}