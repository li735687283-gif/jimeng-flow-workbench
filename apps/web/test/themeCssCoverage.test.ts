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
  assert.equal(css.includes('--theme-agent-bg: color-mix('), true)
  assert.equal(css.includes('var(--theme-panel) 42%'), true)

  const agentPanelStyles = css.slice(
    css.indexOf('.agent-chat-panel'),
    css.indexOf('.agent-conversation-history'),
  )
  assert.equal(agentPanelStyles.includes('background: var(--theme-agent-bg)'), true)

  const agentComposerStyles = css.slice(
    css.indexOf('.agent-composer {'),
    css.indexOf('.agent-composer:focus-within'),
  )
  assert.equal(agentComposerStyles.includes('background: var(--theme-agent-bg)'), true)
  assert.equal(agentComposerStyles.includes('box-shadow: none'), true)

  const focusedComposerStyles = css.slice(
    css.indexOf('.agent-composer:focus-within'),
    css.indexOf('.agent-bubble.user'),
  )
  assert.equal(focusedComposerStyles.includes('background: var(--theme-agent-bg)'), true)
  assert.equal(focusedComposerStyles.includes('transform: none'), true)
})
