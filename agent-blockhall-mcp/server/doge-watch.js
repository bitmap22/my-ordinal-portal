/* Doge Cube's Watch, by bitmap22. Always free. The Dogecoin twin of Agent Blockhall's Watch (watch.js).
   Keeps an eye on Dogecoin and says the moment something happens, each alert checked: the next block (its hash worked out from its
   own header and asked of a second site), a Doginal moving (seen on a second site as soon as the coin it sits on is spent, even
   while that is still waiting to be mined, then confirmed by the explorer), an address getting or sending DOGE (two sites), and a
   kind of transaction turning up in a new block (read the Doge Block Manifest way). There is no fee watch: Dogecoin's fees barely
   move. Every alert links on: to Doge Cube, the Doge Block Manifest and the Doge Provenance Check.
   The same file is for the portal's Doge Watch page and the free Agent Blockhall MCP tool. It only reads and works things out:
   fetching (and how often to look) is left to whoever uses it. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.DogeWatch = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const PORTAL = 'https://bitmap22.github.io/my-ordinal-portal/', GAME = PORTAL + 'doge-cube.html';
  const MANIFEST = PORTAL + 'doge-block-manifest.html', PROV = PORTAL + 'doge-provenance-check.html', WATCH = PORTAL + 'doge-watch.html';
  const WHAT = ['block', 'inscription', 'address', 'kind'];
  const ADDR = /^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/;
  const fmt = n => n == null ? '–' : Number(n).toLocaleString('en-GB');
  const doge = k => (k / 1e8).toLocaleString('en-GB', {maximumFractionDigits: 8});
  const iso = s => s ? new Date(s * 1000).toISOString().replace('.000', '') : null;
  const nowIso = () => new Date().toISOString().replace(/\.\d{3}/, '');
  const MAX_NEW = 6;   // (at most this many new blocks are told about in one look; more are counted)
  const txLink = t => 'https://blockchair.com/dogecoin/transaction/' + t;

  /* ---------- what to watch, in plain words ---------- */
  async function normalise(input, io) {
    const w = {what: String(input && input.what || '').trim().toLowerCase()};
    if (w.what === 'fee') throw new Error('there is no fee watch for Dogecoin: its fees barely move. Watch a block, an inscription, an address or a kind');
    if (!WHAT.includes(w.what)) throw new Error('what to watch: block (the next block), inscription (a Doginal moving), address or kind (a kind of transaction in a new block)');
    const v = input.value == null ? '' : String(input.value).trim();
    if (w.what === 'inscription') {
      if (/^[0-9a-f]{64}i\d+$/.test(v.toLowerCase())) w.value = v.toLowerCase();
      else if (/^#?\d+$/.test(v.replace(/,/g, '')) && io.resolveIns) w.value = await io.resolveIns(v);
      else throw new Error('give a Doginal\'s number (#1000) or its ID');
    }
    if (w.what === 'address') { if (!ADDR.test(v)) throw new Error('give a Dogecoin address (it starts with D, A or 9)'); w.value = v; }
    if (w.what === 'kind') { const k = (io.kindNames || []).find(n => n.toLowerCase() === v.toLowerCase()); if (!k) throw new Error('kinds are: ' + (io.kindNames || []).join(', ')); w.value = k; }
    return w;
  }
  function describe(w) {
    return w.what === 'block' ? 'the next block' : w.what === 'inscription' ? 'Doginal ' + w.value.slice(0, 10) + '…' + w.value.slice(-4) + ' moving'
      : w.what === 'address' ? 'address ' + w.value.slice(0, 10) + '…' + w.value.slice(-6) : 'new blocks with ' + w.value;
  }

  /* ---------- the readings ---------- */
  const tipHeight = async io => { const j = await io.dx('/v1/blocks?limit=1'); return j.blocks && j.blocks[0] ? +j.blocks[0].height : NaN; };
  async function blockFacts(io, h) {
    const [B, S] = await Promise.allSettled([io.dx('/v1/block/' + h + '?limit=1'), io.btc('/block/' + h)]);
    const b = B.status === 'fulfilled' ? B.value : {}, s = S.status === 'fulfilled' ? S.value : null;
    let own = null; try { own = io.headerHash ? io.headerHash(b) : null; } catch (e) {}
    const ok = own != null && own === b.hash && !!s && s.hash === b.hash;
    return {h, hash: b.hash || (s && s.hash) || null, time: iso(b.time), transactions: b.total != null ? b.total : null, size: b.size != null ? b.size : null, mergeMined: b.version != null ? ((+b.version) & 0x100) !== 0 : null,
      checked: {against: s ? 'https://api.bitcore.io' : null, agrees: own == null || !s ? null : ok, what: 'its hash worked out from its own header (' + (own === b.hash ? 'matches' : own ? 'does not match' : 'not worked out') + ') and on bitcore.io (' + (s ? s.hash === b.hash ? 'the same' : 'different' : 'no answer') + ')'}};
  }
  const blockLinks = h => ({dogeBlockManifest: MANIFEST + '?block=' + h, dogeCube: GAME, walkIn: 'In Doge Cube: type ' + h + ' into the tablet, or walkIn({height: ' + h + '}) in its agent kit', blockchair: 'https://blockchair.com/dogecoin/block/' + h});
  // an address's coins on the second site (Bitcore): each coin it got, and whether it has been spent
  async function coinsOf(io, a) {
    const L = await io.btc('/address/' + a + '/txs?limit=200');
    const m = {}; for (const c of Array.isArray(L) ? L : []) m[c.mintTxid + ':' + c.mintIndex] = {v: c.value, h: c.mintHeight, sp: c.spentTxid || '', sh: c.spentHeight};
    return m;
  }
  const balanceOf = async (io, a) => { const b = await io.btc('/address/' + a + '/balance'); return (b.confirmed || 0) + ':' + (b.unconfirmed || 0); };

  /* ---------- the first look: where things stand now ---------- */
  async function start(w, io) {
    if (w.what === 'block' || w.what === 'kind') { const tip = await tipHeight(io); const B = await blockFacts(io, tip); return {tip, hash: B.hash}; }
    if (w.what === 'inscription') { const J = await io.dx('/v1/inscription/' + w.value); return {satpoint: J.satpoint, holder: J.address || null, spentBy: null}; }
    if (w.what === 'address') return {bal: await balanceOf(io, w.value), coins: await coinsOf(io, w.value)};
  }
  function standing(w, s) {
    if (!s) return null;
    if (w.what === 'block' || w.what === 'kind') return 'the newest block is ' + fmt(s.tip);
    if (w.what === 'inscription') return s.spentBy ? 'it is moving: transaction ' + s.spentBy.slice(0, 12) + '… is ' + (s.confirmed ? 'in a block' : 'waiting to be mined') : 'it sits at ' + s.satpoint + (s.holder ? ', held by ' + s.holder : '');
    if (w.what === 'address') { const [c, u] = String(s.bal).split(':').map(Number); return 'it holds ' + doge(c) + ' DOGE' + (u ? ' (' + (u > 0 ? '+' : '') + doge(u) + ' DOGE waiting to be mined)' : ''); }
  }

  /* ---------- each later look: what changed, as alerts ---------- */
  async function poll(w, s, io) {
    const ev = [], E = (title, extra) => ev.push(Object.assign({watch: describe(w), what: w.what, at: nowIso(), title}, extra));
    if (w.what === 'block' || w.what === 'kind') {
      const tip = await tipHeight(io);
      // a block replaced at the top (two miners found one at once): say so, and carry on from the new top
      if (s.hash && tip >= s.tip) { const B0 = await blockFacts(io, s.tip); if (B0.hash && B0.hash !== s.hash) { E('Block ' + fmt(s.tip) + ' was replaced by another miner’s block', {facts: {height: s.tip, was: s.hash, now: B0.hash}, checked: {hash: B0.checked}, links: blockLinks(s.tip)}); if (tip === s.tip) return {state: {tip, hash: B0.hash}, events: ev}; } }
      if (!(tip > s.tip)) return {state: s, events: ev};
      const heights = []; for (let h = s.tip + 1; h <= tip; h++) heights.push(h);
      const told = heights.slice(-MAX_NEW), skipped = heights.length - told.length;
      let lastHash = s.hash;
      for (const h of told) {
        const B = await blockFacts(io, h); lastHash = B.hash;
        if (w.what === 'block') {
          E('New block ' + fmt(h) + ' found', {facts: {height: h, dogemap: h + '.dogemap', hash: B.hash, time: B.time, transactions: B.transactions, size: B.size, mergeMined: B.mergeMined, source: 'https://thedoginalsexplorer.com'},
            checked: {hash: B.checked}, links: blockLinks(h), skippedOlder: skipped || undefined});
        } else if (io.manifest) {
          let M = null; try { M = await io.manifest(h); } catch (e) { E('Block ' + fmt(h) + ' could not be read to look for ' + w.value + ': ' + (e.message || e), {facts: {height: h}, links: blockLinks(h)}); continue; }
          const n = M.counts[w.value] || 0;
          if (n) {
            const list = M.items.filter(it => it.kinds.includes(w.value)).slice(0, 20).map(it => {
              const o = {n: it.n, txid: it.txid, fee: it.fee, feeRate: it.feeRate, kinds: it.kinds};
              if (it.inscriptions) o.inscriptions = it.inscriptions.map(x => ({id: x.id, contentType: x.contentType, provenanceCheck: x.id ? PROV + '?id=' + x.id : null}));
              for (const k of ['token', 'dune', 'dogemap', 'name', 'message']) if (it[k] != null) o[k] = it[k];
              return o;
            });
            const C = M.checked;
            E(fmt(n) + ' ' + w.value + ' in new block ' + fmt(h), {facts: {height: h, hash: B.hash, time: B.time, count: n, of: M.block.transactions, first: list},
              checked: {hash: B.checked, transactionList: {provedByMerkleRoot: C.transactionList.provedByMerkleRoot}, kinds: {agreed: C.kinds.agreed, of: C.kinds.of}, inscriptions: {agreed: C.inscriptions.agreed, of: C.inscriptions.of}},
              links: blockLinks(h), skippedOlder: skipped || undefined});
          }
        }
      }
      return {state: {tip, hash: lastHash}, events: ev};
    }
    if (w.what === 'inscription') {
      const [t, v] = String(s.satpoint).split(':'), links = {dogeProvenanceCheck: PROV + '?id=' + w.value, dogeCube: GAME + (/^[0-9a-f]{64}i\d+$/.test(String(w.value)) ? '#find=' + w.value + ' (walks in with it found: hold its parcel, then FOLLOW IT BACK)' : ' (hold its parcel, then FOLLOW IT BACK)')};
      const C = await io.btc('/tx/' + t + '/coins'), out = (C.outputs || []).find(c => c.mintIndex === +v);
      if (out && out.spentTxid && out.spentTxid !== s.spentBy) {
        const conf = out.spentHeight > 0;
        // the explorer too: the spending transaction takes that exact coin
        let ok = null; try { const x = await io.dx('/v1/tx/' + out.spentTxid); ok = (x.inputs || []).some(i => i.txid === t && i.vout === +v); } catch (e) {}
        E('Doginal is moving: the coin it sat on (' + t.slice(0, 10) + '…:' + v + ') has been spent', {facts: {inscription: w.value, spentBy: out.spentTxid, inABlock: conf, block: conf ? out.spentHeight : null},
          checked: {spends: {against: 'https://thedoginalsexplorer.com', agrees: ok, what: 'bitcore.io sees the spend; the explorer\'s copy of that transaction ' + (ok ? 'takes that exact coin' : ok === false ? 'does not take that coin' : 'was not found yet')}}, links: Object.assign({blockchair: txLink(out.spentTxid)}, links)});
        s = Object.assign({}, s, {spentBy: out.spentTxid, confirmed: conf});
      }
      if (s.spentBy) {
        // once the move is in a block, the explorer shows where it sits now
        const J = await io.dx('/v1/inscription/' + w.value);
        if (J.satpoint && J.satpoint !== s.satpoint) {
          const nt = String(J.satpoint).split(':')[0];
          E('Doginal moved' + (J.address ? ' to ' + J.address.slice(0, 10) + '…' + J.address.slice(-6) : ''), {facts: {inscription: w.value, from: s.satpoint, now: J.satpoint, holder: J.address || null},
            checked: {move: {against: 'https://api.bitcore.io', agrees: nt === s.spentBy ? true : null, what: nt === s.spentBy ? 'the explorer puts it in the very transaction bitcore.io saw spend where it sat' : 'it moved on again since: the Doge Provenance Check follows every step'}},
            links: Object.assign({blockchair: txLink(nt)}, links)});
          return {state: {satpoint: J.satpoint, holder: J.address || null, spentBy: null}, events: ev};
        }
        if (out && !out.spentTxid) s = Object.assign({}, s, {spentBy: null, confirmed: false});   // (the spend left the waiting list without going in a block)
        else if (out) s = Object.assign({}, s, {confirmed: out.spentHeight > 0});
      }
      return {state: s, events: ev};
    }
    if (w.what === 'address') {
      const bal = await balanceOf(io, w.value);
      if (bal === s.bal) return {state: s, events: ev};
      const now = await coinsOf(io, w.value), byTx = new Map();
      const add = (txid, d, h) => { const o = byTx.get(txid) || {got: 0, sent: 0, h}; if (d > 0) o.got += d; else o.sent -= d; if (h != null) o.h = h; byTx.set(txid, o); };
      for (const [k, c] of Object.entries(now)) {
        const was = s.coins[k];
        if (!was) add(k.split(':')[0], c.v, c.h);
        if (c.sp && (!was || !was.sp)) add(c.sp, -c.v, c.sh);
      }
      for (const [txid, o] of [...byTx].slice(0, 10)) {
        const net = o.got - o.sent, conf = o.h > 0;
        let ok = null; try { const x = await io.dx('/v1/tx/' + txid); ok = (x.outputs || []).some(q => q.address === w.value) || (x.inputs || []).some(q => q.address === w.value); } catch (e) {}
        E((net >= 0 ? 'Address got ' : 'Address sent ') + doge(Math.abs(net)) + ' DOGE' + (conf ? ' in block ' + fmt(o.h) : ' (waiting to be mined)'),
          {facts: {address: w.value, txid, koinu: net, inABlock: conf, block: conf ? o.h : null},
            checked: {address: {against: 'https://thedoginalsexplorer.com', agrees: ok, what: 'bitcore.io sees the coins; the explorer\'s copy of the transaction ' + (ok ? 'pays to or from this address too' : ok === false ? 'does not show this address' : 'was not found yet')}},
            links: {blockchair: txLink(txid), dogeBlockManifest: conf ? MANIFEST + '?block=' + o.h : null, dogeCube: GAME + ' (its tablet finds addresses too)'}});
      }
      return {state: {bal, coins: now}, events: ev};
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
