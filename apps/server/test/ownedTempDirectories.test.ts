import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GenerationResult } from '@jimeng-flow/shared/generateNode'
import { generateCodexCliImage } from '../src/services/codexImage'
import { generateImageResultsForRequest } from '../src/services/generations'
import {
  cleanupOwnedResultBatch,
  cleanupOwnedTempDirectory,
  createOwnedTempDirectory,
  handoffOwnedTempDirectory,
} from '../src/services/ownedTempDirectories'

async function assertMissing(path: string): Promise<void> {
  await assert.rejects(
    access(path),
    (err: NodeJS.ErrnoException) => err.code === 'ENOENT',
  )
}

test('owned result cleanup removes only the exact registered directory', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'mok-owned-parent-'))
  const sibling = join(parent, 'sibling')
  await mkdir(sibling)
  const owner = await createOwnedTempDirectory(parent, 'generation-')
  const resultPath = join(owner.path, 'result.png')
  await writeFile(resultPath, 'image')
  const results: GenerationResult[] = [{ localPath: resultPath }]

  try {
    assert.equal(handoffOwnedTempDirectory(results, owner), true)
    await cleanupOwnedResultBatch(results)

    await assertMissing(owner.path)
    await access(parent)
    await access(sibling)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test('unregistered external result paths are never used as cleanup roots', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'mok-owned-external-'))
  const external = join(parent, 'external.png')
  await writeFile(external, 'external')
  const owner = await createOwnedTempDirectory(parent, 'generation-')
  const results: GenerationResult[] = [{ localPath: external }]

  try {
    assert.equal(handoffOwnedTempDirectory(results, owner), false)
    await cleanupOwnedResultBatch(results)
    await access(owner.path)
    await access(external)

    await cleanupOwnedTempDirectory(owner)
    await assertMissing(owner.path)
    await access(external)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test('image batch cleanup waits for every save attempt and runs after partial failure', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'mok-owned-batch-'))
  const owner = await createOwnedTempDirectory(parent, 'generation-')
  const firstPath = join(owner.path, 'first.png')
  const secondPath = join(owner.path, 'second.png')
  await writeFile(firstPath, 'first')
  await writeFile(secondPath, 'second')
  const rawResults: GenerationResult[] = [
    { localPath: firstPath },
    { localPath: secondPath },
  ]
  assert.equal(handoffOwnedTempDirectory(rawResults, owner), true)
  let saveCalls = 0

  try {
    const outcome = await generateImageResultsForRequest(
      {
        flowId: 'local',
        nodeId: 'owned-temp-node',
        mediaType: 'image',
        prompt: 'test',
        model: 'jimeng-5.0',
        width: 1024,
        height: 1024,
        count: 2,
      },
      {
        settings: { modelConfigs: [] },
        generateImageImpl: async () => rawResults,
        saveImageGenerationResultImpl: async (result) => {
          await access(owner.path)
          saveCalls += 1
          if (saveCalls === 2) throw new Error('second save failed')
          return { ...result, assetId: 'asset-first', url: 'asset-first' }
        },
      },
    )

    assert.equal(saveCalls, 2)
    assert.equal(outcome.successCount, 1)
    assert.equal(outcome.errors.length, 1)
    await assertMissing(owner.path)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test('Codex removes its empty task directory when only a remote URL is returned', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'mok-codex-owned-'))
  const outputDir = join(parent, 'outputs')
  let runOutputDir = ''

  try {
    const results = await generateCodexCliImage(
      {
        flowId: 'local',
        nodeId: 'codex-owned-node',
        mediaType: 'image',
        prompt: 'test',
        model: 'codex:gpt-5.5',
        width: 1024,
        height: 1024,
        count: 1,
      },
      {
        codexPath: 'codex',
        cwd: parent,
        outputDir,
        runCommand: async (_command, _args, options) => {
          runOutputDir = options.input
            ?.match(/保存到这个本地目录：(.+)/)?.[1]
            ?.trim() ?? ''
          return {
            stdout: JSON.stringify({
              images: [{ url: 'https://cdn.example.com/result.png' }],
            }),
            stderr: '',
          }
        },
        fileExists: async () => false,
        listImageFiles: async () => [],
      },
    )

    assert.deepEqual(results, [
      { remoteUrl: 'https://cdn.example.com/result.png' },
    ])
    assert.ok(runOutputDir)
    await assertMissing(runOutputDir)
    await access(outputDir)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})
