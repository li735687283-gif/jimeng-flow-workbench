import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('video generation panel mirrors the image editor controls with video models', async () => {
  const { VideoGenerationPanel } = await import('../src/components/VideoGenerationPanel')

  const html = renderToStaticMarkup(
    <VideoGenerationPanel
      closing={false}
      prompt="cinematic rain street"
      referenceAssetIds={['asset_ref_a', 'asset_ref_b']}
      modelOptions={[
        { id: 'seedance-2.0', label: 'Seedance 2.0' },
        { id: 'veo3-fast', label: 'Veo 3 Fast' },
      ]}
      selectedModelId="veo3-fast"
      modelMenuOpen={true}
      qualityMenuOpen={true}
      countMenuOpen={false}
      aspectRatio="16:9"
      resolution="720P"
      durationSeconds={5}
      count={1}
      running={false}
      submitLabel="生成"
      sendError=""
      onPromptChange={() => undefined}
      onModelToggle={() => undefined}
      onSelectModel={() => undefined}
      onQualityToggle={() => undefined}
      onAspectRatioChange={() => undefined}
      onResolutionChange={() => undefined}
      onDurationChange={() => undefined}
      onCountToggle={() => undefined}
      onCountChange={() => undefined}
      onSend={() => undefined}
    />,
  )

  assert.equal(html.includes('image-editor-panel'), true)
  assert.equal(html.includes('video-generation-panel'), true)
  assert.equal(html.includes('cinematic rain street'), true)
  assert.equal(html.includes('Veo 3 Fast'), true)
  assert.equal(html.includes('Seedance 2.0'), true)
  assert.equal(html.includes('16:9 · 720P · 5s'), true)
  assert.equal(html.includes('1条'), true)
  assert.equal(html.includes('aria-label="发送生成视频"'), true)
  assert.equal(html.includes('reference-asset-strip'), true)
  assert.equal(html.includes('/api/assets/asset_ref_a/file'), true)
  assert.equal(html.includes('video-duration-slider'), true)
  assert.equal(html.includes('aria-label="视频时长"'), true)
  assert.equal(html.includes('type="range"'), true)
  assert.equal(html.includes('min="1"'), true)
  assert.equal(html.includes('max="15"'), true)
  assert.equal(html.includes('<strong>5s</strong>'), true)
  assert.equal(html.includes('>1s</span>'), true)
  assert.equal(html.includes('>15s</span>'), true)
  assert.equal(html.includes('video-duration-grid'), false)
  assert.equal(html.includes('image-editor-tool'), false)
  assert.equal(html.includes('<span>视频</span>'), false)
  assert.equal(html.includes('<span>生成</span>'), false)
})
