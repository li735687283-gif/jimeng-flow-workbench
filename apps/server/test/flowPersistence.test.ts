import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-flow-persistence-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { createFlow, getFlow, updateFlow } = await import('../src/services/flows')

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

function generatedNode(id: string, assetId: string) {
  return {
    id,
    type: 'image',
    position: { x: 0, y: 0 },
    data: {
      title: id,
      status: 'success' as const,
      assetId,
      updatedAt: new Date().toISOString(),
    },
  }
}

test('concurrent flow updates preserve generated nodes from both writers', async () => {
  const flow = await createFlow('concurrent updates')
  await Promise.all([
    updateFlow(flow.id, { nodes: [generatedNode('image-a', 'asset-a')] }),
    updateFlow(flow.id, { nodes: [generatedNode('image-b', 'asset-b')] }),
  ])

  const saved = await getFlow(flow.id)
  assert.deepEqual(
    saved.nodes.map((node) => node.id).sort(),
    ['image-a', 'image-b'],
  )
  const raw = await readFile(join(workspaceDir, 'flows', flow.id + '.json'), 'utf8')
  assert.doesNotThrow(() => JSON.parse(raw))
})
