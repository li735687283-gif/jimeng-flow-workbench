import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('image and video prompts share expandable wheel-scroll editor', async () => {
  const imageNode = await readFile(
    new URL('../src/nodes/ImageNode.tsx', import.meta.url),
    'utf8',
  )
  const videoPanel = await readFile(
    new URL('../src/components/VideoGenerationPanel.tsx', import.meta.url),
    'utf8',
  )
  const promptEditor = await readFile(
    new URL('../src/components/PromptEditor.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

  assert.match(imageNode, /<PromptEditor[\s\S]*placeholder="可直接文字生图/)
  assert.match(imageNode, /closest\('\.prompt-editor-modal'\)/)
  assert.match(videoPanel, /<MentionablePromptEditor[\s\S]*placeholder="描述视频画面/)
  assert.match(videoPanel, /import\s+\{\s*MentionablePromptEditor/)
  const videoNode = await readFile(
    new URL('../src/nodes/VideoNode.tsx', import.meta.url),
    'utf8',
  )
  assert.match(videoNode, /closest\('\.prompt-editor-modal'\)/)
  assert.match(promptEditor, /\bMaximize2\b/)
  assert.match(promptEditor, /\bcreatePortal\b/)
  assert.match(promptEditor, /onWheelCapture=\{handleWheel\}/)
  assert.match(promptEditor, /event\.stopPropagation\(\)/)
  assert.match(css, /\.prompt-editor-shell\s*\{[\s\S]*width:\s*100%;/)
  assert.match(css, /\.image-editor-prompt\s*\{[\s\S]*min-height:\s*190px;/)
  assert.match(css, /\.prompt-editor-expand\s*\{[\s\S]*position:\s*absolute;[\s\S]*right:\s*0;/)
})
