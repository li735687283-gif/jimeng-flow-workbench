import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  getUpstreamTextReferences,
  resolveImageGenerationPrompt,
} from '../src/utils/imageGenerationInputs'

test('video node can resolve prompt from upstream text nodes', () => {
  const nodes = [
    {
      id: 'text_a',
      type: 'text',
      data: { title: '分镜文案', content: '清晨树下读书的女孩，电影感光影' },
    },
    { id: 'video_1', type: 'video', data: {} },
  ]
  const edges = [{ source: 'text_a', target: 'video_1' }]

  assert.deepEqual(getUpstreamTextReferences({ nodeId: 'video_1', nodes, edges }), [
    {
      nodeId: 'text_a',
      title: '分镜文案',
      text: '清晨树下读书的女孩，电影感光影',
    },
  ])

  assert.equal(
    resolveImageGenerationPrompt({
      localPrompt: '',
      nodeId: 'video_1',
      nodes,
      edges,
    }).source,
    'upstream-text',
  )
  assert.equal(
    resolveImageGenerationPrompt({
      localPrompt: '本地覆盖',
      nodeId: 'video_1',
      nodes,
      edges,
    }).prompt,
    '本地覆盖',
  )
})

test('video node wires upstream text resolve into send and panel', async () => {
  const videoNode = await readFile(
    new URL('../src/nodes/VideoNode.tsx', import.meta.url),
    'utf8',
  )
  const panel = await readFile(
    new URL('../src/components/VideoGenerationPanel.tsx', import.meta.url),
    'utf8',
  )

  assert.match(videoNode, /resolveImageGenerationPrompt/)
  assert.match(videoNode, /upstreamTextBrief/)
  assert.match(videoNode, /getUpstreamTextReferences/)
  assert.match(panel, /upstreamTextBrief/)
  assert.match(panel, /文本提示词/)
  assert.match(panel, /reference-text-chip/)
})
