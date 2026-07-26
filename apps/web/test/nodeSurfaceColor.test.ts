import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('text, empty image, and empty video nodes match the expanded panel surface', async () => {
  const [theme, css] = await Promise.all([
    readFile(new URL('../src/theme.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.css', import.meta.url), 'utf8'),
  ])

  assert.match(theme, /--text-frame-obsidian:\s*var\(--theme-panel\);/)
  assert.match(
    theme,
    /\.node-wrapper\[data-flow-node-type='text'\] \.node-card\s*\{[^}]*background:\s*var\(--text-node-frame-color,\s*var\(--theme-panel\)\)\s*!important;/s,
  )
  assert.match(
    theme,
    /\.node-wrapper\[data-flow-node-type='text'\]:hover \.node-card,[\s\S]*?\.node-wrapper\[data-flow-node-type='text'\]\.selected \.node-card\s*\{[^}]*background:\s*var\(--text-node-frame-color,\s*var\(--theme-panel\)\)\s*!important;/,
  )
  assert.match(
    theme,
    /\.node-wrapper\[data-flow-node-type='image'\]:not\(\.media-display\) \.node-card,[\s\S]*?\.node-wrapper\[data-flow-node-type='video'\]:not\(\.media-display\) \.node-card\s*\{[^}]*background:\s*var\(--theme-panel\)\s*!important;/,
  )

  const genericHoverIndex = theme.indexOf(
    ".node-wrapper:not(.media-display):hover .node-card",
  )
  const textOverrideIndex = theme.indexOf(
    ".node-wrapper[data-flow-node-type='text']:hover .node-card",
  )
  const mediaOverrideIndex = theme.indexOf(
    ".node-wrapper[data-flow-node-type='image']:not(.media-display) .node-card",
  )
  assert.ok(genericHoverIndex >= 0)
  assert.ok(textOverrideIndex > genericHoverIndex)
  assert.ok(mediaOverrideIndex > genericHoverIndex)
  assert.match(
    theme,
    /\.image-editor-panel,[\s\S]*?\.prompt-editor-modal\s*\{[^}]*background:\s*var\(--theme-panel\)\s*!important;/,
  )
  assert.match(
    css,
    /\.node-wrapper\.media-display \.node-card,[\s\S]*?\{[^}]*background:\s*transparent;/,
  )
})
