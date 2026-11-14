window.__wio = (() => {
  const MIRRORS = ['https://mempool.space', 'https://ordpool.space', 'https://mempool.emzy.de', 'https://mempool.ninja', 'https://mempool.fra.mempool.space'];
  const ORD_R = ['https://ordinals.com', 'https://static.unisat.io'];
  const get = async (u, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 30000); try { const r = await fetch(u, {signal: c.signal}); if (!r.ok) throw new Error('http ' + r.status + ' from ' + new URL(u).host); return r; } finally { clearTimeout(t); } };
  const mp = async (path, list) => { let e; for (const b of list || MIRRORS) { try { return {r: await get(b + path), site: b}; } catch (x) { e = x; if (/http 404/.test(String(x))) throw x; } } throw e; };
  const ord = async path => { let e; for (const b of ORD_R) { try { return {r: await get(b + path), site: b}; } catch (x) { e = x; } } throw e; };
  const io = {
    mpText: async p => { const x = await mp(p); return {t: await x.r.text(), site: x.site}; },
    mpJson: async p => { const x = await mp(p); return {j: await x.r.json(), site: x.site}; },
    mp2Json: async (p, not) => { const x = await mp(p, MIRRORS.filter(b => b !== not)); return {j: await x.r.json(), site: x.site}; },
    ordJson: async p => { const x = await ord(p); return {j: await x.r.json(), site: x.site}; },
    ordText: async p => { const x = await ord(p); return {t: await x.r.text(), site: x.site}; },
    kindNames: BlockManifest.KIND_NAMES,
    manifest: async h => {
      const BM = BlockManifest, hash = (await io.mpText('/api/block-height/' + h)).t.trim();
      const raw = new Uint8Array(await (await get('https://mempool.space/api/block/' + hash + '/raw', 90000)).arrayBuffer());
      const sum = BM.readSummary(await (await get('https://mempool.space/api/v1/block/' + hash + '/summary', 90000)).text());
      let tags = null; try { tags = BM.readSummary(await (await get('https://ordpool.space/api/v1/block/' + hash + '/summary', 90000)).text()); } catch (e) {}
      const scan = BM.scanBlock(raw, h);
      return BM.buildManifest({height: h, time: null, scan, rawSite: 'https://mempool.space', hash, hashSite: 'https://mempool.space', secondHash: null, secondSite: null, summary: sum, summarySite: 'https://mempool.space', tags, tagSite: 'https://ordpool.space', ordIds: null, ordSite: null, runesHtml: null});
    }
  };
  return io;
})();
