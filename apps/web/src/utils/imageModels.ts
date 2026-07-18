import {
  IMAGE_MODELS,
  isJimengImageModel,
} from '@jimeng-flow/shared/generateNode'
import type { ModelConfig } from '@jimeng-flow/shared/settings'
import { getModelConfigsByCapability } from '@jimeng-flow/shared/settings'

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
const OPENAI_CLI_IMAGE_MODEL_ID = 'codex:gpt-5.5'
const OPENAI_CLI_IMAGE_MODEL_LABEL = 'GPT Image（OpenAI CLI）'

export function isOpenAiCliImageModel(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase()
  return (
    normalized === '$imagegen' ||
    normalized === 'gpt-image-2' ||
    normalized === OPENAI_CLI_IMAGE_MODEL_ID ||
    normalized.startsWith('codex:')
  )
}

function normalizeOpenAiCliImageModelId(modelId: string): string {
  const id = modelId.trim()
  const normalized = id.toLowerCase()
  return normalized === '$imagegen' || normalized === 'gpt-image-2'
    ? OPENAI_CLI_IMAGE_MODEL_ID
    : id
}

function toImageModelOption(modelId: string): ImageModelOption | null {
  const id = normalizeOpenAiCliImageModelId(modelId)
  if (!id) return null

  const builtin = IMAGE_MODELS.find((model) => model.id === id)
  if (builtin) return builtin

  const normalized = id.toLowerCase()
  if (
    normalized === OPENAI_CLI_IMAGE_MODEL_ID ||
    normalized.startsWith('codex:')
  ) {
    return {
      id,
      label: normalized === OPENAI_CLI_IMAGE_MODEL_ID
        ? OPENAI_CLI_IMAGE_MODEL_LABEL
        : id,
      description: 'OpenAI CLI 图片模型',
    }
  }

  return {
    id,
    label: id,
    description: '第三方 API 图片模型',
  }
}

function modelConfigToImageOption(model: ModelConfig): ImageModelOption | null {
  const id = normalizeOpenAiCliImageModelId(model.id)
  if (!id) return null
  const legacyOpenAiCliId = id !== model.id.trim()
  const builtin = IMAGE_MODELS.find((item) => item.id === id)
  if (builtin) {
    return {
      ...builtin,
      label: legacyOpenAiCliId
        ? OPENAI_CLI_IMAGE_MODEL_LABEL
        : model.label?.trim() || builtin.label,
      description: builtin.description,
    }
  }

  return {
    id,
    label: legacyOpenAiCliId || id.toLowerCase() === OPENAI_CLI_IMAGE_MODEL_ID
      ? OPENAI_CLI_IMAGE_MODEL_LABEL
      : model.label?.trim() || id,
    description: model.provider === 'codex'
      ? 'OpenAI CLI 图片模型'
      : '第三方 API 图片模型',
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

export function shouldRequireJimengCliForImageModel(modelId: string): boolean {
  return isJimengImageModel(modelId)
}

export function getConfiguredImageModels(
  modelIds: string[] | undefined,
  _legacyCommonModelIds: string[] | undefined = [],
  modelConfigs: ModelConfig[] | undefined = [],
): ImageModelOption[] {
  const selected: ImageModelOption[] = []
  const seen = new Set<string>()

  // The explicit settings list is authoritative. Do not infer image models
  // from the LLM list or append built-in/CLI fallbacks here.
  if (modelIds !== undefined) {
    for (const modelId of modelIds) {
      const option = toImageModelOption(modelId)
      if (!option || seen.has(option.id)) continue
      selected.push(option)
      seen.add(option.id)
    }
    return selected
  }

  // Compatibility path for older settings that have not been migrated to the
  // explicit imageModels array yet.
  for (const model of getModelConfigsByCapability(modelConfigs, 'image')) {
    const option = modelConfigToImageOption(model)
    if (!option || seen.has(option.id)) continue
    selected.push(option)
    seen.add(option.id)
  }
  return selected
}

export function getConfiguredDefaultImageModel(
  modelIds: string[] | undefined,
  preferredModel: string | undefined,
  _legacyCommonModelIds: string[] | undefined = [],
  modelConfigs: ModelConfig[] | undefined = [],
): string {
  const models = getConfiguredImageModels(modelIds, undefined, modelConfigs)
  return (
    models.find((model) => model.id === preferredModel)?.id ??
    models[0]?.id ??
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