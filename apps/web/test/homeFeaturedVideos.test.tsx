import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('home page renders featured work cards with cover and muted loop playback', async () => {
  const { HomePage } = await import('../src/components/HomePage')

  const html = renderToStaticMarkup(
    <HomePage
      recentFlows={[]}
      showcaseAssets={[]}
      workAssets={[]}
      featuredWorks={[
        {
          id: 'video_featured',
          mediaType: 'video',
          title: '首页精选视频',
          description: '悬停自动播放',
          mediaAssetId: 'asset_video_featured',
          coverAssetId: 'asset_cover_featured',
          mediaUrl: '/api/assets/asset_video_featured/file',
          coverUrl: '/api/assets/asset_cover_featured/file',
          isFeatured: true,
          isPinned: false,
          isPublished: true,
          sortOrder: 90,
          createdAt: '2026-07-08T10:00:00.000Z',
          updatedAt: '2026-07-08T10:00:00.000Z',
        },
      ]}
      mokHeroImageUrl="/mok-hero-test.png"
      onCreateFlow={() => undefined}
      onOpenFlow={() => undefined}
      onOpenAllFlows={() => undefined}
      onOpenAssetLibrary={() => undefined}
      onOpenVideoAdmin={() => undefined}
      onOpenSettings={() => undefined}
    />,
  )

  assert.equal(html.includes('home-featured-video-card'), true)
  assert.equal(html.includes('/api/assets/asset_cover_featured/file'), true)
  assert.equal(html.includes('/api/assets/asset_video_featured/file'), true)
  assert.match(html, /<video[^>]+muted/)
  assert.match(html, /<video[^>]+loop/)
  assert.equal(html.includes('首页精选视频'), false)
})
