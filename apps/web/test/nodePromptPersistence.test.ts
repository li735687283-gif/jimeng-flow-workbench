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

test('text node body edit persists content; prompt box persists input separately', () => {
  const textNode = readFileSync('apps/web/src/nodes/TextNode.tsx', 'utf8')

  // 双击编辑节点正文 → content
  assert.match(textNode, /const persistBodyDraft = useCallback/)
  assert.match(textNode, /value=\{bodyDraft\}/)
  assert.match(textNode, /onChange=\{\(event\) => persistBodyDraft/)
  assert.match(
    textNode,
    /const persistBodyDraft = useCallback\(\s*\(value: string\) => \{[^]*?content:\s*value[^]*?\[id, updateNodeData\],\s*\)/,
  )

  // 下方提示词框 → input，不写 content
  assert.match(textNode, /const persistPromptDraft = useCallback/)
  assert.match(textNode, /onChange=\{persistPromptDraft\}/)
  assert.match(textNode, /useFlowStore\.getState\(\)\.saveCurrent\(\)/)
  assert.match(
    textNode,
    /const persistPromptDraft = useCallback\(\s*\(value: string\) => \{[^]*?input:\s*value[^]*?\[id, sendError, updateNodeData\],\s*\)/,
  )
  // prompt 回调里不应同时写 content: value
  const promptStart = textNode.indexOf('const persistPromptDraft = useCallback')
  const bodyStart = textNode.indexOf('const persistBodyDraft = useCallback')
  assert.ok(promptStart >= 0 && bodyStart > promptStart)
  const promptBlock = textNode.slice(promptStart, bodyStart)
  assert.match(promptBlock, /input:\s*value/)
  assert.equal(promptBlock.includes('content: value'), false)
})
