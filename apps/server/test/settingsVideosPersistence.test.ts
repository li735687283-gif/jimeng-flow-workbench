import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-settings-videos-persistence-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { getSettings, updateSettings } = await import('../src/services/settings')
const { listWorks, updateWork } = await import('../src/services/videos')

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

test('concurrent settings patches preserve fields from both writers', async () => {
  await Promise.all([
    updateSettings({ canvasTheme: 'hokusai-indigo' }),
    updateSettings({ themeBackgroundMode: 'original' }),
  ])

  const saved = await getSettings()
  assert.equal(saved.canvasTheme, 'hokusai-indigo')
  assert.equal(saved.themeBackgroundMode, 'original')
  const raw = await readFile(join(workspaceDir, 'config', 'settings.json'), 'utf8')
  assert.doesNotThrow(() => JSON.parse(raw))
})

test('concurrent work patches preserve fields from both writers', async () => {
  const configDir = join(workspaceDir, 'config')
  await mkdir(configDir, { recursive: true })
  await writeFile(
    join(configDir, 'videos.json'),
    JSON.stringify([
      {
        id: 'work_concurrent',
        mediaType: 'image',
        title: 'before title',
        description: 'before description',
        mediaAssetId: 'asset_image_1',
        coverAssetId: 'asset_image_1',
        mediaUrl: '/api/assets/asset_image_1/file',
        coverUrl: '/api/assets/asset_image_1/file',
        isFeatured: false,
        isPinned: false,
        isPublished: true,
        sortOrder: 0,
        createdAt: '2026-07-28T00:00:00.000Z',
        updatedAt: '2026-07-28T00:00:00.000Z',
      },
    ], null, 2),
    'utf8',
  )

  await Promise.all([
    updateWork('work_concurrent', { title: 'after title' }),
    updateWork('work_concurrent', { description: 'after description' }),
  ])

  const saved = await listWorks({ pageSize: 10 })
  assert.equal(saved.items[0]?.title, 'after title')
  assert.equal(saved.items[0]?.description, 'after description')
  const raw = await readFile(join(configDir, 'videos.json'), 'utf8')
  assert.doesNotThrow(() => JSON.parse(raw))
})
