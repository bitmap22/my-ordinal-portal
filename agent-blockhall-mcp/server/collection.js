/* Collection Check, by bitmap22. Always free. Part of Agent Blockhall: https://bitmap22.github.io/my-ordinal-portal/block-cube.html
   Proves which pieces of a Bitcoin collection are the real children of its parent inscription, from the chain itself.
   Under ord's rules a child is made by a transaction that names the parent inside the child (its "parent" field) and spends
   the parent in the same transaction. So, for each child that ord lists:
   - listed twice: it is in the parent's children list on ordinals.com (or a back-up) and on a second ord site;
   - names the parent: its own transaction (read from a mempool site, not from ord) names the parent in its parent field;
   - parent spent: the transaction that made it is one of the parent's own moves. The parent's trail is followed back from
     where it sits now, move by move (a transaction hands its sats on in order, first in first out), to where it was made;
     each move's transaction is worked out to its own ID from its own data, and each move spends the output of the one before.
   A child is proven when it names the parent and the parent was spent to make it. Pieces found naming the parent on the
   parent's own trail but missing from ord's list are reported too. Inscriptions without a parent (a list of pieces) are
   checked for whether they name one at all: a piece that names no parent can't be proven to belong by a parent.
   The same file is for the portal's Collection Check page and the free Agent Blockhall MCP tool. It uses the Provenance
   Check's reader (provenance.js) for the transaction maths. Fetching is left to whoever uses it (the io object). No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('./provenance.js'));
  else root.CollectionCheck = make(root.ProvenanceCheck);
})(typeof self !== 'undefined' ? self : this, function (PV) {
  'use strict';
  const VERSION = '1.0.0';
  if (!PV) throw new Error('the Collection Check needs the Provenance Check\'s reader (provenance.js) loaded first');
  const isInsId = t => /^[0-9a-f]{64}i\d+$/.test(t);
  const iso = s => s ? new Date(s * 1000).toISOString().replace('.000', '') : null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fmt = n => Number(n).toLocaleString('en-GB');

  /* ---------- a transaction from a mempool site's JSON, worked out to its own ID ----------
     The ID is the double SHA-256 of the transaction without its witness: version, inputs, outputs, lock time. If the site's
     JSON gives back the same ID, its inputs and outputs (and their amounts) are that transaction's. */
  function jsonTxid(J) {
    const parts = []; let n = 0;
    const put = u => { parts.push(u); n += u.length; };
    const u32 = x => Uint8Array.of(x & 255, x >>> 8 & 255, x >>> 16 & 255, x >>> 24 & 255);
    const u64 = x => { const b = new Uint8Array(8); for (let i = 0; i < 8; i++) { b[i] = x % 256; x = Math.floor(x / 256); } return b; };
    const vi = x => x < 0xfd ? Uint8Array.of(x) : x <= 0xffff ? Uint8Array.of(0xfd, x & 255, x >> 8) : Uint8Array.of(0xfe, ...u32(x));
    put(u32(J.version >>> 0)); put(vi(J.vin.length));
    for (const v of J.vin) { put(PV.fromHex(v.txid).reverse()); put(u32(v.vout >>> 0)); const s = PV.fromHex(v.scriptsig || ''); put(vi(s.length)); put(s); put(u32(v.sequence >>> 0)); }
    put(vi(J.vout.length));
    for (const o of J.vout) { put(u64(o.value)); const s = PV.fromHex(o.scriptpubkey || ''); put(vi(s.length)); put(s); }
    put(u32(J.locktime >>> 0));
    const b = new Uint8Array(n); let o = 0; for (const p of parts) { b.set(p, o); o += p.length; }
    return PV.hex(PV.sha256(PV.sha256(b)).reverse());
  }
  // the inscriptions a transaction makes, read from its witness (the part its ID does not cover), with the parents each names
  function made(J) {
    try { return PV.envelopes({vin: J.vin.map(v => ({witness: (v.witness || []).map(w => PV.fromHex(w))}))}).map(e => ({index: e.index, parents: e.parents})); }
    catch (e) { return []; }
  }
  const trim = J => {   // (what is kept of each transaction: enough for the trail and the report, not its witness)
    const st = J.status || {};
    return {txid: J.txid, block: st.confirmed ? st.block_height : null, time: iso(st.block_time), coinbase: J.vin.some(v => v.is_coinbase),
      vin: J.vin.map(v => ({txid: v.txid, vout: v.vout, prevout: v.prevout ? {value: v.prevout.value, scriptpubkey: v.prevout.scriptpubkey} : null})),
      vout: J.vout.map(o => ({value: o.value, scriptpubkey: o.scriptpubkey, scriptpubkey_address: o.scriptpubkey_address || ''})),
      hashOk: (() => { try { return jsonTxid(J) === J.txid; } catch (e) { return false; } })(), made: made(J)};
  };

  /* ---------- a run: one parent's collection, checked bit by bit ----------
     io: {ordJson(path), ord2Json(path) (a second ord site, never the first one's), ordText(path), mpJson(path) (a mempool site)};
     each ...Json returns {j, site}, ordText {t, site}. */
  async function start(q, io, progress) {
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const pid = await PV.resolve(q, io); say('found', pid);
    const info = await io.ordJson('/r/inscription/' + pid); const P = info.j; say('parent', true);
    const run = {pid, gen: pid.slice(0, 64), parent: P, parentSite: info.site, started: new Date().toISOString().replace(/\.\d{3}/, ''),
      list: [], listSite: null, listDone: false, second: null, secondSite: null, secondDone: false,
      txs: new Map(), trail: {moves: [], at: null, reached: false, lost: false, error: null, linkBad: 0}, extraFound: []};
    // the children, as ord lists them (with their numbers and blocks), a hundred a page
    const t0 = Date.now(), had = new Set();   // (a site that keeps saying "more" with nothing new, or a list that takes over 3 minutes, is stopped)
    for (let p = 0; ; p++) {
      const x = await io.ordJson('/r/children/' + pid + '/inscriptions' + (p ? '/' + p : ''));
      run.listSite = run.listSite || x.site;
      let fresh = 0;
      for (const c of (x.j && x.j.children) || []) if (isInsId(c.id || '') && !had.has(c.id)) { had.add(c.id); fresh++; run.list.push({id: c.id, number: c.number, block: c.height, time: iso(c.timestamp)}); }
      say('list', run.list.length);
      if (!x.j || !x.j.more) break;
      if (!fresh) throw new Error(run.listSite + ' kept saying there were more children, with no new ones: the list could not be trusted');
      if (p > 2000) throw new Error('more than 200,000 children: too many to check here');
      if (Date.now() - t0 > 180000) throw new Error('listing the children took over 3 minutes: try again later');
    }
    run.listDone = true;
    // the same list, on a second ord site
    try {
      const S = new Set(), t1 = Date.now();
      for (let p = 0; ; p++) {
        const x = await io.ord2Json('/r/children/' + pid + (p ? '/' + p : ''));
        run.secondSite = run.secondSite || x.site;
        const before = S.size; for (const id of (x.j && x.j.ids) || []) S.add(id);
        say('second', S.size);
        if (!x.j || !x.j.more || p > 2000 || S.size === before || Date.now() - t1 > 180000) break;
      }
      run.second = S; run.secondDone = true;
    } catch (e) { run.secondError = String(e && e.message || e); say('second', false); }
    // where the parent sits now: the trail starts there
    const sp = String(P.satpoint || '').split(':');
    if (/^[0-9a-f]{64}$/.test(sp[0] || '') && +sp[1] >= 0 && +sp[2] >= 0) run.trail.at = {txid: sp[0], vout: +sp[1], offset: +sp[2]};
    else run.trail.error = 'where the parent sits now could not be read';
    return run;
  }

  // fetch one transaction (kept, so the children's and the trail's asks are shared)
  async function tx(run, io, txid) {
    let t = run.txs.get(txid);
    if (t && t.then) return t;
    if (t) return t;
    const p = io.mpJson('/api/tx/' + txid).then(x => { const k = trim(x.j); k.hashOk = k.hashOk && k.txid === txid; k.site = x.site; run.txs.set(txid, k); return k; }, e => { run.txs.delete(txid); throw e; });
    run.txs.set(txid, p);
    return p;
  }

  /* ---------- the parent's trail, from where it sits now back to where it was made ----------
     Asks for the children's own transactions ahead of time (most of the parent's moves are those), so the walk mostly finds
     each move ready. opts: {deadline (ms since 1970: stop walking then), stop() (true: stop now), ahead (how many to ask ahead)} */
  async function walk(run, io, opts, progress) {
    opts = opts || {};
    const T = run.trail, say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    if (T.reached || T.lost || T.error || !T.at || run.walking) return run;
    run.walking = true;
    const stopNow = () => (opts.stop && opts.stop()) || (opts.deadline && Date.now() > opts.deadline);
    // ask ahead: the children's own transactions, newest first (the trail goes back from now)
    const ahead = run.list.map(c => c.id.slice(0, 64)).filter((t, i, a) => a.indexOf(t) === i).reverse();
    let ai = 0, live = 0; const AHEAD = opts.ahead || 12;
    const pump = () => { while (live < AHEAD && ai < ahead.length && !stopNow()) { const t = ahead[ai++]; if (run.txs.has(t)) continue; live++; tx(run, io, t).catch(() => {}).then(() => { live--; pump(); }); } };
    pump();
    let expect = null;   // (the value and script the next transaction's output must have, from the input that spent it)
    if (T.moves.length && T.pendingLink) expect = T.pendingLink;
    try {
      while (!stopNow()) {
        const {txid, vout, offset} = T.at;
        let J; try { J = await tx(run, io, txid); } catch (e) { if (/404/.test(String(e))) throw new Error('a site has no transaction ' + txid.slice(0, 12) + '…'); await sleep(800); J = await tx(run, io, txid); }
        const o = J.vout[vout];
        const link = expect ? !!o && o.value === expect.value && o.scriptpubkey === expect.scriptpubkey : null;
        if (link === false) T.linkBad++;
        T.moves.push({txid, block: J.block, time: J.time, to: o ? o.scriptpubkey_address : '', hashOk: J.hashOk, linkOk: link, made: txid === run.gen || undefined});
        // pieces made by this move that name the parent
        for (const e of J.made) if (e.parents.includes(run.pid)) { const id = txid + 'i' + e.index; if (!(run.listSet || (run.listSet = new Set(run.list.map(c => c.id)))).has(id)) run.extraFound.push({id, block: J.block, time: J.time}); }
        say('trail', T.moves.length);
        if (txid === run.gen) { T.reached = true; break; }
        if (J.coinbase) { T.lost = true; T.moves[T.moves.length - 1].toMiner = true; break; }
        const b = PV.stepBack(J, vout, offset);
        if (!b) throw new Error('the trail could not be followed past ' + txid.slice(0, 12) + '…');
        const pv = J.vin[b.input].prevout; expect = pv ? {value: pv.value, scriptpubkey: pv.scriptpubkey} : null; T.pendingLink = expect;
        T.at = {txid: b.txid, vout: b.vout, offset: b.offset};
        pump();
      }
    } catch (e) { T.error = String(e && e.message || e); }
    run.walking = false;
    run.extraFound = run.extraFound.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
    return run;
  }

  // when the whole trail has been followed and a listed child's transaction was not on it: read that child's own
  // transaction anyway, so the report can say whether it even names the parent (at most `cap` of them)
  async function stragglers(run, io, cap) {
    if (!run.trail.reached) return run;
    const onTrail = new Set(run.trail.moves.map(m => m.txid)), left = run.list.filter(c => !onTrail.has(c.id.slice(0, 64))).slice(0, cap || 50);
    for (const c of left) { try { await tx(run, io, c.id.slice(0, 64)); } catch (e) {} }
    return run;
  }

  /* ---------- the report ---------- */
  function judge(run, c, trailSet) {
    const T = run.trail, gen = c.id.slice(0, 64), idx = +c.id.split('i').pop();
    const J = run.txs.get(gen), have = J && !J.then;
    const onTrail = trailSet ? trailSet.has(gen) : T.moves.some(m => m.txid === gen);
    const listedTwice = run.secondDone ? run.second.has(c.id) : null;
    const env = have ? J.made.find(e => e.index === idx) : null;
    const namesParent = have ? !!(env && env.parents.includes(run.pid)) : null;
    const parentSpent = onTrail ? true : T.reached ? false : null;
    const proven = namesParent === true && parentSpent === true ? true : namesParent === false || parentSpent === false ? false : null;
    const why = proven === true ? 'it names the parent, and the transaction that made it spent the parent'
      : proven === false ? [namesParent === false ? (have && !env ? 'its transaction has no inscription ' + idx : 'its own transaction does not name the parent') : null,
        parentSpent === false ? 'the transaction that made it is not one of the parent\'s moves (the whole trail was followed)' : null].filter(Boolean).join('; ')
      : T.lost ? 'not reached: the parent went to a miner in a fee, and its trail can\'t be followed past that block'
      : T.error ? 'not reached: the trail stopped (' + T.error + ')' : 'not reached yet: the parent\'s trail has not been followed back that far';
    return {id: c.id, number: c.number, block: c.block, time: c.time, proven, checks: {listedTwice, namesParent, parentSpent}, why};
  }
  const PAGE_MAX = 500;
  function report(run, opts) {
    opts = opts || {};
    const P = run.parent, T = run.trail;
    const TS = new Set(T.moves.map(m => m.txid)), all = run.list.map(c => judge(run, c, TS)).sort((a, b) => b.number - a.number);
    const nP = all.filter(c => c.proven === true).length, nN = all.filter(c => c.proven === false).length, nR = all.length - nP - nN;
    const missing2 = run.secondDone ? run.list.filter(c => !run.second.has(c.id)).map(c => c.id) : null;
    const L1 = new Set(run.list.map(c => c.id)), extra2 = run.secondDone ? [...run.second].filter(id => !L1.has(id)) : null;
    const want = opts.filter === 'proven' ? all.filter(c => c.proven === true) : opts.filter === 'notProven' ? all.filter(c => c.proven === false)
      : opts.filter === 'notReached' ? all.filter(c => c.proven === null) : all;
    const from = Math.max(0, +opts.from || 0), limit = Math.max(1, Math.min(PAGE_MAX, +opts.limit || 100));
    const moved = T.moves.length ? T.moves.length - (T.reached ? 1 : 0) : 0;
    const verdict = !all.length ? 'ord lists no children for this parent'
      : nN ? fmt(nN) + ' of ' + fmt(all.length) + ' listed children are not proven' + (nR ? ' (' + fmt(nR) + ' not reached yet)' : '')
      : nR ? fmt(nP) + ' of ' + fmt(all.length) + ' children proven so far; ' + fmt(nR) + ' not reached yet'
      : (all.length === 1 ? 'its 1 child is proven' : 'all ' + fmt(all.length) + ' children proven');
    return {
      check: 'Agent Blockhall Collection Check ' + VERSION,
      verdict: verdict + (run.extraFound.length ? '; ' + fmt(run.extraFound.length) + ' found naming the parent on its trail but not listed' : ''),
      parent: {id: run.pid, number: P.number, block: P.height, time: iso(P.timestamp), contentType: P.content_type || null, holder: P.address || null, satpoint: P.satpoint || null},
      counts: {listed: all.length, proven: nP, notProven: nN, notReached: nR, secondList: run.secondDone ? run.second.size : null, foundNotListed: run.extraFound.length,
        checks: Object.fromEntries(['listedTwice', 'namesParent', 'parentSpent'].map(k => [k, all.filter(c => c.checks[k] === true).length]))},
      lists: {first: {site: run.listSite, children: all.length, complete: run.listDone},
        second: run.secondDone ? {site: run.secondSite, children: run.second.size, missingThere: missing2.slice(0, 50), onlyThere: extra2.slice(0, 50)} : {site: null, error: run.secondError || 'not asked'}},
      trail: {moves: moved, followed: T.moves.length, reached: T.reached, lostToMiner: T.lost, stopped: T.error || null,
        allWorkedOut: T.moves.every(m => m.hashOk), linksHeld: T.moves.filter(m => m.linkOk === false).length === 0,
        newest: T.moves.length ? {block: T.moves[0].block, time: T.moves[0].time} : null, oldestSoFar: T.moves.length ? {block: T.moves[T.moves.length - 1].block, time: T.moves[T.moves.length - 1].time} : null},
      foundNotListed: run.extraFound.slice(0, 100),
      page: {filter: opts.filter || 'all', from, limit, total: want.length, more: from + limit < want.length},
      children: want.slice(from, from + limit),
      howProven: {listedTwice: 'in the parent\'s children list on ' + (run.listSite || 'ordinals.com') + ' and on ' + (run.secondSite || 'a second ord site'),
        namesParent: 'its own transaction (read from a mempool site, not from ord) names the parent in its parent field',
        parentSpent: 'the transaction that made it is one of the parent\'s own moves: the parent was spent to make it (ord\'s rule for a child)',
        proven: 'names the parent and the parent was spent to make it'},
      sources: {parent: run.parentSite, children: run.listSite, secondList: run.secondSite, transactions: [...new Set([...run.txs.values()].filter(t => !t.then).map(t => t.site))].slice(0, 8)},
      checkedAt: new Date().toISOString().replace(/\.\d{3}/, '')
    };
  }

  /* ---------- a list of pieces (for a collection without a parent): does each name a parent at all? ---------- */
  async function checkList(ids, io, progress, opts) {
    opts = opts || {};
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const L = [...new Set((ids || []).map(s => String(s).trim().toLowerCase()).filter(isInsId))].slice(0, opts.max || 2000);
    if (!L.length) throw new Error('give inscription IDs (64 hex characters, i, a number), one per line or comma-separated');
    const out = new Array(L.length); let next = 0, done = 0;
    const one = async i => {
      const id = L[i], gen = id.slice(0, 64), idx = +id.split('i').pop();
      const r = {id, namesParents: null, ordParents: null, hashOk: null, result: 'not checked'};
      try { const x = await io.mpJson('/api/tx/' + gen); const k = trim(x.j); r.hashOk = k.hashOk; const e = k.made.find(m => m.index === idx); r.namesParents = e ? e.parents : []; if (!e) r.noSuchInscription = true; } catch (e) { r.error = String(e && e.message || e); }
      if (r.namesParents && r.namesParents.length) { try { const x = await io.ordJson('/r/parents/' + id); r.ordParents = (x.j && x.j.ids) || []; } catch (e) {} }
      else if (r.namesParents) r.ordNotNeeded = true;   // (ord counts a piece as a child only when it names its parent: nothing to ask)
      if (r.namesParents) r.result = r.noSuchInscription ? 'no such inscription in its transaction' : r.namesParents.length ? 'names a parent: check that parent\'s collection' : 'names no parent: it can\'t be proven to belong by a parent';
      if (r.namesParents && r.ordParents && r.namesParents.length && !r.ordParents.length) r.result = 'names a parent, but ord does not count it as its child (the parent was not spent to make it)';
      out[i] = r; done++; say('list', done);
    };
    const W = Math.min(opts.workers || 12, L.length); await Promise.all(Array.from({length: W}, async () => { while (next < L.length && !(opts.stop && opts.stop())) await one(next++); }));
    const R = out.filter(Boolean), parents = {};
    for (const r of R) for (const p of r.namesParents || []) parents[p] = (parents[p] || 0) + 1;
    const nNo = R.filter(r => r.namesParents && !r.namesParents.length && !r.noSuchInscription).length, nYes = R.filter(r => r.namesParents && r.namesParents.length).length;
    const nNot = R.filter(r => r.noSuchInscription).length, nLeft = R.length - nYes - nNo - nNot;
    return {check: 'Agent Blockhall Collection Check ' + VERSION + ' (a list of pieces)',
      verdict: (!R.length ? 'nothing was checked' : nNo === R.length ? (R.length === 1 ? 'it names no parent: it can\'t be proven to belong to a collection by a parent' : 'none of the ' + fmt(R.length) + ' pieces names a parent: they can\'t be proven to belong to one collection by a parent')
        : fmt(nYes) + ' of ' + fmt(R.length) + (nYes === 1 ? ' names' : ' name') + ' a parent; ' + fmt(nNo) + (nNo === 1 ? ' names' : ' name') + ' none' + (nNot ? '; ' + fmt(nNot) + ' not an inscription' : '') + (nLeft ? '; ' + fmt(nLeft) + ' not checked (a site did not answer)' : ''))
        + ((ids || []).length > L.length ? ' (' + fmt((ids || []).length - L.length) + ' left out: not inscription IDs, or given twice)' : ''),
      counts: {pieces: R.length, namesNoParent: nNo, namesAParent: nYes, notAnInscription: nNot, notChecked: nLeft, given: (ids || []).length, usable: L.length, notStarted: L.length - R.length},
      parentsNamed: Object.entries(parents).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, n]) => ({id, pieces: n})),
      pieces: R, checkedAt: new Date().toISOString().replace(/\.\d{3}/, '')};
  }

  /* ---------- everything in one go (for a host that just wants the answer) ---------- */
  async function gather(q, io, progress, opts) {
    opts = opts || {};
    const run = await start(q, io, progress);
    await walk(run, io, opts, progress);
    await stragglers(run, io, 50);
    return {run, report: report(run, opts)};
  }

  const toCSV = r => {
    const q = v => { let t = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const yn = v => v === true ? 'yes' : v === false ? 'no' : 'not checked';
    return ['number,id,block,made,proven,listed_twice,names_parent,parent_spent,why'].concat((r.children || []).map(c => [c.number, c.id, c.block, c.time, yn(c.proven), yn(c.checks.listedTwice), yn(c.checks.namesParent), yn(c.checks.parentSpent), c.why].map(q).join(','))).join('\n') + '\n';
  };

  return {VERSION, jsonTxid, made, start, walk, stragglers, judge, report, checkList, gather, toCSV};
});
