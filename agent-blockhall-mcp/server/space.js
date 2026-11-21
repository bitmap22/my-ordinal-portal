/* Blockspace Share, by bitmap22. Always free. Part of Agent Blockhall: https://ordportal.com/block-cube.html
   How Bitcoin's blockspace splits between the kinds of use, as a share of the bytes, by day, week or month.
   - Every transaction is counted once, under the first of these kinds it is (in the halls a transaction can be several kinds
     at once): Alkanes, runes, BRC-20, Stamps & Counterparty, other tokens, inscriptions, messages, coinbase, consolidations,
     batch payouts, payments.
   - Its bytes are its size as the block holds it (its witness data included). The block's own header and transaction count
     are "block header". So the kinds add up to the block's exact size: every byte is counted once.
   - The kinds come from the Block Manifest's reader (manifest.js, in this folder) reading each block's own bytes, and from
     nothing else, so every day is read the same way.
   - The fees each kind paid, in sats: each transaction's fee from mempool.space's list for the block (or a copy's), kept only if the
     block's fees add up to what its coinbase pays out (read from the block's own bytes) less the new coins.
   - Made each night by GitHub with Daily Data, and saved on the daily-data branch of the portal's repository (space/), from
     1 October 2026. Bitcoin only: Dogecoin's free sites can't give every transaction's bytes, so its kinds would be missing.
   The same file is for the Blockspace Share page, the free Agent Blockhall MCP tool and the nightly job. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.BlockspaceShare = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.1.1';
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
  // the new coins a block at this height makes: 50 BTC, halved every 210,000 blocks
  const newCoins = h => h >= 6930000 ? 0 : Number(5000000000n >> BigInt(Math.floor(h / 210000)));
  // what a block's first transaction (its coinbase) pays out, in sats, read from the block's own bytes
  function coinbaseOut(X) {
    let p = 80;
    const vi = () => { const f = X[p++]; if (f < 253) return f; const n = f === 253 ? 2 : f === 254 ? 4 : 8; let v = 0; for (let i = 0; i < n; i++) v += X[p++] * 2 ** (8 * i); return v; };
    vi(); p += 4; if (X[p] === 0 && X[p + 1] === 1) p += 2;
    const nin = vi(); for (let i = 0; i < nin; i++) { p += 36; const l = vi(); p += l + 4; }
    const nout = vi(); let v = 0n;
    for (let i = 0; i < nout; i++) { let x = 0n; for (let k = 7; k >= 0; k--) x = (x << 8n) | BigInt(X[p + k]); v += x; p += 8; const l = vi(); p += l; }
    if (p > X.length) throw new Error('the coinbase could not be read');
    return Number(v);
  }
  // each transaction's fee in sats (txids in block order; list = mempool.space's block summary, [{txid, fee}]), kept only if
  // the fees add up to what the coinbase pays out less the new coins
  function feesOf(txids, list, blockBytes, height) {
    const m = new Map(); for (const x of list || []) if (x && x.txid) m.set(x.txid, x.fee);
    const fees = new Array(txids.length); let sum = 0;
    for (let i = 0; i < txids.length; i++) {
      let f = i === 0 ? 0 : m.get(txids[i]);   // (the coinbase pays no fee)
      // (one copy, mempool.ninja, sends some fees with a rounding slip, as 838.9999999999999 for 839: put right only when it is
      // that close to a whole number of sats; the coinbase check below must still match to the sat)
      if (typeof f === 'number' && f > 0 && !Number.isInteger(f) && Math.abs(f - Math.round(f)) < 1e-3) f = Math.round(f);
      if (!(Number.isInteger(f) && f >= 0)) throw new Error('the fee list has no fee for transaction ' + i);
      fees[i] = f; sum += f;
    }
    const cb = coinbaseOut(blockBytes), made = newCoins(height);
    if (sum !== cb - made) throw new Error('the fees (' + sum + ' sats) do not match the coinbase (' + cb + ' sats) less the new coins (' + made + ' sats)');
    return fees;
  }
  // one block: items = the Block Manifest's items (kinds), sizes = each transaction's size in bytes, blockBytes = the block's
  // size, fees = each transaction's fee in sats (feesOf), or null when they could not be had or checked
  function splitBlock(items, sizes, blockBytes, fees) {
    const bytes = {}, txs = {}, sats = fees ? {} : null;
    for (const k of NAMES) { bytes[k] = 0; txs[k] = 0; if (sats) sats[k] = 0; }
    let sum = 0;
    for (let i = 0; i < items.length; i++) { const k = kindOf(items[i].kinds), z = sizes[i]; if (!(z > 0)) throw new Error('transaction ' + i + ' has no size'); bytes[k] += z; txs[k]++; sum += z; if (sats) sats[k] += fees[i]; }
    bytes[HEADER] = blockBytes - sum;
    if (bytes[HEADER] < 81 || bytes[HEADER] > 89) throw new Error('the transactions do not add up to the block (' + sum + ' of ' + blockBytes + ' bytes)');
    return sats ? {size: blockBytes, bytes, txs, sats} : {size: blockBytes, bytes, txs};
  }
  const addInto = (T, o) => { for (const [k, v] of Object.entries(o || {})) T[k] = (T[k] || 0) + v; };
  // a day's record from its blocks' splits (null for a block that was not read)
  function dayRecord(day, blocks) {
    const r = {day, blocks: blocks.length, firstBlock: blocks.length ? blocks[0].height : null, lastBlock: blocks.length ? blocks[blocks.length - 1].height : null,
      read: 0, notRead: [], size: 0, bytes: {}, txs: {}, feesRead: 0, feesNotRead: [], fees: 0, sats: {}};
    for (const k of NAMES) { r.bytes[k] = 0; r.txs[k] = 0; r.sats[k] = 0; }
    for (const b of blocks) {
      if (!b.split) { r.notRead.push(b.height); continue; }
      r.read++; r.size += b.split.size; addInto(r.bytes, b.split.bytes); addInto(r.txs, b.split.txs);
      if (!b.split.sats) { r.feesNotRead.push(b.height); continue; }
      r.feesRead++; addInto(r.sats, b.split.sats); for (const v of Object.values(b.split.sats)) r.fees += v;
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
      if (!P) by.set(p.key, P = {period: p.key, from: p.from, to: p.to, daysExpected: Math.round((dayMs(p.to) - dayMs(p.from)) / DAY_MS) + 1, days: 0, blocks: 0, read: 0, notRead: 0, size: 0, bytes: {}, txs: {}, feesRead: 0, feesNotRead: 0, fees: 0, sats: {}});
      P.days++; P.blocks += d.blocks; P.read += d.read; P.notRead += (d.notRead || []).length; P.size += d.size; addInto(P.bytes, d.bytes); addInto(P.txs, d.txs);
      const fr = d.feesRead || 0; P.feesRead += fr; P.feesNotRead += d.read - fr; P.fees += d.fees || 0; addInto(P.sats, d.sats);   // (a day saved before fees were counted has none)
    }
    const out = [...by.values()].sort((a, b) => a.from < b.from ? -1 : 1);
    for (const P of out) {
      P.whole = P.days === P.daysExpected && !P.notRead;
      P.share = {}; for (const k of NAMES) P.share[k] = P.size ? +(100 * (P.bytes[k] || 0) / P.size).toFixed(3) : null;
      if (!P.whole) P.note = (P.days < P.daysExpected ? P.days + ' of its ' + P.daysExpected + ' days are saved' : '') + (P.days < P.daysExpected && P.notRead ? '; ' : '') +
        (P.notRead ? P.notRead + ' block' + (P.notRead === 1 ? ' was' : 's were') + ' not read' : '') + ': its shares are of the bytes that were read.';
      for (const k of NAMES) P.sats[k] = P.sats[k] || 0;
      P.feeShare = {}; for (const k of NAMES) P.feeShare[k] = P.fees ? +(100 * P.sats[k] / P.fees).toFixed(3) : null;
      P.feesWhole = P.whole && !P.feesNotRead;
      if (!P.feesRead) P.feeNote = 'no fees are saved for it';
      else if (!P.feesWhole) P.feeNote = (P.days < P.daysExpected ? P.days + ' of its ' + P.daysExpected + ' days are saved' : '') + (P.days < P.daysExpected && P.feesNotRead ? '; ' : '') +
        (P.feesNotRead ? P.feesNotRead + ' block' + (P.feesNotRead === 1 ? ' has' : 's have') + ' no fees saved' : '') + ': its fee shares are of the fees that were saved (' + P.feesRead + ' of its ' + P.blocks + ' blocks).';
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
      const o = {day: d.day, blocks: d.blocks, firstBlock: d.firstBlock, lastBlock: d.lastBlock, read: d.read, notRead: d.notRead, size: d.size, bytes: d.bytes, txs: d.txs};
      if (d.sats) Object.assign(o, {feesRead: d.feesRead, feesNotRead: d.feesNotRead, fees: d.fees, sats: d.sats});
      return o;
    });
    const index = {data: 'Agent Blockhall Blockspace Share ' + VERSION, licence: LICENCE, updated: new Date().toISOString().replace(/\.\d{3}/, ''),
      what: 'How Bitcoin\'s blockspace splits between the kinds of use, day by day: for each UTC day, the bytes (size), the number of transactions and the fees paid in sats (sats) of each kind, read from every block\'s own bytes by the Block Manifest\'s reader. ' + ORDER + ' "block header" is each block\'s header and transaction count, so the kinds add up to the bytes read (size). notRead lists any block that could not be read: its bytes are not in the day. Fees: each transaction\'s fee from mempool.space\'s list (or a copy\'s), kept for a block only if they add up to what its coinbase pays out (read from its own bytes) less the new coins; fees is the day\'s total, feesRead the blocks whose fees are in it, feesNotRead the read blocks whose fees are not. Bitcoin only.',
      kinds: NAMES.map(k => ({kind: k, what: WHAT[k]})), firstDay: FIRST_DAY, days,
      links: {page: PORTAL + 'blockspace-share.html', dailyData: PORTAL + 'daily.html', blockManifest: PORTAL + 'block-manifest.html?block=<height>', agentBlockhall: PORTAL + 'block-cube.html', mcpTool: 'io.github.bitmap22/agent-blockhall (blockspaceShare)', dayFile: RAW + 'space/days/<day>.json'}};
    fs.writeFileSync(path.join(outDir, 'space', 'index.json'), JSON.stringify(index));
    return index;
  }

  return {VERSION, KINDS, NAMES, HEADER, WHAT, ORDER, FIRST_DAY, DATA_URLS, LICENCE, kindOf, newCoins, coinbaseOut, feesOf, splitBlock, dayRecord, periodOf, periods, fetchIndex, writeDay};
});
