import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('video player opens as one shared full-viewport shell with controls outside the media', async () => {
  const modal = await readFile(
    new URL('../src/components/VideoPlayerModal.tsx', import.meta.url),
    'utf8',
  )
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const store = await readFile(
    new URL('../src/state/videoPlayerStore.ts', import.meta.url),
    'utf8',
  )
  const videoNode = await readFile(
    new URL('../src/nodes/VideoNode.tsx', import.meta.url),
    'utf8',
  )
  const actionCard = await readFile(
    new URL('../src/components/VideoActionCard.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

  // 单层全视口播放器：不再先开小窗，也不调用浏览器 Fullscreen API。
  assert.match(modal, /video-player-overlay/)
  assert.match(modal, /video-player-container/)
  assert.match(modal, /data-player-mode="fullscreen"/)
  assert.match(modal, /aria-label="视频播放器"/)
  assert.doesNotMatch(modal, /windowed/)
  assert.doesNotMatch(modal, /toggleFullscreen/)
  assert.doesNotMatch(modal, /requestFullscreen/)
  assert.match(modal, /Minimize2/)
  assert.match(modal, /closeModal/)

  // 顶栏、视频舞台、控制栏是三个兄弟区域，不覆盖视频画面。
  const headerIndex = modal.indexOf('className="video-player-top-bar')
  const stageIndex = modal.indexOf('className="video-player-stage"')
  const controlsIndex = modal.indexOf('className="video-player-controls')
  assert.ok(headerIndex >= 0)
  assert.ok(stageIndex > headerIndex)
  assert.ok(controlsIndex > stageIndex)
  assert.match(
    css,
    /\.video-player-container\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
  )
  assert.match(
    css,
    /\.video-player-stage\s*\{[^}]*flex:\s*1\s+1\s+auto;[^}]*min-height:\s*0;/s,
  )
  assert.match(css, /\.video-player-top-bar\s*\{[^}]*position:\s*relative;/s)
  assert.match(css, /\.video-player-controls\s*\{[^}]*position:\s*relative;/s)

  // 当前帧截取位于底部外置控制栏，播放器把 video 元素交给画布节点处理。
  assert.match(modal, /onCaptureFrame/)
  assert.match(modal, /截取当前帧/)
  assert.match(modal, /onCaptureFrame\(video\)/)
  assert.ok(modal.lastIndexOf('截取当前帧') > controlsIndex)
  assert.match(videoNode, /captureCurrentVideoFrame/)
  assert.match(videoNode, /createCapturedFrameNode/)
  const openHandler = videoNode.slice(
    videoNode.indexOf('const handleOpenFullSize'),
    videoNode.indexOf('const persistPromptDraft'),
  )
  assert.match(openHandler, /openVideoPlayer\(/)
  assert.match(openHandler, /handleCaptureFrame/)
  assert.match(app, /onCaptureFrame=\{videoPlayer\?\.onCaptureFrame\}/)
  assert.match(store, /onCaptureFrame\?/)

  // 播放速度入口彻底移除。
  assert.doesNotMatch(modal, /PLAYBACK_RATES|playbackRate|播放速度|video-player-speed/)
  assert.doesNotMatch(css, /\.video-player-speed/)

  // 首页 + 画布只共用 App 层的一个播放器实例。
  assert.match(app, /<VideoPlayerModal/)
  assert.match(videoNode, /useVideoPlayerStore/)
  assert.match(videoNode, /openVideoPlayer/)
  assert.doesNotMatch(videoNode, /createPortal/)
  assert.doesNotMatch(videoNode, /<VideoPlayerModal/)
  assert.doesNotMatch(videoNode, /playerOpen/)

  // 双击节点 + 工具条放大 都直接打开全视口播放器。
  assert.match(videoNode, /onOpenFullSize=\{\(\) => handleOpenFullSize\(\)\}/)
  assert.match(videoNode, /onDoubleClick=\{\(event\) => handleOpenFullSize\(event\)\}/)
  assert.match(videoNode, /controlsList="nofullscreen/)
  assert.match(videoNode, /dblclick/)
  assert.match(videoNode, /exitNativeVideoFullscreen/)
  assert.doesNotMatch(videoNode, /requestFullscreen/)

  // 节点原生三点菜单隐藏；放大按钮不受其他任务 busy 状态禁用。
  assert.match(css, /video::-webkit-media-controls-overflow-button/)
  const maximizeLabelIndex = actionCard.indexOf('aria-label="放大查看视频"')
  const maximizeButtonStart = actionCard.lastIndexOf('<button', maximizeLabelIndex)
  const maximizeButtonEnd = actionCard.indexOf('</button>', maximizeLabelIndex)
  const maximizeButton = actionCard.slice(maximizeButtonStart, maximizeButtonEnd)
  assert.ok(maximizeLabelIndex >= 0)
  assert.doesNotMatch(maximizeButton, /disabled=/)
})