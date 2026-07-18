import { useEffect, useId, useRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface SecondaryMenuOption {
  value: string
  label: string
  disabled?: boolean
}

interface SecondaryMenuSelectProps {
  label: string
  value: string
  options: readonly SecondaryMenuOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (value: string) => void
  className?: string
  align?: 'start' | 'end'
  disabled?: boolean
}

export function SecondaryMenuSelect({
  label,
  value,
  options,
  open,
  onOpenChange,
  onChange,
  className = '',
  align = 'start',
  disabled = false,
}: SecondaryMenuSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return

    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onOpenChange, open])

  return (
    <div
      ref={rootRef}
      className={`secondary-menu-select ${className}`.trim()}
    >
      <button
        type="button"
        className="secondary-menu-trigger"
        role="combobox"
        aria-label={label}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        <span className="secondary-menu-trigger-value">
          {selectedOption?.label ?? value}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          className={`add-node-menu secondary-menu-options align-${align}`}
          role="menu"
          aria-label={`${label}选项`}
        >
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                className={`add-node-menu-item secondary-menu-option${selected ? ' selected' : ''}`}
                role="menuitemradio"
                aria-checked={selected}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value)
                  onOpenChange(false)
                }}
              >
                <span className="secondary-menu-option-label">{option.label}</span>
                <Check
                  className="secondary-menu-option-check"
                  size={14}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
