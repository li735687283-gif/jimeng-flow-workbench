import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('text node only keeps write+llm send interaction like image node editor', async () => {
  const source = await readFile(
    new URL('../src/nodes/TextNode.tsx', import.meta.url),
    'utf8',
  )
  const bottomPanel = await readFile(
    new URL('../src/components/inspector/BottomPanel.tsx', import.meta.url),
    'utf8',
  )

  // 简化：移除旧快捷动作
  assert.equal(source.includes('文生视频'), false)
  assert.equal(source.includes('图片反推提示词'), false)
  assert.equal(source.includes('文字生音乐'), false)
  assert.equal(source.includes('自己编写内容'), false)

  // 双击只编辑节点正文（content）；单击才打开提示词面板（input）
  assert.match(source, /onDoubleClick=\{handleNodeDoubleClick\}/)
  assert.match(source, /onClick=\{handleNodeClick\}/)
  assert.match(source, /handleEnterBodyEdit/)
  assert.match(source, /handleOpenPromptPanel/)
  assert.match(source, /text-node-body-editor/)
  assert.match(source, /persistBodyDraft/)
  assert.match(source, /bodyDraft/)
  assert.match(source, /value=\{bodyDraft\}/)
  assert.match(source, /value=\{prompt\}/)
  assert.match(source, /<PromptEditor/)
  assert.match(source, /persistPromptDraft/)
  assert.match(source, /image-editor-model-button/)
  assert.match(source, /image-editor-send/)
  assert.match(source, /PromptTemplateLibrary/)
  assert.match(source, /LayoutTemplate/)
  assert.match(source, /image-editor-prompt-action-button/)
  assert.match(source, /text-prompt-template-anchor/)
  assert.match(source, /handlePromptMenuPointerDown/)
  assert.match(source, /提示词模板库/)
  // 顶部工具条：颜色 / 复制 / 放大弹层（对齐提示词框放大）
  assert.match(source, /TextActionCard/)
  assert.match(source, /persistFrameColor/)
  assert.match(source, /handleCopyAllText/)
  assert.match(source, /handleExpandText/)
  assert.match(source, /prompt-editor-modal-backdrop/)
  // 单击立即打开底栏（与图片/视频一致，无防抖延迟）
  assert.equal(source.includes('SINGLE_CLICK_OPEN_MS'), false)
  assert.equal(source.includes('openPanelTimerRef'), false)
  assert.match(source, /event\.detail > 1/)
  assert.match(
    source,
    /event\.detail > 1[\s\S]{0,120}handleEnterBodyEdit\(\)/,
  )
  assert.match(source, /handleOpenPromptPanel\(\)/)
  assert.match(source, /bodyEditingRef/)
  assert.match(source, /runTextNode\(/)
  // 双击只进正文，不得收起底栏；无动画保持底栏
  const enterBodyStart = source.indexOf('const handleEnterBodyEdit')
  const enterBodyEnd = source.indexOf('const handleNodeClick', enterBodyStart)
  assert.ok(enterBodyStart >= 0 && enterBodyEnd > enterBodyStart)
  const enterBodyBlock = source.slice(enterBodyStart, enterBodyEnd)
  assert.equal(enterBodyBlock.includes('setEditorMounted(false)'), false)
  assert.match(enterBodyBlock, /setBodyEditing\(true\)/)
  assert.match(enterBodyBlock, /setPanelNoAnim\(true\)/)
  // 预览/编辑双层叠放，避免卸载 DOM 导致尺寸跳变
  assert.match(source, /text-node-content-stack/)
  assert.match(source, /text-node-preview-layer/)
  assert.match(source, /is-inactive/)
  // 放大仅在顶部工具条；节点本体不放放大按钮
  assert.equal(source.includes('text-node-expand-btn'), false)
  assert.match(source, /prompt-editor-modal/)
  assert.match(source, /handleExpandText/)
  assert.match(source, /handleSummaryWheel/)
  // 预览态 summary 不可整块 nodrag，否则节点拖不动
  assert.match(source, /className="text-node-summary nowheel"/)
  assert.equal(/className="text-node-summary[^"]*nodrag/.test(source), false)
  // 图片引用仅缩略图，不要胶囊文案
  assert.equal(source.includes('text-reverse-image-chip'), false)
  assert.equal(source.includes('reference-text-chip-tag'), false)
  assert.match(source, /ReferenceAssetStrip/)

  // 底部面板不再挂载 TextComposer
  assert.equal(bottomPanel.includes('TextComposer'), false)
  assert.equal(bottomPanel.includes("node.type === 'text'"), false)
})
