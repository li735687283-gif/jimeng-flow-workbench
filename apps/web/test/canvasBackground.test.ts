import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('canvas dots use a clearer relaxed default density', async () => {
  const source = await readFile(
    new URL('../src/components/canvas/CanvasView.tsx', import.meta.url),
    'utf8',
  )
  const backgroundStart = source.indexOf('<Background')
  const backgroundEnd = source.indexOf('/>', backgroundStart)

  assert.notEqual(backgroundStart, -1)
  assert.notEqual(backgroundEnd, -1)

  const background = source.slice(backgroundStart, backgroundEnd)
  assert.match(background, /variant=\{BackgroundVariant\.Dots\}/)
  assert.match(background, /gap=\{30\}/)
  assert.match(background, /size=\{2\.5\}/)
  assert.match(background, /color="var\(--canvas-grid-color\)"/)
  assert.match(background, /bgColor="transparent"/)
})