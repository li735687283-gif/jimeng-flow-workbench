// 首页精选视频管理服务。
// 视频和封面文件保存在 Asset 系统，这里持久化业务元数据。

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import type {
  CreateVideoRequest,
  ManagedVideo,
  UpdateVideoRequest,
  VideoListQuery,
  VideoListResponse,
} from '@jimeng-flow/shared/video'
import { getProjectRoot } from '../config'
import { getAsset } from './assets'

const VIDEOS_DIR = resolve(getProjectRoot(), 'workspace/config')
const VIDEOS_FILE = resolve(VIDEOS_DIR, 'videos.json')
const VIDEO_ID_PATTERN = /^video_[a-z0-9_]+$/

function nowIso(): string {
  return new Date().toISOString()
}

function generateVideoId(): string {
  const ts = Date.now().toString(36)
  const rand = randomBytes(4).toString('hex')
  return `video_${ts}_${rand}`
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

function withUrls(video: ManagedVideo): ManagedVideo {
  return {
    ...video,
    videoUrl: assetUrl(video.videoAssetId),
    coverUrl: assetUrl(video.coverAssetId),
  }
}

function normalizeVideo(raw: unknown): ManagedVideo | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const id = normalizeText(item.id)
  const videoAssetId = normalizeText(item.videoAssetId)
  const coverAssetId = normalizeText(item.coverAssetId)
  if (!VIDEO_ID_PATTERN.test(id) || !videoAssetId || !coverAssetId) return null

  return withUrls({
    id,
    title: normalizeText(item.title, '未命名视频') || '未命名视频',
    description: normalizeText(item.description),
    videoAssetId,
    coverAssetId,
    videoUrl: assetUrl(videoAssetId),
    coverUrl: assetUrl(coverAssetId),
    isFeatured: item.isFeatured === true,
    isPinned: item.isPinned === true,
    isPublished: item.isPublished === true,
    sortOrder: normalizeSortOrder(item.sortOrder),
    createdAt: normalizeText(item.createdAt, nowIso()),
    updatedAt: normalizeText(item.updatedAt, nowIso()),
  })
}

async function readVideos(): Promise<ManagedVideo[]> {
  try {
    const content = await readFile(VIDEOS_FILE, 'utf8')
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeVideo)
      .filter((video): video is ManagedVideo => video !== null)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || err instanceof SyntaxError) return []
    throw err
  }
}

async function writeVideos(videos: ManagedVideo[]): Promise<void> {
  await mkdir(VIDEOS_DIR, { recursive: true })
  await writeFile(VIDEOS_FILE, JSON.stringify(videos.map(withUrls), null, 2), 'utf8')
}

function compareForAdminList(a: ManagedVideo, b: ManagedVideo): number {
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

export function getFeaturedHomeVideos(videos: ManagedVideo[]): ManagedVideo[] {
  return videos
    .filter((video) => video.isFeatured && video.isPublished)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    .map(withUrls)
}

export function buildVideoListResponse(
  videos: ManagedVideo[],
  query: VideoListQuery = {},
): VideoListResponse {
  const page = normalizePage(query.page)
  const pageSize = normalizePageSize(query.pageSize)
  const keyword = query.q?.trim().toLowerCase() ?? ''

  const filtered = videos.filter((video) => {
    if (typeof query.isFeatured === 'boolean' && video.isFeatured !== query.isFeatured) {
      return false
    }
    if (typeof query.isPinned === 'boolean' && video.isPinned !== query.isPinned) {
      return false
    }
    if (!keyword) return true
    return (
      video.title.toLowerCase().includes(keyword) ||
      video.description.toLowerCase().includes(keyword)
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

async function assertAssetType(assetId: string, expectedType: 'image' | 'video'): Promise<void> {
  const asset = await getAsset(assetId)
  if (!asset || asset.type !== expectedType) {
    const error = new Error(expectedType === 'video' ? '视频文件不存在' : '封面图不存在')
    ;(error as Error & { code: string }).code = 'VIDEO_BAD_ASSET'
    throw error
  }
}

export async function listVideos(query: VideoListQuery = {}): Promise<VideoListResponse> {
  return buildVideoListResponse(await readVideos(), query)
}

export async function listFeaturedVideos(): Promise<ManagedVideo[]> {
  return getFeaturedHomeVideos(await readVideos())
}

export async function createVideo(input: CreateVideoRequest): Promise<ManagedVideo> {
  await assertAssetType(input.videoAssetId, 'video')
  await assertAssetType(input.coverAssetId, 'image')

  const now = nowIso()
  const video: ManagedVideo = withUrls({
    id: generateVideoId(),
    title: normalizeText(input.title, '未命名视频') || '未命名视频',
    description: normalizeText(input.description),
    videoAssetId: input.videoAssetId,
    coverAssetId: input.coverAssetId,
    videoUrl: assetUrl(input.videoAssetId),
    coverUrl: assetUrl(input.coverAssetId),
    isFeatured: input.isFeatured === true,
    isPinned: input.isPinned === true,
    isPublished: input.isPublished !== false,
    sortOrder: normalizeSortOrder(input.sortOrder),
    createdAt: now,
    updatedAt: now,
  })

  const videos = await readVideos()
  videos.unshift(video)
  await writeVideos(videos)
  return video
}

export async function updateVideo(
  id: string,
  patch: UpdateVideoRequest,
): Promise<ManagedVideo> {
  if (!VIDEO_ID_PATTERN.test(id)) {
    const error = new Error('视频不存在')
    ;(error as Error & { code: string }).code = 'VIDEO_NOT_FOUND'
    throw error
  }

  if (patch.videoAssetId) await assertAssetType(patch.videoAssetId, 'video')
  if (patch.coverAssetId) await assertAssetType(patch.coverAssetId, 'image')

  const videos = await readVideos()
  const index = videos.findIndex((video) => video.id === id)
  if (index < 0) {
    const error = new Error('视频不存在')
    ;(error as Error & { code: string }).code = 'VIDEO_NOT_FOUND'
    throw error
  }

  const current = videos[index]
  const next: ManagedVideo = withUrls({
    ...current,
    title: patch.title === undefined ? current.title : normalizeText(patch.title, current.title),
    description:
      patch.description === undefined
        ? current.description
        : normalizeText(patch.description),
    videoAssetId: patch.videoAssetId ?? current.videoAssetId,
    coverAssetId: patch.coverAssetId ?? current.coverAssetId,
    isFeatured: patch.isFeatured ?? current.isFeatured,
    isPinned: patch.isPinned ?? current.isPinned,
    isPublished: patch.isPublished ?? current.isPublished,
    sortOrder:
      patch.sortOrder === undefined ? current.sortOrder : normalizeSortOrder(patch.sortOrder),
    updatedAt: nowIso(),
  })

  videos[index] = next
  await writeVideos(videos)
  return next
}
