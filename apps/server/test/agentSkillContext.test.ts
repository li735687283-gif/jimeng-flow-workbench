import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAgentToolCalls } from '../src/services/agent/index'

test('keeps valid tool calls and fills defaults', () => {
  const calls = parseAgentToolCalls([
    { id: 'a1', tool: 'generate_image', label: '生成图片：猫', args: { prompt: '猫' } },
    { tool: 'read_canvas' },
  ])

  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], {
    id: 'a1',
    tool: 'generate_image',
    label: '生成图片：猫',
    args: { prompt: '猫' },
  })
  assert.equal(calls[1].id, 'action_2')
  assert.equal(calls[1].label, 'read_canvas')
  assert.deepEqual(calls[1].args, {})
})

test('drops unknown tools and malformed entries', () => {
  const calls = parseAgentToolCalls([
    { id: 'a1', tool: 'delete_everything', label: '危险操作' },
    'not an object',
    null,
    { id: 'a2', tool: 'edit_image', label: '修改图片', args: { referenceNodeIds: ['n1'] } },
  ])

  assert.equal(calls.length, 1)
  assert.equal(calls[0].tool, 'edit_image')
})

test('non-array input yields no calls', () => {
  assert.deepEqual(parseAgentToolCalls(undefined), [])
  assert.deepEqual(parseAgentToolCalls({ tool: 'generate_image' }), [])
})
