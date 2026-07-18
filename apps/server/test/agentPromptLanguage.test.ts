import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAgentSystemPrompt } from '../src/services/agent/index.ts'

test('Agent system prompt requires Chinese for every generated prompt field', () => {
  const systemPrompt = buildAgentSystemPrompt('general', '当前工作台能力', '用户技能说明')
  const languageRule = systemPrompt.slice(systemPrompt.lastIndexOf('输出语言要求'))

  assert.match(languageRule, /优先级最高/)
  assert.match(languageRule, /optimizedPrompt/)
  assert.match(languageRule, /negativePrompt/)
  assert.match(languageRule, /storyboard\.style/)
  assert.match(languageRule, /storyboard\.items\[\]\.shotDescription/)
  assert.match(languageRule, /storyboard\.items\[\]\.prompt/)
  assert.match(languageRule, /必须使用简体中文/)
  assert.match(languageRule, /用户输入英文/)
})

test('Chinese prompt requirement remains the final system instruction after skills', () => {
  const systemPrompt = buildAgentSystemPrompt('director', '能力说明', '技能可能包含英文提示词')
  assert.match(systemPrompt, /技能可能包含英文提示词\n\n输出语言要求/)
})
