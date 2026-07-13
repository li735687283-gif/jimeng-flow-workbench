import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('text image and video nodes share a selected highlight ring', () => {
  const textNode = readFileSync('apps/web/src/nodes/TextNode.tsx', 'utf8')
  const imageNode = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const videoNode = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')
  const wrapper = readFileSync('apps/web/src/nodes/NodeWrapper.tsx', 'utf8')
  const css = readFileSync('apps/web/src/App.css', 'utf8')

  assert.match(textNode, /<NodeWrapper[\s\S]*selected=\{selected\}/)
  assert.match(imageNode, /<NodeWrapper[\s\S]*selected=\{selected\}/)
  assert.match(videoNode, /<NodeWrapper[\s\S]*selected=\{selected\}/)
  assert.match(wrapper, /selected \? ' selected' : ''/)
  assert.match(css, /\.node-wrapper\.selected\s+\.node-card::after\s*\{/)
  assert.match(css, /inset:\s*0;/)
  assert.match(css, /box-sizing:\s*border-box;/)
  assert.match(css, /border-radius:\s*inherit;/)
  assert.match(css, /pointer-events:\s*none;/)
  assert.match(
    css,
    /\.node-wrapper:has\(\.image-editor-panel\)\s+\.node-card::after(?:,\s*\.node-wrapper:has\(\.text-editor-panel\)\s+\.node-card::after)?\s*\{[\s\S]*z-index:\s*0;/,
  )
  assert.match(css, /\.video-generation-panel/)
  assert.equal(css.includes('inset: -5px;'), false)
  assert.equal(css.includes('border-radius: calc(15px + 5px);'), false)
  assert.equal(
    /\.node-wrapper\.media-display\.selected\s+\.node-card,[\s\S]*border-color:\s*transparent;/.test(css),
    false,
  )
})
