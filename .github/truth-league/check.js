// The Truth League's timed check, by bitmap22 (© 2026 bitmap22, all rights reserved). Run by GitHub every few hours (see
// .github/workflows/truth-league.yml): proves one Bitcoin block and one Dogecoin block from their own bytes, asks each data
// site the portal's tools read a few facts about them, marks each answer right or wrong against the bytes (never against
// another site), and adds the answers to a 30-day record. The same reader as the Truth League page and the MCP tool.
// Usage: node .github/truth-league/check.js <folder holding league.json>   (writes league.json and latest.json there)
const fs = require('fs'), path = require('path');
const L = require('../../agent-blockhall-mcp/server/league.js');
(async () => {
  const dir = process.argv[2] || 'league';
  let rec = null;
  try { rec = JSON.parse(fs.readFileSync(path.join(dir, 'league.json'), 'utf8')); } catch (e) { console.log('No record yet: starting one.'); }
  // (it says who is asking, as Source Health does: some sites refuse an ask that gives no name, which would not be a fair test)
  const ua = 'agent-blockhall-truth-league/' + L.VERSION + ' (+https://ordportal.com/truth-league.html)';
  const c = await L.check({from: 'GitHub\'s computers', fetch: (u, init) => fetch(u, Object.assign({}, init, {headers: {'User-Agent': ua}})), say: (k, v) => console.log('  ' + k + ': ' + v)});
  rec = L.addToRecord(rec, c);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'league.json'), JSON.stringify(rec));
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(Object.assign({licence: L.LICENCE}, c), null, 1));
  // the order for the tools (agent-blockhall-mcp/server/site-order.js): each site with a wrong answer in the last 7 days
  const week = L.summarise(rec, {days: 7});
  fs.writeFileSync(path.join(dir, 'order.json'), JSON.stringify({made: c.at, days: 7, licence: L.LICENCE, what: 'Sites with a wrong answer in the Truth League\'s last 7 days: the portal\'s tools ask them last (never dropped).',
    wrong: week.sites.filter(s => s.wrong).map(s => ({site: s.site, wrong: s.wrong, answered: s.answered, last: s.lastWrong.length ? L.wrongWords(s.lastWrong[s.lastWrong.length - 1]) : null}))}, null, 1));
  console.log('Checked ' + c.at + '. Bitcoin: ' + JSON.stringify(c.truth.bitcoin) + '\nDogecoin: ' + JSON.stringify(c.truth.doge));
  for (const n of c.notes) console.log('  note: ' + n);
  for (const r of c.results) console.log('  ' + r.site.padEnd(26) + r.facts.map(f => f.fact + '=' + f.code + (f.note ? ' (' + f.note + ')' : '') + (f.code === 'W' ? ' said ' + JSON.stringify(f.said) + ' truth ' + JSON.stringify(f.truth) : '')).join('  '));
  console.log('The record holds ' + rec.checks.length + ' checks and ' + rec.wrong.length + ' wrong answers. ' + fs.statSync(path.join(dir, 'league.json')).size + ' bytes.');
})().catch(e => { console.error(e); process.exit(1); });
