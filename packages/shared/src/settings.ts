// 即梦 Flow 工作台 - Settings 数据模型
// 参考 PRD 11.3 节、第 8.6 节、第 7.1 节
// 本地工具，配置以明文 JSON 形式存储在 workspace/config/settings.json（已加入 .gitignore）。

/** JimengCli_api 鉴权方式 */
export type AuthMode = "apiKey" | "cookie" | "token";

/** 全局 Settings 配置 */
export interface Settings {
  /** JimengCli_api 服务地址，例如 http://localhost:3000 */
  jimengBaseUrl: string;
  /** 鉴权方式 */
  authMode: AuthMode;
  /** API key / cookie / token 明文（本地工具） */
  apiKey: string;

  /** 中转站或 OpenAI-compatible LLM 服务地址 */
  llmBaseUrl: string;
  /** 默认 LLM 模型 */
  llmModel: string;
  /** LLM API key */
  llmApiKey: string;

  /** 输出目录，相对项目根 */
  outputDir: string;

  /** 默认图片模型 */
  defaultModel: string;
  /** 默认图片尺寸，例如 1024x1024 */
  defaultSize: string;

  /** 默认视频模型 */
  defaultVideoModel: string;
  /** 默认视频比例，例如 16:9 */
  defaultVideoAspectRatio: string;
  /** 默认视频分辨率，例如 720P */
  defaultVideoResolution: string;
  /** 默认视频清晰度，例如 standard */
  defaultVideoQuality: string;
  /** 默认视频时长（秒） */
  defaultVideoDurationSeconds: number;
  /** 默认视频生成数量 */
  defaultVideoCount: number;
  /** 默认视频是否生成音频 */
  defaultVideoGenerateAudio: boolean;
}

/** 默认 Settings 值（参考 PRD 11.3 与任务说明） */
export const DEFAULT_SETTINGS: Settings = {
  jimengBaseUrl: "",
  authMode: "apiKey",
  apiKey: "",

  llmBaseUrl: "https://api.openai.com/v1",
  llmModel: "gpt-4o-mini",
  llmApiKey: "",

  outputDir: "./workspace/outputs",

  defaultModel: "jimeng",
  defaultSize: "1024x1024",

  defaultVideoModel: "seedance-2.0",
  defaultVideoAspectRatio: "16:9",
  defaultVideoResolution: "720P",
  defaultVideoQuality: "standard",
  defaultVideoDurationSeconds: 5,
  defaultVideoCount: 1,
  defaultVideoGenerateAudio: true,
};
