import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('apps/web/src/components/AgentPanel.tsx', 'utf8')
const styles = readFileSync('apps/web/src/App.css', 'utf8')

test('Agent panel keeps canvas picking, mentions, resize and model picker', () => {
  assert.match(source, /<MousePointer2 size=\{14\} \/>/)
  assert.match(source, /agent-round-btn agent-canvas-pick-btn/)
  assert.match(source, /aria-pressed=\{pickingCanvasNode\}/)
  assert.match(source, /target\?\.closest\('\[data-flow-node-id\]'\)/)
  assert.match(source, /ids\.includes\(nodeId\) \? ids : \[\.\.\.ids, nodeId\]/)
  assert.match(source, /const MAX_PANEL_WIDTH_RATIO = 2 \/ 3/)
  assert.match(source, /Math\.floor\(window\.innerWidth \* MAX_PANEL_WIDTH_RATIO\)/)
  assert.match(source, /target\?\.closest\('\.agent-model-picker'\)/)
  assert.match(source, /切换 Agent 模型/)
  assert.match(source, /Agent · \$\{currentModel/)

  assert.match(styles, /\.agent-pick-node-active \[data-flow-node-id\] \.node-card/)
  assert.match(styles, /\.agent-canvas-pick-btn\.active/)
  assert.match(styles, /max-width: 66\.667vw/)
})

test('Agent panel has an execution mode dropdown next to the model picker', () => {
  // 模式开关在输入框一排（composer）里，是弹层按钮而不是顶部横条
  assert.doesNotMatch(source, /agent-mode-bar|agent-mode-toggle|role="radiogroup"/)
  assert.match(source, /agent-model-picker agent-mode-picker/)
  assert.match(source, /aria-label="执行模式"/)
  assert.match(source, /aria-label="执行模式选项"/)
  assert.match(source, /手动执行/)
  assert.match(source, /全自动执行/)
  assert.match(source, /setExecutionMode\('manual'\)/)
  assert.match(source, /setExecutionMode\('auto'\)/)
  assert.match(source, /useAgentStore\(\(s\) => s\.executionMode\)/)
  // 模式菜单与模型菜单都在点击外部时关闭
  assert.match(source, /target\?\.closest\('\.agent-model-picker'\)/)
  assert.match(source, /setModeMenuOpen\(false\)/)
})

test('Agent pending image action cards offer model, aspect ratio and resolution selects', () => {
  // 手动模式确认前可调整模型/比例/清晰度,用统一的 SecondaryMenuSelect 模板
  assert.match(source, /className="agent-action-params"/)
  assert.match(source, /label="模型"/)
  assert.match(source, /label="画面比例"/)
  assert.match(source, /label="清晰度"/)
  assert.match(source, /AGENT_IMAGE_ASPECT_RATIOS\.map/)
  assert.match(source, /getAgentImageResolutionOptions\(\s*effectiveImageModel\(action\),?\s*\)/)
  assert.match(source, /applyParamOverrides\(action\)/)
  assert.match(source, /paramOverrides\[action\.id\]/)
  assert.match(source, /AGENT_DEFAULT_IMAGE_ASPECT_RATIO/)
  // 图片卡片 3 个选择器(模型/比例/清晰度) + 视频卡片 1 个(模型)
  assert.equal((source.match(/<SecondaryMenuSelect/g) ?? []).length, 4)
  assert.doesNotMatch(source, /<select/)

  assert.match(styles, /\.agent-action-params/)
})

test('Agent media model selects use settings lists and never mix image and video models', () => {
  // 图片模型与视频模型分别来自设置里的两个独立列表
  assert.match(source, /getConfiguredImageModels\(/)
  assert.match(source, /getConfiguredVideoModels\(/)
  assert.match(source, /getConfiguredDefaultImageModel\(/)
  assert.match(source, /getConfiguredDefaultVideoModel\(/)
  assert.match(source, /settings\?\.imageModels/)
  assert.match(source, /settings\?\.videoModels/)
  // 图片卡片用图片模型,视频卡片用视频模型
  assert.match(source, /effectiveImageModel\(action\)/)
  assert.match(source, /effectiveVideoModel\(action\)/)
  assert.match(source, /pendingVideoCard && videoModelOptions\.length > 0/)
  // 切换模型时不支持的清晰度会被清掉
  assert.match(source, /delete next\.resolution/)
})

test('Agent panel confirms pending tool calls in manual mode and reports results', () => {
  assert.match(source, /function pendingActionsOf\(message: AgentMessage\)/)
  assert.match(source, /handleConfirmActions/)
  assert.match(source, /handleCancelActions/)
  assert.match(source, /用户取消了该操作。/)
  assert.match(source, /addActionResults/)
  assert.match(source, /executeAgentToolCall\(applyParamOverrides\(action\), \{ getDropPosition \}\)/)
  // 任何模式下 read_canvas 都直接执行，不需要确认
  assert.match(source, /action\.tool === 'read_canvas'/)
  // 自动模式下所有工具立即执行
  assert.match(source, /mode === 'auto'\s*\n\s*\? response\.actions/)
  // 画布操作已执行后,后续 LLM 失败提示语要说明操作已生效
  assert.match(source, /runAgentLoop\(true\)/)
  assert.match(source, /画布操作已执行，但后续回复失败/)

  assert.match(styles, /\.agent-action-card/)
  assert.match(styles, /\.agent-action-confirm/)
})

test('Agent panel dropped roles, skills, templates and storyboard', () => {
  assert.doesNotMatch(source, /AGENT_ROLES|AGENT_TEMPLATES|AGENT_SKILLS/)
  assert.doesNotMatch(source, /agentSkills|agentVideoGeneration/)
  assert.doesNotMatch(source, /StoryboardData|storyboard/)
  assert.doesNotMatch(source, /rolePickerOpen|skillPickerOpen|templatePickerOpen/)
  assert.doesNotMatch(source, /打开技能库|创作模板|切换 Agent 角色/)
  assert.doesNotMatch(source, /pendingImageRequest|pendingVideoRequest|pendingEditRequest/)
})

test('Agent chat sends conversational history plus canvas summary to the chat API', () => {
  assert.match(source, /sendAgentChat\(\{/)
  assert.match(source, /history: buildAgentChatHistory\(state\.messages\)/)
  assert.match(source, /canvas: summarizeCanvasNodes\(useCanvasStore\.getState\(\)\.nodes\)/)
  assert.match(source, /MAX_AGENT_ROUNDS = 3/)
})
