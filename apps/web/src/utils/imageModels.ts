import { IMAGE_MODELS } from '@jimeng-flow/shared/generateNode'

export interface ImageModelOption {
  id: string
  label: string
  description?: string
}

const IMAGE_MODEL_MENU_MIN_WIDTH = 220
const IMAGE_MODEL_MENU_MAX_WIDTH = 420
const IMAGE_MODEL_MENU_CHROME_WIDTH = 104
const ASCII_LABEL_CHAR_WIDTH = 8.4
const WIDE_LABEL_CHAR_WIDTH = 14

function toImageModelOption(modelId: string): ImageModelOption | null {
  const id = modelId.trim()
  if (!id) return null

  const builtin = IMAGE_MODELS.find((model) => model.id === id)
  if (builtin) return builtin

  return {
    id,
    label: id,
    description: '第三方 API 图片模型',
  }
}

export function isLikelyImageModelId(modelId: string): boolean {
  const id = modelId.trim().toLowerCase()
  if (!id) return false

  return (
    id.includes('image') ||
    id.includes('imagen') ||
    id.includes('banana') ||
    id.includes('gpt-image') ||
    id.includes('dall-e') ||
    id.includes('flux') ||
    id.includes('sdxl') ||
    id.includes('stable-diffusion') ||
    id.includes('seedream')
  )
}

export function getConfiguredImageModels(
  modelIds: string[] | undefined,
  commonModelIds: string[] | undefined = [],
): ImageModelOption[] {
  const selected: ImageModelOption[] = []
  const seen = new Set<string>()
  const inferredImageModels = (commonModelIds ?? []).filter(isLikelyImageModelId)
  for (const modelId of [...(modelIds ?? []), ...inferredImageModels]) {
    const option = toImageModelOption(modelId)
    if (!option || seen.has(option.id)) continue
    selected.push(option)
    seen.add(option.id)
  }

  if (selected.length > 0) return selected

  const defaultImageModel = IMAGE_MODELS.find((model) => model.id === 'jimeng')
  return defaultImageModel ? [defaultImageModel] : IMAGE_MODELS.slice(0, 1)
}

export function getConfiguredDefaultImageModel(
  modelIds: string[] | undefined,
  preferredModel: string | undefined,
  commonModelIds: string[] | undefined = [],
): string {
  const models = getConfiguredImageModels(modelIds, commonModelIds)
  return (
    models.find((model) => model.id === preferredModel)?.id ??
    models[0]?.id ??
    IMAGE_MODELS[0]?.id ??
    ''
  )
}

function estimateLabelWidth(label: string): number {
  let width = 0
  for (const char of label) {
    width += char.charCodeAt(0) > 255 ? WIDE_LABEL_CHAR_WIDTH : ASCII_LABEL_CHAR_WIDTH
  }
  return width
}

export function getImageModelMenuWidth(models: ImageModelOption[]): number {
  const longestLabelWidth = models.reduce(
    (longest, model) => Math.max(longest, estimateLabelWidth(model.label)),
    0,
  )
  const requestedWidth = Math.ceil(longestLabelWidth + IMAGE_MODEL_MENU_CHROME_WIDTH)
  return Math.min(
    IMAGE_MODEL_MENU_MAX_WIDTH,
    Math.max(IMAGE_MODEL_MENU_MIN_WIDTH, requestedWidth),
  )
}
