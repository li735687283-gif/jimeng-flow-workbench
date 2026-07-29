// Real-ESRGAN 引擎测试：二进制路径解析优先级、命令参数构造、
// 目标长边缩放（jimp 真读写真小图）、缺二进制的可操作错误。
// exe 调用通过注入的 execFileImpl mock 掉，不依赖真实二进制。

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Jimp } from 'jimp'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-realesrgan-ws-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const {
  RealEsrganError,
  buildRealEsrganArgs,
  resolveRealEsrganBinary,
  upscaleWithRealEsrgan,
} = await import('../src/services/realesrgan')

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

const fakeBinary = join(tmpdir(), 'fake-realesrgan', 'realesrgan-ncnn-vulkan.exe')

test('resolveRealEsrganBinary 优先使用 MOK_REALESRGAN_PATH', async () => {
  const resolved = await resolveRealEsrganBinary({
    env: {
      MOK_REALESRGAN_PATH: fakeBinary,
      MOK_RESOURCES_DIR: '/resources',
    },
    fileExists: async () => true,
  })
  assert.equal(resolved, fakeBinary)
})

test('resolveRealEsrganBinary 其次使用 MOK_RESOURCES_DIR 下的打包目录', async () => {
  const resolved = await resolveRealEsrganBinary({
    env: { MOK_RESOURCES_DIR: '/resources' },
    fileExists: async (path) => path === join('/resources', 'realesrgan', 'realesrgan-ncnn-vulkan.exe'),
  })
  assert.equal(resolved, join('/resources', 'realesrgan', 'realesrgan-ncnn-vulkan.exe'))
})

test('resolveRealEsrganBinary 最后回退仓库 vendor 目录', async () => {
  const resolved = await resolveRealEsrganBinary({
    env: {},
    fileExists: async (path) => path.includes('vendor'),
  })
  assert.match(resolved, /vendor[\\/]realesrgan[\\/]realesrgan-ncnn-vulkan\.exe$/)
})

test('resolveRealEsrganBinary 找不到二进制时给出可操作错误', async () => {
  await assert.rejects(
    resolveRealEsrganBinary({ env: {}, fileExists: async () => false }),
    (err: unknown) => {
      assert.ok(err instanceof RealEsrganError)
      assert.equal(err.code, 'REALESRGAN_NOT_INSTALLED')
      assert.equal(err.statusCode, 400)
      assert.match(err.message, /npm run fetch:realesrgan/)
      return true
    },
  )
})

test('resolveRealEsrganBinary 显式配置路径不存在时同样报错', async () => {
  await assert.rejects(
    resolveRealEsrganBinary({
      env: { MOK_REALESRGAN_PATH: '/nonexistent/realesrgan.exe' },
      fileExists: async () => false,
    }),
    (err: unknown) => {
      assert.ok(err instanceof RealEsrganError)
      assert.equal(err.code, 'REALESRGAN_NOT_INSTALLED')
      assert.match(err.message, /MOK_REALESRGAN_PATH/)
      return true
    },
  )
})

test('buildRealEsrganArgs 构造固定 4x、x4plus 模型与显式 models 目录', () => {
  const args = buildRealEsrganArgs(fakeBinary, 'in.png', 'out.png')
  assert.deepEqual(args, [
    '-i', 'in.png',
    '-o', 'out.png',
    '-n', 'realesrgan-x4plus',
    '-s', '4',
    '-m', join(tmpdir(), 'fake-realesrgan', 'models'),
  ])
})

/** 生成一张指定尺寸的真实 PNG 到给定路径（模拟 exe 的 4x 输出） */
async function writePng(path: string, width: number, height: number): Promise<void> {
  const image = new Jimp({ width, height, color: 0xff3366ff })
  await image.write(path as `${string}.${string}`)
}

function createFakeDeps(outputSize: { width: number; height: number }) {
  const calls: Array<{ binary: string; args: string[] }> = []
  const defaultFileExists = async (path: string) => {
    try {
      return (await stat(path)).isFile()
    } catch {
      return false
    }
  }
  const deps = {
    env: { MOK_REALESRGAN_PATH: fakeBinary },
    fileExists: async (path: string) =>
      path === fakeBinary ? true : defaultFileExists(path),
    execFileImpl: async (binary: string, args: string[]) => {
      calls.push({ binary, args })
      const outputPath = args[args.indexOf('-o') + 1]
      await writePng(outputPath, outputSize.width, outputSize.height)
      return { stdout: '', stderr: '' }
    },
  }
  return { calls, deps }
}

async function writeWorkspaceInput(): Promise<string> {
  const inputPath = join(workspaceDir, 'realesrgan-input.png')
  await mkdir(workspaceDir, { recursive: true })
  await writePng(inputPath, 100, 80)
  return 'realesrgan-input.png'
}

test('upscaleWithRealEsrgan：4x 结果小于目标长边时保留原尺寸并标注实际宽高', async () => {
  const inputImage = await writeWorkspaceInput()
  // 100x80 → 4x 为 400x320，长边 400 < 2048（2k 目标）
  const { calls, deps } = createFakeDeps({ width: 400, height: 320 })
  const results = await upscaleWithRealEsrgan(
    { inputImage, resolutionType: '2k' },
    deps,
  )
  assert.equal(results.length, 1)
  assert.equal(results[0].width, 400)
  assert.equal(results[0].height, 320)
  assert.ok(results[0].localPath)
  const output = await Jimp.read(results[0].localPath!)
  assert.equal(output.width, 400)
  assert.equal(output.height, 320)
  // 命令参数：-i 指向 workspace 内的输入，-o 指向临时输出
  assert.equal(calls.length, 1)
  assert.equal(calls[0].binary, fakeBinary)
  assert.match(calls[0].args[calls[0].args.indexOf('-i') + 1], /realesrgan-input\.png$/)
})

test('upscaleWithRealEsrgan：4x 结果超过目标长边时等比缩到目标', async () => {
  const inputImage = await writeWorkspaceInput()
  // 模拟 4x 得到 6000x4000，超过 4k 目标 4096 → 缩到长边 4096
  const { deps } = createFakeDeps({ width: 6000, height: 4000 })
  const results = await upscaleWithRealEsrgan(
    { inputImage, resolutionType: '4k' },
    deps,
  )
  assert.equal(results.length, 1)
  assert.equal(Math.max(results[0].width!, results[0].height!), 4096)
  const output = await Jimp.read(results[0].localPath!)
  assert.equal(Math.max(output.width, output.height), 4096)
  // 等比：宽高比保持 3:2
  const ratio = output.width / output.height
  assert.ok(Math.abs(ratio - 1.5) < 0.01)
})

test('upscaleWithRealEsrgan：非法 resolutionType 返回 400', async () => {
  const inputImage = await writeWorkspaceInput()
  const { deps } = createFakeDeps({ width: 400, height: 320 })
  await assert.rejects(
    upscaleWithRealEsrgan(
      { inputImage, resolutionType: '16k' as '2k' },
      deps,
    ),
    (err: unknown) => {
      assert.ok(err instanceof RealEsrganError)
      assert.equal(err.code, 'INVALID_INPUT')
      assert.equal(err.statusCode, 400)
      return true
    },
  )
})

test('upscaleWithRealEsrgan：找不到输入资产时抛错', async () => {
  const { deps } = createFakeDeps({ width: 400, height: 320 })
  await assert.rejects(
    upscaleWithRealEsrgan({ inputImage: 'asset_missing' }, deps),
  )
})

test('upscaleWithRealEsrgan：exe 未产出结果文件时报 502', async () => {
  const inputImage = await writeWorkspaceInput()
  await assert.rejects(
    upscaleWithRealEsrgan(
      { inputImage, resolutionType: '2k' },
      {
        env: { MOK_REALESRGAN_PATH: fakeBinary },
        fileExists: async (path) =>
          path === fakeBinary || !(path.endsWith('output.png')),
        execFileImpl: async () => ({ stdout: '', stderr: '' }),
      },
    ),
    (err: unknown) => {
      assert.ok(err instanceof RealEsrganError)
      assert.equal(err.code, 'REALESRGAN_EXEC_FAILED')
      assert.equal(err.statusCode, 502)
      return true
    },
  )
})

test('upscaleWithRealEsrgan：exe 超时报 504', async () => {
  const inputImage = await writeWorkspaceInput()
  const timeoutError = Object.assign(new Error('timed out'), {
    killed: true,
    signal: 'SIGTERM',
  })
  await assert.rejects(
    upscaleWithRealEsrgan(
      { inputImage, resolutionType: '2k' },
      {
        env: { MOK_REALESRGAN_PATH: fakeBinary },
        fileExists: async () => true,
        execFileImpl: async () => {
          throw timeoutError
        },
      },
    ),
    (err: unknown) => {
      assert.ok(err instanceof RealEsrganError)
      assert.equal(err.code, 'REALESRGAN_TIMEOUT')
      assert.equal(err.statusCode, 504)
      return true
    },
  )
})
