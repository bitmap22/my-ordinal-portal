// Downloads real test data for the Block Manifest: for each height, the raw block, mempool.space's and ordpool.space's
// transaction lists (kept as text so ordpool's big tag numbers stay exact) and ordinals.com's list of inscriptions made in it.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const OUT = process.argv[2], HS = process.argv.slice(3).map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, bin) {
  for (let k = 0; k < 4; k++) {
    try { const r = await fetch(url, {headers: {'User-Agent': 'agent-blockhall-manifest-test'}}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); console.log('http', r.status, url); }
    catch (e) { console.log('err', String(e), url); }
    await sleep(3000 * (k + 1));
  }
  throw new Error('failed ' + url);
}
(async () => {
  let hs = HS;
  const tip = +(await get('https://mempool.space/api/blocks/tip/height'));
  hs = hs.map(h => h < 0 ? tip + h : h);
  for (const h of hs) {
    const dir = path.join(OUT, String(h)); fs.mkdirSync(dir, {recursive: true});
    const hash = (await get('https://mempool.space/api/block-height/' + h)).trim();
    const raw = await get('https://mempool.space/api/block/' + hash + '/raw', true); await sleep(500);
    const mp = await get('https://mempool.space/api/v1/block/' + hash + '/summary'); await sleep(500);
    const op = await get('https://ordpool.space/api/v1/block/' + hash + '/summary'); await sleep(500);
    const meta = await get('https://mempool.space/api/block/' + hash); await sleep(500);
    const ids = new Set();
    for (let page = 0; page < 400; page++) {
      const html = await get('https://ordinals.com/inscriptions/block/' + h + (page ? '/' + page : ''));
      for (const m of html.matchAll(/\/inscription\/([0-9a-f]{64}i\d+)/g)) ids.add(m[1]);
      if (!html.includes('/inscriptions/block/' + h + '/' + (page + 1))) break;
      await sleep(400);
    }
    const ordHash = (await get('https://ordinals.com/r/blockhash/' + h)).trim().replace(/^"|"$/g, '');
    fs.writeFileSync(path.join(dir, 'raw.bin.gz'), zlib.gzipSync(raw));
    fs.writeFileSync(path.join(dir, 'mempool-summary.json.gz'), zlib.gzipSync(mp));
    fs.writeFileSync(path.join(dir, 'ordpool-summary.json.gz'), zlib.gzipSync(op));
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({height: h, hash, ordHash, meta: JSON.parse(meta), ordIds: [...ids]}));
    console.log(h, hash, 'raw', raw.length, 'ids', ids.size);
  }
})().catch(e => { console.error(e); process.exit(1); });
