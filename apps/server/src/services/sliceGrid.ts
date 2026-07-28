// 即梦 Flow 后端 - 宫格切分 service
// 把一张宫格图按传入的像素区域裁剪，每格按传入顺序存为独立 PNG 素材。
// computeSliceCells 是纯几何工具，供按行×列均分网格的场景（如前端滑块预览）复用。

import { Jimp } from 'jimp'
import type { Asset } from '@jimeng-flow/shared/asset'
import type {
  CropRegion,
  CropRegionsResponse,
} from '@jimeng-flow/shared/grid'
import {
  getAsset,
  getAssetFilePath,
  saveUploadFile,
  type SaveUploadInput,
} from './assets'

/** 宫格切分错误：带 HTTP 状态码，route 直接映射。 */
export class SliceGridError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'SliceGridError'
    this.statusCode = statusCode
  }
}

/** 单次裁剪区域数量上限（7x7 宫格全切）。 */
export const CROP_REGIONS_MAX = 49

/** 校验并归一化裁剪区域：1..49 项，x/y ≥ 0、w/h ≥ 1，全部为有限数。 */
export function normalizeCropRegions(raw: unknown): CropRegion[] {
  const body =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const regions = body.regions
  if (!Array.isArray(regions) || regions.length === 0) {
    throw new SliceGridError('regions 必须是非空数组')
  }
  if (regions.length > CROP_REGIONS_MAX) {
    throw new SliceGridError(`regions 最多 ${CROP_REGIONS_MAX} 项`)
  }
  return regions.map((item, index) => {
    const region =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
    const x = Number(region.x)
    const y = Number(region.y)
    const w = Number(region.w)
    const h = Number(region.h)
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      x < 0 ||
      y < 0 ||
      w < 1 ||
      h < 1
    ) {
      throw new SliceGridError(
        `regions[${index}] 必须是 x/y ≥ 0、w/h ≥ 1 的有限数`,
      )
    }
    return { x, y, w, h }
  })
}

/** 单格裁剪区域（像素）。 */
export interface SliceCell {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 计算 rows×cols 的裁剪区域，按从左到右、从上到下顺序返回。
 * 基础格宽 cellW = floor(W/cols)、格高 cellH = floor(H/rows)；
 * 最后一列/行吃掉余数像素；每格四边向内收缩 inset（防负尺寸，最小 1 像素）。
 */
export function computeSliceCells(
  width: number,
  height: number,
  rows: number,
  cols: number,
  insetPercent = 0,
): SliceCell[] {
  const cellW = Math.floor(width / cols)
  const cellH = Math.floor(height / rows)
  const insetX = Math.round((cellW * insetPercent) / 100)
  const insetY = Math.round((cellH * insetPercent) / 100)

  const cells: SliceCell[] = []
  for (let row = 0; row < rows; row += 1) {
    const isLastRow = row === rows - 1
    const baseH = isLastRow ? height - cellH * (rows - 1) : cellH
    const y = row * cellH + insetY
    const h = Math.max(1, baseH - insetY * 2)
    for (let col = 0; col < cols; col += 1) {
      const isLastCol = col === cols - 1
      const baseW = isLastCol ? width - cellW * (cols - 1) : cellW
      const x = col * cellW + insetX
      const w = Math.max(1, baseW - insetX * 2)
      cells.push({ x, y, w, h })
    }
  }
  return cells
}

/** cropAssetRegions 的可注入依赖，便于测试。 */
export interface SliceGridDeps {
  getAssetImpl?: typeof getAsset
  readImageImpl?: (asset: Asset) => Promise<Awaited<ReturnType<typeof Jimp.read>>>
  saveAssetImpl?: (input: SaveUploadInput) => Promise<Asset>
}

/**
 * 按传入的像素区域裁剪图片素材，逐张存为独立 PNG 素材。
 * 每个 region 先夹紧到图像范围内（x/y 夹到图内，w/h 不超出右/下边界），
 * 夹紧后不足 1 像素的项跳过；全部被跳过时报 400。
 * 元数据用现有 Asset 字段记录来源：inputAssetIds 指向原图，
 * params 记录裁剪序号与区域，prompt 注明序号便于检索。
 */
export async function cropAssetRegions(
  assetId: string,
  rawBody: unknown,
  deps: SliceGridDeps = {},
): Promise<CropRegionsResponse> {
  const regions = normalizeCropRegions(rawBody)
  const lookupAsset = deps.getAssetImpl ?? getAsset
  const asset = await lookupAsset(assetId)
  if (!asset) {
    throw new SliceGridError('资产不存在', 404)
  }
  if (asset.type !== 'image') {
    throw new SliceGridError('只有图片资产支持宫格裁剪', 400)
  }

  const readImage =
    deps.readImageImpl ?? ((a: Asset) => Jimp.read(getAssetFilePath(a)))
  const image = await readImage(asset)
  const saveAsset = deps.saveAssetImpl ?? saveUploadFile

  // 夹紧到图像范围内：w/h 不超出右/下边界；
  // 起点已出界或夹紧后不足 1 像素的项跳过
  const clamped: { index: number; region: CropRegion }[] = []
  for (let i = 0; i < regions.length; i += 1) {
    const source = regions[i]
    const x = Math.max(0, Math.round(source.x))
    const y = Math.max(0, Math.round(source.y))
    const w = Math.min(Math.round(source.w), image.width - x)
    const h = Math.min(Math.round(source.h), image.height - y)
    if (w < 1 || h < 1) continue
    clamped.push({ index: i + 1, region: { x, y, w, h } })
  }
  if (clamped.length === 0) {
    throw new SliceGridError('所有裁剪区域都在图像范围外', 400)
  }

  const assets: Asset[] = []
  for (const { index, region } of clamped) {
    const tile = image
      .clone()
      .crop({ x: region.x, y: region.y, w: region.w, h: region.h })
    const buffer = await tile.getBuffer('image/png')
    const saved = await saveAsset({
      fileBuffer: buffer,
      originalName: `crop-${asset.id}-${index}.png`,
      mimeType: 'image/png',
      prompt: `宫格裁剪 第${index}张（来源 ${asset.id}）`,
      inputAssetIds: [asset.id],
      params: {
        operation: 'crop_region',
        sourceAssetId: asset.id,
        index,
        x: region.x,
        y: region.y,
        w: region.w,
        h: region.h,
      },
    })
    assets.push(saved)
  }
  return { assets }
}
