import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('image generation ensures a current flow before starting', () => {
  const imageNode = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const flowStore = readFileSync('apps/web/src/state/flowStore.ts', 'utf8')

  assert.match(flowStore, /ensureCurrentFlow:\s*\(\)\s*=>\s*Promise<string>/)
  assert.match(flowStore, /flowsApi\.createFlow\(/)
  assert.match(flowStore, /flowsApi\.updateFlow\(flow\.id,\s*\{[\s\S]*nodes[\s\S]*edges/)
  assert.match(imageNode, /await useFlowStore\.getState\(\)\.ensureCurrentFlow\(\)/)
  assert.doesNotMatch(imageNode, /setSendError\('工作流还在加载，请稍后再生成'\)/)
})
