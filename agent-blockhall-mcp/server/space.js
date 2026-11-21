/* Blockspace Share, by bitmap22. Always free. Part of Agent Blockhall: https://ordportal.com/block-cube.html
   How Bitcoin's blockspace splits between the kinds of use, as a share of the bytes, by day, week or month.
   - Every transaction is counted once, under the first of these kinds it is (in the halls a transaction can be several kinds
     at once): Alkanes, runes, BRC-20, Stamps & Counterparty, other tokens, inscriptions, messages, coinbase, consolidations,
     batch payouts, payments.
   - Its bytes are its size as the block holds it (its witness data included). The block's own header and transaction count
     are "block header". So the kinds add up to the block's exact size: every byte is counted once.
   - The kinds come from the Block Manifest's reader (manifest.js, in this folder) reading each block's own bytes, and from
     nothing else, so every day is read the same way.
   - Made each night by GitHub with Daily Data, and saved on the daily-data branch of the portal's repository (space/), from
     1 October 2026. Bitcoin only: Dogecoin's free sites can't give every transaction's bytes, so its kinds would be missing.
   The same file is for the Blockspace Share page, the free Agent Blockhall MCP tool and the nightly job. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.BlockspaceShare = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const PORTAL = 'https://ordportal.com/';
  const DATA_URLS = ['https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/daily-data/space/index.json',
    'https://cdn.jsdelivr.net/gh/bitmap22/my-ordinal-portal@daily-data/space/index.json'];   // (the second is a copy that can be some hours old)
  const RAW = 'https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/daily-data/';
  const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE).';
  const FIRST_DAY = '2026-10-01';

  // [kind, what it holds, the hall kinds (Block Manifest kinds) that put a transaction here]: the first one that fits wins
  const KINDS = [
    ['Alkanes', 'Alkanes token transactions (they ride inside a rune message, so they come before runes)', ['Alkanes']],
    ['runes', 'rune etchings, mints and moves', ['runes', 'runes etched', 'runes minted', 'runes moved']],
    ['BRC-20', 'BRC-20 token inscriptions', ['BRC-20']],
    ['Stamps & Counterparty', 'Stamps, SRC-20 and Counterparty', ['Stamps', 'SRC-20', 'Counterparty']],
    ['other tokens', 'TAP, DMT, NAT, BRC-420, CRC-20, Atomicals, CAT-21 and Labitbu', ['TAP', 'DMT mints', 'NAT', 'BRC-420', 'CRC-20 · LEAF', 'Atomicals', 'CAT-21', 'Labitbu']],
    ['inscriptions', 'ordinal inscriptions that are not tokens: pictures, text, HTML, bitmaps and every other file', ['inscriptions', 'bitmaps', 'images', 'text', 'HTML', 'JSON', 'audio / video', '3D models', 'other files', 'delegates', 'children', 'cursed']],
    ['messages', 'data written in OP_RETURN that is not a token', ['messages', 'OpenTimestamps']],
    ['coinbase', 'each block\'s first transaction, which pays its miner', ['coinbase']],
    ['consolidations', 'three or more coins joined into one', ['consolidations']],
    ['batch payouts', 'one payment to ten or more addresses', ['batch payouts']],
    ['payments', 'every other transaction: ordinary payments', ['regular', 'taproot', 'segwit', 'legacy', 'multisig']]];
  const HEADER = 'block header';
  const NAMES = KINDS.map(k => k[0]).concat([HEADER]);
  const WHAT = Object.assign(Object.fromEntries(KINDS.map(k => [k[0], k[1]])), {[HEADER]: 'each block\'s 80-byte header and its count of transactions'});
  const ORDER = 'A transaction that is several kinds at once is counted under the first that fits, in this order: ' + KINDS.map(k => k[0]).join(', ') + '.';

  // the kind of one transaction, from its hall kinds (the Block Manifest's item.kinds)
  function kindOf(hallKinds) {
    const h = hallKinds || [];
    for (const [name, , from] of KINDS) if (from.some(k => h.includes(k))) return name;
    return 'payments';
  }
  // one block: items = the Block Manifest's items (kinds), sizes = each transaction's size in bytes, blockBytes = the block's size
  function splitBlock(items, sizes, blockBytes) {
    const bytes = {}, txs = {};
    for (const k of NAMES) { bytes[k] = 0; txs[k] = 0; }
    let sum = 0;
    for (let i = 0; i < items.length; i++) { const k = kindOf(items[i].kinds), z = sizes[i]; if (!(z > 0)) throw new Error('transaction ' + i + ' has no size'); bytes[k] += z; txs[k]++; sum += z; }
    bytes[HEADER] = blockBytes - sum;
    if (bytes[HEADER] < 81 || bytes[HEADER] > 89) throw new Error('the transactions do not add up to the block (' + sum + ' of ' + blockBytes + ' bytes)');
    return {size: blockBytes, bytes, txs};
  }
  const addInto = (T, o) => { for (const [k, v] of Object.entries(o || {})) T[k] = (T[k] || 0) + v; };
  // a day's record from its blocks' splits (null for a block that was not read)
  function dayRecord(day, blocks) {
    const r = {day, blocks: blocks.length, firstBlock: blocks.length ? blocks[0].height : null, lastBlock: blocks.length ? blocks[blocks.length - 1].height : null,
      read: 0, notRead: [], size: 0, bytes: {}, txs: {}};
    for (const k of NAMES) { r.bytes[k] = 0; r.txs[k] = 0; }
    for (const b of blocks) {
      if (!b.split) { r.notRead.push(b.height); continue; }
      r.read++; r.size += b.split.size; addInto(r.bytes, b.split.bytes); addInto(r.txs, b.split.txs);
    }
    return r;
  }

  /* ---------- days into periods: day, week (Monday to Sunday, UTC) or month ---------- */
  const DAY_MS = 864e5;
  const dayMs = d => Date.parse(d + 'T00:00:00Z');
  const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
  function periodOf(day, period) {
    if (period === 'month') { const from = day.slice(0, 8) + '01', m = new Date(dayMs(from)); m.setUTCMonth(m.getUTCMonth() + 1); return {key: day.slice(0, 7), from, to: isoDay(m.getTime() - DAY_MS)}; }
    if (period === 'week') { const ms = dayMs(day), back = (new Date(ms).getUTCDay() + 6) % 7, from = isoDay(ms - back * DAY_MS); return {key: 'week of ' + from, from, to: isoDay(dayMs(from) + 6 * DAY_MS)}; }
    return {key: day, from: day, to: day};
  }
  // the periods, oldest first: each with its share of every kind (bytes of that kind / bytes read), and whether it is whole
  function periods(days, period) {
    period = period === 'week' || period === 'month' ? period : 'day';
    const by = new Map();
    for (const d of days || []) {
      const p = periodOf(d.day, period);
      let P = by.get(p.key);
      if (!P) by.set(p.key, P = {period: p.key, from: p.from, to: p.to, daysExpected: Math.round((dayMs(p.to) - dayMs(p.from)) / DAY_MS) + 1, days: 0, blocks: 0, read: 0, notRead: 0, size: 0, bytes: {}, txs: {}});
      P.days++; P.blocks += d.blocks; P.read += d.read; P.notRead += (d.notRead || []).length; P.size += d.size; addInto(P.bytes, d.bytes); addInto(P.txs, d.txs);
    }
    const out = [...by.values()].sort((a, b) => a.from < b.from ? -1 : 1);
    for (const P of out) {
      P.whole = P.days === P.daysExpected && !P.notRead;
      P.share = {}; for (const k of NAMES) P.share[k] = P.size ? +(100 * (P.bytes[k] || 0) / P.size).toFixed(3) : null;
      if (!P.whole) P.note = (P.days < P.daysExpected ? P.days + ' of its ' + P.daysExpected + ' days are saved' : '') + (P.days < P.daysExpected && P.notRead ? '; ' : '') +
        (P.notRead ? P.notRead + ' block' + (P.notRead === 1 ? ' was' : 's were') + ' not read' : '') + ': its shares are of the bytes that were read.';
    }
    return out;
  }

  /* ---------- reading the saved days ---------- */
  async function fetchIndex(fetchFn, ms) {
    const f = fetchFn || (typeof fetch === 'function' ? fetch : null);
    if (!f) throw new Error('no way to fetch');
    let err = null;
    for (const u of DATA_URLS) {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl ? setTimeout(() => ctl.abort(), ms || 20000) : null;
      try { const r = await f(u + '?t=' + Math.floor(Date.now() / 6e5), ctl ? {signal: ctl.signal, cache: 'no-store'} : {}); if (!r.ok) throw new Error('http ' + r.status + ' from ' + new URL(u).host); const j = await r.json(); j.from = u; return j; }
      catch (e) { err = e; } finally { if (t) clearTimeout(t); }
    }
    throw err || new Error('the saved days could not be read');
  }

  /* ---------- writing (the nightly job and the fill-in job, in Node) ---------- */
  function writeDay(outDir, rec) {
    const fs = require('fs'), path = require('path');
    const dir = path.join(outDir, 'space', 'days');
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, rec.day + '.json'), JSON.stringify(Object.assign({data: 'Agent Blockhall Blockspace Share ' + VERSION, licence: LICENCE}, rec)));
    // the index: every saved day, rebuilt from the day files (so two jobs can never leave it short of a day)
    const days = fs.readdirSync(dir).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().map(n => {
      const d = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      return {day: d.day, blocks: d.blocks, firstBlock: d.firstBlock, lastBlock: d.lastBlock, read: d.read, notRead: d.notRead, size: d.size, bytes: d.bytes, txs: d.txs};
    });
    const index = {data: 'Agent Blockhall Blockspace Share ' + VERSION, licence: LICENCE, updated: new Date().toISOString().replace(/\.\d{3}/, ''),
      what: 'How Bitcoin\'s blockspace splits between the kinds of use, day by day: for each UTC day, the bytes (size) and the number of transactions of each kind, read from every block\'s own bytes by the Block Manifest\'s reader. ' + ORDER + ' "block header" is each block\'s header and transaction count, so the kinds add up to the bytes read (size). notRead lists any block that could not be read: its bytes are not in the day. Bitcoin only.',
      kinds: NAMES.map(k => ({kind: k, what: WHAT[k]})), firstDay: FIRST_DAY, days,
      links: {page: PORTAL + 'blockspace-share.html', dailyData: PORTAL + 'daily.html', blockManifest: PORTAL + 'block-manifest.html?block=<height>', agentBlockhall: PORTAL + 'block-cube.html', mcpTool: 'io.github.bitmap22/agent-blockhall (blockspaceShare)', dayFile: RAW + 'space/days/<day>.json'}};
    fs.writeFileSync(path.join(outDir, 'space', 'index.json'), JSON.stringify(index));
    return index;
  }

  return {VERSION, KINDS, NAMES, HEADER, WHAT, ORDER, FIRST_DAY, DATA_URLS, LICENCE, kindOf, splitBlock, dayRecord, periodOf, periods, fetchIndex, writeDay};
});
