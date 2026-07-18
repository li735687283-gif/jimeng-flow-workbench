import { test } from 'node:test'
import assert from 'node:assert/strict'

test('downloadAssetFile fetches the asset and triggers a browser download', async () => {
  const { downloadAssetFile } = await import('../src/api/assets')

  const clicked: string[] = []
  const appended: unknown[] = []
  const removed: unknown[] = []
  const revoked: string[] = []

  const anchor = {
    download: '',
    href: '',
    rel: '',
    click() {
      clicked.push(this.href)
    },
    remove() {
      removed.push(this)
    },
  }

  const originalDocument = globalThis.document
  const originalFetch = globalThis.fetch
  const originalCreateObjectUrl = URL.createObjectURL
  const originalRevokeObjectUrl = URL.revokeObjectURL
  const originalWindow = globalThis.window
  Object.assign(globalThis, {
    fetch: async (url: string) => {
      assert.equal(url, '/api/assets/asset%20id%2F1/download')
      return new Response('image-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-disposition': 'attachment; filename="asset-1.png"',
        },
      })
    },
    document: {
      body: {
        appendChild(element: unknown) {
          appended.push(element)
          return element
        },
      },
      createElement(tagName: string) {
        assert.equal(tagName, 'a')
        return anchor
      },
    },
    window: {
      setTimeout(callback: () => void) {
        callback()
        return 0
      },
    },
  })
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = (url: string) => revoked.push(url)

  try {
    await downloadAssetFile('asset id/1')
  } finally {
    Object.assign(globalThis, {
      document: originalDocument,
      fetch: originalFetch,
      window: originalWindow,
    })
    URL.createObjectURL = originalCreateObjectUrl
    URL.revokeObjectURL = originalRevokeObjectUrl
  }

  assert.equal(anchor.href, 'blob:test')
  assert.equal(anchor.download, 'asset-1.png')
  assert.equal(anchor.rel, 'noopener')
  assert.deepEqual(clicked, ['blob:test'])
  assert.deepEqual(revoked, ['blob:test'])
  assert.equal(appended.length, 1)
  assert.equal(removed.length, 1)
})
