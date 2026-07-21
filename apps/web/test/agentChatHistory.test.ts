import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AgentMessage } from '@jimeng-flow/shared/agentMessage'
import { buildAgentChatHistory } from '../src/state/agentStore'

function message(partial: Partial<AgentMessage> & Pick<AgentMessage, 'role' | 'content'>): AgentMessage {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`,
    contextNodeIds: [],
    createdAt: new Date().toISOString(),
    ...partial,
  }
}

test('buildAgentChatHistory keeps user and assistant turns in order', () => {
  const history = buildAgentChatHistory([
    message({ role: 'user', content: '画一只猫' }),
    message({ role: 'assistant', content: '好的' }),
    message({ role: 'user', content: '再画一只狗' }),
  ])

  assert.deepEqual(
    history.map((turn) => [turn.role, turn.content]),
    [
      ['user', '画一只猫'],
      ['assistant', '好的'],
      ['user', '再画一只狗'],
    ],
  )
})

test('buildAgentChatHistory carries tool calls and results', () => {
  const history = buildAgentChatHistory([
    message({
      role: 'assistant',
      content: '我来生成',
      actions: [{ id: 'a1', tool: 'generate_image', label: '生成图片', args: { prompt: '猫' } }],
      actionResults: [
        { callId: 'a1', tool: 'generate_image', ok: true, summary: '已创建节点 n1' },
      ],
    }),
  ])

  // 助手回合带工具调用，随后的用户回合带工具结果（服务端要求最后是 user）
  assert.equal(history.length, 2)
  assert.equal(history[0]?.role, 'assistant')
  assert.equal(history[0]?.actions?.[0]?.tool, 'generate_image')
  assert.equal(history[1]?.role, 'user')
  assert.equal(history[1]?.toolResults?.[0]?.summary, '已创建节点 n1')
  // 回执必须明确标注"不是用户的新消息",否则模型会把已执行的工具再执行一遍
  assert.match(history[1]?.content, /工具执行回执/)
  assert.match(history[1]?.content, /不是用户的新消息/)
})

test('buildAgentChatHistory drops system messages', () => {
  const history = buildAgentChatHistory([
    message({ role: 'system', content: '内部提示' }),
    message({ role: 'user', content: '你好' }),
  ])

  assert.equal(history.length, 1)
  assert.equal(history[0]?.role, 'user')
})

test('buildAgentChatHistory writes @-mentioned node ids into the user text', () => {
  // 引用关系只在结构化字段里,模型看不到;必须拼进文本
  const history = buildAgentChatHistory([
    message({ role: 'user', content: '把这张图做成视频', contextNodeIds: ['image-abc', 'video-def'] }),
    message({ role: 'assistant', content: '好的', contextNodeIds: ['image-ignored'] }),
  ])

  assert.match(history[0]?.content ?? '', /把这张图做成视频/)
  assert.match(history[0]?.content ?? '', /用户引用的画布节点 id：image-abc、video-def/)
  // 助手消息不拼引用后缀
  assert.equal(history[1]?.content, '好的')
})
