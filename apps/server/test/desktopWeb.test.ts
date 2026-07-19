import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from '../src/app'

test('production server serves the packaged canvas and static assets', async (t) => {
  const webRoot = await mkdtemp(join(tmpdir(), 'mok-desktop-web-'))
  await mkdir(join(webRoot, 'assets'), { recursive: true })
  await writeFile(join(webRoot, 'index.html'), '<main>MO.K canvas</main>')
  await writeFile(join(webRoot, 'assets', 'app.js'), 'window.MOK = true')
  const app = createApp({ logger: false, webRoot })
  t.after(async () => {
    await app.close()
    await rm(webRoot, { force: true, recursive: true })
  })

  const canvas = await app.inject({ method: 'GET', url: '/canvas' })
  assert.equal(canvas.statusCode, 200)
  assert.match(canvas.body, /MO\.K canvas/)

  const asset = await app.inject({ method: 'GET', url: '/assets/app.js' })
  assert.equal(asset.statusCode, 200)
  assert.equal(asset.body, 'window.MOK = true')
})
