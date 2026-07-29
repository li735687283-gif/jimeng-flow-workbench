export interface ImageGenerationProgressState {
  visible: boolean
  label: string
  valueText: string
}

export function isImageGenerationRequestInFlight(
  localRequestInFlight: boolean,
  storeStatus: unknown,
): boolean {
  return (
    localRequestInFlight || storeStatus === 'queued' || storeStatus === 'running'
  )
}

export function isInterruptedImageGeneration(
  status: unknown,
  generationId: unknown,
  requestInFlight: boolean,
): boolean {
  return (
    !requestInFlight &&
    (status === 'queued' || status === 'running') &&
    (typeof generationId !== 'string' || generationId.trim().length === 0)
  )
}

export function getImageGenerationProgressState(
  status: unknown,
  isGenerating: boolean,
  activity: 'generate' | 'upscale' = 'generate',
): ImageGenerationProgressState {
  const visible = isGenerating || status === 'queued' || status === 'running'
  return {
    visible,
    label: activity === 'upscale' ? '高清处理中' : '图片生成中',
    valueText: activity === 'upscale' ? '处理中' : '生成中',
  }
}

export function shouldShowImagePlaceholderIcon(
  progressVisible: boolean,
  _hasLoadError: boolean,
): boolean {
  return !progressVisible
}
