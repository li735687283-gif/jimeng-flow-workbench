import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureCurrentVideoFrame } from '../src/utils/videoFrameCapture'

test('captureCurrentVideoFrame draws the current video frame as an embedded jpeg', () => {
  const drawCalls: unknown[][] = []
  const video = {
    currentTime: 9.375,
    videoWidth: 1920,
    videoHeight: 1080,
    readyState: 2,
  } as HTMLVideoElement
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...args: unknown[]) => drawCalls.push(args),
    }),
    toDataURL: (type: string, quality: number) => {
      assert.equal(type, 'image/jpeg')
      assert.equal(quality, 0.92)
      return 'data:image/jpeg;base64,frame-data'
    },
  } as unknown as HTMLCanvasElement

  const frame = captureCurrentVideoFrame(video, () => canvas)

  assert.deepEqual(frame, {
    dataUrl: 'data:image/jpeg;base64,frame-data',
    width: 1920,
    height: 1080,
    capturedAtSeconds: 9.375,
  })
  assert.equal(canvas.width, 1920)
  assert.equal(canvas.height, 1080)
  assert.deepEqual(drawCalls, [[video, 0, 0, 1920, 1080]])
})

test('captureCurrentVideoFrame rejects a video without a readable current frame', () => {
  const video = {
    currentTime: 0,
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
  } as HTMLVideoElement

  assert.throws(
    () => captureCurrentVideoFrame(video),
    /当前视频帧尚未准备好/,
  )
})