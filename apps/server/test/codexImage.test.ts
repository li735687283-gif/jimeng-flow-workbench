import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  generateCodexCliImage,
  generateCodexCliText,
  getCodexImageProviderStatus,
  isCodexImageModel,
} from '../src/services/codexImage'
import { getAssetFilePath, saveUploadFile } from '../src/services/assets'

test('isCodexImageModel only claims explicit Codex image models', () => {
  assert.equal(isCodexImageModel('$imagegen'), true)
  assert.equal(isCodexImageModel('gpt-image-2'), true)
  assert.equal(isCodexImageModel('codex:gpt-image-2'), true)

  assert.equal(isCodexImageModel('gpt-image-2-official'), false)
  assert.equal(isCodexImageModel('gemini-3-pro-image-preview'), false)
  assert.equal(isCodexImageModel('jimeng-5.0'), false)
})

test('getCodexImageProviderStatus reports available when CLI and auth file exist', async () => {
  const status = await getCodexImageProviderStatus({
    env: {
      CODEX_BIN: 'C:\\tools\\codex.cmd',
      CODEX_AUTH_FILE: 'C:\\Users\\Lzw\\.codex\\auth.json',
      GPT_IMAGE_2_SKILL_BIN: 'C:\\tools\\gpt-image-2-skill.cmd',
    },
    commandExists: async (command) =>
      command === 'C:\\tools\\codex.cmd' ||
      command === 'C:\\tools\\gpt-image-2-skill.cmd',
    fileExists: async (path) => path.endsWith('.codex\\auth.json'),
    runCommand: async () => ({ stdout: 'codex 1.0.0', stderr: '' }),
  })

  assert.equal(status.available, true)
  assert.equal(status.cliFound, true)
  assert.equal(status.authFound, true)
  assert.equal(status.codexPath, 'C:\\tools\\codex.cmd')
  assert.equal(status.helperFound, true)
  assert.equal(status.helperPath, 'C:\\tools\\gpt-image-2-skill.cmd')
  assert.match(status.setupCommands.installCodex, /chatgpt\.com\/codex\/install/)
  assert.equal(status.setupCommands.installImageHelper, 'npm install -g gpt-image-2-skill')
  assert.equal(status.setupCommands.login, 'codex')
})

test('getCodexImageProviderStatus does not block on a missing auth file', async () => {
  const status = await getCodexImageProviderStatus({
    env: {
      CODEX_BIN: 'C:\\tools\\codex.cmd',
      GPT_IMAGE_2_SKILL_BIN: 'C:\\tools\\gpt-image-2-skill.cmd',
    },
    commandExists: async (command) =>
      command === 'C:\\tools\\codex.cmd' ||
      command === 'C:\\tools\\gpt-image-2-skill.cmd',
    fileExists: async () => false,
    runCommand: async () => ({ stdout: 'codex 1.0.0', stderr: '' }),
  })

  assert.equal(status.available, true)
  assert.equal(status.cliFound, true)
  assert.equal(status.authFound, false)
  assert.equal(status.helperFound, true)
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
  const expectedHelper = process.platform === 'win32'
    ? 'gpt-image-2-skill.cmd'
    : 'gpt-image-2-skill'
  assert.equal(status.codexPath, expectedCodex)
  assert.equal(status.helperPath, expectedHelper)
  assert.deepEqual(seen.slice(0, 2), [expectedCodex, expectedHelper])
})

test('getCodexImageProviderStatus can use npx when the image helper is not installed globally', async () => {
  const seen: string[] = []
  const status = await getCodexImageProviderStatus({
    env: {},
    commandExists: async (command) => {
      seen.push(command)
      return command === (process.platform === 'win32' ? 'codex.cmd' : 'codex') ||
        command === (process.platform === 'win32' ? 'npx.cmd' : 'npx')
    },
    fileExists: async () => false,
  })

  const expectedHelper = process.platform === 'win32'
    ? 'npx.cmd -y gpt-image-2-skill'
    : 'npx -y gpt-image-2-skill'
  assert.equal(status.helperFound, true)
  assert.equal(status.helperPath, expectedHelper)
  assert.ok(seen.includes(process.platform === 'win32' ? 'gpt-image-2-skill.cmd' : 'gpt-image-2-skill'))
  assert.ok(seen.includes(process.platform === 'win32' ? 'npx.cmd' : 'npx'))
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

  assert.equal(
    calls[0].command,
    process.platform === 'win32' ? 'codex.cmd' : 'codex',
  )
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

test('generateCodexCliImage prefers gpt-image-2-skill when the helper is available', async () => {
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
        GPT_IMAGE_2_SKILL_BIN: 'C:\\tools\\gpt-image-2-skill.cmd',
        CODEX_AUTH_FILE: 'C:\\Users\\Lzw\\.codex\\auth.json',
      },
      now: () => 1_000,
      commandExists: async (command) =>
        command === 'C:\\tools\\gpt-image-2-skill.cmd',
      fileExists: async (path) => path.endsWith('.codex\\auth.json'),
      runCommand: async (command, args, options) => {
        calls.push({
          command,
          args,
          input: options.input,
          cwd: options.cwd,
        })
        return { stdout: '{"path":"F:\\\\repo\\\\workspace\\\\outputs\\\\helper.png"}', stderr: '' }
      },
      listImageFiles: async () => [
        {
          path: 'F:\\repo\\workspace\\outputs\\helper.png',
          mtimeMs: 1_200,
          size: 10,
        },
      ],
    },
  )

  assert.deepEqual(results, [
    { localPath: 'F:\\repo\\workspace\\outputs\\helper.png' },
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, 'C:\\tools\\gpt-image-2-skill.cmd')
  assert.equal(calls[0].input, undefined)
  assert.deepEqual(calls[0].args.slice(0, 7), [
    '--json',
    '--json-events',
    '--provider',
    'codex',
    '--auth-file',
    'C:\\Users\\Lzw\\.codex\\auth.json',
    'images',
  ])
  assert.ok(calls[0].args.includes('generate'))
  assert.ok(calls[0].args.includes('--prompt'))
  assert.ok(calls[0].args.some((arg) => arg.includes('crystal robot portrait')))
  assert.ok(calls[0].args.includes('--size'))
  assert.ok(calls[0].args.includes('1024x1024'))
  assert.ok(calls[0].args.includes('--quality'))
  assert.ok(calls[0].args.includes('high'))
})

test('generateCodexCliImage falls back to npx gpt-image-2-skill when the helper binary is absent', async () => {
  const calls: {
    command: string
    args: string[]
    input?: string
    cwd?: string
  }[] = []

  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const helperCommand = process.platform === 'win32'
    ? 'gpt-image-2-skill.cmd'
    : 'gpt-image-2-skill'
  const results = await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'quiet monochrome gallery',
      model: 'gpt-image-2',
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
      commandExists: async (command) => command === npxCommand,
      fileExists: async (path) => path.endsWith('.codex\\auth.json'),
      runCommand: async (command, args, options) => {
        calls.push({
          command,
          args,
          input: options.input,
          cwd: options.cwd,
        })
        return { stdout: '{"path":"F:\\\\repo\\\\workspace\\\\outputs\\\\npx-helper.png"}', stderr: '' }
      },
      listImageFiles: async () => [
        {
          path: 'F:\\repo\\workspace\\outputs\\npx-helper.png',
          mtimeMs: 1_200,
          size: 10,
        },
      ],
    },
  )

  assert.deepEqual(results, [
    { localPath: 'F:\\repo\\workspace\\outputs\\npx-helper.png' },
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, npxCommand)
  assert.deepEqual(calls[0].args.slice(0, 2), ['-y', 'gpt-image-2-skill'])
  assert.ok(calls[0].args.includes('--provider'))
  assert.ok(calls[0].args.includes('codex'))
  assert.ok(calls[0].args.includes('--auth-file'))
  assert.ok(calls[0].args.includes('C:\\Users\\Lzw\\.codex\\auth.json'))
  assert.ok(calls[0].args.includes('images'))
  assert.ok(calls[0].args.includes('generate'))
  assert.ok(calls[0].args.some((arg) => arg.includes('quiet monochrome gallery')))
  assert.notEqual(calls[0].command, helperCommand)
})

test('generateCodexCliImage accepts gpt-image-2-skill json image urls', async () => {
  const results = await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'glass city poster',
      model: 'gpt-image-2',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      cwd: 'F:\\repo',
      outputDir: 'F:\\repo\\workspace\\outputs',
      env: {
        GPT_IMAGE_2_SKILL_BIN: 'C:\\tools\\gpt-image-2-skill.cmd',
      },
      now: () => 1_000,
      commandExists: async (command) =>
        command === 'C:\\tools\\gpt-image-2-skill.cmd',
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

test('generateCodexCliImage sends reference images to gpt-image-2-skill edit mode', async () => {
  const calls: { command: string; args: string[] }[] = []
  const referencePath = 'F:\\repo\\workspace\\outputs\\reference.png'

  const results = await generateCodexCliImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'turn the reference into a rainy night scene',
      inputImages: [referencePath],
      model: 'gpt-image-2',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      cwd: 'F:\\repo',
      outputDir: 'F:\\repo\\workspace\\outputs',
      env: {
        GPT_IMAGE_2_SKILL_BIN: 'C:\\tools\\gpt-image-2-skill.cmd',
        CODEX_AUTH_FILE: 'C:\\Users\\Lzw\\.codex\\auth.json',
      },
      now: () => 1_000,
      commandExists: async (command) =>
        command === 'C:\\tools\\gpt-image-2-skill.cmd',
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
  assert.equal(calls[0].command, 'C:\\tools\\gpt-image-2-skill.cmd')
  assert.ok(calls[0].args.includes('edit'))
  assert.ok(calls[0].args.includes('--ref-image'))
  assert.ok(calls[0].args.includes(referencePath))
  assert.equal(calls[0].args.includes('generate'), false)
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
        model: 'gpt-image-2',
        width: 1024,
        height: 1024,
        count: 1,
      },
      {
        cwd: 'F:\\repo',
        outputDir: 'F:\\repo\\workspace\\outputs',
        env: {
          GPT_IMAGE_2_SKILL_BIN: 'C:\\tools\\gpt-image-2-skill.cmd',
        },
        now: () => 1_000,
        commandExists: async (command) =>
          command === 'C:\\tools\\gpt-image-2-skill.cmd',
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
    assert.ok(calls[0].args.includes('edit'))
    assert.ok(calls[0].args.includes('--ref-image'))
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

test('generateCodexCliImage explains missing Codex login for gpt-image-2 helper', async () => {
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
          GPT_IMAGE_2_SKILL_BIN: 'C:\\tools\\gpt-image-2-skill.cmd',
        },
        commandExists: async (command) =>
          command === 'C:\\tools\\gpt-image-2-skill.cmd',
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
