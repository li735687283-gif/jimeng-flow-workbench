import { Zip, ZipDeflate, zipSync } from 'fflate'
import type { Node } from '@xyflow/react'
import { getAssetFileUrl } from '../api/assets'
import { getGroupMembers } from './nodeGroup'

export interface AssetItem {
  assetId: string
  ext: string
}

export interface ImageAssetGroup {
  title: string
  items: AssetItem[]
}

export interface ZipEntry {
  assetId: string
  name: string
}

/** 收集单个节点的可下载素材：图片取 outputAssetIds/assetId（png），视频取 assetIds（mp4） */
function collectNodeItems(node: Node): AssetItem[] {
  if (node.type === 'image') {
    const output = Array.isArray(node.data.outputAssetIds)
      ? node.data.outputAssetIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        )
      : []
    const fallback =
      typeof node.data.assetId === 'string' && node.data.assetId
        ? [node.data.assetId]
        : []
    const ids = output.length > 0 ? output : fallback
    return ids.map((assetId) => ({ assetId, ext: 'png' }))
  }
  if (node.type === 'video') {
    const ids = Array.isArray(node.data.assetIds)
      ? node.data.assetIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        )
      : []
    return ids.map((assetId) => ({ assetId, ext: 'mp4' }))
  }
  return []
}

function nodeTitle(node: Node): string {
  return typeof node.data.title === 'string' && node.data.title.trim()
    ? node.data.title.trim()
    : '素材'
}

/** 收集选中节点的素材（与选区无关的组下载见 collectGroupAssets） */
export function collectImageAssets(
  nodes: Node[],
  selectedIds: string[],
): ImageAssetGroup[] {
  const selected = new Set(selectedIds)
  const groups: ImageAssetGroup[] = []
  for (const node of nodes) {
    if (!selected.has(node.id)) continue
    const items = collectNodeItems(node)
    if (items.length === 0) continue
    groups.push({ title: nodeTitle(node), items })
  }
  return groups
}

/** 收集组内全部成员的素材（图片+视频），无论当前选中了什么 */
export function collectGroupAssets(nodes: Node[], frameId: string): ImageAssetGroup[] {
  const groups: ImageAssetGroup[] = []
  for (const node of getGroupMembers(nodes, frameId)) {
    const items = collectNodeItems(node)
    if (items.length === 0) continue
    groups.push({ title: nodeTitle(node), items })
  }
  return groups
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '素材'
}

/** 生成 zip 内文件名：`节点标题-序号.扩展名`，非法字符替换、重名自动加后缀 */
export function buildZipEntries(groups: ImageAssetGroup[]): ZipEntry[] {
  const used = new Set<string>()
  const entries: ZipEntry[] = []
  for (const group of groups) {
    group.items.forEach((item, index) => {
      const base = sanitizeFileName(`${group.title}-${index + 1}`)
      let name = `${base}.${item.ext}`
      let suffix = 2
      while (used.has(name)) {
        name = `${base}-${suffix}.${item.ext}`
        suffix += 1
      }
      used.add(name)
      entries.push({ assetId: item.assetId, name })
    })
  }
  return entries
}

function timestamp(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

interface SaveFilePickerHandle {
  createWritable: () => Promise<{
    write: (chunk: Uint8Array) => Promise<void>
    close: () => Promise<void>
  }>
}

async function fetchEntryData(entries: ZipEntry[]): Promise<Array<{ name: string; data: Uint8Array }>> {
  const results: Array<{ name: string; data: Uint8Array }> = []
  for (const entry of entries) {
    const response = await fetch(getAssetFileUrl(entry.assetId))
    if (!response.ok) {
      throw new Error(`下载素材失败（${response.status}）：${entry.name}`)
    }
    const buffer = await response.arrayBuffer()
    results.push({ name: entry.name, data: new Uint8Array(buffer) })
  }
  return results
}

/** 素材打包成 zip 下载：优先流式写入本地文件（省内存），不支持时退回内存打包 */
export async function downloadAssetsAsZip(entries: ZipEntry[]): Promise<void> {
  if (entries.length === 0) return
  const files = await fetchEntryData(entries)
  const zipName = `画布批量下载-${timestamp()}.zip`

  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: {
        suggestedName: string
        types: Array<{ description: string; accept: Record<string, string[]> }>
      }) => Promise<SaveFilePickerHandle>
    }
  ).showSaveFilePicker

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: zipName,
        types: [
          { description: 'Zip 压缩包', accept: { 'application/zip': ['.zip'] } },
        ],
      })
      const writable = await handle.createWritable()
      await new Promise<void>((resolve, reject) => {
        const zip = new Zip((err, chunk, final) => {
          if (err) {
            reject(err)
            return
          }
          writable.write(chunk).then(() => {
            if (final) resolve()
          }, reject)
        })
        for (const file of files) {
          const entry = new ZipDeflate(file.name, { level: 0 })
          zip.add(entry)
          entry.push(file.data, true)
        }
        zip.end()
      })
      await writable.close()
      return
    } catch (err) {
      // 用户取消保存对话框时不回退、不报错
      if (err instanceof DOMException && err.name === 'AbortError') return
      throw err
    }
  }

  const zipped = zipSync(
    Object.fromEntries(files.map((file) => [file.name, file.data])),
    { level: 0 },
  )
  const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = zipName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
