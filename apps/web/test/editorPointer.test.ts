import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldCloseFloatingEditorOnPointerDown } from '../src/utils/editorPointer'

test('middle mouse panning does not close a floating editor', () => {
  assert.equal(
    shouldCloseFloatingEditorOnPointerDown({
      button: 1,
      isInsideEditorOwner: false,
    }),
    false,
  )
})

test('left click outside closes a floating editor', () => {
  assert.equal(
    shouldCloseFloatingEditorOnPointerDown({
      button: 0,
      isInsideEditorOwner: false,
    }),
    true,
  )
})

test('left click inside keeps a floating editor open', () => {
  assert.equal(
    shouldCloseFloatingEditorOnPointerDown({
      button: 0,
      isInsideEditorOwner: true,
    }),
    false,
  )
})
