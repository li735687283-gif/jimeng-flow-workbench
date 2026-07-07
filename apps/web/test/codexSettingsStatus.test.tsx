import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('getCodexStatus fetches OpenAI CLI readiness from the backend', async () => {
  const { getCodexStatus } = await import('../src/api/settings')
  const calls: { url: string; init?: RequestInit }[] = []
  const originalFetch = globalThis.fetch
  Object.assign(globalThis, {
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        available: true,
        cliFound: true,
        authFound: true,
        codexPath: 'codex',
        authFile: 'C:\\Users\\Lzw\\.codex\\auth.json',
        helperFound: true,
        helperPath: 'gpt-image-2-skill',
        setupCommands: {
          installCodex: 'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://chatgpt.com/codex/install.ps1 | iex"',
          installImageHelper: 'npm install -g gpt-image-2-skill',
          login: 'codex',
        },
        message: 'OpenAI Codex CLI 可用',
      })
    },
  })

  try {
    const status = await getCodexStatus()

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, '/api/codex/status')
    assert.equal(calls[0].init?.method, 'GET')
    assert.equal(status.available, true)
    assert.equal(status.authFound, true)
    assert.equal(status.helperFound, true)
    assert.equal(status.setupCommands?.login, 'codex')
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
  }
})

test('SettingsModal includes a compact OpenAI CLI status section', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.equal(html.includes('OpenAI CLI'), true)
  assert.equal(html.includes('检测 Codex'), true)
  assert.equal(html.includes('gpt-image-2'), true)
  assert.equal(html.includes('$imagegen'), false)
  assert.equal(html.includes('OpenAI CLI 模型走 Codex'), true)
})

test('SettingsModal exposes Codex CLI setup commands', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.equal(html.includes('安装 Codex CLI'), true)
  assert.equal(html.includes('安装图片 Helper'), true)
  assert.equal(html.includes('打开登录'), true)
  assert.equal(html.includes('chatgpt.com/codex/install'), true)
  assert.equal(html.includes('npm install -g gpt-image-2-skill'), true)
  assert.equal(html.includes('codex'), true)
})

test('SettingsModal offers gpt-image-2 as an explicit OpenAI CLI image model option', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.equal(
    html.includes('<option value="gpt-image-2">gpt-image-2</option>'),
    true,
  )
})

test('SettingsModal offers Codex CLI chat models as selectable common LLM options', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.equal(
    html.includes('<option value="codex:gpt-5.5">codex:gpt-5.5</option>'),
    true,
  )
  assert.equal(html.includes('Codex chat 模型走本机 ChatGPT 登录态'), true)
})
