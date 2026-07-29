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

test('snap toggle active state stays visible in the light theme via tokens', async () => {
  const theme = await readFile(new URL('../src/theme.css', import.meta.url), 'utf8')

  // 深色模板的白色激活图标在浅色主题白底面板上看不见，浅色主题必须用主题令牌覆盖。
  assert.match(
    theme,
    /\[data-canvas-theme='light'\]\s+\.canvas-zoom-btn\.canvas-snap-btn\.is-active\s*\{[^}]*color:\s*var\(--theme-accent\);[^}]*background:\s*var\(--theme-accent-soft\);/s,
  )
  assert.match(
    theme,
    /\[data-canvas-theme='light'\]\s+\.canvas-zoom-btn\.canvas-snap-btn\.is-active:hover\s*\{[^}]*background:\s*var\(--theme-accent-glow\);/s,
  )
})
