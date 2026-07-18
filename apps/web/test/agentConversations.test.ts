import assert from 'node:assert/strict'
import test from 'node:test'
import type { AgentMessage } from '@jimeng-flow/shared/agentMessage'
import { useAgentStore } from '../src/state/agentStore'

function userMessage(content: string): AgentMessage {
  return {
    id: 'test_' + Math.random().toString(36).slice(2),
    role: 'user',
    content,
    contextNodeIds: [],
    createdAt: new Date().toISOString(),
  }
}

test('Agent conversations isolate, restore, and delete their memory', () => {
  useAgentStore.getState().reset()
  const firstConversationId = useAgentStore.getState().activeConversationId
  useAgentStore.setState({ messages: [userMessage('帮我设计一张夏日海报')] })
  useAgentStore.getState().setConversationContext({
    lastPrompt: '夏日海报',
    referenceAssetId: 'asset_summer',
  })

  const storedFirstConversation = useAgentStore
    .getState()
    .conversations.find((item) => item.id === firstConversationId)
  assert.equal(storedFirstConversation?.title, '帮我设计一张夏日海报')

  const secondConversationId = useAgentStore.getState().newConversation()
  assert.notEqual(secondConversationId, firstConversationId)
  assert.deepEqual(useAgentStore.getState().messages, [])
  assert.deepEqual(useAgentStore.getState().conversationContext, {})

  useAgentStore.setState({ messages: [userMessage('做一个秋日短片')] })
  useAgentStore.getState().setConversationContext({ lastPrompt: '秋日短片' })

  useAgentStore.getState().openConversation(firstConversationId)
  assert.equal(useAgentStore.getState().messages[0]?.content, '帮我设计一张夏日海报')
  assert.equal(
    useAgentStore.getState().conversationContext.referenceAssetId,
    'asset_summer',
  )

  useAgentStore.getState().deleteConversation(firstConversationId)
  assert.equal(useAgentStore.getState().activeConversationId, secondConversationId)
  assert.equal(useAgentStore.getState().messages[0]?.content, '做一个秋日短片')
  assert.equal(
    useAgentStore
      .getState()
      .conversations.some((item) => item.id === firstConversationId),
    false,
  )
})
