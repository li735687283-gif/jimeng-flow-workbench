import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('canvas zoom range supports 5 percent to 300 percent', () => {
  const source = readFileSync(
    resolve('apps/web/src/components/canvas/CanvasView.tsx'),
    'utf8',
  )

  assert.equal(source.includes('minZoom={0.05}'), true)
  assert.equal(source.includes('maxZoom={3}'), true)
})
