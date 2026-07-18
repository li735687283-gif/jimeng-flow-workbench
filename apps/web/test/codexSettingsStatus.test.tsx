import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
        helperFound: false,
        setupCommands: {
          installCodex: 'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://chatgpt.com/codex/install.ps1 | iex"',
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
    assert.equal(status.helperFound, false)
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
  assert.equal(html.includes('codex:gpt-5.5'), true)
  assert.equal(html.includes('gpt-image-2'), false)
  assert.equal(html.includes('$imagegen'), false)
})

test('SettingsModal exposes Codex CLI setup commands', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.equal(html.includes('安装 Codex CLI'), true)
  assert.equal(html.includes('打开登录'), true)
  assert.equal(html.includes('chatgpt.com/codex/install'), true)
  assert.equal(html.includes(['安装图片', 'Helper'].join(' ')), false)
  assert.equal(
    html.includes(['npm install -g', ['gpt-image', '2-skill'].join('-')].join(' ')),
    false,
  )
  assert.equal(html.includes('codex'), true)
})

test('SettingsModal lists the current Codex CLI chat model family', () => {
  const source = readFileSync('apps/web/src/components/SettingsModal.tsx', 'utf8')

  for (const modelId of [
    'codex:gpt-5.6-sol',
    'codex:gpt-5.6-terra',
    'codex:gpt-5.6-luna',
    'codex:gpt-5.5',
  ]) {
    assert.match(source, new RegExp(`id: '${modelId.replace('.', '\\.')}'`))
  }
})

test('selected model rows only show the display name', () => {
  const source = readFileSync('apps/web/src/components/SettingsModal.tsx', 'utf8')

  assert.doesNotMatch(source, /settings-model-list-selected-id/)
})

test('shared picker exposes a Codex model with the unified menu surface', async () => {
  const { SettingsModelPickerPanel } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModelPickerPanel
      models={[{ id: 'codex:gpt-5.5', label: 'codex:gpt-5.5' }]}
      selectedModelIds={[]}
      onSelect={() => undefined}
    />,
  )

  assert.match(html, /settings-model-picker/)
  assert.match(html, /settings-model-picker-option/)
  assert.match(html, /data-model-option-id="codex:gpt-5.5"/)
  assert.equal(html.includes('<datalist'), false)
})

test('SettingsModal uses one custom picker system instead of browser datalists', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.equal(html.includes('<datalist'), false)
  assert.equal(html.includes('settings-dropdown-control'), false)
  assert.equal((html.match(/settings-model-list-add/g) ?? []).length >= 5, true)
})
