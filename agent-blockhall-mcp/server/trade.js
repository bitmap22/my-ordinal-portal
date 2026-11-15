/* Trade Check, by bitmap22. Always free. Part of Agent Blockhall: https://bitmap22.github.io/my-ordinal-portal/block-cube.html
   Before you (or an AI agent) buy or trade an inscription: is it what it is said to be? One answer, GO, STOP or NOT SURE,
   with every reason in plain words and a link to check it again later. It reads nothing itself: it runs the portal's own
   checks and judges what they found.
   - Where it came from: the Provenance Check (its file, transaction and block, read from the chain's own bytes, and who holds
     it now). For Dogecoin, the Doge Provenance Check.
   - Whether it is held by the seller's address (if one is given).
   - Whether it is a real member of its collection: the Second Opinion's parent check (it names the parent in its own
     transaction, and the parent was spent to make it), for the collection given, or else the parent it names.
   - For code (HTML, SVG, JavaScript): what its code asks for (Code Read: a wallet, things outside the chain, sending data out,
     tracking, hidden code), and whether everything it loads is on the chain (the Recursion Map).
   The answer:
   - STOP: something is proven not to be as said (its file or bytes differ from the chain, it is held by another address, it is
     not a child of the collection named).
   - NOT SURE: a check could not be made, or something needs care (its code asks a wallet for things, it loads things from
     outside the chain, a piece it loads is missing, it names no parent so a collection can't be proven).
   - GO: every check was made and agrees, and nothing needs care.
   GO means it is what it is said to be. It is never advice on its price, or on whether to buy it.
   The host gives the checks as functions (io): provenance(id), parent(id, parentId), code(id), recursion(id) for Bitcoin, and
   dogeProvenance(id) for Dogecoin, each returning that tool's own answer. The same file is for the portal's Trade Check page
   and the free Agent Blockhall MCP tool. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.TradeCheck = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const PORTAL = 'https://bitmap22.github.io/my-ordinal-portal/';
  const MEANING = 'GO means it is what it is said to be: every check was made and agrees, and nothing needs care. It is never advice on its price, or on whether to buy it.';
  const fmt = n => typeof n === 'number' ? n.toLocaleString('en-GB') : String(n);
  const short = s => { s = String(s || ''); return s.length > 24 ? s.slice(0, 10) + '…' + s.slice(-8) : s; };
  const isId = s => /^[0-9a-f]{64}i\d+$/.test(String(s || ''));
  const CODE_TYPES = /^(text\/html|image\/svg\+xml|text\/javascript|application\/javascript|application\/x-javascript|text\/css)/i;

  // the Provenance Check's checks, and what a 'false' means: 'stop' (the chain or its bytes say otherwise) or 'care' (two sites differ)
  const PROVEN = {
    readFromItsBytes: ['stop', 'its details (type, size, parents) as read from its own transaction', 'its details as read from its own transaction differ from what ord says'],
    transactionBytes: ['stop', 'the transaction’s bytes are that transaction', 'the bytes given for its transaction are not that transaction'],
    writtenChain: ['stop', 'the transactions that wrote it, each spending the one before', 'the transactions that wrote it do not follow on from each other'],
    contentFingerprint: ['stop', 'its file is the one written in its transaction (SHA-256)', 'its file is not the one written in its transaction (SHA-256)'],
    madeInBlock: ['stop', 'the block it was made in', 'it was not made in the block ord says'],
    trail: ['stop', 'its trail from where it was made to where it sits now, each move spending the one before', 'its trail from where it was made to where it sits now is broken'],
    heldNow: ['stop', 'where it sits now (the output is unspent, at the holder’s address)', 'it is not where ord says it sits now (the output is spent, or at another address)'],
    numberAndSat: ['care', 'its number and sat on a second ord site', 'its number and sat'],
    number: ['care', 'its number on a second site', 'its number'],
    secondCopy: ['care', 'a second copy of its file', 'a second copy of its file']
  };

  const reason = (about, mark, says, extra) => Object.assign({about, mark, says}, extra || {});
  // mark: ok, stop, care (needs care), unknown (could not be checked), info

  function fromProvenance(P, chain) {
    const out = [], C = P && P.checked || {}, names = Object.keys(C).filter(k => !C[k].notNeeded);
    const stops = [], cares = [], unknown = [], ok = [];
    for (const k of names) { const c = C[k], rule = PROVEN[k] || ['care', k];
      if (c.agrees === true) ok.push(k); else if (c.agrees === false) (rule[0] === 'stop' ? stops : cares).push(k); else unknown.push(k); }
    const tool = chain === 'doge' ? 'Doge Provenance Check' : 'Provenance Check';
    for (const k of stops) out.push(reason('where it came from', 'stop', 'Proven wrong: ' + (PROVEN[k] ? PROVEN[k][2] : k) + ' (checked: ' + (C[k].what || 'checked') + (C[k].against ? ', against ' + C[k].against : '') + ').', {check: k, from: tool}));
    for (const k of cares) out.push(reason('where it came from', 'care', 'Two sites differ on ' + (PROVEN[k] ? PROVEN[k][2] : k) + ' (' + (C[k].what || 'checked') + ').', {check: k, from: tool}));
    for (const k of unknown) out.push(reason('where it came from', 'unknown', 'Could not be checked this time: ' + (PROVEN[k] ? PROVEN[k][1] : k) + (C[k].what ? ' (' + C[k].what + ')' : '') + '.', {check: k, from: tool}));
    const okChain = ok.filter(k => !PROVEN[k] || PROVEN[k][0] === 'stop'), okSites = ok.filter(k => PROVEN[k] && PROVEN[k][0] === 'care');
    if (!stops.length && ok.length) out.unshift(reason('where it came from', 'ok', (okChain.length ? 'Proven from the chain’s own bytes: ' + okChain.map(k => PROVEN[k] ? PROVEN[k][1] : k).join('; ') + '.' : '') + (okSites.length ? (okChain.length ? ' ' : '') + 'A second site agrees on ' + okSites.map(k => PROVEN[k][2]).join(' and ') + '.' : ''), {from: tool, checks: ok}));
    return out;
  }
  function fromSeller(P, seller) {
    const I = P && P.inscription || {}, held = P && P.checked && P.checked.heldNow;
    if (!seller) return I.holder ? [reason('who holds it', 'info', 'Held now by ' + I.holder + (held && held.agrees ? ' (proven: the output it sits in is unspent, at that address).' : '.'), {holder: I.holder})] : [];
    const s = String(seller).trim();
    if (!I.holder) return [reason('who holds it', 'unknown', 'Who holds it now could not be read, so it could not be checked against the seller’s address ' + s + '.')];
    if (I.holder !== s) return [reason('who holds it', 'stop', 'Proven wrong: it is held by ' + I.holder + ', not by the seller’s address ' + s + '.', {holder: I.holder, seller: s})];
    if (held && held.agrees === true) return [reason('who holds it', 'ok', 'Held by the seller’s address ' + s + ' (proven: the output it sits in is unspent, at that address).', {holder: I.holder})];
    return [reason('who holds it', 'unknown', 'ord says it is held by the seller’s address ' + s + ', but that could not be proven from the chain this time.', {holder: I.holder})];
  }
  function fromParent(O, pid, claimed, named) {
    if (!O) return [reason('its collection', 'unknown', 'Whether it is a child of ' + short(pid) + ' could not be checked this time.', {parent: pid})];
    const tail = (O.verdict ? ' (' + O.verdict + ')' : '');
    if (O.answer === 'true') return [reason('its collection', 'ok', 'Proven a real member of the collection of ' + short(pid) + ': it names it in its own transaction, and it was spent to make it.', {parent: pid, from: 'Second Opinion'})];
    if (O.answer === 'false') return [reason('its collection', claimed ? 'stop' : 'care', (claimed ? 'Proven wrong: it is not a child of ' : 'It names ' + short(pid) + ' as its parent, but is not proven its child') + (claimed ? short(pid) : '') + tail + '.', {parent: pid, from: 'Second Opinion'})];
    return [reason('its collection', 'unknown', 'Whether it is a child of ' + short(pid) + ' could not be proven this time' + tail + '.', {parent: pid, from: 'Second Opinion'})];
  }
  function fromCode(R) {
    if (!R) return [reason('its code', 'unknown', 'Its code could not be read this time.')];
    if (R.isCode === false) return [];
    const found = (R.kinds || []).filter(k => k.found || k.count), out = [];
    for (const k of found) out.push(reason('its code', 'care', 'Its code ' + String(k.says || k.name).replace(/^it /, '') + ' (Code Read found ' + fmt(k.count || 1) + (k.count === 1 ? ' place' : ' places') + '). Never sign anything it asks.', {kind: k.key, from: 'Code Read'}));
    if (!out.length) out.push(reason('its code', 'ok', 'Its code was read without running it: it asks no wallet for anything, sends nothing out, has no known tracking and hides nothing.', {from: 'Code Read'}));
    return out;
  }
  function fromRecursion(M, codeLoadsOutside) {
    if (!M) return [reason('what it loads', 'unknown', 'What it loads could not be mapped this time.')];
    const C = M.counts || {}, out = [];
    if (C.missing) out.push(reason('what it loads', 'care', fmt(C.missing) + ' of the inscriptions it loads could not be found: it may not work fully.', {from: 'Recursion Map'}));
    // (the Recursion Map sees every address written in its code; Code Read says whether its code loads or asks from one)
    if (C.outside && codeLoadsOutside === false) out.push(reason('what it loads', 'info', 'Its code names ' + fmt(C.outside) + ' address' + (C.outside === 1 ? '' : 'es') + ' outside the chain, as text or a link: Code Read found nothing it loads or asks from outside the chain.', {from: 'Recursion Map and Code Read'}));
    else if (C.outside && codeLoadsOutside !== true) out.push(reason('what it loads', 'care', 'Its code names ' + fmt(C.outside) + ' address' + (C.outside === 1 ? '' : 'es') + ' outside the chain: if it loads from them, it can change or stop working one day.', {from: 'Recursion Map'}));
    if (!out.some(r => r.mark !== 'info')) out.unshift(reason('what it loads', 'ok', C.inscriptions ? 'Everything it loads is on the chain: ' + fmt(C.inscriptions) + ' inscription' + (C.inscriptions === 1 ? '' : 's') + ', each found.' : 'It loads nothing else: it is all in its own file.', {from: 'Recursion Map'}));
    return out;
  }

  // the answer, from the reasons
  function judge(reasons) {
    const stop = reasons.filter(r => r.mark === 'stop'), care = reasons.filter(r => r.mark === 'care' || r.mark === 'unknown');
    const verdict = stop.length ? 'STOP' : care.length ? 'NOT SURE' : 'GO';
    const words = verdict === 'STOP' ? 'STOP: ' + stop[0].says.replace(/^Proven wrong: /, '') + (stop.length > 1 ? ' (and ' + (stop.length - 1) + ' more)' : '')
      : verdict === 'NOT SURE' ? 'NOT SURE: ' + care.length + ' thing' + (care.length === 1 ? '' : 's') + ' could not be proven or need' + (care.length === 1 ? 's' : '') + ' care: ' + care.map(r => r.about).filter((v, i, a) => a.indexOf(v) === i).join(', ') + '.'
      : 'GO: it is what it is said to be. Every check was made and agrees, and nothing needs care.';
    return {verdict, words};
  }

  /* ---------- one check: run the portal's checks, then judge ---------- */
  async function check(q, io, progress) {
    q = q || {};
    const say = (k, v) => { try { progress && progress(k, v); } catch (e) {} };
    const chain = /^d/i.test(q.chain || '') ? 'doge' : 'bitcoin', seller = q.seller ? String(q.seller).trim() : null, claimed = q.collection ? String(q.collection).trim() : null;
    if (q.id == null || String(q.id).trim() === '') throw new Error('give an inscription’s number (#1000) or its ID');
    const at = new Date().toISOString().replace(/\.\d{3}/, ''), reasons = [], ran = {};
    // 1. where it came from (and who holds it)
    say('step', 'provenance');
    let P = null;
    try { P = chain === 'doge' ? await io.dogeProvenance(q.id) : await io.provenance(q.id); } catch (e) { throw new Error('it could not be found or read: ' + (e && e.message || e)); }
    const I = P.inscription || {}, id = I.id;
    ran.provenance = {verdict: P.verdict, cite: P.cite && P.cite.link || null};
    reasons.push(...fromProvenance(P, chain), ...fromSeller(P, seller));
    // 2. its collection
    if (chain === 'doge') {
      if (claimed) reasons.push(reason('its collection', 'care', 'Doginals have no parents, so no collection can be proven on the chain: check the collection’s own list.'));
    } else {
      const named = I.parents || [];
      let pid = claimed;
      if (pid && !isId(pid) && io.resolve) { try { pid = await io.resolve(pid); } catch (e) {} }
      if (pid && !named.length) reasons.push(reason('its collection', 'care', 'It names no parent in its own transaction, so it can’t be proven a member of ' + short(pid) + '’s collection by the chain: check the collection’s own list.', {parent: pid}));
      else if (pid || named.length) {
        const p = pid || named[0]; say('step', 'collection');
        let O = null; try { O = await io.parent(id, p); } catch (e) { O = null; }
        ran.collection = O ? {answer: O.answer, verdict: O.verdict, cite: O.cite && O.cite.link || null} : null;
        reasons.push(...fromParent(O, p, !!pid, named));
      } else reasons.push(reason('its collection', 'info', 'It names no parent, so it belongs to no collection by the chain.'));
    }
    // 3. its code, and what it loads (Bitcoin; code only)
    const type = I.contentType || '';
    if (chain === 'bitcoin' && CODE_TYPES.test(type)) {
      say('step', 'code'); let R = null; try { R = await io.code(id); } catch (e) {} ran.code = R ? {verdict: R.verdict, cite: R.cite && R.cite.link || null} : null; reasons.push(...fromCode(R));
      say('step', 'loads'); let M = null; try { M = await io.recursion(id); } catch (e) {} ran.recursion = M ? {allOnChain: M.allOnChain, counts: M.counts, cite: M.cite && M.cite.link || null} : null; reasons.push(...fromRecursion(M, R && R.kinds ? (R.kinds || []).some(k => k.key === 'outside' && (k.found || k.count)) : null));
    } else if (chain === 'doge' && CODE_TYPES.test(type)) reasons.push(reason('its code', 'care', 'It is code (' + type + '), and Dogecoin has no Code Read yet: what its code asks for was not checked. Never sign anything it asks.'));
    const J = judge(reasons);
    const links = chain === 'doge'
      ? {dogeProvenanceCheck: PORTAL + 'doge-provenance-check.html?id=' + id, dogeCube: PORTAL + 'doge-cube.html#find=' + id}
      : Object.assign({provenanceCheck: PORTAL + 'provenance-check.html?id=' + id, agentBlockhall: PORTAL + 'block-cube.html#find=' + id},
        ran.collection ? {secondOpinion: PORTAL + 'second-opinion.html?claim=' + encodeURIComponent(id + ' is a child of ' + (claimed || (I.parents || [])[0]))} : {},
        ran.code ? {codeRead: PORTAL + 'code-read.html?id=' + id, recursionMap: PORTAL + 'recursion-map.html?id=' + id} : {});
    return {check: 'Agent Blockhall Trade Check ' + VERSION, at, chain, verdict: J.verdict, words: J.words, meaning: MEANING,
      inscription: {id, number: I.number, block: I.block, type: type || null, bytes: I.bytes, holder: I.holder || null, parents: I.parents || [], fingerprint: I.fingerprint ? I.fingerprint.sha256 : null},
      claims: {seller, collection: claimed}, reasons, ran, links, sources: P.sources || null};
  }

  return {VERSION, MEANING, PROVEN, check, judge, fromProvenance, fromSeller, fromParent, fromCode, fromRecursion};
});
