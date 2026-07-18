import assert from 'node:assert/strict'
import test from 'node:test'

import { AgentError, extractJson } from '../src/services/agent/index.ts'

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

test('extractJson parse errors never expose raw model output', () => {
  assert.throws(
    () => extractJson('{"reasoning":"内部分析和用户提示词'),
    (error: unknown) =>
      error instanceof AgentError
      && error.code === 'PARSE_FAILED'
      && !error.message.includes('内部分析'),
  )
})
