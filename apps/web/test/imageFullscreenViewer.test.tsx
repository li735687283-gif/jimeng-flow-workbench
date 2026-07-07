import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('image fullscreen viewer exposes gallery controls and clamps zoom range', async () => {
  const {
    ImageFullscreenViewer,
  } = await import('../src/components/ImageFullscreenViewer')
  const {
    clampPreviewScale,
    formatPreviewZoom,
  } = await import('../src/utils/imageFullscreenPreview')

  assert.equal(clampPreviewScale(0.01), 0.05)
  assert.equal(clampPreviewScale(5), 4)
  assert.equal(formatPreviewZoom(0.29), '29%')

  const html = renderToStaticMarkup(
    <ImageFullscreenViewer
      imageSrc="/api/assets/demo/file"
      title="图片节点 1"
      imageInfo="分辨率 1920 x 1080 · 文件大小未知"
      scale={0.29}
      rotation={90}
      offset={{ x: 12, y: -8 }}
      isPanning={true}
      onClose={() => undefined}
      onDownload={() => undefined}
      onRename={() => undefined}
      onReset={() => undefined}
      onRotateClockwise={() => undefined}
      onRotateCounterClockwise={() => undefined}
      onPanStart={() => undefined}
      onPanMove={() => undefined}
      onPanEnd={() => undefined}
      onScaleChange={() => undefined}
      onZoomIn={() => undefined}
      onZoomOut={() => undefined}
      onWheelZoom={() => undefined}
    />,
  )

  for (const ariaLabel of [
    '图片信息',
    '重置预览',
    '下载放大图片',
    '关闭放大预览',
    '顺时针旋转',
    '逆时针旋转',
    '放大图片',
    '缩小图片',
  ]) {
    assert.equal(html.includes(`aria-label="${ariaLabel}"`), true)
  }

  assert.equal(html.includes('aria-label="编辑图片名称"'), true)
  assert.equal(html.includes('value="图片节点 1"'), true)
  assert.equal(html.includes('width:120px'), true)
  assert.equal(html.includes('分辨率 1920 x 1080 · 文件大小未知'), true)
  assert.equal(html.includes('image-fullscreen-stage is-panning'), true)
  assert.equal(html.includes('image-fullscreen-hand'), false)
  assert.equal(html.includes('translate(12px, -8px)'), true)
  assert.equal(html.includes('29%'), true)
  assert.equal(html.includes('aria-valuemin="5"'), true)
  assert.equal(html.includes('aria-valuemax="400"'), true)
})
