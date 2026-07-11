# 前端类型与测试基线恢复 Implementation Plan

> **For agentic workers:** Execute each task against the isolated `codex/frontend-baseline` worktree. Keep production fixes separate from contract-only test migrations, and do not edit the user's dirty main-tree files.

**Goal:** 让 Web TypeScript、161 项现有 Web 测试及根级工程检查恢复绿色，同时修复视频任务刷新恢复和首页 MO.K 视觉配置的真实回归。

**Architecture:** 先按提交历史区分运行时缺陷与测试契约漂移。生成与 UI 的过期测试迁移到当前 `image`/`video`、`ManagedWork`、直接上游、统一校验标签和 datalist 模型控件；视频恢复标识在 shared schema 中持久化；首页仅保留仍被当前页面消费的 MO.K 主图配置，废弃的旧 creative-card 背景 prop 从组件调用链移除。所有实现先在隔离 worktree 验证，再按文件级冲突边界集成到用户主工作树。

**Tech Stack:** React 19、TypeScript、Node test runner、React DOM SSR、Zustand、Vite、npm workspaces

## Global Constraints

- [ ] 不覆盖或提交用户主工作树现有的 `App.css`、`VideoPlayerModal.tsx`、`ImageNode.tsx`、`VideoNode.tsx`、`registry.ts`、`flowStore.ts` 改动。
- [ ] 过期测试必须迁移到当前产品契约，不能为通过测试恢复已明确删除的 Generate 节点、旧首页 greeting、旧 ManagedVideo schema 或旧搜索筛选 UI。
- [ ] 真实生产缺陷必须先增加或更新失败测试，再写实现。
- [ ] 不用类型断言掩盖 `Asset | ManagedWork`；拆开两个集合，使分支类型天然收窄。
- [ ] 不恢复已经失效的 `homeHeroImagePath` UI；当前页面只消费 MO.K 主图。兼容字段继续保留在 shared settings 中，不破坏旧配置解析。
- [ ] `VideoPlayerModal` 的 `orient` 在用户主树已由用户删除；隔离树只做等价单行修复，集成时不得覆盖用户播放器重构。
- [ ] 色彩测试改为中性色加明确语义色白名单；不把金色精选、蓝色操作和红色危险态机械改成灰色。

---

### Task 1: 迁移生成链路测试到当前节点契约

**Files:**

- Modify: `apps/web/test/canvasStore.edgeReferences.test.ts`
- Modify: `apps/web/test/generationFlow.test.ts`
- Modify: `apps/web/test/imageGenerationInputs.test.ts`
- Modify: `apps/web/test/imageValidationProvider.test.ts`

- [ ] 把已删除的 `generate` 目标 fixture 改为当前 `image` 节点，继续断言连接后追加 asset 引用。
- [ ] 生成入口源码检查覆盖 `AgentPanel.tsx`、`ImageNode.tsx`、`VideoNode.tsx`、`VideoComposer.tsx`，不再读取已删除的 `GenerateComposer.tsx`。
- [ ] 直接上游测试只期待当前节点与一层上游 asset，不再期待递归祖先。
- [ ] Provider 校验测试断言统一 `校验` 标签及 Jimeng/Codex 两条真实校验分支，不依赖旧按钮文案。

Run:

```powershell
node --import tsx --test apps/web/test/canvasStore.edgeReferences.test.ts apps/web/test/generationFlow.test.ts apps/web/test/imageGenerationInputs.test.ts apps/web/test/imageValidationProvider.test.ts
```

Expected: 16/16 通过。

---

### Task 2: 迁移 UI 测试并保留有价值的设计约束

**Files:**

- Modify: `apps/web/test/codexSettingsStatus.test.tsx`
- Modify: `apps/web/test/homeFeaturedVideos.test.tsx`
- Modify: `apps/web/test/homePage.test.tsx`
- Modify: `apps/web/test/monochromePalette.test.ts`
- Modify: `apps/web/test/settingsModalHomeVisual.test.tsx`
- Modify: `apps/web/test/videoAdminModal.test.tsx`

- [ ] Settings 测试断言当前 OpenAI CLI 分区、`input[list] + datalist` 和可选择 Codex chat/image 选项，不依赖已改写的说明文案或 `<select>` 标签。
- [ ] 首页精选 fixture 使用 `featuredWorks` 与完整 `ManagedWork` schema；继续验证封面、静音、循环播放。
- [ ] 首页 shell 测试断言 MO.K 主图、Logo 菜单、新建画布、项目与作品层，不恢复已删除的 greeting/creative-card/首页菜单项。
- [ ] 色彩测试允许当前经过设计确认的 semantic accent hex，其余 hex 仍必须是中性色。
- [ ] 首页视觉测试改为当前仍生效的 `首页主图（MO.K）` 上传、预览、尺寸与位置控制；先保持 RED，等待 Task 4 恢复生产入口。
- [ ] 作品管理测试迁移到 `ManagedWork`/作品术语，断言视频与图片切换、上传、精选 tab、编辑与分页；不重新加入只为 SSR 注入数据的 `initialVideos`。

Run:

```powershell
node --import tsx --test apps/web/test/codexSettingsStatus.test.tsx apps/web/test/homeFeaturedVideos.test.tsx apps/web/test/homePage.test.tsx apps/web/test/monochromePalette.test.ts apps/web/test/settingsModalHomeVisual.test.tsx apps/web/test/videoAdminModal.test.tsx
```

Expected before Task 4: 仅 MO.K 设置入口测试保持 RED；其余迁移后的契约通过。

---

### Task 3: 修复视频恢复 schema 与无行为类型债务

**Files:**

- Modify: `packages/shared/src/videoNode.ts`
- Modify: `apps/web/test/videoGenerationState.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/HomePage.tsx`
- Modify: `apps/web/src/components/VideoAdminModal.tsx`
- Modify: `apps/web/src/components/VideoPlayerModal.tsx`

- [ ] 先增加 `mergeVideoDefaults` 保留 `generationId` 的失败测试。
- [ ] 在 `VideoNodeData` 声明 `generationId?: string`，并在 `mergeVideoDefaults` 中保留该字段，使持久化节点刷新后可以恢复 SSE/轮询订阅。
- [ ] 删除未接 UI 的 duplicate selector/callback；保留仍供画布返回使用的 `handleShowHome`。
- [ ] 从 HomePage 调用链删除已失效的 `heroImageUrl` 与 `onReturnHome` props；shared settings 的旧字段保留兼容。
- [ ] 将 managed gallery 和 asset fallback 拆成独立数组，消除联合类型错误。
- [ ] 删除 `requireCover` 死变量；真实封面校验仍由提交路径负责。
- [ ] 隔离树删除非标准 `orient` 属性；主树集成时识别为用户已应用，不覆盖整文件。

Run:

```powershell
node --import tsx --test apps/web/test/videoGenerationState.test.ts
npm run typecheck:web
```

Expected: 视频状态测试通过；Web TypeScript 只可能剩 Task 4 新代码引入的问题，不再出现原 17 条。

---

### Task 4: 恢复当前 MO.K 首页主图设置入口

**Files:**

- Modify: `apps/web/src/components/SettingsModal.tsx`
- Modify: `apps/web/test/settingsModalHomeVisual.test.tsx`

- [ ] 复用现有 `uploadAsset` 与 `getAssetFileUrl` API，接收点击或拖入的图片并写入 `homeMokHeroImagePath`。
- [ ] 显示当前图片或默认 MO.K 图的即时预览。
- [ ] 恢复大小、左右、上下、上边距四个受控 range，写入现有 settings 字段，并提供重置默认值。
- [ ] 清除只清空自定义 MO.K 图片，不删除本地 asset；保存仍走现有 `saveSettings`。
- [ ] 不恢复旧 creative-card 的 `首页背景` 上传入口，避免继续暴露无消费者配置。

Run:

```powershell
node --import tsx --test apps/web/test/settingsModalHomeVisual.test.tsx
npm run typecheck:web
```

Expected: 测试与类型检查均退出 0。

---

### Task 5: 全量验证、审查与安全集成

- [ ] 按 React best-practices 检查 effect 依赖、blob/object URL 生命周期、表单受控状态和无障碍标签。
- [ ] 运行独立 code review；修复所有 Critical/Important 发现。
- [ ] 在隔离树运行完整验证：

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run check
git diff --check
git status --short
```

Expected: typecheck、lint、240+ 测试、build、check 全部退出 0；lint 允许既有 warning 但不得有 error。

- [ ] 将不触碰用户 dirty 文件的提交正常集成。
- [ ] 对 `VideoPlayerModal.tsx` 识别为用户已等价修复；不应用隔离树整文件。
- [ ] 集成前后记录主树六个 dirty 文件的 diff/hash，确认用户改动未丢失、未被 stage、未被提交。
- [ ] 在主树重新运行 `npm run typecheck:web`、`npm run test:web`、`npm run build`。

Expected: 主树验证绿色；用户原有 dirty 文件仍保持 dirty 且内容完整。
