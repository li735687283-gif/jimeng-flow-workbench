import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGridSelectionSummary,
  cellKey,
  computeGridCells,
  retainSelection,
  selectAllCellKeys,
  selectedCellsToRegions,
  toggleSelection,
} from '../src/utils/gridCrop'

test('computeGridCells splits an evenly divisible image into equal cells', () => {
  const cells = computeGridCells(900, 600, 2, 3)

  assert.equal(cells.length, 6)
  assert.deepEqual(cells[0], { row: 1, col: 1, x: 0, y: 0, w: 300, h: 300 })
  assert.deepEqual(cells[2], { row: 1, col: 3, x: 600, y: 0, w: 300, h: 300 })
  assert.deepEqual(cells[3], { row: 2, col: 1, x: 0, y: 300, w: 300, h: 300 })
  assert.deepEqual(cells[5], { row: 2, col: 3, x: 600, y: 300, w: 300, h: 300 })
})

test('computeGridCells assigns the remainder to the last row and column', () => {
  const cells = computeGridCells(1000, 701, 2, 3)

  // cellW = 333, 末列 1000 - 666 = 334；cellH = 350，末行 701 - 350 = 351
  assert.deepEqual(cells[1], { row: 1, col: 2, x: 333, y: 0, w: 333, h: 350 })
  assert.deepEqual(cells[2], { row: 1, col: 3, x: 666, y: 0, w: 334, h: 350 })
  assert.deepEqual(cells[4], { row: 2, col: 2, x: 333, y: 350, w: 333, h: 351 })
  assert.deepEqual(cells[5], { row: 2, col: 3, x: 666, y: 350, w: 334, h: 351 })

  // 全图无缝覆盖：每行宽度之和 = 原宽，每列高度之和 = 原高
  const firstRowWidth = cells
    .filter((cell) => cell.row === 1)
    .reduce((sum, cell) => sum + cell.w, 0)
  const firstColHeight = cells
    .filter((cell) => cell.col === 1)
    .reduce((sum, cell) => sum + cell.h, 0)
  assert.equal(firstRowWidth, 1000)
  assert.equal(firstColHeight, 701)
})

test('computeGridCells shrinks every cell by the gutter on all four sides', () => {
  const cells = computeGridCells(900, 900, 3, 3, 10)

  assert.deepEqual(cells[0], { row: 1, col: 1, x: 10, y: 10, w: 280, h: 280 })
  assert.deepEqual(cells[4], { row: 2, col: 2, x: 310, y: 310, w: 280, h: 280 })
  assert.deepEqual(cells[8], { row: 3, col: 3, x: 610, y: 610, w: 280, h: 280 })
})

test('computeGridCells never returns non-positive sizes even with huge gutter', () => {
  const cells = computeGridCells(30, 30, 3, 3, 50)

  assert.equal(cells.length, 9)
  for (const cell of cells) {
    assert.ok(cell.w >= 1)
    assert.ok(cell.h >= 1)
    assert.ok(cell.x >= 0 && cell.x < 30)
    assert.ok(cell.y >= 0 && cell.y < 30)
  }
})

test('cellKey and toggleSelection manage selection immutably', () => {
  assert.equal(cellKey(1, 1), '1_1')
  assert.equal(cellKey(3, 12), '3_12')

  const initial = new Set<string>()
  const added = toggleSelection(initial, '1_1')
  assert.equal(initial.size, 0)
  assert.deepEqual([...added], ['1_1'])

  const toggledOff = toggleSelection(added, '1_1')
  assert.equal(toggledOff.size, 0)
  assert.equal(added.size, 1)

  const second = toggleSelection(added, '2_3')
  assert.deepEqual([...second].sort(), ['1_1', '2_3'])
})

test('selectAllCellKeys covers the whole grid', () => {
  const all = selectAllCellKeys(2, 3)
  assert.equal(all.size, 6)
  assert.ok(all.has('1_1'))
  assert.ok(all.has('2_3'))
})

test('selectedCellsToRegions keeps reading order and strips row/col', () => {
  const cells = computeGridCells(900, 600, 2, 2)
  const selected = new Set([cellKey(2, 1), cellKey(1, 2)])

  const regions = selectedCellsToRegions(cells, selected)
  assert.deepEqual(regions, [
    { x: 450, y: 0, w: 450, h: 300 },
    { x: 0, y: 300, w: 450, h: 300 },
  ])
})

test('buildGridSelectionSummary renders the pill counter text', () => {
  assert.equal(buildGridSelectionSummary(9, 0), '共 9 个宫格，已选中 0 个')
  assert.equal(buildGridSelectionSummary(9, 4), '共 9 个宫格，已选中 4 个')
})

test('retainSelection 行列不变时保留全部选中（只调间距不清空）', () => {
  const selected = new Set([cellKey(1, 1), cellKey(2, 3), cellKey(3, 2)])
  const retained = retainSelection(selected, 3, 3)

  assert.equal(retained.size, 3)
  assert.deepEqual([...retained].sort(), ['1_1', '2_3', '3_2'])
  // 不改原 Set
  assert.equal(selected.size, 3)
})

test('retainSelection 行列缩小时丢弃越界选中、保留界内', () => {
  const selected = new Set([cellKey(1, 1), cellKey(2, 2), cellKey(3, 3), cellKey(4, 1)])
  const retained = retainSelection(selected, 2, 2)

  assert.deepEqual([...retained].sort(), ['1_1', '2_2'])
})
