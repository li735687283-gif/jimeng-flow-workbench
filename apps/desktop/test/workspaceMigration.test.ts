import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { migrateWorkspace } from '../src/workspaceMigration'

test('workspace migration copies legacy config, flows, and outputs once', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'mok-workspace-migration-'))
  const legacy = join(root, 'legacy')
  const target = join(root, 'user-data', 'workspace')
  await mkdir(join(legacy, 'config'), { recursive: true })
  await mkdir(join(legacy, 'flows'), { recursive: true })
  await mkdir(join(legacy, 'outputs'), { recursive: true })
  await writeFile(join(legacy, 'config', 'settings.json'), '{"model":"test"}')
  await writeFile(join(legacy, 'flows', 'flow_test.json'), '{"id":"flow_test"}')
  await writeFile(join(legacy, 'outputs', 'asset.png'), 'image')
  t.after(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(root, { force: true, recursive: true })
  })

  const result = await migrateWorkspace({
    legacyCandidates: [join(root, 'missing'), legacy],
    targetWorkspace: target,
  })

  assert.equal(result.action, 'migrated')
  assert.equal(await readFile(join(target, 'config', 'settings.json'), 'utf8'), '{"model":"test"}')
  assert.equal(await readFile(join(target, 'flows', 'flow_test.json'), 'utf8'), '{"id":"flow_test"}')
  assert.equal(await readFile(join(target, 'outputs', 'asset.png'), 'utf8'), 'image')
})

test('workspace migration never overwrites an existing user data directory', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'mok-workspace-retain-'))
  const legacy = join(root, 'legacy')
  const target = join(root, 'target')
  await mkdir(legacy, { recursive: true })
  await mkdir(target, { recursive: true })
  await writeFile(join(legacy, 'value.txt'), 'legacy')
  await writeFile(join(target, 'value.txt'), 'current')
  t.after(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(root, { force: true, recursive: true })
  })

  const result = await migrateWorkspace({
    legacyCandidates: [legacy],
    targetWorkspace: target,
  })

  assert.equal(result.action, 'retained')
  assert.equal(await readFile(join(target, 'value.txt'), 'utf8'), 'current')
})
