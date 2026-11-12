# Films one scene of the demo video, frame by frame (the page's clocks only move one frame at a time), with the real
# data recorded earlier: python film.py SCENE OUTDIR [W H FRAMES_LIMIT]
import asyncio, sys, os, json, time, math, re, subprocess
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
SC, OUT = sys.argv[1], sys.argv[2]; W = int(sys.argv[3]) if len(sys.argv) > 3 else 1920; H = int(sys.argv[4]) if len(sys.argv) > 4 else 1080
LIMIT = int(sys.argv[5]) if len(sys.argv) > 5 else 0
GAME = os.environ.get('GAME', 'https://bitmap22.github.io/my-ordinal-portal/block-cube.html'); HOST = os.environ.get('HOST', 'http://127.0.0.1:8000/host.html')
DATA = os.environ.get('DATA', os.path.join(HERE, '..', '..', 'demo-out'))
FAKE = os.environ.get('FAKE')   # (local tests only: made-up blocks)
VT = open(os.path.join(HERE, 'vt.js')).read()
D = json.load(open(os.path.join(DATA, 'index.json'))) if not FAKE else {'t0': time.time(), 'idx': {}}
IDX = D['idx']; NOQ = {}
for u, e in IDX.items(): NOQ.setdefault(u.split('?')[0], e)
miss = {}
async def route(rt):
    u = rt.request.url
    if u.startswith('data:') or u.startswith('blob:') or re.match(r'https?://(127\.0\.0\.1|localhost)', u) or u.startswith('https://bitmap22.github.io/'): return await rt.continue_()
    if FAKE:
        sys.path.insert(0, '/tmp/st/fx'); from run import route as fr; return await fr(rt)
    e = IDX.get(u) or NOQ.get(u.split('?')[0])
    if e: return await rt.fulfill(status=e['s'], body=open(os.path.join(DATA, 'c', e['f']), 'rb').read(), headers={'content-type': e['ct'], 'access-control-allow-origin': '*'})
    miss[u] = miss.get(u, 0) + 1; return await rt.abort()
NAMES = ['Leo', 'Kofi', 'Ren', 'Marco', 'Sam', 'Mia', 'Zara', 'Yuki', 'Elena', 'Nia']; TONES = [0, 3, 1, 1, 0, 0, 4, 1, 1, 1]

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get('CHROME'); kw = {'executable_path': exe} if exe else {}
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'], **kw)
        ctx = await b.new_context(viewport={'width': W, 'height': H}); await ctx.route('**/*', route); await ctx.add_init_script(VT)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto(HOST + '?game=' + GAME, wait_until='domcontentloaded', timeout=180000)
        while len(pg.frames) < 2: await pg.wait_for_timeout(300)
        g = pg.frames[1]
        await g.wait_for_function('window.agent', timeout=180000); await pg.wait_for_timeout(20000)
        A = lambda js: g.evaluate("async () => { try { return JSON.stringify(await (" + js + ")).slice(0, 400); } catch (e) { return 'ERR ' + e; } }")
        OFF = {'cube': 20e3, 'layers': 40e3, 'hall': 70e3, 'hold': 100e3, 'hall2': 70e3, 'hold2': 100e3, 'common': 140e3, 'crew': 170e3}
        await g.evaluate(f"__vtStart({D['t0'] * 1000 + OFF.get(SC, 0)})")
        tstep = [0, time.time()]
        async def step(n=1):
            for i in range(n):
                await g.evaluate("__vtStep(1000 / 30)"); tstep[0] += 1
                if tstep[0] % 60 == 0: print('    film-time frame', tstep[0], round((time.time() - tstep[1]) / 60, 2), 's/frame', flush=True); tstep[1] = time.time()
        async def run(js, maxf=900):   # start something and let film time run until it is done (nothing is filmed)
            await g.evaluate("js => { window.__r = undefined; (async () => { try { window.__r = JSON.stringify(await eval(js)).slice(0, 600); } catch (e) { window.__r = 'ERR ' + e; } })(); }", js)
            for i in range(maxf):
                await step(); r = await g.evaluate("window.__r")
                if r is not None: print('  ', js[:60], '->', r[:300], f'({i} frames)', flush=True); return r
            print('  ', js[:60], 'still going after', maxf, flush=True); return None
        async def ready(maxf=1800):
            for i in range(maxf):
                await step(); r = await g.evaluate("(() => { const s = agent.state(); return !!(s.room && s.room.ready); })()")
                if r: print('   ready after', i, flush=True); return True
            print('   NOT ready', flush=True); return False
        BH = D.get('h') or (int(open(os.path.join(HERE, 'h.txt')).read()) if os.path.exists(os.path.join(HERE, 'h.txt')) else None)   # (the block with pictures, from the recording)
        await run("agent.feed({on: false})")
        st = {}
        if SC == 'cube': N = 240; act = lambda f: "agent.turnCube({right: .35})"
        elif SC == 'layers':
            await run("agent.view({name: 'fees'})"); await step(60); N = 240
            act = lambda f: "agent.layers({open: true})" if f == 45 else "agent.turnCube({right: .3})"
        elif SC in ('hall', 'hold', 'hall2', 'hold2'):
            if BH: await run(f"agent.block({{height: {BH}}})"); await step(60)
            await run(f"agent.walkIn({{height: {BH}}})" if BH else "agent.walkIn()"); await ready(); await step(150)
            if SC in ('hall', 'hall2'): N = 240; act = lambda f: "agent.walk({direction: 'forward', seconds: 7})" if f == 15 else None
            elif SC == 'hold': N = 300; act = lambda f: "agent.hold({type: 'images'})" if f == 10 else None
            else:   # (picked up before filming: the card in your hands, then seen big)
                for ty in ('images', 'inscriptions', 'text', None):
                    r = await run("agent.hold(" + ("{type: '" + ty + "'}" if ty else "{}") + ")", 1800)
                    if r and '"ok":false' not in r and 'ERR' not in r: break
                await step(90); N = 300
                act = lambda f: "agent.viewBig()" if f == 120 else None
        elif SC in ('common', 'crew'):
            await run("agent.commonRoom()"); await ready(); await step(150)
            if SC == 'common':
                await run("agent.goTo({place: 'grand hall'})"); await step(30); N = 240
                act = lambda f: "agent.turn({facing: (agent.state().room || {}).facing + .25})"
            else:
                await run("agent.goTo({place: 'forum steps'})"); await step(30)
                await pg.evaluate("send({type: 'page'})"); await step(10)
                await pg.evaluate("send({type: 'ready', me: {id: 'me'}})"); await step(30)
                me = await pg.evaluate("(() => { const s = __got.filter(m => m.type === 'state').pop(); return s ? s.s : null; })()")
                print('me', me, flush=True); N = 360
                MATES = [('n', 9, 'macarena', -1.7, 34.0), ('m', 3, 'chicken', 0.0, 34.6), ('y', 7, 'twist', 1.7, 34.0)]
                for mid, i, em, x, d in MATES: await pg.evaluate("m => send(m)", {'type': 'look', 'id': mid, 'look': [i, 0, TONES[i]]})
                yaw = ((me or {}).get('y', 0) or 0) + math.pi
                def states(t):
                    return [{'type': 'state', 'id': mid, 'name': NAMES[i], 's': {'in': 1, 'h': -2, 'x': x, 'z': -d, 'y': yaw, 'p': 0, 'hk': -1, 'lv': 0, 'sit': 0, 'em': em, 'en': 1, 'ea': round(t, 2), 'ai': 1}} for mid, i, em, x, d in MATES]
                for k in range(0, 450, 6):   # (their people load while time runs)
                    for m in states(k / 30): await pg.evaluate("m => send(m)", m)
                    await step(6)
                st['states'] = lambda t: states(15 + t); act = lambda f: None
        else: raise SystemExit('no scene ' + SC)
        tt = time.time()
        if LIMIT: N = min(N, LIMIT)
        for f in range(N):
            js = act(f)
            if js: await g.evaluate("js => { (async () => { try { await eval(js); } catch (e) { console.error(e); } })(); }", js)
            if 'states' in st and f % 6 == 0:
                for m in st['states'](f / 30): await pg.evaluate("m => send(m)", m)
            await g.evaluate("__vtStep(1000 / 30)")
            await pg.screenshot(path=f'{OUT}/f{f:04d}.jpg', type='jpeg', quality=92)
            if f % 30 == 0: print(SC, f, round(time.time() - tt), 's', flush=True)
        await b.close()
    json.dump({'miss': miss, 'errs': errs}, open(f'{OUT}/log.json', 'w'), indent=0)
    print('missing', len(miss), list(miss)[:10], errs[:5], flush=True)
asyncio.run(main())
