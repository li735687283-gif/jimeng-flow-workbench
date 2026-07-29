import type {
  GenerationRequest,
  GenerationResult,
} from '@jimeng-flow/shared/generateNode'
import type { UpscaleResolutionType } from '@jimeng-flow/shared/upscale'
import { Jimp } from 'jimp'
import { getAsset, getAssetFilePath } from './assets'
import { generateOpenAiCompatibleImage } from './openaiImage'

export const NANO_BANANA_PRO_MODEL = 'gemini-3-pro-image-preview'

const NANO_BANANA_UPSCALE_PROMPT =
  'Upscale this image to high resolution. Preserve the original composition, subjects, text, colors, lighting, and style exactly. Improve only clarity, fine detail, edge definition, and texture. Do not add, remove, replace, crop, or rearrange anything.'

const NANO_BANANA_TARGET_LONG_EDGE = {
  '2k': 2048,
  '4k': 4096,
} as const

type NanoBananaResolution = keyof typeof NANO_BANANA_TARGET_LONG_EDGE

export type NanoBananaUpscaleErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_RESOLUTION'

export class NanoBananaUpscaleError extends Error {
  code: NanoBananaUpscaleErrorCode
  statusCode: number

  constructor(
    code: NanoBananaUpscaleErrorCode,
    message: string,
    statusCode = 400,
  ) {
    super(message)
    this.name = 'NanoBananaUpscaleError'
    this.code = code
    this.statusCode = statusCode
  }
}

export interface NanoBananaUpscaleParams {
  inputImage: string
  resolutionType?: UpscaleResolutionType
  flowId?: string
}

export interface NanoBananaUpscaleDeps {
  readImageSizeImpl?: (
    inputImage: string,
  ) => Promise<{ width: number; height: number }>
  generateImageImpl?: (
    request: GenerationRequest,
  ) => Promise<GenerationResult[]>
}

async function readAssetImageSize(
  inputImage: string,
): Promise<{ width: number; height: number }> {
  const asset = await getAsset(inputImage)
  if (!asset || asset.type !== 'image') {
    throw new NanoBananaUpscaleError(
      'INVALID_INPUT',
      'Nano Banana Pro 高清需要有效的图片资产',
    )
  }
  const image = await Jimp.read(getAssetFilePath(asset))
  return { width: image.width, height: image.height }
}

export function getNanoBananaTargetSize(
  sourceWidth: number,
  sourceHeight: number,
  resolutionType: NanoBananaResolution,
): { width: number; height: number } {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new NanoBananaUpscaleError(
      'INVALID_INPUT',
      '无法读取原图尺寸，不能执行 Nano Banana Pro 高清',
    )
  }

  const targetLongEdge = NANO_BANANA_TARGET_LONG_EDGE[resolutionType]
  const scale = targetLongEdge / Math.max(sourceWidth, sourceHeight)
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

export async function upscaleWithNanoBananaPro(
  params: NanoBananaUpscaleParams,
  deps: NanoBananaUpscaleDeps = {},
): Promise<GenerationResult[]> {
  const inputImage = params.inputImage?.trim()
  if (!inputImage) {
    throw new NanoBananaUpscaleError('INVALID_INPUT', '缺少输入图片')
  }

  const resolutionType = params.resolutionType ?? '2k'
  if (resolutionType !== '2k' && resolutionType !== '4k') {
    throw new NanoBananaUpscaleError(
      'UNSUPPORTED_RESOLUTION',
      'Nano Banana Pro 高清仅支持 2K 或 4K',
    )
  }

  const readImageSize = deps.readImageSizeImpl ?? readAssetImageSize
  const sourceSize = await readImageSize(inputImage)
  const targetSize = getNanoBananaTargetSize(
    sourceSize.width,
    sourceSize.height,
    resolutionType,
  )
  const generateImage = deps.generateImageImpl ?? generateOpenAiCompatibleImage

  return generateImage({
    flowId: params.flowId,
    nodeId: `upscale-${inputImage}`,
    mediaType: 'image',
    prompt: NANO_BANANA_UPSCALE_PROMPT,
    inputImages: [inputImage],
    model: NANO_BANANA_PRO_MODEL,
    width: targetSize.width,
    height: targetSize.height,
    count: 1,
  })
}