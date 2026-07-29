import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// node 环境无 DOM：用最小假的 HTMLElement 满足 instanceof 与 closest/querySelector
class FakeHTMLElement {
  constructor(
    private readonly closestMap: Record<string, FakeHTMLElement | null>,
    private readonly containsGroupFrame = false,
  ) {}
  closest(selector: string): FakeHTMLElement | null {
    return this.closestMap[selector] ?? null
  }
  querySelector(selector: string): FakeHTMLElement | null {
    if (selector === '.group-frame' && this.containsGroupFrame) {
      return new FakeHTMLElement({})
    }
    return null
  }
}
Object.assign(globalThis, { HTMLElement: FakeHTMLElement })

const { isBlankCanvasTarget } = await import('../src/utils/canvasTargets')

const pane = new FakeHTMLElement({})
const plainNode = new FakeHTMLElement({ '.react-flow': pane })
const frameNode = new FakeHTMLElement({ '.react-flow': pane }, true)

test('blank canvas target accepts the pane itself', () => {
  const target = new FakeHTMLElement({
    '.react-flow__node': null,
    '.react-flow': pane,
  })
  assert.equal(isBlankCanvasTarget(target), true)
})

test('plain nodes and handles are not blank targets', () => {
  const onNode = new FakeHTMLElement({
    '.react-flow__node': plainNode,
    '.react-flow': pane,
  })
  assert.equal(isBlankCanvasTarget(onNode), false)

  const onHandle = new FakeHTMLElement({
    '.react-flow__handle': new FakeHTMLElement({}),
    '.react-flow__node': plainNode,
    '.react-flow': pane,
  })
  assert.equal(isBlankCanvasTarget(onHandle), false)

  assert.equal(isBlankCanvasTarget(null), false)
  assert.equal(isBlankCanvasTarget({}), false)
})

test('group frame counts as blank canvas so in-group nodes can drag-connect', () => {
  const onFrame = new FakeHTMLElement({
    '.react-flow__node': frameNode,
    '.react-flow': pane,
  })
  assert.equal(isBlankCanvasTarget(onFrame), true)

  // 组内成员节点仍是「节点上」，不弹新建菜单（保持连接路径）
  const onMember = new FakeHTMLElement({
    '.react-flow__node': plainNode,
    '.react-flow': frameNode,
  })
  assert.equal(isBlankCanvasTarget(onMember), false)
})

test('canvas view uses the shared frame-aware blank target check', async () => {
  const source = await readFile(
    new URL('../src/components/canvas/CanvasView.tsx', import.meta.url),
    'utf8',
  )
  assert.match(
    source,
    /import \{ isBlankCanvasTarget \} from '\.\.\/\.\.\/utils\/canvasTargets'/,
  )
  assert.match(source, /isBlankCanvasTarget\(event\.target\)/)
})
