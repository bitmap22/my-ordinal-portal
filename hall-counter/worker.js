// Hall Counter: counts what visitors do in Agent Blockhall and Doge Cube, as anonymous daily totals.
// It runs on Cloudflare at ordportal.com/hall-count. Nothing personal is kept: no IP address, no cookie, no browser
// name, no visitor id. Each count is only "on this day, this happened once more", e.g. "a person walked into block 925,000".
//   GET /hall-count?s=btc&e=walk&b=925000&w=p   count one thing (the halls send these; anything not on the lists below is ignored)
//   GET /hall-count/day?d=2026-11-22            that day's totals, as JSON (public: the catalog is public anyway)
// © 2026 bitmap22. All rights reserved.

const SITES = ['btc', 'doge'];
// e: walk (walked into a block, or the common room), stay (stayed in it at least t seconds),
//    hold (picked up a parcel of kind k), look (held it at least t seconds)
const STAY = ['30', '120', '600'], LOOK = ['10', '60'];
const KINDS = new Set(['inscriptions', 'images', 'text', 'HTML', 'JSON', 'audio / video', '3D models', 'other files', 'delegates',
  'children', 'cursed', 'bitmaps', 'BRC-20', 'BRC-420', 'TAP', 'DMT mints', 'NAT', 'CRC-20 · LEAF', 'runes', 'runes etched',
  'runes minted', 'runes moved', 'Alkanes', 'Atomicals', 'SRC-20', 'Stamps', 'Counterparty', 'CAT-21', 'Labitbu', 'OpenTimestamps',
  'with pictures', 'taproot', 'segwit', 'legacy', 'consolidations', 'batch payouts', 'multisig', 'messages', 'coinbase', 'regular',
  'dogemaps', 'names', 'DRC-20', 'dunes', 'dunes etched', 'dunes minted', 'dunes moved', 'pay to script', 'pay to address',
  'pay to key', 'OP_RETURN data']);
// browsers that say they are automated: counted as agents whatever the page says
const AUTO = /HeadlessChrome|Playwright|Puppeteer|PhantomJS|Selenium|bot\b|crawler|spider/i;

const ok = (body, type) => new Response(body, {status: body == null ? 204 : 200, headers: {
  'content-type': type || 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store'}});

function keyOf(q, ua) {
  const s = q.get('s'), e = q.get('e'), b = q.get('b'), k = q.get('k') || '', t = q.get('t') || '';
  if (!SITES.includes(s)) return null;
  if (!(b === 'common' || /^\d{1,8}$/.test(b || ''))) return null;
  if (e === 'walk') { if (k || t) return null; }
  else if (e === 'stay') { if (k || !STAY.includes(t)) return null; }
  else if (e === 'hold') { if (!KINDS.has(k) || t || b === 'common') return null; }
  else if (e === 'look') { if (!KINDS.has(k) || !LOOK.includes(t) || b === 'common') return null; }
  else return null;
  const w = q.get('w') === 'a' || AUTO.test(ua || '') ? 'agent' : 'person';
  return [q.get('x') === '1' ? 'test' : 'live', s, e, b === 'common' ? b : String(Number(b)), k, t, w].join('|');
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return ok(null);
    if (req.method !== 'GET' && req.method !== 'POST') return new Response(null, {status: 405});
    if (u.pathname === '/hall-count/day') {
      const d = u.searchParams.get('d') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return ok(JSON.stringify({error: 'd must be a day like 2026-11-22'}));
      const r = await env.DB.prepare('SELECT key, n FROM counts WHERE day = ?1').bind(d).all();
      return ok(JSON.stringify({day: d, counts: Object.fromEntries((r.results || []).map(x => [x.key, x.n]))}));
    }
    if (u.pathname === '/hall-count') {
      const key = keyOf(u.searchParams, req.headers.get('user-agent'));
      if (key) {
        const day = new Date().toISOString().slice(0, 10);
        await env.DB.prepare('INSERT INTO counts (day, key, n) VALUES (?1, ?2, 1) ON CONFLICT(day, key) DO UPDATE SET n = n + 1').bind(day, key).run();
      }
      return ok(null);
    }
    return new Response('Not found', {status: 404});
  }
};
