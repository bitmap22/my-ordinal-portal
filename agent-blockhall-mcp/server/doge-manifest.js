/* Doge Cube's Block Manifest, by bitmap22. Always free. The Dogecoin twin of Agent Blockhall's Block Manifest (manifest.js).
   Reads a whole Dogecoin block the way Doge Cube's halls do (https://bitmap22.github.io/my-ordinal-portal/doge-cube.html): every
   transaction, sorted into the same kinds as Doge Cube's parcel types (inscriptions and their file types, dogemaps, names, DRC-20,
   TAP, dunes, and how each transaction pays), with its fee and size, and checked against the chain itself:
   - the block's hash is worked out from its own header (its six fields) and asked of a second site;
   - the list of transactions is proved complete and in order: their ids, folded together the way the chain does it (the merkle
     root), must give the root written in that header;
   - every transaction that carries something (an inscription, OP_RETURN data) and the coinbase are read from their own bytes,
     each one hashed to make sure the bytes are that transaction; what is read there is matched with the explorer's reading;
   - each size and fee is matched between two sites.
   The same file is for the portal's Doge Block Manifest page and the free Agent Blockhall MCP tool. It only reads and works things
   out: fetching is left to whoever uses it. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.DogeManifest = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const U8D = new TextDecoder('utf-8'), L1D = new TextDecoder('latin1'), U8F = new TextDecoder('utf-8', {fatal: true});

  /* ---------- SHA-256 (for each transaction's id, the merkle root and the block's hash) ---------- */
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
    0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138,
    0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624,
    0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f,
    0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const W = new Uint32Array(64);
  function sha256(m) {
    const l = m.length, n = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(n);
    b.set(m); b[l] = 0x80;
    const bits = l * 8; for (let i = 0; i < 8; i++) b[n - 1 - i] = Math.floor(bits / 2 ** (8 * i)) & 255;
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = b[o + 4 * i] << 24 | b[o + 4 * i + 1] << 16 | b[o + 4 * i + 2] << 8 | b[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const x = W[i - 15], y = W[i - 2];
        const s0 = (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3, s1 = (y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ y >>> 10;
        W[i] = W[i - 16] + s0 + W[i - 7] + s1;
      }
      let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7), ch = e & f ^ ~e & g, t1 = h + S1 + ch + K[i] + W[i] | 0;
        const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10), mj = a & bb ^ a & c ^ bb & c, t2 = S0 + mj | 0;
        h = g; g = f; f = e; e = d + t1 | 0; d = c; c = bb; bb = a; a = t1 + t2 | 0;
      }
      h0 = h0 + a | 0; h1 = h1 + bb | 0; h2 = h2 + c | 0; h3 = h3 + d | 0; h4 = h4 + e | 0; h5 = h5 + f | 0; h6 = h6 + g | 0; h7 = h7 + h | 0;
    }
    const out = new Uint8Array(32), H = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = H[i] >>> 16 & 255; out[4 * i + 2] = H[i] >>> 8 & 255; out[4 * i + 3] = H[i] & 255; }
    return out;
  }
  const dsha = u => sha256(sha256(u));
  const revHex = u => { let s = ''; for (let i = u.length - 1; i >= 0; i--) s += u[i].toString(16).padStart(2, '0'); return s; };
  const hashHex = u => revHex(dsha(u));
  function fromHex(h) {
    h = String(h || '').trim(); if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error('not hex');
    const u = new Uint8Array(h.length >> 1); for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16); return u;
  }
  const revBytes = h => fromHex(h).reverse();
  const le32 = n => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n >>> 0, true); return a; };
  const catB = list => { let n = 0; for (const a of list) n += a.length; const o = new Uint8Array(n); let k = 0; for (const a of list) { o.set(a, k); k += a.length; } return o; };

  /* ---------- the header: its hash from its six fields, and the merkle root from the transactions' ids ---------- */
  // f: {version, previous, merkle_root, time, bits, nonce} (bits as hex, as written in explorers). Dogecoin's block hash is the
  // double SHA-256 of these 80 bytes, merge-mined (AuxPoW) or not; its proof of work is checked differently (Scrypt), and is not
  // what names it.
  function headerHash(f) {
    const hdr = catB([le32(+f.version), revBytes(f.previous || '0'.repeat(64)), revBytes(f.merkle_root), le32(+f.time), revBytes(String(f.bits).padStart(8, '0')), le32(+f.nonce)]);
    if (hdr.length !== 80) throw new Error('the header is not 80 bytes');   // (block 0 has no block before it: 32 zero bytes there, as the chain has them)
    return hashHex(hdr);
  }
  function merkleRoot(ids) {
    if (!ids.length) return null;
    let lvl = ids.map(revBytes);
    while (lvl.length > 1) { if (lvl.length % 2) lvl.push(lvl[lvl.length - 1]); const n = []; for (let i = 0; i < lvl.length; i += 2) n.push(dsha(catB([lvl[i], lvl[i + 1]]))); lvl = n; }
    return revHex(lvl[0]);
  }
  const MERGE_MINED_FROM = 371337;   // (AuxPoW: Dogecoin is merge-mined with Litecoin from this block; its header's version has bit 0x100)

  /* ---------- the kinds: the same names, in the same order, as Doge Cube's parcel-type chips ---------- */
  const KINDS = [
    ['inscriptions', 'inscriptions'], ['images', 'inscriptions'], ['text', 'inscriptions'], ['HTML', 'inscriptions'], ['JSON', 'inscriptions'],
    ['audio / video', 'inscriptions'], ['3D models', 'inscriptions'], ['other files', 'inscriptions'], ['delegates', 'inscriptions'],
    ['dogemaps', 'inscriptions'], ['names', 'inscriptions'],
    ['DRC-20', 'tokens'], ['TAP', 'tokens'], ['dunes', 'tokens'], ['dunes etched', 'tokens'], ['dunes minted', 'tokens'], ['dunes moved', 'tokens'],
    ['pay to script', 'transactions'], ['pay to address', 'transactions'], ['pay to key', 'transactions'], ['consolidations', 'transactions'],
    ['batch payouts', 'transactions'], ['multisig', 'transactions'], ['OP_RETURN data', 'transactions'], ['coinbase', 'transactions']];
  const KIND_NAMES = KINDS.map(k => k[0]).concat(['regular']);
  const KIND_GROUPS = Object.assign(Object.fromEntries(KINDS), {regular: 'transactions'});
  // the kinds that make a transaction more than a regular payment (Doge Cube's ordinal kinds)
  const SPECIAL = new Set(['inscriptions', 'dogemaps', 'names', 'DRC-20', 'TAP', 'dunes']);
  // a file type as Doge Cube sorts it
  const fileKind = ct => { const ty = (String(ct || '').split(';')[0] || '').trim().toLowerCase();
    return /^image\//.test(ty) ? 'images' : /html/.test(ty) ? 'HTML' : /json/.test(ty) ? 'JSON' : /^text\//.test(ty) ? 'text' : /^(audio|video)\//.test(ty) ? 'audio / video' : /^model\//.test(ty) ? '3D models' : 'other files'; };
  // a content type as written in the inscription, kept only if it looks like one (it is written by whoever inscribed it)
  const ctype = ty => /^[a-z0-9!#$&^_.+-]{1,40}\/[a-z0-9!#$&^_.+-]{1,60}(;[ -~]{0,60})?$/i.test(ty) ? ty : ty ? 'not a standard type' : '';

  /* ---------- reading a transaction's own bytes ---------- */
  function pushes(s, a, b) {
    const o = []; let i = a;
    while (i < b) {
      const opc = s[i++]; let n = opc === 0 ? 0 : -1;
      if (opc >= 1 && opc <= 75) n = opc; else if (opc === 76) n = s[i++]; else if (opc === 77) { n = s[i] | s[i + 1] << 8; i += 2; }
      else if (opc === 78) { n = (s[i] | s[i + 1] << 8 | s[i + 2] << 16 | s[i + 3] << 24) >>> 0; i += 4; }
      if (n < 0) { o.push([opc, null]); continue; }
      if (i + n > b) { o.bad = true; break; }
      o.push([opc, s.subarray(i, i + n)]); i += n;
    }
    return o;
  }
  // a number as Doginals writes its piece counts: OP_0, OP_1..OP_16, or a short push of a little-endian number
  function pieceNum(x) {
    if (!x) return null; const [opc, d] = x;
    if (opc === 0) return 0;
    if (opc >= 0x51 && opc <= 0x60) return opc - 0x50;
    if (d && d.length >= 1 && d.length <= 4) { let v = 0; for (let i = d.length - 1; i >= 0; i--) v = v * 256 + d[i]; return v; }
    return null;
  }
  // readable words: mostly printable characters
  function words(u) {
    if (u.length < 3) return null;
    let raw; try { raw = U8F.decode(u); } catch (e) { return null; }
    const cs = [...raw]; let ok = 0; for (const ch of cs) { const c = ch.codePointAt(0); if ((c >= 32 && c !== 127 && !(c >= 0x80 && c < 0xa0)) || c === 10 || c === 9) ok++; }
    if (ok / cs.length < 0.95) return null;
    const t = raw.replace(/[\u0000-\u001f\u007f�]+/g, ' ').trim();
    return /[a-z]{2}/i.test(t) ? (t.length > 300 ? t.slice(0, 300) + '…' : t) : null;
  }
  function coinbaseWords(u) {
    const parts = []; let i = 0;
    while (i < u.length) {
      const opc = u[i]; let n = -1, h = 1;
      if (opc >= 1 && opc <= 75) n = opc; else if (opc === 76) { n = u[i + 1]; h = 2; } else if (opc === 77) { n = u[i + 1] | u[i + 2] << 8; h = 3; }
      else if (opc === 0 || opc === 79 || (opc >= 81 && opc <= 96)) { i++; continue; } else break;
      if (!(n >= 0) || i + h + n > u.length) break;
      parts.push(u.subarray(i + h, i + h + n)); i += h + n;
    }
    const runs = (i === u.length ? parts : [u]).flatMap(b => L1D.decode(b).match(/[\x20-\x7e]{4,}/g) || []);
    return runs.map(r => r.trim()).filter(r => /[a-z]{2}/i.test(r)).join(' · ');
  }
  // a dune's name, from its number (the same letters-as-digits as ord's runes)
  function duneName(n, sp) {
    n += 1n; let s = '';
    while (n > 0n) { s = String.fromCharCode(65 + Number((n - 1n) % 26n)) + s; n = (n - 1n) / 26n; }
    if (!sp) return s;
    let o = ''; for (let i = 0; i < s.length; i++) { o += s[i]; if (i < s.length - 1 && (sp >> BigInt(i)) & 1n) o += '•'; }
    return o;
  }
  // a dunestone (Dogecoin's runestone, from ord-with-dunes, as Doge Cube reads it): OP_RETURN, a push of the letter D, then LEB128
  // numbers in tag/value pairs; tag 0 starts the edicts (each: a step to the dune's id, an amount, an output). An edict whose id has
  // the claim bit is a mint
  const DUNE_CLAIM = 1n << 48n;
  function dunestone(s) {
    const pay = catB(pushes(s, 3, s.length).filter(x => x[1]).map(x => x[1])), ints = [];
    for (let i = 0; i < pay.length;) { let v = 0n, sh = 0n, c; do { c = pay[i++]; v |= BigInt(c & 127) << sh; sh += 7n; } while (c & 128 && i < pay.length); ints.push(v); }
    const F = {}; let mint = false, move = false;
    for (let k = 0; k < ints.length; k += 2) {
      if (ints[k] === 0n) { let id = 0n; for (let j = k + 1; j + 2 < ints.length; j += 3) { id += ints[j]; if ((id & DUNE_CLAIM) !== 0n) mint = true; else move = true; } break; }
      if (k + 1 < ints.length) (F[ints[k]] = F[ints[k]] || []).push(ints[k + 1]);
    }
    const fl = F[2] ? F[2][0] : 0n, prem = F[22] ? F[22][0] : 0n, etch = !!((fl & 1n) || F[4] || prem > 0n);
    const c = F[5] && F[5][0] <= 0x10ffffn ? Number(F[5][0]) : -1;
    return {etch, mint, move, name: F[4] ? duneName(F[4][0], F[3] && F[3][0]) : null, symbol: c >= 32 && (c < 0xd800 || c > 0xdfff) ? String.fromCodePoint(c) : null};
  }
  // a name in the Dogecoin Names System (as Doge Cube reads it): label.namespace, each 1-63 letters, digits or hyphens
  function dnsName(tok) {
    let s = String(tok || ''); try { s = s.normalize('NFKC'); } catch (e) {}
    s = s.toLowerCase(); const i = s.indexOf('.');
    if (i <= 0 || s.indexOf('.', i + 1) >= 0) return null;
    const a = s.slice(0, i), b = s.slice(i + 1), ok = x => x.length >= 1 && x.length <= 63 && !/^-|-$/.test(x) && /^[\p{L}\p{N}\p{Emoji_Presentation}-]+$/u.test(x);
    if (!ok(a) || !ok(b) || b === 'bitmap' || b.startsWith('dogemap')) return null;
    return a + '.' + b;
  }
  const sx = (v, n) => String(v == null ? '' : v).slice(0, n);
  const tok = (protocol, u) => { const o = {}; for (const k in u) if (u[k] != null && u[k] !== '') o[k] = u[k]; return Object.assign({protocol}, Object.keys(o).length ? {untrusted: o} : {}); };
  // what a finished inscription's file says (Doge Cube's rules): a dogemap claim, a DRC-20 step, a name, TAP
  function readBody(ct, u, r) {
    const ty = (String(ct || '').split(';')[0] || '').trim().toLowerCase();
    if (/^image\//.test(ty) || !u.length) return;
    const s = U8D.decode(u.subarray(0, 8000)).trim(), plain = ty.startsWith('text/plain') || ty.startsWith('application/json');
    const dm = /^(0|[1-9]\d{0,9})\.dogemap$/i.exec(s);
    if (dm) { r.kinds.add('dogemaps'); r.dogemap = +dm[1]; return; }
    if (s[0] === '{') {
      let o = null; try { o = JSON.parse(s); } catch (e) {}
      const p = o && typeof o === 'object' ? String(o.p || '') : '';
      if (p === 'drc-20' && plain && u.length >= 40 && /^(deploy|mint|transfer)$/.test(String(o.op)) && typeof o.tick === 'string') {
        r.kinds.add('DRC-20'); r.token = tok('DRC-20', {tick: sx(o.tick, 16), op: sx(o.op, 12), amount: o.amt != null ? sx(o.amt, 40) : o.max != null ? sx(o.max, 40) : null});
      } else if (p === 'dns' && plain) { r.kinds.add('names'); const nm = dnsName(o.name); r.name = {untrusted: nm || sx(o.op || 'dns', 24)}; }
      else if (p.toLowerCase() === 'tap') { r.kinds.add('TAP'); const items = Array.isArray(o.items) ? o.items : []; r.token = tok('TAP', {tick: sx(o.tick || (items[0] && items[0].tick), 16), op: sx(o.op, 16)}); }
      return;
    }
    if (plain) { const nm = dnsName(s.split(/\s+/)[0]); if (nm) { r.kinds.add('names'); r.name = {untrusted: nm}; } }
  }
  // an output script's kind, as explorers name it
  function outKind(s) {
    const l = s.length;
    if (l && s[0] === 0x6a) return 'nulldata';
    if (l === 25 && s[0] === 0x76 && s[1] === 0xa9 && s[2] === 20 && s[23] === 0x88 && s[24] === 0xac) return 'pubkeyhash';
    if (l === 23 && s[0] === 0xa9 && s[1] === 20 && s[22] === 0x87) return 'scripthash';
    if ((l === 35 && s[0] === 33 || l === 67 && s[0] === 65) && s[l - 1] === 0xac) return 'pubkey';
    if (l >= 37 && s[l - 1] === 0xae && s[0] >= 0x51 && s[0] <= 0x60) return 'multisig';
    return 'nonstandard';
  }
  // how the first input pays (Doge Cube sorts by the first input's address: D… a key's hash, 9… or A… a script, else a bare key)
  function inKind(s) {
    const P = pushes(s, 0, s.length); if (P.bad || !P.length) return 'pay to script';
    const data = P.every(x => x[1] !== null && x[0] !== 0);
    if (data && P.length === 1 && P[0][1].length >= 9 && P[0][1].length <= 73 && P[0][1][0] === 0x30) return 'pay to key';
    if (data && P.length === 2 && P[0][1][0] === 0x30 && (P[1][1].length === 33 && (P[1][1][0] === 2 || P[1][1][0] === 3) || P[1][1].length === 65 && P[1][1][0] === 4)) return 'pay to address';
    return 'pay to script';
  }
  // one transaction from its bytes: its id (the hash of the bytes), its size, and what it carries
  function readTx(u, coinbase) {
    let p = 0;
    const vi = () => { const f = u[p++]; if (f < 253) return f; const n = f === 253 ? 2 : f === 254 ? 4 : 8; let v = 0; for (let i = 0; i < n; i++) v += u[p++] * 2 ** (8 * i); return v; };
    p = 4;
    if (u[p] === 0 && u[p + 1] === 1) throw new Error('segwit is not used on Dogecoin');
    const nin = vi(), ins = [];
    for (let i = 0; i < nin; i++) { p += 36; const l = vi(); ins.push(u.subarray(p, p + l)); p += l + 4; }
    const nout = vi(), outs = [];
    for (let i = 0; i < nout; i++) { p += 8; const l = vi(); outs.push(u.subarray(p, p + l)); p += l; }
    p += 4;
    if (p !== u.length) throw new Error('the transaction\'s bytes do not end where they should');
    const r = {txid: hashHex(u), size: u.length, nin, nout, kinds: new Set(), ins: [], outTypes: outs.map(outKind)};
    if (coinbase) { r.kinds.add('coinbase'); r.coinbaseWords = ins[0] ? coinbaseWords(ins[0]) : ''; return r; }
    r.payKind = inKind(ins[0] || new Uint8Array(0));
    // inscriptions (Doginals: the script that spends an input starts with "ord", a count of the pieces still to come, the content type,
    // then each piece after its count, counting down to 0; a file too big for one transaction carries on in the next ones)
    for (let i = 0; i < ins.length; i++) {
      const P = pushes(ins[i], 0, ins[i].length); if (P.bad || P.length < 3) continue;
      const first = P[0][1];
      if (first && first.length === 3 && first[0] === 0x6f && first[1] === 0x72 && first[2] === 0x64) {
        const n0 = pieceNum(P[1]), ct = P[2][1] ? U8D.decode(P[2][1]).slice(0, 120) : '';
        if (n0 == null || !P[2][1]) continue;
        const body = []; let j = 3, last = n0, finished = false;
        while (j + 1 < P.length) { const k = pieceNum(P[j]); if (k == null || !P[j + 1][1] || k >= last) break; body.push(P[j + 1][1]); last = k; j += 2; if (k === 0) { finished = true; break; } }
        const bytes = body.reduce((n, x) => n + x.length, 0);
        r.ins.push({input: i, contentType: ctype(ct) || 'unknown', pieces: n0, piecesHere: body.length, bytesHere: bytes, finishedHere: finished});
        r.kinds.add('inscriptions'); r.kinds.add(fileKind(ct));
        if (finished) readBody(ct, catB(body), r);
      } else if (i === 0 && r.ins.length === 0) {
        // a later piece of a bigger file: the script starts with a count and a piece (a multisig spend starts OP_0 then signatures and
        // ends with its script; that is not a piece)
        const k = pieceNum(P[0]), lastPush = P[P.length - 1][1];
        const msig = lastPush && lastPush.length > 3 && lastPush[lastPush.length - 1] === 0xae && lastPush[0] >= 0x51 && lastPush[0] <= 0x60;
        if (k != null && P[1][1] && P[1][1].length > 0 && !msig && !(P[0][1] && P[0][1].length > 4)) {
          let j = 0, last = k + 1, n = 0, end = false;
          while (j + 1 < P.length) { const q = pieceNum(P[j]); if (q == null || q >= last || !P[j + 1][1]) break; last = q; n++; j += 2; if (q === 0) { end = true; break; } }
          if (n) r.piece = {piecesHere: n, last: end};
        }
      }
    }
    // OP_RETURN data: a dune step, or words
    for (const s of outs) {
      if (s[0] !== 0x6a) continue;
      r.kinds.add('OP_RETURN data');
      if (s.length >= 3 && s[1] === 1 && s[2] === 0x44) {
        const d = dunestone(s); r.kinds.add('dunes');
        if (d.etch) r.kinds.add('dunes etched'); if (d.mint) r.kinds.add('dunes minted'); if (d.move) r.kinds.add('dunes moved');
        r.dune = {etched: d.etch ? d.name : undefined, symbol: d.etch ? d.symbol || undefined : undefined, minted: d.mint || undefined, moved: d.move || undefined};
      } else if (s.length > 1) { const w = words(catB(pushes(s, 1, s.length).filter(x => x[1]).map(x => x[1]))); if (w && !r.message) r.message = w; }
    }
    if (r.outTypes.includes('multisig')) r.kinds.add('multisig');
    return r;
  }

  /* ---------- the transactions' kinds as the explorer reports them (Doge Cube's way) ---------- */
  // x: the explorer's transaction (inputs with addresses, outputs with types) and its block-list entry (its inscription, if any)
  function explorerKinds(x, listed, coinbase) {
    const k = new Set();
    if (coinbase) { k.add('coinbase'); return k; }
    const outT = (x && x.outputs || []).map(o => o.type || ''), a = x && x.inputs && x.inputs[0] ? String(x.inputs[0].address || '') : '';
    if (outT.includes('nulldata')) k.add('OP_RETURN data');
    if (outT.includes('multisig')) k.add('multisig');
    if (outT.filter(t => t !== 'nulldata').length >= 10) k.add('batch payouts');
    if (x) k.add(/^D/.test(a) ? 'pay to address' : /^[9A]/.test(a) ? 'pay to script' : 'pay to key');   // (only once its inputs are known)
    const nin = x ? (x.inputs || []).length : listed.inputs, nout = x ? (x.outputs || []).length : listed.outputs;
    if (nin >= 3 && nout === 1) k.add('consolidations');
    if (listed && listed.inscription) { k.add('inscriptions'); k.add(fileKind(listed.inscription.contentType)); if (listed.inscription.delegate) k.add('delegates'); }
    return k;
  }

  /* ---------- the manifest: the readings joined, and every item checked ----------
     buildManifest(o) - o:
       height; header: the explorer's block (version, previous, merkle_root, time, bits, nonce, hash); headerSite
       list: the explorer's transactions in block order [{txid, inputs, outputs, inscription}] (its block listing); listSite
       details: Map txid -> the explorer's own transaction (inputs with addresses, outputs with types, size, fee) (optional per item)
       second: [{txid, size, fee}] from a second site (Bitcore), secondHash, secondSite
       raw: Map txid -> that transaction's own bytes (Uint8Array), rawSite; rawWanted: how many were asked for
       dunesMade: Map dune name (no dots) -> its id (height:index) or null if the explorer has no such dune (optional) */
  function buildManifest(o) {
    const L = o.list || [], N = L.length, sec = new Map((o.second || []).map(x => [x.txid, x])), raw = o.raw || new Map(), det = o.details || new Map();
    const ids = L.map(t => t.txid), root = merkleRoot(ids), ownHash = o.header ? headerHash(o.header) : null;
    const counts = {}; for (const k of KIND_NAMES) counts[k] = 0;
    let sizeOk = 0, sizeBoth = 0, feeOk = 0, feeBoth = 0, inSecond = 0, kindsBoth = 0, kindsAgree = 0, insBoth = 0, insAgree = 0, rawRead = 0, rawBad = 0, totalFee = 0, feesKnown = 0, pieces = 0;
    let coinbase = null; const disagree = [], items = new Array(N), etchTried = [];
    const SPEC2 = ['inscriptions', 'OP_RETURN data', 'multisig', 'coinbase', 'pay to script', 'pay to address', 'pay to key'];   // (the kinds both readings can see)
    for (let i = 0; i < N; i++) {
      const l = L[i], x = det.get(l.txid) || null, s2 = sec.get(l.txid) || null, cb = i === 0;
      let r = null; const u = raw.get(l.txid);
      if (u) { try { r = readTx(u, cb); if (r.txid !== l.txid) { r = null; rawBad++; } else rawRead++; } catch (e) { r = null; rawBad++; } }
      const ek = explorerKinds(x, l, cb), kinds = new Set(ek), diff = [];
      if (r) {
        // the kinds read in the bytes, added (and, where both readings can see a kind, compared)
        for (const k of r.kinds) kinds.add(k);
        if (!cb) { for (const k of ['pay to script', 'pay to address', 'pay to key']) kinds.delete(k); kinds.add(r.payKind); if (r.nin >= 3 && r.nout === 1) kinds.add('consolidations'); if (r.outTypes.filter(t => t !== 'nulldata').length >= 10) kinds.add('batch payouts'); }
        if (x || cb) {
          kindsBoth++;
          for (const k of SPEC2) { const a = cb ? k === 'coinbase' : k.startsWith('pay to') ? r.payKind === k : r.kinds.has(k), b = ek.has(k); if (a !== b) diff.push(k + (a ? ' (its bytes only)' : ' (the explorer only)')); }
          if (!diff.length) kindsAgree++; else if (disagree.length < 50) disagree.push({n: i, txid: l.txid, differ: diff});
        }
      }
      if (!kinds.has('coinbase') && ![...kinds].some(k => SPECIAL.has(k))) kinds.add('regular');
      const kl = KIND_NAMES.filter(k => kinds.has(k)); for (const k of kl) counts[k]++;
      // inscriptions: the explorer's list against what the bytes say
      let ic = null;
      if (r && (r.ins.length || l.inscription)) { insBoth++; ic = r.ins.length === (l.inscription ? 1 : 0) && (!l.inscription || !r.ins.length || fileKind(r.ins[0].contentType) === fileKind(l.inscription.contentType)); if (ic) insAgree++; else if (disagree.length < 50) disagree.push({n: i, txid: l.txid, differ: ['inscriptions: ' + r.ins.length + ' read in its bytes' + (r.ins[0] ? ' (' + r.ins[0].contentType + ')' : '') + ', ' + (l.inscription ? '1 (' + (l.inscription.contentType || '?') + ')' : '0') + ' listed by the explorer']}); }
      // size and fee: the explorer against the second site (and the bytes, where read)
      const sizeX = x && x.size != null ? +x.size : null, size2 = s2 ? +s2.size : null, size = r ? r.size : sizeX != null ? sizeX : size2;
      let sc = null; const sizes = [r && r.size, sizeX, size2].filter(v => v != null);
      if (sizes.length >= 2) { sizeBoth++; sc = sizes.every(v => v === sizes[0]); if (sc) sizeOk++; }
      const feeX = x ? (cb ? 0 : x.fee_satoshis != null ? +x.fee_satoshis : null) : null, fee2 = s2 ? (cb ? 0 : +s2.fee) : null, fee = feeX != null ? feeX : fee2;
      let fc = null; if (feeX != null && fee2 != null) { feeBoth++; fc = feeX === fee2; if (fc) feeOk++; }
      if (s2) inSecond++;
      if (fee != null && !cb) { totalFee += fee; feesKnown++; }
      const it = {n: i, txid: l.txid, fee, size, feeRate: fee != null && size ? +(fee / size / 1e5).toFixed(5) : null, kinds: kl};
      if (r && r.ins.length) it.inscriptions = r.ins.map((y, j) => Object.assign({id: l.inscription && j === 0 ? l.inscription.id : null}, y, {readFrom: 'its own bytes'}));
      else if (l.inscription) it.inscriptions = [{id: l.inscription.id, contentType: ctype(l.inscription.contentType || '') || 'unknown', delegate: !!l.inscription.delegate || undefined, readFrom: 'the explorer (its bytes were not read)'}];
      if (r && r.piece) { it.piece = r.piece; pieces++; }
      if (r && r.token) it.token = r.token;
      if (r && r.dogemap != null) it.dogemap = r.dogemap;
      if (r && r.name) it.name = r.name;
      if (r && r.dune) { it.dune = r.dune; if (r.dune.etched) etchTried.push(it); }
      if (r && r.message) it.message = {untrusted: r.message};
      if (cb && r) coinbase = r.coinbaseWords;
      it.checked = {inList: root != null && o.header ? root === o.header.merkle_root : null, size: sc, fee: fc, kinds: r && (x || cb) ? !diff.length : null, inscriptions: ic, ownBytes: r ? true : u ? false : null};
      items[i] = it;
    }
    // dunes etched: an etching only makes its dune if the name was free and the rules were kept
    let etched = undefined;
    if (etchTried.length) {
      if (o.dunesMade) { let made = 0; for (const it of etchTried) { const id = o.dunesMade.get(String(it.dune.etched).replace(/•/g, '')); it.dune.made = id === o.height + ':' + it.n; if (it.dune.made) made++; else { const k = it.kinds.indexOf('dunes etched'); if (k >= 0) { it.kinds.splice(k, 1); counts['dunes etched']--; } } }
        etched = {made, tried: etchTried.length, what: 'etchings read in their bytes, against the explorer\'s list of dunes (an etching only makes its dune if the name was free)'}; }
      else etched = {made: null, tried: etchTried.length, what: 'not checked: an etching only makes its dune if the name was free'};
    }
    let pool = null; for (const [re, nm] of POOLS) if (re.test(coinbase || '')) { pool = nm; break; }
    const hdr = o.header || {}, secH = o.secondHash ? {against: o.secondSite, agrees: o.secondHash === hdr.hash} : null;
    const wanted = o.rawWanted != null ? o.rawWanted : raw.size;
    return {
      manifest: 'Doge Cube Block Manifest ' + VERSION,
      block: {height: o.height, dogemap: o.height + '.dogemap', hash: hdr.hash || null, time: hdr.time ? new Date(hdr.time * 1000).toISOString().replace('.000', '') : null,
        transactions: N, totalFees: feesKnown ? totalFee : null, feesUnit: 'koinu (1 DOGE = 100,000,000 koinu)', mergeMined: hdr.version != null ? ((+hdr.version) & 0x100) !== 0 : null,
        minedBy: pool, coinbaseWords: coinbase ? {untrusted: coinbase} : null, piecesOfBiggerFiles: pieces || undefined},
      counts: Object.fromEntries(Object.entries(counts).filter(([, v]) => v)),
      checked: {
        blockHash: {fromItsOwnHeader: ownHash != null && ownHash === hdr.hash, secondSite: secH, what: 'the hash worked out from the header\'s six fields (' + o.headerSite + '), then asked of a second site'},
        transactionList: {provedByMerkleRoot: root != null && root === hdr.merkle_root, transactions: N, what: 'every transaction id in ' + o.listSite + '\'s list, folded together the way the chain does it, gives the merkle root written in the block\'s header: so the list is complete, in order, and nothing else'},
        secondList: {matched: inSecond, of: N, what: 'transactions also in ' + o.secondSite + '\'s list for this block'},
        sizes: {matched: sizeOk, of: sizeBoth, what: 'each size from ' + o.listSite + ', ' + o.secondSite + ' and, where read, the transaction\'s own bytes'},
        fees: {matched: feeOk, of: feeBoth, what: 'each fee from ' + o.listSite + ' against ' + o.secondSite},
        ownBytes: {read: rawRead, of: wanted, failed: rawBad || undefined, what: 'transactions that carry something (an inscription, OP_RETURN data) and the coinbase, each read from its own bytes (' + (o.rawSite || 'no site') + ') and hashed to make sure the bytes are that transaction'},
        kinds: {agreed: kindsAgree, of: kindsBoth, what: 'inscriptions, OP_RETURN data, multisig and how it pays: its own bytes against the explorer\'s reading'},
        inscriptions: {agreed: insAgree, of: insBoth, listed: L.filter(t => t.inscription).length, what: 'inscriptions read in each transaction\'s bytes against the explorer\'s list (the only Doginals list a web page can ask)'},
        dunesEtched: etched,
        differences: disagree},
      sources: {header: o.headerSite, transactions: o.listSite, second: o.secondSite, bytes: o.rawSite || null},
      items
    };
  }
  // pool names, only where the coinbase's own words name them
  const POOLS = [[/nicehash/i, 'NiceHash'], [/viabtc/i, 'ViaBTC'], [/f2pool/i, 'F2Pool'], [/antpool/i, 'AntPool'], [/binance/i, 'Binance Pool'], [/litecoinpool/i, 'litecoinpool.org'],
    [/poolin/i, 'Poolin'], [/emcd/i, 'EMCD'], [/mining-?dutch/i, 'Mining-Dutch'], [/prohashing/i, 'Prohashing'], [/trustpool/i, 'TrustPool'], [/dxpool/i, 'DxPool'], [/zsolo/i, 'zSolo']];

  // one row per transaction, for spreadsheets
  function toCSV(M) {
    const q = v => { let t = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const head = ['block', 'n', 'txid', 'fee_koinu', 'size_bytes', 'fee_rate_doge_per_kb', 'kinds', 'inscription_ids', 'content_types', 'token_untrusted', 'dune', 'dogemap', 'name_untrusted', 'message_untrusted', 'in_proved_list', 'size_checked', 'fee_checked', 'kinds_agree', 'inscriptions_agree', 'read_from_own_bytes'];
    const rows = [head.join(',')];
    for (const it of M.items) {
      const tu = it.token && it.token.untrusted || {}, tk = it.token ? [it.token.protocol, tu.tick, tu.op, tu.amount].filter(x => x != null && x !== '').join(' ') : '';
      const dn = it.dune ? [it.dune.etched && ('etched ' + it.dune.etched + (it.dune.made === false ? ' (not made)' : '')), it.dune.minted && 'minted', it.dune.moved && 'moved'].filter(Boolean).join('; ') : '';
      const c = it.checked;
      rows.push([M.block.height, it.n, it.txid, it.fee, it.size, it.feeRate, it.kinds.join('; '), (it.inscriptions || []).map(x => x.id).filter(Boolean).join(' '),
        (it.inscriptions || []).map(x => x.contentType).filter(Boolean).join(' '), tk, dn, it.dogemap, it.name ? it.name.untrusted : '', it.message ? it.message.untrusted : '',
        c.inList, c.size, c.fee, c.kinds, c.inscriptions, c.ownBytes].map(q).join(','));
    }
    return rows.join('\n') + '\n';
  }

  /* ---------- gathering a block, in the same steps for every host ----------
     io: {dx(path) -> the explorer's JSON, btc(path) -> Bitcore's JSON, raw(txid) -> a transaction's bytes as hex (or null to skip),
          x3(path) -> 3xpl's JSON (optional, a last word on the hash)}; progress(step, value) is told how far it has got.
     o: {detailCap, bytesCap} (how many transactions to read one by one, and from their bytes) */
  async function gather(h, io, progress, o) {
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const DETAIL_CAP = o && o.detailCap || 600, BYTES_CAP = o && o.bytesCap != null ? o.bytesCap : 150;
    if (h == null || h === '' || h === 'newest') { const j = await io.dx('/v1/blocks?limit=1'); h = j.blocks && j.blocks[0] ? j.blocks[0].height : NaN; }
    h = +h;
    if (!(h >= 0) || h % 1) throw new Error('give a block number (a whole number from 0)');
    say('height', h);
    // 1. the header and the explorer's list, in block order (100 a page)
    let B; try { B = await io.dx('/v1/block/' + h + '?limit=100'); } catch (e) { say('header', false); throw /404/.test(String(e)) ? new Error('there is no block ' + h.toLocaleString('en-GB') + ' yet') : e; }
    if (!B || !B.hash) { say('header', false); throw new Error('there is no block ' + h.toLocaleString('en-GB') + ' yet'); }
    say('header', true);
    const list = (B.txs || []).slice();
    for (let pg = 2; list.length < (B.total || 0) && pg <= 400; pg++) { const P = await io.dx('/v1/block/' + h + '?limit=100&page=' + pg); if (!P.txs || !P.txs.length) break; list.push(...P.txs); say('list', [list.length, B.total]); }
    say('list', list.length === B.total ? true : false);
    // 2. a second site's list (sizes and fees) and its hash
    let second = [], secondHash = null, secondSite = null;
    try { second = await io.btc('/tx?blockHeight=' + h + '&limit=' + Math.max(1000, list.length + 10)); if (second[0] && second[0].blockHash) { secondHash = second[0].blockHash; secondSite = 'https://api.bitcore.io'; } } catch (e) {}
    if (!secondHash) try { const b = await io.btc('/block/' + h); if (b && b.hash) { secondHash = b.hash; secondSite = 'https://api.bitcore.io'; } } catch (e) {}
    if (!secondHash && io.x3) try { const x = await io.x3('/dogecoin/block/' + h + '?data=block'); if (x.data && x.data.block && x.data.block.hash) { secondHash = x.data.block.hash; secondSite = 'https://3xpl.com'; } } catch (e) {}
    say('second', !!secondHash);
    // 3. each transaction, as the explorer reads it (its inputs' addresses and its outputs' kinds), as Doge Cube's halls do
    const details = new Map(), want = list.slice(0, DETAIL_CAP); let done = 0;
    say('details', [0, want.length]);
    let i = 0; await Promise.all(Array.from({length: Math.min(4, want.length)}, async () => { while (i < want.length) { const t = want[i++]; try { details.set(t.txid, await io.dx('/v1/tx/' + t.txid)); } catch (e) {} done++; if (done % 5 === 0 || done === want.length) say('details', [done, want.length]); } }));
    say('details', details.size === list.length ? true : false);
    // 4. the ones that carry something, and the coinbase, from their own bytes
    const carry = list.filter((t, k) => k === 0 || t.inscription || (details.get(t.txid) && (details.get(t.txid).outputs || []).some(q => q.type === 'nulldata'))).slice(0, BYTES_CAP);
    const raw = new Map(); let rawStop = null, rd = 0;
    if (io.raw) {
      say('bytes', [0, carry.length]);
      for (const t of carry) {
        if (rawStop) break;
        try { const hx = await io.raw(t.txid); if (hx) raw.set(t.txid, fromHex(hx)); } catch (e) { if (/slow down|40[23]|429|430/.test(String(e))) rawStop = e; }
        rd++; say('bytes', [rd, carry.length]);
      }
      say('bytes', raw.size === carry.length ? true : false);
    }
    // 5. dunes: an etching only makes its dune if the name was free (the explorer's list of dunes)
    let dunesMade = null; const tried = [];
    for (const [, u] of raw) { try { const r = readTx(u, false); if (r.dune && r.dune.etched) tried.push(r.dune.etched); } catch (e) {} }
    if (tried.length) { dunesMade = new Map();
      for (const nm of tried) { const key = nm.replace(/•/g, ''); try { const j = await io.dx('/v1/dune/' + encodeURIComponent(key)); dunesMade.set(key, j && j.dune ? j.dune.dune_id : null); } catch (e) { if (/404/.test(String(e))) dunesMade.set(key, null); else { dunesMade = null; break; } } }
      say('dunes', !!dunesMade); } else say('dunes', true);
    const m = buildManifest({height: h, header: B, headerSite: 'https://thedoginalsexplorer.com', list, listSite: 'https://thedoginalsexplorer.com', details, second, secondHash, secondSite: secondSite || 'no second site',
      raw, rawSite: io.raw ? 'https://api.blockchair.com' : null, rawWanted: io.raw ? carry.length : 0, dunesMade});
    if (list.length > DETAIL_CAP) m.checked.note = 'A very big block: the first ' + DETAIL_CAP.toLocaleString('en-GB') + ' transactions were read one by one; the rest are from the lists only.';
    if (rawStop) m.checked.ownBytes.stopped = 'Blockchair asked us to slow down (30 asks a minute): the rest were not read from their bytes this time. Try again in a minute.';
    return m;
  }

  const poolOf = words => { for (const [re, nm] of POOLS) if (re.test(words || '')) return nm; return null; };   // (only where the coinbase's own words name one)
  return {VERSION, KIND_NAMES, KIND_GROUPS, MERGE_MINED_FROM, sha256, hashHex, fromHex, headerHash, merkleRoot, readTx, explorerKinds, fileKind, buildManifest, toCSV, gather, poolOf};
});
