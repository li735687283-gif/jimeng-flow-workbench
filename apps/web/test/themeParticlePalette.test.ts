import assert from 'node:assert/strict'
import test from 'node:test'
import { readThemeParticlePalette } from '../src/utils/themeParticlePalette'

test('home particles read live palette channels from global skin tokens', () => {
  const previous = globalThis.getComputedStyle
  globalThis.getComputedStyle = (() => ({
    getPropertyValue(name: string) {
      const values: Record<string, string> = {
        '--theme-particle-base': '98, 153, 230',
        '--theme-particle-base-alpha': '0.2',
        '--theme-particle-hot': '236, 196, 105',
        '--theme-particle-hot-alpha': '0.9',
      }
      return values[name] ?? ''
    },
  })) as typeof getComputedStyle

  try {
    assert.deepEqual(readThemeParticlePalette({} as Element), {
      base: [98, 153, 230, 0.2],
      hot: [236, 196, 105, 0.9],
    })
  } finally {
    globalThis.getComputedStyle = previous
  }
})
