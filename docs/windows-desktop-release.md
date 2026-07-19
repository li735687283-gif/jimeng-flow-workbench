# MO.K Windows 桌面版构建与发布

MO.K 桌面版使用 Electron、electron-builder、NSIS 和 electron-updater。React 画布、Fastify 后端与 mok CLI 仍是同一套代码和数据契约。

## 本地运行与构建

在仓库根目录使用 npm：

```powershell
npm ci
npm run dev:desktop
npm run build:desktop
npm run package:win
```

`dev:desktop` 启动 Vite 和 Electron。Electron 会探测并按需启动 Fastify；不会重复启动已经在 `127.0.0.1:8787` 运行的 MO.K 服务。生产窗口通过 `http://127.0.0.1:8787/canvas` 打开打包后的 Web，不依赖 Vite 开发服务器。

`package:win` 会在 `release/.builder-*/` 使用独立 staging 目录构建 NSIS，再把正式发布文件复制到 `release/`。这样可以避开 Windows 安全扫描器长期占用旧 `app.asar` 的问题。

## 数据目录与升级

生产版把设置、工作流、素材和生成结果放在 Electron 的 `app.getPath('userData')/workspace`。Windows 上通常是 `%APPDATA%\MO.K\workspace`，以实际 Electron userData 路径为准。

首次运行时，如果稳定目录为空，应用会从以下旧位置择一迁移：

- `MOK_LEGACY_WORKSPACE_DIR` 指定的目录；
- 开发工程的 `workspace/`；
- 旧版可执行文件或资源目录旁的 `workspace/`。

已有 userData 不会被覆盖。安装升级和应用版本号变化都继续使用同一个 userData，所以安装目录被替换不会丢失工作流。

## 升级版本号

桌面应用版本取自根 `package.json` 的 `version`。发布前修改它，并同步锁文件：

```powershell
npm version patch --no-git-tag-version
npm install --package-lock-only
npm run check
npm run package:win
```

也可以按发布范围使用 `minor` 或 `major`。不要只改安装包文件名，也不要手工修改 `latest.yml`。

## 创建 GitHub Release

更新源固定为当前仓库 `li735687283-gif/jimeng-flow-workbench` 的 GitHub Releases。

1. 完成版本提交并创建与版本一致的标签，例如 `v0.2.0`。
2. 推送提交和标签。
3. 在 GitHub 创建正式 Release。自动更新不应依赖 Draft Release。
4. 上传 `release/` 下同一轮构建生成的三个文件：
   - `MO.K-Setup-<version>.exe`
   - `MO.K-Setup-<version>.exe.blockmap`
   - `latest.yml`
5. 发布 Release。不要混用不同构建轮次的 EXE、blockmap 和 `latest.yml`。

应用只在正式打包环境启动后检查更新。开发模式不会访问真实更新源；也可用 `MOK_DISABLE_AUTO_UPDATE=1` 临时禁用。没有更新时不弹窗。更新可用时会后台下载，下载完成后提示用户；选择稍后会在正常退出时安装，下次启动进入新版本。网络、版本解析或下载失败只记录错误，不会让应用崩溃。

## Windows 代码签名

仓库不包含证书。electron-builder 会在构建环境提供签名变量时使用真实证书：

```powershell
$env:CSC_LINK = 'C:\secure\mok-signing.pfx'
$env:CSC_KEY_PASSWORD = '<从安全凭据系统读取>'
npm run package:win
```

也可以按 electron-builder 支持的方式让 `CSC_LINK` 指向受保护的证书内容。证书、密码和私钥不得提交到仓库、前端资源或安装包中的配置文件。

未签名版本可以用于内部测试，但 Windows SmartScreen 可能显示“未知发布者”，下载与安装的信任体验较差。公开发布前应使用稳定的代码签名证书；换证书或发布者名称会影响升级信任链，需要单独验证从旧版本更新到新版本。

## 发布前检查

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run build:desktop
npm run package:win
git diff --check
```

还应在干净的 Windows 用户目录中验证安装、启动、退出和再次启动，确认后端只监听 `127.0.0.1:8787`，并用以下命令验证 CLI：

```powershell
npm run mok -- health --json
npm run mok -- flow list --json
```
