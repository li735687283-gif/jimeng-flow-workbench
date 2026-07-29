// 宫格生成提示词回归：镜头语言多样性要求不得退化
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGridImagePrompt } from '@jimeng-flow/shared/grid'

test('buildGridImagePrompt 包含宫格规格与叙事要求', () => {
  const prompt = buildGridImagePrompt(3, 3)
  assert.match(prompt, /3×3 宫格分镜图/)
  assert.match(prompt, /叙事连贯/)
  assert.match(prompt, /同一主体、同一画风/)
  assert.match(prompt, /细白色边框/)
  assert.match(prompt, /完整的一张图/)
})

test('buildGridImagePrompt 要求镜头语言多样：景别、机位、焦距', () => {
  const prompt = buildGridImagePrompt(2, 2)
  // 避免千篇一律的中心构图
  assert.match(prompt, /避免.*中心构图/)
  // 景别混合
  assert.match(prompt, /远景/)
  assert.match(prompt, /特写/)
  // 机位多样
  assert.match(prompt, /俯视/)
  assert.match(prompt, /仰视/)
  // 焦距与景深变化
  assert.match(prompt, /长焦/)
  assert.match(prompt, /广角/)
  assert.match(prompt, /浅景深/)
})
