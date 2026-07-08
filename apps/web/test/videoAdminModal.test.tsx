import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ManagedVideo } from '@jimeng-flow/shared/video'

Object.assign(globalThis, { React })

const demoVideos: ManagedVideo[] = [
  {
    id: 'video_demo',
    title: '首页展示视频',
    description: '一条用于首页精选的视频',
    videoAssetId: 'asset_video_demo',
    coverAssetId: 'asset_cover_demo',
    videoUrl: '/api/assets/asset_video_demo/file',
    coverUrl: '/api/assets/asset_cover_demo/file',
    isFeatured: true,
    isPinned: true,
    isPublished: true,
    sortOrder: 80,
    createdAt: '2026-07-08T10:00:00.000Z',
    updatedAt: '2026-07-08T10:00:00.000Z',
  },
]

test('video admin modal exposes upload, edit, filter, and pagination controls', async () => {
  const { VideoAdminModal } = await import('../src/components/VideoAdminModal')

  const closedHtml = renderToStaticMarkup(
    <VideoAdminModal open={false} onClose={() => undefined} />,
  )
  assert.equal(closedHtml, '')

  const html = renderToStaticMarkup(
    <VideoAdminModal
      open={true}
      onClose={() => undefined}
      initialVideos={demoVideos}
    />,
  )

  for (const text of [
    '视频管理',
    '上传视频',
    '上传封面',
    '标题',
    '简介',
    '排序权重',
    '精选',
    '置顶',
    '上架',
    '搜索视频',
    '全部精选',
    '全部置顶',
    '首页展示视频',
    '上一页',
    '下一页',
  ]) {
    assert.equal(html.includes(text), true)
  }

  assert.equal(html.includes('/api/assets/asset_cover_demo/file'), true)
  assert.equal(html.includes('/api/assets/asset_video_demo/file'), true)
})
