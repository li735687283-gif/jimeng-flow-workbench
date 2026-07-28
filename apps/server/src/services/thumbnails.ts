// 缩略图服务：按需从原图生成小尺寸 JPEG 并落盘缓存。
// 画布节点只展示缩略图，原图仅用于大图预览与下载。
// 选用 jimp（纯 JS）而非 sharp（原生模块），保证桌面版 esbuild 单文件打包可用。

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Jimp } from 'jimp'
import { getAsset, getAssetFilePath } from './assets'
import { getWorkspaceDir } from '../config'

export const THUMB_WIDTHS = [320, 640, 960, 1280] as const
export const DEFAULT_THUMB_WIDTH = 640

const JPEG_QUALITY = 82

const inflight = new Map<string, Promise<string>>()

export function normalizeThumbWidth(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_THUMB_WIDTH
  const matched = THUMB_WIDTHS.find((width) => width === parsed)
  return matched ?? DEFAULT_THUMB_WIDTH
}

function getThumbsDir(): string {
  return join(getWorkspaceDir(), 'outputs', '.thumbs')
}

export function getThumbCachePath(assetId: string, width: number): string {
  return join(getThumbsDir(), `${assetId}_w${width}.jpg`)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

/** 从源图生成缩略图到目标路径：宽度不超过 width，JPEG 输出，alpha 垫白底 */
export async function generateThumbnail(
  sourcePath: string,
  targetPath: string,
  width: number,
): Promise<string> {
  const image = await Jimp.read(sourcePath)
  image.scaleToFit({ w: width, h: width * 4 })
  // JPEG 无 alpha 通道，透明像素先垫白底避免变黑
  const flat = new Jimp({ width: image.width, height: image.height, color: 0xffffffff })
  flat.composite(image, 0, 0)
  const buffer = await flat.getBuffer('image/jpeg', { quality: JPEG_QUALITY })
  await mkdir(getThumbsDir(), { recursive: true })
  await writeFile(targetPath, buffer)
  return targetPath
}

/**
 * 取资产缩略图缓存路径：命中缓存直接返回，否则生成。
 * 同一资产同一宽度的并发生成合并为一个任务，避免重复解码大图。
 */
export async function getAssetThumbnail(
  assetId: string,
  width: number = DEFAULT_THUMB_WIDTH,
): Promise<string | null> {
  const normalizedWidth = normalizeThumbWidth(width)
  const asset = await getAsset(assetId)
  if (!asset) return null
  const cachePath = getThumbCachePath(assetId, normalizedWidth)
  if (await pathExists(cachePath)) return cachePath

  const key = `${assetId}_w${normalizedWidth}`
  let task = inflight.get(key)
  if (!task) {
    task = (async () => {
      const sourcePath = getAssetFilePath(asset)
      return generateThumbnail(sourcePath, cachePath, normalizedWidth)
    })()
    inflight.set(key, task)
    try {
      await task
    } finally {
      inflight.delete(key)
    }
    return cachePath
  }
  await task
  return cachePath
}
