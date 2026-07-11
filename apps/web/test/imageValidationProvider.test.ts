import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateImageProvider } from '../src/utils/imageProviderValidation'

test('image provider dispatcher uses the Jimeng probe for Jimeng models', async () => {
  const calls: string[] = []
  const valid = await validateImageProvider('jimeng-5.0', {
    probeJimeng: async () => {
      calls.push('jimeng')
      return false
    },
    probeCodex: async () => {
      calls.push('codex')
      return true
    },
  })

  assert.equal(valid, false)
  assert.deepEqual(calls, ['jimeng'])
})

test('image provider dispatcher uses the Codex probe for Codex models', async () => {
  const calls: string[] = []
  const valid = await validateImageProvider('codex:gpt-5.5', {
    probeJimeng: async () => {
      calls.push('jimeng')
      return false
    },
    probeCodex: async () => {
      calls.push('codex')
      return true
    },
  })

  assert.equal(valid, true)
  assert.deepEqual(calls, ['codex'])
})

test('image provider dispatcher accepts generic models without provider probes', async () => {
  const valid = await validateImageProvider('flux-1.1-pro', {
    probeJimeng: async () => {
      throw new Error('unexpected Jimeng probe')
    },
    probeCodex: async () => {
      throw new Error('unexpected Codex probe')
    },
  })

  assert.equal(valid, true)
})

test('image provider dispatcher surfaces Jimeng and Codex probe errors', async () => {
  await assert.rejects(
    () =>
      validateImageProvider('jimeng-5.0', {
        probeJimeng: async () => {
          throw new Error('Jimeng unavailable')
        },
        probeCodex: async () => true,
      }),
    /Jimeng unavailable/,
  )
  await assert.rejects(
    () =>
      validateImageProvider('codex:gpt-5.5', {
        probeJimeng: async () => true,
        probeCodex: async () => {
          throw new Error('Codex unavailable')
        },
      }),
    /Codex unavailable/,
  )
})
