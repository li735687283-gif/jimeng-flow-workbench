import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getChangedPersistedImageEditorFields,
  getPersistedImageEditorPatch,
} from '../src/utils/imageEditorState'

test('ImageNode editor sync accepts explicit persisted generation fields', () => {
  assert.deepEqual(
    getPersistedImageEditorPatch({
      title: 'image',
      status: 'success',
      prompt: '服务端提示词',
      model: 'jimeng-4.1',
      quality: '高画质',
      resolution: '4K',
      ratio: '16:9',
      count: 3,
    }),
    {
      prompt: '服务端提示词',
      modelId: 'jimeng-4.1',
      quality: '高画质',
      resolution: '4K',
      ratio: '16:9',
      count: 3,
    },
  )
})

test('ImageNode editor sync ignores absent or invalid fields so local drafts survive', () => {
  assert.deepEqual(
    getPersistedImageEditorPatch({
      title: 'image',
      status: 'idle',
      quality: 'unknown',
      resolution: '8K',
      ratio: '10:3',
      count: 9,
    } as never),
    {},
  )
  assert.deepEqual(
    getPersistedImageEditorPatch({ title: 'image', status: 'idle', prompt: '' }),
    { prompt: '' },
  )
})

test('ImageNode editor sync only reports persisted fields that changed externally', () => {
  const previous = {
    prompt: '旧提示词',
    modelId: 'jimeng-4.1',
    quality: '标准画质' as const,
    resolution: '2K' as const,
    ratio: '1:1' as const,
    count: 1 as const,
  }

  assert.deepEqual(
    getChangedPersistedImageEditorFields(previous, {
      ...previous,
      prompt: '新提示词',
    }),
    ['prompt'],
  )

  assert.deepEqual(
    getChangedPersistedImageEditorFields(previous, {
      ...previous,
      quality: '高画质',
      resolution: '4K',
      ratio: '16:9',
      count: 3,
    }),
    ['quality', 'resolution', 'ratio', 'count'],
  )
})
