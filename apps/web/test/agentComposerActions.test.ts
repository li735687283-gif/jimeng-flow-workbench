import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { AGENT_ROLES, AGENT_TEMPLATES } from '../../../packages/shared/src/agentMessage.ts'

test('Agent composer separates continuous canvas picking from the skill library', () => {
  const source = readFileSync(
    'apps/web/src/components/AgentPanel.tsx',
    'utf8',
  )
  const styles = readFileSync('apps/web/src/App.css', 'utf8')

  assert.match(source, /<MousePointer2 size=\{14\} \/>/)
  assert.match(source, /<Blocks size=\{14\} \/>/)
  assert.match(source, /agent-round-btn agent-canvas-pick-btn/)
  assert.doesNotMatch(source, /连续点选画布节点/)
  assert.match(source, /aria-pressed=\{pickingCanvasNode\}/)
  assert.match(source, /aria-label="打开技能库"/)
  assert.match(source, /aria-haspopup="dialog"/)
  assert.match(source, /target\?\.closest\('\[data-flow-node-id\]'\)/)
  assert.match(source, /ids\.includes\(nodeId\) \? ids : \[\.\.\.ids, nodeId\]/)

  const pickHandler = source.slice(
    source.indexOf('const handlePick ='),
    source.indexOf('const handleCancel ='),
  )
  assert.doesNotMatch(pickHandler, /setPickingCanvasNode\(false\)/)

  assert.equal(
    source.indexOf('<MousePointer2 size={14} />') <
      source.indexOf('aria-label="打开技能库"'),
    true,
  )
  assert.doesNotMatch(source, /actionMenuOpen|agent-action-menu/)
  assert.match(styles, /\.agent-pick-node-active \[data-flow-node-id\] \.node-card/)
  assert.match(styles, /\.agent-canvas-pick-btn\.active/)
  assert.match(styles, /background: #f2f2f2/)
  assert.match(styles, /color: #151515/)
  assert.doesNotMatch(styles, /agent-pick-image-active|agent-action-option/)
})

test('Agent model menu closes outside and the panel can grow to two thirds', () => {
  const source = readFileSync(
    'apps/web/src/components/AgentPanel.tsx',
    'utf8',
  )
  const styles = readFileSync('apps/web/src/App.css', 'utf8')
  const outsideModelEffect = source.slice(
    source.indexOf('if (!modelOpen) return'),
    source.indexOf('if (!historyOpen) return'),
  )

  assert.match(outsideModelEffect, /target\.closest\('\.agent-model-picker'\)/)
  assert.match(outsideModelEffect, /setModelOpen\(false\)/)
  assert.match(
    outsideModelEffect,
    /document\.addEventListener\('mousedown', closeModel\)/,
  )
  assert.match(source, /const MAX_PANEL_WIDTH_RATIO = 2 \/ 3/)
  assert.match(
    source,
    /Math\.floor\(window\.innerWidth \* MAX_PANEL_WIDTH_RATIO\)/,
  )
  assert.match(styles, /max-width: 66\.667vw/)
})

test('creative templates select a workflow before the user explicitly starts it', () => {
  const source = readFileSync(
    'apps/web/src/components/AgentPanel.tsx',
    'utf8',
  )
  const styles = readFileSync('apps/web/src/App.css', 'utf8')
  const outsideTemplateEffect = source.slice(
    source.indexOf('if (!templatePickerOpen) return'),
    source.indexOf('if (!skillPickerOpen) return'),
  )

  assert.deepEqual(
    AGENT_TEMPLATES.map((template) => template.name),
    [
      '产品海报',
      '故事分镜',
      '角色设计',
      '社交封面',
      '产品视频概念',
      '产品场景概念',
    ],
  )
  for (const template of AGENT_TEMPLATES) {
    assert.ok(template.prompt.length > 50)
    assert.ok(template.defaultRole)
    assert.equal('icon' in template, false)
  }
  for (const role of AGENT_ROLES) assert.equal('icon' in role, false)

  assert.match(outsideTemplateEffect, /target\.closest\('\.agent-template-dropdown'\)/)
  assert.match(outsideTemplateEffect, /target\.closest\('\.agent-template-btn'\)/)
  assert.match(source, /const AGENT_ROLE_ICONS: Record<AgentRole, LucideIcon>/)
  assert.match(source, /const AGENT_TEMPLATE_ICONS: Record<string, LucideIcon>/)
  assert.match(source, /const applyTemplate = \(template: AgentTemplate\)/)
  assert.match(source, /setSelectedTemplateId\(template\.id\)/)
  assert.match(source, /setRole\(template\.defaultRole\)/)
  assert.doesNotMatch(source, /void submit\(template\.prompt\)/)
  assert.match(source, /className="agent-active-template"/)
  assert.match(source, /开始创作/)
  assert.match(source, /selectedTemplate\.prompt/)
  assert.match(source, /selectedTemplate \? '补充创作要求/)
  assert.match(source, /agent-round-btn agent-template-btn/)
  assert.match(source, /className="agent-template-dropdown"/)
  assert.match(source, /className="agent-template-option"/)
  assert.match(source, /onClick=\{\(\) => applyTemplate\(template\)\}/)
  assert.doesNotMatch(source, /\{r\.icon\}|\{t\.icon\}/)
  assert.doesNotMatch(source, /setTimeout\(\(\) => submit\(t\.prompt\)/)
  assert.match(styles, /\.agent-template-dropdown/)
  assert.match(styles, /\.agent-template-option-icon/)
  assert.match(styles, /\.agent-active-template/)
  assert.match(styles, /\.agent-template-start/)
})

test('Agent clearly separates the planning model from the image generation model', () => {
  const source = readFileSync(
    'apps/web/src/components/AgentPanel.tsx',
    'utf8',
  )

  assert.match(source, /切换 Agent 模型/)
  assert.match(source, /Agent · \$\{currentModel/)
  assert.match(source, /图片生成模型负责实际出图/)
  assert.match(source, /label="图片模型"/)
  assert.match(source, /label="画面比例"/)
  assert.match(source, /label="清晰度"/)
  assert.match(source, /label="生成数量"/)
  assert.equal(
    (source.match(/<SecondaryMenuSelect/g) ?? []).length >= 4,
    true,
  )
  assert.doesNotMatch(source, /<div className="agent-image-fields">/)
  assert.doesNotMatch(source, /<strong>图片模型<\/strong>/)
  assert.doesNotMatch(source, /<span>图片生成模型<\/span>/)
  assert.match(source, /GPT Image（OpenAI CLI）或即梦 5\.0 Pro/)
  assert.match(
    source,
    /if \(!selectedAgentImageModel\) \{[\s\S]*请先在设置中添加并选择图片生成模型/,
  )
  assert.match(
    source,
    /disabled=\{!selectedAgentImageModel\}/,
  )
  assert.match(
    source,
    /!selectedAgentImageModel \|\|[\s\S]*activeAgentImageModelNeedsJimeng/,
  )
})

test('Agent image generation does not keep a hidden reference image', () => {
  const source = readFileSync(
    'apps/web/src/components/AgentPanel.tsx',
    'utf8',
  )
  const styles = readFileSync('apps/web/src/App.css', 'utf8')

  assert.doesNotMatch(source, /conversationContext\.referenceAssetId|referenceAssetId:/)
  assert.doesNotMatch(source, /锁定参考风格|已锁定参考风格/)
  assert.doesNotMatch(styles, /agent-reference-lock/)
  assert.match(source, /const inputImageAssetIds = imageContextNodes/)
  assert.match(source, /inputImages: inputImageAssetIds/)
  assert.match(source, /const inputImages: string\[\] = \[\]/)
})
