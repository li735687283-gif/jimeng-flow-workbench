import type { ModelConfig } from '@jimeng-flow/shared/settings'
import { getModelConfigsByCapability } from '@jimeng-flow/shared/settings'

function uniqueModels(models: string[]): string[] {
  return Array.from(
    new Set(
      models
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  )
}

export function getConfiguredChatModels(
  modelIds: string[] | undefined,
  currentModel: string | undefined,
  modelConfigs: ModelConfig[] | undefined = [],
): string[] {
  const configured = getModelConfigsByCapability(modelConfigs, 'chat')
    .map((model) => model.id)
  if (configured.length > 0) return uniqueModels(configured)

  return uniqueModels([
    ...(modelIds ?? []),
    currentModel ?? '',
  ])
}
