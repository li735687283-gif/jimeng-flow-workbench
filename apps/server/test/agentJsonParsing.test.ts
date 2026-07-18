import assert from 'node:assert/strict'
import test from 'node:test'

import { AgentError, extractJson, parseAgentResponse } from '../src/services/agent/index.ts'

test('extractJson accepts fenced JSON with raw newlines and trailing commas', () => {
  const parsed = extractJson(`模型输出如下：
\`\`\`json
{
  "reasoning": "第一行
第二行",
  "intent": "image",
  "optimizedPrompt": "长城上的人物",
  "proposedActions": [
    { "id": "action_1", "type": "create_prompt_node", "label": "创建节点", },
  ],
}
\`\`\`
请查收`) as Record<string, unknown>

  assert.equal(parsed.intent, 'image')
  assert.equal(parsed.reasoning, '第一行\n第二行')
  assert.equal(parsed.optimizedPrompt, '长城上的人物')
})

test('extractJson finds the first balanced object instead of swallowing suffix text', () => {
  const parsed = extractJson('说明 {"intent":"image","optimizedPrompt":"长城"} 后续 {not json}') as Record<string, unknown>
  assert.equal(parsed.optimizedPrompt, '长城')
})

test('extractJson unwraps OpenAI-compatible content blocks and encoded JSON strings', () => {
  const wrapped = JSON.stringify({
    content: [
      {
        type: 'text',
        text: JSON.stringify(JSON.stringify({
          intent: 'image',
          optimized_prompt: '白色背景中的护肤品商业海报',
        })),
      },
    ],
  })

  const parsed = extractJson(wrapped) as Record<string, unknown>
  assert.equal(parsed.intent, 'image')
  assert.equal(parsed.optimized_prompt, '白色背景中的护肤品商业海报')
})

test('extractJson repairs unescaped quotes inside generated prompt strings', () => {
  const parsed = extractJson(
    '{"intent":"image","optimizedPrompt":"瓶身印有"FLOW"字样，置于白色展台"}',
  ) as Record<string, unknown>

  assert.equal(parsed.optimizedPrompt, '瓶身印有"FLOW"字样，置于白色展台')
})

test('parseAgentResponse accepts common snake_case aliases', () => {
  const response = parseAgentResponse({
    reason: '商业海报任务',
    analysis: '突出产品和品牌质感',
    intent: 'image',
    optimized_prompt: '极简商业产品海报，柔和棚拍光线',
    negative_prompt: '低清晰度, 文字变形',
    suggested_params: { aspectRatio: '3:4' },
    proposed_actions: [],
  }, ['node_1'], 'raw')

  assert.equal(response.reasoning, '商业海报任务')
  assert.equal(response.thinking, '突出产品和品牌质感')
  assert.equal(response.optimizedPrompt, '极简商业产品海报，柔和棚拍光线')
  assert.equal(response.negativePrompt, '低清晰度, 文字变形')
  assert.deepEqual(response.suggestedParams, { aspectRatio: '3:4' })
  assert.deepEqual(response.usedContextNodeIds, ['node_1'])
})

test('extractJson parse errors never expose raw model output', () => {
  assert.throws(
    () => extractJson('{"reasoning":"内部分析和用户提示词'),
    (error: unknown) =>
      error instanceof AgentError
      && error.code === 'PARSE_FAILED'
      && !error.message.includes('内部分析'),
  )
})
