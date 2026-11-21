/* Agent Blockhall's Blockspace Share: one day's fill-in, by bitmap22. Always free.
   For days from before Daily Data counted bytes: it reads every Bitcoin block of one UTC day from its own bytes (the same
   reader as Daily Data, build-day.js) and saves only that day's bytes by kind (space/days/<day>.json, and space/index.json).
   It asks for nothing else, so it is light on the free sites. Run by GitHub (the Blockspace Share fill-in workflow).
   Usage: node space-day.js YYYY-MM-DD <data folder>
   © 2026 bitmap22. All rights reserved. */
'use strict';
const BD = require('./build-day.js');

async function main() {
  const day = process.argv[2], out = process.argv[3] || 'data';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw new Error('give the day: YYYY-MM-DD');
  const t0 = Date.parse(day + 'T00:00:00Z') / 1000, t1 = t0 + 86400;
  if (t1 > Date.now() / 1000) throw new Error(day + ' has not finished yet (UTC)');
  const list = await BD.blocksOfDay(t0, t1);
  console.log('Blockspace Share for ' + day + ': ' + list.length + ' blocks' + (list.length ? ', ' + list[0].height + ' to ' + list[list.length - 1].height : ''));
  const blocks = [];
  for (const b of list) {
    let split = null, err = null;
    for (let tries = 0; tries < 3 && !split; tries++) {
      try { const raw = await BD.rawBlockOf(b.height, b.id); split = BD.spaceOfBlock(BD.BM.scanBlock(raw.bytes, b.height), raw.bytes, b.id); }
      catch (e) { err = e; await BD.sleep(15000); }
    }
    if (!split) console.log('  ' + b.height + ': not read (' + (err && err.message) + ')');
    blocks.push({height: b.height, split});
  }
  const rec = BD.SP.dayRecord(day, blocks);
  BD.SP.writeDay(out, rec);
  const pct = k => rec.size ? (100 * rec.bytes[k] / rec.size).toFixed(1) + '%' : '-';
  console.log('Saved ' + day + ': ' + rec.read + ' of ' + rec.blocks + ' blocks, ' + rec.size + ' bytes. ' + BD.SP.NAMES.map(k => k + ' ' + pct(k)).join(', '));
}
main().catch(e => { console.error(e); process.exit(1); });
