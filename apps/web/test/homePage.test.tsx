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
          prompt: '工程封面',
          createdAt: '2026-07-08T12:30:00.000Z',
        },
        {
          id: 'asset_work',
          type: 'video',
          path: 'outputs/2026-07-08/asset_work.mp4',
          prompt: '作品视频',
          createdAt: '2026-07-08T12:00:00.000Z',
        },
      ]}
      heroImageUrl="/hero-test.png"
      logoImageUrl="/agent-avatar.png"
      onCreateFlow={() => undefined}
      onOpenFlow={() => undefined}
      onOpenAllFlows={() => undefined}
      onOpenAssetLibrary={() => undefined}
      onOpenSettings={() => undefined}
      onReturnHome={() => undefined}
    />,
  )

  for (const text of [
    '首页',
    '历史项目',
    '资源库',
    '设置',
    'MO.K',
    '晚上好，L-zw~',
    '说说你的创意',
    '新建画布',
    '历史工程',
    '品牌视觉方案',
    '作品',
    '展示封面',
  ]) {
    assert.equal(html.includes(text), true)
  }

  assert.equal(html.includes('/hero-test.png'), true)
  assert.equal(html.includes('NeoAI'), false)
  assert.equal(html.includes('home-particle-field'), true)
  assert.equal(html.includes('dot-field'), false)
  assert.equal(html.includes('home-creative-card'), true)
  assert.equal(html.includes('home-project-layer'), true)
  assert.equal(html.includes('home-project-cover'), true)
  assert.equal(html.includes('home-featured-layer'), true)
  assert.equal(html.includes('home-works-layer'), true)
  assert.equal(html.includes('home-works-grid five-up'), true)
  assert.equal(html.includes('/api/assets/asset_cover/file'), true)
  assert.equal(html.includes('从空白创意板开始'), false)
  assert.equal(html.includes('8 个节点'), false)
  assert.equal(html.includes('分钟前'), false)
  assert.equal(html.includes('Featured'), false)
  assert.equal(html.includes('精选'), false)
  assert.equal(html.match(/资源库/g)?.length, 1)
  assert.equal(html.includes('home-work-caption'), false)
  assert.equal(html.includes('作品视频'), false)
  assert.equal(html.includes('把作品'), false)
  assert.equal(html.includes('/agent-avatar.png'), true)
  assert.equal(html.includes('alt="首页 Logo"'), true)
  assert.equal(html.includes('home-logo-circle'), true)
  assert.equal(html.includes('home-logo-ripple'), true)
  assert.equal(html.includes('/api/assets/asset_showcase/file'), true)
})

test('home page uses quiet empty states without fake projects or assets', async () => {
  const { HomePage } = await import('../src/components/HomePage')

  const html = renderToStaticMarkup(
    <HomePage
      recentFlows={[]}
      showcaseAssets={[]}
      workAssets={[]}
      heroImageUrl="/hero-test.png"
      onCreateFlow={() => undefined}
      onOpenFlow={() => undefined}
      onOpenAllFlows={() => undefined}
      onOpenAssetLibrary={() => undefined}
      onOpenSettings={() => undefined}
      onReturnHome={() => undefined}
    />,
  )

  assert.equal(html.includes('暂无最近项目'), true)
  assert.equal(html.includes('暂无精选作品'), false)
  assert.equal(html.includes('暂无作品'), true)
  assert.equal(html.includes('品牌视觉方案'), false)
  assert.equal(html.includes('假数据'), false)
})
