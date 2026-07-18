import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepareAgentImagePrompt } from '../src/utils/agentImagePrompt'

test('Agent image prompts are platform-safe and bounded before generation', () => {
  const prompt = [
    'Full body cyberpunk female cyborg character, sexy and curvy athletic body,',
    'deep V cutout from chest to abdomen, high slit to waist, seductive pose,',
    'silver mechanical arm, neon blue and magenta lighting, detailed concept art.',
    'additional material and lighting detail. '.repeat(40),
  ].join(' ')

  const prepared = prepareAgentImagePrompt(prompt)

  assert.ok(prepared.length <= 800)
  assert.match(prepared, /cyberpunk female cyborg/i)
  assert.match(prepared, /mechanical arm/i)
  assert.doesNotMatch(
    prepared,
    /sexy|curvy|deep\s*v|chest|high\s*slit|seductive/i,
  )
})

test('Agent image prompt cleanup rewrites explicit Chinese wording', () => {
  const prepared = prepareAgentImagePrompt(
    '超性感女性角色，胸口深V，服装高衩，赛博朋克机械义体，霓虹灯光。',
  )

  assert.match(prepared, /赛博朋克机械义体/)
  assert.doesNotMatch(prepared, /超性感|胸口|深V|高衩/)
})
