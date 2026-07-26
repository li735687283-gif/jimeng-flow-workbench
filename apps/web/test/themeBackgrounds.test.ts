import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return listTypeScriptFiles(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    }),
  )
  return nested.flat()
}

test('art themes map to the prepared full-screen backgrounds', async () => {
  const css = await readFile('apps/web/src/theme.css', 'utf8')
  for (const theme of ['starry-night', 'turner-mist', 'hokusai-indigo', 'monet-lilac']) {
    assert.match(css, new RegExp(`theme-backgrounds/${theme}\\.png`))
  }
  assert.match(css, /\[data-theme-background-mode='original'\][\s\S]*?--theme-background-filter: none/)
  assert.match(css, /\[data-theme-background-mode='blur'\][\s\S]*?--theme-background-filter: blur\(24px\)/)
  assert.match(css, /\.home-page::before,[\s\S]*?\.mature-layout \.canvas-container::before/)
})

test('light skin overrides legacy white UI text with theme tokens', async () => {
  const css = await readFile('apps/web/src/theme.css', 'utf8')
  assert.match(css, /\[data-canvas-theme='light'\] \.node-wrapper\.media-display \.node-title/)
  assert.match(css, /\[data-canvas-theme='light'\] \.agent-input/)
  assert.match(css, /color: var\(--theme-heading\) !important/)
})

test('user-facing inputs do not render placeholder guidance text', async () => {
  const files = await listTypeScriptFiles('apps/web/src')
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /placeholder\s*=/, `${file} must not render placeholder guidance`)
  }
})
