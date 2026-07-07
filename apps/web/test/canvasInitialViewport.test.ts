import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('app recenters restored flows once after refresh', () => {
  const source = readFileSync(resolve('apps/web/src/App.tsx'), 'utf8')

  assert.equal(
    source.includes("import { useFlowStore } from './state/flowStore'"),
    true,
  )
  assert.equal(
    source.includes('const currentFlowId = useFlowStore((s) => s.currentFlowId)'),
    true,
  )
  assert.equal(source.includes('centeredFlowIdRef'), true)
  assert.equal(
    source.includes('centeredFlowIdRef.current === currentFlowId'),
    true,
  )
  assert.equal(source.includes('duration: 0'), true)
  assert.equal(source.includes('maxZoom: 1'), true)
})
