import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('MentionablePromptEditor supports @ mention with upstream images', () => {
  const source = readFileSync('apps/web/src/components/MentionablePromptEditor.tsx', 'utf8')
  const css = readFileSync('apps/web/src/App.css', 'utf8')

  assert.match(source, /MentionImage/)
  assert.match(source, /mentionImages/)
  assert.match(source, /detectMention/)
  assert.match(source, /MENTION_REGEX/)
  assert.match(source, /@[^@\\s]*\$/)
  assert.match(source, /handleSelect/)
  assert.match(source, /getAssetFileUrl/)
  assert.match(source, /mention-popup/)
  assert.match(source, /mention-popup-thumb/)
  assert.match(source, /mention-popup-name/)
  assert.match(source, /ArrowDown/)
  assert.match(source, /ArrowUp/)
  assert.match(source, /highlightedIndex/)

  // Bug fix: read from textarea.value to avoid stale closure
  assert.match(source, /textarea\.value/)
  assert.doesNotMatch(source, /detectMention\(value, caret\)/)

  // Blue mention highlight
  assert.match(source, /mentionHighlightRegex/)
  assert.match(source, /renderHighlightedText/)
  assert.match(source, /mention-token/)
  assert.match(source, /prompt-editor-highlight/)
  assert.match(source, /syncScroll/)

  assert.match(css, /\.mention-popup\b/)
  assert.match(css, /\.mention-popup-grid/)
  assert.match(css, /\.mention-popup-item/)
  assert.match(css, /\.mention-popup-thumb/)
  assert.match(css, /\.mention-token/)
  assert.match(css, /\.prompt-editor-highlight\b/)
  assert.match(css, /\.mention-textarea/)
})

test('VideoGenerationPanel passes mentionImages to the editor', () => {
  const source = readFileSync('apps/web/src/components/VideoGenerationPanel.tsx', 'utf8')

  assert.match(source, /MentionablePromptEditor/)
  assert.match(source, /mentionImages/)
  assert.doesNotMatch(source, /import.*PromptEditor.*from.*'\.\/PromptEditor'/)
})

test('VideoNode builds mentionImages from referenceAssetIds', () => {
  const source = readFileSync('apps/web/src/nodes/VideoNode.tsx', 'utf8')

  assert.match(source, /mentionImages/)
  assert.match(source, /图片\$\{index \+ 1\}/)
  assert.match(source, /mentionImages=\{mentionImages\}/)
})
