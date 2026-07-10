import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Maximize2,
  Palette,
} from 'lucide-react'

export const TEXT_FRAME_COLOR_PRESETS = [
  { id: 'default', color: '#242424', label: '默认灰' },
  { id: 'slate', color: '#1e293b', label: '石板蓝' },
  { id: 'indigo', color: '#1e1b4b', label: '靛蓝' },
  { id: 'forest', color: '#0f291e', label: '森绿' },
  { id: 'wine', color: '#3a1520', label: '酒红' },
  { id: 'amber', color: '#3b2a0a', label: '琥珀' },
  { id: 'graphite', color: '#141414', label: '墨黑' },
] as const

export type TextFrameColorId = (typeof TEXT_FRAME_COLOR_PRESETS)[number]['id']

interface TextActionCardProps {
  frameColor: string
  copyDisabled?: boolean
  closing?: boolean
  onFrameColorChange: (color: string) => void
  onCopyAll: () => void | Promise<void>
  /** 与提示词框放大一致：打开大屏编辑界面 */
  onExpand: () => void
}

export function TextActionCard({
  frameColor,
  copyDisabled = false,
  closing = false,
  onFrameColorChange,
  onCopyAll,
  onExpand,
}: TextActionCardProps) {
  const [colorMenuOpen, setColorMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    if (!colorMenuOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [colorMenuOpen])

  return (
    <div
      className={`image-action-card text-action-card nodrag nopan${
        closing ? ' closing' : ''
      }`}
      role="toolbar"
      aria-label="文本节点工具"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="image-upscale-control text-action-color-control">
        <button
          type="button"
          className="image-action-button"
          onClick={() => setColorMenuOpen((open) => !open)}
          aria-label="文本框颜色"
          aria-haspopup="menu"
          aria-expanded={colorMenuOpen}
          title="框颜色"
        >
          <Palette size={17} strokeWidth={1.7} />
          <span>颜色</span>
          <span
            className="text-action-color-swatch"
            style={{ background: frameColor }}
            aria-hidden="true"
          />
        </button>
        {colorMenuOpen ? (
          <div
            className="text-action-color-menu"
            role="menu"
            aria-label="选择文本框颜色"
          >
            {TEXT_FRAME_COLOR_PRESETS.map((preset) => {
              const active =
                preset.color.toLowerCase() === frameColor.toLowerCase()
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`text-action-color-option${active ? ' active' : ''}`}
                  role="menuitemradio"
                  aria-checked={active}
                  title={preset.label}
                  aria-label={preset.label}
                  onClick={() => {
                    onFrameColorChange(preset.color)
                    setColorMenuOpen(false)
                  }}
                >
                  <span
                    className="text-action-color-swatch large"
                    style={{ background: preset.color }}
                  />
                  {active ? <Check size={13} strokeWidth={2} /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="image-action-button"
        onClick={() => {
          void Promise.resolve(onCopyAll()).then(() => setCopied(true))
        }}
        disabled={copyDisabled}
        aria-label="复制框内全部文字"
        title="复制全文"
      >
        {copied ? (
          <Check size={17} strokeWidth={1.7} />
        ) : (
          <Copy size={17} strokeWidth={1.7} />
        )}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>

      <span className="image-action-divider" aria-hidden="true" />

      <button
        type="button"
        className="image-action-button icon-only"
        onClick={onExpand}
        aria-label="放大查看文本"
        title="放大"
      >
        <Maximize2 size={17} strokeWidth={1.7} />
      </button>
    </div>
  )
}
