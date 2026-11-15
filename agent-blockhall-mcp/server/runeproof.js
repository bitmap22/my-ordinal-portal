/* Rune Proof, by bitmap22. Always free. Part of Agent Blockhall: https://bitmap22.github.io/my-ordinal-portal/block-cube.html
   Give it a rune: its name (DOG•GO•TO•THE•MOON), its ID (840000:3), its number, or the ID of the transaction that etched it.
   It reads the etching transaction's own bytes and decodes its runestone with ord's own rules (ord is the runes protocol's
   reference, and its rules are copied here from its code: crates/ordinals in github.com/ordinals/ord, read 15 Nov 2026).
   It proves the bytes are that transaction (their double SHA-256 is its ID), and that it sits in its block at the place the
   rune's ID says (the block's header hashes to the block's hash, which mempool.space and ordinals.com both give for that height,
   and the merkle path leads from the transaction to the header). It checks the name's rules: not a reserved name, unlocked at
   that height, and committed to in a taproot script spend at least six blocks before. Then it checks ordinals.com's rune page
   against all of it. What only an index can count (how many mints, how many burned, how many there are now, the rune's number)
   comes from ordinals.com alone, and it says so: only that those counts add up is checked.
   No other free rune site can be read from a web page (the rest refuse web pages or ask for a key or a payment), so the second
   source here is the chain itself: mempool.space gives the bytes (it doesn't read runes), and the bytes are read here.
   Nothing is sent or signed: it only reads. The same file is for the portal's Rune Proof page and the free Agent Blockhall MCP
   tool. Fetching is left to whoever uses it (io: mpJson(path), mpText(path), ordPage(path) -> {status, t, site} for 200 and
   404, ordJson(path)). It uses the Provenance Check's transaction reader (provenance.js). No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('./provenance.js'));
  else root.RuneProof = make(root.ProvenanceCheck);
})(typeof self !== 'undefined' ? self : this, function (PV) {
  'use strict';
  const VERSION = '1.0.0';
  const RULES_FROM = 'ord\'s own code (github.com/ordinals/ord, crates/ordinals: runestone.rs, rune.rs, varint.rs; the indexer\'s rune_updater.rs), read 15 Nov 2026';

  /* ---------- ord's rules, copied from its code ---------- */
  const TAG = {body: 0n, flags: 2n, rune: 4n, premine: 6n, cap: 8n, amount: 10n, heightStart: 12n, heightEnd: 14n, offsetStart: 16n, offsetEnd: 18n, mint: 20n, pointer: 22n, divisibility: 1n, spacers: 3n, symbol: 5n};
  const FLAG = {etching: 0n, terms: 1n, turbo: 2n};
  const MAX_DIVISIBILITY = 38n, MAX_SPACERS = 0x07ffffffn;
  const U128 = (1n << 128n) - 1n, U64 = (1n << 64n) - 1n, U32 = (1n << 32n) - 1n, U8 = 255n;
  const RESERVED = 6402364363415443603228541259936211926n;   // AAAAAAAAAAAAAAAAAAAAAAAAAAA: names from here up can't be chosen
  const STEPS = ['0', '26', '702', '18278', '475254', '12356630', '321272406', '8353082582', '217180147158', '5646683826134', '146813779479510',
    '3817158266467286', '99246114928149462', '2580398988131886038', '67090373691429037014', '1744349715977154962390', '45353092615406029022166',
    '1179180408000556754576342', '30658690608014475618984918', '797125955808376366093607894', '20725274851017785518433805270',
    '538857146126462423479278937046', '14010285799288023010461252363222', '364267430781488598271992561443798', '9470953200318703555071806597538774',
    '246244783208286292431866971536008150', '6402364363415443603228541259936211926', '166461473448801533683942072758341510102'].map(BigInt);
  const FIRST_RUNE_HEIGHT = 840000, HALVING = 210000, UNLOCKED = 12, UNLOCK_INTERVAL = HALVING / 12, COMMIT_CONFIRMATIONS = 6;
  // UNCOMMON•GOODS (rune 1:0) is not etched in any transaction: ord writes it into its index itself (src/index.rs)
  const GOODS = {n: 2055900680524219742n, spacers: 128, id: '1:0', divisibility: 0, symbol: '⧉', turbo: true, premine: 0n,
    terms: {amount: 1n, cap: U128, height: [840000n, 1050000n], offset: [null, null]}};
  const FLAWS = {
    'edict-output': 'an edict sends runes to an output the transaction does not have',
    'edict-rune-id': 'an edict names a rune ID that can\'t be',
    'invalid-script': 'the runestone\'s script is broken',
    'opcode': 'the runestone\'s script has something other than data in it',
    'supply-overflow': 'its most possible supply is too big to count (over 2^128)',
    'trailing-integers': 'the edicts end part-way through one',
    'truncated-field': 'a field has no value',
    'unrecognized-even-tag': 'it has a field this version of the rules doesn\'t know, of the kind that must be known (or a known field with a value it can\'t have)',
    'unrecognized-flag': 'it has a flag the rules don\'t know',
    'varint': 'a number in it is badly written (too long, too big or cut off)'};

  // LEB128 numbers, up to 128 bits (varint.rs)
  function varint(b, i) {
    let n = 0n;
    for (let k = 0; i + k < b.length; k++) {
      if (k > 18) return null;
      const byte = b[i + k], v = BigInt(byte & 0x7f);
      if (k === 18 && (v & 0x7cn) !== 0n) return null;
      n |= v << BigInt(7 * k);
      if ((byte & 0x80) === 0) return {n, len: k + 1};
    }
    return null;
  }
  // a script's steps, the way ord's Bitcoin library reads them: pushes of data, or anything else (an op); null where it breaks off
  function steps(s) {
    const o = []; let i = 0;
    while (i < s.length) {
      const op = s[i++]; let n = -1;
      if (op <= 0x4b) n = op;
      else if (op === 0x4c) { if (i + 1 > s.length) { o.push(null); break; } n = s[i]; i += 1; }
      else if (op === 0x4d) { if (i + 2 > s.length) { o.push(null); break; } n = s[i] | s[i + 1] << 8; i += 2; }
      else if (op === 0x4e) { if (i + 4 > s.length) { o.push(null); break; } n = (s[i] | s[i + 1] << 8 | s[i + 2] << 16 | s[i + 3] << 24) >>> 0; i += 4; }
      if (n < 0) { o.push({op}); continue; }
      if (i + n > s.length) { o.push(null); break; }
      o.push({op, push: s.subarray(i, i + n)}); i += n;
    }
    return o;
  }
  // the runestone: the first output whose script starts OP_RETURN OP_13 (runestone.rs, payload)
  function payload(tx) {
    for (let k = 0; k < tx.vout.length; k++) {
      const st = steps(tx.vout[k].script);
      if (!st[0] || st[0].op !== 0x6a || st[0].push) continue;
      if (!st[1] || st[1].op !== 0x5d || st[1].push) continue;
      const parts = [];
      for (const x of st.slice(2)) {
        if (x === null) return {output: k, flaw: 'invalid-script'};
        if (!x.push) return {output: k, flaw: 'opcode'};
        parts.push(x.push);
      }
      let n = 0; for (const p of parts) n += p.length;
      const u = new Uint8Array(n); let o = 0; for (const p of parts) { u.set(p, o); o += p.length; }
      return {output: k, bytes: u};
    }
    return null;
  }
  const runeId = (block, tx) => block === 0n && tx > 0n ? null : {block, tx};
  function nextId(id, block, tx) {
    if (block > U64 || id.block + block > U64) return null;
    if (block === 0n) { if (tx > U32 || id.tx + tx > U32) return null; return runeId(id.block, id.tx + tx); }
    if (tx > U32) return null;
    return runeId(id.block + block, tx);
  }
  // decipher: what ord makes of a transaction's runestone (runestone.rs, decipher; message.rs; tag.rs; flag.rs)
  function decipher(tx) {
    const P = payload(tx);
    if (!P) return null;
    const base = {output: P.output, bytes: P.bytes ? P.bytes.length : null};
    if (P.flaw) return Object.assign(base, {cenotaph: true, flaw: P.flaw, etching: null, mint: null});
    const ints = []; let flaw = null;
    for (let i = 0; i < P.bytes.length;) { const v = varint(P.bytes, i); if (!v) return Object.assign(base, {cenotaph: true, flaw: 'varint', etching: null, mint: null}); ints.push(v.n); i += v.len; }
    const fields = new Map(), edicts = [];
    for (let i = 0; i < ints.length; i += 2) {
      const tag = ints[i];
      if (tag === TAG.body) {
        let id = {block: 0n, tx: 0n};
        for (let j = i + 1; j < ints.length; j += 4) {
          if (j + 4 > ints.length) { flaw = flaw || 'trailing-integers'; break; }
          const next = nextId(id, ints[j], ints[j + 1]);
          if (!next) { flaw = flaw || 'edict-rune-id'; break; }
          const out = ints[j + 3];
          if (out > U32 || out > BigInt(tx.vout.length)) { flaw = flaw || 'edict-output'; break; }
          id = next; edicts.push({id: next.block + ':' + next.tx, amount: ints[j + 2], output: Number(out)});
        }
        break;
      }
      if (i + 1 >= ints.length) { flaw = flaw || 'truncated-field'; break; }
      const k = String(tag); if (!fields.has(k)) fields.set(k, []); fields.get(k).push(ints[i + 1]);
    }
    // take a field's first value(s) if they are allowed; a value that is not allowed is left, and a left even field spoils it
    const take = (tag, n, ok) => {
      const f = fields.get(String(tag)); if (!f || f.length < n) return undefined;
      const v = ok(f.slice(0, n)); if (v === undefined) return undefined;
      f.splice(0, n); if (!f.length) fields.delete(String(tag)); return v;
    };
    let flags = take(TAG.flags, 1, ([v]) => v); if (flags === undefined) flags = 0n;
    const flagTake = f => { const m = 1n << f, set = (flags & m) !== 0n; flags &= ~m; return set; };
    let etching = null;
    if (flagTake(FLAG.etching)) {
      etching = {
        divisibility: take(TAG.divisibility, 1, ([v]) => v <= U8 && v <= MAX_DIVISIBILITY ? Number(v) : undefined),
        premine: take(TAG.premine, 1, ([v]) => v),
        rune: take(TAG.rune, 1, ([v]) => v),
        spacers: take(TAG.spacers, 1, ([v]) => v <= U32 && v <= MAX_SPACERS ? Number(v) : undefined),
        symbol: take(TAG.symbol, 1, ([v]) => v <= U32 && v <= 0x10ffffn && !(v >= 0xd800n && v <= 0xdfffn) ? String.fromCodePoint(Number(v)) : undefined),
        terms: null, turbo: false};
      if (flagTake(FLAG.terms)) etching.terms = {
        cap: take(TAG.cap, 1, ([v]) => v),
        height: [take(TAG.heightStart, 1, ([v]) => v <= U64 ? v : undefined), take(TAG.heightEnd, 1, ([v]) => v <= U64 ? v : undefined)],
        amount: take(TAG.amount, 1, ([v]) => v),
        offset: [take(TAG.offsetStart, 1, ([v]) => v <= U64 ? v : undefined), take(TAG.offsetEnd, 1, ([v]) => v <= U64 ? v : undefined)]};
      etching.turbo = flagTake(FLAG.turbo);
    }
    const mint = take(TAG.mint, 2, ([b, t]) => b <= U64 && t <= U32 && runeId(b, t) ? b + ':' + t : undefined);
    const pointer = take(TAG.pointer, 1, ([v]) => v <= U32 && v < BigInt(tx.vout.length) ? Number(v) : undefined);
    if (etching) {
      const prem = etching.premine || 0n, cap = etching.terms && etching.terms.cap || 0n, amt = etching.terms && etching.terms.amount || 0n;
      if (cap * amt > U128 || prem + cap * amt > U128) flaw = flaw || 'supply-overflow';
    }
    if (flags !== 0n) flaw = flaw || 'unrecognized-flag';
    if ([...fields.keys()].some(k => BigInt(k) % 2n === 0n)) flaw = flaw || 'unrecognized-even-tag';
    const fieldsLeft = [...fields.keys()].map(Number);
    if (flaw) return Object.assign(base, {cenotaph: true, flaw, etching: etching ? {rune: etching.rune === undefined ? null : etching.rune} : null, mint: mint || null, fieldsLeft});
    return Object.assign(base, {cenotaph: false, flaw: null, etching, mint: mint || null, pointer: pointer === undefined ? null : pointer, edicts, fieldsLeft});
  }

  /* ---------- names (rune.rs, spaced_rune.rs) ---------- */
  function letters(n) {
    if (n === U128) return 'BCGDENLQRQWDSLRUGSNLBTMFIJAV';
    let s = ''; n += 1n;
    while (n > 0n) { s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Number((n - 1n) % 26n)] + s; n = (n - 1n) / 26n; }
    return s;
  }
  function spaced(n, spacers) {
    const r = letters(n); let s = '';
    for (let i = 0; i < r.length; i++) { s += r[i]; if (i < r.length - 1 && spacers & (1 << i)) s += '•'; }
    return s;
  }
  // a name as people write it: letters, with • or . (or a space) between them
  function parseName(t) {
    const s = String(t).trim().toUpperCase(); let L = '', spacers = 0;
    for (const c of s) {
      if (c >= 'A' && c <= 'Z') L += c;
      else if (c === '•' || c === '.' || c === ' ') { if (!L) return null; const f = 1 << (L.length - 1); if (spacers & f) return null; spacers |= f; }
      else return null;
    }
    if (!L || L.length > 28 || (spacers && 32 - Math.clz32(spacers) >= L.length)) return null;
    let x = 0n; for (let i = 0; i < L.length; i++) { if (i > 0) x += 1n; x = x * 26n + BigInt(L.charCodeAt(i) - 65); }
    if (x > U128) return null;
    return {n: x, spacers, letters: L, spaced: spaced(x, spacers)};
  }
  // the shortest names allowed at a height: 13 letters and up at first, then one letter shorter each 17,500 blocks, bit by bit
  function minimumAt(height) {
    const offset = height + 1, start = FIRST_RUNE_HEIGHT, end = start + HALVING;
    if (offset < start) return STEPS[UNLOCKED];
    if (offset >= end) return 0n;
    const progress = offset - start, length = Math.max(0, UNLOCKED - Math.floor(progress / UNLOCK_INTERVAL));
    const e = STEPS[length - 1], s = STEPS[length], rem = BigInt(progress % UNLOCK_INTERVAL);
    return s - (s - e) * rem / BigInt(UNLOCK_INTERVAL);
  }
  function unlockHeight(n) {
    if (n >= RESERVED) return null;
    if (n >= STEPS[UNLOCKED]) return 0;
    const i = STEPS.findIndex(s => n < s), start = STEPS[i], end = i > 0 ? STEPS[i - 1] : 0n, interval = start - end, progress = start - n;
    return FIRST_RUNE_HEIGHT + (UNLOCKED - i) * UNLOCK_INTERVAL + Number((progress * BigInt(UNLOCK_INTERVAL) - 1n) / interval);
  }
  const reservedName = (block, tx) => RESERVED + (BigInt(block) << 32n | BigInt(tx));
  // the commitment: the name as a little-endian number, trailing zero bytes left off
  function commitment(n) { const o = []; while (n > 0n) { o.push(Number(n & 255n)); n >>= 8n; } return Uint8Array.from(o); }
  // the script a taproot script spend runs: second from last in the witness (third from last when there is an annex)
  function tapscript(w) {
    if (!w.length) return null;
    const pos = w.length >= 2 && w[w.length - 1][0] === 0x50 ? 3 : 2;
    return w.length >= pos ? w[w.length - pos] : null;
  }
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  function commitsIn(tx, n) {
    const c = commitment(n), found = [];
    tx.vin.forEach((v, i) => {
      const s = tapscript(v.witness); if (!s) return;
      for (const x of steps(s)) { if (!x) break; if (x.push && same(x.push, c)) { found.push(i); return; } }
    });
    return found;
  }
  const isP2tr = s => s.length === 34 && s[0] === 0x51 && s[1] === 0x20;
  // an ord envelope (an inscription) in a taproot script: OP_FALSE OP_IF "ord"
  const hasEnvelope = tx => tx.vin.some(v => { const s = tapscript(v.witness); return s && PV.hex(s).includes('0063036f7264'); });

  /* ---------- amounts, written the way ord writes them (pile.rs) ---------- */
  function pile(amount, div, symbol) {
    const cut = 10n ** BigInt(div), whole = amount / cut; let frac = amount % cut, w = div, s;
    if (frac === 0n) s = String(whole);
    else { while (frac % 10n === 0n) { frac /= 10n; w--; } s = whole + '.' + String(frac).padStart(w, '0'); }
    return s + ' ' + (symbol || '¤');
  }
  function unpile(t, div) {
    const m = /^(\d+)(?:\.(\d+))?/.exec(String(t || '').trim()); if (!m) return null;
    const f = (m[2] || ''); if (f.length > div) return null;
    return BigInt(m[1]) * 10n ** BigInt(div) + BigInt(f.padEnd(div, '0') || '0');
  }
  const big = v => v == null ? null : typeof v === 'bigint' ? v.toString() : v;
  const group = t => String(t).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /* ---------- ordinals.com's rune page ---------- */
  const unesc = t => String(t).replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  function pairs(h) { const o = {}; for (const m of h.matchAll(/<dt>([^<]*)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) o[unesc(m[1])] = unesc(m[2]); return o; }
  function readPage(html) {
    const i = html.indexOf('<main'), j = html.indexOf('</main>');
    let h = i >= 0 ? html.slice(i, j > i ? j : undefined) : html;
    const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(h); if (!h1) return null;
    const out = {name: unesc(h1[1])};
    const mm = /<dt>mint<\/dt>\s*<dd>\s*<dl>([\s\S]*?)<\/dl>\s*<\/dd>/.exec(h);
    if (mm) { out.mint = pairs(mm[1]); h = h.replace(mm[0], ''); }
    else if (/<dt>mint<\/dt>\s*<dd>no<\/dd>/.test(h)) out.mint = 'no';
    Object.assign(out, pairs(h));
    if (out.mint === undefined) delete out.mint;
    return out;
  }

  /* ---------- the proof ---------- */
  const isTxid = s => /^[0-9a-f]{64}$/i.test(s);
  const ZERO = '0'.repeat(64);
  function sha256d(u) { return PV.sha256(PV.sha256(u)); }
  const rev = u => Uint8Array.from(u).reverse();
  function merkleRoot(txid, siblings, pos) {
    let cur = rev(PV.fromHex(txid));
    siblings.forEach((s, i) => { const b = rev(PV.fromHex(s)), u = new Uint8Array(64); if ((pos >> i) & 1) { u.set(b); u.set(cur, 32); } else { u.set(cur); u.set(b, 32); } cur = sha256d(u); });
    return PV.hex(rev(cur));
  }
  const when = s => new Date(s * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  async function prove(q, io, progress) {
    const say = (k, v) => { if (progress) try { progress(k, v); } catch (e) {} };
    const t0 = String(q == null ? '' : q).trim().replace(/^#/, '');
    if (!t0) throw new Error('give a rune: its name (DOG•GO•TO•THE•MOON), its ID (840000:3), its number, or the etching transaction\'s ID');
    const sources = new Set(), R = {tool: 'Rune Proof', version: VERSION, query: String(q).trim(), rulesFrom: RULES_FROM};
    let mode, page = null, name = null;
    if (isTxid(t0)) mode = 'tx';
    else if (/^\d+:\d+$/.test(t0)) mode = 'id';
    else if (/^\d+$/.test(t0)) mode = 'number';
    else { name = parseName(t0); if (!name) throw new Error('not a rune name: a name is 1 to 28 letters A to Z, with • (or a dot) between letters if you like, e.g. DOG•GO•TO•THE•MOON'); mode = 'name'; }
    const ordRune = async key => { say('ordinals', key); const x = await io.ordPage('/rune/' + encodeURIComponent(key)); sources.add('ordinals.com'); return x; };

    // 1. ordinals.com first, unless it is a transaction
    let etchTx = null;
    if (mode !== 'tx') {
      const x = await ordRune(mode === 'name' ? name.letters : t0);
      if (x.status === 404) {
        if (mode !== 'name') return Object.assign(R, {answer: 'not found', verdict: 'ordinals.com has no rune ' + (mode === 'id' ? 'with the ID ' + t0 : 'number ' + t0) + '.', sources: [...sources]});
        const P = pairs(x.t), theirs = P['unlock height'], ours = unlockHeight(name.n), res = name.n >= RESERVED;
        const agree = res ? P.reserved === 'true' : theirs != null && +theirs === ours;
        return Object.assign(R, {answer: 'not etched', rune: {name: name.spaced, letters: name.letters},
          verdict: res ? 'Nobody has etched ' + name.spaced + ', and nobody can: a name this long (27 letters from AAAAAAAAAAAAAAAAAAAAAAAAAAA up) is reserved. ord gives such names itself, to etchings that don\'t choose one.'
            : 'Nobody has etched ' + name.spaced + ' yet (ordinals.com has no rune by that name). ' + (ours === 0 ? 'A name of ' + name.letters.length + ' letters could be etched from the start of runes.' : 'A name like this can be etched from block ' + group(ours) + '.') + (agree ? ' ordinals.com says the same' + (!P['unlock time'] || ours === 0 ? '.' : /expected/.test(P['unlock time']) ? ', and expects that block around ' + P['unlock time'].replace(/\s*\(expected\)$/, '') + '.' : ': that block came on ' + P['unlock time'] + '.') : ' ordinals.com says ' + (theirs ? 'block ' + group(theirs) : 'something else') + ': they differ.'),
          unlock: {block: ours, ordinals: theirs == null ? null : +theirs, same: agree, reserved: res, when: P['unlock time'] || null}, sources: [...sources]});
      }
      page = readPage(x.t);
      if (!page) throw new Error('ordinals.com\'s page for ' + t0 + ' could not be read');
      etchTx = page.etching;
    } else etchTx = t0.toLowerCase();

    // 2. UNCOMMON•GOODS: set in ord's own code, not etched in a transaction
    if (etchTx === ZERO) return Object.assign(R, goods(page), {sources: [...sources]});
    if (!isTxid(etchTx || '')) throw new Error('ordinals.com\'s page gave no etching transaction');

    // 3. the etching transaction's own bytes
    say('bytes', etchTx);
    let hx; try { hx = await io.mpText('/api/tx/' + etchTx + '/hex'); } catch (e) { if (/404/.test(String(e && e.message || e))) throw new Error('mempool.space doesn\'t know a transaction ' + etchTx + (mode === 'tx' ? '' : ' (the one ordinals.com says etched it)')); throw e; }
    sources.add(new URL(hx.site).host);
    const bytes = PV.fromHex(String(hx.t).trim()), tx = PV.parseTx(bytes);
    const tj = (await io.mpJson('/api/tx/' + etchTx)).j;
    const rules = [], add = (key, ok, what) => rules.push({key, ok, what});
    add('bytes', tx.txid === etchTx, tx.txid === etchTx ? 'The bytes are this transaction: their double SHA-256 is its ID.' : 'The bytes mempool.space gave are not this transaction (they hash to ' + tx.txid + ').');
    if (tx.txid !== etchTx) return Object.assign(R, {answer: 'differs', verdict: 'The bytes for ' + etchTx + ' could not be trusted: they hash to a different ID.', rules, sources: [...sources]});
    const st = tj.status || {}, confirmed = !!st.confirmed;
    let H = null, pos = null, time = null;
    if (confirmed) {
      say('block', st.block_height);
      H = st.block_height;
      const [mp, hdr, h1, h2] = await Promise.all([io.mpJson('/api/tx/' + etchTx + '/merkle-proof'), io.mpText('/api/block/' + st.block_hash + '/header'),
        io.mpText('/api/block-height/' + H), io.ordJson('/r/blockhash/' + H).catch(e => ({err: e}))]);
      if (!h2.err) sources.add('ordinals.com');
      const hb = PV.fromHex(String(hdr.t).trim()), bh = PV.hex(rev(sha256d(hb))), root = PV.hex(rev(hb.subarray(36, 68)));
      pos = mp.j.pos; time = hb[68] | hb[69] << 8 | hb[70] << 16 | hb[71] * 2 ** 24;
      const ordHash = h2.err ? null : String(h2.j).trim(), mpHash = String(h1.t).trim();
      add('block', bh === st.block_hash && mpHash === bh && (ordHash == null || ordHash === bh),
        bh === st.block_hash && mpHash === bh && ordHash === bh ? 'Block ' + group(H) + '\'s header hashes to its hash, and mempool.space and ordinals.com both give that hash for height ' + group(H) + '.'
          : bh === st.block_hash && mpHash === bh && ordHash == null ? 'Block ' + group(H) + '\'s header hashes to its hash, which mempool.space gives for height ' + group(H) + ' (ordinals.com didn\'t answer for it this time).'
          : 'Block ' + group(H) + '\'s hash doesn\'t add up: header ' + bh + ', mempool.space ' + mpHash + ', ordinals.com ' + ordHash + '.');
      const mr = merkleRoot(etchTx, mp.j.merkle || [], pos);
      add('place', mr === root && mp.j.block_height === H, mr === root ? 'The transaction is number ' + group(pos) + ' in block ' + group(H) + ' (counting from 0): its merkle path leads to the block\'s header.' : 'The transaction\'s merkle path does not lead to block ' + group(H) + '\'s header.');
    } else {
      const tip = +String((await io.mpText('/api/blocks/tip/height')).t).trim(); H = tip + 1;
      add('block', null, 'Not mined yet: it waits to be mined. What follows is worked out as if it is mined in the next block, ' + group(H) + '.');
    }

    // 4. the runestone, and the name's rules
    const D = decipher(tx);
    R.runestone = D ? {output: D.output, bytes: D.bytes, cenotaph: D.cenotaph, flaw: D.flaw, flawWords: D.flaw ? FLAWS[D.flaw] : null, mint: D.mint, pointer: D.pointer == null ? null : D.pointer,
      edicts: D.edicts ? D.edicts.length : 0, fieldsLeft: D.fieldsLeft || []} : null;
    if (!D) add('runestone', false, 'This transaction has no runestone (no output whose script starts OP_RETURN OP_13).');
    else add('runestone', D.cenotaph ? null : true, D.cenotaph ? 'Its runestone (output ' + D.output + ') is broken, a "cenotaph": ' + FLAWS[D.flaw] + '. ord burns the runes going in; ' + (D.etching && D.etching.rune != null ? 'the rune it names is still made, with nothing in it and no way to mint it.' : 'it makes no rune.') : 'Its runestone is in output ' + D.output + ' (' + D.bytes + ' bytes), and reads cleanly under ord\'s rules.');
    const E = D && D.etching;
    const tries = E ? (D.cenotaph ? E.rune : E.rune === undefined ? undefined : E.rune) : undefined;   // (undefined: it names no rune)
    if (!E || (D.cenotaph && tries == null)) {
      const what = !D ? 'has no runestone' : D.cenotaph ? 'has a broken runestone that names no rune' : D.mint ? 'mints rune ' + D.mint + (D.edicts.length ? ' and moves runes' : '') : D.edicts.length ? 'moves runes' : 'has a runestone that etches nothing';
      if (mode === 'tx' && !page) {
        let id = null; if (confirmed) { const x = await ordRune(H + ':' + pos); if (x.status === 200) { page = readPage(x.t); id = H + ':' + pos; } }
        if (!page) return Object.assign(R, {answer: 'no etching', verdict: 'This transaction doesn\'t etch a rune: it ' + what + '.' + (D && D.mint ? ' Give ' + D.mint + ' to prove that rune.' : ''), mintsRune: D && D.mint || null, rules, sources: [...sources]});
      } else if (page) return Object.assign(R, {answer: 'differs', verdict: 'ordinals.com says ' + page.name + ' was etched in ' + etchTx + ', but that transaction ' + what + '.', rules, sources: [...sources]});
    }
    let n = null, spacers = 0, nameOk = true;
    if (E && tries != null) {
      n = tries; spacers = D.cenotaph ? 0 : E.spacers || 0;
      const min = minimumAt(H), res = n >= RESERVED, at = unlockHeight(n);
      add('reserved', !res, res ? 'It names a reserved name (27 letters from AAAAAAAAAAAAAAAAAAAAAAAAAAA up), which can\'t be chosen.' : 'Its name is not a reserved name.');
      const unlocked = n >= min;
      add('unlocked', unlocked, unlocked ? letters(n) + ' (' + letters(n).length + ' letters) was unlocked at block ' + group(H) + (at > 0 ? ' (from block ' + group(at) + ')' : '') + '.' : letters(n) + ' was not unlocked yet at block ' + group(H) + ': it unlocks at block ' + group(at) + '.');
      const ins = commitsIn(tx, n); let cm = null;
      for (const i of ins) {
        const pv = tj.vin[i] && tj.vin[i].prevout, sp = pv ? PV.fromHex(pv.scriptpubkey) : new Uint8Array(0);
        if (!isP2tr(sp)) { cm = cm || {input: i, ok: false, why: 'the coin it spends is not a taproot output'}; continue; }
        const ps = (await io.mpJson('/api/tx/' + tx.vin[i].txid + '/status')).j;
        if (!ps.confirmed) { cm = cm || {input: i, ok: false, why: 'the transaction it spends is not mined yet'}; continue; }
        const conf = H - ps.block_height + 1;
        const c = {input: i, ok: conf >= COMMIT_CONFIRMATIONS, commitBlock: ps.block_height, commitTx: tx.vin[i].txid, confirmations: conf};
        if (c.ok) { cm = c; break; } cm = cm && cm.confirmations != null && cm.confirmations > conf ? cm : c;
      }
      R.commitment = cm ? Object.assign({bytes: PV.hex(commitment(n))}, cm) : {bytes: PV.hex(commitment(n)), ok: false};
      add('committed', !!(cm && cm.ok), cm && cm.ok ? 'It commits to the name: input ' + cm.input + '\'s taproot script holds the name, and the transaction it spends was mined in block ' + group(cm.commitBlock) + ', so it had ' + cm.confirmations + ' confirmations by block ' + group(H) + ' (at least ' + COMMIT_CONFIRMATIONS + ' are needed).'
        : !ins.length ? 'No input\'s taproot script holds the name, so it doesn\'t commit to it.'
        : cm.confirmations != null ? 'Input ' + cm.input + ' holds the name, but the transaction it spends was mined in block ' + group(cm.commitBlock) + ', so it had only ' + cm.confirmations + ' confirmation' + (cm.confirmations === 1 ? '' : 's') + ' by block ' + group(H) + ': at least ' + COMMIT_CONFIRMATIONS + ' are needed.'
        : 'Input ' + cm.input + ' holds the name, but ' + cm.why + '.');
      nameOk = !res && unlocked && !!(cm && cm.ok);
    } else if (E && !D.cenotaph) {
      n = confirmed ? reservedName(H, pos) : null; spacers = E.spacers || 0;
      add('reserved', true, 'It chooses no name, so ord gives it a reserved one, worked out from its block and place' + (confirmed ? ': ' + letters(n) + '.' : ' (known once it is mined).'));
    }
    const wanted = n != null ? spaced(n, spacers) : null;
    R.etching = summary(E, D, H);
    R.rune = {name: wanted, letters: n != null ? letters(n) : null, n: big(n), spacers, id: confirmed ? H + ':' + pos : null, etching: etchTx, block: confirmed ? H : null, position: confirmed ? pos : null, time: time ? when(time) : null};

    // 5. ordinals.com, for a transaction: the rune at its place (block:place), or by name
    if (mode === 'tx' && !page) {
      if (confirmed) { const x = await ordRune(H + ':' + pos); if (x.status === 200) page = readPage(x.t); }
      if (!confirmed) {
        const other = n != null ? (x => x.status === 200 ? readPage(x.t) : null)(await ordRune(letters(n))) : null, ok = nameOk && !other;
        return Object.assign(R, {answer: 'waiting', verdict: 'Waiting to be mined. If it is mined in the next block (' + group(H) + '), it ' + (n == null ? 'would make a rune with the reserved name ord gives it (worked out from its block and place, once it is mined).' : ok ? 'would make ' + wanted + '.' : 'would not make ' + wanted + ': ' + whyNot(rules, other) + '.'),
          taken: other ? {name: other.name, id: other.id, etching: other.etching} : null, rules, sources: [...sources]});
      }
      if (!page && n != null) {
        const x = await ordRune(letters(n));
        const other = x.status === 200 ? readPage(x.t) : null;
        const ob = other && /^\d+:\d+$/.test(other.id || '') ? other.id.split(':').map(Number) : null;
        const before = !!ob && (ob[0] < H || (ob[0] === H && ob[1] < pos)), ourNo = !nameOk || before;
        return Object.assign(R, {answer: ourNo ? 'not made' : 'differs',
          verdict: ourNo ? 'This transaction tried to etch ' + wanted + ', but no rune was made: ' + whyNot(rules, before ? other : null) + '.' + (other && !before ? ' (The name was etched later, by rune ' + other.id + '.)' : '') + ' ordinals.com agrees: it has no rune at ' + H + ':' + pos + '.'
            : 'By ord\'s rules this transaction should have made ' + wanted + ' (' + H + ':' + pos + '), but ordinals.com has no rune there.',
          taken: other ? {name: other.name, id: other.id, etching: other.etching} : null, rules, sources: [...sources]});
      }
      if (!page) return Object.assign(R, {answer: 'differs', verdict: 'ordinals.com has no rune at ' + H + ':' + pos + '.', rules, sources: [...sources]});
    }

    // 6. what the bytes say against what ordinals.com says
    const C = [], cmp = (field, chain, ord, words) => C.push({field, chain, ordinals: ord == null ? null : ord, same: ord != null && String(chain) === String(ord), words});
    const div = E && !D.cenotaph ? E.divisibility || 0 : 0, sym = E && !D.cenotaph ? E.symbol || null : null, prem = E && !D.cenotaph ? E.premine || 0n : 0n;
    const T = E && !D.cenotaph ? E.terms : null, turbo = E && !D.cenotaph ? E.turbo : false;
    cmp('name', wanted, page.name, 'its name, with its spacers');
    cmp('id', R.rune.id, page.id, 'its ID: block and place in the block');
    cmp('etching', etchTx, page.etching, 'the transaction that etched it');
    cmp('time', R.rune.time, page.timestamp, 'when its block was mined (from the block\'s header)');
    cmp('divisibility', div, page.divisibility, 'how many decimal places it has');
    cmp('symbol', sym || '(none)', page.symbol || '(none)', 'its symbol');
    cmp('premine', pile(prem, div, sym), page.premine, 'how much went to the etcher at the start');
    cmp('turbo', String(turbo), page.turbo, 'whether it takes part in future rune upgrades early');
    if (!T) cmp('mint', 'no', typeof page.mint === 'string' ? page.mint : page.mint ? 'yes' : null, 'whether it can be minted');
    else {
      const M = typeof page.mint === 'object' ? page.mint : {}, start = R.etching.terms.opens, end = R.etching.terms.closes;
      cmp('mint', 'yes', typeof page.mint === 'object' ? 'yes' : page.mint, 'whether it can be minted');
      cmp('mint opens', start == null ? 'none' : String(start), M.start, 'the block minting opens');
      cmp('mint closes', end == null ? 'none' : String(end), M.end, 'the block minting closes (it can\'t be minted in that block or after)');
      cmp('amount', T.amount == null ? 'none' : pile(T.amount, div, sym), M.amount, 'how much each mint makes');
      cmp('cap', String(T.cap || 0n), M.cap, 'how many times it can be minted');
    }
    cmp('parent', hasEnvelope(tx) ? 'an inscription' : '(none)', page.parent ? (page.parent === etchTx + 'i0' ? 'an inscription' : page.parent) : '(none)', 'whether the etching also made an inscription (its parent inscription)');
    // only ordinals.com counts these; check they add up
    const M = typeof page.mint === 'object' ? page.mint : null, adds = [];
    const sup = unpile(page.supply, div), mints = M && /^\d+$/.test(M.mints || '') ? BigInt(M.mints) : 0n, amt = T && T.amount || 0n;
    if (sup != null) adds.push({what: 'supply = premine + mints × amount', ok: sup === prem + mints * amt, words: 'how many there are now (' + page.supply + ') = what went to the etcher + each mint\'s amount for every mint so far'});
    if (M && T) adds.push({what: 'remaining = cap - mints', ok: /^\d+$/.test(M.remaining || '') && BigInt(M.remaining) === (T.cap || 0n) - mints, words: 'mints left (' + group(M.remaining) + ') = the cap - the mints so far'});
    const only = {number: page.number != null ? +page.number : null, supply: page.supply || null, burned: page.burned || null, premineShare: page['premine percentage'] || null,
      mints: M ? M.mints : null, remaining: M ? M.remaining : null, mintable: M ? M.mintable === 'true' : false, progress: M && M.progress || null, parent: page.parent || null};
    if (page.number != null) R.rune.number = +page.number;
    const bad = C.filter(c => !c.same), rulesBad = rules.filter(r => r.ok === false), addsBad = adds.filter(a => !a.ok);
    const proven = !bad.length && !rulesBad.length && !addsBad.length;
    R.answer = proven ? 'proven' : 'differs';
    R.verdict = proven ? 'Proven. The etching transaction\'s own bytes say the same as ordinals.com about all ' + C.length + ' things both can say, and ' + (tries != null ? 'the rune kept every rule: its name was unlocked, and committed to in a taproot spend with ' + R.commitment.confirmations + ' confirmations.' : 'it took the reserved name ord gives an etching that chooses none.') + (D.cenotaph ? ' Its runestone is broken (a cenotaph), so ord made the rune with nothing in it and no way to mint it, as ordinals.com shows.' : '') + ' ordinals.com\'s own counts (mints, supply) add up.'
      : 'Not the same. ' + [bad.length ? 'The bytes and ordinals.com differ about: ' + bad.map(c => c.field).join(', ') + '.' : '', rulesBad.length ? 'Rules not kept: ' + rulesBad.map(r => r.what).join(' ') : '', addsBad.length ? 'ordinals.com\'s counts don\'t add up: ' + addsBad.map(a => a.what).join('; ') + '.' : ''].filter(Boolean).join(' ');
    return Object.assign(R, {compare: C, rules, addsUp: adds, ordinalsOnly: only, sources: [...sources],
      note: 'compare: what the etching\'s own bytes say (chain) and what ordinals.com says (ordinals), field by field. rules: the proof that the bytes are the transaction and sit in its block, and the rules a new rune must keep (' + RULES_FROM + '). ordinalsOnly: what only an index can count (from ordinals.com alone); addsUp checks those counts add up. Amounts are written the way ord writes them.'});
  }
  // what an etching says, with its mint window worked out the way ord does (entry.rs: start and end)
  function summary(E, D, H) {
    if (!E || D.cenotaph) return null;
    const div = E.divisibility || 0, sym = E.symbol || null, prem = E.premine || 0n, T = E.terms;
    let start = null, end = null;
    if (T) {
      const r0 = T.offset[0] == null ? null : BigInt(H) + T.offset[0], a0 = T.height[0] == null ? null : T.height[0];
      start = r0 != null && a0 != null ? (r0 > a0 ? r0 : a0) : r0 != null ? r0 : a0;
      const r1 = T.offset[1] == null ? null : BigInt(H) + T.offset[1], a1 = T.height[1] == null ? null : T.height[1];
      end = r1 != null && a1 != null ? (r1 < a1 ? r1 : a1) : r1 != null ? r1 : a1;
    }
    return {divisibility: div, symbol: sym, premine: big(prem), premineShown: pile(prem, div, sym), turbo: !!E.turbo,
      terms: T ? {amount: big(T.amount), amountShown: T.amount == null ? null : pile(T.amount, div, sym), cap: big(T.cap), heightStart: big(T.height[0]), heightEnd: big(T.height[1]), offsetStart: big(T.offset[0]), offsetEnd: big(T.offset[1]),
        opens: big(start), closes: big(end), mostPossible: pile(prem + (T.cap || 0n) * (T.amount || 0n), div, sym)} : null};
  }
  function whyNot(rules, other) {
    const r = k => rules.find(x => x.key === k), low = t => t.replace(/^([A-Z])(?=[a-z' ])/, c => c.toLowerCase());
    for (const k of ['runestone', 'unlocked', 'reserved']) { const x = r(k); if (x && x.ok === false) return low(x.what.replace(/\.$/, '')); }
    if (other) return 'the name was already taken, by rune ' + other.id + ' (etched in ' + other.etching.slice(0, 12) + '…)';
    const c = r('committed'); if (c && c.ok === false) return low(c.what.replace(/\.$/, ''));
    return 'it broke a rule';
  }
  function goods(page) {
    const G = GOODS, T = G.terms, C = [], cmp = (field, chain, ord, words) => C.push({field, chain, ordinals: ord == null ? null : ord, same: ord != null && String(chain) === String(ord), words});
    const M = typeof page.mint === 'object' ? page.mint : {};
    cmp('name', spaced(G.n, G.spacers), page.name, 'its name, with its spacers'); cmp('id', G.id, page.id, 'its ID');
    cmp('divisibility', G.divisibility, page.divisibility, 'how many decimal places it has'); cmp('symbol', G.symbol, page.symbol, 'its symbol');
    cmp('premine', pile(G.premine, 0, G.symbol), page.premine, 'how much went to the etcher'); cmp('turbo', String(G.turbo), page.turbo, 'whether it takes part in future rune upgrades early');
    cmp('mint opens', String(T.height[0]), M.start, 'the block minting opens'); cmp('mint closes', String(T.height[1]), M.end, 'the block minting closes');
    cmp('amount', pile(T.amount, 0, G.symbol), M.amount, 'how much each mint makes'); cmp('cap', String(T.cap), M.cap, 'how many times it can be minted');
    const bad = C.filter(c => !c.same);
    return {answer: bad.length ? 'differs' : 'set in ord\'s code', rune: {name: spaced(G.n, G.spacers), letters: letters(G.n), id: G.id, etching: null, number: page.number != null ? +page.number : null},
      verdict: (bad.length ? 'Not the same: ordinals.com and ord\'s code differ about ' + bad.map(c => c.field).join(', ') + '. ' : 'The same as ord\'s own code. ') + 'UNCOMMON•GOODS was never etched in a transaction: ord writes it into its index itself (in src/index.rs), as rune 1:0, mintable by anyone from block 840,000 to 1,050,000, one at a time. So there are no bytes to read: its rules are checked against ord\'s code instead.',
      compare: C, ordinalsOnly: {number: page.number != null ? +page.number : null, supply: page.supply || null, burned: page.burned || null, mints: M.mints || null, remaining: M.remaining || null, mintable: M.mintable === 'true', progress: M.progress || null},
      note: 'compare: what ord\'s own code sets (chain) and what ordinals.com says (ordinals). ordinalsOnly: what only an index can count.'};
  }

  return {VERSION, RULES_FROM, decipher, parseName, letters, spaced, minimumAt, unlockHeight, reservedName, commitment, commitsIn, tapscript, pile, unpile, readPage, merkleRoot, prove, FLAWS};
});
