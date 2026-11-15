/* Doge Cube's Provenance Check, by bitmap22. Always free. The Dogecoin twin of Agent Blockhall's Provenance Check (provenance.js).
   Proves where a Doginal (a Dogecoin inscription) came from, from the chain itself:
   - its file is read out of the transactions that wrote it: a Doginal starts with "ord", its file type and a count of its pieces,
     and a file too big for one transaction carries on in the next ones, each spending the one before, counting down to 0. Every
     transaction is read from its own bytes and hashed to make sure the bytes are that transaction;
   - the file put back together from the chain gets a fingerprint (SHA-256), matched with the copies the explorer and Doggy Market show;
   - it follows every move from where it sits now back to the transaction that finished writing it, the way Doge Cube's "follow it
     back" does (a transaction hands its coins on in order, first in first out); each step is checked on a second site (Bitcore);
   - where it sits now: that output must be unspent, at the holder's address, on the second site too.
   Its number comes from the explorer only: it is the one Doginals list a web page can ask.
   The same file is for the portal's Doge Provenance Check page and the free Agent Blockhall MCP tool. It only reads and works things
   out: fetching is left to whoever uses it. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.DogeProvenance = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';

  /* ---------- SHA-256 (for transaction ids and the file's fingerprint) ---------- */
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
    0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(m) {
    const l = m.length, n = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(n); b.set(m); b[l] = 0x80;
    const bits = l * 8; for (let i = 0; i < 8; i++) b[n - 1 - i] = Math.floor(bits / 2 ** (8 * i)) & 255;
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = b[o + i * 4] << 24 | b[o + i * 4 + 1] << 16 | b[o + i * 4 + 2] << 8 | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) { const a = W[i - 15], c = W[i - 2]; W[i] = (((a >>> 7 | a << 25) ^ (a >>> 18 | a << 14) ^ a >>> 3) + W[i - 7] + ((c >>> 17 | c << 15) ^ (c >>> 19 | c << 13) ^ c >>> 10) + W[i - 16]) | 0; }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32); for (let i = 0; i < 8; i++) { out[i * 4] = H[i] >>> 24; out[i * 4 + 1] = H[i] >>> 16 & 255; out[i * 4 + 2] = H[i] >>> 8 & 255; out[i * 4 + 3] = H[i] & 255; }
    return out;
  }
  const hex = u => Array.from(u, b => b.toString(16).padStart(2, '0')).join('');
  const revHex = u => { let s = ''; for (let i = u.length - 1; i >= 0; i--) s += u[i].toString(16).padStart(2, '0'); return s; };
  function fromHex(h) { h = String(h || '').trim(); if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error('not hex'); const u = new Uint8Array(h.length >> 1); for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16); return u; }
  const catB = list => { let n = 0; for (const a of list) n += a.length; const o = new Uint8Array(n); let k = 0; for (const a of list) { o.set(a, k); k += a.length; } return o; };

  /* ---------- a transaction from its own bytes (Dogecoin: no segwit) ---------- */
  function parseTx(u) {
    let p = 4;
    const vi = () => { const f = u[p++]; if (f < 253) return f; const n = f === 253 ? 2 : f === 254 ? 4 : 8; let v = 0; for (let i = 0; i < n; i++) v += u[p++] * 2 ** (8 * i); return v; };
    if (u[p] === 0 && u[p + 1] === 1) throw new Error('segwit is not used on Dogecoin');
    const nin = vi(), vin = [];
    for (let i = 0; i < nin; i++) { const txid = revHex(u.subarray(p, p + 32)); p += 32; const vout = (u[p] | u[p + 1] << 8 | u[p + 2] << 16 | u[p + 3] << 24) >>> 0; p += 4; const l = vi(); vin.push({txid, vout, script: u.subarray(p, p + l)}); p += l + 4; }
    const nout = vi(), vout = [];
    for (let i = 0; i < nout; i++) { let v = 0; for (let k = 0; k < 8; k++) v += u[p + k] * 2 ** (8 * k); p += 8; const l = vi(); vout.push({value: v, script: u.subarray(p, p + l)}); p += l; }
    p += 4;
    if (p !== u.length) throw new Error('the transaction\'s bytes do not end where they should');
    return {txid: revHex(sha256(sha256(u))), size: u.length, vin, vout};
  }
  function pushes(s) {
    const o = []; let i = 0;
    while (i < s.length) {
      const opc = s[i++]; let n = opc === 0 ? 0 : -1;
      if (opc >= 1 && opc <= 75) n = opc; else if (opc === 76) n = s[i++]; else if (opc === 77) { n = s[i] | s[i + 1] << 8; i += 2; }
      else if (opc === 78) { n = (s[i] | s[i + 1] << 8 | s[i + 2] << 16 | s[i + 3] << 24) >>> 0; i += 4; }
      if (n < 0) { o.push([opc, null]); continue; }
      if (i + n > s.length) { o.bad = true; break; }
      o.push([opc, s.subarray(i, i + n)]); i += n;
    }
    return o;
  }
  // a piece count as Doginals writes it: OP_0, OP_1..OP_16, or a short push of a little-endian number
  function pieceNum(x) {
    if (!x) return null; const [opc, d] = x;
    if (opc === 0) return 0;
    if (opc >= 0x51 && opc <= 0x60) return opc - 0x50;
    if (d && d.length >= 1 && d.length <= 4) { let v = 0; for (let i = d.length - 1; i >= 0; i--) v = v * 256 + d[i]; return v; }
    return null;
  }
  // the pieces at P[j..]: each a count, then its data; the counts go down; it ends at 0 (finished) or where the pieces stop
  function readPieces(P, j, last) {
    const body = []; let finished = false;
    while (j + 1 < P.length) { const k = pieceNum(P[j]); if (k == null || k >= last || !P[j + 1][1]) break; body.push(P[j + 1][1]); last = k; j += 2; if (k === 0) { finished = true; break; } }
    return {body, last, finished};
  }
  // the start of a Doginal in a transaction: the input whose script starts "ord", its file type, its piece count and the pieces there
  function inscriptionStart(tx) {
    for (let i = 0; i < tx.vin.length; i++) {
      const P = pushes(tx.vin[i].script); if (P.bad || P.length < 3) continue;
      const f = P[0][1];
      if (!(f && f.length === 3 && f[0] === 0x6f && f[1] === 0x72 && f[2] === 0x64)) continue;
      const n0 = pieceNum(P[1]); if (n0 == null || !P[2][1]) continue;
      const ct = new TextDecoder('utf-8').decode(P[2][1]).slice(0, 120), R = readPieces(P, 3, n0);
      return {input: i, contentType: ct, pieces: n0, body: R.body, last: R.last, finished: R.finished};
    }
    return null;
  }
  // a later piece of the file: the input that spends the transaction before (txid:vout) starts with the next count
  function inscriptionMore(tx, prevTxid, last) {
    for (let i = 0; i < tx.vin.length; i++) {
      if (tx.vin[i].txid !== prevTxid) continue;
      const P = pushes(tx.vin[i].script); if (P.bad || !P.length) continue;
      const R = readPieces(P, 0, last); if (!R.body.length) continue;
      return {input: i, spends: prevTxid + ':' + tx.vin[i].vout, body: R.body, last: R.last, finished: R.finished};
    }
    return null;
  }

  /* ---------- one step back along the trail (first in, first out) ---------- */
  // x: the explorer's transaction (inputs with txid, vout, satoshis; outputs with satoshis)
  function stepBack(x, vout, offset) {
    let abs = offset; for (let k = 0; k < vout; k++) abs += (x.outputs[k] || {}).satoshis || 0;
    let acc = 0;
    for (let k = 0; k < x.inputs.length; k++) { const v = x.inputs[k].satoshis || 0; if (abs < acc + v) return {input: k, txid: x.inputs[k].txid, vout: x.inputs[k].vout, offset: abs - acc, from: x.inputs[k].address || ''}; acc += v; }
    return null;
  }

  /* ---------- putting the proof together ---------- */
  const okType = t => /^[a-z0-9!#$&^_.+-]{1,40}\/[a-z0-9!#$&^_.+-]{1,60}(\s*;\s*[a-z0-9-]+=[a-z0-9_.-]{1,40})*$/i.test(t || '');
  function buildProvenance(o) {
    const id = o.id, J = o.info || {}, C = {}, diffs = [], W = o.written || {};
    const chk = (name, against, agrees, what, extra) => { C[name] = Object.assign({against, agrees, what}, extra || {}); if (agrees === false) diffs.push(name); };
    // 1. the transactions that wrote it, from their own bytes
    chk('transactionBytes', o.rawSite || null, W.txs && W.txs.length ? W.bytesOk : null,
      W.txs && W.txs.length ? (W.txs.length === 1 ? 'the transaction that wrote it, read from its own bytes (' + (o.rawSite || 'a site') + '), works out to its own id' + (W.txs[0].txid === id.slice(0, 64) ? ', the one in the inscription\'s id' : '') : 'each of the ' + W.txs.length + ' transactions that wrote it, read from its own bytes (' + (o.rawSite || 'a site') + '), works out to its own id' + (W.txs[0] && W.txs[0].txid === id.slice(0, 64) ? ', the first being the one in the inscription\'s id' : '')) : W.error ? 'not read: ' + W.error : 'its bytes could not be had');
    chk('writtenChain', o.secondSite || null, W.txs && W.txs.length ? (W.finished && W.linked ? true : W.capped ? null : false) : null,
      !W.txs || !W.txs.length ? 'not read' : W.finished ? (W.txs.length === 1 ? 'the whole file is in one transaction: its pieces count down to 0 there' : 'the file is written over ' + W.txs.length + ' transactions: each spends the one before (read in its bytes; the next one found on ' + (o.secondSite || 'a second site') + ') and the pieces count down to 0') + (W.linked ? '' : ', but a link did not hold')
        : W.capped ? 'a very big file: the first ' + W.txs.length + ' transactions were read; the rest were not, so the file was not put back together here' : 'the countdown did not reach 0: ' + (W.error || 'the next piece was not found'));
    // 2. the file: its type and size, and its fingerprint against the two copies shown
    const mine = W.finished ? catB(W.body) : null, fp = mine ? hex(sha256(mine)) : null;
    chk('readFromItsBytes', o.infoSite || null, mine ? (W.contentType || '') === (J.contentType || '') : null,
      mine ? 'its file type read in its first transaction (' + (W.contentType || 'none') + ') against the explorer\'s (' + (J.contentType || 'none') + ')' : 'not read: the whole file was not put back together');
    const fpCheck = (name, file, site) => {
      if (!mine) return chk(name, site, null, 'not compared: the file was not put back together from the chain');
      if (!file) return chk(name, site, null, site + ' did not give its copy');
      const theirs = hex(sha256(file)); chk(name, site, theirs === fp, 'the file put back together from the chain (' + mine.length.toLocaleString('en-GB') + ' bytes) against the copy ' + site + ' shows (' + file.length.toLocaleString('en-GB') + ' bytes), SHA-256 of each', {copy: theirs, onChain: fp});
    };
    fpCheck('contentFingerprint', o.file, o.fileSite || 'https://thedoginalsexplorer.com');
    fpCheck('secondCopy', o.file2, o.file2Site || 'https://cdn.doggy.market');
    // 3. the block it was made in: where its last piece went in
    chk('madeInBlock', o.secondSite || null, o.lastBlock != null ? o.lastBlock === J.genesis_height : null,
      o.lastBlock != null ? 'the explorer says block ' + J.genesis_height + '; ' + (o.secondSite || 'the second site') + ' says the transaction that finished writing it is in block ' + o.lastBlock : 'not checked');
    // 4. the trail: from where it sits now, back to the transaction that finished writing it
    const T = o.trail || {};
    chk('trail', o.secondSite || null, T.reached ? T.allChecked !== false : T.lost || T.more || T.error ? null : false,
      T.reached ? (T.steps.length <= 1 ? 'it has not moved since it was written' : 'followed ' + (T.steps.length - 1) + ' move' + (T.steps.length === 2 ? '' : 's') + ' back from where the explorer says it sits now, over the explorer\'s transactions, first in first out; each step checked on ' + (o.secondSite || 'a second site') + ' (it spends the one before)') + (T.allChecked === false ? ': a step did not hold there' : '')
        : T.error ? 'not finished: ' + T.error : T.lost ? 'it went to a miner in a fee: past that block, its trail is in the block\'s fees' : T.more ? 'it moved more than ' + T.steps.length + ' times: the newest moves were checked' : 'the trail did not reach the transactions that wrote it');
    // 5. who holds it now
    const H = o.heldNow;
    chk('heldNow', o.secondSite || null, H ? !H.spent && H.address === J.address : null,
      H ? 'the output it sits in (' + String(J.satpoint).split(':').slice(0, 2).join(':') + ') is ' + (H.spent ? 'spent on ' + (o.secondSite || 'the second site') + ', so it has moved since' : 'unspent on ' + (o.secondSite || 'the second site')) + ', and its address ' + (H.address === J.address ? 'matches' : 'does not match') + ' the holder the explorer names' : 'not checked');
    // 6. its number: one list only
    chk('number', null, null, 'its number (#' + (J.number != null ? Number(J.number).toLocaleString('en-GB') : '?') + ') comes from the explorer only: it is the one Doginals list a web page can ask', {oneListOnly: true});
    const used = Object.values(C).filter(c => !c.oneListOnly), vals = used.map(c => c.agrees), nOk = vals.filter(v => v === true).length, nNo = vals.filter(v => v === false).length, nNone = vals.filter(v => v === null).length;
    const ct = J.contentType || null;
    const R = {
      check: 'Doge Cube Provenance Check ' + VERSION,
      verdict: nNo ? nNo + ' of ' + vals.length + ' checks differ: ' + diffs.join(', ') : nOk + ' of ' + vals.length + ' checks agree' + (nNone ? ', ' + nNone + ' could not be made' : ''),
      inscription: {id, number: J.number != null ? J.number : null, block: J.genesis_height != null ? J.genesis_height : null, startedInBlock: W.txs && W.txs[0] ? W.txs[0].block : null,
        time: J.genesis_time ? new Date(J.genesis_time * 1000).toISOString().replace('.000', '') : null,
        contentType: okType(ct) ? ct : ct ? 'not a standard type' : null, bytes: mine ? mine.length : o.file ? o.file.length : null,
        fingerprint: fp ? {sha256: fp, of: 'the file put back together from the transactions that wrote it'} : null,
        pieces: W.pieces != null ? W.pieces : null, writtenOver: W.txs ? W.txs.map(t => ({txid: t.txid, block: t.block != null ? t.block : null, piecesHere: t.pieces})) : [],
        satpoint: J.satpoint || null, holder: J.address || null, delegate: J.delegate || null, kinds: Array.isArray(J.kinds) ? J.kinds : []},
      checked: C,
      trail: T.steps || [],
      sources: {inscription: o.infoSite || null, secondSite: o.secondSite || null, bytes: o.rawSite || null, file: o.file ? o.fileSite : null, secondCopy: o.file2 ? o.file2Site : null}
    };
    Object.defineProperty(R, '_file', {value: mine ? {bytes: mine, type: W.contentType || J.contentType, from: 'the file put back together from the transactions that wrote it'} : o.file ? {bytes: o.file, type: J.contentType, from: 'the copy the explorer shows (the whole file was not put back together from the chain)'} : null, enumerable: false});
    return R;
  }

  /* ---------- gathering everything, in the same steps for every host ----------
     io: {dx(path) -> the explorer's JSON, raw(txid) -> a transaction's bytes as hex, btc(path) -> Bitcore's JSON,
          file(id) -> the explorer's copy of the file (bytes), file2(id) -> Doggy Market's copy (bytes), sleep(ms)} */
  const TRAIL_MAX = 50, CHAIN_MAX = 120, FILE_MAX = 3000000;
  const isInsId = t => /^[0-9a-f]{64}i\d+$/.test(t);
  async function resolve(q, io) {
    q = String(q == null ? '' : q).trim().toLowerCase().replace(/^#/, '').replace(/[,\s]/g, '');
    if (isInsId(q)) return q;
    if (/^[0-9a-f]{64}$/.test(q)) return q + 'i0';
    if (!/^\d+$/.test(q)) throw new Error('give a Doginal\'s number (#1000) or its ID (64 hex characters, i, a number)');
    let j; try { j = await io.dx('/v1/inscriptions/number/' + q); } catch (e) { throw new Error(/404/.test(String(e)) ? 'there is no Doginal #' + Number(q).toLocaleString('en-GB') + ' (yet)' : 'the explorer did not answer: try again in a moment'); }
    if (!j || !isInsId(String(j.id || ''))) throw new Error('there is no Doginal #' + Number(q).toLocaleString('en-GB') + ' (yet)');
    return j.id;
  }
  async function gather(q, io, progress) {
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const id = await resolve(q, io), gen = id.slice(0, 64);
    say('found', id);
    const J = await io.dx('/v1/inscription/' + id); say('info', true);
    // the copies of the file, while the chain is read
    const files = Promise.allSettled([io.file(id), io.file2(id)]);
    // 1. the transactions that wrote it, from their own bytes, forward from the first
    const W = {txs: [], body: [], bytesOk: true, linked: true, finished: false};
    try {
      let tx = parseTx(fromHex(await io.raw(gen)));
      if (tx.txid !== gen) W.bytesOk = false;
      const S = inscriptionStart(tx); if (!S) throw new Error('no Doginal starts in its first transaction');
      W.contentType = S.contentType; W.pieces = S.pieces; W.body.push(...S.body); W.txs.push({txid: tx.txid, pieces: S.body.length}); W.finished = S.finished;
      let last = S.last;
      say('chain', W.txs.length);
      while (!W.finished) {
        if (W.txs.length >= CHAIN_MAX) { W.capped = true; break; }
        const coins = await io.btc('/tx/' + tx.txid + '/coins'), spenders = [...new Set((coins.outputs || []).map(c => c.spentTxid).filter(Boolean))];
        if (!spenders.length) throw new Error('the next piece has not been written yet (no transaction spends ' + tx.txid.slice(0, 12) + '…)');
        let next = null, M = null;
        for (const s of spenders) { const t2 = parseTx(fromHex(await io.raw(s))); if (t2.txid !== s) { W.bytesOk = false; continue; } const m = inscriptionMore(t2, tx.txid, last); if (m) { next = t2; M = m; break; } }
        if (!next) { W.linked = false; throw new Error('no transaction after ' + tx.txid.slice(0, 12) + '… carries the next piece'); }
        W.body.push(...M.body); W.txs.push({txid: next.txid, pieces: M.body.length}); W.finished = M.finished; last = M.last; tx = next;
        say('chain', W.txs.length);
      }
    } catch (e) { W.error = String(e && e.message || e); }
    // the blocks the writing went into (the second site)
    let lastBlock = null;
    for (const t of [W.txs[0], W.txs[W.txs.length - 1]].filter(Boolean)) { if (t.block != null) continue; try { const x = await io.btc('/tx/' + t.txid); t.block = x.blockHeight > 0 ? x.blockHeight : null; } catch (e) {} }
    if (W.finished && W.txs.length) lastBlock = W.txs[W.txs.length - 1].block;
    say('blocks', true);
    // 2. the trail, from where it sits now back to the transactions that wrote it
    const written = new Set(W.txs.map(t => t.txid)), T = {steps: [], reached: false, allChecked: true};
    let [txid, vout, off] = String(J.satpoint || '').split(':'); vout = +vout; off = +off;
    let heldNow = null;
    try {
      if (!/^[0-9a-f]{64}$/.test(txid || '') || !(vout >= 0) || !(off >= 0)) throw new Error('where it sits now could not be read');
      try { const c = await io.btc('/tx/' + txid + '/coins'), out = (c.outputs || []).find(x => x.mintIndex === vout); if (out) heldNow = {spent: !!out.spentTxid, address: out.address || ''}; } catch (e) {}
      for (;;) {
        if (written.has(txid) || txid === gen) { T.steps.push({txid, written: true}); T.reached = true; break; }
        if (T.steps.length >= TRAIL_MAX) { T.more = true; break; }
        const x = await io.dx('/v1/tx/' + txid), o = (x.outputs || [])[vout];
        if (x.inputs_truncated) throw new Error('a transaction on the trail has too many inputs to follow');
        T.steps.push({txid, block: x.block_height || null, time: x.time ? new Date(x.time * 1000).toISOString().replace('.000', '') : null, to: o && o.address || '', waiting: !(x.block_height > 0) || undefined});
        if (x.coinbase) { T.lost = true; T.steps[T.steps.length - 1].toMiner = true; break; }
        const b = stepBack(x, vout, off);
        if (!b) throw new Error('its trail could not be followed past ' + txid.slice(0, 12) + '…');
        // the second site: the output it came from was spent by this transaction
        try { const c = await io.btc('/tx/' + b.txid + '/coins'), out = (c.outputs || []).find(y => y.mintIndex === b.vout); const ok = !!out && out.spentTxid === txid; T.steps[T.steps.length - 1].checked = ok; if (!ok) T.allChecked = false; }
        catch (e) { T.steps[T.steps.length - 1].checked = null; T.allChecked = false; }
        txid = b.txid; vout = b.vout; off = b.offset;
        say('trail', T.steps.length);
      }
    } catch (e) { T.error = String(e && e.message || e); }
    T.steps.reverse();   // (oldest first)
    const F = await files;
    say('done', true);
    const rawFrom = new Set(); if (io.rawFrom) for (const t of W.txs) { const f = io.rawFrom.get(t.txid); if (f) rawFrom.add(f); }   // (which site gave the bytes: see doge-manifest.js)
    return addWhatIsInIt(buildProvenance({id, info: J, infoSite: 'https://thedoginalsexplorer.com', written: W, rawSite: rawFrom.size ? [...rawFrom].join(' and ') : 'https://api.blockchair.com', secondSite: 'https://api.bitcore.io',
      file: F[0].status === 'fulfilled' ? F[0].value : null, fileSite: 'https://thedoginalsexplorer.com', file2: F[1].status === 'fulfilled' ? F[1].value : null, file2Site: 'https://cdn.doggy.market',
      lastBlock, trail: T, heldNow}), io.media);
  }

  // (15 Nov 2026) what is in the file it proved, read by the Media Reader (media.js) when the host gives it as io.media:
  // the file put back together from the chain where it could be, else the copy shown (and it says which)
  async function addWhatIsInIt(R, media) {
    const f = R && R._file;
    if (!media || !f || !f.bytes || !f.bytes.length) { if (R && media && f && f.none) R.whatIsInIt = {none: f.none}; return R; }
    try { const r = await media.read(f.bytes, f.type); r.readFrom = f.from; r.says = media.describe(r); R.whatIsInIt = r; }
    catch (e) { R.whatIsInIt = {readFrom: f.from, error: 'it could not be read: ' + (e.message || e)}; }
    return R;
  }


  return {VERSION, sha256, hex, fromHex, parseTx, inscriptionStart, inscriptionMore, stepBack, buildProvenance, resolve, gather, TRAIL_MAX, CHAIN_MAX, FILE_MAX};
});
