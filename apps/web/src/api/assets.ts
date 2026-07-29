// 即梦 Flow 前端 - Assets API client
// 封装与后端 /api/assets 的交互。
// Vite proxy 已把 /api 转发到后端 8787，前端用相对路径即可。
// 参考 PRD 10.4、9.3 上传资源数据流。

import type { Asset } from '@jimeng-flow/shared/asset'
import type {
  CropRegion,
  CropRegionsRequest,
  CropRegionsResponse,
} from '@jimeng-flow/shared/grid'
import type { UpscaleEngine, UpscaleImageRequest } from '@jimeng-flow/shared/upscale'
import type {
  VideoCompressionRequest,
  VideoCompressionTargetHeight,
} from '@jimeng-flow/shared/videoCompression'
import type { VideoTrimRequest } from '@jimeng-flow/shared/videoTrim'

/** 返回资产文件的访问 URL（供 <img src> / <video src> 使用） */
export function getAssetFileUrl(id: string): string {
  return `/api/assets/${encodeURIComponent(id)}/file`
}

/** 返回画布展示用的缩略图 URL（服务端按需生成并缓存，原图仅用于大图预览与下载） */
export function getAssetThumbUrl(id: string, width = 640): string {
  return `/api/assets/${encodeURIComponent(id)}/thumb?w=${width}`
}

/** 返回资产下载 URL（触发浏览器下载） */
export function getAssetDownloadUrl(id: string): string {
  return `/api/assets/${encodeURIComponent(id)}/download`
}

/** 读取资产并触发浏览器下载，避免直接链接被浏览器拦截。 */
export async function downloadAssetFile(id: string): Promise<void> {
  const res = await fetch(getAssetDownloadUrl(id))
  if (!res.ok) {
    throw new Error(`下载资产失败：${res.status} ${res.statusText}`)
  }

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const disposition = res.headers.get('content-disposition') || ''
  const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition)
  const filename = filenameMatch?.[1] || `asset-${id}`
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
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

/**
 * 上传本地文件为资产。
 * - 使用 multipart/form-data 流式上传，适合大文件（视频等），避免 base64 内存膨胀
 * - 返回后端写入的 Asset
 */
export async function uploadAsset(file: File): Promise<Asset> {
  const formData = new FormData()
  formData.append('file', file, file.name)

  const res = await fetch('/api/assets/upload/file', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message || `上传资产失败：${res.status} ${res.statusText}`)
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

/** 读取资产库中的资产（只包含右键保存过的资产）。 */
export async function listLibraryAssets(): Promise<Asset[]> {
  const res = await fetch('/api/assets/library')
  if (!res.ok) {
    throw new Error(`列出资产库失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Asset[]
}

/** 将已有输出资产登记到资产库，并由后端自动分类。 */
export async function saveAssetToLibrary(id: string): Promise<Asset> {
  const res = await fetch(`/api/assets/${encodeURIComponent(id)}/library`, {
    method: 'POST',
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message || `保存到资产库失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Asset
}

/** 高清当前图片资产，返回新资产；engine 缺省 dreamina，可选 nanobanana-pro（Nano Banana Pro 智能高清） */
export async function upscaleImageAsset(
  assetId: string,
  resolutionType = '2k',
  engine?: UpscaleEngine,
): Promise<Asset> {
  const body: UpscaleImageRequest = { resolutionType: resolutionType as UpscaleImageRequest['resolutionType'] }
  if (engine) body.engine = engine
  const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/upscale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message || `图片高清失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Asset
}

/** 本地压缩视频到 480P 或 360P，返回新的派生视频资产。 */
export async function compressVideoAsset(
  assetId: string,
  targetHeight: VideoCompressionTargetHeight,
): Promise<Asset> {
  const body: VideoCompressionRequest = { targetHeight }
  const res = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/compress-video`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      message?: string
    } | null
    throw new Error(
      payload?.message ||
        `视频压缩失败：${res.status} ${res.statusText}`,
    )
  }
  return (await res.json()) as Asset
}

/** 本地按入点和长度裁切视频，保留源分辨率并返回新的派生视频资产。 */
export async function trimVideoAsset(
  assetId: string,
  startSeconds: number,
  durationSeconds: number,
): Promise<Asset> {
  const body: VideoTrimRequest = { startSeconds, durationSeconds }
  const res = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/trim-video`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      message?: string
    } | null
    throw new Error(
      payload?.message || `视频裁切失败：${res.status} ${res.statusText}`,
    )
  }
  return (await res.json()) as Asset
}
/** 按原图像素坐标区域裁剪资产，每个区域存为独立 PNG 素材，按传入顺序返回 */
export async function cropAssetRegions(
  assetId: string,
  regions: CropRegion[],
): Promise<Asset[]> {
  const body: CropRegionsRequest = { regions }
  const res = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/crop-regions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message || `宫格裁剪失败：${res.status} ${res.statusText}`)
  }
  return ((await res.json()) as CropRegionsResponse).assets
}
