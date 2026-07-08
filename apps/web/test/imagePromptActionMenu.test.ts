import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('image editor opens a prompt template library from the library button', () => {
  const source = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const css = readFileSync('apps/web/src/App.css', 'utf8')

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
  assert.match(source, /LayoutTemplate/)
  assert.doesNotMatch(source, /title="提示词操作"/)
  assert.doesNotMatch(source, />复制提示词</)
  assert.doesNotMatch(source, />正向</)
  assert.doesNotMatch(source, />负向</)

  assert.match(css, /\.prompt-template-library/)
  assert.match(css, /\.prompt-template-apply/)
  assert.match(css, /\.image-editor-prompt-action-button/)
})

test('prompt template library supports saving and reusing prompts', () => {
  const source = readFileSync('apps/web/src/components/PromptTemplateLibrary.tsx', 'utf8')

  assert.match(source, /CUSTOM_PROMPT_TEMPLATES_KEY/)
  assert.match(source, /localStorage\.setItem/)
  assert.match(source, /localStorage\.getItem/)
  assert.match(source, /BUILTIN_PROMPT_TEMPLATES/)
  assert.match(source, /aria-label="应用模板"/)
  assert.match(source, /onApply\(template\.prompt\)/)
  assert.doesNotMatch(source, />收藏当前</)
  assert.doesNotMatch(source, /placeholder="搜索模板/)
})

test('prompt template library supports creating custom templates', () => {
  const source = readFileSync('apps/web/src/components/PromptTemplateLibrary.tsx', 'utf8')
  const css = readFileSync('apps/web/src/App.css', 'utf8')

  assert.match(source, /handleOpenNew/)
  assert.match(source, /handleSaveNew/)
  assert.match(source, /newTitle/)
  assert.match(source, /newCategory/)
  assert.match(source, /newPrompt/)
  assert.match(source, />新建</)
  assert.match(source, /placeholder="输入模板标题"/)
  assert.match(source, /placeholder="粘贴提示词内容\.\.\."/)
  assert.match(source, /prompt-template-category-trigger/)
  assert.match(source, /prompt-template-category-dropdown/)
  assert.match(source, /categoryOptions/)
  assert.match(source, />\s*保存\s*</)
  assert.match(source, /handleSaveNew/)
  assert.match(css, /\.prompt-template-new-btn/)
  assert.match(css, /\.prompt-template-new-form/)
  assert.match(css, /\.prompt-template-new-save/)
  assert.match(css, /\.prompt-template-category-dropdown/)
  assert.match(css, /\.prompt-template-category-option/)
})
