import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getWorkspaceDir,
  resolveWorkspaceInputPath,
} from '../src/config'
import {
  assertValidGenerationInputImages,
  createGeneration,
} from '../src/services/generations'
import { JimengError, generateImage } from '../src/services/jimeng'
import { generateOpenAiCompatibleImage } from '../src/services/openaiImage'

const ATTACK_PATHS = [
  'C:/Windows/win.ini',
  'c:\\windows\\win.ini',
  'C:\\Windows\\win.ini',
  '\\\\server\\share\\file.png',
  '//server/share/file.png',
  '/etc/passwd',
  '../outside-secret.txt',
  'outputs/../../outside-secret.txt',
  'workspace/../../outside-secret.txt',
]

test('resolveWorkspaceInputPath rejects absolute paths and directory traversal', () => {
  for (const value of ATTACK_PATHS) {
    assert.throws(() => resolveWorkspaceInputPath(value), /workspace/, value)
  }
})

test('resolveWorkspaceInputPath resolves workspace-relative paths inside the workspace', () => {
  const workspace = getWorkspaceDir().replace(/\\/g, '/').toLowerCase()
  for (const value of [
    'outputs/2026-07-22/asset_1.png',
    'workspace/outputs/2026-07-22/asset_1.png',
    './outputs/reference.png',
  ]) {
    const resolved = resolveWorkspaceInputPath(value).replace(/\\/g, '/').toLowerCase()
    assert.ok(
      resolved.startsWith(`${workspace}/`),
      `${value} should resolve inside workspace, got ${resolved}`,
    )
  }
})

test('assertValidGenerationInputImages accepts asset ids, data urls and workspace files', () => {
  assert.doesNotThrow(() =>
    assertValidGenerationInputImages([
      'asset_1720000000000_ab12cd34',
      'data:image/png;base64,iVBORw0KGgo=',
      'http://127.0.0.1:8787/api/assets/asset_1720000000000_ab12cd34/file',
      '/api/assets/asset_1720000000000_ab12cd34/file',
      'outputs/2026-07-22/asset_1.png',
      undefined,
      '',
    ]),
  )
})

test('assertValidGenerationInputImages rejects absolute paths and traversal', () => {
  for (const value of ATTACK_PATHS) {
    assert.throws(
      () => assertValidGenerationInputImages([value]),
      (err: unknown) =>
        err instanceof JimengError &&
        err.code === 'INVALID_INPUT' &&
        err.statusCode === 400,
      value,
    )
  }
})
test('assertValidGenerationInputImages rejects non-asset remote and file urls', () => {
  for (const value of [
    'https://example.com/reference.png',
    'file:///C:/Windows/win.ini',
  ]) {
    assert.throws(
      () => assertValidGenerationInputImages([value]),
      (err: unknown) =>
        err instanceof JimengError &&
        err.code === 'INVALID_INPUT' &&
        err.statusCode === 400 &&
        /Asset/.test(err.message),
      value,
    )
  }
})

test('createGeneration rejects input images outside the workspace with HTTP 400', async () => {
  await assert.rejects(
    createGeneration({
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'edit this',
      inputImages: ['C:/Windows/win.ini'],
      model: 'gpt-image-1',
      width: 1024,
      height: 1024,
      count: 1,
    }),
    (err: unknown) =>
      err instanceof JimengError &&
      err.code === 'INVALID_INPUT' &&
      err.statusCode === 400 &&
      /workspace/.test(err.message),
  )
})

test('jimeng generateImage rejects traversal input before invoking the CLI', async () => {
  await assert.rejects(
    generateImage({
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'edit this',
      inputImages: ['../outside-secret.txt'],
      model: 'jimeng-5.0',
      width: 1024,
      height: 1024,
      count: 1,
    }),
    /workspace/,
  )
})

test('openai-compatible image edit rejects absolute input path before any fetch', async () => {
  let fetchCalled = false
  const fetchImpl = async () => {
    fetchCalled = true
    return Response.json({})
  }

  await assert.rejects(
    generateOpenAiCompatibleImage(
      {
        flowId: 'local',
        nodeId: 'image-1',
        mediaType: 'image',
        prompt: 'edit this',
        inputImages: ['\\\\server\\share\\file.png'],
        model: 'gpt-image-1',
        width: 1024,
        height: 1024,
        count: 1,
      },
      {
        settings: {
          llmBaseUrl: 'https://api.openai.example/v1',
          llmApiKey: 'test-key',
        },
        fetchImpl: fetchImpl as typeof fetch,
      },
    ),
    /workspace/,
  )
  assert.equal(fetchCalled, false)
})
