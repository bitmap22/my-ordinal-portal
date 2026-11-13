// virtual time for filming: once __vtStart(epoch) is called, the page's clocks, frames and timers only move when __vtStep(ms) is called
(() => {
  const RD = Date, rNow = performance.now.bind(performance), rRAF = requestAnimationFrame.bind(window), rST = setTimeout.bind(window), rSI = setInterval.bind(window), rCT = clearTimeout.bind(window), rCI = clearInterval.bind(window);
  let on = false, drift = 0, V = 0, base = 0, raf = [], rafId = 5e8, timers = new Map(), tid = 1e7;
  const vt = window.__vt = {get on() { return on; }, get V() { return V; }};
  window.__vtStart = epoch => { if (on) return; V = rNow(); base = epoch - V; on = true; };
  performance.now = () => on ? V + (drift += 0.002) : rNow();   // (a hair more each time it is asked, so 'work for 6 ms' loops still end)
  class VDate extends RD { constructor(...a) { if (on && a.length === 0) super(base + V); else super(...a); } static now() { return on ? base + V : RD.now(); } }
  window.Date = VDate;
  window.requestAnimationFrame = cb => { if (!on) return rRAF(cb); const id = rafId++; raf.push([id, cb]); return id; };
  const rCAF = cancelAnimationFrame.bind(window);
  window.cancelAnimationFrame = id => { if (id >= 5e8) raf = raf.filter(r => r[0] !== id); else rCAF(id); };   // (film-time frame numbers never clash with the browser's own)
  window.setTimeout = (cb, ms, ...a) => { if (!on) return rST(cb, ms, ...a); const id = tid++; timers.set(id, {at: V + Math.max(0, +ms || 0), cb, a}); return id; };
  window.setInterval = (cb, ms, ...a) => { if (!on) return rSI(cb, ms, ...a); const id = tid++; const iv = Math.max(4, +ms || 0); timers.set(id, {at: V + iv, cb, a, iv}); return id; };
  window.clearTimeout = id => { if (timers.has(id)) timers.delete(id); else rCT(id); };
  window.clearInterval = id => { if (timers.has(id)) timers.delete(id); else rCI(id); };
  window.__vtStep = ms => {
    const end = V + ms; drift = 0;
    for (let guard = 0; guard < 10000; guard++) {   // timers due before the end of this frame, in order
      let best = null; for (const [id, t] of timers) if (t.at <= end && (!best || t.at < best[1].at)) best = [id, t];
      if (!best) break; const [id, t] = best; V = Math.max(V, t.at);
      if (t.iv) t.at += t.iv; else timers.delete(id);
      try { typeof t.cb === 'function' ? t.cb(...t.a) : 0; } catch (e) { console.error(e); }
    }
    V = end; drift = 0; const q = raf; raf = [];
    for (const [, cb] of q) { try { cb(V); } catch (e) { console.error(e); } }
    return q.length;
  };
})();
