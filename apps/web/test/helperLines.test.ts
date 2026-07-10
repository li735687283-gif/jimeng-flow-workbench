import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import {
  computeHelperLines,
  getSnapThreshold,
} from '../src/utils/helperLines.ts'

function box(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 80,
  selected = false,
): Node {
  return {
    id,
    position: { x, y },
    data: {},
    selected,
    measured: { width, height },
  } as Node
}

test('snaps left edges and draws a vertical helper line', () => {
  const dragged = box('a', 203, 40)
  const other = box('b', 200, 200)
  const result = computeHelperLines(dragged, [dragged, other], 8)

  assert.equal(result.snapped, true)
  assert.equal(result.position.x, 200)
  assert.ok(result.verticals.includes(200))
})

test('snaps top edges and draws a horizontal helper line', () => {
  const dragged = box('a', 40, 203)
  const other = box('b', 300, 200)
  const result = computeHelperLines(dragged, [dragged, other], 8)

  assert.equal(result.snapped, true)
  assert.equal(result.position.y, 200)
  assert.ok(result.horizontals.includes(200))
})

test('when tops align and heights match, top/center/bottom lines all show', () => {
  // 与参考图一致：等高卡片顶对齐时，出现三条水平虚线
  const dragged = box('a', 50, 102, 120, 100)
  const other = box('b', 300, 100, 180, 100)
  const result = computeHelperLines(dragged, [dragged, other], 8)

  assert.equal(result.snapped, true)
  assert.equal(result.position.y, 100)
  assert.ok(result.horizontals.includes(100)) // top
  assert.ok(result.horizontals.includes(150)) // center
  assert.ok(result.horizontals.includes(200)) // bottom
})

test('ignores other selected nodes during multi-drag', () => {
  const dragged = box('a', 203, 40, 100, 80, true)
  const other = box('b', 200, 200, 100, 80, true)
  const result = computeHelperLines(dragged, [dragged, other], 8)

  assert.equal(result.snapped, false)
  assert.equal(result.verticals.length, 0)
  assert.equal(result.horizontals.length, 0)
})

test('snap threshold scales with zoom', () => {
  assert.ok(getSnapThreshold(1) >= 5)
  assert.ok(getSnapThreshold(0.5) > getSnapThreshold(1))
  assert.ok(getSnapThreshold(2) <= getSnapThreshold(1))
})
