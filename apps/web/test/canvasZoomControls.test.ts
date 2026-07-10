import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('canvas zoom controls include snap toggle next to zoom actions', async () => {
  const source = await readFile(
    new URL('../src/components/canvas/CanvasZoomControls.tsx', import.meta.url),
    'utf8',
  )
  const view = await readFile(
    new URL('../src/components/canvas/CanvasView.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

  assert.match(source, /放大/)
  assert.match(source, /缩小/)
  assert.match(source, /适应画布/)
  assert.match(source, /对齐吸附/)
  assert.match(source, /Magnet/)
  assert.match(source, /snapAlignEnabled/)
  assert.match(source, /onToggleSnapAlign/)
  assert.match(view, /CanvasZoomControls/)
  assert.match(view, /toggleSnapAlign/)
  assert.match(view, /snapAlignEnabled/)
  assert.equal(view.includes('<Controls'), false)
  assert.match(css, /\.canvas-zoom-controls/)
  assert.match(css, /\.canvas-snap-btn/)
})
