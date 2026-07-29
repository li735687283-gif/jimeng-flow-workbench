import { shouldRequireJimengCliForImageModel } from './imageModels'

export interface ImageProviderValidationResult {
  ok: boolean
  message?: string
}

export interface ImageProviderValidationProbes {
  probeJimeng: () => Promise<ImageProviderValidationResult>
  probeCodex: () => Promise<ImageProviderValidationResult>
}

export async function validateImageProvider(
  modelId: string,
  probes: ImageProviderValidationProbes,
): Promise<ImageProviderValidationResult> {
  if (shouldRequireJimengCliForImageModel(modelId)) {
    return probes.probeJimeng()
  }
  if (modelId.trim().toLowerCase().startsWith('codex:')) {
    return probes.probeCodex()
  }
  // 通用 OpenAI 兼容图像模型走已配置的 HTTP 接口，没有本地环境可探测；
  // 明确告知用户「未做本地探测」，避免点了校验却什么都没发生的错觉。
  return {
    ok: true,
    message: '该模型使用已配置的图像接口，无需本地环境校验',
  }
}
