import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractTextNodePrompt,
  getImageGenerationInputImages,
  getUpstreamTextReferences,
  joinUpstreamTextPrompts,
  resolveImageGenerationPrompt,
} from '../src/utils/imageGenerationInputs'

test('image generation includes the current image asset for third-party image models', () => {
  assert.deepEqual(
    getImageGenerationInputImages({
      assetId: 'asset_current',
      modelId: 'gpt-image-2-official',
    }),
    ['asset_current'],
  )
})

test('image generation keeps blank image nodes text-to-image', () => {
  assert.deepEqual(
    getImageGenerationInputImages({
      assetId: undefined,
      modelId: 'gpt-image-2-official',
    }),
    [],
  )
})

test('image generation includes only direct upstream image assets after the current image', () => {
  assert.deepEqual(
    getImageGenerationInputImages({
      assetId: 'asset_current',
      modelId: 'gpt-image-2-official',
      nodeId: 'target',
      nodes: [
        { id: 'root', type: 'image', data: { assetId: 'asset_root' } },
        { id: 'middle', type: 'image', data: { assetId: 'asset_middle' } },
        { id: 'target', type: 'image', data: { assetId: 'asset_current' } },
      ],
      edges: [
        { source: 'root', target: 'middle' },
        { source: 'middle', target: 'target' },
      ],
    }),
    // 仅直接上游一层：middle → target，不含 root
    ['asset_current', 'asset_middle'],
  )
})

test('image generation deduplicates connected refs and ignores invalid upstream nodes', () => {
  assert.deepEqual(
    getImageGenerationInputImages({
      assetId: ' asset_current ',
      modelId: 'gpt-image-2-official',
      nodeId: 'target',
      nodes: [
        { id: 'same', type: 'image', data: { assetId: 'asset_current' } },
        { id: 'blank', type: 'image', data: { assetId: '   ' } },
        { id: 'text', type: 'text', data: { assetId: 'asset_text' } },
        { id: 'target', type: 'image', data: { assetId: 'asset_current' } },
      ],
      edges: [
        { source: 'same', target: 'target' },
        { source: 'blank', target: 'target' },
        { source: 'text', target: 'target' },
      ],
    }),
    ['asset_current'],
  )
})

test('extractTextNodePrompt prefers content over promptCandidate and input', () => {
  assert.equal(
    extractTextNodePrompt({
      content: '  正文提示词  ',
      promptCandidate: '候选',
      input: '输入',
    }),
    '正文提示词',
  )
  assert.equal(
    extractTextNodePrompt({
      content: '   ',
      promptCandidate: ' 候选词 ',
      input: '输入',
    }),
    '候选词',
  )
  assert.equal(
    extractTextNodePrompt({
      content: '',
      input: ' 仅有输入 ',
    }),
    '仅有输入',
  )
})

test('upstream text nodes are collected as prompt references for image generation', () => {
  const refs = getUpstreamTextReferences({
    nodeId: 'image_1',
    nodes: [
      {
        id: 'text_a',
        type: 'text',
        data: { title: '场景描述', content: '清晨的树下读书' },
      },
      {
        id: 'text_empty',
        type: 'text',
        data: { title: '空', content: '  ' },
      },
      {
        id: 'image_src',
        type: 'image',
        data: { assetId: 'asset_x' },
      },
      { id: 'image_1', type: 'image', data: {} },
    ],
    edges: [
      { source: 'text_a', target: 'image_1' },
      { source: 'text_empty', target: 'image_1' },
      { source: 'image_src', target: 'image_1' },
    ],
  })

  assert.deepEqual(refs, [
    {
      nodeId: 'text_a',
      title: '场景描述',
      text: '清晨的树下读书',
    },
  ])
  assert.equal(joinUpstreamTextPrompts(refs), '清晨的树下读书')
})

test('resolveImageGenerationPrompt prefers local prompt then falls back to upstream text', () => {
  const nodes = [
    {
      id: 'text_a',
      type: 'text',
      data: { content: '上游文本提示词' },
    },
    { id: 'image_1', type: 'image', data: {} },
  ]
  const edges = [{ source: 'text_a', target: 'image_1' }]

  assert.deepEqual(
    resolveImageGenerationPrompt({
      localPrompt: '本地手写提示词',
      nodeId: 'image_1',
      nodes,
      edges,
    }),
    {
      prompt: '本地手写提示词',
      source: 'local',
      upstreamRefs: [
        {
          nodeId: 'text_a',
          title: '文本节点',
          text: '上游文本提示词',
        },
      ],
    },
  )

  assert.deepEqual(
    resolveImageGenerationPrompt({
      localPrompt: '   ',
      nodeId: 'image_1',
      nodes,
      edges,
    }),
    {
      prompt: '上游文本提示词',
      source: 'upstream-text',
      upstreamRefs: [
        {
          nodeId: 'text_a',
          title: '文本节点',
          text: '上游文本提示词',
        },
      ],
    },
  )

  assert.equal(
    resolveImageGenerationPrompt({
      localPrompt: '',
      nodeId: 'image_1',
      nodes: [{ id: 'image_1', type: 'image', data: {} }],
      edges: [],
    }).source,
    'empty',
  )
})
