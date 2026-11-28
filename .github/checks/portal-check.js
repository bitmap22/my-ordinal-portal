/* The portal's safety check, by bitmap22: runs on GitHub on every change (portal-check.yml), with no add-ons and no network.
   It fails when a change brings back one of the problems the 21 November 2026 deep-dive found and fixed:
   1. A frame without a lock. Every <iframe> and every createElement('iframe') in a page must have a sandbox, or a note on the
      same line, "frame-ok: <why>", that says why it can be unlocked (it shows one of our own pages).
   2. A stranger's picture made into an address on our own site. Every new Blob(...) whose type comes from a variable (so it could
      be an SVG or a web page from an inscription) must be checked with SAFE_PIC_T / shownPic just before, or have a note on the
      same line, "blob-ok: <why>" (for example: only drawn off-screen, never put where a person can open it in a new tab).
   3. A risky button left open to AI agents. Every page with the agent kit keeps the whole person-only list (NO_AGENT and
      NO_AGENT_IDS, the same on every page), and no file has fewer "isTrusted" checks (clicks a person really made) than
      .github/checks/baseline.json records. Adding checks is fine; to remove one on purpose, lower its number there too.
   And since 28 November 2026, one more, so that a page that no longer works can never go live by mistake:
   4. A script that no longer reads. Every <script> written into a page must still be JavaScript the browser can read (one stray
      bracket stops the whole page), every data block of type application/ld+json or application/json must still be JSON, and
      every script file a page loads from this repository (and every .js file under vendor/) must be there and must read too.
      Scripts are only read here (parsed), never run. A module (a script with import or export) is read as one. Blocks of
      other types (a page's own data) are left alone.
   It reads only the files in this repository; it changes nothing. © 2026 bitmap22. All rights reserved. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['agent-blockhall-mcp/server/view.html']).filter(f => fs.existsSync(path.join(ROOT, f)));
const JS_T = /^(text|application)\/(x-)?(java|ecma)script$/, own = new Set(), count = {inline: 0, data: 0, files: 0};
// reads a script without running it: null when it reads, or where and why it does not
const readErr = (code, name, lineOffset) => { try { new vm.Script(code, {filename: name, lineOffset: lineOffset || 0}); return null; } catch (e) { const at = String(e && e.stack || '').split('\n')[0]; return (/:\d+$/.test(at) ? at : name) + ': ' + (e && e.message || e); } };
// the same for a module (a file with import or export in it): a second Node reads a copy of it as a module, and runs none of it
const MOD_READ = "try{new (require('vm').SourceTextModule)(require('fs').readFileSync(process.argv[1],'utf8'));console.log('reads')}catch(e){console.log('no: '+(e&&e.message||e))}";
const readModErr = (code, name) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-check-')), t = path.join(d, 'm.mjs'); fs.writeFileSync(t, code);
  const r = cp.spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', '-e', MOD_READ, t], {encoding: 'utf8'}); fs.rmSync(d, {recursive: true, force: true});
  const out = String(r.stdout || '').trim(); return out === 'reads' ? null : name + ': ' + (out.startsWith('no: ') ? out.slice(4) : 'it could not be read as a module');
};
const isMod = (code, err) => /\b(import|export)\b/.test(err) && /(^|[\n;}])\s*(import|export)\b/.test(code);
const bad = [], lineOf = (s, i) => s.slice(0, i).split('\n').length, lineAt = (s, i) => { const a = s.lastIndexOf('\n', i) + 1, b = s.indexOf('\n', i); return s.slice(a, b < 0 ? s.length : b); };

for (const f of pages) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // 1. frames
  for (const m of s.matchAll(/<iframe\b[^>]*>|createElement\(\s*['"]iframe['"]\s*\)/gi)) {
    const ln = lineAt(s, m.index); if (/frame-ok:/.test(ln)) continue;
    const tail = m[0].startsWith('<') ? m[0] : s.slice(m.index, m.index + 600).split(/;\s*(?:return|\}|$)/)[0];
    if (/<iframe\b/i.test(m[0]) && /^\s*\{\s*regex:/.test(ln)) continue;   // (a pattern that looks for frames in an inscription's code, not a frame)
    if (!/sandbox/i.test(tail) && !/sandbox/i.test(ln)) bad.push(f + ':' + lineOf(s, m.index) + ': a frame without a sandbox (add one, or a "frame-ok: <why>" note on that line)');
  }
  // 2. blobs whose type comes from a variable
  for (const m of s.matchAll(/new Blob\(\s*\[[^\]]*\]\s*,\s*\{\s*type\s*:\s*([^}]+)\}/g)) {
    const t = m[1].trim(); if (/^(['"])[^'"]*\1$/.test(t)) continue;
    const ln = lineAt(s, m.index), before = s.slice(Math.max(0, m.index - 600), m.index);
    if (/blob-ok:/.test(ln) || /SAFE_PIC_T|shownPic/.test(before)) continue;
    bad.push(f + ':' + lineOf(s, m.index) + ': a picture address made from a type that could be an SVG or a web page (check it with SAFE_PIC_T, or add a "blob-ok: <why>" note on that line)');
  }
  // 3. the agent kit's person-only list
  if (/const NO_AGENT = /.test(s)) {
    const na = (s.match(/const NO_AGENT = (\/[^\n]*?\/i)/) || [])[1], ids = (s.match(/NO_AGENT_IDS = (new Set\(\[[^\]]*\]\))/) || [])[1];
    if (na !== base.kit.NO_AGENT) bad.push(f + ': the agent kit\'s person-only words (NO_AGENT) differ from the other pages\' (baseline.json)');
    if (ids !== base.kit.NO_AGENT_IDS) bad.push(f + ': the agent kit\'s person-only buttons (NO_AGENT_IDS) differ from the other pages\' (baseline.json)');
  }
  // 4. scripts that no longer read (parsed only, never run)
  for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const at = m[1], code = m[2], ty = ((at.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '').toLowerCase(), src = (at.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1];
    const mod = ty === 'module', js = !ty || mod || JS_T.test(ty), ln = lineOf(s, m.index + m[0].indexOf('>') + 1);
    if (src) { if (js && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(src)) own.add(path.normalize(path.join(path.dirname(f), src.split(/[?#]/)[0]))); continue; }   // (a script file of our own: read below, once)
    if (!code.trim()) continue;
    if (js) { count.inline++; const e = mod ? readModErr(code, f + ':' + ln) : readErr(code, f, ln - 1); if (e) bad.push(e + ' (a script in this page no longer reads as JavaScript: the page would stop working)'); }
    else if (/^application\/(ld\+)?json$/.test(ty)) { count.data++; try { JSON.parse(code); } catch (e) { bad.push(f + ':' + ln + ': a data block (' + ty + ') that is no longer JSON: ' + e.message); } }
  }
}
// 4, continued: the script files the pages load from this repository, and everything under vendor/
const jsUnder = d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d), {withFileTypes: true}).flatMap(e => e.isDirectory() ? jsUnder(d + '/' + e.name) : e.name.endsWith('.js') ? [path.normalize(d + '/' + e.name)] : []) : [];
for (const f of jsUnder('vendor')) own.add(f);
for (const f of [...own].sort()) {
  const p = path.join(ROOT, f); if (f.startsWith('..')) continue;   // (outside the repository: not ours to read)
  if (!fs.existsSync(p)) { bad.push(f + ': a page loads this script file, but it is not in the repository'); continue; }
  count.files++; const code = fs.readFileSync(p, 'utf8'); let e = readErr(code, f, 0); if (e && isMod(code, e)) e = readModErr(code, f);
  if (e) bad.push(e + ' (a script file the pages load no longer reads as JavaScript)');
}
for (const [f, n] of Object.entries(base.isTrusted)) {
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) { bad.push(f + ': gone, but baseline.json counts ' + n + ' person-only checks in it'); continue; }
  const k = (fs.readFileSync(p, 'utf8').match(/isTrusted/g) || []).length;
  if (k < n) bad.push(f + ': ' + k + ' person-only checks (isTrusted), fewer than the ' + n + ' in baseline.json');
}
if (bad.length) { console.log('The portal check found ' + bad.length + ' problem' + (bad.length === 1 ? '' : 's') + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('The portal check passed: ' + pages.length + ' pages, every frame locked or noted, every picture address checked or noted, the agent kit\'s person-only list whole, no person-only check removed, and every script reads (' + count.inline + ' scripts in the pages, ' + count.files + ' script files, ' + count.data + ' data blocks).');
