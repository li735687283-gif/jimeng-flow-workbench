import { test } from 'node:test'
import assert from 'node:assert/strict'

test('downloadAssetFile triggers a browser download link', async () => {
  const { downloadAssetFile } = await import('../src/api/assets')

  const clicked: string[] = []
  const appended: unknown[] = []
  const removed: unknown[] = []

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
  Object.assign(globalThis, {
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
  })

  try {
    downloadAssetFile('asset id/1')
  } finally {
    Object.assign(globalThis, { document: originalDocument })
  }

  assert.equal(anchor.href, '/api/assets/asset%20id%2F1/download')
  assert.equal(anchor.download, '')
  assert.equal(anchor.rel, 'noopener')
  assert.deepEqual(clicked, ['/api/assets/asset%20id%2F1/download'])
  assert.equal(appended.length, 1)
  assert.equal(removed.length, 1)
})
