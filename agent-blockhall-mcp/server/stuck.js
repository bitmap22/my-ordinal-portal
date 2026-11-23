/* Stuck Transaction Doctor, by bitmap22. Always free. Part of Agent Blockhall: https://ordportal.com/block-cube.html
   Give it a Bitcoin transaction's ID. It says whether it is stuck and why (its fee against the blocks waiting to be mined, a
   parent that pays too little, dropped by nodes, an inscription's reveal waiting for its commit), and the fee that would get it
   in: by replacing it (replace-by-fee) or by spending one of its outputs in a child that pays for both (CPFP), worked out for
   each output. The fees aimed for are the fee advice that keeps score of itself (Agent Blockhall's big screen): next block,
   about an hour, about three hours, each counted from the last day of blocks, never under what the next block takes now.
   The replacement rules are Bitcoin Core's own (doc/policy/mempool-replacements.md): a replacement must pay at least what it
   replaces and its own size again at the incremental relay fee, and leave the waiting blocks better; Bitcoin Core 28 and later
   accept a replacement without the old opt-in signal. Bitcoin Core 29.1 and 30 lowered the incremental relay fee to 0.1 sat/vB,
   but many nodes still use 1 sat/vB, so 1 sat/vB is used here, so every node passes the replacement on.
   A child's size is the usual size for its kind of output (one input, one output back to the same kind of address).
   It reads mempool.space (and its copies) and uses the Provenance Check's transaction reader (provenance.js) to spot an
   inscription. Nothing is sent or signed: it only reads and works out. The same file is for the portal's Stuck Transaction
   Doctor page and the free Agent Blockhall MCP tool. Fetching is left to whoever uses it (io: mpJson(path), mpText(path),
   fineBlocks(height) -> a page of blocks with their fee ranges, from a site that gives fees to the decimal). No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('./provenance.js'));
  else root.StuckDoctor = make(root.ProvenanceCheck);
})(typeof self !== 'undefined' ? self : this, function (PV) {
  'use strict';
  const VERSION = '1.0.0';
  const INCREMENTAL = 1;      // sat/vB a replacement adds for its own size (1: what every node still accepts; Bitcoin Core 29.1 and later ask 0.1)
  const r1 = v => v == null || !isFinite(v) ? '?' : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, '');   // (a fee rate a site didn't give: ?, never NaN)
  const fmt = n => n == null || !isFinite(Number(n)) ? '–' : Number(n).toLocaleString('en-GB');   // (a number a site didn't give: a dash, never NaN)
  const up = v => Math.ceil(v * 100 - 1e-9) / 100;
  const whole = fr => fr.every(v => Math.abs(v - Math.round(v)) < 1e-9);

  /* ---------- the fee advice that keeps score of itself (the same way as Agent Blockhall's big screen and the MCP tool's feeAdvice) ---------- */
  async function advise(io, progress) {
    const [tipX, nextX] = await Promise.all([io.mpText('/api/blocks/tip/height'), io.mpJson('/api/v1/fees/mempool-blocks')]);
    const top = +String(tipX.t).trim(), got = new Map(), used = new Set([tipX.site, nextX.site]);
    for (let h = top; h > top - 144;) {
      const x = await io.fineBlocks(h); const list = x && x.list;
      if (!Array.isArray(list) || !list.length) break;
      used.add(x.site); for (const b of list) if (!got.has(b.height)) got.set(b.height, b);
      const nh = Math.min(...list.map(b => b.height)) - 1; if (!(nh < h)) break; h = nh; if (progress) progress('blocks', got.size);   // (a copy that ignores the height asked: stop, never loop)
    }
    const B = [];
    for (let i = 0; i < 144; i++) {
      const h = top - 143 + i, b = got.get(h); if (!b || !b.timestamp) continue;
      const e = b.extras, fr = e && e.feeRange && e.feeRange.length > 1 ? e.feeRange : null, fine = fr ? !whole(fr) : false;
      B.push({h, t: b.timestamp, fl: fr ? (fine ? fr[0] : fr[0] < fr[1] * .5 ? fr[1] : fr[0]) : null});
    }
    const f0 = nextX.j && nextX.j[0], F0 = f0 && f0.feeRange && f0.feeRange.length ? f0.feeRange[0] : null, fl = B.map(q => q.fl).filter(v => v != null);
    const q25 = f0 && f0.feeRange && f0.feeRange.length > 2 ? f0.feeRange[2] : F0 || 0, T0 = 36, S = {fees: [], keepsScoreOfItself: null, nextBlockTakesNow: F0, waiting: nextX.j || []};
    if (fl.length >= T0 + 12) {
      const ways = [], H = T0 + Math.floor((fl.length - T0) / 2);
      for (const W of [12, 24, 36]) for (const mm of [1, 1.1, 1.25, 1.5]) {
        let hit = 0, sum = 0, hb = 0;
        for (let i = T0; i < fl.length; i++) { let mx = 0; for (let k = i - W; k < i; k++) if (fl[k] > mx) mx = fl[k]; const fee = up(mx * mm); if (i < H) { if (fl[i] <= fee) hit++; sum += fee; } else if (fl[i] <= fee) hb++; }
        let mx = 0; for (let k = fl.length - W; k < fl.length; k++) if (fl[k] > mx) mx = fl[k];
        ways.push({W, m: mm, hit, hb, avg: sum / (H - T0), fee: up(Math.max(mx * mm, q25))});
      }
      const n = H - T0, nb = fl.length - H, top1 = Math.max(...ways.map(w => w.hit));
      const good = ways.filter(w => w.hit / n >= .95).sort((p, q) => p.avg - q.avg), best = good[0] || ways.filter(w => w.hit >= top1).sort((p, q) => p.avg - q.avg)[0];
      const cand = [...new Set(fl.map(up))].filter(c => c >= .1).sort((p, q) => p - q), st = fl.length - 5; let pat = null;
      for (const c of cand) { let in6 = 0; for (let i = 0; i < st; i++) { if (fl[i] <= c) { in6++; continue; } for (let j = i + 1; j < i + 6; j++) if (fl[j] <= c) { in6++; break; } } if (in6 / st >= .9) { pat = {fee: c, p6: Math.round(in6 / st * 100)}; break; } }
      let chp = null; { const s2 = fl.length - 17; if (s2 > 30) for (const c of cand) { let ok = 0; for (let i = 0; i < s2; i++) for (let j = i; j < i + 18; j++) if (fl[j] <= c) { ok++; break; } if (ok / s2 >= .9) { chp = {fee: c, p: Math.round(ok / s2 * 100)}; break; } } }
      S.fees.push({name: 'next block', feeRate: +r1(best.fee), what: 'the next block: right ' + best.hb + ' of the last ' + nb + ' blocks'});
      if (pat && pat.fee < best.fee * .9) S.fees.push({name: 'about an hour', feeRate: +r1(pat.fee), what: 'within about an hour (6 blocks): ' + pat.p6 + '% of the last day'});
      if (chp && chp.fee < best.fee * .9 && (!pat || chp.fee < pat.fee * .9)) S.fees.push({name: 'about three hours', feeRate: +r1(chp.fee), what: 'within about three hours (18 blocks): ' + chp.p + '% of the last day'});
      S.keepsScoreOfItself = {right: best.hb, of: nb, percent: Math.round(best.hb / nb * 100), way: 'the dearest of the last ' + best.W + ' blocks' + (best.m > 1 ? ' + ' + Math.round((best.m - 1) * 100) + '%' : '')};
    } else if (fl.length >= 25) { const L = fl.slice(-24); S.fees.push({name: 'next block', feeRate: +r1(up(Math.max(Math.max(...L) * 1.1, q25))), what: 'the next block (not enough blocks read to keep score)'}); }
    else if (F0 != null) S.fees.push({name: 'next block', feeRate: +r1(Math.max(F0, q25)), what: 'what the next block takes now (not enough blocks read to keep score)'});
    // (never under what the blocks waiting now take: the next block's entry for the next block; the sixth block's for about an hour,
    //  or the last waiting block's if fewer are waiting; the last waiting block's for about three hours)
    const W = S.waiting, entry = i => W[i] && W[i].feeRange && W[i].feeRange.length ? W[i].feeRange[0] : null;
    const floor = {'next block': entry(0), 'about an hour': entry(Math.min(5, W.length - 1)), 'about three hours': entry(W.length - 1)};
    for (const f of S.fees) { const fl0 = floor[f.name]; if (fl0 != null && f.feeRate < fl0) { f.feeRate = +r1(up(fl0)); f.what += ' (raised to what the blocks waiting now take)'; } }
    for (let i = S.fees.length - 1; i > 0; i--) if (S.fees[i].feeRate >= S.fees[i - 1].feeRate) S.fees.splice(i, 1);   // (a slower aim that costs no less is no aim)
    S.newestBlock = top; S.blocksRead = B.length; S.sources = [...used].filter(Boolean);
    return S;
  }

  /* ---------- a child's usual size, and the smallest output it may leave, by the kind of output it spends ---------- */
  const KIND = {
    v1_p2tr: {name: 'taproot (bc1p…)', child: 111, dust: 330},
    v0_p2wpkh: {name: 'native segwit (bc1q…)', child: 110, dust: 294},
    v0_p2wsh: {name: 'segwit script (bc1q…, long)', child: 160, dust: 330, about: true},
    p2sh: {name: 'script hash (3…)', child: 134, dust: 540, about: true},
    p2pkh: {name: 'legacy (1…)', child: 192, dust: 546}
  };

  // where it would sit in the blocks waiting now (the next block first)
  function place(rate, waiting) {
    for (let i = 0; i < waiting.length; i++) { const w = waiting[i], lo = w.feeRange && w.feeRange.length ? w.feeRange[0] : null; if (lo != null && rate >= lo) return {block: i + 1, of: waiting.length, entry: lo}; }
    return {block: null, of: waiting.length, entry: waiting.length ? (waiting[waiting.length - 1].feeRange || [null])[0] : null};
  }

  /* ---------- the diagnosis ---------- */
  async function diagnose(txid, io, progress) {
    txid = String(txid || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(txid)) throw new Error('give a transaction ID: 64 letters and numbers (0-9, a-f)');
    const say = (k, v) => { if (progress) progress(k, v); };
    say('reading', 'the transaction');
    let T = null, site = null;
    try { const x = await io.mpJson('/api/tx/' + txid); T = x.j; site = x.site; } catch (e) { if (!/404|not found/i.test(String(e && e.message || e))) throw e; }
    const out = {txid, checked: new Date().toISOString().replace(/\.\d{3}/, ''), sources: site ? [site] : []};
    if (!T) {
      const m = await io.mpJson('/api/v1/fees/recommended').catch(() => null);
      return Object.assign(out, {state: 'not found', verdict: 'Not found: ' + (io.askedAll ? io.askedAll() : 'mempool.space and its copies') + ' have no transaction with this ID, waiting or mined.',
        why: ['It was never sent to the network, or nodes have dropped it (a transaction paying under what full nodes keep' + (m && m.j ? ', now ' + r1(m.j.minimumFee) + ' sat/vB,' : '') + ' can be dropped, and so can one that waited two weeks), or the ID has a mistake in it.',
          'If it was dropped, its coins were never spent: the wallet that made it can send it again, with a higher fee.'], fixes: null});
    }
    if (T.status && T.status.confirmed) {
      let tip = null; try { tip = +String((await io.mpText('/api/blocks/tip/height')).t).trim(); } catch (e) {}
      const conf = tip != null ? tip - T.status.block_height + 1 : null;
      let insM = 0; try { insM = PV.envelopes(PV.parseTx(PV.fromHex(String((await io.mpText('/api/tx/' + txid + '/hex')).t).trim()))).length; } catch (e) {}
      return Object.assign(out, {state: 'mined', verdict: 'Not stuck: it was mined in block ' + fmt(T.status.block_height) + (conf ? ' (' + fmt(conf) + ' confirmation' + (conf === 1 ? '' : 's') + ')' : '') + '.',
        facts: {block: T.status.block_height, time: T.status.block_time ? new Date(T.status.block_time * 1000).toISOString().replace('.000', '') : null, fee: T.fee, vsize: Math.ceil(T.weight / 4), feeRate: +r1(T.fee / Math.ceil(T.weight / 4)), confirmations: conf, inscriptions: insM}, why: insM ? ['It wrote ' + insM + ' inscription' + (insM === 1 ? '' : 's') + '.'] : [], fixes: null});
    }

    // waiting: its fee, the transactions tied to it, where it sits, how long it has waited
    say('reading', 'the transactions tied to it, and the blocks waiting');
    const vsize = Math.ceil(T.weight / 4), rate = T.fee / vsize;
    const [cp, rec, times, outsp, hexX, adv] = await Promise.all([
      io.mpJson('/api/v1/cpfp/' + txid).then(x => x.j).catch(() => null),
      io.mpJson('/api/v1/fees/recommended').then(x => x.j).catch(() => null),
      io.mpJson('/api/v1/transaction-times?txId[]=' + txid).then(x => x.j).catch(() => null),
      io.mpJson('/api/tx/' + txid + '/outspends').then(x => x.j).catch(() => null),
      io.mpText('/api/tx/' + txid + '/hex').then(x => x.t).catch(() => null),
      advise(io, progress)]);
    const anc = cp && Array.isArray(cp.ancestors) ? cp.ancestors : [], desc = cp && Array.isArray(cp.descendants) ? cp.descendants : [];
    const vz = t => t.vsize || Math.ceil((t.weight || 0) / 4);
    const ancFee = anc.reduce((s, a) => s + (a.fee || 0), 0), ancV = anc.reduce((s, a) => s + vz(a), 0), descFee = desc.reduce((s, a) => s + (a.fee || 0), 0);
    const eff = cp && cp.effectiveFeePerVsize ? cp.effectiveFeePerVsize : (ancFee + T.fee) / (ancV + vsize);
    const where = place(eff, adv.waiting), F0 = adv.nextBlockTakesNow;
    let ins = []; try { if (hexX) ins = PV.envelopes(PV.parseTx(PV.fromHex(hexX))); } catch (e) {}
    const firstSeen = Array.isArray(times) && times[0] ? times[0] : null;
    const facts = {fee: T.fee, vsize, feeRate: +r1(rate), effectiveFeeRate: +r1(eff), waitingSince: firstSeen ? new Date(firstSeen * 1000).toISOString().replace('.000', '') : null,
      waitingFor: firstSeen ? Math.max(0, Math.round((Date.now() / 1000 - firstSeen) / 60)) : null, inWaitingBlock: where.block, waitingBlocks: where.of, nextBlockTakesNow: F0 != null ? +r1(F0) : null,
      nodesDropBelow: rec && rec.minimumFee != null ? +r1(rec.minimumFee) : null, parentsWaiting: anc.length, childrenWaiting: desc.length, inscriptions: ins.length || 0};

    // why
    const why = [];
    if (where.block === 1) why.push('It pays enough for the next block now (' + r1(eff) + ' sat/vB, and the next block takes from ' + r1(F0) + '): it should go in soon, unless blocks fill with higher fees first.');
    else if (where.block) why.push('Its fee, ' + r1(eff) + ' sat/vB, puts it in about block ' + where.block + ' of the ' + where.of + ' waiting (around ' + (where.block * 10) + ' minutes, if nothing paying more arrives); the next block takes from ' + r1(F0) + ' sat/vB.');
    else why.push('Its fee, ' + r1(eff) + ' sat/vB, is under every one of the ' + where.of + ' blocks waiting: everything waiting pays more, so it goes in only once that has cleared and fees drop.');
    if (anc.length && eff < rate - 1e-9) why.push('It spends ' + (anc.length === 1 ? 'a transaction that is' : anc.length + ' transactions that are') + ' still waiting too, paying less (' + r1(ancFee / Math.max(1, ancV)) + ' sat/vB): a miner takes them together, so they pull it down to ' + r1(eff) + ' sat/vB.');
    if (anc.length && eff > rate + 1e-9) why.push('It spends a transaction still waiting; together they pay ' + r1(eff) + ' sat/vB.');
    if (desc.length) why.push(desc.length + ' transaction' + (desc.length === 1 ? ' spends' : 's spend') + ' its outputs already and wait' + (desc.length === 1 ? 's' : '') + ' with it' + (cp && cp.effectiveFeePerVsize && cp.effectiveFeePerVsize > rate ? ', paying for it (' + r1(cp.effectiveFeePerVsize) + ' sat/vB together)' : '') + '.');
    if (facts.nodesDropBelow != null && eff < facts.nodesDropBelow) why.push('Nodes with full mempools drop transactions under ' + r1(facts.nodesDropBelow) + ' sat/vB now: it may be dropped (its coins then stay unspent and can be sent again).');
    if (ins.length) why.push('It is an inscription\'s reveal (' + ins.length + ' inscription' + (ins.length === 1 ? '' : 's') + ' written in it)' + (anc.length ? ', and its commit is still waiting too: the reveal can\'t be mined before the commit' : '') + '.');
    if (facts.waitingFor != null) why.push('Seen waiting since ' + facts.waitingSince.replace('T', ' ').replace('Z', ' UTC') + ' (' + (facts.waitingFor < 120 ? facts.waitingFor + ' minutes' : Math.round(facts.waitingFor / 60) + ' hours') + '). Nodes drop a transaction after two weeks of waiting.');

    // the fixes, for each fee aimed at
    const targets = adv.fees.slice().sort((a, b) => b.feeRate - a.feeRate);
    const replace = [], child = [];
    for (const t of targets) {
      // replace-by-fee: the same transaction made again with a higher fee (the same size), paying for what it replaces (its children too) and its own size again
      const need = Math.max(Math.ceil(t.feeRate * (ancV + vsize) - ancFee), T.fee + descFee + Math.ceil(INCREMENTAL * vsize), T.fee + 1);
      replace.push({aim: t.name, aimRate: t.feeRate, newFee: need, newFeeRate: +r1(need / vsize), extra: need - T.fee, alreadyEnough: eff >= t.feeRate});
    }
    // which outputs the new inscriptions land in (ord: the first sat of the input it was written in, or its pointer)
    const held = new Map();
    for (const e of ins) {
      let off = e.pointer != null ? e.pointer : (T.vin || []).slice(0, e.input).reduce((s, v) => s + (v.prevout ? v.prevout.value : 0), 0), at = 0;
      for (let i = 0; i < (T.vout || []).length; i++) { if (off < at + T.vout[i].value) { held.set(i, (held.get(i) || 0) + 1); break; } at += T.vout[i].value; }
    }
    const outs = (T.vout || []).map((o, i) => ({vout: i, value: o.value, address: o.scriptpubkey_address || null, type: o.scriptpubkey_type, spent: outsp && outsp[i] ? !!outsp[i].spent : null}));
    for (const o of outs) {
      const K = KIND[o.type];
      if (!K) { child.push({vout: o.vout, value: o.value, address: o.address, kind: o.type, usable: false, why: o.type === 'op_return' ? 'it holds data, not coins' : 'a kind of output this doesn\'t size'}); continue; }
      if (o.spent) { child.push({vout: o.vout, value: o.value, address: o.address, kind: K.name, usable: false, why: 'already spent by a transaction waiting with it'}); continue; }
      const per = targets.map(t => {
        const fee = Math.ceil(t.feeRate * (ancV + vsize + K.child) - (ancFee + T.fee));
        return {aim: t.name, aimRate: t.feeRate, childFee: Math.max(fee, Math.ceil(INCREMENTAL * K.child)), childFeeRate: +r1(Math.max(fee, Math.ceil(INCREMENTAL * K.child)) / K.child), leaves: o.value - Math.max(fee, Math.ceil(INCREMENTAL * K.child)), enough: o.value - Math.max(fee, Math.ceil(INCREMENTAL * K.child)) >= K.dust};
      });
      const holds = held.has(o.vout) ? 'it holds ' + (held.get(o.vout) === 1 ? 'the new inscription' : held.get(o.vout) + ' of the new inscriptions') + ': if you spend it, send it only back to yourself, with a wallet that keeps inscriptions safe' : null;
      child.push({vout: o.vout, value: o.value, address: o.address, kind: K.name, childSize: K.child, childSizeIsAbout: !!K.about, usable: per.some(p => p.enough), fees: per, warning: holds,
        why: per.some(p => p.enough) ? null : 'it holds too little to pay the child\'s fee and leave ' + K.dust + ' sats (the smallest output nodes pass on)'});
    }
    const ok = eff >= (targets[0] ? targets[0].feeRate : Infinity) || where.block === 1;
    const verdict = ok ? 'Waiting, but not stuck: it pays enough for the next block (' + r1(eff) + ' sat/vB).'
      : where.block ? 'Waiting: at ' + r1(eff) + ' sat/vB it sits in about block ' + where.block + ' of the ' + where.of + ' waiting. To be sure of the next block, it needs about ' + (targets[0] ? targets[0].feeRate : '?') + ' sat/vB (the next block takes from ' + r1(F0) + ' now).'
      : 'Stuck at the back: at ' + r1(eff) + ' sat/vB it is under every block waiting. For the next block it needs about ' + (targets[0] ? targets[0].feeRate : '?') + ' sat/vB.';
    out.sources = [...new Set(out.sources.concat(adv.sources))];
    return Object.assign(out, {state: ok ? 'waiting, not stuck' : where.block ? 'waiting' : 'stuck', verdict, facts, why,
      fees: {aims: adv.fees, keepsScoreOfItself: adv.keepsScoreOfItself, newestBlock: adv.newestBlock, blocksRead: adv.blocksRead},
      fixes: {
        replace: {how: 'Make the same transaction again, spending the same coins, with a higher fee (most wallets call it "speed up" or "bump fee"; only the wallet that made it can). Bitcoin Core 28 and later accept it without the old opt-in signal.' + (desc.length ? ' It throws out the ' + desc.length + ' waiting on it, so they would have to be made again' + (ins.length ? '' : '') + '.' : '') + (anc.length ? ' Its parent still waits: the fee covers both.' : ''), rules: 'It must pay at least what it replaces (' + fmt(T.fee + descFee) + ' sats), plus its own size again at ' + INCREMENTAL + ' sat/vB, and a higher fee rate than before.', options: replace},
        child: {how: 'Send one of its outputs on (to yourself) in a new transaction that pays a fee big enough for both: miners take the two together (child pays for parent). Only the owner of that output can.', options: child}},
      rules: {incrementalRelayFee: INCREMENTAL + ' sat/vB (Bitcoin Core 29.1 and later ask 0.1, but many nodes still ask 1)', fullRbf: 'Bitcoin Core 28 (Oct 2024) and later accept a replacement without the opt-in signal', source: 'Bitcoin Core\'s doc/policy/mempool-replacements.md and release notes 28.0, 30.0 and 31.0'}});
  }

  return {VERSION, INCREMENTAL, KIND, advise, place, diagnose};
});
