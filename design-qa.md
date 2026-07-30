# Design QA

> 本文件是按任务追加的历史设计 QA 日志，各节中的绝对路径、测试数量和运行状态只代表当次验收现场，不是当前能力或质量门禁的权威来源。
> 当前命令、端口和质量状态以根 `README.md`、源码、测试及实际命令输出为准；已标记 `blocked` 的历史记录不代表当前实现仍被阻塞。

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

---

# Design QA — 文本节点缩放与画布点阵（2026-07-26）

## Scope

- Reference: 用户提供的截图（已保留在 `docs/design-qa/text-node-resize-comparison.png` 对照图中）
- Implementation: `docs/design-qa/text-node-resize-full.png`
- Focused implementation: `docs/design-qa/text-node-resize-focused.png`
- Side-by-side comparison: `docs/design-qa/text-node-resize-comparison.png`
- Refined default state: `docs/design-qa/text-node-resize-default-refined.png`
- Refined hover state: `docs/design-qa/text-node-resize-hover-refined.png`
- Refined three-way comparison: `docs/design-qa/text-node-resize-refined-comparison.png`
- Contained-corner default state: `docs/design-qa/text-node-resize-corner-contained-default-fit.png`
- Contained-corner hover state: `docs/design-qa/text-node-resize-corner-contained-hover-fit.png`
- Contained-corner three-way comparison: `docs/design-qa/text-node-resize-corner-contained-comparison.png`
- Viewport: 1280 × 720, default canvas theme, one text node with multiline Chinese content
- Reference size: 562 × 438
- Focused implementation size: 620 × 440

## Visual comparison

- The default dot grid is visibly larger and more widely spaced while preserving the existing theme color.
- The bottom-right resize affordance follows the reference's rounded corner treatment and now occupies a 26 × 26 logical-pixel target, half the original area.
- The icon uses Lucide `Equal`, rotated -45 degrees into the reference's two parallel rising strokes; the existing fullscreen `Maximize2` remains unchanged.
- The default handle background is transparent, so it reveals the exact text-node frame color without creating a second visible corner.
- The 26 × 26 handle is inset by 2px and uses a 26px outer radius inside the node's 28px radius; its arc no longer protrudes beyond the node edge.
- Hover resolves to the sampled reference colors `#392b5b` with `#8b5cf6` strokes, with only an inset highlight and no external glow.
- Content padding was reduced with the smaller target while retaining enough bottom-right clearance for text.
- No clipping, broken borders, or unexpected layout shifts were visible at the tested viewport.

## Interaction verification

- Dragged the text node from 360 × 300 to 497 × 327.
- Dragged it narrower to 311 × 327; the multiline sample reflowed from four to six visible text-line rectangles.
- Dragged it back to 499 × 327 for the final inspection state.
- Verified the resize target uses `cursor: nwse-resize`.
- Verified the default icon transform is `rotate(-45deg) scale(0.88)` and hover is `rotate(-45deg) scale(1.12)`.
- Browser-computed hover state: background `rgb(57, 43, 91)`, stroke color `rgb(139, 92, 246)`, opacity `1`.
- Browser-computed corner geometry: default background `transparent`, node radius `28px`, handle radius `15px 0 26px 0`, and right/bottom inset `2px`.
- Verified the 26 × 26 target still resizes a valid server-backed canvas from 360 × 300 to 404 × 324 and autosaves without a new console error.
- The live text-generation provider was not invoked; source regression tests verify the progress dot and empty-state symbol are both absent while loading.

## QA history

1. Captured the supplied reference image.
2. Opened a new local canvas in the in-app browser.
3. Added a text node, entered multiline content, and exercised both wider and narrower resize paths.
4. Captured the full and focused implementation states.
5. Compared the reference and implementation side by side and found no blocking mismatch.
6. Refined the handle to half size, replaced the arrows with rotated parallel strokes, and sampled the reference purple colors directly.
7. Captured default and forced-hover states in the same viewport and compared them with the source in one three-way image.
8. Inset the handle arc to match the node corner, removed the external hover glow, and captured a focused reference/default/hover comparison confirming no protruding edge.

final result: passed

---

# Design QA — 文本节点高级渐变色板（2026-07-26）

## Scope

- Source visual truth: 用户提供的截图（已保留在 `docs/design-qa/text-node-premium-palette-comparison.png` 对照图中）
- Rendered implementation: `docs/design-qa/text-node-premium-palette-selected.png`
- Focused side-by-side comparison: `docs/design-qa/text-node-premium-palette-comparison.png`
- Source pixels: 708 × 909
- Implementation capture: 1095 × 720 pixels from a 1280 × 720 CSS viewport at device pixel ratio 1.5
- State: dark canvas, text-node color menu open, `暮光靛` selected

## Findings

- No actionable P0, P1, or P2 issues remain.
- The source's seven grayscale solids were intentionally replaced with seven distinct low-saturation mineral gradients.
- The menu structure, three-column rhythm, selected check, compact spacing, and rounded dark surface remain unchanged.

## Required fidelity surfaces

- Fonts and typography: unchanged; toolbar copy and hierarchy remain consistent with the source state.
- Spacing and layout rhythm: unchanged; the focused comparison confirms the swatch grid, gaps, padding, and menu radius remain stable.
- Colors and visual tokens: passed; all seven computed backgrounds are unique gradients, remain dark enough for the existing text, and avoid saturated red/green.
- Image quality and assets: not applicable; this control contains only existing Lucide icons and CSS color surfaces.
- Copy and content: passed; accessible labels are `夜雾墨 / 深海雾蓝 / 暮光靛 / 苔玉灰 / 烟熏玫瑰 / 古铜茶 / 月影灰紫`.

## Interaction verification

- Clicked `暮光靛`; the node background immediately changed to the corresponding three-stop gradient.
- Reopened the menu and confirmed only `暮光靛` reported `aria-checked="true"`.
- Reloaded the app, reopened the same project, and confirmed the selected gradient persisted.
- Verified all seven swatches expose distinct computed `background-image` values.
- Verified legacy grayscale preset strings resolve to their corresponding new gradients.
- Browser console errors after selection and reload: 0.

## QA history

1. Opened the supplied grayscale palette reference and captured the initial implementation state.
2. Replaced the seven grayscale solids with muted mineral gradients and added legacy-value normalization.
3. Fixed the later-loaded theme rule so node gradients survive default, hover, and selected states.
4. Captured the open palette, selected-state node, and focused side-by-side comparison.
5. Selected a color, reloaded the project, and confirmed persistence with no console errors.

final result: passed
---

# Design QA — 三类节点与展开面板同色（2026-07-26）

## Scope

- Source visual truth: `docs/design-qa/2026-07-26-node-surface-reference.png`
- Implementation screenshot: `docs/design-qa/2026-07-26-node-surface-implementation.jpg`
- Expanded-panel screenshot: `docs/design-qa/2026-07-26-node-surface-implementation-panel.jpg`
- Source pixels: 1389 × 1059
- Implementation capture: 1095 × 720 pixels from a 1280 × 720 CSS viewport
- State: dark theme; one empty text node, image node, and video node; video and image expanded-editor states checked

## Visual comparison

- The supplied reference and the current implementation were emitted together in one comparison input. The external reference viewport is taller than the fixed in-app browser viewport, so the comparison used the same three-node state plus a focused expanded-panel capture.
- Text, empty image, empty video, and the expanded editor all resolve to the same surface: `rgb(24, 24, 24)` / `#181818` / `--theme-panel`.
- The selected-node border remains brighter for orientation, but selection no longer changes the node fill.
- The default text preset now follows `--theme-panel`; the six intentionally selected premium gradients remain available.
- Media-result image and video nodes remain transparent so real assets are not covered by the empty-node surface.

## Findings

- P0: none
- P1: none
- P2: none
- P3: the source screenshot used a taller viewport than the available in-app browser preview; exact computed-color checks were used alongside the focused visual comparison.

## Interaction and runtime checks

- Opened the video editor, then the image editor, and confirmed the selected node and panel stay `rgb(24, 24, 24)`.
- Confirmed the text, image, and video prompt/editor surfaces remain borderless and visually merge into their default node surface.
- Confirmed the empty-state override is ordered after the generic hover/selected rule; regression tests lock that cascade order.
- Browser Vite error overlays: 0. The current in-app browser binding did not expose historical console collection during this pass.
- Focused regression tests: 6 passed.
- Web typecheck: passed.
- Full web suite: 337 passed, 0 failed.
- Web lint: 0 errors; 10 pre-existing warnings remain.
- Production build: passed; the existing main-chunk size warning remains.

## Comparison history

1. Sampled the expanded panel from the supplied screenshot at `#181818`.
2. Added a failing regression test covering the default text, empty image, empty video, expanded panel, and media transparency.
3. Mapped the three empty-node surfaces and direct text editor to the panel token, then reran the focused tests.
4. Opened the real saved canvas, compared source and implementation in one input, and measured all four rendered surfaces at `rgb(24, 24, 24)`.
5. Added a cascade-order assertion after independent review and reran the focused tests.

final result: passed

---

# Agent Composer Toolbar Design QA

- Source visual truth: `C:\tmp\mok-agent-toolbar-reference.png`
- Implementation screenshot: `C:\tmp\mok-agent-toolbar-implementation.png`
- Combined comparison: `C:\tmp\mok-agent-toolbar-comparison.png`
- Viewport: 1229 × 720 CSS px
- Source pixels: 999 × 258
- Implementation pixels: 1229 × 720
- CSS viewport: 1229 × 720
- Density normalization: implementation pixels matched the CSS viewport at 1:1; the source was treated as a focused before-state reference rather than scaled as an exact viewport target.
- State: dark canvas, Agent panel open and resized to 820 px, empty conversation, no menus open.

## Full-view comparison evidence

The final browser capture shows the Agent panel at a wide desktop size. The canvas-pick arrow and execution-mode control remain aligned to the lower-left edge, while the Agent model control and send button align to the lower-right edge. The action row spans 778 px inside the 820 px panel and reports no horizontal overflow.

## Focused-region comparison evidence

The combined comparison places the supplied before-state directly above the final footer crop. It confirms that the original four controls were clustered on the left, while the implementation preserves the same controls, sizing, order, color, typography, and spacing within two edge-aligned groups separated by flexible empty space.

## Required fidelity surfaces

- Fonts and typography: unchanged from the existing Agent controls; labels, weight, line wrapping, and model-name treatment remain consistent.
- Spacing and layout rhythm: left and right groups are edge-aligned with the existing 8 px intra-group gap; the middle absorbs resizing space.
- Colors and visual tokens: unchanged; existing dark surfaces and control states are preserved.
- Image quality and asset fidelity: no image assets were changed or introduced; existing Lucide control icons remain intact.
- Copy and content: unchanged; “手动”, Agent model name, and button labels remain the same.

## Comparison history

### Pass 1 — blocked

- Finding: P1, `.agent-composer-actions` remained content-width `inline-flex`, so assigning automatic margin to the model picker did not create visible separation when the panel was widened.
- Evidence: the panel measured 810 px while the action row measured only 296 px.
- Fix: explicitly set the action row to `display: flex` and `width: 100%`.

### Pass 2 — passed

- Post-fix evidence: at a 1229 × 720 viewport, the panel measured 820 px and the action row measured 778 px. The left group ended at 522 px, the right group began at 1013 px, the send button ended at 1201 px, and no overflow was detected.
- Interactions tested: opened the Agent panel, resized it to the wide state, toggled the execution-mode menu, and toggled the Agent-model menu.
- Console errors: none.

## Findings

No actionable P0, P1, or P2 differences remain for the requested toolbar grouping.

## Follow-up polish

No P3 changes are necessary for this focused adjustment.
final result: passed

---

# Agent Video Parameters, Prompt Text, and Alignment Guides Design QA

- Source visual truth:
  - `docs/design-qa/2026-07-27-video-text-reference.png`
  - `docs/design-qa/2026-07-27-guide-lines-reference.png`
- Implementation screenshots:
  - `docs/design-qa/2026-07-27-video-text-implementation.png`
  - `docs/design-qa/2026-07-27-guide-lines-implementation.png`
- Combined comparisons:
  - `docs/design-qa/2026-07-27-video-text-comparison.png`
  - `docs/design-qa/2026-07-27-guide-lines-comparison.png`
- Browser viewport: 1280 × 720 CSS px.
- Source pixels: 1158 × 570 for prompt text and 1071 × 1374 for guide lines.
- Implementation pixels: 1280 × 720 for each browser capture.
- Density normalization: the implementation captures matched the CSS viewport at 1:1. The supplied images were treated as focused before-state references; the comparisons use contain scaling and letterboxing without cropping.
- State: saved local canvas, video editor open for prompt inspection, then an overview canvas state during node drag.

## Functional verification

- Opened an Agent video action in manual mode and confirmed four unified dark-menu controls: model, size, resolution, and duration.
- Opened each new menu and changed size from `16:9` to `9:16`, resolution from `1080P` to `720P`, and duration from `8s` to `5s`; cancelled before starting a real generation job.
- Opened the saved video node with one reference image and a plain long prompt. The editor rendered no highlight layer and no `mention-textarea` class because no real `@图片` token was present.
- Dragged an image node into simultaneous horizontal and vertical alignment. Mid-drag there were exactly three vertical and three horizontal guides (edge, center, edge), with no near-duplicate pairs.
- The dragged node position was identical immediately before and after pointer release; measured release delta was `0 px` on both axes. All helper lines disappeared after release.

## Visual comparison

### Prompt text

The source reference shows two visible text layers offset over the same paragraph. The implementation comparison shows a single crisp text layer while preserving the existing panel surface, typography, wrapping, controls, and spacing. When a real `@图片` token is present, the highlight layer remains available and the textarea text fill is explicitly transparent.

### Alignment guides

The source reference shows paired dashed guides at nearly identical positions. The implementation comparison shows one guide for each aligned edge or center. The final snap coordinate is retained through drag stop, removing the small release-time displacement.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: the guide-line implementation screenshot uses the current saved canvas state and a wider overview than the supplied source; the focused comparison evaluates guide multiplicity and release stability rather than identical node composition.

## Runtime and regression checks

- Browser console errors: none.
- Focused regression tests: 20 passed.
- Full project check: passed.
- Tests: 525 passed, 0 failed.
- Type checks: passed for desktop, server, web, and shared workspaces.
- Lint: 0 errors; 11 pre-existing warnings remain.
- Production build: passed; the existing main-chunk size warning remains.
final result: passed

---

# Viewport Dropdown Menus Design QA

- Source visual truth: `docs/design-qa/2026-07-27-viewport-menu-reference.png`
- Implementation screenshot: `docs/design-qa/2026-07-27-viewport-menu-implementation.jpg`
- Flip-up screenshot: `docs/design-qa/2026-07-27-viewport-menu-flip-up.jpg`
- Combined comparison: `docs/design-qa/2026-07-27-viewport-menu-comparison.jpg`
- Browser viewport: 1280 × 720 CSS px.
- Source pixels: 607 × 349.
- Implementation pixels: 1280 × 720.
- State: saved local canvas, Agent panel open, manual video action waiting for confirmation, resolution menu open; second capture shows the footer execution-mode menu near the viewport bottom.

## Behavior verification

- Unified parameter dropdowns render under `document.body`, outside conversation and canvas clipping containers.
- The shared menu layer resolves to `z-index: 2147483000`.
- The video resolution menu opened downward when space was available, stayed inside the 720 px viewport, displayed all four options, and measured 148 px wide.
- The footer execution-mode menu detected the bottom collision and opened upward: trigger top 661.33 px, menu bottom 656.67 px.
- Menus recompute their position on window resize and capturing scroll events; long option lists receive the available-side maximum height and internal scrolling.
- Selection remained functional: resolution changed from 1080P to 720P and back, and execution mode changed from manual to auto and back. Test generation cards were cancelled without starting a media job.

## Visual comparison

The supplied reference shows the resolution list trapped below the conversation content and partially hidden by the lower panel. The implementation comparison shows the same menu above surrounding cards and footer content. The flip-up capture confirms that a trigger near the viewport bottom places the complete list above the trigger instead of extending below the screen.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: the implementation uses the current saved canvas and a wider viewport than the focused source crop; the comparison evaluates menu stacking, visibility, and collision behavior rather than identical canvas composition.

## Runtime and regression checks

- Browser console errors: none.
- Focused menu tests: 17 passed.
- Full project check: passed.
- Tests: 528 passed, 0 failed.
- Type checks: passed for desktop, server, web, and shared workspaces.
- Lint: 0 errors; 11 pre-existing warnings remain.
- Production build: passed; the existing main-chunk size warning remains.

final result: passed

---

# Design QA — 视频压缩

## Sources

- Reference: `.codex-logs/video-compression-reference.png`
- Implementation: `.codex-logs/video-compression-implementation.png`
- Combined comparison: `.codex-logs/video-compression-comparison-vertical.png`

## Capture state

- Browser: Codex in-app browser
- CSS viewport: `1342 × 984`
- Reference pixels: `1341 × 983`
- Implementation capture pixels: `1205 × 984` (the in-app browser screenshot surface is narrower than its explicit CSS viewport)
- State: existing `1248 × 704` video, compression dialog open, `480P` selected, expected output `850 × 480`

## Evidence

- Left side is the live source video preview with native playback controls.
- Right side reports the measured source resolution and exposes only lower `480P` and `360P` choices.
- Selecting `360P` updated the checked option and output summary to `638 × 360`; selecting `480P` restored `850 × 480`.
- Cancel closed the dialog.
- Browser console contained no error-level entries.
- Real FFmpeg smoke test converted `1280 × 720` to `854 × 480` and retained an AAC audio stream.

## Findings and history

1. Initial implementation matched the reference structure but the video-node toolbar hid the compression label because it reused an icon-only class.
2. The toolbar entry was changed to visibly show `视频压缩`.
3. Final comparison confirmed the dark modal, header, left preview, right configuration panel, selected target treatment, output summary, and footer actions are visually aligned with the reference.
4. The reference includes smart-adapt, 1080P, and 720P rows; the implementation intentionally omits them because this feature only permits down-compression to 480P or 360P.

final result: passed

---

# Design QA — 视频长度裁切

## Sources

- Source visual truth: `.codex-logs/video-trim-reference.png`
- Implementation screenshot: `.codex-logs/video-trim-implementation.png`
- Combined comparison: `.codex-logs/video-trim-comparison.png`

## Capture state

- Browser: Codex in-app browser
- CSS viewport: `1280 × 720`; explicit tall-layout inspection: `1098 × 1060`
- Reference pixels: `1095 × 1056`
- Implementation capture pixels: `1205 × 720` from the in-app browser screenshot surface
- Density normalization: both captures were placed on `1098 × 1060` comparison canvases with contain scaling and no crop
- State: existing `1248 × 704`, `5.2s` video; default selection `0:00.0–0:04.0`

## Required fidelity surfaces

- Fonts and typography: follows the existing Chinese sans-serif stack; heading, time values, limit summary and action hierarchy match the reference.
- Spacing and layout rhythm: header, large preview, transport controls, in/out controls, thumbnail timeline and footer preserve the reference ordering. The dialog adapts to a 720px-high viewport without hiding the timeline.
- Colors and visual tokens: neutral dark surfaces use project-approved grayscale values; selected range uses the approved featured-gold accent, and errors use the approved danger red.
- Image quality and asset fidelity: the preview and timeline use frames extracted from the actual source video in memory; no generic or persisted image asset replaces the source content. Icons come from the existing Lucide library.
- Copy and content: `长度裁切`, `入点`, `出点`, `已选`, the `1–4s` limit, source resolution note and confirmation action are present and readable.

## Interaction and runtime checks

- Toolbar exposes a visible `长度裁切` entry.
- Default selection is the maximum allowed `4.0s`; videos shorter than one second disable trimming.
- `+ / -` controls move the in/out points by `0.1s` and update the selected duration immediately.
- Dragging the yellow selection moved `0:00.1–0:04.1` to `0:00.6–0:04.6` without changing its four-second duration.
- Dragging the out handle past the limit stopped at exactly `1.0s`, confirming the minimum duration guard.
- Selection playback stopped automatically at the out point; reset restored `0:00.0–0:04.0`.
- Cancel closed the dialog. Confirmation was intentionally not clicked on the user's saved canvas, so QA created no user asset.
- Browser console errors: none.
- Real FFmpeg smoke: trimmed from `1.5s` for `3.0s`; output was `1280 × 720`, retained AAC audio, and probed at `3.02s`.

## Comparison history

1. Pass 1 found a P2 responsive issue: at a 720px-high viewport the timeline fell below the scroll fold.
2. The content area was converted to an adaptive grid with a flexible preview row and a fixed visible timeline row.
3. Pass 2 showed the complete preview, transport, in/out controls, real thumbnails, range handles and footer in one viewport. No actionable P0/P1/P2 difference remained.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: the supplied reference uses a taller viewport and permits much longer selections; the implementation intentionally replaces that duration rule with the requested hard `1–4s` range.

final result: passed

---

# Design QA — 移除视频节点喇叭

## Sources

- Source visual truth: `C:/Users/Lzw/AppData/Local/Temp/codex-clipboard-d72afc85-e180-4c32-899b-7fa63447daa2.png`
- Implementation screenshot: `.codex-logs/remove-video-speaker-implementation.png`
- Combined comparison: `.codex-logs/remove-video-speaker-comparison.png`

## Capture state

- Browser: Codex in-app browser
- CSS viewport: `1280 × 720`
- Source pixels: `296 × 300`
- Implementation focus capture: `351 × 208`
- Density normalization: both images use density `1`; the combined comparison preserves each focus crop at native pixels with a `24px` separator.
- State: an existing canvas video node is selected, the pointer is over the video preview, native playback controls remain enabled, and audio is unmuted.

## Required fidelity surfaces

- Fonts and typography: no typography changed; the video-node title and toolbar remain on the existing project type scale.
- Spacing and layout rhythm: removing the absolutely positioned overlay leaves the video crop, radius and native control layout unchanged.
- Colors and visual tokens: no palette or token changed; the dark speaker tile and its border are intentionally absent.
- Image quality and asset fidelity: the implementation uses the existing source video without replacement, crop changes or new assets.
- Copy and content: no product copy changed; only the redundant custom sound control was removed.

## Full-view and focused comparison evidence

- DOM inspection found `0` `.video-sound-toggle` elements across the rendered canvas.
- The selected video still reports `controls: true` and `muted: false`, so playback and audio remain available through the native player.
- The focused side-by-side comparison shows the reference's large lower-right speaker overlay and the implementation without that overlay.
- A separate full-canvas inspection confirmed the video toolbar, node title, video preview and neighboring nodes remain intact.
- Browser console errors: none.
- No additional focused region was needed because the requested change is isolated to one lower-right overlay control.

## Comparison history

1. The source identified one unwanted P2 overlay: a second, oversized speaker control covering the lower-right video content.
2. The custom button, dedicated mute state and unused CSS were removed; the native video controls were retained.
3. Post-fix browser capture and DOM inspection confirmed the overlay is gone with no P0/P1/P2 regression.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

final result: passed
