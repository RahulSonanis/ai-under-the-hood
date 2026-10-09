/* Chapter 3 film: choosing the next word. Scores, softmax, temperature, top-k / top-p, sampling, the loop, and the loss. */
chapter("predict", () => {
  const fig = $("#pd-film"); if (!fig) return;
  const narrow = () => innerW(fig) < 640;
  const colOf = ["#5ce1c6", "#ffb547", "#8fb3ff", "#d59cff", "#ff8fa3", "#9be37a", "#7fdcff", "#ffd27a"];

  // illustrative probabilities at T = 1; logits are ln p plus a constant, so softmax gives them back exactly
  const D0 = [["mat", .40], ["floor", .16], ["sofa", .10], ["bed", .08], ["couch", .06], ["chair", .05], ["rug", .04], ["table", .03], ["roof", .025], ["ground", .02], ["edge", .02], ["grass", .015]];
  const D1 = [[".", .34], ["and", .22], [",", .14], ["while", .08], ["again", .06], ["all", .05], ["with", .04], ["for", .03], ["in", .03], ["near", .02], ["by", .02], ["at", .01]];
  const D2 = [["slept", .30], ["purred", .22], ["stared", .12], ["looked", .09], ["yawned", .07], ["waited", .06], ["then", .04], ["licked", .03], ["ate", .03], ["sat", .02], ["ran", .01], ["was", .01]];
  const logits = D => D.map(([, p]) => Math.log(p) + 2.2);
  const softmax = (z, T) => { const m = Math.max(...z), e = z.map(v => Math.exp((v - m) / T)), s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); };
  const topP = (p, P) => { let c = 0, n = 0; for (; n < p.length; n++) { c += p[n]; if (c >= P - 1e-9) { n++; break; } } return n; };
  const renorm = (p, n) => { const s = p.slice(0, n).reduce((a, b) => a + b, 0); return p.map((v, i) => i < n ? v / s : 0); };
  const Z0 = logits(D0), P0 = softmax(Z0, 1);
  const K = 5, TP = 0.9, NP = topP(P0, TP); // NP = 8 tokens kept by top-p
  const WHEEL0 = renorm(P0, NP);

  const CTX = ["The", "cat", "sat", "on", "the"], ADD = ["mat", "and", "purred"];
  const PICK = [0, 1, 1]; // index picked in D0, D1, D2

  // ---- layout ----
  const B = { y0: 140, dy: 36, h: 24, lx: 520, LZ: 820, LS: 120, PB: 540, PS: 640 };
  const rowY = j => B.y0 + j * B.dy;
  let NR = 12; // rows drawn (fewer on phones)
  const M = { x: 60, y: 150, w: 250, h: 330 }; // the model box (moved closer on phones)
  const L = () => { const n = narrow(); return n ? { n, cx0: 200, cy: 46, wrap: 600, fs: 30, chH: 54, wh: [500, 420], r: 220 } : { n, cx0: 380, cy: 62, wrap: 1200, fs: 20, chH: 42, wh: [1370, 330], r: 185 }; };
  const meas = document.createElement("canvas").getContext("2d");
  function chipsLayout(lay, words) {
    meas.font = `600 ${lay.fs}px ${css("--f-display")}`;
    const out = []; let x = lay.cx0, y = lay.cy;
    words.forEach(w => { const cw = meas.measureText(w).width + lay.fs * 1.2; if (x + cw > lay.cx0 + lay.wrap) { x = lay.cx0; y += lay.chH + 14; } out.push({ w, x, y, cw }); x += cw + 12; });
    return out;
  }
  // next free slot after the given words
  function nextSlot(lay, words, w) { const all = chipsLayout(lay, [...words, w]); return all[all.length - 1]; }

  const cams = {
    get default() { return narrow() ? { x: 170, y: 0, w: 880, h: 640 } : { x: 30, y: 0, w: 1100, h: 610 }; },
    get context() { return this.default; },
    get softmax() { return narrow() ? { x: 410, y: 100, w: 660, h: 580 } : { x: 330, y: 20, w: 1060, h: 650 }; },
    get temp() { return this.softmax; }, get cut() { return this.softmax; },
    get sample() { return narrow() ? { x: 180, y: 20, w: 640, h: 640 } : { x: 330, y: 10, w: 1260, h: 630 }; },
    get loop() { return this.sample; },
    get loss() { return narrow() ? { x: 80, y: 740, w: 840, h: 540 } : { x: 40, y: 730, w: 1000, h: 560 }; }
  };

  const steps = [
    { key: "context", short: "Scores", title: "The model scores every possible next token", dur: 6,
      text: [`The model reads "The cat sat on the" and gives every possible next word a score. A higher score means more likely. We show 12 of them.`,
             `The final layer produces one logit per vocabulary entry, about 128k for Llama 3. Logits are unbounded real numbers. Only 12 are drawn here, with made-up values.`], link: "#ref-39" },
    { key: "softmax", short: "Softmax", title: "Softmax turns scores into probabilities", dur: 6,
      text: [`The scores are turned into chances that add up to 100%. The order stays the same: the biggest score gets the biggest chance.`,
             `pᵢ = exp(zᵢ) / Σⱼ exp(zⱼ). Exponentiating makes every value positive, and dividing by the sum makes them add up to 1.`] },
    { key: "temp", short: "Temperature", title: "Temperature sharpens or flattens the odds", dur: 7,
      text: [`Low temperature makes the favourite even more likely: safe and repetitive. High temperature evens out the odds: surprising, then nonsense.`,
             `pᵢ = exp(zᵢ/T) / Σⱼ exp(zⱼ/T). As T → 0 this approaches argmax (greedy decoding); T = 1 leaves the distribution unchanged; as T grows it approaches uniform.`] },
    { key: "cut", short: "Top-k, top-p", title: "Top-k and top-p cut off the long tail", dur: 7.5,
      text: [`Top-k keeps only the k most likely words. Top-p keeps the fewest words whose chances add up to p. Either way, the unlikely tail can't be picked.`,
             `Top-k keeps the k largest; top-p (nucleus sampling) keeps the smallest set S with Σ pᵢ ≥ p. The kept probabilities are renormalised to sum to 1. Here k = 5, then p = 0.9 keeps 8 tokens.`], link: "#ref-39" },
    { key: "sample", short: "Sample", title: "A weighted spin picks one token", dur: 6.5,
      text: [`Now a wheel spins, with a bigger slice for each likelier word. It lands on "mat", which is added to the text.`,
             `The sampler draws one token from the renormalised distribution. This is the only random step: with greedy decoding and exact arithmetic the output would be deterministic.`] },
    { key: "loop", short: "Repeat", title: "Add it to the text and repeat", dur: 6.5,
      text: [`The whole thing runs again with the longer text, one token at a time. Here the wheel picks "and", then "purred". "and" wasn't the favourite: that is sampling at work.`,
             `Generation is autoregressive: each sampled token is appended to the context, and the model runs again to score the next position.`] },
    { key: "loss", short: "Loss", title: "Training measures surprise: loss = −log p", dur: 7,
      text: [`In training the real next word is known. If the model gave it a high chance, the penalty is tiny. If it gave it a low chance, the penalty is big.`,
             `The loss is cross-entropy, −ln p(true token), averaged over all tokens: p = 0.9 costs about 0.1 and p = 0.01 costs about 4.6. Training adjusts the weights to push it down.`] }
  ];

  // ---- drawing helpers ----
  function chip(k, lay, c, o = {}) {
    const C = k.C, a = o.alpha == null ? 1 : o.alpha;
    k.box(c.x, c.y - lay.chH / 2, c.cw, lay.chH, { fill: o.fill || C.bg2, stroke: o.stroke || C.line, r: 8, alpha: a, glow: o.glow || 0 });
    k.text(c.x + c.cw / 2, c.y + 1, c.w, { col: o.col || C.ink, size: lay.fs, weight: "600", alpha: a });
  }
  function contextRow(k, lay, words, o = {}) { chipsLayout(lay, words).forEach((c, j) => chip(k, lay, c, { alpha: o.alpha ? o.alpha(j) : 1, stroke: o.hi && o.hi(j) ? k.C.sig : k.C.line, glow: o.hi && o.hi(j) ? 12 : 0 })); }
  function modelBox(k, f, glowK, a = 1) {
    const C = k.C; if (a <= 0) return;
    k.box(M.x, M.y, M.w, M.h, { fill: C.bg2, stroke: glowK > 0 ? C.amb : C.line, r: 16, alpha: a });
    const dx = (M.w - 40) / 7; for (let j = 0; j < 7; j++) { const x = M.x + 20 + j * dx + (dx - 18) / 2, d = Math.abs(glowK * 9 - 1 - j); const g = glowK > 0 && glowK < 1 && d < 1.5 ? 1 - d / 1.5 : 0; k.box(x, M.y + 40, 18, M.h - 80, { fill: g > 0 ? C.amb : C.line, r: 5, alpha: a * (0.5 + 0.5 * g), glow: g * 16 }); }
    k.label(M.x + M.w / 2, M.y + M.h + 18, "The model", { col: glowK > 0 && glowK < 1 ? C.ink : C.muted, weight: "600", alpha: a });
  }
  // bars: v[j] in [0,1] probability mode, or z in logit mode, blended by e (0 logits -> 1 probabilities)
  function bars(k, D, z, p, e, o = {}) {
    const C = k.C, a0 = o.alpha == null ? 1 : o.alpha;
    D.slice(0, NR).forEach(([w], j) => {
      const y = rowY(j), ra = a0 * (o.rowA ? o.rowA(j) : 1), g = o.grow ? o.grow(j) : 1; if (ra <= 0.01) return;
      const zx0 = B.LZ + Math.min(0, z[j]) * B.LS * g, zx1 = B.LZ + Math.max(0, z[j]) * B.LS * g;
      const px0 = B.PB, px1 = B.PB + p[j] * B.PS * g;
      const x0 = lerp(zx0, px0, e), x1 = lerp(zx1, px1, e);
      const col = o.col ? o.col(j) : (e < 0.5 ? (z[j] >= 0 ? C.sig : C.muted) : C.sig);
      const hi = o.hi && o.hi(j);
      k.label(B.lx, y + B.h / 2, w, { align: "right", col: hi ? C.ink : C.muted, weight: hi ? "650" : "500", size: 13, alpha: ra, mono: true });
      k.box(x0, y, Math.max(1, x1 - x0), B.h, { fill: col, r: 4, alpha: ra * (hi ? 1 : 0.85), glow: hi ? 12 : 0 });
      if (o.vals !== false && g > 0.6) { const v = e < 0.5 ? (z[j] >= 0 ? "" : "−") + Math.abs(z[j]).toFixed(2) : (p[j] * 100).toFixed(p[j] < 0.1 ? 1 : 0) + "%"; k.label(x1 + 8 + (e < 0.5 && z[j] < 0 ? 0 : 0), y + B.h / 2, v, { align: "left", col: C.muted, size: 11, mono: true, alpha: ra * (e < 0.5 ? 1 - e * 2 : (e - 0.5) * 2) * clamp01((g - 0.6) / 0.4) }); }
    });
  }
  function wheel(k, lay, D, p, ang, a, pickJ, glow) {
    const C = k.C, [cx, cy] = lay.wh, r = lay.r, c = k.ctx; if (a <= 0) return;
    let s = -Math.PI / 2 + ang;
    p.forEach((v, j) => {
      if (v <= 0) return; const e = s + v * Math.PI * 2;
      c.save(); c.globalAlpha = a * (pickJ === j && glow ? 1 : 0.8); c.fillStyle = colOf[j % 8]; if (pickJ === j && glow) { c.shadowColor = colOf[j % 8]; c.shadowBlur = 20 * glow; }
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, s, e); c.closePath(); c.fill(); c.lineWidth = k.px(2); c.strokeStyle = C.bg; c.stroke(); c.restore();
      if (v > 0.055) { const m = (s + e) / 2; k.text(cx + Math.cos(m) * r * 0.66, cy + Math.sin(m) * r * 0.66, D[j][0], { col: C.bg, size: lay.n ? 22 : 16, weight: "700", alpha: a }); }
      s = e;
    });
    k.dot(cx, cy, r * 0.12, C.bg2, { alpha: a });
    // pointer at the top
    c.save(); c.globalAlpha = a; c.fillStyle = C.ink; c.beginPath(); c.moveTo(cx, cy - r + 16); c.lineTo(cx - 13, cy - r - 14); c.lineTo(cx + 13, cy - r - 14); c.closePath(); c.fill(); c.restore();
  }
  // wheel angle that puts the middle of slice j under the pointer, plus whole turns
  const landAng = (p, j, turns) => { let s = 0; for (let i = 0; i < j; i++) s += p[i]; return -(s + p[j] / 2) * Math.PI * 2 + turns * Math.PI * 2; };

  storyFilm(fig, {
    label: "Animated explanation of how a language model picks the next word",
    steps, cams,
    draw(k, f) {
      const C = k.C, lay = L(), key = f.key;
      NR = lay.n ? 10 : 12; B.PS = lay.n ? 460 : 640; B.dy = lay.n ? 44 : 36; B.h = lay.n ? 30 : 24;
      Object.assign(M, lay.n ? { x: 190, y: 160, w: 180, h: 360 } : { x: 60, y: 150, w: 250, h: 330 });
      // ---------- training view ----------
      if (key === "loss") {
        const ox = 160, oy = 1220, gw = 700, gh = 330, Lmax = 5;
        const X = p => ox + p * gw, Y = l => oy - Math.min(l, Lmax) / Lmax * gh;
        const lay2 = { ...lay, cx0: 160, cy: 790, wrap: 1000, fs: lay.n ? 24 : 20, chH: lay.n ? 46 : 42 };
        const cs = chipsLayout(lay2, [...CTX, "mat"]);
        cs.forEach((c, j) => chip(k, lay2, c, j === 5 ? { stroke: C.sig, col: C.sig, glow: 10 } : {}));
        k.label(cs[5].x + cs[5].cw / 2, 790 - lay2.chH / 2 - 14, "true next word", { col: C.sig, size: 11 });
        // axes
        k.line(ox, oy, ox + gw + 20, oy, { col: C.muted }); k.line(ox, oy, ox, oy - gh - 20, { col: C.muted });
        k.label(ox + gw / 2, oy + 34, "probability the model gave the true word", { col: C.muted, size: 12 });
        k.label(ox - 14, oy - gh - 34, "loss (surprise)", { col: C.muted, size: 12, align: "left" });
        [0, 0.5, 1].forEach(p => k.label(X(p), oy + 14, String(p), { col: C.muted, size: 11, mono: true }));
        [0, 1, 2, 3, 4, 5].forEach(l => { k.label(ox - 10, Y(l), String(l), { col: C.muted, size: 11, mono: true, align: "right" }); if (l) k.line(ox, Y(l), ox + gw, Y(l), { alpha: 0.4 }); });
        // the curve, drawn in
        const draw = easeIO(f.p / 0.25), pts = []; for (let q = 0; q <= 120; q++) { const p = 0.0067 + (1 - 0.0067) * q / 120; if (q / 120 <= draw) pts.push([X(p), Y(-Math.log(p))]); }
        for (let q = 1; q < pts.length; q++) k.line(...pts[q - 1], ...pts[q], { col: C.amb, lw: 2.5 });
        // the moving point
        const pp = f.p < 0.3 ? 0.40 : f.p < 0.55 ? lerp(0.40, 0.9, easeIO((f.p - 0.3) / 0.2)) : lerp(0.9, 0.01, easeIO((f.p - 0.6) / 0.25));
        const L1 = -Math.log(pp), pa = clamp01((f.p - 0.12) / 0.1);
        if (pa > 0) {
          k.line(X(pp), oy, X(pp), Y(L1), { col: C.sig, dash: [4, 4], alpha: pa * 0.7 }); k.line(ox, Y(L1), X(pp), Y(L1), { col: C.amb, dash: [4, 4], alpha: pa * 0.7 });
          k.dot(X(pp), Y(L1), k.px(7), C.ink, { glow: 16, alpha: pa });
          k.label(X(pp), Y(L1), `p = ${pp.toFixed(2)} → loss ${L1.toFixed(2)}`, { col: C.ink, weight: "600", size: 12, align: pp > 0.6 ? "right" : "left", dx: pp > 0.6 ? -14 : 14, dy: -16, alpha: pa });
        }
        // mini probability bar for the true word
        const bx = cs[5].x + cs[5].cw + 30, bw = lay.n ? 110 : 220; k.box(bx, 790 - 9, bw, 18, { stroke: C.line, r: 4 }); k.box(bx, 790 - 9, bw * pp, 18, { fill: C.sig, r: 4, alpha: 0.9 });
        k.label(bx + bw + 10, 790, (pp * 100).toFixed(0) + "%", { col: C.sig, mono: true, size: 12, align: "left" });
        [[0.9, "90% → 0.1"], [0.01, "1% → 4.6"]].forEach(([q, t]) => { const ra = clamp01((f.p - 0.2) / 0.1) * clamp01(Math.abs(Math.log(pp / q)) / 0.4); k.dot(X(q), Y(-Math.log(q)), k.px(4), C.amb, { alpha: ra }); k.label(X(q), Y(-Math.log(q)), t, { col: C.amb, size: 11, mono: true, align: q > 0.5 ? "right" : "left", dx: q > 0.5 ? -4 : 10, dy: q > 0.5 ? -16 : 0, alpha: ra }); });
        return;
      }

      // ---------- generation view ----------
      const loopP = f.at("loop"), sampP = f.at("sample");
      const cyc = key === "loop" ? (loopP < 0.5 ? 1 : 2) : 0, u = key === "loop" ? (loopP % 0.5) / 0.5 : 0;
      // words in the text so far (the chip being added flies in separately)
      const nAdded = key === "sample" ? 0 : key === "loop" ? cyc : 0;
      const words = [...CTX, ...ADD.slice(0, nAdded)];
      const dimGen = lay.n && (key === "sample" || key === "loop");
      // context row
      const appear = j => key === "context" ? easeOut((f.p - j * 0.04) / 0.12) : 1;
      const ctxA = lay.n && ["softmax", "temp", "cut"].includes(key) ? 0 : lay.n && key === "sample" ? clamp01((f.p - 0.05) / 0.1) : 1;
      if (ctxA > 0) contextRow(k, lay, words, { alpha: j => appear(j) * ctxA, hi: j => key === "context" && f.p > 0.2 && f.p < 0.5 });
      if (key === "context") k.label(lay.cx0, lay.cy - lay.chH / 2 - 16, "Text so far", { col: C.muted, align: "left", size: 12, alpha: appear(0) });
      // model
      const modelA = key === "context" ? 1 : key === "softmax" ? 1 - clamp01(f.p / 0.15) : 0;
      const thinkK = key === "context" ? (f.p - 0.28) / 0.3 : key === "loop" ? (u - 0.02) / 0.2 : 0;
      modelBox(k, f, thinkK, modelA);
      if (key === "context" && f.p > 0.18 && f.p < 0.5) { const cs = chipsLayout(lay, words); cs.forEach((c, j) => { const P = q => bez([[c.x + c.cw / 2, c.y + lay.chH / 2], [c.x + c.cw / 2, c.y + 120], [M.x + M.w / 2 + 60, M.y - 60], [M.x + M.w / 2, M.y + 20]], q); k.flow(P, 2, f.t * 0.7 + j * 0.13, C.sig, { alpha: clamp01((0.5 - f.p) / 0.08) }); }); }
      if (key === "loop" && u < 0.3) { const cs = chipsLayout(lay, words); cs.forEach((c, j) => { const tx = lay.n ? lay.wh[0] : B.lx - 40, ty = lay.n ? lay.wh[1] - lay.r : rowY(3); const P = q => bez([[c.x + c.cw / 2, c.y + lay.chH / 2], [c.x + c.cw / 2, c.y + 90], [tx - 60, ty - 60], [tx, ty]], q); k.flow(P, 1, f.t * 0.9 + j * 0.11, C.sig, { alpha: 1 - u / 0.3 }); }); }
      // which distribution is on screen
      const D = cyc === 1 ? D1 : cyc === 2 ? D2 : D0, z = logits(D);
      let p = softmax(z, 1), e = 1, T = 1, rowA = null, grow = null, hi = null;
      if (key === "context") { e = 0; grow = j => easeOut((f.p - 0.6 - j * 0.02) / 0.15); if (f.p > 0.48 && f.p < 0.85) k.flow(q => bez([[M.x + M.w - 10, M.y + M.h / 2], [M.x + M.w + 90, M.y + M.h / 2], [B.lx - 100, rowY(5)], [B.lx - 60, rowY(5)]], q), 5, f.t * 0.8, C.sig, { alpha: clamp01((0.85 - f.p) / 0.08) }); }
      if (key === "softmax") e = easeIO((f.p - 0.15) / 0.55);
      if (key === "temp") { T = f.p < 0.1 ? 1 : f.p < 0.4 ? lerp(1, 0.4, easeIO((f.p - 0.1) / 0.25)) : f.p < 0.48 ? 0.4 : f.p < 0.78 ? lerp(0.4, 2.2, easeIO((f.p - 0.48) / 0.27)) : lerp(2.2, 1, easeIO((f.p - 0.84) / 0.14)); p = softmax(z, T); }
      let mode = null, kept = 12;
      if (key === "cut") {
        if (f.p < 0.47) { mode = "k"; const c = easeIO((f.p - 0.12) / 0.18), rn = easeIO((f.p - 0.3) / 0.12); kept = K; rowA = j => j < K ? 1 : 1 - 0.85 * c; grow = j => j < K ? 1 : 1 - c; const pr = renorm(p, K); p = p.map((v, j) => j < K ? lerp(v, pr[j], rn) : v); }
        else { mode = "p"; const back = easeIO((f.p - 0.47) / 0.08), c = easeIO((f.p - 0.68) / 0.14), rn = easeIO((f.p - 0.84) / 0.12); kept = NP; rowA = j => j < K ? 1 : j < NP ? lerp(0.15, 1, back) : lerp(0.15, 1, back) * (1 - 0.85 * c); grow = j => j < K || j < NP ? (j < K ? 1 : back) : back * (1 - c); const pr = renorm(p, NP); p = p.map((v, j) => j < NP ? lerp(v, pr[j], rn) : v); }
      }
      if (key === "sample" || key === "loop") { if (key === "sample") p = WHEEL0; rowA = j => (key === "loop" || j < NP ? 1 : 0.15) * (dimGen ? 0 : 0.45); }
      const pickJ = key === "sample" ? PICK[0] : key === "loop" ? PICK[cyc] : -1;
      if (key !== "loss") {
        const barsA = key === "context" ? 1 : 1;
        bars(k, D, z, p, e, { rowA, grow, alpha: barsA, col: (key === "sample" || key === "loop") ? (j => colOf[j % 8]) : null, hi: j => (key === "sample" && sampP > 0.75 || key === "loop" && u > 0.6) && j === pickJ, vals: !(key === "sample" || key === "loop") });
        if (!dimGen) {
          const head = key === "context" ? "Raw scores (logits)" : key === "softmax" ? (e < 0.5 ? "Raw scores (logits)" : "Probabilities") : key === "sample" || key === "loop" ? "Probabilities" : "Probabilities";
          k.label(B.lx - 60, B.y0 - 26, head, { col: C.ink, weight: "600", align: "left", alpha: key === "sample" || key === "loop" ? 0.5 : 1 });
          k.label(B.lx - 60, rowY(NR) + 8, "… and about 128k more tokens", { col: C.muted, size: 11, align: "left", alpha: (key === "sample" || key === "loop" ? 0.5 : 1) * (key === "context" ? clamp01((f.p - 0.8) / 0.1) : 1) });
        }
        if (key === "context" && f.p > 0.6) k.line(B.LZ, B.y0 - 8, B.LZ, rowY(NR - 1) + B.h + 8, { col: C.muted, alpha: 0.6, dash: [3, 4] });
        if (key === "softmax" && e < 0.5) k.line(B.LZ, B.y0 - 8, B.LZ, rowY(NR - 1) + B.h + 8, { col: C.muted, alpha: 0.6 * (1 - e * 2), dash: [3, 4] });
      }
      // softmax: a stacked bar showing the probabilities add up to 100%
      if (key === "softmax" && e > 0.6) {
        const a = clamp01((e - 0.6) / 0.3), yb = rowY(NR) + 30; let x = B.PB;
        p.forEach((v, j) => { k.box(x, yb, Math.max(1, v * B.PS * a), 22, { fill: colOf[j % 8], r: 3, alpha: 0.85 }); x += v * B.PS * a; });
        if (lay.n) k.label(B.PB + B.PS, yb + 40, "all together = 100%", { col: C.ink, weight: "650", align: "right", alpha: a, mono: true });
        else k.label(B.PB + B.PS + 12, yb + 11, "= 100%", { col: C.ink, weight: "650", align: "left", alpha: a, mono: true });
      }
      if (key === "softmax" && !lay.n) { const sum = p.reduce((s2, v, j) => s2 + lerp(z[j], v, e), 0); k.hud("tr", "Softmax", [["showing", e < 0.5 ? "raw scores" : "probabilities"], ["total", e > 0.98 ? "1.00 = 100%" : sum.toFixed(2), e > 0.98 ? C.sig : C.ink]], { w: 190 }); }
      // temperature slider
      if (key === "temp") {
        const y = rowY(NR) + 58, x0 = B.PB, x1 = B.PB + B.PS, tx = lerp(x0, x1, T / 2.5);
        k.line(x0, y, x1, y, { col: C.line, lw: 3 }); k.line(x0, y, tx, y, { col: C.amb, lw: 3 });
        k.dot(tx, y, k.px(8), C.amb, { glow: 14 });
        k.label(tx, y, "T = " + T.toFixed(1), { col: C.amb, mono: true, weight: "650", dy: -18 });
        k.label(x0, y + 22, lay.n ? "safe" : "safe, repetitive", { col: C.muted, size: 11, align: "left" }); k.label(x1, y + 22, lay.n ? "surprising" : "surprising, then nonsense", { col: C.muted, size: 11, align: "right" });
        if (!lay.n) k.hud("tr", "Temperature", [["T", T.toFixed(2), C.amb], ["chance of \"mat\"", (p[0] * 100).toFixed(0) + "%", C.sig], ["chance of \"grass\"", (p[11] * 100).toFixed(1) + "%"]], { w: 190 });
      }
      if (key === "cut") {
        const n = mode === "k" ? K : NP, a = mode === "k" ? clamp01((f.p - 0.08) / 0.08) * (1 - clamp01((f.p - 0.44) / 0.04)) : clamp01((f.p - 0.62) / 0.08);
        const yc = rowY(n) - (B.dy - B.h) / 2;
        k.line(B.lx - 70, yc, B.PB + B.PS + 40, yc, { col: C.amb, lw: 2, dash: [6, 5], alpha: a, glow: 6 });
        k.label(B.PB + 320, yc, lay.n ? (mode === "k" ? "top-k = 5" : "top-p = 0.9") : mode === "k" ? "top-k = 5: keep the 5 best" : "top-p = 0.9: keep until the sum reaches 90%", { col: C.amb, weight: "650", align: "left", dy: 13, alpha: a });
        if (mode === "p") { // running total that decides the top-p cutoff
          const ra = clamp01((f.p - 0.52) / 0.08) * (1 - clamp01((f.p - 0.84) / 0.06)); let c = 0;
          P0.forEach((v, j) => { c += v; const show = clamp01((f.p - 0.52 - j * 0.012) / 0.04); if (j <= NP) k.label(B.PB + B.PS + 40, rowY(j) + B.h / 2, "sum " + Math.round(c * 100) + "%", { col: j === NP - 1 ? C.amb : C.muted, mono: true, size: 11, align: "right", alpha: ra * show * (j < NP ? 1 : 0) }); });
        }
        if (!lay.n) k.hud("br", mode === "k" ? "Top-k" : "Top-p (nucleus)", [["rule", mode === "k" ? "keep 5 best" : "keep until 90%"], ["tokens kept", String(n), C.sig], ["then", "rescale to 100%"]], { w: 200 });
      }
      // ---------- the wheel ----------
      if (key === "sample" || key === "loop") {
        let wp = WHEEL0, wD = D0, ang = 0, pj = PICK[0], glow = 0, wa = 1;
        if (key === "sample") { wa = easeOut(f.p / 0.15); const s = easeOut((f.p - 0.12) / 0.6); ang = landAng(wp, pj, 4) * s; glow = clamp01((f.p - 0.7) / 0.1); }
        else { const pn = renorm(softmax(z, 1), topP(softmax(z, 1), TP)); const prevP = cyc === 1 ? WHEEL0 : renorm(softmax(logits(D1), 1), topP(softmax(logits(D1), 1), TP)); const prevJ = PICK[cyc - 1];
          const mo = easeIO((u - 0.05) / 0.2), s = easeOut((u - 0.25) / 0.4); wD = mo < 0.5 ? (cyc === 1 ? D0 : D1) : D; wp = mo < 0.5 ? prevP : pn; const a0 = landAng(prevP, prevJ, 0);
          ang = mo < 1 ? a0 * (1 - mo) : landAng(wp, PICK[cyc], 3) * s; wa = mo < 1 ? 1 - Math.sin(mo * Math.PI) * 0.6 : 1; pj = mo < 0.5 ? prevJ : PICK[cyc]; glow = mo < 0.5 ? 1 - mo * 2 : clamp01((u - 0.63) / 0.07); }
        wheel(k, lay, wD, wp, ang, wa, pj, glow);
        // the chosen word flies into the text
        const flyK = key === "sample" ? easeIO((f.p - 0.76) / 0.18) : easeIO((u - 0.72) / 0.2);
        const w = key === "sample" ? ADD[0] : ADD[cyc];
        if (flyK > 0) { const slot = nextSlot(lay, words, w), [cx, cy] = lay.wh, x0 = cx - slot.cw / 2, y0 = cy - lay.r - 40; const x = lerp(x0, slot.x, flyK), y = lerp(y0, slot.y, flyK) - Math.sin(flyK * Math.PI) * 60; chip(k, lay, { ...slot, x, y }, { stroke: C.sig, col: C.sig, glow: 14 }); }
        else if (glow > 0.5) k.label(lay.wh[0], lay.wh[1] - lay.r - 52, `picked "${key === "sample" ? ADD[0] : ADD[cyc]}"`, { col: C.sig, weight: "650", size: 13, alpha: glow });
        if (!lay.n) k.hud("br", key === "sample" ? "Sampling" : "One token at a time", key === "sample" ? [["slices", NP + " (after top-p)"], ["chance of \"mat\"", (WHEEL0[0] * 100).toFixed(0) + "%", C.sig]] : [["tokens added", String(cyc + (flyK >= 1 ? 1 : 0))], ["picked", ADD[cyc], C.sig]], { w: 200 });
      }
    }
  });
});
