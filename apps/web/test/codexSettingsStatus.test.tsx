import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

function extractDatalist(html: string, id: string): string {
  const openingTag = `<datalist id="${id}">`
  const start = html.indexOf(openingTag)
  assert.notEqual(start, -1, `Missing datalist #${id}`)

  const end = html.indexOf('</datalist>', start + openingTag.length)
  assert.notEqual(end, -1, `Missing closing tag for datalist #${id}`)
  return html.slice(start, end + '</datalist>'.length)
}

function extractInputForList(html: string, listId: string): string {
  const input = (html.match(/<input\b[^>]*>/g) ?? []).find((tag) =>
    tag.includes(`list="${listId}"`),
  )
  assert.ok(input, `Missing input linked to datalist #${listId}`)
  return input
}

async function renderSettingsModalWithCodexModelRows(): Promise<string> {
  const { DEFAULT_SETTINGS } = await import('@jimeng-flow/shared')
  const originalImageModels = DEFAULT_SETTINGS.imageModels
  const originalLlmModels = DEFAULT_SETTINGS.llmModels
  DEFAULT_SETTINGS.imageModels = [...originalImageModels, 'codex:gpt-5.5']
  DEFAULT_SETTINGS.llmModels = [...originalLlmModels, 'codex:gpt-5.5']

  try {
    const { SettingsModal } = await import('../src/components/SettingsModal')
    return renderToStaticMarkup(
      <SettingsModal open={true} onClose={() => undefined} />,
    )
  } finally {
    DEFAULT_SETTINGS.imageModels = originalImageModels
    DEFAULT_SETTINGS.llmModels = originalLlmModels
  }
}

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
  assert.equal(html.includes(['npm install -g', ['gpt-image', '2-skill'].join('-')].join(' ')), false)
  assert.equal(html.includes('codex'), true)
})

test('SettingsModal offers a Codex model as the OpenAI CLI image model option', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  const imageOptions = extractDatalist(html, 'set-codex-image-model-options')
  assert.equal(
    imageOptions.includes('<option value="codex:gpt-5.5">codex:gpt-5.5</option>'),
    true,
  )
})

test('SettingsModal datalist inputs use the shared canvas menu rhythm', async () => {
  const html = await renderSettingsModalWithCodexModelRows()

  extractDatalist(html, 'set-codex-image-model-options')
  extractDatalist(html, 'set-codex-chat-model-options')

  const imageInput = extractInputForList(html, 'set-codex-image-model-options')
  const chatInput = extractInputForList(html, 'set-codex-chat-model-options')
  assert.match(imageInput, /\blist="set-codex-image-model-options"/)
  assert.match(chatInput, /\blist="set-codex-chat-model-options"/)
  assert.match(imageInput, /\bclass="settings-dropdown-control"/)
  assert.match(chatInput, /\bclass="settings-dropdown-control"/)
  assert.match(html, /--menu-control-font-size:12px/)
  assert.match(html, /--menu-control-padding:6px 8px/)
})

test('SettingsModal offers Codex CLI chat models as selectable common LLM options', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  const chatOptions = extractDatalist(html, 'set-codex-chat-model-options')
  assert.equal(
    chatOptions.includes('<option value="codex:gpt-5.5">codex:gpt-5.5</option>'),
    true,
  )
})
