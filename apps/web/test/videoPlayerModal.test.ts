import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('video player modal uses homepage-style black player chrome', async () => {
  const source = await readFile(
    new URL('../src/components/VideoPlayerModal.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

  assert.match(source, /video-player-overlay/)
  assert.match(source, /video-player-container/)
  assert.match(source, /video-player-video/)
  assert.match(source, /video-player-top-bar/)
  assert.match(source, /video-player-controls/)
  assert.match(source, /ArrowLeft/)
  // 必须始终可返回画布
  assert.match(source, /video-player-close-fixed/)
  assert.match(source, /返回画布/)
  assert.match(source, /handleClose/)
  assert.match(source, /onClick=\{handleClose\}/)
  assert.equal(source.includes('image-fullscreen-viewer'), false)

  assert.match(css, /\.video-player-overlay\s*\{[^}]*background:\s*#000/)
  assert.match(css, /\.video-player-close-fixed/)
  assert.match(css, /\.video-player-container\s*\{/)
})

test('canvas video node opens the same global player as homepage', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const videoNode = await readFile(
    new URL('../src/nodes/VideoNode.tsx', import.meta.url),
    'utf8',
  )
  const store = await readFile(
    new URL('../src/state/videoPlayerStore.ts', import.meta.url),
    'utf8',
  )

  assert.match(store, /useVideoPlayerStore/)
  assert.match(store, /openPlayer/)
  assert.match(store, /closePlayer/)

  // App 层挂载唯一播放器（与首页相同）
  assert.match(app, /useVideoPlayerStore/)
  assert.match(app, /<VideoPlayerModal/)
  assert.match(app, /openVideoPlayer/)

  // 画布节点只负责调起全局播放器，不再本地 createPortal
  assert.match(videoNode, /useVideoPlayerStore/)
  assert.match(videoNode, /openVideoPlayer/)
  assert.match(videoNode, /getAssetFileUrl/)
  assert.equal(videoNode.includes('createPortal'), false)
  assert.equal(videoNode.includes('<VideoPlayerModal'), false)
  assert.equal(videoNode.includes('fullSizeOpen'), false)
})
