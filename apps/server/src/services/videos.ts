// 首页精选作品管理服务（支持图片和视频）。
// 媒体文件保存在 Asset 系统，这里持久化业务元数据。

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import type {
  CreateWorkRequest,
  ManagedWork,
  UpdateWorkRequest,
  WorkListQuery,
  WorkListResponse,
  WorkMediaType,
} from '@jimeng-flow/shared/video'
import { getProjectRoot } from '../config'
import { getAsset } from './assets'

const WORKS_DIR = resolve(getProjectRoot(), 'workspace/config')
const WORKS_FILE = resolve(WORKS_DIR, 'videos.json')
const WORK_ID_PATTERN = /^(video|work)_[a-z0-9_]+$/

function nowIso(): string {
  return new Date().toISOString()
}

function generateWorkId(): string {
  const ts = Date.now().toString(36)
  const rand = randomBytes(4).toString('hex')
  return `work_${ts}_${rand}`
}

function assetUrl(assetId: string): string {
  return `/api/assets/${encodeURIComponent(assetId)}/file`
}

function normalizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function normalizeSortOrder(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeMediaType(value: unknown): WorkMediaType {
  return value === 'image' ? 'image' : 'video'
}

function withUrls(work: ManagedWork): ManagedWork {
  return {
    ...work,
    mediaUrl: assetUrl(work.mediaAssetId),
    coverUrl: assetUrl(work.coverAssetId),
  }
}

function normalizeWork(raw: unknown): ManagedWork | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  const id = normalizeText(item.id)
  let mediaType = normalizeMediaType(item.mediaType)
  let mediaAssetId = normalizeText(item.mediaAssetId)
  let coverAssetId = normalizeText(item.coverAssetId)

  // 向后兼容旧数据结构（videoAssetId/coverAssetId/videoUrl）
  if (!mediaAssetId) {
    mediaAssetId = normalizeText(item.videoAssetId)
    mediaType = 'video'
  }
  if (!coverAssetId) {
    coverAssetId = normalizeText(item.coverAssetId) || mediaAssetId
  }

  if (!WORK_ID_PATTERN.test(id) || !mediaAssetId || !coverAssetId) return null

  return withUrls({
    id,
    mediaType,
    title: normalizeText(item.title, '未命名作品') || '未命名作品',
    description: normalizeText(item.description),
    mediaAssetId,
    coverAssetId,
    mediaUrl: assetUrl(mediaAssetId),
    coverUrl: assetUrl(coverAssetId),
    isFeatured: item.isFeatured === true,
    isPinned: item.isPinned === true,
    isPublished: item.isPublished === true,
    sortOrder: normalizeSortOrder(item.sortOrder),
    createdAt: normalizeText(item.createdAt, nowIso()),
    updatedAt: normalizeText(item.updatedAt, nowIso()),
  })
}

async function readWorks(): Promise<ManagedWork[]> {
  try {
    const content = await readFile(WORKS_FILE, 'utf8')
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeWork)
      .filter((work): work is ManagedWork => work !== null)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || err instanceof SyntaxError) return []
    throw err
  }
}

async function writeWorks(works: ManagedWork[]): Promise<void> {
  await mkdir(WORKS_DIR, { recursive: true })
  await writeFile(WORKS_FILE, JSON.stringify(works.map(withUrls), null, 2), 'utf8')
}

function compareForAdminList(a: ManagedWork, b: ManagedWork): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
  if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder
  return b.updatedAt.localeCompare(a.updatedAt)
}

function normalizePage(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}

function normalizePageSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 12
  return Math.min(100, Math.max(1, Math.floor(value)))
}

export function getFeaturedHomeWorks(works: ManagedWork[]): ManagedWork[] {
  return works
    .filter((work) => work.isFeatured && work.isPublished)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    .map(withUrls)
}

export function getGalleryWorks(works: ManagedWork[]): ManagedWork[] {
  return works
    .filter((work) => work.isPublished)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    .map(withUrls)
}

export function buildWorkListResponse(
  works: ManagedWork[],
  query: WorkListQuery = {},
): WorkListResponse {
  const page = normalizePage(query.page)
  const pageSize = normalizePageSize(query.pageSize)
  const keyword = query.q?.trim().toLowerCase() ?? ''

  const filtered = works.filter((work) => {
    if (query.mediaType && work.mediaType !== query.mediaType) {
      return false
    }
    if (typeof query.isFeatured === 'boolean' && work.isFeatured !== query.isFeatured) {
      return false
    }
    if (typeof query.isPinned === 'boolean' && work.isPinned !== query.isPinned) {
      return false
    }
    if (!keyword) return true
    return (
      work.title.toLowerCase().includes(keyword) ||
      work.description.toLowerCase().includes(keyword)
    )
  })

  const sorted = filtered.map(withUrls).sort(compareForAdminList)
  const start = (page - 1) * pageSize
  return {
    items: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page,
    pageSize,
  }
}

async function assertAssetType(assetId: string, expectedType: WorkMediaType): Promise<void> {
  const asset = await getAsset(assetId)
  if (!asset || asset.type !== expectedType) {
    const error = new Error(expectedType === 'video' ? '视频文件不存在' : '图片文件不存在')
    ;(error as Error & { code: string }).code = 'WORK_BAD_ASSET'
    throw error
  }
}

export async function listWorks(query: WorkListQuery = {}): Promise<WorkListResponse> {
  return buildWorkListResponse(await readWorks(), query)
}

export async function listFeaturedWorks(): Promise<ManagedWork[]> {
  return getFeaturedHomeWorks(await readWorks())
}

export async function listGalleryWorks(): Promise<ManagedWork[]> {
  return getGalleryWorks(await readWorks())
}

export async function createWork(input: CreateWorkRequest): Promise<ManagedWork> {
  const mediaType = normalizeMediaType(input.mediaType)
  await assertAssetType(input.mediaAssetId, mediaType)

  let coverAssetId = input.coverAssetId?.trim() || input.mediaAssetId
  if (coverAssetId !== input.mediaAssetId) {
    await assertAssetType(coverAssetId, 'image')
  } else if (mediaType === 'video') {
    const error = new Error('视频作品需要上传封面图')
    ;(error as Error & { code: string }).code = 'WORK_BAD_ASSET'
    throw error
  }

  const now = nowIso()
  const work: ManagedWork = withUrls({
    id: generateWorkId(),
    mediaType,
    title: normalizeText(input.title, '未命名作品') || '未命名作品',
    description: normalizeText(input.description),
    mediaAssetId: input.mediaAssetId,
    coverAssetId,
    mediaUrl: assetUrl(input.mediaAssetId),
    coverUrl: assetUrl(coverAssetId),
    isFeatured: input.isFeatured === true,
    isPinned: input.isPinned === true,
    isPublished: input.isPublished !== false,
    sortOrder: normalizeSortOrder(input.sortOrder),
    createdAt: now,
    updatedAt: now,
  })

  const works = await readWorks()
  works.unshift(work)
  await writeWorks(works)
  return work
}

export async function updateWork(
  id: string,
  patch: UpdateWorkRequest,
): Promise<ManagedWork> {
  if (!WORK_ID_PATTERN.test(id)) {
    const error = new Error('作品不存在')
    ;(error as Error & { code: string }).code = 'WORK_NOT_FOUND'
    throw error
  }

  if (patch.mediaAssetId) {
    const works = await readWorks()
    const current = works.find((w) => w.id === id)
    const mediaType = current?.mediaType ?? 'video'
    await assertAssetType(patch.mediaAssetId, mediaType)
  }
  if (patch.coverAssetId) {
    await assertAssetType(patch.coverAssetId, 'image')
  }

  const works = await readWorks()
  const index = works.findIndex((work) => work.id === id)
  if (index < 0) {
    const error = new Error('作品不存在')
    ;(error as Error & { code: string }).code = 'WORK_NOT_FOUND'
    throw error
  }

  const current = works[index]
  const nextMediaAssetId = patch.mediaAssetId ?? current.mediaAssetId
  let nextCoverAssetId = patch.coverAssetId ?? current.coverAssetId

  if (patch.mediaAssetId && current.mediaType === 'video' && !patch.coverAssetId) {
    const error = new Error('视频作品需要上传封面图')
    ;(error as Error & { code: string }).code = 'WORK_BAD_ASSET'
    throw error
  }

  if (current.mediaType === 'image' && nextCoverAssetId === nextMediaAssetId && !patch.coverAssetId) {
    nextCoverAssetId = nextMediaAssetId
  }

  const next: ManagedWork = withUrls({
    ...current,
    title: patch.title === undefined ? current.title : normalizeText(patch.title, current.title),
    description:
      patch.description === undefined
        ? current.description
        : normalizeText(patch.description),
    mediaAssetId: nextMediaAssetId,
    coverAssetId: nextCoverAssetId,
    isFeatured: patch.isFeatured ?? current.isFeatured,
    isPinned: patch.isPinned ?? current.isPinned,
    isPublished: patch.isPublished ?? current.isPublished,
    sortOrder:
      patch.sortOrder === undefined ? current.sortOrder : normalizeSortOrder(patch.sortOrder),
    updatedAt: nowIso(),
  })

  works[index] = next
  await writeWorks(works)
  return next
}

// Backwards compatibility aliases
/** @deprecated Use createWork instead */
export const createVideo = createWork
/** @deprecated Use updateWork instead */
export const updateVideo = updateWork
/** @deprecated Use listWorks instead */
export const listVideos = listWorks
/** @deprecated Use listFeaturedWorks instead */
export const listFeaturedVideos = listFeaturedWorks
