import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  resolveTextFrameColor,
  TEXT_FRAME_COLOR_PRESETS,
} from '../src/utils/textFrameColors'

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

test('text frame palette defaults to the panel surface and keeps six muted gradients', async () => {
  const theme = await readFile(new URL('../src/theme.css', import.meta.url), 'utf8')
  const ids = TEXT_FRAME_COLOR_PRESETS.map((preset) => preset.id)

  assert.deepEqual(ids, [
    'default',
    'slate',
    'indigo',
    'forest',
    'wine',
    'amber',
    'graphite',
  ])
  assert.equal(new Set(TEXT_FRAME_COLOR_PRESETS.map((preset) => preset.color)).size, 7)

  for (const preset of TEXT_FRAME_COLOR_PRESETS) {
    assert.match(preset.color, /^var\(--text-frame-[a-z-]+\)$/)
    const token = preset.color.slice(4, -1)
    const declaration = theme.match(
      new RegExp(`${token}:\\s*([^;]+);`),
    )?.[1]
    assert.ok(declaration, `${token} should be declared in theme.css`)
    if (preset.id === 'default') {
      assert.equal(declaration, 'var(--theme-panel)')
    } else {
      assert.match(declaration, /gradient\(/)

      const stops = [...declaration.matchAll(/#([0-9a-f]{6})\b/gi)].map(
        (match) => match[1],
      )
      assert.ok(stops.length >= 3)
      assert.ok(
        stops.every((hex) => {
          const channels = hex
            .match(/.{2}/g)
            ?.map((channel) => Number.parseInt(channel, 16)) ?? []
          const spread = Math.max(...channels) - Math.min(...channels)
          return channels.length === 3 && Math.max(...channels) <= 96 && spread >= 6
        }),
        `${token} should stay dark, chromatic, and low-saturation`,
      )
    }

    assert.equal(resolveTextFrameColor(preset.legacyColor), preset.color)
  }

  assert.equal(
    resolveTextFrameColor(undefined),
    TEXT_FRAME_COLOR_PRESETS[0].color,
  )
  assert.equal(resolveTextFrameColor('#123456'), '#123456')
  assert.match(
    theme,
    /background:\s*var\(--text-node-frame-color,\s*var\(--theme-panel\)\)\s*!important;/,
  )
})