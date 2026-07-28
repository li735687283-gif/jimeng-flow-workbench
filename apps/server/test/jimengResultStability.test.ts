import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isCompleteImageBuffer,
  parseQueryResultPayload,
} from '../src/services/jimeng/index'

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function makePng(size: number, withIend: boolean): Buffer {
  const buf = Buffer.alloc(size, 0x61)
  PNG_HEADER.copy(buf, 0)
  if (withIend) {
    // IEND 块：4 字节长度(0) + 'IEND' + 4 字节 CRC，位于文件末尾 12 字节
    buf.writeUInt32BE(0, size - 12)
    buf.write('IEND', size - 8, 'latin1')
    buf.writeUInt32BE(0xae426082, size - 4)
  }
  return buf
}

test('PNG 必须以 IEND 块结尾才算完整（大小稳定不代表写完）', () => {
  assert.equal(isCompleteImageBuffer(makePng(1024, true)), true)
  assert.equal(isCompleteImageBuffer(makePng(1024, false)), false)
  assert.equal(isCompleteImageBuffer(makePng(1024, true).subarray(0, 700)), false)
})

test('JPEG 必须以 EOI 结尾', () => {
  const complete = Buffer.from([0xff, 0xd8, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xff, 0xd9])
  assert.equal(isCompleteImageBuffer(complete), true)
  assert.equal(isCompleteImageBuffer(complete.subarray(0, 14)), false)
})

test('WEBP 校验 RIFF 声明长度，其他格式按完整处理', () => {
  const webp = Buffer.alloc(64, 0x62)
  webp.write('RIFF', 0, 'latin1')
  webp.writeUInt32LE(56, 4)
  webp.write('WEBP', 8, 'latin1')
  assert.equal(isCompleteImageBuffer(webp), true)
  webp.writeUInt32LE(9999, 4)
  assert.equal(isCompleteImageBuffer(webp), false)
  const gif = Buffer.alloc(32, 0x47)
  assert.equal(isCompleteImageBuffer(gif), true)
  assert.equal(isCompleteImageBuffer(Buffer.alloc(4, 0)), false)
})

test('parseQueryResultPayload 解析任务状态与结果路径', () => {
  const output = JSON.stringify({
    submit_id: 'abc',
    gen_status: 'success',
    result_json: {
      images: [
        { path: 'C:\\tmp\\a_image_1.png', width: 2048, height: 2048 },
        { path: 'C:\\tmp\\a_image_2.png', width: 2048, height: 2048 },
      ],
      videos: [],
    },
  })
  const parsed = parseQueryResultPayload(output)
  assert.equal(parsed.status, 'success')
  assert.deepEqual(parsed.paths, ['C:\\tmp\\a_image_1.png', 'C:\\tmp\\a_image_2.png'])
})

test('parseQueryResultPayload 处理进行中、视频结果与坏输出', () => {
  assert.deepEqual(parseQueryResultPayload('{"gen_status":"querying"}'), { status: 'querying', paths: [] })
  const video = parseQueryResultPayload('{"gen_status":"success","result_json":{"images":[],"videos":[{"path":"/tmp/v.mp4"}]}}')
  assert.deepEqual(video.paths, ['/tmp/v.mp4'])
  assert.deepEqual(parseQueryResultPayload('not json at all'), { status: null, paths: [] })
  assert.deepEqual(parseQueryResultPayload('{"result_json":{"images":[{"width":1}]}}'), { status: null, paths: [] })
})
