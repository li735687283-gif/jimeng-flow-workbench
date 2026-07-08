import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as editorPointer from '../src/utils/editorPointer'

const { shouldCloseFloatingEditorOnPointerDown } = editorPointer

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

test('left click outside an open floating menu closes only the menu layer', () => {
  const shouldCloseFloatingMenuOnPointerDown = (
    editorPointer as Record<string, unknown>
  ).shouldCloseFloatingMenuOnPointerDown as
    | ((state: {
        button: number
        isMenuOpen: boolean
        isInsideMenuRoot: boolean
      }) => boolean)
    | undefined

  assert.equal(typeof shouldCloseFloatingMenuOnPointerDown, 'function')
  assert.equal(
    shouldCloseFloatingMenuOnPointerDown?.({
      button: 0,
      isMenuOpen: true,
      isInsideMenuRoot: false,
    }),
    true,
  )
  assert.equal(
    shouldCloseFloatingMenuOnPointerDown?.({
      button: 0,
      isMenuOpen: true,
      isInsideMenuRoot: true,
    }),
    false,
  )
  assert.equal(
    shouldCloseFloatingMenuOnPointerDown?.({
      button: 1,
      isMenuOpen: true,
      isInsideMenuRoot: false,
    }),
    false,
  )
  assert.equal(
    shouldCloseFloatingMenuOnPointerDown?.({
      button: 0,
      isMenuOpen: false,
      isInsideMenuRoot: false,
    }),
    false,
  )
})
