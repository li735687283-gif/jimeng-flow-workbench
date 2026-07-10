import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('video player uses two-level open: windowed first, fullscreen only on toggle', async () => {
  const modal = await readFile(
    new URL('../src/components/VideoPlayerModal.tsx', import.meta.url),
    'utf8',
  )
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const videoNode = await readFile(
    new URL('../src/nodes/VideoNode.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

  // 一级：小播放器弹层
  assert.match(modal, /video-player-overlay/)
  assert.match(modal, /video-player-container/)
  assert.match(modal, /data-player-mode/)
  assert.match(modal, /windowed/)
  assert.match(modal, /视频小播放器/)
  assert.match(modal, /setIsFullscreen\(false\)/)
  // 打开时不得 requestFullscreen
  assert.doesNotMatch(
    modal,
    /useEffect\(\(\) => \{[\s\S]*requestFullscreen[\s\S]*\}, \[open/,
  )

  // 二级：仅 toggleFullscreen 进入应用内全屏（不自动 requestFullscreen）
  assert.match(modal, /toggleFullscreen/)
  assert.match(modal, /setIsFullscreen\(\(prev\) => !prev\)/)
  assert.match(modal, /onClick=\{toggleFullscreen\}/)
  assert.match(modal, /Minimize2/)
  // 打开时强制 windowed
  assert.match(modal, /强制非全屏打开|绝不全屏打开/)

  // 关闭路径
  assert.match(modal, /closeModal/)

  // 首页 + 画布共用
  assert.match(app, /<VideoPlayerModal/)
  assert.match(videoNode, /createPortal/)
  assert.match(videoNode, /VideoPlayerModal/)
  assert.match(videoNode, /playerOpen/)
  assert.match(videoNode, /setPlayerOpen\(true\)/)
  // 双击节点 + 工具条放大 都打开一级播放器
  assert.match(videoNode, /onOpenFullSize=\{\(\) => handleOpenFullSize\(\)\}/)
  assert.match(videoNode, /onDoubleClick=\{\(event\) => handleOpenFullSize\(event\)\}/)
  assert.match(videoNode, /controlsList="nofullscreen/)
  assert.match(videoNode, /dblclick/)
  assert.match(videoNode, /exitNativeVideoFullscreen/)
  // 节点侧不得直接 requestFullscreen
  assert.doesNotMatch(videoNode, /requestFullscreen/)

  // CSS：约 8/9 视口的小播放器（2/3 再大 1/3）+ 全屏态
  assert.match(css, /\.video-player-overlay/)
  assert.match(css, /88\.889vw|8\/9/)
  assert.match(css, /\.video-player-container\.is-fullscreen/)
  assert.match(css, /:fullscreen/)
})
