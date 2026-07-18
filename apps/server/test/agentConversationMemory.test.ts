import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUserMessage } from '../src/services/agent/index'

test('Agent user message includes only the current conversation history', () => {
  const message = buildUserMessage(
    '继续做成竖版',
    ['node_1'],
    'node_2',
    [
      { role: 'user', content: '做一张夏日海报' },
      { role: 'assistant', content: '已经给出第一版提示词' },
    ],
  )

  assert.match(message, /同一对话的最近上下文/)
  assert.match(message, /用户：做一张夏日海报/)
  assert.match(message, /助手：已经给出第一版提示词/)
  assert.match(message, /继续做成竖版/)
  assert.match(message, /node_1/)
  assert.match(message, /node_2/)
})

test('A new Agent conversation sends no old conversation context', () => {
  const message = buildUserMessage('从头设计一个角色', [], undefined, [])
  assert.equal(message, '从头设计一个角色')
  assert.doesNotMatch(message, /同一对话的最近上下文/)
})
