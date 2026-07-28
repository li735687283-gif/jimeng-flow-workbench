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

test('index.css 节点阴影令牌统一为 none（画布节点不使用阴影）', () => {
  assert.match(indexCss, /--node-shadow:\s*none;/)
  assert.match(indexCss, /--node-shadow-hover:\s*none;/)
  assert.match(indexCss, /--node-shadow-selected:\s*none;/)
})

test('所有 node-card 规则不出现实阴影，只允许令牌/none/选中内描线', () => {
  const blocks = nodeCardBlocks()
  assert.ok(blocks.length > 0)

  for (const block of blocks) {
    for (const decl of block.matchAll(/box-shadow:\s*([^;]+);/g)) {
      const value = decl[1].replace('!important', '').trim()
      // 只允许：统一令牌、none，或选中描边 ::after 上的单层内描线
      const allowed =
        /^var\(--node-shadow(-hover|-selected)?\)$/.test(value) ||
        value === 'none' ||
        /^inset 0 0 0 1px /.test(value)
      assert.ok(allowed, `node-card 规则存在实阴影：${value}\n${block.slice(0, 120)}`)
    }
  }
})

test('节点的 rest/hover/selected 三态都引用统一令牌', () => {
  const rest = appCss.match(/\.node-card \{[^}]*\}/)
  assert.ok(rest)
  assert.match(rest[0], /box-shadow: var\(--node-shadow\);/)

  const hover = appCss.match(/\.node-wrapper:hover \.node-card \{[^}]*\}/)
  assert.ok(hover)
  assert.match(hover[0], /box-shadow: var\(--node-shadow-hover\);/)

  const selected = appCss.match(/\.node-wrapper\.selected \.node-card \{[^}]*\}/)
  assert.ok(selected)
  assert.match(selected[0], /box-shadow: var\(--node-shadow-selected\);/)

  const media = appCss.match(
    /\.node-wrapper\.media-display \.node-card,[\s\S]*?\.node-wrapper\.media-display\.status-error \.node-card \{[^}]*\}/,
  )
  assert.ok(media)
  assert.match(media[0], /box-shadow: var\(--node-shadow\);/)

  const textRest = appCss.match(
    /\.node-wrapper\[data-flow-node-type='text'\] \.node-card \{[^}]*\}/,
  )
  assert.ok(textRest)
  assert.match(textRest[0], /box-shadow: var\(--node-shadow\) !important;/)
})
