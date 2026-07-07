import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_SETTINGS } from '@jimeng-flow/shared/settings'

test('global settings no longer define default image or video models', () => {
  assert.equal(DEFAULT_SETTINGS.defaultModel, '')
  assert.equal(DEFAULT_SETTINGS.defaultVideoModel, '')
})

test('settings modal does not expose default image or video model controls', () => {
  const source = readFileSync(
    resolve('apps/web/src/components/SettingsModal.tsx'),
    'utf8',
  )

  assert.equal(source.includes('默认图片模型'), false)
  assert.equal(source.includes('默认视频模型'), false)
  assert.equal(source.includes('set-image-default-model'), false)
  assert.equal(source.includes('set-video-default-model'), false)
})
