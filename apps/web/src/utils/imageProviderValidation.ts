import { shouldRequireJimengCliForImageModel } from './imageModels'

export interface ImageProviderValidationProbes {
  probeJimeng: () => Promise<boolean>
  probeCodex: () => Promise<boolean>
}

export async function validateImageProvider(
  modelId: string,
  probes: ImageProviderValidationProbes,
): Promise<boolean> {
  if (shouldRequireJimengCliForImageModel(modelId)) {
    return probes.probeJimeng()
  }
  if (modelId.trim().toLowerCase().startsWith('codex:')) {
    return probes.probeCodex()
  }
  return true
}
