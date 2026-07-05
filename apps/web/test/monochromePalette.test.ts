import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, '../src')
const allowedExtensions = new Set(['.css', '.ts', '.tsx'])

function collectSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath)
    }
    return allowedExtensions.has(path.extname(entry.name)) ? [fullPath] : []
  })
}

function expandHex(hex: string): string {
  const normalized = hex.slice(1)
  if (normalized.length === 3 || normalized.length === 4) {
    return normalized
      .split('')
      .map((char) => char + char)
      .join('')
      .slice(0, 6)
  }
  return normalized.slice(0, 6)
}

function isGrayRgb(r: number, g: number, b: number) {
  return r === g && g === b
}

function isGrayHex(hex: string) {
  const expanded = expandHex(hex)
  const r = Number.parseInt(expanded.slice(0, 2), 16)
  const g = Number.parseInt(expanded.slice(2, 4), 16)
  const b = Number.parseInt(expanded.slice(4, 6), 16)
  return isGrayRgb(r, g, b)
}

function lineNumberFor(text: string, index: number) {
  return text.slice(0, index).split(/\r?\n/).length
}

test('web source palette stays monochrome', () => {
  const violations: string[] = []

  for (const file of collectSourceFiles(srcDir)) {
    const text = fs.readFileSync(file, 'utf8')
    const relative = path.relative(path.resolve(__dirname, '..'), file)

    for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const token = match[0]
      if (!isGrayHex(token)) {
        violations.push(`${relative}:${lineNumberFor(text, match.index ?? 0)} ${token}`)
      }
    }

    for (const match of text.matchAll(/rgba?\(([^)]*)\)/g)) {
      const token = match[0]
      const channels = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
      if (
        channels.length >= 3 &&
        channels.slice(0, 3).every((channel) => Number.isFinite(channel)) &&
        !isGrayRgb(channels[0], channels[1], channels[2])
      ) {
        violations.push(`${relative}:${lineNumberFor(text, match.index ?? 0)} ${token}`)
      }
    }
  }

  assert.deepEqual(violations, [])
})
