import assert from 'node:assert/strict';
import test from 'node:test';

import { assertLoopbackUrl, buildNode, parseCliArgs } from './mok.mjs';

test('CLI parser keeps positional text and JSON mode', () => {
  const parsed = parseCliArgs(['agent', 'prompt', '一张海报', '--flow', 'flow-1', '--json']);
  assert.deepEqual(parsed.positionals, ['agent', 'prompt', '一张海报']);
  assert.equal(parsed.options.flow, 'flow-1');
  assert.equal(parsed.options.json, true);
});

test('CLI only accepts loopback API URLs', () => {
  assert.equal(assertLoopbackUrl('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
  assert.equal(assertLoopbackUrl('http://localhost:8787/'), 'http://localhost:8787');
  assert.equal(assertLoopbackUrl('http://[::1]:8787/'), 'http://[::1]:8787');
  assert.throws(() => assertLoopbackUrl('http://192.168.1.12:8787'), (error) => error.code === 'LOOPBACK_ONLY');
});

test('node builder creates deterministic canvas node data', () => {
  const node = buildNode('image', {
    id: 'node-1',
    x: '120',
    y: '-40',
    title: '封面',
    prompt: '黑色耳机海报',
  });
  assert.equal(node.id, 'node-1');
  assert.equal(node.type, 'image');
  assert.deepEqual(node.position, { x: 120, y: -40 });
  assert.equal(node.data.title, '封面');
  assert.equal(node.data.prompt, '黑色耳机海报');
  assert.equal(node.data.status, 'idle');
});
