// 即梦 Flow 前端 - 宫格切分纯逻辑
// 负责把一张图按行列切成宫格单元，并管理单元选择状态。
// 坐标均为原图像素坐标，row / col 从 1 起。

import type { CropRegion } from '@jimeng-flow/shared/grid'

/** 单个宫格单元：行列编号（1 起）+ 原图像素坐标区域。 */
export interface GridCell extends CropRegion {
  row: number
  col: number
}

/**
 * 按行列把 width×height 的原图切成宫格单元（行优先、从左到右排列）。
 * - cellW = floor(width/cols)、cellH = floor(height/rows)，余数归末行末列；
 * - gutterPx 为每格四边向内收缩的像素（去掉宫格白边），w/h 最小 1。
 */
export function computeGridCells(
  width: number,
  height: number,
  rows: number,
  cols: number,
  gutterPx = 0,
): GridCell[] {
  const safeRows = Math.max(1, Math.floor(rows))
  const safeCols = Math.max(1, Math.floor(cols))
  const safeWidth = Math.max(1, Math.floor(width))
  const safeHeight = Math.max(1, Math.floor(height))
  const cellW = Math.floor(safeWidth / safeCols)
  const cellH = Math.floor(safeHeight / safeRows)
  const gutter = Math.max(0, Math.floor(gutterPx))

  const cells: GridCell[] = []
  for (let row = 1; row <= safeRows; row += 1) {
    for (let col = 1; col <= safeCols; col += 1) {
      const x = (col - 1) * cellW
      const y = (row - 1) * cellH
      const baseW = col === safeCols ? safeWidth - x : cellW
      const baseH = row === safeRows ? safeHeight - y : cellH
      cells.push({
        row,
        col,
        x: Math.min(x + gutter, safeWidth - 1),
        y: Math.min(y + gutter, safeHeight - 1),
        w: Math.max(1, baseW - gutter * 2),
        h: Math.max(1, baseH - gutter * 2),
      })
    }
  }
  return cells
}

/** 宫格单元的选择 key（行_列，1 起）。 */
export function cellKey(row: number, col: number): string {
  return `${row}_${col}`
}

/** 切换某个 key 的选中状态，返回新 Set（不改原 Set）。 */
export function toggleSelection(
  selected: Set<string>,
  key: string,
): Set<string> {
  const next = new Set(selected)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  return next
}

/** 生成整张宫格的全选 key 集合。 */
export function selectAllCellKeys(rows: number, cols: number): Set<string> {
  const keys = new Set<string>()
  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      keys.add(cellKey(row, col))
    }
  }
  return keys
}

/**
 * 把选中的 key 映射回宫格单元的裁剪区域，
 * 结果按从左到右、从上到下排序（computeGridCells 本身即行优先）。
 */
export function selectedCellsToRegions(
  cells: GridCell[],
  selected: Set<string>,
): CropRegion[] {
  return cells
    .filter((cell) => selected.has(cellKey(cell.row, cell.col)))
    .map(({ x, y, w, h }) => ({ x, y, w, h }))
}

/** 底部计数 pill 文案：共 N 个宫格，已选中 M 个。 */
export function buildGridSelectionSummary(
  totalCells: number,
  selectedCount: number,
): string {
  return `共 ${totalCells} 个宫格，已选中 ${selectedCount} 个`
}
