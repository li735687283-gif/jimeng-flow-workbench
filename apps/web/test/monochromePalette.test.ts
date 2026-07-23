import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(testDir, '../src')
const checkedExtensions = new Set(['.css', '.ts', '.tsx', '.svg'])
const approvedSemanticAccentHexes = new Set([
  'ff5c5c',
  'ff7878',
  '4a9eff',
  'f0b429',
  'f5c842',
])

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(filePath)
    return checkedExtensions.has(extname(entry.name)) ? [filePath] : []
  })
}

function isNeutralHex(hex: string): boolean {
  const value = hex.length === 3 || hex.length === 4
    ? hex
        .slice(0, 3)
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : hex.slice(0, 6)
  if (value.length !== 6) return false
  const channels = value.match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16))
  if (!channels || channels.length !== 3) return false
  return Math.max(...channels) - Math.min(...channels) <= 4
}

test('frontend source colors stay neutral except for approved semantic accents', () => {
  const violations: string[] = []

  for (const filePath of listSourceFiles(srcDir)) {
    if (relative(srcDir, filePath) === 'theme.css') continue
    const source = readFileSync(filePath, 'utf8')
    for (const match of source.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
      const color = match[1].toLowerCase()
      if (isNeutralHex(color) || approvedSemanticAccentHexes.has(color)) continue
      violations.push(`${relative(srcDir, filePath)} uses unapproved non-neutral #${color}`)
    }
  }

  assert.deepEqual(
    violations,
    [],
    'Non-neutral hex colors must be approved danger red, action blue, or featured gold accents',
  )
})
