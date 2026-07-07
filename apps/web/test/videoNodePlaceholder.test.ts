import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('empty video node uses a centered camera icon instead of the play triangle', () => {
  const source = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')

  assert.equal(source.includes("import { Film, Video } from 'lucide-react'"), true)
  assert.equal(source.includes('video-placeholder-icon'), true)
  assert.equal(source.includes('<Play size='), false)
})
