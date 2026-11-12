# Temporary: plays the demo video's shots on the live Agent Blockhall and saves every reply from outside sites
# (mempool.space, ordpool.space, ordinals.com...), so the video can be filmed later with the same real data.
import asyncio, json, os, hashlib, time
from playwright.async_api import async_playwright
OUT = 'demo-out'; os.makedirs(OUT + '/c', exist_ok=True)
idx = {}; log = []
SITE = 'https://bitmap22.github.io/my-ordinal-portal/'
STEPS = json.load(open('.github/demo/steps.json'))
def key(u): return hashlib.sha1(u.encode()).hexdigest()[:24]
async def route(rt):
    u = rt.request.url
    if u.startswith('https://bitmap22.github.io/') or u.startswith('data:') or u.startswith('blob:'): return await rt.continue_()
    try:
        r = await rt.fetch(timeout=30000); b = await r.body()
        if u not in idx:
            f = key(u); open(OUT + '/c/' + f, 'wb').write(b)
            idx[u] = {'f': f, 's': r.status, 'ct': r.headers.get('content-type', 'application/octet-stream'), 't': time.time()}
        await rt.fulfill(response=r, body=b)
    except Exception as e:
        log.append(['fail', u, str(e)[:120]]); await rt.abort()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1920, 'height': 1080}); await ctx.route('**/*', route)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: log.append(['pageerror', str(e)[:200]]))
        t0 = time.time(); await pg.goto(SITE + 'block-cube.html', wait_until='domcontentloaded', timeout=120000)
        await pg.wait_for_function('window.agent', timeout=120000); await pg.wait_for_timeout(25000)
        for js, w, name in STEPS:
            try: r = await pg.evaluate("async () => { try { return JSON.stringify(await (" + js + ")).slice(0, 2000); } catch (e) { return 'ERR ' + e; } }")
            except Exception as e: r = 'EVAL ' + str(e)[:200]
            log.append(['step', name, js, r]); await pg.wait_for_timeout(w)
            if name: await pg.screenshot(path=f'{OUT}/shot_{name}.jpg', type='jpeg', quality=70)
        await b.close()
    json.dump({'t0': t0, 'idx': idx, 'log': log}, open(OUT + '/index.json', 'w'), indent=0)
    print(len(idx), 'replies saved')
asyncio.run(main())
