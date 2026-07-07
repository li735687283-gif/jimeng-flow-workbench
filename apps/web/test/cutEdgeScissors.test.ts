import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('cut edge exposes a scissors cut control instead of an ambiguous close icon', () => {
  const source = readFileSync(
    resolve('apps/web/src/components/canvas/CutEdge.tsx'),
    'utf8',
  )

  assert.equal(source.includes('aria-label="剪刀断开连线"'), true)
  assert.equal(source.includes('title="剪刀断开连线"'), true)
  assert.equal(source.includes('<Scissors size={15}'), true)
})

test('cut edge scissors control blocks canvas pointer handling before removing edge', () => {
  const source = readFileSync(
    resolve('apps/web/src/components/canvas/CutEdge.tsx'),
    'utf8',
  )

  assert.equal(source.includes('cut-edge-button-wrap nodrag nopan'), true)
  assert.equal(source.includes('onPointerDown={(e) => {'), true)
  assert.equal(source.includes('e.preventDefault()'), true)
  assert.equal(source.includes('removeEdge(id)'), true)
})

test('cut edge keeps scissors mounted so the hover transition is stable', () => {
  const source = readFileSync(
    resolve('apps/web/src/components/canvas/CutEdge.tsx'),
    'utf8',
  )
  const css = readFileSync(resolve('apps/web/src/App.css'), 'utf8')

  assert.equal(source.includes('{showButton && ('), false)
  assert.equal(
    source.includes("className={`cut-edge-button-wrap nodrag nopan${isActive ? ' visible' : ''}`}"),
    true,
  )
  assert.equal(
    source.includes("pointerEvents: isActive ? 'all' : 'none'"),
    true,
  )
  assert.equal(/\.cut-edge-button-wrap\s*\{[^}]*animation:/s.test(css), false)
  assert.equal(
    /\.cut-edge-button-wrap\.visible\s*\{[^}]*opacity: 1;[^}]*pointer-events: auto;/s.test(
      css,
    ),
    true,
  )
})

test('cut edge removes the line on pointer release inside the scissors control', () => {
  const source = readFileSync(
    resolve('apps/web/src/components/canvas/CutEdge.tsx'),
    'utf8',
  )

  assert.equal(source.includes('onPointerUp={(e) => {'), true)
  assert.equal(source.includes('removeEdge(id)'), true)
})

test('cut edge scissors compensates for canvas zoom so it stays visible', () => {
  const source = readFileSync(
    resolve('apps/web/src/components/canvas/CutEdge.tsx'),
    'utf8',
  )

  assert.equal(source.includes('useStore'), true)
  assert.equal(source.includes('state.transform[2]'), true)
  assert.equal(source.includes('scissorsScale'), true)
  assert.equal(source.includes("'--cut-edge-scale': `${scissorsScale}`"), true)

  const css = readFileSync(resolve('apps/web/src/App.css'), 'utf8')
  assert.equal(css.includes('scale(var(--cut-edge-scale, 1))'), true)
})
