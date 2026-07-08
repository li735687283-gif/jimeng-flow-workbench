import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('image editor opens a prompt template library from the library button', () => {
  const source = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const css = readFileSync('apps/web/src/App.css', 'utf8')

  assert.match(source, /function PromptLibraryIcon/)
  assert.match(source, /<PromptLibraryIcon \/>/)
  assert.match(source, /promptMenuOpen/)
  assert.match(source, /handlePromptMenuToggle/)
  assert.match(source, /handlePromptMenuPointerDown/)
  assert.match(source, /event\.stopPropagation\(\)/)
  assert.match(source, /onPointerDown=\{handlePromptMenuPointerDown\}/)
  assert.match(source, /PromptTemplateLibrary/)
  assert.match(source, /handleApplyPromptTemplate/)
  assert.match(source, /target\.closest\('\.image-editor-panel'\)/)
  assert.match(source, /target\.closest\('\.prompt-template-library'\)/)
  assert.match(source, /createPortal\(/)
  assert.match(source, /image-editor-prompt-action-button/)
  assert.doesNotMatch(source, />复制提示词</)
  assert.doesNotMatch(source, />正向</)
  assert.doesNotMatch(source, />负向</)

  assert.match(css, /\.prompt-template-library/)
  assert.match(css, /\.prompt-template-save-current/)
  assert.match(css, /\.prompt-template-apply/)
  assert.match(css, /\.image-editor-prompt-action-button/)
})

test('prompt template library supports saving and reusing prompts', () => {
  const source = readFileSync('apps/web/src/components/PromptTemplateLibrary.tsx', 'utf8')

  assert.match(source, /CUSTOM_PROMPT_TEMPLATES_KEY/)
  assert.match(source, /localStorage\.setItem/)
  assert.match(source, /localStorage\.getItem/)
  assert.match(source, /BUILTIN_PROMPT_TEMPLATES/)
  assert.match(source, />收藏当前</)
  assert.match(source, />应用模板</)
  assert.match(source, /onApply\(template\.prompt\)/)
  assert.match(source, /setCategory\('我的'\)/)
})
