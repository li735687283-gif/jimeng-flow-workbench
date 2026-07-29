import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  deleteSelection,
  insertTextAtSelection,
} from '../src/utils/textEditActions'

test('insertTextAtSelection replaces the current selection and places caret after inserted text', () => {
  const replaced = insertTextAtSelection('hello world', 6, 11, '画布')
  assert.deepEqual(replaced, { value: 'hello 画布', caret: 8 })

  const appended = insertTextAtSelection('abc', 3, 3, 'de')
  assert.deepEqual(appended, { value: 'abcde', caret: 5 })

  const clamped = insertTextAtSelection('abc', 10, 20, 'x')
  assert.deepEqual(clamped, { value: 'abcx', caret: 4 })

  const reversed = insertTextAtSelection('abc', 2, 1, 'x')
  assert.deepEqual(reversed, { value: 'abxc', caret: 3 })
})

test('deleteSelection removes the selected range and keeps caret at selection start', () => {
  const removed = deleteSelection('hello world', 0, 6)
  assert.deepEqual(removed, { value: 'world', caret: 0 })

  const collapsed = deleteSelection('abc', 2, 2)
  assert.deepEqual(collapsed, { value: 'abc', caret: 2 })
})

test('prompt editor exposes a dark themed context menu with paste via clipboard api', async () => {
  const source = await readFile(
    new URL('../src/components/PromptEditor.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /onContextMenu=\{handleContextMenu\}/)
  assert.match(source, /event\.preventDefault\(\)/)
  assert.match(source, /event\.stopPropagation\(\)/)
  assert.match(source, /<ViewportMenuPortal/)
  assert.match(source, /className="context-menu"/)
  assert.match(source, /navigator\.clipboard\.readText\(\)/)
  assert.match(source, /navigator\.clipboard\.writeText/)
  assert.match(source, /insertTextAtSelection/)
  assert.match(source, /deleteSelection/)
  assert.match(source, /粘贴/)
  assert.match(source, /复制/)
  assert.match(source, /剪切/)
  assert.match(source, /全选/)
  assert.match(source, /Ctrl\+V/)
})
