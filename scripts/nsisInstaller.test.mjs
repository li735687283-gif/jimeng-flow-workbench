import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

test('Windows desktop build uses the same cat avatar as the home logo', () => {
  const icon = packageJson.build?.win?.icon

  assert.equal(icon, 'image/agent-avatar-black.png')
  assert.ok(existsSync(icon), 'Windows 应用图标不存在：' + icon)
})

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
  // 前台锁下的加强手段：Alt+Tab 级激活 + TOPMOST 改 Z 序
  assert.match(script, /SwitchToThisWindow/)
  assert.match(script, /SetWindowPos\(i \$HWNDPARENT, i -1,/)
  // 进入安装段后取消 TOPMOST，不永久压在其他窗口上
  assert.match(script, /!macro customInstall/)
  assert.match(script, /SetWindowPos\(i \$HWNDPARENT, i -2,/)
  // .onInit 兜底宏
  assert.match(script, /!macro customInit/)
})
