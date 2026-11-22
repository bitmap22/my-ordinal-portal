// Hall Visits: turns a day's counts from the Hall Counter (ordportal.com/hall-count/day) into the catalog files.
//   node build-visits.js <folder>     <folder> holds the hall-visits branch: days/<day>.json and index.json
// Days already saved are kept as they are; any finished day (UTC) from the start that is missing is fetched and saved.
// Test counts (from the test copies) are left out. © 2026 bitmap22. All rights reserved.
const fs = require('fs'), path = require('path');
const DIR = process.argv[2] || 'hv', START = '2026-11-22', API = 'https://ordportal.com/hall-count/day?d=';
const NOTE = 'Anonymous daily totals of what visitors did in Agent Blockhall (btc) and Doge Cube (doge), from the portal\'s own counter. ' +
  'Each thing is counted once a visit: walking into a block (or the common room), staying at least 30, 120 or 600 seconds, picking up ' +
  'a parcel of a kind, and holding it at least 10 or 60 seconds. "agent" means the visitor was an AI agent: it started the agent kit, ' +
  'or its browser says it is automated (headless browsers, WebDriver). Everyone else is "person". Nothing personal is kept.';
const day = d => d.toISOString().slice(0, 10);
const pw = () => ({person: 0, agent: 0});

function build(d, counts) {
  const S = {};
  for (const [key, n] of Object.entries(counts)) {
    const [mode, site, e, b, k, t, w] = key.split('|');
    if (mode !== 'live' || !(w === 'person' || w === 'agent')) continue;
    const s = S[site] = S[site] || {places: {}, totals: {walks: pw(), holds: pw()}};
    const P = s.places[b] = s.places[b] || {walks: pw(), stays: {}, holds: {}, looks: {}};
    if (e === 'walk') { P.walks[w] += n; s.totals.walks[w] += n; }
    else if (e === 'stay') (P.stays[t + 's'] = P.stays[t + 's'] || pw())[w] += n;
    else if (e === 'hold') { (P.holds[k] = P.holds[k] || pw())[w] += n; s.totals.holds[w] += n; }
    else if (e === 'look') { const L = P.looks[k] = P.looks[k] || {}; (L[t + 's'] = L[t + 's'] || pw())[w] += n; }
  }
  const out = {day: d, note: NOTE};
  for (const site of ['btc', 'doge']) {
    const s = S[site] || {places: {}, totals: {walks: pw(), holds: pw()}}, all = s.places;
    const blocks = Object.keys(all).filter(b => b !== 'common').map(b => Object.assign({block: Number(b)}, all[b]))
      .sort((a, b) => (b.walks.person + b.walks.agent) - (a.walks.person + a.walks.agent) || a.block - b.block);
    const kinds = {};
    for (const b of Object.values(all)) for (const [k, v] of Object.entries(b.holds)) { const K = kinds[k] = kinds[k] || pw(); K.person += v.person; K.agent += v.agent; }
    out[site] = {totals: Object.assign(s.totals, {blocks: blocks.length}), commonRoom: all.common || null, kindsPickedUp: kinds, blocks};
  }
  return out;
}

if (require.main === module) (async () => {
  fs.mkdirSync(path.join(DIR, 'days'), {recursive: true});
  const today = day(new Date());
  for (let t = new Date(START + 'T00:00:00Z'); day(t) < today; t.setUTCDate(t.getUTCDate() + 1)) {
    const d = day(t), f = path.join(DIR, 'days', d + '.json');
    if (fs.existsSync(f)) continue;
    let j = null;
    for (let i = 0; i < 4 && !j; i++) { try { const r = await fetch(API + d); if (r.ok) j = await r.json(); } catch (e) {} if (!j) await new Promise(r => setTimeout(r, 5000)); }
    if (!j || !j.counts) { console.log(d + ': the counter did not answer, try again next run'); continue; }
    fs.writeFileSync(f, JSON.stringify(build(d, j.counts), null, 1)); console.log(d + ': saved');
  }
  const days = fs.readdirSync(path.join(DIR, 'days')).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f => {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, 'days', f)));
    return {day: j.day, btc: j.btc.totals, doge: j.doge.totals};
  });
  fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({note: NOTE, file: 'days/<day>.json', days}, null, 1));
  console.log(days.length + ' days in the catalog');
})();
module.exports = {build};
