import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { assertLoopbackUrl, buildBatchNodes, buildNode, executeCli, parseBatchSpec, parseCliArgs } from './mok.mjs';

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
  assert.equal(node.data.model, 'codex:gpt-5.5');
  assert.equal(node.data.status, 'idle');
});

function writeSpec(spec) {
  const dir = mkdtempSync(join(tmpdir(), 'mok-batch-'));
  const file = join(dir, 'batch.json');
  writeFileSync(file, typeof spec === 'string' ? spec : JSON.stringify(spec));
  return file;
}

function mockFetch(router) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const [status, payload] = router(method, path, body);
    return { ok: status < 400, status, text: async () => JSON.stringify(payload) };
  };
  return { calls, fetchImpl };
}

test('batch spec parser applies defaults and per-item overrides', () => {
  const spec = parseBatchSpec(JSON.stringify({
    model: 'jimeng-5.0',
    width: 1536,
    height: 864,
    items: [
      { title: '海报一', prompt: '第一张' },
      { prompt: '第二张', model: 'codex:gpt-5.5', width: 1024 },
    ],
  }));
  assert.equal(spec.items.length, 2);
  assert.equal(spec.items[0].title, '海报一');
  assert.equal(spec.items[0].model, 'jimeng-5.0');
  assert.equal(spec.items[0].width, 1536);
  assert.equal(spec.items[1].title, '批量图片 2');
  assert.equal(spec.items[1].model, 'codex:gpt-5.5');
  assert.equal(spec.items[1].width, 1024);
  assert.equal(spec.items[1].height, 864);
});

test('batch spec parser reports the failing item index', () => {
  assert.throws(
    () => parseBatchSpec(JSON.stringify({ items: [{ prompt: '有' }, { title: '没 prompt' }] })),
    (error) => error.code === 'INVALID_BATCH_ITEM' && error.message.includes('第 2 条'),
  );
  assert.throws(() => parseBatchSpec('not json'), (error) => error.code === 'INVALID_BATCH_FILE');
  assert.throws(() => parseBatchSpec('{"items": []}'), (error) => error.code === 'INVALID_BATCH_FILE');
});

test('batch node builder lays out a grid after existing nodes', () => {
  const existing = [{ position: { x: 200, y: 0 } }, { position: { x: 900, y: 50 } }];
  const nodes = buildBatchNodes(parseBatchSpec(JSON.stringify({ items: [{ prompt: 'a' }, { prompt: 'b' }, { prompt: 'c' }, { prompt: 'd' }] })), existing);
  assert.equal(nodes.length, 4);
  assert.equal(nodes[0].position.x, 1380);
  assert.equal(nodes[0].position.y, 0);
  assert.equal(nodes[1].position.x, 1860);
  assert.equal(nodes[2].position.x, 2340);
  assert.equal(nodes[3].position.x, 1380);
  assert.equal(nodes[3].position.y, 420);
  assert.equal(nodes[0].data.status, 'idle');
  assert.equal(nodes[0].data.prompt, 'a');
  assert.ok(nodes[0].data.updatedAt);
});

test('generate batch creates nodes, submits generations and stamps generationIds', async () => {
  const file = writeSpec({ model: 'jimeng-5.0', items: [{ prompt: '第一张' }, { prompt: '第二张' }] });
  const flow = { id: 'flow-1', name: '测试', nodes: [], edges: [] };
  let putCount = 0;
  const { calls, fetchImpl } = mockFetch((method, path, body) => {
    if (method === 'GET' && path === '/api/flows/flow-1') return [200, flow];
    if (method === 'PUT' && path === '/api/flows/flow-1') { putCount += 1; flow.nodes = body.nodes; return [200, { ...flow }]; }
    if (method === 'POST' && path === '/api/generations') {
      if (body.prompt === '第二张') return [502, { message: '供应商故障' }];
      return [201, { id: 'gen-1', status: 'queued' }];
    }
    if (method === 'GET' && path === '/api/generations/gen-1') return [200, { id: 'gen-1', status: 'success', results: [{ assetId: 'asset-1' }] }];
    return [404, { message: `未 mock：${method} ${path}` }];
  });
  const result = await executeCli(['generate', 'batch', '--flow', 'flow-1', '--file', file, '--wait'], { fetchImpl });
  assert.equal(result.flowId, 'flow-1');
  assert.equal(result.total, 2);
  assert.equal(result.submitted, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.items[0].generationId, 'gen-1');
  assert.equal(result.items[0].status, 'success');
  assert.deepEqual(result.items[0].assetIds, ['asset-1']);
  assert.equal(result.items[1].status, 'submit_failed');
  assert.equal(result.items[1].error, '供应商故障');
  const puts = calls.filter((call) => call.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.equal(puts[0].body.nodes.length, 2);
  const stamped = puts[1].body.nodes.find((node) => node.data?.generationId === 'gen-1');
  assert.ok(stamped);
  assert.equal(stamped.data.status, 'queued');
});

test('generate batch --new creates the flow first', async () => {
  const file = writeSpec({ items: [{ prompt: '唯一一张' }] });
  const { calls, fetchImpl } = mockFetch((method, path) => {
    if (method === 'POST' && path === '/api/flows') return [201, { id: 'flow-new', name: '新项目', nodes: [], edges: [] }];
    if (method === 'PUT' && path === '/api/flows/flow-new') return [200, {}];
    if (method === 'GET' && path === '/api/flows/flow-new') return [200, { id: 'flow-new', nodes: calls.filter((c) => c.method === 'PUT').at(-1)?.body?.nodes || [], edges: [] }];
    if (method === 'POST' && path === '/api/generations') return [201, { id: 'gen-9', status: 'queued' }];
    return [404, { message: `未 mock：${method} ${path}` }];
  });
  const result = await executeCli(['generate', 'batch', '--new', '新项目', '--file', file], { fetchImpl });
  assert.equal(result.flowId, 'flow-new');
  assert.equal(result.submitted, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/api/flows');
});

test('generate batch requires exactly one of --flow or --new', async () => {
  const file = writeSpec({ items: [{ prompt: 'x' }] });
  const { fetchImpl } = mockFetch(() => [500, {}]);
  await assert.rejects(() => executeCli(['generate', 'batch', '--file', file], { fetchImpl }), (error) => error.code === 'MISSING_OPTION');
  await assert.rejects(() => executeCli(['generate', 'batch', '--flow', 'a', '--new', 'b', '--file', file], { fetchImpl }), (error) => error.code === 'MISSING_OPTION');
});
