#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DEFAULT_API_URL = 'http://127.0.0.1:8787';
const TERMINAL = new Set(['succeeded', 'completed', 'failed', 'error', 'cancelled']);
const NODE_TYPES = new Set(['text', 'image', 'video', 'agentPrompt', 'note']);

export class MokCliError extends Error {
  constructor(message, code = 'MOK_ERROR', status = 1) { super(message); this.code = code; this.status = status; }
}

export function assertLoopbackUrl(value = DEFAULT_API_URL) {
  let url;
  try { url = new URL(value); } catch { throw new MokCliError(`无效的 API 地址：${value}`, 'INVALID_API_URL'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) throw new MokCliError('MO.K CLI 只允许连接本机回环地址（127.0.0.1/localhost/::1）。', 'LOOPBACK_ONLY');
  return url.toString().replace(/\/$/, '');
}

export function parseCliArgs(argv) {
  const positionals = []; const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) { positionals.push(token); continue; }
    const raw = token.slice(2); const equals = raw.indexOf('=');
    if (equals !== -1) { options[raw.slice(0, equals)] = raw.slice(equals + 1); continue; }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { options[raw] = next; i += 1; } else options[raw] = true;
  }
  return { positionals, options };
}

const json = (value) => { try { return JSON.parse(value); } catch { throw new MokCliError(`不是有效的 JSON：${value}`, 'INVALID_JSON'); } };
const required = (options, name) => { const value = options[name]; if (value === undefined || value === true || value === '') throw new MokCliError(`缺少参数 --${name}。`, 'MISSING_OPTION'); return value; };
const numberValue = (value, name, fallback) => { if (value === undefined) return fallback; const result = Number(value); if (!Number.isFinite(result)) throw new MokCliError(`参数 --${name} 必须是数字。`, 'INVALID_NUMBER'); return result; };
const makeId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export function buildNode(type, options = {}) {
  if (!NODE_TYPES.has(type)) throw new MokCliError(`不支持的节点类型：${type}`, 'INVALID_NODE_TYPE');
  const data = { title: options.title || `${type} 节点`, status: 'idle' };
  if (type === 'text') Object.assign(data, { content: options.content || '', contentType: options['content-type'] || 'text' });
  if (type === 'image') Object.assign(data, { prompt: options.prompt || '', model: options.model || 'jimeng-5.0-pro', width: numberValue(options.width, 'width', 1024), height: numberValue(options.height, 'height', 1024), count: numberValue(options.count, 'count', 1), inputImageAssetIds: [] });
  if (type === 'video') Object.assign(data, { prompt: options.prompt || '', model: options.model || 'seedance-2.0-vip', aspectRatio: options['aspect-ratio'] || '16:9', resolution: options.resolution || '720P', count: numberValue(options.count, 'count', 1) });
  if (type === 'agentPrompt') Object.assign(data, { prompt: options.prompt || options.content || '', model: options.model || 'codex:gpt-5.5' });
  if (type === 'note') data.content = options.content || '';
  return { id: options.id || makeId('node'), type, position: { x: numberValue(options.x, 'x', 0), y: numberValue(options.y, 'y', 0) }, data };
}

export function createApiClient({ baseUrl = process.env.MOK_API_URL || DEFAULT_API_URL, fetchImpl = globalThis.fetch } = {}) {
  const apiUrl = assertLoopbackUrl(baseUrl); if (typeof fetchImpl !== 'function') throw new MokCliError('当前 Node 环境没有可用的 fetch。', 'FETCH_UNAVAILABLE');
  return { baseUrl: apiUrl, async request(path, { method = 'GET', body } = {}) {
    const response = await fetchImpl(`${apiUrl}${path}`, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let payload; try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) throw new MokCliError(payload?.message || payload?.error || `API 请求失败（${response.status}）`, payload?.code || 'API_ERROR', response.status);
    return payload;
  } };
}

async function fileJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { throw new MokCliError(`无法读取 JSON 文件：${path}（${error.message}）`, 'INVALID_FILE'); } }
const getFlow = (client, id) => client.request(`/api/flows/${encodeURIComponent(id)}`);
const putFlow = (client, flow, changes) => client.request(`/api/flows/${encodeURIComponent(flow.id)}`, { method: 'PUT', body: { name: changes.name ?? flow.name, nodes: changes.nodes ?? flow.nodes, edges: changes.edges ?? flow.edges } });
async function mutateFlow(client, id, mutate) { const flow = await getFlow(client, id); const result = await mutate({ flow, nodes: [...(flow.nodes || [])], edges: [...(flow.edges || [])] }); const updated = await putFlow(client, flow, result); return { flowId: id, flow: updated, result }; }
async function waitGeneration(client, id, timeout) { const end = Date.now() + timeout; while (Date.now() < end) { const item = await client.request(`/api/generations/${encodeURIComponent(id)}`); if (TERMINAL.has(String(item?.status || '').toLowerCase())) return item; await new Promise((resolve) => setTimeout(resolve, 1000)); } throw new MokCliError(`生成任务等待超时：${id}`, 'GENERATION_TIMEOUT'); }

function help() { return { name: 'mok', brand: '墨K / MO.K', api: DEFAULT_API_URL, commands: ['health', 'flow list|get|create|update|duplicate|delete', 'canvas inspect|nodes|edges', 'node list|add|update|delete', 'edge connect|delete', 'generate image|video|status', 'agent prompt'], security: '仅连接 127.0.0.1/localhost/::1' }; }

export async function executeCli(argv, dependencies = {}) {
  const { positionals, options } = parseCliArgs(argv); if (options.help || !positionals.length) return help();
  const client = createApiClient({ ...dependencies, baseUrl: dependencies.baseUrl || options['base-url'] }); const [group, action, value] = positionals;
  if (group === 'health') return client.request('/api/health');
  if (group === 'flow') {
    if (action === 'list') return client.request('/api/flows');
    if (action === 'get') return getFlow(client, required({ id: value }, 'id'));
    if (action === 'create') return client.request('/api/flows', { method: 'POST', body: { name: options.name || value || '未命名工作流' } });
    const flowId = value || options.flow;
    if (action === 'update') { const body = options.file ? await fileJson(options.file) : json(required(options, 'patch')); return client.request(`/api/flows/${encodeURIComponent(required({ id: flowId }, 'id'))}`, { method: 'PUT', body }); }
    if (action === 'duplicate') return client.request(`/api/flows/${encodeURIComponent(required({ id: flowId }, 'id'))}/duplicate`, { method: 'POST' });
    if (action === 'delete') return client.request(`/api/flows/${encodeURIComponent(required({ id: flowId }, 'id'))}`, { method: 'DELETE' });
  }
  if (group === 'canvas') { const flow = await getFlow(client, required(options, 'flow')); if (action === 'inspect') return flow; if (action === 'nodes') return flow.nodes || []; if (action === 'edges') return flow.edges || []; }
  if (group === 'node') {
    const flowId = required(options, 'flow');
    if (action === 'list') return (await getFlow(client, flowId)).nodes || [];
    if (action === 'add') { const node = buildNode(required(options, 'type'), options); await mutateFlow(client, flowId, ({ nodes }) => ({ nodes: [...nodes, node] })); return node; }
    if (action === 'update') return mutateFlow(client, flowId, ({ nodes }) => { const nodeId = required(options, 'id'); const patch = json(required(options, 'patch')); const index = nodes.findIndex((node) => node.id === nodeId); if (index < 0) throw new MokCliError(`找不到节点：${nodeId}`, 'NODE_NOT_FOUND', 404); nodes[index] = { ...nodes[index], ...patch, data: patch.data ? { ...nodes[index].data, ...patch.data } : nodes[index].data }; return { nodes }; });
    if (action === 'delete') { const nodeId = required(options, 'id'); return mutateFlow(client, flowId, ({ nodes, edges }) => ({ nodes: nodes.filter((node) => node.id !== nodeId), edges: edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) })); }
  }
  if (group === 'edge') {
    const flowId = required(options, 'flow');
    if (action === 'connect') return mutateFlow(client, flowId, ({ nodes, edges }) => { const source = required(options, 'from'); const target = required(options, 'to'); if (!nodes.some((node) => node.id === source) || !nodes.some((node) => node.id === target)) throw new MokCliError('连线两端节点必须存在。', 'NODE_NOT_FOUND', 404); return { edges: [...edges, { id: options.id || makeId('edge'), source, target, ...(options.type ? { type: options.type } : {}) }] }; });
    if (action === 'delete') { const edgeId = required(options, 'id'); return mutateFlow(client, flowId, ({ edges }) => ({ edges: edges.filter((edge) => edge.id !== edgeId) })); }
  }
  if (group === 'generate') {
    if (action === 'status') { const generationId = value || options.id; const item = await client.request(`/api/generations/${encodeURIComponent(required({ id: generationId }, 'id'))}`); return options.wait ? waitGeneration(client, generationId, numberValue(options.timeout, 'timeout', 600000)) : item; }
    if (action === 'image' || action === 'video') { const flowId = required(options, 'flow'); const nodeId = required(options, 'node'); const prompt = positionals.slice(2).join(' ') || options.prompt || ''; const body = action === 'image' ? { flowId, nodeId, mediaType: 'image', prompt, model: options.model || 'jimeng-5.0-pro', width: numberValue(options.width, 'width', 1024), height: numberValue(options.height, 'height', 1024), count: numberValue(options.count, 'count', 1), ...(options['input-images'] ? { inputImages: json(options['input-images']) } : {}) } : { flowId, nodeId, mediaType: 'video', mode: options.mode || 'text_to_video', prompt, inputImages: options['input-images'] ? json(options['input-images']) : [], model: options.model || 'seedance-2.0-vip', aspectRatio: options['aspect-ratio'] || '16:9', resolution: options.resolution || '720P', quality: options.quality || 'standard', durationSeconds: numberValue(options.duration, 'duration', 5), count: numberValue(options.count, 'count', 1), generateAudio: options.audio !== 'false' }; const created = await client.request('/api/generations', { method: 'POST', body }); return options.wait ? waitGeneration(client, created.id, numberValue(options.timeout, 'timeout', 600000)) : created; }
  }
  if (group === 'agent' && action === 'prompt') { const userIdea = positionals.slice(2).join(' ') || options.prompt || ''; if (!userIdea) throw new MokCliError('缺少 Agent 提示词。', 'MISSING_PROMPT'); return client.request('/api/agent/prompt-optimize', { method: 'POST', body: { userIdea, ...(options.flow ? { flowId: options.flow } : {}), ...(options.model ? { model: options.model } : {}), ...(options.role ? { role: options.role } : {}) } }); }
  throw new MokCliError(`未知命令：${positionals.join(' ')}`, 'UNKNOWN_COMMAND');
}

async function main() { const { options } = parseCliArgs(process.argv.slice(2)); try { const result = await executeCli(process.argv.slice(2)); process.stdout.write(`${JSON.stringify({ ok: true, data: result }, null, options.json ? 0 : 2)}\n`); } catch (error) { const payload = { ok: false, error: { code: error.code || 'MOK_ERROR', message: error.message } }; if (options.json) process.stdout.write(`${JSON.stringify(payload)}\n`); else process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`); process.exitCode = error.status && Number.isInteger(error.status) ? error.status : 1; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
