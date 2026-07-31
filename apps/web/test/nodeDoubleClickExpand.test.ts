import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('text, image, and video nodes reuse their expanded viewers on double click', async () => {
  const [textNode, imageNode, videoNode] = await Promise.all([
    readFile(new URL('../src/nodes/TextNode.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/nodes/ImageNode.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/nodes/VideoNode.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(textNode, /onDoubleClick=\{handleNodeDoubleClick\}/)
  assert.match(
    textNode,
    /const handleEnterBodyEdit = useCallback\(\(\) => \{[\s\S]*?setContentExpanded\(true\)/,
  )
  assert.match(textNode, /\{contentExpanded[\s\S]*?prompt-editor-modal-backdrop/)

  assert.match(
    imageNode,
    /className="media-display-node image-media-display"[\s\S]{0,220}onDoubleClick=\{handleMediaDoubleClick\}/,
  )
  assert.match(
    imageNode,
    /const handleMediaDoubleClick = useCallback\([\s\S]*?handleOpenFullSize\(\)/,
  )
  assert.match(imageNode, /<ImageFullscreenViewer/)

  assert.match(
    videoNode,
    /className="media-display-node video-media-display"[\s\S]{0,220}onDoubleClick=\{\(event\) => handleOpenFullSize\(event\)\}/,
  )
  assert.match(videoNode, /useVideoPlayerStore/)
  assert.match(videoNode, /openVideoPlayer\(/)
  assert.doesNotMatch(videoNode, /<VideoPlayerModal/)
})
