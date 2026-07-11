import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ManagedWork } from '@jimeng-flow/shared/video'
import { buildWorkListResponse, getFeaturedHomeWorks } from '../src/services/videos'

const works: ManagedWork[] = [
  {
    id: 'video_1',
    mediaType: 'video',
    title: '城市预告片',
    description: '夜色里的城市镜头',
    mediaAssetId: 'asset_video_1',
    coverAssetId: 'asset_cover_1',
    mediaUrl: '/api/assets/asset_video_1/file',
    coverUrl: '/api/assets/asset_cover_1/file',
    isFeatured: true,
    isPinned: false,
    isPublished: true,
    sortOrder: 12,
    createdAt: '2026-07-08T10:00:00.000Z',
    updatedAt: '2026-07-08T10:00:00.000Z',
  },
  {
    id: 'video_2',
    mediaType: 'video',
    title: '角色测试',
    description: '未上架内容',
    mediaAssetId: 'asset_video_2',
    coverAssetId: 'asset_cover_2',
    mediaUrl: '/api/assets/asset_video_2/file',
    coverUrl: '/api/assets/asset_cover_2/file',
    isFeatured: true,
    isPinned: true,
    isPublished: false,
    sortOrder: 99,
    createdAt: '2026-07-08T11:00:00.000Z',
    updatedAt: '2026-07-08T11:00:00.000Z',
  },
  {
    id: 'video_3',
    mediaType: 'video',
    title: '山谷短片',
    description: '精选上架',
    mediaAssetId: 'asset_video_3',
    coverAssetId: 'asset_cover_3',
    mediaUrl: '/api/assets/asset_video_3/file',
    coverUrl: '/api/assets/asset_cover_3/file',
    isFeatured: true,
    isPinned: true,
    isPublished: true,
    sortOrder: 48,
    createdAt: '2026-07-08T12:00:00.000Z',
    updatedAt: '2026-07-08T12:00:00.000Z',
  },
]

test('getFeaturedHomeWorks returns only featured published works by sort order desc', () => {
  const result = getFeaturedHomeWorks(works)

  assert.deepEqual(
    result.map((work) => work.id),
    ['video_3', 'video_1'],
  )
  assert.equal(result[0]?.mediaUrl, '/api/assets/asset_video_3/file')
})

test('buildWorkListResponse filters by search and pinned state with pagination', () => {
  const result = buildWorkListResponse(works, {
    page: 1,
    pageSize: 1,
    q: '角色',
    isPinned: true,
  })

  assert.equal(result.total, 1)
  assert.equal(result.page, 1)
  assert.equal(result.pageSize, 1)
  assert.deepEqual(
    result.items.map((work) => work.id),
    ['video_2'],
  )
  assert.equal(result.items[0]?.mediaUrl, '/api/assets/asset_video_2/file')
})
