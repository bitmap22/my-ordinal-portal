/* Highlights, by bitmap22. Always free.
   One real fact for each tool on the Ord Portal's front page, made each day by GitHub. Every fact comes from the tool's own
   code (the free Agent Blockhall MCP tool's, the same readers the pages use), run on yesterday's real blocks or on a real
   example from them, or read from the tool's own saved data. Each fact says when it was found and links to the tool, so
   anyone can check it there. A fact that can't be found today keeps its last one, with that one's own date: nothing is
   ever made up. Two tools (the Ordinal View Tester and the Sentinel ID Viewer) only check files you give them, so their
   line says what they check instead.
   Usage: node build-highlights.js <folder with the last highlights.json, written back there>
   © 2026 bitmap22. All rights reserved. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const M = require(path.join(ROOT, 'agent-blockhall-mcp', 'server', 'index.js'));
const BD = require(path.join(ROOT, '.github', 'daily-data', 'build-day.js'));
const T = Object.fromEntries(M.TOOLS.map(t => [t.name, t.run]));
const VERSION = '1.0.0', PORTAL = 'https://ordportal.com/';
const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE). Bitcoin\'s data is public and is not part of it.';

const n0 = n => Number(n).toLocaleString('en-GB');
const pc = v => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + '%';
const btc = s => (s / 1e8).toFixed(3) + ' BTC';
const dayWords = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {day: 'numeric', month: 'long', timeZone: 'UTC'});
const hhmm = t => new Date(t).toISOString().slice(11, 16) + ' UTC';
const mins = ms => { const m = Math.round(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
const q = encodeURIComponent;

async function main() {
  const dir = process.argv[2] || 'out', file = path.join(dir, 'highlights.json');
  fs.mkdirSync(dir, {recursive: true});
  let old = {facts: {}}; try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  const now = new Date(), D = new Date(now.getTime() - 864e5).toISOString().slice(0, 10), Dw = dayWords(D);
  const facts = {}, log = [];
  // one fact: f() returns {text, link, period} or throws; a failure keeps the last fact (with its own date)
  async function fact(page, name, f) {
    const t0 = Date.now();
    try {
      const r = await f();
      facts[page] = Object.assign({tool: name, page: PORTAL + page, found: now.toISOString().replace(/\.\d{3}/, '')}, r);
      log.push('ok   ' + page + ' (' + (Date.now() - t0) + ' ms): ' + r.text);
    } catch (e) {
      if (old.facts && old.facts[page]) { facts[page] = Object.assign({}, old.facts[page], {kept: true}); log.push('kept ' + page + ': ' + e.message); }
      else log.push('none ' + page + ': ' + e.message);
    }
  }
  const btcDay = await T.dailyData({day: D}).catch(e => { log.push('no Daily Data for ' + D + ': ' + e.message); return null; });
  const need = (x, what) => { if (!x) throw new Error(what + ' for ' + D + ' is not saved yet'); return x; };
  const blocksOf = x => (x.blocks || []).slice().sort((a, b) => a.height - b.height);
  const maxBy = (list, f) => list.reduce((a, b) => (f(b) > f(a) ? b : a), list[0]);
  const items = r => (r && r.items && r.items.list) || [];
  const insOf = it => it && (it.inscriptions && it.inscriptions[0] && (it.inscriptions[0].id || it.inscriptions[0])) || (it && it.txid + 'i0');
  // a real example from yesterday's blocks: the first item of this kind, looking through the blocks that have it
  async function example(kind, tries) {
    const hs = blocksOf(need(btcDay, 'Daily Data')).filter(b => b.counts && b.counts[kind] > 0).map(b => b.height);
    for (const h of hs.slice(0, tries || 3)) { const r = await T.blockManifest({height: h, kind, limit: 5}); const l = items(r); if (l.length) return {height: h, list: l}; }
    throw new Error('no ' + kind + ' in yesterday\'s blocks');
  }

  /* ---------- the halls ---------- */
  await fact('block-cube.html', 'Agent Blockhall', async () => {
    const b = maxBy(blocksOf(need(btcDay, 'Daily Data')), x => x.transactions);
    return {text: 'Yesterday\'s busiest Bitcoin block was ' + n0(b.height) + ': ' + n0(b.transactions) + ' transactions, each one a parcel on its shelves' + (b.minedBy ? ' (mined by ' + b.minedBy + ')' : '') + '.',
      link: PORTAL + 'block-cube.html#block=' + b.height, linkText: 'Walk into block ' + n0(b.height), period: D};
  });

  /* ---------- reading blocks ---------- */
  await fact('block-manifest.html', 'Block Manifest', async () => {
    // (23 Nov 2026: says only what was checked: a fee proven against the coinbase is said so; the words never claim more than the data)
    const b = maxBy(blocksOf(need(btcDay, 'Daily Data')).filter(x => x.totalFees != null), x => x.totalFees);
    return {text: 'Block ' + n0(b.height) + ' paid its miner the most fees yesterday: ' + btc(b.totalFees) + ' from ' + n0(b.transactions) + ' transactions' + (b.checked && b.checked.feesAgainstCoinbase === true ? ', its fees checked against what its coinbase pays out.' : '.'),
      link: PORTAL + 'block-manifest.html?block=' + b.height, linkText: 'See every transaction', period: D};
  });
  await fact('daily.html', 'Daily Data', async () => {
    const t = need(btcDay, 'Daily Data').totals, K = t.checked || {}, whole = !K.notRead && !K.feesMissing;
    return {text: 'On ' + Dw + ': ' + n0(t.blocks) + ' Bitcoin blocks, ' + n0(t.transactions) + ' transactions, ' + btc(t.totalFees) + ' in fees' + (K.feesMissing ? ' (' + n0(K.feesMissing) + ' block' + (K.feesMissing === 1 ? '' : 's') + ' with no fee figure left out)' : '') + ' and ' + n0((t.counts || {}).inscriptions || 0) + ' inscriptions' + (whole ? ', every block read.' : K.notRead ? ' (' + n0(K.notRead) + ' block' + (K.notRead === 1 ? '' : 's') + ' could not be read).' : '.'),
      link: PORTAL + 'daily.html?day=' + D, linkText: 'See every block of the day', period: D};
  });
  await fact('blockspace-share.html', 'Blockspace Share', async () => {
    const r = await T.blockspaceShare({period: 'day', at: D});
    if (!r.feesWhole) throw new Error('the fees of ' + D + ' are not all saved');
    const k = maxBy(r.kinds.filter(x => x.shareOfFees != null), x => x.shareOfAll - x.shareOfFees);
    return {text: 'On ' + Dw + ', ' + k.kind + ' used ' + pc(k.shareOfAll) + ' of Bitcoin\'s block space but paid only ' + pc(k.shareOfFees) + ' of the fees.',
      link: PORTAL + 'blockspace-share.html?by=day&at=' + D + '&show=fees', linkText: 'See who used the space and who paid', period: D};
  });
  await fact('track.html', 'Track', async () => {
    const bs = blocksOf(need(btcDay, 'Daily Data')); let gap = 0, at = null;
    for (let i = 1; i < bs.length; i++) { const g = Date.parse(bs[i].time) - Date.parse(bs[i - 1].time); if (g > gap) { gap = g; at = bs[i]; } }
    if (!at) throw new Error('too few blocks');
    return {text: 'The longest wait for a Bitcoin block on ' + Dw + ' was ' + mins(gap) + ', before block ' + n0(at.height) + ' (by the times written in the blocks). Track tells you the moment the next one comes.',
      link: PORTAL + 'track.html', linkText: 'Track the next block', period: D};
  });
  await fact('stuck-transaction.html', 'Stuck Transaction Doctor', async () => {
    const r = await T.stuckTx({}), f = r.facts || {}, aim = ((r.fees || {}).aims || [])[0], sc = (r.fees || {}).keepsScoreOfItself;
    if (f.nextBlockTakesNow == null) throw new Error('no next-block fee');
    return {text: 'At ' + hhmm(r.checked) + ', the next block was taking fees from ' + f.nextBlockTakesNow + ' sat/vB' + (aim && sc ? ', and ' + aim.feeRate + ' sat/vB got into the next block ' + sc.right + ' times out of the last ' + sc.of : '') + '.',
      link: PORTAL + 'stuck-transaction.html', linkText: 'Check a transaction', period: r.checked};
  });
  await fact('inscription-cost-calculator.html', 'Inscription Cost Calculator', async () => {
    const fees = (await BD.mpJson('/api/v1/fees/recommended', 20000)).j, prices = (await BD.mpJson('/api/v1/prices', 20000)).j;
    const rate = fees.halfHourFee; if (!(rate > 0)) throw new Error('no live fee');
    // the calculator's own sum, with its own settings: 102,400 bytes, 200 vB extra, 330 sats postage
    const b = 102400, vb = Math.ceil(b / 4) + Math.ceil(Math.ceil(b / 520) * 3 / 4) + 200, sats = Math.ceil(vb * rate - 1e-9) + 330;
    // (24 Nov 2026) the dollar figure only when a second, separate source agrees within 1% (CoinGecko: Powered by CoinGecko)
    let second = null; for (const [u, f] of [['https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', j => +j.bitcoin.usd]]) { try { const r = await fetch(u, {signal: AbortSignal.timeout(15000)}); if (r.ok) { second = f(await r.json()); if (second > 0) break; } } catch (e) {} }
    const usd = prices.USD && second > 0 && Math.abs(second - prices.USD) / prices.USD <= 0.01 ? sats / 1e8 * prices.USD : null;
    return {text: 'At ' + hhmm(now) + ', a 100 KB inscription cost about ' + n0(sats) + ' sats' + (usd != null ? ' ($' + usd.toFixed(2) + ')' : '') + ', at the live "within half an hour" fee of ' + rate + ' sat/vB.',
      link: PORTAL + 'inscription-cost-calculator.html', linkText: 'Work out your own file', period: now.toISOString().replace(/\.\d{3}/, '')};
  });

  /* ---------- checking an inscription (each on a real example from yesterday's blocks) ---------- */
  let html = null;
  await fact('provenance-check.html', 'Provenance Check', async () => {
    html = html || await example('HTML');
    const id = insOf(html.list[0]), r = await T.provenanceCheck({id}), i = r.inscription || {};
    return {text: 'Inscription #' + n0(i.number) + ' (' + i.contentType + ', made in block ' + n0(i.block) + ' on ' + dayWords(String(i.time).slice(0, 10)) + '): ' + r.verdict + ', from the chain\'s own bytes.',
      link: PORTAL + 'provenance-check.html?id=' + id, linkText: 'See every check', period: D};
  });
  await fact('code-read.html', 'Code Read', async () => {
    html = html || await example('HTML');
    const id = insOf(html.list[0]), r = await T.codeRead({id}), found = (r.kinds || []).filter(k => k.found).map(k => k.name.toLowerCase());
    return {text: 'Inscription #' + n0(r.number) + ', a web page made yesterday, read without running it: ' + (found.length ? 'it ' + found.join(', ') + '.' : 'it asks no wallet for anything, loads nothing from outside the chain and sends nothing out.'),
      link: PORTAL + 'code-read.html?id=' + id, linkText: 'See what it asks for', period: D};
  });
  await fact('recursion-map.html', 'Recursion Map', async () => {
    // yesterday's web pages, from up to 6 blocks: the first that loads other inscriptions (else the last one read, as it is)
    const hs = blocksOf(need(btcDay, 'Daily Data')).filter(b => b.counts && b.counts.HTML > 0).map(b => b.height).slice(0, 6);
    let best = null, tried = 0;
    for (const h of hs) {
      for (const it of items(await T.blockManifest({height: h, kind: 'HTML', limit: 3}))) {
        const id = insOf(it), r = await T.recursionMap({id}); tried++;
        if (!best || ((r.counts || {}).inscriptions || 0) > ((best.r.counts || {}).inscriptions || 0)) best = {id, r};
        if (((best.r.counts || {}).inscriptions || 0) > 0 || tried >= 10) break;
      }
      if (best && (((best.r.counts || {}).inscriptions || 0) > 0 || tried >= 10)) break;
    }
    if (!best) throw new Error('no web page inscription yesterday');
    const r = best.r, c = r.counts || {};
    return {text: 'Inscription #' + n0((r.root || {}).number) + ', made yesterday: ' + (c.inscriptions ? 'it loads ' + n0(c.inscriptions) + ' other inscription' + (c.inscriptions === 1 ? '' : 's') + (r.allOnChain ? ', all found on the chain' : '') + '.' : r.verdict + '.'),
      link: PORTAL + 'recursion-map.html?id=' + best.id, linkText: 'See the map', period: D};
  });
  let kid = null;
  async function child() {
    if (kid) return kid;
    const ex = await example('children', 4);
    for (const it of ex.list) { const id = insOf(it), ci = await T.inscription({id}), p = ci && ci.parents && ci.parents[0]; if (p) return (kid = {id, number: ci.number, parent: p.id || p}); }
    throw new Error('no child with a parent found');
  }
  await fact('trade-check.html', 'Authenticity Check', async () => {
    const c = await child(), r = await T.authenticityCheck({id: c.id, collection: c.parent});
    const said = String(r.words || r.verdict).split(' (checked:')[0].replace(/\s+$/, '');   // (its first plain sentence; every reason is on the page)
    return {text: 'Authenticity Check on inscription #' + n0(c.number) + ', made yesterday in the collection it names: ' + said + (/[.!?]$/.test(said) ? '' : '.'),
      link: PORTAL + 'trade-check.html?id=' + c.id + '&collection=' + c.parent, linkText: 'See every reason', period: D};
  });
  await fact('collection-check.html', 'Collection Check', async () => {
    const c = await child(), r = await T.collectionCheck({parent: c.parent, limit: 5}), p = r.parent || {};
    return {text: 'The collection under inscription #' + n0(p.number) + ' (it grew yesterday): ' + r.verdict + ', each one proven from the chain.',
      link: PORTAL + 'collection-check.html?parent=' + c.parent, linkText: 'See the proof', period: D};
  });
  await fact('rune-proof.html', 'Rune Proof', async () => {
    const ex = await example('runes etched', 6);
    for (const it of ex.list) {
      const r = await T.runeProof({rune: it.txid}), rn = r.rune || {};
      if (!rn.name) continue;
      return {text: 'The rune ' + rn.name + (r.etching && r.etching.symbol ? ' ' + r.etching.symbol : '') + ' was etched in block ' + n0(rn.block) + ' on ' + dayWords(String(rn.time).slice(0, 10)) + ': ' + (r.answer === 'proven' ? 'proven from its own bytes, with ord\'s own rules.' : String(r.verdict || r.answer) + '.'),
        link: PORTAL + 'rune-proof.html?rune=' + q(rn.id || it.txid), linkText: 'See the proof', period: D};
    }
    throw new Error('no rune made yesterday could be proven');
  });
  await fact('second-opinion.html', 'Second Opinion', async () => {
    const b = maxBy(blocksOf(need(btcDay, 'Daily Data')).filter(x => x.minedBy), x => x.transactions);
    const claim = 'block ' + b.height + ' was mined by ' + b.minedBy, r = await T.secondOpinion({claim});
    return {text: '"Block ' + n0(b.height) + ' was mined by ' + b.minedBy + '": ' + r.verdict + '.', link: PORTAL + 'second-opinion.html?claim=' + q(claim), linkText: 'Check a claim of your own', period: D};
  });
  await fact('earned-traits.html', 'Earned Traits', async () => {
    const bs = blocksOf(need(btcDay, 'Daily Data')).filter(x => x.counts && x.counts.bitmaps > 0);
    for (const b of bs.slice(0, 6)) {
      let r; try { r = await T.earnedTraits({bitmap: String(b.height)}); } catch (e) { continue; }
      const t = (r.traits || [])[0]; if (!t) continue;
      return {text: r.bitmap + ' (a block from ' + Dw + ') has earned "' + t.trait + '": ' + t.why + '.', link: PORTAL + 'earned-traits.html?bitmap=' + b.height, linkText: 'See its proof', period: D};
    }
    throw new Error('no bitmap of yesterday has a trait yet');
  });

  /* ---------- the data sites ---------- */
  await fact('truth-league.html', 'Truth League', async () => {
    const r = await T.truthLeague({days: 7}); let right = 0, wrong = 0;
    for (const ch of Object.values(r.league || {})) for (const s of ch) { right += s.right || 0; wrong += s.wrong || 0; }
    return {text: 'In the last 7 days the data sites gave ' + n0(right) + ' right answer' + (right === 1 ? '' : 's') + ' and ' + n0(wrong) + ' wrong, checked against ' + n0((r.record || {}).checks || 0) + ' blocks proved from their own bytes.',
      link: PORTAL + 'truth-league.html', linkText: 'See which sites tell the truth', period: (r.record || {}).lastCheck};
  });
  await fact('source-health.html', 'Source Health', async () => {
    const j = JSON.parse(await (await fetch('https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/source-health/latest.json?t=' + Date.now())).text());
    const ok = (j.results || []).filter(x => x.state === 'answers'), fast = maxBy(ok, x => -x.ms);
    return {text: 'At ' + hhmm(j.at) + ', ' + j.counts.answers + ' of the ' + j.counts.asked + ' free data sites were answering' + (fast ? '; the fastest was ' + fast.site + ' (' + n0(fast.ms) + ' ms)' : '') + '.',
      link: PORTAL + 'source-health.html', linkText: 'See every site', period: j.at};
  });
  for (const [page, chain, name] of [['safety-scan.html', 'bitcoin', 'Safety Scan']]) {
    await fact(page, name, async () => {
      const r = await T.safetyScan({chain}), key = Object.fromEntries((r.key || []).map(k => [k.mark, k.name.toLowerCase()]));
      const ins = (r.blocks || []).reduce((n, b) => n + (b.inscriptions || 0), 0), marks = Object.entries(r.totals || {}).filter(([, v]) => v > 0);
      return {text: 'In the last ' + n0(r.scanned) + ' ' + r.chain + ' blocks, ' + n0(ins) + ' inscriptions were read without running them: ' + (marks.length ? marks.map(([k, v]) => n0(v) + ' marked "' + (key[k] || k) + '"').join(', ') : 'none was marked') + '.',
        link: PORTAL + page, linkText: 'See the marks', period: r.updated};
    });
  }


  /* ---------- the two tools that check your own files: what they check (not data) ---------- */
  facts['ordinal-view-tester.html'] = {tool: 'Ordinal View Tester', page: PORTAL + 'ordinal-view-tester.html', about: true,
    text: 'No fact of the day for this one: it tests your own HTML file before you inscribe it, not the chain.', link: PORTAL + 'ordinal-view-tester.html', linkText: 'Test a file'};
  facts['sentinel-id-viewer.html'] = {tool: 'Sentinel ID Viewer', page: PORTAL + 'sentinel-id-viewer.html', about: true,
    text: 'No fact of the day for this one: it checks a list of inscriptions you give it, not the chain.', link: PORTAL + 'sentinel-id-viewer.html', linkText: 'Go through a list'};

  const out = {data: 'Ord Portal Highlights ' + VERSION, licence: LICENCE, made: now.toISOString().replace(/\.\d{3}/, ''), day: D,
    what: 'One real fact for each tool on the Ord Portal\'s front page, made each day by GitHub with the tool\'s own code (the Agent Blockhall MCP tool), on yesterday\'s (UTC) blocks or a real example from them, or from the tool\'s own saved data. period: the day or time the fact is about. kept: true when today\'s could not be found, so the last one is kept, with its own date. about: true for the two tools that check your own files: their line says what they check (not data).',
    facts};
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(log.join('\n'));
  console.log('\n' + Object.keys(facts).length + ' facts written to ' + file);
}
main().catch(e => { console.error(e); process.exit(1); });
