import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

test('nsis installer is wired to a foreground include script', () => {
  const nsis = packageJson.build?.nsis ?? {}

  // 置顶宏按 assisted 安装器设计；若改为 oneClick 需重新评估 .nsh 钩子
  assert.equal(nsis.oneClick, false)

  const include = nsis.include
  assert.equal(typeof include, 'string')
  assert.ok(include.endsWith('.nsh'))
  assert.ok(existsSync(include), `nsis include 文件不存在：${include}`)

  const script = readFileSync(include, 'utf8')
  // 窗口创建完成后回调里置顶 + 强制前台，缺一不可
  assert.match(script, /MUI_CUSTOMFUNCTION_GUIINIT/)
  assert.match(script, /BringToFront/)
  assert.match(script, /SetForegroundWindow/)
  // .onInit 兜底宏
  assert.match(script, /!macro customInit/)
})
