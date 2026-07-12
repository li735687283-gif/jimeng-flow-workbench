import { createHash } from 'node:crypto'
import type { Asset } from '@jimeng-flow/shared/asset'

export function createAssetContentHash(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

export function findDuplicateImportedImage(
  assets: Asset[],
  contentHash: string,
): Asset | null {
  return (
    assets.find(
      (asset) =>
        asset.type === 'image' &&
        !asset.provider &&
        asset.params?.origin === 'upload' &&
        asset.params?.contentHash === contentHash,
    ) ?? null
  )
}
