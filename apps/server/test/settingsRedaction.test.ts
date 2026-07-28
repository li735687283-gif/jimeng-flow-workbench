import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import { DEFAULT_SETTINGS, SETTINGS_SECRET_MASK } from '@jimeng-flow/shared'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-settings-redaction-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { default: settingsRoutes } = await import('../src/routes/settings')
const { getSettings } = await import('../src/services/settings')
const { isAllowedDreaminaExecutablePath } = await import('../src/services/jimeng')
let app: FastifyInstance

before(async () => {
  app = Fastify({ logger: false })
  await app.register(settingsRoutes)
  await app.ready()
})

after(async () => {
  await app.close()
  await rm(workspaceDir, { recursive: true, force: true })
})

test('GET and PUT settings responses never expose persisted API keys', async () => {
  const secrets = {
    apiKey: 'jimeng-secret',
    llmApiKey: 'llm-secret',
    kimiApiKey: 'kimi-secret',
    kimiCodingApiKey: 'kimi-coding-secret',
    deepseekApiKey: 'deepseek-secret',
  }
  const put = await app.inject({ method: 'PUT', url: '/api/settings', payload: secrets })
  assert.equal(put.statusCode, 200)
  for (const secret of Object.values(secrets)) {
    assert.equal(put.body.includes(secret), false)
  }
  assert.equal(put.json().apiKey, SETTINGS_SECRET_MASK)
  assert.equal(put.json().llmApiKey, SETTINGS_SECRET_MASK)
  assert.equal(put.json().hasApiKey, true)
  assert.equal(put.json().hasLlmApiKey, true)
  assert.equal(put.json().hasKimiApiKey, true)
  assert.equal(put.json().hasKimiCodingApiKey, true)
  assert.equal(put.json().hasDeepseekApiKey, true)

  const get = await app.inject({ method: 'GET', url: '/api/settings' })
  assert.equal(get.statusCode, 200)
  for (const secret of Object.values(secrets)) {
    assert.equal(get.body.includes(secret), false)
  }
  assert.equal(get.json().deepseekApiKey, SETTINGS_SECRET_MASK)

  const internal = await getSettings()
  assert.equal(internal.llmApiKey, secrets.llmApiKey)
  assert.equal(internal.deepseekApiKey, secrets.deepseekApiKey)
})

test('masked secrets preserve the old value while explicit empty strings clear it', async () => {
  const preserve = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    payload: { llmApiKey: SETTINGS_SECRET_MASK, llmModel: 'next-model' },
  })
  assert.equal(preserve.statusCode, 200)
  assert.equal((await getSettings()).llmApiKey, 'llm-secret')
  assert.equal((await getSettings()).llmModel, 'next-model')

  const clear = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    payload: { llmApiKey: '' },
  })
  assert.equal(clear.statusCode, 200)
  assert.equal(clear.json().llmApiKey, '')
  assert.equal(clear.json().hasLlmApiKey, false)
  assert.equal((await getSettings()).llmApiKey, '')
})

test('Dreamina executable setting only accepts the PATH-resolved command', () => {
  assert.equal(isAllowedDreaminaExecutablePath('dreamina'), true)
  assert.equal(isAllowedDreaminaExecutablePath(' dreamina '), true)
  assert.equal(isAllowedDreaminaExecutablePath('dreamina.exe'), false)
  assert.equal(isAllowedDreaminaExecutablePath('C:\\tools\\dreamina.cmd'), false)
  assert.equal(isAllowedDreaminaExecutablePath('/opt/dreamina/bin/dreamina'), false)
  assert.equal(isAllowedDreaminaExecutablePath('C:\\Windows\\System32\\cmd.exe'), false)
  assert.equal(isAllowedDreaminaExecutablePath('dreamina.cmd /c whoami'), false)
  assert.equal(isAllowedDreaminaExecutablePath('node.exe'), false)
})

test('settings routes reject arbitrary local executables for Dreamina', async () => {
  const before = await getSettings()
  const update = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    payload: { dreaminaPath: 'C:\\Windows\\System32\\cmd.exe' },
  })
  assert.equal(update.statusCode, 400)
  assert.match(update.json().message, /dreamina/)
  assert.equal((await getSettings()).dreaminaPath, before.dreaminaPath)

  const testResult = await app.inject({
    method: 'POST',
    url: '/api/settings/test-jimeng',
    payload: { dreaminaPath: 'C:\\Windows\\System32\\calc.exe' },
  })
  assert.equal(testResult.statusCode, 400)
  assert.match(testResult.json().message, /dreamina/)
})

test('changing a provider Base URL requires replacing or clearing its stored key', async () => {
  const initial = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    payload: {
      kimiBaseUrl: 'https://trusted.example/v1',
      kimiApiKey: 'stored-kimi-key',
    },
  })
  assert.equal(initial.statusCode, 200)

  const blocked = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    payload: {
      kimiBaseUrl: 'https://attacker.example/v1',
      kimiApiKey: SETTINGS_SECRET_MASK,
    },
  })
  assert.equal(blocked.statusCode, 400)
  assert.match(blocked.json().message, /重新输入或清空/)
  assert.equal((await getSettings()).kimiBaseUrl, 'https://trusted.example/v1')
  assert.equal((await getSettings()).kimiApiKey, 'stored-kimi-key')

  const replaced = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    payload: {
      kimiBaseUrl: 'https://replacement.example/v1',
      kimiApiKey: 'replacement-kimi-key',
    },
  })
  assert.equal(replaced.statusCode, 200)
  assert.equal((await getSettings()).kimiBaseUrl, 'https://replacement.example/v1')
  assert.equal((await getSettings()).kimiApiKey, 'replacement-kimi-key')

  const cleared = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    payload: {
      kimiBaseUrl: 'https://cleared.example/v1',
      kimiApiKey: '',
    },
  })
  assert.equal(cleared.statusCode, 200)
  assert.equal((await getSettings()).kimiBaseUrl, 'https://cleared.example/v1')
  assert.equal((await getSettings()).kimiApiKey, '')
})

test('settings routes reject malformed field types before persisting them', async () => {
  const before = await getSettings()
  const update = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    payload: { llmApiKey: 123 },
  })

  assert.equal(update.statusCode, 400)
  assert.match(update.json().message, /llmApiKey/)
  assert.deepEqual(await getSettings(), before)
})

test('settings responses omit unknown legacy fields', async () => {
  const { toSettingsResponse } = await import('../src/services/settings')
  const response = toSettingsResponse({
    ...DEFAULT_SETTINGS,
    legacyApiToken: 'legacy-secret',
  } as typeof DEFAULT_SETTINGS & { legacyApiToken: string }) as Record<string, unknown>

  assert.equal('legacyApiToken' in response, false)
  assert.equal(JSON.stringify(response).includes('legacy-secret'), false)
})

test('legacy custom Dreamina paths are ignored in favor of the PATH command', async () => {
  const configDir = join(workspaceDir, 'config')
  await mkdir(configDir, { recursive: true })
  await writeFile(
    join(configDir, 'settings.json'),
    JSON.stringify({ dreaminaPath: 'C:\\legacy\\dreamina.cmd' }),
    'utf8',
  )

  assert.equal((await getSettings()).dreaminaPath, 'dreamina')
})
