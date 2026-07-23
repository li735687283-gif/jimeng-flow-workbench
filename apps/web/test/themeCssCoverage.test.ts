import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CANVAS_THEMES } from '@jimeng-flow/shared'

test('global skin stylesheet covers every theme and major application surface', async () => {
  const css = await readFile('apps/web/src/theme.css', 'utf8')

  for (const theme of CANVAS_THEMES) {
    assert.match(css, new RegExp(`data-canvas-theme=['"]${theme}['"]`))
  }

  for (const surface of [
    '.home-page',
    '.canvas-stage',
    '.node-card',
    '.agent-chat-panel',
    '.settings-modal-content',
    '.asset-library-panel',
    '.project-manager-modal',
    '.video-admin-modal',
  ]) {
    assert.equal(css.includes(surface), true, `${surface} must use global skin tokens`)
  }

  assert.match(css, /--theme-edge:/)
  assert.match(css, /--theme-particle-base:/)
})
