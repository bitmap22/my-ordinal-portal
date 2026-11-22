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

// Keeping the cream: a day keeps every detail for 90 days. After that it keeps its totals, every kind picked up, and only the
// blocks 2 or more visitors walked into or where a parcel was held a minute or more (thinned: true says so). Each finished
// month also gets a best of the month that is kept for good: months/<YYYY-MM>.json.
const KEEP_DAYS = 90, TOP = 100;
function thin(j) {
  if (j.thinned) return false;
  for (const site of ['btc', 'doge']) {
    const H = j[site], before = H.blocks.length;
    H.blocks = H.blocks.filter(b => b.walks.person + b.walks.agent >= 2 || Object.values(b.looks || {}).some(L => L['60s'] && L['60s'].person + L['60s'].agent > 0));
    H.blocksDropped = before - H.blocks.length;
  }
  j.thinned = true; j.thinnedNote = 'Older than ' + KEEP_DAYS + ' days: only the blocks 2 or more visitors walked into, or where a parcel was held a minute or more, are kept. The totals and kinds are whole.';
  return true;
}
function month(m, days) {
  const out = {month: m, note: 'The best of the month: the ' + TOP + ' most visited blocks, the kinds picked up, and the totals, each split into person and agent. Kept for good.', days: days.length};
  for (const site of ['btc', 'doge']) {
    const T = {walks: pw(), holds: pw()}, B = {}, K = {}, K60 = {}, C = {walks: pw()};
    for (const j of days) {
      const H = j[site]; if (!H) continue;
      for (const w of ['person', 'agent']) { T.walks[w] += H.totals.walks[w]; T.holds[w] += H.totals.holds[w]; if (H.commonRoom) C.walks[w] += H.commonRoom.walks[w]; }
      for (const [k, v] of Object.entries(H.kindsPickedUp)) { const x = K[k] = K[k] || pw(); x.person += v.person; x.agent += v.agent; }
      for (const b of H.blocks) {
        const x = B[b.block] = B[b.block] || {block: b.block, walks: pw(), stayed2min: pw(), pickedUp: pw(), held1min: pw(), days: 0};
        x.days++;
        for (const w of ['person', 'agent']) { x.walks[w] += b.walks[w]; x.stayed2min[w] += (b.stays['120s'] || {})[w] || 0;
          for (const v of Object.values(b.holds || {})) x.pickedUp[w] += v[w] || 0;
          for (const [k, L] of Object.entries(b.looks || {})) { const n = (L['60s'] || {})[w] || 0; x.held1min[w] += n; const y = K60[k] = K60[k] || pw(); y[w] += n; } }
      }
    }
    const all = Object.values(B).sort((a, b) => (b.walks.person + b.walks.agent) - (a.walks.person + a.walks.agent) || a.block - b.block);
    out[site] = {totals: Object.assign(T, {blocks: all.length}), commonRoom: C, kindsPickedUp: K, kindsHeld1min: K60, topBlocks: all.slice(0, TOP)};
  }
  return out;
}

if (require.main === module) (async () => {
  fs.mkdirSync(path.join(DIR, 'days'), {recursive: true}); fs.mkdirSync(path.join(DIR, 'months'), {recursive: true});
  const today = day(new Date());
  for (let t = new Date(START + 'T00:00:00Z'); day(t) < today; t.setUTCDate(t.getUTCDate() + 1)) {
    const d = day(t), f = path.join(DIR, 'days', d + '.json');
    if (fs.existsSync(f)) continue;
    let j = null;
    for (let i = 0; i < 4 && !j; i++) { try { const r = await fetch(API + d); if (r.ok) j = await r.json(); } catch (e) {} if (!j) await new Promise(r => setTimeout(r, 5000)); }
    if (!j || !j.counts) { console.log(d + ': the counter did not answer, try again next run'); continue; }
    fs.writeFileSync(f, JSON.stringify(build(d, j.counts), null, 1)); console.log(d + ': saved');
  }
  const files = fs.readdirSync(path.join(DIR, 'days')).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const read = f => JSON.parse(fs.readFileSync(path.join(DIR, 'days', f)));
  // the best of each finished month, made once, from the days while they still have every detail
  const thisMonth = today.slice(0, 7);
  for (const m of [...new Set(files.map(f => f.slice(0, 7)))]) {
    const mf = path.join(DIR, 'months', m + '.json');
    if (m >= thisMonth || fs.existsSync(mf)) continue;
    fs.writeFileSync(mf, JSON.stringify(month(m, files.filter(f => f.startsWith(m)).map(read)), null, 1)); console.log(m + ': best of the month saved');
  }
  // thin the days older than 90 days (their month's best is already saved above)
  const cut = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  for (const f of files) if (f.slice(0, 10) < cut) { const j = read(f); if (thin(j)) { fs.writeFileSync(path.join(DIR, 'days', f), JSON.stringify(j, null, 1)); console.log(f + ': thinned'); } }
  const days = files.map(f => { const j = read(f); return {day: j.day, btc: j.btc.totals, doge: j.doge.totals, thinned: !!j.thinned}; });
  const months = fs.readdirSync(path.join(DIR, 'months')).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort().map(f => f.slice(0, 7));
  fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({note: NOTE, file: 'days/<day>.json', monthFile: 'months/<month>.json', days, months}, null, 1));
  console.log(days.length + ' days and ' + months.length + ' months in the catalog');
})();
module.exports = {build, thin, month};
