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
const { deriveAssetType, listAssets } = await import('../src/services/assets')

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

async function createTestApp(options: Parameters<typeof multipart>[1] = {}) {
  const app = Fastify()
  await app.register(multipart, options)
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

test('SVG file responses disable script execution and MIME sniffing', async () => {
  const app = await createTestApp()
  try {
    const upload = await app.inject({
      method: 'POST',
      url: '/api/assets/upload',
      payload: uploadPayload(
        'unsafe.svg',
        'image/svg+xml',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>globalThis.pwned=true</script></svg>',
      ),
    })
    assert.equal(upload.statusCode, 201)

    const response = await app.inject({
      method: 'GET',
      url: `/api/assets/${upload.json().id}/file`,
    })
    assert.equal(response.statusCode, 200)
    assert.match(String(response.headers['content-type']), /^image\/svg\+xml/)
    assert.equal(response.headers['x-content-type-options'], 'nosniff')
    assert.match(String(response.headers['content-security-policy']), /script-src 'none'/)
    assert.match(String(response.headers['content-security-policy']), /sandbox/)
  } finally {
    await app.close()
  }
})

test('multipart upload rejects PDF with actionable 4xx response', async () => {
  const app = await createTestApp()
  const boundary = '----mok-upload-boundary'
  const body = Buffer.from([
    '--' + boundary,
    'Content-Disposition: form-data; name="file"; filename="document.pdf"',
    'Content-Type: application/pdf',
    '',
    'pdf-content',
    '--' + boundary + '--',
    '',
  ].join('\r\n'))

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/assets/upload/file',
      headers: {
        'content-type': 'multipart/form-data; boundary=' + boundary,
        'content-length': String(body.length),
      },
      payload: body,
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().code, 'INVALID_INPUT')
    assert.match(response.json().message, /文件类型|MIME|扩展名/)
  } finally {
    await app.close()
  }
})

test('multipart upload rejects truncated files instead of saving partial content', async () => {
  const beforeCount = (await listAssets()).length
  const app = await createTestApp({
    limits: { fileSize: 8, files: 1 },
    throwFileSizeLimit: false,
  })
  const boundary = '----mok-truncated-upload'
  const body = Buffer.from([
    '--' + boundary,
    'Content-Disposition: form-data; name="file"; filename="large.png"',
    'Content-Type: image/png',
    '',
    '0123456789abcdef',
    '--' + boundary + '--',
    '',
  ].join('\r\n'))

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/assets/upload/file',
      headers: {
        'content-type': 'multipart/form-data; boundary=' + boundary,
        'content-length': String(body.length),
      },
      payload: body,
    })
    assert.equal(response.statusCode, 413)
    assert.equal(response.json().code, 'FILE_TOO_LARGE')
    assert.match(response.json().message, /超过大小限制|未保存/)
    assert.equal((await listAssets()).length, beforeCount)
  } finally {
    await app.close()
  }
})
