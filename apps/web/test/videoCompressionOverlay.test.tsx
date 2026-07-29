import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('video compression overlay renders the reference layout and lower targets', async () => {
  const { VideoCompressionOverlay } = await import(
    '../src/components/VideoCompressionOverlay'
  )
  const html = renderToStaticMarkup(
    <VideoCompressionOverlay
      open={true}
      videoUrl="/api/assets/video-1/file"
      sourceWidth={1280}
      sourceHeight={720}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )

  assert.equal(html.includes('视频压缩'), true)
  assert.equal(html.includes('/api/assets/video-1/file'), true)
  assert.equal(html.includes('源分辨率'), true)
  assert.equal(html.includes('1280 × 720'), true)
  assert.equal(html.includes('目标分辨率'), true)
  assert.equal(html.includes('480P'), true)
  assert.equal(html.includes('360P'), true)
  assert.equal(html.includes('854 × 480'), true)
  assert.equal(html.includes('输出'), true)
  assert.equal(html.includes('确认压缩'), true)
  assert.equal(html.includes('取消'), true)
  assert.match(html, /video-compression-option active/)
  assert.match(html, /role="dialog"[^>]*aria-label="视频压缩"/)
})

test('video compression overlay only offers targets below the source height', async () => {
  const { VideoCompressionOverlay } = await import(
    '../src/components/VideoCompressionOverlay'
  )
  const html = renderToStaticMarkup(
    <VideoCompressionOverlay
      open={true}
      videoUrl="/video.mp4"
      sourceWidth={854}
      sourceHeight={480}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )

  assert.equal(html.includes('360P'), true)
  assert.equal(html.includes('480P'), false)
  assert.equal(html.includes('640 × 360'), true)
})

test('video compression overlay disables confirmation when no lower target exists', async () => {
  const { VideoCompressionOverlay } = await import(
    '../src/components/VideoCompressionOverlay'
  )
  const html = renderToStaticMarkup(
    <VideoCompressionOverlay
      open={true}
      videoUrl="/video.mp4"
      sourceWidth={640}
      sourceHeight={360}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )

  assert.equal(html.includes('当前视频已不高于 360P'), true)
  assert.match(html, /disabled=""[^>]*>确认压缩</)
})
