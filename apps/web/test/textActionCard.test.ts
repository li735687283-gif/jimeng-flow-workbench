import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('text action card exposes color, copy and expand controls', async () => {
  const source = await readFile(
    new URL('../src/components/TextActionCard.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /文本节点工具/)
  assert.match(source, /文本框颜色/)
  assert.match(source, /复制框内全部文字/)
  assert.match(source, /放大查看文本/)
  assert.match(source, /Maximize2/)
  assert.match(source, /onExpand/)
  assert.match(source, /TEXT_FRAME_COLOR_PRESETS/)
  assert.match(source, /Palette/)
  assert.match(source, /Copy/)
  assert.match(source, /image-action-card/)
  // 不再使用节点尺寸缩放
  assert.equal(source.includes('ZoomIn'), false)
  assert.equal(source.includes('ZoomOut'), false)
  assert.equal(source.includes('displayScale'), false)
})

test('text node mounts action card and opens prompt-style expand modal', async () => {
  const source = await readFile(
    new URL('../src/nodes/TextNode.tsx', import.meta.url),
    'utf8',
  )
  const shared = await readFile(
    new URL('../../../packages/shared/src/textNode.ts', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

  assert.match(source, /TextActionCard/)
  assert.match(source, /persistFrameColor/)
  assert.match(source, /handleCopyAllText/)
  assert.match(source, /handleExpandText/)
  assert.match(source, /onExpand=\{handleExpandText\}/)
  assert.match(source, /setContentExpanded\(true\)/)
  assert.match(source, /prompt-editor-modal-backdrop/)
  assert.match(source, /prompt-editor-modal-textarea/)
  assert.match(source, /--text-node-frame-color/)
  assert.match(shared, /frameColor\?:/)
  assert.equal(shared.includes('displayScale'), false)
  assert.match(css, /--text-node-frame-color/)
  assert.match(css, /\.text-action-color-menu/)
})
