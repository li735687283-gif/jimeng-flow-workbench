import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('canvas UI uses one Chinese sans-serif font family', () => {
  const globalStyles = readFileSync('apps/web/src/index.css', 'utf8')
  const appStyles = readFileSync('apps/web/src/App.css', 'utf8')
  const textNode = readFileSync('apps/web/src/nodes/TextNode.tsx', 'utf8')

  assert.match(
    globalStyles,
    /--font-ui: 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;/,
  )
  assert.match(globalStyles, /font: 13px\/1\.5 var\(--font-ui\);/)
  assert.match(globalStyles, /button,[\s\S]*font-family: var\(--font-ui\);/)
  assert.match(
    appStyles,
    /\.inspector-row \.value-mono \{[\s\S]*?font-family: inherit;/,
  )
  assert.doesNotMatch(textNode, /fontFamily: isJson \?/)
  assert.match(textNode, /fontFamily: 'inherit'/)
})
