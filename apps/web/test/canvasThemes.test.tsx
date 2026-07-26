import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CANVAS_THEMES,
  DEFAULT_SETTINGS,
  THEME_BACKGROUND_MODES,
  normalizeCanvasTheme,
  normalizeThemeBackgroundMode,
} from '@jimeng-flow/shared'
import {
  applyCanvasTheme,
  applyThemeBackgroundMode,
  CANVAS_THEME_OPTIONS,
} from '../src/utils/canvasTheme'

Object.assign(globalThis, { React })

test('the global skin registry exposes exactly the six requested themes', () => {
  assert.deepEqual(CANVAS_THEMES, [
    'dark',
    'light',
    'starry-night',
    'turner-mist',
    'hokusai-indigo',
    'monet-lilac',
  ])
  assert.equal(CANVAS_THEME_OPTIONS.length, 6)
  assert.equal(DEFAULT_SETTINGS.canvasTheme, 'dark')
  assert.deepEqual(THEME_BACKGROUND_MODES, ['original', 'blur'])
  assert.equal(DEFAULT_SETTINGS.themeBackgroundMode, 'blur')
})

test('legacy and invalid settings fall back to the existing dark skin', () => {
  assert.equal(normalizeCanvasTheme(undefined), 'dark')
  assert.equal(normalizeCanvasTheme('unknown-theme'), 'dark')
  assert.equal(normalizeCanvasTheme('light'), 'light')
  assert.equal(normalizeThemeBackgroundMode(undefined), 'blur')
  assert.equal(normalizeThemeBackgroundMode('unknown-mode'), 'blur')
  assert.equal(normalizeThemeBackgroundMode('original'), 'original')
})

test('applying a skin updates the root without reloading the document', () => {
  const root = {
    dataset: {} as Record<string, string>,
    style: { colorScheme: '' },
  } as unknown as HTMLElement

  assert.equal(applyCanvasTheme('monet-lilac', root), 'monet-lilac')
  assert.equal(root.dataset.canvasTheme, 'monet-lilac')
  assert.equal(root.style.colorScheme, 'dark')

  assert.equal(applyCanvasTheme('light', root), 'light')
  assert.equal(root.dataset.canvasTheme, 'light')
  assert.equal(root.style.colorScheme, 'light')

  assert.equal(applyThemeBackgroundMode('original', root), 'original')
  assert.equal(root.dataset.themeBackgroundMode, 'original')
  assert.equal(applyThemeBackgroundMode('invalid', root), 'blur')
  assert.equal(root.dataset.themeBackgroundMode, 'blur')
})

test('settings renders all skins in one real-time preview group', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')
  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.match(html, /aria-label="全局皮肤"/)
  for (const option of CANVAS_THEME_OPTIONS) {
    assert.match(html, new RegExp(`data-theme-option="${option.id}"`))
    assert.equal(html.includes(option.name), true)
  }
  assert.match(html, />确认</)
})
