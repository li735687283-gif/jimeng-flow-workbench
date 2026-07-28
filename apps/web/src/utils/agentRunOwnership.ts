export interface AgentRunOwner {
  projectId: string | null
  conversationId: string
  contextVersion: number
  runId: number
}

export interface AgentRunSnapshot {
  activeProjectId: string | null
  activeConversationId: string
  contextVersion: number
}

export function isAgentRunOwnerActive(
  owner: AgentRunOwner,
  snapshot: AgentRunSnapshot,
  currentRunId: number,
): boolean {
  return (
    owner.runId === currentRunId &&
    owner.projectId === snapshot.activeProjectId &&
    owner.conversationId === snapshot.activeConversationId &&
    owner.contextVersion === snapshot.contextVersion
  )
}

export async function awaitAgentRunResult<T>(
  promise: Promise<T>,
  owner: AgentRunOwner,
  getSnapshot: () => AgentRunSnapshot,
  getCurrentRunId: () => number,
): Promise<{ active: true; value: T } | { active: false }> {
  const value = await promise
  if (!isAgentRunOwnerActive(owner, getSnapshot(), getCurrentRunId())) {
    return { active: false }
  }
  return { active: true, value }
}
