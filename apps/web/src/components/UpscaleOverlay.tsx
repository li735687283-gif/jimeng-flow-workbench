// 高清增强配置全屏遮罩：左侧原图预览，右侧引擎/目标分辨率配置，底部摘要 + 发送。
// 结构仿 GridCropOverlay（portal 挂 body 顶层），视觉复用 --menu-surface-* / --menu-item-* 令牌。

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, X } from 'lucide-react'
import type {
  UpscaleEngine,
  UpscaleResolutionType,
} from '@jimeng-flow/shared/upscale'
import {
  buildUpscaleSummary,
  formatMegapixels,
  formatUpscaleScale,
  getAspectRatioLabel,
  getUpscaleOutputPlan,
  UPSCALE_ENGINE_OPTIONS,
} from '../utils/upscalePlan'

const UPSCALE_RESOLUTION_OPTIONS: UpscaleResolutionType[] = ['2k', '4k', '8k']

interface UpscaleOverlayProps {
  open: boolean
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  defaultEngine?: UpscaleEngine
  defaultResolution?: UpscaleResolutionType
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (engine: UpscaleEngine, resolution: UpscaleResolutionType) => void
}

export function UpscaleOverlay({
  open,
  imageUrl,
  naturalWidth,
  naturalHeight,
  defaultEngine = 'dreamina',
  defaultResolution = '2k',
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: UpscaleOverlayProps) {
  const [engine, setEngine] = useState<UpscaleEngine>(defaultEngine)
  const [resolution, setResolution] =
    useState<UpscaleResolutionType>(defaultResolution)
  // 以 <img> 实测尺寸为准（节点 data 里的宽高可能是高清前的旧值），加载前先用 props
  const [sourceSize, setSourceSize] = useState({
    width: naturalWidth,
    height: naturalHeight,
  })

  // 每次打开时重置选择与尺寸
  useEffect(() => {
    if (!open) return
    setEngine(defaultEngine)
    setResolution(defaultResolution)
    setSourceSize({ width: naturalWidth, height: naturalHeight })
  }, [defaultEngine, defaultResolution, naturalHeight, naturalWidth, open])

  // Escape 任何时候都可关闭：任务派发后画布节点自带进度，退出不影响后台任务
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, open])

  if (!open) return null

  const outputPlan = getUpscaleOutputPlan(
    sourceSize.width,
    sourceSize.height,
    resolution,
  )
  const aspectLabel = getAspectRatioLabel(sourceSize.width, sourceSize.height)

  const content = (
    <div className="upscale-overlay" role="dialog" aria-label="高清增强配置">
      <div className="upscale-preview">
        <span className="upscale-preview-label">原图预览</span>
        <div className="upscale-preview-stage">
          <img
            src={imageUrl}
            alt="高清原图预览"
            className="upscale-preview-image"
            draggable={false}
            onLoad={(event) => {
              const img = event.currentTarget
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setSourceSize({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                })
              }
            }}
          />
        </div>
      </div>

      <div className="upscale-panel">
        <div className="upscale-panel-head">
          <span className="upscale-panel-title">高清增强配置</span>
          <button
            type="button"
            className="upscale-icon-button"
            onClick={onCancel}
            aria-label="关闭高清配置"
          >
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>

        <div className="upscale-info" aria-label="图片信息">
          <div className="upscale-info-item">
            <span className="upscale-info-label">分辨率</span>
            <span className="upscale-info-value">
              {sourceSize.width > 0 && sourceSize.height > 0
                ? `${sourceSize.width}×${sourceSize.height} px`
                : '未知'}
            </span>
          </div>
          <div className="upscale-info-item">
            <span className="upscale-info-label">宽高比</span>
            <span className="upscale-info-value">{aspectLabel || '未知'}</span>
          </div>
          <div className="upscale-info-item">
            <span className="upscale-info-label">像素总量</span>
            <span className="upscale-info-value">
              {formatMegapixels(sourceSize.width, sourceSize.height)}
            </span>
          </div>
        </div>

        <div className="upscale-section">
          <span className="upscale-section-title">处理引擎</span>
          <span className="upscale-section-subtitle">选择底层的增强策略</span>
          <div className="upscale-engine-list" role="radiogroup" aria-label="处理引擎">
            {UPSCALE_ENGINE_OPTIONS.map((option) => {
              const active = option.id === engine
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`upscale-engine-card${active ? ' active' : ''}`}
                  onClick={() => setEngine(option.id)}
                  disabled={busy}
                  role="radio"
                  aria-checked={active}
                >
                  <span className="upscale-engine-name">{option.label}</span>
                  <span className="upscale-engine-desc">
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="upscale-section">
          <span className="upscale-section-title">目标分辨率</span>
          <span className="upscale-section-subtitle">等比放大至目标分辨率</span>
          {outputPlan ? (
            <div className="upscale-output" aria-live="polite">
              <span className="upscale-output-size">
                {outputPlan.width}×{outputPlan.height} px
              </span>
              <span className="upscale-output-scale">
                {formatUpscaleScale(outputPlan.scale)}
              </span>
            </div>
          ) : null}
          <div className="upscale-resolution-pills" role="radiogroup" aria-label="目标分辨率">
            {UPSCALE_RESOLUTION_OPTIONS.map((option) => {
              const active = option === resolution
              return (
                <button
                  key={option}
                  type="button"
                  className={`upscale-resolution-pill${active ? ' active' : ''}`}
                  onClick={() => setResolution(option)}
                  disabled={busy}
                  role="radio"
                  aria-checked={active}
                >
                  {option.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>

        {error ? (
          <div className="upscale-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="upscale-footer">
          <span className="upscale-summary">
            {buildUpscaleSummary(engine, resolution)}
          </span>
          <button
            type="button"
            className="upscale-send-button"
            onClick={() => onConfirm(engine, resolution)}
            disabled={busy}
            aria-label={busy ? '高清处理中' : '开始高清'}
          >
            {busy ? (
              <span className="upscale-send-spinner" aria-hidden="true" />
            ) : (
              <ArrowUp size={19} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  )

  // 测试环境（无 document）直接内联渲染；浏览器中挂到 body 顶层避免被裁剪
  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
