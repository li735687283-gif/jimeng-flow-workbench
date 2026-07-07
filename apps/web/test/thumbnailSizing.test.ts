import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('reference and history thumbnails share the unified sizing tokens', () => {
  const css = readFileSync('apps/web/src/App.css', 'utf8')

  assert.equal(css.includes('--reference-asset-thumb-size: 58px;'), true)
  assert.equal(css.includes('--reference-asset-preview-size: 168px;'), true)
  assert.equal(css.includes('--history-thumb-width: 96px;'), true)
  assert.equal(css.includes('--history-thumb-height: 64px;'), true)
  assert.equal(css.includes('width: var(--reference-asset-thumb-size);'), true)
  assert.equal(css.includes('height: var(--reference-asset-thumb-size);'), true)
  assert.equal(css.includes('width: var(--history-thumb-width);'), true)
  assert.equal(css.includes('height: var(--history-thumb-height);'), true)
  assert.equal(css.includes('var(--image-history-preview-scale'), false)
  assert.equal(css.includes('var(--video-history-preview-scale'), false)
})
