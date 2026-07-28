import { useEffect, useRef, useState } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'

const HIDE_DELAY_MS = 150

/**
 * 自绘窗口控制按钮（桌面端）：平时隐藏，鼠标移到顶部热区时落下。
 * 替代原生 titleBarOverlay——原生无法做悬停动画，也会遮挡画布内的放大操作。
 */
export function WindowControls() {
  const controls =
    typeof window !== 'undefined'
      ? window.mokDesktop?.windowControls
      : undefined
  const [visible, setVisible] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!controls) return
    void controls.isMaximized().then(setMaximized).catch(() => undefined)
  }, [controls])

  if (!controls) return null

  const show = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    setVisible(true)
  }
  const scheduleHide = () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null
      setVisible(false)
    }, HIDE_DELAY_MS)
  }

  const handleToggleMaximize = async () => {
    try {
      setMaximized(await controls.toggleMaximize())
    } catch {
      // 忽略：窗口已销毁等极端情况
    }
  }

  return (
    <div
      className={`window-controls-zone${visible ? ' visible' : ''}`}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <div className="window-controls-notch" aria-hidden="true">
        <svg width="14" height="6" viewBox="0 0 14 6" fill="none">
          <path d="M1 1l6 4 6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="window-controls" role="toolbar" aria-label="窗口控制">
        <button
          type="button"
          className="window-controls-button"
          title="最小化"
          aria-label="最小化"
          onClick={() => void controls.minimize()}
        >
          <Minus size={14} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="window-controls-button"
          title={maximized ? '还原' : '最大化'}
          aria-label={maximized ? '还原' : '最大化'}
          onClick={() => void handleToggleMaximize()}
        >
          {maximized ? (
            <Copy size={12} strokeWidth={1.8} style={{ transform: 'scaleX(-1)' }} />
          ) : (
            <Square size={12} strokeWidth={1.8} />
          )}
        </button>
        <button
          type="button"
          className="window-controls-button close"
          title="关闭"
          aria-label="关闭"
          onClick={() => void controls.close()}
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
