import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Agent composer separates continuous canvas picking from the skill library', () => {
  const source = readFileSync(
    'apps/web/src/components/AgentPanel.tsx',
    'utf8',
  )
  const styles = readFileSync('apps/web/src/App.css', 'utf8')

  assert.match(source, /<MousePointer2 size=\{14\} \/>/)
  assert.match(source, /<Blocks size=\{14\} \/>/)
  assert.match(source, /agent-round-btn agent-canvas-pick-btn/)
  assert.doesNotMatch(source, /连续点选画布节点/)
  assert.match(source, /aria-pressed=\{pickingCanvasNode\}/)
  assert.match(source, /aria-label="打开技能库"/)
  assert.match(source, /aria-haspopup="dialog"/)
  assert.match(source, /target\?\.closest\('\[data-flow-node-id\]'\)/)
  assert.match(source, /ids\.includes\(nodeId\) \? ids : \[\.\.\.ids, nodeId\]/)

  const pickHandler = source.slice(
    source.indexOf('const handlePick ='),
    source.indexOf('const handleCancel ='),
  )
  assert.doesNotMatch(pickHandler, /setPickingCanvasNode\(false\)/)

  assert.equal(
    source.indexOf('<MousePointer2 size={14} />') <
      source.indexOf('aria-label="打开技能库"'),
    true,
  )
  assert.doesNotMatch(source, /actionMenuOpen|agent-action-menu/)
  assert.match(styles, /\.agent-pick-node-active \[data-flow-node-id\] \.node-card/)
  assert.match(styles, /\.agent-canvas-pick-btn\.active/)
  assert.match(styles, /background: #f2f2f2/)
  assert.match(styles, /color: #151515/)
  assert.doesNotMatch(styles, /agent-pick-image-active|agent-action-option/)
})
