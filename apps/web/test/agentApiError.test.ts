import assert from 'node:assert/strict'
import test from 'node:test'

import { getAgentApiErrorMessage } from '../src/api/agent.ts'

test('agent parse errors hide raw model output and explain that no result was generated', () => {
  const message = getAgentApiErrorMessage(
    502,
    'Bad Gateway',
    JSON.stringify({
      code: 'PARSE_FAILED',
      message: '无法从 LLM 输出中解析 JSON：内部分析内容',
    }),
  )

  assert.equal(message, '模型返回格式异常，本次没有生成新结果。请重试或切换模型。')
  assert.equal(message.includes('内部分析'), false)
})

test('agent API errors keep useful non-parse messages', () => {
  const message = getAgentApiErrorMessage(
    502,
    'Bad Gateway',
    JSON.stringify({ code: 'LLM_CALL_FAILED', message: 'LLM 调用超时（90s）' }),
  )
  assert.equal(message, 'LLM 调用超时（90s）')
})
