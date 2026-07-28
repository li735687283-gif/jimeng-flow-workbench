import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTINGS,
  SETTINGS_SECRET_MASK,
  type SettingsResponse,
} from '@jimeng-flow/shared'
import {
  isSettingsSecretMasked,
  omitMaskedSettingsSecrets,
} from '../src/utils/settingsModalState'
import { deriveLlmConfigured } from '../src/state/settingsStore'

test('masked settings secrets are omitted while new and explicitly cleared values remain', () => {
  assert.equal(isSettingsSecretMasked(SETTINGS_SECRET_MASK), true)
  const patch = omitMaskedSettingsSecrets({
    ...DEFAULT_SETTINGS,
    apiKey: SETTINGS_SECRET_MASK,
    llmApiKey: 'new-key',
    kimiApiKey: '',
  })
  assert.equal('apiKey' in patch, false)
  assert.equal(patch.llmApiKey, 'new-key')
  assert.equal(patch.kimiApiKey, '')
})

test('settings store uses credential presence flags instead of the masked value', () => {
  const response: SettingsResponse = {
    ...DEFAULT_SETTINGS,
    llmApiKey: '',
    hasApiKey: false,
    hasLlmApiKey: true,
    hasKimiApiKey: false,
    hasKimiCodingApiKey: false,
    hasDeepseekApiKey: false,
  }
  assert.equal(deriveLlmConfigured(response), true)
})
