import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import {
  enqueueCodexCli,
  generateCodexCliImage,
  generateCodexCliText,
  getCodexImageProviderStatus,
  isCodexImageModel,
  startCodexLogin,
} from '../src/services/codexImage'
import { getAssetFilePath, saveUploadFile } from '../src/services/assets'

test('isCodexImageModel only claims explicit Codex image models', () => {
  assert.equal(isCodexImageModel('$imagegen'), true)
  assert.equal(isCodexImageModel('gpt-image-2'), true)
  assert.equal(isCodexImageModel('codex:gpt-image-2'), true)
  assert.equal(isCodexImageModel('codex:gpt-5.5'), true)

  assert.equal(isCodexImageModel('gpt-image-2-official'), false)
  assert.equal(isCodexImageModel('gemini-3-pro-image-preview'), false)
  assert.equal(isCodexImageModel('jimeng-5.0'), false)
})

test('getCodexImageProviderStatus reports available when CLI and auth file exist', async () => {
  const status = await getCodexImageProviderStatus({
    env: {
      CODEX_BIN: 'C:\\tools\\codex.cmd',
      CODEX_CLI_PATH: 'C:\\legacy\\codex.exe',
      CODEX_AUTH_FILE: 'C:\\Users\\Lzw\\.codex\\auth.json',
    },
    commandExists: async (command) =>
      command === 'C:\\tools\\codex.cmd',
    fileExists: async (path) => path.endsWith('.codex\\auth.json'),
    runCommand: async () => ({ stdout: 'codex 1.0.0', stderr: '' }),
  })

  assert.equal(status.available, true)
  assert.equal(status.cliFound, true)
  assert.equal(status.authFound, true)
  assert.equal(status.codexPath, 'C:\\tools\\codex.cmd')
  assert.equal(status.helperFound, false)
  assert.equal(status.helperPath, undefined)
  assert.match(status.setupCommands.installCodex, /chatgpt\.com\/codex\/install/)
  assert.equal(status.setupCommands.installImageHelper, undefined)
  assert.equal(status.setupCommands.login, 'codex')
})

test('getCodexImageProviderStatus accepts Windows exe and cmd commands', async () => {
  for (const codexPath of ['C:\\tools\\codex.exe', 'C:\\tools\\codex.cmd']) {
    const status = await getCodexImageProviderStatus({
      env: { CODEX_BIN: codexPath },
      commandExists: async (command) => command === codexPath,
      fileExists: async () => false,
    })

    assert.equal(status.available, true)
    assert.equal(status.codexPath, codexPath)
  }
})

test('getCodexImageProviderStatus does not block on a missing auth file', async () => {
  const status = await getCodexImageProviderStatus({
    env: {
      CODEX_BIN: 'C:\\tools\\codex.cmd',
    },
    commandExists: async (command) =>
      command === 'C:\\tools\\codex.cmd',
    fileExists: async () => false,
    runCommand: async () => ({ stdout: 'codex 1.0.0', stderr: '' }),
  })

  assert.equal(status.available, true)
  assert.equal(status.cliFound, true)
  assert.equal(status.authFound, false)
  assert.equal(status.helperFound, false)
  assert.match(status.message, /首次执行/)
})

test('getCodexImageProviderStatus uses platform-safe default command names', async () => {
  const seen: string[] = []
  const status = await getCodexImageProviderStatus({
    env: {},
    commandExists: async (command) => {
      seen.push(command)
      return true
    },
    fileExists: async () => false,
  })

  const expectedCodex = process.platform === 'win32' ? 'codex.cmd' : 'codex'
  assert.equal(status.codexPath, expectedCodex)
  assert.equal(status.helperPath, undefined)
  assert.deepEqual(seen.slice(0, 1), [expectedCodex])
})

test('getCodexImageProviderStatus does not require the legacy image helper', async () => {
  const seen: string[] = []
  const status = await getCodexImageProviderStatus({
    env: {},
    commandExists: async (command) => {
      seen.push(command)
      return command === (process.platform === 'win32' ? 'codex.cmd' : 'codex')
    },
    fileExists: async () => false,
  })

  assert.equal(status.available, true)
  assert.equal(status.helperFound, false)
  assert.equal(status.helperPath, undefined)
  assert.deepEqual(seen, [process.platform === 'win32' ? 'codex.cmd' : 'codex'])
})

test('generateCodexCliImage runs codex exec and returns newly created image files', async () => {
  const calls: {
    command: string
    args: string[]
    input?: string
    cwd?: string
  }[] = []

  const results = await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'cinematic city skyline',
      model: '$imagegen',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      codexPath: 'codex',
      cwd: 'F:\\repo',
      outputDir: 'F:\\repo\\workspace\\outputs',
      now: () => 1_000,
      commandExists: async () => false,
      runCommand: async (command, args, options) => {
        calls.push({
          command,
          args,
          input: options.input,
          cwd: options.cwd,
        })
        return { stdout: 'saved image', stderr: '' }
      },
      listImageFiles: async () => [
        {
          path: 'F:\\repo\\workspace\\outputs\\codex-image.png',
          mtimeMs: 1_200,
          size: 10,
        },
      ],
    },
  )

  assert.deepEqual(results, [
    { localPath: 'F:\\repo\\workspace\\outputs\\codex-image.png' },
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, 'codex')
  assert.deepEqual(calls[0].args.slice(0, 2), ['exec', '--cd'])
  assert.equal(calls[0].cwd, 'F:\\repo')
  assert.match(calls[0].input ?? '', /\$imagegen/)
  assert.match(calls[0].input ?? '', /cinematic city skyline/)
})

test('generateCodexCliText runs codex exec and returns the last message', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-text-'))
  const calls: Array<{ command: string; args: string[]; input?: string }> = []

  const result = await generateCodexCliText(
    {
      model: 'codex:gpt-5',
      messages: [
        { role: 'system', content: '你是画布助手' },
        { role: 'user', content: '总结这张图的风格' },
      ],
    },
    {
      codexPath: 'codex',
      cwd: dir,
      outputDir: dir,
      runCommand: async (command, args, options) => {
        calls.push({ command, args, input: options.input })
        const lastIndex = args.indexOf('--output-last-message')
        if (lastIndex >= 0) {
          await writeFile(args[lastIndex + 1], 'Codex 文本回复')
        }
        return { stdout: 'ignored stdout', stderr: '' }
      },
      commandExists: async () => true,
      fileExists: async () => true,
    },
  )

  assert.equal(result.content, 'Codex 文本回复')
  assert.equal(calls[0].command, 'codex')
  assert.deepEqual(calls[0].args.slice(0, 6), [
    'exec',
    '--cd',
    dir,
    '--sandbox',
    'read-only',
    '--ephemeral',
  ])
  assert.deepEqual(calls[0].args.slice(6, 8), [
    '--skip-git-repo-check',
    '--output-last-message',
  ])
  assert.equal(calls[0].args.includes('--model'), true)
  assert.equal(calls[0].args[calls[0].args.indexOf('--model') + 1], 'gpt-5')
  assert.match(calls[0].input ?? '', /系统要求/)
  assert.match(calls[0].input ?? '', /总结这张图的风格/)
})

test('generateCodexCliText uses a platform-safe default Codex command', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-text-default-bin-'))
  const calls: Array<{ command: string; args: string[] }> = []

  try {
    await generateCodexCliText(
      {
        model: 'codex:gpt-5',
        messages: [{ role: 'user', content: 'ping' }],
      },
      {
        cwd: dir,
        outputDir: dir,
        runCommand: async (command, args) => {
          calls.push({ command, args })
          const lastIndex = args.indexOf('--output-last-message')
          if (lastIndex >= 0) {
            await writeFile(args[lastIndex + 1], 'pong')
          }
          return { stdout: '', stderr: '' }
        },
      },
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  if (process.platform === 'win32') {
    assert.match(basename(calls[0].command), /^codex\.(?:exe|cmd)$/i)
  } else {
    assert.equal(calls[0].command, 'codex')
  }
})

test('generateCodexCliText explains when the Codex executable is missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-text-missing-bin-'))

  try {
    await assert.rejects(
      () => generateCodexCliText(
        {
          model: 'codex:gpt-5',
          messages: [{ role: 'user', content: 'ping' }],
        },
        {
          env: {},
          cwd: dir,
          outputDir: dir,
          runCommand: async () => {
            throw new Error('spawn codex ENOENT')
          },
        },
      ),
      /未找到 OpenAI Codex CLI 可执行命令[\s\S]*CODEX_BIN/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('generateCodexCliText can execute a Windows .cmd Codex binary', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows .cmd spawn behavior only applies on Windows')
    return
  }
  const dir = await mkdtemp(join(tmpdir(), 'codex-text-cmd-bin-'))
  const codexCmd = join(dir, 'fake-codex.cmd')
  await writeFile(codexCmd, [
    '@echo off',
    'set "out="',
    ':loop',
    'if "%~1"=="" goto done',
    'if "%~1"=="--output-last-message" set "out=%~2"',
    'shift',
    'goto loop',
    ':done',
    'if not "%out%"=="" echo fake-codex-ok>"%out%"',
    'exit /b 0',
  ].join('\r\n'))

  try {
    const result = await generateCodexCliText(
      {
        model: 'codex:gpt-5',
        messages: [{ role: 'user', content: 'ping' }],
      },
      {
        codexPath: codexCmd,
        cwd: dir,
        outputDir: dir,
        timeoutMs: 30_000,
      },
    )

    assert.equal(result.content, 'fake-codex-ok')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('generateCodexCliText resolves Windows .cmd commands from PATH before launching them', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows .cmd PATH behavior only applies on Windows')
    return
  }
  const dir = await mkdtemp(join(tmpdir(), 'codex-text-path-cmd-bin-'))
  const runDir = await mkdtemp(join(tmpdir(), 'codex-text-path-cmd-run-'))
  const codexCmd = join(dir, 'path-codex.cmd')
  const oldPath = process.env.Path
  const oldPATH = process.env.PATH
  await writeFile(join(dir, 'marker.txt'), 'marker')
  await writeFile(codexCmd, [
    '@echo off',
    'if not exist "%~dp0marker.txt" exit /b 7',
    'set "out="',
    ':loop',
    'if "%~1"=="" goto done',
    'if "%~1"=="--output-last-message" set "out=%~2"',
    'shift',
    'goto loop',
    ':done',
    'if not "%out%"=="" echo path-codex-ok>"%out%"',
    'exit /b 0',
  ].join('\r\n'))

  try {
    process.env.Path = `${dir};${oldPath ?? ''}`
    process.env.PATH = `${dir};${oldPATH ?? ''}`
    const result = await generateCodexCliText(
      {
        model: 'codex:gpt-5',
        messages: [{ role: 'user', content: 'ping' }],
      },
      {
        codexPath: 'path-codex.cmd',
        cwd: runDir,
        outputDir: runDir,
        timeoutMs: 30_000,
      },
    )

    assert.equal(result.content, 'path-codex-ok')
  } finally {
    process.env.Path = oldPath
    process.env.PATH = oldPATH
    await rm(dir, { recursive: true, force: true })
    await rm(runDir, { recursive: true, force: true })
  }
})

test('generateCodexCliImage uses codex exec for legacy gpt-image-2 requests', async () => {
  const calls: {
    command: string
    args: string[]
    input?: string
    cwd?: string
  }[] = []

  const results = await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'crystal robot portrait',
      model: 'gpt-image-2',
      width: 1024,
      height: 1024,
      count: 1,
    },
    {
      cwd: 'F:\\repo',
      outputDir: 'F:\\repo\\workspace\\outputs',
      env: {
        CODEX_AUTH_FILE: 'C:\\Users\\Lzw\\.codex\\auth.json',
      },
      now: () => 1_000,
      commandExists: async () => false,
      fileExists: async (path) => path.endsWith('.codex\\auth.json'),
      runCommand: async (command, args, options) => {
        calls.push({
          command,
          args,
          input: options.input,
          cwd: options.cwd,
        })
        return { stdout: 'saved image', stderr: '' }
      },
      listImageFiles: async () => [
        {
          path: 'F:\\repo\\workspace\\outputs\\codex-image.png',
          mtimeMs: 1_200,
          size: 10,
        },
      ],
    },
  )

  assert.deepEqual(results, [
    { localPath: 'F:\\repo\\workspace\\outputs\\codex-image.png' },
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, process.platform === 'win32' ? 'codex.cmd' : 'codex')
  assert.deepEqual(calls[0].args.slice(0, 2), ['exec', '--cd'])
  assert.equal(calls[0].args.includes('--model'), false)
  assert.match(calls[0].input ?? '', /\$imagegen/)
  assert.match(calls[0].input ?? '', /crystal robot portrait/)
})

test('generateCodexCliImage passes the selected Codex model to codex exec', async () => {
  const calls: {
    command: string
    args: string[]
    input?: string
    cwd?: string
  }[] = []

  const results = await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'quiet monochrome gallery',
      model: 'codex:gpt-5.5',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      cwd: 'F:\\repo',
      outputDir: 'F:\\repo\\workspace\\outputs',
      env: {
        CODEX_AUTH_FILE: 'C:\\Users\\Lzw\\.codex\\auth.json',
      },
      now: () => 1_000,
      commandExists: async () => false,
      fileExists: async (path) => path.endsWith('.codex\\auth.json'),
      runCommand: async (command, args, options) => {
        calls.push({
          command,
          args,
          input: options.input,
          cwd: options.cwd,
        })
        return { stdout: 'saved image', stderr: '' }
      },
      listImageFiles: async () => [
        {
          path: 'F:\\repo\\workspace\\outputs\\codex-model.png',
          mtimeMs: 1_200,
          size: 10,
        },
      ],
    },
  )

  assert.deepEqual(results, [
    { localPath: 'F:\\repo\\workspace\\outputs\\codex-model.png' },
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, process.platform === 'win32' ? 'codex.cmd' : 'codex')
  assert.equal(calls[0].args.includes('--model'), true)
  assert.equal(calls[0].args[calls[0].args.indexOf('--model') + 1], 'gpt-5.5')
  assert.match(calls[0].input ?? '', /quiet monochrome gallery/)
})

test('generateCodexCliImage avoids Windows workspace sandbox setup during image generation', async () => {
  const calls: { args: string[] }[] = []

  await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'silent moon poster',
      model: 'codex:gpt-5.5',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      cwd: 'F:\\repo',
      outputDir: 'F:\\repo\\workspace\\outputs',
      now: () => 1_000,
      runCommand: async (_command, args) => {
        calls.push({ args })
        return { stdout: 'saved image', stderr: '' }
      },
      listImageFiles: async () => [
        {
          path: 'F:\\repo\\workspace\\outputs\\moon.png',
          mtimeMs: 1_200,
          size: 10,
        },
      ],
    },
  )

  const sandboxIndex = calls[0].args.indexOf('--sandbox')
  assert.notEqual(sandboxIndex, -1)
  assert.equal(calls[0].args[sandboxIndex + 1], 'danger-full-access')
  assert.equal(calls[0].args.includes('workspace-write'), false)
})

test('generateCodexCliImage accepts codex exec reported image urls', async () => {
  const results = await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'glass city poster',
      model: 'codex:gpt-5.5',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      cwd: 'F:\\repo',
      outputDir: 'F:\\repo\\workspace\\outputs',
      env: {},
      now: () => 1_000,
      commandExists: async () => false,
      fileExists: async () => false,
      runCommand: async () => ({
        stdout: '{"images":[{"url":"https://cdn.example.com/generated.png"}]}',
        stderr: '',
      }),
      listImageFiles: async () => [],
    },
  )

  assert.deepEqual(results, [
    { remoteUrl: 'https://cdn.example.com/generated.png' },
  ])
})

test('generateCodexCliImage sends reference images to codex exec', async () => {
  const calls: { command: string; args: string[] }[] = []
  const referencePath = 'F:\\repo\\workspace\\outputs\\reference.png'

  const results = await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'turn the reference into a rainy night scene',
      inputImages: [referencePath],
      model: 'codex:gpt-5.5',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      cwd: 'F:\\repo',
      outputDir: 'F:\\repo\\workspace\\outputs',
      env: {
        CODEX_AUTH_FILE: 'C:\\Users\\Lzw\\.codex\\auth.json',
      },
      now: () => 1_000,
      commandExists: async () => false,
      fileExists: async (path) => path.endsWith('.codex\\auth.json'),
      runCommand: async (command, args) => {
        calls.push({ command, args })
        return { stdout: 'done', stderr: '' }
      },
      listImageFiles: async () => [
        {
          path: 'F:\\repo\\workspace\\outputs\\edited.png',
          mtimeMs: 1_200,
          size: 10,
        },
      ],
    },
  )

  assert.deepEqual(results, [
    { localPath: 'F:\\repo\\workspace\\outputs\\edited.png' },
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, process.platform === 'win32' ? 'codex.cmd' : 'codex')
  assert.ok(calls[0].args.includes('--image'))
  assert.ok(calls[0].args.includes(referencePath))
})

test('generateCodexCliImage resolves local asset file urls before edit mode', async () => {
  const calls: { command: string; args: string[] }[] = []
  const asset = await saveUploadFile({
    fileBuffer: Buffer.from('fake-image'),
    originalName: 'reference.png',
    mimeType: 'image/png',
  })
  const assetPath = getAssetFilePath(asset)
  const metaPath = join(dirname(assetPath), `${asset.id}.json`)

  try {
    const results = await generateCodexCliImage(
      {
        flowId: 'local',
        nodeId: 'image-1',
        mediaType: 'image',
        prompt: 'edit the canvas reference',
        inputImages: [`/api/assets/${asset.id}/file`],
        model: 'codex:gpt-5.5',
        width: 1024,
        height: 1024,
        count: 1,
      },
      {
        cwd: 'F:\\repo',
        outputDir: 'F:\\repo\\workspace\\outputs',
        env: {
        },
        now: () => 1_000,
        commandExists: async () => false,
        fileExists: async () => false,
        runCommand: async (command, args) => {
          calls.push({ command, args })
          return { stdout: 'done', stderr: '' }
        },
        listImageFiles: async () => [
          {
            path: 'F:\\repo\\workspace\\outputs\\edited-from-url.png',
            mtimeMs: 1_200,
            size: 10,
          },
        ],
      },
    )

    assert.deepEqual(results, [
      { localPath: 'F:\\repo\\workspace\\outputs\\edited-from-url.png' },
    ])
    assert.equal(calls.length, 1)
    assert.ok(calls[0].args.includes('--image'))
    assert.ok(calls[0].args.includes(assetPath))
    assert.equal(calls[0].args.includes(`/api/assets/${asset.id}/file`), false)
  } finally {
    await rm(assetPath, { force: true })
    await rm(metaPath, { force: true })
  }
})

test('generateCodexCliImage fails clearly when no output image appears', async () => {
  await assert.rejects(
    () => generateCodexCliImage(
      {
        flowId: 'local',
        nodeId: 'image-1',
        mediaType: 'image',
        prompt: 'empty result',
        model: '$imagegen',
        width: 1024,
        height: 1024,
        count: 1,
      },
      {
        codexPath: 'codex',
        cwd: 'F:\\repo',
        outputDir: 'F:\\repo\\workspace\\outputs',
        now: () => 1_000,
        commandExists: async () => false,
        runCommand: async () => ({ stdout: 'done', stderr: '' }),
        listImageFiles: async () => [],
      },
    ),
    /OpenAI Codex CLI 已返回，但没有在输出目录发现图片/,
  )
})

test('generateCodexCliImage explains missing Codex login for legacy gpt-image-2 requests', async () => {
  await assert.rejects(
    () => generateCodexCliImage(
      {
        flowId: 'local',
        nodeId: 'image-1',
        mediaType: 'image',
        prompt: 'auth failure',
        model: 'gpt-image-2',
        width: 1024,
        height: 1024,
        count: 1,
      },
      {
        cwd: 'F:\\repo',
        outputDir: 'F:\\repo\\workspace\\outputs',
        env: {
        },
        commandExists: async () => false,
        fileExists: async () => false,
        runCommand: async () => {
          throw new Error('No auth file found. Please run codex to sign in.')
        },
        listImageFiles: async () => [],
      },
    ),
    /OpenAI CLI 未登录[\s\S]*打开登录/,
  )
})

test('generateCodexCliImage explains missing Codex login for codex exec fallback', async () => {
  await assert.rejects(
    () => generateCodexCliImage(
      {
        flowId: 'local',
        nodeId: 'image-1',
        mediaType: 'image',
        prompt: 'auth failure',
        model: '$imagegen',
        width: 1024,
        height: 1024,
        count: 1,
      },
      {
        codexPath: 'codex',
        cwd: 'F:\\repo',
        outputDir: 'F:\\repo\\workspace\\outputs',
        commandExists: async () => false,
        runCommand: async () => {
          throw new Error('401 Unauthorized: login required')
        },
        listImageFiles: async () => [],
      },
    ),
    /OpenAI CLI 未登录[\s\S]*打开登录/,
  )
})

test('generateCodexCliText explains refresh-token conflicts and trims log spam', async () => {
  // 真实故障:CLI 会把同一条 ERROR 重复刷几千字,不能把整段塞进错误气泡
  const spam = Array.from(
    { length: 50 },
    (_, i) =>
      `2026-07-20T11:46:45.${i}Z ERROR codex_login::auth::manager: Failed to refresh token: 401 Unauthorized: {"error":{"message":"Your refresh token has already been used to generate a new access token.","code":"refresh_token_reused"}}`,
  ).join(' ')

  let thrown: Error | null = null
  try {
    await generateCodexCliText(
      { model: 'codex:gpt-5.5', messages: [{ role: 'user', content: 'hi' }] },
      {
        cwd: 'F:\\repo',
        outputDir: 'F:\\repo\\workspace\\outputs',
        commandExists: async () => true,
        runCommand: async () => {
          throw new Error(spam)
        },
      },
    )
  } catch (err) {
    thrown = err as Error
  }

  assert.ok(thrown)
  assert.match(thrown.message, /刷新令牌冲突/)
  assert.match(thrown.message, /打开登录/)
  assert.match(thrown.message, /避免同时在终端等其他地方使用 codex/)
  // 截断:不能整段刷屏日志都进错误消息
  assert.ok(thrown.message.length < 800, `message too long: ${thrown.message.length}`)
})

test('enqueueCodexCli serializes concurrent tasks', async () => {
  const order: string[] = []
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  await Promise.all([
    enqueueCodexCli(async () => {
      order.push('a:start')
      await delay(30)
      order.push('a:end')
    }),
    enqueueCodexCli(async () => {
      order.push('b:start')
      await delay(5)
      order.push('b:end')
    }),
    enqueueCodexCli(async () => {
      order.push('c:start')
      order.push('c:end')
    }),
  ])

  // 串行:每个任务必须完整跑完才轮到下一个,不能交错
  assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
})

test('enqueueCodexCli keeps the queue alive after a task fails', async () => {
  await assert.rejects(() =>
    enqueueCodexCli(async () => {
      throw new Error('boom')
    }),
  )
  const value = await enqueueCodexCli(async () => 42)
  assert.equal(value, 42)
})

test('startCodexLogin logs out first, then spawns the browser login', async () => {
  const calls: string[] = []
  const result = await startCodexLogin({
    codexPath: 'codex',
    runCommand: async (_command, args) => {
      calls.push(`run:${args.join(' ')}`)
      return { stdout: '', stderr: '' }
    },
    spawnLogin: (codexPath) => {
      calls.push(`spawn:${codexPath} login`)
    },
  })

  assert.equal(result.ok, true)
  assert.match(result.message, /浏览器/)
  // 必须先 logout 清掉作废令牌,再拉起登录
  assert.deepEqual(calls, ['run:logout', 'spawn:codex login'])
})

test('startCodexLogin still spawns login when logout fails', async () => {
  const calls: string[] = []
  const result = await startCodexLogin({
    codexPath: 'codex',
    runCommand: async () => {
      throw new Error('not logged in')
    },
    spawnLogin: () => {
      calls.push('spawn')
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(calls, ['spawn'])
})

test('startCodexLogin reports spawn failures', async () => {
  const result = await startCodexLogin({
    codexPath: 'codex',
    runCommand: async () => ({ stdout: '', stderr: '' }),
    spawnLogin: () => {
      throw new Error('spawn ENOENT')
    },
  })

  assert.equal(result.ok, false)
  assert.match(result.message, /启动 Codex 登录失败/)
})
