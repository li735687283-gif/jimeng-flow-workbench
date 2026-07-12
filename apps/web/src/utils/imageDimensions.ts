interface LoadedImage {
  naturalWidth: number
  naturalHeight: number
}

interface ImageNodeDimensionState {
  width?: unknown
  height?: unknown
  localPreviewUrl?: unknown
}

export interface ImageDimensions {
  width: number
  height: number
}

export function getImageDimensionsToPersist(
  image: LoadedImage,
  current: ImageNodeDimensionState,
): ImageDimensions | null {
  const width = Number(image.naturalWidth)
  const height = Number(image.naturalHeight)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  const hasPersistedDimensions =
    typeof current.width === 'number' &&
    Number.isFinite(current.width) &&
    current.width > 0 &&
    typeof current.height === 'number' &&
    Number.isFinite(current.height) &&
    current.height > 0

  if (hasPersistedDimensions && !current.localPreviewUrl) return null
  if (current.width === width && current.height === height) return null

  return { width, height }
}
