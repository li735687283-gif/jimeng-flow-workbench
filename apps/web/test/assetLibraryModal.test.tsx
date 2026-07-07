import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('asset library modal renders the reference shell when open', async () => {
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

  for (const text of [
    '资产库',
    '素材库',
    '画布资产',
    '图片工具',
    '视频工具',
    '全部分类',
    '全部',
    '图片',
    '视频',
    '音频',
    '文本',
    '实时预览',
    '批量选择',
    '图片生成',
  ]) {
    assert.equal(html.includes(text), true)
  }

  assert.equal(html.includes('aria-label="关闭素材库"'), true)
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
