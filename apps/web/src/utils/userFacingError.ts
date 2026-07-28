const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /networkerror/i,
  /network request failed/i,
]

export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const trimmed = message.trim()
  if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return '无法连接服务，请确认后端已启动'
  }
  return trimmed || fallback
}
