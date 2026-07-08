import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('image and video editor menus close when clicking back on node chrome', () => {
  const imageNode = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const videoNode = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')

  for (const source of [imageNode, videoNode]) {
    assert.match(source, /shouldCloseFloatingMenuOnPointerDown/)
    assert.match(source, /target\.closest\('\.image-editor-menu-anchor'\)/)
    assert.match(source, /setModelMenuOpen\(false\)/)
    assert.match(source, /setQualityMenuOpen\(false\)/)
    assert.match(source, /setCountMenuOpen\(false\)/)
  }
})
