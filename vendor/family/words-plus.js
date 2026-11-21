/* Family Guard word layer, version 1 (© 2026 bitmap22, all rights reserved).
   It sits on top of AllProfanity (words.min.js, MIT licence, kept unchanged) and makes the rude-word check harder to get round:
   - fancy letters (maths, circled, full-width, small capitals, flag letters), look-alike letters from other alphabets, hidden and
     direction-flipping characters and stacked marks are turned back into plain letters before the list is asked;
   - repeated letters are folded, number swaps (4 for a, 3 for e...) are undone, and a * standing for a vowel is tried as each vowel;
   - letters spaced or dotted apart ("f u c k") are joined, and words written backwards after a direction flip are read the right way;
   - the worst words are found inside longer words and names glued with _ too;
   - it adds terms the list lacks (slurs, bullying phrases, swearing in other languages);
   - it lets through words and phrases the list gets wrong ("that sucks", "cum laude", "Moby Dick", "escort mission").
   Nothing leaves the device. No word filter catches everything: this one is much harder to fool than the list alone. */
(() => {
  const W = window.FamilyWords; if (!W || W.plus) return;
  const HIDDEN = /[­͏؜ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g;
  const FLIP = /[‮⁧]/;   // (a right-to-left override: the word may be written backwards)
  // letters from other alphabets that look like Latin ones, and small capitals (not folded by NFKC)
  const LOOK = {};
  // (each pair: the look-alike, then the plain letter it stands for)
  const pairs = ('а:a в:b е:e к:k м:m н:h о:o р:p с:c т:t у:y х:x ѕ:s і:i ј:j һ:h ь:b ԁ:d ӏ:l ɡ:g ո:n ս:u ց:g զ:q ' +
    'А:a В:b Е:e К:k М:m Н:h О:o Р:p С:c Т:t У:y Х:x Ѕ:s І:i Ј:j ' +
    'α:a β:b ε:e η:n ι:i κ:k ν:v ο:o ρ:p τ:t υ:u χ:x ω:w Α:a Β:b Ε:e Η:h Ι:i Κ:k Μ:m Ν:n Ο:o Ρ:p Τ:t Υ:y Χ:x Ζ:z ' +
    'ᴀ:a ʙ:b ᴄ:c ᴅ:d ᴇ:e ꜰ:f ɢ:g ʜ:h ɪ:i ᴊ:j ᴋ:k ʟ:l ᴍ:m ɴ:n ᴏ:o ᴘ:p ʀ:r ꜱ:s ᴛ:t ᴜ:u ᴠ:v ᴡ:w ʏ:y ᴢ:z').split(' ');
  for (const p of pairs) { const [a, b] = p.split(':'); LOOK[a] = b; }
  const LEET = {'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't', '€': 'e', '£': 'l'};
  // plain letters, as a person reads them (letters(): case kept; plain(): lower case)
  function letters(s) {
    s = String(s == null ? '' : s).normalize('NFKC').replace(HIDDEN, '').normalize('NFD').replace(/\p{M}+/gu, '');
    let o = ''; for (const ch of s) { const cp = ch.codePointAt(0); o += cp >= 0x1F1E6 && cp <= 0x1F1FF ? String.fromCharCode(97 + cp - 0x1F1E6) : (LOOK[ch] || ch); }
    return o;
  }
  const plain = s => letters(s).toLowerCase();
  // harmless words and phrases the list gets wrong: taken out before checking
  const ALLOW = /\b(summa |magna )?cum laude\b|\bmoby dick\b|\bdick (turpin|van dyke|whittington)\b|\bspic and span\b|\bshitterton\b|\bmatsushita\b|\bsnigger(s|ed|ing)?\b|\bscunthorpe\b|\bpenistone\b|\bclitheroe\b|\bescort(s|ed|ing)?\b|\b(that |it |this )?sucks?\b|\bsexy beast\b|\bnude (colou?r|shade|tone|lipstick)s?\b|\b(blue|great|coal|marsh|willow|crested|long-tailed) tits?\b|\btits are birds\b|\bshii?take\b/g;
  // the worst words: found even inside a longer word or a glued name
  const STRONG = /fuck|cunt|nigg(er|a|uh)|fagg?ot|whore|slut|bitch|shit|motherf|dickhead|cocksuck|jizz|paedo|pedophil|anilingus|arsehole|asshole|bestiality|blowjob|bukkake|bulldyke|camwhore|creampie|cunnilingus|deepthroat|dildo|fellatio|fisting|footjob|goatse|handjob|hentai|jailbait|kike|poontang|raghead|rimjob|shemale|slanteye|splooge|strapon|threesome|towelhead|tranny|wetback|zoophilia|porn/;
  // terms the list lacks: slurs, bullying phrases, hate codes, and swearing in other languages (whole words only)
  const EXTRA = new RegExp('\\b(' + [
    'retard(s|ed)?', 'tard', 'spaz', 'fag(s)?', 'dyke(s)?', 'chink(s)?', 'gook(s)?', 'kys', 'kill (your|ur|yo)self', 'go (and )?die', 'neck yourself', 'heil hitler', 'sieg heil', '1488', 'white power',
    'skank(s)?', 'slag(s)?', 'prick(s)?', 'wanker(s)?', 'arse', 'bellend(s)?', 'knobhead(s)?', 'minge', 'pikey(s)?', 'gypo(s)?', 'paedo(s)?', 'pedo(s)?', 'thot(s)?', 'incel(s)?',
    'puta(s)?', 'puto(s)?', 'mierda', 'pendejo(s)?', 'cabr[oó]n(es)?', 'maric[oó]n(es)?', 'joder', 'gilipollas', 'co[nñ]o', 'merde', 'putain', 'salope(s)?', 'connard(s)?', 'encul[eé](s)?',
    'schei(ss|ß)e', 'arschloch', 'fotze', 'hurensohn', 'wichser', 'cazzo', 'stronzo', 'vaffanculo', 'puttana', 'caralho', 'porra', 'buceta', 'viado',
    'kurwa', 'chuj', 'suka ?blyat', 'nonce(s)?', 'jeba[cć]', 'blyat', 'blyad', 'pizd(a|ec)', 'khuy', 'nahui', 'orospu', 'siktir', 'amk', 'godverdomme', 'klootzak', 'madarchod', 'bhenchod', 'chutiya', 'gandu'
  ].join('|') + ')\\b');
  // the ways a word can be written to slip past: each is checked
  function variants(p) {
    const v = new Set([p]);
    if (/[0134578@$!|+€£]/.test(p)) v.add(p.replace(/[0134578@$!|+€£]/g, c => LEET[c] || c));
    for (const x of [...v]) { v.add(x.replace(/([a-z])\1{2,}/g, '$1')); v.add(x.replace(/([a-z])\1{2,}/g, '$1$1')); }   // (a letter said three times or more: tried once and twice, never folding an ordinary double)
    for (const x of [...v]) if (x.includes('*')) for (const c of 'aeiou') v.add(x.replace(/\*/g, c));
    for (const x of [...v]) { const j = x.replace(/\b([a-z])(?:[\s._\-,~'`^*:;/\\]+([a-z])\b)+/g, m => m.replace(/[^a-z]/g, '')); if (j !== x) v.add(j); }   // (single letters spaced or dotted apart: joined)
    return [...v];
  }
  const bad = x => W.has(x) || EXTRA.test(x) || x.split(/[^a-z]+/).some(t => t.length >= 4 && STRONG.test(t));
  function has(text, flipped) {
    const p0 = plain(text); if (!p0.trim()) return false;
    const p = p0.replace(ALLOW, ' ');
    const all = variants(p); if (flipped || FLIP.test(String(text))) all.push(...variants([...p].reverse().join('')));
    return all.some(bad);
  }
  // the text with rude words starred: the list's own starring first, then any word it missed; if what is left still reads as rude
  // (a phrase, or letters spaced apart), every word is starred
  function clean(text) {
    const s0 = String(text == null ? '' : text), fl = FLIP.test(s0), s = s0.replace(HIDDEN, '');
    if (!has(s, fl)) return s;
    const keep = new Set((plain(s).match(ALLOW) || []).join(' ').split(/[^a-z]+/).filter(Boolean));   // (words of an allowed phrase stay as written)
    let out = s.split(/(\s+)/).map(t => /^\s*$/.test(t) || keep.has(plain(t).replace(/[^a-z]/g, '')) || !has(t, fl) ? t : '*'.repeat([...t].length)).join('');
    if (has(out, fl)) out = out.split(/(\s+)/).map(t => /^\s*$/.test(t) ? t : '*'.repeat([...t].length)).join('');
    return out;
  }
  // a name: plain letters, numbers, spaces, - and _ only (fancy and look-alike letters become plain ones)
  function plainName(s, n = 20) { return letters(s).replace(/[^a-z0-9 _\-]/gi, '').replace(/\s+/g, ' ').trim().slice(0, n); }
  // chat: a word split over two short messages ("fu", then "ck") is caught too. Returns the message to show (starred if needed).
  const LAST = new Map();
  function chat(from, text) {
    const t = clean(text), q = plain(text).replace(/[^a-z0-9]/g, ''), k = String(from == null ? '' : from), prev = LAST.get(k) || [];
    let out = t;
    if (t === String(text).replace(HIDDEN, '') && q.length && q.length <= 8) { const j = prev.slice(-2).join('') + q, j1 = (prev[prev.length - 1] || '') + q; if ((prev.length && prev[prev.length - 1].length <= 8) && (W.has(j1) || W.has(j) || EXTRA.test(j1))) out = '*'.repeat([...t].length); }
    prev.push(q.slice(0, 40)); if (prev.length > 3) prev.shift(); LAST.set(k, prev); if (LAST.size > 200) LAST.delete(LAST.keys().next().value);
    return out;
  }
  window.FamilyWords = {plus: 1, has, clean, plain, plainName, chat, raw: W};
})();
