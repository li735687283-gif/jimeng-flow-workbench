import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  DEFAULT_SETTINGS,
  normalizeCanvasTheme,
} from '@jimeng-flow/shared'

test('theme settings preserve the existing dark default and reject unknown skins', () => {
  assert.equal(DEFAULT_SETTINGS.canvasTheme, 'dark')
  assert.equal(normalizeCanvasTheme('hokusai-indigo'), 'hokusai-indigo')
  assert.equal(normalizeCanvasTheme('not-a-theme'), 'dark')
})

test('settings route persists the global canvas theme key', async () => {
  const source = await readFile('apps/server/src/routes/settings.ts', 'utf8')
  assert.match(source, /'canvasTheme'/)
})
