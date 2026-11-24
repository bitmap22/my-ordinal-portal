// Source Review, by bitmap22: once a month, look again at every site the Ord Portal stopped reading on 24 November 2026
// (SOURCES.md, "No longer read"), to see if any of them now allows the portal's use. It opens one GitHub issue a month
// listing each site, its terms page, and whether that page changed since last month. A person reads the changed ones and
// decides; nothing on the portal is changed by this job. Pages a script can't read are listed to read by hand.
// Usage: node review.js <folder>   (the folder holds review.json and texts/ from last month; both are updated)
// © 2026 bitmap22. All rights reserved.
'use strict';
const fs = require('fs'), path = require('path');
const {fingerprint, read, changes, UA} = require('./check.js');

// what each site gave the portal, and its terms page (where one was found; "page: null" means read it by hand on its site)
const REVIEW = [
  {id: 'kraken', site: 'Kraken', gave: 'the bitcoin price', page: 'https://www.kraken.com/legal/global-terms', html: true},
  {id: 'gemini', site: 'Gemini', gave: 'the bitcoin price', page: 'https://www.gemini.com/legal/api-agreement', html: true},
  {id: 'gemini-data', site: 'Gemini (market data)', gave: 'the bitcoin price', page: 'https://www.gemini.com/legal/market-data-agreement', html: true},
  {id: 'coinbase', site: 'Coinbase', gave: 'the bitcoin price, and past days’ low and high', page: 'https://docs.cdp.coinbase.com/exchange/docs/intro', html: true},
  {id: 'bitstamp', site: 'Bitstamp', gave: 'past days’ low and high', page: null, home: 'https://www.bitstamp.net/'},
  {id: 'blockchain-com', site: 'Blockchain.com (blockchain.info)', gave: 'the bitcoin price; a back-up explorer', page: 'https://www.blockchain.com/legal/api-terms', html: true},
  {id: 'stampchain', site: 'stampchain.io', gave: 'Stamp numbers, SRC-20 totals, SRC-721 pictures, SRC-101 names', page: null, home: 'https://stampchain.io/'},
  {id: 'counterparty', site: 'api.counterparty.io', gave: 'Counterparty details', page: null, home: 'https://docs.counterparty.io/'},
  {id: 'ordinals-wallet', site: 'Ordinals Wallet', gave: 'a back-up ord site', page: null, home: 'https://ordinalswallet.com/'},
  {id: 'xverse', site: 'Xverse (ord.xverse.app)', gave: 'the second ord site for 4 tools', page: 'https://xverse.app/terms', html: true},
  {id: 'ordinalsbot', site: 'OrdinalsBot', gave: 'a back-up ord site', page: 'https://ordinalsbot.com/terms', html: true},
  {id: 'ordiscan', site: 'Ordiscan (as a data source; links still go there)', gave: 'a back-up ord site; rare sat prices', page: 'https://ordiscan.com/docs', html: true},
  {id: 'mempool-copies', site: 'mempool.emzy.de, mempool.ninja, mempool.bitaroo.net', gave: 'back-up copies of mempool.space', page: null, home: 'https://mempool.emzy.de/'},
  {id: 'blockchair', site: 'Blockchair', gave: 'a back-up explorer; Dogecoin transactions', page: null, home: 'https://blockchair.com/api'},
  {id: 'blockcypher', site: 'BlockCypher', gave: 'a back-up explorer; Dogecoin fees', page: 'https://www.blockcypher.com/terms-of-service.html', html: true},
  {id: 'bitcore', site: 'BitPay’s Bitcore (api.bitcore.io)', gave: 'a back-up explorer; Dogecoin blocks', page: null, home: 'https://bitpay.com/legal/'},
  {id: '3xpl', site: '3xpl', gave: 'a back-up explorer', page: null, home: 'https://3xpl.com/'},
  {id: 'doggy-market', site: 'Doggy Market', gave: 'Doginal files (Doge Cube)', page: null, home: 'https://doggy.market/'}
];

async function issue(title, body) {
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) { console.log('(no GitHub token: the issue would say)\n' + title + '\n' + body); return; }
  const h = {authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'user-agent': UA, 'content-type': 'application/json'};
  const r = await fetch('https://api.github.com/repos/' + repo + '/issues', {method: 'POST', headers: h, body: JSON.stringify({title, body, labels: ['source-review']})});
  if (!r.ok) throw new Error('could not open the issue: http ' + r.status + ' ' + (await r.text()).slice(0, 200));
  console.log('Opened issue: ' + title);
}

(async () => {
  const dir = process.argv[2]; if (!dir) throw new Error('give the folder');
  fs.mkdirSync(path.join(dir, 'texts'), {recursive: true});
  const sf = path.join(dir, 'review.json');
  const state = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : {sites: {}};
  const now = new Date().toISOString().replace(/\.\d{3}/, ''), month = new Date().toLocaleString('en-GB', {month: 'long', year: 'numeric', timeZone: 'UTC'});
  const repo = process.env.GITHUB_REPOSITORY || 'bitmap22/my-ordinal-portal', rows = [], changed = [];
  for (const w of REVIEW) {
    const p = state.sites[w.id] = Object.assign({site: w.site}, state.sites[w.id] || {});
    let says;
    if (!w.page) says = 'read by hand: no terms page a script can follow was found (start at ' + w.home + ')';
    else {
      const x = await read(Object.assign({url: w.page}, w));
      if (x.error) says = 'read by hand: the page could not be read by a script (' + x.error.slice(0, 80) + ')';
      else {
        const fp = fingerprint(x.text), file = path.join(dir, 'texts', w.id + '.txt');
        // (which part of the page is compared: if that rule was changed here, the page is looked at afresh, never called changed)
        const rule = JSON.stringify([w.page, w.start || null, w.endBefore || null, w.endAfter || null]);
        if (p.rule !== rule) { delete p.fingerprint; p.rule = rule; }
        if (!p.fingerprint) says = 'first look: kept to compare from next month';
        else if (p.fingerprint === fp) says = 'the same as last month';
        else {
          const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '', c = changes(old, x.text);
          says = '**CHANGED since last month** (' + c.gone.length + ' lines gone, ' + c.added.length + ' new): read it, it may now allow the portal’s use';
          changed.push(w.site);
        }
        p.fingerprint = fp; p.lastRead = now; fs.writeFileSync(file, x.text + '\n');
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    p.says = says; p.checked = now;
    rows.push('- [ ] **' + w.site + '** (gave: ' + w.gave + '): ' + says + (w.page ? '. Terms: ' + w.page : ''));
  }
  state.checked = now; state.licence = '© 2026 bitmap22. All rights reserved.';
  fs.writeFileSync(sf, JSON.stringify(state, null, 1) + '\n');
  const body = 'Once a month, the sites the portal stopped reading on 24 November 2026 are looked at again, to see if any now allows the portal’s use (see SOURCES.md).\n\n' +
    (changed.length ? '**Terms changed this month: ' + changed.join(', ') + '.** Read those first.\n\n' : 'No watched terms page changed this month.\n\n') +
    'Tick each site once it has been read. If a site now clearly allows the portal’s use, it can be brought back (and added to SOURCES.md and the daily Terms Check). **Nothing on the portal was changed by this review.**\n\n' +
    rows.join('\n') + '\n\nEvery wording of each page is kept on the `source-review` branch: https://github.com/' + repo + '/tree/source-review/texts';
  await issue('Monthly source review: ' + month, body);
  console.log('Source Review, ' + now + ':\n' + rows.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
