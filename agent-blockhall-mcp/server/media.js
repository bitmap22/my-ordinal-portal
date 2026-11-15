/* The Media Reader, by bitmap22. Always free.
   "Tuning in": it opens a file's own bytes (an inscription on Bitcoin, or a Doginal on Dogecoin) and says what is really in it,
   every number read or counted from the bytes themselves, never guessed. The same file is used by the portal's pages, by
   Agent Blockhall and Doge Cube, and by the Agent Blockhall MCP tool.
   Pictures: PNG (and moving PNG), GIF, JPEG, WebP, AVIF, BMP and SVG: resolution, colour depth, how colour is stored, the palette,
   the exact number of colours used (where a file's colours are fixed: PNG, GIF, BMP, SVG), see-through parts, colour profile,
   frames and timing, how it is packed, and any words written inside it (marked untrusted: anyone can write them).
   Squashed ("lossy") pictures (JPEG, lossy WebP, AVIF) have no one true colour count: different programs unpack the same bytes
   into slightly different pixels, so none is given for them, and the answer says why.
   Sound: MP3, AAC, WAV, Ogg (Vorbis, Opus), FLAC and M4A: length, samples a second, bits, mono or stereo, bitrate, how it is packed,
   cover art, and any title or artist written inside it (untrusted). Video: MP4, QuickTime, WebM and Matroska: resolution, length,
   frames a second, codec, and whether it has sound.
   Usage: MediaReader.read(bytes (Uint8Array), declaredType (string, optional)) -> Promise of the reading; MediaReader.describe(reading)
   -> plain words. Works in a browser and in Node.js 18 or newer, with no other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in its folder). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MediaReader = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const MAX_PIXELS = 16000000;   // (colours are counted one pixel at a time: past this, the file is still read, but its colours are not counted)
  const MAX_LIST = 256;          // (at most this many colours or words are listed; the counts are always whole)

  /* ---------- small helpers ---------- */
  const be16 = (u, i) => (u[i] << 8) | u[i + 1];
  const le16 = (u, i) => u[i] | (u[i + 1] << 8);
  const be24 = (u, i) => (u[i] << 16) | (u[i + 1] << 8) | u[i + 2];
  const le24 = (u, i) => u[i] | (u[i + 1] << 8) | (u[i + 2] << 16);
  const be32 = (u, i) => ((u[i] << 24) | (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3]) >>> 0;
  const le32 = (u, i) => (u[i] | (u[i + 1] << 8) | (u[i + 2] << 16) | (u[i + 3] << 24)) >>> 0;
  const s32le = (u, i) => u[i] | (u[i + 1] << 8) | (u[i + 2] << 16) | (u[i + 3] << 24);
  const ascii = (u, i, n) => { let s = ''; for (let k = 0; k < n && i + k < u.length; k++) s += String.fromCharCode(u[i + k]); return s; };
  const hex2 = v => (v < 16 ? '0' : '') + v.toString(16);
  const rgbHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
  const utf8 = u => { try { return new TextDecoder('utf-8', {fatal: false}).decode(u); } catch (e) { let s = ''; for (const c of u) s += String.fromCharCode(c); return s; } };
  const utf8ok = u => { try { new TextDecoder('utf-8', {fatal: true}).decode(u); return true; } catch (e) { return false; } };
  const latin1 = u => { let s = ''; for (const c of u) s += String.fromCharCode(c); return s; };
  const clean = (s, n) => { s = String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim(); return s.length > (n || 400) ? s.slice(0, n || 400) + '…' : s; };
  const cat = parts => { let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

  // unpacking zlib data (PNG pictures, PNG colour profiles and text): the browser's own, or Node's
  async function inflate(u) {
    if (typeof require === 'function') { try { const z = require('zlib'); return new Uint8Array(z.inflateSync(u)); } catch (e) { if (!/Cannot find module/.test(String(e))) throw e; } }
    if (typeof DecompressionStream === 'function') {
      const ds = new DecompressionStream('deflate'), w = ds.writable.getWriter(); w.write(u); w.close();
      return new Uint8Array(await new Response(ds.readable).arrayBuffer());
    }
    throw new Error('this place has no way to unpack zlib data');
  }
  // the file's fingerprint (SHA-256): the browser's own, or Node's
  async function sha256(u) {
    if (typeof require === 'function') { try { return require('crypto').createHash('sha256').update(u).digest('hex'); } catch (e) {} }
    const c = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto : null;
    if (!c) return null;
    const h = new Uint8Array(await c.subtle.digest('SHA-256', u)); let s = ''; for (const b of h) s += hex2(b); return s;
  }

  /* ---------- what a file really is, from its first bytes ---------- */
  function sniff(u) {
    const a = ascii(u, 0, 16);
    if (u[0] === 0x89 && a.slice(1, 4) === 'PNG') return {type: 'image/png', name: 'PNG'};
    if (a.startsWith('GIF87a') || a.startsWith('GIF89a')) return {type: 'image/gif', name: 'GIF'};
    if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return {type: 'image/jpeg', name: 'JPEG'};
    if (a.startsWith('RIFF') && a.slice(8, 12) === 'WEBP') return {type: 'image/webp', name: 'WebP'};
    if (a.startsWith('RIFF') && a.slice(8, 12) === 'WAVE') return {type: 'audio/wav', name: 'WAV'};
    if (a.startsWith('BM') && u.length > 26) return {type: 'image/bmp', name: 'BMP'};
    if (a.slice(4, 8) === 'ftyp') {
      const brands = []; const sz = be32(u, 0); for (let i = 8; i + 4 <= Math.min(sz, 64); i += 4) if (i !== 12) brands.push(ascii(u, i, 4));
      if (brands.includes('avif') || brands.includes('avis')) return {type: 'image/avif', name: 'AVIF'};
      if (brands.some(b => /^(heic|heix|mif1)$/.test(b))) return {type: 'image/heic', name: 'HEIF'};
      if (brands.some(b => /^(M4A |M4B )$/.test(b))) return {type: 'audio/mp4', name: 'M4A'};
      if (brands.some(b => /^qt  $/.test(b))) return {type: 'video/quicktime', name: 'QuickTime'};
      return {type: 'video/mp4', name: 'MP4'};
    }
    if (u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3) return {type: 'video/webm', name: 'WebM/Matroska'};
    if (a.startsWith('OggS')) return {type: 'audio/ogg', name: 'Ogg'};
    if (a.startsWith('fLaC')) return {type: 'audio/flac', name: 'FLAC'};
    if (a.startsWith('ID3') || (u[0] === 0xff && (u[1] & 0xe0) === 0xe0 && (u[1] & 0x06) !== 0)) return {type: 'audio/mpeg', name: 'MP3'};
    if (u[0] === 0xff && (u[1] & 0xf6) === 0xf0) return {type: 'audio/aac', name: 'AAC'};
    if (a.startsWith('glTF')) return {type: 'model/gltf-binary', name: 'glTF (binary)'};
    if (a.startsWith('%PDF')) return {type: 'application/pdf', name: 'PDF'};
    if (a.startsWith('wOFF')) return {type: 'font/woff', name: 'WOFF'};
    if (a.startsWith('wOF2')) return {type: 'font/woff2', name: 'WOFF2'};
    if (u[0] === 0x50 && u[1] === 0x4b && u[2] === 3 && u[3] === 4) return {type: 'application/zip', name: 'ZIP'};
    if (u[0] === 0x1f && u[1] === 0x8b) return {type: 'application/gzip', name: 'gzip'};
    // words: SVG, HTML, JSON, glTF (JSON), OBJ, plain text
    const head = utf8(u.subarray(0, Math.min(u.length, 4096))).replace(/^\ufeff/, '').trimStart(), low = head.toLowerCase();
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/.test(low)) return {type: 'image/svg+xml', name: 'SVG'};
    if (/^(<!doctype html|<html|<head|<body|<script|<meta|<div|<canvas|<style)/.test(low)) return {type: 'text/html', name: 'HTML'};
    if (/^[{[]/.test(head)) { if (/"asset"\s*:\s*\{[^}]*"version"/.test(head) || /"asset"\s*:/.test(head) && /"meshes"|"nodes"/.test(utf8(u))) return {type: 'model/gltf+json', name: 'glTF (JSON)'}; return {type: 'application/json', name: 'JSON'}; }
    if (/^(#.*\n|\s)*(v|vn|vt|f|o|g|mtllib|usemtl)\s/m.test(head) && /^v\s+-?[\d.]+\s+-?[\d.]+\s+-?[\d.]+/m.test(head)) return {type: 'model/obj', name: 'OBJ'};
    if (utf8ok(u)) return {type: 'text/plain', name: 'text'};
    return {type: null, name: 'not known from its first bytes'};
  }
  const FAMILY = t => !t ? 'other' : /^image\//.test(t) ? 'picture' : /^audio\//.test(t) ? 'sound' : /^video\//.test(t) ? 'video' : /^model\//.test(t) ? 'model' : /^(text\/|application\/(json|javascript|xml))/.test(t) ? 'words' : 'other';
  // two names for the same kind of file are the same kind (image/jpg and image/jpeg, audio/wave and audio/wav, ...)
  const SAME = {'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg', 'audio/wave': 'audio/wav', 'audio/x-wav': 'audio/wav', 'audio/vnd.wave': 'audio/wav', 'audio/mp3': 'audio/mpeg', 'audio/x-mp3': 'audio/mpeg', 'audio/x-aac': 'audio/aac', 'audio/x-flac': 'audio/flac', 'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4', 'image/x-ms-bmp': 'image/bmp', 'image/x-bmp': 'image/bmp', 'application/x-javascript': 'text/javascript', 'application/javascript': 'text/javascript', 'audio/opus': 'audio/ogg', 'video/ogg': 'audio/ogg', 'audio/webm': 'video/webm', 'model/stl': 'model/stl', 'image/apng': 'image/png'};
  const norm = t => { t = String(t || '').split(';')[0].trim().toLowerCase(); return SAME[t] || t; };
  function typesAgree(declared, found) {
    const d = norm(declared), f = norm(found);
    if (!d || !f) return null;
    if (d === f) return true;
    if (/^text\//.test(d) && f === 'text/plain') return true;                 // (any words file reads as words)
    if (d === 'application/json' && f === 'text/plain') return null;          // (words that do not start like JSON: checked by reading them)
    if ((d === 'video/webm' || d === 'audio/webm') && f === 'video/webm') return true;
    if (d === 'video/mp4' && (f === 'audio/mp4' || f === 'video/quicktime')) return true;
    if (d === 'audio/mp4' && f === 'video/mp4') return true;
    return false;
  }

  /* ---------- colours, counted exactly ---------- */
  function colourCounter() {
    const seen = new Set(); let seeThrough = false, over = false;
    return {
      add(key, alphaBelowFull) { if (alphaBelowFull) seeThrough = true; if (!over) { seen.add(key); if (seen.size > MAX_PIXELS) over = true; } },
      get count() { return over ? null : seen.size; }, get seeThrough() { return seeThrough; }, keys: () => seen
    };
  }

  /* ---------- PNG (and moving PNG) ---------- */
  const PNG_MODEL = {0: 'grey', 2: 'full colour (red, green, blue)', 3: 'a set palette', 4: 'grey with see-through levels', 6: 'full colour with see-through levels'};
  const PNG_CH = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4};
  async function readPNG(u, out) {
    const P = out.picture = {format: 'PNG'}, words = [];
    let p = 8, idat = [], plte = null, trns = null, frames = 0, plays = null, durationMs = 0, fctlSeen = 0, firstIsFrame = false, sawIDAT = false;
    while (p + 8 <= u.length) {
      const len = be32(u, p), t = ascii(u, p + 4, 4), d = u.subarray(p + 8, p + 8 + len);
      if (t === 'IHDR') { P.width = be32(d, 0); P.height = be32(d, 4); P.bitsPerChannel = d[8]; P.colourType = d[9]; P.interlaced = d[12] === 1; }
      else if (t === 'PLTE') plte = d;
      else if (t === 'tRNS') trns = d;
      else if (t === 'IDAT') { idat.push(d); sawIDAT = true; }
      else if (t === 'gAMA') P.gamma = +(be32(d, 0) / 100000).toFixed(5);
      else if (t === 'sRGB') P.profile = 'sRGB (rendering intent ' + d[0] + ')';
      else if (t === 'cHRM') P.chromaticities = true;
      else if (t === 'cICP') P.profile = 'coded colour (cICP: primaries ' + d[0] + ', transfer ' + d[1] + ')';
      else if (t === 'iCCP') { let z = 0; while (z < d.length && d[z]) z++; P.profile = 'an ICC colour profile named "' + clean(latin1(d.subarray(0, z)), 80) + '"'; }
      else if (t === 'pHYs') { const x = be32(d, 0), y = be32(d, 4); if (d[8] === 1) P.density = {dpiX: Math.round(x * 0.0254), dpiY: Math.round(y * 0.0254)}; else P.pixelAspect = x && y ? +(x / y).toFixed(4) : null; }
      else if (t === 'acTL') { frames = be32(d, 0); plays = be32(d, 4); }
      else if (t === 'fcTL') { fctlSeen++; if (!sawIDAT && fctlSeen === 1) firstIsFrame = true; const num = be16(d, 20), den = be16(d, 22) || 100; durationMs += num * 1000 / den; }
      else if (t === 'tEXt') { let z = 0; while (z < d.length && d[z]) z++; words.push({key: clean(latin1(d.subarray(0, z)), 80), text: clean(latin1(d.subarray(z + 1)))}); }
      else if (t === 'zTXt') { let z = 0; while (z < d.length && d[z]) z++; let txt = ''; try { txt = latin1(await inflate(d.subarray(z + 2))); } catch (e) { txt = '(packed words that could not be unpacked)'; } words.push({key: clean(latin1(d.subarray(0, z)), 80), text: clean(txt)}); }
      else if (t === 'iTXt') { let z = 0; while (z < d.length && d[z]) z++; const key = latin1(d.subarray(0, z)), comp = d[z + 1]; let q = z + 3; while (q < d.length && d[q]) q++; q++; while (q < d.length && d[q]) q++; q++; let txt = ''; try { txt = utf8(comp ? await inflate(d.subarray(q)) : d.subarray(q)); } catch (e) { txt = '(packed words that could not be unpacked)'; } words.push({key: clean(key, 80), text: clean(txt)}); }
      else if (t === 'eXIf') P.hasExif = true;
      else if (t === 'IEND') break;
      p += 12 + len;
    }
    if (!P.width) throw new Error('its PNG header could not be read');
    if (P.colourType === 3) { P.bitsPerIndex = P.bitsPerChannel; P.bitsPerChannel = 8; }   // (a palette picture: each pixel is a palette number; the palette's colours are 8 bits a channel)
    P.colourModel = PNG_MODEL[P.colourType] || 'colour type ' + P.colourType;
    if (frames > 1 || (frames === 1 && firstIsFrame && fctlSeen > 1)) { P.frames = frames; P.plays = plays === 0 ? 'for ever' : plays; P.durationMs = Math.round(durationMs); P.moving = true; }
    else P.frames = 1;
    if (plte) { P.palette = {size: plte.length / 3, colours: []}; for (let i = 0; i < plte.length && P.palette.colours.length < MAX_LIST; i += 3) P.palette.colours.push(rgbHex(plte[i], plte[i + 1], plte[i + 2])); }
    if (words.length) out.words = {untrusted: words.slice(0, 40), note: 'written inside the file by whoever made it'};
    P.packing = 'PNG keeps every pixel exactly (lossless)' + (P.interlaced ? ', interlaced (it draws in from blurry to sharp)' : '');
    // the colours, counted pixel by pixel from the picture's own data
    const px = P.width * P.height;
    if (px > MAX_PIXELS) { P.coloursUsed = null; P.coloursNote = 'not counted: ' + px.toLocaleString('en-GB') + ' pixels is more than this reader counts one by one'; return; }
    let raw; try { raw = await inflate(cat(idat)); } catch (e) { P.coloursUsed = null; P.coloursNote = 'not counted: its picture data could not be unpacked (' + (e.message || e) + ')'; return; }
    const C = colourCounter(), bd = P.bitsPerIndex || P.bitsPerChannel, ct = P.colourType, ch = PNG_CH[ct], bpp = ch * bd, bytesPP = Math.max(1, bpp >> 3), max = (1 << bd) - 1;
    const tr = trns ? (ct === 0 ? be16(trns, 0) : ct === 2 ? [be16(trns, 0), be16(trns, 2), be16(trns, 4)] : null) : null;
    const used = ct === 3 ? new Uint8Array(256) : null;
    const passes = P.interlaced ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
    let q = 0;
    for (const [x0, y0, dx, dy] of passes) {
      const pw = Math.ceil((P.width - x0) / dx), ph = Math.ceil((P.height - y0) / dy);
      if (pw <= 0 || ph <= 0) continue;
      const rb = Math.ceil(pw * bpp / 8); let prev = new Uint8Array(rb), cur = new Uint8Array(rb);
      for (let y = 0; y < ph; y++) {
        const f = raw[q++]; cur.set(raw.subarray(q, q + rb)); q += rb;
        for (let i = 0; i < rb; i++) {
          const a = i >= bytesPP ? cur[i - bytesPP] : 0, b = prev[i], c = i >= bytesPP ? prev[i - bytesPP] : 0;
          if (f === 1) cur[i] = (cur[i] + a) & 255; else if (f === 2) cur[i] = (cur[i] + b) & 255; else if (f === 3) cur[i] = (cur[i] + ((a + b) >> 1)) & 255;
          else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
        }
        const s = bd === 16 ? (i => (cur[i * 2] << 8) | cur[i * 2 + 1]) : bd === 8 ? (i => cur[i]) : (i => (cur[(i * bd) >> 3] >> (8 - bd - ((i * bd) & 7))) & max);
        for (let x = 0; x < pw; x++) {
          const k = x * ch;
          if (ct === 3) { const idx = s(k); used[idx] = 1; }
          else if (ct === 0) { const g = s(k); C.add(g, tr != null && g === tr); }
          else if (ct === 2) { const r = s(k), g = s(k + 1), b = s(k + 2); C.add(bd === 16 ? r * 4294967296 + g * 65536 + b : (r << 16) | (g << 8) | b, tr != null && r === tr[0] && g === tr[1] && b === tr[2]); }
          else if (ct === 4) { const g = s(k), al = s(k + 1); C.add(g * 65536 + al, al < max); }
          else if (ct === 6) { const r = s(k), g = s(k + 1), b = s(k + 2), al = s(k + 3); C.add(bd === 16 ? r + ',' + g + ',' + b + ',' + al : (r * 16777216) + (g << 16) + (b << 8) + al, al < max); }
        }
        const t = prev; prev = cur; cur = t;
      }
    }
    if (ct === 3) {   // a palette picture: the palette entries it really uses, and any see-through ones among them
      const seen = new Set(); let st = false, n = 0;
      for (let i = 0; i < 256; i++) if (used[i]) { n++; const r = plte ? plte[i * 3] : 0, g = plte ? plte[i * 3 + 1] : 0, b = plte ? plte[i * 3 + 2] : 0, al = trns && i < trns.length ? trns[i] : 255; if (al < 255) st = true; seen.add((r << 16 | g << 8 | b) * 256 + al); }
      P.coloursUsed = seen.size; P.paletteEntriesUsed = n; P.seeThrough = st;
    } else { P.coloursUsed = C.count; P.seeThrough = C.seeThrough; if (C.count == null) P.coloursNote = 'not counted: more colours than this reader keeps track of'; }
    if (P.moving) P.coloursNote = 'counted in its first picture (a moving PNG\'s other frames are drawn over it)';
    if (P.coloursUsed != null && P.coloursUsed <= 16 && ct !== 3) {   // (a handful of colours: list them)
      P.colours = [...C.keys()].slice(0, 16).map(k => typeof k === 'string' ? k : ct === 2 && bd === 8 ? rgbHex((k >> 16) & 255, (k >> 8) & 255, k & 255) : ct === 6 && bd === 8 ? rgbHex(Math.floor(k / 16777216), (k >> 16) & 255, (k >> 8) & 255) + ((k & 255) === 255 ? '' : hex2(k & 255)) : String(k));
    }
  }

  /* ---------- GIF ---------- */
  function lzw(minSize, data, count) {
    const out = new Uint8Array(count), clear = 1 << minSize, eoi = clear + 1, prefix = new Int16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097);
    let size = minSize + 1, mask = (1 << size) - 1, next = eoi + 1, old = -1, first = 0, bits = 0, acc = 0, o = 0, i = 0;
    for (let c = 0; c < clear; c++) suffix[c] = c;
    while (o < count) {
      while (bits < size) { if (i >= data.length) return {out, got: o}; acc |= data[i++] << bits; bits += 8; }
      const code = acc & mask; acc >>>= size; bits -= size;
      if (code === clear) { size = minSize + 1; mask = (1 << size) - 1; next = eoi + 1; old = -1; continue; }
      if (code === eoi) break;
      if (old === -1) { out[o++] = suffix[code]; old = code; first = code; continue; }
      let c = code, sp = 0;
      if (code >= next) { stack[sp++] = first; c = old; }
      while (c >= clear) { stack[sp++] = suffix[c]; c = prefix[c]; }
      first = suffix[c]; stack[sp++] = first;
      while (sp && o < count) out[o++] = stack[--sp];
      if (next < 4096) { prefix[next] = old; suffix[next] = first; next++; if ((next & mask) === 0 && next < 4096) { size++; mask = (1 << size) - 1; } }
      old = code;
    }
    return {out, got: o};
  }
  function readGIF(u, out) {
    const P = out.picture = {format: 'GIF (' + ascii(u, 3, 3) + ')'}, words = [];
    P.width = le16(u, 6); P.height = le16(u, 8);
    const pk = u[10], gct = pk & 0x80 ? u.subarray(13, 13 + 3 * (1 << ((pk & 7) + 1))) : null;
    P.bitsPerChannel = 8; P.colourModel = 'a set palette (up to 256 colours a frame)';
    if (gct) { P.palette = {size: gct.length / 3, colours: []}; for (let i = 0; i < gct.length && P.palette.colours.length < MAX_LIST; i += 3) P.palette.colours.push(rgbHex(gct[i], gct[i + 1], gct[i + 2])); }
    let p = 13 + (gct ? gct.length : 0), frames = 0, delay = 0, trIdx = -1, durationCs = 0, plays = null, local = 0, interlacedAny = false, pixelsOver = false;
    const seen = new Set(); let seeThrough = false, decodeFailed = 0;
    const blocks = () => { const parts = []; while (p < u.length) { const n = u[p++]; if (!n) break; parts.push(u.subarray(p, p + n)); p += n; } return parts; };
    while (p < u.length) {
      const b = u[p++];
      if (b === 0x21) {
        const label = u[p++];
        if (label === 0xf9) { const n = u[p]; const pkg = u[p + 1]; delay = le16(u, p + 2); trIdx = pkg & 1 ? u[p + 4] : -1; p += 1 + n; blocks(); }
        else if (label === 0xff) { const n = u[p]; const app = ascii(u, p + 1, n); p += 1 + n; const parts = blocks(); if (/^(NETSCAPE2\.0|ANIMEXTS1\.0)/.test(app) && parts[0] && parts[0][0] === 1) plays = le16(parts[0], 1); else if (app) words.push({key: 'application block', text: clean(app, 40)}); }
        else if (label === 0xfe) { const parts = blocks(); words.push({key: 'comment', text: clean(latin1(cat(parts)))}); }
        else { const n = u[p]; p += 1 + n; const parts = blocks(); if (label === 0x01) words.push({key: 'plain text block', text: clean(latin1(cat(parts)))}); }
      } else if (b === 0x2c) {
        const w = le16(u, p + 4), h = le16(u, p + 6), fp = u[p + 8]; p += 9;
        if (fp & 0x40) interlacedAny = true;
        let table = gct;
        if (fp & 0x80) { const n = 3 * (1 << ((fp & 7) + 1)); table = u.subarray(p, p + n); p += n; local++; }
        const minSize = u[p++], data = cat(blocks());
        frames++; durationCs += delay;
        if (w * h <= MAX_PIXELS && table && seen.size < MAX_PIXELS) {
          const r = lzw(minSize, data, w * h); if (r.got < w * h) decodeFailed++;
          const usedIdx = new Uint8Array(256); for (let i = 0; i < r.got; i++) usedIdx[r.out[i]] = 1;
          for (let i = 0; i < 256; i++) if (usedIdx[i]) { if (i === trIdx) { seeThrough = true; continue; } if (i * 3 + 2 < table.length) seen.add((table[i * 3] << 16) | (table[i * 3 + 1] << 8) | table[i * 3 + 2]); }
        } else pixelsOver = true;
        delay = 0; trIdx = -1;
      } else if (b === 0x3b) break;
      else break;
    }
    P.frames = frames; if (frames > 1) { P.moving = true; P.durationMs = durationCs * 10; P.plays = plays == null ? 'once' : plays === 0 ? 'for ever' : plays + 1; P.framesWithOwnPalette = local || undefined; }
    if (pixelsOver) { P.coloursUsed = null; P.coloursNote = 'not counted: a frame is bigger than this reader counts one by one'; }
    else { P.coloursUsed = seen.size; P.seeThrough = seeThrough; if (frames > 1) P.coloursNote = 'counted across all ' + frames + ' frames'; if (decodeFailed) P.coloursNote = (P.coloursNote ? P.coloursNote + '; ' : '') + decodeFailed + ' frame' + (decodeFailed === 1 ? '' : 's') + ' ended early in the file: counted as far as they go'; }
    if (P.coloursUsed != null && P.coloursUsed <= 16) P.colours = [...seen].map(k => rgbHex((k >> 16) & 255, (k >> 8) & 255, k & 255));
    P.packing = 'GIF keeps every pixel exactly (lossless), up to 256 colours a frame' + (interlacedAny ? ', interlaced' : '');
    if (words.length) out.words = {untrusted: words.slice(0, 40), note: 'written inside the file by whoever made it'};
  }

  /* ---------- BMP ---------- */
  function readBMP(u, out) {
    const P = out.picture = {format: 'BMP'};
    const off = le32(u, 10), hs = le32(u, 14), w = s32le(u, 18), h = s32le(u, 22), bpp = le16(u, 28), comp = hs >= 40 ? le32(u, 30) : 0, ncol = hs >= 40 ? le32(u, 46) : 0;
    P.width = Math.abs(w); P.height = Math.abs(h); P.bitsPerPixel = bpp;
    P.colourModel = bpp <= 8 ? 'a set palette' : bpp === 32 ? 'full colour (32 bits a pixel)' : 'full colour';
    const palN = bpp <= 8 ? (ncol || (1 << bpp)) : 0, palAt = 14 + hs;
    if (palN) { P.palette = {size: palN, colours: []}; for (let i = 0; i < palN && i < MAX_LIST; i++) P.palette.colours.push(rgbHex(u[palAt + i * 4 + 2], u[palAt + i * 4 + 1], u[palAt + i * 4])); }
    P.packing = comp === 0 ? 'not packed at all: every pixel stored as it is' : comp === 1 || comp === 2 ? 'run-length packed (RLE)' : comp === 3 || comp === 6 ? 'bit fields' : 'packing ' + comp;
    if (comp !== 0 || ![1, 4, 8, 24, 32].includes(bpp) || P.width * P.height > MAX_PIXELS) { P.coloursUsed = null; P.coloursNote = 'not counted: only plain (unpacked) 1, 4, 8, 24 and 32 bit BMPs are counted'; return; }
    const row = Math.ceil(P.width * bpp / 32) * 4, seen = new Set();
    for (let y = 0; y < P.height; y++) {
      const r0 = off + y * row;
      for (let x = 0; x < P.width; x++) {
        if (bpp >= 24) { const i = r0 + x * (bpp >> 3); seen.add((u[i + 2] << 16) | (u[i + 1] << 8) | u[i]); }
        else { const bit = x * bpp, v = (u[r0 + (bit >> 3)] >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1); const i = palAt + v * 4; seen.add((u[i + 2] << 16) | (u[i + 1] << 8) | u[i]); }
      }
    }
    P.coloursUsed = seen.size; P.seeThrough = false;
    if (seen.size <= 16) P.colours = [...seen].map(k => rgbHex((k >> 16) & 255, (k >> 8) & 255, k & 255));
  }

  /* ---------- colour profiles (ICC): their own name ---------- */
  function iccName(d) {
    try {
      const n = be32(d, 128);
      for (let i = 0; i < n && i < 100; i++) {
        const e = 132 + i * 12, sig = ascii(d, e, 4), at = be32(d, e + 4);
        if (sig !== 'desc') continue;
        const ty = ascii(d, at, 4);
        if (ty === 'desc') { const len = be32(d, at + 8); return clean(latin1(d.subarray(at + 12, at + 12 + len - 1)), 80); }
        if (ty === 'mluc') { const rec = at + 16, len = be32(d, rec + 4), off = be32(d, rec + 8); let s = ''; for (let k = 0; k < len; k += 2) s += String.fromCharCode(be16(d, at + off + k)); return clean(s, 80); }
      }
    } catch (e) {}
    return null;
  }

  /* ---------- JPEG ---------- */
  const SOF = {0xc0: 'baseline', 0xc1: 'extended', 0xc2: 'progressive (it draws in from blurry to sharp)', 0xc3: 'lossless JPEG', 0xc5: 'differential', 0xc6: 'differential progressive', 0xc7: 'differential lossless', 0xc9: 'extended, arithmetic-coded', 0xca: 'progressive, arithmetic-coded', 0xcb: 'lossless, arithmetic-coded'};
  function readEXIF(d, out) {
    // the camera's or program's own words (make, model, software, date), and whether a place (GPS) is written in
    try {
      const le = ascii(d, 0, 2) === 'II', g16 = i => le ? le16(d, i) : be16(d, i), g32 = i => le ? le32(d, i) : be32(d, i);
      const ifd = g32(4), n = g16(ifd), want = {0x010f: 'camera make', 0x0110: 'camera model', 0x0131: 'software', 0x0132: 'date written', 0x013b: 'artist', 0x8298: 'copyright', 0x010e: 'description'}, got = [];
      let gps = false, orientation = null;
      for (let i = 0; i < n && i < 200; i++) {
        const e = ifd + 2 + i * 12, tag = g16(e), type = g16(e + 2), cnt = g32(e + 4);
        if (tag === 0x8825) gps = true;
        if (tag === 0x0112) orientation = g16(e + 8);
        if (want[tag] && type === 2) { const at = cnt > 4 ? g32(e + 8) : e + 8; got.push({key: want[tag], text: clean(latin1(d.subarray(at, at + cnt)).replace(/\0+$/, ''), 120)}); }
      }
      return {words: got, gps, orientation};
    } catch (e) { return {words: [], gps: false, orientation: null}; }
  }
  function readJPEG(u, out) {
    const P = out.picture = {format: 'JPEG'}, words = []; let p = 2, scans = 0, icc = [], exif = null;
    while (p + 4 <= u.length) {
      if (u[p] !== 0xff) { p++; continue; }
      const m = u[p + 1];
      if (m === 0xff) { p++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
      if (m === 0xd9) break;
      const len = be16(u, p + 2), d = u.subarray(p + 4, p + 2 + len);
      if (SOF[m] !== undefined) {
        P.kind = SOF[m]; P.bitsPerChannel = d[0]; P.height = be16(d, 1); P.width = be16(d, 3); const n = d[5], comps = [];
        for (let i = 0; i < n; i++) comps.push({id: d[6 + i * 3], h: d[7 + i * 3] >> 4, v: d[7 + i * 3] & 15});
        P.channels = n; P.colourModel = n === 1 ? 'grey' : n === 3 ? 'full colour (stored as brightness and two colour channels)' : n === 4 ? 'four channels (CMYK, for printing)' : n + ' channels';
        if (n === 3) { const y = comps[0], c = comps[1]; const sx = y.h / c.h, sy = y.v / c.v; P.colourDetail = sx === 1 && sy === 1 ? '4:4:4 (colour kept at full detail)' : sx === 2 && sy === 1 ? '4:2:2 (colour kept at half detail across)' : sx === 2 && sy === 2 ? '4:2:0 (colour kept at a quarter of the detail)' : sx === 4 && sy === 1 ? '4:1:1 (colour kept at a quarter of the detail across)' : 'colour sampled ' + y.h + 'x' + y.v + ' to ' + c.h + 'x' + c.v; }
      } else if (m === 0xe0 && ascii(d, 0, 5) === 'JFIF\0') { const units = d[7], x = be16(d, 8), y = be16(d, 10); P.jfif = 'JFIF ' + d[5] + '.' + hex2(d[6]); if (units === 1) P.density = {dpiX: x, dpiY: y}; else if (units === 2) P.density = {dpiX: Math.round(x * 2.54), dpiY: Math.round(y * 2.54)}; else if (x && y && x !== y) P.pixelAspect = +(x / y).toFixed(4); }
      else if (m === 0xe1 && ascii(d, 0, 6) === 'Exif\0\0') { exif = readEXIF(d.subarray(6), out); }
      else if (m === 0xe1 && /^http:\/\/ns\.adobe\.com\/xap/.test(ascii(d, 0, 29))) P.hasXMP = true;
      else if (m === 0xe2 && ascii(d, 0, 12) === 'ICC_PROFILE\0') icc.push(d.subarray(14));
      else if (m === 0xee && ascii(d, 0, 5) === 'Adobe') P.adobeTransform = d[11];
      else if (m === 0xfe) words.push({key: 'comment', text: clean(latin1(d))});
      else if (m === 0xda) {
        scans++; p += 2 + len;
        while (p + 1 < u.length && !(u[p] === 0xff && u[p + 1] !== 0 && !(u[p + 1] >= 0xd0 && u[p + 1] <= 0xd7))) p++;
        continue;
      }
      p += 2 + len;
    }
    if (!P.width) throw new Error('its JPEG header could not be read');
    if (icc.length) { const name = iccName(cat(icc)); P.profile = 'an ICC colour profile' + (name ? ' named "' + name + '"' : ''); }
    if (exif) { for (const w of exif.words) words.push(w); if (exif.gps) P.hasLocation = 'a GPS place is written in it (not shown here)'; if (exif.orientation && exif.orientation !== 1) P.orientation = exif.orientation; P.hasExif = true; }
    P.scans = scans; P.frames = 1;
    P.packing = 'JPEG squashes the picture (lossy): ' + (P.kind || 'JPEG');
    P.coloursUsed = null; P.coloursNote = 'not counted: JPEG is squashed (lossy), so different programs unpack the same bytes into slightly different pixels: it has no one true colour count';
    if (words.length) out.words = {untrusted: words.slice(0, 40), note: 'written inside the file by whoever made it, or their camera or program'};
  }

  /* ---------- WebP ---------- */
  function readWebP(u, out) {
    const P = out.picture = {format: 'WebP'}; let p = 12, lossless = 0, lossy = 0, frames = 0, durationMs = 0, plays = null, alpha = false, icc = null;
    while (p + 8 <= u.length) {
      const t = ascii(u, p, 4), len = le32(u, p + 4), d = u.subarray(p + 8, p + 8 + len);
      if (t === 'VP8X') { const f = d[0]; P.width = le24(d, 4) + 1; P.height = le24(d, 7) + 1; if (f & 0x10) alpha = true; if (f & 0x08) P.hasExif = true; if (f & 0x04) P.hasXMP = true; }
      else if (t === 'VP8 ') { lossy++; if (!P.width && d[3] === 0x9d && d[4] === 0x01 && d[5] === 0x2a) { P.width = le16(d, 6) & 0x3fff; P.height = le16(d, 8) & 0x3fff; } }
      else if (t === 'VP8L') { lossless++; if (!P.width && d[0] === 0x2f) { const b = le32(d, 1); P.width = (b & 0x3fff) + 1; P.height = ((b >> 14) & 0x3fff) + 1; if ((b >> 28) & 1) alpha = true; } }
      else if (t === 'ALPH') alpha = true;
      else if (t === 'ICCP') icc = d;
      else if (t === 'ANIM') plays = le16(d, 4);
      else if (t === 'ANMF') { frames++; durationMs += le24(d, 12); let q = 16; while (q + 8 <= d.length) { const tt = ascii(d, q, 4), ll = le32(d, q + 4); if (tt === 'VP8L') lossless++; else if (tt === 'VP8 ') lossy++; else if (tt === 'ALPH') alpha = true; q += 8 + ll + (ll & 1); } }
      else if (t === 'EXIF') P.hasExif = true;
      else if (t === 'XMP ') P.hasXMP = true;
      p += 8 + len + (len & 1);
    }
    if (!P.width) throw new Error('its WebP header could not be read');
    P.bitsPerChannel = 8; P.colourModel = 'full colour' + (alpha ? ' with see-through levels' : ''); P.seeThrough = alpha || undefined;
    if (icc) { const name = iccName(icc); P.profile = 'an ICC colour profile' + (name ? ' named "' + name + '"' : ''); }
    if (frames) { P.frames = frames; P.moving = frames > 1; P.durationMs = durationMs; P.plays = plays === 0 ? 'for ever' : plays; } else P.frames = 1;
    P.packing = lossless && !lossy ? 'WebP lossless: every pixel kept exactly' : lossy && !lossless ? 'WebP lossy: the picture is squashed' : 'WebP, partly lossless and partly squashed';
    P.coloursUsed = null;
    P.coloursNote = lossy ? 'not counted: lossy WebP is squashed, so different programs unpack the same bytes into slightly different pixels: it has no one true colour count'
      : 'not counted: its pixels are exact, but unpacking lossless WebP takes a whole WebP decoder, which this reader does not have yet';
  }

  /* ---------- AVIF (and other HEIF pictures) ---------- */
  // coded colour (CICP numbers, ITU-T H.273) in plain words
  const PRIM = {1: 'BT.709 / sRGB', 4: 'BT.470M', 5: 'BT.601 (PAL)', 6: 'BT.601 (NTSC)', 9: 'BT.2020 (wide colour)', 10: 'XYZ', 11: 'DCI-P3', 12: 'Display P3'};
  const TRANS = {1: 'BT.709', 4: 'gamma 2.2', 5: 'gamma 2.8', 6: 'BT.601', 8: 'linear', 13: 'sRGB', 14: 'BT.2020', 16: 'PQ (HDR)', 18: 'HLG (HDR)'};
  const MATRIX = {0: 'stored as red, green, blue', 1: 'BT.709', 5: 'BT.601', 6: 'BT.601', 9: 'BT.2020'};
  const cicp = (p, t, m, full) => 'coded colour: ' + (PRIM[p] || (p === 2 ? 'colours not stated' : 'primaries ' + p)) + ', ' + (TRANS[t] || (t === 2 ? 'brightness curve not stated' : 'brightness curve ' + t)) + (t === 13 ? ' brightness curve' : '') + (MATRIX[m] != null ? ', ' + MATRIX[m] : '') + (full ? ', full range' : ', limited range');
  function boxes(u, s, e, fn) { let p = s; while (p + 8 <= e) { let size = be32(u, p); const type = ascii(u, p + 4, 4); let h = 8; if (size === 1) { size = be32(u, p + 8) * 4294967296 + be32(u, p + 12); h = 16; } else if (size === 0) size = e - p; if (size < h) break; fn(type, p + h, p + size); p += size; } }
  function readAVIF(u, out) {
    const P = out.picture = {format: out.fromBytes.name}; const sizes = []; let pixi = null, av1 = null, colr = null, alpha = false, moving = false, frames = null, durationMs = null;
    const walk = (s, e, depth) => boxes(u, s, e, (t, a, b) => {
      if (t === 'meta') walk(a + 4, b, depth + 1);
      else if (t === 'iprp' || t === 'ipco' || t === 'moov' || t === 'trak' || t === 'mdia' || t === 'minf' || t === 'stbl') walk(a, b, depth + 1);
      else if (t === 'ispe') sizes.push([be32(u, a + 4), be32(u, a + 8)]);
      else if (t === 'pixi') { const n = u[a + 4]; pixi = []; for (let i = 0; i < n; i++) pixi.push(u[a + 5 + i]); }
      else if (t === 'av1C') { const b1 = u[a + 1], b2 = u[a + 2]; av1 = {profile: b1 >> 5, highBits: (b2 >> 6) & 1, twelve: (b2 >> 5) & 1, mono: (b2 >> 4) & 1, sx: (b2 >> 3) & 1, sy: (b2 >> 2) & 1}; }
      else if (t === 'colr') { const ty = ascii(u, a, 4); colr = ty === 'nclx' ? {kind: 'nclx', primaries: be16(u, a + 4), transfer: be16(u, a + 6), matrix: be16(u, a + 8), fullRange: (u[a + 10] >> 7) & 1} : {kind: 'ICC', name: iccName(u.subarray(a + 4, b))}; }
      else if (t === 'auxC') { if (/alpha/.test(ascii(u, a + 4, b - a - 4))) alpha = true; }
      else if (t === 'mvhd') { moving = true; const v = u[a]; const ts = v ? be32(u, a + 20) : be32(u, a + 12), du = v ? be32(u, a + 24) * 4294967296 + be32(u, a + 28) : be32(u, a + 16); if (ts) durationMs = Math.round(du * 1000 / ts); }
      else if (t === 'stsz') { const n = be32(u, a + 8); frames = Math.max(frames || 0, n); }
    });
    walk(0, u.length, 0);
    if (!sizes.length) throw new Error('its size could not be read');
    const big = sizes.reduce((m, s) => s[0] * s[1] > m[0] * m[1] ? s : m, sizes[0]); P.width = big[0]; P.height = big[1];
    if (av1) { P.bitsPerChannel = av1.twelve ? 12 : av1.highBits ? 10 : 8; P.colourModel = av1.mono ? 'grey' : 'full colour (stored as brightness and two colour channels)'; P.colourDetail = av1.mono ? undefined : av1.sx && av1.sy ? '4:2:0 (colour kept at a quarter of the detail)' : av1.sx ? '4:2:2 (colour kept at half detail across)' : '4:4:4 (colour kept at full detail)'; }
    else if (pixi) P.bitsPerChannel = pixi[0];
    if (colr) P.profile = colr.kind === 'ICC' ? 'an ICC colour profile' + (colr.name ? ' named "' + colr.name + '"' : '') : cicp(colr.primaries, colr.transfer, colr.matrix, colr.fullRange);
    if (alpha) { P.seeThrough = true; P.colourModel += ' with see-through levels'; }
    if (moving && frames > 1) { P.moving = true; P.frames = frames; P.durationMs = durationMs; } else P.frames = 1;
    P.packing = out.fromBytes.name + ' squashes the picture (lossy, AV1)';
    P.coloursUsed = null; P.coloursNote = 'not counted: ' + out.fromBytes.name + ' is squashed (lossy), so different programs unpack the same bytes into slightly different pixels: it has no one true colour count';
  }

  /* ---------- SVG (a drawing written in words) ---------- */
  const NOT_COLOUR = /^(none|transparent|currentcolor|inherit|initial|unset|context-fill|context-stroke|auto)$/i;
  function colourWord(v) {
    v = v.trim().replace(/\s*!important$/i, '');
    if (!v || NOT_COLOUR.test(v) || /^url\(/i.test(v) || /^var\(/i.test(v)) return null;
    const m = /^#([0-9a-f]{3,8})$/i.exec(v);
    if (m) { let h = m[1].toLowerCase(); if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join(''); return '#' + h; }
    if (/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i.test(v)) return v.toLowerCase().replace(/\s+/g, ' ');
    if (/^[a-z]+$/i.test(v)) return v.toLowerCase();
    return null;
  }
  async function readSVG(u, out, depth) {
    const P = out.picture = {format: 'SVG (a drawing written in words: it is sharp at any size)'}, txt = utf8(u);
    const root = /<svg\b([^>]*)>/i.exec(txt); const at = root ? root[1] : '';
    const attr = n => { const m = new RegExp('\\s' + n + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(at); return m ? (m[2] != null ? m[2] : m[3]) : null; };
    const w = attr('width'), h = attr('height'), vb = attr('viewBox');
    if (w) P.widthAsWritten = w; if (h) P.heightAsWritten = h; if (vb) P.viewBox = vb.trim().replace(/[\s,]+/g, ' ');
    const num = s => s && /^\s*[\d.]+\s*(px)?\s*$/.test(s) ? +parseFloat(s) : null, vbN = vb ? vb.trim().split(/[\s,]+/).map(Number) : null;
    P.width = num(w) || (vbN && vbN.length === 4 ? vbN[2] : null); P.height = num(h) || (vbN && vbN.length === 4 ? vbN[3] : null);
    const tags = {}; for (const m of txt.matchAll(/<([a-zA-Z][\w:.-]*)/g)) { const t = m[1].toLowerCase(); tags[t] = (tags[t] || 0) + 1; }
    const SHAPES = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use'];
    P.shapes = SHAPES.reduce((n, t) => n + (tags[t] || 0), 0);
    P.parts = Object.fromEntries(Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 30));
    const colours = new Set();
    for (const m of txt.matchAll(/\s(fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*("([^"]*)"|'([^']*)')/gi)) { const c = colourWord(m[3] != null ? m[3] : m[4]); if (c) colours.add(c); }
    for (const m of txt.matchAll(/(?:^|[;{\s"'])(fill|stroke|stop-color|flood-color|lighting-color|color|background-color|background)\s*:\s*([^;}"'<>]+)/gi)) { const c = colourWord(m[2]); if (c) colours.add(c); }
    P.coloursUsed = colours.size; P.colours = [...colours].slice(0, MAX_LIST); P.coloursNote = 'every colour the drawing names, read from its words (gradients blend between them)';
    P.gradients = (tags.lineargradient || 0) + (tags.radialgradient || 0) || undefined;
    P.moving = !!(tags.animate || tags.animatetransform || tags.animatemotion || tags.set || /@keyframes/i.test(txt)) || undefined;
    P.scripts = tags.script || undefined;
    P.packing = 'SVG keeps the drawing as words (shapes and colours), not pixels';
    // what it pulls in: other inscriptions (recursion), and pictures packed inside it
    const loads = new Set(), inside = [];
    for (const m of txt.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) { const v = m[1]; if (/^\/(content|r)\//.test(v) || /^https?:/.test(v)) loads.add(v.slice(0, 200)); }
    for (const m of txt.matchAll(/url\(\s*["']?(\/(?:content|r)\/[^"')\s]+)/gi)) loads.add(m[1].slice(0, 200));
    if (loads.size) out.loads = {count: loads.size, list: [...loads].slice(0, 40), note: 'other files it asks for when it is shown (/content/ and /r/ are other inscriptions)'};
    if (depth < 1) for (const m of txt.matchAll(/data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]{16,})/gi)) {
      if (inside.length >= 8) break;
      try { const b = typeof atob === 'function' ? Uint8Array.from(atob(m[2].replace(/\s+/g, '')), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(m[2], 'base64')); const r = await read(b, m[1], depth + 1); inside.push({declared: m[1], bytes: b.length, picture: r.picture, says: describe(r)}); } catch (e) {}
    }
    if (inside.length) P.picturesInside = inside;
  }

  /* ---------- sound and video ---------- */
  const secs = (n, d) => d ? +(n / d).toFixed(3) : null;
  // words (tags) written in a sound file by whoever made it: title, artist, album and so on
  const TAGWANT = {TIT2: 'title', TPE1: 'artist', TALB: 'album', TYER: 'year', TDRC: 'year', TCON: 'genre', TCOM: 'composer', TPE2: 'album artist', TCOP: 'copyright', TENC: 'encoded by', TSSE: 'made with', COMM: 'comment', TXXX: 'other', WXXX: 'link', TIT1: 'group', TIT3: 'subtitle'};
  function id3text(d) {
    const enc = d[0], b = d.subarray(1);
    if (enc === 1 || enc === 2) { let s = '', le = enc === 1 && b[0] === 0xff && b[1] === 0xfe, i = enc === 1 && ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff)) ? 2 : 0; for (; i + 1 < b.length; i += 2) { const c = le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]; s += c ? String.fromCharCode(c) : ' '; } return s; }
    return (enc === 3 ? utf8(b) : latin1(b)).replace(/\0/g, ' ');
  }
  function readID3(u, out) {
    if (ascii(u, 0, 3) !== 'ID3') return 0;
    const ver = u[3], flags = u[5], size = (u[6] << 21) | (u[7] << 14) | (u[8] << 7) | u[9], end = 10 + size, words = [];
    let p = 10; if (flags & 0x40) p += ver === 4 ? ((u[p] << 21) | (u[p + 1] << 14) | (u[p + 2] << 7) | u[p + 3]) : be32(u, p) + 4;
    while (p + 10 <= end && ver >= 3) {
      const id = ascii(u, p, 4); if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fs = ver === 4 ? ((u[p + 4] << 21) | (u[p + 5] << 14) | (u[p + 6] << 7) | u[p + 7]) : be32(u, p + 4), d = u.subarray(p + 10, p + 10 + fs);
      if (TAGWANT[id] && fs) { let t = id === 'COMM' ? id3text(new Uint8Array([d[0], ...d.subarray(4)])) : id3text(d); words.push({key: TAGWANT[id], text: clean(t, 200)}); }
      else if (id === 'APIC') out.coverArt = {bytes: fs, note: 'a picture is packed in with the sound (cover art)'};
      p += 10 + fs;
    }
    if (words.length) out.words = {untrusted: words.slice(0, 40), note: 'written inside the file by whoever made it'};
    return end + (flags & 0x10 ? 10 : 0);
  }
  const MP3_BR = {1: {1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], 2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]},
    2: {1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]}};
  const MP3_SR = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]};
  function mp3Frame(u, p) {
    if (u[p] !== 0xff || (u[p + 1] & 0xe0) !== 0xe0) return null;
    const v = (u[p + 1] >> 3) & 3, l = (u[p + 1] >> 1) & 3, bi = u[p + 2] >> 4, si = (u[p + 2] >> 2) & 3, pad = (u[p + 2] >> 1) & 1, mode = u[p + 3] >> 6;
    if (v === 1 || l === 0 || bi === 0 || bi === 15 || si === 3) return null;
    const layer = 4 - l, br = MP3_BR[v === 3 ? 1 : 2][layer][bi] * 1000, sr = MP3_SR[v][si];
    const spf = layer === 1 ? 384 : layer === 3 && v !== 3 ? 576 : 1152;
    const len = layer === 1 ? Math.floor(12 * br / sr + pad) * 4 : Math.floor(spf / 8 * br / sr) + pad;
    return {v, layer, br, sr, spf, len, mode, version: v === 3 ? 'MPEG-1' : v === 2 ? 'MPEG-2' : 'MPEG-2.5'};
  }
  function readMP3(u, out) {
    const S = out.sound = {format: 'MP3'}; let p = readID3(u, out), frames = 0, samples = 0, first = null, brs = new Set(), audioBytes = 0, info = null;
    while (p + 4 <= u.length) {
      const f = mp3Frame(u, p);
      if (!f || f.len < 4) { if (!first) { p++; continue; } break; }
      if (!first) {
        first = f;
        // a first frame that only holds the encoder's notes (Xing, Info or VBRI): it is not sound
        const side = f.v === 3 ? (f.mode === 3 ? 17 : 32) : (f.mode === 3 ? 9 : 17), tag = ascii(u, p + 4 + side, 4);
        if (tag === 'Xing' || tag === 'Info') { info = {kind: tag === 'Xing' ? 'variable bitrate' : 'constant bitrate'}; const q = p + 8 + side, fl = be32(u, q); if (fl & 1) info.frames = be32(u, q + 4); const lame = ascii(u, q + 4 + (fl & 1 ? 4 : 0) + (fl & 2 ? 4 : 0) + (fl & 4 ? 100 : 0) + (fl & 8 ? 4 : 0), 9); if (/^LAME|^Lavc|^Lavf/.test(lame)) { const lq = q + 4 + (fl & 1 ? 4 : 0) + (fl & 2 ? 4 : 0) + (fl & 4 ? 100 : 0) + (fl & 8 ? 4 : 0); info.encoder = clean(lame, 9); const d0 = lq + 21; info.delay = (u[d0] << 4) | (u[d0 + 1] >> 4); info.padding = ((u[d0 + 1] & 15) << 8) | u[d0 + 2]; } p += f.len; continue; }
        if (ascii(u, p + 36, 4) === 'VBRI') { info = {kind: 'variable bitrate', frames: be32(u, p + 50)}; p += f.len; continue; }
      }
      frames++; samples += f.spf; brs.add(f.br); audioBytes += f.len; p += f.len;
    }
    if (!first) throw new Error('no MP3 sound frames were found');
    if (p < u.length - 256 && ascii(u, p, 3) !== 'TAG' && ascii(u, p, 8) !== 'APETAGEX') S.framesStopAt = {byte: p, of: u.length, note: 'the sound frames stop before the file ends: the length counts the frames up to there'};
    S.version = first.version + ' layer ' + ['', 'I', 'II', 'III'][first.layer]; S.sampleRate = first.sr; S.channels = first.mode === 3 ? 1 : 2; S.channelMode = ['stereo', 'joint stereo', 'dual channel', 'mono'][first.mode];
    S.frames = frames; S.seconds = secs(samples, first.sr);
    if (info && info.delay != null) { const playable = samples - info.delay - info.padding; if (playable > 0) S.secondsPlayable = secs(playable, first.sr); S.encoder = info.encoder; }
    S.bitrate = brs.size === 1 ? {kbps: [...brs][0] / 1000, kind: 'constant'} : {kbps: Math.round(audioBytes * 8 / (samples / first.sr) / 1000), kind: 'variable (this is its average)'};
    S.packing = 'MP3 squashes the sound (lossy)';
  }
  const AAC_SR = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  function readAAC(u, out) {
    const S = out.sound = {format: 'AAC (ADTS)'}; let p = readID3(u, out), frames = 0, first = null, bytes = 0;
    while (p + 7 <= u.length) {
      if (u[p] !== 0xff || (u[p + 1] & 0xf6) !== 0xf0) { if (!first) { p++; continue; } break; }
      const prof = u[p + 2] >> 6, si = (u[p + 2] >> 2) & 15, ch = ((u[p + 2] & 1) << 2) | (u[p + 3] >> 6), len = ((u[p + 3] & 3) << 11) | (u[p + 4] << 3) | (u[p + 5] >> 5), blocks = (u[p + 6] & 3) + 1;
      if (len < 7) break;
      if (!first) first = {prof, sr: AAC_SR[si], ch};
      frames += blocks; bytes += len; p += len;
    }
    if (!first) throw new Error('no AAC frames were found');
    if (p < u.length - 256) S.framesStopAt = {byte: p, of: u.length, note: 'the sound frames stop before the file ends: the length counts the frames up to there'};
    S.profile = ['Main', 'LC (low complexity)', 'SSR', 'LTP'][first.prof]; S.sampleRate = first.sr; S.channels = first.ch; S.frames = frames;
    S.note = 'the length counts every sound frame in the file, including the short start an AAC encoder always adds';
    S.seconds = secs(frames * 1024, first.sr); S.bitrate = {kbps: S.seconds ? Math.round(bytes * 8 / S.seconds / 1000) : null, kind: 'average'};
    S.packing = 'AAC squashes the sound (lossy)';
  }
  function readWAV(u, out) {
    const S = out.sound = {format: 'WAV'}, words = []; let p = 12, fmt = null, data = 0;
    while (p + 8 <= u.length) {
      const id = ascii(u, p, 4), n = le32(u, p + 4), d = u.subarray(p + 8, p + 8 + n);
      if (id === 'fmt ') fmt = {tag: le16(d, 0), ch: le16(d, 2), sr: le32(d, 4), byteRate: le32(d, 8), align: le16(d, 12), bits: le16(d, 14), sub: n >= 40 ? le16(d, 24) : null};
      else if (id === 'data') data = Math.min(n, u.length - p - 8);
      else if (id === 'LIST' && ascii(d, 0, 4) === 'INFO') { let q = 4; const K = {INAM: 'title', IART: 'artist', ICMT: 'comment', ICRD: 'date', IGNR: 'genre', ISFT: 'made with', ICOP: 'copyright', IPRD: 'album'}; while (q + 8 <= d.length) { const k = ascii(d, q, 4), m = le32(d, q + 4); if (K[k]) words.push({key: K[k], text: clean(latin1(d.subarray(q + 8, q + 8 + m)).replace(/\0+$/, ''), 200)}); q += 8 + m + (m & 1); } }
      p += 8 + n + (n & 1);
    }
    if (!fmt) throw new Error('its WAV header could not be read');
    const tag = fmt.tag === 0xfffe ? fmt.sub : fmt.tag;
    S.encoding = tag === 1 ? 'plain samples (PCM): every sample kept exactly' : tag === 3 ? 'floating-point samples: every sample kept exactly' : tag === 6 ? 'A-law' : tag === 7 ? 'μ-law' : tag === 2 ? 'ADPCM (squashed)' : 'format ' + tag;
    S.sampleRate = fmt.sr; S.channels = fmt.ch; S.bitsPerSample = fmt.bits; S.seconds = secs(data, fmt.byteRate); S.bitrate = {kbps: Math.round(fmt.byteRate * 8 / 1000), kind: 'constant'};
    S.packing = tag === 1 || tag === 3 ? 'WAV keeps every sample exactly (not squashed)' : 'WAV';
    if (words.length) out.words = {untrusted: words, note: 'written inside the file by whoever made it'};
  }
  function vorbisComments(d, out) {
    try { let q = 0; const vl = le32(d, q); q += 4 + vl; const n = le32(d, q); q += 4; const words = [];
      for (let i = 0; i < n && i < 60 && q + 4 <= d.length; i++) { const l = le32(d, q); q += 4; const s = utf8(d.subarray(q, q + l)); q += l; const e = s.indexOf('='); if (e > 0) { const k = s.slice(0, e).toLowerCase(); if (k === 'metadata_block_picture') { out.coverArt = {bytes: l, note: 'a picture is packed in with the sound (cover art)'}; continue; } words.push({key: clean(k, 40), text: clean(s.slice(e + 1), 200)}); } }
      if (words.length) out.words = {untrusted: words, note: 'written inside the file by whoever made it'};
    } catch (e) {}
  }
  function readOgg(u, out) {
    // Ogg pages: the first packet names the codec; the last page's granule position says how long it is
    let p = 0, codec = null, S = null, lastGranule = 0, serial0 = null, pkt = [], packets = 0, bytes = 0;
    while (p + 27 <= u.length && ascii(u, p, 4) === 'OggS') {
      const gran = le32(u, p + 6) + le32(u, p + 10) * 4294967296, serial = le32(u, p + 14), segs = u[p + 26], lace = u.subarray(p + 27, p + 27 + segs);
      let q = p + 27 + segs; if (serial0 == null) serial0 = serial;
      for (const l of lace) { pkt.push(u.subarray(q, q + l)); q += l; if (l < 255) { const P = cat(pkt); pkt = []; if (serial === serial0) { packets++; if (packets === 1) codec = P; else if (packets === 2 && codec) { if (ascii(P, 0, 8) === 'OpusTags') vorbisComments(P.subarray(8), out); else if (P[0] === 3 && ascii(P, 1, 6) === 'vorbis') vorbisComments(P.subarray(7), out); } } } }
      if (serial === serial0 && gran > 0 && gran < 9e15) lastGranule = gran;
      bytes += q - p; p = q;
    }
    if (!codec) throw new Error('its Ogg pages could not be read');
    if (ascii(codec, 0, 8) === 'OpusHead') { S = out.sound = {format: 'Ogg Opus'}; const pre = le16(codec, 10); S.channels = codec[9]; S.sampleRate = 48000; S.originalSampleRate = le32(codec, 12) || undefined; S.seconds = secs(lastGranule - pre, 48000); S.packing = 'Opus squashes the sound (lossy)'; }
    else if (codec[0] === 1 && ascii(codec, 1, 6) === 'vorbis') { S = out.sound = {format: 'Ogg Vorbis'}; S.channels = codec[11]; S.sampleRate = le32(codec, 12); const nom = s32le(codec, 20); if (nom > 0) S.bitrateNominal = Math.round(nom / 1000); S.seconds = secs(lastGranule, S.sampleRate); S.packing = 'Vorbis squashes the sound (lossy)'; }
    else if (ascii(codec, 1, 4) === 'FLAC') { S = out.sound = {format: 'Ogg FLAC'}; S.packing = 'FLAC keeps every sample exactly (lossless)'; }
    else if (codec[0] === 0x80 && ascii(codec, 1, 6) === 'theora') { out.kind = 'video'; S = out.video = {format: 'Ogg Theora', width: be16(codec, 10) * 16, height: be16(codec, 12) * 16}; }
    else S = out.sound = {format: 'Ogg (' + clean(ascii(codec, 0, 8), 12) + ')'};
    if (S.seconds) S.bitrate = {kbps: Math.round(u.length * 8 / S.seconds / 1000), kind: 'average'};
  }
  async function readFLAC(u, out) {
    const S = out.sound = {format: 'FLAC'}; let p = 4, last = false;
    while (!last && p + 4 <= u.length) {
      const h = u[p]; last = !!(h & 0x80); const type = h & 127, len = be24(u, p + 1), d = u.subarray(p + 4, p + 4 + len);
      if (type === 0) { S.sampleRate = (d[10] << 12) | (d[11] << 4) | (d[12] >> 4); S.channels = ((d[12] >> 1) & 7) + 1; S.bitsPerSample = (((d[12] & 1) << 4) | (d[13] >> 4)) + 1; const total = (d[13] & 15) * 4294967296 + be32(d, 14); S.samples = total; S.seconds = secs(total, S.sampleRate); let md5 = ''; for (let i = 18; i < 34; i++) md5 += hex2(d[i]); if (/[^0]/.test(md5)) S.soundFingerprintMD5 = md5; }
      else if (type === 4) vorbisComments(d, out);
      else if (type === 6) { try { let q = 4; const ml = be32(d, q); const mime = ascii(d, q + 4, ml); q += 4 + ml; const dl = be32(d, q); q += 4 + dl + 16; const pl = be32(d, q); const pic = d.subarray(q + 4, q + 4 + pl); const r = await read(pic, mime, 1); out.coverArt = {bytes: pl, declared: mime, says: describe(r), picture: r.picture, note: 'a picture is packed in with the sound (cover art)'}; } catch (e) {} }
      p += 4 + len;
    }
    if (S.seconds) S.bitrate = {kbps: Math.round(u.length * 8 / S.seconds / 1000), kind: 'average'};
    S.packing = 'FLAC keeps every sample exactly (lossless)';
  }
  // MP4, M4A and QuickTime: boxes inside boxes
  const CODEC4 = {avc1: 'H.264', avc3: 'H.264', hvc1: 'H.265 (HEVC)', hev1: 'H.265 (HEVC)', av01: 'AV1', vp09: 'VP9', vp08: 'VP8', mp4v: 'MPEG-4 Part 2', mp4a: 'AAC', Opus: 'Opus', fLaC: 'FLAC', 'ac-3': 'AC-3', 'ec-3': 'E-AC-3', '.mp3': 'MP3', alac: 'ALAC (lossless)', s263: 'H.263', jpeg: 'Motion JPEG', mjpa: 'Motion JPEG', apcn: 'ProRes', apch: 'ProRes', lpcm: 'PCM', sowt: 'PCM', twos: 'PCM'};
  async function readMP4(u, out) {
    const tracks = [], words = []; let movie = null, cur = null;
    const walk = (s, e) => boxes(u, s, e, (t, a, b) => {
      if (t === 'moov' || t === 'mdia' || t === 'minf' || t === 'stbl' || t === 'edts' || t === 'udta' || t === 'ilst') walk(a, b);
      else if (t === 'meta') walk(a + (ascii(u, a + 4, 4) === 'hdlr' ? 0 : 4), b);
      else if (t === 'trak') { cur = {}; tracks.push(cur); walk(a, b); cur = null; }
      else if (t === 'mvhd') { const v = u[a]; const ts = v ? be32(u, a + 20) : be32(u, a + 12), du = v ? be32(u, a + 24) * 4294967296 + be32(u, a + 28) : be32(u, a + 16); movie = {ts, du}; }
      else if (t === 'tkhd' && cur) { const v = u[a], o = v ? a + 4 + 32 + 52 : a + 4 + 20 + 52; cur.w = be32(u, o) / 65536; cur.h = be32(u, o + 4) / 65536; }
      else if (t === 'mdhd' && cur) { const v = u[a]; cur.ts = v ? be32(u, a + 20) : be32(u, a + 12); cur.du = v ? be32(u, a + 24) * 4294967296 + be32(u, a + 28) : be32(u, a + 16); }
      else if (t === 'hdlr' && cur) cur.kind = ascii(u, a + 8, 4);
      else if (t === 'stsd' && cur) { const e1 = a + 8, fourcc = ascii(u, e1 + 4, 4); cur.codec = CODEC4[fourcc] || fourcc; const sd = e1 + 8;
        if (cur.kind === 'vide') { cur.pw = be16(u, sd + 24); cur.ph = be16(u, sd + 26); cur.depth = be16(u, sd + 74); }
        else if (cur.kind === 'soun') { cur.ch = be16(u, sd + 16); cur.bits = be16(u, sd + 18); cur.sr = be32(u, sd + 24) / 65536; } }
      else if (t === 'stts' && cur) { const n = be32(u, a + 4); let c = 0; for (let i = 0; i < n; i++) c += be32(u, a + 8 + i * 8); cur.samples = c; }
      else if (t === 'stsz' && cur) { if (!cur.samples) cur.samples = be32(u, a + 8); }
      else if (/^[©\xa9](nam|ART|alb|day|cmt|too|wrt|gen)$/.test(t) || t === 'aART' || t === 'desc') { const K = {nam: 'title', ART: 'artist', alb: 'album', day: 'date', cmt: 'comment', too: 'made with', wrt: 'composer', gen: 'genre', aART: 'album artist', desc: 'description'}; const k = K[t.slice(1)] || K[t]; let q = a; while (q + 16 <= b) { const sz = be32(u, q); if (ascii(u, q + 4, 4) === 'data') { words.push({key: k, text: clean(utf8(u.subarray(q + 16, q + sz)), 200)}); break; } q += sz || b; } }
      else if (t === 'covr') out.coverArt = {bytes: b - a, note: 'a picture is packed in with the sound (cover art)'};
    });
    walk(0, u.length);
    const V = tracks.find(t => t.kind === 'vide'), A = tracks.find(t => t.kind === 'soun');
    const seconds = movie && movie.ts ? secs(movie.du, movie.ts) : V && V.ts ? secs(V.du, V.ts) : A && A.ts ? secs(A.du, A.ts) : null;
    const name = out.fromBytes.name;
    if (V) {
      out.kind = 'video';
      const X = out.video = {format: name, codec: V.codec, width: V.pw || Math.round(V.w), height: V.ph || Math.round(V.h), seconds};
      if (V.w && V.pw && (Math.round(V.w) !== V.pw || Math.round(V.h) !== V.ph)) X.shownAs = Math.round(V.w) + ' × ' + Math.round(V.h);
      if (V.samples && V.ts && V.du) { X.frames = V.samples; X.framesPerSecond = +(V.samples / (V.du / V.ts)).toFixed(3); }
      X.hasSound = !!A; if (A) X.sound = {codec: A.codec, channels: A.ch, sampleRate: A.sr};
      X.packing = name + ' squashes the picture and sound (lossy)';
    } else if (A) {
      out.kind = 'sound';
      const S = out.sound = {format: name === 'MP4' ? 'M4A (MP4 sound)' : name, codec: A.codec, channels: A.ch, sampleRate: A.sr, seconds: seconds != null ? seconds : A.ts ? secs(A.du, A.ts) : null};   // (the movie's own length counts the edit list: the sound as it plays)
      if (/PCM|ALAC|FLAC/.test(A.codec)) S.bitsPerSample = A.bits;
      if (S.seconds) S.bitrate = {kbps: Math.round(u.length * 8 / S.seconds / 1000), kind: 'average'};
      S.packing = /ALAC|FLAC|PCM/.test(A.codec) ? A.codec + ': every sample kept exactly' : A.codec + ' squashes the sound (lossy)';
    } else throw new Error('no picture or sound track was found');
    if (tracks.length > (V ? 1 : 0) + (A ? 1 : 0)) (out.video || out.sound).otherTracks = tracks.length - (V ? 1 : 0) - (A ? 1 : 0);
    if (words.length) out.words = {untrusted: words, note: 'written inside the file by whoever made it'};
  }
  // WebM and Matroska: EBML elements
  function ebml(u, p) { const b = u[p]; let n = 1, m = 0x80; while (n <= 8 && !(b & m)) { n++; m >>= 1; } if (n > 8) return null; let id = b, v = b & (m - 1); for (let i = 1; i < n; i++) { id = id * 256 + u[p + i]; v = v * 256 + u[p + i]; } return {n, id, v, unknown: v === Math.pow(2, 7 * n) - 1}; }
  const ebmlUint = (u, a, b) => { let v = 0; for (let i = a; i < b; i++) v = v * 256 + u[i]; return v; };
  const ebmlFloat = (u, a, b) => { const dv = new DataView(u.buffer, u.byteOffset + a, b - a); return b - a === 4 ? dv.getFloat32(0) : dv.getFloat64(0); };
  function readWebM(u, out) {
    const tracks = []; let scale = 1000000, dur = null, words = [], cur = null, docType = null; const blocks = {};
    const CONTAINERS = new Set([0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0xe0, 0xe1, 0x1f43b675, 0xa0, 0x1254c367, 0x7373, 0x67c8, 0x1a45dfa3]);
    const walk = (s, e) => { let p = s; while (p < e) {
      const I = ebml(u, p); if (!I) break; const S = ebml(u, p + I.n); if (!S) break;
      const a = p + I.n + S.n, b = S.unknown ? e : Math.min(e, a + S.v), id = I.id;
      if (id === 0xae) { cur = {}; tracks.push(cur); walk(a, b); cur = null; }
      else if (CONTAINERS.has(id)) walk(a, b);
      else if (id === 0x4282) docType = ascii(u, a, b - a);
      else if (id === 0x2ad7b1) scale = ebmlUint(u, a, b);
      else if (id === 0x4489) dur = ebmlFloat(u, a, b);
      else if (id === 0x7ba9) words.push({key: 'title', text: clean(utf8(u.subarray(a, b)), 200)});
      else if (id === 0x4d80) words.push({key: 'packed with', text: clean(utf8(u.subarray(a, b)), 120)});
      else if (id === 0x5741) words.push({key: 'made with', text: clean(utf8(u.subarray(a, b)), 120)});
      else if (cur && id === 0xd7) cur.num = ebmlUint(u, a, b);
      else if (cur && id === 0x83) cur.type = ebmlUint(u, a, b);
      else if (cur && id === 0x86) cur.codec = ascii(u, a, b - a).replace(/\0+$/, '');
      else if (cur && id === 0xb0) cur.w = ebmlUint(u, a, b);
      else if (cur && id === 0xba) cur.h = ebmlUint(u, a, b);
      else if (cur && id === 0x54b0) cur.dw = ebmlUint(u, a, b);
      else if (cur && id === 0x54ba) cur.dh = ebmlUint(u, a, b);
      else if (cur && id === 0x23e383) cur.frameNs = ebmlUint(u, a, b);
      else if (cur && id === 0xb5) cur.sr = ebmlFloat(u, a, b);
      else if (cur && id === 0x9f) cur.ch = ebmlUint(u, a, b);
      else if (cur && id === 0x6264) cur.bits = ebmlUint(u, a, b);
      else if (id === 0xa3 || id === 0xa1) { const T = ebml(u, a); if (T) { const fl = u[a + T.n + 2], laced = fl & 0x06; blocks[T.v] = (blocks[T.v] || 0) + (laced ? u[a + T.n + 3] + 1 : 1); } }   // (a laced block holds several frames)
      p = b;
    } };
    walk(0, u.length);
    const CN = {V_VP8: 'VP8', V_VP9: 'VP9', V_AV1: 'AV1', 'V_MPEG4/ISO/AVC': 'H.264', 'V_MPEGH/ISO/HEVC': 'H.265 (HEVC)', A_OPUS: 'Opus', A_VORBIS: 'Vorbis', A_AAC: 'AAC', A_FLAC: 'FLAC', 'A_PCM/INT/LIT': 'PCM', A_MPEG_L3: 'MP3'};
    const V = tracks.find(t => t.type === 1), A = tracks.find(t => t.type === 2), seconds = dur != null ? +(dur * scale / 1e9).toFixed(3) : null;
    const name = docType === 'webm' ? 'WebM' : 'Matroska';
    if (V) {
      out.kind = 'video';
      const X = out.video = {format: name, codec: CN[V.codec] || V.codec, width: V.w, height: V.h, seconds};
      if (V.dw && V.dh && (V.dw !== V.w || V.dh !== V.h)) X.shownAs = V.dw + ' × ' + V.dh;
      const nf = V.num != null ? blocks[V.num] : null; if (nf) X.frames = nf;
      // the rate it states, where the frames it really holds agree with it; else the frames counted over its length
      const stated = V.frameNs ? 1e9 / V.frameNs : null, counted = nf && seconds ? nf / seconds : null;
      if (stated && (!counted || Math.abs(stated - counted) <= 0.03 * stated)) X.framesPerSecond = +stated.toFixed(3);
      else if (counted) { X.framesPerSecond = +counted.toFixed(3); if (stated) X.framesPerSecondStated = +stated.toFixed(3); X.framesNote = 'it states ' + (+stated.toFixed(3)) + ' frames a second, but holds ' + nf + ' frames over ' + seconds + ' s: the counted rate is shown'; }
      X.hasSound = !!A; if (A) X.sound = {codec: CN[A.codec] || A.codec, channels: A.ch, sampleRate: A.sr};
      X.packing = name + ' squashes the picture and sound (lossy)';
    } else if (A) {
      out.kind = 'sound';
      const S = out.sound = {format: name + ' sound', codec: CN[A.codec] || A.codec, channels: A.ch, sampleRate: A.sr, seconds};
      if (A.bits) S.bitsPerSample = A.bits;
      if (seconds) S.bitrate = {kbps: Math.round(u.length * 8 / seconds / 1000), kind: 'average'};
      S.packing = /FLAC|PCM/.test(S.codec) ? S.codec + ': every sample kept exactly' : S.codec + ' squashes the sound (lossy)';
    } else throw new Error('no picture or sound track was found');
    if (words.length) out.words = {untrusted: words, note: 'written inside the file by whoever made it, or their program'};
  }

  /* ---------- words (text, JSON, HTML, code): the basics ---------- */
  function readWords(u, out) {
    const txt = utf8(u), W = out.words_ = {characters: [...txt].length, lines: txt.split('\n').length, validUTF8: utf8ok(u)};
    if (out.fromBytes.type === 'application/json' || /json/.test(out.declared || '')) { try { const j = JSON.parse(txt); W.json = Array.isArray(j) ? {list: j.length} : {fields: Object.keys(j).slice(0, 30).map(k => clean(k, 60))}; } catch (e) { W.json = {valid: false}; } }
    if (out.fromBytes.type === 'text/html' || /html/.test(out.declared || '')) { W.scripts = (txt.match(/<script\b/gi) || []).length; const loads = new Set(); for (const m of txt.matchAll(/["'`](\/(?:content|r)\/[^"'`\s)]+)/g)) loads.add(m[1].slice(0, 200)); if (loads.size) out.loads = {count: loads.size, list: [...loads].slice(0, 40), note: 'other inscriptions it asks for when it runs (paths built in code are not seen here)'}; }
    out.text = W; delete out.words_;
  }

  /* ---------- the reading ---------- */
  async function read(bytes, declaredType, depth) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const out = {reader: 'Media Reader ' + VERSION, bytes: u.length, declared: declaredType ? String(declaredType).split(';')[0].trim() : null};
    out.fromBytes = sniff(u);
    out.typesAgree = typesAgree(out.declared, out.fromBytes.type);
    out.kind = FAMILY(out.fromBytes.type || norm(out.declared));
    if (!depth) out.sha256 = await sha256(u);
    const t = out.fromBytes.type, notes = [];
    try {
      if (t === 'image/png') await readPNG(u, out);
      else if (t === 'image/gif') readGIF(u, out);
      else if (t === 'image/jpeg') readJPEG(u, out);
      else if (t === 'image/webp') readWebP(u, out);
      else if (t === 'image/avif' || t === 'image/heic') readAVIF(u, out);
      else if (t === 'image/bmp') readBMP(u, out);
      else if (t === 'image/svg+xml') await readSVG(u, out, depth || 0);
      else if (out.kind === 'words') readWords(u, out);
      else if (t === 'audio/mpeg') readMP3(u, out);
      else if (t === 'audio/aac') readAAC(u, out);
      else if (t === 'audio/wav') readWAV(u, out);
      else if (t === 'audio/ogg') readOgg(u, out);
      else if (t === 'audio/flac') await readFLAC(u, out);
      else if (t === 'video/mp4' || t === 'audio/mp4' || t === 'video/quicktime') await readMP4(u, out);
      else if (t === 'video/webm') readWebM(u, out);
      else if (out.kind === 'model') notes.push('this reader reads pictures, sound and video so far: 3D models come next');
      else notes.push('this kind of file is not read in detail');
    } catch (e) { notes.push('it could not be read in detail: ' + (e.message || e)); }
    if (out.picture) { const P = out.picture; if (P.width && P.height) P.pixels = P.width * P.height; }
    if (out.typesAgree === false) notes.push('it says it is ' + out.declared + ', but its own bytes are ' + (out.fromBytes.name || 'something else'));
    if (notes.length) out.notes = notes;
    return out;
  }

  /* ---------- plain words ---------- */
  const fmt = n => n == null ? '?' : Number(n).toLocaleString('en-GB');
  function describe(r) {
    if (!r) return '';
    const P = r.picture, bits = [];
    if (P) {
      const size = P.width && P.height ? fmt(P.width) + ' × ' + fmt(P.height) : 'a';
      bits.push(size + (P.format && /^SVG/.test(P.format) ? ' drawing (SVG)' : ' ' + (P.format || '') + ' picture'));
      if (P.moving) bits.push('moving: ' + fmt(P.frames) + ' frames' + (P.durationMs ? ' over ' + (P.durationMs / 1000).toLocaleString('en-GB', {maximumFractionDigits: 2}) + ' s' : '') + (P.plays ? ', playing ' + (typeof P.plays === 'number' ? P.plays + ' times' : P.plays) : ''));
      if (P.colourModel) bits.push(P.colourModel + (P.bitsPerIndex ? ', ' + P.bitsPerIndex + ' bit' + (P.bitsPerIndex === 1 ? '' : 's') + ' a pixel' : P.bitsPerChannel ? ', ' + P.bitsPerChannel + ' bit' + (P.bitsPerChannel === 1 ? '' : 's') + ' a channel' : ''));
      if (P.coloursUsed != null) bits.push(fmt(P.coloursUsed) + ' colour' + (P.coloursUsed === 1 ? '' : 's') + ' used' + (P.framesWithOwnPalette ? ' (frames have palettes of their own)' : P.palette ? ' (palette of ' + fmt(P.palette.size) + ')' : ''));
      else if (P.palette) bits.push('a palette of ' + fmt(P.palette.size) + ' colours');
      if (P.seeThrough) bits.push('has see-through parts');
      if (P.packing) bits.push(/lossless|every pixel stored as it is|exactly/.test(P.packing) ? 'every pixel kept exactly' : /squash/.test(P.packing) ? 'squashed (lossy)' : /as words/.test(P.packing) ? 'sharp at any size' : '');
      if (P.colourDetail) bits.push(P.colourDetail);
      if (P.profile) bits.push(P.profile);
      if (P.shapes != null) bits.push(fmt(P.shapes) + ' shapes');
    } else if (r.video) {
      const X = r.video;
      bits.push((X.width && X.height ? fmt(X.width) + ' × ' + fmt(X.height) + ' ' : '') + X.format + ' video' + (X.codec ? ' (' + X.codec + ')' : ''));
      if (X.seconds != null) bits.push(X.seconds.toLocaleString('en-GB', {maximumFractionDigits: 2}) + ' s long');
      if (X.framesPerSecond) bits.push(X.framesPerSecond.toLocaleString('en-GB', {maximumFractionDigits: 2}) + ' frames a second' + (X.frames ? ' (' + fmt(X.frames) + ' frames)' : ''));
      bits.push(X.hasSound ? 'with sound' + (X.sound && X.sound.codec ? ' (' + X.sound.codec + (X.sound.channels ? ', ' + (X.sound.channels === 1 ? 'mono' : X.sound.channels === 2 ? 'stereo' : X.sound.channels + ' channels') : '') + ')' : '') : 'no sound');
    } else if (r.sound) {
      const S = r.sound, len = S.secondsPlayable != null ? S.secondsPlayable : S.seconds;
      bits.push(S.format + (S.codec && !S.format.includes(S.codec) ? ' (' + S.codec + ')' : '') + ' sound');
      if (len != null) bits.push(len.toLocaleString('en-GB', {maximumFractionDigits: 2}) + ' s long');
      if (S.sampleRate) bits.push(fmt(S.sampleRate) + ' samples a second' + (S.bitsPerSample ? ', ' + S.bitsPerSample + ' bits' : ''));
      if (S.channels) bits.push(S.channels === 1 ? 'mono' : S.channels === 2 ? 'stereo' : S.channels + ' channels');
      if (S.bitrate && S.bitrate.kbps) bits.push(fmt(S.bitrate.kbps) + ' kbit/s' + (S.bitrate.kind === 'constant' ? '' : ' average'));
      if (S.packing) bits.push(/exactly/.test(S.packing) ? 'every sample kept exactly' : /squash/.test(S.packing) ? 'squashed (lossy)' : '');
      if (r.coverArt) bits.push('with cover art' + (r.coverArt.says ? ' (' + r.coverArt.says.split(' · ')[0] + ')' : ''));
    } else if (r.text) bits.push(fmt(r.text.characters) + ' characters over ' + fmt(r.text.lines) + ' lines' + (r.text.validUTF8 ? '' : ' (not all valid UTF-8)'));
    else bits.push((r.fromBytes && r.fromBytes.name) || 'a file');
    bits.push(fmt(r.bytes) + ' bytes');
    if (r.loads) bits.push('asks for ' + fmt(r.loads.count) + ' other file' + (r.loads.count === 1 ? '' : 's'));
    return bits.filter(Boolean).join(' · ');
  }

  return {VERSION, read, describe, sniff, typesAgree, MAX_PIXELS};
});
