import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { VideoTrimOverlay } from '../src/components/VideoTrimOverlay'

Object.assign(globalThis, { React })

test('video trim overlay exposes the reference-style controls and limits', () => {
  const html = renderToStaticMarkup(
    <VideoTrimOverlay
      open
      videoUrl="/api/assets/video/file"
      sourceWidth={1280}
      sourceHeight={720}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )

  assert.match(html, /role="dialog"[^>]*aria-label="长度裁切"/)
  assert.equal(html.includes('限 0:01.0 ~ 0:04.0'), true)
  assert.equal(html.includes('入点'), true)
  assert.equal(html.includes('出点'), true)
  assert.equal(html.includes('裁切后保持原分辨率'), true)
  assert.equal(html.includes('确认裁切'), true)
  assert.equal(html.includes('视频裁切时间轴'), true)
})

test('video trim overlay renders nothing while closed', () => {
  const html = renderToStaticMarkup(
    <VideoTrimOverlay
      open={false}
      videoUrl="/api/assets/video/file"
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )
  assert.equal(html, '')
})
