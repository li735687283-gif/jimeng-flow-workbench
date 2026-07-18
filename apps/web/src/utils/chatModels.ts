import type { ModelConfig } from '@jimeng-flow/shared/settings'
import {
  getModelConfigsByCapability,
  normalizeModelConfigs,
} from '@jimeng-flow/shared/settings'
import { isLikelyImageModelId, isOpenAiCliImageModel } from './imageModels'

function uniqueModels(models: string[]): string[] {
  return Array.from(
    new Set(
      models
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  )
}

function isLikelyVideoModelId(modelId: string): boolean {
  const id = modelId.trim().toLowerCase()
  return (
    id.includes('video') ||
    id.includes('veo') ||
    id.includes('kling') ||
    id.includes('seedance') ||
    id.includes('sora') ||
    id.includes('wan2')
  )
}

function filterChatModelIds(
  modelIds: string[],
  modelConfigs: ModelConfig[] | undefined,
): string[] {
  const configs = new Map(
    normalizeModelConfigs(modelConfigs).map((model) => [model.id, model]),
  )

  return uniqueModels(modelIds).filter((modelId) => {
    if (isOpenAiCliImageModel(modelId)) return false
    const config = configs.get(modelId)
    if (config) {
      return config.enabled !== false && config.capabilities.includes('chat')
    }
    // Older settings may not have a structured config for every model. In
    // that case, hide IDs that clearly belong to image/video capabilities.
    return !isLikelyImageModelId(modelId) && !isLikelyVideoModelId(modelId)
  })
}

export function getConfiguredChatModels(
  modelIds: string[] | undefined,
  currentModel: string | undefined,
  modelConfigs: ModelConfig[] | undefined = [],
): string[] {
  // The explicit settings list is authoritative, but capability metadata still
  // prevents image/video-only IDs from leaking into a text node.
  if (modelIds !== undefined) return filterChatModelIds(modelIds, modelConfigs)

  const configured = getModelConfigsByCapability(modelConfigs, 'chat').map(
    (model) => model.id,
  )
  if (configured.length > 0) return uniqueModels(configured)

  return filterChatModelIds([currentModel ?? ''], modelConfigs)
}