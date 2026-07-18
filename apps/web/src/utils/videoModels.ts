import { VIDEO_MODELS, isJimengVideoModel } from '@jimeng-flow/shared/videoNode'
import type { ModelConfig } from '@jimeng-flow/shared/settings'
import { getModelConfigsByCapability } from '@jimeng-flow/shared/settings'

export interface VideoModelOption {
  id: string
  label: string
}

function toVideoModelOption(modelId: string): VideoModelOption | null {
  const id = modelId.trim()
  if (!id) return null

  const builtin = VIDEO_MODELS.find((model) => model.id === id)
  if (builtin) return { id: builtin.id, label: builtin.label }

  return { id, label: id }
}

function modelConfigToVideoOption(model: ModelConfig): VideoModelOption | null {
  const id = model.id.trim()
  if (!id) return null

  const builtin = VIDEO_MODELS.find((item) => item.id === id)
  if (builtin) return { id: builtin.id, label: model.label?.trim() || builtin.label }

  return { id, label: model.label?.trim() || id }
}

export function getConfiguredVideoModels(
  modelIds: string[] | undefined,
  modelConfigs: ModelConfig[] | undefined = [],
): VideoModelOption[] {
  const selected: VideoModelOption[] = []
  const seen = new Set<string>()

  // The explicit settings list is authoritative. An empty list means that no
  // video model has been selected; never show built-in or cross-capability
  // models as a fallback.
  if (modelIds !== undefined) {
    for (const modelId of modelIds) {
      const option = toVideoModelOption(modelId)
      if (!option || seen.has(option.id)) continue
      selected.push(option)
      seen.add(option.id)
    }
    return selected
  }

  for (const model of getModelConfigsByCapability(modelConfigs, 'video')) {
    const option = modelConfigToVideoOption(model)
    if (!option || seen.has(option.id)) continue
    selected.push(option)
    seen.add(option.id)
  }
  return selected
}

export function getConfiguredDefaultVideoModel(
  modelIds: string[] | undefined,
  preferredModel: string | undefined,
  modelConfigs: ModelConfig[] | undefined = [],
): string {
  const models = getConfiguredVideoModels(modelIds, modelConfigs)
  return (
    models.find((model) => model.id === preferredModel)?.id ??
    models[0]?.id ??
    ''
  )
}

export function videoModelNeedsJimeng(modelId: string): boolean {
  const id = modelId.trim()
  return !!id && isJimengVideoModel(id)
}

export function getUnsupportedVideoModelMessage(modelId: string): string | null {
  void modelId
  return null
}