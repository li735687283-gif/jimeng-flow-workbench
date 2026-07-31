export function getAssetDisplayName(
  assetId: string,
  assetPath?: string,
): string {
  const normalizedPath = assetPath?.trim().replace(/\\/g, '/')
  const filename = normalizedPath?.split('/').filter(Boolean).at(-1)?.trim()
  return filename || assetId
}
