import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('text-node API has a bounded request timeout and clears its timer', async () => {
  const source = await readFile(
    new URL('../src/api/llm.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /TEXT_NODE_REQUEST_TIMEOUT_MS/)
  assert.match(source, /TEXT_NODE_REQUEST_TIMEOUT_MS\s*=\s*310_000/)
  assert.match(source, /new AbortController\(\)/)
  assert.match(source, /signal:\s*controller\.signal/)
  assert.match(source, /文本生成等待超时，请检查模型连接后重试/)
  assert.match(source, /finally\s*\{[\s\S]{0,120}clearTimeout\(timer\)/)
})
