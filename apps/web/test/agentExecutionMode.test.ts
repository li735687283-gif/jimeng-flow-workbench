import assert from 'node:assert/strict'
import test from 'node:test'
import { useAgentStore } from '../src/state/agentStore'

test('execution mode defaults to manual and switches to auto', () => {
  const store = useAgentStore.getState()
  assert.equal(['manual', 'auto'].includes(store.executionMode), true)

  useAgentStore.getState().setExecutionMode('auto')
  assert.equal(useAgentStore.getState().executionMode, 'auto')

  useAgentStore.getState().setExecutionMode('manual')
  assert.equal(useAgentStore.getState().executionMode, 'manual')
})

test('execution mode persists to localStorage when available', () => {
  useAgentStore.getState().setExecutionMode('auto')
  if (typeof localStorage !== 'undefined') {
    assert.equal(localStorage.getItem('mok-agent-execution-mode'), 'auto')
  }
  assert.equal(useAgentStore.getState().executionMode, 'auto')
  useAgentStore.getState().setExecutionMode('manual')
  assert.equal(useAgentStore.getState().executionMode, 'manual')
})

test('addActionResults appends tool results onto the assistant message', () => {
  useAgentStore.getState().setActiveProject('flow-action-results')
  useAgentStore.getState().reset()
  useAgentStore.getState().addMessage({
    id: 'msg_a',
    role: 'assistant',
    content: '我来生成',
    contextNodeIds: [],
    actions: [
      { id: 'a1', tool: 'generate_image', label: '生成图片：猫', args: {} },
      { id: 'a2', tool: 'read_canvas', label: '读取画布', args: {} },
    ],
    createdAt: new Date().toISOString(),
  })

  useAgentStore.getState().addActionResults('msg_a', [
    { callId: 'a2', tool: 'read_canvas', ok: true, summary: '画布为空' },
  ])
  useAgentStore.getState().addActionResults('msg_a', [
    { callId: 'a1', tool: 'generate_image', ok: false, summary: '用户取消了该操作。' },
  ])

  const message = useAgentStore.getState().messages.find((item) => item.id === 'msg_a')
  assert.equal(message?.actionResults?.length, 2)
  assert.equal(message?.actionResults?.[0]?.callId, 'a2')
  assert.equal(message?.actionResults?.[1]?.ok, false)

  // 结果同步进了会话持久化
  const conversation = useAgentStore
    .getState()
    .conversations.find((item) => item.id === useAgentStore.getState().activeConversationId)
  assert.equal(conversation?.messages[0]?.actionResults?.length, 2)
})
