// 前端视频管理 API client。

import type {
  CreateVideoRequest,
  ManagedVideo,
  UpdateVideoRequest,
  VideoListQuery,
  VideoListResponse,
} from '@jimeng-flow/shared/video'

function toSearchParams(query: VideoListQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.isFeatured !== undefined) params.set('isFeatured', String(query.isFeatured))
  if (query.isPinned !== undefined) params.set('isPinned', String(query.isPinned))
  return params
}

async function readApiError(res: Response, fallback: string): Promise<Error> {
  const payload = (await res.json().catch(() => null)) as { message?: string } | null
  return new Error(payload?.message || fallback)
}

export async function listVideos(query: VideoListQuery = {}): Promise<VideoListResponse> {
  const params = toSearchParams(query)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  const res = await fetch(`/api/videos${suffix}`)
  if (!res.ok) {
    throw await readApiError(res, `获取视频列表失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as VideoListResponse
}

export async function listFeaturedVideos(): Promise<ManagedVideo[]> {
  const res = await fetch('/api/videos/featured')
  if (!res.ok) {
    throw await readApiError(res, `获取首页精选视频失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as ManagedVideo[]
}

export async function createVideo(input: CreateVideoRequest): Promise<ManagedVideo> {
  const res = await fetch('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw await readApiError(res, `创建视频失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as ManagedVideo
}

export async function updateVideo(
  id: string,
  patch: UpdateVideoRequest,
): Promise<ManagedVideo> {
  const res = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    throw await readApiError(res, `更新视频失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as ManagedVideo
}
