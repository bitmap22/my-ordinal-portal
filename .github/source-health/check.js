// Source Health's hourly check, by bitmap22 (© 2026 bitmap22, all rights reserved). Run by GitHub about once an hour (see
// .github/workflows/source-health.yml): asks each data site the portal's tools read one small thing, using the same reader as
// the Source Health page and the Agent Blockhall MCP tool, then adds the answers to a week-long record.
// Usage: node .github/source-health/check.js <folder holding week.json>   (writes week.json and latest.json there)
const fs = require('fs'), path = require('path');
const H = require('../../agent-blockhall-mcp/server/health.js');
(async () => {
  const dir = process.argv[2] || 'health';
  let rec = null;
  try { rec = JSON.parse(fs.readFileSync(path.join(dir, 'week.json'), 'utf8')); } catch (e) { console.log('No record yet: starting one.'); }
  // (it says who is asking, as the MCP tool does: some sites refuse an ask that gives no name, which would not be a fair test)
  const ua = 'agent-blockhall-source-health/' + H.VERSION + ' (+https://ordportal.com/source-health.html)';
  const c = await H.check({from: 'GitHub\'s computers', fetch: (u, init) => fetch(u, Object.assign({}, init, {headers: {'User-Agent': ua}}))});
  rec = H.addToRecord(rec, c);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'week.json'), JSON.stringify(rec));
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(Object.assign({licence: H.LICENCE}, c), null, 1));
  console.log('Checked ' + c.at + ': ' + JSON.stringify(c.counts) + ', newest blocks ' + JSON.stringify(c.newest) + '. The record holds ' + rec.checks.length + ' checks.');
  for (const r of c.results) console.log('  ' + r.site.padEnd(26) + r.words);
})().catch(e => { console.error(e); process.exit(1); });
