/* Agent Blockhall's Provenance Check, by bitmap22. Always free.
   Proves where a Bitcoin inscription came from, in the same steps as Agent Blockhall's "follow it back"
   (https://bitmap22.github.io/my-ordinal-portal/block-cube.html): it reads the inscription out of its own transaction's bytes
   (its file type, size, parents and delegate, matched with ordinals.com), takes a fingerprint (SHA-256) of the content stored
   on the chain and matches it with the file ordinals.com shows, checks the block it was made in with a second site, and
   follows every move from where it sits now back to where it was made: each step must spend the one before it.
   The same file runs in the free Agent Blockhall MCP tool and on the portal's Provenance Check page. It only reads and works
   things out: fetching is left to whoever uses it. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.ProvenanceCheck = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';

  /* ---------- SHA-256 (for transaction ids and content fingerprints) ---------- */
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
  const hex = u => Array.from(u, x => x.toString(16).padStart(2, '0')).join('');
  const revHex = u => hex(Uint8Array.from(u).reverse());
  const fromHex = t => { t = String(t || '').trim(); if (!/^([0-9a-f]{2})*$/i.test(t)) throw new Error('not hex'); const u = new Uint8Array(t.length >> 1); for (let i = 0; i < u.length; i++) u[i] = parseInt(t.substr(i * 2, 2), 16); return u; };
  const U8D = new TextDecoder('utf-8'), L1D = new TextDecoder('latin1');

  /* ---------- reading one transaction from its bytes ---------- */
  function parseTx(X, at) {
    const one = at == null; let p = one ? 0 : at; const p0 = p;
    const need = n => { if (p + n > X.length) throw new Error('the transaction ended early'); };
    const u32 = () => { need(4); const v = (X[p] | X[p + 1] << 8 | X[p + 2] << 16 | X[p + 3] << 24) >>> 0; p += 4; return v; };
    const vi = () => { need(1); const f = X[p++]; if (f < 0xfd) return f; if (f === 0xfd) { need(2); const v = X[p] | X[p + 1] << 8; p += 2; return v; } if (f === 0xfe) return u32(); const lo = u32(), hi = u32(); return hi * 2 ** 32 + lo; };
    const take = n => { need(n); const s = X.subarray(p, p + n); p += n; return s; };
    const version = u32();
    const sw = X[p] === 0 && X[p + 1] === 1; if (sw) p += 2;
    const a0 = p, vin = [], nin = vi();
    for (let i = 0; i < nin; i++) { const prev = take(32), vout = u32(), script = take(vi()), sequence = u32(); vin.push({txid: revHex(prev), vout, script, sequence, witness: []}); }
    const vout = [], nout = vi();
    for (let i = 0; i < nout; i++) { const lo = u32(), hi = u32(), script = take(vi()); vout.push({value: hi * 2 ** 32 + lo, script}); }
    const a1 = p;
    if (sw) for (const v of vin) { const n = vi(); for (let k = 0; k < n; k++) v.witness.push(take(vi())); }
    const lock = take(4);
    if (one && p !== X.length) throw new Error('bytes left over after the transaction');
    // its id: the double SHA-256 of the transaction without its witness data, byte-reversed
    const base = new Uint8Array(4 + (a1 - a0) + 4); base.set(X.subarray(p0, p0 + 4)); base.set(X.subarray(a0, a1), 4); base.set(lock, 4 + a1 - a0);
    const total = p - p0, stripped = base.length;
    return {txid: revHex(sha256(sha256(base))), version, vin, vout, segwit: sw, size: total, vsize: Math.ceil((stripped * 3 + total) / 4), end: p};
  }

  /* ---------- ord envelopes: OP_FALSE OP_IF "ord" ... OP_ENDIF in a taproot script, in input order ---------- */
  function pushes(s) {
    const o = []; let i = 0;
    while (i < s.length) {
      const opc = s[i++]; let n = -1;
      if (opc === 0) n = 0; else if (opc >= 1 && opc <= 75) n = opc; else if (opc === 76) n = s[i++]; else if (opc === 77) { n = s[i] | s[i + 1] << 8; i += 2; }
      else if (opc === 78) { n = (s[i] | s[i + 1] << 8 | s[i + 2] << 16 | s[i + 3] << 24) >>> 0; i += 4; }
      if (n < 0) { o.push({op: opc, data: opc >= 0x51 && opc <= 0x60 ? Uint8Array.of(opc - 0x50) : opc === 0x4f ? Uint8Array.of(0x81) : null}); continue; }
      if (i + n > s.length) break;
      o.push({op: opc, data: s.subarray(i, i + n)}); i += n;
    }
    return o;
  }
  // an inscription id written in a field (parent, delegate): the transaction id's 32 bytes reversed, then the index, little-endian, trailing zeros left off
  function idFromField(v) {
    if (!v || v.length < 32 || v.length > 36) return null;
    let n = 0; for (let i = v.length - 1; i >= 32; i--) n = n * 256 + v[i];
    return revHex(v.subarray(0, 32)) + 'i' + n;
  }
  const leNum = v => { let n = 0; for (let i = v.length - 1; i >= 0; i--) n = n * 256 + v[i]; return n; };
  function envelopes(tx) {
    const out = [];
    for (let i = 0; i < tx.vin.length; i++) {
      const w = tx.vin[i].witness.slice();
      if (w.length >= 2 && w[w.length - 1][0] === 0x50) w.pop();                  // (the annex)
      if (w.length < 2) continue;
      const cb = w[w.length - 1];
      if (!(cb.length >= 33 && (cb.length - 33) % 32 === 0 && (cb[0] & 0xfe) === 0xc0)) continue;   // (not a taproot script spend)
      const P = pushes(w[w.length - 2]);
      for (let k = 0; k + 2 < P.length; k++) {
        if (!(P[k].op === 0 && P[k + 1].op === 0x63 && P[k + 2].data && L1D.decode(P[k + 2].data) === 'ord')) continue;
        const f = {}, order = []; let j = k + 3, body = null, pushnum = false;
        while (j < P.length && P[j].op !== 0x68) {
          const tag = P[j];
          if (tag.op === 0 && body === null) { body = []; for (j++; j < P.length && P[j].op !== 0x68; j++) if (P[j].data) body.push(P[j].data); break; }
          if (tag.op >= 0x51 && tag.op <= 0x60) pushnum = true;
          const t = tag.data && tag.data.length === 1 ? tag.data[0] : tag.data ? 'x' + hex(tag.data) : 'op' + tag.op;
          const v = P[j + 1] && P[j + 1].op !== 0x68 ? P[j + 1].data || new Uint8Array(0) : null;
          (f[t] = f[t] || []).push(v); order.push(t);
          j += v === null ? 1 : 2;
        }
        k = j;
        const one = t => f[t] && f[t][0] ? f[t][0] : null;
        const bodyBytes = body ? (() => { let n = 0; for (const x of body) n += x.length; const u = new Uint8Array(n); let o = 0; for (const x of body) { u.set(x, o); o += x.length; } return u; })() : new Uint8Array(0);
        out.push({
          index: out.length, input: i,
          contentType: one(1) ? U8D.decode(one(1)) : null,
          parents: (f[3] || []).map(idFromField).filter(Boolean),
          delegate: one(11) ? idFromField(one(11)) : null,
          metaprotocol: one(7) ? U8D.decode(one(7)) : null,
          encoding: one(9) ? L1D.decode(one(9)) : null,
          pointer: one(2) ? leNum(one(2)) : null,
          hasBody: body !== null, body: bodyBytes, pushnum,
          duplicateFields: Object.keys(f).filter(t => t !== '3' && t !== '5' && f[t].length > 1).length > 0
        });
      }
    }
    return out;
  }

  /* ---------- one step back along an inscription's trail ----------
     A transaction hands its coins on in order, first in first out: counting along its outputs to the sat, then along its inputs,
     says which input the sat came in on, and so which output of which earlier transaction held it before. */
  function stepBack(tx, vout, offset) {
    let abs = offset; for (let k = 0; k < vout; k++) abs += tx.vout[k].value;
    let acc = 0;
    for (let k = 0; k < tx.vin.length; k++) {
      const v = tx.vin[k].prevout ? tx.vin[k].prevout.value : 0;
      if (abs < acc + v) return {input: k, txid: tx.vin[k].txid, vout: tx.vin[k].vout, offset: abs - acc, from: tx.vin[k].prevout.scriptpubkey_address || ''};
      acc += v;
    }
    return null;
  }

  /* ---------- putting the proof together ----------
     o: {id, info (ordinals.com's /r/inscription), infoSite, parents (ordinals.com's list), second (a second ord site's /r/inscription), secondSite,
         revealStatus ({confirmed, block_height, block_time} from mempool.space), statusSite, revealHex, hexSite,
         content (Uint8Array of the file ordinals.com shows, or null), contentSite, decompress (bytes => bytes, or null),
         trail ({steps, reached, lost, more, error}), trailSite, outspend ({spent}), nowTx (mempool.space's transaction that holds it now)} */
  const okType = t => /^[a-z0-9!#$&^_.+-]{1,40}\/[a-z0-9!#$&^_.+-]{1,60}(\s*;\s*[a-z0-9-]+=[a-z0-9_.-]{1,40})*$/i.test(t || '');
  function buildProvenance(o) {
    const id = o.id, gen = id.slice(0, 64), idx = +id.split('i').pop(), J = o.info || {}, diffs = [];
    const C = {};
    const chk = (name, against, agrees, what, extra) => { C[name] = Object.assign({against, agrees, what}, extra || {}); if (agrees === false) diffs.push(name); };
    // 1. the block it was made in
    const st = o.revealStatus;
    chk('madeInBlock', o.statusSite || null, st ? !!st.confirmed && st.block_height === J.height : null,
      st ? 'ordinals.com says block ' + J.height + '; ' + (o.statusSite || 'the second site') + ' says its transaction is in block ' + (st.confirmed ? st.block_height : 'none yet') : 'the second site did not answer');
    // 2. the transaction's own bytes, and the inscription read out of them
    let tx = null, env = null, txErr = null;
    if (o.revealHex) { try { tx = parseTx(fromHex(o.revealHex)); } catch (e) { txErr = String(e.message || e); } }
    chk('transactionBytes', o.hexSite || null, tx ? tx.txid === gen : null, tx ? 'its transaction\'s bytes (from ' + (o.hexSite || 'a second site') + ') work out to the transaction id in the inscription\'s id' : txErr ? 'its bytes could not be read: ' + txErr : 'the second site did not give its bytes');
    if (tx && tx.txid === gen) {
      const E = envelopes(tx); env = E[idx] || null;
      const want = {contentType: J.content_type || null, bytes: J.content_length != null ? J.content_length : null, parents: (o.parents || []).slice().sort(), delegate: J.delegate || null};
      if (!env) chk('readFromItsBytes', 'https://ordinals.com', false, 'no inscription number ' + idx + ' in its transaction (' + E.length + ' found)');
      else {
        const got = {contentType: env.contentType, bytes: env.body.length, parents: env.parents.slice().sort(), delegate: env.delegate};
        const differ = [];
        if ((got.contentType || null) !== (want.contentType || null)) differ.push('file type');
        if (want.bytes != null && got.bytes !== want.bytes) differ.push('size');
        if (o.parents && JSON.stringify(got.parents) !== JSON.stringify(want.parents)) differ.push('parents');
        if ((got.delegate || null) !== (want.delegate || null)) differ.push('delegate');
        chk('readFromItsBytes', o.infoSite || 'https://ordinals.com', !differ.length,
          'the inscription read out of its own transaction (inscription ' + idx + ' of ' + E.length + ' there): its file type, size, parents and delegate against ordinals.com' + (differ.length ? ': ' + differ.join(', ') + ' differ' : ''),
          differ.length ? {fromItsBytes: {contentType: got.contentType, bytes: got.bytes, parents: got.parents, delegate: got.delegate}, ordinalsCom: want} : undefined);
      }
    } else chk('readFromItsBytes', null, null, 'not read: its transaction\'s bytes are needed first');
    // 3. the content's fingerprint
    let fp = null, fpNote = '';
    if (env) {
      fp = hex(sha256(env.body));
      if (env.delegate && !env.body.length) { fpNote = 'it has no content of its own: it shows its delegate\'s content'; chk('contentFingerprint', null, null, fpNote); }
      else if (!o.content) chk('contentFingerprint', null, null, o.contentNote || 'the file ordinals.com shows was not fetched (too big, or it did not answer)');
      else {
        let mine = env.body, how = 'the content stored in its transaction';
        if (env.encoding) {
          if (o.decompress) { try { mine = o.decompress(env.body, env.encoding); how = 'the content stored in its transaction, unpacked (' + env.encoding + ')'; } catch (e) { mine = null; } }
          else mine = null;
        }
        if (!mine) chk('contentFingerprint', null, null, 'stored packed (' + env.encoding + '): this browser cannot unpack it to compare');
        else { const theirs = hex(sha256(o.content)), ours = hex(sha256(mine)); chk('contentFingerprint', o.contentSite || 'https://ordinals.com', ours === theirs, how + ' against the file ' + (o.contentSite || 'ordinals.com') + ' shows (SHA-256 of each)', {fileShown: theirs, onChain: ours}); }
      }
    }
    // 4. the trail: from where ordinals.com says it sits now, back over the second site's transactions, to where it was made
    const T = o.trail;
    chk('trail', o.trailSite || null, T ? T.reached === true ? true : T.lost || T.more || T.error ? null : false : null,
      T ? T.reached ? 'followed ' + T.steps.length + ' move' + (T.steps.length === 1 ? '' : 's') + ' back from where ordinals.com says it sits now, over ' + (o.trailSite || 'the second site') + '\'s transactions: each step spends the one before, and the last reaches the transaction that made it'
        : T.error ? 'not finished: ' + T.error : T.lost ? 'it went to a miner in a fee: past that block, its trail is in the block\'s fees' : T.more ? 'it moved more than ' + T.steps.length + ' times: the newest moves were checked' : 'the trail did not reach the transaction that made it'
        : 'not followed');
    // 5. who holds it now
    const sp = String(J.satpoint || '').split(':'), nowOut = o.nowTx && o.nowTx.vout ? o.nowTx.vout[+sp[1]] : null;
    const addrOk = nowOut ? (nowOut.scriptpubkey_address || null) === (J.address || null) : null;
    chk('heldNow', o.trailSite || null, o.outspend && nowOut ? !o.outspend.spent && addrOk : null,
      o.outspend && nowOut ? 'the output it sits in (' + J.satpoint.split(':').slice(0, 2).join(':') + ') ' + (o.outspend.spent ? 'has been spent, so it has moved since' : 'is unspent') + ', and its address ' + (addrOk ? 'matches' : 'does not match') + ' the holder ordinals.com names' : 'not checked');
    // 6. its number and sat, on a second ord site
    const S2 = o.second;
    chk('numberAndSat', o.secondSite || null, S2 ? S2.number === J.number && String(S2.sat) === String(J.sat) && S2.height === J.height : null,
      S2 ? 'its number, sat and block on ' + (o.secondSite || 'a second ord site') + ' against ordinals.com' : 'no second ord site answered');
    const vals = Object.values(C).map(c => c.agrees), nOk = vals.filter(v => v === true).length, nNo = vals.filter(v => v === false).length, nNone = vals.filter(v => v === null).length;
    const ctype = J.content_type || null;
    return {
      check: 'Agent Blockhall Provenance Check ' + VERSION,
      verdict: nNo ? nNo + ' of ' + vals.length + ' checks differ: ' + diffs.join(', ') : nOk + ' of ' + vals.length + ' checks agree' + (nNone ? ', ' + nNone + ' could not be made' : ''),
      inscription: {id, number: J.number, block: J.height, time: J.timestamp ? new Date(J.timestamp * 1000).toISOString().replace('.000', '') : null,
        contentType: okType(ctype) ? ctype : ctype ? 'not a standard type' : null, bytes: J.content_length != null ? J.content_length : null, fingerprint: fp ? {sha256: fp, of: 'the content as stored in its transaction'} : null,
        sat: J.sat != null ? J.sat : null, satpoint: J.satpoint || null, holder: J.address || null, parents: o.parents || [], delegate: J.delegate || null,
        packed: env && env.encoding ? env.encoding : null, metaprotocol: env && env.metaprotocol ? {untrusted: env.metaprotocol.slice(0, 80)} : null,
        inscriptionInItsTransaction: env ? {index: idx, input: env.input, of: envelopes(tx).length} : null},
      checked: C,
      trail: T && T.steps ? T.steps : [],
      sources: {inscription: o.infoSite || null, secondOrdSite: o.secondSite || null, transactions: o.trailSite || o.statusSite || null, bytes: o.hexSite || null, file: o.content ? o.contentSite : null}
    };
  }

  /* ---------- gathering everything, in the same steps for every host ----------
     io: {ordJson(path), ord2Json(path), ordText(path), ordBytes(path), mpJson(path), mpText(path), sleep(ms), decompress (or null)};
     each ...Json returns {j, site}, ...Text {t, site}, ordBytes {bytes, site}. */
  const TRAIL_MAX = 50, FILE_MAX = 2000000;
  const isInsId = t => /^[0-9a-f]{64}i\d+$/.test(t);
  async function resolve(q, io) {
    q = String(q == null ? '' : q).trim().toLowerCase().replace(/^#/, '').replace(/[,\s]/g, '');
    if (isInsId(q)) return q;
    if (!/^-?\d+$/.test(q)) throw new Error('give an inscription number (#1000) or its ID (64 hex characters, i, a number)');
    let html; try { html = (await io.ordText('/inscription/' + q)).t; } catch (e) { throw new Error(/404/.test(String(e)) ? 'there is no inscription #' + Number(q).toLocaleString('en-GB') + ' (yet)' : 'ordinals.com did not answer: try again in a moment'); }
    const m = html.match(/<dt>id<\/dt>\s*<dd[^>]*>(?:<[^>]+>)*\s*([0-9a-f]{64}i\d+)/);
    if (!m) throw new Error('ordinals.com\'s page for #' + q + ' could not be read');
    return m[1];
  }
  async function gather(q, io, progress) {
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const id = await resolve(q, io), gen = id.slice(0, 64);
    say('found', id);
    const info = await io.ordJson('/r/inscription/' + id); say('info', true);
    const J = info.j;
    const [par, second, status, raw, file] = await Promise.allSettled([
      io.ordJson('/r/parents/' + id).then(x => (say('parents', true), x)),
      io.ord2Json('/r/inscription/' + id).then(x => (say('second', true), x)),
      io.mpJson('/api/tx/' + gen).then(x => (say('status', true), x)),
      io.mpText('/api/tx/' + gen + '/hex').then(x => (say('bytes', true), x)),
      J.content_length != null && J.content_length <= FILE_MAX && !(J.delegate && !J.content_length) ? io.ordBytes('/content/' + id).then(x => (say('file', true), x)) : Promise.reject(new Error('skip'))]);
    for (const [k, r] of [['parents', par], ['second', second], ['status', status], ['bytes', raw]]) if (r.status !== 'fulfilled') say(k, false);
    // the trail, from where it sits now back to where it was made
    const T = {steps: [], reached: false}; let nowTx = null, outspend = null;
    let [txid, vout, off] = String(J.satpoint || '').split(':'); vout = +vout; off = +off;
    try {
      if (!/^[0-9a-f]{64}$/.test(txid || '') || !(vout >= 0) || !(off >= 0)) throw new Error('where it sits now could not be read');
      for (;;) {
        if (T.steps.length) await io.sleep(250);
        const x = await io.mpJson('/api/tx/' + txid), tx = x.j, st = tx.status || {};
        T.site = x.site;
        if (!nowTx) nowTx = tx;
        const o = tx.vout[vout];
        if (txid === gen) { T.steps.push({txid, block: st.confirmed ? st.block_height : null, time: st.block_time ? new Date(st.block_time * 1000).toISOString().replace('.000', '') : null, to: o && o.scriptpubkey_address || '', made: true}); T.reached = true; break; }
        if (T.steps.length >= TRAIL_MAX) { T.more = true; break; }
        T.steps.push({txid, block: st.confirmed ? st.block_height : null, time: st.block_time ? new Date(st.block_time * 1000).toISOString().replace('.000', '') : null, to: o && o.scriptpubkey_address || '', waiting: !st.confirmed || undefined});
        if (tx.vin.some(v => v.is_coinbase)) { T.lost = true; T.steps[T.steps.length - 1].toMiner = true; break; }
        const b = stepBack(tx, vout, off);
        if (!b) throw new Error('its trail could not be followed past ' + txid.slice(0, 12) + '\u2026');
        txid = b.txid; vout = b.vout; off = b.offset;
        say('trail', T.steps.length);
      }
    } catch (e) { T.error = String(e && e.message || e); }
    T.steps.reverse();   // (oldest first)
    try { const sp = String(J.satpoint).split(':'); outspend = (await io.mpJson('/api/tx/' + sp[0] + '/outspend/' + sp[1])).j; } catch (e) {}
    say('done', true);
    return buildProvenance({id, info: J, infoSite: info.site, parents: par.status === 'fulfilled' ? par.value.j.ids || [] : null,
      second: second.status === 'fulfilled' ? second.value.j : null, secondSite: second.status === 'fulfilled' ? second.value.site : null,
      revealStatus: status.status === 'fulfilled' ? status.value.j.status : null, statusSite: status.status === 'fulfilled' ? status.value.site : null,
      revealHex: raw.status === 'fulfilled' ? raw.value.t : null, hexSite: raw.status === 'fulfilled' ? raw.value.site : null,
      content: file.status === 'fulfilled' ? file.value.bytes : null, contentSite: file.status === 'fulfilled' ? file.value.site : null,
      contentNote: J.content_length > FILE_MAX ? 'the file is over 2 MB, so it was not fetched to compare' : null,
      decompress: io.decompress || null, trail: T, trailSite: T.site || null, outspend, nowTx});
  }

  return {VERSION, sha256, hex, fromHex, parseTx, envelopes, idFromField, stepBack, buildProvenance, resolve, gather};
});
