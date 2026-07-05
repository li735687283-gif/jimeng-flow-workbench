export interface ImageGenerationProgressState {
  visible: boolean
  label: string
  valueText: string
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
