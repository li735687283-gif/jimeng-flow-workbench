import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(testDir, '../src')
const checkedExtensions = new Set(['.css', '.ts', '.tsx', '.svg'])

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(filePath)
    return checkedExtensions.has(extname(entry.name)) ? [filePath] : []
  })
}

function isGrayHex(hex: string): boolean {
  const value = hex.length === 3 || hex.length === 4
    ? hex
        .slice(0, 3)
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : hex.slice(0, 6)
  if (value.length !== 6) return false
  return value.slice(0, 2) === value.slice(2, 4) && value.slice(2, 4) === value.slice(4, 6)
}

test('frontend source colors stay within black white and gray', () => {
  const violations: string[] = []

  for (const filePath of listSourceFiles(srcDir)) {
    const source = readFileSync(filePath, 'utf8')
    for (const match of source.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
      const color = match[1].toLowerCase()
      if (isGrayHex(color)) continue
      violations.push(`${relative(srcDir, filePath)} uses #${color}`)
    }
  }

  assert.deepEqual(violations, [])
})
