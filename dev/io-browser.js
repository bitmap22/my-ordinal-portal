window.__io = (() => {
  const MIRRORS = ['https://mempool.space', 'https://ordpool.space', 'https://mempool.emzy.de', 'https://mempool.ninja', 'https://mempool.fra.mempool.space', 'https://mempool.bitaroo.net', 'https://blockstream.info'];
  const ORD_R = ['https://ordinals.com', 'https://static.unisat.io', 'https://ordiscan.com', 'https://ordinalswallet.com', 'https://ord.xverse.app'];
  const get = async (u, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 20000); try { const r = await fetch(u, {signal: c.signal}); if (!r.ok) throw new Error('http ' + r.status + ' from ' + new URL(u).host); return r; } finally { clearTimeout(t); } };
  const mp = async path => { let e; for (const b of MIRRORS) { try { return {r: await get(b + path), site: b}; } catch (x) { e = x; if (/http 404/.test(String(x))) throw x; } } throw e; };
  const ord = async (path, list) => { let e; for (const b of list) { try { return {r: await get(b + path), site: b}; } catch (x) { e = x; if (b === list[0] && /http 404/.test(String(x))) throw x; } } throw e; };
  return {
    ordJson: async p => { const x = await ord(p, ORD_R.slice(0, 1)); return {j: await x.r.json(), site: x.site}; },
    ord2Json: async p => { const x = await ord(p, ORD_R.slice(1)); return {j: await x.r.json(), site: x.site}; },
    ordText: async p => { const x = await ord(p, ORD_R.slice(0, 1)); return {t: await x.r.text(), site: x.site}; },
    ordBytes: async p => { const x = await ord(p, ORD_R.slice(0, 1)); return {bytes: new Uint8Array(await x.r.arrayBuffer()), site: x.site}; },
    mpJson: async p => { const x = await mp(p); return {j: await x.r.json(), site: x.site}; },
    mpText: async p => { const x = await mp(p); return {t: await x.r.text(), site: x.site}; },
    sleep: ms => new Promise(r => setTimeout(r, ms)), decompress: null};
})();
