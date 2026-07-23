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

---

# Design QA — 全局主题皮肤（2026-07-22）

- Source visual truth:
  - `F:/AI/Codex/墨K画布/图片/方案八·梵高星夜旋光蓝金_20260722_140516.png`
  - `F:/AI/Codex/墨K画布/图片/方案六·透纳晨雾金灰辉光_20260722_140506.png`
  - `F:/AI/Codex/墨K画布/图片/方案七·北斋浮世靛青朱印_20260722_140511.png`
  - `F:/AI/Codex/墨K画布/图片/方案五·莫奈睡莲紫蓝柔光_20260722_140440.png`
- Implementation screenshots: `C:/Users/Lzw/.codex/visualizations/2026/07/22/019f89a1-0fb5-7972-a5c3-f5e05be154ed/theme-qa/*-canvas.png`
- Focused comparisons: `C:/Users/Lzw/.codex/visualizations/2026/07/22/019f89a1-0fb5-7972-a5c3-f5e05be154ed/theme-qa/compare-*.png`
- Browser: Codex in-app browser
- Viewport: 1269 × 720, default desktop density
- State: 同一个已有画布项目、相同缩放和节点位置；分别切换四套艺术主题并截取相同视图

## Full-view review

- 星夜蓝金保留深海蓝基底，以亮金作为主操作和连接强调；整体明暗关系与旋光蓝金参考一致。
- 晨雾金灰使用炭灰褐底、暖金辉光和低饱和表面；整体温度与透纳参考一致。
- 浮世靛青使用深靛青背景、旧金细节和朱红主操作；颜色角色与北斋参考一致。
- 睡莲紫蓝使用深紫蓝背景、紫罗兰节点表面和柔紫强调；整体层次与莫奈参考一致。
- 主题只迁移颜色、线条、辉光和调性，没有改变首页、画布、节点、Agent 或设置的 UI 结构。

## Focused review

- 首页背景、卡片、粒子与顶部品牌控件随主题同步更新。
- 画布背景、网格、节点表面、边框、连接线、控制条和主操作按钮使用同一套语义令牌。
- Agent 面板、输入区、气泡、下拉菜单与设置弹窗同步换肤。
- 日间主题使用米白表面和深色文字，节点、画布控件和设置表单保持清晰可辨。
- 独立审查后补测节点浮动编辑器、提示词弹窗、参考图/历史状态、Agent 视频确认卡、分镜卡和生成画廊，均已映射到主题语义令牌。

## Findings

- P0: none
- P1: none
- P2: none
- P3: 参考图含有更丰富的绘画纹理；本实现按需求只迁移风格、颜色和调性，不把参考图直接铺成背景，因此保留现有产品内容的可读性和性能。

## Interaction and runtime checks

- 设置中展示且仅展示 6 套主题：墨黑、日间及 4 套艺术主题。
- 选择主题后根节点 `data-canvas-theme` 立即变化，无页面重载。
- 点击“取消”后从日间实时预览正确回滚到已保存的墨黑主题。
- 点击“确认”后设置弹窗关闭；重新打开可看到保存主题处于选中状态。
- 刷新应用后已保存主题仍恢复；验收结束已恢复并保存为原有墨黑主题。
- 首页、画布节点、节点浮动编辑器、Agent、设置均在真实运行界面中检查。
- 主题单选组支持方向键与 Home/End，保持唯一 roving tab stop；浏览器实测 ArrowRight 可实时切换并由取消回滚。
- 服务端写盘前归一化非法主题值；延迟设置响应不会覆盖正在进行的实时预览。
- 全量 `npm run check`: passed（322 web tests、152 server tests、17 desktop tests，加上 4 项 root/CLI tests；lint 仅保留既有 warnings）。
- Production build: passed。
- 最终 Windows 解包版在 http://127.0.0.1:8787/ 冒烟通过：健康接口与应用壳均为 200，6 个主题入口完整，星夜实时预览与取消回滚通过，控制台错误为 0。

## Comparison history

- Pass 1: 四组参考图与实现截图已生成同一输入的左右并排对照图，确认主色、背景温度、强调色和整体调性对应。
- Pass 2: 单独检查日间设置与日间画布，确认白色表面、深色文字和控件边界没有结构或布局回退。
- Pass 3: 验证实时预览、取消回滚、确认保存和刷新恢复；全部通过。
- Pass 4: 子 Agent 发现嵌套节点/Agent 状态、日间辅助文字、写盘校验、预览竞态和键盘操作缺口；逐项修复后重跑浏览器复验与全量检查。
- Pass 5: 子 Agent 继续审查并定位 TextNode、设置页实例级固定灰色及两个状态提示块；全部令牌化并补回归断言。最终独立复审结论：无 P0/P1/P2。
- Pass 6: 最终安装包对应的解包版实测 6 个主题、实时预览、取消回滚、确认持久化和刷新恢复；恢复墨黑后控制台错误为 0。

## Implementation checklist

- [x] 保持现有 UI 结构。
- [x] 新增 4 套参考主题、保留墨黑并新增日间，共 6 套。
- [x] 覆盖首页、画布、节点、连线、Agent、设置和统一菜单/弹窗。
- [x] 设置内实时预览，取消回滚，确认持久化。
- [x] 旧设置缺少主题字段时安全回退到墨黑。
- [x] 浏览器操作验证、并排视觉对照、类型检查、测试与生产构建通过。

## Follow-up polish

- 当前需求范围内无必须修复项。

final result: passed

---

# Design QA — 节点输入圆角与滚动条内缩（2026-07-22）

- Source visual truth: `C:/Users/Lzw/.codex/visualizations/2026/07/22/019f89a1-0fb5-7972-a5c3-f5e05be154ed/node-radius-qa/before-text-edit.png`
- Implementation screenshot: `C:/Users/Lzw/.codex/visualizations/2026/07/22/019f89a1-0fb5-7972-a5c3-f5e05be154ed/node-radius-qa/after-text-edit.png`
- Full-view comparison: `C:/Users/Lzw/.codex/visualizations/2026/07/22/019f89a1-0fb5-7972-a5c3-f5e05be154ed/node-radius-qa/compare-before-after.png`
- Focused comparison: `C:/Users/Lzw/.codex/visualizations/2026/07/22/019f89a1-0fb5-7972-a5c3-f5e05be154ed/node-radius-qa/compare-focused-input.png`
- Viewport and pixels: 1280 x 720 CSS px, 1280 x 720 screenshot px, device scale factor 1; before/after use the same project, light theme, fit-view transform and open text prompt state.

## Full-view and focused review

- UI structure, node positions, typography, colors, imagery and copy remain unchanged.
- Text, image and video panels continue to share the existing prompt editor; its 10px inner radius corresponds to the 28px panel radius minus 18px panel padding.
- Direct text-body editing now uses a 27px radius inside the node's 28px outer radius and 1px border, so the two curves are concentric.
- Text previews, direct text editors, node prompt editors and expanded editors share node-local scrollbar styling: 10px gutter, 12px end inset and a 3px transparent thumb border.
- The active long-text scroll region was exercised with the wheel; scrollTop changed while the canvas stayed fixed.
- No new assets, font changes, copy changes or layout restructuring were introduced.

## Findings

- P0: none
- P1: none
- P2: none
- P3: Windows overlay scrollbars may fade out quickly in static screenshots; computed pseudo-element styles confirm the 12px track inset and content-box thumb padding are active.

## Verification

- Browser-computed radii: node card 28px, direct text input 27px, shared prompt input 10px.
- Focused tests: 5 passed.
- Full `npm run check`: passed (324 web tests, 152 server tests, 17 desktop tests, plus 4 root/CLI tests; lint only reports pre-existing warnings).
- Production build: passed.
- Browser console errors for `http://127.0.0.1:5174/`: 0.
- Final packaged runtime at http://127.0.0.1:8787/: node card 28px, direct text input 27px, shared prompt input 10px; console errors 0.

## Comparison history

- Pass 1: the source showed square textarea backgrounds and scrollbars touching the node boundary.
- Pass 2: shared prompt shells received concentric inner radii; direct text editing received the 27px inner radius; node-local scrollbars were inset. Same-state full and focused comparisons showed no remaining P0/P1/P2 issue.

final result: passed
