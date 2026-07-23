import {
  normalizeCanvasTheme,
  type CanvasTheme,
} from '@jimeng-flow/shared'

export interface CanvasThemeOption {
  id: CanvasTheme
  name: string
  description: string
}

export const CANVAS_THEME_OPTIONS: readonly CanvasThemeOption[] = [
  { id: 'dark', name: '墨黑', description: '现有经典黑色工作台' },
  { id: 'light', name: '日间', description: '柔和米白与清晰深色文字' },
  { id: 'starry-night', name: '星夜蓝金', description: '深海蓝、旋光与金色节点线' },
  { id: 'turner-mist', name: '晨雾金灰', description: '暖金雾气与沉静炭灰表面' },
  { id: 'hokusai-indigo', name: '浮世靛青', description: '靛青海色、朱印与旧金细节' },
  { id: 'monet-lilac', name: '睡莲紫蓝', description: '紫蓝柔光与水面般层次' },
] as const

export function applyCanvasTheme(
  value: unknown,
  root: HTMLElement = document.documentElement,
): CanvasTheme {
  const theme = normalizeCanvasTheme(value)
  root.dataset.canvasTheme = theme
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark'
  return theme
}

export const CANVAS_THEME_PREVIEW_ATTRIBUTE = 'data-canvas-theme-preview'

export function beginCanvasThemePreview(
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute(CANVAS_THEME_PREVIEW_ATTRIBUTE, 'true')
}

export function endCanvasThemePreview(
  root: HTMLElement = document.documentElement,
): void {
  root.removeAttribute(CANVAS_THEME_PREVIEW_ATTRIBUTE)
}

export function isCanvasThemePreviewActive(
  root: HTMLElement = document.documentElement,
): boolean {
  return root.getAttribute(CANVAS_THEME_PREVIEW_ATTRIBUTE) === 'true'
}