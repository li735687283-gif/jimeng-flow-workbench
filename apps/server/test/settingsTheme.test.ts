import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  DEFAULT_SETTINGS,
  normalizeCanvasTheme,
  normalizeThemeBackgroundMode,
} from '@jimeng-flow/shared'

test('theme settings preserve the existing dark default and reject unknown skins', () => {
  assert.equal(DEFAULT_SETTINGS.canvasTheme, 'dark')
  assert.equal(normalizeCanvasTheme('hokusai-indigo'), 'hokusai-indigo')
  assert.equal(normalizeCanvasTheme('not-a-theme'), 'dark')
  assert.equal(DEFAULT_SETTINGS.themeBackgroundMode, 'blur')
  assert.equal(normalizeThemeBackgroundMode('original'), 'original')
  assert.equal(normalizeThemeBackgroundMode('not-a-mode'), 'blur')
})

test('settings route persists the global canvas theme key', async () => {
  const source = await readFile('apps/server/src/routes/settings.ts', 'utf8')
  assert.match(source, /'canvasTheme'/)
  assert.match(source, /'themeBackgroundMode'/)
})
