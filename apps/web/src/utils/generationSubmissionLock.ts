export interface GenerationSubmissionLock {
  current: boolean
}

export function tryAcquireGenerationSubmission(
  lock: GenerationSubmissionLock,
): boolean {
  if (lock.current) return false
  lock.current = true
  return true
}

export function releaseGenerationSubmission(
  lock: GenerationSubmissionLock,
): void {
  lock.current = false
}
