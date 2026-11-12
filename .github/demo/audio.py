# Records the game's own sounds in real time (as a player hears them): the next block's ticks, then the common room.
import asyncio, os, sys, json, base64, struct, wave
from playwright.async_api import async_playwright
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
TAP = """(() => {
  const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
  const conn = AudioNode.prototype.connect;
  window.__pcm = []; window.__taps = new WeakMap();
  function tapOf(ctx) {
    let t = __taps.get(ctx); if (t) return t;
    const g = ctx.createGain(), sp = ctx.createScriptProcessor(4096, 2, 2);
    sp.onaudioprocess = e => { const L = e.inputBuffer.getChannelData(0), R = e.inputBuffer.getChannelData(1), o = new Int16Array(L.length * 2);
      for (let i = 0; i < L.length; i++) { o[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; o[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; } __pcm.push(o); };
    conn.call(g, sp); conn.call(sp, ctx.destination); t = {g, sr: ctx.sampleRate}; __taps.set(ctx, t); window.__sr = ctx.sampleRate; return t;
  }
  AudioNode.prototype.connect = function (dest, ...a) { const r = conn.call(this, dest, ...a); try { if (dest === this.context.destination && !(this instanceof ScriptProcessorNode)) conn.call(this, tapOf(this.context).g); } catch (e) {} return r; };
})();"""
async def drain(g, path):
    chunks = []
    while True:
        b64 = await g.evaluate("(() => { const q = __pcm.splice(0, 40); if (!q.length) return ''; let n = 0; q.forEach(a => n += a.length); const all = new Int16Array(n); let k = 0; q.forEach(a => { all.set(a, k); k += a.length; }); const u = new Uint8Array(all.buffer); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); })()")
        if not b64: break
        chunks.append(base64.b64decode(b64))
    sr = await g.evaluate("window.__sr || 48000")
    w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(int(sr)); w.writeframes(b''.join(chunks)); w.close()
    print(path, sum(len(c) for c in chunks) / 4 / sr, 's', flush=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 960, 'height': 540}); await ctx.add_init_script(TAP)
        pg = await ctx.new_page()
        await pg.goto('https://bitmap22.github.io/my-ordinal-portal/block-cube.html', wait_until='domcontentloaded', timeout=180000)
        await pg.wait_for_function('window.agent', timeout=180000); await pg.wait_for_timeout(25000)
        print(await pg.evaluate("JSON.stringify(agent.sound())"), flush=True)
        await pg.evaluate("__pcm.length = 0"); await pg.wait_for_timeout(30000); await drain(pg, f'{OUT}/cube.wav')
        print(await pg.evaluate("agent.commonRoom().then(r => JSON.stringify(r))"), flush=True)
        await pg.wait_for_timeout(30000); await pg.evaluate("__pcm.length = 0")
        for k in range(6): await pg.wait_for_timeout(10000)
        await drain(pg, f'{OUT}/common.wav')
        await b.close()
asyncio.run(main())
