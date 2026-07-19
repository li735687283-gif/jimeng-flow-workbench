# MO.K 本地 CLI

画布名称：墨K / MO.K。CLI 只连接本机后端，默认地址为 `http://127.0.0.1:8787`，会拒绝公网和局域网地址。

## 调用

```powershell
npm run mok -- health --json
npm run mok -- flow list --json
npm run mok -- canvas inspect --flow <flow-id> --json
```

所有成功和失败结果都输出 JSON；`--json` 保留为 Agent 调用时的显式标记。API 地址可用 `MOK_API_URL` 或 `--base-url` 指定，但仍必须是 `127.0.0.1`、`localhost` 或 `::1`。

## 画布控制

```powershell
npm run mok -- flow create --name "产品海报"
npm run mok -- node add --flow <flow-id> --type image --title "主视觉" --prompt "黑色耳机产品海报"
npm run mok -- node list --flow <flow-id>
npm run mok -- edge connect --flow <flow-id> --from <source-node> --to <target-node>
npm run mok -- node update --flow <flow-id> --id <node-id> --patch '{"data":{"prompt":"改写后的提示词"}}'
```

节点和连线变更会读取完整工作流，再通过现有工作流更新接口写回；删除节点时会同时移除相关连线。

## 生成与 Agent

```powershell
npm run mok -- generate image --flow <flow-id> --node <node-id> "一张产品海报" --count 4 --json
npm run mok -- generate status <generation-id> --wait --json
npm run mok -- agent prompt "把这个产品海报提示词改成中文" --flow <flow-id> --json
```
图片节点和 `generate image` 未显式传入 `--model` 时，默认使用 `codex:gpt-5.5`，界面显示为“GPT Image（OpenAI CLI）”。


生成任务沿用画布后端的图片/视频接口，不在 CLI 内保存密钥，也不新增公网监听端口。
