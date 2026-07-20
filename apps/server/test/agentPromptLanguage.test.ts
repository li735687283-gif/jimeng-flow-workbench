import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildCanvasContext } from '../src/services/agent/index.ts'

test('empty canvas is described as having no nodes', () => {
  const context = buildCanvasContext({ history: [], canvas: [] })
  assert.match(context, /画布为空/)
})

test('canvas context lists node ids, types, prompts and statuses', () => {
  const context = buildCanvasContext({
    history: [],
    canvas: [
      { id: 'node_1', type: 'image', title: '猫咪海报', prompt: '一只猫', status: 'success' },
      { id: 'node_2', type: 'video', title: '视频节点 2' },
    ],
  })

  assert.match(context, /node_1（image）「猫咪海报」/)
  assert.match(context, /提示词：一只猫/)
  assert.match(context, /状态：success/)
  assert.match(context, /node_2（video）/)
})

test('canvas context truncates long prompts', () => {
  const context = buildCanvasContext({
    history: [],
    canvas: [
      { id: 'node_1', type: 'image', title: '长提示词', prompt: '猫'.repeat(500) },
    ],
  })
  assert.ok(context.length < 400)
})

test('agent service uses a generous LLM timeout for slow CLI providers', () => {
  const source = readFileSync('apps/server/src/services/agent/index.ts', 'utf8')
  // Codex CLI 冷启动经常超过 90s,统一放宽到 5 分钟并允许环境变量覆盖
  assert.match(source, /MOK_AGENT_LLM_TIMEOUT_MS/)
  assert.match(source, /300_000/)
  assert.match(source, /timeoutMs: AGENT_LLM_TIMEOUT_MS/)
  assert.doesNotMatch(source, /timeoutMs: 90_000/)
})

test('agent system prompt documents model args and video workflows', () => {
  const source = readFileSync('apps/server/src/services/agent/index.ts', 'utf8')
  // 工具支持 model 参数,图片/视频模型绝不混用
  assert.match(source, /model\(可选\):从可用的图片模型 id 中选一个/)
  assert.match(source, /model\(可选\):从可用的视频模型 id 中选一个/)
  assert.match(source, /图片模型和视频模型是两套独立列表,绝不能混用/)
  // 大白话 → 视频提示词;不满意 → 引用视频节点 id 在原节点重新生成
  assert.match(source, /替他改写成专业的视频提示词/)
  assert.match(source, /新视频会在原节点上重新生成/)
  assert.match(source, /视频会在原节点上重新生成/)
})
