import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateImageProvider } from '../src/utils/imageProviderValidation'

test('image provider dispatcher uses the Jimeng probe for Jimeng models', async () => {
  const calls: string[] = []
  const result = await validateImageProvider('jimeng-5.0', {
    probeJimeng: async () => {
      calls.push('jimeng')
      return { ok: false, message: 'dreamina CLI 不可用' }
    },
    probeCodex: async () => {
      calls.push('codex')
      return { ok: true }
    },
  })

  assert.deepEqual(result, { ok: false, message: 'dreamina CLI 不可用' })
  assert.deepEqual(calls, ['jimeng'])
})

test('image provider dispatcher uses the Codex probe for Codex models', async () => {
  const calls: string[] = []
  const result = await validateImageProvider('codex:gpt-5.5', {
    probeJimeng: async () => {
      calls.push('jimeng')
      return { ok: false }
    },
    probeCodex: async () => {
      calls.push('codex')
      return { ok: true, message: 'OpenAI Codex CLI 可用' }
    },
  })

  assert.deepEqual(result, { ok: true, message: 'OpenAI Codex CLI 可用' })
  assert.deepEqual(calls, ['codex'])
})

test('generic models pass with an explicit no-local-probe message instead of silence', async () => {
  const result = await validateImageProvider('flux-1.1-pro', {
    probeJimeng: async () => {
      throw new Error('unexpected Jimeng probe')
    },
    probeCodex: async () => {
      throw new Error('unexpected Codex probe')
    },
  })

  assert.equal(result.ok, true)
  // 用户点了「校验」必须看到发生了什么，不能无声通过
  assert.match(result.message ?? '', /无需本地环境校验/)
})

test('image provider dispatcher surfaces Jimeng and Codex probe errors', async () => {
  await assert.rejects(
    () =>
      validateImageProvider('jimeng-5.0', {
        probeJimeng: async () => {
          throw new Error('Jimeng unavailable')
        },
        probeCodex: async () => ({ ok: true }),
      }),
    /Jimeng unavailable/,
  )
  await assert.rejects(
    () =>
      validateImageProvider('codex:gpt-5.5', {
        probeJimeng: async () => ({ ok: true }),
        probeCodex: async () => {
          throw new Error('Codex unavailable')
        },
      }),
    /Codex unavailable/,
  )
})

test('validate button gives perceivable visual feedback: icon color and spinner ring', async () => {
  const source = await readFile(
    new URL('../src/nodes/ImageNode.tsx', import.meta.url),
    'utf8',
  )
  const card = await readFile(
    new URL('../src/components/ImageActionCard.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
  const tokens = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  // 失败原因仍进入编辑面板错误区（可操作反馈），tooltip 同步展示
  assert.match(source, /setSendError\(\s*`校验失败：/)
  assert.match(source, /setValidationMessage/)
  assert.match(source, /validationTitle=\{validationMessage \|\| undefined\}/)
  assert.match(card, /title=\{validationTitle\}/)

  // 按钮本体是纯视觉反馈：不再按状态切换文字（「校验通过/失败」只出现在消息里）
  assert.doesNotMatch(source, /validationLabel=\{validationStatus/)

  // 图标包裹层 + 校验中环形动画元素
  assert.match(card, /className="validation-icon"/)
  assert.match(card, /validationStatus === 'checking'/)
  assert.match(card, /className="validation-spinner"/)
  assert.match(css, /\.validation-spinner\s*\{[^}]*position:\s*absolute;[^}]*border-radius:\s*50%;[^}]*animation:\s*validation-spin/s)
  assert.match(css, /@keyframes validation-spin/)

  // 通过绿 / 失败红作用在图标上，使用令牌而非零散色值
  assert.match(
    css,
    /\.image-action-button\.validation-success \.validation-icon\s*\{[^}]*color:\s*var\(--status-valid\);/s,
  )
  assert.match(
    css,
    /\.image-action-button\.validation-error \.validation-icon\s*\{[^}]*color:\s*var\(--menu-danger-text\);/s,
  )
  assert.match(tokens, /--status-valid:\s*#2da44e;/)
})
