import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('home page renders a restrained creation entry with logo menu items', async () => {
  const { HomePage } = await import('../src/components/HomePage')

  const html = renderToStaticMarkup(
    <HomePage
      recentFlows={[
        {
          id: 'flow_recent',
          name: '品牌视觉方案',
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-08T10:30:00.000Z',
          nodeCount: 8,
          coverAssetId: 'asset_cover',
        },
      ]}
      showcaseAssets={[
        {
          id: 'asset_showcase',
          type: 'image',
          path: 'outputs/2026-07-08/asset_showcase.png',
          prompt: '展示封面',
          createdAt: '2026-07-08T11:00:00.000Z',
          showcase: true,
        },
      ]}
      workAssets={[
        {
          id: 'asset_cover',
          type: 'image',
          path: 'outputs/2026-07-08/asset_cover.png',
          sourceNodeId: 'image_node',
          prompt: '工程封面',
          createdAt: '2026-07-08T12:30:00.000Z',
        },
        {
          id: 'asset_work',
          type: 'video',
          path: 'outputs/2026-07-08/asset_work.mp4',
          sourceNodeId: 'video_node',
          prompt: '作品视频',
          createdAt: '2026-07-08T12:00:00.000Z',
        },
      ]}
      mokHeroImageUrl="/mok-hero-test.png"
      logoImageUrl="/agent-avatar.png"
      onCreateFlow={() => undefined}
      onOpenFlow={() => undefined}
      onOpenAllFlows={() => undefined}
      onOpenAssetLibrary={() => undefined}
      onOpenVideoAdmin={() => undefined}
      onOpenSettings={() => undefined}
    />,
  )

  for (const text of [
    '历史记录',
    '资源库',
    '作品管理',
    '设置',
    'MO.K',
    '新建画布',
    '全部项目',
    '品牌视觉方案',
    '展示封面',
  ]) {
    assert.equal(html.includes(text), true)
  }

  assert.equal(html.includes('/mok-hero-test.png'), true)
  assert.equal(html.includes('NeoAI'), false)
  assert.equal(html.includes('home-particle-field'), true)
  assert.equal(html.includes('dot-field'), false)
  assert.equal(html.includes('home-project-layer'), true)
  assert.equal(html.includes('home-project-cover'), true)
  assert.equal(html.includes('home-featured-layer'), true)
  assert.equal(html.includes('home-works-layer'), true)
  assert.equal(html.includes('home-media-masonry'), true)
  assert.equal(html.includes('/api/assets/asset_cover/thumb?w=640'), true)
  assert.equal(html.includes('从空白创意板开始'), false)
  assert.equal(html.includes('8 个节点'), false)
  assert.equal(html.includes('分钟前'), false)
  assert.equal(html.includes('Featured'), false)
  assert.equal(html.includes('精选'), false)
  assert.equal(html.match(/资源库/g)?.length, 1)
  assert.equal(html.includes('home-work-caption'), false)
  assert.equal(html.includes('作品视频'), true)
  assert.equal(html.includes('把作品'), false)
  assert.equal(html.includes('/agent-avatar.png'), true)
  assert.equal(html.includes('alt="首页 Logo"'), true)
  assert.equal(html.includes('home-logo-circle'), true)
  assert.equal(html.includes('home-logo-ripple'), true)
  assert.equal(html.includes('/api/assets/asset_showcase/thumb?w=640'), true)
})

test('home page shows a compact update pill and circular download progress', async () => {
  const { HomePage } = await import('../src/components/HomePage')
  const baseProps = {
    recentFlows: [],
    showcaseAssets: [],
    workAssets: [],
    mokHeroImageUrl: '/mok-hero-test.png',
    onCreateFlow: () => undefined,
    onOpenFlow: () => undefined,
    onOpenAllFlows: () => undefined,
    onOpenAssetLibrary: () => undefined,
    onOpenSettings: () => undefined,
  }

  const availableHtml = renderToStaticMarkup(
    <HomePage
      {...baseProps}
      updateState={{ status: 'available', version: '0.1.4' }}
      onDownloadUpdate={() => undefined}
    />,
  )
  assert.equal(availableHtml.includes('home-update-pill is-available'), true)
  assert.equal(availableHtml.includes('新版本 0.1.4'), true)
  assert.equal(availableHtml.includes('有新版本 0.1.4，点击下载'), true)

  const downloadingHtml = renderToStaticMarkup(
    <HomePage
      {...baseProps}
      updateState={{ status: 'downloading', version: '0.1.4', percent: 42 }}
    />,
  )
  assert.equal(downloadingHtml.includes('role="progressbar"'), true)
  assert.equal(downloadingHtml.includes('aria-valuenow="42"'), true)
  assert.equal(downloadingHtml.includes('home-update-progress-value'), true)
})

test('home page uses quiet empty states without fake projects or assets', async () => {
  const { HomePage } = await import('../src/components/HomePage')

  const html = renderToStaticMarkup(
    <HomePage
      recentFlows={[]}
      showcaseAssets={[]}
      workAssets={[]}
      mokHeroImageUrl="/mok-hero-test.png"
      onCreateFlow={() => undefined}
      onOpenFlow={() => undefined}
      onOpenAllFlows={() => undefined}
      onOpenAssetLibrary={() => undefined}
      onOpenSettings={() => undefined}
    />,
  )

  assert.equal(html.includes('暂无最近项目'), true)
  assert.equal(html.includes('暂无精选作品'), false)
  assert.equal(html.includes('暂无画布作品'), true)
  assert.equal(html.includes('品牌视觉方案'), false)
  assert.equal(html.includes('假数据'), false)
})

test('home page progressively renders canvas-generated media as an infinite masonry feed', async () => {
  const { HomePage } = await import('../src/components/HomePage')
  const generatedAssets = Array.from({ length: 15 }, (_, index) => ({
    id: `asset_generated_${index}`,
    type: index % 3 === 0 ? ('video' as const) : ('image' as const),
    path: `outputs/2026-07-31/asset_generated_${index}.${index % 3 === 0 ? 'mp4' : 'png'}`,
    sourceNodeId: `node_${index}`,
    prompt: `画布作品 ${index}`,
    createdAt: new Date(Date.UTC(2026, 6, 31, 12, index)).toISOString(),
  }))

  const html = renderToStaticMarkup(
    <HomePage
      recentFlows={[]}
      showcaseAssets={[]}
      workAssets={[
        ...generatedAssets,
        {
          id: 'asset_upload',
          type: 'image',
          path: 'outputs/2026-07-31/asset_upload.png',
          params: { origin: 'upload' },
          createdAt: '2026-07-31T14:00:00.000Z',
        },
      ]}
      mokHeroImageUrl="/mok-hero-test.png"
      onCreateFlow={() => undefined}
      onOpenFlow={() => undefined}
      onOpenAllFlows={() => undefined}
      onOpenAssetLibrary={() => undefined}
      onOpenSettings={() => undefined}
    />,
  )

  assert.equal(html.includes('home-media-masonry'), true)
  assert.equal((html.match(/class="home-media-column"/g) ?? []).length, 5)
  assert.equal((html.match(/home-media-card/g) ?? []).length, 12)
  assert.equal(html.includes('home-media-load-more'), true)
  assert.equal(html.includes('asset_upload'), false)
  assert.equal(html.includes('loading="eager"'), true)
})
