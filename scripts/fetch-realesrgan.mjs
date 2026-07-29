// 下载 Real-ESRGAN ncnn-vulkan Windows 发行版到 vendor/realesrgan/。
// 幂等：目标可执行文件已存在则跳过。二进制不进 git（见 .gitignore）。
// 用法：npm run fetch:realesrgan

import { createWriteStream } from 'node:fs'
import { access, cp, mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// 注意：二进制附件挂在 v0.2.5.0 这个 release 上（v0.3.0 没有附件）
const DOWNLOAD_URL =
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip'
const EXE_NAME = 'realesrgan-ncnn-vulkan.exe'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const vendorDir = resolve(repositoryRoot, 'vendor/realesrgan')
const vendorExe = join(vendorDir, EXE_NAME)

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function downloadToFile(url, targetPath) {
  try {
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(targetPath))
    return
  } catch (err) {
    // 直连失败（如 GitHub 被墙）时回退 curl：curl 支持 HTTPS_PROXY 等标准代理环境变量
    console.warn(`直接下载失败（${err instanceof Error ? err.message : String(err)}），改用 curl 重试…`)
    await rm(targetPath, { force: true }).catch(() => {})
  }
  await runCommand('curl', ['-fL', '--retry', '2', '-o', targetPath, url])
}

async function runCommand(command, args) {
  const exitCode = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true })
    child.once('error', rejectPromise)
    child.once('close', (code) => resolvePromise(code ?? 1))
  })
  if (exitCode !== 0) {
    throw new Error(`${command} 退出码 ${exitCode}`)
  }
}

async function extractZip(zipPath, targetDir) {
  // Windows 10+ 自带 bsdtar 可直接解 zip；失败时回退 PowerShell Expand-Archive
  try {
    await runCommand('tar', ['--force-local', '-xf', zipPath, '-C', targetDir])
    return
  } catch {
    // fall through to PowerShell
  }
  await runCommand('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replaceAll("'", "''")}' -DestinationPath '${targetDir.replaceAll("'", "''")}' -Force`,
  ])
}

/** 在解压目录里找到包含 exe 的那一层（zip 内通常还有一层版本目录） */
async function findExtractedRoot(dir, depth = 0) {
  if (depth > 3) return null
  const entries = await readdir(dir, { withFileTypes: true })
  if (entries.some((entry) => entry.isFile() && entry.name === EXE_NAME)) return dir
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = await findExtractedRoot(join(dir, entry.name), depth + 1)
    if (found) return found
  }
  return null
}

async function moveEntry(source, target) {
  await rm(target, { recursive: true, force: true })
  try {
    await rename(source, target)
  } catch (err) {
    // 临时目录与 vendor 不在同一盘时 rename 会 EXDEV，退回复制
    if (err?.code !== 'EXDEV') throw err
    await cp(source, target, { recursive: true })
    await rm(source, { recursive: true, force: true })
  }
}

if (await pathExists(vendorExe)) {
  console.log(`Real-ESRGAN 已就绪：${vendorExe}，跳过下载`)
  process.exit(0)
}

const stagingDir = await mkdtemp(join(tmpdir(), 'mok-realesrgan-fetch-'))
try {
  const zipPath = join(stagingDir, 'realesrgan.zip')
  console.log(`下载 Real-ESRGAN：${DOWNLOAD_URL}`)
  await downloadToFile(DOWNLOAD_URL, zipPath)

  const extractDir = join(stagingDir, 'extract')
  await mkdir(extractDir, { recursive: true })
  console.log('解压中…')
  await extractZip(zipPath, extractDir)

  const extractedRoot = await findExtractedRoot(extractDir)
  if (!extractedRoot) {
    throw new Error('解压结果中找不到 realesrgan-ncnn-vulkan.exe，发行包结构可能已变化')
  }
  if (!(await pathExists(join(extractedRoot, 'models')))) {
    throw new Error('解压结果中找不到 models 目录，发行包结构可能已变化')
  }

  await mkdir(vendorDir, { recursive: true })
  await moveEntry(join(extractedRoot, EXE_NAME), join(vendorDir, EXE_NAME))
  await moveEntry(join(extractedRoot, 'models'), join(vendorDir, 'models'))

  if (!(await pathExists(vendorExe))) {
    throw new Error(`安装失败：${vendorExe} 不存在`)
  }
  console.log(`Real-ESRGAN 已安装到 ${vendorDir}`)
} catch (err) {
  await rm(vendorDir, { recursive: true, force: true }).catch(() => {})
  console.error(
    `获取 Real-ESRGAN 失败：${err instanceof Error ? err.message : String(err)}`,
  )
  console.error(`可手动下载 ${DOWNLOAD_URL} 并解压到 vendor/realesrgan/（需含 ${EXE_NAME} 与 models/）`)
  process.exit(1)
} finally {
  await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
}
