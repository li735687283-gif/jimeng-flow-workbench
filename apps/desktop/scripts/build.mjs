import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const desktopRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

await rm(resolve(desktopRoot, 'dist'), { force: true, recursive: true })

await build({
  absWorkingDir: desktopRoot,
  bundle: true,
  entryNames: '[name]',
  entryPoints: {
    main: 'src/main.ts',
    preload: 'src/preload.ts',
  },
  external: ['electron'],
  format: 'cjs',
  outExtension: {
    '.js': '.cjs',
  },
  outdir: 'dist',
  platform: 'node',
  sourcemap: true,
  target: 'node20',
})
