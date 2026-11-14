// Uses the Agent Blockhall MCP tool the way an agent does: starts it, says hello over MCP, lists its tools, and calls each
// one on live Bitcoin data. Writes everything it got back to test/results.json. Run: node test/live.js
'use strict';
const {spawn} = require('child_process');
const path = require('path');
const fs = require('fs');

const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {stdio: ['pipe', 'pipe', 'inherit']});
let buf = '', next = 1;
const waiting = new Map();
server.stdout.setEncoding('utf8');
server.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; const m = JSON.parse(line); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } }
});
const ask = (method, params) => new Promise(res => { const id = next++; waiting.set(id, res); server.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n'); });
const call = async (name, args) => { const t0 = Date.now(); const m = await ask('tools/call', {name, arguments: args}); return {name, args, ms: Date.now() - t0, isError: !!(m.result && m.result.isError), error: m.error || null, out: m.result && (m.result.structuredContent || m.result.content[0].text)}; };

(async () => {
  const results = {when: new Date().toISOString(), node: process.version};
  const init = await ask('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'live-test', version: '1'}});
  results.initialize = init.result;
  server.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  results.tools = (await ask('tools/list')).result.tools.map(t => t.name);
  const calls = [];
  calls.push(await call('about', {}));
  calls.push(await call('chain', {}));
  calls.push(await call('feeAdvice', {}));
  calls.push(await call('block', {height: 840000, limit: 5}));
  calls.push(await call('inscription', {id: '#0'}));
  calls.push(await call('inscription', {id: '#1000'}));
  calls.push(await call('children', {id: '#0'}));
  calls.push(await call('followBack', {id: '#1000'}));
  calls.push(await call('search', {query: '840000'}));
  calls.push(await call('search', {query: '#1000'}));
  calls.push(await call('search', {query: '12.840000.bitmap'}));
  const firstTx = calls.find(c => c.name === 'followBack' && c.out && c.out.steps);
  if (firstTx) calls.push(await call('search', {query: firstTx.out.steps[0].txid}));
  const holder = calls.find(c => c.name === 'inscription' && c.args.id === '#1000' && c.out && c.out.owner);
  if (holder) calls.push(await call('search', {query: holder.out.owner}));
  calls.push(await call('search', {query: 'satoshi.sats'}));
  calls.push(await call('rareSats', {}));
  // the Block Manifest: the halving block's rune etchings, the next page of the same block (no new reading), inscription 0's
  // block, a kind that is not there, a kind it does not know, and the newest block
  calls.push(await call('blockManifest', {height: 840000, kind: 'runes etched', limit: 5}));
  calls.push(await call('blockManifest', {height: 840000, from: 5, limit: 3}));
  calls.push(await call('blockManifest', {height: 767430, kind: 'inscriptions'}));
  calls.push(await call('blockManifest', {height: 767430, kind: 'runes etched'}));
  calls.push(await call('blockManifest', {height: 767430, kind: 'shoes'}));
  const tip = calls.find(c => c.name === 'chain' && c.out && c.out.newestBlock);
  if (tip) calls.push(await call('blockManifest', {height: tip.out.newestBlock - 1, limit: 5}));
  results.manifestChecks = calls.filter(c => c.name === 'blockManifest' && c.out && c.out.checked).map(c => {
    const k = c.out.checked;
    return c.out.block.height + ' (' + c.ms + ' ms): hash ' + k.blockHash.fromItsOwnBytes + '/' + (k.blockHash.secondSite && k.blockHash.secondSite.agrees) + ', ids ' + k.transactions.matched + '/' + k.transactions.of +
      ', sizes ' + k.sizes.matched + '/' + k.sizes.of + ', kinds ' + (k.kinds ? k.kinds.agreed + '/' + k.kinds.of : '-') + ', inscriptions ' + (k.inscriptions ? k.inscriptions.agreed + '/' + k.inscriptions.of : '-') +
      (k.runesEtched ? ', etched ' + k.runesEtched.made + '/' + k.runesEtched.tried : '') + ', differences ' + k.differences.length + ', items ' + c.out.items.kind + ' ' + c.out.items.list.length + '/' + c.out.items.total + ', sources ' + JSON.stringify(c.out.sources);
  });
  results.calls = calls;
  results.summary = calls.map(c => c.name + ' ' + JSON.stringify(c.args) + ': ' + (c.error ? 'PROTOCOL ERROR ' + c.error.message : c.isError ? 'ERROR ' + c.out : 'ok') + ' (' + c.ms + ' ms)');
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 1));
  console.log(results.summary.join('\n'));
  if (results.manifestChecks.length) console.log('Block Manifest checks:\n' + results.manifestChecks.join('\n'));
  server.kill();
  process.exit(0);
})().catch(e => { console.error(e); server.kill(); process.exit(1); });
