import { cp, mkdir, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export interface WorkspaceMigrationResult {
  action: 'created' | 'migrated' | 'retained'
  source?: string
  target: string
}

async function listDirectory(path: string): Promise<string[] | null> {
  try {
    return await readdir(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function migrateWorkspace(options: {
  targetWorkspace: string
  legacyCandidates: string[]
}): Promise<WorkspaceMigrationResult> {
  const target = resolve(options.targetWorkspace)
  const targetEntries = await listDirectory(target)
  if (targetEntries && targetEntries.length > 0) {
    return { action: 'retained', target }
  }

  const candidates = Array.from(
    new Set(options.legacyCandidates.map((candidate) => resolve(candidate))),
  )
  for (const source of candidates) {
    if (source === target) continue
    const sourceEntries = await listDirectory(source)
    if (!sourceEntries || sourceEntries.length === 0) continue

    await mkdir(dirname(target), { recursive: true })
    await cp(source, target, {
      errorOnExist: false,
      force: false,
      recursive: true,
    })
    return { action: 'migrated', source, target }
  }

  await mkdir(target, { recursive: true })
  return { action: 'created', target }
}
