import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replaceGenerationSubscription } from '../src/utils/generationSubscription'

test('replacing a generation subscription cancels the old one without letting old cleanup cancel the new one', () => {
  const events: string[] = []
  const ref: { current: (() => void) | null } = { current: null }
  const cleanupOld = replaceGenerationSubscription(ref, () => events.push('old'))
  const oldManagedSubscription = ref.current
  const cleanupNew = replaceGenerationSubscription(ref, () => events.push('new'))
  const newManagedSubscription = ref.current

  assert.deepEqual(events, ['old'])
  assert.notEqual(oldManagedSubscription, newManagedSubscription)

  cleanupOld()
  assert.deepEqual(events, ['old'])
  assert.equal(ref.current, newManagedSubscription)

  cleanupNew()
  assert.deepEqual(events, ['old', 'new'])
  assert.equal(ref.current, null)
})

test('VideoNode manages both resumed and newly-created generation subscriptions through replacement cleanup', () => {
  const source = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')

  assert.match(
    source,
    /return replaceGenerationSubscription\(generationUnsubscribeRef, unsubscribe\)/,
  )
  assert.equal(
    (source.match(/replaceGenerationSubscription\(generationUnsubscribeRef, unsubscribe\)/g) ?? [])
      .length >= 2,
    true,
  )
  assert.doesNotMatch(
    source,
    /generationUnsubscribeRef\.current = resumeGenerationSubscription/,
  )
  assert.doesNotMatch(
    source,
    /generationUnsubscribeRef\.current = subscribeGenerationWithFallback/,
  )
})
