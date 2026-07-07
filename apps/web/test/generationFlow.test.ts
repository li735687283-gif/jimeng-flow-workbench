import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveGenerationFlowId } from '../src/utils/generationFlow'

const testDir = dirname(fileURLToPath(import.meta.url))

test('resolveGenerationFlowId uses the current persisted flow when available', () => {
  assert.equal(resolveGenerationFlowId('flow_123'), 'flow_123')
  assert.equal(resolveGenerationFlowId('  flow_abc  '), 'flow_abc')
})

test('resolveGenerationFlowId falls back to local only when no flow is available', () => {
  assert.equal(resolveGenerationFlowId(null), 'local')
  assert.equal(resolveGenerationFlowId(undefined), 'local')
  assert.equal(resolveGenerationFlowId('   '), 'local')
})

test('generation entrypoints do not hard-code local flow ids', () => {
  const files = [
    'src/components/AgentPanel.tsx',
    'src/components/GenerateComposer.tsx',
    'src/components/VideoComposer.tsx',
  ]

  for (const file of files) {
    const source = readFileSync(resolve(testDir, '..', file), 'utf8')
    assert.doesNotMatch(source, /flowId:\s*['"]local['"]/)
  }
})
