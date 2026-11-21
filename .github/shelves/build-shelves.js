/* The front page corridor's shelves, by bitmap22. Always free.
   Run by GitHub about every half hour (the Corridor shelves workflow): it reads each of the newest Bitcoin blocks the Block
   Manifest way (agent-blockhall-mcp/server/manifest.js, the same reading as Agent Blockhall's halls and Daily Data) and keeps,
   for the last 144 blocks, how many of each block's transactions go on each kind of shelf in its hall. A transaction goes on
   one shelf, the first of its kinds in the halls' own order (BRC-20 first, inscriptions last; one with none is a regular
   payment), so the counts add up to the block's transactions. The front page colours each frame's boxes with them.
   Usage: node build-shelves.js <data folder>. It asks the free public sites gently, as Daily Data does.
   © 2026 bitmap22. All rights reserved. */
'use strict';
const fs = require('fs'), path = require('path');
const {readBlock, mpJson, sleep} = require(path.join(__dirname, '..', 'daily-data', 'build-day.js'));
const VERSION = '1.0.0', KEEP = 144, MAX_READ = 150, TIME_BOX = 14 * 60 * 1000;   // (a block takes about 2 seconds to read: one run can fill the day; the time box keeps it short)
const PORTAL = 'https://ordportal.com/';
const LICENCE = '© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission (https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE).';
// the halls' shelf kinds, in the halls' own order and colours (block-cube.html, KINDS); the Block Manifest's names where they differ
const SHELVES = [['BRC-20', '#4aa8ff'], ['TAP', '#36f1ff'], ['CRC-20 · LEAF', '#7cff6b'], ['BRC-420', '#ff4ff0'], ['SRC-20', '#2fe0c0'], ['Stamps', '#d9d9d9'],
  ['Counterparty', '#b08cff'], ['CAT-21', '#ff6fb1'], ['Atomicals', '#9be15d'], ['Labitbu', '#ffe066'], ['OpenTimestamps', '#e8c9a0'], ['Alkanes', '#ff7a45'],
  ['bitmaps', '#ff3b5c'], ['runes', '#c86bff'], ['inscriptions', '#ffa53a'], ['regular', '#7d8cab']];
const shelfOf = kinds => { for (const [k] of SHELVES) if (k !== 'regular' && kinds.includes(k)) return k; return 'regular'; };

async function main() {
  const out = process.argv[2] || 'data', dir = path.join(out, 'btc'), file = path.join(dir, 'shelves.json'), t0 = Date.now();
  fs.mkdirSync(dir, {recursive: true});
  let old = {blocks: []}; try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  const have = new Map((old.blocks || []).map(b => [b.height, b]));
  const newest = (await mpJson('/api/v1/blocks', 20000)).j;
  const tip = newest[0].height, want = [];
  for (let h = tip; h > tip - KEEP; h--) want.push(h);
  // the block list (hash, time, pool) for the window, 15 at a time
  const info = new Map(newest.map(b => [b.height, b]));
  for (let h = tip - 15; h > tip - KEEP; h -= 15) { const L = (await mpJson('/api/v1/blocks/' + h, 20000)).j; for (const b of L) info.set(b.height, b); }
  // read the ones it does not have yet, newest first, a few a run
  let read = 0;
  for (const h of want) {
    if (have.has(h) && have.get(h).shelves) continue;
    if (read >= MAX_READ || Date.now() - t0 > TIME_BOX) break;
    const b = info.get(h); if (!b) continue;
    let M = null, err = null;
    for (let tries = 0; tries < 2 && !M; tries++) { try { M = await readBlock(h, b.id); } catch (e) { err = e; await sleep(10000); } }
    read++;
    if (!M) { console.log('  ' + h + ': not read (' + (err && err.message) + ')'); continue; }
    const shelves = {};
    for (const it of M.items) { const k = shelfOf(it.kinds || []); shelves[k] = (shelves[k] || 0) + 1; }
    const C = M.checked;
    have.set(h, {height: h, hash: b.id, time: new Date(b.timestamp * 1000).toISOString().replace('.000', ''), transactions: M.block.transactions,
      shelves: Object.fromEntries(SHELVES.filter(([k]) => shelves[k]).map(([k]) => [k, shelves[k]])),
      checked: {ids: [C.transactions.matched, C.transactions.of], kinds: C.kinds.agreed != null ? [C.kinds.agreed, C.kinds.of] : null}});
    console.log('  ' + h + ': ' + M.block.transactions + ' transactions, shelves ' + JSON.stringify(have.get(h).shelves));
  }
  const blocks = want.filter(h => have.has(h)).map(h => have.get(h));
  const doc = {
    data: 'Agent Blockhall corridor shelves ' + VERSION, made: new Date().toISOString().replace(/\.\d{3}/, ''), licence: LICENCE,
    what: 'For each of the last ' + KEEP + ' Bitcoin blocks (that have been read), how many of its transactions go on each kind of shelf in its hall: '
      + 'each transaction on one shelf, the first of its kinds in the halls\' own order (the order of shelves below), read the Block Manifest way; one with none of them is a regular payment. '
      + 'The counts add up to the block\'s transactions. Made by GitHub about every half hour; a block not read yet is not here.',
    shelves: SHELVES.map(([name, colour]) => ({name, colour})),
    upTo: blocks.length ? blocks[0].height : null, newestKnown: tip, keeps: KEEP, read: blocks.length,
    blocks,
    links: {frontPage: PORTAL, blockManifest: PORTAL + 'block-manifest.html?block=<height>', agentBlockhall: PORTAL + 'block-cube.html#block=<height>', dailyData: PORTAL + 'daily.html'}};
  fs.writeFileSync(file, JSON.stringify(doc));
  console.log('Wrote ' + blocks.length + ' of the last ' + KEEP + ' blocks (read ' + read + ' this run), up to ' + doc.upTo + ', newest known ' + tip);
}
main().catch(e => { console.error(e); process.exit(1); });
