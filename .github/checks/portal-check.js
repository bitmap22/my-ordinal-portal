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
   It reads only the files in this repository; it changes nothing. © 2026 bitmap22. All rights reserved. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['agent-blockhall-mcp/server/view.html']).filter(f => fs.existsSync(path.join(ROOT, f)));
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
}
for (const [f, n] of Object.entries(base.isTrusted)) {
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) { bad.push(f + ': gone, but baseline.json counts ' + n + ' person-only checks in it'); continue; }
  const k = (fs.readFileSync(p, 'utf8').match(/isTrusted/g) || []).length;
  if (k < n) bad.push(f + ': ' + k + ' person-only checks (isTrusted), fewer than the ' + n + ' in baseline.json');
}
if (bad.length) { console.log('The portal check found ' + bad.length + ' problem' + (bad.length === 1 ? '' : 's') + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('The portal check passed: ' + pages.length + ' pages, every frame locked or noted, every picture address checked or noted, the agent kit\'s person-only list whole, and no person-only check removed.');
