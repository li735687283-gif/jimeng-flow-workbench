import type {
  ManagedWork,
  WorkListQuery,
  WorkMediaType,
} from '@jimeng-flow/shared/video'

export type WorkAdminTab = 'all' | 'video' | 'image' | 'featured'

export interface WorkAdminFormState {
  mediaType: WorkMediaType
  title: string
  description: string
  sortOrder: string
  isFeatured: boolean
  isPinned: boolean
  isPublished: boolean
}

export function buildWorkAdminListQuery(
  tab: WorkAdminTab,
  page: number,
  pageSize: number,
): WorkListQuery {
  const query: WorkListQuery = { page, pageSize }
  if (tab === 'featured') return { ...query, isFeatured: true }
  if (tab === 'video' || tab === 'image') return { ...query, mediaType: tab }
  return query
}

export function buildWorkAdminEditForm(work: ManagedWork): WorkAdminFormState {
  return {
    mediaType: work.mediaType,
    title: work.title,
    description: work.description,
    sortOrder: String(work.sortOrder),
    isFeatured: work.isFeatured,
    isPinned: work.isPinned,
    isPublished: work.isPublished,
  }
}

export function clampWorkAdminPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, page), Math.max(1, pageCount))
}
