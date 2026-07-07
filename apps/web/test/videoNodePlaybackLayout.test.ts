import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('video node playback keeps audio enabled and history inside editor panel', () => {
  const nodeSource = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')
  const panelSource = readFileSync(
    'apps/web/src/components/VideoGenerationPanel.tsx',
    'utf8',
  )
  const css = readFileSync('apps/web/src/App.css', 'utf8')

  const videoTagIndex = nodeSource.indexOf('<video')
  const videoCloseIndex = nodeSource.indexOf('/>', videoTagIndex)
  const mainVideoMarkup = nodeSource.slice(videoTagIndex, videoCloseIndex)

  assert.equal(/\n\s+muted\s*(\n|$)/.test(mainVideoMarkup), false)
  assert.equal(mainVideoMarkup.includes('muted={videoMuted}'), true)
  assert.equal(nodeSource.includes('Volume2'), true)
  assert.equal(nodeSource.includes('VolumeX'), true)
  assert.equal(nodeSource.includes('videoMuted'), true)
  assert.equal(nodeSource.includes('handleToggleVideoMute'), true)
  assert.equal(nodeSource.includes('aria-label={videoMuted ? \'取消静音\' : \'静音\'}'), true)
  assert.equal(css.includes('.video-sound-toggle'), true)
  assert.equal(nodeSource.includes('className="video-media-stack"'), false)
  assert.equal(panelSource.includes('<VideoGenerationHistoryStrip'), true)
  assert.match(
    nodeSource,
    /<VideoGenerationPanel[\s\S]*historyItems=\{generationHistoryItems\}/,
  )
  assert.match(css, /\.video-generation-history\s*\{[^}]*margin-top:\s*14px;/s)
  assert.match(css, /\.video-generation-history-item\s*\{[^}]*overflow:\s*visible;/s)
})
