// 即梦 Flow 前端 - Assets API client
// 封装与后端 /api/assets 的交互。
// Vite proxy 已把 /api 转发到后端 8787，前端用相对路径即可。
// 参考 PRD 10.4、9.3 上传资源数据流。

import type { Asset } from '@jimeng-flow/shared/asset'

/** 返回资产文件的访问 URL（供 <img src> / <video src> 使用） */
export function getAssetFileUrl(id: string): string {
  return `/api/assets/${encodeURIComponent(id)}/file`
}

/** 返回资产下载 URL（触发浏览器下载） */
export function getAssetDownloadUrl(id: string): string {
  return `/api/assets/${encodeURIComponent(id)}/download`
}

/** 触发浏览器下载当前资产 */
export function downloadAssetFile(id: string): void {
  const anchor = document.createElement('a')
  anchor.href = getAssetDownloadUrl(id)
  anchor.download = ''
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/** 将资产导出到本地 workspace/outputs/downloads 文件夹 */
export async function exportAssetFile(id: string): Promise<{ path: string }> {
  const res = await fetch(`/api/assets/${encodeURIComponent(id)}/export`, {
    method: 'POST',
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message || `导出资产失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as { path: string }
}

/** 将 File 读取为纯 base64 字符串（不含 data: 前缀） */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('文件读取失败'))
        return
      }
      // result 形如 "data:<mime>;base64,<base64>"
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 上传本地文件为资产。
 * - 内部将 File 转 base64，POST JSON 到后端
 * - 返回后端写入的 Asset
 */
export async function uploadAsset(file: File): Promise<Asset> {
  const dataBase64 = await fileToBase64(file)
  const res = await fetch('/api/assets/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
    }),
  })
  if (!res.ok) {
    throw new Error(`上传资产失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Asset
}

/** 读取单个资产 metadata */
export async function getAsset(id: string): Promise<Asset> {
  const res = await fetch(`/api/assets/${encodeURIComponent(id)}`)
  if (!res.ok) {
    throw new Error(`获取资产失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Asset
}

/** 列出全部资产（按 createdAt 倒序） */
export async function listAssets(): Promise<Asset[]> {
  const res = await fetch('/api/assets')
  if (!res.ok) {
    throw new Error(`列出资产失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Asset[]
}

/** 使用 dreamina image_upscale 高清当前图片资产，返回新资产 */
export async function upscaleImageAsset(
  assetId: string,
  resolutionType = '2k',
): Promise<Asset> {
  const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/upscale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolutionType }),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message || `图片高清失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Asset
}
