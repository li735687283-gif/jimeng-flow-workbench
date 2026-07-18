import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAgentSkillContext } from '../src/services/agent/index'

test('builds an ordered and bounded skill execution context', () => {
  const context = buildAgentSkillContext([
    {
      id: 'prompt-polish',
      label: '提示词增强',
      instruction: '补齐生成细节',
      input: 'text',
      output: 'prompt',
      steps: ['澄清目标', '补齐细节'],
    },
    {
      id: 'shot-design',
      label: '镜头设计',
      instruction: '设计镜头语言',
      input: 'text',
      output: 'prompt',
      steps: ['设计镜头', '补充光线'],
    },
    {
      id: 'storyboard',
      label: '分镜拆解',
      instruction: '拆成连续镜头',
    },
    {
      id: 'ignored',
      label: '不应出现',
      instruction: '超过技能上限',
    },
  ])

  assert.match(context, /1\. 提示词增强/)
  assert.match(context, /2\. 镜头设计/)
  assert.match(context, /3\. 分镜拆解/)
  assert.match(context, /澄清目标 → 补齐细节/)
  assert.doesNotMatch(context, /不应出现/)
})

test('ignores malformed skill selections', () => {
  assert.equal(buildAgentSkillContext(undefined), '')
  assert.equal(buildAgentSkillContext([]), '')
})
