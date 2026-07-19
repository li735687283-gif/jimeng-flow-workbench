import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  resolveWorkspaceDataPathFrom,
  resolveWorkspaceDirectory,
} from '../src/config'

test('workspace directory defaults under the project root and accepts a desktop override', () => {
  const projectRoot = resolve(join('F:', 'repo'))
  const desktopWorkspace = resolve(join('D:', 'MO.K', 'workspace'))

  assert.equal(
    resolveWorkspaceDirectory(projectRoot),
    resolve(projectRoot, 'workspace'),
  )
  assert.equal(
    resolveWorkspaceDirectory(projectRoot, desktopWorkspace),
    desktopWorkspace,
  )
})

test('workspace-prefixed output paths remain inside the selected workspace', () => {
  const workspace = resolve(join('D:', 'MO.K', 'workspace'))

  assert.equal(
    resolveWorkspaceDataPathFrom(workspace, './workspace/outputs'),
    resolve(workspace, 'outputs'),
  )
  assert.equal(
    resolveWorkspaceDataPathFrom(workspace, 'workspace\\flows'),
    resolve(workspace, 'flows'),
  )
})
