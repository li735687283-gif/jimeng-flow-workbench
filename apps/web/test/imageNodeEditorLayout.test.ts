import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('image node editor starts with reference thumbnails like video nodes', async () => {
  const source = await readFile(
    new URL('../src/nodes/ImageNode.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

  assert.equal(source.includes('className="image-editor-tools"'), false)
  assert.equal(source.includes('<span>风格</span>'), false)
  assert.equal(source.includes('<span>标记</span>'), false)
  assert.equal(source.includes('<span>参考</span>'), false)

  const stripIndex = source.indexOf('<ReferenceAssetStrip')
  const promptIndex = source.indexOf('<PromptEditor')

  assert.ok(stripIndex > -1)
  assert.ok(promptIndex > -1)
  assert.ok(stripIndex < promptIndex)
  assert.match(
    css,
    /\.image-editor-panel\s*>\s*\.reference-asset-strip:first-child\s*\{[^}]*margin-top:\s*0;/s,
  )
  assert.match(
    css,
    /\.image-editor-panel\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
  )
  assert.match(css, /\.image-editor-bottom\s*\{[^}]*margin-top:\s*auto;/s)
})
