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
  useAgentStore.getState().setActiveProject('flow-conversations')
  useAgentStore.getState().reset()
  const firstConversationId = useAgentStore.getState().activeConversationId
  useAgentStore.setState({ messages: [userMessage('帮我设计一张夏日海报')] })
  useAgentStore.getState().setConversationContext({
    lastPrompt: '夏日海报',
    lastGeneratedAssetIds: ['asset_summer'],
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
  assert.deepEqual(
    useAgentStore.getState().conversationContext.lastGeneratedAssetIds,
    ['asset_summer'],
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

test('Agent memory is isolated by project and a new project starts blank', () => {
  useAgentStore.getState().setActiveProject('flow-a')
  useAgentStore.getState().reset()
  useAgentStore.setState({ messages: [userMessage('A 项目的秘密')] })
  useAgentStore.getState().setConversationContext({ lastPrompt: 'A 项目的秘密' })

  useAgentStore.getState().setActiveProject('flow-b')
  assert.equal(useAgentStore.getState().activeProjectId, 'flow-b')
  assert.deepEqual(useAgentStore.getState().messages, [])
  assert.deepEqual(useAgentStore.getState().conversationContext, {})
  assert.equal(useAgentStore.getState().conversations.length, 1)

  useAgentStore.setState({ messages: [userMessage('B 项目的内容')] })
  useAgentStore.getState().setActiveProject('flow-a')
  assert.equal(useAgentStore.getState().messages[0]?.content, 'A 项目的秘密')
  assert.equal(useAgentStore.getState().conversationContext.lastPrompt, 'A 项目的秘密')

  useAgentStore.getState().setActiveProject('flow-b')
  assert.equal(useAgentStore.getState().messages[0]?.content, 'B 项目的内容')

  useAgentStore.getState().setActiveProject(null)
  assert.equal(useAgentStore.getState().activeProjectId, null)
  assert.deepEqual(useAgentStore.getState().messages, [])
})

test('Agent context version invalidates work after project or conversation changes', () => {
  useAgentStore.getState().setActiveProject('flow-owner-a')
  const firstVersion = useAgentStore.getState().contextVersion

  useAgentStore.getState().setActiveProject('flow-owner-b')
  const secondVersion = useAgentStore.getState().contextVersion
  assert.equal(secondVersion > firstVersion, true)

  useAgentStore.getState().setActiveProject('flow-owner-a')
  const restoredVersion = useAgentStore.getState().contextVersion
  assert.equal(restoredVersion > secondVersion, true)

  useAgentStore.getState().newConversation()
  assert.equal(useAgentStore.getState().contextVersion > restoredVersion, true)
})

test('Agent drafts remain isolated by project', () => {
  useAgentStore.getState().setActiveProject('flow-draft-a')
  useAgentStore.getState().setDraft('A 的未发送内容')

  useAgentStore.getState().setActiveProject('flow-draft-b')
  assert.equal(useAgentStore.getState().draft, '')
  useAgentStore.getState().setDraft('B 的未发送内容')

  useAgentStore.getState().setActiveProject('flow-draft-a')
  assert.equal(useAgentStore.getState().draft, 'A 的未发送内容')

  useAgentStore.getState().setActiveProject('flow-draft-b')
  assert.equal(useAgentStore.getState().draft, 'B 的未发送内容')
  useAgentStore.getState().setActiveProject(null)
})

test('background Agent updates are written back to their originating conversation', () => {
  const projectId = 'flow-background-conversation'
  useAgentStore.getState().setActiveProject(projectId)
  useAgentStore.getState().reset()
  const originConversationId = useAgentStore.getState().activeConversationId
  useAgentStore.getState().addMessage({
    id: 'assistant-background-action',
    role: 'assistant',
    content: '正在生成图片',
    contextNodeIds: [],
    actions: [
      {
        id: 'generate-background-image',
        tool: 'generate_image',
        label: '生成图片',
        args: {},
      },
    ],
    createdAt: new Date().toISOString(),
  })

  const currentConversationId = useAgentStore.getState().newConversation()
  useAgentStore.getState().addMessage(userMessage('这是当前会话'))

  useAgentStore.getState().setConversationContextFor(
    projectId,
    originConversationId,
    {
      lastPrompt: '原会话提示词',
      lastGeneratedAssetIds: ['asset-background'],
    },
  )
  useAgentStore.getState().addMessageToConversation(
    projectId,
    originConversationId,
    {
      id: 'background-failure',
      role: 'assistant',
      content: '原会话的后台任务失败',
      contextNodeIds: [],
      createdAt: new Date().toISOString(),
    },
  )
  useAgentStore.getState().addActionResultsToConversation(
    projectId,
    originConversationId,
    'assistant-background-action',
    [{
      callId: 'generate-background-image',
      tool: 'generate_image',
      ok: true,
      summary: '任务已经提交',
    }],
  )

  assert.equal(useAgentStore.getState().activeConversationId, currentConversationId)
  assert.equal(useAgentStore.getState().messages.length, 1)
  assert.equal(useAgentStore.getState().messages[0]?.content, '这是当前会话')
  assert.deepEqual(useAgentStore.getState().conversationContext, {})

  useAgentStore.getState().openConversation(originConversationId)
  const originState = useAgentStore.getState()
  assert.equal(originState.conversationContext.lastPrompt, '原会话提示词')
  assert.deepEqual(
    originState.conversationContext.lastGeneratedAssetIds,
    ['asset-background'],
  )
  assert.equal(
    originState.messages.some((message) => message.id === 'background-failure'),
    true,
  )
  assert.equal(
    originState.messages
      .find((message) => message.id === 'assistant-background-action')
      ?.actionResults?.[0]?.callId,
    'generate-background-image',
  )
})

test('targeted Agent updates survive a project switch and de-duplicate tool results', () => {
  const originProjectId = 'flow-background-project-a'
  useAgentStore.getState().setActiveProject(originProjectId)
  useAgentStore.getState().reset()
  const originConversationId = useAgentStore.getState().activeConversationId
  useAgentStore.getState().addMessage({
    id: 'assistant-project-action',
    role: 'assistant',
    content: '正在生成视频',
    contextNodeIds: [],
    actions: [{
      id: 'generate-background-video',
      tool: 'generate_video',
      label: '生成视频',
      args: {},
    }],
    createdAt: new Date().toISOString(),
  })

  useAgentStore.getState().setActiveProject('flow-background-project-b')
  useAgentStore.getState().reset()
  useAgentStore.getState().addMessage(userMessage('B 项目的当前内容'))

  const result = {
    callId: 'generate-background-video',
    tool: 'generate_video' as const,
    ok: true,
    summary: '视频任务已经提交',
  }
  useAgentStore.getState().addActionResultsToConversation(
    originProjectId,
    originConversationId,
    'assistant-project-action',
    [result],
  )
  useAgentStore.getState().addActionResultsToConversation(
    originProjectId,
    originConversationId,
    'assistant-project-action',
    [result],
  )

  assert.equal(useAgentStore.getState().messages[0]?.content, 'B 项目的当前内容')
  useAgentStore.getState().setActiveProject(originProjectId)
  const actionMessage = useAgentStore
    .getState()
    .messages.find((message) => message.id === 'assistant-project-action')
  assert.equal(actionMessage?.actionResults?.length, 1)
  assert.equal(actionMessage?.actionResults?.[0]?.callId, 'generate-background-video')
})
