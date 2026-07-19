import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const releaseDir = resolve(repositoryRoot, 'release')
const stagingDir = resolve(
  releaseDir,
  `.builder-${Date.now()}-${process.pid}`,
)
const builderCli = resolve(
  repositoryRoot,
  'node_modules/electron-builder/out/cli/cli.js',
)

await mkdir(stagingDir, { recursive: true })

const exitCode = await new Promise((resolvePromise, rejectPromise) => {
  const child = spawn(
    process.execPath,
    [
      builderCli,
      '--win',
      'nsis',
      `--config.directories.output=${stagingDir}`,
    ],
    {
      cwd: repositoryRoot,
      stdio: 'inherit',
      windowsHide: true,
    },
  )
  child.once('error', rejectPromise)
  child.once('close', (code) => resolvePromise(code ?? 1))
})

if (exitCode !== 0) {
  process.exitCode = exitCode
} else {
  const entries = await readdir(stagingDir, { withFileTypes: true })
  const artifacts = entries.filter(
    (entry) =>
      entry.isFile() &&
      (entry.name === 'latest.yml' ||
        (entry.name.startsWith('MO.K-Setup-') &&
          (entry.name.endsWith('.exe') ||
            entry.name.endsWith('.exe.blockmap')))),
  )
  if (!artifacts.some((entry) => entry.name.endsWith('.exe'))) {
    throw new Error(`No NSIS installer was produced under ${stagingDir}`)
  }

  await Promise.all(
    artifacts.map((entry) =>
      copyFile(
        resolve(stagingDir, entry.name),
        resolve(releaseDir, entry.name),
      ),
    ),
  )
  console.log(
    `Windows package artifacts copied to ${releaseDir}; unpacked app: ${resolve(stagingDir, 'win-unpacked')}`,
  )
}
