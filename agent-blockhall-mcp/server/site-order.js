/* The Truth League's order, by bitmap22. Always free. Part of Agent Blockhall: https://bitmap22.github.io/my-ordinal-portal/block-cube.html
   For the portal's tools and both halls: ask the data sites that tell the truth and keep up first. A site with a wrong answer in
   the Truth League's last 7 days (an answer that differs from a block proved from its own bytes), or 2 or more blocks behind, or
   with a file copy that did not match, at Source Health's last hourly check, is asked last. No site is ever dropped: it is only
   moved to the end of the list, and every tool still falls back to it. ord's own site (ordinals.com) stays first in its list,
   because its "there is none" is the one the tools trust. Until the order is read (or if it can't be), every list stays as it is.
   It reads two small files from the portal's own repository: the Truth League's order.json (truth-league branch) and Source
   Health's latest.json (source-health branch, used only if it is less than 3 hours old), at most once every 30 minutes (a
   browser keeps a copy for that long).
   The same file is for the portal's pages and the free Agent Blockhall MCP tool. No other packages.
   © 2026 bitmap22. All rights reserved. Free to use under the Agent Blockhall MCP tool's licence (LICENCE, in this folder's parent). */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.SiteOrder = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const URLS = {
    league: ['https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/truth-league/order.json', 'https://cdn.jsdelivr.net/gh/bitmap22/my-ordinal-portal@truth-league/order.json'],
    health: ['https://raw.githubusercontent.com/bitmap22/my-ordinal-portal/source-health/latest.json', 'https://cdn.jsdelivr.net/gh/bitmap22/my-ordinal-portal@source-health/latest.json']
  };
  const KEEP_MS = 30 * 60000, KEY = 'portal-site-order';
  let state = {at: 0, last: new Map(), from: null}, loading = null;
  // a copy this browser kept in the last 30 minutes, so a page has the order at once
  try { const c = typeof localStorage !== 'undefined' && JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.at < KEEP_MS) state = {at: c.at, last: new Map(c.last), from: c.from}; } catch (e) {}
  async function get(list) {
    for (const u of list) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
        const r = await fetch(u + (u.includes('raw.githubusercontent') ? '?t=' + Math.floor(Date.now() / 600000) : ''), {signal: ctl.signal}); clearTimeout(t);
        if (r.ok) return await r.json();
      } catch (e) {}
    }
    return null;
  }
  // read the order again (if the copy is 30 minutes old or more, or when asked)
  function load(force) {
    if (loading) return loading;
    if (!force && state.at && Date.now() - state.at < KEEP_MS) return Promise.resolve(now());
    loading = (async () => {
      try {
        const [o, h] = await Promise.all([get(URLS.league), get(URLS.health)]), last = new Map(), add = (s, why) => last.set(s, (last.has(s) ? last.get(s) + '; ' : '') + why);
        if (o && Array.isArray(o.wrong)) for (const w of o.wrong) add(w.site, 'a wrong answer in the Truth League’s last 7 days (' + w.wrong + ' of ' + w.answered + ')');
        if (h && Array.isArray(h.results) && Date.now() - Date.parse(h.at) < 3 * 3600000) for (const r of h.results) {   // (an hourly check more than 3 hours old is not used)
          if (r.behind >= 2) add(r.site, r.behind + ' blocks behind at Source Health’s last hourly check (' + h.at + ')');
          else if (r.sameAs && r.sameAs.same === false) add(r.site, 'its file copy did not match at Source Health’s last hourly check (' + h.at + ')');
        }
        if (o || h) {
          state = {at: Date.now(), last, from: {league: o ? o.made : null, health: h ? h.at : null}};
          try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify({at: state.at, last: [...last], from: state.from})); } catch (e) {}
        }
      } catch (e) {}
      loading = null; return now();
    })();
    return loading;
  }
  const host = u => String(u || '').replace(/^\w+:\/\//, '').replace(/[:/?#].*$/, '');
  const stale = () => { if (!state.at || Date.now() - state.at >= KEEP_MS) load(); };
  const last = u => state.last.has(host(u));
  // a list of site addresses, in the order to ask them (keepFirst: the first stays first)
  function list(l, keepFirst) { stale(); if (!state.last.size || !Array.isArray(l)) return l; const head = keepFirst ? l.slice(0, 1) : [], rest = keepFirst ? l.slice(1) : l; return head.concat(rest.filter(u => !last(u)), rest.filter(u => last(u))); }
  // the same, for a list of things that each have an address (key gives it)
  function by(l, key) { stale(); if (!state.last.size || !Array.isArray(l)) return l; return l.filter(x => !last(key(x))).concat(l.filter(x => last(key(x)))); }
  // the same, for a list of places (indexes) in a list of addresses
  function idx(L, order) { stale(); if (!state.last.size || !Array.isArray(order)) return order; return order.filter(i => !last(L[i])).concat(order.filter(i => last(L[i]))); }
  // what the order is now: which sites are asked last, and why
  function now() { return {readAt: state.at ? new Date(state.at).toISOString() : null, from: state.from, askedLast: [...state.last].map(([site, why]) => ({site, why}))}; }
  load();
  return {VERSION, URLS, list, by, idx, load, now};
});
