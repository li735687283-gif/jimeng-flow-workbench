import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('create and open project failures are shown to the user', async () => {
  const source = await readFile('apps/web/src/App.tsx', 'utf8')
  assert.equal(source.includes('setOperationError('), true)
  assert.equal(source.includes('新建画布失败：'), true)
  assert.equal(source.includes('打开项目失败：'), true)
  assert.equal(source.includes('className="app-operation-error" role="alert"'), true)
  assert.equal(source.includes('getUserFacingErrorMessage'), true)
})

test('VideoComposer localizes fetch failures before showing node errors', async () => {
  const source = await readFile('apps/web/src/components/VideoComposer.tsx', 'utf8')
  assert.equal(
    source.split("getUserFacingErrorMessage(err, '视频生成失败')").length - 1,
    2,
  )
})
