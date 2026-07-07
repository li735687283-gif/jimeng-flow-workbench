import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { VideoGenerationHistoryItem } from '../src/utils/videoGenerationHistory'

Object.assign(globalThis, { React })

test('video generation history strip renders clean selectable video versions', async () => {
  const { VideoGenerationHistoryStrip } = await import(
    '../src/components/VideoGenerationHistoryStrip'
  )
  const items: VideoGenerationHistoryItem[] = [
    {
      assetId: 'asset_video_1',
      assetIndex: 0,
      run: {
        id: 'gen_video_1',
        generationId: 'gen_video_1',
        status: 'success',
        assetIds: ['asset_video_1'],
        prompt: 'first',
        model: 'seedance-2.0',
        mode: 'text_to_video',
        aspectRatio: '16:9',
        resolution: '720P',
        quality: 'standard',
        durationSeconds: 5,
        count: 1,
        generateAudio: true,
        inputImageAssetIds: [],
        createdAt: '2026-07-05T10:00:00.000Z',
      },
    },
    {
      assetId: 'asset_video_2',
      assetIndex: 0,
      run: {
        id: 'gen_video_2',
        generationId: 'gen_video_2',
        status: 'success',
        assetIds: ['asset_video_2'],
        prompt: 'second',
        model: 'seedance-2.0',
        mode: 'image_to_video',
        aspectRatio: '16:9',
        resolution: '720P',
        quality: 'standard',
        durationSeconds: 5,
        count: 1,
        generateAudio: true,
        inputImageAssetIds: ['asset_ref'],
        createdAt: '2026-07-05T11:00:00.000Z',
      },
    },
  ]

  const html = renderToStaticMarkup(
    <VideoGenerationHistoryStrip
      items={items}
      currentAssetId="asset_video_2"
      onSelect={() => undefined}
    />,
  )

  assert.equal(html.includes('历史版本'), true)
  assert.equal(html.includes('/api/assets/asset_video_1/file'), true)
  assert.equal(html.includes('/api/assets/asset_video_2/file'), true)
  assert.equal(html.includes('复用'), false)
  assert.equal(html.includes('重复生成'), false)
  assert.equal(html.match(/<button/g)?.length, 2)
  assert.equal(html.includes('aria-current="true"'), true)
  assert.equal(html.includes('video-generation-history-item current'), true)
  assert.equal(
    html.match(/video-generation-history-preview/g)?.length,
    2,
  )
  assert.equal(html.includes('--history-preview-scale'), true)
})
