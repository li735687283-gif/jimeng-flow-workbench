import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('all-projects modal is a large thumbnail manager without legacy workflow actions', async () => {
  const source = await readFile(
    new URL('../src/components/FlowsHistoryModal.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /project-manager-modal/)
  assert.match(source, /project-manager-grid/)
  assert.match(source, />全部项目</)
  assert.match(source, /getAssetFileUrl\(flow\.coverAssetId\)/)
  assert.match(source, />改名字</)
  assert.match(source, />删除</)
  assert.match(source, /renameFlow\(flow\.id, nextName\)/)
  assert.match(source, /deleteFlow\(flow\.id\)/)
  assert.match(source, /project-manager-rename-form/)
  assert.equal(source.includes('window.prompt'), false)
  assert.equal(source.includes('历史工作流'), false)
  assert.equal(source.includes('新建工作流'), false)
  assert.equal(source.includes('createFlow'), false)
})
