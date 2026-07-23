import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-flow-normalize-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { getFlow, updateFlow } = await import('../src/services/flows')
const { applyImageGenerationResultToFlow } = await import(
  '../src/services/generations'
)

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

async function writeRawFlow(id: string, value: Record<string, unknown>) {
  const flowsDir = join(workspaceDir, 'flows')
  await mkdir(flowsDir, { recursive: true })
  await writeFile(join(flowsDir, `${id}.json`), JSON.stringify(value), 'utf8')
}

function baseFlow(id: string): Record<string, unknown> {
  return {
    id,
    name: 'legacy flow',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

const generationPatch = {
  nodeId: 'image-recovered',
  generationId: 'gen-recovered',
  prompt: 'recover generation state',
  model: 'gpt-image-1',
  width: 1024,
  height: 1024,
  count: 1,
  assetIds: [],
  status: 'error' as const,
  error: 'provider unavailable',
  updatedAt: '2026-07-22T00:00:00.000Z',
}

test('missing nodes or edges normalize to arrays and generation writeback succeeds', async () => {
  for (const [id, raw] of [
    ['flow_missing_nodes', { ...baseFlow('flow_missing_nodes'), edges: [] }],
    ['flow_missing_edges', { ...baseFlow('flow_missing_edges'), nodes: [] }],
  ] as const) {
    await writeRawFlow(id, raw)
    const flow = await getFlow(id)
    assert.deepEqual(flow.nodes, [])
    assert.deepEqual(flow.edges, [])

    const patched = applyImageGenerationResultToFlow(flow, generationPatch)
    await updateFlow(id, { nodes: patched.nodes })
    const saved = await getFlow(id)
    assert.equal(saved.nodes[0]?.id, 'image-recovered')
    assert.equal(saved.nodes[0]?.data.status, 'error')
    assert.deepEqual(saved.edges, [])
  }
})

test('non-array nodes report a clear corrupt-flow error on load and writeback', async () => {
  const id = 'flow_invalid_nodes'
  await writeRawFlow(id, {
    ...baseFlow(id),
    nodes: { bad: true },
    edges: [],
  })

  for (const operation of [
    () => getFlow(id),
    () => updateFlow(id, { edges: [] }),
  ]) {
    await assert.rejects(
      operation,
      (err: unknown) => {
        const error = err as Error & { code?: string }
        return error.code === 'FLOW_CORRUPT' && /nodes|损坏/.test(error.message)
      },
    )
  }
})
