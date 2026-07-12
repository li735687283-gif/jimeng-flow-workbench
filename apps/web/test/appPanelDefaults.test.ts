import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('agent starts closed and media history has its own modal state', () => {
  const source = readFileSync(resolve('apps/web/src/App.tsx'), 'utf8')

  assert.equal(source.includes('const [agentOpen, setAgentOpen] = useState(false)'), true)
  assert.equal(source.includes('const [generationHistoryOpen, setGenerationHistoryOpen]'), true)
  assert.equal(source.includes('onOpenHistory={() => setGenerationHistoryOpen(true)}'), true)
  assert.equal(source.includes('mode="history"'), true)
})
