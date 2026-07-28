import test from 'node:test'
import assert from 'node:assert/strict'
import {
  awaitAgentRunResult,
  isAgentRunOwnerActive,
  type AgentRunSnapshot,
} from '../src/utils/agentRunOwnership'

const owner = {
  projectId: 'flow-a',
  conversationId: 'conversation-a',
  contextVersion: 3,
  runId: 7,
}

const activeSnapshot: AgentRunSnapshot = {
  activeProjectId: 'flow-a',
  activeConversationId: 'conversation-a',
  contextVersion: 3,
}

test('agent run owner requires the same project, conversation version, and run id', () => {
  assert.equal(isAgentRunOwnerActive(owner, activeSnapshot, 7), true)
  assert.equal(
    isAgentRunOwnerActive(owner, { ...activeSnapshot, activeProjectId: 'flow-b' }, 7),
    false,
  )
  assert.equal(
    isAgentRunOwnerActive(owner, { ...activeSnapshot, contextVersion: 4 }, 7),
    false,
  )
  assert.equal(isAgentRunOwnerActive(owner, activeSnapshot, 8), false)
})

test('deferred agent response is discarded after the active project changes', async () => {
  let snapshot = activeSnapshot
  let resolveResponse: (value: string) => void = () => undefined
  const response = new Promise<string>((resolve) => {
    resolveResponse = resolve
  })

  const pending = awaitAgentRunResult(
    response,
    owner,
    () => snapshot,
    () => 7,
  )
  snapshot = { ...activeSnapshot, activeProjectId: 'flow-b', contextVersion: 4 }
  resolveResponse('old project reply')

  assert.deepEqual(await pending, { active: false })
})
