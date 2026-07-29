// 即梦 Flow 工作台 - 宫格生成 / 宫格切分 共享契约
// 宫格生成：让图片模型参考原图重绘成一张 N×N 宫格分镜图；
// 宫格切分：把宫格图按区域裁剪，每格存为独立素材。

import type { Asset } from './asset'

/** 宫格预设规格（均为 N×N）。 */
export type GridPreset = '2x2' | '3x3' | '4x4' | '5x5' | '6x6' | '7x7'

/** 各宫格预设对应的行列数。 */
export const GRID_PRESET_CONFIGS: Record<
  GridPreset,
  { rows: number; cols: number }
> = {
  '2x2': { rows: 2, cols: 2 },
  '3x3': { rows: 3, cols: 3 },
  '4x4': { rows: 4, cols: 4 },
  '5x5': { rows: 5, cols: 5 },
  '6x6': { rows: 6, cols: 6 },
  '7x7': { rows: 7, cols: 7 },
}

/** 宫格生成可选的预设（过大格数生成质量不稳定，切分支持到 7x7）。 */
export const GRID_GENERATE_OPTIONS: GridPreset[] = ['2x2', '3x3', '4x4']

/**
 * 宫格生成提示词：让图片模型参考原图重绘成一张 rows×cols 宫格图。
 * 输出是完整的一张图，由图片生成接口常规返回。
 */
export function buildGridImagePrompt(rows: number, cols: number): string {
  return `参考原图重绘为一张 ${rows}×${cols} 宫格分镜图：每格一个画面，格与格之间叙事连贯，像同一故事的不同镜头；镜头语言要丰富、有电影感和张力——避免千篇一律的中心构图和单一侧面视角，混合远景、全景、中景、近景、特写等不同景别，尝试俯视、仰视、过肩、侧面、背面等多种机位，并变化镜头焦距与景深（广角的纵深空间感、长焦的压缩感、浅景深的前景虚化）；所有格保持同一主体、同一画风；格与格之间用细白色边框分隔；输出是完整的一张图。`
}

/** 原图像素坐标下的裁剪区域。 */
export interface CropRegion {
  x: number
  y: number
  w: number
  h: number
}

/** POST /api/assets/:assetId/crop-regions 请求体。 */
export interface CropRegionsRequest {
  regions: CropRegion[]
}

/** POST /api/assets/:assetId/crop-regions 响应体，按 regions 传入顺序。 */
export interface CropRegionsResponse {
  assets: Asset[]
}
