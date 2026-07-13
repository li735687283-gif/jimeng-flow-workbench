import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('text-node run route supports inputImages and default reverse prompt', () => {
  const route = readFileSync('apps/server/src/routes/llm.ts', 'utf8')
  const llm = readFileSync('apps/server/src/services/llm/index.ts', 'utf8')
  const shared = readFileSync('packages/shared/src/textNode.ts', 'utf8')

  assert.match(shared, /DEFAULT_IMAGE_REVERSE_PROMPT/)
  assert.match(shared, /TEXT_NODE_SYSTEM_PROMPT/)
  assert.match(shared, /禁止输出任何客套/)
  assert.match(shared, /inputImages\?:/)
  assert.match(route, /resolveAssetImageDataUrls/)
  assert.match(route, /DEFAULT_IMAGE_REVERSE_PROMPT/)
  assert.match(route, /body\.inputImages/)
  assert.match(llm, /image_url/)
  assert.match(llm, /imageDataUrls/)
  assert.match(llm, /OpenAiContentPart/)
  assert.match(llm, /TEXT_NODE_SYSTEM_PROMPT/)
  assert.match(llm, /role: 'system'/)
})
