import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import codexRoutes from '../src/routes/codex'

test('GET /api/codex/status reports local CLI and auth availability', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-status-route-'))
  const codexBin = join(dir, 'codex.cmd')
  const authFile = join(dir, 'auth.json')
  await writeFile(codexBin, '@echo off\r\n')
  await writeFile(authFile, '{}')

  const previousBin = process.env.CODEX_BIN
  const previousAuth = process.env.CODEX_AUTH_FILE
  process.env.CODEX_BIN = codexBin
  process.env.CODEX_AUTH_FILE = authFile

  const app = Fastify()
  try {
    await app.register(codexRoutes)
    const response = await app.inject({
      method: 'GET',
      url: '/api/codex/status',
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      available: true,
      cliFound: true,
      authFound: true,
      codexPath: codexBin,
      authFile,
      helperFound: false,
      message: 'OpenAI Codex CLI 可用',
      setupCommands: {
        installCodex: process.platform === 'win32'
          ? 'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://chatgpt.com/codex/install.ps1 | iex"'
          : 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
        login: 'codex',
      },
    })
  } finally {
    if (previousBin === undefined) {
      delete process.env.CODEX_BIN
    } else {
      process.env.CODEX_BIN = previousBin
    }
    if (previousAuth === undefined) {
      delete process.env.CODEX_AUTH_FILE
    } else {
      process.env.CODEX_AUTH_FILE = previousAuth
    }
    await app.close()
    await rm(dir, { recursive: true, force: true })
  }
})
