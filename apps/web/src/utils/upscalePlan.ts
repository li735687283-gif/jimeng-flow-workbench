// 高清配置界面的纯逻辑：输出尺寸/倍率、宽高比、像素总量、引擎选项与摘要文案。

import type {
  UpscaleEngine,
  UpscaleResolutionType,
} from '@jimeng-flow/shared/upscale'

/** 目标长边像素：2K=2048 / 4K=4096 / 8K=8192 */
export const UPSCALE_TARGET_LONG_EDGE: Record<UpscaleResolutionType, number> = {
  '2k': 2048,
  '4k': 4096,
  '8k': 8192,
}

export interface UpscaleEngineOption {
  id: UpscaleEngine
  label: string
  description: string
}

/** 处理引擎卡片：顺序即界面展示顺序 */
export const UPSCALE_ENGINE_OPTIONS: readonly UpscaleEngineOption[] = [
  {
    id: 'dreamina',
    label: '即梦放大',
    description: '生成式放大，会重绘补充细节，画面风格统一；4K/8K 需要即梦 VIP',
  },
  {
    id: 'realesrgan',
    label: 'Real-ESRGAN',
    description:
      '本地保真放大，固定 4 倍，不改动画面内容；小图可能达不到目标分辨率时按 4x 实际尺寸交付',
  },
]

export interface UpscaleOutputPlan {
  width: number
  height: number
  scale: number
}

/** 按原图宽高比等比放大到目标长边，返回输出尺寸与放大倍率；输入非法返回 null */
export function getUpscaleOutputPlan(
  sourceWidth: number,
  sourceHeight: number,
  resolution: UpscaleResolutionType,
): UpscaleOutputPlan | null {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return null
  }
  const longEdge = Math.max(sourceWidth, sourceHeight)
  const scale = UPSCALE_TARGET_LONG_EDGE[resolution] / longEdge
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
    scale,
  }
}

/** 倍率展示：保留一位小数，如 ≈ 2.1x */
export function formatUpscaleScale(scale: number): string {
  return `≈ ${scale.toFixed(1)}x`
}

/** 宽高比化简，如 1920×1080 -> 16:9；非法输入返回空串 */
export function getAspectRatioLabel(width: number, height: number): string {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return ''
  }
  let a = Math.round(width)
  let b = Math.round(height)
  while (b !== 0) {
    const rest = a % b
    a = b
    b = rest
  }
  const gcd = a || 1
  return `${Math.round(width) / gcd}:${Math.round(height) / gcd}`
}

/** 像素总量展示：百万像素一位小数，如 2.1 MP */
export function formatMegapixels(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '0 MP'
  return `${((width * height) / 1e6).toFixed(1)} MP`
}

export function getUpscaleEngineLabel(engine: UpscaleEngine): string {
  return (
    UPSCALE_ENGINE_OPTIONS.find((option) => option.id === engine)?.label ??
    engine
  )
}

/** 底部摘要，如「高清 · 即梦放大 · 4K」 */
export function buildUpscaleSummary(
  engine: UpscaleEngine,
  resolution: UpscaleResolutionType,
): string {
  return `高清 · ${getUpscaleEngineLabel(engine)} · ${resolution.toUpperCase()}`
}
