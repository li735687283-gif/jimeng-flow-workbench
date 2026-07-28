import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  runSerializedFileOperation,
  writeJsonAtomic,
} from '../src/services/jsonFilePersistence'

test('writeJsonAtomic leaves a complete JSON file and no temporary sibling', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mok-json-atomic-'))
  const file = join(dir, 'state.json')
  try {
    await writeJsonAtomic(file, { version: 1, items: ['a', 'b'] })

    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
      version: 1,
      items: ['a', 'b'],
    })
    assert.deepEqual(await readdir(dir), ['state.json'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('runSerializedFileOperation serializes one file without blocking another file', async () => {
  const events: string[] = []
  let releaseFirst: () => void = () => undefined
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })

  const first = runSerializedFileOperation('flow-a.json', async () => {
    events.push('a1:start')
    await firstGate
    events.push('a1:end')
  })
  const second = runSerializedFileOperation('flow-a.json', async () => {
    events.push('a2')
  })
  const otherFile = runSerializedFileOperation('flow-b.json', async () => {
    events.push('b1')
  })

  await otherFile
  assert.deepEqual(events, ['a1:start', 'b1'])
  releaseFirst()
  await Promise.all([first, second])
  assert.deepEqual(events, ['a1:start', 'b1', 'a1:end', 'a2'])
})

test('a failed serialized operation does not poison later writes', async () => {
  await assert.rejects(
    runSerializedFileOperation('recover.json', async () => {
      throw new Error('write failed')
    }),
    /write failed/,
  )
  const result = await runSerializedFileOperation('recover.json', async () => 'ok')
  assert.equal(result, 'ok')
})
