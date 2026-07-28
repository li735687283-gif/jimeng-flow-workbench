import test from 'node:test'
import assert from 'node:assert/strict'
import { getUserFacingErrorMessage } from '../src/utils/userFacingError'

test('network fetch errors become an actionable Chinese message', () => {
  assert.equal(
    getUserFacingErrorMessage(new TypeError('Failed to fetch'), '操作失败'),
    '无法连接服务，请确认后端已启动',
  )
  assert.equal(
    getUserFacingErrorMessage(new Error('fetch failed'), '操作失败'),
    '无法连接服务，请确认后端已启动',
  )
})

test('specific backend errors and empty fallbacks stay readable', () => {
  assert.equal(getUserFacingErrorMessage(new Error('工作流不存在'), '打开失败'), '工作流不存在')
  assert.equal(getUserFacingErrorMessage('', '打开失败'), '打开失败')
})
