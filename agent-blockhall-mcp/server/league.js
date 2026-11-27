/* Truth League, by bitmap22. Always free. Part of Agent Blockhall: https://ordportal.com/block-cube.html
   Which of the free public data sites the portal's tools read tell the truth. Every few hours each site is asked a few facts
   whose answers can be worked out from the chain's own bytes, and each answer is marked right or wrong against those bytes:
   never against another site.
   - The truth for each check is one whole block, read from its own bytes and proved by them:
     Bitcoin: its hash is worked out from its header and starts with at least 70 zero bits (its proof of work, which no one
     could fake), its transactions are each worked out to their ids and lead to the header's merkle root (so the list is whole
     and in order), and its first transaction says its height (as Bitcoin's rules require since block 227,931).
   - Each site is then asked what it is for: a block's hash, a transaction's bytes and its block (mempool.space, ordpool.space,
     mempool.space's Frankfurt server and blockstream.info), an inscription's file and record, and inscription #0's file (ordinals.com).
   (24 Nov 2026: only sites whose terms allow the portal's use are asked; Dogecoin is paused. See SOURCES.md in the portal's repository.)
   - Right: the same as the bytes. Wrong: a different answer (kept, with what it said and what the bytes say). A site that
     refused, did not have it, gave an error or did not answer is counted as that, never as wrong.
   GitHub's computers do this every few hours and keep the last 30 days (the truth-league branch of the portal's own
   repository); a person or an AI agent can also run the same checks from their own computer. The same file is for the
   portal's Truth League page, the free Agent Blockhall MCP tool and that timed check. Needs the Provenance Check reader
   (provenance.js, in this folder). No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('./provenance.js'), null);
  else root.TruthLeague = make(root.ProvenanceCheck, root.DogeProvenance);
})(typeof self !== 'undefined' ? self : this, function (P, DP) {
  'use strict';
  const VERSION = '1.1.0';
  const WAIT_MS = 20000, BLOCK_WAIT_MS = 90000, KEEP_DAYS = 30, KEEP_WRONG = 200, MIN_ZERO_BITS = 70, DOGE_AGREE = 2;
  const RECORD_URLS = ['https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/truth-league/league.json',
    'https://cdn.jsdelivr.net/gh/bitmap22/my-ordinal-portal@truth-league/league.json'];   // (the second is a copy that can be some hours old)
  const ZERO = {bitcoin: '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0', doge: '15f3b73df7e5c072becb1d84191843ba080734805addfccb650929719080f62ei0'};
  const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE). What each site said is its own answer.';

  /* ---------- the sites, and what each is asked ---------- */
  const mp = (site, what) => ({site, chain: 'bitcoin', kind: 'mempool', group: 'Blocks and transactions', base: 'https://' + site, what});
  const ord = (site, what) => ({site, chain: 'bitcoin', kind: 'ord', group: 'Inscriptions', base: 'https://' + site, what});
  const SITES = [
    mp('mempool.space', 'blocks, transactions, fees and prices'), mp('ordpool.space', 'blocks and transactions, from its own node'),
    mp('mempool.fra.mempool.space', 'mempool.space\'s own second server'), mp('blockstream.info', 'blocks and transactions'),
    ord('ordinals.com', 'inscriptions, their files and records (ord’s own site)')
  ];
  const CHAINS = {bitcoin: 'Bitcoin'};
  const pick = () => SITES;   // (Bitcoin only)
  const site = name => SITES.find(s => s.site === String(name || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''));

  const txt = b => new TextDecoder().decode(b).trim();
  const js = b => JSON.parse(txt(b));
  const fp = b => P.hex(P.sha256(b));
  const lower = s => String(s).trim().toLowerCase();
  // the facts: what is asked (path, from the truth), how the answer is read, and what the bytes say it should be
  const F = {
    hash: {words: 'a block’s hash'}, bytes: {words: 'a transaction’s bytes'}, place: {words: 'which block a transaction is in'},
    file: {words: 'an inscription’s file'}, record: {words: 'an inscription’s record'}, old: {words: 'inscription #0’s file'}
  };
  const FACTS = {
    mempool: [
      {f: 'hash', path: t => '/api/block-height/' + t.h, read: b => lower(txt(b)), want: t => t.hash},
      {f: 'bytes', need: 'tx', path: t => '/api/tx/' + t.tx.id + '/hex', read: b => lower(txt(b)), want: t => t.tx.hex, short: true},
      {f: 'place', need: 'tx', path: t => '/api/tx/' + t.tx.id + '/status', read: b => { const j = js(b); return [j.block_height, j.block_hash]; }, want: t => [t.h, t.hash]}],
    ord: [
      {f: 'hash', path: t => '/r/blockhash/' + t.h, read: b => lower(js(b)), want: t => t.hash},
      {f: 'file', need: 'ins', path: t => '/content/' + t.ins.id, read: b => fp(b), want: t => t.ins.sha, isFile: true},
      {f: 'record', need: 'ins', path: t => '/r/inscription/' + t.ins.id, read: b => { const j = js(b); return [j.height, j.content_length, j.content_type]; }, want: t => [t.h, t.ins.length, t.ins.type], keep: b => ({number: js(b).number})},
      {f: 'old', need: 'zero', path: t => '/content/' + t.zero.id, read: b => fp(b), want: t => t.zero.sha, isFile: true}],
    none: []
  };
  const factsOf = s => FACTS[s.kind] || [];

  /* ---------- asking ---------- */
  async function ask(url, opt, wait) {
    const go = opt && opt.fetch || fetch, t0 = Date.now(), ctl = new AbortController(), ms = wait || opt && opt.wait || WAIT_MS, timer = setTimeout(() => ctl.abort(), ms);
    try {
      const init = {signal: ctl.signal}; if (typeof window !== 'undefined') init.cache = 'no-store';
      const r = await go(url, init), bytes = new Uint8Array(await r.arrayBuffer());
      return {http: r.status, ms: Date.now() - t0, bytes};
    } catch (e) { return {http: null, ms: Date.now() - t0, failed: e && e.name === 'AbortError' ? 'nothing in ' + Math.round(ms / 1000) + ' seconds'
      : typeof window !== 'undefined' ? 'it could not be reached, or would not let this page read it' : 'it could not be reached (' + String(e && e.cause && e.cause.code || e && e.message || e).slice(0, 60) + ')'}; }
    finally { clearTimeout(timer); }
  }
  // what one answer was: R right, W wrong, M did not have it, F refused, E an error or an answer that could not be read, N no answer
  const CODES = {R: 'right', W: 'wrong', M: 'did not have it', F: 'refused', E: 'error', N: 'no answer', '-': 'not asked'};
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const brief = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > 140 ? s.slice(0, 70) + '…' + s.slice(-20) + ' (' + s.length + ' characters)' : s; };
  async function askFact(s, q, t, opt) {
    const url = s.base + q.path(t), r = await ask(url, opt), out = {fact: q.f, asked: url, ms: r.ms, http: r.http};
    if (r.failed) return Object.assign(out, {code: 'N', note: r.failed});
    if (r.http === 401 || r.http === 403 || r.http === 429) return Object.assign(out, {code: 'F', note: r.http === 429 ? 'asked us to slow down (http 429)' : 'said no (http ' + r.http + ')'});
    if (r.http === 404) return Object.assign(out, {code: 'M', note: 'it did not have it (http 404)'});
    if (r.http < 200 || r.http > 299) return Object.assign(out, {code: 'E', note: 'http ' + r.http});
    let said; try { said = q.read(r.bytes); } catch (e) { return Object.assign(out, {code: 'E', note: 'its answer could not be read'}); }
    if (q.keep) try { Object.assign(out, q.keep(r.bytes)); } catch (e) {}   // (kept beside the answer, never scored: see numbers below)
    const want = q.want(t);
    if (same(said, want)) return Object.assign(out, {code: 'R'});
    return Object.assign(out, {code: 'W', said: q.isFile ? {bytes: r.bytes.length, sha256: said} : brief(said), truth: q.isFile ? {sha256: want} : brief(want)});
  }
  // one site: its facts in turn (a site is never asked two things at once)
  async function askSite(s, truth, opt) {
    const t = truth[s.chain], out = {site: s.site, chain: s.chain, kind: s.kind, facts: []};
    for (const q of factsOf(s)) {
      if (!t || (q.need && !t[q.need])) { out.facts.push({fact: q.f, code: '-', note: !t ? 'no proven block this time' : 'nothing to ask this time'}); continue; }
      out.facts.push(await askFact(s, q, t, opt));
    }
    return out;
  }

  /* ---------- the truth: one whole block from its own bytes ---------- */
  const rev = u => P.hex(Uint8Array.from(u).reverse());
  const dsha = u => P.sha256(P.sha256(u));
  function varint(X, p) { const f = X[p]; if (f < 253) return [f, p + 1]; const n = f === 253 ? 2 : f === 254 ? 4 : 8; let v = 0; for (let i = 0; i < n; i++) v += X[p + 1 + i] * 2 ** (8 * i); return [v, p + 1 + n]; }
  function merkle(ids) {
    let l = ids.map(h => P.fromHex(h).reverse());
    while (l.length > 1) { if (l.length % 2) l.push(l[l.length - 1]); const n = []; for (let i = 0; i < l.length; i += 2) { const c = new Uint8Array(64); c.set(l[i]); c.set(l[i + 1], 32); n.push(dsha(c)); } l = n; }
    return rev(l[0]);
  }
  const zeroBits = h => { let z = 0; for (const c of h) { const v = parseInt(c, 16); if (v === 0) { z += 4; continue; } return z + Math.clz32(v) - 28; } return z; };
  function belowTarget(hashBE, bits) { const e = bits >>> 24, m = bits & 0xffffff; return BigInt('0x' + hashBE) <= BigInt(m) << BigInt(8 * Math.max(0, e - 3)); }
  function heightIn(script) { const n = script[0]; if (!(n >= 1 && n <= 8)) return null; let v = 0; for (let i = 0; i < n; i++) v += script[1 + i] * 2 ** (8 * i); return v; }
  // read a whole block: its header, (Dogecoin) its merge-mining part, and every transaction
  function readBlock(X, chain) {
    if (!(X instanceof Uint8Array) || X.length < 81) throw new Error('not a block');
    const hdr = X.subarray(0, 80), hash = rev(dsha(hdr)), version = (hdr[0] | hdr[1] << 8 | hdr[2] << 16 | hdr[3] << 24) >>> 0;
    const root = rev(hdr.subarray(36, 68)), bits = (hdr[72] | hdr[73] << 8 | hdr[74] << 16 | hdr[75] << 24) >>> 0;
    let p = 80;
    if (chain === 'doge' && version & 0x100) {   // (AuxPoW: the parent block's coinbase, its hash, two merkle branches, the parent header)
      const cb = P.parseTx(X, p); p = cb.end + 32;
      for (let k = 0; k < 2; k++) { const [m, q] = varint(X, p); p = q + m * 32 + 4; }
      p += 80;
    }
    const [n, q] = varint(X, p); p = q; const txs = [];
    for (let i = 0; i < n; i++) { const t = P.parseTx(X, p); t.a = p; txs.push(t); p = t.end; }
    if (p !== X.length) throw new Error('the block has bytes left over');
    return {hash, root, bits, txs, height: txs[0] ? heightIn(txs[0].vin[0].script) : null, X};
  }
  // proper random numbers (so no data site can guess which block or transaction it will be asked about next)
  const rnd = () => { try { const c = globalThis.crypto, u = new Uint32Array(1); c.getRandomValues(u); return u[0] / 4294967296; } catch (e) { return Math.random(); } };
  const pickOne = a => a[Math.floor(rnd() * a.length)];
  // a sample transaction (not the coinbase, if there is another)
  function sampleTx(B) { const t = B.txs.length > 1 ? pickOne(B.txs.slice(1)) : B.txs[0]; return {id: t.txid, hex: P.hex(B.X.subarray(t.a, t.end))}; }

  async function bitcoinTruth(opt) {
    const say = opt.say || (() => {}), MPS = SITES.filter(s => s.kind === 'mempool');
    // the newest block: the second highest of what three copies say (one site alone can't set it)
    const tips = (await Promise.all(MPS.slice(0, 4).map(s => ask(s.base + '/api/blocks/tip/height', opt)))).map(r => r.http === 200 ? Number(txt(r.bytes)) : NaN).filter(Number.isInteger).sort((a, b) => b - a);
    if (!tips.length) throw new Error('no copy of mempool.space said how high the chain is');
    const tip = tips.length >= 2 ? tips[1] : tips[0], h = opt.btcHeight || tip - 6 - Math.floor(rnd() * 138);   // (about the last day, at least 6 blocks deep)
    say('bitcoin block', h);
    let B = null, from = null, why = [];
    for (const s of MPS) {
      const a = await ask(s.base + '/api/block-height/' + h, opt); if (a.http !== 200) { why.push(s.site + ': http ' + (a.http || a.failed)); continue; }
      const hh = lower(txt(a.bytes)); if (!/^[0-9a-f]{64}$/.test(hh)) continue;
      const r = await ask(s.base + '/api/block/' + hh + '/raw', opt, BLOCK_WAIT_MS); if (r.http !== 200) { why.push(s.site + ': http ' + (r.http || r.failed)); continue; }
      try {
        const b = readBlock(r.bytes, 'bitcoin');
        if (b.hash !== hh) throw new Error('its bytes are not block ' + hh);
        if (zeroBits(b.hash) < MIN_ZERO_BITS || !belowTarget(b.hash, b.bits)) throw new Error('its proof of work is not there');
        if (merkle(b.txs.map(t => t.txid)) !== b.root) throw new Error('its transactions do not lead to its header');
        if (b.height !== h) throw new Error('its first transaction says block ' + b.height);
        B = b; from = s.site; break;
      } catch (e) { why.push(s.site + ': ' + e.message); }
    }
    if (!B) throw new Error('no copy gave a block that proves itself (' + why.join('; ') + ')');
    // an inscription made in it: one alone in its transaction, in its first input, with a file that is not packed or borrowed
    const ins = [];
    for (const t of B.txs) { let E; try { E = P.envelopes(t); } catch (e) { continue; } if (E.length === 1 && E[0].input === 0 && E[0].hasBody && !E[0].encoding && !E[0].delegate && E[0].body.length && E[0].contentType) ins.push({id: t.txid + 'i0', sha: fp(E[0].body), length: E[0].body.length, type: E[0].contentType}); }
    // inscription #0, from its own transaction's bytes
    let zero = null; const gen = ZERO.bitcoin.slice(0, 64);
    for (const s of MPS) { const r = await ask(s.base + '/api/tx/' + gen + '/hex', opt); if (r.http !== 200) continue; try { const t = P.parseTx(P.fromHex(txt(r.bytes))); if (t.txid !== gen) continue; const E = P.envelopes(t); if (E[0] && E[0].hasBody) { zero = {id: ZERO.bitcoin, sha: fp(E[0].body), length: E[0].body.length}; break; } } catch (e) {} }
    return {chain: 'bitcoin', h, hash: B.hash, settled: true, proof: {bytesFrom: from, zeroBits: zeroBits(B.hash), transactions: B.txs.length, inscriptionsFound: ins.length}, tx: sampleTx(B), ins: ins.length ? pickOne(ins) : null, zero};
  }

  /* ---------- one check: the truth, then every site ---------- */
  async function check(opt) {
    opt = opt || {};
    const at = new Date().toISOString(), truth = {}, notes = [];
    const chains = ['bitcoin'];
    for (const c of chains) { try { truth[c] = await bitcoinTruth(opt); } catch (e) { truth[c] = null; notes.push(CHAINS[c] + ': no block could be proved from its own bytes this time, so its sites were not asked (' + String(e && e.message || e).replace(/^SyntaxError: /, '') + ')'); } }
    const list = pick(opt.chain).filter(s => chains.includes(s.chain) && (!opt.site || s.site === (site(opt.site) || {}).site));
    let done = 0;
    const results = await Promise.all(list.map(s => askSite(s, truth, opt).then(r => { if (opt.progress) opt.progress(++done, list.length, r); return r; })));
    // inscription numbers: no block's bytes can prove one (it is each site's count of every inscription ever made), so they
    // are never marked right or wrong; the ord sites' numbers for the same inscription are set side by side, to show whether they agree
    let numbers = null;
    if (truth.bitcoin && truth.bitcoin.ins) {
      const said = {}; for (const r of results) if (r.kind === 'ord') { const f = r.facts.find(x => x.fact === 'record'); if (f && f.code === 'R' && Number.isInteger(f.number)) said[r.site] = f.number; }
      const vals = [...new Set(Object.values(said))];
      numbers = {inscription: truth.bitcoin.ins.id, said, sites: Object.keys(said).length, agree: Object.keys(said).length >= 2 ? vals.length === 1 : null};
      if (SITES.filter(s => s.kind === 'ord').length < 2) numbers = null;   // (24 Nov 2026: with one ord site read there is nothing to set side by side)
      if (numbers && numbers.agree === false) notes.push('Bitcoin: the ord sites gave different numbers for the same inscription (' + Object.entries(said).map(([k, v]) => k + ' #' + v).join(', ') + '). Numbers are not marked right or wrong, because no block’s bytes can prove one.');
    }
    const pub = t => t ? {h: t.h, hash: t.hash, settled: t.settled, agreedBy: t.agreedBy, proof: t.proof, tx: t.tx && t.tx.id, inscription: t.ins && t.ins.id, zero: t.zero && t.zero.id} : null;
    return {at, from: opt.from || 'here', truth: {bitcoin: pub(truth.bitcoin), doge: pub(truth.doge)}, numbers, notes, results};
  }

  /* ---------- the record (GitHub's computers): 30 days of checks, one line each ---------- */
  function addToRecord(rec, c) {
    rec = rec && rec.v === 1 ? rec : {v: 1, sites: SITES.map(s => s.site), checks: [], wrong: []};
    const order = SITES.map(s => s.site);
    if (rec.sites.join() !== order.join()) rec.checks = rec.checks.map(k => Object.assign({}, k, {r: order.map(n => { const i = rec.sites.indexOf(n); return i >= 0 ? k.r[i] : null; })}));
    rec.sites = order;
    const by = new Map(c.results.map(r => [r.site, r])), t = Math.round(Date.parse(c.at) / 1000);
    rec.checks.push({t, b: c.truth.bitcoin ? [c.truth.bitcoin.h, c.truth.bitcoin.hash] : null, d: c.truth.doge ? [c.truth.doge.h, c.truth.doge.hash, c.truth.doge.settled ? 1 : 0] : null,
      r: SITES.map(s => { const r = by.get(s.site); return r ? r.facts.map(f => f.code).join('') : null; })});
    for (const r of c.results) for (const f of r.facts) if (f.code === 'W') rec.wrong.push({t, site: r.site, fact: f.fact, asked: f.asked, said: f.said, truth: f.truth});
    const cut = t - KEEP_DAYS * 86400;
    rec.checks = rec.checks.filter(k => k.t > cut); rec.wrong = rec.wrong.filter(w => w.t > cut).slice(-KEEP_WRONG);
    if (c.numbers && c.numbers.sites) { rec.numbers = (rec.numbers || []).concat([{t, id: c.numbers.inscription, said: c.numbers.said, agree: c.numbers.agree}]).filter(n => n.t > t - KEEP_DAYS * 86400).slice(-60); }
    rec.made = c.at; rec.licence = LICENCE; rec.facts = Object.fromEntries(Object.entries(FACTS).map(([k, v]) => [k, v.map(q => q.f)]));
    return rec;
  }
  const blank = () => ({asked: 0, right: 0, wrong: 0, missing: 0, refused: 0, errors: 0, noAnswer: 0});
  // each site's answers over the last days (7 by default): counts, and its share of right answers among those it gave
  function summarise(rec, opt) {
    opt = opt || {};
    if (!rec || rec.v !== 1 || !rec.checks || !rec.checks.length) return {checks: 0, note: 'no record yet'};
    const now = opt.now || Math.max(...rec.checks.map(k => k.t)), days = opt.days || 7, from = now - days * 86400;
    const rows = rec.checks.filter(k => k.t > from);
    const sites = pick(opt.chain).filter(s => !opt.site || s.site === (site(opt.site) || {}).site).map(s => {
      const i = rec.sites.indexOf(s.site), o = Object.assign({site: s.site, chain: s.chain, group: s.group, what: s.what, checkable: factsOf(s).length > 0}, blank()), by = {};
      for (const k of rows) { const codes = k.r[i]; if (!codes) continue; const names = (rec.facts && rec.facts[s.kind]) || factsOf(s).map(q => q.f);
        [...codes].forEach((c, j) => { if (c === '-') return; const b = by[names[j]] = by[names[j]] || blank(); for (const x of [o, b]) { x.asked++; x[{R: 'right', W: 'wrong', M: 'missing', F: 'refused', E: 'errors', N: 'noAnswer'}[c]]++; } }); }
      o.byFact = by; o.answered = o.right + o.wrong; o.rightPct = o.answered ? Math.round(o.right / o.answered * 1000) / 10 : null;
      o.lastWrong = (rec.wrong || []).filter(w => w.site === s.site && w.t > from).slice(-3).map(w => Object.assign({}, w, {at: new Date(w.t * 1000).toISOString()}));
      return o;
    });
    return {from: 'GitHub’s computers', days, checks: rows.length, since: new Date(Math.min(...rows.map(k => k.t)) * 1000).toISOString(), lastCheck: new Date(now * 1000).toISOString(), sites};
  }
  // the league: wrong answers first (fewest is best), then how many it answered, then (from Source Health) up to date and speed
  function rank(sum, health) {
    const h = new Map((health && health.sites || []).map(s => [s.site, s]));
    const key = s => { const w = h.get(s.site), wk = w && w.week || {};
      return [s.checkable && s.answered >= 3 ? 0 : 1, s.answered ? s.wrong / s.answered : 1, s.asked ? -(s.answered / s.asked) : 0,
        wk.checks ? (wk.behind || 0) / wk.checks : 1, wk.checks ? -(wk.answered / wk.checks) : 0, wk.typicalMs != null ? wk.typicalMs : 1e9]; };
    const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return a.site < b.site ? -1 : 1; };
    const out = {};
    for (const c of Object.keys(CHAINS)) out[c] = (sum.sites || []).filter(s => s.chain === c).map(s => Object.assign({}, s, {health: h.get(s.site) ? {week: h.get(s.site).week, last: h.get(s.site).last} : null})).sort(cmp).map((s, i) => Object.assign(s, {place: i + 1, words: words(s)}));
    return out;
  }
  const fmt = n => Number(n).toLocaleString('en-GB');
  const when = iso => { const d = new Date(iso), p = n => String(n).padStart(2, '0'); return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'}) + ', ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ' UTC'; };
  function words(s) {
    if (!s.checkable) return 'Its facts can’t yet be worked out from the chain’s bytes here, so only whether it answers and keeps up is shown.';
    if (!s.asked) return 'Not asked yet.';
    let w = s.answered ? 'Right ' + fmt(s.right) + ' of ' + fmt(s.answered) + ' answer' + (s.answered === 1 ? '' : 's') + (s.wrong ? ', wrong ' + fmt(s.wrong) : '') : 'No answers to score yet';
    const not = [['refused', s.refused], ['did not have it', s.missing], ['errors', s.errors], ['no answer', s.noAnswer]].filter(x => x[1]);
    if (not.length) w += ' (asked ' + fmt(s.asked) + ': ' + not.map(x => x[0] + ' ' + fmt(x[1])).join(', ') + ')';
    return w + '.' + (s.answered && s.answered < 3 ? ' Too few answers yet to place it fairly.' : '');
  }
  // what one wrong answer was, in words
  function wrongWords(w) {
    const what = (F[w.fact] || {}).words || w.fact, said = w.said && w.said.sha256 ? 'a file with fingerprint ' + w.said.sha256.slice(0, 16) + '…' : w.said, truth = w.truth && w.truth.sha256 ? 'fingerprint ' + w.truth.sha256.slice(0, 16) + '…' : w.truth;
    return when(w.at || new Date(w.t * 1000).toISOString()) + ': asked for ' + what + ' (' + w.asked + '), it said ' + said + '; the block’s own bytes say ' + truth + '.';
  }
  // what it means, in words: only what the record shows (sum: summarise(); health: Source Health's summarise() of its week)
  function findings(sum, chain, health) {
    const out = [], name = CHAINS[chain] || 'the', days = sum && sum.days || 7, span = 'the last ' + (days === 1 ? 'day' : days + ' days');
    if (!sum || !sum.checks) return [{trouble: false, says: 'GitHub’s record has no checks yet.'}];
    const mine = (sum.sites || []).filter(s => s.chain === chain), checked = mine.filter(s => s.checkable);
    const right = checked.reduce((a, s) => a + s.right, 0), answered = checked.reduce((a, s) => a + s.answered, 0);
    const wrongs = checked.filter(s => s.wrong);
    for (const s of wrongs) out.push({trouble: true, site: s.site, says: s.site + ' gave ' + fmt(s.wrong) + ' wrong answer' + (s.wrong === 1 ? '' : 's') + ' in ' + span + ' (of ' + fmt(s.answered) + ').' + (s.lastWrong.length ? ' The last: ' + wrongWords(s.lastWrong[s.lastWrong.length - 1]) : '')});
    if (!wrongs.length && answered) out.push({trouble: false, says: 'Every answer ' + name + '’s sites gave in ' + span + ' was right: ' + fmt(right) + ' of ' + fmt(answered) + ', each checked against a block proved from its own bytes (' + fmt(sum.checks) + ' check' + (sum.checks === 1 ? '' : 's') + ').'});
    const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
    for (const s of checked) {
      const of = k => Object.entries(s.byFact || {}).filter(([, b]) => b[k] || (k === 'failed' && (b.noAnswer + b.errors))).map(([f, b]) => (F[f] ? F[f].words : f) + ' (' + fmt(k === 'failed' ? b.noAnswer + b.errors : b[k]) + ' of ' + fmt(b.asked) + ')');
      const m = of('missing'), r = of('refused'), x = of('failed');
      if (m.length) out.push({trouble: true, site: s.site, says: s.site + ' did not have ' + list(m) + ' in ' + span + ' (http 404). That is not counted as wrong: a tool that asks it falls back to another site.'});
      if (r.length) out.push({trouble: true, site: s.site, says: s.site + ' refused GitHub\u2019s computers ' + fmt(s.refused) + ' of ' + fmt(s.asked) + ' times in ' + span + ', asked for ' + list(r) + '. A site can refuse one computer and answer another: press Check now to ask it from yours.'});
      if (x.length) out.push({trouble: true, site: s.site, says: s.site + ' gave no answer or an error ' + fmt(s.noAnswer + s.errors) + ' of ' + fmt(s.asked) + ' times in ' + span + ', asked for ' + list(x) + '.'});
    }
    const h = new Map((health && health.sites || []).map(x => [x.site, x]));
    for (const s of mine) { const w = h.get(s.site), wk = w && w.week; if (wk && wk.behind) out.push({trouble: true, site: s.site, says: 'From Source Health’s hourly record, ' + s.site + ' was behind in ' + fmt(wk.behind) + ' of ' + fmt(wk.checks) + ' checks this week' + (wk.mostBehind > 0 ? ', at most ' + fmt(wk.mostBehind) + ' blocks' : '') + ': its answers about the newest blocks were out of date then.'}); }
    const unchecked = mine.filter(s => !s.checkable).map(s => s.site);
    if (unchecked.length) out.push({trouble: false, says: unchecked.join(', ').replace(/, ([^,]*)$/, ' and $1') + ' give facts the portal can’t yet work out from the chain’s bytes, so the League shows only whether they answer and keep up (from Source Health).'});
    return out;
  }
  // the record itself, read from the portal's repository
  async function record(opt) {
    let err = null;
    for (const u of RECORD_URLS) {
      const r = await ask(u + (u.includes('raw.githubusercontent') ? '?t=' + Math.floor(Date.now() / 60000) : ''), opt, 20000);
      if (r.http === 200) { try { const rec = js(r.bytes); rec.readFrom = u; return rec; } catch (e) { err = new Error('the record could not be read'); } }
      else err = new Error(r.failed || 'http ' + r.http + ' for the record');
    }
    throw err || new Error('no record');
  }
  // for the tools: a list of sites with any wrong answer in the last 7 days, or behind or not answering at the last hourly check, put last
  function order(list, sum, health) {
    const bad = new Set(), host = u => String(u).replace(/^\w+:\/\//, '').replace(/[:/].*$/, '');
    for (const s of (sum && sum.sites || [])) if (s.wrong) bad.add(s.site);
    for (const s of (health && health.sites || [])) if (s.last && (s.last.state !== 'answers' && s.last.state !== 'slow' || s.last.behind >= 2 || s.last.behind < 0)) bad.add(s.site);
    return list.filter(u => !bad.has(host(u))).concat(list.filter(u => bad.has(host(u))));
  }

  return {VERSION, SITES: SITES.map(s => Object.assign({}, s, {facts: factsOf(s).map(q => q.f)})), CHAINS, CODES, FACT_WORDS: Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v.words])),
    MIN_ZERO_BITS, DOGE_AGREE, KEEP_DAYS, RECORD_URLS, LICENCE, check, readBlock, merkle, addToRecord, summarise, rank, findings, words, wrongWords, record, order, site, when};
});
