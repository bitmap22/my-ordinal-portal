// Terms Check, by bitmap22: once a day, read the terms (and licences) of every site the Ord Portal reads, and say if any
// changed. It only tells: a change opens a GitHub issue (bitmap22 gets an email) with what changed. It never stops a site
// being read: a person reads the new terms first and decides. The list of sites is SOURCES.md's "Read" list.
// Usage: node check.js <folder>   (the folder holds state.json and texts/ from the last check; both are updated)
// © 2026 bitmap22. All rights reserved.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

// Each page: the site it belongs to, its address, and (for a web page) where the terms' own words start, so the menus and
// live numbers around them are not compared. Code files are read from the sites' own public code on GitHub.
const RAW = 'https://raw.githubusercontent.com/';
const WATCH = [
  {id: 'mempool-terms', site: 'mempool.space (and its Frankfurt server)', url: RAW + 'mempool/mempool/master/frontend/src/app/components/terms-of-service/terms-of-service.component.html', see: 'https://mempool.space/terms-of-service', html: true},
  {id: 'mempool-terms-page', site: 'mempool.space (and its Frankfurt server)', url: 'https://mempool.space/terms-of-service', see: 'https://mempool.space/terms-of-service', start: 'Updated:', html: true, optional: true},
  {id: 'ordpool-terms', site: 'ordpool.space', url: RAW + 'ordpool-space/ordpool/main/frontend/src/app/components/terms-of-service/terms-of-service.component.html', see: 'https://ordpool.space/terms-of-service', html: true},
  {id: 'esplora-api', site: 'blockstream.info', url: RAW + 'Blockstream/esplora/master/API.md', see: 'https://github.com/Blockstream/esplora/blob/master/API.md', upTo: '## Transactions'},
  {id: 'blockstream-explorer-api', site: 'blockstream.info', url: 'https://blockstream.info/explorer-api', see: 'https://blockstream.info/explorer-api', html: true, optional: true},
  {id: 'blockstream-privacy', site: 'blockstream.info', url: 'https://blockstream.com/privacy', see: 'https://blockstream.com/privacy', start: 'At Blockstream, we are committed', endAfter: 'This Privacy Policy was last updated', html: true, optional: true},
  {id: 'ord-licence', site: 'ordinals.com', url: RAW + 'ordinals/ord/master/LICENSE', see: 'https://github.com/ordinals/ord/blob/master/LICENSE'},
  {id: 'coingecko-api-terms', site: 'CoinGecko', url: 'https://www.coingecko.com/en/api_terms', see: 'https://www.coingecko.com/en/api_terms', start: 'Latest Version:', endBefore: 'Coingecko provides a fundamental analysis', html: true},
  {id: 'coingecko-keyless', site: 'CoinGecko', url: 'https://docs.coingecko.com/docs/keyless-public-api', see: 'https://docs.coingecko.com/docs/keyless-public-api', start: 'The Keyless Public API lets you', endBefore: 'Was this page helpful?', html: true, optional: true},
  {id: 'bnrp-docs', site: 'BNRP (api.bnrp.name)', url: 'https://btcnative.pages.dev/docs', see: 'https://btcnative.pages.dev/docs', start: 'Protocol overview', endBefore: 'Powered by BNRP open resolution', html: true},
  {id: 'bnrp-standard', site: 'BNRP (api.bnrp.name)', url: 'https://btcnative.pages.dev/bnrp.html', see: 'https://btcnative.pages.dev/bnrp.html', start: 'What is BNRP?', endBefore: 'Powered by BNRP open resolution', html: true, optional: true}
];
// (optional: a page that is often hard for a script to read, because it is built in the browser or sits behind a bot
// check. Its words are compared when they can be read; it only raises an issue for a change, never for not being read.)
const UNREADABLE_DAYS = 3;   // a needed page that can't be read this many checks in a row raises an issue
const UA = 'OrdPortal-TermsCheck/1.0 (+https://ordportal.com/SOURCES.md)';

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&copy;/g, '©').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)));
function textOf(body, w) {
  let t = body;
  if (w.html) {
    t = t.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|p|div|li|h[1-6]|tr|section|article|header|footer|ul|ol|table)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
    t = decode(t);
    t = t.replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/i18n(-[a-z-]+)?="[^"]*"/g, ' ');   // (Angular's own marks in a code file)
  }
  let lines = t.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  // start: the first line that begins with it; endBefore: stop before the first line after that begins with it; endAfter: stop after it
  if (w.start) { const i = lines.findIndex(l => l.startsWith(w.start)); if (i < 0) return ''; lines = lines.slice(i); }
  const upTo = w.upTo || w.endBefore;
  if (upTo) { const i = lines.findIndex((l, k) => k > 0 && l.startsWith(upTo)); if (i >= 0) lines = lines.slice(0, i); }
  if (w.endAfter) { const i = lines.findIndex(l => l.startsWith(w.endAfter)); if (i >= 0) lines = lines.slice(0, i + 1); }
  return lines.join('\n');
}
// The fingerprint leaves out digits and spacing: live numbers on a page (prices, counts) are not terms. A real change to the
// terms changes their words too; the words that changed, dates included, are shown in full in the issue.
const fingerprint = t => crypto.createHash('sha256').update(t.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim()).digest('hex');

async function read(w) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(w.url, {headers: {'user-agent': UA, accept: 'text/html,text/plain,*/*'}, redirect: 'follow', signal: ctl.signal});
    if (!r.ok) return {error: 'http ' + r.status};
    const t = textOf(await r.text(), w);
    if (t.length < 200) return {error: 'the page gave too few words to compare (' + t.length + ' characters): it may be built in the browser, or behind a bot check'};
    return {text: t};
  } catch (e) { return {error: String(e && e.message || e).slice(0, 120)}; } finally { clearTimeout(timer); }
}

// lines gone and lines new, in order (a plain line diff: enough to see what changed, the whole text is on the branch)
function changes(a, b) {
  const A = a.split('\n'), B = b.split('\n'), inB = new Set(B), inA = new Set(A);
  return {gone: A.filter(l => !inB.has(l)), added: B.filter(l => !inA.has(l))};
}

async function issue(title, body) {
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) { console.log('(no GitHub token: the issue would say)\n' + title + '\n' + body); return; }
  const h = {authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'user-agent': UA, 'content-type': 'application/json'};
  // the same issue still open: add to it, never open a second one
  const open = await (await fetch('https://api.github.com/repos/' + repo + '/issues?state=open&labels=terms-check&per_page=50', {headers: h})).json();
  const same = Array.isArray(open) && open.find(i => i.title === title);
  const r = same
    ? await fetch(same.url + '/comments', {method: 'POST', headers: h, body: JSON.stringify({body})})
    : await fetch('https://api.github.com/repos/' + repo + '/issues', {method: 'POST', headers: h, body: JSON.stringify({title, body, labels: ['terms-check']})});
  if (!r.ok) throw new Error('could not write the issue: http ' + r.status + ' ' + (await r.text()).slice(0, 200));
  console.log((same ? 'Added to issue: ' : 'Opened issue: ') + title);
}

(async () => {
  const dir = process.argv[2]; if (!dir) throw new Error('give the folder');
  fs.mkdirSync(path.join(dir, 'texts'), {recursive: true});
  const sf = path.join(dir, 'state.json');
  const state = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : {pages: {}};
  const now = new Date().toISOString().replace(/\.\d{3}/, ''), branch = 'https://github.com/' + (process.env.GITHUB_REPOSITORY || 'bitmap22/my-ordinal-portal') + '/blob/terms-check/texts/';
  const report = [];
  for (const w of WATCH) {
    const p = state.pages[w.id] = Object.assign({site: w.site, url: w.url}, state.pages[w.id] || {}), x = await read(w);
    p.lastChecked = now;
    if (x.error) {
      p.unreadable = (p.unreadable || 0) + 1; p.lastError = x.error;
      report.push(w.id + ': not read (' + x.error + ')' + (w.optional ? ', a page often hard for a script to read' : ''));
      if (!w.optional && p.unreadable === UNREADABLE_DAYS)
        await issue('Terms check: can’t read ' + w.site + '’s terms page',
          'The daily terms check could not read this page ' + UNREADABLE_DAYS + ' checks in a row, so a change to it would not be seen.\n\n' +
          '- Site: ' + w.site + '\n- Page: ' + w.see + '\n- What happened: ' + x.error + '\n\nNothing on the portal was changed. Please open the page and read the terms by hand.');
      await new Promise(r => setTimeout(r, 1500)); continue;
    }
    p.unreadable = 0; delete p.lastError;
    const fp = fingerprint(x.text), file = path.join(dir, 'texts', w.id + '.txt');
    if (!p.fingerprint) { p.fingerprint = fp; p.since = now; fs.writeFileSync(file, x.text + '\n'); report.push(w.id + ': first read, kept to compare'); }
    else if (p.fingerprint === fp) { fs.writeFileSync(file, x.text + '\n'); report.push(w.id + ': the same'); }
    else {
      const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '', c = changes(old, x.text), cut = L => L.slice(0, 40).map(l => '> ' + l.slice(0, 300)).join('\n') + (L.length > 40 ? '\n> … and ' + (L.length - 40) + ' more lines' : '');
      await issue('Terms check: ' + w.site + '’s terms changed',
        'The daily terms check found that this page changed on ' + now.slice(0, 10) + '.\n\n- Site: ' + w.site + '\n- Page: ' + w.see + '\n- Unchanged since: ' + (p.since || 'the first check').slice(0, 10) +
        '\n\n**Nothing on the portal was changed.** The site is still read. Please read the new terms, and decide whether the portal may keep reading it (then update SOURCES.md) or should stop.\n\n' +
        '### Lines that are gone\n' + (c.gone.length ? cut(c.gone) : '(none)') + '\n\n### Lines that are new\n' + (c.added.length ? cut(c.added) : '(none: only numbers, dates or spacing changed)') +
        '\n\nThe whole old and new text, with every change: ' + branch + w.id + '.txt (its history).');
      p.fingerprint = fp; p.since = now; p.changes = (p.changes || 0) + 1; fs.writeFileSync(file, x.text + '\n');
      report.push(w.id + ': CHANGED (issue opened)');
    }
    await new Promise(r => setTimeout(r, 1500));   // gently: one page at a time
  }
  state.checked = now; state.licence = '© 2026 bitmap22. All rights reserved.';
  fs.writeFileSync(sf, JSON.stringify(state, null, 1) + '\n');
  console.log('Terms check, ' + now + ':\n' + report.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
