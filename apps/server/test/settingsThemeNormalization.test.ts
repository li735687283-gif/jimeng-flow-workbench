import assert from 'node:assert/strict'
import test from 'node:test'
import type { CanvasTheme, ThemeBackgroundMode } from '@jimeng-flow/shared'
import { normalizeSettingsPatch } from '../src/services/settings'

test('settings writes normalize invalid canvas themes before persistence', () => {
  const invalid = normalizeSettingsPatch({
    canvasTheme: 'not-a-theme' as CanvasTheme,
  })
  const valid = normalizeSettingsPatch({ canvasTheme: 'turner-mist' })
  const invalidBackground = normalizeSettingsPatch({
    themeBackgroundMode: 'not-a-mode' as ThemeBackgroundMode,
  })
  const validBackground = normalizeSettingsPatch({ themeBackgroundMode: 'original' })

  assert.equal(invalid.canvasTheme, 'dark')
  assert.equal(valid.canvasTheme, 'turner-mist')
  assert.equal(invalidBackground.themeBackgroundMode, 'blur')
  assert.equal(validBackground.themeBackgroundMode, 'original')
})
