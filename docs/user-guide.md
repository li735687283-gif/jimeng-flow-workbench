# MO.K 当前使用说明

本文只记录当前可用的用户流程。安装、启动和工程命令见根 [`README.md`](../README.md)，Windows 安装包与升级说明见 [`windows-desktop-release.md`](windows-desktop-release.md)。

## 项目管理

- 首页“全部项目”和左上角头像菜单中的“历史记录”会打开同一个大尺寸项目管理界面。
- 项目卡片显示当前画布缩略图；没有可用预览时显示统一占位内容。
- 可以直接打开项目、修改项目名称或删除项目。删除前会要求确认，删除当前项目后应用会回到可继续操作的状态。
- 项目管理界面不提供旧版“历史工作流”和“新建工作流”入口；新项目仍从首页的新建项目卡片创建。

## 文本节点

1. 单击文本节点打开提示词面板，输入要交给大语言模型处理的内容。
2. 如需分析图片或反推提示词，把图片节点连接到文本节点；文本请求会携带直接上游图片。
3. 选择文本模型并发送。请求运行时，节点正文区域显示白点、扫光和进度条，输入控件暂时禁用。
4. 请求完成后，结果写入文本节点正文，运行指示自动消失。

文本节点左下角不显示持久化状态文案。刷新或异常中断留下的旧 `running` 状态会静默恢复为空闲；是否正在请求只以当前运行时状态为准。

## 第三方文本模型

在“设置 → 第三方模型”中配置 Provider，再把需要的模型加入文本模型列表。每个 API Key 输入框旁都有“获取 API Key”链接，会交给系统浏览器打开官方密钥页面。

| Provider | 默认 Base URL | API Key 页面 | 说明 |
| --- | --- | --- | --- |
| Kimi API | `https://api.moonshot.cn/v1` | [Kimi 开放平台](https://platform.kimi.com/console/api-keys) | 按量付费的开放平台接口 |
| Kimi Coding Plan | `https://api.kimi.com/coding/v1` | [Kimi Coding 控制台](https://www.kimi.com/code/console) | 使用会员 Coding 权益和独立 Coding Plan API Key |
| DeepSeek API | `https://api.deepseek.com` | [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) | 独立 API Key 的 OpenAI-compatible 接口 |

Kimi API 与 Kimi Coding Plan 是两套独立连接，Base URL、API Key 和模型列表不能混用。配置保存到本机工作区，不要把真实密钥写入源码、文档、日志或 Git。
