import { useId, useRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { ViewportMenuPortal } from './ViewportMenuPortal'

export interface SecondaryMenuOption {
  value: string
  label: string
  disabled?: boolean
}

interface SecondaryMenuSelectProps {
  label: string
  value: string
  options: readonly SecondaryMenuOption[]
  displayValue?: string
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (value: string) => void
  className?: string
  triggerClassName?: string
  menuClassName?: string
  optionClassName?: string
  align?: 'start' | 'end'
  disabled?: boolean
}

export function SecondaryMenuSelect({
  label,
  value,
  options,
  displayValue,
  title,
  open,
  onOpenChange,
  onChange,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  optionClassName = '',
  align = 'start',
  disabled = false,
}: SecondaryMenuSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const selectedOption = options.find((option) => option.value === value)

  return (
    <div
      ref={rootRef}
      className={`secondary-menu-select ${className}`.trim()}
    >
      <button
        type="button"
        className={`secondary-menu-trigger ${triggerClassName}`.trim()}
        role="combobox"
        aria-label={label}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        title={title}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        <span className="secondary-menu-trigger-value">
          {displayValue ?? selectedOption?.label ?? value}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      <ViewportMenuPortal
        anchorRef={rootRef}
        open={open}
        onClose={() => onOpenChange(false)}
        align={align}
        className={`add-node-menu secondary-menu-options align-${align} ${menuClassName}`.trim()}
        id={menuId}
        ariaLabel={`${label}选项`}
      >
        <div>
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                className={`add-node-menu-item secondary-menu-option${optionClassName ? ` ${optionClassName}` : ''}${selected ? ' selected' : ''}`}
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
      </ViewportMenuPortal>
    </div>
  )
}
