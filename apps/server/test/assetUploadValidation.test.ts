import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-asset-upload-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { default: assetsRoutes } = await import('../src/routes/assets')
const { deriveAssetType } = await import('../src/services/assets')

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

async function createTestApp() {
  const app = Fastify()
  await app.register(multipart)
  await app.register(assetsRoutes)
  await app.ready()
  return app
}

function uploadPayload(fileName: string, mimeType: string, content = 'file-content') {
  return {
    fileName,
    mimeType,
    dataBase64: Buffer.from(content).toString('base64'),
  }
}

test('asset type derivation has no image fallback for unsupported files', () => {
  assert.equal(deriveAssetType('application/pdf', 'document.pdf'), null)
  assert.equal(deriveAssetType('application/octet-stream', 'tool.exe'), null)
  assert.equal(deriveAssetType('image/png', 'README'), null)
})

test('JSON upload rejects unsupported, extensionless, and MIME-mismatched files', async () => {
  const app = await createTestApp()
  try {
    for (const payload of [
      uploadPayload('document.pdf', 'application/pdf'),
      uploadPayload('tool.exe', 'application/octet-stream'),
      uploadPayload('README', 'image/png'),
      uploadPayload('photo.png', 'application/pdf'),
      uploadPayload('clip.mp4', 'image/png'),
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/upload',
        payload,
      })
      assert.equal(response.statusCode, 400, JSON.stringify(payload))
      assert.equal(response.json().code, 'INVALID_INPUT')
      assert.match(response.json().message, /MIME|文件类型|扩展名/)
    }
  } finally {
    await app.close()
  }
})

test('JSON upload accepts matching PNG, JPEG, and MP4 types', async () => {
  const app = await createTestApp()
  try {
    for (const [fileName, mimeType, type] of [
      ['image.png', 'image/png', 'image'],
      ['photo.jpeg', 'image/jpeg', 'image'],
      ['clip.mp4', 'video/mp4', 'video'],
    ] as const) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/upload',
        payload: uploadPayload(fileName, mimeType, `${fileName}-content`),
      })
      assert.equal(response.statusCode, 201, `${fileName}: ${response.body}`)
      assert.equal(response.json().type, type)
    }
  } finally {
    await app.close()
  }
})

test('multipart upload rejects PDF with actionable 4xx response', async () => {
  const app = await createTestApp()
  const boundary = '----mok-upload-boundary'
  const body = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="document.pdf"\r\n' +
      'Content-Type: application/pdf\r\n\r\n' +
      'pdf-content\r\n' +
      `--${boundary}--\r\n`,
  )
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/assets/upload/file',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().code, 'INVALID_INPUT')
    assert.match(response.json().message, /MIME|文件类型|扩展名/)
  } finally {
    await app.close()
  }
})
