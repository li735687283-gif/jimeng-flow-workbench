import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('text node exposes one themed bottom-right resize control', async () => {
  const [source, css, theme] = await Promise.all([
    readFile(new URL('../src/nodes/TextNode.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/theme.css', import.meta.url), 'utf8'),
  ])

  assert.match(
    source,
    /import \{ NodeResizeControl, type NodeProps \} from '@xyflow\/react'/,
  )
  assert.match(
    source,
    /<NodeResizeControl[\s\S]*?nodeId=\{id\}[\s\S]*?className="text-node-resize-control nopan"[\s\S]*?position="bottom-right"[\s\S]*?minWidth=\{TEXT_NODE_MIN_WIDTH\}[\s\S]*?minHeight=\{TEXT_NODE_MIN_HEIGHT\}/,
  )
  assert.match(source, /<Equal size=\{16\} strokeWidth=\{3\}/)
  assert.match(
    source,
    /const CONTAINER_STYLE:[\s\S]*?width: '100%'[\s\S]*?minHeight: 0/,
  )
  assert.match(source, /Math\.max\(width, TEXT_NODE_MIN_WIDTH\)/)
  assert.match(source, /Math\.max\(height, TEXT_NODE_MIN_HEIGHT\)/)
  assert.match(source, /whiteSpace: 'pre-wrap'/)
  assert.match(source, /wordBreak: 'break-word'/)

  assert.match(
    css,
    /data-flow-node-type='text'\] \.node-card \{[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?box-sizing: border-box;/,
  )
  assert.match(
    css,
    /text-node-resize-control\.react-flow__resize-control\.handle\.bottom\.right \{[\s\S]*?right: 2px;[\s\S]*?bottom: 2px;[\s\S]*?width: 26px;[\s\S]*?height: 26px;[\s\S]*?background: transparent;[\s\S]*?border-radius: 15px 0 26px 0;[\s\S]*?cursor: nwse-resize;/,
  )
  assert.match(
    css,
    /text-node-resize-control\.react-flow__resize-control\.handle\.bottom\.right:hover,[\s\S]*?color: var\(--text-resize-handle-hover-icon\);[\s\S]*?background: var\(--text-resize-handle-hover-bg\);/,
  )
  assert.match(theme, /--text-resize-handle-hover-icon: #8b5cf6;/)
  assert.match(theme, /--text-resize-handle-hover-bg: #392b5b;/)
  assert.doesNotMatch(css, /0 0 12px rgba\(139, 92, 246, 0\.18\)/)
  assert.match(
    css,
    /\.text-node-resize-control:hover \.text-node-resize-icon \{[\s\S]*?transform: rotate\(-45deg\) scale\(1\.12\);/,
  )
  assert.match(source, /const TEXT_CONTENT_PADDING = '22px 40px 38px 28px'/)
  assert.match(css, /padding: 22px 40px 38px 28px;/)
})

test('React Flow dimension changes remain on text nodes for autosave', async () => {
  const { useCanvasStore } = await import('../src/state/canvasStore')
  const previousState = useCanvasStore.getState()

  try {
    useCanvasStore.setState({
      nodes: [
        {
          id: 'text-resize-test',
          type: 'text',
          position: { x: 0, y: 0 },
          data: { title: '文本节点', status: 'idle' },
        },
      ],
      edges: [],
      deletedNodeIds: [],
      selectedNodeId: null,
      clipboardNode: null,
    })

    useCanvasStore.getState().onNodesChange([
      {
        id: 'text-resize-test',
        type: 'dimensions',
        dimensions: { width: 520, height: 360 },
        setAttributes: true,
        resizing: true,
      },
    ])

    const resized = useCanvasStore
      .getState()
      .nodes.find((node) => node.id === 'text-resize-test')

    assert.equal(resized?.width, 520)
    assert.equal(resized?.height, 360)
    assert.deepEqual(resized?.measured, { width: 520, height: 360 })
    assert.equal(resized?.resizing, true)
  } finally {
    useCanvasStore.setState(previousState)
  }
})