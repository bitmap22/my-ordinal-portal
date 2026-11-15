/* The Media Reader, by bitmap22. Always free.
   "Tuning in": it opens a file's own bytes (an inscription on Bitcoin, or a Doginal on Dogecoin) and says what is really in it,
   every number read or counted from the bytes themselves, never guessed. The same file is used by the portal's pages, by
   Agent Blockhall and Doge Cube, and by the Agent Blockhall MCP tool.
   Pictures: PNG (and moving PNG), GIF, JPEG, WebP, AVIF, BMP and SVG: resolution, colour depth, how colour is stored, the palette,
   the exact number of colours used (where a file's colours are fixed: PNG, GIF, BMP, SVG), see-through parts, colour profile,
   frames and timing, how it is packed, and any words written inside it (marked untrusted: anyone can write them).
   Squashed ("lossy") pictures (JPEG, lossy WebP, AVIF) have no one true colour count: different programs unpack the same bytes
   into slightly different pixels, so none is given for them, and the answer says why.
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
      else if (out.kind === 'sound' || out.kind === 'video' || out.kind === 'model') notes.push('this reader reads pictures so far: sound, video and 3D models come next');
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
    } else if (r.text) bits.push(fmt(r.text.characters) + ' characters over ' + fmt(r.text.lines) + ' lines' + (r.text.validUTF8 ? '' : ' (not all valid UTF-8)'));
    else bits.push((r.fromBytes && r.fromBytes.name) || 'a file');
    bits.push(fmt(r.bytes) + ' bytes');
    if (r.loads) bits.push('asks for ' + fmt(r.loads.count) + ' other file' + (r.loads.count === 1 ? '' : 's'));
    return bits.filter(Boolean).join(' · ');
  }

  return {VERSION, read, describe, sniff, typesAgree, MAX_PIXELS};
});
