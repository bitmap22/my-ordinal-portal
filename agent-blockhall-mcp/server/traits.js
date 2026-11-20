/* Agent Blockhall's Earned Traits, by bitmap22. Always free. Read only: it never signs, sends or changes anything.
   Traits a bitmap and its holder have earned from what really happened on Bitcoin, each one proven step by step:
     Blockout bitmap             the district is one of blocks 0 to 796,515, the land claimed by Blockout Day (30 June 2023), and its
                                 claim was made in block 796,515 or earlier
     Blockout claimer, never sold  a blockout bitmap still held by the wallet that claimed it, which has never let it go: every move
                                 it ever made stayed in that wallet
     Held since claimed          the same, for a bitmap of any year
     Held N years                how long the wallet holding it now has had it, from the day it arrived there
   Which inscription claimed N.bitmap: bop's on-chain index (OCI), read the way the OCI module reads it, then checked with ord
   (the body exactly "N.bitmap", no delegate, made in block N or later). The trail: from where it sits now, back over each
   transaction to the one that made it, as the Provenance Check follows it (each step must spend the one before it).
   The same file runs in the free Agent Blockhall MCP tool and on the portal's Earned Traits page. It only reads and works
   things out: fetching is left to whoever uses it. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.EarnedTraits = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  // The blockout: when every block mined so far had been claimed as a bitmap. Block 796,515 was mined on 30 June 2023 at 05:24 UTC
  // (checked on the chain); "Blockout Day" and that height are the bitmap community's own record of it.
  const BLOCKOUT = {block: 796515, day: '2023-06-30', source: 'Block 796,515 was mined on 30 June 2023 (on the chain); the bitmap community marks that day as Blockout Day, when all blocks mined so far (to 796,515) had been claimed.'};
  const TRAIL_MAX = 50, OCI_LIMIT = 942000;

  /* ---------- bop's on-chain index (OCI): the sat of each district's first claim, below 942,000 ----------
     (its pages are inscriptions; read the way the OCI module reads them, quirks included; the sat list for bitmaps below 840,000
     that are not the first inscription on their sat is from the OCI module, credited there to @_lefrog) */
  const OCI_PAGES = ['01bba6c58af39d7f199aa2bceeaaba1ba91b23d2663bc4ef079a4b5e442dbf74i0',
    'bb01dfa977a5cd0ee6e900f1d1f896b5ec4b1e3c7b18f09c952f25af6591809fi0', 'bb02e94f3062facf6aa2e47eeed348d017fd31c97614170dddb58fc59da304efi0',
    'bb037ec98e6700e8415f95d1f5ca1fe1ba23a3f0c5cb7284d877e9ac418d0d32i0', 'bb9438f4345f223c6f4f92adf6db12a82c45d1724019ecd7b6af4fcc3f5786cei0',
    'bb0542d4606a9e7eb4f31051e91f7696040db06ca1383dff98505618c34d7df7i0', 'bb06a4dffba42b6b513ddee452b40a67688562be4a1345127e4d57269e6b2ab6i0',
    'bb076934c1c22007b315dd1dc0f8c4a2f9d52f348320cfbadc7c0bd99eaa5e18i0', 'bb986a1208380ec7db8df55a01c88c73a581069a51b5a2eb2734b41ba10b65c2i0',
    'b907b51a239e3a37f29f8222fb274f828c6ebf7b93ce501a55b7171daaa75758i0', 'b942b6477c7da9090edb9751429ba9c3ba01b39ab972fc888d481f528e3e03c3i0'];
  const OCI_SATIDX = {92871: 1, 92970: 1, 123132: 1, 365518: 1, 700181: 1, 826151: 1, 827151: 1, 828151: 1, 828239: 1, 828661: 1,
    829151: 1, 830151: 1, 832104: 2, 832249: 2, 832252: 2, 832385: 4, 833067: 1, 833101: 3, 833105: 4, 833109: 4, 833121: 8,
    834030: 2, 834036: 2, 834051: 17, 834073: 4, 836151: 1, 837115: 2, 837120: 2, 837151: 1, 837183: 3, 837188: 2, 838058: 5,
    838068: 2, 838076: 2, 838096: 1, 838151: 1, 838821: 1, 839151: 1, 839377: 1, 839378: 2, 839382: 2, 839397: 1};
  const ociPageNo = n => n >= 907000 ? 10 : n >= 840000 ? 9 : Math.floor(n / 100000);
  const ociPos = n => n >= 907000 ? n - 907000 : n >= 840000 ? n - 840000 : n % 100000;
  function ociDecode(p, text) {
    let d; const full = [], sats = [], pi = v => parseInt(String(v)), undelta = (list, out) => list.forEach((s, i) => out.push(i ? pi(out[i - 1]) + pi(s) : pi(s)));
    if (p >= 9) { d = JSON.parse(text); undelta(d.deltaEncodedSats, sats); return {sats, map: d.satIndexMap || {}}; }
    if (p === 2 || p === 3) { d = JSON.parse('[' + text + ']'); d = [d.slice(0, 99999), d.slice(100000, 199999)]; }
    else { d = text; try { d = JSON.parse(d.split('\\n  ').join('')); } catch (e) {} if (typeof d === 'string') try { d = JSON.parse(d.split('  ').join('')); } catch (e) {} }
    undelta(d[0], full); d[1].forEach((pos, i) => { sats[pos] = full[i]; });
    return {sats, map: null};
  }
  const pages = new Map();
  async function ociClaimId(n, io) {
    const p = ociPageNo(n);
    if (!pages.has(p)) pages.set(p, io.ordText('/content/' + OCI_PAGES[p]).then(x => ociDecode(p, x.t)).catch(e => { pages.delete(p); throw e; }));
    const pg = await pages.get(p), sat = pg.sats[ociPos(n)], at = n >= 840000 ? (pg.map[String(n)] || 0) : (OCI_SATIDX[n] || 0);
    if (typeof sat !== 'number' || !(sat > 0) || sat % 1 || sat > 9007199254740991) return null;
    const j = (await io.ordJson('/r/sat/' + sat + '/at/' + at)).j; return (j && j.id) || null;
  }
  // which inscription claimed N.bitmap, checked with ord: {id, number, block, time, holder, satpoint} (or {none, why})
  async function claimOf(n, io) {
    if (!(Number.isInteger(n) && n >= 0)) throw new Error('give a bitmap: a block number, like 388067 or 388067.bitmap');
    if (n >= OCI_LIMIT) return {none: true, why: 'districts from ' + OCI_LIMIT.toLocaleString('en-GB') + ' up are not in the on-chain index this reads yet: Agent Blockhall\'s tablet finds their claims block by block'};
    const id = await ociClaimId(n, io); if (!id) return {none: true, why: 'the on-chain index has no claim for ' + n + '.bitmap'};
    const want = n + '.bitmap', [o, t] = await Promise.all([io.ordJson('/r/inscription/' + id), io.ordText('/content/' + id)]), J = o.j;
    const ok = t.t === want && !J.delegate && (typeof J.content_length !== 'number' || J.content_length === want.length) && J.height >= n;
    if (!ok) return {none: true, why: 'the inscription the index points to (' + id + ') did not check out as ' + want + ' with ord', id};
    return {id, number: J.number, block: J.height, time: J.timestamp ? iso(J.timestamp) : null, holder: J.address || null, satpoint: J.satpoint || null, site: o.site};
  }
  const iso = s => new Date(s * 1000).toISOString().replace('.000', '');

  /* ---------- the trail: from where it sits now back to the transaction that made it (oldest first) ---------- */
  function stepBack(tx, vout, offset) {
    let abs = offset; for (let k = 0; k < vout; k++) abs += tx.vout[k].value;
    let acc = 0;
    for (let k = 0; k < tx.vin.length; k++) { const v = tx.vin[k].prevout ? tx.vin[k].prevout.value : 0; if (abs < acc + v) return {txid: tx.vin[k].txid, vout: tx.vin[k].vout, offset: abs - acc}; acc += v; }
    return null;
  }
  async function trailOf(id, satpoint, io) {
    const gen = id.slice(0, 64), T = {steps: [], reached: false}; let [txid, vout, off] = String(satpoint || '').split(':'); vout = +vout; off = +off;
    try {
      if (!/^[0-9a-f]{64}$/.test(txid || '') || !(vout >= 0) || !(off >= 0)) throw new Error('where it sits now could not be read');
      for (;;) {
        if (T.steps.length) await io.sleep(250);
        const x = await io.mpJson('/api/tx/' + txid), tx = x.j, st = tx.status || {}, o = tx.vout[vout]; T.site = x.site;
        const step = {txid, block: st.confirmed ? st.block_height : null, time: st.block_time ? iso(st.block_time) : null, to: (o && o.scriptpubkey_address) || ''};
        if (txid === gen) { step.made = true; T.steps.push(step); T.reached = true; break; }
        if (!st.confirmed) step.waiting = true;
        T.steps.push(step);
        if (T.steps.length >= TRAIL_MAX) { T.more = true; break; }
        if (tx.vin.some(v => v.is_coinbase)) { T.lost = true; step.toMiner = true; break; }
        const b = stepBack(tx, vout, off); if (!b) throw new Error('its trail could not be followed past ' + txid.slice(0, 12) + '…');
        txid = b.txid; vout = b.vout; off = b.offset;
      }
    } catch (e) { T.error = String(e && e.message || e); }
    T.steps.reverse();
    return T;
  }

  /* ---------- the traits, worked out from the claim and the trail ---------- */
  const fmt = n => Number(n).toLocaleString('en-GB');
  function build(n, C, T, now, unspent) {
    const R = {check: 'Agent Blockhall Earned Traits ' + VERSION, bitmap: n + '.bitmap', claim: null, holder: null, traits: [], notEarned: [], couldNotCheck: [], trail: T ? T.steps : [], blockout: BLOCKOUT};
    if (C.none) { R.couldNotCheck.push({trait: 'every trait', why: C.why}); return R; }
    R.claim = {id: C.id, number: C.number, block: C.block, time: C.time, byWallet: T && T.reached ? T.steps[0].to : null};
    R.holder = C.holder;
    const earn = (trait, about, why, proof) => R.traits.push({trait, about, why, proof});
    const no = (trait, why) => R.notEarned.push({trait, why}), cant = (trait, why) => R.couldNotCheck.push({trait, why});
    // 1. the land: a blockout district
    const inBlockout = n <= BLOCKOUT.block && C.block <= BLOCKOUT.block;
    if (inBlockout) earn('Blockout bitmap', 'the bitmap', 'district ' + fmt(n) + ', claimed in block ' + fmt(C.block) + ' (' + (C.time || '').slice(0, 10) + '): by Blockout Day, ' + BLOCKOUT.day + ', when every block mined so far (to ' + fmt(BLOCKOUT.block) + ') had been claimed', {claim: C.id, claimBlock: C.block});
    else no('Blockout bitmap', n > BLOCKOUT.block ? 'district ' + fmt(n) + ' is after the blockout line (block ' + fmt(BLOCKOUT.block) + ')' : 'its claim was made in block ' + fmt(C.block) + ', after the blockout (block ' + fmt(BLOCKOUT.block) + ')');
    // 2. the wallet: held since claimed (every move stayed in the wallet that claimed it), and how long it has been held now
    const done = T && T.reached && !T.error, claimer = done ? T.steps[0].to : null;
    if (!done) {
      const why = !T ? 'its trail was not followed' : T.more ? 'it has moved more than ' + TRAIL_MAX + ' times: its whole trail was not followed' : T.lost ? 'its trail goes through a miner\'s fee' : 'its trail could not be followed: ' + (T.error || 'unknown');
      cant('Held since claimed', why); if (inBlockout) cant('Blockout claimer, never sold', why); cant('Held N years', why);
      return R;
    }
    const left = T.steps.find(s => s.to !== claimer), stillThere = C.holder === claimer && unspent !== false;
    const moves = T.steps.length - 1, proofTrail = {claimedBy: claimer, moves, everyMoveStayed: !left, trail: T.steps.map(s => s.txid)};
    if (!left && stillThere) {
      earn('Held since claimed', 'the wallet ' + claimer, 'the wallet that claimed it in block ' + fmt(C.block) + ' still holds it, and ' + (moves ? 'all ' + moves + ' of its moves stayed in that wallet' : 'it has never moved'), proofTrail);
      if (inBlockout) earn('Blockout claimer, never sold', 'the wallet ' + claimer, 'claimed during the blockout and never let go: ' + (moves ? 'all ' + moves + ' of its moves stayed in that wallet' : 'it has never moved'), proofTrail);
    } else {
      const why = left ? 'it left the wallet that claimed it in transaction ' + left.txid + (left.block ? ' (block ' + fmt(left.block) + ')' : '') : 'the wallet that claimed it no longer holds it';
      no('Held since claimed', why); if (inBlockout) no('Blockout claimer, never sold', why);
    }
    // how long the wallet holding it now has had it: from the oldest step of the unbroken run of steps into that wallet
    if (C.holder) {
      let k = T.steps.length - 1; if (T.steps[k].to !== C.holder) { cant('Held N years', 'the newest step of its trail does not go to the wallet ord says holds it'); return R; }
      while (k > 0 && T.steps[k - 1].to === C.holder) k--;
      const since = T.steps[k].time, yrs = since ? Math.floor((now - Date.parse(since)) / (365.25 * 864e5)) : null;
      R.heldSince = since ? {wallet: C.holder, since, transaction: T.steps[k].txid} : null;
      if (yrs >= 1) earn('Held ' + yrs + ' year' + (yrs === 1 ? '' : 's'), 'the wallet ' + C.holder, 'it arrived in this wallet on ' + since.slice(0, 10) + ' and has stayed there', {since, transaction: T.steps[k].txid});
      else if (since) no('Held 1 year', 'it arrived in the wallet that holds it now on ' + since.slice(0, 10) + ', under a year ago');
    }
    return R;
  }

  /* ---------- one bitmap, all the steps ----------
     io: {ordJson(path) -> {j, site}, ordText(path) -> {t, site}, mpJson(path) -> {j, site}, sleep(ms), now (optional, ms)} */
  function bitmapNumber(q) {
    const m = /^\s*#?\s*(\d{1,7})(\.bitmap)?\s*$/i.exec(String(q == null ? '' : q).replace(/,/g, ''));
    return m ? +m[1] : null;
  }
  async function bitmap(q, io) {
    const n = typeof q === 'number' ? q : bitmapNumber(q); if (n == null) throw new Error('give a bitmap: a block number, like 388067 or 388067.bitmap');
    const C = await claimOf(n, io); if (C.none) return build(n, C, null, io.now || Date.now());
    const T = await trailOf(C.id, C.satpoint, io);
    let unspent = null; try { const sp = String(C.satpoint).split(':'); unspent = !(await io.mpJson('/api/tx/' + sp[0] + '/outspend/' + sp[1])).j.spent; } catch (e) {}
    const R = build(n, C, T, io.now || Date.now(), unspent);
    R.sources = {claim: C.site || null, trail: T.site || null};
    return R;
  }

  /* ---------- a wallet: which bitmaps it holds that are real claims, and what each has earned ----------
     io as above, plus addressText(address) -> {t, site} (ord's page for the address); progress(text) optional */
  const isBtcAddr = a => /^(bc1[0-9a-z]{25,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a);
  async function wallet(address, io, o = {}) {
    const a = String(address || '').trim(); if (!isBtcAddr(a)) throw new Error('give a Bitcoin address (starts with bc1, 1 or 3)');
    const say = io.progress || (() => {}), MAX = Math.min(o.max || 60, 200);
    say('Reading which inscriptions ' + a + ' holds…');
    const page = await io.addressText(a), ids = [...new Set([...page.t.matchAll(/\/inscription\/([0-9a-f]{64}i\d+)/g)].map(m => m[1]))];
    const out = {check: 'Agent Blockhall Earned Traits ' + VERSION, wallet: a, holds: ids.length, bitmaps: [], walletTraits: [], skipped: 0, blockout: BLOCKOUT};
    // the small text inscriptions only (a bitmap's body is "N.bitmap", 8 to 14 characters), then the index must agree it is the claim
    const found = [];
    for (let i = 0; i < ids.length; i++) {
      if (o.stopped && o.stopped()) break;
      if (i && !(i % 25)) say('Looking for bitmaps among ' + fmt(ids.length) + ' inscriptions: ' + fmt(i) + ' read…');
      let J; try { J = (await io.ordJson('/r/inscription/' + ids[i])).j; } catch (e) { continue; }
      if (!(J.content_length >= 8 && J.content_length <= 14) || !/^text\/plain/.test(J.content_type || '') || J.delegate) continue;
      let t; try { t = (await io.ordText('/content/' + ids[i])).t; } catch (e) { continue; }
      const m = /^(0|[1-9]\d{0,6})\.bitmap$/.exec(t); if (m) found.push({n: +m[1], id: ids[i]});
    }
    found.sort((x, y) => x.n - y.n);
    if (found.length > MAX) { out.skipped = found.length - MAX; found.length = MAX; }
    for (let i = 0; i < found.length; i++) {
      if (o.stopped && o.stopped()) break;
      say('Checking ' + found[i].n + '.bitmap (' + (i + 1) + ' of ' + found.length + ')…');
      try {
        const R = await bitmap(found[i].n, io);
        if (R.claim && R.claim.id !== found[i].id) { out.bitmaps.push({bitmap: found[i].n + '.bitmap', id: found[i].id, notTheClaim: 'an earlier inscription claimed ' + found[i].n + '.bitmap (' + R.claim.id + '): this one is a copy, so it earns nothing'}); continue; }
        out.bitmaps.push(R);
      } catch (e) { out.bitmaps.push({bitmap: found[i].n + '.bitmap', id: found[i].id, error: String(e.message || e)}); }
    }
    // the wallet's own traits: the ones it earned through the bitmaps it holds (only where it is the wallet named)
    const tally = new Map();
    for (const R of out.bitmaps) for (const t of R.traits || []) if (t.about === 'the wallet ' + a) { const k = /^Held \d+ years?$/.test(t.trait) ? 'Held a bitmap 1 year or more' : t.trait; tally.set(k, (tally.get(k) || []).concat(R.bitmap)); }
    out.walletTraits = [...tally].map(([trait, bitmaps]) => ({trait, bitmaps}));
    return out;
  }

  return {VERSION, BLOCKOUT, bitmapNumber, claimOf, trailOf, build, bitmap, wallet, isBtcAddr};
});
