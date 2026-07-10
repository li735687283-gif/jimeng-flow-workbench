import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('empty video node uses a centered camera icon instead of the play triangle', () => {
  const source = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')

  assert.match(source, /import \{[^}]*\bVideo\b[^}]*\} from 'lucide-react'/)
  assert.equal(source.includes('video-placeholder-icon'), true)
  assert.equal(source.includes('<Video'), true)
  assert.equal(source.includes('<Play size='), false)
  // 生成中隐藏摄像机占位图标，只保留进度条
  assert.match(source, /\{\s*!running\s*\?\s*\(/)
  assert.match(source, /video-placeholder-icon/)
})
