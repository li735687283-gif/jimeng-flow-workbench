import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { Jimp } from 'jimp'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

test('Windows desktop build uses a circular transparent cat icon', async () => {
  const icon = packageJson.build?.win?.icon

  assert.equal(icon, 'image/app-icon-cat-round.png')
  assert.ok(existsSync(icon), 'Windows 应用图标不存在：' + icon)

  const bitmap = await Jimp.read(icon)
  assert.equal(bitmap.bitmap.width, 512)
  assert.equal(bitmap.bitmap.height, 512)
  for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) {
    assert.equal(bitmap.getPixelColor(x, y) & 0xff, 0)
  }
  assert.ok((bitmap.getPixelColor(256, 256) & 0xff) >= 250)
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
