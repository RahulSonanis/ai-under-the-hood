/* Chapter 13 · Learning. A real neural network trains live in the browser.
   Network: 1 input → H tanh neurons → H tanh neurons → 1 output, mean-squared error on 40 dots,
   hand-written backpropagation and the Adam optimiser (β1 0.9, β2 0.999). Every step uses all 40 dots.
   Loss landscape: a real slice of the network's weight space, the flat plane through three points of the run
   (the start, the halfway point and now); the colours are the loss computed at each point of that plane. */
chapter("learning", () => {
  const N = 40, SPS = 40; // training steps per simulated second (time is sped up)
  const PATTERNS = {
    wave: x => Math.sin(3 * x) * 0.8,
    steps: x => (x < -0.35 ? -0.6 : x < 0.35 ? 0.15 : 0.7),
    bumps: x => Math.exp(-((x - 0.5) ** 2) * 14) - 0.8 * Math.exp(-((x + 0.5) ** 2) * 12)
  };
  const NOISE = 0.2;

  // ---------- the network, as one flat list of weights ----------
  const layout = H => { const o = {}; let i = 0; o.W1 = i; i += H; o.b1 = i; i += H; o.W2 = i; i += H * H; o.b2 = i; i += H; o.W3 = i; i += H; o.b3 = i; i += 1; o.n = i; return o; };
  function initWeights(H, r) {
    const o = layout(H), th = new Float64Array(o.n);
    for (let j = 0; j < H; j++) { th[o.W1 + j] = gauss(r) * 1.6; th[o.b1 + j] = gauss(r) * 0.6; th[o.b2 + j] = gauss(r) * 0.2; th[o.W3 + j] = gauss(r) / Math.sqrt(H); }
    for (let k = 0; k < H * H; k++) th[o.W2 + k] = gauss(r) / Math.sqrt(H);
    return th;
  }
  function predict(th, H, x, h1, h2) {
    const o = layout(H);
    for (let j = 0; j < H; j++) h1[j] = Math.tanh(th[o.W1 + j] * x + th[o.b1 + j]);
    let y = th[o.b3];
    for (let k = 0; k < H; k++) { let z = th[o.b2 + k]; for (let j = 0; j < H; j++) z += th[o.W2 + k * H + j] * h1[j]; h2[k] = Math.tanh(z); y += th[o.W3 + k] * h2[k]; }
    return y;
  }
  function lossAt(th, H, data) { const h1 = new Float64Array(H), h2 = new Float64Array(H); let L = 0; for (const [x, t] of data) { const e = predict(th, H, x, h1, h2) - t; L += e * e; } return L / data.length; }
  // forward + backward over all dots: returns the loss and fills g with dL/dθ (backpropagation, chain rule by hand)
  function gradient(th, H, data, g, act) {
    const o = layout(H), h1 = new Float64Array(H), h2 = new Float64Array(H), d2 = new Float64Array(H), d1 = new Float64Array(H);
    g.fill(0); act.fill(0); let L = 0;
    for (const [x, t] of data) {
      const y = predict(th, H, x, h1, h2), e = y - t; L += e * e;
      const dy = 2 * e / data.length;
      g[o.b3] += dy;
      for (let k = 0; k < H; k++) { g[o.W3 + k] += dy * h2[k]; d2[k] = dy * th[o.W3 + k] * (1 - h2[k] * h2[k]); g[o.b2 + k] += d2[k]; act[H + k] += Math.abs(h2[k]) / data.length; }
      for (let j = 0; j < H; j++) { let s = 0; for (let k = 0; k < H; k++) { g[o.W2 + k * H + j] += d2[k] * h1[j]; s += d2[k] * th[o.W2 + k * H + j]; } d1[j] = s * (1 - h1[j] * h1[j]); g[o.W1 + j] += d1[j] * x; g[o.b1 + j] += d1[j]; act[j] += Math.abs(h1[j]) / data.length; }
    }
    return L / data.length;
  }
  const norm = (g, a, b) => { let s = 0; for (let i = a; i < b; i++) s += g[i] * g[i]; return Math.sqrt(s); };

  // ---------- state ----------
  function makeData(s) {
    const r = rng(17), f = PATTERNS[s.pattern];
    s.data = Array.from({ length: N }, (_, i) => { const x = -1 + 2 * i / (N - 1), n = gauss(r); return [x, f(x) + (s.noise ? NOISE * n : 0.02 * n)]; });
    // the loss the true pattern itself would score on these dots: nothing can do better without memorising the noise
    s.floor = s.data.reduce((a, [x, t]) => a + (f(x) - t) ** 2, 0) / N;
  }
  function restart(s) {
    makeData(s); const H = s.H;
    s.th = initWeights(H, rng(s.seed)); s.th0 = Float64Array.from(s.th); s.m = new Float64Array(s.th.length); s.v = new Float64Array(s.th.length);
    s.g = new Float64Array(s.th.length); s.act = new Float64Array(2 * H); s.stepN = 0; s.acc = 0;
    s.loss = lossAt(s.th, H, s.data); s.best = s.loss; s.loss0 = s.loss; s.losses = [[0, s.loss]]; s.hist = [Float64Array.from(s.th)];
    s.reached = 0; s.blownAt = 0; s.blown = false; s.lastStep = new Float64Array(s.th.length); s.land = null; s.landT = -9; s.gn = [0, 0, 0];
    s.restartT = s.t;
  }
  function trainStep(s) {
    const H = s.H, o = layout(H), lr = s.lr, b1 = 0.9, b2 = 0.999;
    s.loss = gradient(s.th, H, s.data, s.g, s.act); s.stepN++;
    s.gn = [norm(s.g, o.W1, o.W2), norm(s.g, o.W2, o.W3), norm(s.g, o.W3, o.n)];
    const t = s.stepN;
    for (let i = 0; i < s.th.length; i++) {
      const gi = s.g[i]; s.m[i] = b1 * s.m[i] + (1 - b1) * gi; s.v[i] = b2 * s.v[i] + (1 - b2) * gi * gi;
      const d = lr * (s.m[i] / (1 - b1 ** t)) / (Math.sqrt(s.v[i] / (1 - b2 ** t)) + 1e-8);
      s.lastStep[i] = -d; s.th[i] -= d;
    }
    if (!isFinite(s.loss)) s.loss = 99;
    if (s.loss < s.best) s.best = s.loss;
    if (!s.reached && s.loss < 0.02 && !s.blown) s.reached = t;
    if (!s.blown && t > 20 && s.loss > Math.max(0.15, 5 * s.best) && s.best < s.loss0 * 0.7) { s.blown = true; s.blownAt = s.t; s.blownFrom = s.best; }
    if (s.blown && s.loss < s.best * 1.5 && s.t - s.blownAt > 3) s.blown = false;
    s.losses.push([t, s.loss]); if (s.losses.length > 1600) s.losses = s.losses.filter((_, i) => i % 2 === 0 || i > s.losses.length - 50);
    if (t % 5 === 0) { s.hist.push(Float64Array.from(s.th)); if (s.hist.length > 400) s.hist = s.hist.filter((_, i) => i % 2 === 0 || i === s.hist.length - 1); }
  }
  function init(rand) { const s = { t: 0, rand, H: 8, pattern: "wave", noise: false, lr: 0.001, seed: 11, sel: { layer: 2, j: 0 } }; restart(s); return s; }
  function step(s, dt) {
    s.t += dt; s.acc += dt * SPS;
    while (s.acc >= 1) { s.acc -= 1; trainStep(s); }
    if (s.stepN > 10 && s.t - s.landT > 1.1) buildLand(s);
  }

  // ---------- loss landscape: the plane through start, halfway and now ----------
  const GRID = 30;
  function buildLand(s) {
    s.landT = s.t; const H = s.H, n = s.th.length, th0 = s.th0, mid = s.hist[Math.floor(s.hist.length / 2)], now = s.th;
    const d1 = new Float64Array(n), d2 = new Float64Array(n);
    for (let i = 0; i < n; i++) { d1[i] = now[i] - th0[i]; d2[i] = mid[i] - th0[i]; }
    const L1 = Math.sqrt(d1.reduce((a, x) => a + x * x, 0)); if (L1 < 1e-6) return;
    for (let i = 0; i < n; i++) d1[i] /= L1;
    let p = 0; for (let i = 0; i < n; i++) p += d2[i] * d1[i]; for (let i = 0; i < n; i++) d2[i] -= p * d1[i];
    let L2 = Math.sqrt(d2.reduce((a, x) => a + x * x, 0));
    if (L2 < 1e-3 * L1) { const r = rng(5); for (let i = 0; i < n; i++) d2[i] = gauss(r); let q = 0; for (let i = 0; i < n; i++) q += d2[i] * d1[i]; for (let i = 0; i < n; i++) d2[i] -= q * d1[i]; L2 = Math.sqrt(d2.reduce((a, x) => a + x * x, 0)); }
    for (let i = 0; i < n; i++) d2[i] /= L2;
    const proj = th => { let a = 0, b = 0; for (let i = 0; i < n; i++) { const d = th[i] - th0[i]; a += d * d1[i]; b += d * d2[i]; } return [a, b]; };
    const path = s.hist.map(proj); path.push(proj(now));
    const span = Math.max(L1, ...path.map(q => Math.abs(q[1]) * 1.6)) * 1.5, a0 = -0.25 * L1 - (span - 1.5 * L1) / 2, b0 = -span / 2;
    const vals = new Float64Array(GRID * GRID), th = new Float64Array(n); let mn = Infinity, mx = -Infinity;
    for (let jy = 0; jy < GRID; jy++) for (let ix = 0; ix < GRID; ix++) {
      const a = a0 + span * (ix + 0.5) / GRID, b = b0 + span * (1 - (jy + 0.5) / GRID);
      for (let i = 0; i < n; i++) th[i] = th0[i] + a * d1[i] + b * d2[i];
      const v = Math.log10(Math.max(1e-4, lossAt(th, H, s.data))); vals[jy * GRID + ix] = v; if (v < mn) mn = v; if (v > mx) mx = v;
    }
    s.land = { vals, mn, mx, a0, b0, span, path, img: null };
  }
  function landImage(k, land) {
    if (land.img && land.img._bg === k.C.bg) return land.img;
    const cv = document.createElement("canvas"); cv.width = cv.height = GRID; const ctx = cv.getContext("2d"), im = ctx.createImageData(GRID, GRID);
    const lo = [16, 28, 46], mid = [44, 92, 128], hi = [205, 220, 240];
    for (let i = 0; i < GRID * GRID; i++) {
      const t = (land.vals[i] - land.mn) / Math.max(1e-6, land.mx - land.mn), band = 1;
      const c = t < 0.5 ? lo.map((v, j) => lerp(v, mid[j], t * 2)) : mid.map((v, j) => lerp(v, hi[j], (t - 0.5) * 2));
      im.data[i * 4] = c[0] * band; im.data[i * 4 + 1] = c[1] * band; im.data[i * 4 + 2] = c[2] * band; im.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0); cv._bg = k.C.bg; land.img = cv; return cv;
  }

  // ---------- drawing ----------
  function lay(narrow) {
    return narrow
      ? { net: { x: 30, y: 70, w: 440, h: 360 }, fit: { x: 530, y: 70, w: 440, h: 360 }, loss: { x: 80, y: 560, w: 390, h: 340 }, land: { x: 560, y: 545, w: 370, h: 370 } }
      : { net: { x: 40, y: 80, w: 470, h: 380 }, fit: { x: 590, y: 80, w: 440, h: 300 }, loss: { x: 590, y: 470, w: 440, h: 200 }, land: { x: 1100, y: 80, w: 360, h: 360 } };
  }
  function neuronXY(R, H, layer, j) {
    const xs = [R.x + 20, R.x + R.w * 0.36, R.x + R.w * 0.68, R.x + R.w - 20];
    const n = layer === 0 || layer === 3 ? 1 : H, gap = Math.min(42, (R.h - 40) / Math.max(1, n - 1));
    return [xs[layer], R.y + R.h / 2 + (j - (n - 1) / 2) * gap];
  }
  const fmtL = v => v >= 10 ? v.toFixed(0) : v >= 0.1 ? v.toFixed(2) : v >= 0.001 ? v.toFixed(3) : v >= 0.0001 ? v.toFixed(4) : "< 0.0001";
  // small signed numbers as plain decimals with two significant figures (no "e-4" notation)
  const fmtS = v => { const a = Math.abs(v); if (a < 1e-6) return "0.000000"; const d = Math.min(7, Math.max(2, 1 - Math.floor(Math.log10(a)))); return (v >= 0 ? "+" : "−") + a.toFixed(d); };
  const fmtLR = v => v >= 0.1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toFixed(4);

  function drawNet(k, s, R, narrow) {
    const C = k.C, H = s.H, o = layout(H), th = s.th, cyc = (s.t * 0.7) % 1;
    const fwd = cyc < 0.48, u = fwd ? cyc / 0.48 : (cyc - 0.5) / 0.48; // wave position 0..1
    const gmax = Math.max(1e-9, ...s.gn), gl = s.gn.map(v => clamp01(1 + Math.log10(Math.max(1e-9, v / Math.max(gmax, 1e-3))) / 3) * clamp01(Math.log10(Math.max(1e-9, v) * 1e5) / 4));
    const r = Math.max(5, Math.min(11, (R.h - 40) / Math.max(1, H - 1) * 0.32));
    // edges
    const edge = (l1, j1, l2, j2, w, gapIdx) => {
      const [x1, y1] = neuronXY(R, H, l1, j1), [x2, y2] = neuronXY(R, H, l2, j2), a = clamp01(Math.abs(w) / 1.5);
      k.line(x1, y1, x2, y2, { col: w >= 0 ? C.ink : C.muted, alpha: 0.08 + 0.3 * a, lw: 0.6 + 1.6 * a });
      // pulses: teal forward, amber backward (size = how big this layer's gradient is)
      const lu = fwd ? u * 3 - gapIdx : (1 - u) * 3 - gapIdx;
      if (lu > 0 && lu < 1 && (a > 0.25 || H <= 4)) {
        const p = fwd ? lu : 1 - lu, x = lerp(x1, x2, p), y = lerp(y1, y2, p), back = 0.12;
        const tail = fwd ? [lerp(x1, x2, Math.max(0, p - back)), lerp(y1, y2, Math.max(0, p - back))] : [lerp(x1, x2, Math.min(1, p + back)), lerp(y1, y2, Math.min(1, p + back))];
        const col = fwd ? C.sig : C.amb, al = fwd ? 0.9 : 0.15 + 0.85 * gl[gapIdx];
        k.trail([tail, [x, y]], col, { w: 2.2, alpha: al }); k.dot(x, y, k.px(2.6), col, { glow: 8, alpha: al });
      }
    };
    for (let j = 0; j < H; j++) edge(0, 0, 1, j, th[o.W1 + j], 0);
    for (let kk = 0; kk < H; kk++) for (let j = 0; j < H; j++) edge(1, j, 2, kk, th[o.W2 + kk * H + j], 1);
    for (let kk = 0; kk < H; kk++) edge(2, kk, 3, 0, th[o.W3 + kk], 2);
    // neurons
    const node = (l, j, act) => { const [x, y] = neuronXY(R, H, l, j), sel = s.sel.layer === l && s.sel.j === j && (l === 1 || l === 2);
      k.dot(x, y, r + 2, C.bg); k.dot(x, y, r, C.sig, { alpha: 0.18 + 0.7 * act, glow: act > 0.6 ? 6 : 0 }); k.box(x - r, y - r, 2 * r, 2 * r, { stroke: sel ? C.ink : C.line, r, lw: sel ? 2.2 : 1.2 }); };
    node(0, 0, 0.8); for (let j = 0; j < H; j++) node(1, j, s.act[j] || 0); for (let j = 0; j < H; j++) node(2, j, s.act[H + j] || 0); node(3, 0, 0.8);
    // labels
    const top = R.y - (narrow ? 4 : 10);
    if (!narrow) {
      [["input x", 0], ["layer 1", 1], ["layer 2", 2], ["guess", 3]].forEach(([t, l]) => k.label(neuronXY(R, H, l, 0)[0], top, t, { size: 11 }));
      k.label(R.x, R.y + R.h + 20, fwd ? "Forward pass: the dots go in, guesses come out" : "Backward pass: blame flows back to every weight", { align: "left", col: fwd ? C.sig : C.amb, weight: "650", size: 12.5 });
      k.label(R.x, R.y + R.h + 44, "One pulse stands for many training steps (time is sped up)", { align: "left", size: 10.5 });
    } else k.label(R.x, R.y - 14, fwd ? "forward" : "backward", { align: "left", col: fwd ? C.sig : C.amb, weight: "650", size: 11 });
  }

  function drawFit(k, s, R, narrow) {
    const C = k.C, H = s.H, X = x => R.x + (x + 1) / 2 * R.w, Y = y => R.y + R.h / 2 - y / 1.25 * (R.h / 2);
    k.box(R.x - 10, R.y - 10, R.w + 20, R.h + 20, { stroke: C.line, r: 12 });
    k.line(R.x, Y(0), R.x + R.w, Y(0), { col: C.line, alpha: 0.6 });
    const h1 = new Float64Array(H), h2 = new Float64Array(H);
    for (const [x, t] of s.data) { const y = Math.max(-1.25, Math.min(1.25, predict(s.th, H, x, h1, h2))); k.line(X(x), Y(t), X(x), Y(y), { col: C.crit, alpha: 0.45, lw: 1.2 }); }
    for (const [x, t] of s.data) k.dot(X(x), Y(t), k.px(narrow ? 3 : 4), C.sig, { alpha: 0.95 });
    const pts = []; for (let i = 0; i <= 120; i++) { const x = -1 + 2 * i / 120; pts.push([X(x), Y(Math.max(-1.25, Math.min(1.25, predict(s.th, H, x, h1, h2))))]); }
    const c = k.ctx; c.save(); c.strokeStyle = C.amb; c.lineWidth = k.px(3); c.shadowColor = C.amb; c.shadowBlur = 8; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.stroke(); c.restore();
    k.label(R.x, R.y - 10, narrow ? "The fit" : "Data (dots) and the network's guess (amber)", { align: "left", col: C.ink, weight: "650", size: narrow ? 11 : 12.5, dy: -12 });
    if (!narrow) k.label(R.x, R.y + R.h + 10, "red lines: the misses the loss measures", { align: "left", size: 10.5, dy: 10, col: C.crit });
  }

  function drawLoss(k, s, R, narrow) {
    const C = k.C, pts = s.losses, n = Math.max(200, s.stepN), lo = -3, hi = 1;
    const X = t => R.x + t / n * R.w, Y = v => R.y + R.h - (clamp01((Math.log10(Math.max(1e-3, v)) - lo) / (hi - lo))) * R.h;
    k.box(R.x - 10, R.y - 10, R.w + 20, R.h + 20, { stroke: C.line, r: 12 });
    [1, 0.1, 0.01, 0.001].forEach(v => { k.line(R.x, Y(v), R.x + R.w, Y(v), { col: C.line, alpha: 0.5, lw: 1 }); if (!narrow || v === 0.1 || v === 0.01) k.label(R.x - 6, Y(v), String(v), { align: "right", size: 10, mono: true }); });
    k.line(R.x, Y(0.02), R.x + R.w, Y(0.02), { col: C.ok, dash: [5, 5], alpha: 0.8 }); if (!narrow) k.label(R.x + 8, Y(0.02), "goal 0.02", { align: "left", size: 10, col: C.ok, dy: 9 });
    const c = k.ctx; c.save(); c.strokeStyle = C.sig; c.lineWidth = k.px(2); c.beginPath(); pts.forEach(([t, v], i) => { const x = X(t), y = Y(v); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.restore();
    const [lt, lv] = pts[pts.length - 1]; k.dot(X(lt), Y(lv), k.px(4), s.blown ? C.crit : C.sig, { glow: 8 });
    k.label(R.x, R.y - 10, narrow ? "Loss" : `Loss = average miss, squared · step ${s.stepN.toLocaleString()}`, { align: "left", col: C.ink, weight: "650", size: narrow ? 11 : 12.5, dy: -12 });
  }

  function drawLand(k, s, R, narrow) {
    const C = k.C;
    k.label(R.x, R.y - 10, narrow ? "Landscape" : "Loss landscape (a real slice)", { align: "left", col: C.ink, weight: "650", size: narrow ? 11 : 12.5, dy: -12 });
    if (!s.land) { k.box(R.x, R.y, R.w, R.h, { stroke: C.line, r: 10, dash: [4, 5] }); k.label(R.x + R.w / 2, R.y + R.h / 2, "appears after a few steps", { size: 11 }); return; }
    const L = s.land, img = landImage(k, L), c = k.ctx;
    c.save(); rr(c, R.x, R.y, R.w, R.h, 10); c.clip(); c.imageSmoothingEnabled = true; c.drawImage(img, R.x, R.y, R.w, R.h); c.restore();
    k.box(R.x, R.y, R.w, R.h, { stroke: C.line, r: 10 });
    const P = ([a, b]) => [R.x + (a - L.a0) / L.span * R.w, R.y + (1 - (b - L.b0) / L.span) * R.h];
    const pts = L.path.map(P).map(([x, y]) => [Math.max(R.x, Math.min(R.x + R.w, x)), Math.max(R.y, Math.min(R.y + R.h, y))]);
    c.save(); c.strokeStyle = "#ffffff"; c.globalAlpha = 0.9; c.lineWidth = k.px(2); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.stroke(); c.restore();
    k.dot(...pts[0], k.px(5), "#ffffff"); k.dot(...pts[pts.length - 1], k.px(7), C.amb, { glow: 12 });
    if (!narrow) {
      k.label(pts[0][0], pts[0][1], "start", { col: "#ffffff", size: 10.5, dy: 13, bg: "#0b1220" });
      k.label(R.x, R.y + R.h + 10, "dark = low loss · light = high loss", { align: "left", size: 10.5, dy: 10 });
      k.label(R.x, R.y + R.h + 30, "white line = the path the weights took", { align: "left", size: 10.5, dy: 10 });
    }
  }

  function selInfo(s) {
    const H = s.H, o = layout(H), j = Math.min(s.sel.j, H - 1), i = s.sel.layer === 1 ? o.W1 + j : o.W3 + j;
    return { i, w: s.th[i], g: s.g[i], plain: -s.lr * s.g[i], adam: s.lastStep[i], name: s.sel.layer === 1 ? `input → layer 1, neuron ${j + 1}` : `layer 2, neuron ${j + 1} → guess` };
  }
  function draw(k, s, sim) {
    const C = k.C, L = lay(sim.narrow), narrow = sim.narrow;
    drawNet(k, s, L.net, narrow); drawFit(k, s, L.fit, narrow); drawLoss(k, s, L.loss, narrow); drawLand(k, s, L.land, narrow);
    if (!narrow) {
      // gradient strength per layer (amber), under the landscape
      const gx = L.land.x, gy = L.land.y + L.land.h + 90;
      k.label(gx, gy, "How hard each layer is pushed", { align: "left", col: C.ink, weight: "650", size: 12 });
      ["layer 1", "layer 2", "output"].forEach((t, i) => { const yy = gy + 22 + i * 22, v = s.gn[i], f = clamp01((Math.log10(Math.max(1e-7, v)) + 5) / 5);
        k.label(gx, yy, t, { align: "left", size: 11 }); k.box(gx + 70, yy - 6, 200, 12, { fill: C.line, r: 4, alpha: 0.5 }); k.box(gx + 70, yy - 6, Math.max(2, 200 * f), 12, { fill: C.amb, r: 4, alpha: 0.9, glow: 6, glowCol: C.amb }); });
      // the weight the learner picked: its value, its slope and its last nudge
      const si = selInfo(s), P = { x: L.net.x - 10, y: L.net.y + L.net.h + 76, w: 490, h: 150 };
      k.box(P.x, P.y, P.w, P.h, { fill: C.bg2, stroke: C.line, r: 12, alpha: 0.9 });
      k.label(P.x + 14, P.y + 22, "One weight up close (click a neuron)", { align: "left", col: C.ink, weight: "650", size: 12 });
      [["which weight", si.name, C.ink], ["its value now", si.w.toFixed(3), C.ink], ["slope of the loss", fmtS(si.g), C.amb], ["last nudge", fmtS(si.adam), C.sig]].forEach(([a, b, col], i) => {
        k.label(P.x + 14, P.y + 52 + i * 26, a, { align: "left", size: 11.5 }); k.label(P.x + P.w - 14, P.y + 52 + i * 26, b, { align: "right", size: 11.5, mono: true, col, weight: "600" }); });
    }
  }

  const sim = makeSim($("#learn-sim"), {
    label: "Neural network training simulation. Left: the network, with teal pulses for the forward pass and amber for the backward pass. Middle: the data dots and the network's curve, and the loss over time. Right: a slice of the loss landscape with the path the weights took. Click a neuron to inspect one of its weights.",
    cams: { default: { x: 10, y: 30, w: 1470, h: 720 } },
    camsNarrow: { default: { x: 0, y: 30, w: 1000, h: 900 } },
    height: w => w < 640 ? Math.round(Math.max(320, w * 1.0)) : Math.round(Math.min(580, Math.max(380, w * 0.52))),
    init, warmup: 2, factDelay: 6, speeds: [1, 3, 10],
    intro: "A real network is learning to draw a curve through the dots. Change the learning rate and watch the loss.",
    controls: [
      { id: "lr", label: "Learning rate (step size)", type: "range", min: -3.5, max: 0, step: 0.1, value: -3, fmt: v => fmtLR(10 ** v), help: "How far each weight moves on every step. Changing it restarts training from the same random start, so you can compare.", apply: (s, v) => { const ch = s.lr !== 10 ** v; s.lr = 10 ** v; if (ch && s.stepN > 0) restart(s); } },
      { id: "H", label: "Neurons per layer", type: "choice", value: 8, options: [[1, "1"], [2, "2"], [4, "4"], [8, "8"], [16, "16"]], help: "More neurons, more bends the curve can make.", apply: (s, v) => { if (s.H !== v) { s.H = v; s.sel.j = Math.min(s.sel.j, v - 1); restart(s); } } },
      { id: "pattern", label: "Data to learn", type: "choice", value: "wave", options: [["wave", "Wave"], ["steps", "Steps"], ["bumps", "Two bumps"]], apply: (s, v) => { if (s.pattern !== v) { s.pattern = v; restart(s); } } },
      { id: "noise", label: "Noisy data", type: "toggle", value: false, help: "Each dot is pushed up or down at random.", apply: (s, v) => { if (s.noise !== v) { s.noise = v; restart(s); } } },
      { id: "again", label: "New random start", type: "button", help: "Fresh random weights; training restarts at step 0.", apply: s => { s.seed = 1 + Math.floor(s.rand() * 1e6); restart(s); } }
    ],
    step, draw,
    click: (s, wx, wy, sim) => { const R = lay(sim.narrow).net; let best = null, bd = 1e9; for (const l of [1, 2]) for (let j = 0; j < s.H; j++) { const [x, y] = neuronXY(R, s.H, l, j), d = Math.hypot(wx - x, wy - y); if (d < bd) { bd = d; best = { layer: l, j }; } } if (best && bd < 40) s.sel = best; },
    stats: s => [["training steps", s.stepN.toLocaleString(), s.reached && s.reached <= 200 ? "ok" : s.stepN > 200 && !s.reached ? "hot" : ""], ["loss", fmtL(s.loss), s.blown ? "bad" : s.loss < 0.02 ? "ok" : ""], ["weights being trained", String(s.th.length)], ["learning rate", fmtLR(s.lr)]],
    goal: { text: "get the loss below 0.02 within 200 training steps", check: s => ({ done: !!s.reached && s.reached <= 200, progress: s.reached ? `reached at step ${s.reached}` : `step ${s.stepN} · loss ${fmtL(s.loss)}` }) },
    notices: [
      { id: "blown", when: s => s.blown, say: s => `The loss jumped from ${fmtL(s.blownFrom)} to ${fmtL(s.loss)}. With a learning rate of ${fmtLR(s.lr)} each nudge is too big: it overshoots the bottom of the valley and lands somewhere worse. Lower it and training starts again from the same random start.` },
      { id: "stuck", when: s => s.stepN > 300 && s.loss > 0.08 && Math.max(...s.gn) < 3e-4, say: s => `The amber pulses have almost faded: the slope is nearly flat, so every nudge is tiny. The neurons are pushed to their limits, where changing a weight barely changes anything. Learning has stalled; try a new random start.` },
      { id: "overfit", when: s => s.noise && s.loss < s.floor * 0.85, say: s => `The loss (${fmtL(s.loss)}) is now lower than the true pattern itself would score on these dots (${fmtL(s.floor)}). The only way to do that is to bend the curve towards single noisy dots. That's <b>overfitting</b>: memorising the noise instead of learning the pattern.` },
      { id: "noise", when: s => s.noise && s.stepN > 150, say: s => `Nobody can predict random noise. Even the true pattern behind these dots would score a loss of ${fmtL(s.floor)}, so that's about as low as honest learning goes. The loss is at ${fmtL(s.loss)}. ${s.H >= 8 ? "Leave it running at 10× and watch whether it starts chasing single dots." : "A small network can't wiggle much, which protects it from chasing the noise."}` },
      { id: "thrash", when: s => s.lr >= 0.3 && s.stepN > 80 && s.loss > 0.02, say: s => `With a learning rate of ${fmtLR(s.lr)} every nudge is so big that it jumps right over the low ground. The loss bounces around ${fmtL(s.loss)} instead of settling. Smaller steps would get further.` },
      { id: "small", when: s => s.H === 1 && s.stepN > 150 && s.loss > 0.03, say: s => `With one neuron per layer, the network can only draw a curve that goes one way: always up or always down. The ${s.pattern === "wave" ? "wave" : s.pattern === "steps" ? "steps go up, so it does fairly well, but the corners" : "two bumps"} need more bends, so the loss is stuck near ${fmtL(s.loss)}. More neurons, more bends.` },
      { id: "slow", when: s => s.lr < 0.003 && s.stepN > 120 && s.loss > 0.02, say: s => `It's learning, but slowly: with a learning rate of ${fmtLR(s.lr)}, each weight moves at most about ${fmtLR(s.lr)} per step. After ${s.stepN} steps the loss is still ${fmtL(s.loss)}. Try a bigger learning rate.` },
      { id: "done", when: s => s.loss < 0.02, say: s => `Loss ${fmtL(s.loss)} after ${s.stepN.toLocaleString()} steps. The curve now follows the dots, and every one of the ${s.th.length} weights got there by being nudged slightly downhill, step after step.` },
      { id: "early", when: s => s.stepN < 200, say: s => `Every step, all 40 dots go through the network (teal), the misses are measured (red lines), and blame flows back (amber) to nudge all ${s.th.length} weights a little.` },
      { id: "calm", when: () => true, say: s => `Step ${s.stepN}: loss ${fmtL(s.loss)}. The white path on the landscape is the route the weights have taken downhill.` }
    ],
    facts: [
      { id: "six", when: s => s.stepN > 300, text: "Working out the blame (the backward pass) costs about twice as much as the forward pass. That's why training a large model costs about 6 calculations per weight for every token it reads, against 2 to use it.", ref: "#ref-7" },
      { id: "spikes", when: s => s.blown, text: "Big training runs watch for loss spikes like this one all the time. DeepSeek reported that training its V3 model on 14.8 trillion tokens had no spikes it couldn't recover from and never needed to roll back to an earlier save, which is rare enough to be worth saying.", ref: "#ref-10" }
    ],
    tour: [
      { say: "This network starts with random weights, so its amber curve is nowhere near the dots. Each step it guesses, measures the misses and nudges every weight. With a learning rate of 0.001 it is slow.", set: { lr: -3, H: 8, pattern: "wave", noise: false }, wait: 8 },
      { say: "Raise the learning rate to 0.02. Training restarts from the same random weights, and this time the curve bends into shape within about 40 steps. The white path runs downhill on the landscape.", set: { lr: -1.7 }, until: s => s.loss < 0.02, min: 4, max: 16 },
      { say: "Now a huge learning rate, 1.0. Every nudge overshoots the low ground, so the loss jumps around and never settles.", set: { lr: 0 }, wait: 9 },
      { say: "Back to 0.02, but only one neuron per layer. Such a network can only draw a curve that goes one way, so it can't follow the wave.", set: { lr: -1.7, H: 1 }, wait: 9 },
      { say: "Sixteen neurons and noisy dots. Nobody can predict the noise, so the loss stops falling near 0.03, what even the true pattern would score. Left running, the big network starts bending towards single dots: overfitting.", set: { H: 16, noise: true }, wait: 10 }
    ],
    publish: s => { const si = selInfo(s); return {
      lSteps: s.stepN.toLocaleString(), lLoss: fmtL(s.loss), lParams: String(s.th.length), lLR: fmtLR(s.lr),
      lW: si.w.toFixed(6), lG: fmtS(si.g).replace("+", ""), lPlain: fmtS(si.plain), lNew: (si.w + si.plain).toFixed(6), lAdam: fmtS(si.adam), lWhich: si.name }; }
  });
});
