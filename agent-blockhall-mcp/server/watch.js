/* Agent Blockhall's Watch, by bitmap22. Always free.
   Keeps an eye on Bitcoin and says the moment something happens, each alert checked like the rest of Agent Blockhall
   (https://bitmap22.github.io/my-ordinal-portal/block-cube.html): the next block (with what is in it), a fee level, an inscription
   moving, an address sending or getting a transaction, and a kind of transaction turning up in a new block.
   Every alert links on: to Agent Blockhall, the Block Manifest and the Provenance Check.
   The same file runs in the free Agent Blockhall MCP tool and on the portal's Watch page. It only reads and works things out:
   fetching (and how often to look) is left to whoever uses it. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.ChainWatch = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const PORTAL = 'https://bitmap22.github.io/my-ordinal-portal/', GAME = PORTAL + 'block-cube.html';
  const MANIFEST = PORTAL + 'block-manifest.html', PROV = PORTAL + 'provenance-check.html', WATCH = PORTAL + 'watch.html';
  const WHAT = ['block', 'fee', 'inscription', 'address', 'kind'];
  const ADDR = /^(bc1[02-9ac-hj-np-z]{11,87}|BC1[02-9AC-HJ-NP-Z]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
  const isTxid = t => /^[0-9a-f]{64}$/.test(t || '');
  const fmt = n => n == null ? '–' : Number(n).toLocaleString('en-GB');
  const iso = s => s ? new Date(s * 1000).toISOString().replace('.000', '') : null;
  const nowIso = () => new Date().toISOString().replace(/\.\d{3}/, '');
  const MAX_NEW = 6;   // (at most this many new blocks are told about in one look; more are counted)

  /* ---------- what to watch, in plain words ---------- */
  async function normalise(input, io) {
    const w = {what: String(input && input.what || '').trim().toLowerCase()};
    if (!WHAT.includes(w.what)) throw new Error('what to watch: block (the next block), fee (a fee level), inscription, address or kind (a kind of transaction in a new block)');
    const v = input.value == null ? '' : String(input.value).trim();
    if (w.what === 'fee') { const f = Number(v.replace(/sat\/?v?b?$/i, '')); if (!(f > 0 && f < 100000)) throw new Error('give the fee level in sat/vB, e.g. 3'); w.value = f; }
    if (w.what === 'inscription') {
      if (/^[0-9a-f]{64}i\d+$/.test(v.toLowerCase())) w.value = v.toLowerCase();
      else if (/^#?-?\d+$/.test(v.replace(/,/g, '')) && io.resolveIns) w.value = await io.resolveIns(v);
      else throw new Error('give an inscription number (#1000) or its ID');
    }
    if (w.what === 'address') { if (!ADDR.test(v)) throw new Error('give a Bitcoin address'); w.value = v; }
    if (w.what === 'kind') { const k = (io.kindNames || []).find(n => n.toLowerCase() === v.toLowerCase()); if (!k) throw new Error('kinds are: ' + (io.kindNames || []).join(', ')); w.value = k; }
    return w;
  }
  function describe(w) {
    return w.what === 'block' ? 'the next block' : w.what === 'fee' ? 'the next-block fee at or under ' + w.value + ' sat/vB'
      : w.what === 'inscription' ? 'inscription ' + w.value.slice(0, 10) + '…' + w.value.slice(-4) + ' moving' : w.what === 'address' ? 'address ' + w.value.slice(0, 10) + '…' + w.value.slice(-6)
      : 'new blocks with ' + w.value;
  }

  /* ---------- the readings ---------- */
  const tipHeight = async io => +(await io.mpText('/api/blocks/tip/height')).t.trim();
  const hashAt = async (io, h) => (await io.mpText('/api/block-height/' + h)).t.trim();
  async function feeNow(io) {
    // the median fee of the next block to be mined, from two separate sites
    const a = await io.mpJson('/api/v1/fees/mempool-blocks'), A = a.j && a.j[0] ? +a.j[0].medianFee : null;
    let b = null; try { b = await io.mp2Json('/api/v1/fees/mempool-blocks', a.site); } catch (e) {}
    const r = v => v == null || !isFinite(v) ? null : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;   // (0.13, 2.4, 15.2 sat/vB)
    return {fee: r(A), site: a.site, second: b && b.j && b.j[0] ? r(+b.j[0].medianFee) : null, secondSite: b ? b.site : null};
  }
  async function blockFacts(io, h) {
    const hash = await hashAt(io, h);
    const [meta, second] = await Promise.allSettled([io.mpJson('/api/v1/block/' + hash).catch(() => io.mpJson('/api/block/' + hash)), io.ordText('/r/blockhash/' + h)]);
    const m = meta.status === 'fulfilled' ? meta.value.j : {};
    const sh = second.status === 'fulfilled' ? second.value.t.trim().replace(/^"|"$/g, '') : null;
    return {h, hash, site: meta.status === 'fulfilled' ? meta.value.site : null, time: iso(m.timestamp), transactions: m.tx_count != null ? m.tx_count : null, size: m.size != null ? m.size : null,
      minedBy: m.extras && m.extras.pool ? m.extras.pool.name : null, fees: m.extras && m.extras.totalFees != null ? m.extras.totalFees : null,
      checked: {against: second.status === 'fulfilled' ? second.value.site : null, agrees: sh ? sh === hash : null, what: 'the block’s hash on ' + (second.status === 'fulfilled' ? second.value.site : 'a second site') + ' against ' + (meta.status === 'fulfilled' ? meta.value.site : 'the first')}};
  }
  const blockLinks = (h, hash) => ({blockManifest: MANIFEST + '?block=' + h, agentBlockhall: GAME, walkIn: 'In Agent Blockhall: type ' + h + ' into the tablet, or walkIn({height: ' + h + '}) in its agent kit', mempool: 'https://mempool.space/block/' + hash});
  async function outAt(io, satpoint) { const [t, v] = String(satpoint).split(':'); return {txid: t, vout: +v}; }
  async function addrCount(io, a) { const x = (await io.mpJson('/api/address/' + a)).j; return (x.chain_stats ? x.chain_stats.tx_count : 0) + (x.mempool_stats ? x.mempool_stats.tx_count : 0); }

  /* ---------- the first look: where things stand now ---------- */
  async function start(w, io) {
    if (w.what === 'block' || w.what === 'kind') { const tip = await tipHeight(io); return {tip, hash: await hashAt(io, tip)}; }
    if (w.what === 'fee') { const f = await feeNow(io); return {fee: f.fee, under: f.fee != null && f.fee <= w.value}; }
    if (w.what === 'inscription') { const J = (await io.ordJson('/r/inscription/' + w.value)).j; return {satpoint: J.satpoint, holder: J.address || null, spentBy: null}; }
    if (w.what === 'address') return {count: await addrCount(io, w.value)};
  }
  function standing(w, s) {
    if (!s) return null;
    if (w.what === 'block' || w.what === 'kind') return 'the newest block is ' + fmt(s.tip);
    if (w.what === 'fee') return 'the next-block fee is ' + s.fee + ' sat/vB (' + (s.under ? 'at or under' : 'over') + ' your ' + w.value + ')';
    if (w.what === 'inscription') return s.spentBy ? 'it is moving: transaction ' + s.spentBy.slice(0, 12) + '… is ' + (s.confirmed ? 'confirmed' : 'waiting in the mempool') : 'it sits at ' + s.satpoint + (s.holder ? ', held by ' + s.holder : '');
    if (w.what === 'address') return 'it has ' + fmt(s.count) + ' transactions';
  }

  /* ---------- each later look: what changed, as alerts ---------- */
  async function poll(w, s, io) {
    const ev = [], E = (title, extra) => ev.push(Object.assign({watch: describe(w), what: w.what, at: nowIso(), title}, extra));
    if (w.what === 'block' || w.what === 'kind') {
      const tip = await tipHeight(io);
      // a block replaced at the top (two miners found one at once): say so, and carry on from the new top
      if (s.hash && tip >= s.tip) { const hNow = await hashAt(io, s.tip); if (hNow !== s.hash) { E('Block ' + fmt(s.tip) + ' was replaced by another miner’s block', {facts: {height: s.tip, was: s.hash, now: hNow}, links: blockLinks(s.tip, hNow)}); if (tip === s.tip) return {state: {tip, hash: hNow}, events: ev}; } }
      if (tip <= s.tip) return {state: tip < s.tip ? {tip, hash: await hashAt(io, tip)} : s, events: ev};
      const heights = []; for (let h = s.tip + 1; h <= tip; h++) heights.push(h);
      const told = heights.slice(-MAX_NEW), skipped = heights.length - told.length;
      let lastHash = s.hash;
      for (const h of told) {
        const B = await blockFacts(io, h); lastHash = B.hash;
        if (w.what === 'block') {
          E('New block ' + fmt(h) + ' found' + (B.minedBy ? ', mined by ' + B.minedBy : ''), {facts: {height: h, bitmap: h + '.bitmap', hash: B.hash, time: B.time, transactions: B.transactions, size: B.size, fees: B.fees, minedBy: B.minedBy, source: B.site},
            checked: {hash: B.checked}, links: blockLinks(h, B.hash), skippedOlder: skipped || undefined});
        } else if (io.manifest) {
          let M = null; try { M = await io.manifest(h); } catch (e) { E('Block ' + fmt(h) + ' could not be read to look for ' + w.value + ': ' + (e.message || e), {facts: {height: h}, links: blockLinks(h, B.hash)}); continue; }
          const n = M.counts[w.value] || 0;
          if (n) {
            const list = M.items.filter(it => it.kinds.includes(w.value)).slice(0, 20).map(it => {
              const o = {n: it.n, txid: it.txid, fee: it.fee, feeRate: it.feeRate, kinds: it.kinds};
              if (it.inscriptions) o.inscriptions = it.inscriptions.map(x => ({id: x.id, contentType: x.contentType, provenanceCheck: x.id ? PROV + '?id=' + x.id : null}));
              for (const k of ['token', 'rune', 'bitmap', 'message', 'cat21']) if (it[k] != null) o[k] = it[k];
              return o;
            });
            const C = M.checked;
            E(fmt(n) + ' ' + w.value + ' in new block ' + fmt(h), {facts: {height: h, hash: B.hash, time: B.time, count: n, of: M.block.transactions, first: list},
              checked: {hash: B.checked, transactions: {matched: C.transactions.matched, of: C.transactions.of}, kinds: C.kinds, inscriptions: C.inscriptions.agreed != null ? {agreed: C.inscriptions.agreed, of: C.inscriptions.of} : C.inscriptions},
              links: blockLinks(h, B.hash), skippedOlder: skipped || undefined});
          }
        }
      }
      return {state: {tip, hash: lastHash}, events: ev};
    }
    if (w.what === 'fee') {
      const f = await feeNow(io); if (f.fee == null) return {state: s, events: ev};
      const under = f.fee <= w.value, both = f.second != null ? (f.second <= w.value) === under : null;
      if (under !== s.under) E(under ? 'Fees are down: the next block’s fee is ' + f.fee + ' sat/vB (your level: ' + w.value + ')' : 'Fees went back up: ' + f.fee + ' sat/vB, over your ' + w.value,
        {facts: {fee: f.fee, level: w.value, under, source: f.site, secondSite: f.secondSite, secondFee: f.second},
          checked: {fee: {against: f.secondSite, agrees: both, what: 'the next block’s median fee on ' + (f.secondSite || 'a second site') + ' says the same: ' + (f.second != null ? f.second + ' sat/vB' : 'no answer')}},
          links: {feeAdvice: GAME + ' (the big screen in its common room, or feeAdvice() in the MCP tool): the usual wait and whether now is a cheap time', mempool: 'https://mempool.space'}});
      return {state: {fee: f.fee, under}, events: ev};
    }
    if (w.what === 'inscription') {
      const o = await outAt(io, s.satpoint), sp = (await io.mpJson('/api/tx/' + o.txid + '/outspend/' + o.vout)).j;
      const links = {provenanceCheck: PROV + '?id=' + w.value, agentBlockhall: GAME + ' (hold its parcel, then FOLLOW IT BACK)'};
      if (sp.spent && sp.txid && sp.txid !== s.spentBy) {
        const conf = !!(sp.status && sp.status.confirmed);
        E('Inscription is moving: the place it sat (' + o.txid.slice(0, 10) + '…:' + o.vout + ') has been spent', {facts: {inscription: w.value, spentBy: sp.txid, confirmed: conf, block: conf ? sp.status.block_height : null},
          checked: {spends: {against: null, agrees: true, what: 'the transaction spends the exact output the inscription sat in (' + o.txid + ':' + o.vout + ')'}}, links: Object.assign({mempool: 'https://mempool.space/tx/' + sp.txid}, links)});
        s = Object.assign({}, s, {spentBy: sp.txid, confirmed: conf});
      }
      if (s.spentBy) {
        // once the move is in a block, ordinals.com shows where it sits now
        const J = (await io.ordJson('/r/inscription/' + w.value)).j;
        if (J.satpoint !== s.satpoint) {
          const nt = String(J.satpoint).split(':')[0];
          E('Inscription moved' + (J.address ? ' to ' + J.address.slice(0, 10) + '…' + J.address.slice(-6) : ''), {facts: {inscription: w.value, from: s.satpoint, now: J.satpoint, holder: J.address || null},
            checked: {move: {against: 'https://ordinals.com', agrees: nt === s.spentBy ? true : null, what: nt === s.spentBy ? 'ordinals.com puts it in the very transaction that spent where it sat' : 'it moved on again since: the Provenance Check follows every step'}},
            links: Object.assign({mempool: 'https://mempool.space/tx/' + nt}, links)});
          return {state: {satpoint: J.satpoint, holder: J.address || null, spentBy: null}, events: ev};
        }
        if (!sp.spent) s = Object.assign({}, s, {spentBy: null, confirmed: false});   // (the spend left the mempool without going in a block)
        else s = Object.assign({}, s, {confirmed: !!(sp.status && sp.status.confirmed)});
      }
      return {state: s, events: ev};
    }
    if (w.what === 'address') {
      const n = await addrCount(io, w.value);
      if (n > s.count) {
        const txs = (await io.mpJson('/api/address/' + w.value + '/txs')).j.slice(0, Math.min(10, n - s.count));
        for (const t of txs) {
          let net = 0; for (const o of t.vout || []) if (o.scriptpubkey_address === w.value) net += o.value; for (const i of t.vin || []) if (i.prevout && i.prevout.scriptpubkey_address === w.value) net -= i.prevout.value;
          const conf = !!(t.status && t.status.confirmed);
          E((net >= 0 ? 'Address got ' : 'Address sent ') + fmt(Math.abs(net)) + ' sats' + (conf ? ' in block ' + fmt(t.status.block_height) : ' (waiting in the mempool)'),
            {facts: {address: w.value, txid: t.txid, sats: net, confirmed: conf, block: conf ? t.status.block_height : null},
              links: {mempool: 'https://mempool.space/tx/' + t.txid, blockManifest: conf ? MANIFEST + '?block=' + t.status.block_height : null, agentBlockhall: GAME + ' (its tablet finds addresses too)'}});
        }
      }
      return {state: {count: n}, events: ev};
    }
    return {state: s, events: ev};
  }

  /* ---------- a watch carried between looks as one short token (for agents with no memory between calls) ---------- */
  const b64e = t => typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(t))) : Buffer.from(t, 'utf8').toString('base64');
  const b64d = t => typeof atob === 'function' ? decodeURIComponent(escape(atob(t))) : Buffer.from(t, 'base64').toString('utf8');
  const pack = (w, s) => b64e(JSON.stringify({v: 1, w, s})).replace(/=+$/, '');
  function unpack(t) { try { const o = JSON.parse(b64d(String(t))); if (o && o.v === 1 && o.w && WHAT.includes(o.w.what)) return o; } catch (e) {} throw new Error('that since token could not be read: start the watch again without it'); }

  return {VERSION, WHAT, normalise, describe, start, standing, poll, pack, unpack, links: {GAME, MANIFEST, PROV, WATCH}};
});
