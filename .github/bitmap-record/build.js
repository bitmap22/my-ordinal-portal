/* Agent Blockhall's Bitmap Record, by bitmap22. Always free.
   Bop's on-chain index (OCI) says which inscription is the real claim of every block up to 941,999. For blocks from 942,000 there is
   no index, so this keeps one: it reads every Bitcoin block from 942,000 on and writes down every bitmap claim of a block from
   942,000 on, by bop's rules (the body exactly "N.bitmap" with no leading zero, no compression, no delegate, made in block N or
   later). For each number, the first claim (in Bitcoin order: block, transaction, input, envelope) is the real one; every later
   claim of the same number is listed with it, as a copy. Run by GitHub (the Bitmap Record workflow) a stretch of blocks at a
   time until it reaches the newest block, then it keeps up. Usage: node build.js <data folder> [minutes]
   © 2026 bitmap22. All rights reserved. */
'use strict';
const fs = require('fs'), path = require('path');
const BM = require(path.join(__dirname, '..', '..', 'agent-blockhall-mcp', 'server', 'manifest.js'));
const VERSION = '1.0.0', UA = 'agent-blockhall-mcp/bitmap-record-' + VERSION, FROM = 942000, SAFE = 6;
const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (https://github.com/bitmap22/my-ordinal-portal)';

/* ---------- being gentle with the sites (the same way as Daily Data): 6 a second per site, rest any site that asks ---------- */
const MIRRORS = ['https://mempool.space', 'https://ordpool.space', 'https://mempool.emzy.de', 'https://mempool.ninja', 'https://mempool.fra.mempool.space', 'https://mempool.bitaroo.net', 'https://blockstream.info'];
const PACE = {rate: 6, burst: 30, rest: 30}, sites = new Map();
const site = h => { let b = sites.get(h); if (!b) sites.set(h, b = {tok: PACE.burst, t: Date.now(), restUntil: 0}); return b; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function paceWait(host) { const b = site(host); for (;;) { const now = Date.now(); b.tok = Math.min(PACE.burst, b.tok + (now - b.t) / 1000 * PACE.rate); b.t = now; if (b.tok >= 1) { b.tok -= 1; return; } await sleep(Math.ceil((1 - b.tok) / PACE.rate * 1000)); } }
async function fetchT(url, ms) {
  const host = new URL(url).host, b = site(host);
  if (b.restUntil > Date.now()) throw new Error('resting ' + host);
  await paceWait(host);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 20000);
  let r;
  try { r = await fetch(url, {signal: ctl.signal, headers: {'User-Agent': UA}}); } catch (e) { b.restUntil = Date.now() + PACE.rest * 1000; throw new Error('no answer from ' + host); } finally { clearTimeout(timer); }
  if (r.status === 429 || r.status === 503) { b.restUntil = Date.now() + (+r.headers.get('retry-after') || PACE.rest) * 1000; throw new Error('http ' + r.status + ' from ' + host); }
  if (!r.ok) throw new Error('http ' + r.status + ' from ' + host);
  return r;
}
let at = 0;
async function mp(p, ms) {
  let err = null;
  for (let round = 0; round < 3; round++) {
    for (let k = 0; k < MIRRORS.length; k++) { const i = (at + k) % MIRRORS.length; try { const r = await fetchT(MIRRORS[i] + p, ms); at = i; return r; } catch (e) { err = e; } }
    await sleep(20000);
  }
  throw err || new Error('no site answered');
}

/* ---------- one block's bitmap claims ---------- */
async function claimsOf(h) {
  const hash = (await (await mp('/api/block-height/' + h, 20000)).text()).trim();
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('no hash for block ' + h);
  const X = new Uint8Array(await (await mp('/api/block/' + hash + '/raw', 120000)).arrayBuffer());
  const found = [], U8 = new TextDecoder('utf-8');
  const scan = BM.scanBlock(X, h, {onBody: (t, idx, ty, body, enc) => {
    if (enc) return;
    let n = 0; for (const b of body) n += b.length; if (n > 24) return;
    const m = /^(0|[1-9][0-9]{0,15})\.bitmap$/.exec(U8.decode(Buffer.concat(body.map(b => Buffer.from(b)))));
    if (m && +m[1] >= FROM && +m[1] <= h) found.push({t, idx, n: +m[1]});
  }});
  if (scan.hash !== hash) throw new Error('block ' + h + ': its bytes do not match its hash');
  return found.filter(c => { const r = scan.txs[c.t], i = r && r.ins.find(x => x.index === c.idx); return r && !(i && i.delegate); })
    .map(c => ({n: c.n, id: scan.txs[c.t].txid + 'i' + c.idx, block: h}));
}

(async () => {
  const dir = process.argv[2], minutes = +(process.argv[3] || 50);
  if (!dir) throw new Error('usage: node build.js <data folder> [minutes]');
  const file = path.join(dir, 'record.json'), stop = Date.now() + minutes * 60000;
  let R = null; try { R = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  if (!R) R = {record: 'Agent Blockhall Bitmap Record ' + VERSION, from: FROM, upTo: FROM - 1, claims: {}};
  const tip = +(await (await mp('/api/blocks/tip/height', 20000)).text()), end = tip - SAFE;   // (the newest few blocks wait: they could still change)
  const save = () => {
    const nums = Object.keys(R.claims), multi = nums.filter(k => R.claims[k].length > 1);
    R.about = 'Every bitmap claim of a block from ' + FROM.toLocaleString('en-US') + ' on, read from every block from ' + FROM.toLocaleString('en-US') + ' to ' + R.upTo.toLocaleString('en-US') + ' by bop\'s rules: the body exactly "N.bitmap", no leading zero, no compression, no delegate, made in block N or later. claims[N][0] is the real claim (the first, in Bitcoin order); the rest are later copies. Below 942,000 bop\'s on-chain index says which claim is real.';
    R.counts = {numbersClaimed: nums.length, claimedMoreThanOnce: multi.length, copies: multi.reduce((a, k) => a + R.claims[k].length - 1, 0)};
    R.updated = new Date().toISOString().replace(/\.\d+Z$/, 'Z'); R.licence = LICENCE;
    fs.writeFileSync(file + '.tmp', JSON.stringify(R)); fs.renameSync(file + '.tmp', file);
  };
  let n = 0;
  for (let h = R.upTo + 1; h <= end && Date.now() < stop; h++) {
    let got = null;
    for (let a = 0; a < 6 && !got; a++) { try { got = await claimsOf(h); } catch (e) { console.log('  block ' + h + ': ' + e.message + ' (trying again)'); await sleep(15000 * (a + 1)); } }
    if (!got) { console.log('block ' + h + ' could not be read: stopping here, the next run starts again from it'); break; }
    for (const c of got) (R.claims[c.n] = R.claims[c.n] || []).push({id: c.id, block: c.block});
    R.upTo = h; n++;
    if (n % 200 === 0) { save(); console.log('read up to block ' + h + ' (' + (end - h) + ' to go)'); }
  }
  save();
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'behind=' + Math.max(0, end - R.upTo) + '\n');   // (how many blocks it still has to read: the next step starts another run straight away if it is behind)
  console.log('Bitmap Record: read ' + n + ' blocks this run, up to block ' + R.upTo + ' of ' + end + '; ' + R.counts.numbersClaimed + ' numbers claimed, ' + R.counts.claimedMoreThanOnce + ' of them more than once');
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
