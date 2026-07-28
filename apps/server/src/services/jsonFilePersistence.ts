import { randomBytes } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

const fileOperationQueues = new Map<string, Promise<void>>()

function fileQueueKey(filePath: string): string {
  const absolutePath = resolve(filePath)
  return process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath
}

/**
 * Serialize a complete read-modify-write transaction for one file.
 * A failed operation is converted into a resolved queue tail so later writes still run.
 */
export function runSerializedFileOperation<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = fileQueueKey(filePath)
  const previous = fileOperationQueues.get(key) ?? Promise.resolve()
  const result = previous.then(operation, operation)
  const tail = result.then(
    () => undefined,
    () => undefined,
  )

  fileOperationQueues.set(key, tail)
  void tail.then(() => {
    if (fileOperationQueues.get(key) === tail) {
      fileOperationQueues.delete(key)
    }
  })

  return result
}

/** Write JSON through a same-directory temporary file and atomically replace the target. */
export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const directory = dirname(filePath)
  const temporaryPath = resolve(
    directory,
    `.${basename(filePath)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`,
  )

  await mkdir(directory, { recursive: true })
  try {
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8')
    await rename(temporaryPath, filePath)
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}
