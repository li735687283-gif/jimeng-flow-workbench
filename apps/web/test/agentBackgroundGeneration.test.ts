import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { AgentToolResult } from '@jimeng-flow/shared/agentMessage'
import { shouldFinishAgentTurnAfterToolResults } from '../src/utils/agentExecution'

const panelSource = readFileSync('apps/web/src/components/AgentPanel.tsx', 'utf8')

function result(
  tool: AgentToolResult['tool'],
  ok = true,
): AgentToolResult {
  return {
    callId: `call_${tool}`,
    tool,
    ok,
    summary: ok ? '已提交' : '提交失败',
  }
}

test('successful background media submissions finish the Agent turn', () => {
  assert.equal(
    shouldFinishAgentTurnAfterToolResults([result('generate_image')]),
    true,
  )
  assert.equal(
    shouldFinishAgentTurnAfterToolResults([result('generate_video')]),
    true,
  )
  assert.equal(
    shouldFinishAgentTurnAfterToolResults([result('edit_image')]),
    true,
  )
})

test('read-only actions and failed media submissions keep the Agent loop available', () => {
  assert.equal(
    shouldFinishAgentTurnAfterToolResults([result('read_canvas')]),
    false,
  )
  assert.equal(
    shouldFinishAgentTurnAfterToolResults([
      result('read_canvas'),
      result('generate_image', false),
    ]),
    false,
  )
})

test('auto and manual Agent flows stop after handing media work to the canvas', () => {
  assert.match(
    panelSource,
    /if \(shouldFinishAgentTurnAfterToolResults\(results\)\) break/,
  )
  assert.match(
    panelSource,
    /if \(!shouldFinishAgentTurnAfterToolResults\(results\)\) \{\s*await runAgentLoop\(true\)\s*\}/,
  )
})
