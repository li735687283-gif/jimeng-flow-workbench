// 首页精选作品管理模型（支持图片和视频）。
// 媒体文件仍复用 Asset 存储，这里只保存后台管理需要的业务字段。

export type WorkMediaType = 'video' | 'image'

export interface ManagedWork {
  id: string
  mediaType: WorkMediaType
  title: string
  description: string
  mediaAssetId: string
  coverAssetId: string
  mediaUrl: string
  coverUrl: string
  isFeatured: boolean
  isPinned: boolean
  isPublished: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** @deprecated Use ManagedWork instead - kept for backwards compatibility */
export type ManagedVideo = ManagedWork

export interface CreateWorkRequest {
  mediaType: WorkMediaType
  title?: string
  description?: string
  mediaAssetId: string
  coverAssetId?: string
  isFeatured?: boolean
  isPinned?: boolean
  isPublished?: boolean
  sortOrder?: number
}

/** @deprecated Use CreateWorkRequest instead */
export type CreateVideoRequest = CreateWorkRequest

export interface UpdateWorkRequest {
  title?: string
  description?: string
  mediaAssetId?: string
  coverAssetId?: string
  isFeatured?: boolean
  isPinned?: boolean
  isPublished?: boolean
  sortOrder?: number
}

/** @deprecated Use UpdateWorkRequest instead */
export type UpdateVideoRequest = UpdateWorkRequest

export interface WorkListQuery {
  page?: number
  pageSize?: number
  q?: string
  mediaType?: WorkMediaType
  isFeatured?: boolean
  isPinned?: boolean
}

/** @deprecated Use WorkListQuery instead */
export type VideoListQuery = WorkListQuery

export interface WorkListResponse {
  items: ManagedWork[]
  total: number
  page: number
  pageSize: number
}

/** @deprecated Use WorkListResponse instead */
export type VideoListResponse = WorkListResponse
