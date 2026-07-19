import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeGenerateDefaults } from '@jimeng-flow/shared/generateNode'

test('new image nodes default to GPT Image through OpenAI CLI', () => {
  assert.equal(mergeGenerateDefaults({}).model, 'codex:gpt-5.5')
})
