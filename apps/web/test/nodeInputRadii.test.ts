import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('text, image, and video node inputs share rounded editor surfaces', async () => {
  const [css, textNode, promptEditor, mentionableEditor, videoPanel] = await Promise.all([
    readFile('apps/web/src/App.css', 'utf8'),
    readFile('apps/web/src/nodes/TextNode.tsx', 'utf8'),
    readFile('apps/web/src/components/PromptEditor.tsx', 'utf8'),
    readFile('apps/web/src/components/MentionablePromptEditor.tsx', 'utf8'),
    readFile('apps/web/src/components/VideoGenerationPanel.tsx', 'utf8'),
  ])

  assert.match(css, /--node-card-radius:\s*28px/)
  assert.match(css, /--node-content-radius:\s*calc\(var\(--node-card-radius\) - var\(--node-card-border-width\)\)/)
  assert.match(css, /\.prompt-editor-shell\s*\{[^}]*border-radius:\s*var\(--node-prompt-radius\)/s)
  assert.match(css, /\.text-node-body-editor\s*\{[^}]*background-color:\s*var\(--theme-control/s)
  assert.match(css, /\.text-node-summary,[\s\S]*?\.text-node-body-editor\s*\{[^}]*border-radius:\s*var\(--node-content-radius\)/)

  assert.match(textNode, /className=\{`text-node-body-editor/)
  assert.match(promptEditor, /className="image-editor-prompt/)
  assert.match(mentionableEditor, /className=\{`image-editor-prompt/)
  assert.match(videoPanel, /<MentionablePromptEditor/)
})

test('node-local scrollbars are inset from rounded edges', async () => {
  const css = await readFile('apps/web/src/App.css', 'utf8')

  assert.match(css, /--node-scrollbar-inset:\s*12px/)
  assert.match(css, /::-webkit-scrollbar-track[\s\S]*?margin-block:\s*var\(--node-scrollbar-inset\)/)
  assert.match(css, /::-webkit-scrollbar-track[\s\S]*?margin-inline:\s*var\(--node-scrollbar-inset\)/)
  assert.match(css, /::-webkit-scrollbar-thumb[\s\S]*?background-clip:\s*content-box/)
  assert.match(css, /::-webkit-scrollbar-thumb[\s\S]*?border:\s*3px solid transparent/)
})
