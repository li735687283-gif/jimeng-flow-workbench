import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AGENT_SKILLS,
  getAgentSkillInputIssue,
  getRecommendedAgentSkillIds,
  toAgentSkillSelections,
} from '../src/utils/agentSkills'

test('recommends canvas-aware skills from the draft and referenced node types', () => {
  assert.deepEqual(
    getRecommendedAgentSkillIds('让这张图动起来，镜头慢慢推进', ['image']),
    ['shot-design', 'image-to-video', 'prompt-polish'],
  )
  assert.deepEqual(
    getRecommendedAgentSkillIds('把脚本拆成六个分镜', []),
    ['storyboard', 'prompt-polish'],
  )
})

test('reports missing canvas inputs before a skill is executed', () => {
  const imageToVideo = AGENT_SKILLS.find((skill) => skill.id === 'image-to-video')
  assert.ok(imageToVideo)
  assert.equal(
    getAgentSkillInputIssue(imageToVideo, []),
    '图片转视频需要先引用一个图片节点',
  )
  assert.equal(getAgentSkillInputIssue(imageToVideo, ['image']), null)
})

test('serializes skills in the same order the user selected them', () => {
  const selected = ['prompt-polish', 'shot-design']
    .map((id) => AGENT_SKILLS.find((skill) => skill.id === id))
    .filter((skill): skill is (typeof AGENT_SKILLS)[number] => !!skill)

  assert.deepEqual(
    toAgentSkillSelections(selected).map((skill) => skill.id),
    selected.map((skill) => skill.id),
  )
  assert.deepEqual(toAgentSkillSelections(selected)[0]?.steps, [
    '澄清创作目标',
    '补齐生成细节',
  ])
})
