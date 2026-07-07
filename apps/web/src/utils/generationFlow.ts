export function resolveGenerationFlowId(
  currentFlowId: string | null | undefined,
): string {
  const flowId = currentFlowId?.trim()
  return flowId || 'local'
}
