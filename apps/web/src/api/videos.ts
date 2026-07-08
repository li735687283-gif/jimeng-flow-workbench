// 前端作品管理 API client（支持图片和视频作品）。

import type {
  CreateWorkRequest,
  ManagedWork,
  UpdateWorkRequest,
  WorkListQuery,
  WorkListResponse,
  WorkMediaType,
} from '@jimeng-flow/shared/video'

function toSearchParams(query: WorkListQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.mediaType) params.set('mediaType', query.mediaType)
  if (query.isFeatured !== undefined) params.set('isFeatured', String(query.isFeatured))
  if (query.isPinned !== undefined) params.set('isPinned', String(query.isPinned))
  return params
}

async function readApiError(res: Response, fallback: string): Promise<Error> {
  const payload = (await res.json().catch(() => null)) as { message?: string } | null
  return new Error(payload?.message || fallback)
}

export async function listWorks(query: WorkListQuery = {}): Promise<WorkListResponse> {
  const params = toSearchParams(query)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  const res = await fetch(`/api/videos${suffix}`)
  if (!res.ok) {
    throw await readApiError(res, `获取作品列表失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as WorkListResponse
}

export async function listFeaturedWorks(): Promise<ManagedWork[]> {
  const res = await fetch('/api/videos/featured')
  if (!res.ok) {
    throw await readApiError(res, `获取首页精选作品失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as ManagedWork[]
}

export async function listGalleryWorks(): Promise<ManagedWork[]> {
  const res = await fetch('/api/videos/gallery')
  if (!res.ok) {
    throw await readApiError(res, `获取首页作品展示失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as ManagedWork[]
}

export async function createWork(input: CreateWorkRequest): Promise<ManagedWork> {
  const res = await fetch('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw await readApiError(res, `创建作品失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as ManagedWork
}

export async function updateWork(
  id: string,
  patch: UpdateWorkRequest,
): Promise<ManagedWork> {
  const res = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    throw await readApiError(res, `更新作品失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as ManagedWork
}

// Backwards compatibility aliases
/** @deprecated Use listWorks instead */
export const listVideos = listWorks
/** @deprecated Use listFeaturedWorks instead */
export const listFeaturedVideos = listFeaturedWorks
/** @deprecated Use createWork instead */
export const createVideo = createWork
/** @deprecated Use updateWork instead */
export const updateVideo = updateWork

export type { WorkMediaType }
