# Design QA

- Source visual truth: `F:/AI/vs code/claudecode/即梦CLI调用-agent-skill/reference-font.png`
- Implementation screenshot: `F:/AI/vs code/claudecode/即梦CLI调用/.codex-logs/font-qa-menu.png`
- Agent menu screenshot: `F:/AI/vs code/claudecode/即梦CLI调用/.codex-logs/font-qa-agent-role.png`
- Focused comparison: `F:/AI/vs code/claudecode/即梦CLI调用/.codex-logs/font-qa-comparison.png`
- Viewport: 1280 x 720
- State: empty canvas; Add Node menu expanded; Agent role menu expanded in a second check

**Findings**

- No actionable P0, P1, or P2 differences remain for the requested typography scope.
- Fonts and typography: every inspected canvas control, Add Node menu item, and Agent role menu item resolves to the same `PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif` stack. Existing sizes (10px to 16px), weights, and hierarchy remain intact. The JSON preview and inspector ID no longer switch to monospace.
- Spacing and layout rhythm: unchanged. No horizontal text overflow was detected. The Agent role menu reports a 1px vertical scroll-height rounding difference on four labels, but the rendered screenshot shows no clipping.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: icons and raster assets are unchanged; no assets were replaced or approximated.
- Copy and content: unchanged.

**Interaction and Runtime Checks**

- Add Node menu opened from the keyboard and rendered all five menu rows.
- Agent panel and role dropdown opened successfully.
- Browser console errors and warnings: none.
- Typography regression test: passed.
- Web typecheck: passed.
- Production build: passed.
- Full web suite: 287 passed, 2 unrelated existing failures (`monochromePalette.test.ts` and `nodeSelectionHighlight.test.ts`). Neither failing assertion touches the typography diff.

**Comparison History**

- Pass 1: side-by-side focused comparison showed the implementation using the same modern Chinese sans-serif character as the reference. Computed-style inspection confirmed a single family across both sampled menus. No P0/P1/P2 fix was required after this pass.

**Open Questions**

- None for the requested font-unification scope.

**Implementation Checklist**

- [x] Centralize the UI font stack.
- [x] Apply the stack to native form controls.
- [x] Remove canvas monospace exceptions.
- [x] Verify multiple menu sizes and weights.
- [x] Confirm no browser console errors.

**Follow-up Polish**

- None required for typography fidelity.

final result: passed

# Design QA — Agent 图片计划精简（2026-07-18）

- Source visual truth: `F:/AI/vs code/claudecode/即梦CLI调用-agent-skill/agent-image-plan-reference.png`
- Implementation screenshot: `F:/AI/vs code/claudecode/即梦CLI调用-agent-skill/agent-image-plan-implementation.png`
- Viewport: 1366 x 1273
- State: Agent 图片计划已打开；即梦 5.0 Pro、9:16、4K、数量 4
- Full-view comparison evidence: 参考图与当前实现均已分别打开检查。当前卡片由重复的“摘要标签 + 完整表单”缩减为一排四个可点击下拉控件，三个底部操作按钮保持完整可见。
- Focused region comparison evidence: 浏览器安全策略阻止创建本地并排对比页，因此无法把两张截图放入同一个浏览器比较输入；这是本轮严格设计 QA 的唯一阻塞项。

**Findings**

- 未从单独视觉检查中发现 P0、P1 或 P2 界面问题，但缺少技能要求的同一输入并排证据，不能将严格设计 QA 标记为通过。
- Fonts and typography: 沿用现有 Agent 字体、字号和字重；四个控件的值清晰可读。
- Spacing and layout rhythm: 四个控件在当前 Agent 宽度内保持同一行；模型控件弹性占宽，其余控件固定紧凑宽度，并允许窄宽度自然换行。
- Colors and visual tokens: 沿用原卡片的深色背景、边框、圆角、悬停和聚焦反馈。
- Image quality and asset fidelity: 本次不涉及图片、品牌资产或图标替换。
- Copy and content: 已删除可见的“图片模型 / 比例 / 清晰度 / 数量”标签和下方重复表单；保留标题、说明、状态提示与三个操作按钮。

**Interaction and Runtime Checks**

- 图片模型、画面比例、清晰度、生成数量四个原生下拉菜单均可操作。
- 比例成功切换到 9:16，清晰度切换到 4K，数量切换到 4。
- 模型由即梦切换为 GPT Image 时，4K 自动校正为受支持的 1K；切回即梦后可重新选择 4K。
- 取消、发送至画布、发送并生成按钮均保持可见。
- 浏览器控制台错误：0。
- 相关测试：7 passed。
- Web typecheck：passed。
- Web lint：0 errors，保留 11 个与本次改动无关的既有 warnings。

**Comparison History**

- Pass 1: 当前实现截图显示重复表单已消失，四个参数值整齐排列在同一行，未发现可见布局或交互回退。
- Blocking evidence gap: 创建本地并排比较页被浏览器安全策略拒绝，未继续使用绕过方案。

**Implementation Checklist**

- [x] 删除下方重复图片参数表单。
- [x] 移除四个可见字段标题。
- [x] 将模型、比例、清晰度、数量改为直接下拉选择。
- [x] 保留底部三个操作按钮。
- [x] 验证模型与清晰度联动。
- [ ] 在同一比较输入中完成参考图与实现截图的并排视觉证据。

**Follow-up Polish**

- 暂无基于当前截图可确认的 P3 项。

final result: blocked

---

# Design QA — 文本节点运行反馈（2026-07-22）

- Source visual truth: 用户在任务中提供的截图（1200 × 921；会话内核对）
- Implementation capture: 本地延迟 mock 的运行态截图（1280 × 720；会话内核对，临时文件已清理）
- State verified: text request running against a delayed local mock API

## Full-view review

- The existing text-node frame and editor layout remain unchanged.
- The stale bottom-left message is absent in both idle and running states.
- The running overlay stays inside the text-node body and does not cover the prompt editor.

## Focused review

- Reuses the image/video node dot, sweep and progress-bar classes.
- Shows `文本生成中` and an accessible progress bar while the request is pending.
- Prompt, model selector and send action are disabled during the request and recover afterward.
- Browser console: no warnings or errors.

## Findings

- P0: none
- P1: none
- P2: none

Final result: passed.
