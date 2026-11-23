/* Agent Blockhall's Block Manifest, by bitmap22. Always free.
   Reads a whole Bitcoin block the way Agent Blockhall's halls do (https://ordportal.com/block-cube.html):
   every transaction, sorted into the same kinds as the hall's shelves (inscriptions and their file types, bitmaps, BRC-20,
   runes, Alkanes, Stamps, CAT-21 and more), with its fee and size, and checked: its id and size worked out from the block's
   own bytes against a second site's list, its kinds read twice (this reader and ordpool.space's tags), and its inscriptions
   against ordinals.com's list. The same file runs in the free Agent Blockhall MCP tool and on the portal's Block Manifest
   page. It only reads and works things out: fetching is left to whoever uses it. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.BlockManifest = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const U8D = new TextDecoder('utf-8'), L1D = new TextDecoder('latin1'), U8F = new TextDecoder('utf-8', {fatal: true});

  /* ---------- SHA-256 (for each transaction's id and the block's hash, worked out from the bytes themselves) ---------- */
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
  const hashHex = u => { const d = sha256(sha256(u)); let s = ''; for (let i = 31; i >= 0; i--) s += d[i].toString(16).padStart(2, '0'); return s; };

  /* ---------- the kinds: the same names, in the same order, as the parcel-type chips in Agent Blockhall's halls ---------- */
  // what this reader finds in a transaction (a transaction can be several at once)
  const TF = {insc: 0, img: 1, txt: 2, html: 3, json: 4, media: 5, model: 6, other: 7, cursed: 8, child: 9, brc20: 10, tap: 11, dmt: 12, bitmap: 13,
    atom: 14, rune: 15, etch: 16, rmint: 17, rmove: 18, alkanes: 19, cp: 20, stamps: 21, msg: 22, taproot: 23, segwit: 24, legacy: 25,
    consol: 26, batch: 27, msig: 28, cb: 29, crc20: 30, brc420: 31};
  // ordpool.space's tags (bit numbers in its "flags", from its open-source parser) and the kind each one is
  const OP = {Atomicals: 48n, 'CAT-21': 49n, inscriptions: 50n, runes: 51n, 'BRC-20': 52n, 'SRC-20': 53n, Labitbu: 54n, OpenTimestamps: 81n};
  const sc = (t, f) => ((t.sc >> f) & 1) === 1, op = (t, k) => t.op != null && ((t.op >> OP[k]) & 1n) === 1n;
  // [chip name, shelf group, this reader's reading, ordpool.space's reading (null where it has none)]
  const KINDS = [
    ['inscriptions', 'inscriptions', t => sc(t, TF.insc), t => op(t, 'inscriptions')],
    ['images', 'inscriptions', t => sc(t, TF.img)], ['text', 'inscriptions', t => sc(t, TF.txt)], ['HTML', 'inscriptions', t => sc(t, TF.html)],
    ['JSON', 'inscriptions', t => sc(t, TF.json)], ['audio / video', 'inscriptions', t => sc(t, TF.media)], ['3D models', 'inscriptions', t => sc(t, TF.model)],
    ['other files', 'inscriptions', t => sc(t, TF.other)], ['delegates', 'inscriptions', t => t.dele === true], ['children', 'inscriptions', t => sc(t, TF.child)],
    ['cursed', 'inscriptions', t => sc(t, TF.cursed)], ['bitmaps', 'inscriptions', t => sc(t, TF.bitmap)],
    ['BRC-20', 'tokens', t => sc(t, TF.brc20), t => op(t, 'BRC-20')], ['BRC-420', 'tokens', t => sc(t, TF.brc420)], ['TAP', 'tokens', t => sc(t, TF.tap)],
    ['DMT mints', 'tokens', t => sc(t, TF.dmt)], ['NAT', 'tokens', t => t.nat === true], ['CRC-20 · LEAF', 'tokens', t => sc(t, TF.crc20)],
    ['runes', 'tokens', t => sc(t, TF.rune), t => op(t, 'runes')], ['runes etched', 'tokens', t => sc(t, TF.etch)], ['runes minted', 'tokens', t => sc(t, TF.rmint)],
    ['runes moved', 'tokens', t => sc(t, TF.rmove)], ['Alkanes', 'tokens', t => sc(t, TF.alkanes)], ['Atomicals', 'tokens', t => sc(t, TF.atom), t => op(t, 'Atomicals')],
    ['SRC-20', 'tokens', t => t.src20 === true, t => op(t, 'SRC-20')], ['Stamps', 'tokens', t => sc(t, TF.stamps)], ['Counterparty', 'tokens', t => sc(t, TF.cp)],
    ['CAT-21', 'tokens', t => t.cat21 === true, t => op(t, 'CAT-21')], ['Labitbu', 'tokens', t => t.labitbu === true, t => op(t, 'Labitbu')],
    ['OpenTimestamps', 'tokens', null, t => op(t, 'OpenTimestamps')],
    ['taproot', 'transactions', t => sc(t, TF.taproot)], ['segwit', 'transactions', t => sc(t, TF.segwit)], ['legacy', 'transactions', t => sc(t, TF.legacy)],
    ['consolidations', 'transactions', t => sc(t, TF.consol)], ['batch payouts', 'transactions', t => sc(t, TF.batch)], ['multisig', 'transactions', t => sc(t, TF.msig)],
    ['messages', 'transactions', t => sc(t, TF.msg)], ['coinbase', 'transactions', t => sc(t, TF.cb)]];
  const KIND_NAMES = KINDS.map(k => k[0]).concat(['regular']);
  // which part of the hall each kind's shelves are in: inscriptions, tokens or transactions
  const KIND_GROUPS = Object.assign(Object.fromEntries(KINDS.map(k => [k[0], k[1]])), {regular: 'transactions'});
  // the kinds that make a transaction more than a regular payment (the hall's "regular" shelf is everything without one)
  const SPECIAL = new Set(['inscriptions', 'bitmaps', 'BRC-20', 'BRC-420', 'TAP', 'CRC-20 · LEAF', 'SRC-20', 'Stamps', 'Counterparty', 'CAT-21', 'Atomicals', 'Labitbu', 'OpenTimestamps', 'Alkanes', 'runes', 'DMT mints', 'NAT']);

  /* ---------- reading the block's bytes (the same reading as Agent Blockhall's halls) ---------- */
  const catB = list => { let n = 0; for (const a of list) n += a.length; const o = new Uint8Array(n); let k = 0; for (const a of list) { o.set(a, k); k += a.length; } return o; };
  function pushes(s, a, b) {
    const o = []; let i = a;
    while (i < b) {
      const opc = s[i++]; let n = opc === 0 ? 0 : -1;
      if (opc >= 1 && opc <= 75) n = opc; else if (opc === 76) n = s[i++]; else if (opc === 77) { n = s[i] | s[i + 1] << 8; i += 2; }
      else if (opc === 78) { n = (s[i] | s[i + 1] << 8 | s[i + 2] << 16 | s[i + 3] << 24) >>> 0; i += 4; }
      if (n < 0) { o.push([opc, null]); continue; }
      if (i + n > b) break;
      o.push([opc, s.subarray(i, i + n)]); i += n;
    }
    return o;
  }
  // RUNES. A rune message (a runestone) is read the way ord reads it: ord is the Runes reference, and every rule here is its own
  // (its runestone.rs, message.rs, varint.rs, tag.rs, flag.rs, rune_id.rs and edict.rs). A message that breaks a rule is a
  // broken one (ord calls it a cenotaph): nothing it asks for happens, and any runes its transaction spends are burned.
  const RUNES_START = 840000, ALK_START = 880000;   // (ord: runes count from block 840,000. Alkanes' own code: from block 880,000)
  const RUNE_ONE = 'UNCOMMON•GOODS', runeNm = id => id === '1:0' ? RUNE_ONE : id;   // (rune 1:0 is built into ord under this name: the one rune its number alone can name)
  // why a rune message is broken: ord's own names for the faults, said plainly
  const RUNE_FLAW = {Opcode: 'its script holds a step that is not data', InvalidScript: 'its script is cut short', Varint: 'one of its numbers is cut off or too big',
    TrailingIntegers: 'its list of moves has numbers left over', EdictRuneId: 'a move names a rune number that cannot be', EdictOutput: 'a move points at an output the transaction does not have',
    TruncatedField: 'a field has no value', UnrecognizedEvenTag: 'it holds a field that runes does not know, or one that is out of place', UnrecognizedFlag: 'it sets a flag that runes does not know',
    SupplyOverflow: 'the new rune\'s supply would be too big to count'};
  // s: the output's script (it starts OP_RETURN OP_13); nout: how many outputs the transaction has. Gives back its fields (F, as
  // before), and what it does: etch (a new rune: its number n, spacers sp, symbol sym), mint (a rune's id), ptr (the output any
  // left-over runes go to), ed (its moves: rune id, amount, output), moves (it has moves that count), bad (why it is broken, or null)
  function runestone(s, nout) {
    const U64 = 18446744073709551615n, U32 = 4294967295n, U128 = (1n << 128n) - 1n, R = {F: {}, moves: false, bad: null, etch: null, mint: null, ptr: null, ed: []}, bad = f => { if (!R.bad) R.bad = f; return R; };
    let i = 2; const pay = [];
    while (i < s.length) {   // the data pushes, joined up (any other script step breaks it)
      const op = s[i++]; let n;
      if (op <= 75) n = op; else if (op === 76) { if (i + 1 > s.length) return bad('InvalidScript'); n = s[i++]; }
      else if (op === 77) { if (i + 2 > s.length) return bad('InvalidScript'); n = s[i] | s[i + 1] << 8; i += 2; }
      else if (op === 78) { if (i + 4 > s.length) return bad('InvalidScript'); n = (s[i] | s[i + 1] << 8 | s[i + 2] << 16 | s[i + 3] << 24) >>> 0; i += 4; }
      else return bad('Opcode');
      if (i + n > s.length) return bad('InvalidScript');
      for (let k = 0; k < n; k++) pay.push(s[i + k]); i += n;
    }
    const ints = [];
    for (let p = 0; p < pay.length;) {   // its numbers (LEB128, 128 bits at most)
      let v = 0n, j = 0, end = false;
      for (; p + j < pay.length; j++) { if (j > 18) return bad('Varint'); const b = pay[p + j]; if (j === 18 && b & 0x7c) return bad('Varint'); v |= BigInt(b & 127) << BigInt(7 * j); if (!(b & 128)) { end = true; j++; break; } }
      if (!end) return bad('Varint');
      ints.push(v); p += j;
    }
    const M = new Map();
    for (let k = 0; k < ints.length; k += 2) {   // tag and value pairs; tag 0 starts the moves (four numbers each)
      const tag = ints[k];
      if (tag === 0n) {
        let ib = 0n, it = 0n;
        for (let c = k + 1; c < ints.length; c += 4) {
          if (c + 3 >= ints.length) { bad('TrailingIntegers'); break; }
          const blk = ints[c], tx = ints[c + 1]; let nb, nt, ok = blk <= U64 && tx <= U32;
          if (ok) { nb = ib + blk; nt = blk === 0n ? it + tx : tx; ok = nb <= U64 && nt <= U32 && !(nb === 0n && nt > 0n); }
          if (!ok) { bad('EdictRuneId'); break; }
          if (ints[c + 3] > U32 || ints[c + 3] > BigInt(nout)) { bad('EdictOutput'); break; }
          ib = nb; it = nt; R.ed.push({id: nb + ':' + nt, amt: ints[c + 2], out: Number(ints[c + 3])});
        }
        break;
      }
      if (k + 1 >= ints.length) { bad('TruncatedField'); break; }
      if (!M.has(tag)) M.set(tag, []); M.get(tag).push(ints[k + 1]); (R.F[tag] = R.F[tag] || []).push(ints[k + 1]);
    }
    // a field is taken only if it is whole and in range; what is left over decides whether the message is broken
    const take = (tag, N, f) => { const a = M.get(tag); if (!a || a.length < N) return undefined; const v = f(a); if (v === undefined) return undefined; a.splice(0, N); if (!a.length) M.delete(tag); return v; };
    const one = a => a[0], u64 = a => a[0] <= U64 ? a[0] : undefined;
    let flags = take(2n, 1, one) || 0n, over = false; const flag = b => { const m = 1n << b, on = (flags & m) !== 0n; flags &= ~m & U128; return on; };
    if (flag(0n)) {
      const e = R.etch = {}; take(1n, 1, a => a[0] <= 38n ? a[0] : undefined);
      const prem = take(6n, 1, one) || 0n; let cap = 0n, amt = 0n;
      e.n = take(4n, 1, one); e.sp = take(3n, 1, a => a[0] <= 0x07ffffffn ? a[0] : undefined); e.sym = take(5n, 1, a => a[0] <= 0x10ffffn && !(a[0] >= 0xd800n && a[0] <= 0xdfffn) ? a[0] : undefined);
      if (flag(1n)) { cap = take(8n, 1, one) || 0n; take(12n, 1, u64); take(14n, 1, u64); amt = take(10n, 1, one) || 0n; take(16n, 1, u64); take(18n, 1, u64); }
      flag(2n); over = prem + cap * amt > U128;
    }
    R.mint = take(20n, 2, a => a[0] <= U64 && a[1] <= U32 && !(a[0] === 0n && a[1] > 0n) ? a[0] + ':' + a[1] : undefined) || null;
    const ptr = take(22n, 1, a => a[0] <= U32 && a[0] < BigInt(nout) ? a[0] : undefined); if (ptr !== undefined) R.ptr = Number(ptr);
    if (over) bad('SupplyOverflow'); if (flags !== 0n) bad('UnrecognizedFlag');
    for (const t of M.keys()) if (t % 2n === 0n) { bad('UnrecognizedEvenTag'); break; }
    R.moves = !R.bad && R.ed.length > 0;
    return R;
  }
  function runeName(n, sp) {
    n += 1n; let s = '';
    while (n > 0n) { s = String.fromCharCode(65 + Number((n - 1n) % 26n)) + s; n = (n - 1n) / 26n; }
    if (!sp) return s;
    let o = ''; for (let i = 0; i < s.length; i++) { o += s[i]; if (i < s.length - 1 && (sp >> BigInt(i)) & 1n) o += '•'; }
    return o;
  }
  // Counterparty and Stamps scramble their data with RC4, keyed on the id of the transaction's first input
  function rc4(key, d) {
    const S = new Uint8Array(256).map((_, i) => i);
    for (let i = 0, j = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) & 255; [S[i], S[j]] = [S[j], S[i]]; }
    const o = new Uint8Array(d.length);
    for (let k = 0, i = 0, j = 0; k < d.length; k++) { i = (i + 1) & 255; j = (j + S[i]) & 255; [S[i], S[j]] = [S[j], S[i]]; o[k] = d[k] ^ S[(S[i] + S[j]) & 255]; }
    return o;
  }
  function cpKind(key, chunks) {
    const t = L1D.decode(rc4(key, catB(chunks))) + (chunks.length > 1 ? '\n' + L1D.decode(catB(chunks.map(c => rc4(key, c)))) : '');
    return /stamp:/i.test(t) ? TF.stamps : t.includes('CNTRPRTY') ? TF.cp : -1;
  }
  // a Labitbu's control block (4,129 bytes) starts with this shared key (github.com/stutxo/labitbu); all were minted in blocks 908,072 to 908,196
  const LAB_KEY = '96053db5b18967b5a410326ecca687441579225a6d190f398e2180deec6e429e'.match(/../g).map(h => parseInt(h, 16));
  function words(u) {
    if (u.length < 3) return null;
    let raw; try { raw = U8F.decode(u); } catch (e) { return null; }
    const cs = [...raw]; let ok = 0; for (const ch of cs) { const c = ch.codePointAt(0); if ((c >= 32 && c !== 127 && !(c >= 0x80 && c < 0xa0)) || c === 10 || c === 9) ok++; }
    if (ok / cs.length < 0.95) return null;
    const t = raw.replace(/[\u0000-\u001f\u007f\ufffd]+/g, ' ').trim();
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
  const POOLS = [[/foundry/i, 'Foundry USA'], [/antpool/i, 'AntPool'], [/viabtc/i, 'ViaBTC'], [/f2pool/i, 'F2Pool'], [/\bmara\b/i, 'MARA Pool'],
    [/spiderpool/i, 'SpiderPool'], [/binance/i, 'Binance Pool'], [/luxor/i, 'Luxor'], [/braiins|slush/i, 'Braiins Pool'], [/secpool/i, 'SECPOOL'],
    [/ocean/i, 'OCEAN'], [/poolin/i, 'Poolin'], [/sbi ?crypto/i, 'SBI Crypto'], [/\bemcd\b/i, 'EMCD'], [/ultimus/i, 'ULTIMUSPOOL'],
    [/whitepool/i, 'WhitePool'], [/btc\.com/i, 'BTC.com'], [/nicehash/i, 'NiceHash'], [/titan/i, 'Titan'], [/kucoin/i, 'KuCoin Pool'],
    [/miningsquared|bsquared/i, 'Mining Squared'], [/ckpool|solo\.ck/i, 'solo miner'], [/datum/i, 'DATUM']];
  const hex = u => Array.from(u, b => b.toString(16).padStart(2, '0')).join('');
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  const amt = o => o.amt != null ? s(o.amt, 40) : o.max != null ? s(o.max, 40) : null;
  // a token: its protocol is this reader's word; everything written in the transaction itself goes under "untrusted"
  // (22 Nov 2026) SRC-101 names, stored the Stamps way (github.com/stampchain-io/stamps_sdk docs/src101specs.md): in bare multisig from 870,652, in P2WSH from 940,000
  // (the Stamps indexer's own start blocks). The names are written in base64; read here as their letters. Whether a name is owned, paid for or in date needs the indexer.
  const b64name = x => { try { const t = new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(String(x)), c => c.charCodeAt(0))).toLowerCase(); return t ? t.slice(0, 64) : null; } catch (e) { return null; } };
  const src101 = o => { const op = s(o.op, 16).toLowerCase(), raw = Array.isArray(o.tokenid) ? o.tokenid : o.tokenid != null ? [o.tokenid] : [];
    return tok('SRC-101', {op, names: raw.slice(0, 10).filter(x => String(x).length <= 128).map(b64name).filter(Boolean).join(', '), root: op === 'deploy' ? s(o.root, 24).toLowerCase() : null,
      deploy: /^[0-9a-f]{64}$/i.test(String(o.hash || '')) ? String(o.hash).toLowerCase() : null, years: o.dua != null ? s(o.dua, 4) : null, to: o.toaddress ? s(o.toaddress, 90) : null}); };
  const tok = (protocol, u, extra) => { const o = {}; for (const k in u) if (u[k] != null && u[k] !== '') o[k] = u[k]; return Object.assign({protocol}, extra || {}, Object.keys(o).length ? {untrusted: o} : {}); };
  // a content type as written in the inscription, kept only if it looks like one (it is written by whoever inscribed it)
  const ctype = ty => /^[a-z0-9!#$&^_.+-]{1,40}\/[a-z0-9!#$&^_.+-]{1,60}$/.test(ty) ? ty : ty ? 'not a standard type' : '';

  // every transaction in the block, read once from its bytes
  function scanBlock(X, h, opts) {   // (opts.onBody(n, index, contentType, bodyPieces, compressed): optional, gives each inscription's contents, for the Safety Scan)
    const onBody = opts && typeof opts.onBody === 'function' ? opts.onBody : null;
    if (!(X instanceof Uint8Array) || X.length < 81) throw new Error('not a block');
    let p = 80;
    const vi = () => { const f = X[p++]; if (f < 253) return f; const n = f === 253 ? 2 : f === 254 ? 4 : 8; let v = 0; for (let i = 0; i < n; i++) v += X[p++] * 2 ** (8 * i); return v; };
    const blockHash = hashHex(X.subarray(0, 80)), ntx = vi(), out = new Array(ntx); let cb = '';
    for (let t = 0; t < ntx && p < X.length; t++) {
      const r = {n: t, sc: 0, ins: [], a: p}, set = f => { r.sc |= 1 << f; };
      p += 4; let sw = 0; if (X[p] === 0 && X[p + 1] === 1) { sw = 1; p += 2; }
      r.s = p;
      const nin = vi(), key = X.slice(p, p + 32).reverse(), isc = [];
      for (let i = 0; i < nin; i++) { p += 36; const l = vi(); isc.push([p, p + l]); p += l + 4; }
      const nout = vi(); let ms = null, mso = null, wsh = null, pay = 0;
      for (let i = 0; i < nout; i++) {
        p += 8; const l = vi(), q = p; p += l;
        if (!t) continue;
        if (X[q] === 0x6a) {
          if (X[q + 1] === 0x5d) {
            if (h < RUNES_START || r.rs) continue;   // (no runes before block 840,000; only a transaction's first rune message counts)
            r.rs = 1; const R = runestone(X.subarray(q, p), nout), F = R.F; set(TF.rune);
            if (R.bad) r.rune = {broken: R.bad, why: RUNE_FLAW[R.bad] || 'it breaks a rule', burns: 'any runes this transaction spends'};
            else {
              if (R.etch) { set(TF.etch); r.rune = {}; if (R.etch.n != null) r.rune.etched = runeName(R.etch.n, R.etch.sp); const c = R.etch.sym == null ? -1 : Number(R.etch.sym); if (c >= 32) r.rune.symbol = String.fromCodePoint(c); }
              if (R.mint) { set(TF.rmint); (r.rune = r.rune || {}).minted = R.mint; if (R.mint === '1:0') r.rune.mintedName = RUNE_ONE; }
              if (R.moves) { set(TF.rmove); const ids = [...new Set(R.ed.map(e => e.id))].filter(v => v !== '0:0'); if (ids.length) (r.rune = r.rune || {}).moved = ids; }
              if (!r.rune) r.rune = R.ptr != null ? {pointerOnly: R.ptr} : {empty: true};
              if (F[16383] && h >= ALK_START) set(TF.alkanes);   // (Alkanes reads only an unbroken rune message, from block 880,000)
            }
          } else if (l > 1) {
            const d = catB(pushes(X, q + 1, p).filter(x => x[1]).map(x => x[1])), k = d.length > 8 ? cpKind(key, [d]) : -1;
            if (k >= 0) set(k);
            else if (d.length === 8 && L1D.decode(d) === 'CNTRPRTY') set(TF.cp);
            else {
              const w = words(d); let pr = null;
              if (w && w[0] === '{') try { const o = JSON.parse(U8D.decode(d)); pr = String(o.p || '').toLowerCase(); if (pr === 'crc-20') { set(TF.crc20); r.token = tok('CRC-20', {tick: s(o.tick || o.exe, 20), op: s(o.op, 12), amount: amt(o)}); } else pr = null; } catch (e) {}
              if (w && !pr) { set(TF.msg); r.message = w; }
            }
          }
        } else {
          pay++;
          if (l >= 105 && X[p - 1] === 0xae && X[q] >= 0x51 && X[q] <= 0x53) {
            const P = pushes(X, q + 1, p - 2); for (const x of P) if (x[1] && x[1].length === 33) (ms = ms || []).push(x[1].subarray(1, 32));
            (mso = mso || []).push(P.filter(x => x[1] && (x[1].length === 33 || x[1].length === 65)).map(x => x[1]));
          } else if (l === 34 && X[q] === 0 && X[q + 1] === 32) (wsh = wsh || []).push(X.subarray(q + 2, p));
        }
      }
      if (ms) { const k = cpKind(key, ms); if (k >= 0) set(k); }
      if (mso && sc(r, TF.stamps) && h >= 793068) try {   // (SRC-20's own start blocks: bare multisig from 793,068, P2WSH from 865,000)
        const D = rc4(key, catB(mso.flatMap(pk => pk.length < 2 ? [] : pk.slice(0, -1).map(k => k.subarray(1, k.length - 1))))), L = D[0] << 8 | D[1];
        if (L > 6 && L <= D.length - 2 && /^stamp:/i.test(L1D.decode(D.subarray(2, 8)))) { const o = JSON.parse(U8D.decode(D.subarray(8, 2 + L)));
          if (String(o.p || '').toLowerCase() === 'src-20') { r.src20 = true; r.sc &= ~(1 << TF.stamps); r.token = tok('SRC-20', {tick: s(o.tick, 16).toUpperCase(), op: s(o.op, 12).toLowerCase(), amount: amt(o)}); }
          else if (String(o.p || '').toLowerCase() === 'src-101' && h >= 870652) r.token = src101(o); }
      } catch (e) {}
      if (wsh && h >= 865000) { const W2 = catB(wsh), L = W2[0] << 8 | W2[1];
        if (L > 6 && L <= W2.length - 2 && /^stamp:/i.test(L1D.decode(W2.subarray(2, 8)))) try {
          const o = JSON.parse(U8D.decode(W2.subarray(8, 2 + L)));
          if (String(o.p || '').toLowerCase() === 'src-20') { r.src20 = true; r.token = tok('SRC-20', {tick: s(o.tick, 16).toUpperCase(), op: s(o.op, 12).toLowerCase(), amount: amt(o)}); }
          else if (String(o.p || '').toLowerCase() === 'src-101' && h >= 940000 && !r.token) r.token = src101(o);
        } catch (e) {}
      }
      r.e = p;
      let tap = false, ei = 0;
      for (let i = 0; i < nin; i++) {
        const w = [];
        if (sw) { const ni = vi(); for (let k = 0; k < ni; k++) { const l = vi(); w.push([p, p + l]); p += l; } }
        if (!t) continue;
        if (!w.length) {
          const P = pushes(X, isc[i][0], isc[i][1]), last = P.length && P[P.length - 1][1];
          if (last && last.length > 3 && last[last.length - 1] === 0xae && last[0] >= 0x51 && last[0] <= 0x60) set(TF.msig);
          continue;
        }
        if (w.length >= 2 && X[w[w.length - 1][0]] === 0x50) w.pop();
        const lw = w[w.length - 1], ll = lw[1] - lw[0];
        if (w.length === 1 && (ll === 64 || ll === 65)) { tap = true; continue; }
        if (w.length >= 2 && ll >= 33 && (ll - 33) % 32 === 0 && (X[lw[0]] & 0xfe) === 0xc0) {
          tap = true;
          if (ll === 4129 && h >= 908072 && h <= 908196 && LAB_KEY.every((v, j) => X[lw[0] + 1 + j] === v)) r.labitbu = true;
          const [sa, sb] = w[w.length - 2], P = pushes(X, sa, sb);
          if (X[lw[0] - 1] === 0xae) set(TF.msig);
          for (let k = 0; k + 2 < P.length; k++) {
            if (P[k][0] !== 0 || P[k + 1][0] !== 0x63 || !P[k + 2][1]) continue;
            const tag = L1D.decode(P[k + 2][1]);
            if (tag === 'atom') { set(TF.atom); continue; }
            if (tag !== 'ord') continue;
            let j = k + 3, ct = '', enc = false, par = false, del = false, pn = false; const body = [];
            while (j < P.length && P[j][0] !== 0x68) {
              const [opc, d] = P[j];
              if (opc === 0) { for (j++; j < P.length && P[j][0] !== 0x68; j++) if (P[j][1]) body.push(P[j][1]); break; }
              const tg = d && d.length === 1 ? d[0] : opc >= 0x51 && opc <= 0x60 ? (pn = true, opc - 0x50) : -1, v = P[j + 1] && P[j + 1][1];
              if (tg === 1 && v) ct = U8D.decode(v).slice(0, 80); else if (tg === 3) par = true; else if (tg === 9) enc = true; else if (tg === 11) del = true;
              j += 2;
            }
            k = j;
            set(TF.insc); if (par) set(TF.child);
            if (h < 824544 && (i > 0 || ei > 0 || pn)) set(TF.cursed);
            const ty = (ct.split(';')[0] || '').trim().toLowerCase();
            if (!(del && !ty)) set(/^image\//.test(ty) ? TF.img : /html/.test(ty) ? TF.html : /json/.test(ty) ? TF.json : /^text\//.test(ty) ? TF.txt : /^(audio|video)\//.test(ty) ? TF.media : /^model\//.test(ty) ? TF.model : TF.other);
            if (del) r.dele = true;
            const bl = body.reduce((n, x) => n + x.length, 0);
            r.ins.push({index: ei++, contentType: ctype(ty) || (del ? 'delegate' : 'unknown'), bytes: bl, child: par, delegate: del, compressed: enc});
            if (onBody && bl) onBody(t, ei - 1, ty || (del ? 'delegate' : ''), body, enc);
            if (!enc && bl && bl <= 65536) {
              const raw = U8D.decode(catB(body)), txt = raw.trim(), bm = /^(0|[1-9]\d{0,15})\.bitmap$/.exec(raw);
              if (bm && !del && +bm[1] <= h) { (r.bitmapClaims = r.bitmapClaims || []).push({number: +bm[1], index: ei - 1}); if (r.bitmapClaim == null) r.bitmapClaim = {number: +bm[1], index: ei - 1}; }   // (a bitmap claim by bop's rules; it counts as a bitmap only once checked as the first claim: see checkBitmaps)
              else if (/^\/content\/[0-9a-f]{64}i\d+$/i.test(txt)) { set(TF.brc420); if (!r.token) r.token = tok('BRC-420', {link: txt.slice(9)}, {op: 'mint (not checked)'}); }
              else if (txt[0] === '{') try {
                const o = JSON.parse(txt), pr = String(o.p || '').toLowerCase();
                if (pr === 'brc-420') { set(TF.brc420); if (!r.token) r.token = tok('BRC-420', {name: o.name != null ? s(o.name, 24) : null, amount: amt(o)}, {op: String(o.op || '').toLowerCase() === 'deploy' ? 'deploy' : 'mint (not checked)'}); }
                else if (pr === 'brc-20' && o.p === 'brc-20' && h >= 779832 && /^(text\/plain|application\/json)(;|$)/.test(ct) && i === 0 && ei === 1 && !pn) {   // (BRC-20's own filter: plain text or JSON, the transaction's first inscription, written the standard way, from block 779,832)
                  set(TF.brc20); if (!r.token) r.token = tok('BRC-20', {tick: s(o.tick, 16), op: s(o.op, 12), amount: amt(o)}); }
                // BRC2.0 (from block 912,690): programs (EVM smart contracts) written as inscriptions, under BRC-20's same rules
                else if ((pr === 'brc20-prog' || (pr === 'brc20-module' && o.module === 'BRC20PROG')) && o.p === pr && h >= 912690 && /^(text\/plain|application\/json)(;|$)/.test(ct) && i === 0 && ei === 1 && !pn) {
                  set(TF.brc20); if (!r.token) r.token = tok('BRC2.0', {op: s(o.op, 12)}); }
                else if (pr === 'tap' && h >= 801993) {   // (TAP's own start; DMT from 817,705; NAT mints not counted from 885,588)
                  set(TF.tap);
                  const items = Array.isArray(o.items) ? o.items : [], isNat = x => /^(dmt-)?nat$/i.test(String(x || ''));
                  const tick = s(o.tick || (items[0] && items[0].tick), 16);
                  if (/^dmt-/i.test(String(o.op || '')) && h >= 817705) set(TF.dmt);
                  if (isNat(tick) || items.some(x => x && isNat(x.tick))) r.nat = true;
                  if (r.nat && /^dmt-mint$/i.test(String(o.op || '')) && h >= 885588) r.natNotCounted = 'from block 885,588 TAP does not count NAT mints: NAT comes from each block\'s reward';
                  if (!r.token) r.token = tok(r.nat ? 'TAP · NAT' : 'TAP', {tick, op: s(o.op, 16), amount: items.length > 1 ? null : items.length ? (items[0].amt != null ? s(items[0].amt, 40) : null) : amt(o)},
                    Object.assign(items.length > 1 ? {items: items.length} : {}, /^dmt-/i.test(String(o.op || '')) && /^\d{1,8}$/.test(String(o.blk || '')) ? {dmtBlock: +o.blk} : {}));
                }
              } catch (e) {}
            }
          }
          continue;
        }
        if (ll > 3 && X[lw[1] - 1] === 0xae && X[lw[0]] >= 0x51 && X[lw[0]] <= 0x60) set(TF.msig);
      }
      p += 4; r.z = p;
      if (t && h >= 824205 && ((X[p - 4] | X[p - 3] << 8 | X[p - 2] << 16 | X[p - 1] << 24) >>> 0) === 21) r.cat21 = true;
      if (!t) { set(TF.cb); cb = isc[0] ? coinbaseWords(X.subarray(isc[0][0], isc[0][1])) : ''; }
      else {
        set(tap ? TF.taproot : sw ? TF.segwit : TF.legacy);
        if (nin >= 3 && nout === 1) set(TF.consol);
        if (pay - (mso ? mso.length : 0) - ((sc(r, TF.stamps) || r.src20) && wsh ? wsh.length : 0) >= 10) set(TF.batch);
      }
      // its id (from the transaction without its witness data) and its size
      const base = 4 + (r.e - r.s) + 4, total = r.z - r.a;
      r.txid = hashHex(catB([X.subarray(r.a, r.a + 4), X.subarray(r.s, r.e), X.subarray(r.z - 4, r.z)]));
      r.weight = base * 3 + total; r.vsize = Math.ceil(r.weight / 4); r.size = total;   // (size: its bytes as the block holds them, for Blockspace Share)
      delete r.a; delete r.s; delete r.e; delete r.z;
      out[t] = r;
    }
    if (out.length !== ntx || out.some(x => !x)) throw new Error('the block ended early');
    if (p !== X.length) throw new Error('the block has bytes left over');
    let pool = null; for (const [re, nm] of POOLS) if (re.test(cb)) { pool = nm; break; }
    return {hash: blockHash, txs: out, coinbase: {words: cb, pool}};
  }


  /* ---------- bitmaps: which claim is the real one (bop's rules) ----------
     A bitmap counts only when it is the first proper "N.bitmap" claim of block N: below 942,000 bop's on-chain index (OCI, read
     from ordinals.com the way bop's own module reads it) names it, and ord must agree (the body exactly "N.bitmap", made in block N
     or later). From 942,000 the claim made in block N itself is the first; a later one needs blocks N onward read (earlier(n, h)).
     checkBitmaps(scan, height, get, earlier) gives {N: the real claim's inscription id, or null when this block's claim is not it};
     get(path) fetches a path from ordinals.com as text; earlier(n, h), if given, says whether blocks n to h - 1 hold a claim of n.
     A claim it could not answer is left out, so it does not count, and it is tried again next time (no limit on how many). */
  var OCI_LIMIT = 942000, WALK_MAX = 6, CHECK_MS = 30000;
  var OCI_PAGES = ['01bba6c58af39d7f199aa2bceeaaba1ba91b23d2663bc4ef079a4b5e442dbf74i0',
    'bb01dfa977a5cd0ee6e900f1d1f896b5ec4b1e3c7b18f09c952f25af6591809fi0', 'bb02e94f3062facf6aa2e47eeed348d017fd31c97614170dddb58fc59da304efi0',
    'bb037ec98e6700e8415f95d1f5ca1fe1ba23a3f0c5cb7284d877e9ac418d0d32i0', 'bb9438f4345f223c6f4f92adf6db12a82c45d1724019ecd7b6af4fcc3f5786cei0',
    'bb0542d4606a9e7eb4f31051e91f7696040db06ca1383dff98505618c34d7df7i0', 'bb06a4dffba42b6b513ddee452b40a67688562be4a1345127e4d57269e6b2ab6i0',
    'bb076934c1c22007b315dd1dc0f8c4a2f9d52f348320cfbadc7c0bd99eaa5e18i0', 'bb986a1208380ec7db8df55a01c88c73a581069a51b5a2eb2734b41ba10b65c2i0',
    'b907b51a239e3a37f29f8222fb274f828c6ebf7b93ce501a55b7171daaa75758i0', 'b942b6477c7da9090edb9751429ba9c3ba01b39ab972fc888d481f528e3e03c3i0'];
  // Bitmaps below 840,000 that are not the first inscription on their sat (from the OCI module, credited there to @_lefrog).
  var OCI_SATIDX = { 92871: 1, 92970: 1, 123132: 1, 365518: 1, 700181: 1, 826151: 1, 827151: 1, 828151: 1, 828239: 1, 828661: 1,
    829151: 1, 830151: 1, 832104: 2, 832249: 2, 832252: 2, 832385: 4, 833067: 1, 833101: 3, 833105: 4, 833109: 4, 833121: 8,
    834030: 2, 834036: 2, 834051: 17, 834073: 4, 836151: 1, 837115: 2, 837120: 2, 837151: 1, 837183: 3, 837188: 2, 838058: 5,
    838068: 2, 838076: 2, 838096: 1, 838151: 1, 838821: 1, 839151: 1, 839377: 1, 839378: 2, 839382: 2, 839397: 1 };
  function ociPageNo(n) { return n >= 907000 ? 10 : n >= 840000 ? 9 : Math.floor(n / 100000); }
  function ociPos(n) { return n >= 907000 ? n - 907000 : n >= 840000 ? n - 840000 : n % 100000; }
  // Read one OCI page the way the OCI module itself does, quirks included.
  function ociDecode(p, text) {
    var d, full = [], sats = [];
    function pi(v) { return parseInt(String(v)); }
    function undelta(list, out) { list.forEach(function (s, i) { out.push(i ? pi(out[i - 1]) + pi(s) : pi(s)); }); }
    if (p >= 9) { d = JSON.parse(text); undelta(d.deltaEncodedSats, sats); return { sats: sats, map: d.satIndexMap || {} }; }
    if (p === 2 || p === 3) { d = JSON.parse('[' + text + ']'); d = [d.slice(0, 99999), d.slice(100000, 199999)]; }
    else {
      d = text;
      try { d = JSON.parse(d.split('\\n  ').join('')); } catch (e) {}
      if (typeof d === 'string') try { d = JSON.parse(d.split('  ').join('')); } catch (e) {}
    }
    undelta(d[0], full);
    d[1].forEach(function (pos, i) { sats[pos] = full[i]; });
    return { sats: sats, map: null };
  }
  var ociPages = {};
  function ociFirst(n, get) {
    var p = ociPageNo(n);
    if (!ociPages[p]) ociPages[p] = get('/content/' + OCI_PAGES[p]).then(function (t) { return ociDecode(p, t); });
    return ociPages[p].then(function (pg) {
      var sat = pg.sats[ociPos(n)], at = n >= 840000 ? (pg.map[String(n)] || 0) : (OCI_SATIDX[n] || 0);
      if (typeof sat !== 'number' || !(sat > 0) || sat % 1 || sat > 9007199254740991) return null;
      return get('/r/sat/' + sat + '/at/' + at).then(function (t) { var j = JSON.parse(t); return (j && j.id) || null; });
    });
  }
  async function checkBitmaps(scan, height, get, earlier) {
    const out = {};
    for (let round = 0; round < 4; round++) {   // (a check that gets no answer is asked again, three more times, a little later each time)
      const seen = new Set(); let missing = false;
      for (const r of scan.txs) {
        const c = r && r.bitmapClaim; if (!c || seen.has(c.number)) continue; seen.add(c.number);
        if (c.number in out) continue;
        const id0 = r.txid + 'i' + c.index;
        try {
          if (c.number < OCI_LIMIT) {
            const id = await ociFirst(c.number, get); if (!id) { missing = true; continue; }
            if (id !== id0) { out[c.number] = null; continue; }
            const o = JSON.parse(await get('/r/inscription/' + id)), body = String(c.number) + '.bitmap';
            if (o && !o.delegate && (typeof o.content_length !== 'number' || o.content_length === body.length) && o.height >= c.number) out[c.number] = id; else out[c.number] = null;
          } else if (c.number === height) out[c.number] = id0;
          else if (typeof earlier === 'function') { const e = await earlier(c.number, height); if (e === false) out[c.number] = id0; else if (e === true) out[c.number] = null; else missing = true; }
          else missing = true;
        } catch (e) { missing = true; }
      }
      if (!missing || round === 3) break;
      await new Promise(r => setTimeout(r, 3000 * (round + 1)));
    }
    return out;
  }

  /* ---------- the manifest: the reading joined with the sites' lists, and every item checked ---------- */
  // ordpool.space's tag numbers are too big for JSON numbers: keep them as text before reading the list
  function readSummary(text) { return JSON.parse(String(text).replace(/"flags"\s*:\s*(\d+)/g, '"flags":"$1"')); }
  // runes made in a block, from ordinals.com's /block/<height> page (an etching only makes its rune if the name was free)
  const runesMade = html => new Set([...String(html).matchAll(/href=\/rune\/([^> ]+)>/g)].map(m => decodeURIComponent(m[1]).replace(/•/g, '')));

  /* buildManifest(o) - o:
       height, time (unix seconds)
       scan: scanBlock() of the block's bytes, and rawSite: where the bytes came from
       hash, hashSite: the block's hash from a site; secondHash, secondSite: from a second, separate site (optional)
       summary: [{txid, fee, vsize, value, flags}] from mempool.space or a copy (readSummary), summarySite
       tags: ordpool.space's summary (readSummary) or null, tagSite
       ordIds: ordinals.com's list of the inscriptions made in the block, or null, ordSite
       runesHtml: ordinals.com's /block/<height> page when the block has etchings (optional)
       bitmapFirst: checkBitmaps()'s answer (optional: without it no bitmap counts, and each claim says it was not checked) */
  function buildManifest(o) {
    const S = o.scan, txs = S.txs, N = txs.length, sum = o.summary || [], tagMap = new Map(), idsBy = new Map();
    for (const x of o.tags || []) if (x && x.txid) tagMap.set(x.txid, x.flags);
    for (const id of o.ordIds || []) { const t = id.slice(0, 64); if (!idsBy.has(t)) idsBy.set(t, []); idsBy.get(t).push(id); }
    const made = o.runesHtml ? runesMade(o.runesHtml) : null;
    const counts = {}; for (const k of KIND_NAMES) counts[k] = 0;
    let idOk = 0, sizeOk = 0, kindsBoth = 0, kindsAgree = 0, insBoth = 0, insAgree = 0, totalFee = 0;
    const disagree = [], items = new Array(N);
    for (let i = 0; i < N; i++) {
      const r = txs[i], m = sum[i] || null, f = tagMap.get(r.txid);
      const t = {sc: r.sc, dele: r.dele, nat: r.nat, src20: r.src20, cat21: r.cat21, labitbu: r.labitbu, op: null};
      if (f != null) try { t.op = BigInt(f); if (o.height < RUNES_START) t.op &= ~(1n << 51n); } catch (e) {}
      if (r.bitmapClaim && o.bitmapFirst && o.bitmapFirst[r.bitmapClaim.number] === r.txid + 'i' + r.bitmapClaim.index) t.sc |= 1 << TF.bitmap;
      if (r.rune && r.rune.etched && made) { r.rune.made = made.has(r.rune.etched.replace(/•/g, '')); if (!r.rune.made) t.sc &= ~(1 << TF.etch); }
      const kinds = [], ours = [], theirs = [], diff = [];
      for (const [name, , mine, op2] of KINDS) {
        const a = mine ? mine(t) : false, b = op2 && t.op != null ? op2(t) : null;
        if (a || b) kinds.push(name);
        if (mine && op2 && t.op != null) { if (a !== b) diff.push(name + (a ? ' (this reader only)' : ' (ordpool.space only)')); }
      }
      if (!kinds.some(k => SPECIAL.has(k)) && !kinds.includes('coinbase')) kinds.push('regular');
      for (const k of kinds) counts[k]++;
      const idMatch = !!m && m.txid === r.txid, sizeMatch = !!m && Math.abs(Number(m.vsize) - r.vsize) <= 1;
      if (idMatch) idOk++; if (sizeMatch) sizeOk++;
      let kc = null;
      if (t.op != null) { kindsBoth++; kc = !diff.length; if (kc) kindsAgree++; else if (disagree.length < 50) disagree.push({n: i, txid: r.txid, differ: diff}); }
      const ids = idsBy.get(r.txid) || [];
      let ic = null;
      if (o.ordIds && (r.ins.length || ids.length)) { insBoth++; ic = r.ins.length === ids.length; if (ic) insAgree++; else if (disagree.length < 50) disagree.push({n: i, txid: r.txid, differ: ['inscriptions: ' + r.ins.length + ' read here, ' + ids.length + ' listed by ordinals.com']}); }
      const fee = m && m.fee != null ? Number(m.fee) : null; if (fee != null) totalFee += fee;
      const it = {n: i, txid: r.txid, fee, vsize: r.vsize, feeRate: fee != null && r.vsize ? +(fee / r.vsize).toFixed(2) : null, kinds};
      if (r.ins.length || ids.length) it.inscriptions = (r.ins.length ? r.ins : ids.map((_, j) => ({index: j}))).map(x => Object.assign({id: ids.includes(r.txid + 'i' + x.index) ? r.txid + 'i' + x.index : null}, x));
      if (r.token) it.token = r.token;
      if (r.rune) it.rune = r.rune;
      if (r.bitmapClaim) { const c = r.bitmapClaim, f1 = o.bitmapFirst ? o.bitmapFirst[c.number] : undefined; if (sc(t, TF.bitmap)) it.bitmap = c.number;
        else it.bitmapClaim = {says: c.number + '.bitmap', real: f1 === undefined ? null : false, why: f1 === undefined ? 'not checked here: a bitmap counts only when checked as the first claim of its block (checkBitmaps)' : 'not the first claim of block ' + c.number + ', so not a bitmap'}; }
      if (r.natNotCounted) it.natNotCounted = r.natNotCounted;
      if (r.message) it.message = {untrusted: r.message};
      if (r.cat21) it.cat21 = true;
      it.checked = {id: idMatch, size: sizeMatch, kinds: kc, inscriptions: ic};
      items[i] = it;
    }
    const sec = o.secondHash ? {against: o.secondSite, agrees: o.secondHash === o.hash} : null;
    const etchTries = txs.filter(r => r.rune && r.rune.etched).length;
    return {
      manifest: 'Agent Blockhall Block Manifest ' + VERSION,
      block: {height: o.height, bitmap: o.height + '.bitmap', hash: o.hash, time: o.time ? new Date(o.time * 1000).toISOString().replace('.000', '') : null,
        transactions: N, totalFees: totalFee, minedBy: S.coinbase.pool, coinbaseWords: S.coinbase.words ? {untrusted: S.coinbase.words} : null},
      counts: Object.fromEntries(Object.entries(counts).filter(([, v]) => v)),
      checked: {
        blockHash: {fromItsOwnBytes: S.hash === o.hash, secondSite: sec},
        transactions: {matched: idOk, of: N, what: 'each transaction\'s id, worked out from the block\'s own bytes (' + o.rawSite + '), against ' + o.summarySite + '\'s list, in the same order'},
        sizes: {matched: sizeOk, of: N, what: 'each size worked out from the bytes against ' + o.summarySite},
        kinds: o.tags ? {agreed: kindsAgree, of: kindsBoth, what: 'inscriptions, runes, BRC-20, SRC-20, CAT-21, Atomicals and Labitbu: this reader\'s reading against ' + o.tagSite + '\'s tags'} : {agreed: null, of: 0, what: 'ordpool.space did not answer, so kinds were read once'},
        inscriptions: o.ordIds ? {agreed: insAgree, of: insBoth, listed: o.ordIds.length, what: 'inscriptions read in each transaction against ' + o.ordSite + '\'s list for this block'} : {agreed: null, of: 0, what: 'ordinals.com did not answer, so inscription ids are missing'},
        runesEtched: etchTries ? (made ? {made: txs.filter(r => r.rune && r.rune.made).length, tried: etchTries, what: 'etchings against the runes ' + (o.ordSite || 'ordinals.com') + ' says this block made'} : {made: null, tried: etchTries, what: 'not checked: an etching only makes its rune if the name was free'}) : undefined,
        differences: disagree},
      sources: {bytes: o.rawSite, transactions: o.summarySite, tags: o.tags ? o.tagSite : null, inscriptions: o.ordIds ? o.ordSite : null},
      items
    };
  }

  // one row per transaction, for spreadsheets
  function toCSV(M) {
    // (text written in a transaction that starts like a spreadsheet formula gets a ' in front, so a spreadsheet shows it and never runs it)
    const q = v => { let t = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const head = ['block', 'n', 'txid', 'fee_sats', 'vsize', 'fee_rate_sat_vb', 'kinds', 'inscription_ids', 'content_types', 'token_untrusted', 'rune', 'bitmap', 'message_untrusted', 'id_checked', 'size_checked', 'kinds_agree', 'inscriptions_agree'];
    const rows = [head.join(',')];
    for (const it of M.items) {
      const tu = it.token && it.token.untrusted || {}, tk = it.token ? [it.token.protocol, it.token.op, tu.tick, tu.op, tu.amount, tu.name].filter(x => x != null && x !== '').join(' ') : '';
      const rn = it.rune ? [it.rune.etched && ('etched ' + it.rune.etched + (it.rune.made === false ? ' (name taken: not made)' : '')), it.rune.minted && ('minted ' + it.rune.minted)].filter(Boolean).join('; ') : '';
      rows.push([M.block.height, it.n, it.txid, it.fee, it.vsize, it.feeRate, it.kinds.join('; '), (it.inscriptions || []).map(x => x.id).filter(Boolean).join(' '),
        (it.inscriptions || []).map(x => x.contentType).filter(Boolean).join(' '), tk, rn, it.bitmap, it.message ? it.message.untrusted : '',
        it.checked.id, it.checked.size, it.checked.kinds, it.checked.inscriptions].map(q).join(','));
    }
    return rows.join('\n') + '\n';
  }

  return {VERSION, KIND_NAMES, KIND_GROUPS, sha256, hashHex, scanBlock, readSummary, buildManifest, toCSV, runesMade, checkBitmaps};
});
