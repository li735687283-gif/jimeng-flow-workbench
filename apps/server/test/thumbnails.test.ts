import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Jimp } from 'jimp'
import {
  generateThumbnail,
  normalizeThumbWidth,
} from '../src/services/thumbnails'

test('normalizeThumbWidth 只接受白名单宽度，其他回退默认 640', () => {
  assert.equal(normalizeThumbWidth('320'), 320)
  assert.equal(normalizeThumbWidth('1280'), 1280)
  assert.equal(normalizeThumbWidth('999'), 640)
  assert.equal(normalizeThumbWidth('abc'), 640)
  assert.equal(normalizeThumbWidth(undefined), 640)
})

test('generateThumbnail 生成不大于目标宽度的 JPEG 并落盘', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mok-thumb-'))
  const source = join(dir, 'source.png')
  const target = join(dir, 'out.jpg')

  const image = new Jimp({ width: 2000, height: 900, color: 0xff3366ff })
  await image.write(source)

  await generateThumbnail(source, target, 320)

  assert.ok(existsSync(target))
  assert.ok(statSync(target).size > 0)
  const thumb = await Jimp.read(target)
  assert.ok(thumb.width <= 320)
  assert.equal(Math.round((thumb.width / thumb.height) * 10), Math.round((2000 / 900) * 10))
  // JPEG 魔数 FFD8
  const buf = await import('node:fs/promises').then((fs) => fs.readFile(target))
  assert.equal(buf[0], 0xff)
  assert.equal(buf[1], 0xd8)
})
