/* Citable checks, by bitmap22. Always free. Part of Agent Blockhall: https://bitmap22.github.io/my-ordinal-portal/block-cube.html
   Every check the portal's tools make gets a link that carries what it found: when it was checked, which sites it asked, its
   main facts, and a fingerprint (SHA-256) of its core, the part that comes from the chain itself (a block's hash and every
   transaction ID, an inscription's file and where it was made, a collection's members, the inscriptions a piece loads).
   Anyone who opens the link gets the same check made again, now, and is told whether it is the same, or what changed
   (the holder was X, now Y). Nothing is stored anywhere: the link itself is the record.
   Tools: manifest (Block Manifest), provenance (Provenance Check), collection (Collection Check), recursion (Recursion Map),
   opinion (Second Opinion), health (Source Health), daily (Daily Data), stuck (Stuck Transaction Doctor), code (Code Read), league (Truth League), and Doge Cube's
   dogemanifest, dogeprovenance and dogedaily. The same file is for the portal's pages and the free
   Agent Blockhall MCP tool (its checkAgain tool reads a link and makes the check again). No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.Cite = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const PORTAL = 'https://bitmap22.github.io/my-ordinal-portal/';

  /* ---------- SHA-256 (of text, as UTF-8), so a fingerprint is ready at once, in a page or in Node ---------- */
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(text) {
    const b = new TextEncoder().encode(text), n = ((b.length + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(b); m[b.length] = 0x80;
    const bits = b.length * 8; for (let i = 0; i < 8; i++) m[n - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
    const r = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) { const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
  }
  // the same value always written the same way (keys in order), so its fingerprint is the same
  const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v);
  const fingerprint = v => sha256(canon(v)).slice(0, 16);
  const b64 = s => { const b = new TextEncoder().encode(s); let t = ''; for (const x of b) t += String.fromCharCode(x); return (typeof btoa === 'function' ? btoa(t) : Buffer.from(b).toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const t = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'); return new TextDecoder().decode(Uint8Array.from(t, c => c.charCodeAt(0))); };
  const host = u => String(u || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const fmt = n => typeof n === 'number' ? n.toLocaleString('en-GB') : String(n);
  const short = v => { const s = typeof v === 'number' ? fmt(v) : v == null ? 'nothing' : String(v); return s.length > 24 && /^[0-9a-z]+$/i.test(s) ? s.slice(0, 10) + '…' + s.slice(-6) : s.length > 80 ? s.slice(0, 77) + '…' : s; };

  /* ---------- what each tool's check is: its subject (the link), its core (fingerprinted) and its main facts ---------- */
  const TOOLS = {
    manifest: {coreName: 'the block itself', name: 'Block Manifest', page: 'block-manifest.html', mcp: 'blockManifest', subject: r => ({block: r.block.height}), label: r => 'block ' + fmt(r.block.height),
      coreIs: 'the block itself: its hash and every transaction ID, in order',
      core: r => [r.block.hash, (r.items || []).map(i => i && i.txid)],
      facts: r => Object.assign({transactions: r.block.transactions, fees: r.block.totalFees, minedBy: r.block.minedBy || null}, Object.fromEntries(Object.entries(r.counts || {}).map(([k, v]) => ['kind: ' + k, v]))),
      sources: r => Object.values(r.sources || {})},
    provenance: {coreName: 'the inscription itself', name: 'Provenance Check', page: 'provenance-check.html', mcp: 'provenanceCheck', subject: r => ({id: r.inscription.id}), label: r => 'inscription ' + (r.inscription.number != null ? '#' + fmt(r.inscription.number) : r.inscription.id),
      coreIs: 'the inscription itself: its file\'s fingerprint, the block it was made in, its type, size, parents and delegate',
      core: r => { const I = r.inscription; return [I.id, I.fingerprint && I.fingerprint.sha256, I.block, I.contentType, I.bytes, I.parents || [], I.delegate || null]; },
      facts: r => { const I = r.inscription, T = r.trail || []; return {number: I.number, block: I.block, type: I.contentType, bytes: I.bytes, file: I.fingerprint ? I.fingerprint.sha256.slice(0, 16) : null, sat: I.sat, holder: I.holder, moves: T.length ? T.length - 1 : 0, checks: r.verdict}; },
      sources: r => Object.values(r.sources || {})},
    collection: {coreName: 'the collection\'s members', name: 'Collection Check', page: 'collection-check.html', mcp: 'collectionCheck', subject: r => ({parent: r.parent.id}), label: r => 'the collection of ' + (r.parent.number != null ? '#' + fmt(r.parent.number) : r.parent.id),
      coreIs: 'the collection itself: every child its parent has, by ID',
      core: r => [r.parent.id, (r.allIds || (r.children || []).map(c => c.id)).slice().sort()],
      facts: r => ({children: r.counts.listed, proven: r.counts.proven, notProven: r.counts.notProven, notReached: r.counts.notReached, parentHolder: r.parent.holder, parentMoves: r.trail ? r.trail.moves : null}),
      sources: r => [r.lists && r.lists.first && r.lists.first.site, r.lists && r.lists.second && r.lists.second.site]},
    recursion: {coreName: 'what it loads', name: 'Recursion Map', page: 'recursion-map.html', mcp: 'recursionMap', subject: r => Object.assign({id: r.root.id}, r.limits && r.limits.levelsRead !== 3 ? {depth: r.limits.levelsRead} : {}),
      label: r => 'what ' + (r.root.number != null ? '#' + fmt(r.root.number) : r.root.id) + ' loads',
      coreIs: 'what it loads: every inscription on the map, the /r/ endpoints its code asks, and any address outside the chain in its code',
      core: r => [r.root.id, (r.nodes || []).map(n => n.id).sort(), (r.endpoints || []).map(e => e.endpoint).sort(), (r.outside || []).map(o => o.url).sort()],
      facts: r => ({inscriptions: r.counts.inscriptions, levels: r.counts.levels, missing: r.counts.missing, notOnSecondSite: r.counts.notOnSecondSite, endpoints: r.counts.endpoints, outside: r.counts.outside, allOnChain: r.allOnChain}),
      sources: r => Object.values(r.sources || {})},
    opinion: {coreName: 'the claim and its answer', name: 'Second Opinion', page: 'second-opinion.html', mcp: 'secondOpinion', subject: r => ({claim: r.claim.text}), label: r => '“' + r.claim.text + '”',
      coreIs: 'the claim and its answer',
      core: r => [r.claim.kind, r.claim.subject, r.claim.value, r.answer],
      facts: r => Object.assign({answer: r.answer}, Object.fromEntries((r.sources || []).map(s => [(s.kind === 'chain' ? 'the chain' : host(s.source)) + ' says', s.says == null ? null : typeof s.says === 'object' ? JSON.stringify(s.says) : s.says]))),
      sources: r => (r.sources || []).map(s => s.source)},
    health: {coreName: 'how every site answered', name: 'Source Health', page: 'source-health.html', mcp: 'sourceHealth', subject: r => r.chain && r.chain !== 'all' ? {chain: r.chain} : {}, label: r => r.chain === 'doge' ? 'Dogecoin\'s data sites' : r.chain === 'bitcoin' ? 'Bitcoin\'s data sites' : 'the data sites',
      coreIs: 'how every site answered',
      core: r => (r.results || []).map(x => [x.site, x.state, x.behind >= 2 ? x.behind : 0]),
      facts: r => Object.fromEntries((r.results || []).map(x => [x.site, x.state + (x.behind >= 2 ? ', ' + x.behind + ' blocks behind' : '') + (x.sameAs && x.sameAs.same === false ? ', a different file' : '')])),
      sources: r => (r.results || []).map(x => x.site)},
    daily: {coreName: 'the day\'s blocks', name: 'Daily Data', page: 'daily.html', mcp: 'dailyData', subject: r => ({day: r.day}), label: r => 'Daily Data for ' + r.day,
      coreIs: 'the day\'s blocks: every block\'s height and hash',
      core: r => (r.blocks || []).map(b => [b.height, b.hash]),
      facts: r => { const T = r.totals || {}; return Object.assign({blocks: T.blocks, firstBlock: T.firstBlock, lastBlock: T.lastBlock, transactions: T.transactions, fees: T.totalFees}, Object.fromEntries(Object.entries(T.counts || {}).map(([k, v]) => ['kind: ' + k, v]))); },
      sources: () => ['github.com/bitmap22/my-ordinal-portal (the daily-data branch)']}
  };

  // the Stuck Transaction Doctor: where a transaction is (waiting, or mined in a block) and what it pays
  TOOLS.stuck = {coreName: 'where it stands', name: 'Stuck Transaction Doctor', page: 'stuck-transaction.html', mcp: 'stuckTx', subject: r => ({tx: r.txid}), label: r => 'transaction ' + r.txid.slice(0, 10) + '…' + r.txid.slice(-6),
    coreIs: 'where it is: waiting, mined (and in which block) or not found',
    core: r => [r.txid, r.state === 'mined' ? 'mined' : r.state === 'not found' ? 'not found' : 'waiting', r.facts && r.facts.block != null ? r.facts.block : null],
    facts: r => { const F = r.facts || {}, w = r.state === 'mined' ? 'mined' : r.state === 'not found' ? 'not found' : null;
      return {state: r.state, feeRate: F.feeRate != null ? F.feeRate : w, withParents: F.effectiveFeeRate != null ? F.effectiveFeeRate : w, inWaitingBlock: F.inWaitingBlock != null ? F.inWaitingBlock : w || 'under every block waiting', block: F.block != null ? F.block : w ? w : 'not yet'}; },
    sources: r => r.sources || []};

  // Code Read: what an inscription's code (and the code it loads) asks for
  TOOLS.code = {coreName: 'the code read', name: 'Code Read', page: 'code-read.html', mcp: 'codeRead', subject: r => ({id: r.id}), label: r => 'the code of ' + (r.number != null ? '#' + fmt(r.number) : r.id),
    coreIs: 'the code read: the inscription and each inscription of code it loads, with its size',
    core: r => [r.id, (r.files || []).map(f => [f.id, f.bytes || null])],
    facts: r => Object.assign({isCode: r.isCode, files: (r.files || []).length, outsideAddresses: (r.outsideAddresses || []).length}, Object.fromEntries((r.kinds || []).map(k => [k.name, k.count]))),
    sources: r => r.sources || []};

  // Doge Collection Check: the pieces of a Doginals collection checked so far (Doginals have no parents: the list is the explorer's)
  TOOLS.dogecollection = {coreName: 'the pieces checked', name: 'Doge Collection Check', page: 'doge-collection-check.html', mcp: 'dogeCollectionCheck', subject: r => ({collection: r.collection.slug, checked: r.counts.checked}),
    label: r => 'the Doginals collection ' + r.collection.name + ' (its first ' + fmt(r.counts.checked) + ' piece' + (r.counts.checked === 1 ? '' : 's') + ')',
    coreIs: 'the pieces checked: each one\'s ID and file fingerprint, in the collection\'s order',
    core: r => [r.collection.slug, (r.pieces || []).map(p => [p.id, p.fingerprint || null])],
    facts: r => ({listed: r.counts.listed, checked: r.counts.checked, real: r.counts.real, problems: r.counts.problems, notFullyChecked: r.counts.notFullyChecked, holders: r.collection.holders}),
    sources: r => [r.sources.list, r.sources.secondSite].concat(r.sources.fileCopies || [])};

  // Rune Proof: a rune's etching, read from the chain's own bytes and checked against ordinals.com
  TOOLS.rune = {coreName: 'the rune as etched', name: 'Rune Proof', page: 'rune-proof.html', mcp: 'runeProof', subject: r => ({rune: r.query}), label: r => 'rune ' + (r.rune && r.rune.name || r.query),
    coreIs: 'the rune as etched: its name, ID and etching transaction, and the rules written in its etching',
    core: r => [r.rune ? [r.rune.name || null, r.rune.id || null, r.rune.etching || null] : null, r.etching || null, ['not etched', 'not found', 'no etching', 'not made'].includes(r.answer) ? r.answer : null],
    facts: r => { const O = r.ordinalsOnly || {}; return {answer: r.answer, id: r.rune && r.rune.id || null, supply: O.supply || null, mints: O.mints || null, burned: O.burned || null, differs: (r.compare || []).filter(c => !c.same).map(c => c.field).join(', ') || null}; },
    sources: r => r.sources || []};

  // Doge Cube's twins of three of them (Dogecoin's blocks, Doginals and days), read the same way
  TOOLS.dogemanifest = Object.assign({}, TOOLS.manifest, {name: 'Doge Block Manifest', page: 'doge-block-manifest.html', mcp: 'dogeBlockManifest', label: r => 'Dogecoin block ' + fmt(r.block.height)});
  TOOLS.dogeprovenance = Object.assign({}, TOOLS.provenance, {coreName: 'the Doginal itself', name: 'Doge Provenance Check', page: 'doge-provenance-check.html', mcp: 'dogeProvenanceCheck',
    label: r => 'Doginal ' + (r.inscription.number != null ? '#' + fmt(r.inscription.number) : r.inscription.id), coreIs: 'the Doginal itself: its file\'s fingerprint (put back together from the transactions that wrote it), the block it was made in, its type, size and delegate',
    facts: r => { const I = r.inscription, T = r.trail || []; return {number: I.number, block: I.block, type: I.contentType, bytes: I.bytes, file: I.fingerprint ? I.fingerprint.sha256.slice(0, 16) : null, holder: I.holder, moves: T.length ? T.length - 1 : 0, checks: r.verdict}; }});
  TOOLS.dogedaily = Object.assign({}, TOOLS.daily, {name: 'Doge Daily Data', page: 'doge-daily.html', mcp: 'dogeDailyData', label: r => 'Doge Daily Data for ' + r.day, sources: () => ['github.com/bitmap22/my-ordinal-portal (the doge-daily-data branch)']});

  // Truth League: one check of every data site's answers, against blocks proved from their own bytes
  TOOLS.league = {coreName: 'how every site answered', name: 'Truth League', page: 'truth-league.html', mcp: 'truthLeague', subject: r => r.chain && r.chain !== 'all' ? {chain: r.chain} : {},
    label: r => r.chain === 'doge' ? 'Dogecoin\'s data sites' : r.chain === 'bitcoin' ? 'Bitcoin\'s data sites' : 'every data site',
    coreIs: 'how every site answered: right, wrong or not answered, for each fact it was asked',
    core: r => (r.results || []).filter(x => x.facts && x.facts.length).map(x => [x.site, x.facts.map(f => f.code === 'R' || f.code === 'W' || f.code === '-' ? f.code : 'N').join('')]),
    facts: r => Object.fromEntries((r.results || []).filter(x => x.facts && x.facts.length).map(x => { const n = c => x.facts.filter(f => f.code === c).length; return [x.site, n('R') + ' right, ' + n('W') + ' wrong, of ' + x.facts.filter(f => f.code !== '-').length + ' asked']; })),
    sources: r => (r.results || []).filter(x => x.facts && x.facts.length).map(x => x.site)};
  /* ---------- making a citation, reading one back, comparing ---------- */
  const minute = d => new Date(d || Date.now()).toISOString().slice(0, 16) + 'Z';
  function make(tool, r, at) {
    const T = TOOLS[tool]; if (!T) throw new Error('no such tool: the tools are ' + Object.keys(TOOLS).join(', '));
    const subject = T.subject(r), facts = T.facts(r), fp = fingerprint(T.core(r)), when = minute(at);
    // (a source named in words, e.g. "the chain (its coinbase, from mempool.space)", is cited by the site it came from)
    const site = u => { const h = host(u); if (/^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?$/i.test(h)) return h; const m = String(u).match(/[a-z0-9-]+(\.[a-z0-9-]+)+/i); return m ? m[0] : null; };
    const src = [...new Set(T.sources(r).filter(Boolean).map(site).filter(Boolean))];
    const q = new URLSearchParams(Object.assign({}, subject, {cited: when, fp, src: src.join(','), f: b64(JSON.stringify(facts))}));
    return {tool, check: T.name, of: T.label(r), subject, at: when, fingerprint: fp, fingerprintOf: T.coreIs, facts, sources: src,
      link: PORTAL + T.page + '?' + q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':'),
      howToUse: 'Cite the link. Opening it makes the same check again, now, and says whether it is the same, or what changed. ' + (T.mcp ? 'Without a browser: the Agent Blockhall MCP tool\'s checkAgain({link}).' : '')};
  }
  // a citation from a link (or a page's own address): null if it is not one
  function read(link) {
    let u; try { u = new URL(link, PORTAL); } catch (e) { return null; }
    const p = u.searchParams; if (!p.get('cited') || !p.get('fp')) return null;
    const page = u.pathname.split('/').pop(), tool = Object.keys(TOOLS).find(k => TOOLS[k].page === page); if (!tool) return null;
    let facts = null; try { facts = JSON.parse(unb64(p.get('f') || '')); } catch (e) {}
    const subject = {}; for (const [k, v] of p) if (!['cited', 'fp', 'src', 'f'].includes(k)) subject[k] = v;
    return {tool, check: TOOLS[tool].name, subject, at: p.get('cited'), fingerprint: p.get('fp'), sources: (p.get('src') || '').split(',').filter(Boolean), facts, raw: {cited: p.get('cited'), fp: p.get('fp'), src: p.get('src') || '', f: p.get('f') || ''}};
  }
  const sameSubject = (a, b) => canon(Object.fromEntries(Object.entries(a || {}).map(([k, v]) => [k, String(v)]))) === canon(Object.fromEntries(Object.entries(b || {}).map(([k, v]) => [k, String(v)])));
  const when = at => { const d = new Date(at); return isNaN(d) ? String(at) : d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}) + ', ' + d.toISOString().slice(11, 16) + ' UTC'; };
  // then (a citation read from a link) against now (make() of the check made again): same, or what changed
  function compare(then, now) {
    const changed = [], notReadNow = [];
    const keys = [...new Set(Object.keys(then.facts || {}).concat(Object.keys(now.facts || {})))];
    for (const k of keys) {
      const a = then.facts ? then.facts[k] : undefined, b = now.facts[k];
      if (canon(a === undefined ? null : a) === canon(b === undefined ? null : b)) continue;
      if ((b == null) && a != null) notReadNow.push({what: k, then: a}); else changed.push({what: k, then: a === undefined ? null : a, now: b === undefined ? null : b});
    }
    const coreSame = then.fingerprint === now.fingerprint, same = coreSame && !changed.length && !notReadNow.length;
    const list = changed.map(c => c.what + ' was ' + short(c.then) + ', now ' + short(c.now)).join('; ');
    const core = 'the fingerprint of ' + TOOLS[now.tool].coreName, cited = '(' + when(then.at) + ')';
    const words = (same ? 'The same as when it was cited ' + cited + ': ' + core + ' matches, and so does every fact'
      : coreSame ? 'Since it was cited ' + cited + ', ' + core + ' still matches' + (list ? ', but ' + list : '')
      : 'Changed since it was cited ' + cited + ': ' + core + ' is different' + (list ? '. ' + list : ''))
      + (notReadNow.length ? '. Not read this time (a site did not answer): ' + notReadNow.map(c => c.what).join(', ') : '') + '.';
    return {same, coreSame, answer: same ? 'same' : coreSame && !changed.length ? 'same core, some facts not read now' : 'changed', citedAt: then.at, checkedAgainAt: now.at, fingerprintThen: then.fingerprint, fingerprintNow: now.fingerprint, changed, notReadNow, words};
  }

  /* ---------- in a page: a "Cite this check" panel, and the comparison when the page was opened from a citation ---------- */
  const opened = typeof location !== 'undefined' ? read(location.href) : null;
  let compared = false;
  function show(tool, r, mount, at) {
    const c = make(tool, r, at); r.cite = c;
    if (opened && !compared && opened.tool === tool && sameSubject(opened.subject, c.subject)) {
      compared = true; c.comparedWith = compare(opened, c); c.comparedWith.citedSources = opened.sources;
      // (the page's address keeps the citation, so reloading it compares again)
      try { const q = new URLSearchParams(location.search); for (const [k, v] of Object.entries(opened.raw)) q.set(k, v); history.replaceState(null, '', location.pathname + '?' + q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':')); } catch (e) {}
    }
    if (!mount || typeof document === 'undefined') return c;
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    mount.textContent = ''; mount.classList.remove('hidden');
    mount.appendChild(el('h2', null, 'Cite this check'));
    if (c.comparedWith) { const k = c.comparedWith, b = el('div', 'citeback ' + (k.same ? 'same' : k.answer === 'changed' ? 'changed' : 'part')); b.appendChild(el('b', null, k.same ? 'SAME' : k.answer === 'changed' ? 'CHANGED' : 'SAME CORE')); b.appendChild(el('span', null, ' ' + k.words)); mount.appendChild(b); }
    mount.appendChild(el('p', 'small', 'A link to this check as it is now: ' + c.of + ', checked ' + when(c.at) + (c.sources.length ? ' from ' + c.sources.join(', ') : '') + '. Its fingerprint, ' + c.fingerprint + ', is of ' + c.fingerprintOf + '. Opening the link makes the check again and says whether it is the same, or what changed.'));
    const row = el('div', 'citerow'), inp = el('input'); inp.readOnly = true; inp.value = c.link; inp.setAttribute('aria-label', 'The link to cite'); inp.addEventListener('focus', () => inp.select());
    const btn = el('button', null, 'Copy the link'); btn.type = 'button';
    btn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(c.link); btn.textContent = 'Copied'; } catch (e) { inp.focus(); inp.select(); btn.textContent = 'Press Ctrl+C'; } setTimeout(() => { btn.textContent = 'Copy the link'; }, 2000); });
    row.appendChild(inp); row.appendChild(btn); mount.appendChild(row);
    return c;
  }
  const CSS = '.citeback { border: 1px solid #555; border-radius: 10px; padding: 10px; margin: 0 0 10px; text-align: left; font-size: 14px; line-height: 1.45; } .citeback b { letter-spacing: 1px; } '
    + '.citeback.same { border-color: var(--green, #3ddc84); } .citeback.same b { color: var(--green, #3ddc84); } .citeback.changed { border-color: var(--orange, #f7931a); } .citeback.changed b { color: var(--orange, #f7931a); } .citeback.part b { color: #fd9; } '
    + '.citerow { display: grid; grid-template-columns: 1fr auto; gap: 8px; } .citerow input { width: 100%; min-width: 0; font: 12px monospace; padding: 8px; background: #0b0b0b; color: #ddd; border: 1px solid #444; border-radius: 8px; } .citerow button { margin: 0; }';
  if (typeof document !== 'undefined' && document.head) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

  return {VERSION, TOOLS, sha256, canon, fingerprint, make, read, compare, sameSubject, show, opened: () => opened, when};
});
