export interface ImageGenerationProgressState {
  visible: boolean
  label: string
  valueText: string
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
): ImageGenerationProgressState {
  const visible = isGenerating || status === 'queued' || status === 'running'
  return {
    visible,
    label: '图片生成中',
    valueText: '生成中',
  }
}

export function shouldShowImagePlaceholderIcon(
  progressVisible: boolean,
  _hasLoadError: boolean,
): boolean {
  return !progressVisible
}
