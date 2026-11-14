/* Second Opinion, by bitmap22. Always free. Part of Agent Blockhall: https://bitmap22.github.io/my-ordinal-portal/block-cube.html
   Checks a claim about Bitcoin against several sources, and says where they agree, where they don't, and why. It knows set kinds
   of claim, written in plain words (or as {kind, subject, value}):
   - a block's inscriptions, transactions, hash, fees or miner      ("block 840000 has 3,000 inscriptions", "block 840000 was mined by ViaBTC")
   - an inscription's block, number, sat, file type, size, holder or parent   ("#1000 was made in block 767,753", "#1000 is a child of #0")
   - a collection's size                                             ("collection #126744012 has 2 children")
   - what an address holds                                           ("address bc1q... holds #1000", "address bc1q... has 0.5 BTC")
   Each source says what it says; the chain's own bytes (a block or a transaction, worked out to its own hash) count for most.
   It uses the Block Manifest's block reader (manifest.js), the Provenance Check's transaction reader (provenance.js) and the
   Collection Check's trail (collection.js). The same file is for the portal's Second Opinion page and the free Agent Blockhall
   MCP tool. Fetching is left to whoever uses it (the io object: ordJson, ord2Json, ordText, ordList(height) -> ord's list of the
   block's inscription IDs, mpJson, mp2Json(path, notThisSite), mpText, mpBytes). No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('./provenance.js'), require('./manifest.js'), require('./collection.js'));
  else root.SecondOpinion = make(root.ProvenanceCheck, root.BlockManifest, root.CollectionCheck);
})(typeof self !== 'undefined' ? self : this, function (PV, BM, CC) {
  'use strict';
  const VERSION = '1.0.0';
  if (!PV || !BM || !CC) throw new Error('the Second Opinion needs provenance.js, manifest.js and collection.js loaded first');
  const fmt = n => Number(n).toLocaleString('en-GB');
  const ID = '(#?-?\\d+|[0-9a-f]{64}i\\d+)', ADDR = '(bc1[02-9ac-hj-np-z]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})';
  const num = t => +String(t).replace(/[,_\s]/g, '');
  const TYPES = {png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', html: 'text/html', text: 'text/plain',
    json: 'application/json', javascript: 'text/javascript', js: 'text/javascript', css: 'text/css', mp3: 'audio/mpeg', mp4: 'video/mp4', glb: 'model/gltf-binary', pdf: 'application/pdf'};
  const KINDS = {
    'block.inscriptions': 'how many inscriptions a block has', 'block.transactions': 'how many transactions a block has', 'block.hash': 'a block\'s hash',
    'block.fees': 'the fees a block paid (in sats)', 'block.miner': 'who mined a block', 'ins.block': 'the block an inscription was made in', 'ins.number': 'an inscription\'s number',
    'ins.sat': 'the sat an inscription sits on', 'ins.type': 'an inscription\'s file type', 'ins.size': 'an inscription\'s size (bytes)', 'ins.holder': 'who holds an inscription (its address)',
    'ins.parent': 'an inscription is a child of a parent (belongs to its collection)', 'coll.count': 'how many children a parent has', 'addr.holds': 'an address holds an inscription', 'addr.balance': 'how much bitcoin an address has (sats)'};

  /* ---------- reading a claim written in plain words ---------- */
  const SAY = [
    [new RegExp('^block\\s+([\\d,]+)\\s+(?:has|had|holds|contains)\\s+([\\d,]+)\\s+inscriptions?$'), m => ({kind: 'block.inscriptions', subject: num(m[1]), value: num(m[2])})],
    [new RegExp('^block\\s+([\\d,]+)\\s+(?:has|had|holds|contains)\\s+([\\d,]+)\\s+(?:transactions?|txs?)$'), m => ({kind: 'block.transactions', subject: num(m[1]), value: num(m[2])})],
    [new RegExp('^block\\s+([\\d,]+)(?:\'s)?\\s+hash\\s+(?:is\\s+)?([0-9a-f]{64})$'), m => ({kind: 'block.hash', subject: num(m[1]), value: m[2]})],
    [new RegExp('^block\\s+([\\d,]+)\\s+(?:paid|has|had|took|earned)\\s+([\\d,.]+)\\s*(sats?|btc)\\s+(?:in\\s+)?fees?$'), m => ({kind: 'block.fees', subject: num(m[1]), value: /btc/.test(m[3]) ? Math.round(num(m[2]) * 1e8) : num(m[2])})],
    [new RegExp('^block\\s+([\\d,]+)\\s+(?:was\\s+)?mined\\s+by\\s+(.{2,60})$'), m => ({kind: 'block.miner', subject: num(m[1]), value: m[2].trim()})],
    [new RegExp('^(?:inscription\\s+)?' + ID + '\\s+(?:was\\s+)?(?:made|inscribed|created|minted)\\s+in\\s+block\\s+([\\d,]+)$'), m => ({kind: 'ins.block', subject: m[1], value: num(m[2])})],
    [new RegExp('^(?:inscription\\s+)?([0-9a-f]{64}i\\d+)\\s+is\\s+(?:inscription\\s+)?(?:number\\s+)?#?(-?[\\d,]+)$'), m => ({kind: 'ins.number', subject: m[1], value: num(m[2])})],
    [new RegExp('^(?:inscription\\s+)?' + ID + '\\s+(?:is\\s+|sits\\s+)?on\\s+sat\\s+([\\d,]+)$'), m => ({kind: 'ins.sat', subject: m[1], value: num(m[2])})],
    [new RegExp('^(?:inscription\\s+)?' + ID + '\\s+is\\s+([\\d,]+)\\s*bytes?$'), m => ({kind: 'ins.size', subject: m[1], value: num(m[2])})],
    [new RegExp('^(?:inscription\\s+)?' + ID + '\\s+is\\s+(?:held|owned)\\s+by\\s+(?:address\\s+)?' + ADDR + '$', 'i'), m => ({kind: 'ins.holder', subject: m[1], value: m[2]})],
    [new RegExp('^address\\s+' + ADDR + '\\s+(?:holds|owns|has)\\s+(?:inscription\\s+)?' + ID + '$', 'i'), m => ({kind: 'addr.holds', subject: m[1], value: m[2]})],
    [new RegExp('^address\\s+' + ADDR + '\\s+(?:holds|owns|has)\\s+([\\d,.]+)\\s*(sats?|btc)$', 'i'), m => ({kind: 'addr.balance', subject: m[1], value: /btc/i.test(m[3]) ? Math.round(num(m[2]) * 1e8) : num(m[2])})],
    [new RegExp('^(?:inscription\\s+)?' + ID + '\\s+(?:is\\s+(?:a\\s+)?child\\s+of|belongs\\s+to(?:\\s+the\\s+collection\\s+of)?|is\\s+in\\s+the\\s+collection\\s+of)\\s+(?:parent\\s+|inscription\\s+)?' + ID + '$'), m => ({kind: 'ins.parent', subject: m[1], value: m[2]})],
    [new RegExp('^(?:collection|parent|inscription)\\s+' + ID + '\\s+has\\s+([\\d,]+)\\s+(?:children|child|pieces?|items?)$'), m => ({kind: 'coll.count', subject: m[1], value: num(m[2])})],
    [new RegExp('^(?:inscription\\s+)?' + ID + '\\s+is\\s+(?:an?\\s+)?([a-z0-9.+-]+\\/[a-z0-9.+-]+|' + Object.keys(TYPES).join('|') + ')(?:\\s+file|\\s+image)?$'), m => ({kind: 'ins.type', subject: m[1], value: TYPES[m[2].toLowerCase()] || m[2].toLowerCase()})]
  ];
  function parse(text) {
    const t0 = String(text || '').trim().replace(/[.?!]+$/, '').replace(/\s+/g, ' ');
    let t = t0.replace(/^(?:is it true that|is it true|check that|check|claim:)\s+/i, '');
    const approx = /\b(?:about|around|roughly|approximately|nearly)\s+(?=[\d~])|~\s*(?=\d)/i.test(t); t = t.replace(/\b(?:about|around|roughly|approximately|nearly)\s+(?=[\d~])|~\s*(?=\d)/ig, '');
    for (const [re, f] of SAY) { const m = t.match(new RegExp(re.source, 'i')); if (m) { const c = f(m); for (const k of ['subject', 'value']) if (typeof c[k] === 'string' && /^(#|[0-9a-f]{64})/i.test(c[k])) c[k] = c[k].toLowerCase(); return Object.assign(c, {text: t0}, approx && typeof c.value === 'number' ? {approx: true} : {}); } }
    throw new Error('this claim is not one of the kinds it can check. It checks: ' + Object.values(KINDS).join('; ') + '. Write it like "block 840000 has 3,000 inscriptions" or "#1000 was made in block 767,753"');
  }
  function normal(c) {
    if (typeof c === 'string') return parse(c);
    if (!c || !KINDS[c.kind]) throw new Error('kind must be one of: ' + Object.keys(KINDS).join(', '));
    return Object.assign({}, c, {text: c.text || c.kind + ' ' + c.subject + ' = ' + c.value});
  }

  /* ---------- the sources ---------- */
  const isIns = t => /^[0-9a-f]{64}i\d+$/.test(String(t));
  async function insId(q, io) { return PV.resolve(String(q).replace(/^inscription\s+/, ''), io); }
  async function blockHash(h, io) { const x = await io.mpText('/api/block-height/' + h); return {hash: x.t.trim(), site: x.site}; }
  async function blockBytes(hash, io) { return io.mpBytes('/api/block/' + hash + '/raw'); }
  const S = (source, says, agrees, how, kind) => ({source, says, agrees, how, kind});
  let APPROX = false;   // (set for the claim being checked: "about 37.6 BTC" agrees within 1%)
  const same = (v, want) => typeof v === 'number' && typeof want === 'number' ? (APPROX ? Math.abs(v - want) <= Math.abs(want) * 0.01 : v === want) : v === want;

  async function gather(c, io, say) {
    const out = [], note = [];
    const tryIt = async (f, label) => { try { await f(); } catch (e) { out.push(S(label, null, null, 'did not answer: ' + String(e && e.message || e).slice(0, 100), null)); } };
    const k = c.kind;
    if (k.startsWith('block.')) {
      const h = c.subject; let H = null, X = null;
      await tryIt(async () => { H = await blockHash(h, io); }, 'mempool.space (or a copy)');
      say('sources', 1);
      if (k === 'block.hash') {
        if (H) out.push(S(H.site, H.hash, H.hash === c.value, 'block ' + fmt(h) + '\'s hash, as this mempool site has it', 'mempool'));
        await tryIt(async () => { const x = await io.ordText('/r/blockhash/' + h); const v = x.t.trim().replace(/^"|"$/g, ''); out.push(S(x.site, v, v === c.value, 'block ' + fmt(h) + '\'s hash, as ord has it', 'ord')); }, 'ordinals.com');
        if (H) await tryIt(async () => { const x = await io.mpText('/api/block/' + H.hash + '/header'); const v = BM.hashHex(PV.fromHex(x.t.trim())); out.push(S('the chain (its header, from ' + x.site.replace(/^https:\/\//, '') + ')', v, v === c.value, 'the hash worked out from the block\'s own 80-byte header', 'chain')); }, 'the block\'s header');
      }
      if (k === 'block.transactions' || k === 'block.inscriptions' || k === 'block.miner') {
        if (H) await tryIt(async () => { const x = await blockBytes(H.hash, io); X = x.bytes; X.site = x.site; }, 'the block\'s bytes');
      }
      if (k === 'block.transactions') {
        if (H) await tryIt(async () => { const x = await io.mpJson('/api/block/' + H.hash); out.push(S(x.site, x.j.tx_count, same(x.j.tx_count, c.value), 'its transaction count, as this mempool site has it', 'mempool')); }, 'mempool.space');
        await tryIt(async () => { const x = await io.ordJson('/r/blockinfo/' + h); out.push(S(x.site, x.j.transaction_count, same(x.j.transaction_count, c.value), 'its transaction count, as ord has it', 'ord')); }, 'ordinals.com');
        if (X) { const T = BM.scanBlock(X, h); const ok = T.hash === H.hash; out.push(S('the chain (its bytes, from ' + X.site.replace(/^https:\/\//, '') + ')', T.txs.length, same(T.txs.length, c.value), 'counted in the block\'s own bytes' + (ok ? ', which work out to its hash' : ', which did NOT work out to its hash'), 'chain')); }
      }
      if (k === 'block.inscriptions') {
        await tryIt(async () => { const ids = await io.ordList(h); out.push(S('https://ordinals.com', ids.length, same(ids.length, c.value), 'its list of inscriptions, read to the end', 'ord')); c._ordIds = ids; }, 'ordinals.com');
        if (X) {
          const T = BM.scanBlock(X, h), ids = []; for (const r of T.txs) for (const e of r.ins) ids.push(r.txid + 'i' + e.index);
          out.push(S('the chain (its bytes, from ' + X.site.replace(/^https:\/\//, '') + ')', ids.length, same(ids.length, c.value), 'inscriptions read out of every transaction in the block\'s own bytes' + (T.hash === H.hash ? ', which work out to its hash' : ', which did NOT work out to its hash'), 'chain'));
          if (c._ordIds) { const A = new Set(c._ordIds), B = new Set(ids), onlyOrd = c._ordIds.filter(i => !B.has(i)), onlyBytes = ids.filter(i => !A.has(i));
            if (onlyOrd.length || onlyBytes.length) note.push('ord lists ' + fmt(onlyOrd.length) + ' the bytes reader does not find' + (onlyOrd.length ? ' (e.g. ' + onlyOrd.slice(0, 3).join(', ') + ')' : '') + ', and the bytes show ' + fmt(onlyBytes.length) + ' ord does not list' + (onlyBytes.length ? ' (e.g. ' + onlyBytes.slice(0, 3).join(', ') + ')' : '') + '. ord has its own rules for which writings count as inscriptions, so the two can differ; the Block Manifest page shows each one.'); }
        }
      }
      if (k === 'block.fees') {
        if (H) await tryIt(async () => { const x = await io.mpJson('/api/v1/block/' + H.hash); const v = x.j.extras && x.j.extras.totalFees; out.push(S(x.site, v, same(v, c.value), 'its total fees, as this mempool site has it', 'mempool')); }, 'mempool.space');
        await tryIt(async () => { const x = await io.ordJson('/r/blockinfo/' + h); out.push(S(x.site, x.j.total_fee, same(x.j.total_fee, c.value), 'its total fees, as ord has it', 'ord')); }, 'ordinals.com');
        note.push('fees are not written in a block: each site adds up its transactions\' fees');
      }
      if (k === 'block.miner') {
        const like = (a, b) => String(a || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(String(b || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (H) await tryIt(async () => { const x = await io.mpJson('/api/v1/block/' + H.hash); const v = x.j.extras && x.j.extras.pool && x.j.extras.pool.name; out.push(S(x.site, v || 'unknown', v ? like(v, c.value) || like(c.value, v) : null, 'the pool this mempool site names (from its own list of pools\' tags and addresses)', 'mempool')); }, 'mempool.space');
        if (X) { const w = BM.scanBlock(X, h).coinbase.words || ''; out.push(S('the chain (its coinbase, from ' + X.site.replace(/^https:\/\//, '') + ')', w.slice(0, 80) || '(no words)', w ? like(w, c.value) : null, 'the words the miner wrote in the block\'s first transaction', 'chain')); }
        note.push('the coinbase\'s words are the miner\'s own; a pool name from a site is its reading of them (and of the payout address)');
      }
    }
    if (k.startsWith('ins.') || k === 'coll.count' || k === 'addr.holds') {
      const id = await insId(k === 'addr.holds' ? c.value : c.subject, io), gen = id.slice(0, 64), idx = +id.split('i').pop(); c._id = id;
      let J = null, J2 = null, env = null, txSite = null;
      await tryIt(async () => { const x = await io.ordJson('/r/inscription/' + id); J = x.j; J.site = x.site; }, 'ordinals.com');
      await tryIt(async () => { const x = await io.ord2Json('/r/inscription/' + id); J2 = x.j; J2.site = x.site; }, 'a second ord site');
      say('sources', 2);
      if (/^ins\.(type|size|parent)$/.test(k)) await tryIt(async () => { const x = await io.mpText('/api/tx/' + gen + '/hex'); const T = PV.parseTx(PV.fromHex(x.t.trim())); if (T.txid !== gen) throw new Error('its bytes did not work out to its id'); env = PV.envelopes(T)[idx] || null; txSite = x.site; }, 'its transaction\'s bytes');
      const chainSrc = 'the chain (its transaction, from ' + String(txSite || '').replace(/^https:\/\//, '') + ')';
      const two = (field, f, how, eq) => { for (const j of [J, J2]) if (j) { const v = f(j); out.push(S(j.site, v == null ? 'not given' : v, v == null ? null : eq ? eq(v) : v === c.value, how, 'ord')); } };
      if (k === 'ins.block') {
        two('height', j => j.height, 'the block it was made in, as this ord site has it');
        await tryIt(async () => { const x = await io.mpJson('/api/tx/' + gen); const st = x.j.status || {}; const v = st.confirmed ? st.block_height : null; out.push(S(x.site, v == null ? 'not in a block yet' : v, v == null ? false : v === c.value, 'the block its transaction is in, as this mempool site has it', 'mempool')); }, 'mempool.space');
      }
      if (k === 'ins.number') { two('number', j => j.number, 'its number, as this ord site has it'); note.push('numbers are not written on the chain: they come from ord indexers counting inscriptions in order'); }
      if (k === 'ins.sat') { two('sat', j => j.sat, 'the sat it sits on, as this ord site has it'); note.push('sat numbers come from ord indexers following every sat from the block that mined it'); }
      if (k === 'ins.type') {
        const base = v => String(v || '').split(';')[0].trim().toLowerCase(), want = base(c.value);
        two('type', j => j.content_type, 'its file type, as this ord site has it', v => base(v) === want);
        if (env) out.push(S(chainSrc, env.contentType || 'none', base(env.contentType) === want, 'its file type, read out of its own transaction', 'chain'));
      }
      if (k === 'ins.size') {
        two('size', j => j.content_length, 'its size, as this ord site has it');
        if (env) out.push(S(chainSrc, env.body.length, same(env.body.length, c.value), 'its size, read out of its own transaction' + (env.encoding ? ' (stored packed: ' + env.encoding + ')' : ''), 'chain'));
      }
      if (k === 'ins.holder' || k === 'addr.holds') {
        const A = k === 'ins.holder' ? c.value : c.subject;
        two('address', j => j.address, 'the address holding it, as this ord site has it', v => v === A);
        if (J && J.satpoint) await tryIt(async () => { const [t, o] = J.satpoint.split(':'); const x = await io.mpJson('/api/tx/' + t); const out1 = x.j.vout[+o]; const sp = (await io.mpJson('/api/tx/' + t + '/outspend/' + o)).j;
          const v = sp.spent ? 'moved since (the output it sat in is spent)' : out1.scriptpubkey_address; out.push(S(x.site, v, !sp.spent && v === A, 'the output it sits in (' + t.slice(0, 10) + '…:' + o + ') and its address, as this mempool site has it', 'mempool')); }, 'mempool.space');
      }
      if (k === 'ins.parent') {
        const pid = await insId(c.value, io); c._pid = pid;
        await tryIt(async () => { const x = await io.ordJson('/r/parents/' + id); const v = (x.j && x.j.ids) || []; out.push(S(x.site, v.length ? v.join(', ') : 'no parent', v.includes(pid), 'its parents, as ord has them', 'ord')); }, 'ordinals.com');
        if (env) out.push(S(chainSrc, env.parents.length ? env.parents.join(', ') : 'names no parent', env.parents.includes(pid), 'the parent named in its own transaction', 'chain'));
        if (env && env.parents.includes(pid)) await tryIt(async () => {
          // was the parent spent to make it? follow the parent's trail back until the transaction that made this child (the Collection Check's way)
          const P = (await io.ordJson('/r/inscription/' + pid)).j, sp = String(P.satpoint || '').split(':');
          const run = {pid, gen: pid.slice(0, 64), parent: P, list: [{id}], txs: new Map(), trail: {moves: [], at: {txid: sp[0], vout: +sp[1], offset: +sp[2]}, reached: false, lost: false, error: null, linkBad: 0}, extraFound: []};
          await CC.walk(run, io, {stop: () => run.trail.moves.some(m => m.txid === gen) || run.trail.moves.length > 5000, deadline: Date.now() + 60000}, (kk, v) => say('trail', v));
          const hit = run.trail.moves.some(m => m.txid === gen);
          out.push(S('the chain (the parent\'s trail)', hit ? 'the parent was spent to make it' : run.trail.reached ? 'the parent was not spent to make it' : 'not reached (followed ' + fmt(run.trail.moves.length) + ' moves)', hit ? true : run.trail.reached ? false : null,
            'the parent\'s moves followed back from where it sits now: ord counts a child only if the parent was spent to make it', 'chain'));
        }, 'the parent\'s trail');
      }
      if (k === 'coll.count') {
        const count = async (j, site) => { let n = 0; for (let p = 0; p < 3000; p++) { const x = await j('/r/children/' + id + (p ? '/' + p : '')); n += ((x.j && x.j.ids) || []).length; site.s = x.site; if (!x.j || !x.j.more) break; } return n; };
        for (const [f, label] of [[io.ordJson, 'ordinals.com'], [io.ord2Json, 'a second ord site']]) await tryIt(async () => { const site = {}; const n = await count(f, site); out.push(S(site.s, n, same(n, c.value), 'its children, counted through its list', 'ord')); }, label);
        note.push('a count is what ord lists; the Collection Check proves each child on the chain');
      }
    }
    if (k === 'addr.balance') {
      let first = null;
      await tryIt(async () => { const x = await io.mpJson('/api/address/' + c.subject); first = x.site; const s = x.j.chain_stats, v = s.funded_txo_sum - s.spent_txo_sum; out.push(S(x.site, v, same(v, c.value), 'its confirmed balance in sats, as this mempool site has it' + (x.j.mempool_stats && (x.j.mempool_stats.funded_txo_sum || x.j.mempool_stats.spent_txo_sum) ? ' (more is waiting to be mined)' : ''), 'mempool')); }, 'mempool.space');
      await tryIt(async () => { const x = await io.mp2Json('/api/address/' + c.subject, first); const s = x.j.chain_stats, v = s.funded_txo_sum - s.spent_txo_sum; out.push(S(x.site, v, same(v, c.value), 'its confirmed balance in sats, as a second, separate site has it', 'mempool')); }, 'a second mempool site');
    }
    return {sources: out, notes: note};
  }

  /* ---------- the answer ---------- */
  async function check(claim, io, progress) {
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const c = normal(claim); say('read', c.kind); APPROX = !!c.approx;
    const {sources, notes} = await gather(c, io, say);
    const show = v => typeof v === 'number' ? (/fees|balance/.test(c.kind) ? fmt(v) + ' sats (' + (v / 1e8).toLocaleString('en-GB', {maximumFractionDigits: 8}) + ' BTC)' : fmt(v)) : /^\d+$/.test(String(v)) && String(v).length < 16 ? fmt(+v) : String(v);
    const used = sources.filter(s => s.agrees !== null), yes = used.filter(s => s.agrees), no = used.filter(s => s.agrees === false), chain = used.filter(s => s.kind === 'chain');
    let answer, verdict;
    if (!used.length) { answer = 'unknown'; verdict = 'Could not be checked: no source answered it'; }
    else if (!no.length) { answer = 'true'; verdict = 'True: ' + (yes.length === 1 ? 'the one source that answered agrees' : yes.length === 2 ? 'both sources agree' : 'all ' + yes.length + ' sources agree') + (c.approx ? ' (within 1%)' : '') + (chain.length ? ', the chain itself included' : ''); }
    else if (!yes.length) { const vals = [...new Set(no.map(s => show(s.says)))]; answer = 'false'; verdict = 'False: ' + (vals.length === 1 ? (no.length === 1 ? 'the source says ' : no.length === 2 ? 'both sources say ' : 'all ' + no.length + ' sources say ') + vals[0] : 'the sources say ' + vals.join(' / ')); }
    else { answer = chain.length ? (chain.every(s => s.agrees) ? 'true' : 'false') : 'mixed'; verdict = 'The sources differ: ' + yes.length + ' agree, ' + no.length + ' don\'t' + (chain.length ? '; the chain itself says ' + (chain.every(s => s.agrees) ? 'it is true' : show(chain[0].says)) : ''); }
    const r = {check: 'Agent Blockhall Second Opinion ' + VERSION, claim: {text: c.text, kind: c.kind, means: KINDS[c.kind], subject: c.subject, value: c.value, approx: c.approx || undefined, inscription: c._id, parent: c._pid},
      answer, verdict, sources, why: notes, checkedAt: new Date().toISOString().replace(/\.\d{3}/, '')};
    say('done', true);
    return r;
  }

  return {VERSION, KINDS, parse, check};
});
