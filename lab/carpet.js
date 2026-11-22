// (22 Nov 2026) the carpets. Each is one repeating tile, drawn once with the browser's own drawing tools into three masks (red: the
// deeper tone, green: the light tone, blue: the accent, gold or a coin's own colour); the floor's shader colours it by the block's
// fees. Mipmapped, so it stays clean near and far. Everything on them is drawn here, by this page: no borrowed pictures.
const CPT = {tex: null, one: null, pat: -1, tw: 1, th: 1, acc: [0, 0, 0], accM: 0, litM: 0};
function cptPaint(pat, N) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const x = cv.getContext('2d', {alpha: false}), T = 6.2832;
  let q = 7 + pat * 977; const rnd = () => (q = (q * 1664525 + 1013904223) >>> 0) / 4294967296;
  // ink(k, a): the shapes that follow add a of mask k; rub(k): they rub mask k out (k < 0: all three); put: set mask k to a
  const ink = (k, a) => { const v = Math.round(255 * a); x.globalCompositeOperation = 'lighter'; x.fillStyle = x.strokeStyle = 'rgb(' + (k ? 0 : v) + ',' + (k === 1 ? v : 0) + ',' + (k === 2 ? v : 0) + ')'; };
  const rub = k => { x.globalCompositeOperation = k < 0 ? 'source-over' : 'multiply'; x.fillStyle = x.strokeStyle = k < 0 ? '#000' : ['#0ff', '#f0f', '#ff0'][k]; };
  const put = (k, a, f) => { rub(k); f(); ink(k, a); f(); };
  const disc = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, T); x.fill(); };
  const ring = (cx, cy, r, w) => { x.lineWidth = w; x.beginPath(); x.arc(cx, cy, r, 0, T); x.stroke(); };
  const SIZE = [[1, 1], [.8, .6], [.9, .9], [.66, .98], [.56, .56], [.88, .88], [.8, 1.04], [.8, 1.04], [.72, .72]][pat] || [1, 1], tw = SIZE[0], th = SIZE[1];
  const metres = () => x.setTransform(N / tw, 0, 0, N / th, 0, 0);
  const wrap = f => { for (const dx of [-tw, 0, tw]) for (const dy of [-th, 0, th]) { x.save(); x.translate(dx, dy); f(); x.restore(); } };
  // the weave: flecks of deeper and lighter wool, and a faint rib across it
  const weave = k => { x.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0, n = N * N / 46 * k; i < n; i++) { const g = rnd() < .28; ink(g ? 1 : 0, g ? .02 + rnd() * .05 : .05 + rnd() * .14); x.fillRect(rnd() * N, rnd() * N, 2, 2); }
    ink(0, .05); for (let y = 0; y < N; y += 4) x.fillRect(0, y, N, 1); metres(); };
  // a small four-pointed star, and a flower of n petals
  const star = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 4; i++) { const a = i * T / 4, b = a + T / 8; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.quadraticCurveTo(cx, cy, cx + Math.cos(a + T / 4) * r, cy + Math.sin(a + T / 4) * r); } x.closePath(); x.fill(); };
  const flower = (cx, cy, r, n) => { for (let i = 0; i < n; i++) { const a = i * T / n; x.beginPath(); x.ellipse(cx + Math.cos(a) * r * .56, cy + Math.sin(a) * r * .56, r * .46, r * .24, a, 0, T); x.fill(); } };
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  const out = {c: cv, tw, th, acc: [.863, .694, .333], accM: 0, litM: 0};
  weave(1);
  if (pat === 1) {   // stripes, running the length of the hall: a broad deeper band edged in gold with a row of gold stars down it, fine light lines between
    const c0 = tw / 2, pair = (k, a, d, w) => { ink(k, a); for (const s of [-1, 1]) x.fillRect(c0 + s * d - w / 2, 0, w, th); };
    put(0, .8, () => x.fillRect(c0 - .15, 0, .3, th));
    pair(2, 1, .178, .009); pair(1, .3, .385, .012); pair(0, .42, .268, .06); pair(2, .55, .328, .005);
    ink(2, 1); for (let i = 0; i < 3; i++) star(c0, th * (i + .5) / 3, .028);
    ink(2, .9); for (let i = 0; i <= 3; i++) for (const s of [-1, 1]) disc(c0 + s * .09, th * i / 3, .0065);
  } else if (pat === 2) {   // checks: a tartan of its own, the same sett both ways (each band is laid at half strength, so where two cross the colour is whole)
    const band = (k, a, c, w) => { ink(k, a); for (const d of [-tw, 0, tw]) { x.fillRect(c + d - w / 2, 0, w, th); x.fillRect(0, c + d - w / 2, tw, w); } };
    band(0, .5, 0, .26); band(0, .5, .2, .034); band(0, .5, -.2, .034);   // the broad deeper band and its two guards
    band(0, .3, tw / 2 - .07, .016); band(0, .3, tw / 2 + .07, .016);
    band(1, .2, tw / 2, .016); band(2, .42, 0, .011); band(2, .26, .2, .006); band(2, .26, -.2, .006);   // a light line through each square, gold through each band
    x.lineWidth = .0026; ink(0, .1); for (let d = -th; d < tw; d += .0095) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + th, th); x.stroke(); }   // the twill
  } else if (pat === 3) {   // diamonds: a gold trellis, a rosette where its lines meet, every other diamond deeper, a small flower in each
    const dia = () => { x.beginPath(); x.moveTo(tw / 2, 0); x.lineTo(tw, th / 2); x.lineTo(tw / 2, th); x.lineTo(0, th / 2); x.closePath(); };
    ink(0, .4); dia(); x.fill();
    x.lineJoin = 'miter'; ink(2, .5); x.lineWidth = .026; dia(); x.stroke(); ink(2, .5); x.lineWidth = .008; dia(); x.stroke();
    wrap(() => { for (const [px, py] of [[tw / 2, 0], [0, th / 2]]) { put(2, 1, () => disc(px, py, .04)); put(0, .9, () => disc(px, py, .017)); rub(2); disc(px, py, .017); ink(1, .9); ring(px, py, .0285, .004); }
      for (const [px, py] of [[tw / 2, th / 2], [0, 0]]) { ink(1, .78); flower(px, py, .062, 4); x.save(); x.translate(px, py); x.rotate(T / 8); ink(1, .4); flower(0, 0, .045, 4); x.restore(); put(2, 1, () => disc(px, py, .013)); } });
  } else if (pat === 4) {   // herringbone: slanting bands that turn at every column and step half a band as they turn, a light thread along each
    const w = tw / 2, P = th / 4, t = P / 2, off = P / 2;
    for (let k = -8; k < 10; k++) { const y = k * P;
      ink(0, .56); x.beginPath(); x.moveTo(0, y); x.lineTo(w, y + w); x.lineTo(w, y + w + t); x.lineTo(0, y + t); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(w, y + off); x.lineTo(2 * w, y + off - w); x.lineTo(2 * w, y + off - w + t); x.lineTo(w, y + off + t); x.closePath(); x.fill();
      ink(1, .3); x.beginPath(); x.moveTo(0, y + t); x.lineTo(w, y + w + t); x.lineTo(w, y + w + t + .007); x.lineTo(0, y + t + .007); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(w, y + off + t); x.lineTo(2 * w, y + off - w + t); x.lineTo(2 * w, y + off - w + t + .007); x.lineTo(w, y + off + t + .007); x.closePath(); x.fill(); }
    ink(0, .45); for (const c of [0, w, 2 * w]) x.fillRect(c - .004, 0, .008, th);   // the spine between two columns
  } else if (pat === 5) {   // waves (the old sea-wave pattern of fans in rows, each row laid over the one behind): arcs a tone lighter, a fine gold edge
    const R = tw / 4;
    for (let j = -3; j <= th / (R / 2) + 3; j++) for (let i = -1; i <= tw / (2 * R) + 1; i++) { const cx = i * 2 * R + (j & 1 ? R : 0), cy = j * R / 2 + R;
      rub(-1); disc(cx, cy, R);
      const g = x.createRadialGradient(cx, cy, R * .55, cx, cy, R); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, 'rgba(255,0,0,.62)'); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; disc(cx, cy, R);   // deeper towards its rim
      ink(2, .95); ring(cx, cy, R - .006, .0085);
      ink(1, .4); for (const f of [.74, .5, .26]) ring(cx, cy, R * f, R * .085); ink(1, .5); disc(cx, cy, R * .075); }
    weave(.6);
  } else if (pat === 6 || pat === 7) {   // coins: Bitcoin's orange, or Dogecoin's gold, each with its own sign, in a trellis of ogee curves; a small flower where the curves meet
    out.acc = pat === 6 ? [.969, .576, .102] : [.761, .651, .2]; out.accM = 1; out.litM = 1;
    const k = th * .29, og = () => { x.beginPath(); x.moveTo(tw / 2, 0); x.bezierCurveTo(tw / 2, k, tw, th / 2 - k, tw, th / 2); x.bezierCurveTo(tw, th / 2 + k, tw / 2, th - k, tw / 2, th); x.bezierCurveTo(tw / 2, th - k, 0, th / 2 + k, 0, th / 2); x.bezierCurveTo(0, th / 2 - k, tw / 2, k, tw / 2, 0); x.closePath(); };
    const r = .15, cell = () => {
      x.save(); x.translate(tw / 2, th / 2); x.scale(.8, .8); x.translate(-tw / 2, -th / 2); ink(0, .34); og(); x.fill(); x.restore();   // the deeper ground inside each ogee
      const cx = tw / 2, cy = th / 2, g = x.createRadialGradient(cx + .012, cy + .018, r * .9, cx + .012, cy + .018, r * 1.36); g.addColorStop(0, 'rgba(255,0,0,.8)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      x.globalCompositeOperation = 'lighter'; x.fillStyle = g; disc(cx + .012, cy + .018, r * 1.36);   // the coin's soft shadow in the pile
      rub(-1); disc(cx, cy, r); ink(1, 1); disc(cx, cy, r);   // its light rim
      rub(1); disc(cx, cy, r - .012); ink(2, 1); disc(cx, cy, r - .012);   // its face, in the coin's own colour
      rub(2); ring(cx, cy, r - .031, .0045); ink(0, .85); ring(cx, cy, r - .031, .0045);   // a fine groove
      x.save(); x.translate(cx, cy); if (pat === 6) x.rotate(.2422); x.scale(.0019, .0019); x.font = 'bold 100px Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      const ch = pat === 6 ? 'B' : 'Ð', m = x.measureText(ch), l = m.actualBoundingBoxLeft || 0, w = l + (m.actualBoundingBoxRight || m.width), a = m.actualBoundingBoxAscent || 72, d = m.actualBoundingBoxDescent || 0, h = a + d;
      ink(1, 1); x.fillText(ch, l - w / 2, a - h / 2);
      if (pat === 6) for (const f of [.3, .56]) { x.fillRect(-w / 2 + f * w - w * .055, -h / 2 - h * .16, w * .11, h * .17); x.fillRect(-w / 2 + f * w - w * .055, h / 2 - h * .01, w * .11, h * .17); }   // the Bitcoin sign's two bars, above and below
      x.restore();
      for (const s of [-1, 1]) { ink(1, .9); star(cx, cy + s * (r + .115), .024); ink(1, .55); disc(cx, cy + s * (r + .062), .0055); disc(cx, cy + s * (r + .168), .0045); } };
    wrap(() => { cell(); x.save(); x.translate(-tw / 2, -th / 2); cell(); x.restore(); });
    x.lineJoin = 'round'; ink(0, .5); x.lineWidth = .032; og(); x.stroke(); put(1, .92, () => { x.lineWidth = .0075; og(); x.stroke(); });
    wrap(() => { for (const [px, py] of [[tw / 2, 0], [0, th / 2]]) { rub(-1); disc(px, py, .042); ink(0, .5); disc(px, py, .042); ink(1, .95); flower(px, py, .036, 4); put(2, 1, () => disc(px, py, .0105)); rub(1); disc(px, py, .0105); } });
  } else if (pat === 8) {   // paw prints: tracks walking the length of the hall, left then right; a gold dot between
    const paw = (cx, cy, a, s) => { x.save(); x.translate(cx, cy); x.rotate(a); x.scale(s, s);
      const shape = () => { x.beginPath(); x.moveTo(0, -.06); x.bezierCurveTo(.33, -.09, .42, .36, .17, .42); x.bezierCurveTo(.06, .46, -.06, .46, -.17, .42); x.bezierCurveTo(-.42, .36, -.33, -.09, 0, -.06); x.fill();
        for (const [ex, ey, rx, ry, ea] of [[-.37, -.12, .098, .135, -.4], [-.14, -.34, .105, .142, -.13], [.14, -.34, .105, .142, .13], [.37, -.12, .098, .135, .4]]) { x.beginPath(); x.ellipse(ex, ey, rx, ry, ea, 0, T); x.fill(); } };
      x.save(); x.translate(.035, .05); ink(0, .6); shape(); x.restore(); rub(0); shape(); ink(1, .93); shape(); x.restore(); };
    wrap(() => { paw(tw / 2 - .14, th * .25, -.2, .2); paw(tw / 2 + .14, th * .75, .2, .2);
      for (const py of [0, th / 2]) put(2, 1, () => disc(0, py, .011)); });
  }
  return out;
}
// the carpet's tile on the floor's shader (made again only when another pattern is picked; with the moving floor it is a blank)
function cptBind() {
  gl.activeTexture(gl.TEXTURE9);
  if (!SET.calm) {
    if (!CPT.one) { CPT.one = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, CPT.one); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }
    gl.bindTexture(gl.TEXTURE_2D, CPT.one);
  } else {
    if (CPT.pat !== SET.pat || !CPT.tex) {
      const P = cptPaint(SET.pat, matchMedia('(pointer: coarse)').matches ? 512 : 1024), fy = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), pm = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
      if (!CPT.tex) CPT.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, CPT.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, P.c); gl.generateMipmap(gl.TEXTURE_2D);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, fy); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pm);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1));
      Object.assign(CPT, {pat: SET.pat, tw: P.tw, th: P.th, acc: P.acc, accM: P.accM, litM: P.litM});
    }
    gl.bindTexture(gl.TEXTURE_2D, CPT.tex);
  }
  gl.uniform2f(mtP.u.uTile, CPT.tw, CPT.th); gl.uniform3fv(mtP.u.uAccC, CPT.acc); gl.uniform1f(mtP.u.uAccM, CPT.accM); gl.uniform1f(mtP.u.uLitM, CPT.litM);
  gl.uniform1i(mtP.u.uCpt, 9); gl.activeTexture(gl.TEXTURE0);
}
