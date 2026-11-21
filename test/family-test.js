/* The Family Guard, by bitmap22. Always free.
   Keeps the Ord Portal family friendly. Anyone can inscribe anything, so every picture and film from an inscription is checked,
   in the visitor's own browser, before it is shown clearly:
   - while it is being checked, it is blurred;
   - when the checker thinks it may be adult content, it stays hidden behind an 18+ warning, and only a person can choose to show it;
   - when it could not be checked, it stays hidden until a person chooses to show it;
   - in Family mode (a switch kept in this browser), every picture from an inscription stays hidden until a person chooses;
   - a moving picture (GIF, moving WebP or PNG) is checked on several of its frames, where the browser can split it into frames
     (Chrome and Edge can; elsewhere its first frame is checked);
   - a moving picture or film that flashes more than 3 times a second (the WCAG rule: a seizure risk for some people) shows still,
     with a warning, until a person chooses to play it; and with "reduce motion" turned on, every moving picture shows still.
   Words written in an inscription, and what players type in chat, are checked for rude words too.
   The picture checker is NSFWJS (MIT licence, by Infinite Red) with its MobileNetV2 model, run in a background worker so games
   stay smooth. (21 Nov 2026) It works on the device's main processor (TensorFlow.js's WebAssembly engine, Apache 2.0), not on
   its graphics chip: on a phone, checking a busy block's pictures on the graphics chip took the time the game needed to draw.
   Where WebAssembly can't start, it falls back to the graphics chip. The word checker is AllProfanity (MIT licence, by Ayush Jadaun). Both live in this folder, with their licences.
   Neither is perfect: NSFWJS is right about 9 times in 10, and it looks at the picture only (not words drawn in it, and not
   violence). Nothing is sent anywhere: every check happens on this computer or phone.
   For AI agents: FamilyGuard.state() says what was checked and hidden. An agent never shows something that was hidden.
   (c) 2026 bitmap22. All rights reserved. Free to use on the Ord Portal, under its licence (LICENCE, at the top of the repository). */
(function () {
  'use strict';
  if (window.FamilyGuard) return;
  const onSite = /(^|\.)github\.io$|(^|\.)ordportal\.com$/.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // (20 Nov 2026) still frames are kept in wide colour (Display P3), so deep reds and greens are not dulled to ordinary colour
  const WIDE = {colorSpace: 'display-p3'};
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
  // how it moves, once known: {anim: moves or not, frames: 'all' (several checked) or 'first', flash: flashes in its worst second}
  const metaStr = new Map(), metaObj = new WeakMap(), partial = new Set(), partialObj = new WeakSet();
  const metaSet = (k, v) => { if (k == null) return; if (typeof k === 'object') metaObj.set(k, v); else { metaStr.set(String(k), v); if (metaStr.size > 6000) metaStr.delete(metaStr.keys().next().value); } };
  const metaOf = k => k == null ? null : (typeof k === 'object' ? metaObj.get(k) : metaStr.get(String(k))) || null;
  const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  // flashing, the WCAG "three flashes" rule, read on each quarter of the picture and its middle (as the Safety Scan reads it)
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  function flashes(frames, times, W, H) {
    if (!frames || frames.length < 4) return 0;
    let worst = 0;
    for (const [px, py] of [[0, 0], [W / 2, 0], [0, H / 2], [W / 2, H / 2], [W / 4, H / 4]]) {
      const pw = W / 2, ph = H / 2, L = frames.map(f => { let s = 0; for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) s += lin(f[y * W + x]); return s / (pw * ph); });
      const turns = []; let ref = L[0], dir = 0;
      for (let i = 1; i < L.length; i++) { const d = L[i] - ref; if (Math.abs(d) >= 0.1 && Math.min(L[i], ref) < 0.8) { const g = Math.sign(d); if (g !== dir) { turns.push(times[i]); dir = g; } ref = L[i]; } else if (dir && Math.sign(L[i] - ref) === dir) ref = L[i]; }
      for (let i = 0; i + 1 < turns.length; i++) { let n = 0; for (let j = i; j + 1 < turns.length && turns[j + 1] - turns[i] < 1000; j += 2) n++; worst = Math.max(worst, n); }
    }
    return worst;
  }
  const grey32 = (x, src) => { x.fillStyle = '#000'; x.fillRect(0, 0, 32, 32); x.drawImage(src, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data, g = new Uint8Array(1024); for (let k = 0; k < 1024; k++) g[k] = Math.round(.2126 * d[k * 4] + .7152 * d[k * 4 + 1] + .0722 * d[k * 4 + 2]); return g; };
  // (21 Nov 2026) a GIF's frames, read here when the browser has no ImageDecoder (Safari, Firefox): each frame is drawn in turn, as a
  // browser plays it, so the checker sees frames from all through it and the flash check sees every frame. Up to 1,000 frames.
  function lzw(d, mcs, npix) {
    const out = new Uint8Array(npix); if (mcs < 2 || mcs > 8) return out;
    const clear = 1 << mcs, eoi = clear + 1, pre = new Int16Array(4096), suf = new Uint8Array(4096), stack = new Uint8Array(4097);
    for (let i = 0; i < clear; i++) { pre[i] = -1; suf[i] = i; }
    let size = mcs + 1, mask = (1 << size) - 1, avail = clear + 2, old = -1, first = 0, bits = 0, cur = 0, pos = 0, o = 0;
    while (o < npix) {
      while (bits < size) { if (pos >= d.length) return out; cur |= d[pos++] << bits; bits += 8; }
      let code = cur & mask; cur >>>= size; bits -= size;
      if (code === clear) { size = mcs + 1; mask = (1 << size) - 1; avail = clear + 2; old = -1; continue; }
      if (code === eoi) break;
      if (old === -1) { if (code >= clear) break; out[o++] = suf[code]; old = first = code; continue; }
      const inCode = code; let sp = 0;
      if (code >= avail) { stack[sp++] = first; code = old; }
      while (code > eoi) { if (sp >= 4096) return out; stack[sp++] = suf[code]; code = pre[code]; }
      first = suf[code]; stack[sp++] = first;
      if (avail < 4096) { pre[avail] = old; suf[avail] = first; avail++; if (avail === (1 << size) && size < 12) { size++; mask = (1 << size) - 1; } }
      old = inCode;
      while (sp && o < npix) out[o++] = stack[--sp];
    }
    return out;
  }
  async function gifFrames(b, picks) {
    if (b.length < 13 || b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return null;
    let p = 6; const u = () => b[p++], u16 = () => { const v = b[p] | b[p + 1] << 8; p += 2; return v; };
    const W = u16(), H = u16(), f = u(); p += 2; if (!W || !H || W * H > 4e6) return null;
    const table = n => { const t = b.subarray(p, p + 3 * n); p += 3 * n; return t; }, gct = f & 0x80 ? table(2 << (f & 7)) : null, start = p;
    // first, how many frames (picks are spread through them)
    let n = 0; while (p < b.length) { const c = u(); if (c === 0x3B) break; if (c === 0x21) { p++; while (p < b.length) { const k = u(); if (!k) break; p += k; } continue; } if (c !== 0x2C) break; p += 8; const g = u(); if (g & 0x80) p += 3 * (2 << (g & 7)); p++; while (p < b.length) { const k = u(); if (!k) break; p += k; } n++; }
    if (n < 2) return {n};
    const want = new Set(picks(n)), px = new Uint8ClampedArray(W * H * 4), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', {willReadFrequently: true});
    const small = [], times = [], big = []; let t = 0, i = 0, gce = {disp: 0, tr: -1, delay: 0}, still = null; p = start;
    const grey = () => { const g = new Uint8Array(1024); for (let gy = 0; gy < 32; gy++) for (let gx = 0; gx < 32; gx++) { const o = (Math.floor((gy + .5) * H / 32) * W + Math.floor((gx + .5) * W / 32)) * 4, a = px[o + 3] / 255; g[gy * 32 + gx] = Math.round((.2126 * px[o] + .7152 * px[o + 1] + .0722 * px[o + 2]) * a); } return g; };
    while (p < b.length && i < 1000) {
      const c = u(); if (c === 0x3B) break;
      if (c === 0x21) { const lab = u(); if (lab === 0xF9 && b[p] >= 4) { p++; const g = u(); gce = {disp: (g >> 2) & 7, delay: b[p] | b[p + 1] << 8, tr: g & 1 ? b[p + 2] : -1}; p += 3; } while (p < b.length) { const k = u(); if (!k) break; p += k; } continue; }
      if (c !== 0x2C) break;
      const x0 = u16(), y0 = u16(), w = u16(), h = u16(), g = u(), tab = g & 0x80 ? table(2 << (g & 7)) : gct, inter = g & 0x40, mcs = u();
      let len = 0; for (let q = p; q < b.length;) { const k = b[q]; q += 1 + k; if (!k) break; len += k; }
      const data = new Uint8Array(len); for (let k0 = 0; p < b.length;) { const k = u(); if (!k) break; data.set(b.subarray(p, p + k), k0); k0 += k; p += k; }
      if (!w || !h || w * h > 4e6) break;
      const idx = lzw(data, mcs, w * h), keep = gce.disp === 3 ? px.slice() : null;
      const rows = []; if (inter) { for (const [s0, st] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = s0; y < h; y += st) rows.push(y); }
      for (let r = 0; r < h; r++) { const y = (inter ? rows[r] : r) + y0; if (y >= H) continue; for (let xx = 0; xx < w; xx++) { const x = x0 + xx; if (x >= W) continue; const ci = idx[r * w + xx]; if (ci === gce.tr || !tab || ci * 3 + 2 >= tab.length) continue; const o = (y * W + x) * 4; px[o] = tab[ci * 3]; px[o + 1] = tab[ci * 3 + 1]; px[o + 2] = tab[ci * 3 + 2]; px[o + 3] = 255; } }
      small.push(grey()); times.push(t); const ms = gce.delay * 10; t += ms <= 10 ? 100 : ms;
      if (want.has(i) || !i) { cx.putImageData(new ImageData(px, W, H), 0, 0); if (want.has(i)) big.push(sample(cv)); if (!i) try { const k = Math.min(1, 2048 / Math.max(W, H)), c0 = document.createElement('canvas'); c0.width = Math.max(1, Math.round(W * k)); c0.height = Math.max(1, Math.round(H * k)); c0.getContext('2d').drawImage(cv, 0, 0, c0.width, c0.height); still = c0.toDataURL('image/png'); } catch (e) {} }
      if (gce.disp === 2) { for (let y = y0; y < Math.min(H, y0 + h); y++) px.fill(0, (y * W + x0) * 4, (y * W + Math.min(W, x0 + w)) * 4); } else if (keep) px.set(keep);
      gce = {disp: 0, tr: -1, delay: 0}; i++;
      if (!(i % 40)) await new Promise(r => setTimeout(r));
    }
    for (let k = 0, L = small.length, T = t; k < L && times[times.length - 1] - T < 1000; k++) { small.push(small[k]); times.push(T + times[k]); }   // (it loops: the join counts too)
    return {n, big: big.filter(Boolean), flash: flashes(small, times, 32, 32), still};
  }
  // twelve frames spread through a moving picture, for the checker
  const spread = n => [...new Set(Array.from({length: Math.min(n, 12)}, (_, k) => Math.round(k * (n - 1) / Math.max(1, Math.min(n, 12) - 1))))];
  // a moving picture's frames: twelve spread through it for the checker, and up to 1,000 small grey ones for flashing
  async function animFrames(bytes, type) {
    const ty = String(type || '').toLowerCase(); if (!/^image\/(gif|webp|png|apng|avif)/.test(ty)) return null;
    if (typeof ImageDecoder === 'undefined') { if (/gif/.test(ty)) { try { const G = await gifFrames(bytes, spread); if (G) return G; } catch (e) {} } return /gif|webp|apng/.test(ty) ? {n: 0, firstOnly: true} : null; }
    let dec; try { dec = new ImageDecoder({data: bytes, type: ty === 'image/apng' ? 'image/png' : ty}); await dec.tracks.ready; } catch (e) { return null; }
    try {
      const tr = dec.tracks.selectedTrack, n = tr ? tr.frameCount : 1; if (!(n > 1)) return {n: 1};
      const N = Math.min(n, 1000), pick = spread(n);
      const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d', {willReadFrequently: true});
      const small = [], times = [], big = []; let t = 0, still = null;
      for (let i = 0; i < N; i++) { if (i && !(i % 40)) await new Promise(r => setTimeout(r)); const {image} = await dec.decode({frameIndex: i}); small.push(grey32(x, image)); if (!i) try { const w = image.displayWidth, h = image.displayHeight, k = Math.min(1, 2048 / Math.max(w, h)), c0 = document.createElement('canvas'); c0.width = Math.max(1, Math.round(w * k)); c0.height = Math.max(1, Math.round(h * k)); const x0 = c0.getContext('2d', WIDE); x0.imageSmoothingEnabled = k < 1; x0.drawImage(image, 0, 0, c0.width, c0.height); still = c0.toDataURL('image/png'); } catch (e) {} /* (its first frame, kept to show it still) */ times.push(t); const ms = (image.duration || 0) / 1000; t += ms <= 10 ? 100 : ms; if (pick.includes(i)) big.push(sample(image)); image.close(); }
      for (const i of pick) if (i >= N) { const {image} = await dec.decode({frameIndex: i}); big.push(sample(image)); image.close(); }
      for (let i = 0, L = small.length, T = t; i < L && times[times.length - 1] - T < 1000; i++) { small.push(small[i]); times.push(T + times[i]); }   // (it loops: the join counts too)
      return {n, big: big.filter(Boolean), flash: flashes(small, times, 32, 32), still};
    } finally { try { dec.close(); } catch (e) {} }
  }

  /* ---------- the picture checker: a worker, loaded the first time a picture needs it ---------- */
  let W = null, dead = '', seq = 0, busy = 0, engine = '';
  const wait = new Map(), qNow = [], qLater = [];
  function worker() {
    if (W || dead) return W;
    try {
      const u = n => JSON.stringify(BASE + n), js = ['model.min.js', 'group1-shard1of1.min.js', 'nsfwjs.min.js'].map(u).join(',');
      // (21 Nov 2026) the main processor, not the graphics chip: TensorFlow.js's WebAssembly engine is loaded beside the checker
      // (both use the same TensorFlow.js 4.22.0, which shares one engine between them) and chosen before the model loads
      const src = 'importScripts(' + js + ');\n' +
        'let E = "the graphics chip (WebGL)";\n' +
        'const cpu = async () => { try { importScripts(' + u('tf-core.min.js') + ', ' + u('tf-backend-wasm.min.js') + '); const w = ' + u('tfjs-backend-wasm.wasm') + ', s = ' + u('tfjs-backend-wasm-simd.wasm') + ';\n' +
        '  tf.wasm.setWasmPaths({"tfjs-backend-wasm.wasm": w, "tfjs-backend-wasm-simd.wasm": s, "tfjs-backend-wasm-threaded-simd.wasm": s});\n' +
        '  if (await tf.setBackend("wasm")) E = "the main processor (WebAssembly" + (await tf.env().getAsync("WASM_HAS_SIMD_SUPPORT") ? ", SIMD" : "") + ")"; } catch (e) {} };\n' +
        'let M = null; const ready = cpu().then(() => nsfwjs.load("MobileNetV2")).then(m => { M = m; postMessage({engine: E}); }, e => { postMessage({dead: String(e && e.message || e)}); });\n' +
        'onmessage = async e => { const {id, data} = e.data; try { await ready; if (!M) throw Error("no checker"); const p = await M.classify(data); postMessage({id, p: p.map(q => [q.className, q.probability])}); } catch (x) { postMessage({id, err: String(x && x.message || x)}); } };';
      W = new Worker(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})));
      W.onmessage = e => { const m = e.data || {}; if (m.dead) return die(m.dead); if (m.engine) { engine = m.engine; return; } const f = wait.get(m.id); if (!f) return; wait.delete(m.id); busy--; m.err ? f.no(new Error(m.err)) : f.ok(m.p); pump(); };
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
  function classify(data, soon, key) { return new Promise((ok, no) => { if (dead) return no(new Error(dead)); (soon ? qNow : qLater).push({data, ok, no, key}); pump(); }); }
  // (21 Nov 2026) already being checked? Then nothing more is needed. soon: someone is looking at it now, so it goes to the front
  // of the queue (a busy block queues hundreds of pictures; the ones in front of you are checked first)
  function hurry(key, soon) {
    if (key == null || !keyGet(key)) return false;
    if (soon && !knownOf(key)) { const k = typeof key === 'object' ? key : String(key), i = qLater.findIndex(j => j.key === k); if (i >= 0) { qNow.push(qLater.splice(i, 1)[0]); pump(); } }
    return true;
  }

  /* ---------- a picture, made ready for the checker (224 x 224, as the checker looks at it) ---------- */
  let sc224 = null;   // (one drawing surface, used again for every picture: a busy block has hundreds)
  function sample(src) {
    try {
      if (!src) return null; if (typeof ImageData !== 'undefined' && src instanceof ImageData) return src;
      const w = src.naturalWidth || src.videoWidth || src.displayWidth || src.width, h = src.naturalHeight || src.videoHeight || src.displayHeight || src.height; if (!w || !h) return null;   // (displayWidth: a frame split out of a moving picture)
      if (!sc224) { const c = document.createElement('canvas'); c.width = c.height = 224; sc224 = c.getContext('2d', {willReadFrequently: true}); }
      const x = sc224; x.fillStyle = '#000'; x.fillRect(0, 0, 224, 224); x.drawImage(src, 0, 0, 224, 224);
      return x.getImageData(0, 0, 224, 224);
    } catch (e) { return null; }   // (a picture this page may not read: it stays unchecked)
  }
  async function decode(bytes, type) {
    const blob = new Blob([bytes], {type: type || ''});
    if (!/svg/.test(type || '') && window.createImageBitmap) { try { return await createImageBitmap(blob); } catch (e) {} }
    const url = URL.createObjectURL(blob), im = new Image(); im.src = url;
    try { await im.decode(); return im; } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  }
  async function filmSamples(bytes, type) {   // eight moments of a film, spread through it
    const url = URL.createObjectURL(new Blob([bytes], {type: type || 'video/mp4'})), v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url; const out = [];
    try {
      await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('the film could not be read')); setTimeout(() => no(new Error('the film took too long')), 15000); });
      const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
      for (const f of d ? [.06, .19, .31, .44, .56, .69, .81, .94] : [0]) {
        if (d) await new Promise(ok => { v.onseeked = ok; v.currentTime = d * f; setTimeout(ok, 4000); });
        const s = sample(v); if (s) out.push(s);
      }
      if (d) {   // flashing: 3-second windows all through it (up to 8, from the start), 24 frames a second each
        const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d', {willReadFrequently: true}), at = d <= 3 ? [0] : [...new Set(Array.from({length: Math.min(8, Math.ceil(d / 3))}, (_, k) => Math.max(0, Math.min(d - 3, k * (d - 3) / Math.max(1, Math.min(8, Math.ceil(d / 3)) - 1)))))]; let worst = 0;
        for (const s0 of at) { const fr = [], tm = []; for (let t = s0; t < Math.min(d, s0 + 3); t += 1 / 24) { await new Promise(ok => { v.onseeked = ok; v.currentTime = t; setTimeout(ok, 1500); }); try { fr.push(grey32(x, v)); tm.push(t * 1000); } catch (e) { break; } } worst = Math.max(worst, flashes(fr, tm, 32, 32)); }
        out.flash = worst;
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
    const fuller = src && (src.bytes || typeof src === 'string'), wasPartial = key != null && (typeof key === 'object' ? partialObj.has(key) : partial.has(String(key)));
    const had = keyGet(key); if (had && !(fuller && wasPartial)) return had;
    if (key != null) { if (fuller) { if (typeof key === 'object') partialObj.delete(key); else partial.delete(String(key)); } else if (src) { if (typeof key === 'object') partialObj.add(key); else partial.add(String(key)); } }
    const p = (async () => {
      if (had) { const v0 = await had; if (v0 === 'adult') return v0; }   // (checked before from one frame: still adult if it was; else checked again, fully)
      let samples = [], meta = null;
      try {
        if (typeof src === 'string') { const r = await fetch(src); if (!r.ok) throw Error('not answered'); const ty = (r.headers.get('content-type') || '').split(';')[0]; src = {bytes: new Uint8Array(await r.arrayBuffer()), type: ty}; }
        if (src && src.bytes) {
          if (/^video\//.test(src.type || '')) { samples = src.bytes.length <= 40e6 ? await filmSamples(src.bytes, src.type) : []; meta = {anim: true, frames: 'film', flash: samples.flash || 0}; }
          else {
            if (/svg/.test(src.type || '')) { const tx = new TextDecoder().decode(src.bytes.subarray(0, 400000)); if (/<(animate|animateTransform|animateMotion|set)\b|@keyframes|animation(-name)?\s*:|<script/i.test(tx)) meta = {anim: true, frames: 'svg', flash: 0, why: 'svg'}; }
            const A = await animFrames(src.bytes, src.type);
            if (A && A.n > 1) meta = {anim: true, frames: A.big && A.big.length ? 'all' : 'first', flash: A.flash || 0, still: A.still || null};
            if (A && A.n > 1 && A.big && A.big.length) samples = A.big;
            else { const im = await decode(src.bytes, src.type); samples = [sample(im)]; if (im && im.close) im.close(); if (A && A.firstOnly) meta = {anim: null, frames: 'first', flash: null}; }
          }
        } else samples = [sample(src)];
        samples = samples.filter(Boolean); if (!samples.length) throw Error('nothing to look at');
        let worst = {v: 'ok', score: 0};
        for (const s of samples) { const r = verdictOf(await classify(s, o.soon, key == null ? null : typeof key === 'object' ? key : String(key))); if (r.score > worst.score) worst = r; if (r.v === 'adult') { worst = r; break; } }
        if (meta) metaSet(key, meta);
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
    const add = src => new Promise(ok => { const s = document.createElement('script'); s.src = BASE + src; s.onload = () => ok(true); s.onerror = () => ok(false); document.head.appendChild(s); });
    return wordsP || (wordsP = add('words.min.js').then(() => window.FamilyWords ? add('words-plus.js?v=1') : null).then(() => window.FamilyWords || null));   // (the list, then the layer that makes it harder to get round)
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
      if (btn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = btn; b.onclick = e => { e.preventDefault(); e.stopPropagation(); if (!e.isTrusted) return; if (key != null) shown.add(typeof key === 'object' ? key : String(key)); stats.shownByPerson++; clear(); tell(); }; n.appendChild(b); }
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
      clear(); still(el, key, kind, o);
    });
    return el;
  }

  // a moving picture or film that may flash (or any moving picture, with "reduce motion" on): shown still until a person plays it
  const played = new Set();
  function still(el, key, kind, o) {
    const M = metaOf(key); if (!M || !el || !M.anim) return;
    const flash = M.flash > 3, calm = reduceMotion(), svg = M.why === 'svg', ask = !!(o && o.still); if (!flash && !calm && !svg && !ask) return;   // (o.still: someone else's, as on a crewmate's stand: moving pictures wait for a tap)
    const k = key != null ? (typeof key === 'object' ? key : String(key)) : null; if (k != null && played.has(k)) return;
    const n = document.createElement('div'); n.className = 'fg-note ' + (el.tagName === 'VIDEO' ? 'fg-below' : 'fg-over') + (flash ? '' : ' fg-small'); n.setAttribute('role', 'note');
    n.innerHTML = flash ? '<b>⚡ May flash</b>This ' + kind + ' flashes ' + M.flash + ' times a second, which can set off seizures in some people. It is shown still.' : calm ? '<b>Still picture</b>Reduce motion is on, so this moving ' + kind + ' is shown still.' : svg ? '<b>Still picture</b>This ' + kind + ' moves by itself (it can change after it was checked), so it is shown still.' : '<b>Still picture</b>This moving ' + kind + ' is shown still until you play it.';
    const b = document.createElement('button'); b.type = 'button'; b.textContent = flash ? 'Play it anyway' : 'Play it'; n.appendChild(b);
    const go = e => { if (e) { e.preventDefault(); e.stopPropagation(); if (!e.isTrusted) return; } if (k != null) played.add(k); n.remove(); if (el._fgOrig) { el.src = el._fgOrig; el._fgOrig = null; } };
    b.onclick = go;
    if (el.tagName === 'VIDEO') { try { el.pause(); } catch (e) {} const stop = () => { if (n.isConnected) { try { el.pause(); } catch (e) {} } else el.removeEventListener('play', stop); }; el.addEventListener('play', stop); }
    else if (el.tagName === 'IMG') {   // (its first frame, drawn once, stands in for it)
      const freeze = () => { if (M.still) { el._fgOrig = el.currentSrc || el.src; el.src = M.still; return; } try { const c = document.createElement('canvas'); c.width = el.naturalWidth || 1; c.height = el.naturalHeight || 1; c.getContext('2d', WIDE).drawImage(el, 0, 0); el._fgOrig = el.currentSrc || el.src; el.src = c.toDataURL('image/png'); } catch (e) {} };
      if (M.still || el.complete && el.naturalWidth) freeze(); else el.addEventListener('load', freeze, {once: true});
    } else return;
    if (el.isConnected && el.parentNode) el.insertAdjacentElement('afterend', n);
  }

  /* ---------- for 3D worlds: a tile that says it is hidden, and a blurred stand-in while it is checked ---------- */
  function placard(n) {
    const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
    x.fillStyle = '#1b0f0a'; x.fillRect(0, 0, n, n); x.strokeStyle = '#b3261e'; x.lineWidth = Math.max(1, n / 24); x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, n - x.lineWidth, n - x.lineWidth);
    x.fillStyle = '#ff6b5c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 ' + Math.round(n * .36) + 'px system-ui,-apple-system,"Segoe UI",sans-serif'; x.fillText('18+', n / 2, n * (n >= 64 ? .44 : .5));
    if (n >= 64) { x.fillStyle = '#e8d6c2'; x.font = '700 ' + Math.round(n * .1) + 'px system-ui,-apple-system,"Segoe UI",sans-serif'; x.fillText('HIDDEN', n / 2, n * .74); }
    return c;
  }
  let c4 = null;
  // the picture, so blurred that nothing can be made out (its colours only). into: a canvas of the caller's to draw it on (a 3D
  // world that sends it straight to its graphics, and so needs no new canvas for each picture); else a new one
  function coarse(src, n, into) {
    const c = into || document.createElement('canvas'); if (c.width !== n) c.width = n; if (c.height !== n) c.height = n; const x = c.getContext('2d');
    if (!c4) { const t = document.createElement('canvas'); t.width = t.height = 4; c4 = t.getContext('2d'); c4.imageSmoothingEnabled = true; }
    c4.clearRect(0, 0, 4, 4); c4.drawImage(src, 0, 0, 4, 4);
    x.clearRect(0, 0, n, n); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(c4.canvas, 0, 0, n, n); return c;
  }

  /* ---------- the switch, and what agents can read ---------- */
  function setStrict(on) { strict = !!on; try { on ? localStorage.setItem(SKEY, '1') : localStorage.removeItem(SKEY); } catch (e) {} tell(); return strict; }
  function state() {
    return {familyMode: strict, reduceMotion: reduceMotion(), framesChecked: typeof ImageDecoder !== 'undefined' ? 'several frames of a moving picture' : 'the first frame of a moving picture (this browser cannot split it into frames)', checker: dead ? 'not working here: ' + dead : W ? 'ready' : 'starts with the first picture', checksOn: engine || (W && !dead ? 'starting' : 'not started yet'), checked: stats.checked, hiddenAsMaybeAdult: stats.adult, couldNotCheck: stats.unchecked, shownByAPerson: stats.shownByPerson,
      recent: recent.slice(-15), rule: 'A picture is hidden behind an 18+ warning when the checker (NSFWJS, in this browser) scores it 0.5 or more for adult content. Only a person can choose to show it. A moving picture is checked on four of its frames where the browser can split it (Chrome, Edge). A moving picture or film that flashes more than 3 times a second (the WCAG rule) shows still with a warning until a person plays it; with reduce motion on, every moving picture shows still. Words in inscriptions and chat are checked for rude words (AllProfanity). Neither checker is perfect.'};
  }
  window.FamilyGuard = {check, hurry, checkWords, known: knownOf, motion: metaOf, flashes, guard, placard, coarse, sample, loadWords, rude, tidy, strict: () => strict, setStrict, state, onChange: f => { subs.add(f); return () => subs.delete(f); }, base: BASE, version: '1.3.0'};
})();
