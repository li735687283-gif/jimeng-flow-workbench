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
  // 点距与点径保持 2 倍以上的宽松密度，两色主题下都要清晰可见
  assert.match(background, /gap=\{72\}/)
  assert.match(background, /size=\{6\}/)
  assert.match(background, /color="var\(--canvas-grid-color\)"/)
  assert.match(background, /bgColor="transparent"/)
})

test('grid dot tokens stay visible on both dark and light canvas themes', async () => {
  const theme = await readFile(new URL('../src/theme.css', import.meta.url), 'utf8')

  // 深色主题：点色必须明显亮于画布底色 #0f0f0f
  assert.match(
    theme,
    /\[data-canvas-theme='dark'\]\s*\{[\s\S]*?--theme-grid:\s*#383838;/,
  )
  // 浅色主题：点色必须明显深于画布底色 #efebe2
  assert.match(
    theme,
    /\[data-canvas-theme='light'\]\s*\{[\s\S]*?--theme-grid:\s*#bdb4a6;/,
  )
})