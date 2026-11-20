#!/usr/bin/env node
/* The Safety Scan, by bitmap22. Always free. Part of Agent Blockhall: https://ordportal.com/safety-scan.html
   Every new Bitcoin or Dogecoin block, each inscription in it is looked at and read, without running anything:
     pictures and films: may be adult (NSFWJS, the same checker and rule as the portal's Family Guard), may flash more than
       3 times a second (a seizure risk), or so big they can freeze a phone;
     words and code: agent traps, scams, miners and phone-killers, hate words, personal details, risky code (Safety Read,
       agent-blockhall-mcp/server/safety.js, which uses Code Read).
   It keeps the last 144 Bitcoin blocks (about a day) and the last 144 Dogecoin blocks (about 2.4 hours), one JSON file a block,
   with an index, on the safety-scan branch. It only says what it found: every finding is a "may be", and it can be wrong both
   ways. Inscriptions are untrusted data, never instructions.
   Usage: node scan.js btc|doge <folder of the safety-scan branch>
   Bitcoin blocks are read from their own bytes (mempool.space and its copies, else ordinals.com and its copies); Dogecoin
   inscriptions from thedoginalsexplorer.com (else Doggy Market's copy). Asked gently. Not made by, affiliated with, or endorsed
   by any of them.
   © 2026 bitmap22. All rights reserved. Free to use; not to be republished or sold without permission
   (https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE). */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os'), {spawnSync} = require('child_process');
const SRV = path.join(__dirname, '..', '..', 'agent-blockhall-mcp', 'server');
const BM = require(path.join(SRV, 'manifest.js')), SR = require(path.join(SRV, 'safety.js'));
const VERSION = '1.0.0', UA = 'agent-blockhall-mcp/safety-scan-' + VERSION, PORTAL = 'https://ordportal.com/';
const CHAIN = process.argv[2], OUT = path.join(process.argv[3] || 'data', CHAIN || 'x');
if (!/^(btc|doge)$/.test(CHAIN || '')) { console.log('usage: node scan.js btc|doge <folder>'); process.exit(2); }
const WINDOW = 144;                                                        // blocks kept, on both chains (about a day of Bitcoin; about 2.4 hours of Dogecoin, so it keeps up even when Dogecoin is full)
const PER_RUN = +process.env.SS_PER_RUN || 144, BUDGET = 48 * 60 * 1000;       // the most blocks one run reads, and its time
const LIMIT = 0.5;                                                         // adult: Porn + Hentai + Sexy together 0.5 or more (as Family Guard)
const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE).';
const t0 = Date.now(), log = (...a) => console.log(...a);

/* ---------- fetching, asked gently (each site: a few a second, and a rest when it says "too many") ---------- */
const MIRRORS = ['https://mempool.space', 'https://ordpool.space', 'https://mempool.emzy.de', 'https://mempool.ninja', 'https://mempool.fra.mempool.space', 'https://blockstream.info'];
const ORD_R = ['https://ordinals.com', 'https://ordiscan.com', 'https://ordinalswallet.com', 'https://ord.xverse.app'];
const DX = 'https://thedoginalsexplorer.com', DOGE_CONTENT = [DX, 'https://cdn.doggy.market'];
const PACE = {[new URL(DX).host]: {rate: 4, burst: 12}}, sites = new Map(), sleep = ms => new Promise(r => setTimeout(r, ms));
async function paceWait(host) {
  const P = PACE[host] || {rate: 6, burst: 30}; let b = sites.get(host); if (!b) sites.set(host, b = {tok: P.burst, t: Date.now(), restUntil: 0});
  for (;;) { const now = Date.now(); b.tok = Math.min(P.burst, b.tok + (now - b.t) / 1000 * P.rate); b.t = now; if (b.tok >= 1) { b.tok -= 1; return b; } await sleep(Math.ceil((1 - b.tok) / P.rate * 1000)); }
}
async function fetchT(url, ms) {
  const host = new URL(url).host, b = await paceWait(host);
  if (b.restUntil > Date.now()) { if (b.restUntil - Date.now() > 65000) throw new Error('resting ' + host); await sleep(b.restUntil - Date.now()); }   // (a short rest is waited out; a long one moves on to the next site)
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 20000); let r;
  try { r = await fetch(url, {signal: ctl.signal, headers: {'User-Agent': UA}}); } catch (e) { b.restUntil = Date.now() + 20000; throw new Error('no answer from ' + host); } finally { clearTimeout(timer); }
  if (r.status === 429 || r.status === 503) { b.restUntil = Date.now() + (+r.headers.get('retry-after') || 30) * 1000; throw new Error('http ' + r.status + ' from ' + host); }
  if (!r.ok) throw new Error('http ' + r.status + ' from ' + host);
  // a site that says how much it has left (the Doginals Explorer: 300 units a minute, X-RateLimit-Remaining): near the end, rest until the minute is up
  const left = parseFloat(r.headers.get('x-ratelimit-remaining')), lim = parseFloat(r.headers.get('x-ratelimit-limit'));
  if (Number.isFinite(left) && Number.isFinite(lim) && left < lim * 0.15) b.restUntil = Math.max(b.restUntil, Date.now() + 20000);
  return r;
}
async function fromAny(list, p, ms, how) {
  let err = null;
  for (const b of list) { try { const r = await fetchT(b + p, ms); return {v: await (how ? how(r) : r.text()), site: b}; } catch (e) { err = e; } }
  throw err || new Error('no site answered');
}
const bytesOf = async r => { const n = +r.headers.get('content-length'); if (n > 8e6) throw new Error('too big'); return new Uint8Array(await r.arrayBuffer()); };

/* ---------- the picture checker (NSFWJS 4.4.0, MIT, with TensorFlow.js, Apache-2.0), on WebAssembly ---------- */
let tf = null, nsfw = null, sharp = null, M = null;
async function checker() {
  if (M) return M;
  tf = require('@tensorflow/tfjs'); require('@tensorflow/tfjs-backend-wasm'); nsfw = require('nsfwjs'); sharp = require('sharp');
  await tf.setBackend('wasm'); await tf.ready(); M = await nsfw.load('MobileNetV2'); return M;
}
const ffmpegOk = (() => { try { return spawnSync('ffmpeg', ['-version'], {timeout: 5000}).status === 0; } catch (e) { return false; } })();
async function adultScore(rgb) {   // rgb: 224 x 224 x 3 bytes
  const x = tf.tensor3d(rgb, [224, 224, 3], 'int32'); try { const p = await M.classify(x); const s = n => (p.find(q => q.className === n) || {}).probability || 0; return +(s('Porn') + s('Hentai') + s('Sexy')).toFixed(3); } finally { x.dispose(); }
}
// flashing: the WCAG "three flashes" rule, read on each quarter of the picture (a quarter is the area the rule counts)
const flashes = SR.flashes;   // (the WCAG three-flashes rule, shared with the portal's wallet check: safety.js)
async function lookPicture(buf, ty) {
  const finds = []; let meta;
  try { meta = await sharp(buf, {animated: true, limitInputPixels: 1e8}).metadata(); }
  catch (e) { if (/pixel limit|too large|exceeds/i.test(String(e))) finds.push({kind: 'miner', what: 'a picture so big it can freeze a phone'}); return {finds, looked: false}; }
  const W = meta.width || 0, H = meta.pageHeight || meta.height || 0, pages = meta.pages || 1;
  if (W * H * pages > 6e7 || W > 16384 || H > 16384) finds.push({kind: 'miner', what: 'a picture so big it can freeze a phone (' + W + ' x ' + H + (pages > 1 ? ', ' + pages + ' frames' : '') + ')'});
  if (W < 48 || H < 48) return {finds, looked: false, small: true};
  // adult: up to 3 frames
  const pick = pages > 1 ? [...new Set([0, pages >> 1, Math.max(0, pages - 2)])] : [0];
  let score = 0;
  for (const pg of pick) {
    try { const raw = await sharp(buf, {page: pg, limitInputPixels: 1e8}).resize(224, 224, {fit: 'fill'}).flatten({background: '#000'}).removeAlpha().raw().toBuffer(); score = Math.max(score, await adultScore(new Uint8Array(raw))); } catch (e) {}
  }
  if (score >= LIMIT) finds.push({kind: 'adult', what: 'a picture that may show nudity', score});
  // flashing: moving pictures
  if (pages >= 4) {
    try {
      const n = Math.min(pages, 400), raw = await sharp(buf, {animated: true, pages: n, limitInputPixels: 1e8}).resize(32, 32, {fit: 'fill'}).flatten({background: '#000'}).greyscale().raw().toBuffer();
      const frames = [], times = []; let t = 0; const d = meta.delay || [];
      for (let i = 0; i < n; i++) { frames.push(raw.subarray(i * 1024, i * 1024 + 1024)); times.push(t); const ms = +d[i] || 100; t += ms <= 10 ? 100 : ms; }
      if (meta.loop !== 1) for (let i = 0; i < n && times[times.length - 1] - t < 1000; i++) { frames.push(frames[i]); times.push(t + times[i]); }   // (it loops: the join counts too)
      const f = flashes(frames, times, 32, 32); if (f > 3) finds.push({kind: 'flash', what: 'flashes ' + f + ' times in one second', perSecond: f});
    } catch (e) {}
  }
  return {finds, looked: true, score};
}
function lookFilm(buf) {
  const finds = []; if (!ffmpegOk) return {finds, looked: false};
  const f = path.join(os.tmpdir(), 'ss-film-' + process.pid); fs.writeFileSync(f, buf);
  try {
    const a = spawnSync('ffmpeg', ['-v', 'error', '-t', '60', '-i', f, '-vf', 'fps=1/4,scale=224:224', '-frames:v', '6', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {timeout: 40000, maxBuffer: 2e7});
    const shots = []; if (a.stdout) for (let i = 0; i + 150528 <= a.stdout.length; i += 150528) shots.push(new Uint8Array(a.stdout.subarray(i, i + 150528)));
    const b = spawnSync('ffmpeg', ['-v', 'error', '-t', '30', '-i', f, '-vf', 'fps=20,scale=32:32', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], {timeout: 40000, maxBuffer: 2e7});
    const frames = [], times = []; if (b.stdout) for (let i = 0; i + 1024 <= b.stdout.length; i += 1024) { frames.push(b.stdout.subarray(i, i + 1024)); times.push(frames.length * 50); }
    return {finds, shots, frames, times, looked: shots.length > 0 || frames.length > 0};
  } finally { try { fs.unlinkSync(f); } catch (e) {} }
}

/* ---------- one inscription: looked at and read ---------- */
const PIC = /^image\/(png|jpeg|jpg|webp|gif|avif|bmp|tiff)$/, FILM = /^video\//;
const stats = () => ({inscriptions: 0, pictures: 0, films: 0, models: 0, sounds: 0, text: 0, notLooked: 0});
async function checkOne(id, ty, buf, S) {
  ty = String(ty || '').split(';')[0].trim().toLowerCase(); const finds = [];
  if (PIC.test(ty)) {
    S.pictures++; await checker(); const r = await lookPicture(Buffer.from(buf), ty); finds.push(...r.finds); if (!r.looked && !r.small) S.notLooked++;
  } else if (FILM.test(ty)) {
    S.films++; await checker(); const r = lookFilm(Buffer.from(buf));
    if (!r.looked) S.notLooked++;
    else {
      let score = 0; for (const s of r.shots || []) score = Math.max(score, await adultScore(s));
      if (score >= LIMIT) finds.push({kind: 'adult', what: 'a film that may show nudity', score});
      const f = flashes(r.frames || [], r.times || [], 32, 32); if (f > 3) finds.push({kind: 'flash', what: 'flashes ' + f + ' times in one second', perSecond: f});
    }
  } else if (/^audio\//.test(ty)) {
    S.sounds++; const A = SR.readSound(ty, buf); finds.push(...A.finds);
    for (const p of A.pictures) { try { await checker(); const r = await lookPicture(Buffer.from(p.bytes), p.type); for (const f of r.finds) { f.what += ' (' + p.where + ')'; finds.push(f); } } catch (e) {} }
  } else if (SR.isModel(ty)) {
    S.models++; const M = SR.readModel(ty, buf); finds.push(...M.finds.map(f => (delete f.file, f)));
    for (const p of M.pictures) { try { await checker(); const r = await lookPicture(Buffer.from(p.bytes), p.type); for (const f of r.finds) { f.what += ' (' + p.where + ')'; finds.push(f); } } catch (e) {} }
  } else if (SR.isText(ty) || !ty) {
    S.text++;
    const text = Buffer.from(buf).toString('utf8');
    for (const f of SR.read(ty || 'text/plain', text, id)) { delete f.file; finds.push(f); }
    if (/svg/.test(ty)) {   // (an SVG is a drawing: drawn here, with nothing in it run or fetched, then looked at like any picture)
      try { await checker(); const png = await sharp(Buffer.from(buf), {density: 96, limitInputPixels: 1e8}).resize(512, 512, {fit: 'inside'}).png().toBuffer(); const r = await lookPicture(png, 'image/png'); S.pictures++; for (const f of r.finds) { f.what = f.what.replace('a picture', 'a drawing (SVG)'); finds.push(f); } } catch (e) {}
    }
    // pictures tucked inside the code (data: addresses): looked at too
    let k = 0;
    for (const m of text.matchAll(/data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]{2000,})/g)) {
      if (++k > 3) break;
      try { await checker(); const r = await lookPicture(Buffer.from(m[2], 'base64'), 'image/' + m[1]); for (const f of r.finds) { f.what += ' (inside the code)'; finds.push(f); } } catch (e) {}
    }
  }
  return finds;
}
const slim = f => { const o = {kind: f.kind, what: f.what}; for (const k of ['line', 'score', 'perSecond', 'hidden', 'codeRead']) if (f[k] != null) o[k] = f[k]; if (f.sample && f.sample.untrusted) o.sample = {untrusted: String(f.sample.untrusted).slice(0, 160)}; if (f.sample && f.sample.masked) o.sample.masked = true; return o; };

/* ---------- Bitcoin: a block, from its own bytes ---------- */
async function btcTip() { return +(await fromAny(MIRRORS, '/api/blocks/tip/height', 15000)).v; }
async function btcBlock(h) {
  const hash = (await fromAny(MIRRORS, '/api/block-height/' + h, 15000)).v.trim();
  let X, site;
  try { const r = await fromAny(MIRRORS, '/api/block/' + hash + '/raw', 120000, bytesOfBig); X = r.v; site = r.site; }
  catch (e) { const r = await fromAny(ORD_R, '/r/block/' + h, 120000); let t = r.v.trim(); if (t[0] === '"') t = t.slice(1, -1); X = BM.fromHex ? BM.fromHex(t) : Uint8Array.from(Buffer.from(t, 'hex')); site = r.site; }
  const bodies = [], scan = BM.scanBlock(X, h, {onBody: (n, index, ty, pieces, enc) => bodies.push({n, index, ty, pieces, enc})});
  if (scan.hash !== hash) throw new Error('the block\'s bytes don\'t match its hash');
  const time = new Date(new DataView(X.buffer, X.byteOffset).getUint32(68, true) * 1000).toISOString().replace('.000', '');
  const S = stats(), found = [];
  S.inscriptions = scan.txs.reduce((n, r) => n + r.ins.length, 0);
  for (const b of bodies) {
    const id = scan.txs[b.n].txid + 'i' + b.index; let buf = Buffer.concat(b.pieces.map(p => Buffer.from(p.buffer, p.byteOffset, p.length)));
    if (b.enc) { try { buf = zlib.brotliDecompressSync(buf, {maxOutputLength: 8e6}); } catch (e) { S.notLooked++; continue; } }
    if (!b.ty || b.ty === 'delegate') continue;
    let finds = []; try { finds = await checkOne(id, b.ty, buf, S); } catch (e) { S.notLooked++; }
    if (finds.length) found.push({id, contentType: b.ty, bytes: buf.length, kinds: [...new Set(finds.map(f => f.kind))], finds: finds.slice(0, 8).map(slim)});
  }
  return {height: h, hash, time, readFrom: site, ...S, found};
}
const bytesOfBig = async r => new Uint8Array(await r.arrayBuffer());

/* ---------- Dogecoin: a block's inscriptions, from the explorer ---------- */
const dj = async (p, ms) => { try { return JSON.parse((await fromAny([DX], p, ms || 30000)).v); } catch (e) { if (!/http 429|http 503|resting/.test(String(e))) throw e; await sleep(30000); return JSON.parse((await fromAny([DX], p, ms || 30000)).v); } };   // ("too many": rest, then once more)
async function dogeTip() { const j = await dj('/v1/blocks?limit=1'); return j.blocks[0].height; }
async function dogeBlock(h) {
  const B = await dj('/v1/block/' + h + '?limit=100'), list = (B.txs || []).slice();
  for (let pg = 2; list.length < (B.total || 0) && pg <= 400; pg++) { const P = await dj('/v1/block/' + h + '?limit=100&page=' + pg); if (!P.txs || !P.txs.length) break; list.push(...P.txs); }
  const S = stats(), found = [];
  for (const t of list) {
    const I = t.inscription; if (!I || !I.id) continue; S.inscriptions++;
    const ty = String(I.contentType || '').split(';')[0].trim().toLowerCase();
    if (I.delegate || !(PIC.test(ty) || FILM.test(ty) || SR.isText(ty) || SR.isModel(ty) || /^audio\//.test(ty))) continue;
    if ((I.kinds || []).some(k => /dogemap|drc-?20/i.test(k))) continue;   // (names and token lines: one line of fixed text, nothing to read)
    let buf; try { buf = (await fromAny(DOGE_CONTENT, '/content/' + I.id, 30000, bytesOf)).v; } catch (e) { S.notLooked++; continue; }
    let finds = []; try { finds = await checkOne(I.id, ty, buf, S); } catch (e) { S.notLooked++; }
    if (finds.length) found.push({id: I.id, contentType: ty, bytes: buf.length, kinds: [...new Set(finds.map(f => f.kind))], finds: finds.slice(0, 8).map(slim)});
  }
  return {height: h, hash: B.hash, time: new Date(B.time * 1000).toISOString().replace('.000', ''), readFrom: DX, ...S, found};
}

/* ---------- the run: newest blocks first, then the index ---------- */
async function main() {
  fs.mkdirSync(path.join(OUT, 'blocks'), {recursive: true});
  const ixFile = path.join(OUT, 'index.json');
  let ix = {blocks: []}; try { ix = JSON.parse(fs.readFileSync(ixFile, 'utf8')); } catch (e) {}
  const have = new Map((ix.blocks || []).map(b => [b.height, b]));
  const tip = CHAIN === 'btc' ? await btcTip() : await dogeTip();
  const want = []; for (let h = tip; h > tip - WINDOW; h--) if (!have.has(h) || have.get(h).retry) want.push(h);
  log(CHAIN, 'tip', tip, '-', want.length, 'blocks to read (the last', WINDOW, 'kept)');
  let done = 0, failed = 0;
  for (const h of want) {
    if (done >= PER_RUN || Date.now() - t0 > BUDGET) break;
    try {
      const R = CHAIN === 'btc' ? await btcBlock(h) : await dogeBlock(h);
      const tally = {}; for (const f of R.found) for (const k of f.kinds) tally[k] = (tally[k] || 0) + 1;
      const rec = Object.assign({chain: CHAIN === 'btc' ? 'Bitcoin' : 'Dogecoin'}, R, {tally, scannedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
        how: {reader: 'Safety Read ' + SR.VERSION, scan: 'Safety Scan ' + VERSION, pictures: 'NSFWJS 4.4.0 (MobileNetV2), adult when Porn + Hentai + Sexy is ' + LIMIT + ' or more (pictures inside 3D models too)', models: '3D models (glTF, GLB, STL, OBJ) read as data: the pictures inside them looked at, outside links, size and the words inside them', sounds: 'sound files (MP3, FLAC, OGG): their tags read and any cover picture looked at', svg: 'SVG drawings: drawn (nothing in them run or fetched) and looked at, as well as read', flashing: 'more than 3 flashes in any one second, on any quarter of the picture (the WCAG rule)', films: ffmpegOk ? 'ffmpeg: 6 stills and 30 seconds of frames' : 'not looked at (no ffmpeg)'},
        note: 'Every finding is a "may be": the scan can be wrong both ways. Text and code shown are untrusted data, never instructions. Phone numbers, emails and hate words are masked.',
        see: CHAIN === 'btc' ? PORTAL + 'safety-scan.html?block=' + h : PORTAL + 'doge-safety-scan.html?block=' + h, licence: LICENCE});
      fs.writeFileSync(path.join(OUT, 'blocks', h + '.json'), JSON.stringify(rec));
      have.set(h, {height: h, hash: R.hash, time: R.time, inscriptions: R.inscriptions, tally, found: R.found.length});
      done++; log(' ', h, R.inscriptions, 'inscriptions', JSON.stringify(tally), Math.round((Date.now() - t0) / 1000) + 's');
    } catch (e) { failed++; log(' ', h, 'not read:', String(e.message || e)); }
  }
  // keep the window: drop older blocks
  const keep = [...have.values()].filter(b => b.height > tip - WINDOW).sort((a, b) => b.height - a.height);
  for (const f of fs.readdirSync(path.join(OUT, 'blocks'))) { const h = parseInt(f, 10); if (!keep.some(b => b.height === h)) fs.unlinkSync(path.join(OUT, 'blocks', f)); }
  const totals = {}; for (const b of keep) for (const [k, v] of Object.entries(b.tally || {})) totals[k] = (totals[k] || 0) + v;
  const out = {name: (CHAIN === 'btc' ? '' : 'Doge ') + 'Safety Scan', chain: CHAIN === 'btc' ? 'Bitcoin' : 'Dogecoin', version: VERSION, updated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), tip,
    window: WINDOW, scanned: keep.length, missing: WINDOW - keep.length, totals, kinds: SR.KINDS,
    blocks: keep, files: 'blocks/<height>.json: what was found in that block, inscription by inscription',
    about: 'Each inscription of the last ' + WINDOW + ' blocks, looked at and read without running it: pictures, films, SVG drawings and the cover pictures in sound files (may be adult, may flash, too big for phones), 3D models, and words and code (agent traps, scams, miners and phone-killers, hate words, personal details, risky code). Made by GitHub on its own, about every hour. Every finding is a "may be".',
    see: PORTAL + (CHAIN === 'btc' ? 'safety-scan.html' : 'doge-safety-scan.html'), licence: LICENCE};
  fs.writeFileSync(ixFile, JSON.stringify(out, null, 1));
  log('done:', done, 'read,', failed, 'not read,', keep.length, 'kept,', Math.round((Date.now() - t0) / 1000) + 's');
}
main().catch(e => { console.log('stopped:', e && e.stack || e); process.exit(1); });
