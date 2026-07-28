import { mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { GenerationResult } from '@jimeng-flow/shared/generateNode'

declare const ownedTempDirectoryBrand: unique symbol

export interface OwnedTempDirectory {
  readonly path: string
  readonly [ownedTempDirectoryBrand]: true
}

const ownedDirectories = new WeakSet<object>()
const resultBatchOwners = new WeakMap<GenerationResult[], OwnedTempDirectory[]>()

function isPathInsideDirectory(filePath: string, directory: string): boolean {
  const rel = relative(resolve(directory), resolve(filePath))
  return rel !== ''
    && rel !== '..'
    && !rel.startsWith(`..${sep}`)
    && !isAbsolute(rel)
}

export async function createOwnedTempDirectory(
  parent: string,
  prefix: string,
): Promise<OwnedTempDirectory> {
  const token = Object.freeze({
    path: await mkdtemp(join(parent, prefix)),
  }) as OwnedTempDirectory
  ownedDirectories.add(token)
  return token
}

export function handoffOwnedTempDirectory(
  results: GenerationResult[],
  token: OwnedTempDirectory,
): boolean {
  if (!ownedDirectories.has(token)) return false
  if (!results.some((result) =>
    result.localPath && isPathInsideDirectory(result.localPath, token.path))) {
    return false
  }

  const owners = resultBatchOwners.get(results) ?? []
  if (!owners.includes(token)) owners.push(token)
  resultBatchOwners.set(results, owners)
  return true
}

export async function cleanupOwnedTempDirectory(
  token: OwnedTempDirectory,
): Promise<void> {
  if (!ownedDirectories.has(token)) return
  ownedDirectories.delete(token)
  try {
    await rm(token.path, { recursive: true, force: true })
  } catch {
    // 临时文件清理失败不应覆盖原始生成结果或错误。
  }
}

export async function cleanupOwnedResultBatch(
  results: GenerationResult[],
): Promise<void> {
  const owners = resultBatchOwners.get(results)
  if (!owners) return
  resultBatchOwners.delete(results)
  await Promise.all(owners.map(cleanupOwnedTempDirectory))
}
