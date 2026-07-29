import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('node with an open editor panel is elevated above later siblings', async () => {
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
  const view = await readFile(
    new URL('../src/components/canvas/CanvasView.tsx', import.meta.url),
    'utf8',
  )

  // React Flow 按 DOM 顺序堆叠节点且 elevateNodesOnSelect 关闭，
  // 必须靠 CSS 把打开编辑面板的 .react-flow__node 提层（内联 z-index 需 !important 覆盖）。
  assert.match(view, /elevateNodesOnSelect=\{false\}/)
  assert.match(
    css,
    /\.react-flow__node:has\(\.image-editor-panel\),\s*\.react-flow__node:has\(\.text-editor-panel\)\s*\{[^}]*z-index:\s*1000\s*!important;/s,
  )
})
