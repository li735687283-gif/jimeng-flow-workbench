---
name: mok-batch
description: 批量把一批图片提示词发到墨K画布（MO.K）上生成。当用户给出一批提示词想批量生图、批量上画布、不想一条条粘贴时使用。通过仓库自带的 mok CLI（scripts/mok.mjs）完成，只连本机后端。
---

# MO.K 画布批量生图

把一批提示词一次性变成画布上的图片节点并发起生成，全程通过 mok CLI，不要逐条调 API，也不要自己拼 HTTP 请求。

## 前置条件

- 后端在跑：`npm run mok -- health --json` 能通（默认 `http://127.0.0.1:8787`）。不通就先提醒用户启动（`npm run dev`），不要自己改配置。
- 所有命令在仓库根目录执行。

## 步骤

1. **确认目标项目**。用户指定了项目就用 `npm run mok -- flow list --json` 找到对应 `id`；用户没指定或要新项目，用 `--new "项目名"`。
2. **整理清单**。把提示词写成 JSON 清单，保存到 `.tmp/batch-<时间戳>.json`：

```json
{
  "model": "jimeng-5.0",
  "width": 1536,
  "height": 864,
  "count": 1,
  "items": [
    { "title": "可选标题", "prompt": "提示词一" },
    { "prompt": "提示词二", "model": "codex:gpt-5.5", "width": 1024, "height": 1024 }
  ]
}
```

   - 每条 `prompt` 必填；顶层 `model/width/height/count` 是默认值，条目可覆盖。
   - 用户没指定模型时，批量场景默认用 `jimeng-5.0`（实测约 30 秒/张）；GPT Image（`codex:gpt-5.5`）一张要 15–20 分钟且易超时，仅当用户明确要求时使用。
3. **执行批量**：

```powershell
npm run mok -- generate batch --flow <flow-id> --file .tmp/batch-<时间戳>.json --wait --json
```

   - 任务多、耗时长时不加 `--wait`，先返回提交结果让用户去画布看进度。
4. **汇报**。用中文汇总：成功提交几条、失败几条及原因、`--wait` 时列出每张图的 assetId。
5. **提醒用户**：刷新画布页面（或重开项目）查看进度和结果；刷新前不要在画布上编辑，避免浏览器里的旧画布覆盖新节点。

## 注意

- 节点按每行 3 个的网格接在现有节点右侧；用户要求别的排布时加 `--start-x/--start-y/--columns`。
- 部分提交失败不会中断整批；把失败的提示词和原因如实告诉用户，不要静默重试。
- 完整命令说明见 `docs/mok-cli.md`。
