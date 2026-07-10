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

test('video node body is not marked nodrag so the node can be dragged', () => {
  const nodeSource = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')

  // 空节点与有视频预览的主容器都不应整块 nodrag（否则拖不动）
  assert.equal(
    /className="media-display-node video-media-display[^"]*nodrag/.test(nodeSource),
    false,
  )
  assert.equal(
    /className="image-node-container video-node-container[^"]*nodrag/.test(nodeSource),
    false,
  )
  // 编辑面板仍可 nodrag，避免拖动画布时误拖节点
  assert.match(nodeSource, /VideoGenerationPanel/)
})
