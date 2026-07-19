import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

interface CssRule {
  selectors: string[]
  declarations: string
}

function getCssRules(css: string): CssRule[] {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selectors: match[1].split(',').map((selector) => selector.trim()),
    declarations: match[2],
  }))
}

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
  const selectedRingRule = getCssRules(css).find((rule) =>
    rule.selectors.some((selector) =>
      selector.startsWith('.node-wrapper.selected') &&
      selector.endsWith('.node-card::after'),
    ),
  )
  assert.ok(selectedRingRule, 'selected nodes must render a shared highlight ring')
  assert.equal(
    selectedRingRule.selectors.some((selector) => selector.includes(':not(.media-display)')),
    false,
    'media nodes must not be excluded from the shared selected highlight ring',
  )
  assert.match(selectedRingRule.declarations, /inset:\s*0;/)
  assert.match(selectedRingRule.declarations, /box-sizing:\s*border-box;/)
  assert.match(selectedRingRule.declarations, /border-radius:\s*inherit;/)
  assert.match(selectedRingRule.declarations, /pointer-events:\s*none;/)
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

test('canvas nodes use a 28 pixel corner radius', () => {
  const css = readFileSync('apps/web/src/App.css', 'utf8')
  const imageNode = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const videoNode = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')

  assert.match(css, /\.node-card\s*\{[^}]*border-radius:\s*28px;/)
  assert.match(
    css,
    /\.node-wrapper\.media-display \.node-card,[\s\S]*?border-radius:\s*28px;/,
  )
  assert.match(
    css,
    /\.image-node-container\s*\{[^}]*border-radius:\s*28px;/,
  )
  assert.match(
    css,
    /\.image-editor-panel\s*\{[^}]*border-radius:\s*28px;/,
  )
  assert.match(imageNode, /const MEDIA_DISPLAY_STYLE:[\s\S]*?borderRadius:\s*28,/)
  assert.match(videoNode, /const VIDEO_DISPLAY_STYLE:[\s\S]*?borderRadius:\s*28,/)
})
