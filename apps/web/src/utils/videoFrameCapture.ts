export interface CapturedVideoFrame {
  dataUrl: string
  width: number
  height: number
  capturedAtSeconds: number
}

type CanvasFactory = () => HTMLCanvasElement

export function formatCapturedFrameTime(seconds: number): string {
  const totalMilliseconds = Number.isFinite(seconds)
    ? Math.max(0, Math.round(seconds * 1000))
    : 0
  const minutes = Math.floor(totalMilliseconds / 60_000)
  const secondsPart = Math.floor((totalMilliseconds % 60_000) / 1000)
  const milliseconds = totalMilliseconds % 1000
  return `${String(minutes).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

export function getCapturedFrameRatio(width: number, height: number): string {
  const normalizedWidth = Math.max(1, Math.round(width))
  const normalizedHeight = Math.max(1, Math.round(height))
  let a = normalizedWidth
  let b = normalizedHeight
  while (b !== 0) {
    const remainder = a % b
    a = b
    b = remainder
  }
  return `${normalizedWidth / a}:${normalizedHeight / a}`
}

export function captureCurrentVideoFrame(
  video: HTMLVideoElement,
  createCanvas: CanvasFactory = () => document.createElement('canvas'),
): CapturedVideoFrame {
  const width = video.videoWidth
  const height = video.videoHeight
  if (video.readyState < 2 || width <= 0 || height <= 0) {
    throw new Error('当前视频帧尚未准备好，请等待画面显示后重试')
  }

  const canvas = createCanvas()
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('当前环境无法截取视频帧')
  }

  try {
    context.drawImage(video, 0, 0, width, height)
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      width,
      height,
      capturedAtSeconds: video.currentTime,
    }
  } catch (error) {
    const detail = error instanceof Error ? `：${error.message}` : ''
    throw new Error(`无法读取当前视频画面${detail}`)
  }
}