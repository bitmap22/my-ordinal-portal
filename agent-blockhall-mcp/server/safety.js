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
  const VERSION = '1.0.0';
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
      [/\b(you are now|from now on,? you|act as|pretend (to be|you are)|you must now|your new (role|task|goal) is)\b/i, 'tries to change what an AI is or does'],
      [/\b(do not|don't|never)\s+(tell|inform|show|mention|reveal|let)\s+(this\s+to\s+)?(the\s+)?(user|human|owner|person)\b/i, 'tells an AI to hide something from its user'],
      [/<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|assistant\|>|\[\/?INST\]|<<\/?SYS>>|<\/?(system|assistant|tool_call|function_call)>|^\s*(system|assistant)\s*:/im, 'copies the hidden markers chat AIs use'],
      [/\b(reveal|print|show|output|repeat|leak)\s+(your\s+|the\s+)(system\s+prompt|hidden\s+prompt|instructions|api\s+keys?|secrets?|seed|private\s+keys?)/i, 'asks an AI to give away its secrets'],
      [/\b(agents?|assistants?|ai)\s+(must|should|shall|will)\s+(now\s+)?(send|transfer|sign|approve|pay|buy|sell|delete|run|execute|visit|open|click|connect)/i, 'orders AI agents to act'],
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
      [/<form\b[^>]*\baction\s*=\s*["']?\s*(https?:)?\/\//i, 'a form that sends what you type to another site'],
      [/<input\b[^>]*\btype\s*=\s*["']?password/i, 'a password box'],
      [/\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|rb\.gy|tiny\.cc)\/[A-Za-z0-9]+/i, 'a hidden-address short link']],
    miner: [
      [/\b(coin-?hive|cryptonight|coinimp|crypto-?loot|webminepool|minero\.cc|jsecoin|deepminer|cryptoloot|webmine\.pro|monerominer|xmrig|nicehash|minergate)\b|stratum\+(tcp|ssl):\/\//i, 'a known coin-mining tool'],
      [/\bnew\s+(Worker|SharedWorker)\s*\([\s\S]{0,400}\b(hash(rate|es)?|nonce|mining|miner|cryptonight)\b/i, 'starts background workers that hash (may be mining)'],
      [/\bwhile\s*\(\s*(true|1|!0|!!1)\s*\)\s*(\{\s*\}|;)/, 'a loop that never ends (freezes the page)'],
      [/\bwhile\s*\(\s*(true|1|!0|!!1)\s*\)\s*\{[^}]{0,200}\b(window\.open|alert|confirm|prompt|history\.pushState|location\s*=)/, 'opens windows or boxes forever'],
      [/\bfor\s*\(\s*;\s*;\s*\)\s*(\{\s*\}|;)/, 'a loop that never ends (freezes the page)'],
      [/\.repeat\s*\(\s*(\d{8,}|\d+e[7-9]|\d+e\d{2,}|2\s*\*\*\s*(2[7-9]|[3-9]\d))\s*\)/i, 'makes a giant string (fills memory)'],
      [/\bnew\s+(Array|ArrayBuffer|SharedArrayBuffer|(Uint|Int|Float)(8|16|32|64)Array|BigInt64Array)\s*\(\s*(\d{9,}|\d+e(9|\d{2,})|2\s*\*\*\s*(3[0-9]|[4-9]\d))\s*\)/i, 'asks for a giant block of memory'],
      [/<!ENTITY\s+\w+\s+["'](&\w+;){4,}/i, 'nested entities that blow up when opened (a "billion laughs")'],
      [/\bsetInterval\s*\(\s*(function\s*\(\s*\)\s*\{|\(\s*\)\s*=>\s*\{?)\s*[^}]{0,80}\bwindow\.open\b/, 'keeps opening new windows']],
    hate: []};
  // hate words and slogans: kept encoded so the list isn't shown as plain words in the page
  const HATE = 'bmlnZ2VyfG5pZ2dlcnN8bmlnZ2F8bmlnZ2FzfGtpa2V8a2lrZXN8c3BpY3xzcGljc3x3ZXRiYWNrfHdldGJhY2tzfGNoaW5rc3xnb29rfGdvb2tzfHJhZ2hlYWR8cmFnaGVhZHN8dG93ZWxoZWFkfHRvd2VsaGVhZHN8c2FuZG5pZ2dlcnxwYWtpfHBha2lzfGZhZ2dvdHxmYWdnb3RzfGZhZ3N8dHJhbm55fHRyYW5uaWVzfGRhcmtpZXxkYXJraWVzfGp1bmdsZSBidW5ueXxwb3JjaCBtb25rZXl8aGVpbCBoaXRsZXJ8c2llZyBoZWlsfHdoaXRlIHBvd2VyfDE0ODh8Z2FzIHRoZSBqZXdzfGpld3Mgd2lsbCBub3QgcmVwbGFjZSB1c3x3aGl0ZSBnZW5vY2lkZXxyYWNlIHdhciBub3d8a2lsbCBhbGwgKGpld3N8YmxhY2tzfG11c2xpbXN8Z2F5c3xpbW1pZ3JhbnRzKXxzdWJodW1hbnM=';
  const b64 = s => typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('latin1');
  RULES.hate.push([new RegExp('(^|[^a-z0-9])(' + b64(HATE) + ')(?=$|[^a-z0-9])', 'i'), 'a hate word or slogan']);
  const PERSONAL = [
    [/(^|[^\w+])(\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}(?!\d)/, 'a UK mobile number'],
    [/(^|[^\w])(\+?1[\s.-]?)?\(\d{3}\)\s?\d{3}[\s.-]\d{4}(?!\d)|(^|[^\w.-])\d{3}-\d{3}-\d{4}(?![\d-])/, 'a phone number'],
    [/(^|[^\w])\+(?!44\s?7)\d{1,3}[\s-]\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}(?!\d)/, 'a phone number'],
    [/\b\d{1,5}\s+([A-Z][a-z]+\s){1,3}(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Way|Crescent|Boulevard|Blvd|Court|Ct|Terrace|Gardens|Grove)\b\.?/, 'a street address'],
    [/\b(GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2})\b/, 'a UK postcode'],
    [/\b[A-Za-z0-9._%+-]{2,}@(?!(example|test|domain|email|sentry|w3)\.)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(com|net|org|co\.uk|uk|io|me|de|fr|jp|cn|ru|xyz|info|app|dev|ai)\b/, 'an email address']];

  // ----- reading -----
  const cut = (s, i, n) => s.slice(Math.max(0, i - 30), i + Math.min(n, 90) + 20).replace(/\s+/g, ' ').trim();
  function visible(html) {   // the words a person would see (scripts, styles and tags taken out)
    return String(html).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ');
  }
  // text hidden from people but there for machines: HTML comments, hidden elements, tiny or invisible text, alt and title words
  function hiddenBits(html) {
    const out = [], s = String(html);
    for (const m of s.matchAll(/<!--([\s\S]*?)-->/g)) out.push(m[1]);
    for (const m of s.matchAll(/<(\w+)\b[^>]*\b(hidden|aria-hidden\s*=\s*["']?true|style\s*=\s*["'][^"']*(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(px|pt|em|rem)?\b|opacity\s*:\s*0(\.0+)?\s*[;"']|color\s*:\s*transparent|left\s*:\s*-\d{3,}px|clip\s*:\s*rect\(0))[^>]*>([\s\S]{1,2000}?)<\/\1>/gi)) out.push(m[6] || '');
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
    const ty = String(contentType || '').split(';')[0].trim().toLowerCase(), s = String(text || ''), out = [];
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
    if (code && CR && typeof CR.scan === 'function') {
      for (const f of CR.scan(s, file)) if (/^(wallet|outside|sends|tracks)$/.test(f.kind) && out.filter(x => x.kind === 'code').length < 12)
        out.push({kind: 'code', what: f.what, file, line: f.line, sample: f.code || {untrusted: ''}, codeRead: f.kind});
    }
    // what it shows of personal details and hate words is masked, so the scan never spreads them further
    const HRE = new RegExp(RULES.hate[0][0].source, 'gi');
    for (const f of out) {
      if (f.kind === 'personal') f.sample = {untrusted: f.sample.untrusted.replace(/\d/g, '•').replace(/[A-Za-z0-9._%+-]{2,}@/g, '•••@').replace(/\b([A-Z][a-z]+)(\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Way|Crescent|Boulevard|Blvd|Court|Ct|Terrace|Gardens|Grove)\b)/g, '•••$2').replace(/\b([A-Z]{1,2})\d[A-Z\d]? ?\d[A-Z]{2}\b/g, '$1•• •••'), masked: true};
      if (f.kind === 'hate') f.sample = {untrusted: f.sample.untrusted.replace(HRE, (m, a, w) => a + w[0] + '•'.repeat(Math.max(2, w.length - 1))), masked: true};
    }
    // the same thing found twice on one line is one finding
    const keep = new Map(); for (const f of out) { const k = f.kind + '|' + f.what + '|' + f.line; if (!keep.has(k)) keep.set(k, f); }
    return [...keep.values()];
  }
  // a short summary: how many of each kind
  const tally = finds => { const t = {}; for (const f of finds || []) t[f.kind] = (t[f.kind] || 0) + 1; return t; };
  const isText = t => TEXTY.test(String(t || ''));
  return {VERSION, KINDS, KIND, read, tally, isText, visible};
});
