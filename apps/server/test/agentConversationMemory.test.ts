import assert from 'node:assert/strict'
import test from 'node:test'
import { buildConversationText } from '../src/services/agent/index'

test('renders user and assistant turns as dialogue', () => {
  const text = buildConversationText([
    { role: 'user', content: '画一只猫' },
    { role: 'assistant', content: '好的，我来生成' },
    { role: 'user', content: '再画一张狗的' },
  ])

  assert.match(text, /用户：画一只猫/)
  assert.match(text, /助手：好的，我来生成/)
  assert.match(text, /用户：再画一张狗的/)
})

test('includes tool calls and tool results in the transcript', () => {
  const text = buildConversationText([
    {
      role: 'assistant',
      content: '我来创建图片节点',
      actions: [
        { id: 'a1', tool: 'generate_image', label: '生成图片：猫', args: {} },
      ],
    },
    {
      role: 'user',
      content: '继续',
      toolResults: [
        { callId: 'a1', tool: 'generate_image', ok: true, summary: '已创建节点 node_1 并提交生成' },
      ],
    },
  ])

  assert.match(text, /助手请求执行工具：generate_image（生成图片：猫）/)
  assert.match(text, /工具结果（generate_image）：成功 — 已创建节点 node_1 并提交生成/)
})

test('keeps only the most recent turns', () => {
  const history = Array.from({ length: 30 }, (_, index) => ({
    role: 'user' as const,
    content: `第 ${index + 1} 条`,
  }))
  const text = buildConversationText(history)

  assert.doesNotMatch(text, /第 1 条/)
  assert.match(text, /第 30 条/)
})
