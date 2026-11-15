/* Doge Collection Check, by bitmap22. Always free. The Dogecoin twin of Agent Blockhall's Collection Check (collection.js), for Doge Cube:
   https://bitmap22.github.io/my-ordinal-portal/doge-cube.html
   A Bitcoin collection can be proven by its parent: ord makes a child only when its transaction names the parent and spends it.
   Doginals have no parents: the Doginals way of writing a file has no field to name one. So a Dogecoin collection's pieces are
   the ones an explorer lists for it, and that can't be proven on the chain: each piece is "listed, not proven by a parent". The
   list here is thedoginalsexplorer.com's, the only collection list a web page can read (Doggy Market's lists refuse web pages).
   What can be proven is that each listed piece is real, from separate sites:
   - a Doginal: the explorer knows it (its number, the block it was made in, its file type);
   - in its block: the transaction that started it is in that block's list of transactions on a second, separate site (Bitcore);
   - the same file: the explorer's copy of its file and Doggy Market's copy have the same fingerprint (SHA-256);
   - held there: the output holding it now is unspent, at the address the explorer says, on the second site (Bitcore).
   A piece listed twice, or with the same file as another piece, is flagged. Doge Provenance Check proves any one piece fully,
   from the chain's own bytes.
   The same file is for the portal's Doge Collection Check page and the free Agent Blockhall MCP tool. It uses Doge Provenance
   Check's reader (doge-provenance.js) for the fingerprints and for numbers. Fetching is left to whoever uses it (io: dx(path),
   btc(path), file(id), file2(id)). No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('./doge-provenance.js'));
  else root.DogeCollection = make(root.DogeProvenance);
})(typeof self !== 'undefined' ? self : this, function (DP) {
  'use strict';
  const VERSION = '1.0.0';
  if (!DP) throw new Error('the Doge Collection Check needs Doge Provenance Check\'s reader (doge-provenance.js) loaded first');
  const isInsId = t => /^[0-9a-f]{64}i\d+$/.test(t);
  const fmt = n => n == null ? '–' : Number(n).toLocaleString('en-GB');
  const iso = s => s ? new Date(s * 1000).toISOString().replace('.000', '') : null;
  const NOTE = 'Doginals have no parents (the Doginals way of writing a file has no field to name one), so which pieces belong to a collection can\'t be proven on the chain: these are the pieces thedoginalsexplorer.com lists for it. Each one is checked to be real.';
  const HOW = {
    listed: 'listed for the collection by thedoginalsexplorer.com: not proven by a parent, because Doginals have none',
    real: 'a Doginal: the explorer knows it (its number, the block it was made in, its file type)',
    inBlock: 'the transaction that started it is in a block on a second, separate site (Bitcore): in the block the explorer says, or, for a file written over several transactions, a block before the one the explorer says it was finished in',
    sameFile: 'the explorer\'s copy of its file and Doggy Market\'s copy have the same fingerprint (SHA-256)',
    heldThere: 'the output holding it now is unspent, at the address the explorer says, on the second site (Bitcore)',
    ok: 'real, in its block, the same file on two sites, and held where the explorer says'};

  /* ---------- the collection: by its short name (slug) or its name ---------- */
  const slugOf = t => String(t || '').trim().toLowerCase().replace(/^https?:\/\/[^/]+\/(?:v1\/)?collections?\//, '').replace(/[?#].*$/, '').replace(/\/.*$/, '');
  async function find(q, io) {
    const s = slugOf(q);
    if (!s) throw new Error('give a collection: its name (Doginal Frogs) or its short name (doginal-frogs)');
    if (/^[a-z0-9-]+$/.test(s)) { try { const j = await io.dx('/v1/collections/' + encodeURIComponent(s)); if (j && j.collection) return j.collection; } catch (e) { if (!/404/.test(String(e))) throw e; } }
    const want = String(q).trim().toLowerCase(), all = [];
    let cursor = '0';
    for (let k = 0; k < 20; k++) {
      const j = await io.dx('/v1/collections?limit=100&cursor=' + encodeURIComponent(cursor));
      all.push(...(j.collections || []));
      const hit = all.find(c => String(c.name || '').toLowerCase() === want || c.slug === s);
      if (hit) { const d = await io.dx('/v1/collections/' + encodeURIComponent(hit.slug)); return d.collection || hit; }
      if (!j.nextCursor || !(j.collections || []).length) break; cursor = j.nextCursor;
    }
    const close = all.filter(c => String(c.name || '').toLowerCase().includes(want) || String(c.slug || '').includes(s)).slice(0, 5).map(c => c.name + ' (' + c.slug + ')');
    throw new Error('the explorer lists no collection called "' + String(q).trim() + '"' + (close.length ? '. Close ones: ' + close.join(', ') : '') + '. Its ' + fmt(all.length) + ' collections: ' + 'https://thedoginalsexplorer.com/v1/collections');
  }
  async function start(q, io) {
    const C = await find(q, io);
    return {C, slug: C.slug, items: [], seen: new Map(), cursor: '0', itemsDone: false, total: null, results: new Map(), lists: new Map(), coins: new Map(), prints: new Map(), site: 'https://thedoginalsexplorer.com'};
  }
  // the collection's pieces, as the explorer lists them (100 at a time), up to n of them
  async function loadItems(run, io, n) {
    while (!run.itemsDone && run.items.length < n) {
      const j = await io.dx('/v1/collections/' + encodeURIComponent(run.slug) + '/items?limit=100&cursor=' + encodeURIComponent(run.cursor));
      run.total = j.total != null ? j.total : run.total;
      for (const it of j.items || []) {
        const id = String(it.inscriptionId || '').toLowerCase();
        const x = {id, name: it.name || null, n: it.number != null ? it.number : null};
        if (run.seen.has(id)) { run.seen.get(id).twice = (run.seen.get(id).twice || 1) + 1; x.listedTwice = true; }
        else run.seen.set(id, x);
        run.items.push(x);
      }
      if (!j.nextCursor || !(j.items || []).length) run.itemsDone = true; else run.cursor = j.nextCursor;
    }
    return run.items.length;
  }

  /* ---------- one piece ---------- */
  // a block's transactions on the second site (Bitcore), asked once per block
  function blockList(run, io, h) {
    if (!run.lists.has(h)) run.lists.set(h, io.btc('/tx?blockHeight=' + h + '&limit=10000').then(L => new Set((L || []).map(t => t.txid))).catch(() => null));
    return run.lists.get(h);
  }
  function coinsOf(run, io, txid) {
    if (!run.coins.has(txid)) run.coins.set(txid, io.btc('/tx/' + txid + '/coins').catch(() => null));
    return run.coins.get(txid);
  }
  const fp = u => u && u.length != null ? DP.hex(DP.sha256(u)) : null;
  async function piece(run, io, item) {
    const id = item.id, r = {id, n: item.n, name: item.name, number: null, block: null, time: null, type: null, bytes: null, fingerprint: null, holder: null,
      checks: {real: null, inBlock: null, sameFile: null, heldThere: null}, listedTwice: !!item.listedTwice};
    if (!isInsId(id)) { r.checks.real = false; r.why = 'the explorer lists "' + id + '", which is not a Doginal ID'; r.ok = false; return r; }
    let J = null;
    try { J = await io.dx('/v1/inscription/' + id); } catch (e) { if (/404/.test(String(e))) { r.checks.real = false; r.why = 'the explorer lists it for the collection, but knows no such Doginal'; r.ok = false; return r; } r.error = String(e && e.message || e); }
    if (J) { r.checks.real = true; r.number = J.number != null ? J.number : null; r.block = J.genesis_height != null ? J.genesis_height : null; r.time = iso(J.genesis_time); r.type = J.contentType || null; r.holder = J.address || null; r.satpoint = J.satpoint || null; }
    const gen = id.slice(0, 64);
    const [F, L, K] = await Promise.all([
      Promise.allSettled([io.file(id), io.file2(id)]),
      r.block != null ? blockList(run, io, r.block) : null,
      r.satpoint ? coinsOf(run, io, r.satpoint.split(':')[0]) : null]);
    const a = F[0].status === 'fulfilled' ? F[0].value : null, b = F[1].status === 'fulfilled' ? F[1].value : null;
    const fa = a && a.length ? fp(a) : null, fb = b && b.length ? fp(b) : null;
    r.fingerprint = fa || fb; r.bytes = a && a.length ? a.length : b && b.length ? b.length : null;
    r.checks.sameFile = fa && fb ? fa === fb : null;
    if (fa && fb && fa !== fb) r.fileCopies = {explorer: {bytes: a.length, fingerprint: fa}, doggyMarket: {bytes: b.length, fingerprint: fb}};
    if (!(fa && fb)) {
      const said = (x, st, who) => x && !x.length ? who + ' gives no file for it (0 bytes)' : st.status === 'rejected' ? (/too big/.test(String(st.reason)) ? who + '\'s copy is too big to fetch here' : who + ' did not give its file') : null;
      r.fileNote = [said(a, F[0], 'the explorer'), said(b, F[1], 'Doggy Market')].filter(Boolean).join('; ') || null;
    }
    if (L && L.has(gen)) r.checks.inBlock = true;
    else if (r.block != null) {
      // a file written over several transactions: the explorer gives the block it was finished in; ask the second site where it started
      try { const t = await io.btc('/tx/' + gen); if (t && t.blockHeight > 0) { r.startedBlock = t.blockHeight; r.checks.inBlock = t.blockHeight <= r.block; } else if (t) r.checks.inBlock = false; }
      catch (e) { if (/404/.test(String(e))) r.checks.inBlock = false; }
    }
    if (K && r.satpoint) {
      const vout = +r.satpoint.split(':')[1], o = (K.outputs || []).find(x => x.mintIndex === vout);
      r.checks.heldThere = !!o && !o.spentTxid && (!r.holder || o.address === r.holder);
      if (o && o.spentTxid) r.movedOn = o.spentTxid;
      if (o && r.holder && o.address !== r.holder) r.secondSiteHolder = o.address || null;
    }
    const c = r.checks, bad = [];
    if (c.real === false) bad.push('the explorer knows no such Doginal');
    if (c.inBlock === false) bad.push(r.startedBlock ? 'the second site has the transaction that started it in block ' + fmt(r.startedBlock) + ', after block ' + fmt(r.block) + ' that the explorer gives' : 'the second site has no such transaction in a block');
    if (c.sameFile === false) bad.push('the explorer\'s copy of its file and Doggy Market\'s copy are different files');
    if (c.heldThere === false) bad.push(r.movedOn ? 'the second site says the output the explorer has it in was spent since (it may just have moved: the explorer may be behind)' : 'the second site has it held at a different address');
    const open = Object.entries(c).filter(([k, v]) => v === null).map(([k]) => k === 'sameFile' && r.fileNote ? 'its file on two sites (' + r.fileNote + ')' : ({real: 'whether it is a Doginal', inBlock: 'its block', sameFile: 'its file on two sites', heldThere: 'where it is held'})[k] + ' (a site did not answer)');
    r.ok = bad.length ? false : open.length ? null : true;
    r.why = r.ok === true ? 'real: in its block, the same file on two sites, and held where the explorer says' + (r.startedBlock && r.startedBlock !== r.block ? ' (written from block ' + fmt(r.startedBlock) + ' to ' + fmt(r.block) + ')' : '')
      : bad.length ? bad.join('; ') + (open.length ? '; not checked: ' + open.join(', ') : '') : 'not fully checked: ' + open.join(', ');
    if (r.listedTwice) r.why += '; listed more than once';
    return r;
  }

  /* ---------- checking a run of pieces: from (the first one, counting from 0), up to limit of them ---------- */
  async function walk(run, io, opts, progress) {
    opts = opts || {};
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const from = Math.max(0, +opts.from || 0), limit = Math.max(1, +opts.limit || 25), stop = opts.stop || (() => false);
    await loadItems(run, io, from + limit);
    const want = run.items.slice(from, from + limit).filter(x => !run.results.has(x.id) || x.listedTwice);
    let next = 0, done = 0;
    const W = Math.min(opts.workers || 3, want.length);
    await Promise.all(Array.from({length: W}, async () => {
      while (next < want.length && !stop()) {
        const x = want[next++];
        const r = await piece(run, io, x);
        if (!run.results.has(x.id)) run.results.set(x.id, r);
        if (r.fingerprint) { const p = run.prints.get(r.fingerprint) || []; if (!p.includes(x.id)) p.push(x.id); run.prints.set(r.fingerprint, p); }
        done++; say('piece', [done, want.length]);
      }
    }));
    return done;
  }

  function report(run, opts) {
    opts = opts || {};
    const C = run.C, checked = run.items.filter(x => run.results.has(x.id)).map(x => Object.assign({}, run.results.get(x.id), {listedTwice: !!x.listedTwice || !!(run.seen.get(x.id) && run.seen.get(x.id).twice)}));
    const uniq = [...new Map(checked.map(r => [r.id, r])).values()];
    for (const r of uniq) { const p = r.fingerprint ? run.prints.get(r.fingerprint) || [] : []; if (p.length > 1) r.sameFileAs = p.filter(i => i !== r.id).slice(0, 5); }
    const ok = uniq.filter(r => r.ok === true).length, bad = uniq.filter(r => r.ok === false).length, open = uniq.length - ok - bad;
    const twice = [...run.seen.values()].filter(x => x.twice).map(x => x.id), copies = uniq.filter(r => r.sameFileAs).length;
    const total = run.total != null ? run.total : run.items.length;
    const verdict = !total ? 'the explorer lists no pieces for ' + C.name
      : !uniq.length ? 'no pieces checked yet'
      : (bad ? fmt(bad) + ' of ' + fmt(uniq.length) + ' checked pieces have a problem' : open ? fmt(ok) + ' of ' + fmt(uniq.length) + ' checked pieces are real; ' + fmt(open) + ' not fully checked'
        : uniq.length === 1 ? 'the checked piece is real' : 'all ' + fmt(uniq.length) + ' checked pieces are real')
        + (uniq.length < total ? ' (' + fmt(uniq.length) + ' of the ' + fmt(total) + ' listed checked so far)' : '')
        + '. Listed, not proven by a parent: Doginals have no parents.';
    const from = Math.max(0, +opts.from || 0), limit = Math.max(1, Math.min(500, +opts.limit || 100));
    const want = opts.filter === 'problems' ? uniq.filter(r => r.ok === false) : opts.filter === 'notChecked' ? uniq.filter(r => r.ok === null) : uniq;
    return {
      check: 'Agent Blockhall Doge Collection Check ' + VERSION,
      verdict: verdict + (twice.length ? ' ' + fmt(twice.length) + ' listed more than once.' : '') + (copies ? ' ' + fmt(copies) + ' have the same file as another piece.' : ''),
      collection: {name: C.name, slug: C.slug, supply: C.supply != null ? C.supply : null, listed: total, holders: C.holders != null ? C.holders : null, verifiedByExplorer: !!C.verified, standard: C.standard || null,
        description: C.description ? {untrusted: String(C.description).slice(0, 400)} : null, page: 'https://thedoginalsexplorer.com/collections/' + C.slug},
      belongs: NOTE,
      counts: {listed: total, checked: uniq.length, real: ok, problems: bad, notFullyChecked: open, listedTwice: twice.length, sameFileAsAnother: copies, left: Math.max(0, total - uniq.length),
        checks: Object.fromEntries(['real', 'inBlock', 'sameFile', 'heldThere'].map(k => [k, uniq.filter(r => r.checks[k] === true).length]))},
      listedTwice: twice.slice(0, 50),
      page: {filter: opts.filter || 'all', from, limit, total: want.length, more: from + limit < want.length},
      pieces: want.slice(from, from + limit),
      next: run.itemsDone && run.items.length <= uniq.length ? null : {from: uniq.length, left: Math.max(0, total - uniq.length)},
      howChecked: HOW,
      sources: {list: run.site, pieces: 'https://thedoginalsexplorer.com', secondSite: 'https://api.bitcore.io', fileCopies: ['https://thedoginalsexplorer.com', 'https://cdn.doggy.market']},
      checkedAt: new Date().toISOString().replace(/\.\d{3}/, '')};
  }

  /* ---------- a list of pieces (numbers or IDs): each one checked the same way ---------- */
  async function checkList(ids, io, progress, opts) {
    opts = opts || {};
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const raw = (Array.isArray(ids) ? ids : String(ids || '').split(/[\s,]+/)).map(s => String(s).trim()).filter(Boolean);
    if (!raw.length) throw new Error('give Doginals: their numbers (#1000) or IDs, one per line or comma-separated');
    const L = [...new Set(raw)].slice(0, opts.max || 500), run = {lists: new Map(), coins: new Map(), prints: new Map()};
    const out = new Array(L.length); let next = 0, done = 0;
    const W = Math.min(opts.workers || 3, L.length);
    await Promise.all(Array.from({length: W}, async () => {
      while (next < L.length && !(opts.stop && opts.stop())) {
        const i = next++; let id = null;
        try { id = await DP.resolve(L[i], io); } catch (e) { out[i] = {given: L[i], ok: false, checks: {real: false}, why: String(e && e.message || e)}; done++; say('piece', [done, L.length]); continue; }
        const r = await piece(run, io, {id, n: null, name: null}); r.given = L[i];
        if (r.fingerprint) { const p = run.prints.get(r.fingerprint) || []; if (!p.includes(id)) p.push(id); run.prints.set(r.fingerprint, p); }
        out[i] = r; done++; say('piece', [done, L.length]);
      }
    }));
    const R = out.filter(Boolean);
    for (const r of R) { const p = r.fingerprint ? run.prints.get(r.fingerprint) || [] : []; if (p.length > 1) r.sameFileAs = p.filter(i => i !== r.id).slice(0, 5); }
    const ok = R.filter(r => r.ok === true).length, bad = R.filter(r => r.ok === false).length, open = R.length - ok - bad;
    return {check: 'Agent Blockhall Doge Collection Check ' + VERSION + ' (a list of pieces)',
      verdict: (!R.length ? 'nothing was checked' : bad ? fmt(bad) + ' of ' + fmt(R.length) + ' pieces have a problem' : open ? fmt(ok) + ' of ' + fmt(R.length) + ' pieces are real; ' + fmt(open) + ' not fully checked' : R.length === 1 ? 'it is real' : 'all ' + fmt(R.length) + ' pieces are real')
        + '. Doginals have no parents, so whether they belong together can\'t be proven on the chain: each piece is checked on its own.' + (raw.length > L.length ? ' (' + fmt(raw.length - L.length) + ' left out: given twice, or over ' + fmt(opts.max || 500) + ')' : ''),
      counts: {pieces: R.length, real: ok, problems: bad, notFullyChecked: open, sameFileAsAnother: R.filter(r => r.sameFileAs).length, given: raw.length, notStarted: L.length - R.length},
      pieces: R, howChecked: HOW,
      sources: {pieces: 'https://thedoginalsexplorer.com', secondSite: 'https://api.bitcore.io', fileCopies: ['https://thedoginalsexplorer.com', 'https://cdn.doggy.market']},
      checkedAt: new Date().toISOString().replace(/\.\d{3}/, '')};
  }

  const toCSV = r => {
    const q = v => { let t = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const yn = v => v === true ? 'yes' : v === false ? 'no' : 'not checked';
    return ['collection_number,name,doginal_number,id,block,made,type,bytes,fingerprint,real,in_block,same_file,held_there,result,why'].concat((r.pieces || []).map(c => [c.n, c.name, c.number, c.id, c.block, c.time, c.type, c.bytes, c.fingerprint, yn(c.checks.real), yn(c.checks.inBlock), yn(c.checks.sameFile), yn(c.checks.heldThere), yn(c.ok), c.why].map(q).join(','))).join('\n') + '\n';
  };

  return {VERSION, NOTE, HOW, find, start, loadItems, piece, walk, report, checkList, toCSV};
});
