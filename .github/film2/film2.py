# Films one scene of the Agent Blockhall video on the live site, frame by frame (the page's clocks only move one frame
# at a time, so every frame is drawn in full): python film2.py SCENE OUTDIR [probe]
import asyncio, sys, os, json, time, math, re
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
SC, OUT = sys.argv[1], sys.argv[2]; PROBE = len(sys.argv) > 3 and sys.argv[3] == 'probe'
W, H = 1920, 1080
GAME = 'https://bitmap22.github.io/my-ordinal-portal/' + os.environ.get('GAME', 'block-cube.html'); HOST = 'http://127.0.0.1:8000/host.html'
DOGE = 'doge' in GAME
DOGEF = 'true' if DOGE and SC in ('forum', 'common2') else 'false'
VT = open(os.path.join(HERE, 'vt.js')).read()
HIDE = "const DOGEFORUM = " + DOGEF + "; addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '[data-agentbox]{display:none!important}' + (DOGEFORUM ? '#rl{display:none!important}' : ''); document.head.appendChild(s); });"
NAMES = ['Leo', 'Kofi', 'Ren', 'Marco', 'Sam', 'Mia', 'Zara', 'Yuki', 'Elena', 'Nia']; TONES = [0, 3, 1, 1, 0, 0, 4, 1, 1, 1]
N = {'title': 240, 'next': 240, 'help': 150, 'hall': 210, 'hold': 210, 'genesis': 240, 'ins0': 180, 'common': 300, 'common2': 300, 'forum': 420, 'gallery': 210}[SC]
if DOGE and SC == 'forum': N = 270
LOG = []
def log(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); LOG.append(s)

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': W, 'height': H}); await ctx.add_init_script(VT); await ctx.add_init_script(HIDE)
        WSOK = [True]   # (the live feed loads the page, then is held still while filming: a frame takes seconds, so live blocks would come far too fast)
        async def wshold(ws):
            server = ws.connect_to_server()
            def down(m):
                if WSOK[0]: ws.send(m)
            server.on_message(down); ws.on_message(lambda m: server.send(m))
        await ctx.route_web_socket(re.compile(r'wss?://.*'), wshold)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto(HOST + '?game=' + GAME, wait_until='domcontentloaded', timeout=180000)
        while len(pg.frames) < 2: await pg.wait_for_timeout(300)
        g = pg.frames[1]
        await g.wait_for_function('window.agent', timeout=240000); await pg.wait_for_timeout(25000)
        async def A(js, wait=0):   # real time, before filming
            r = await g.evaluate("async () => { try { return JSON.stringify(await (" + js + ")).slice(0, 500); } catch (e) { return 'ERR ' + e; } }")
            log('real', js[:70], '->', (r or '')[:300])
            if wait: await pg.wait_for_timeout(wait)
            return r
        async def roomReady(maxs=240):
            for i in range(maxs // 3):
                r = await g.evaluate("(() => { try { return !!(room && room.at && room.at.ready); } catch (e) { return false; } })()")
                if r: log('room ready after', i * 3, 's'); return True
                await pg.wait_for_timeout(3000)
            log('room NOT ready'); return False
        await A("agent.feed({on: false})")
        HT = await g.evaluate("agent.chain().then(c => c.newestBlock)")
        log('newest block', HT)
        st = {}
        if SC in ('title', 'help'):
            await A(f"agent.block({{height: {HT}}})", 20000)
        elif SC == 'next':
            await A("agent.live()", 8000); await A("agent.view({name: 'fees'})", 10000)
        elif DOGE and SC == 'hall':   # (a full hall of blocks, walked from its first block down its length)
            await A(f"agent.block({{height: {HT - 45}}})", 10000); r = await A(f"agent.walkIn({{height: {HT - 45}}})", 30000); await roomReady()
            m = re.search(r'hall of blocks ([0-9,]+) to ([0-9,]+)', r or '')
            if m:
                a0 = int(m.group(1).replace(',', '')); await A(f"agent.walkIn({{height: {a0}}})", 30000); await roomReady()
            log('at', await g.evaluate("JSON.stringify({x: room.p.x, z: room.p.z, yaw: room.p.yaw})"))
        elif SC == 'gallery':   # (a collection's own room, found by name on the tablet, as a player does)
            try: rows = json.loads(await g.evaluate("agent.search ? (async () => JSON.stringify((await agent.search({query: '" + os.environ.get('COLLECTION', 'Dogebirds') + "'})).results))() : '[]'"))
            except Exception as e: rows = []; log('search rows failed', e)
            for row in rows: log('result', row.get('n'), str(row.get('untrusted'))[:160])
            pick = [i for i, row in enumerate(rows) if 'GALLERY' in str(row.get('untrusted', '')).upper()]
            log('gallery pick', pick[:3])
            if pick:
                await A(f"agent.go({{n: {pick[0]}}})", 5000); await roomReady()
                for i in range(40):
                    gi = await g.evaluate("(() => { try { const G = room.at.gal; return G ? {name: G.name, n: G.n, loaded: G.loaded, done: G.done} : null; } catch (e) { return null; } })()")
                    if gi and gi.get('n') and gi.get('loaded', 0) >= min(gi['n'], 60): break
                    await pg.wait_for_timeout(3000)
                log('gallery', gi)
                await A("agent.clearArrow()", 1500); await pg.wait_for_timeout(15000)
            if SC == 'hold':
                for ty in (('DRC-20', 'dunes', 'text', 'inscriptions') if DOGE else ('BRC-20', 'runes', 'text', 'inscriptions')):
                    r = await A("agent.hold({type: '" + ty + "'})", 20000)
                    if r and '"ok":false' not in r and 'ERR' not in r: st['held'] = ty; break
        elif SC == 'genesis':
            await A("agent.block({height: 0})", 10000); await A("agent.walkIn({height: 0})", 30000); await roomReady()
            z = await g.evaluate("wpAt(room.at)[1]"); st['z'] = (z + 3.2, z + 1.55); log('lectern z', z)
            await g.evaluate("([z]) => { room.p.x = 0; room.p.z = z; room.p.yaw = 0; room.p.pitch = -.1; room.mx = innerWidth / 2; room.my = innerHeight * .75; }", [st['z'][0]])
        elif SC == 'ins0':
            await A("agent.block({height: 767430})", 10000); await A("agent.walkIn({height: 767430})", 30000); await roomReady()
            for i in range(40):
                if await g.evaluate("!!(room.at && room.at.ins0)"): break
                await pg.wait_for_timeout(3000)
            z = await g.evaluate("room.at.ins0.w[2]"); st['z'] = (z + 1.40, z + 1.27); log('stand z', z)
            await g.evaluate("([z]) => { room.p.x = 0; room.p.z = z; room.p.yaw = 0; room.p.pitch = -.84; room.mx = innerWidth / 2; room.my = innerHeight * .2; }", [st['z'][0]])
        elif SC in ('common', 'common2'):
            await A("agent.commonRoom()", 30000); await roomReady(); await A("agent.goTo({place: 'grand hall'})", 15000)
        elif SC == 'forum':
            await A("agent.commonRoom()", 30000); await roomReady(); await A("agent.goTo({place: 'forum steps'})", 15000)
            await pg.evaluate("send({type: 'page'})"); await pg.wait_for_timeout(1500)
            await pg.evaluate("send({type: 'ready', me: {id: 'me', name: 'bitmap22'}})"); await pg.wait_for_timeout(3000)
            me = await pg.evaluate("(() => { const s = __got.filter(m => m.type === 'state').pop(); return s ? s.s : null; })()")
            log('me', me)
            mx, md = (me or {}).get('x', 2.4), -((me or {}).get('z', -28.5))
            MATES = [('n', 9, 'macarena', mx - 1.5, md + 4.2), ('m', 3, 'chicken', mx, md + 4.8), ('y', 7, 'twist', mx + 1.5, md + 4.2)]
            DLOOK = {'n': [1, 0, 3], 'm': [2, 0, 1], 'y': [3, 0, 0]}   # (Doge Cube's runners: Spark, Relay and Cipher, each with its own skin tone)
            DWALK = {'n': (3.0, 3.3, 5.8), 'y': (3.6, 4.0, 7.0)}         # (Doge Cube has no dances: two of them walk up to you instead, metres back and from/to seconds)
            for mid, i, em, x, d in MATES:
                await pg.evaluate("m => send(m)", {'type': 'look', 'id': mid, 'look': DLOOK[mid] if DOGE else [i, 0, TONES[i]]})
            yaw = ((me or {}).get('y', 0) or 0) + math.pi
            def back(mid, t):
                if not DOGE or mid not in DWALK: return 0
                b, a, e = DWALK[mid]; k = min(1, max(0, (t - a) / (e - a))); return b * (1 - k)
            def states(t):
                return [{'type': 'state', 'id': mid, 'name': NAMES[i], 's': {'in': 1, 'h': -2, 'x': x, 'z': -(d + back(mid, t)), 'y': yaw, 'p': 0, 'hk': -1, 'lv': 0, 'sit': 0, 'em': em, 'en': 1, 'ea': round(t, 2), 'ai': 1}} for mid, i, em, x, d in MATES]
            for k in range(12):   # (their people load: real seconds)
                for m in states(k * .2): await pg.evaluate("m => send(m)", m)
                await pg.wait_for_timeout(2500)
            await A("agent.turn({pitch: -12})", 2000)
            st['states'] = states
        # ---- film: the page's clocks move one frame at a time from here
        if DOGE and SC in ('common2', 'forum'):
            async def hold(route):
                h = route.request.url.split('/')[2] if '://' in route.request.url else ''
                if route.request.resource_type in ('fetch', 'xhr') and h not in ('127.0.0.1:8000', 'bitmap22.github.io'): await route.abort()
                else: await route.continue_()
            await ctx.route('**/*', hold)
        await g.evaluate(f"__vtStart({time.time() * 1000})"); WSOK[0] = False
        async def step(n=1):
            for i in range(n): await g.evaluate("__vtStep(1000 / 30)")
        async def go(js): await g.evaluate("js => { (async () => { try { await eval(js); } catch (e) { console.error(e); } })(); }", js)
        await step(150 if SC in ('title', 'next', 'help') else 30)   # (a cube's floor and colours settle first)
        X0, Y0 = int(W * .82), int(H * .78)
        PE = "([t, x, y, b]) => { const c = document.getElementById('c'); c.dispatchEvent(new PointerEvent(t, {clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: b, button: 0, bubbles: true, cancelable: true})); }"
        if SC in ('common', 'common2', 'forum', 'hold'): fac0 = await g.evaluate("async () => (await agent.state()).room.facing")
        if SC == 'common2': fac0 -= 15   # (a gentler pan, from a little right of the big screen to a little left of it)
        shots = set(range(N)) if not PROBE else {0, N // 2, N - 1}
        tt = time.time()
        for f in range(N):
            if SC in ('title', 'next'):   # (the cube turned by one long, slow drag from a spot off the cube, let go at the end)
                x = X0 - f * 1.3
                if f == 0:
                    for t in ('pointerover', 'pointerenter'): await g.evaluate(PE, [t, X0, Y0, 0])
                    await g.evaluate(PE, ['pointerdown', X0, Y0, 1])
                elif f == N - 1:
                    for t in ('pointerup', 'pointerout', 'pointerleave'): await g.evaluate(PE, [t, x, Y0, 0])
                else: await g.evaluate(PE, ['pointermove', x, Y0, 1])
                if SC == 'next' and f == 45: await go("agent.layers({open: true})")
            elif SC == 'help':
                if f == 10: await g.evaluate("document.getElementById('ti').click()")
                if f == 80: await g.evaluate("(() => { const b = [...document.querySelectorAll('#cinf button')].find(b => /HOW TO/i.test(b.textContent)); if (b) b.click(); else { ci.tab = 'how'; ciDraw(); } })()")
                if f > 100: await g.evaluate("(() => { const d = document.querySelector('#cinf>div'); if (d) d.scrollTop += 3; })()")
            elif SC == 'hall':
                if f == 15: await go("agent.walk({direction: 'forward', seconds: 6})")
            elif SC == 'gallery':
                if f == 15: await go("agent.walk({direction: 'forward', seconds: 5.5})")
            elif SC in ('genesis', 'ins0'):
                z0, z1 = st['z']; k = f / (N - 1); k = k * k * (3 - 2 * k)
                await g.evaluate("z => { room.p.z = z; }", z0 + (z1 - z0) * k)
                if SC == 'ins0' and f == 105: await g.evaluate("otOpen()")
            elif SC in ('common', 'common2', 'forum', 'hold'):
                await go(f"agent.turn({{facing: {fac0 + {'common': 0.22, 'common2': 0.1, 'forum': 0.06, 'hold': 0.05}[SC] * (f + 1):.3f}}})")
                if 'states' in st and f % (2 if DOGE else 6) == 0:
                    for m in st['states'](3 + f / 30): await pg.evaluate("m => send(m)", m)
            await step()
            if f in shots:
                for k in range(4):
                    try: await pg.screenshot(path=f'{OUT}/f{f:04d}.jpg', type='jpeg', quality=92, timeout=180000); break
                    except Exception as e: log('screenshot retry', f, str(e)[:80])
            if f % 30 == 0: log(SC, f, round(time.time() - tt), 's')
        log('held', st.get('held')); await b.close()
    json.dump({'scene': SC, 'log': LOG, 'errs': errs[:20]}, open(f'{OUT}/log.json', 'w'), indent=0)
asyncio.run(main())
