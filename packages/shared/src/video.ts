// 首页精选视频管理模型。
// 媒体文件仍复用 Asset 存储，这里只保存后台管理需要的业务字段。

export interface ManagedVideo {
  id: string
  title: string
  description: string
  videoAssetId: string
  coverAssetId: string
  videoUrl: string
  coverUrl: string
  isFeatured: boolean
  isPinned: boolean
  isPublished: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateVideoRequest {
  title?: string
  description?: string
  videoAssetId: string
  coverAssetId: string
  isFeatured?: boolean
  isPinned?: boolean
  isPublished?: boolean
  sortOrder?: number
}

export interface UpdateVideoRequest {
  title?: string
  description?: string
  videoAssetId?: string
  coverAssetId?: string
  isFeatured?: boolean
  isPinned?: boolean
  isPublished?: boolean
  sortOrder?: number
}

export interface VideoListQuery {
  page?: number
  pageSize?: number
  q?: string
  isFeatured?: boolean
  isPinned?: boolean
}

export interface VideoListResponse {
  items: ManagedVideo[]
  total: number
  page: number
  pageSize: number
}
