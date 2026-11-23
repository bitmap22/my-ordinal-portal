'use strict';
const {spawn} = require('child_process'), path = require('path');
const server = spawn(process.execPath, [path.join(process.cwd(), 'agent-blockhall-mcp', 'server', 'index.js')], {stdio: ['pipe', 'pipe', 'inherit']});
let buf = '', next = 1; const waiting = new Map(); server.stdout.setEncoding('utf8');
server.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; const m = JSON.parse(l); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } } });
const ask = (method, params) => new Promise(res => { const id = next++; waiting.set(id, res); server.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n'); });
(async () => {
  // the back-up path on its own: ordiscan's page for a number, every ID on it, kept only when an ord record gives that number
  const UA = {headers: {'User-Agent': 'agent-blockhall-mcp/test (+https://ordportal.com/block-cube.html)'}};
  for (const n of [0, 1000, 126744012, 127512326]) for (const b of ['https://ordiscan.com', 'https://ord.xverse.app']) {
    try { const h = await (await fetch(b + '/inscription/' + n, UA)).text(); const ids = [...new Set(h.match(/[0-9a-f]{64}i\d{1,7}/g) || [])].slice(0, 6); let ok = null;
      for (const id of ids) { const j = await (await fetch('https://ord.xverse.app/r/inscription/' + id, UA)).json().catch(() => null); if (j && +j.number === n) { ok = id; break; } }
      console.log('BACKUP', b, '#' + n, 'ids on page', ids.length, 'confirmed', ok); } catch (e) { console.log('BACKUP', b, '#' + n, 'ERR', String(e).slice(0, 60)); }
  }
  await ask('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 't', version: '1'}});
  server.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  const calls = [['price', {}], ['price', {chain: 'doge'}], ['price', {date: '2026-11-01'}], ['price', {chain: 'doge', date: '2026-11-01'}], ['inscriptionCost', {bytes: 100000}], ['inscriptionCost', {bytes: 400000, feeRate: '2.5', currency: 'GBP'}], ['hallVisits', {}], ['hallVisits', {day: '2026-11-22', hall: 'btc'}], ['bitmapClaims', {number: '950000'}], ['bitmapClaims', {number: '977246.bitmap'}], ['bitmapClaims', {recent: 3}], ['bitmapClaims', {number: '840000'}],
    ['inscription', {id: '#0'}], ['provenanceCheck', {id: '#126744012'}], ['codeRead', {id: '#127512326'}], ['recursionMap', {id: '#127512326'}], ['authenticityCheck', {id: '#0'}], ['collectionCheck', {parent: '#126744012'}]];
  for (const [n, a] of calls) {
    const t0 = Date.now(), m = await ask('tools/call', {name: n, arguments: a});
    const txt = (m.result && m.result.content && m.result.content[0] && m.result.content[0].text) || JSON.stringify(m.error);
    console.log((m.result && m.result.isError ? 'ERROR ' : 'ok    ') + n.padEnd(18) + String(Date.now() - t0).padStart(7) + ' ms  ' + JSON.stringify(a) + '  ' + txt.replace(/\s+/g, ' ').slice(0, 300));
  }
  server.kill(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
