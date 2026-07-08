import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('selecting an image model immediately persists it as the next node default', () => {
  const source = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')

  assert.match(source, /const persistSelectedImageModel = useCallback/)
  assert.match(source, /const nextDefaults = \{[\s\S]*model:\s*modelId/)
  assert.match(source, /rememberImageDefaults\(nextDefaults\)/)
  assert.match(source, /updateNodeData\(id,\s*\{[\s\S]*model:\s*modelId/)
  assert.match(source, /persistSelectedImageModel\(model\.id\)/)
})
