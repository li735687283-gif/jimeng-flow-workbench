import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('image and video editor prompt changes persist to node data immediately', () => {
  const imageNode = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const videoNode = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')

  for (const source of [imageNode, videoNode]) {
    assert.match(source, /const persistPromptDraft = useCallback/)
    assert.match(source, /updateNodeData\(id,\s*\{[\s\S]*prompt:\s*value/)
    assert.match(source, /useFlowStore\.getState\(\)\.saveCurrent\(\)/)
    assert.match(source, /on(?:Prompt)?Change=\{persistPromptDraft\}/)
  }
})
