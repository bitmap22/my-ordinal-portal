// Checks how the Agent Blockhall MCP tool speaks MCP, without the network: the newest version (2026-07-28, no handshake,
// server/discover, _meta on every request), the older handshake versions, MCP Apps (the view), Tasks and Skills over MCP.
// Run: node agent-blockhall-mcp/test/protocol.js
'use strict';
const {spawn} = require('child_process');
const path = require('path'), crypto = require('crypto'), fs = require('fs');
const start = env => {
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {stdio: ['pipe', 'pipe', 'inherit'], env: Object.assign({}, process.env, env)});
  let buf = ''; const waiting = new Map(), notes = [];
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
    const m = JSON.parse(line); if (m.id != null && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } else notes.push(m); } });
  let n = 1;
  const ask = (method, params, id) => new Promise(res => { const k = id != null ? id : n++; waiting.set(k, res); p.stdin.write(JSON.stringify({jsonrpc: '2.0', id: k, method, params}) + '\n'); });
  const tell = (method, params) => p.stdin.write(JSON.stringify({jsonrpc: '2.0', method, params}) + '\n');
  return {p, ask, tell, notes};
};
const V = '2026-07-28', K = k => 'io.modelcontextprotocol/' + k;
const meta = (ext, extra) => ({_meta: Object.assign({[K('protocolVersion')]: V, [K('clientInfo')]: {name: 'protocol-test', version: '1'}, [K('clientCapabilities')]: ext ? {extensions: ext} : {}}, extra || {})});
let bad = 0; const ok = (cond, what) => { console.log((cond ? 'PASS ' : 'FAIL ') + what); if (!cond) bad++; };
(async () => {
  const s = start({AGENT_BLOCKHALL_TASK_WAIT_MS: '0'});
  // the newest version
  const d = await s.ask('server/discover', meta());
  ok(d.result && d.result.resultType === 'complete' && d.result.supportedVersions[0] === V && d.result.ttlMs > 0 && d.result.cacheScope === 'public', 'server/discover: versions, cache hints');
  ok(d.result.capabilities.extensions[K('tasks')] && d.result.capabilities.extensions[K('skills')] && d.result.capabilities.resources, 'server/discover: tasks, skills and resources');
  ok(d.result._meta[K('serverInfo')].name === 'agent-blockhall', 'server/discover: serverInfo in _meta');
  const old = await s.ask('tools/list', {_meta: {[K('protocolVersion')]: '1900-01-01', [K('clientCapabilities')]: {}}});
  ok(old.error && old.error.code === -32022 && old.error.data.supported.includes(V) && old.error.data.requested === '1900-01-01', 'unknown version: UnsupportedProtocolVersion (-32022) with the list');
  const nocaps = await s.ask('tools/list', {_meta: {[K('protocolVersion')]: V}});
  ok(nocaps.error && nocaps.error.code === -32602, 'no clientCapabilities: Invalid params (-32602)');
  const tl = await s.ask('tools/list', meta());
  const tools = tl.result.tools;
  ok(tl.result.resultType === 'complete' && tl.result.ttlMs > 0 && tools.length > 25, 'tools/list: ' + tools.length + ' tools, cacheable');
  const pv = tools.find(t => t.name === 'provenanceCheck');
  ok(pv._meta && pv._meta.ui && pv._meta.ui.resourceUri === 'ui://agent-blockhall/view', 'tools/list: provenanceCheck shows in the view (MCP Apps)');
  ok(!tools.find(t => t.name === 'about')._meta, 'tools/list: about has no view');
  const rl = await s.ask('resources/list', meta());
  ok(rl.result.resources.some(r => r.uri === 'ui://agent-blockhall/view' && r.mimeType === 'text/html;profile=mcp-app'), 'resources/list: the view');
  const rv = await s.ask('resources/read', Object.assign({uri: 'ui://agent-blockhall/view'}, meta()));
  const html = rv.result && rv.result.contents[0].text;
  ok(rv.result.resultType === 'complete' && /^<!DOCTYPE html>/i.test(html) && rv.result.contents[0].mimeType === 'text/html;profile=mcp-app', 'resources/read: the view is an HTML5 page');
  ok(!/\bfetch\(|XMLHttpRequest|WebSocket|<iframe|eval\(|new Function/.test(html), 'the view fetches nothing, opens no frames and runs no code from text');
  const rx = await s.ask('resources/read', Object.assign({uri: 'ui://nothing'}, meta()));
  ok(rx.error && rx.error.code === -32602, 'resources/read of nothing: -32602');
  // Skills over MCP
  const sl = await s.ask('skills/list', meta());
  const sk = sl.result && sl.result.skills[0];
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'skills', 'ord-portal', 'SKILL.md'));
  ok(sk && sk.uri === 'skill://ord-portal/SKILL.md' && sk.frontmatter.name === 'ord-portal' && sk.frontmatter.metadata.author === 'bitmap22', 'skills/list: ord-portal with its frontmatter');
  ok(sk.resources[0].digest === 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex') && sk.resources[0].size === bytes.length, 'skills/list: digest and size match the file');
  const sr = await s.ask('resources/read', Object.assign({uri: 'skill://ord-portal/SKILL.md'}, meta()));
  ok(Buffer.from(sr.result.contents[0].text, 'utf8').equals(bytes), 'resources/read: SKILL.md, byte for byte');
  const sg = await s.ask('skills/get', Object.assign({uri: 'skill://nope/SKILL.md'}, meta()));
  ok(sg.error && sg.error.code === -32602, 'skills/get of an unknown skill: -32602');
  // Tasks: with the extension a slow call answers with a task (the test makes every call count as slow)
  const plain = await s.ask('tools/call', Object.assign({name: 'about', arguments: {}}, meta()));
  ok(plain.result && plain.result.resultType === 'complete' && plain.result.content, 'tools/call without the tasks extension: a plain answer');
  const tk = await s.ask('tools/call', Object.assign({name: 'chain', arguments: {}}, meta({[K('tasks')]: {}})));
  ok(tk.result && tk.result.resultType === 'task' && tk.result.status === 'working' && tk.result.taskId.length > 40 && tk.result.pollIntervalMs > 0, 'tools/call with tasks: CreateTaskResult');
  let g; for (let i = 0; i < 120; i++) { g = await s.ask('tasks/get', Object.assign({taskId: tk.result.taskId}, meta({[K('tasks')]: {}}))); if (g.result && g.result.status !== 'working') break; await new Promise(r => setTimeout(r, 500)); }
  ok(g.result && g.result.resultType === 'complete' && g.result.status === 'completed' && g.result.result && g.result.result.content, 'tasks/get: completed, with the tool\'s answer');
  const g2 = await s.ask('tasks/get', Object.assign({taskId: tk.result.taskId}, meta()));
  ok(g2.error && g2.error.code === -32021, 'tasks/get without the extension: -32021');
  const g3 = await s.ask('tasks/get', Object.assign({taskId: 'nope'}, meta({[K('tasks')]: {}})));
  ok(g3.error && g3.error.code === -32602, 'tasks/get of an unknown task: -32602');
  const tk2 = await s.ask('tools/call', Object.assign({name: 'chain', arguments: {}}, meta({[K('tasks')]: {}})));
  const c = await s.ask('tasks/cancel', Object.assign({taskId: tk2.result.taskId}, meta({[K('tasks')]: {}})));
  const g4 = await s.ask('tasks/get', Object.assign({taskId: tk2.result.taskId}, meta({[K('tasks')]: {}})));
  ok(c.result && c.result.resultType === 'complete' && ['cancelled', 'completed'].includes(g4.result.status), 'tasks/cancel: acknowledged (' + g4.result.status + ')');
  // subscriptions/listen: acknowledged with nothing to send, ended by cancelling
  const lid = 9001; s.ask('subscriptions/listen', Object.assign({notifications: {toolsListChanged: true}}, meta()), lid);
  await new Promise(r => setTimeout(r, 300));
  const ack = s.notes.find(x => x.method === 'notifications/subscriptions/acknowledged');
  ok(ack && ack.params._meta[K('subscriptionId')] === lid && Object.keys(ack.params.notifications).length === 0, 'subscriptions/listen: acknowledged (nothing changes here)');
  s.tell('notifications/cancelled', {requestId: lid});
  const pg = await s.ask('ping', meta());
  ok(pg.error && pg.error.code === -32601, 'ping in 2026-07-28: Method not found (removed)');
  s.p.kill();
  // the older versions, as before
  const o = start({});
  const init = await o.ask('initialize', {protocolVersion: '2025-11-25', capabilities: {extensions: {[K('ui')]: {mimeTypes: ['text/html;profile=mcp-app']}}}, clientInfo: {name: 'old', version: '1'}});
  ok(init.result && init.result.protocolVersion === '2025-11-25' && init.result.capabilities.resources && init.result.serverInfo.version, 'initialize (2025-11-25): as before, with resources');
  o.tell('notifications/initialized', {});
  const otl = await o.ask('tools/list', {});
  ok(otl.result.tools.length === tools.length && !('resultType' in otl.result), 'tools/list (2025-11-25): the same tools');
  const orr = await o.ask('resources/read', {uri: 'ui://agent-blockhall/view'});
  ok(orr.result && orr.result.contents[0].text === html, 'resources/read (2025-11-25): the same view');
  const onf = await o.ask('resources/read', {uri: 'ui://nothing'});
  ok(onf.error && onf.error.code === -32002, 'resources/read of nothing (2025-11-25): -32002, as that version says');
  const op = await o.ask('ping', {});
  ok(op.result && !op.error, 'ping (2025-11-25): answered');
  const oc = await o.ask('tools/call', {name: 'about', arguments: {}});
  ok(oc.result && oc.result.structuredContent && oc.result.structuredContent.name === 'Agent Blockhall', 'tools/call (2025-11-25): about');
  const od = await o.ask('server/discover', {});
  ok(od.error && od.error.code === -32602, 'server/discover without its version: an error the old way');
  o.p.kill();
  console.log(bad ? bad + ' failed' : 'All protocol checks passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
