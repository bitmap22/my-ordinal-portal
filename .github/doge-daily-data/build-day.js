/* Doge Cube's Daily Data, by bitmap22. Always free. The Dogecoin twin of Agent Blockhall's Daily Data.
   Run once a night by GitHub (the Doge Daily Data workflow): it reads every Dogecoin block of one UTC day and writes the day as one
   JSON file and one CSV file, plus an index of all the days. Dogecoin makes about 1,440 blocks a day, so each block is read in a
   lighter way than the Doge Block Manifest's (which reads every transaction one by one), and every fact is still checked:
   - its hash, worked out here from its own header (agent-blockhall-mcp/server/doge-manifest.js), and on a second site (Bitcore);
   - its list of transactions, proved by the merkle root written in that header;
   - the same transactions on the second site's list, with their sizes and fees;
   - its coinbase, read from its own bytes (Blockchair) and hashed to its id: the miner's own words, and the pool they name;
   - its inscriptions and their file types from the explorer's list (the one Doginals list there is).
   Tokens (DRC-20, TAP) and dunes need every transaction's bytes: they are not counted here. Open a block in the Doge Block Manifest.
   Usage: node build-day.js [YYYY-MM-DD] <data folder> (the day defaults to yesterday, UTC). It asks the free public sites gently.
   © 2026 bitmap22. All rights reserved. */
'use strict';
const fs = require('fs'), path = require('path');
const DM = require(path.join(__dirname, '..', '..', 'agent-blockhall-mcp', 'server', 'doge-manifest.js'));
const VERSION = '1.0.0', UA = 'agent-blockhall-mcp/doge-daily-' + VERSION;
const PORTAL = 'https://ordportal.com/', RAW = 'https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/doge-daily-data/';
const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE). Dogecoin\'s data is public and is not part of it.';
const DX = 'https://thedoginalsexplorer.com', BTC = 'https://api.bitcore.io/api/DOGE/mainnet', BCR = 'https://api.blockchair.com/dogecoin';

/* ---------- being gentle with the sites ---------- */
// the explorer: 300 units a minute for everyone; Blockchair: 30 asks a minute, 1,800 an hour (it says so itself); Bitcore: a few a second
const PACE = {[DX]: {rate: 2, burst: 10}, [BTC]: {rate: 2, burst: 6}, [BCR]: {rate: 0.42, burst: 5}}, sites = new Map();
// Blockchair's key, if one has been given (a GitHub secret, BLOCKCHAIR_KEY: never in the code). Without one, the free allowance is used.
const BCR_KEY = /^[A-Za-z0-9_-]{8,128}$/.test(process.env.BLOCKCHAIR_KEY || '') ? '?key=' + process.env.BLOCKCHAIR_KEY : '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = u => Object.keys(PACE).find(b => u.startsWith(b)) || new URL(u).origin;
async function paceWait(b) {
  const P = PACE[b] || {rate: 2, burst: 4}; let s = sites.get(b); if (!s) sites.set(b, s = {tok: P.burst, t: Date.now(), restUntil: 0});
  for (;;) { const now = Date.now(); if (s.restUntil > now) { await sleep(s.restUntil - now); continue; } s.tok = Math.min(P.burst, s.tok + (now - s.t) / 1000 * P.rate); s.t = now; if (s.tok >= 1) { s.tok -= 1; return; } await sleep(Math.ceil((1 - s.tok) / P.rate * 1000)); }
}
async function getJ(url, ms) {
  const b = base(url);
  for (let tries = 0; ; tries++) {
    await paceWait(b);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 30000);
    let r;
    try { r = await fetch(url, {signal: ctl.signal, headers: {'User-Agent': UA}}); }
    catch (e) { clearTimeout(timer); if (tries < 3) { await sleep(10000); continue; } throw new Error('no answer from ' + b); }
    clearTimeout(timer);
    if ([429, 402, 430, 503].includes(r.status)) { sites.get(b).restUntil = Date.now() + 65000; if (tries < (b === BCR ? 1 : 4)) continue; throw new Error('slow down: http ' + r.status + ' from ' + b); }
    if (!r.ok) throw new Error('http ' + r.status + ' from ' + b);
    return r.json();
  }
}

let bcrSlow = 0, bcrStopped = null;   // (Blockchair gives each coinbase's bytes: if it keeps saying slow down, the day goes on without it)

/* ---------- the blocks of one UTC day (by the time written in each block) ---------- */
async function timeOf(h) { const j = await getJ(DX + '/v1/blocks?limit=1&before=' + h); if (!j.blocks || !j.blocks[0] || j.blocks[0].height !== h) throw new Error('the explorer did not give block ' + h); return j.blocks[0].time; }
async function firstAtOrAfter(ts, lo, hi) {   // (block times can step back a little: this finds a block near the edge, then the day is read with a margin)
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (await timeOf(mid) < ts) lo = mid + 1; else hi = mid; }
  return lo;
}
async function blocksOfDay(t0, t1) {
  const tip = await getJ(DX + '/v1/blocks?limit=1'), top = tip.blocks[0].height;
  const a = await firstAtOrAfter(t0, 0, top), b = await firstAtOrAfter(t1, a, top + 1);
  const lo = Math.max(0, a - 120), hi = Math.min(top, b + 120), out = [];
  for (let h = hi; h >= lo; ) {
    const j = await getJ(DX + '/v1/blocks?limit=100&before=' + h);   // (the explorer gives this block and the 99 before it)
    if (!j.blocks || !j.blocks.length) break;
    for (const x of j.blocks) if (x.height >= lo && x.height <= hi && x.time >= t0 && x.time < t1) out.push(x);
    h = j.blocks[j.blocks.length - 1].height - 1;
  }
  return out.sort((x, y) => x.height - y.height);
}

/* ---------- one block, read and checked ---------- */
async function readBlock(h) {
  const B = await getJ(DX + '/v1/block/' + h + '?limit=100');
  const list = (B.txs || []).slice();
  for (let pg = 2; list.length < (B.total || 0) && pg <= 400; pg++) { const P = await getJ(DX + '/v1/block/' + h + '?limit=100&page=' + pg); if (!P.txs || !P.txs.length) break; list.push(...P.txs); }
  const own = DM.headerHash(B), root = DM.merkleRoot(list.map(t => t.txid));
  let second = null; try { second = await getJ(BTC + '/tx?blockHeight=' + h + '&limit=' + Math.max(1000, list.length + 10), 60000); } catch (e) {}
  let secondHash = second && second[0] ? second[0].blockHash : null;
  if (!secondHash) try { secondHash = (await getJ(BTC + '/block/' + h)).hash; } catch (e) {}
  const S = new Map((second || []).map(x => [x.txid, x]));
  let fees = 0, size = 0, inSecond = 0;
  for (const t of list) { const x = S.get(t.txid); if (x) { inSecond++; if (!x.coinbase) fees += x.fee; size += x.size; } }
  // the coinbase, from its own bytes
  let cb = null;
  if (!bcrStopped) try { const j = await getJ(BCR + '/raw/transaction/' + list[0].txid + BCR_KEY); const hx = j.data && j.data[list[0].txid] && j.data[list[0].txid].raw_transaction; if (hx) { const r = DM.readTx(DM.fromHex(hx), true); cb = {ok: r.txid === list[0].txid, words: r.coinbaseWords}; } bcrSlow = 0; }
  catch (e) { if (/slow down/.test(String(e)) && ++bcrSlow >= 3) { bcrStopped = 'Blockchair said slow down three times in a row (block ' + h + '), so it was not asked for the rest of the day.'; console.log('  ' + bcrStopped); } }
  // what the explorer's list says each transaction carries
  const counts = {};
  const add = k => { counts[k] = (counts[k] || 0) + 1; };
  list.forEach((t, i) => {
    if (i === 0) { add('coinbase'); return; }
    if (t.inscription) { add('inscriptions'); add(DM.fileKind(t.inscription.contentType)); if (t.inscription.delegate) add('delegates'); }
    if (t.inputs >= 3 && t.outputs === 1) add('consolidations');
  });
  return {height: h, dogemap: h + '.dogemap', hash: B.hash, time: new Date(B.time * 1000).toISOString().replace('.000', ''), mergeMined: ((+B.version) & 0x100) !== 0,
    minedBy: cb && cb.ok ? DM.poolOf(cb.words) : null, coinbaseWords: cb && cb.ok && cb.words ? {untrusted: cb.words} : null,
    // (23 Nov 2026) the fee total is known only when the second site lists every transaction of the block; otherwise it is left blank, with the reason
    transactions: list.length, size: B.size, totalFees: second && inSecond === list.length ? fees : null,
    feesNote: !second ? 'No fee figure: the second site (Bitcore), which gives each transaction\'s fee, did not answer for this block, so none is shown.'
      : inSecond < list.length ? 'No fee figure: the second site (Bitcore) listed ' + inSecond + ' of the block\'s ' + list.length + ' transactions, so its fee total is not known and none is shown.' : null, counts,
    checked: {hashFromItsHeader: own === B.hash, secondSite: secondHash ? {against: 'https://api.bitcore.io', agrees: secondHash === B.hash} : null, listProved: root === B.merkle_root,
      secondList: second ? [inSecond, list.length] : null, coinbaseFromItsBytes: cb ? cb.ok : null},
    dogeBlockManifest: PORTAL + 'doge-block-manifest.html?block=' + h};
}

/* ---------- the day ---------- */
const sumInto = (T, o) => { for (const [k, v] of Object.entries(o || {})) T[k] = (T[k] || 0) + v; };
async function main() {
  const dayArg = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : null;
  const out = process.argv[dayArg ? 3 : 2] || 'data';
  const day = dayArg || new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const t0 = Date.parse(day + 'T00:00:00Z') / 1000, t1 = t0 + 86400;
  if (t1 > Date.now() / 1000) throw new Error(day + ' has not finished yet (UTC)');
  console.log('Doge Daily Data for ' + day);
  const list = await blocksOfDay(t0, t1);
  console.log(list.length + ' blocks: ' + (list.length ? list[0].height + ' to ' + list[list.length - 1].height : 'none'));
  const blocks = [], T = {transactions: 0, totalFees: 0, counts: {}, pools: {}, checked: {hashFromItsHeader: 0, secondSiteAgrees: 0, secondSiteAsked: 0, listProved: 0, secondList: [0, 0], coinbaseFromItsBytes: 0, coinbaseNotRead: 0, notRead: 0}};
  const got = new Array(list.length); let next = 0, n = 0;
  await Promise.all([0, 1].map(async () => { while (next < list.length) { const k = next++, b = list[k]; let rec = null, err = null;
    for (let tries = 0; tries < 3 && !rec; tries++) { try { rec = await readBlock(b.height); } catch (e) { err = e; await sleep(15000); } }
    got[k] = {rec, err}; if (++n % 60 === 0) console.log('  ' + n + ' of ' + list.length + ' read'); } }));
  for (let k = 0; k < list.length; k++) {
    const b = list[k], {rec, err} = got[k];
    if (!rec) { console.log('  ' + b.height + ': not read (' + (err && err.message) + ')'); T.checked.notRead++; blocks.push({height: b.height, hash: b.hash, time: new Date(b.time * 1000).toISOString().replace('.000', ''), notRead: String(err && err.message || err)}); continue; }
    blocks.push(rec);
    T.transactions += rec.transactions; if (rec.totalFees != null) T.totalFees += rec.totalFees; else T.checked.feesMissing = (T.checked.feesMissing || 0) + 1; sumInto(T.counts, rec.counts); if (rec.minedBy) T.pools[rec.minedBy] = (T.pools[rec.minedBy] || 0) + 1;
    const K = T.checked, C = rec.checked;
    if (C.hashFromItsHeader) K.hashFromItsHeader++; if (C.secondSite) { K.secondSiteAsked++; if (C.secondSite.agrees) K.secondSiteAgrees++; }
    if (C.listProved) K.listProved++; if (C.secondList) { K.secondList[0] += C.secondList[0]; K.secondList[1] += C.secondList[1]; }
    if (C.coinbaseFromItsBytes) K.coinbaseFromItsBytes++; else K.coinbaseNotRead++;
  }
  const K = T.checked, notes = [], read = blocks.length - K.notRead;
  if (K.feesMissing) notes.push('Fees: ' + K.feesMissing + ' block' + (K.feesMissing === 1 ? ' has' : 's have') + ' no fee figure (see feesNote on each), so the day\'s fee total leaves ' + (K.feesMissing === 1 ? 'it' : 'them') + ' out and is lower than the real total.');
  if (K.notRead) notes.push(K.notRead + ' block' + (K.notRead === 1 ? ' was' : 's were') + ' not read at all: see notRead on each.');
  if (K.hashFromItsHeader < read) notes.push((read - K.hashFromItsHeader) + ' block' + (read - K.hashFromItsHeader === 1 ? '\'s hash does' : 's\' hashes do') + ' not match their own header: open them in the Doge Block Manifest.');
  if (K.secondSiteAsked < read) notes.push('For ' + (read - K.secondSiteAsked) + ' block' + (read - K.secondSiteAsked === 1 ? '' : 's') + ', the second site did not answer, so the hash was only checked against its own header.');
  if (K.secondSiteAgrees < K.secondSiteAsked) notes.push((K.secondSiteAsked - K.secondSiteAgrees) + ' block hash' + (K.secondSiteAsked - K.secondSiteAgrees === 1 ? '' : 'es') + ' differ on the second site.');
  if (K.listProved < read) notes.push((read - K.listProved) + ' block' + (read - K.listProved === 1 ? '\'s' : 's\'') + ' transaction list' + (read - K.listProved === 1 ? ' is' : 's are') + ' not proved by the header.');
  if (bcrStopped) notes.push(bcrStopped);
  if (K.coinbaseNotRead) notes.push('For ' + K.coinbaseNotRead + ' block' + (K.coinbaseNotRead === 1 ? '' : 's') + ', the coinbase\'s bytes were not had, so who mined it is not named.');
  if (!notes.length) notes.push('Every block was read and every check was made.');
  notes.push('Tokens (DRC-20, TAP) and dunes are not counted in Daily Data: they need every transaction\'s own bytes. The Doge Block Manifest reads them for any block.');
  T.notes = notes;
  const file = {
    data: 'Doge Cube Daily Data ' + VERSION, day, utc: {from: new Date(t0 * 1000).toISOString().replace('.000', ''), to: new Date(t1 * 1000).toISOString().replace('.000', '')},
    made: new Date().toISOString().replace(/\.\d{3}/, ''), licence: LICENCE,
    what: 'Every Dogecoin block whose time falls in this UTC day: its hash (worked out from its own header, and on Bitcore), its transaction list (proved by the merkle root in that header, and matched with Bitcore\'s list), its size and fees (Bitcore), its coinbase (read from its own bytes: the miner\'s words, untrusted, and the pool they name), and its inscriptions and their file types (the explorer\'s list). Fees are in koinu (1 DOGE = 100,000,000 koinu).',
    totals: Object.assign({blocks: blocks.length, firstBlock: blocks.length ? blocks[0].height : null, lastBlock: blocks.length ? blocks[blocks.length - 1].height : null}, T),
    blocks,
    links: {page: PORTAL + 'doge-daily.html?day=' + day, dogeBlockManifest: PORTAL + 'doge-block-manifest.html?block=<height>', dogeWatch: PORTAL + 'doge-watch.html?watch=block', dogeCube: PORTAL + 'doge-cube.html', mcpTool: 'io.github.bitmap22/agent-blockhall (dogeDailyData)', bitcoinTwin: PORTAL + 'daily.html?day=' + day}
  };
  fs.mkdirSync(path.join(out, 'days'), {recursive: true});
  fs.writeFileSync(path.join(out, 'days', day + '.json'), JSON.stringify(file));
  // the same day as a spreadsheet: one row per block (words written by miners stay out of it)
  const KINDS = ['inscriptions', 'images', 'text', 'HTML', 'JSON', 'audio / video', '3D models', 'other files', 'delegates', 'consolidations'], q = v => v == null ? '' : String(v);
  const head = ['day', 'height', 'hash', 'time_utc', 'mined_by', 'transactions', 'size_bytes', 'fees_koinu'].concat(KINDS.map(k => 'kind_' + k.replace(/[^a-z0-9]+/gi, '_').toLowerCase()))
    .concat(['hash_from_its_header', 'hash_second_site_agrees', 'list_proved', 'in_second_list', 'coinbase_from_its_bytes', 'not_read']);
  const rows = [head.join(',')];
  for (const b of blocks) rows.push([day, b.height, b.hash, b.time, b.minedBy || '', b.transactions, b.size, b.totalFees].map(q).concat(KINDS.map(k => q(b.counts ? b.counts[k] || 0 : '')))
    .concat(b.checked ? [b.checked.hashFromItsHeader, b.checked.secondSite && b.checked.secondSite.agrees, b.checked.listProved, b.checked.secondList && b.checked.secondList.join('/'), b.checked.coinbaseFromItsBytes, ''].map(q) : ['', '', '', '', '', 'yes']).join(','));
  fs.writeFileSync(path.join(out, 'days', day + '.csv'), rows.join('\n') + '\n');
  // the index of every day
  const ip = path.join(out, 'index.json');
  let index = {data: 'Doge Cube Daily Data', licence: LICENCE, days: []}; try { index = JSON.parse(fs.readFileSync(ip, 'utf8')); } catch (e) {}
  index.days = (index.days || []).filter(d => d.day !== day);
  index.days.push({day, blocks: blocks.length, firstBlock: file.totals.firstBlock, lastBlock: file.totals.lastBlock, transactions: T.transactions, totalFees: T.totalFees, inscriptions: T.counts.inscriptions || 0, notRead: K.notRead, notes, json: RAW + 'days/' + day + '.json', csv: RAW + 'days/' + day + '.csv'});
  index.days.sort((a, b) => a.day < b.day ? -1 : 1);
  index.updated = file.made; index.licence = LICENCE;
  index.links = {page: PORTAL + 'doge-daily.html', dogeCube: PORTAL + 'doge-cube.html', mcpTool: 'io.github.bitmap22/agent-blockhall (dogeDailyData)', bitcoinTwin: RAW.replace('doge-daily-data', 'daily-data') + 'index.json'};
  fs.writeFileSync(ip, JSON.stringify(index, null, 1));
  console.log('Wrote ' + day + ': ' + blocks.length + ' blocks, ' + T.transactions + ' transactions, hash ' + K.hashFromItsHeader + '/' + read + ', second site ' + K.secondSiteAgrees + '/' + K.secondSiteAsked + ', lists proved ' + K.listProved + '/' + read + ', coinbases ' + K.coinbaseFromItsBytes + '/' + read);
  console.log('Notes: ' + notes.join(' | '));
}
main().catch(e => { console.error(e); process.exit(1); });
