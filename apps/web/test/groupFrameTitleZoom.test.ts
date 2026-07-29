import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  getGroupTitleZoomFactor,
  GROUP_TITLE_MAX_ZOOM_FACTOR,
  GROUP_TITLE_MIN_ZOOM_FACTOR,
} from '../src/utils/nodeGroup'

test('group title zoom factor grows inversely with canvas zoom within bounds', () => {
  // 正常/放大画布：不缩小组名
  assert.equal(getGroupTitleZoomFactor(1), 1)
  assert.equal(getGroupTitleZoomFactor(2), 1)
  // 画布缩小：按 1/zoom 反向放大
  assert.equal(getGroupTitleZoomFactor(0.5), 2)
  assert.equal(getGroupTitleZoomFactor(0.25), 4)
  // 缩到画布最小 zoom（0.05）：放大 20 倍，屏幕上组名字号保持恒定可读
  assert.equal(getGroupTitleZoomFactor(0.05), 20)
  // 超出范围：封顶 20 倍，防止失控
  assert.equal(getGroupTitleZoomFactor(0.001), GROUP_TITLE_MAX_ZOOM_FACTOR)
  // 非法 zoom：回落到下限，不放大
  assert.equal(getGroupTitleZoomFactor(0), GROUP_TITLE_MIN_ZOOM_FACTOR)
  assert.equal(getGroupTitleZoomFactor(-1), GROUP_TITLE_MIN_ZOOM_FACTOR)
  assert.equal(getGroupTitleZoomFactor(Number.NaN), GROUP_TITLE_MIN_ZOOM_FACTOR)
})

test('group frame node feeds the zoom factor into a css variable scoped to the title', async () => {
  const source = await readFile(
    new URL('../src/nodes/GroupFrameNode.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

  // zoom 来自 React Flow store，因子写入 --group-title-zoom
  assert.match(source, /useStore\(\(state\) => state\.transform\[2\]\)/)
  assert.match(source, /getGroupTitleZoomFactor\(zoom\)/)
  assert.match(source, /'--group-title-zoom'/)

  // 只有组名相关元素被放大，画框本体不受影响；锚定方式（bottom:100% 左上角）不变
  assert.match(
    css,
    /\.group-frame \.node-title\s*\{[^}]*font-size:\s*calc\(16px \* var\(--group-title-zoom, 1\)\);/s,
  )
  assert.match(
    css,
    /\.group-frame \.node-title svg\s*\{[^}]*width:\s*calc\(16px \* var\(--group-title-zoom, 1\)\);/s,
  )
  assert.match(
    css,
    /\.group-frame \.node-title-input\s*\{[^}]*font-size:\s*calc\(14px \* var\(--group-title-zoom, 1\)\);/s,
  )
  assert.doesNotMatch(css, /\.group-frame\s*\{[^}]*--group-title-zoom/s)
})
