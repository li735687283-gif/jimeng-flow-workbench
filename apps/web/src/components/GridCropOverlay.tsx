// 即梦 Flow 前端 - 宫格切分全屏遮罩
// 在一整宫格图上点选要裁出的格子，确认后按原图像素坐标导出 CropRegion。
// 视觉复用 --menu-surface-* / --menu-item-* 深色令牌（见 App.css grid-crop-*）。

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { CropRegion, GridPreset } from '@jimeng-flow/shared/grid'
import {
  GRID_PRESET_CONFIGS,
} from '@jimeng-flow/shared/grid'
import {
  buildGridSelectionSummary,
  cellKey,
  computeGridCells,
  selectAllCellKeys,
  selectedCellsToRegions,
  toggleSelection,
} from '../utils/gridCrop'

const GRID_CROP_PRESETS: GridPreset[] = [
  '2x2',
  '3x3',
  '4x4',
  '5x5',
  '6x6',
  '7x7',
]

const MIN_GRID_SIDE = 1
const MAX_GRID_SIDE = 10

function clampGridSide(value: number): number {
  if (!Number.isFinite(value)) return MIN_GRID_SIDE
  return Math.min(
    MAX_GRID_SIDE,
    Math.max(MIN_GRID_SIDE, Math.floor(value)),
  )
}

function clampGutter(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

interface GridCropOverlayProps {
  open: boolean
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  defaultRows?: number
  defaultCols?: number
  busy?: boolean
  onCancel: () => void
  onConfirm: (regions: CropRegion[]) => void
}

export function GridCropOverlay({
  open,
  imageUrl,
  naturalWidth,
  naturalHeight,
  defaultRows = 3,
  defaultCols = 3,
  busy = false,
  onCancel,
  onConfirm,
}: GridCropOverlayProps) {
  const [rows, setRows] = useState(() => clampGridSide(defaultRows))
  const [cols, setCols] = useState(() => clampGridSide(defaultCols))
  const [gutter, setGutter] = useState(0)
  const [draftRows, setDraftRows] = useState(() => String(clampGridSide(defaultRows)))
  const [draftCols, setDraftCols] = useState(() => String(clampGridSide(defaultCols)))
  const [draftGutter, setDraftGutter] = useState('0')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [displaySize, setDisplaySize] = useState<{
    width: number
    height: number
  } | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  // 每次打开时按 defaultRows/Cols 重置网格与选择
  useEffect(() => {
    if (!open) return
    const nextRows = clampGridSide(defaultRows)
    const nextCols = clampGridSide(defaultCols)
    setRows(nextRows)
    setCols(nextCols)
    setGutter(0)
    setDraftRows(String(nextRows))
    setDraftCols(String(nextCols))
    setDraftGutter('0')
    setSelected(new Set())
  }, [defaultCols, defaultRows, open])

  // Escape 关闭（生成/裁剪中不关闭）；点遮罩空白不关闭（防误触）
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel, open])

  // img 加载后量显示尺寸，窗口尺寸变化时同步重算
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const img = imageRef.current
      if (!img) return
      const width = img.clientWidth
      const height = img.clientHeight
      if (width > 0 && height > 0) setDisplaySize({ width, height })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  const totalCells = rows * cols
  const allSelected = selected.size === totalCells && totalCells > 0
  // 显示层用无间距的原始宫格；确认导出时才按 gutter 内缩
  const displayCells = useMemo(
    () => computeGridCells(naturalWidth, naturalHeight, rows, cols),
    [cols, naturalHeight, naturalWidth, rows],
  )
  const scale =
    displaySize && naturalWidth > 0 ? displaySize.width / naturalWidth : 0

  const applyPreset = (preset: GridPreset) => {
    const config = GRID_PRESET_CONFIGS[preset]
    setRows(config.rows)
    setCols(config.cols)
    setDraftRows(String(config.rows))
    setDraftCols(String(config.cols))
    setSelected(new Set())
  }

  const applyCustom = () => {
    const nextRows = clampGridSide(Number(draftRows))
    const nextCols = clampGridSide(Number(draftCols))
    const nextGutter = clampGutter(Number(draftGutter))
    setRows(nextRows)
    setCols(nextCols)
    setGutter(nextGutter)
    setDraftRows(String(nextRows))
    setDraftCols(String(nextCols))
    setDraftGutter(String(nextGutter))
    setSelected(new Set())
  }

  const handleSelectAll = () => {
    setSelected(allSelected ? new Set() : selectAllCellKeys(rows, cols))
  }

  const handleConfirm = () => {
    if (selected.size === 0 || busy) return
    const exportCells = computeGridCells(
      naturalWidth,
      naturalHeight,
      rows,
      cols,
      gutter,
    )
    onConfirm(selectedCellsToRegions(exportCells, selected))
  }

  if (!open) return null

  const content = (
    <div className="grid-crop-overlay" role="dialog" aria-label="宫格裁剪">
      <div className="grid-crop-topbar">
        <span className="grid-crop-title">宫格裁剪</span>
        <div className="grid-crop-topbar-actions">
          <button
            type="button"
            className="grid-crop-text-button"
            onClick={handleSelectAll}
            disabled={busy}
          >
            {allSelected ? '取消全选' : '全选'}
          </button>
          <button
            type="button"
            className="grid-crop-icon-button"
            onClick={onCancel}
            disabled={busy}
            aria-label="关闭宫格裁剪"
          >
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="grid-crop-stage">
        <div className="grid-crop-image-wrap">
          <img
            ref={imageRef}
            src={imageUrl}
            alt="宫格裁剪原图"
            className="grid-crop-image"
            draggable={false}
            onLoad={() => {
              const img = imageRef.current
              if (img && img.clientWidth > 0) {
                setDisplaySize({
                  width: img.clientWidth,
                  height: img.clientHeight,
                })
              }
            }}
          />
          {displaySize && scale > 0 ? (
            <div className="grid-crop-cells">
              {displayCells.map((cell, index) => {
                const key = cellKey(cell.row, cell.col)
                const isSelected = selected.has(key)
                const dimmed = selected.size > 0 && !isSelected
                return (
                  <button
                    key={key}
                    type="button"
                    className={`grid-crop-cell${isSelected ? ' selected' : ''}${
                      dimmed ? ' dimmed' : ''
                    }`}
                    style={{
                      left: cell.x * scale,
                      top: cell.y * scale,
                      width: cell.w * scale,
                      height: cell.h * scale,
                    }}
                    onClick={() =>
                      setSelected((current) => toggleSelection(current, key))
                    }
                    disabled={busy}
                    aria-label={`第 ${index + 1} 格`}
                    aria-pressed={isSelected}
                  >
                    <span className="grid-crop-cell-badge">{index + 1}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid-crop-pill" aria-live="polite">
        <span className="grid-crop-pill-main">
          {buildGridSelectionSummary(totalCells, selected.size)}
        </span>
        <span className="grid-crop-pill-sub">点击选择 · 再次点击取消</span>
      </div>

      <div className="grid-crop-toolbar">
        <span className="grid-crop-toolbar-label">手动网格:</span>
        <div className="grid-crop-presets">
          {GRID_CROP_PRESETS.map((preset) => {
            const config = GRID_PRESET_CONFIGS[preset]
            const active = config.rows === rows && config.cols === cols
            return (
              <button
                key={preset}
                type="button"
                className={`grid-crop-preset${active ? ' active' : ''}`}
                onClick={() => applyPreset(preset)}
                disabled={busy}
              >
                {preset}
              </button>
            )
          })}
        </div>
        <span className="grid-crop-toolbar-label">自定义:</span>
        <input
          type="number"
          className="grid-crop-number"
          min={MIN_GRID_SIDE}
          max={MAX_GRID_SIDE}
          value={draftRows}
          onChange={(event) => setDraftRows(event.target.value)}
          disabled={busy}
          aria-label="自定义行数"
        />
        <span className="grid-crop-toolbar-times">×</span>
        <input
          type="number"
          className="grid-crop-number"
          min={MIN_GRID_SIDE}
          max={MAX_GRID_SIDE}
          value={draftCols}
          onChange={(event) => setDraftCols(event.target.value)}
          disabled={busy}
          aria-label="自定义列数"
        />
        <span className="grid-crop-toolbar-label">间距:</span>
        <input
          type="number"
          className="grid-crop-number"
          min={0}
          value={draftGutter}
          onChange={(event) => setDraftGutter(event.target.value)}
          disabled={busy}
          aria-label="宫格间距像素"
        />
        <span className="grid-crop-toolbar-unit">px</span>
        <button
          type="button"
          className="grid-crop-text-button"
          onClick={applyCustom}
          disabled={busy}
        >
          应用
        </button>
        <div className="grid-crop-toolbar-spacer" />
        <button
          type="button"
          className="grid-crop-text-button"
          onClick={onCancel}
          disabled={busy}
        >
          取消
        </button>
        <button
          type="button"
          className="grid-crop-primary-button"
          onClick={handleConfirm}
          disabled={busy || selected.size === 0}
        >
          {`裁剪选中区域（${selected.size}张）`}
        </button>
      </div>

      <span
        className={`grid-crop-hint${
          selected.size === 0 ? ' grid-crop-hint-empty' : ''
        }`}
      >
        {selected.size === 0
          ? '未选择任何宫格，无法进行裁剪'
          : `将导出 ${selected.size} 张图片`}
      </span>
    </div>
  )

  // 测试环境（无 document）直接内联渲染；浏览器中挂到 body 顶层避免被裁剪
  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
