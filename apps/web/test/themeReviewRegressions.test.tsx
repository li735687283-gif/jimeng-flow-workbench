import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemePicker } from '../src/components/ThemePicker'
import {
  beginCanvasThemePreview,
  endCanvasThemePreview,
  isCanvasThemePreviewActive,
} from '../src/utils/canvasTheme'

Object.assign(globalThis, { React })

test('theme radios expose one roving tab stop and keyboard navigation', async () => {
  const html = renderToStaticMarkup(
    <ThemePicker value="dark" onChange={() => undefined} />,
  )
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1)
  assert.equal((html.match(/tabindex="-1"/g) ?? []).length, 5)

  const source = await readFile('apps/web/src/components/ThemePicker.tsx', 'utf8')
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']) {
    assert.equal(source.includes(key), true, `${key} must navigate the radio group`)
  }
})

test('active previews block delayed persisted settings from repainting the app', async () => {
  const attributes = new Map<string, string>()
  const root = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
  } as unknown as HTMLElement

  beginCanvasThemePreview(root)
  assert.equal(isCanvasThemePreviewActive(root), true)
  endCanvasThemePreview(root)
  assert.equal(isCanvasThemePreviewActive(root), false)

  const appSource = await readFile('apps/web/src/App.tsx', 'utf8')
  const modalSource = await readFile('apps/web/src/components/SettingsModal.tsx', 'utf8')
  assert.match(appSource, /settings && !isCanvasThemePreviewActive\(\)/)
  assert.match(modalSource, /beginCanvasThemePreview\(\)/)
  assert.match(modalSource, /endCanvasThemePreview\(\)/)
})

test('nested home, node editor and Agent result states use global skin tokens', async () => {
  const css = await readFile('apps/web/src/theme.css', 'utf8')
  for (const selector of [
    '.home-project-card.no-cover small',
    '.image-editor-panel',
    '.prompt-editor-modal',
    '.reference-asset-thumb',
    '.image-generation-history-item',
    '.reference-text-chip',
    '.image-generation-progress-label',
    '.image-generation-progress-dot',
    '.agent-video-request',
    '.agent-storyboard-card',
    '.agent-generation-gallery',
  ]) {
    assert.equal(css.includes(selector), true, `${selector} must use global skin tokens`)
  }
  assert.match(
    css,
    /\.settings-theme-copy small\s*\{[^}]*color:\s*var\(--theme-text\)[^}]*font-size:\s*11px/s,
  )
})

test('inline node and settings surfaces use global skin tokens', async () => {
  const textNodeSource = await readFile('apps/web/src/nodes/TextNode.tsx', 'utf8')
  const settingsSource = await readFile('apps/web/src/components/SettingsModal.tsx', 'utf8')

  assert.match(textNodeSource, /text: 'var\(--theme-text/)
  assert.match(textNodeSource, /jsonBg: 'var\(--theme-control/)
  assert.match(settingsSource, /borderBottom: '1px solid var\(--theme-border/)
  assert.match(settingsSource, /color: 'var\(--theme-muted/)
  assert.doesNotMatch(settingsSource, /color: '#(?:c0c0c0|b8b8b8|cfcfcf|8d8d8d|777)'/)
  assert.doesNotMatch(settingsSource, /(?:background|border): '(?:1px solid )?rgba\(255, 255, 255/)
  assert.match(settingsSource, /var\(--theme-accent-soft/)
  assert.match(settingsSource, /var\(--theme-border-strong/)
  assert.match(settingsSource, /helperTextStyle[\s\S]*?var\(--theme-muted/)
  assert.match(settingsSource, /llmModelsMessage\.includes\('失败'\)[\s\S]*?var\(--theme-text[\s\S]*?var\(--theme-muted/)
})
