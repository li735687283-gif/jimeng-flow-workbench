import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexCss = readFileSync('apps/web/src/index.css', 'utf8')
const appCss = readFileSync('apps/web/src/App.css', 'utf8')

function nodeCardBlocks(): string[] {
  const blocks: string[] = []
  for (const match of appCss.matchAll(/\.[^{]*node-card[^{]*\{([^}]*)\}/g)) {
    blocks.push(match[0])
  }
  return blocks
}

test('index.css 定义统一的节点阴影令牌', () => {
  assert.match(indexCss, /--node-shadow:\s*0 8px 24px rgba\(0, 0, 0, 0\.35\)/)
  assert.match(indexCss, /--node-shadow-hover:\s*0 12px 30px rgba\(0, 0, 0, 0\.42\)/)
  assert.match(indexCss, /--node-shadow-selected:/)

  // 基础与 hover 令牌必须是单层阴影（去掉 rgba() 后无逗号叠加）
  const layerCount = (value: string) =>
    value.replace(/rgba?\([^)]*\)/g, '').split(',').length
  const base = indexCss.match(/--node-shadow:\s*([^;]+);/)
  const hover = indexCss.match(/--node-shadow-hover:\s*([^;]+);/)
  assert.ok(base && hover)
  assert.equal(base[1].includes('0 0'), false)
  assert.equal(layerCount(base[1]), 1)
  assert.equal(layerCount(hover[1]), 1)
})

test('所有 node-card 规则统一引用阴影令牌，无多层叠加或裸值', () => {
  const blocks = nodeCardBlocks()
  assert.ok(blocks.length > 0)

  for (const block of blocks) {
    for (const decl of block.matchAll(/box-shadow:\s*([^;]+);/g)) {
      const value = decl[1].replace('!important', '').trim()
      // 只允许：统一令牌，或选中描边 ::after 上的单层内描线
      const allowed =
        /^var\(--node-shadow(-hover|-selected)?\)$/.test(value) ||
        /^inset 0 0 0 1px /.test(value)
      assert.ok(allowed, `node-card 规则存在非令牌阴影：${value}\n${block.slice(0, 120)}`)
    }
  }
})

test('节点的 rest/hover/selected 三态都有且仅有一层阴影', () => {
  // rest：基础卡片不再是 box-shadow: none
  const rest = appCss.match(/\.node-card \{[^}]*\}/)
  assert.ok(rest)
  assert.match(rest[0], /box-shadow: var\(--node-shadow\);/)

  const hover = appCss.match(/\.node-wrapper:hover \.node-card \{[^}]*\}/)
  assert.ok(hover)
  assert.match(hover[0], /box-shadow: var\(--node-shadow-hover\);/)

  const selected = appCss.match(/\.node-wrapper\.selected \.node-card \{[^}]*\}/)
  assert.ok(selected)
  assert.match(selected[0], /box-shadow: var\(--node-shadow-selected\);/)

  // 媒体展示节点（图片/视频出图后）同样带统一基础阴影
  const media = appCss.match(
    /\.node-wrapper\.media-display \.node-card,[\s\S]*?\.node-wrapper\.media-display\.status-error \.node-card \{[^}]*\}/,
  )
  assert.ok(media)
  assert.match(media[0], /box-shadow: var\(--node-shadow\);/)

  // 文本节点不再强制无阴影
  const textRest = appCss.match(
    /\.node-wrapper\[data-flow-node-type='text'\] \.node-card \{[^}]*\}/,
  )
  assert.ok(textRest)
  assert.match(textRest[0], /box-shadow: var\(--node-shadow\) !important;/)
  assert.doesNotMatch(textRest[0], /box-shadow: none/)
})
