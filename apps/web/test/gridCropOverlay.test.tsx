import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  buildGridSelectionSummary,
  cellKey,
  computeGridCells,
  selectAllCellKeys,
  selectedCellsToRegions,
  toggleSelection,
} from '../src/utils/gridCrop'

Object.assign(globalThis, { React })

function renderOverlay(props: Partial<Parameters<typeof import('../src/components/GridCropOverlay').GridCropOverlay>[0]> = {}) {
  return import('../src/components/GridCropOverlay').then(({ GridCropOverlay }) =>
    renderToStaticMarkup(
      <GridCropOverlay
        open={true}
        imageUrl="/api/assets/demo/file"
        naturalWidth={900}
        naturalHeight={900}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        {...props}
      />,
    ),
  )
}

test('grid crop overlay renders nothing when closed', async () => {
  const html = await renderOverlay({ open: false })
  assert.equal(html, '')
})

test('grid crop overlay renders topbar, presets, pill and toolbar', async () => {
  const html = await renderOverlay()

  for (const text of [
    '宫格裁剪',
    '全选',
    '手动网格:',
    '自定义:',
    '间距:',
    '应用',
    '取消',
    '共 9 个宫格，已选中 0 个',
    '点击选择 · 再次点击取消',
    '裁剪选中区域（0张）',
    '未选择任何宫格，无法进行裁剪',
  ]) {
    assert.equal(html.includes(text), true, `缺少文案：${text}`)
  }

  for (const preset of ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7']) {
    assert.equal(html.includes(`>${preset}</button>`), true, `缺少预设：${preset}`)
  }
  // 默认 3x3 预设高亮
  assert.match(html, /grid-crop-preset active[^>]*>3x3<\/button>/)
  assert.equal(html.includes('aria-label="关闭宫格裁剪"'), true)
  assert.equal(html.includes('aria-label="自定义行数"'), true)
  assert.equal(html.includes('aria-label="自定义列数"'), true)
  assert.equal(html.includes('aria-label="宫格间距像素"'), true)
  // 未选中时主按钮禁用
  assert.match(html, /class="grid-crop-primary-button" disabled=""/)
})

test('grid crop overlay honors default rows and cols from node gridSpec', async () => {
  const html = await renderOverlay({ defaultRows: 4, defaultCols: 4 })
  assert.equal(html.includes('共 16 个宫格，已选中 0 个'), true)
  assert.match(html, /grid-crop-preset active[^>]*>4x4<\/button>/)
})

test('grid selection counting follows cell toggling and select-all', () => {
  // 与 overlay 内部同一套纯逻辑：点格子 toggle、全选切换
  const rows = 3
  const cols = 3
  const total = rows * cols
  let selected = new Set<string>()

  selected = toggleSelection(selected, cellKey(1, 1))
  assert.equal(
    buildGridSelectionSummary(total, selected.size),
    '共 9 个宫格，已选中 1 个',
  )

  selected = toggleSelection(selected, cellKey(2, 3))
  assert.equal(
    buildGridSelectionSummary(total, selected.size),
    '共 9 个宫格，已选中 2 个',
  )

  // 再次点击取消
  selected = toggleSelection(selected, cellKey(1, 1))
  assert.equal(
    buildGridSelectionSummary(total, selected.size),
    '共 9 个宫格，已选中 1 个',
  )

  // 全选 → 再点取消全选
  selected = selectAllCellKeys(rows, cols)
  assert.equal(
    buildGridSelectionSummary(total, selected.size),
    '共 9 个宫格，已选中 9 个',
  )
  selected = selected.size === total ? new Set() : selected
  assert.equal(
    buildGridSelectionSummary(total, selected.size),
    '共 9 个宫格，已选中 0 个',
  )

  // onConfirm 传出的区域按从左到右、从上到下排序
  const cells = computeGridCells(900, 900, rows, cols)
  const regions = selectedCellsToRegions(
    cells,
    new Set([cellKey(3, 3), cellKey(1, 2)]),
  )
  assert.deepEqual(regions, [
    { x: 300, y: 0, w: 300, h: 300 },
    { x: 600, y: 600, w: 300, h: 300 },
  ])
})

test('grid crop overlay closes on Escape but not while busy', () => {
  const source = readFileSync(
    'apps/web/src/components/GridCropOverlay.tsx',
    'utf8',
  )

  assert.match(source, /event\.key === 'Escape' && !busy/)
  assert.match(source, /createPortal\(content, document\.body\)/)
  // 遮罩空白不绑定关闭（防误触）
  assert.doesNotMatch(source, /grid-crop-overlay[^>]*onClick/)
})
