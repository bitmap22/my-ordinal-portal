/* The Family Guard, by bitmap22. Always free.
   Keeps the Ord Portal family friendly. Anyone can inscribe anything, so every picture and film from an inscription is checked,
   in the visitor's own browser, before it is shown clearly:
   - while it is being checked, it is blurred;
   - when the checker thinks it may be adult content, it stays hidden behind an 18+ warning, and only a person can choose to show it;
   - when it could not be checked, it stays hidden until a person chooses to show it;
   - in Family mode (a switch kept in this browser), every picture from an inscription stays hidden until a person chooses.
   Words written in an inscription, and what players type in chat, are checked for rude words too.
   The picture checker is NSFWJS (MIT licence, by Infinite Red) with its MobileNetV2 model, run in a background worker so games
   stay smooth. The word checker is AllProfanity (MIT licence, by Ayush Jadaun). Both live in this folder, with their licences.
   Neither is perfect: NSFWJS is right about 9 times in 10, and it looks at the picture only (not words drawn in it, and not
   violence). Nothing is sent anywhere: every check happens on this computer or phone.
   For AI agents: FamilyGuard.state() says what was checked and hidden. An agent never shows something that was hidden.
   (c) 2026 bitmap22. All rights reserved. Free to use on the Ord Portal, under its licence (LICENCE, at the top of the repository). */
(function () {
  'use strict';
  if (window.FamilyGuard) return;
  const onSite = /(^|\.)github\.io$|(^|\.)ordportal\.com$/.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const BASE = new URL((onSite ? (/\/test\//.test(location.pathname) ? '../' : '/') : 'https://ordportal.com/') + 'vendor/family/', location.href).href;
  const SKEY = 'ordportal-family', LIMIT = 0.5;   // adult: Porn, Hentai and Sexy together score 0.5 or more
  let strict = false; try { strict = localStorage.getItem(SKEY) === '1'; } catch (e) {}
  const byStr = new Map(), byObj = new WeakMap(), shown = new Set(), subs = new Set(), recent = [];
  const stats = {checked: 0, adult: 0, unchecked: 0, shownByPerson: 0};
  const valStr = new Map(), valObj = new WeakMap();   // (the answers once known, to read without waiting)
  const keyGet = k => k == null ? undefined : typeof k === 'object' ? byObj.get(k) : byStr.get(String(k));
  const valSet = (k, v) => { if (k == null) return; if (typeof k === 'object') valObj.set(k, v); else { valStr.set(String(k), v); if (valStr.size > 6000) valStr.delete(valStr.keys().next().value); } };
  const keySet = (k, v) => { if (k == null) return; if (typeof k === 'object') byObj.set(k, v); else { byStr.set(String(k), v); if (byStr.size > 6000) byStr.delete(byStr.keys().next().value); } };
  const tell = () => { for (const f of subs) { try { f(); } catch (e) {} } };

  /* ---------- the picture checker: a worker, loaded the first time a picture needs it ---------- */
  let W = null, dead = '', seq = 0, busy = 0;
  const wait = new Map(), qNow = [], qLater = [];
  function worker() {
    if (W || dead) return W;
    try {
      const js = [BASE + 'model.min.js', BASE + 'group1-shard1of1.min.js', BASE + 'nsfwjs.min.js'].map(u => JSON.stringify(u)).join(',');
      const src = 'importScripts(' + js + ');\n' +
        'let M = null; const ready = nsfwjs.load("MobileNetV2").then(m => { M = m; }, e => { postMessage({dead: String(e && e.message || e)}); });\n' +
        'onmessage = async e => { const {id, data} = e.data; try { await ready; if (!M) throw Error("no checker"); const p = await M.classify(data); postMessage({id, p: p.map(q => [q.className, q.probability])}); } catch (x) { postMessage({id, err: String(x && x.message || x)}); } };';
      W = new Worker(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})));
      W.onmessage = e => { const m = e.data || {}; if (m.dead) return die(m.dead); const f = wait.get(m.id); if (!f) return; wait.delete(m.id); busy--; m.err ? f.no(new Error(m.err)) : f.ok(m.p); pump(); };
      W.onerror = () => die('the picture checker did not start');
    } catch (e) { die('the picture checker did not start'); }
    return W;
  }
  function die(why) { dead = why || 'the picture checker stopped'; try { W && W.terminate(); } catch (e) {} W = null; for (const [, f] of wait) f.no(new Error(dead)); wait.clear(); for (const j of qNow.splice(0).concat(qLater.splice(0))) j.no(new Error(dead)); busy = 0; tell(); }
  function pump() {
    while (busy < 2 && (qNow.length || qLater.length)) {
      const w = worker(); if (!w) return;
      const j = qNow.length ? qNow.shift() : qLater.shift(), id = ++seq; busy++; wait.set(id, j);
      try { w.postMessage({id, data: j.data}); } catch (e) { wait.delete(id); busy--; j.no(e); }
    }
  }
  function classify(data, soon) { return new Promise((ok, no) => { if (dead) return no(new Error(dead)); (soon ? qNow : qLater).push({data, ok, no}); pump(); }); }

  /* ---------- a picture, made ready for the checker (224 x 224, as the checker looks at it) ---------- */
  function sample(src) {
    try {
      if (!src) return null; if (typeof ImageData !== 'undefined' && src instanceof ImageData) return src;
      const w = src.naturalWidth || src.videoWidth || src.width, h = src.naturalHeight || src.videoHeight || src.height; if (!w || !h) return null;
      const c = document.createElement('canvas'); c.width = c.height = 224; const x = c.getContext('2d', {willReadFrequently: true});
      x.fillStyle = '#000'; x.fillRect(0, 0, 224, 224); x.drawImage(src, 0, 0, 224, 224);
      return x.getImageData(0, 0, 224, 224);
    } catch (e) { return null; }   // (a picture this page may not read: it stays unchecked)
  }
  async function decode(bytes, type) {
    const blob = new Blob([bytes], {type: type || ''});
    if (!/svg/.test(type || '') && window.createImageBitmap) { try { return await createImageBitmap(blob); } catch (e) {} }
    const url = URL.createObjectURL(blob), im = new Image(); im.src = url;
    try { await im.decode(); return im; } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  }
  async function filmSamples(bytes, type) {   // three moments of a film: a quarter, half and three quarters in
    const url = URL.createObjectURL(new Blob([bytes], {type: type || 'video/mp4'})), v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url; const out = [];
    try {
      await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('the film could not be read')); setTimeout(() => no(new Error('the film took too long')), 15000); });
      const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
      for (const f of d ? [.25, .5, .75] : [0]) {
        if (d) await new Promise(ok => { v.onseeked = ok; v.currentTime = d * f; setTimeout(ok, 4000); });
        const s = sample(v); if (s) out.push(s);
      }
    } finally { URL.revokeObjectURL(url); v.removeAttribute('src'); }
    return out;
  }
  const verdictOf = p => { let s = 0; for (const [n, v] of p) if (n === 'Porn' || n === 'Hentai' || n === 'Sexy') s += v; return {v: s >= LIMIT ? 'adult' : 'ok', score: Math.round(s * 1000) / 1000}; };
  function note(key, v, label, score) { recent.push({what: label || (typeof key === 'string' ? key : 'a picture'), verdict: v, score: score == null ? null : score, at: new Date().toISOString()}); if (recent.length > 40) recent.shift(); }

  // the verdict on one thing: 'ok', 'adult' or 'unchecked'. src: ImageData, a picture (img, ImageBitmap, canvas), a film element,
  // {bytes, type}, or a web address. key: what it is (an inscription ID, or the object it belongs to), so it is checked once.
  function check(src, key, o) {
    o = o || {};
    const had = keyGet(key); if (had) return had;
    const p = (async () => {
      let samples = [];
      try {
        if (typeof src === 'string') { const r = await fetch(src); if (!r.ok) throw Error('not answered'); const ty = (r.headers.get('content-type') || '').split(';')[0]; src = {bytes: new Uint8Array(await r.arrayBuffer()), type: ty}; }
        if (src && src.bytes) {
          if (/^video\//.test(src.type || '')) samples = src.bytes.length <= 40e6 ? await filmSamples(src.bytes, src.type) : [];
          else { const im = await decode(src.bytes, src.type); samples = [sample(im)]; if (im && im.close) im.close(); }
        } else samples = [sample(src)];
        samples = samples.filter(Boolean); if (!samples.length) throw Error('nothing to look at');
        let worst = {v: 'ok', score: 0};
        for (const s of samples) { const r = verdictOf(await classify(s, o.soon)); if (r.score > worst.score) worst = r; if (r.v === 'adult') { worst = r; break; } }
        stats.checked++; if (worst.v === 'adult') stats.adult++; note(key, worst.v, o.label, worst.score); tell();
        return worst.v;
      } catch (e) { stats.unchecked++; note(key, 'unchecked', o.label); tell(); return 'unchecked'; }
    })();
    keySet(key, p); p.then(v => valSet(key, v));
    return p;
  }
  // what is already known about it, without waiting: 'ok', 'adult', 'unchecked', or null (not checked yet)
  function knownOf(key) { if (key == null) return null; const v = typeof key === 'object' ? valObj.get(key) : valStr.get(String(key)); return v || null; }

  /* ---------- words ---------- */
  let wordsP = null;
  function loadWords() {
    if (window.FamilyWords) return Promise.resolve(window.FamilyWords);
    return wordsP || (wordsP = new Promise(ok => { const s = document.createElement('script'); s.src = BASE + 'words.min.js'; s.onload = () => ok(window.FamilyWords || null); s.onerror = () => ok(null); document.head.appendChild(s); }));
  }
  const rude = s => !!(window.FamilyWords && window.FamilyWords.has(String(s || '')));
  const tidy = s => window.FamilyWords ? window.FamilyWords.clean(String(s == null ? '' : s)) : String(s == null ? '' : s);
  async function checkWords(text, key, o) {
    const had = keyGet(key); if (had) return had;
    const p = loadWords().then(W => { const v = W ? (W.has(String(text || '')) ? 'adult' : 'ok') : 'unchecked'; stats.checked++; if (v === 'adult') stats.adult++; note(key, v, (o && o.label) || 'words'); tell(); return v; });
    keySet(key, p); p.then(v => valSet(key, v)); return p;
  }

  /* ---------- on the page: blurred while checked, hidden behind a warning when it may be adult ---------- */
  function css() {
    if (document.getElementById('fg-css')) return;
    const s = document.createElement('style'); s.id = 'fg-css';
    s.textContent = '.fg-wait{filter:blur(22px) saturate(.5)!important;transition:filter .3s}.fg-hold{filter:blur(36px) brightness(.35) saturate(.3)!important;pointer-events:none!important}' +
      '.fg-note{box-sizing:border-box;z-index:5;max-width:min(420px,calc(100% - 24px));padding:10px 14px;border-radius:12px;background:rgba(14,9,5,.94);border:1px solid rgba(247,147,26,.45);color:#f2e6d6;font:600 12px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}' +
      '.fg-note.fg-over{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}.fg-note.fg-below{margin:8px auto 0}' +
      '.fg-note b{display:block;font-size:13px;color:#ffb04a;letter-spacing:.06em;margin-bottom:3px}.fg-note b.fg-18{display:inline-block;margin:0 0 6px;padding:2px 9px;border-radius:9px;background:#b3261e;color:#fff;font-size:14px}' +
      '.fg-note button{margin-top:8px;padding:5px 12px;border-radius:10px;border:1px solid rgba(247,147,26,.55);background:rgba(247,147,26,.12);color:#ffb04a;font:700 12px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}' +
      '.fg-note button:focus-visible{outline:2px solid #ffb04a;outline-offset:2px}.fg-note.fg-small{padding:6px 10px;font-size:11px}';
    document.head.appendChild(s);
  }
  // el: the element that shows it (already in the page, or about to be). verdict: a Promise from check(). o: {key, below, kind, label}
  function guard(el, verdict, o) {
    o = o || {}; css(); if (!el) return el;
    const kind = o.kind || 'picture', key = o.key, tok = el._fgTok = (el._fgTok || 0) + 1;   // (the same element guarded again: only the newest counts)
    if (el._fgNote) { el._fgNote.remove(); el._fgNote = null; } el.classList.remove('fg-wait', 'fg-hold');
    let n = null;
    const mine = () => el._fgTok === tok;
    const clear = () => { if (!mine()) return; el.classList.remove('fg-wait', 'fg-hold'); if (n) { n.remove(); n = el._fgNote = null; } };
    const place = (k) => { if (!mine() || !n) return; if (el.isConnected && el.parentNode) el.insertAdjacentElement('afterend', n); else if ((k || 0) < 240) requestAnimationFrame(() => place((k || 0) + 1)); };
    const say = (html, btn, small) => {
      if (!mine()) return;
      if (n) n.remove(); n = el._fgNote = document.createElement('div'); n.className = 'fg-note ' + (o.below ? 'fg-below' : 'fg-over') + (small ? ' fg-small' : '');
      n.innerHTML = html; n.setAttribute('role', 'note');
      if (btn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = btn; b.onclick = e => { e.preventDefault(); e.stopPropagation(); if (key != null) shown.add(typeof key === 'object' ? key : String(key)); stats.shownByPerson++; clear(); tell(); }; n.appendChild(b); }
      place();
    };
    const isShown = () => key != null && shown.has(typeof key === 'object' ? key : String(key));
    if (isShown()) return el;
    el.classList.add('fg-wait');
    if (!o.quiet) say('Checking this ' + kind + '…', null, true);
    Promise.resolve(verdict).then(v => {
      if (!mine()) return;
      if (isShown()) return clear();
      if (v === 'adult') { el.classList.remove('fg-wait'); el.classList.add('fg-hold'); return say('<b class="fg-18">18+</b><b>Hidden: this may be adult content</b>Anyone can inscribe anything, and our checker thinks this ' + kind + ' may not be family friendly. Only show it if you are 18 or over.', 'Show it (I am 18 or over)'); }
      if (v === 'unchecked') { el.classList.remove('fg-wait'); el.classList.add('fg-hold'); return say('<b>Not checked</b>This ' + kind + ' could not be checked just now, so it is hidden.', 'Show it'); }
      if (strict) { el.classList.remove('fg-wait'); el.classList.add('fg-hold'); return say('<b>Family mode</b>Pictures from inscriptions stay hidden until you choose.', 'Show it'); }
      clear();
    });
    return el;
  }

  /* ---------- for 3D worlds: a tile that says it is hidden, and a blurred stand-in while it is checked ---------- */
  function placard(n) {
    const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
    x.fillStyle = '#1b0f0a'; x.fillRect(0, 0, n, n); x.strokeStyle = '#b3261e'; x.lineWidth = Math.max(1, n / 24); x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, n - x.lineWidth, n - x.lineWidth);
    x.fillStyle = '#ff6b5c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 ' + Math.round(n * .36) + 'px system-ui,-apple-system,"Segoe UI",sans-serif'; x.fillText('18+', n / 2, n * (n >= 64 ? .44 : .5));
    if (n >= 64) { x.fillStyle = '#e8d6c2'; x.font = '700 ' + Math.round(n * .1) + 'px system-ui,-apple-system,"Segoe UI",sans-serif'; x.fillText('HIDDEN', n / 2, n * .74); }
    return c;
  }
  function coarse(src, n) {   // the picture, so blurred that nothing can be made out (its colours only)
    const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), k = 4;
    const t = document.createElement('canvas'); t.width = t.height = k; const tx = t.getContext('2d'); tx.imageSmoothingEnabled = true; tx.drawImage(src, 0, 0, k, k);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(t, 0, 0, n, n); return c;
  }

  /* ---------- the switch, and what agents can read ---------- */
  function setStrict(on) { strict = !!on; try { on ? localStorage.setItem(SKEY, '1') : localStorage.removeItem(SKEY); } catch (e) {} tell(); return strict; }
  function state() {
    return {familyMode: strict, checker: dead ? 'not working here: ' + dead : W ? 'ready' : 'starts with the first picture', checked: stats.checked, hiddenAsMaybeAdult: stats.adult, couldNotCheck: stats.unchecked, shownByAPerson: stats.shownByPerson,
      recent: recent.slice(-15), rule: 'A picture is hidden behind an 18+ warning when the checker (NSFWJS, in this browser) scores it 0.5 or more for adult content. Only a person can choose to show it. Words in inscriptions and chat are checked for rude words (AllProfanity). Neither checker is perfect.'};
  }
  window.FamilyGuard = {check, checkWords, known: knownOf, guard, placard, coarse, sample, loadWords, rude, tidy, strict: () => strict, setStrict, state, onChange: f => { subs.add(f); return () => subs.delete(f); }, base: BASE, version: '1.0.0'};
})();
