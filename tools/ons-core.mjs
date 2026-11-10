// The 0NS name list: the engine (no Node-only parts, so the same code can be tried anywhere). ons-robot.mjs runs it.
//
// It reads each NEW 0NS registration from Bitcoin once, gently (one question at a time, with rests), for everyone, so no
// visitor's browser ever has to read the whole register. The list is a few small files:
//   meta.json      how far the list has got (block height), how many names, registrations still being checked
//   n/<ab>.json    the names starting with "ab": name -> [registration inscription ID, its sat, inscription number, block]
//   all.txt        every name, one per line (only while the list is small, for "names containing ..." searches)
//   state.json     the robot's own notes (where it got to)
//
// 0NS rules (the same the cube used): a registration is a commit paying exactly 1,000 sats to the 0NS index address, whose
// output 0 is spent by the reveal; the reveal's first inscription is the name (plain text) with a delegate. The first valid
// confirmed registration of a name (lowest inscription number) wins.
export const ONS_IDX = 'bc1p0jhh0smr9u76xkly8ch343yu2fcgrp4xszzz3qte25v7sq0txqzssd32f5', ONS_FEE = 1000;
export const ONS_MEMPOOL = ['https://mempool.space', 'https://mempool.emzy.de', 'https://blockstream.info'];
export const ONS_ORD = ['https://ordinals.com', 'https://static.unisat.io', 'https://ordiscan.com', 'https://ordinalswallet.com'];
const NAME_RE = /^[a-z0-9-]{1,63}$/, ID_RE = /^[0-9a-f]{64}i\d+$/;
const MAX_PER_RUN = 600;      // registrations read in one run at most (the rest wait for the next run)
const ALL_TXT_MAX = 20000;    // all.txt is kept while the list has this many names or fewer
export const onsKeyOf = name => (name + '_').slice(0, 2);

// io: {fetch, nap(ms), read(path, fallback), write(path, value), writeText(path, text), remove(path), shardNames() -> [keys]}
export async function onsUpdate(io) {
  let asked = 0;
  // one question, trying each site in turn; a 404 is an answer ("not there"), not a failure
  async function get(sites, p, text) {
    let last = null;
    for (const s of sites) {
      try {
        asked++;
        const r = await io.fetch(s + p);
        if (r.status === 404) { const e = new Error('404 ' + p); e.notFound = true; throw e; }
        if (!r.ok) throw new Error('http ' + r.status + ' ' + p);
        return text ? await r.text() : await r.json();
      } catch (e) { last = e; if (e.notFound) throw e; await io.nap(1500); }
    }
    throw last;
  }

  const st = io.read('state.json', {v: 1, height: -1, pending: [], count: 0, regs: 0});
  const tip = +(await get(ONS_MEMPOOL, '/api/blocks/tip/height', true));
  if (!Number.isSafeInteger(tip)) throw new Error('no block height');

  // 1) the commits made since the last run: newest first, 25 a page, back to the last block already done
  const fresh = [];
  let last = null;
  for (let p = 0; p < 4000; p++) {
    const page = await get(ONS_MEMPOOL, '/api/address/' + ONS_IDX + '/txs/chain' + (last ? '/' + last : ''));
    if (!Array.isArray(page) || !page.length) break;
    let older = false;
    for (const t of page) {
      const h = t.status && t.status.block_height;
      if (h != null && h <= st.height) { older = true; break; }
      fresh.push(t);
    }
    if (older || page.length < 25) break;
    last = page[page.length - 1].txid;
    await io.nap(1000);
  }
  fresh.sort((a, b) => a.status.block_height - b.status.block_height);
  const beacons = fresh.filter(t => (t.vout || []).some(o => o.scriptpubkey_address === ONS_IDX && o.value === ONS_FEE)).map(t => t.txid);
  const todo = [...new Set(st.pending.concat(beacons))];

  // 2) each one, one at a time: its reveal, then the inscription it made (checked against the 0NS rules)
  const shards = new Map(), shard = k => { if (!shards.has(k)) shards.set(k, io.read('n/' + k + '.json', {})); return shards.get(k); };
  const pending = [];
  let done = 0, miss = 0, added = 0;
  for (const tx of todo) {
    if (done >= MAX_PER_RUN || miss >= 3) { pending.push(tx); continue; }
    if (done++) await io.nap(600);
    try {
      const os = await get(ONS_MEMPOOL, '/api/tx/' + tx + '/outspend/0');
      miss = 0;
      if (!os || !os.spent || !os.txid || !(os.status && os.status.confirmed)) { pending.push(tx); continue; }   // (not revealed or not mined yet)
      const id = os.txid + 'i0';
      let info, body;
      try {
        info = await get(ONS_ORD, '/r/inscription/' + id);
        await io.nap(300);
        body = await get(ONS_ORD, '/r/undelegated-content/' + id, true);
      } catch (e) { if (e.notFound) continue; throw e; }   // (the reveal made no inscription: not a registration)
      const name = String(body || '').trim().toLowerCase();
      st.regs++;
      if (!(info && info.height >= 0 && NAME_RE.test(name) && ID_RE.test(String(info.delegate || '')) && Number.isSafeInteger(+info.sat))) continue;
      const S = shard(onsKeyOf(name)), old = S[name];
      if (old && old[2] <= info.number) continue;   // (an earlier registration of this name already holds it)
      if (!old) st.count++;
      S[name] = [id, +info.sat, info.number, info.height];
      added++;
    } catch (e) {
      miss++; pending.push(tx);
      await io.nap(miss * 3000);   // (no answer: wait a little longer each time; tried again next run)
    }
  }

  // 3) save: the touched name files, how far the list has got, and all.txt while the list is small
  for (const [k, S] of shards) io.write('n/' + k + '.json', S);
  st.pending = pending;
  st.height = tip;
  io.write('state.json', st);
  const all = st.count <= ALL_TXT_MAX;
  if (all) {
    const names = [];
    for (const k of io.shardNames().sort()) names.push(...Object.keys(io.read('n/' + k + '.json', {})));
    io.writeText('all.txt', names.sort().join('\n') + (names.length ? '\n' : ''));
  } else io.remove('all.txt');
  const meta = {v: 1, height: tip, count: st.count, complete: pending.length === 0, pending: pending.slice(0, 50), all, updated: new Date(io.now ? io.now() : Date.now()).toISOString()};
  io.write('meta.json', meta);
  return {tip, count: st.count, added, waiting: pending.length, asked};
}
