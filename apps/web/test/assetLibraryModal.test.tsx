import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('asset library modal renders only useful navigation and search controls', async () => {
  const { AssetLibraryModal } = await import(
    '../src/components/AssetLibraryModal'
  )

  const closedHtml = renderToStaticMarkup(
    <AssetLibraryModal open={false} onClose={() => undefined} />,
  )
  assert.equal(closedHtml, '')

  const html = renderToStaticMarkup(
    <AssetLibraryModal open={true} onClose={() => undefined} />,
  )

  for (const text of ['素材库', '全部', '图片', '视频', '暂无素材']) {
    assert.equal(html.includes(text), true)
  }

  for (const removedText of [
    '画布资产',
    '图片工具',
    '视频工具',
    '全部分类',
    '音频',
    '文本',
    '实时预览',
    '批量选择',
  ]) {
    assert.equal(html.includes(removedText), false)
  }

  assert.equal(html.includes('aria-label="关闭素材库"'), true)
  assert.equal(html.includes('aria-label="搜索素材"'), true)
})

test('asset library modal renders real image and video assets', async () => {
  const { AssetLibraryModal } = await import(
    '../src/components/AssetLibraryModal'
  )

  const html = renderToStaticMarkup(
    <AssetLibraryModal
      open={true}
      onClose={() => undefined}
      initialAssets={[
        {
          id: 'asset_image_1',
          type: 'image',
          path: 'workspace/outputs/asset_image_1.png',
          prompt: 'still frame',
          createdAt: '2026-07-07T10:00:00.000Z',
        },
        {
          id: 'asset_video_1',
          type: 'video',
          path: 'workspace/outputs/asset_video_1.mp4',
          prompt: 'video draw',
          sourceNodeId: 'video-1',
          createdAt: '2026-07-07T11:00:00.000Z',
        },
      ]}
    />,
  )

  assert.equal(html.includes('/api/assets/asset_image_1/file'), true)
  assert.equal(html.includes('/api/assets/asset_video_1/file'), true)
  assert.equal(html.includes('<img'), true)
  assert.equal(html.includes('<video'), true)
  assert.equal(html.includes('data-source-node-id="video-1"'), true)
  assert.equal(html.includes('still frame'), true)
  assert.equal(html.includes('video draw'), true)
  assert.equal(html.includes('图片生成'), false)
})

test('asset library modal can start filtered to video assets', async () => {
  const { AssetLibraryModal } = await import(
    '../src/components/AssetLibraryModal'
  )

  const html = renderToStaticMarkup(
    <AssetLibraryModal
      open={true}
      onClose={() => undefined}
      initialFilter="视频"
      initialAssets={[
        {
          id: 'asset_image_1',
          type: 'image',
          path: 'workspace/outputs/asset_image_1.png',
          prompt: 'image result',
          createdAt: '2026-07-07T10:00:00.000Z',
        },
        {
          id: 'asset_video_1',
          type: 'video',
          path: 'workspace/outputs/asset_video_1.mp4',
          prompt: 'video result',
          createdAt: '2026-07-07T11:00:00.000Z',
        },
      ]}
    />,
  )

  assert.equal(html.includes('/api/assets/asset_video_1/file'), true)
  assert.equal(html.includes('/api/assets/asset_image_1/file'), false)
  assert.equal(html.includes('video result'), true)
  assert.equal(html.includes('image result'), false)
})

test('generation history shows generated image and video assets only', async () => {
  const { AssetLibraryModal } = await import(
    '../src/components/AssetLibraryModal'
  )

  const html = renderToStaticMarkup(
    <AssetLibraryModal
      open={true}
      mode="history"
      onClose={() => undefined}
      initialAssets={[
        {
          id: 'asset_imported',
          type: 'image',
          path: 'workspace/outputs/imported.png',
          createdAt: '2026-07-07T09:00:00.000Z',
        },
        {
          id: 'asset_generated_image',
          type: 'image',
          path: 'workspace/outputs/generated.png',
          prompt: 'generated still',
          provider: 'codex',
          createdAt: '2026-07-07T10:00:00.000Z',
        },
        {
          id: 'asset_generated_video',
          type: 'video',
          path: 'workspace/outputs/generated.mp4',
          prompt: 'generated motion',
          provider: 'dreamina',
          createdAt: '2026-07-07T11:00:00.000Z',
        },
      ]}
    />,
  )

  assert.equal(html.includes('历史记录'), true)
  assert.equal(html.includes('aria-label="搜索历史记录"'), true)
  assert.equal(html.includes('/api/assets/asset_generated_image/file'), true)
  assert.equal(html.includes('/api/assets/asset_generated_video/file'), true)
  assert.equal(html.includes('/api/assets/asset_imported/file'), false)
})
