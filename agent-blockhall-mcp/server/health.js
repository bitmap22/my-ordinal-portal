/* Source Health, by bitmap22. Always free. Part of Agent Blockhall: https://bitmap22.github.io/my-ordinal-portal/block-cube.html
   Which of the free public data sites the portal's tools read are answering, how fast, and whether their answers are up to
   date, so a person or an AI agent knows how far to trust an answer and which site to ask. Each site is asked one small thing
   (most: the newest block's height, which says both whether it answers and whether it has kept up with the chain):
   - Bitcoin: mempool.space and its 6 copies, ordinals.com and its 4 copies, stampchain.io, api.counterparty.io, api.bnrp.name
   - Dogecoin: thedoginalsexplorer.com, Blockchair, BlockCypher, BitPay's Bitcore, 3xpl's sandbox, and Doggy Market's file copies
   What each says is only ever what it said: nothing is guessed. A site that answers in 2.5 seconds or more is slow (the
   portal's tools ask the next site after 2.5 seconds); a site 2 or more blocks behind the others is behind.
   GitHub's computers ask the same, about once an hour, and keep a week of it (the source-health branch of the portal's own
   repository): record() and summarise() read that. The same file is for the portal's Source Health page, the free Agent
   Blockhall MCP tool and that hourly check. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.SourceHealth = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const SLOW_MS = 2500, WAIT_MS = 15000, KEEP_HOURS = 168;
  const RECORD_URLS = ['https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/source-health/week.json',
    'https://cdn.jsdelivr.net/gh/bitmap22/my-ordinal-portal@source-health/week.json'];   // (the second is a copy that can be some hours old)
  // inscription #0 on each chain: a file every copy site should give exactly (Bitcoin's is 793 bytes, Dogecoin's 1,461)
  const DOGE_0 = '15f3b73df7e5c072becb1d84191843ba080734805addfccb650929719080f62ei0';

  const height = t => { const n = Number(String(t).trim()); return Number.isInteger(n) && n > 0 ? n : null; };
  const json = t => JSON.parse(t);
  const mp = (site, what) => ({site, chain: 'bitcoin', group: 'Blocks and fees', what, path: '/api/blocks/tip/height', read: height});
  const ord = (site, what) => ({site, chain: 'bitcoin', group: 'Inscriptions', what, path: '/r/blockheight', read: height});
  const SITES = [
    mp('mempool.space', 'blocks, transactions, fees and prices (asked first)'),
    mp('ordpool.space', 'a copy of mempool.space, and the only site that tags CAT-21, Labitbu and OpenTimestamps in mined blocks'),
    mp('mempool.emzy.de', 'a copy of mempool.space'),
    mp('mempool.ninja', 'a copy of mempool.space'),
    mp('mempool.fra.mempool.space', 'a copy of mempool.space'),
    mp('mempool.bitaroo.net', 'a copy of mempool.space'),
    mp('blockstream.info', 'blocks and transactions (the last copy asked)'),
    ord('ordinals.com', 'inscriptions, their files and records, rune pages and each block\'s list of inscriptions (asked first)'),
    ord('static.unisat.io', 'a copy of ordinals.com\'s recursive endpoints (/r/) and files'),
    ord('ordiscan.com', 'a copy of ordinals.com\'s recursive endpoints (/r/) and files'),
    ord('ordinalswallet.com', 'a copy of ordinals.com\'s recursive endpoints (/r/) and files'),
    ord('ord.xverse.app', 'a copy of ordinals.com\'s recursive endpoints (/r/) and files'),
    {site: 'stampchain.io', chain: 'bitcoin', group: 'Stamps, Counterparty and names', what: 'Stamp numbers and SRC-20 token totals', path: '/api/v2/health',
      read: t => { const j = json(t), s = j && j.services && j.services.blockSync; return s && height(s.indexed); }},
    {site: 'api.counterparty.io', base: 'https://api.counterparty.io:4000', chain: 'bitcoin', group: 'Stamps, Counterparty and names', what: 'Counterparty messages', path: '/v2/',
      read: t => { const r = json(t).result; return r && height(r.counterparty_height); }},
    {site: 'api.bnrp.name', chain: 'bitcoin', group: 'Stamps, Counterparty and names', what: 'names (.sats, .btc and the like)', path: '/v1/resolve/satoshi.sats',
      read: t => { const j = json(t); return j && /^[0-9a-f]{64}i\d+$/.test(j.inscription_id || '') ? {name: j.name, inscription: j.inscription_id} : null; }, kind: 'name'},
    {site: 'thedoginalsexplorer.com', chain: 'doge', group: 'Blocks and inscriptions', what: 'blocks, transactions, inscriptions and their files (asked first)', path: '/r/blockheight', read: height},
    {site: 'api.blockchair.com', chain: 'doge', group: 'Blocks and inscriptions', what: 'blocks (a back-up)', path: '/dogecoin/stats',
      read: t => { const d = json(t).data; return d && height(d.best_block_height); }},
    {site: 'api.blockcypher.com', chain: 'doge', group: 'Blocks and inscriptions', what: 'blocks (a back-up)', path: '/v1/doge/main', read: t => height(json(t).height)},
    {site: 'api.bitcore.io', chain: 'doge', group: 'Blocks and inscriptions', what: 'the newest block, and every transaction\'s size and fee', path: '/api/DOGE/mainnet/block/tip', read: t => height(json(t).height)},
    {site: 'sandbox-api.3xpl.com', chain: 'doge', group: 'Blocks and inscriptions', what: 'the newest block and block hashes (a last word)', path: '/?from=dogecoin',
      read: t => { const d = json(t).data.blockchains.dogecoin; return d && height(d.best_block); }},
    {site: 'cdn.doggy.market', chain: 'doge', group: 'Blocks and inscriptions', what: 'copies of inscription files (when the explorer doesn\'t have one)', path: '/content/' + DOGE_0, kind: 'file',
      against: 'https://thedoginalsexplorer.com/content/' + DOGE_0}
  ];
  for (const s of SITES) s.url = (s.base || 'https://' + s.site) + s.path;
  const CHAINS = {bitcoin: 'Bitcoin', doge: 'Dogecoin'};
  const pick = chain => chain && chain !== 'all' ? SITES.filter(s => s.chain === (/^d/i.test(chain) ? 'doge' : 'bitcoin')) : SITES;

  // the states a site can be in, as one letter in the hourly record
  const STATE = {answers: 'a', slow: 's', refused: 'r', error: 'e', 'no answer': 'n', 'wrong answer': 'w'};
  const FROM = Object.fromEntries(Object.entries(STATE).map(([k, v]) => [v, k]));
  const SAYS = {answers: 'answers', slow: 'answers, but slowly (2.5 seconds or more)', refused: 'refused', error: 'answered with an error', 'no answer': 'no answer', 'wrong answer': 'answered, but not with what was asked'};

  async function sha256(bytes) {
    if (typeof crypto !== 'undefined' && crypto.subtle) return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    return require('crypto').createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  }
  // one ask: how long it took, what came back
  async function ask(url, opt) {
    const go = opt && opt.fetch || fetch, t0 = Date.now(), ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), opt && opt.wait || WAIT_MS);
    try {
      const init = {signal: ctl.signal}; if (typeof window !== 'undefined') init.cache = 'no-store';
      const r = await go(url, init), bytes = new Uint8Array(await r.arrayBuffer());
      return {http: r.status, ms: Date.now() - t0, bytes, retryAfter: r.headers && r.headers.get ? r.headers.get('retry-after') : null};
    } catch (e) { return {http: null, ms: Date.now() - t0, failed: e && e.name === 'AbortError' ? 'nothing in ' + Math.round((opt && opt.wait || WAIT_MS) / 1000) + ' seconds'
      : typeof window !== 'undefined' ? 'it could not be reached, or would not let this page read it' : 'it could not be reached (' + String(e && e.cause && e.cause.code || e && e.message || e).slice(0, 60) + ')'}; }
    finally { clearTimeout(timer); }
  }

  // ask one site its one thing
  async function probe(s, opt) {
    const r = await ask(s.url, opt), out = {site: s.site, chain: s.chain, group: s.group, what: s.what, asked: s.url, http: r.http, ms: r.ms};
    if (r.failed) return Object.assign(out, {state: 'no answer', says: null, note: r.failed});
    if (r.http === 429 || r.http === 403 || r.http === 401) return Object.assign(out, {state: 'refused', says: null, note: (r.http === 429 ? 'asked us to slow down' + (r.retryAfter ? ' for ' + r.retryAfter + ' seconds' : '') : 'said no') + ', http ' + r.http});
    if (r.http < 200 || r.http > 299) return Object.assign(out, {state: 'error', says: null, note: 'http ' + r.http});
    let says = null;
    try {
      if (s.kind === 'file') {
        const sum = await sha256(r.bytes); says = {bytes: r.bytes.length, sha256: sum};
        const b = opt && opt.against && opt.against[s.against] || await ask(s.against, opt);
        if (b.http === 200 && b.bytes) { const sum2 = await sha256(b.bytes); out.sameAs = {site: new URL(s.against).host, same: sum2 === sum, bytes: b.bytes.length}; }
        else out.sameAs = {site: new URL(s.against).host, same: null, note: 'it gave no copy to compare with just now'};
      } else says = s.read(new TextDecoder().decode(r.bytes));
    } catch (e) { says = null; }
    if (says == null) return Object.assign(out, {state: 'wrong answer', says: null, note: 'its answer could not be read'});
    out.says = says; out.state = r.ms >= SLOW_MS ? 'slow' : 'answers';
    return out;
  }

  // up to date or behind: each chain's newest block is the highest height at least two sites have reached (one site alone can't set it)
  function judge(results) {
    const tips = {};
    for (const chain of Object.keys(CHAINS)) {
      const hs = results.filter(r => r.chain === chain && typeof r.says === 'number').map(r => r.says).sort((a, b) => b - a);
      if (hs.length) tips[chain] = hs.length >= 2 ? hs[1] : hs[0];
    }
    for (const r of results) {
      if (typeof r.says === 'number' && tips[r.chain] != null) { r.behind = Math.max(0, tips[r.chain] - r.says); r.upToDate = r.behind <= 1; if (r.says > tips[r.chain]) r.ahead = r.says - tips[r.chain]; }
      else if (r.sameAs) r.upToDate = r.sameAs.same;
      else r.upToDate = null;
      r.words = words(r);
    }
    return tips;
  }
  const fmt = n => Number(n).toLocaleString('en-GB');
  function words(r) {
    if (r.state === 'answers' || r.state === 'slow') {
      let w = (r.state === 'slow' ? 'answers slowly' : 'answers') + ' (' + fmt(r.ms) + ' ms)';
      if (typeof r.says === 'number') w += r.behind >= 2 ? ': ' + fmt(r.behind) + ' blocks behind (it says ' + fmt(r.says) + ')' : r.ahead ? ': it already has block ' + fmt(r.says) + ', newer than the others' : ': up to date (block ' + fmt(r.says) + ')';
      else if (r.sameAs) w += r.sameAs.same === true ? ': its copy of inscription #0 is the same, byte for byte, as ' + r.sameAs.site + '\'s' : r.sameAs.same === false ? ': its copy of inscription #0 is NOT the same as ' + r.sameAs.site + '\'s' : ': ' + r.sameAs.site + ' ' + r.sameAs.note;
      else if (r.says && r.says.name) w += ': ' + r.says.name + ' is inscription ' + r.says.inscription;
      return w;
    }
    return SAYS[r.state] + (r.note ? ': ' + r.note : '');
  }

  // ask every site (or one chain's) once, all at the same time: one small ask each
  async function check(opt) {
    opt = opt || {};
    const list = pick(opt.chain).filter(s => !opt.site || s.site === String(opt.site).replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
    if (!list.length) throw new Error('no such site: the sites are ' + SITES.map(s => s.site).join(', '));
    const at = new Date().toISOString(); let done = 0;
    const results = await Promise.all(list.map(s => probe(s, opt).then(r => { if (opt.progress) opt.progress(++done, list.length, r); return r; })));
    const tips = judge(results);
    return {at, from: opt.from || 'here', newest: tips, counts: counts(results), results};
  }
  function counts(results) {
    const c = {asked: results.length, answers: 0, slow: 0, behind: 0, down: 0};
    for (const r of results) { if (r.state === 'answers') c.answers++; else if (r.state === 'slow') c.slow++; else c.down++; if (r.upToDate === false) c.behind++; }
    return c;
  }

  /* ---------- the hourly record (GitHub's computers): a week of checks, one line each ---------- */
  // one check, kept small: [state letter, ms, blocks behind (or null)] for each site, in SITES order
  function line(c) { const by = new Map(c.results.map(r => [r.site, r])); return {t: Math.round(Date.parse(c.at) / 1000), r: SITES.map(s => { const r = by.get(s.site); return r ? [STATE[r.state], r.ms, r.behind != null ? r.behind : r.upToDate === false ? -1 : null] : null; })}; }
  function addToRecord(rec, c, keepHours) {
    rec = rec && rec.v === 1 ? rec : {v: 1, sites: SITES.map(s => s.site), checks: []};
    const order = SITES.map(s => s.site);
    if (rec.sites.join() !== order.join()) rec.checks = rec.checks.map(k => ({t: k.t, r: order.map(n => { const i = rec.sites.indexOf(n); return i >= 0 ? k.r[i] : null; })}));   // (a site list that has changed: keep what matches)
    rec.sites = order; rec.checks.push(line(c));
    const cut = Math.round(Date.parse(c.at) / 1000) - (keepHours || KEEP_HOURS) * 3600;
    rec.checks = rec.checks.filter(k => k.t > cut); rec.made = c.at; rec.licence = LICENCE;
    return rec;
  }
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
  // what the record says about each site: over the last day and the last week
  function summarise(rec, opt) {
    opt = opt || {};
    if (!rec || rec.v !== 1 || !rec.checks || !rec.checks.length) return {checks: 0, note: 'no record yet'};
    const now = opt.now || Math.max(...rec.checks.map(k => k.t)), span = {day: 24 * 3600, week: 7 * 24 * 3600};
    const sites = pick(opt.chain).filter(s => !opt.site || s.site === opt.site).map(s => {
      const i = rec.sites.indexOf(s.site), o = {site: s.site, chain: s.chain, group: s.group, what: s.what};
      for (const [name, secs] of Object.entries(span)) {
        const rows = rec.checks.filter(k => k.t > now - secs && k.r[i]).map(k => ({t: k.t, s: k.r[i][0], ms: k.r[i][1], b: k.r[i][2]}));
        const ans = rows.filter(x => x.s === 'a' || x.s === 's'), bad = rows.filter(x => x.s !== 'a' && x.s !== 's'), behind = rows.filter(x => x.b != null && (x.b >= 2 || x.b < 0));
        o[name] = {checks: rows.length, answered: ans.length, answeredPct: rows.length ? Math.round(ans.length / rows.length * 1000) / 10 : null, typicalMs: median(ans.map(x => x.ms)),
          slow: rows.filter(x => x.s === 's').length, refused: rows.filter(x => x.s === 'r').length, errors: rows.filter(x => x.s === 'e' || x.s === 'w').length, noAnswer: rows.filter(x => x.s === 'n').length,
          behind: behind.length, mostBehind: behind.length ? Math.max(...behind.map(x => x.b)) : 0,
          lastTrouble: bad.length ? {at: new Date(bad[bad.length - 1].t * 1000).toISOString(), was: FROM[bad[bad.length - 1].s]} : null};
      }
      const last = rec.checks.slice().reverse().find(k => k.r[i]);
      if (last) o.last = {at: new Date(last.t * 1000).toISOString(), state: FROM[last.r[i][0]], ms: last.r[i][1], behind: last.r[i][2]};
      return o;
    });
    const first = Math.min(...rec.checks.map(k => k.t));
    return {from: 'GitHub\'s computers (about once an hour)', checks: rec.checks.length, since: new Date(first * 1000).toISOString(), lastCheck: new Date(now * 1000).toISOString(), sites};
  }
  // the record itself, read from the portal's repository
  async function record(opt) {
    let err = null;
    for (const u of RECORD_URLS) {
      const r = await ask(u + (u.includes('raw.githubusercontent') ? '?t=' + Math.floor(Date.now() / 60000) : ''), Object.assign({}, opt, {wait: 20000}));
      if (r.http === 200) { try { const rec = json(new TextDecoder().decode(r.bytes)); rec.readFrom = u; return rec; } catch (e) { err = new Error('the record could not be read'); } }
      else err = new Error(r.failed || 'http ' + r.http + ' for the record');
    }
    throw err || new Error('no record');
  }

  const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE). What each site said is its own answer.';
  const site = name => SITES.find(s => s.site === name);
  return {VERSION, SITES: SITES.map(({read, ...s}) => s), CHAINS, SLOW_MS, WAIT_MS, KEEP_HOURS, RECORD_URLS, LICENCE, check, probe, judge, words, addToRecord, summarise, record, site};
});
