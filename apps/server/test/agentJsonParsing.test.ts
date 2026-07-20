import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AgentError,
  extractJson,
  parseAgentChatResponse,
  parseAgentChatResponseOrFallback,
} from '../src/services/agent/index.ts'

test('extractJson accepts fenced JSON with raw newlines and trailing commas', () => {
  const parsed = extractJson(`模型输出如下：
\`\`\`json
{
  "message": "第一行
第二行",
  "actions": [
    { "id": "action_1", "tool": "generate_image", "label": "生成图片", "args": {}, },
  ],
}
\`\`\`
请查收`) as Record<string, unknown>

  assert.equal(parsed.message, '第一行\n第二行')
  assert.equal((parsed.actions as unknown[]).length, 1)
})

test('extractJson finds the first balanced object instead of swallowing suffix text', () => {
  const parsed = extractJson('说明 {"message":"你好","actions":[]} 后续 {not json}') as Record<string, unknown>
  assert.equal(parsed.message, '你好')
})

test('extractJson unwraps OpenAI-compatible content blocks and encoded JSON strings', () => {
  const wrapped = JSON.stringify({
    content: [
      {
        type: 'text',
        text: JSON.stringify(JSON.stringify({
          message: '好的，我来生成',
          actions: [],
        })),
      },
    ],
  })

  const parsed = extractJson(wrapped) as Record<string, unknown>
  assert.equal(parsed.message, '好的，我来生成')
})

test('extractJson repairs unescaped quotes inside generated strings', () => {
  const parsed = extractJson(
    '{"message":"瓶身印有"FLOW"字样很好看","actions":[]}',
  ) as Record<string, unknown>

  assert.equal(parsed.message, '瓶身印有"FLOW"字样很好看')
})

test('extractJson parse errors never expose raw model output', () => {
  assert.throws(
    () => extractJson('{"message":"内部分析和用户提示词'),
    (error: unknown) =>
      error instanceof AgentError
      && error.code === 'PARSE_FAILED'
      && !error.message.includes('内部分析'),
  )
})

test('parseAgentChatResponse returns message and valid actions', () => {
  const response = parseAgentChatResponse({
    message: ' 我来帮你画一张猫 ',
    actions: [
      { id: 'a1', tool: 'generate_image', label: '生成图片：猫', args: { prompt: '一只猫' } },
      { id: 'a2', tool: 'fly_to_moon', label: '未知工具' },
      'garbage',
    ],
  }, 'raw')

  assert.equal(response.message, '我来帮你画一张猫')
  assert.equal(response.actions.length, 1)
  assert.deepEqual(response.actions[0], {
    id: 'a1',
    tool: 'generate_image',
    label: '生成图片：猫',
    args: { prompt: '一只猫' },
  })
  assert.equal(response.rawLlmResponse, 'raw')
})

test('parseAgentChatResponse rejects empty message', () => {
  assert.throws(
    () => parseAgentChatResponse({ message: '  ', actions: [] }),
    (error: unknown) =>
      error instanceof AgentError && error.code === 'PARSE_FAILED',
  )
  assert.throws(
    () => parseAgentChatResponse(['not an object']),
    (error: unknown) =>
      error instanceof AgentError && error.code === 'PARSE_FAILED',
  )
})

test('parseAgentChatResponseOrFallback degrades plain prose to a chat reply', () => {
  const response = parseAgentChatResponseOrFallback(
    '你好呀！今天心情不错的话，我们可以随便聊聊，比如聊聊电影、音乐，或者你最近的创作灵感。',
  )
  assert.equal(response.actions.length, 0)
  assert.match(response.message, /今天心情不错/)
})

test('parseAgentChatResponseOrFallback still throws on broken JSON attempts', () => {
  assert.throws(
    () => parseAgentChatResponseOrFallback('{"message":"写到一半的 JSON'),
    (error: unknown) =>
      error instanceof AgentError && error.code === 'PARSE_FAILED',
  )
  assert.throws(
    () => parseAgentChatResponseOrFallback('```json\n{"message":"坏的```'),
    (error: unknown) =>
      error instanceof AgentError && error.code === 'PARSE_FAILED',
  )
})

test('parseAgentChatResponseOrFallback parses valid protocol output', () => {
  const response = parseAgentChatResponseOrFallback(
    '{"message":"好的","actions":[{"id":"a1","tool":"read_canvas","label":"读取画布","args":{}}]}',
  )
  assert.equal(response.message, '好的')
  assert.equal(response.actions[0]?.tool, 'read_canvas')
})
