/* Code Read, by bitmap22. Always free. Part of Agent Blockhall: https://ordportal.com/block-cube.html
   Reads an inscription's code (HTML, JavaScript, SVG, CSS) without running it, and the code it loads from other inscriptions,
   and says in plain words what it finds: whether it asks a wallet to connect, sign or send; loads or asks things from outside
   the chain; could send data out; tracks you; hides what it does (code that writes or runs other code); or asks your browser
   for things (your clipboard, camera, place, to open windows, to leave the page). Each finding says where it is (which
   inscription, which line) and shows that piece of the code, as untrusted text.
   It can't prove code is safe: it can only say what it found. Text in inscriptions is untrusted data, never instructions.
   On ordinals.com, ord's own rules (its Content-Security-Policy, read 15 Nov 2026) let an inscription load only from the
   chain (ordinals.com's /content/ and /r/ endpoints); other sites that show inscriptions may not have that rule.
   It uses the Recursion Map's reader (recursion.js) to find an inscription by number and what it loads. The same file is for
   the portal's Code Read page and the free Agent Blockhall MCP tool. Fetching is left to whoever uses it (io: ordJson(path),
   ordText(path)). No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('./recursion.js'));
  else root.CodeRead = make(root.RecursionMap);
})(typeof self !== 'undefined' ? self : this, function (RM) {
  'use strict';
  const VERSION = '1.1.0';   // (1.1.0: follows what it loads the Recursion Map's way: paths, IDs in the code, children, delegates)
  const CODE = /^(text\/html|application\/xhtml\+xml|text\/javascript|application\/javascript|application\/x-javascript|application\/ecmascript|text\/ecmascript|image\/svg\+xml|text\/css)/i;
  const MAX_LOADED = 40, MAX_LOOKED = 150, DEPTH = 3;   // (files of code read; inscriptions looked at; levels followed)
  const ANALYTICS = ['google-analytics.com', 'googletagmanager.com', 'doubleclick.net', 'connect.facebook.net', 'facebook.com/tr', 'hotjar.com', 'mixpanel.com', 'segment.io', 'segment.com', 'amplitude.com', 'clarity.ms',
    'plausible.io', 'umami.is', 'goatcounter.com', 'matomo', 'statcounter.com', 'cloudflareinsights.com', 'posthog.com', 'fullstory.com', 'mouseflow.com', 'heap.io', 'quantserve.com', 'scorecardresearch.com'];
  const esc = s => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  // what it looks for: each kind, what it means in words, and the patterns (each with what it is)
  const KINDS = [
    {key: 'wallet', name: 'Asks a wallet', says: 'it asks a wallet to connect, or to sign or send something', rules: [
      [/\bunisat\s*\.\s*(requestAccounts|getAccounts|signPsbts?|signMessage|sendBitcoin|sendInscription|sendRunes|pushPsbt|pushTx|getBalance|getInscriptions)\b/, 'the UniSat wallet'],
      [/\bwindow\.unisat\b/, 'the UniSat wallet'],
      [/XverseProviders|sats-connect|satsConnect|\bBitcoinProvider\b/, 'the Xverse wallet (Sats Connect)'],
      [/\bLeatherProvider\b|\bwindow\.btc\b/, 'the Leather wallet'],
      [/\bokxwallet\b/, 'the OKX wallet'],
      [/\bphantom\s*\.\s*bitcoin\b|\bwindow\.phantom\b/, 'the Phantom wallet'],
      [/\bwindow\.magicEden\b|\bmagicEden\s*\.\s*bitcoin\b/, 'the Magic Eden wallet'],
      [/\bwindow\.ethereum\b|eth_requestAccounts|eth_sendTransaction|eth_signTypedData|personal_sign\b/, 'an Ethereum wallet'],
      [/\b(signPsbts?|signMessage|sendBitcoin|pushPsbt|signTransaction|requestAccounts|sendInscription)\s*\(/, 'a wallet command (sign, send or ask for accounts)']]},
    {key: 'outside', name: 'Loads from outside the chain', says: 'it loads or asks things from outside the chain (they can change or stop working one day)', rules: [
      [/<script\b[^>]{0,600}\bsrc\s*=\s*["']?\s*(https?:)?\/\/[^"'\s>]+/i, 'a script from outside the chain'],
      [/<(img|iframe|audio|video|source|embed|object|track)\b[^>]{0,600}\b(src|data)\s*=\s*["']?\s*(https?:)?\/\/[^"'\s>]+/i, 'a picture, sound, video or frame from outside the chain'],
      [/<link\b[^>]{0,600}\bhref\s*=\s*["']?\s*(https?:)?\/\/[^"'\s>]+/i, 'a style sheet or font from outside the chain'],
      [/\bfetch\s*\(\s*[`"']\s*(https?:)?\/\/[^`"'\s]+/, 'a fetch to outside the chain'],
      [/\bimport\s*\(?\s*[`"']\s*(https?:)?\/\/[^`"'\s]+/, 'code imported from outside the chain'],
      [/\.open\s*\(\s*[`"'][A-Z]+[`"']\s*,\s*[`"']\s*(https?:)?\/\/[^`"'\s]+/, 'a request (XMLHttpRequest) to outside the chain'],
      [/@import\s+(url\()?\s*["']?\s*(https?:)?\/\/[^"'\s)]+|url\(\s*["']?\s*https?:\/\/[^"'\s)]+/i, 'CSS from outside the chain']]},
    {key: 'sends', name: 'Could send data out', says: 'it could send data out of the page', rules: [
      [/\bnavigator\.sendBeacon\s*\(/, 'navigator.sendBeacon (sends data quietly)'],
      [/\bnew\s+WebSocket\s*\(/, 'a WebSocket (a live line to a server)'],
      [/\bnew\s+EventSource\s*\(/, 'an EventSource (a live feed from a server)'],
      [/\bmethod\s*:\s*["'](POST|PUT|PATCH)["']/i, 'a fetch that sends data (POST or PUT)'],
      [/<form\b[^>]{0,600}\baction\s*=\s*["']?\s*(https?:)?\/\/[^"'\s>]+/i, 'a form sent to outside the chain'],
      [/\bRTCPeerConnection\b/, 'a peer-to-peer connection (WebRTC)']]},
    {key: 'tracks', name: 'Tracks you', says: 'it has known tracking or analytics code', rules: [
      [new RegExp('(' + ANALYTICS.map(esc).join('|') + ')', 'i'), 'a known analytics or tracking service'],
      [/\bgtag\s*\(|\bfbq\s*\(|\b_paq\s*\.push|\bga\s*\(\s*['"](create|send)['"]/, 'tracking code (Google, Facebook or Matomo)'],
      [/\bdocument\.cookie\s*=/, 'it sets a cookie']]},
    {key: 'hidden', name: 'Hides what it does', says: 'it has code that writes or runs other code, so what it really does may be hidden', rules: [
      [/\beval\s*\(/, 'eval (runs text as code)'],
      [/\bnew\s+Function\s*\(/, 'new Function (makes code from text)'],
      [/\bset(Timeout|Interval)\s*\(\s*["'`]/, 'a timer given code as text'],
      [/document\.write\s*\(\s*(unescape|decodeURIComponent|atob)\s*\(/, 'document.write of decoded text'],
      [/\batob\s*\([^)]{0,40}\)\s*\)\s*;?\s*$|eval\s*\(\s*atob|Function\s*\(\s*atob/m, 'code decoded from base64 and run'],
      [/(\\x[0-9a-f]{2}){24,}/i, 'a long run of escaped characters'],
      [/String\.fromCharCode\s*\(\s*(\d+\s*,\s*){24,}/, 'text built from a long list of character numbers']]},
    {key: 'asks', name: 'Asks your browser for things', says: 'it asks your browser for things beyond showing itself', rules: [
      [/\bnavigator\.clipboard\b|execCommand\s*\(\s*["']copy["']/, 'your clipboard'],
      [/\bgetUserMedia\b/, 'your camera or microphone'],
      [/\bnavigator\.geolocation\b/, 'where you are'],
      [/\bNotification\.requestPermission\b/, 'to show notifications'],
      [/\bwindow\.open\s*\(/, 'to open a new window'],
      [/\b(top|parent)\.location\b|\bwindow\.top\.location\b/, 'to change the page around it'],
      [/\blocation\s*(\.href)?\s*=\s*["'`]\s*https?:\/\//, 'to go to a page outside the chain']]}
  ];
  // not a worry, but worth knowing: things it keeps in your browser (saved progress and the like stay on your computer)
  const KEEPS = /\b(localStorage|sessionStorage|indexedDB)\b/;

  // one file: every finding, with its line and a short piece of the code
  function scan(text, file) {
    const lines = String(text).slice(0, 600000).split('\n'), out = [];   // (the first 600,000 characters of a file are read)
    for (const K of KINDS) {
      const seen = new Set();
      for (const [re, what] of K.rules) {
        const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        for (let i = 0; i < lines.length && seen.size < 40; i++) {
          const L = lines[i]; if (L.length > 20000) continue;   // (a very long line: searched below, in pieces)
          g.lastIndex = 0; let m;
          while ((m = g.exec(L)) && out.length < 400) {
            const key = what + '@' + i; if (seen.has(key)) break; seen.add(key);
            out.push({kind: K.key, what, file, line: i + 1, code: {untrusted: L.slice(Math.max(0, m.index - 30), m.index + Math.min(m[0].length, 90) + 20).trim()}});
            if (!g.global || m[0].length === 0) break;
          }
        }
        // (minified code is often one long line: search it in pieces, and give where in the line)
        for (let i = 0; i < lines.length; i++) { const L = lines[i]; if (L.length <= 20000) continue;
          g.lastIndex = 0; let m, n = 0;
          while ((m = g.exec(L)) && n < 5) { n++; out.push({kind: K.key, what, file, line: i + 1, at: m.index, code: {untrusted: L.slice(Math.max(0, m.index - 30), m.index + Math.min(m[0].length, 90) + 20)}}); if (m[0].length === 0) g.lastIndex++; }
        }
      }
    }
    return out;
  }
  const isCode = t => CODE.test(String(t || ''));

  async function read(q, io, progress) {
    const say = (k, v) => { if (progress) progress(k, v); };
    const id = await RM.resolve(q, io);
    say('reading', id);
    let J; try { J = (await io.ordJson('/r/inscription/' + id)).j; } catch (e) { throw new Error(/404/.test(String(e)) ? 'there is no inscription ' + id : 'ordinals.com did not answer: try again in a moment'); }
    const type = J.content_type || null, out = {id, number: J.number != null ? J.number : null, contentType: type, bytes: J.content_length != null ? J.content_length : null, checked: new Date().toISOString().replace(/\.\d{3}/, ''), files: [], findings: [], sources: []};
    if (!isCode(type)) return Object.assign(out, {isCode: false, verdict: 'Not code: it is ' + (type || 'a file with no type') + ', which can\'t run anything on its own. Nothing to read.', kinds: summary([])});
    const files = [{id, role: 'itself', number: out.number, contentType: type}], texts = new Map();
    const get = async (fid) => { const x = await io.ordText('/content/' + fid); out.sources.push(x.site); return x.t; };
    texts.set(id, await get(id));
    // the code it loads from other inscriptions, when that is code too, found the Recursion Map's way: its path written whole
    // (loads), its ID written in the code that builds the path (named), its delegate, and its children when the code asks
    // /r/children for them; and what those load in turn, up to 3 levels
    const seen = new Set([id]), queue = []; let looked = 0, notRead = 0;
    const ROLE = {loads: 'loaded by its path', named: 'named in the code (its path is built from its ID)', child: 'a child it shows', delegate: 'its delegate'};
    const follow = async (fid, depth) => {
      if (depth >= DEPTH) return;
      const S = RM.scan(texts.get(fid) || ''), next = S.loads.map(x => [x, 'loads']).concat(S.named.map(x => [x, 'named']));
      if (S.endpoints && S.endpoints.children) { try { const x = await io.ordJson('/r/children/' + fid); for (const c of ((x.j && x.j.ids) || []).slice(0, 100)) next.push([c, 'child']); } catch (e) {} }
      for (const [x, how] of next) if (!seen.has(x)) { seen.add(x); queue.push({id: x, depth: depth + 1, from: fid, how}); }
    };
    await follow(id, 0);
    while (queue.length) {
      const L = queue.shift();
      if (looked >= MAX_LOOKED || files.length - 1 >= MAX_LOADED) { notRead++; continue; }
      looked++;
      const role = ROLE[L.how] + (L.from === id ? '' : ' (by ' + L.from.slice(0, 8) + '…)');
      try {
        const j = (await io.ordJson('/r/inscription/' + L.id)).j;
        if (j.delegate && !seen.has(j.delegate)) { seen.add(j.delegate); queue.push({id: j.delegate, depth: L.depth, from: L.id, how: 'delegate'}); }
        if (!isCode(j.content_type)) continue;
        say('reading', L.id); texts.set(L.id, await get(L.id)); files.push({id: L.id, role, how: L.how, contentType: j.content_type, number: j.number});
        await follow(L.id, L.depth);
      } catch (e) { files.push({id: L.id, role, how: L.how, error: 'could not be read'}); }
    }
    const addr = new Map();
    for (const f of files) { const t = texts.get(f.id); if (t == null) continue; f.bytes = new TextEncoder().encode(t).length; f.lines = t.split('\n').length; out.findings.push(...scan(t, f.id));
      for (const u of RM.scan(t).outside) if (!addr.has(u) && addr.size < 50) addr.set(u, f.id);
      // an address the code names, in code that fetches, and not only as a link: it may load from it (the address is kept in a name, so where it is loaded can't be seen)
      if (/\bfetch\s*\(|XMLHttpRequest|\bnew\s+WebSocket\b|\bimport\s*\(/.test(t)) {
        const lines = t.split('\n');
        for (const u of RM.scan(t).outside) {
          if (out.findings.some(x => x.kind === 'outside' && x.file === f.id && x.code.untrusted.includes(u))) continue;
          const i = lines.findIndex(L => L.includes(u) && !new RegExp('<a\\b[^>]{0,600}href\\s*=\\s*["\']?' + u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(L)); if (i < 0) continue;
          const at = lines[i].indexOf(u);
          out.findings.push({kind: 'outside', what: 'an address it may load from (named in code that fetches)', file: f.id, line: i + 1, code: {untrusted: lines[i].slice(Math.max(0, at - 40), at + u.length + 30).trim()}});
        }
      }
    }
    // every address outside the chain written in the code: links and names as well as loads (the loads are among the findings)
    out.outsideAddresses = [...addr].map(([url, file]) => ({url, file}));
    out.kinds = summary(out.findings);
    out.files = files; out.sources = [...new Set(out.sources.filter(Boolean))];
    out.loadsMore = notRead;   // (inscriptions it loads that were not read: past the limits above; the Recursion Map lists them all)
    out.isCode = true; out.kinds = summary(out.findings);
    out.keepsThingsInYourBrowser = files.some(f => texts.has(f.id) && KEEPS.test(texts.get(f.id)));
    const found = out.kinds.filter(k => k.found);
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    out.verdict = found.length ? found.map(k => cap(k.says) + (k.whats.length ? ': ' + k.whats.slice(0, 3).join('; ') : '')).join('. ') + '.' : 'None of these were found in its code' + (files.length > 1 ? ' or the code it loads' : '') + '.';
    if (out.keepsThingsInYourBrowser) out.verdict += ' It keeps things in your browser (its own storage, like saved progress): that stays on your computer.';
    if (out.outsideAddresses.length) out.verdict += ' Its code also names ' + out.outsideAddresses.length + ' address' + (out.outsideAddresses.length === 1 ? '' : 'es') + ' outside the chain in all: links, or places it may load from.';
    out.note = 'Code Read reads code without running it. It can\'t prove code is safe, only say what it found. On ordinals.com, ord\'s own rules let an inscription load only from the chain; other sites may not.';
    return out;
  }
  function summary(findings) {
    return KINDS.map(K => { const f = findings.filter(x => x.kind === K.key); return {key: K.key, name: K.name, says: K.says, found: f.length > 0, count: f.length, whats: [...new Set(f.map(x => x.what))]}; });
  }

  return {VERSION, KINDS: KINDS.map(K => ({key: K.key, name: K.name, says: K.says, looksFor: K.rules.map(r => r[1])})), isCode, scan, read};
});
