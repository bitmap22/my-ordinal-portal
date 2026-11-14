/* Agent Blockhall's Daily Data, by bitmap22. Always free.
   Run once a night by GitHub (the Daily Data workflow): it reads every Bitcoin block of one UTC day the Block Manifest way
   (agent-blockhall-mcp/server/manifest.js: every transaction sorted into the halls' kinds, every one checked) and writes the
   day as one JSON file and one CSV file, plus an index of all the days. Usage: node build-day.js [YYYY-MM-DD] <data folder>
   (the day defaults to yesterday, UTC). It asks the free public sites gently, the same way as Agent Blockhall and its tool.
   © 2026 bitmap22. All rights reserved. */
'use strict';
const fs = require('fs'), path = require('path');
const BM = require(path.join(__dirname, '..', '..', 'agent-blockhall-mcp', 'server', 'manifest.js'));
const VERSION = '1.0.0', UA = 'agent-blockhall-mcp/daily-' + VERSION;
const PORTAL = 'https://bitmap22.github.io/my-ordinal-portal/', RAW = 'https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/daily-data/';
const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (' + 'https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE' + '). Bitcoin’s own data is public.';

/* ---------- being gentle with the sites: at most 30 at once, then 6 a second per site; rest any site that asks ---------- */
const MIRRORS = ['https://mempool.space', 'https://ordpool.space', 'https://mempool.emzy.de', 'https://mempool.ninja', 'https://mempool.fra.mempool.space', 'https://mempool.bitaroo.net', 'https://blockstream.info'];
const MIRROR_V1 = 5;
const ORD_R = ['https://ordinals.com', 'https://static.unisat.io', 'https://ordiscan.com', 'https://ordinalswallet.com', 'https://ord.xverse.app'];
const ORD_LIST = 'https://ordinals.com';
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
let mpAt = 0;
async function mpFetch(p, ms) {
  const n = p.startsWith('/api/v1/') ? MIRROR_V1 : MIRRORS.length, order = [mpAt];
  for (let i = 0; i < n; i++) if (!order.includes(i)) order.push(i);
  let err = null;
  for (let round = 0; round < 3; round++) {
    for (const i of order) { if (i >= n) continue; try { const r = await fetchT(MIRRORS[i] + p, ms); mpAt = i; return {r, site: MIRRORS[i]}; } catch (e) { err = e; if (/http 404/.test(String(e))) throw e; } }
    await sleep(20000);   // (every site was busy: wait and try them all again)
  }
  throw err || new Error('no site answered');
}
const mpJson = async (p, ms) => { const x = await mpFetch(p, ms); return {j: await x.r.json(), site: x.site}; };
async function ordFetch(p, ms, list) {
  let err = null;
  for (const b of list || ORD_R) { try { return {r: await fetchT(b + p, ms), site: b}; } catch (e) { err = e; if (b === (list || ORD_R)[0] && /http 404/.test(String(e))) break; } }
  throw err || new Error('no site answered');
}

/* ---------- one block, read the Block Manifest way ---------- */
async function readBlock(h, hash) {
  const rawBlock = async () => {
    try { const {r, site} = await mpFetch('/api/block/' + hash + '/raw', 120000); return {bytes: new Uint8Array(await r.arrayBuffer()), site}; } catch (e) {}
    const {r, site} = await ordFetch('/r/block/' + h, 120000); let t = (await r.text()).trim(); if (t[0] === '"') t = t.slice(1, -1);
    if (!/^[0-9a-f]{160}/i.test(t)) throw new Error('no site gave the block’s bytes');
    const u = new Uint8Array(t.length >> 1); for (let i = 0; i < u.length; i++) u[i] = parseInt(t.substr(i * 2, 2), 16); return {bytes: u, site};
  };
  const ids = async () => { const S = new Set(); for (let p = 0; p < 400; p++) { const {r} = await ordFetch('/inscriptions/block/' + h + (p ? '/' + p : ''), 30000, [ORD_LIST]); const html = await r.text(); for (const m of html.matchAll(/\/inscription\/([0-9a-f]{64}i\d+)/g)) S.add(m[1]); if (!html.includes('/inscriptions/block/' + h + '/' + (p + 1))) break; } return [...S]; };
  const [raw, sum, tags, second, list] = await Promise.allSettled([rawBlock(),
    mpFetch('/api/v1/block/' + hash + '/summary', 120000).then(async x => ({list: BM.readSummary(await x.r.text()), site: x.site})),
    fetchT('https://ordpool.space/api/v1/block/' + hash + '/summary', 120000).then(async r => BM.readSummary(await r.text())),
    ordFetch('/r/blockhash/' + h, 20000).then(async x => ({hash: (await x.r.text()).trim().replace(/^"|"$/g, ''), site: x.site})), ids()]);
  if (raw.status !== 'fulfilled') throw new Error('its bytes could not be had: ' + (raw.reason && raw.reason.message));
  if (sum.status !== 'fulfilled') throw new Error('its transaction list could not be had: ' + (sum.reason && sum.reason.message));
  const scan = BM.scanBlock(raw.value.bytes, h);
  let runesHtml = null; if (scan.txs.some(t => t.rune && t.rune.etched)) try { runesHtml = await (await ordFetch('/block/' + h, 45000, [ORD_LIST])).r.text(); } catch (e) {}
  return BM.buildManifest({height: h, time: null, scan, rawSite: raw.value.site, hash, hashSite: 'https://mempool.space',
    secondHash: second.status === 'fulfilled' ? second.value.hash : null, secondSite: second.status === 'fulfilled' ? second.value.site : null,
    summary: sum.value.list, summarySite: sum.value.site, tags: tags.status === 'fulfilled' ? tags.value : null, tagSite: 'https://ordpool.space',
    ordIds: list.status === 'fulfilled' ? list.value : null, ordSite: ORD_LIST, runesHtml});
}

/* ---------- the blocks of one UTC day (by the time written in each block) ---------- */
async function blockAt(ts) { return (await mpJson('/api/v1/mining/blocks/timestamp/' + ts, 20000)).j; }
async function blocksOfDay(t0, t1) {
  const lo = await blockAt(t0 - 7200), hi = await blockAt(Math.min(t1 + 7200, Math.floor(Date.now() / 1000)));
  const out = new Map();
  for (let h = hi.height; h >= lo.height; ) {
    const list = (await mpJson('/api/v1/blocks/' + h, 20000)).j;
    if (!list.length) break;
    for (const b of list) if (b.timestamp >= t0 && b.timestamp < t1) out.set(b.height, b);
    h = list[list.length - 1].height - 1;
  }
  return [...out.values()].sort((a, b) => a.height - b.height);
}

/* ---------- the day ---------- */
const sumInto = (T, o) => { for (const [k, v] of Object.entries(o || {})) T[k] = (T[k] || 0) + v; };
async function main() {
  const dayArg = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : null;
  const out = process.argv[dayArg ? 3 : 2] || process.argv[3] || 'data';
  const day = dayArg || new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const t0 = Date.parse(day + 'T00:00:00Z') / 1000, t1 = t0 + 86400;
  if (t1 > Date.now() / 1000) throw new Error(day + ' has not finished yet (UTC)');
  console.log('Daily Data for ' + day);
  const list = await blocksOfDay(t0, t1);
  console.log(list.length + ' blocks: ' + (list.length ? list[0].height + ' to ' + list[list.length - 1].height : 'none'));
  const blocks = [], T = {transactions: 0, totalFees: 0, counts: {}, pools: {}, checked: {hashFromItsBytes: 0, secondSiteAgrees: 0, secondSiteAsked: 0, ids: [0, 0], sizes: [0, 0], kinds: [0, 0], inscriptions: [0, 0], inscriptionsListed: 0, runesEtched: [0, 0], differences: 0, notRead: 0,
    secondSiteNotAsked: 0, kindsNotChecked: 0, inscriptionsNotChecked: 0, runesEtchedNotChecked: 0}};
  for (const b of list) {
    let M = null, err = null;
    for (let tries = 0; tries < 3 && !M; tries++) { try { M = await readBlock(b.height, b.id); } catch (e) { err = e; await sleep(15000); } }
    const pool = b.extras && b.extras.pool ? b.extras.pool.name : null;
    if (!M) { console.log('  ' + b.height + ': not read (' + (err && err.message) + ')'); T.checked.notRead++; blocks.push({height: b.height, hash: b.id, time: new Date(b.timestamp * 1000).toISOString().replace('.000', ''), minedBy: pool, notRead: String(err && err.message || err)}); continue; }
    const C = M.checked;
    const rec = {height: b.height, bitmap: b.height + '.bitmap', hash: b.id, time: new Date(b.timestamp * 1000).toISOString().replace('.000', ''), minedBy: pool || M.block.minedBy,
      transactions: M.block.transactions, totalFees: M.block.totalFees, counts: M.counts,
      checked: {hashFromItsBytes: C.blockHash.fromItsOwnBytes, secondSite: C.blockHash.secondSite, ids: [C.transactions.matched, C.transactions.of], sizes: [C.sizes.matched, C.sizes.of],
        kinds: C.kinds.agreed != null ? [C.kinds.agreed, C.kinds.of] : null, inscriptions: C.inscriptions.agreed != null ? [C.inscriptions.agreed, C.inscriptions.of, C.inscriptions.listed] : null,
        runesEtched: C.runesEtched ? [C.runesEtched.made, C.runesEtched.tried] : null, differences: C.differences.length},
      sources: M.sources, blockManifest: PORTAL + 'block-manifest.html?block=' + b.height};
    blocks.push(rec);
    T.transactions += rec.transactions; T.totalFees += rec.totalFees; sumInto(T.counts, rec.counts); if (rec.minedBy) T.pools[rec.minedBy] = (T.pools[rec.minedBy] || 0) + 1;
    const K = T.checked; if (rec.checked.hashFromItsBytes) K.hashFromItsBytes++; if (rec.checked.secondSite) { K.secondSiteAsked++; if (rec.checked.secondSite.agrees) K.secondSiteAgrees++; }
    for (const k of ['ids', 'sizes', 'kinds', 'inscriptions', 'runesEtched']) if (rec.checked[k] && rec.checked[k][0] != null) { K[k][0] += rec.checked[k][0]; K[k][1] += rec.checked[k][1]; }
    if (rec.checked.inscriptions) K.inscriptionsListed += rec.checked.inscriptions[2];
    K.differences += rec.checked.differences;
    // (where a site did not answer, that check was not made: counted, so a reader never takes it for "0 of 0")
    if (!rec.checked.secondSite) K.secondSiteNotAsked++;
    if (!rec.checked.kinds) K.kindsNotChecked++;
    if (!rec.checked.inscriptions && (rec.counts.inscriptions || 0) > 0) K.inscriptionsNotChecked++;
    if (rec.checked.runesEtched && rec.checked.runesEtched[0] == null) K.runesEtchedNotChecked++;
    console.log('  ' + b.height + ': ' + rec.transactions + ' txs, ids ' + rec.checked.ids.join('/') + ', kinds ' + (rec.checked.kinds || ['-']).join('/') + ', inscriptions ' + (rec.checked.inscriptions || ['-']).slice(0, 2).join('/') + ', differences ' + rec.checked.differences);
  }
  // plain words for every check that could not be made, and pairs that were never filled set to null
  const K = T.checked, notes = [];
  if (K.notRead) notes.push(K.notRead + ' block' + (K.notRead === 1 ? ' was' : 's were') + ' not read at all (no site gave its bytes or transaction list): see notRead on each.');
  if (K.secondSiteNotAsked) notes.push('For ' + K.secondSiteNotAsked + ' block' + (K.secondSiteNotAsked === 1 ? '' : 's') + ', no second site answered, so the hash was only checked against its own bytes.');
  if (K.kindsNotChecked) notes.push('For ' + K.kindsNotChecked + ' block' + (K.kindsNotChecked === 1 ? '' : 's') + ', ordpool.space did not answer, so their kinds were read once and not checked (null on those blocks).');
  if (K.inscriptionsNotChecked) notes.push('For ' + K.inscriptionsNotChecked + ' block' + (K.inscriptionsNotChecked === 1 ? '' : 's') + ' with inscriptions, ordinals.com did not answer, so their inscriptions were not checked (null on those blocks). It was not a disagreement.');
  if (K.runesEtchedNotChecked) notes.push('For ' + K.runesEtchedNotChecked + ' block' + (K.runesEtchedNotChecked === 1 ? '' : 's') + ', ordinals.com did not say which runes were made, so etchings were not checked.');
  if (K.differences) notes.push(K.differences + ' difference' + (K.differences === 1 ? '' : 's') + ' between this reader and the second sites across the day: open a block in the Block Manifest to see each one.');
  for (const k of ['kinds', 'inscriptions', 'runesEtched']) if (K[k] && K[k][1] === 0) K[k] = null;   // (nothing was checked: null, not [0, 0])
  if (!notes.length) notes.push('Every block was read and every check was made.');
  T.notes = notes;
  const file = {
    data: 'Agent Blockhall Daily Data ' + VERSION, day, utc: {from: new Date(t0 * 1000).toISOString().replace('.000', ''), to: new Date(t1 * 1000).toISOString().replace('.000', '')},
    made: new Date().toISOString().replace(/\.\d{3}/, ''), licence: LICENCE,
    what: 'Every Bitcoin block whose time falls in this UTC day, read the Block Manifest way: each block’s transactions sorted into Agent Blockhall’s hall kinds (counts), its fees and who mined it, and its checks: its hash worked out from its own bytes and asked of a second site, each transaction’s id and size worked out from the bytes against mempool.space’s list, its kinds against ordpool.space’s tags, its inscriptions against ordinals.com’s list, and rune etchings against the runes ordinals.com says the block made. [matched, of] pairs. null means that check could not be made because a site did not answer: it is not a disagreement. totals.notes says in plain words which checks could not be made.',
    totals: Object.assign({blocks: blocks.length, firstBlock: blocks.length ? blocks[0].height : null, lastBlock: blocks.length ? blocks[blocks.length - 1].height : null}, T),
    blocks,
    links: {page: PORTAL + 'daily.html?day=' + day, blockManifest: PORTAL + 'block-manifest.html?block=<height>', watch: PORTAL + 'watch.html?watch=block', agentBlockhall: PORTAL + 'block-cube.html', mcpTool: 'io.github.bitmap22/agent-blockhall (dailyData)', csv: RAW + 'days/' + day + '.csv'}
  };
  fs.mkdirSync(path.join(out, 'days'), {recursive: true});
  fs.writeFileSync(path.join(out, 'days', day + '.json'), JSON.stringify(file));
  // the same day as a spreadsheet: one row per block (text written by miners stays out of it)
  const kinds = BM.KIND_NAMES, q = v => v == null ? '' : String(v);
  const head = ['day', 'height', 'hash', 'time_utc', 'mined_by', 'transactions', 'fees_sats'].concat(kinds.map(k => 'kind_' + k.replace(/[^a-z0-9]+/gi, '_').toLowerCase()))
    .concat(['ids_matched', 'ids_of', 'kinds_agreed', 'kinds_of', 'inscriptions_agreed', 'inscriptions_of', 'hash_second_site_agrees', 'differences', 'not_read']);
  const rows = [head.join(',')];
  for (const b of blocks) rows.push([day, b.height, b.hash, b.time, b.minedBy ? '"' + b.minedBy.replace(/"/g, '""').replace(/^[=+\-@]/, "'$&") + '"' : '', b.transactions, b.totalFees].map(q)
    .concat(kinds.map(k => q(b.counts ? b.counts[k] || 0 : '')))
    .concat(b.checked ? [b.checked.ids[0], b.checked.ids[1], b.checked.kinds && b.checked.kinds[0], b.checked.kinds && b.checked.kinds[1], b.checked.inscriptions && b.checked.inscriptions[0], b.checked.inscriptions && b.checked.inscriptions[1], b.checked.secondSite && b.checked.secondSite.agrees, b.checked.differences, ''].map(q) : ['', '', '', '', '', '', '', '', q(b.notRead).replace(/,/g, ';')]).join(','));
  fs.writeFileSync(path.join(out, 'days', day + '.csv'), rows.join('\n') + '\n');
  // the index of every day
  const ip = path.join(out, 'index.json');
  let index = {data: 'Agent Blockhall Daily Data', licence: LICENCE, days: []}; try { index = JSON.parse(fs.readFileSync(ip, 'utf8')); } catch (e) {}
  index.days = (index.days || []).filter(d => d.day !== day);
  index.days.push({day, blocks: blocks.length, firstBlock: file.totals.firstBlock, lastBlock: file.totals.lastBlock, transactions: T.transactions, totalFees: T.totalFees,
    inscriptions: T.counts.inscriptions || 0, runes: T.counts.runes || 0, 'BRC-20': T.counts['BRC-20'] || 0, notRead: T.checked.notRead, notes, json: RAW + 'days/' + day + '.json', csv: RAW + 'days/' + day + '.csv'});
  index.days.sort((a, b) => a.day < b.day ? -1 : 1);
  index.updated = file.made; index.licence = LICENCE;
  index.links = {page: PORTAL + 'daily.html', mcpTool: 'io.github.bitmap22/agent-blockhall (dailyData)', agentBlockhall: PORTAL + 'block-cube.html'};
  fs.writeFileSync(ip, JSON.stringify(index, null, 1));
  console.log('Wrote ' + day + ': ' + blocks.length + ' blocks, ' + T.transactions + ' transactions, ids ' + T.checked.ids.join('/') + ', kinds ' + (T.checked.kinds || ['not checked']).join('/') + ', inscriptions ' + (T.checked.inscriptions || ['not checked']).join('/') + ', not read ' + T.checked.notRead);
  console.log('Notes: ' + notes.join(' | '));
}
main().catch(e => { console.error(e); process.exit(1); });
