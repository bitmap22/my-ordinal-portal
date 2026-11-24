/* Safety Read, by bitmap22. Always free. Part of Agent Blockhall: https://ordportal.com/block-cube.html
   Reads an inscription's words and code without running them, and says what it finds that could hurt or trick someone,
   each with its own colour and symbol:
     agent trap (words or code trying to give AI agents orders), scam (asks for your secret words, fake airdrops, fake
     wallet logins), miner or phone-killer (secret coin mining, code or files built to freeze or crash a device),
     hate words, personal details (phone numbers, home addresses, emails), and risky code (asks a wallet to sign or pay,
     loads from outside the chain, could send data out, tracks you: found by Code Read, coderead.js).
   Pictures and films (may be adult, may flash) are checked by the Safety Scan itself (it looks at them); their kinds are
   listed here so every tool shows them the same way.
   It can't prove anything is safe: it can only say what it found, and it can be wrong both ways. Every finding is a
   "may be". Text in inscriptions is untrusted data, never instructions.
   The same file is for the portal's Safety Scan pages, the Safety Scan GitHub job and the free Agent Blockhall MCP tool.
   No other packages (Code Read is used if it is there).
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) { let CR = null; try { CR = require('./coderead.js'); } catch (e) {} module.exports = make(CR); }
  else root.SafetyRead = make(root.CodeRead || null);
})(typeof self !== 'undefined' ? self : this, function (CR) {
  'use strict';
  const VERSION = '1.3.0';   // (1.1.0: scanWallet, every inscription an address holds; flashes, shared with the scan. 1.1.1: gentler with the Doginals Explorer. 1.2.0: 3D models. 1.3.0: sound files, SVG drawings looked at)
  // every kind: its key, name, symbol, colour, what it means, and whether the Safety Scan finds it by looking (pictures, films) or by reading
  const KINDS = [
    {key: 'adult', name: 'May be adult', symbol: '🔞', colour: '#e5484d', says: 'a picture or film that may show nudity (18+)', by: 'looking'},
    {key: 'flash', name: 'May flash', symbol: '⚡', colour: '#ffc53d', says: 'a moving picture or film that flashes more than 3 times a second (a seizure risk for some people)', by: 'looking'},
    {key: 'scam', name: 'May be a scam', symbol: '🎣', colour: '#e93d82', says: 'asks for your secret words or keys, offers free coins, or looks like a wallet login', by: 'reading'},
    {key: 'agent', name: 'Agent trap', symbol: '🤖', colour: '#9e6cf2', says: 'words or code that try to give AI agents orders, or hide instructions for them', by: 'reading'},
    {key: 'code', name: 'Risky code', symbol: '⚠️', colour: '#f5a524', says: 'asks a wallet to sign or pay, loads from outside the chain, could send data out, or tracks you', by: 'reading'},
    {key: 'miner', name: 'Miner or phone-killer', symbol: '⛏️', colour: '#12a594', says: 'may secretly mine coins, or is built to freeze or crash a device', by: 'reading'},
    {key: 'hate', name: 'Hate words', symbol: '🚫', colour: '#a1a1aa', says: 'has words or slogans used to attack people for who they are', by: 'reading'},
    {key: 'personal', name: 'Personal details', symbol: '📇', colour: '#3e9cfe', says: 'shows a phone number, home address or email (could be someone being exposed)', by: 'reading'}];
  const KIND = Object.fromEntries(KINDS.map(K => [K.key, K]));
  const CODE = /^(text\/html|application\/xhtml\+xml|text\/javascript|application\/javascript|application\/x-javascript|application\/ecmascript|text\/ecmascript|image\/svg\+xml|text\/css)/i;
  const TEXTY = /^(text\/|application\/(json|xml|xhtml\+xml|javascript|x-javascript|ecmascript|ld\+json|yaml|toml)|image\/svg\+xml)/i;

  // ----- what it reads for -----
  const RULES = {
    agent: [
      [/\b(ignore|disregard|forget|override|bypass)\s+(all\s+|any\s+|the\s+|your\s+)*(previous|prior|above|earlier|preceding|system|original|existing)\s+(instructions?|prompts?|rules?|guidelines?|directions?|messages?)/i, 'tells an AI to ignore its instructions'],
      [/\b(new|updated|real|secret|hidden|important)\s+(system\s+)?(instructions?|orders?|directives?)\s*(for\s+(the\s+)?(ai|agent|assistant|llm|model|bot)s?)?\s*:/i, 'gives "new instructions"'],
      [/\b(attention|note|message|instructions?)\s+(to|for)\s+(any\s+|all\s+|the\s+)?(ai|a\.i\.|agents?|assistants?|llms?|language models?|chatbots?|claude|chatgpt|gpt|gemini|copilot|grok)\b/i, 'speaks to AI agents directly'],
      [/\b(you are now|from now on,? you( are| will| must)?|act as|pretend (to be|you are)|you must now|your new (role|task|goal) is)\b[^.\n]{0,60}\b(ai|a\.i\.|assistant|agent|model|chatbot|bot|mode|dan|jailbr\w*|unrestricted|unfiltered|uncensored|developer mode)\b/i, 'tries to change what an AI is or does'],
      [/\b(do not|don't|never)\s+(tell|inform|show|mention|reveal|let)\s+(this\s+to\s+)?(the\s+)?(user|human|owner|person)\b/i, 'tells an AI to hide something from its user'],
      [/<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|assistant\|>|\[\/?INST\]|<<\/?SYS>>|<\/?(system|assistant|tool_call|function_call)>|^\s*(system|assistant)\s*:/im, 'copies the hidden markers chat AIs use'],
      [/\b(reveal|print|show|output|repeat|leak)\s+(your\s+|the\s+)(system\s+prompt|hidden\s+prompt|instructions|api\s+keys?|secrets?|seed|private\s+keys?)/i, 'asks an AI to give away its secrets'],
      [/\b(agents?|assistants?|ai)\s+(must|should|shall|will)\s+(now\s+|immediately\s+|always\s+)?(send|transfer|sign|approve|pay|delete|execute|connect\s+(the\s+|a\s+|your\s+)?wallet|reveal|ignore|disregard)\b/i, 'orders AI agents to act'],
      [/\bnavigator\s*\.\s*modelContext\b|\bmodelContext\s*\.\s*(registerTool|provideContext|unregisterTool|clearContext)\b|\bregisterTool\s*\(/, 'code that offers tools to AI agents in the browser (WebMCP)'],
      [/\bwindow\s*\.\s*(agent|ai|claude|openai|anthropic|mcp)\b(?!\s*=)|\b(LanguageModel|ai\s*\.\s*languageModel)\s*\.\s*(create|availability|capabilities)\b|\bself\s*\.\s*ai\s*\.\s*/, 'code that reaches for an AI agent or the browser\'s AI'],
      [/["']method["']\s*:\s*["'](tools\/call|tools\/list|resources\/read|prompts\/get|sampling\/createMessage)["']/, 'speaks the AI tool language (MCP) to agents'],
      [/[\u{E0000}-\u{E007F}]/u, 'hidden letters only machines can read (Unicode tag letters)'],
      [/[​-‏⁠-⁤﻿]{6,}/, 'a run of invisible letters']],
    scam: [
      [/\b(enter|type|paste|input|submit|verify|confirm|import|share|provide|send|write)\s+(in\s+)?(your|the|a)?\s*(12|24|twelve|twenty[- ]four|18)?[- ]?(word\s+)?(seed|secret|recovery|mnemonic|backup|wallet)\s+(phrase|words?|key)/i, 'asks you to type in your secret words'],
      [/\b(seed|recovery|mnemonic|secret)\s+phrase\b[\s\S]{0,400}<(input|textarea)\b|<(input|textarea)\b[\s\S]{0,400}\b(seed|recovery|mnemonic|secret)\s+phrase\b/i, 'a box to type secret words into'],
      [/\b(enter|paste|import|provide|send)\s+(your\s+)?(private\s+key|wif\s+key|xprv|keystore)/i, 'asks for your private key'],
      [/\bclaim\s+(your\s+)?(free\s+)?(airdrop|reward|prize|bonus|tokens?|bitcoin|btc|sats|ordinals?|nfts?|allocation|whitelist)\b/i, 'offers free coins or prizes to claim'],
      [/\b(you\s+(have\s+)?(won|been\s+(selected|chosen))|congratulations[!,.]?\s+you)\b/i, 'says you have won'],
      [/\b(double|2x|triple|3x)\s+your\s+(btc|bitcoin|crypto|coins?|sats|money|doge)\b|\bsend\s+[\d.]+\s*(btc|bitcoin|doge|sats)[\s\S]{0,80}\b(get|receive)\b[\s\S]{0,40}\b(back|double|2x)\b/i, 'promises to multiply your coins'],
      [/\b(connect|validate|verify|sync|synchroni[sz]e|rectify|restore|unlock|migrate)\s+(your\s+)?wallet\b[\s\S]{0,600}<(input|form)\b/i, 'a "fix your wallet" form'],
      [/<form\b[^>]{0,600}\baction\s*=\s*["']?\s*(https?:)?\/\//i, 'a form that sends what you type to another site'],
      [/<input\b[^>]{0,600}\btype\s*=\s*["']?password/i, 'a password box'],
      [/\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|rb\.gy|tiny\.cc)\/[A-Za-z0-9]+/i, 'a hidden-address short link']],
    miner: [
      [/\b(coin-?hive|cryptonight|coinimp|crypto-?loot|webminepool|minero\.cc|jsecoin|deepminer|cryptoloot|webmine\.pro|monerominer|xmrig|nicehash|minergate)\b|stratum\+(tcp|ssl):\/\//i, 'a known coin-mining tool'],
      [/\bnew\s+(Worker|SharedWorker)\s*\([\s\S]{0,400}\b(hashrate|hashes per second|mining|miner|cryptonight|stratum)\b/i, 'starts background workers that mine (may be mining)'],
      [/\bwhile\s*\(\s*(true|1|!0|!!1)\s*\)\s*(\{\s*\}|;)/, 'a loop that never ends (freezes the page)'],
      [/\bwhile\s*\(\s*(true|1|!0|!!1)\s*\)\s*\{[^}]{0,200}\b(window\.open|alert|confirm|prompt|history\.pushState|location\s*=)/, 'opens windows or boxes forever'],
      [/\bfor\s*\(\s*;\s*;\s*\)\s*(\{\s*\}|;)/, 'a loop that never ends (freezes the page)'],
      [/\.repeat\s*\(\s*(\d{8,}|\d+e[7-9]|\d+e\d{2,}|2\s*\*\*\s*(2[7-9]|[3-9]\d))\s*\)/i, 'makes a giant string (fills memory)'],
      [/\bnew\s+(Array|ArrayBuffer|SharedArrayBuffer|(Uint|Int|Float)(8|16|32|64)Array|BigInt64Array)\s*\(\s*(\d{9,}|\d+e(9|\d{2,})|2\s*\*\*\s*(3[0-9]|[4-9]\d))\s*\)/i, 'asks for a giant block of memory'],
      [/<!ENTITY\s+\w+\s+["'](&\w+;){4,}/i, 'nested entities that blow up when opened (a "billion laughs")'],
      [/\bsetInterval\s*\(\s*(function\s*\(\s*\)\s*\{|\(\s*\)\s*=>\s*\{?)\s*[^}]{0,80}\bwindow\.open\b/, 'keeps opening new windows']],
    hate: [],
    // outside loads Code Read doesn't look for: an SVG's own pictures and patterns, and CSS backgrounds and fonts from the web
    code: [
      [/<(image|use|feImage|pattern)\b[^>]{0,600}\b(xlink:)?href\s*=\s*["']?\s*(https?:)?\/\//i, 'a drawing (SVG) that loads from outside the chain'],
      [/\burl\(\s*["']?\s*(https?:)?\/\/[^)]+\)/i, 'a style that loads from outside the chain'],
      [/@import\s+(url\()?\s*["']?\s*(https?:)?\/\//i, 'a style sheet from outside the chain']]};
  // hate words and slogans: kept encoded so the list isn't shown as plain words in the page
  const HATE = 'bmlnZ2VyfG5pZ2dlcnN8bmlnZ2F8bmlnZ2FzfGtpa2V8a2lrZXN8c3BpY3xzcGljc3x3ZXRiYWNrfHdldGJhY2tzfGNoaW5rc3xnb29rfGdvb2tzfHJhZ2hlYWR8cmFnaGVhZHN8dG93ZWxoZWFkfHRvd2VsaGVhZHN8c2FuZG5pZ2dlcnxwYWtpfHBha2lzfGZhZ2dvdHxmYWdnb3RzfHRyYW5ueXx0cmFubmllc3xkYXJraWV8ZGFya2llc3xqdW5nbGUgYnVubnl8cG9yY2ggbW9ua2V5fGhlaWwgaGl0bGVyfHNpZWcgaGVpbHx3aGl0ZSBwb3dlcnwxNDg4fGdhcyB0aGUgamV3c3xqZXdzIHdpbGwgbm90IHJlcGxhY2UgdXN8d2hpdGUgZ2Vub2NpZGV8cmFjZSB3YXIgbm93fGtpbGwgYWxsIChqZXdzfGJsYWNrc3xtdXNsaW1zfGdheXN8aW1taWdyYW50cyl8c3ViaHVtYW5z';
  const b64 = s => typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('latin1');
  RULES.hate.push([new RegExp('(^|[^a-z0-9])(' + b64(HATE) + ')(?=$|[^a-z0-9])', 'i'), 'a hate word or slogan']);
  const PERSONAL = [
    [/(^|[^\w+])(\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}(?!\d)/, 'a UK mobile number'],
    [/(^|[^\w])(\+?1[\s.-]?)?\(\d{3}\)\s?\d{3}[\s.-]\d{4}(?!\d)|(^|[^\w.-])\d{3}-\d{3}-\d{4}(?![\d-])/, 'a phone number'],
    [/(^|[^\w])\+(?!44\s?7)\d{1,3}[\s-]\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}(?!\d)/, 'a phone number'],
    [/\b\d{1,5}\s+([A-Z][a-z]+\s){1,3}(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Way|Crescent|Boulevard|Blvd|Court|Ct|Terrace|Gardens|Grove)\b\.?/, 'a street address'],
    [/\b(GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2})\b/, 'a UK postcode'],
    [/\b[A-Za-z0-9._%+-]{2,64}@(?!(example|test|domain|email|sentry|w3)\.)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(com|net|org|co\.uk|uk|io|me|de|fr|jp|cn|ru|xyz|info|app|dev|ai)\b/, 'an email address']];

  // ----- reading -----
  const cut = (s, i, n) => s.slice(Math.max(0, i - 30), i + Math.min(n, 90) + 20).replace(/\s+/g, ' ').trim();
  function visible(html) {   // the words a person would see (scripts, styles, comments and tags taken out), read in one pass so no text can make it slow
    const s = String(html), low = s.toLowerCase(); let o = '', i = 0;
    for (;;) {
      const lt = s.indexOf('<', i); if (lt < 0) { o += s.slice(i); break; }
      o += s.slice(i, lt);
      if (low.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); o += ' '; if (e < 0) break; i = e + 3; continue; }
      const b = /^<(script|style|noscript|template)\b/.exec(low.slice(lt, lt + 12));
      if (b) { const e = low.indexOf('</' + b[1], lt + 1); o += ' '; if (e < 0) break; const gt = s.indexOf('>', e); if (gt < 0) break; i = gt + 1; continue; }
      const gt = s.indexOf('>', lt + 1); if (gt < 0) { o += s.slice(lt); break; }   // (a < with no > after it: kept as text)
      o += ' '; i = gt + 1;
    }
    return o
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ');
  }
  // text hidden from people but there for machines: HTML comments, hidden elements, tiny or invisible text, alt and title words
  function hiddenBits(html) {
    const out = [], s = String(html).slice(0, 300000);
    for (let i = 0; out.length < 200;) { const a = s.indexOf('<!--', i); if (a < 0) break; const e = s.indexOf('-->', a + 4); if (e < 0) break; out.push(s.slice(a + 4, Math.min(e, a + 20004))); i = e + 3; }   // (comments, read in one pass)
    for (const m of s.matchAll(/<(\w+)\b[^>]{0,600}\b(hidden|aria-hidden\s*=\s*["']?true|style\s*=\s*["'][^"']{0,600}(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(px|pt|em|rem)?\b|opacity\s*:\s*0(\.0+)?\s*[;"']|color\s*:\s*transparent|left\s*:\s*-\d{3,}px|clip\s*:\s*rect\(0))[^>]{0,600}>([\s\S]{1,2000}?)<\/\1>/gi)) out.push(m[6] || '');
    for (const m of s.matchAll(/\b(alt|title|aria-label|content|data-[\w-]+)\s*=\s*["']([^"']{20,1000})["']/gi)) out.push(m[2]);
    return out.join('\n');
  }
  function run(rules, text, kind, file, out, extra) {
    const s = String(text);
    for (const [re, what] of rules) {
      const g = new RegExp(re.source, re.flags.replace('g', '') + 'g'); let m, n = 0;
      while ((m = g.exec(s)) && n < 3 && out.length < 200) {
        n++; const line = s.slice(0, m.index).split('\n').length;
        out.push(Object.assign({kind, what, file, line, sample: {untrusted: cut(s, m.index, m[0].length)}}, extra || {}));
        if (m[0].length === 0) g.lastIndex++;
      }
    }
  }
  /* read(contentType, text, file): what it finds in one inscription's words or code.
     file: its inscription id (or a name). Gives [{kind, what, file, line, sample: {untrusted}, hidden?}] */
  function read(contentType, text, file) {
    const ty = String(contentType || '').split(';')[0].trim().toLowerCase(), s = String(text || '').slice(0, 300000), out = [];   // (the first 300,000 characters are read)
    if (!s || !TEXTY.test(ty) && !/^\s*[<{[]|^[\x09\x0a\x0d\x20-\x7e -￿]{20,}$/.test(s.slice(0, 200))) return out;
    if (/json/.test(ty) && /^\s*\{\s*"p"\s*:\s*"(brc-20|brc20|drc-20|tap|sns|orc-20|src-20|bitmap)"/i.test(s) && s.length < 600) return out;   // (a token or name line: nothing to read)
    const isHtml = /html|svg|xml/.test(ty) || /^\s*<(!doctype|html|svg|body|div|script)/i.test(s), code = CODE.test(ty) || isHtml;
    const seen = isHtml ? visible(s) : s;
    run(RULES.agent, s, 'agent', file, out);
    if (isHtml) { const h = hiddenBits(s); if (h.trim()) { const before = out.length; run(RULES.agent.slice(0, 8), h, 'agent', file, out, {hidden: true}); const hid = new Set(); for (let i = before; i < out.length; i++) { hid.add(out[i].what); out[i].what += ' (hidden from people)'; } for (let i = before - 1; i >= 0; i--) if (out[i].kind === 'agent' && hid.has(out[i].what)) out.splice(i, 1); } }
    run(RULES.scam, s, 'scam', file, out);
    if (code) run(RULES.miner, s, 'miner', file, out);
    run(RULES.hate, seen, 'hate', file, out);
    if (!code || isHtml) run(PERSONAL, seen, 'personal', file, out);
    if (code) run(RULES.code, s, 'code', file, out);
    if (code && CR && typeof CR.scan === 'function') {
      for (const f of CR.scan(s, file)) if (/^(wallet|outside|sends|tracks)$/.test(f.kind) && out.filter(x => x.kind === 'code').length < 12)
        out.push({kind: 'code', what: f.what, file, line: f.line, sample: f.code || {untrusted: ''}, codeRead: f.kind});
    }
    // what it shows of personal details and hate words is masked, so the scan never spreads them further
    const HRE = new RegExp(RULES.hate[0][0].source, 'gi');
    for (const f of out) {
      if (f.kind === 'personal') f.sample = {untrusted: f.sample.untrusted.replace(/\d/g, '•').replace(/[A-Za-z0-9._%+-]{2,64}@/g, '•••@').replace(/\b([A-Z][a-z]+)(\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Way|Crescent|Boulevard|Blvd|Court|Ct|Terrace|Gardens|Grove)\b)/g, '•••$2').replace(/\b([A-Z]{1,2})\d[A-Z\d]? ?\d[A-Z]{2}\b/g, '$1•• •••'), masked: true};
      if (f.kind === 'hate') f.sample = {untrusted: f.sample.untrusted.replace(HRE, (m, a, w) => a + w[0] + '•'.repeat(Math.max(2, w.length - 1))), masked: true};
    }
    // the same thing found twice on one line is one finding
    const keep = new Map(); for (const f of out) { const k = f.kind + '|' + f.what + '|' + f.line; if (!keep.has(k)) keep.set(k, f); }
    return [...keep.values()];
  }
  /* ---------- 3D models (glTF and GLB, STL, OBJ): read as data, never shown or run ----------
     readModel(type, bytes): {model: 'GLB'|'glTF'|'STL'|'OBJ'|null, finds[], pictures[{type, bytes, where}], triangles, points}
     finds: loads from outside the chain (code), too big for a phone (miner), and words written inside it (agent traps, scams, hate
     words, personal details). pictures: the pictures packed inside it (its "skins"), for the picture checker to look at. */
  const MBIG_TRIS = 3e6, MBIG_POINTS = 5e6, MBIG_BYTES = 2e8;
  const u8s = (u, a, b) => { let t = ''; for (let i = a; i < b && i < u.length; i++) t += String.fromCharCode(u[i]); return t; };
  const le32 = (u, p) => (u[p] | u[p + 1] << 8 | u[p + 2] << 16 | u[p + 3] << 24) >>> 0;
  const utf8 = u => new TextDecoder().decode(u);
  const outside = x => /^\s*(https?:)?\/\//i.test(String(x || ''));
  function modelKind(type, u) {
    const t = String(type || '').split(';')[0].trim().toLowerCase();
    if (u.length >= 12 && u8s(u, 0, 4) === 'glTF') return 'GLB';
    if (/gltf/.test(t) || /^\s*\{/.test(u8s(u, 0, 64)) && /"asset"\s*:/.test(u8s(u, 0, 4000))) { if (/^\s*\{/.test(u8s(u, 0, 64))) return 'glTF'; }
    if (/stl|sla/.test(t)) return 'STL';
    if (/obj/.test(t)) return 'OBJ';
    if (/^model\//.test(t)) { if (u.length >= 84 && 84 + le32(u, 80) * 50 === u.length) return 'STL'; if (/^solid\s/.test(u8s(u, 0, 6))) return 'STL'; }
    return null;
  }
  function readModel(type, bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), out = {model: modelKind(type, u), finds: [], pictures: [], triangles: 0, points: 0};
    const big = what => out.finds.push({kind: 'miner', what: 'a 3D model so big it can freeze a phone (' + what + ')'});
    const words = [];
    try {
      if (out.model === 'GLB' || out.model === 'glTF') {
        let J = null, bin = null;
        if (out.model === 'GLB') { let p = 12; while (p + 8 <= u.length) { const len = le32(u, p), ty = le32(u, p + 4), d = u.subarray(p + 8, p + 8 + len); if (ty === 0x4e4f534a) J = JSON.parse(utf8(d).replace(/[\0 ]+$/, '')); else if (ty === 0x004e4942) bin = d; p += 8 + len; } }
        else J = JSON.parse(utf8(u));
        if (!J || typeof J !== 'object') return out;
        const views = J.bufferViews || [], bufs = J.buffers || [], acc = J.accessors || [], bufBytes = [];
        let declared = 0;
        bufs.forEach((b, i) => { declared += +b.byteLength || 0; if (b.uri == null) bufBytes[i] = bin; else if (/^data:/.test(b.uri)) { try { bufBytes[i] = b64u(String(b.uri).split(',')[1] || ''); } catch (e) {} } else if (outside(b.uri)) out.finds.push({kind: 'code', what: 'a 3D model that loads its shapes from outside the chain', sample: {untrusted: String(b.uri).slice(0, 140)}}); });
        (J.meshes || []).forEach(m => (m.primitives || []).forEach(p => { const pos = acc[p.attributes && p.attributes.POSITION], n = p.indices != null && acc[p.indices] ? +acc[p.indices].count || 0 : pos ? +pos.count || 0 : 0; if (pos) out.points += +pos.count || 0; const mode = p.mode == null ? 4 : p.mode; if (mode === 4) out.triangles += Math.floor(n / 3); else if (mode === 5 || mode === 6) out.triangles += Math.max(0, n - 2); }));
        if (out.triangles > MBIG_TRIS) big(Math.round(out.triangles).toLocaleString('en-GB') + ' triangles'); else if (out.points > MBIG_POINTS) big(Math.round(out.points).toLocaleString('en-GB') + ' points'); else if (declared > MBIG_BYTES) big('it says its data is ' + Math.round(declared / 1e6) + ' MB');
        (J.images || []).forEach((im, i) => {
          if (out.pictures.length >= 6) return;
          let b = null;
          if (im.bufferView != null && views[im.bufferView]) { const v = views[im.bufferView], B = bufBytes[v.buffer]; if (B) b = B.subarray(v.byteOffset || 0, (v.byteOffset || 0) + (v.byteLength || 0)); }
          else if (im.uri && /^data:/.test(im.uri)) { try { b = b64u(String(im.uri).split(',')[1] || ''); } catch (e) {} }
          else if (outside(im.uri)) { out.finds.push({kind: 'code', what: 'a 3D model that loads a picture from outside the chain', sample: {untrusted: String(im.uri).slice(0, 140)}}); return; }
          if (b && b.length) { const ty = im.mimeType || (/^\x89PNG/.test(u8s(b, 0, 4)) ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : /^RIFF/.test(u8s(b, 0, 4)) ? 'image/webp' : ''); if (ty) out.pictures.push({type: ty, bytes: b, where: 'picture ' + (i + 1) + ' inside the 3D model'}); }
        });
        // the words written inside it: who made it, names of its parts, notes ("extras")
        const A = J.asset || {}; for (const k of ['generator', 'copyright']) if (A[k]) words.push(String(A[k]));
        for (const list of ['scenes', 'nodes', 'meshes', 'materials', 'textures', 'images', 'animations', 'skins', 'cameras']) for (const x of (J[list] || []).slice(0, 2000)) if (x && x.name) words.push(String(x.name));
        const ex = []; (function walk(o, d) { if (!o || typeof o !== 'object' || d > 8 || ex.length > 400) return; for (const [k, v] of Object.entries(o)) { if (k === 'extras' && v != null) ex.push(typeof v === 'string' ? v : JSON.stringify(v).slice(0, 4000)); else if (typeof v === 'object') walk(v, d + 1); } })(J, 0);
        words.push(...ex);
      } else if (out.model === 'STL') {
        if (/^solid\s/.test(u8s(u, 0, 6)) && !(u.length >= 84 && 84 + le32(u, 80) * 50 === u.length)) { const t = utf8(u.subarray(0, Math.min(u.length, 2e7))); out.triangles = (t.match(/\bfacet\b/g) || []).length; words.push((t.match(/^solid[ \t]+([^\r\n]*)/) || ['', ''])[1]); }
        else if (u.length >= 84) { out.triangles = le32(u, 80); words.push(u8s(u, 0, 80).replace(/[^\x20-\x7e]+/g, ' ')); }
        if (out.triangles > MBIG_TRIS) big(out.triangles.toLocaleString('en-GB') + ' triangles');
      } else if (out.model === 'OBJ') {
        const t = utf8(u.subarray(0, Math.min(u.length, 2e7)));
        for (const line of t.split(/\r?\n/)) { const c = line.trimStart(); if (c[0] === 'v' && c[1] === ' ') out.points++; else if (c[0] === 'f' && c[1] === ' ') out.triangles += Math.max(1, c.split(/\s+/).length - 3);
          else if (c[0] === '#') words.push(c.slice(1)); else if (/^(o|g|usemtl|mtllib)\s/.test(c)) { words.push(c.replace(/^\S+\s+/, '')); if (/^mtllib\s/.test(c) && outside(c.slice(7))) out.finds.push({kind: 'code', what: 'a 3D model that loads its looks from outside the chain', sample: {untrusted: c.slice(0, 140)}}); } }
        if (out.triangles > MBIG_TRIS) big(out.triangles.toLocaleString('en-GB') + ' faces'); else if (out.points > MBIG_POINTS) big(out.points.toLocaleString('en-GB') + ' points');
      }
    } catch (e) { out.unread = String(e && e.message || e).slice(0, 120); }
    const w = words.filter(Boolean).join('\n').slice(0, 200000);
    if (w.trim()) for (const f of read('text/plain', w, 'model')) { if (f.kind === 'personal' && /^made with|generator/i.test(f.what)) continue; delete f.file; f.what += ' (written inside the 3D model)'; out.finds.push(f); }
    return out;
  }
  const b64u = s => typeof atob === 'function' ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, 'base64'));

  /* ---------- sound files (MP3, FLAC, OGG / Opus): the words and the cover picture packed in with the sound ----------
     readSound(type, bytes): {finds[], pictures[{type, bytes, where}]}. The sound itself is not judged: only its tags (title, artist,
     album, comments, lyrics and the like) are read, the Safety Scan's way, and any cover picture is handed back to be looked at. */
  function readSound(type, bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), out = {finds: [], pictures: []}, words = [];
    const latin = (a, b) => { let t = ''; for (let i = a; i < b && i < u.length; i++) t += String.fromCharCode(u[i]); return t; };
    const txt = (d, enc) => { try { return enc === 1 || enc === 2 ? new TextDecoder(enc === 2 ? 'utf-16be' : 'utf-16').decode(d) : enc === 3 ? utf8(d) : Array.from(d, c => String.fromCharCode(c)).join(''); } catch (e) { return ''; } };
    const picType = d => /^\x89PNG/.test(u8s(d, 0, 4)) ? 'image/png' : d[0] === 0xff && d[1] === 0xd8 ? 'image/jpeg' : /^GIF8/.test(u8s(d, 0, 4)) ? 'image/gif' : /^RIFF/.test(u8s(d, 0, 4)) ? 'image/webp' : '';
    const addPic = (pic, where) => { const ty = picType(pic); if (ty && out.pictures.length < 3) out.pictures.push({type: ty, bytes: pic, where}); };
    function vorbis(d) {
      const r = [];
      try {
        const dv = new DataView(d.buffer, d.byteOffset, d.byteLength); let q = 0; const vl = dv.getUint32(q, true); q += 4 + vl;
        const n = Math.min(dv.getUint32(q, true), 500); q += 4;
        for (let k = 0; k < n && q + 4 <= d.length; k++) {
          const l = dv.getUint32(q, true); q += 4; const s = utf8(d.subarray(q, q + l)); q += l;
          if (/^METADATA_BLOCK_PICTURE=/i.test(s)) { try { const b = b64u(s.slice(23)), bd = new DataView(b.buffer, b.byteOffset, b.byteLength); let z = 4; z += 4 + bd.getUint32(z); const dl = bd.getUint32(z); z += 4 + dl + 16; const pl = bd.getUint32(z); z += 4; addPic(b.subarray(z, z + pl), 'the cover picture inside the sound file'); } catch (e) {} }
          else r.push(s.replace(/^[^=]*=/, ''));
        }
      } catch (e) {}
      return r;
    }
    try {
      // ID3v2 (MP3, and some AAC): frames of words and pictures at the start of the file
      if (u.length > 10 && latin(0, 3) === 'ID3') {
        const ver = u[3], size = (u[6] & 127) << 21 | (u[7] & 127) << 14 | (u[8] & 127) << 7 | (u[9] & 127), end = Math.min(u.length, 10 + size);
        let p = 10; if (u[5] & 0x40) { const ext = ver === 4 ? (u[10] & 127) << 21 | (u[11] & 127) << 14 | (u[12] & 127) << 7 | (u[13] & 127) : (u[10] << 24 | u[11] << 16 | u[12] << 8 | u[13]) >>> 0; p += ver === 4 ? ext : ext + 4; }
        for (let guard = 0; guard < 2000 && p + (ver === 2 ? 6 : 10) <= end; guard++) {
          const id = latin(p, p + (ver === 2 ? 3 : 4)); if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
          const n = ver === 2 ? u[p + 3] << 16 | u[p + 4] << 8 | u[p + 5] : ver === 4 ? (u[p + 4] & 127) << 21 | (u[p + 5] & 127) << 14 | (u[p + 6] & 127) << 7 | (u[p + 7] & 127) : (u[p + 4] << 24 | u[p + 5] << 16 | u[p + 6] << 8 | u[p + 7]) >>> 0;
          const h = ver === 2 ? 6 : 10, d = u.subarray(p + h, Math.min(end, p + h + n)); p += h + n; if (!n) continue;
          if (id === 'APIC' || id === 'PIC') {
            const two = d[0] === 1 || d[0] === 2; let q = 1;
            if (id === 'APIC') { while (q < d.length && d[q]) q++; q++; } else q = 4;   // (its picture type: a word like image/jpeg, or 3 letters)
            q++;   // (what the picture is: cover, artist...)
            while (q < d.length && (two ? d[q] || d[q + 1] : d[q])) q += two ? 2 : 1; q += two ? 2 : 1;   // (its description, then the picture)
            addPic(d.subarray(q), 'the cover picture inside the sound file');
          } else if (id[0] === 'T' || id[0] === 'W' || /^(COMM|USLT|COM|ULT)$/.test(id)) words.push(txt(d.subarray(1), d[0]).replace(/\0/g, ' '));
        }
      }
      // ID3v1: 128 bytes at the end of an MP3
      if (u.length > 128 && latin(u.length - 128, u.length - 125) === 'TAG') words.push(latin(u.length - 125, u.length - 2).replace(/\0+/g, ' '));
      // FLAC: its blocks of words (VORBIS_COMMENT) and pictures
      if (latin(0, 4) === 'fLaC') {
        let p = 4;
        for (let k = 0; k < 64 && p + 4 <= u.length; k++) {
          const last = u[p] & 0x80, ty = u[p] & 127, n = u[p + 1] << 16 | u[p + 2] << 8 | u[p + 3], d = u.subarray(p + 4, p + 4 + n); p += 4 + n;
          if (ty === 4) words.push(...vorbis(d));
          else if (ty === 6) { try { const dv = new DataView(d.buffer, d.byteOffset, d.byteLength); let q = 4; q += 4 + dv.getUint32(q); const dl = dv.getUint32(q); q += 4; words.push(utf8(d.subarray(q, q + dl))); q += dl + 16; const pl = dv.getUint32(q); q += 4; addPic(d.subarray(q, q + pl), 'the cover picture inside the sound file'); } catch (e) {} }
          if (last) break;
        }
      }
      // OGG (Vorbis or Opus): the comment packet near the start
      if (latin(0, 4) === 'OggS') { const head = latin(0, Math.min(u.length, 65536)); let i = head.indexOf('\x03vorbis'), o = i >= 0 ? i + 7 : (i = head.indexOf('OpusTags')) >= 0 ? i + 8 : -1; if (o > 0) words.push(...vorbis(u.subarray(o))); }
    } catch (e) {}
    const w = words.filter(Boolean).join('\n').slice(0, 100000);
    if (w.trim()) for (const f of read('text/plain', w, 'sound')) { delete f.file; f.what += ' (written in the sound file\'s tags)'; out.finds.push(f); }
    return out;
  }

  /* ---------- flashing: the WCAG "three flashes" rule, read on each quarter of the picture (and its middle) ----------
     frames: grey values (0-255), W x H each; times: when each frame starts (ms). Gives the most flashes in any one second. */
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  function flashes(frames, times, W, H) {
    if (!frames || frames.length < 4) return 0;
    const parts = [[0, 0], [W / 2, 0], [0, H / 2], [W / 2, H / 2], [W / 4, H / 4]].map(([x, y]) => [x | 0, y | 0, W / 2 | 0, H / 2 | 0]);
    let worst = 0;
    for (const [px, py, pw, ph] of parts) {
      const L = frames.map(f => { let s = 0; for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) s += lin(f[y * W + x]); return s / (pw * ph); });
      const turns = []; let ref = L[0], dir = 0;   // (a turn: the brightness changes by 10% or more, the darker side below 0.8; a flash is two opposite turns)
      for (let i = 1; i < L.length; i++) {
        const d = L[i] - ref;
        if (Math.abs(d) >= 0.1 && Math.min(L[i], ref) < 0.8) { const g = Math.sign(d); if (g !== dir) { turns.push(times[i]); dir = g; } ref = L[i]; }
        else if (dir && Math.sign(L[i] - ref) === dir) ref = L[i];
      }
      for (let i = 0; i + 1 < turns.length; i++) { let n = 0; for (let j = i; j + 1 < turns.length && turns[j + 1] - turns[i] < 1000; j += 2) n++; worst = Math.max(worst, n); }
    }
    return worst;
  }

  /* ---------- a wallet: every inscription an address holds, checked the Safety Scan's way ----------
     scanWallet({chain: 'bitcoin'|'doge', address, fetch, look, progress, stopped, max})
     look({id, type, bytes}): optional, looks at pictures and films (the portal's pages give one that uses the Family Guard);
     without it, pictures and films are counted as not looked at. Nothing is run: files are only read as bytes.
     Bitcoin: the address's inscriptions from ordinals.com (its address page), each file from ordinals.com/content/.
     (24 Nov 2026: Bitcoin only; Dogecoin is paused.) */
  const PIC = /^image\/(png|jpeg|jpg|webp|gif|avif|bmp)$/, FILM = /^video\//;
  const isAddr = (c, a) => c === 'doge' ? /^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a) : /^(bc1[02-9ac-hj-np-z]{8,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/i.test(a);
  async function scanWallet(o) {
    o = o || {}; if (/^d/i.test(o.chain || '')) throw new Error('Dogecoin is paused: only Bitcoin addresses are scanned');
    const chain = 'btc', a = String(o.address || '').trim();
    if (!isAddr(chain, a)) throw new Error('give a ' + (chain === 'doge' ? 'Dogecoin address (starts with D, A or 9)' : 'Bitcoin address (starts with bc1, 1 or 3)'));
    const F = o.fetch || ((u, i) => fetch(u, i)), MAX = Math.min(o.max || 3000, 10000), say = o.progress || (() => {}), stop = o.stopped || (() => false);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const BASES = ['https://ordinals.com'];
    const out = {chain: chain === 'doge' ? 'Dogecoin' : 'Bitcoin', address: a, at: new Date().toISOString(), holds: 0, checked: 0, pictures: 0, films: 0, models: 0, sounds: 0, text: 0, other: 0, notLooked: 0, flashNotChecked: 0, namesAndTokens: 0, tooMany: 0, found: [], tally: {}};
    // the list
    let list = [];
    say('Reading which inscriptions ' + a + ' holds…');
    if (chain === 'btc') {
      const r = await F('https://ordinals.com/address/' + encodeURIComponent(a)); if (!r.ok) throw new Error('ordinals.com did not answer (http ' + r.status + ')');
      const t = await r.text(); list = [...new Set([...t.matchAll(/\/inscription\/([0-9a-f]{64}i\d+)/g)].map(m => m[1]))].map(id => ({id, type: null}));
    }
    out.holds = list.length + out.namesAndTokens;
    if (list.length > MAX) { out.tooMany = list.length - MAX; list = list.slice(0, MAX); }
    // each file: read as bytes, never run
    let i = 0, done = 0;
    const one = async x => {
      let r = null, base = null;
      for (const b of BASES) { try { r = await F(b + '/content/' + x.id); if (r.ok) { base = b; break; } } catch (e) {} r = null; }
      if (!r) { out.notLooked++; return; }
      const n = +r.headers.get('content-length'), ty = (x.type || (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase());
      if (n > 8e6) { out.notLooked++; return; }
      const bytes = new Uint8Array(await r.arrayBuffer()); if (bytes.length > 8e6) { out.notLooked++; return; }
      let finds = [];
      if (PIC.test(ty) || FILM.test(ty)) {
        if (FILM.test(ty)) out.films++; else out.pictures++;
        if (o.look) { try { const L = await o.look({id: x.id, type: ty, bytes}); finds = L.finds || []; if (L.flashNotChecked) out.flashNotChecked++; if (L.notLooked) out.notLooked++; } catch (e) { out.notLooked++; } } else out.notLooked++;
      } else if (/^audio\//.test(ty)) {
        out.sounds++; const A = readSound(ty, bytes); finds = A.finds;
        if (o.look) { for (const p of A.pictures) { try { const L = await o.look({id: x.id + '#cover', type: p.type, bytes: p.bytes}); for (const f of L.finds || []) { f.what += ' (' + p.where + ')'; finds.push(f); } } catch (e) {} } }
        else if (A.pictures.length) out.notLooked++;
      } else if (/^model\//.test(ty)) {
        out.models++; const M = readModel(ty, bytes); finds = M.finds;
        if (o.look) { for (const p of M.pictures) { try { const L = await o.look({id: x.id + '#model', type: p.type, bytes: p.bytes}); for (const f of L.finds || []) { f.what += ' (' + p.where + ')'; finds.push(f); } } catch (e) {} } }
        else if (M.pictures.length) out.notLooked++;
      } else if (TEXTY.test(ty) || !ty) {
        out.text++; const text = new TextDecoder().decode(bytes);
        if (/json/.test(ty) && /^\s*\{\s*"p"\s*:/.test(text) && text.length < 600) { out.namesAndTokens++; out.text--; return; }
        finds = read(ty || 'text/plain', text, x.id); for (const f of finds) delete f.file;
        if (/svg/.test(ty) && o.look) { try { const L = await o.look({id: x.id, type: 'image/svg+xml', bytes}); for (const f of L.finds || []) { f.what = f.what.replace('a picture', 'a drawing (SVG)'); finds.push(f); } } catch (e) {} }   // (an SVG drawn and looked at too)
        if (o.look) { let k = 0; for (const m of text.matchAll(/data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]{2000,})/g)) { if (++k > 3) break;
          try { const bin = typeof atob === 'function' ? Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(m[2], 'base64')); const L = await o.look({id: x.id + '#' + k, type: 'image/' + m[1].replace('jpg', 'jpeg'), bytes: bin}); for (const f of L.finds || []) { f.what += ' (inside the code)'; finds.push(f); } } catch (e) {} } }
      } else out.other++;
      if (finds.length) {
        const kinds = KINDS.map(K => K.key).filter(k => finds.some(f => f.kind === k));
        out.found.push({id: x.id, contentType: ty, bytes: bytes.length, kinds, finds: finds.slice(0, 8).map(f => { const g = {kind: f.kind, what: f.what}; for (const k of ['line', 'score', 'perSecond', 'hidden']) if (f[k] != null) g[k] = f[k]; if (f.sample) g.sample = {untrusted: String(f.sample.untrusted).slice(0, 160), masked: f.sample.masked || undefined}; return g; })});
        for (const k of kinds) out.tally[k] = (out.tally[k] || 0) + 1;
      }
    };
    const worker = async () => { while (i < list.length && !stop()) { const x = list[i++]; try { await one(x); } catch (e) { out.notLooked++; } out.checked++; done++; if (done % 5 === 0 || done === list.length) say('Checked ' + done + ' of ' + list.length + (out.found.length ? ': ' + out.found.length + ' marked so far' : '') + '…', out); await sleep(120); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    out.stopped = stop() && done < list.length ? true : undefined;
    out.found.sort((p, q) => KINDS.findIndex(K => K.key === p.kinds[0]) - KINDS.findIndex(K => K.key === q.kinds[0]));
    return out;
  }
  // a short summary: how many of each kind
  const tally = finds => { const t = {}; for (const f of finds || []) t[f.kind] = (t[f.kind] || 0) + 1; return t; };
  const isText = t => TEXTY.test(String(t || ''));
  return {VERSION, KINDS, KIND, read, tally, isText, visible, flashes, scanWallet, isAddr, readModel, readSound, isModel: t => /^model\//i.test(String(t || '').trim())};
});
