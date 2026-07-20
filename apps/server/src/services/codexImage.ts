import { spawn } from 'node:child_process'
import { constants, existsSync, readdirSync, statSync } from 'node:fs'
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import {
  extname,
  isAbsolute,
  join,
  resolve,
} from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  GenerationRequest,
  GenerationResult,
} from '@jimeng-flow/shared/generateNode'
import type { Settings } from '@jimeng-flow/shared/settings'
import { getProjectRoot, resolveOutputDir, resolveRuntimePath } from '../config'
import { getAsset, getAssetFilePath } from './assets'
import { getSettings } from './settings'

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
])
const DEFAULT_CODEX_TIMEOUT_MS = 600_000

export interface CodexCommandResult {
  stdout: string
  stderr: string
}

export interface CodexCommandOptions {
  cwd: string
  input?: string
  timeoutMs?: number
}

export type CodexRunCommand = (
  command: string,
  args: string[],
  options: CodexCommandOptions,
) => Promise<CodexCommandResult>

export interface CodexImageFile {
  path: string
  mtimeMs: number
  size: number
}

export interface CodexTextMessage {
  role?: string
  content?: string
}

export interface CodexTextRequest {
  model: string
  messages: CodexTextMessage[]
  /** 为 true 时不再要求"输出纯文本"（调用方需要 JSON 等结构化输出） */
  expectJson?: boolean
}

export interface CodexTextResult {
  content: string
}

export interface CodexImageStatus {
  available: boolean
  cliFound: boolean
  authFound: boolean
  helperFound: boolean
  codexPath: string
  authFile?: string
  helperPath?: string
  setupCommands: {
    installCodex: string
    installImageHelper?: string
    login: string
  }
  message: string
}

export interface CodexImageDeps {
  codexPath?: string
  cwd?: string
  outputDir?: string
  settings?: Pick<Settings, 'outputDir'>
  env?: Record<string, string | undefined>
  now?: () => number
  commandExists?: (command: string) => Promise<boolean>
  fileExists?: (path: string) => Promise<boolean>
  runCommand?: CodexRunCommand
  listImageFiles?: (dir: string) => Promise<CodexImageFile[]>
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase()
}

export function isCodexImageModel(modelId: string): boolean {
  const id = normalizeModelId(modelId)
  return id === '$imagegen' || id === 'gpt-image-2' || id.startsWith('codex:')
}

function getCodexPath(
  deps: Pick<CodexImageDeps, 'codexPath' | 'env'> = {},
): string {
  const env = deps.env ?? process.env
  const explicitPath =
    deps.codexPath?.trim() ||
    env.CODEX_BIN?.trim() ||
    env.CODEX_CLI_PATH?.trim()
  if (explicitPath) return explicitPath
  if (deps.env === undefined && process.platform === 'win32') {
    try {
      const root = join(
        env.LOCALAPPDATA?.trim() || join(homedir(), 'AppData', 'Local'),
        'OpenAI',
        'Codex',
        'bin',
      )
      const nativePath = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(root, entry.name, 'codex.exe'))
        .filter((path) => existsSync(path))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
      if (nativePath) return nativePath
    } catch {
      // Fall back to PATH when the native Codex install is unavailable.
    }
  }
  return process.platform === 'win32' ? 'codex.cmd' : 'codex'
}

function getCodexExecModel(modelId: string): string {
  const raw = modelId.trim()
  const id = normalizeModelId(raw)
  if (!id || id === '$imagegen' || id === 'gpt-image-2') return ''
  if (!id.startsWith('codex:')) return ''

  const value = raw.slice(raw.indexOf(':') + 1).trim()
  const normalized = normalizeModelId(value)
  if (!value || normalized === '$imagegen' || normalized === 'gpt-image-2') {
    return ''
  }
  return value
}

function getCodexTextExecModel(modelId: string): string {
  const raw = modelId.trim()
  const id = normalizeModelId(raw)
  if (!id || id.startsWith('$imagegen') || id.startsWith('gpt-image')) return ''
  if (!id.startsWith('codex:')) return raw
  return raw.slice(raw.indexOf(':') + 1).trim()
}

function getCodexTimeoutMs(
  deps: Pick<CodexImageDeps, 'env' | 'timeoutMs'> = {},
): number {
  if (deps.timeoutMs && Number.isFinite(deps.timeoutMs)) return deps.timeoutMs
  const env = deps.env ?? process.env
  const raw = Number(env.CODEX_CLI_TIMEOUT ?? '')
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_CODEX_TIMEOUT_MS
  return Math.max(30_000, Math.min(raw * 1000, 3_600_000))
}

function getCodexSetupCommands(): CodexImageStatus['setupCommands'] {
  return {
    installCodex: process.platform === 'win32'
      ? 'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://chatgpt.com/codex/install.ps1 | iex"'
      : 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
    login: 'codex',
  }
}

function summarizeOutput(stdout: string, stderr: string): string {
  const text = [stdout, stderr].filter(Boolean).join('\n').trim()
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function isCodexAuthError(message: string): boolean {
  return /(auth|login|sign in|401|unauthorized|credentials|api key)/i.test(message)
}

function isCodexCommandNotFoundError(message: string): boolean {
  return /\bENOENT\b|command not found|not recognized as an internal or external command|系统找不到指定的文件|找不到.*(?:文件|命令)/i.test(
    message,
  )
}

function wrapCodexCommandError(source: string, err: unknown): Error {
  const message = getErrorMessage(err)
  if (isCodexCommandNotFoundError(message)) {
    return new Error(
      `未找到 ${source} 可执行命令。请安装 Codex CLI，或通过 CODEX_BIN 指定 codex.exe、codex.cmd 或 codex。原始错误：${message}`,
    )
  }
  if (isCodexAuthError(message)) {
    return new Error(
      `OpenAI CLI 未登录或登录态失效。请在设置里的 OpenAI CLI 区块复制并运行“打开登录”命令：codex。原始错误：${message}`,
    )
  }
  return new Error(`${source} 调用失败：${message}`)
}

function quoteWindowsCommandArg(value: string): string {
  if (!value) return '""'
  return `"${value.replace(/(["^&|<>])/g, '^$1')}"`
}

function resolveWindowsBatchCommand(command: string): string {
  if (process.platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(command)) {
    return command
  }
  if (command.includes('\\') || command.includes('/') || isAbsolute(command)) {
    return command
  }

  const pathValue = process.env.Path || process.env.PATH || ''
  for (const entry of pathValue.split(';')) {
    const dir = entry.trim().replace(/^"|"$/g, '')
    if (!dir) continue
    const candidate = join(dir, command)
    if (existsSync(candidate)) return candidate
  }
  return command
}

async function defaultRunCommand(
  command: string,
  args: string[],
  options: CodexCommandOptions,
): Promise<CodexCommandResult> {
  return new Promise((resolvePromise, reject) => {
    const needsCmdLauncher = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command)
    const launchCommand = needsCmdLauncher
      ? resolveWindowsBatchCommand(command)
      : command
    const commandLine = [launchCommand, ...args].map(quoteWindowsCommandArg).join(' ')
    const child = spawn(
      needsCmdLauncher ? process.env.ComSpec || 'cmd.exe' : launchCommand,
      needsCmdLauncher
        ? [
            '/d',
            '/s',
            '/c',
            `"${commandLine}"`,
          ]
        : args,
      {
        cwd: options.cwd,
        windowsHide: true,
        windowsVerbatimArguments: needsCmdLauncher,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`OpenAI Codex CLI 执行超时（${(options.timeoutMs ?? DEFAULT_CODEX_TIMEOUT_MS) / 1000}s）`))
    }, options.timeoutMs ?? DEFAULT_CODEX_TIMEOUT_MS)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code && code !== 0) {
        reject(new Error(`OpenAI Codex CLI 调用失败：${summarizeOutput(stdout, stderr) || `exit=${code}`}`))
        return
      }
      resolvePromise({ stdout, stderr })
    })
    child.stdin.end(options.input ?? '')
  })
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function defaultCommandExists(command: string): Promise<boolean> {
  if (command.includes('\\') || command.includes('/') || isAbsolute(command)) {
    return defaultFileExists(command)
  }

  const lookup = process.platform === 'win32' ? 'where.exe' : 'which'
  try {
    await defaultRunCommand(lookup, [command], {
      cwd: getProjectRoot(),
      timeoutMs: 10_000,
    })
    return true
  } catch {
    return false
  }
}

function getCodexAuthCandidates(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const candidates = [
    env.GPT_IMAGE_2_SKILL_AUTH_FILE?.trim(),
    env.CODEX_AUTH_FILE?.trim(),
    env.USERPROFILE
      ? join(env.USERPROFILE, '.codex', 'auth.json')
      : undefined,
    join(homedir(), '.codex', 'auth.json'),
  ].filter((path): path is string => !!path)
  return Array.from(new Set(candidates))
}

async function findCodexAuthFile(
  env: Record<string, string | undefined>,
  fileExists: (path: string) => Promise<boolean>,
): Promise<string | undefined> {
  for (const candidate of getCodexAuthCandidates(env)) {
    if (await fileExists(candidate)) return candidate
  }
  return undefined
}

export async function getCodexImageProviderStatus(
  deps: CodexImageDeps = {},
): Promise<CodexImageStatus> {
  const env = deps.env ?? process.env
  const codexPath = getCodexPath(deps)
  const commandExists = deps.commandExists ?? defaultCommandExists
  const fileExists = deps.fileExists ?? defaultFileExists
  const cliFound = await commandExists(codexPath)

  const authFile = await findCodexAuthFile(env, fileExists)
  const authFound = !!authFile

  if (cliFound && deps.runCommand) {
    await deps.runCommand(codexPath, ['--version'], {
      cwd: deps.cwd ?? getProjectRoot(),
      timeoutMs: 10_000,
    }).catch(() => undefined)
  }

  return {
    available: cliFound,
    cliFound,
    authFound,
    helperFound: false,
    codexPath,
    authFile,
    setupCommands: getCodexSetupCommands(),
    message: cliFound
      ? authFound
        ? 'OpenAI Codex CLI 可用'
        : 'OpenAI Codex CLI 已安装，未找到 auth 文件；登录状态会在首次执行时由 CLI 校验'
      : 'OpenAI Codex CLI 未就绪，请确认已安装 codex 并完成登录',
  }
}

function imageExtFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'image/jpeg') return '.jpg'
  if (normalized === 'image/webp') return '.webp'
  if (normalized === 'image/gif') return '.gif'
  if (normalized === 'image/bmp') return '.bmp'
  return '.png'
}

function isAssetId(value: string): boolean {
  return /^asset_[A-Za-z0-9_-]+$/.test(value)
}

function isDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]'
}

function extractLocalAssetIdFromUrl(value: string): string | null {
  let pathname = ''
  if (value.startsWith('/')) {
    pathname = value
  } else {
    try {
      const url = new URL(value)
      if (!isLocalHost(url.hostname)) return null
      pathname = url.pathname
    } catch {
      return null
    }
  }

  const match = pathname.match(/^\/api\/assets\/([^/]+)\/(?:file|download)$/)
  if (!match) return null
  return decodeURIComponent(match[1])
}

function parseDataUrlImage(value: string): { buffer: Buffer; ext: string } {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) throw new Error('OpenAI Codex CLI 参考图 data URL 格式不正确')
  const mimeType = match[1] || 'image/png'
  const encoded = match[3] || ''
  const buffer = match[2]
    ? Buffer.from(encoded, 'base64')
    : Buffer.from(decodeURIComponent(encoded), 'utf8')
  return { buffer, ext: imageExtFromMime(mimeType) }
}

async function createTempImageFile(
  buffer: Buffer,
  ext: string,
  tempPaths: string[],
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'codex-flow-ref-'))
  const filePath = join(dir, `reference-${randomBytes(4).toString('hex')}${ext}`)
  await writeFile(filePath, buffer)
  tempPaths.push(filePath)
  return filePath
}

async function resolveInputImagePath(
  input: string,
  deps: Pick<CodexImageDeps, 'fetchImpl'>,
  tempPaths: string[],
): Promise<string | null> {
  const value = input.trim()
  if (!value) return null
  const localAssetId = extractLocalAssetIdFromUrl(value)
  if (localAssetId) {
    const asset = await getAsset(localAssetId)
    if (!asset) throw new Error(`找不到参考图 Asset：${localAssetId}`)
    return getAssetFilePath(asset)
  }
  if (isAssetId(value)) {
    const asset = await getAsset(value)
    if (!asset) throw new Error(`找不到参考图 Asset：${value}`)
    return getAssetFilePath(asset)
  }
  if (isDataUrl(value)) {
    const parsed = parseDataUrlImage(value)
    return createTempImageFile(parsed.buffer, parsed.ext, tempPaths)
  }
  if (isRemoteUrl(value)) {
    const fetchImpl = deps.fetchImpl ?? fetch
    const res = await fetchImpl(value)
    if (!res.ok) {
      throw new Error(`下载 OpenAI Codex CLI 参考图失败：HTTP ${res.status} ${res.statusText}`)
    }
    const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
    return createTempImageFile(
      Buffer.from(await res.arrayBuffer()),
      imageExtFromMime(mimeType),
      tempPaths,
    )
  }
  if (value.startsWith('file://')) {
    return fileURLToPath(value)
  }
  return resolveRuntimePath(value)
}

async function resolveInputImagePaths(
  inputImages: string[] | undefined,
  deps: Pick<CodexImageDeps, 'fetchImpl'>,
  tempPaths: string[],
): Promise<string[]> {
  const paths: string[] = []
  for (const input of inputImages ?? []) {
    const path = await resolveInputImagePath(input, deps, tempPaths)
    if (path) paths.push(path)
  }
  return paths
}

async function defaultListImageFiles(dir: string): Promise<CodexImageFile[]> {
  const files: CodexImageFile[] = []

  async function walk(current: string): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      const ext = extname(entry.name).toLowerCase()
      if (!IMAGE_EXTENSIONS.has(ext)) continue
      const info = await stat(full)
      if (info.size > 0) {
        files.push({ path: full, mtimeMs: info.mtimeMs, size: info.size })
      }
    }
  }

  await walk(dir)
  return files
}

function getNewImageFiles(
  files: CodexImageFile[],
  sinceMs: number,
  count: number,
): CodexImageFile[] {
  return files
    .filter((file) => file.size > 0 && file.mtimeMs >= sinceMs)
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .slice(0, Math.max(1, count))
}

function extractImagePathsFromText(text: string): string[] {
  const pattern = /([A-Za-z]:\\[^\r\n"'<>]+\.(?:png|jpe?g|webp|gif|bmp)|\/[^\r\n"'<>]+\.(?:png|jpe?g|webp|gif|bmp))/gi
  const matches = text.match(pattern) ?? []
  return Array.from(new Set(matches.map((path) => path.trim())))
}

function extractImageResultsFromJsonValue(value: unknown): GenerationResult[] {
  const results: GenerationResult[] = []
  const pushCandidate = (candidate: unknown) => {
    const text = typeof candidate === 'string' ? candidate.trim() : ''
    if (!text) return
    if (isRemoteUrl(text)) {
      results.push({ remoteUrl: text })
      return
    }
    results.push({ localPath: text })
  }

  const visit = (item: unknown) => {
    if (!item) return
    if (typeof item === 'string') {
      pushCandidate(item)
      return
    }
    if (Array.isArray(item)) {
      item.forEach(visit)
      return
    }
    if (typeof item !== 'object') return
    const record = item as Record<string, unknown>
    pushCandidate(record.path)
    pushCandidate(record.file)
    pushCandidate(record.output)
    pushCandidate(record.out)
    pushCandidate(record.url)
    visit(record.images)
  }

  visit(value)
  return results
}

function extractImageResultsFromText(text: string): GenerationResult[] {
  const results: GenerationResult[] = []
  const seen = new Set<string>()
  const pushResult = (result: GenerationResult) => {
    const key = result.remoteUrl ?? result.localPath ?? ''
    if (!key || seen.has(key)) return
    seen.add(key)
    results.push(result)
  }

  const parseJson = (value: string) => {
    try {
      extractImageResultsFromJsonValue(JSON.parse(value)).forEach(pushResult)
    } catch {
      // CLI output often mixes progress lines with JSON events.
    }
  }

  parseJson(text)
  for (const line of text.split(/\r?\n/)) parseJson(line.trim())

  const urlPattern = /https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif|bmp)(?:\?[^\s"'<>]*)?/gi
  for (const match of text.match(urlPattern) ?? []) {
    pushResult({ remoteUrl: match.trim() })
  }

  for (const path of extractImagePathsFromText(
    text.replace(urlPattern, ''),
  )) {
    pushResult({ localPath: path })
  }

  return results
}

function buildCodexImagePrompt(
  req: GenerationRequest,
  outputDir: string,
): string {
  const refs = req.inputImages?.length
    ? `参考图数量：${req.inputImages.length} 张。\n`
    : ''
  return [
    '$imagegen',
    '',
    `任务：${req.prompt}`,
    '',
    refs,
    `尺寸：${req.width}x${req.height}。`,
    `生成张数：${Math.max(1, req.count ?? 1)}。`,
    `请把最终图片保存到这个本地目录：${outputDir}`,
    '只输出最终图片文件路径和一句简短说明；不要修改项目代码，不要创建额外文档。',
  ].filter(Boolean).join('\n')
}

async function cleanupTempPaths(paths: string[]): Promise<void> {
  const dirs = new Set(paths.map((path) => resolve(path, '..')))
  await Promise.all(Array.from(dirs).map((dir) => rm(dir, {
    recursive: true,
    force: true,
  })))
}

async function getOutputDir(deps: CodexImageDeps): Promise<string> {
  if (deps.outputDir) return deps.outputDir
  const settings = deps.settings ?? await getSettings()
  return resolveOutputDir(settings.outputDir)
}

function buildCodexTextPrompt(messages: CodexTextMessage[], expectJson = false): string {
  const parts: string[] = []
  for (const message of messages) {
    const content = message.content?.trim()
    if (!content) continue
    if (message.role === 'system') {
      parts.push(`系统要求：\n${content}`)
    } else if (message.role === 'assistant') {
      parts.push(`助手：\n${content}`)
    } else {
      parts.push(`用户：\n${content}`)
    }
  }
  parts.push(
    expectJson
      ? '请直接回答用户，严格遵守系统要求中的输出格式，不要修改项目文件。'
      : '请直接回答用户，输出纯文本，不要修改项目文件。',
  )
  return parts.join('\n\n')
}

export async function generateCodexCliText(
  req: CodexTextRequest,
  deps: CodexImageDeps = {},
): Promise<CodexTextResult> {
  const codexPath = getCodexPath(deps)
  const cwd = deps.cwd ?? getProjectRoot()
  const outputDir = await getOutputDir(deps)
  const runCommand = deps.runCommand ?? defaultRunCommand
  const timeoutMs = getCodexTimeoutMs(deps)

  await mkdir(outputDir, { recursive: true })

  const lastMessagePath = join(
    outputDir,
    `codex-chat-${Date.now()}-${randomBytes(4).toString('hex')}.txt`,
  )
  const args = [
    'exec',
    '--cd',
    cwd,
    '--sandbox',
    'read-only',
    '--ephemeral',
    '--skip-git-repo-check',
    '--output-last-message',
    lastMessagePath,
  ]
  const execModel = getCodexTextExecModel(req.model)
  if (execModel) args.push('--model', execModel)
  args.push('-')

  let result: CodexCommandResult
  try {
    result = await runCommand(codexPath, args, {
      cwd,
      input: buildCodexTextPrompt(req.messages, req.expectJson === true),
      timeoutMs,
    })
  } catch (err) {
    throw wrapCodexCommandError('OpenAI Codex CLI', err)
  }
  let content = ''
  try {
    content = (await readFile(lastMessagePath, 'utf8')).trim()
  } catch {
    content = ''
  }
  content ||= result.stdout.trim()
  if (!content) {
    const summary = summarizeOutput(result.stdout, result.stderr)
    content = summary || 'Codex CLI 返回了空回复。'
  }
  return { content }
}

export async function generateCodexCliImage(
  req: GenerationRequest,
  deps: CodexImageDeps = {},
): Promise<GenerationResult[]> {
  const codexPath = getCodexPath(deps)
  const cwd = deps.cwd ?? getProjectRoot()
  const outputDir = await getOutputDir(deps)
  const runCommand = deps.runCommand ?? defaultRunCommand
  const listImageFiles = deps.listImageFiles ?? defaultListImageFiles
  const timeoutMs = getCodexTimeoutMs(deps)
  const sinceMs = deps.now?.() ?? Date.now()
  const tempPaths: string[] = []

  await mkdir(outputDir, { recursive: true })

  try {
    const referencePaths = await resolveInputImagePaths(
      req.inputImages,
      deps,
      tempPaths,
    )
    const lastMessagePath = join(
      outputDir,
      `codex-last-${Date.now()}-${randomBytes(4).toString('hex')}.txt`,
    )
    const args = [
      'exec',
      '--cd',
      cwd,
      '--sandbox',
      'danger-full-access',
      '--ephemeral',
      '--skip-git-repo-check',
      '--output-last-message',
      lastMessagePath,
    ]
    const execModel = getCodexExecModel(req.model)
    if (execModel) args.push('--model', execModel)
    for (const path of referencePaths) {
      args.push('--image', path)
    }
    args.push('-')

    let result: CodexCommandResult
    try {
      result = await runCommand(codexPath, args, {
        cwd,
        input: buildCodexImagePrompt(req, outputDir),
        timeoutMs,
      })
    } catch (err) {
      throw wrapCodexCommandError('OpenAI Codex CLI', err)
    }

    let newFiles = getNewImageFiles(
      await listImageFiles(outputDir),
      sinceMs,
      req.count,
    )
    if (newFiles.length === 0) {
      let lastMessage = ''
      try {
        lastMessage = await readFile(lastMessagePath, 'utf8')
      } catch {
        lastMessage = ''
      }
      const text = [
        result.stdout,
        result.stderr,
        lastMessage,
      ].filter(Boolean).join('\n')
      const reportedResults = extractImageResultsFromText(text)
      if (reportedResults.length > 0) {
        return reportedResults.slice(0, Math.max(1, req.count ?? 1))
      }
    }

    if (newFiles.length === 0) {
      throw new Error(
        `OpenAI Codex CLI 已返回，但没有在输出目录发现图片：${summarizeOutput(result.stdout, result.stderr)}`,
      )
    }

    return newFiles.map((file) => ({ localPath: file.path }))
  } finally {
    await cleanupTempPaths(tempPaths)
  }
}
