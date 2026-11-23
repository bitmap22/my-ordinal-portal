'use strict';
const {spawn} = require('child_process'), path = require('path');
const server = spawn(process.execPath, [path.join(process.cwd(), 'agent-blockhall-mcp', 'server', 'index.js')], {stdio: ['pipe', 'pipe', 'inherit']});
let buf = '', next = 1; const waiting = new Map(); server.stdout.setEncoding('utf8');
server.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; const m = JSON.parse(l); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } } });
const ask = (method, params) => new Promise(res => { const id = next++; waiting.set(id, res); server.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n'); });
(async () => {
  // the back-up path on its own: ordiscan's page for a number, every ID on it, kept only when an ord record gives that number
  const UA = {headers: {'User-Agent': 'agent-blockhall-mcp/test (+https://ordportal.com/block-cube.html)'}};
  await ask('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 't', version: '1'}});
  server.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  const calls = [['authenticityCheck', {id: '#0'}], ['authenticityCheck', {id: '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0'}]]; const _x = [['price', {}], ['price', {chain: 'doge'}], ['price', {date: '2026-11-01'}], ['price', {chain: 'doge', date: '2026-11-01'}], ['inscriptionCost', {bytes: 100000}], ['inscriptionCost', {bytes: 400000, feeRate: '2.5', currency: 'GBP'}], ['hallVisits', {}], ['hallVisits', {day: '2026-11-22', hall: 'btc'}], ['bitmapClaims', {number: '950000'}], ['bitmapClaims', {number: '977246.bitmap'}], ['bitmapClaims', {recent: 3}], ['bitmapClaims', {number: '840000'}],
    ['inscription', {id: '#0'}], ['provenanceCheck', {id: '#126744012'}], ['codeRead', {id: '#127512326'}], ['recursionMap', {id: '#127512326'}], ['authenticityCheck', {id: '#0'}], ['collectionCheck', {parent: '#126744012'}]];
  for (const [n, a] of calls) {
    const t0 = Date.now(), m = await ask('tools/call', {name: n, arguments: a});
    const txt = (m.result && m.result.content && m.result.content[0] && m.result.content[0].text) || JSON.stringify(m.error);
    console.log((m.result && m.result.isError ? 'ERROR ' : 'ok    ') + n.padEnd(18) + String(Date.now() - t0).padStart(7) + ' ms  ' + JSON.stringify(a) + '  ' + txt.replace(/\s+/g, ' ').slice(0, 3000));
  }
  server.kill(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
