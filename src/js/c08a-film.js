/* Chapter 8 film: one training step (batch, forward, loss, backward, AdamW update), then many steps and the LR schedule.
   Every frame is a pure function of t. */
chapter("learning", () => {
  const fig = $("#lr-film"); if (!fig) return;
  const narrow = () => (fig.clientWidth || 600) < 640;
  const IN = ["The", "cat", "sat", "on", "the"], OUT = ["cat", "sat", "on", "the", "mat"];
  const GUESS = ["dog", "the", "mat", "a", "on"], PTRUE = [0.02, 0.03, 0.01, 0.04, 0.02];
  const LOSS0 = PTRUE.reduce((a, q) => a - Math.log(q), 0) / PTRUE.length;
  const colX = j => 380 + j * 110, NL = 6, layerY = i => 540 - i * 76, LX0 = 300, LX1 = 920, NC = 14;
  const cellX = c => LX0 + 14 + c * ((LX1 - LX0 - 28) / NC), CS = 30;
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const grad = (i, c) => hash(i + 1, c + 1) * 2 - 1, w0 = (i, c) => 0.2 + 0.6 * hash(i + 7, c + 3);

  const steps = [
    { key: "batch", short: "Batch", title: "A batch of text goes in", dur: 5,
      text: [`Each training step starts with a handful of text snippets from the dataset. For every word, the model will try to guess the word that comes next.`,
             `Each optimiser step uses a mini-batch of a few million tokens, so the slope it measures is a noisy estimate of the slope over all the data (mini-batch stochastic gradient descent).`] },
    { key: "fwd", short: "Forward pass", title: "Forward pass: guess every next word", dur: 5.5,
      text: [`The words flow up through the layers, one after another. At the top the model makes a guess for the next word at every position at once.`,
             `The forward pass costs about 2 FLOPs per parameter per token. Every layer's activations are kept in memory, because the backward pass needs them.`], link: "#ref-7" },
    { key: "loss", short: "Loss", title: "Score the guesses: the loss", dur: 5.5,
      text: [`Each guess is checked against the real next word. The less chance the model gave the right word, the bigger the penalty. The average penalty is the loss.`,
             `Cross-entropy: L = −(1/T) Σ log p(true next token). An untrained model spreads its probability thinly, so the true tokens get little of it and L is high.`] },
    { key: "back", short: "Backward pass", title: "Backward pass: the blame flows down", dur: 6,
      text: [`Now the error travels back down through every layer. Each number in the model finds out which way it should move to make the guess a little better.`,
             `Backpropagation applies the chain rule layer by layer and gives ∂L/∂θ for every weight in one pass. It costs about twice the forward pass: 2 + 4 = 6 FLOPs per parameter per token.`], link: "#ref-7" },
    { key: "update", short: "Update", title: "The optimiser nudges every weight", dur: 6,
      text: [`Every number takes a tiny step in its downhill direction. The steps are small on purpose: too big and training bounces around or flies off.`,
             `AdamW keeps running averages of each weight's gradient (m) and squared gradient (v), steps by η·m̂/(√v̂ + ε) and applies decoupled weight decay. Typical settings: β₁ = 0.9, β₂ = 0.95.`], link: "#ref-68" },
    { key: "repeat", short: "Repeat", title: "Repeat, millions of times", dur: 6.5,
      text: [`Then the next batch comes in and it all happens again. Step after step the loss falls, with a wobble because every batch is different.`,
             `The curve is noisy because each mini-batch gives a different gradient estimate. Large runs watch for loss spikes; some recover, others force a rollback to an earlier checkpoint.`] },
    { key: "sched", short: "Schedule", title: "The step size follows a schedule", dur: 6,
      text: [`At the start the steps begin tiny and grow (warm-up). Near the end they shrink, so the model can settle into the bottom of the valley.`,
             `A short warm-up to a peak learning rate around 10⁻⁴ to 10⁻³, then a decay: cosine, or warmup–stable–decay (WSD), which SmolLM3 and Kimi K2 used. Gradient norms are clipped at 1.0.`], link: "#ref-1" }
  ];
  const wide = {
    default: { x: 0, y: 0, w: 1400, h: 700 },
    batch: { x: 100, y: 340, w: 1000, h: 500 }, fwd: { x: -20, y: -20, w: 1460, h: 730 }, loss: { x: 120, y: -40, w: 1240, h: 620 },
    back: { x: -20, y: -20, w: 1460, h: 730 }, update: { x: 140, y: 150, w: 1200, h: 600 },
    repeat: { x: 1420, y: -10, w: 1440, h: 720 }, sched: { x: 1420, y: 400, w: 1440, h: 720 }
  };
  const tall = {
    default: { x: 150, y: -60, w: 860, h: 900 },
    batch: { x: 150, y: 300, w: 860, h: 620 }, fwd: { x: 150, y: -60, w: 860, h: 900 }, loss: { x: 150, y: -60, w: 1080, h: 960 },
    back: { x: 150, y: -60, w: 1080, h: 960 }, update: { x: 150, y: 100, w: 860, h: 800 },
    repeat: { x: 1460, y: 0, w: 1320, h: 760 }, sched: { x: 1460, y: 480, w: 1320, h: 760 }
  };
  // HUD: on phones, no title, only the rows listed in `keep`, narrower panel
  const hud = (k, corner, nCorner, title, rows, w, keep) => narrow() ? k.hud(nCorner, "", keep.map(i => rows[i]), { w: 180 }) : k.hud(corner, title, rows, { w });
  const cams = new Proxy({}, { get: (_, key) => (narrow() ? tall : wide)[key] });

  function chip(k, cx, cy, word, o = {}) {
    const C = k.C, w = 22 + word.length * 13;
    k.box(cx - w / 2, cy - 18, w, 36, { fill: o.fill || C.bg2, stroke: o.stroke || C.line, r: 8, alpha: o.alpha, glow: o.glow || 0 });
    k.text(cx, cy + 1, word, { col: o.col || C.ink, size: 17, weight: "600", alpha: o.alpha });
  }
  function arrow(k, x, y, g, col, a) { // vertical arrow pointing the way the weight should move (against the gradient)
    const len = (8 + 16 * Math.abs(g)) * a, dir = g > 0 ? 1 : -1, y2 = y + dir * len; if (a <= 0.02) return;
    k.line(x, y, x, y2, { col, lw: 1.6, alpha: a });
    k.line(x, y2, x - 4, y2 - dir * 5, { col, lw: 1.6, alpha: a }); k.line(x, y2, x + 4, y2 - dir * 5, { col, lw: 1.6, alpha: a });
  }
  // the network: layers with weight cells; light(i) gives a glow colour/amount per layer; arrows(i) 0..1
  function network(k, f, o) {
    const C = k.C;
    for (let i = 0; i < NL; i++) {
      const y = layerY(i), L = o.light ? o.light(i) : null;
      k.box(LX0, y - 22, LX1 - LX0, 44, { fill: C.bg2, stroke: L ? L.col : C.line, r: 10, glow: L ? 16 * L.a : 0, glowCol: L ? L.col : null, alpha: 1 });
      if (L && L.a > 0.05) k.box(LX0, y - 22, LX1 - LX0, 44, { fill: L.col, r: 10, alpha: 0.18 * L.a });
      k.label(LX0 - 14, y, "Layer " + (i + 1), { align: "right", col: L && L.a > 0.3 ? C.ink : C.muted, size: 11 });
      const ar = o.arrows ? o.arrows(i) : 0;
      for (let c = 0; c < NC; c++) {
        const x = cellX(c), v = o.value ? o.value(i, c) : w0(i, c);
        k.box(x, y - CS / 2, CS - 6, CS, { stroke: C.line, r: 4, alpha: 0.9 });
        k.box(x + 3, y + CS / 2 - 3 - v * (CS - 6), CS - 12, 2.5, { fill: C.ink, r: 1, alpha: 0.75 });
        if (ar > 0) arrow(k, x + (CS - 6) / 2 + 14, y, -grad(i, c) * 0.9, C.amb, Math.min(1, ar));
      }
      if (o.saved && o.saved(i) > 0) { k.dot(LX1 + 18, y, 5, C.sig, { alpha: o.saved(i), glow: 8 }); }
    }
    if (o.saved && o.saved(0) > 0 && !narrow()) k.label(LX1 + 30, layerY(0), "activations kept", { align: "left", col: C.sig, size: 11, alpha: o.saved(0) });
  }
  function inputs(k, a = 1) { IN.forEach((w, j) => chip(k, colX(j), 640, w, { alpha: a })); }
  function lossBox(k, val, a, glow) {
    const C = k.C; if (a <= 0) return;
    k.box(1000, 40, 200, 80, { fill: C.bg2, stroke: C.amb, r: 12, alpha: a, glow: glow || 0, glowCol: C.amb });
    k.text(1100, 64, "loss", { col: C.muted, size: 15, alpha: a });
    k.text(1100, 94, val, { col: C.amb, size: 26, mono: true, weight: "700", alpha: a });
  }

  // illustrative loss curve: power-law fall plus deterministic noise and one small spike that recovers
  const lossAt = s => 2.3 + 8.4 / Math.pow(1 + s / 0.012, 0.55) + 0.09 * (hash(Math.floor(s * 900), 3) - 0.5) * (1.2 - s) + 0.5 * Math.exp(-Math.pow((s - 0.42) / 0.006, 2));
  const LC = { x: 1640, y: 60, w: 1120, h: 500 }, LR = { x: 1640, y: 760, w: 1120, h: 300 };
  const lmax = 10.7, lmin = 2;
  const lPt = s => [LC.x + s * LC.w, LC.y + LC.h - (lossAt(s) - lmin) / (lmax - lmin) * LC.h];
  const lrWSD = s => s < 0.06 ? s / 0.06 : s < 0.8 ? 1 : 1 - (s - 0.8) / 0.2 * 0.95;
  const lrCos = s => s < 0.06 ? s / 0.06 : 0.05 + 0.95 * 0.5 * (1 + Math.cos(Math.PI * (s - 0.06) / 0.94));
  function axes(k, R, xl, yl) {
    const C = k.C; k.line(R.x, R.y + R.h, R.x + R.w, R.y + R.h, { col: C.line }); k.line(R.x, R.y, R.x, R.y + R.h, { col: C.line });
    k.label(R.x + R.w, R.y + R.h + 20, xl, { align: "right", col: C.muted, size: 11 }); k.label(R.x + 8, R.y - 14, yl, { align: "left", col: C.muted, size: 11 });
  }
  function miniNet(k, f, ph) { // small stack beside the chart: teal up, amber down, once per cycle
    const C = k.C, x = 1490, w = 90;
    for (let i = 0; i < NL; i++) {
      const y = 470 - i * 70, up = ph < 0.5, wave = up ? ph * 2 * (NL + 1) : (1 - ph) * 2 * (NL + 1), a = clamp01(1 - Math.abs(wave - i - 0.5));
      const col = up ? C.sig : C.amb;
      k.box(x, y - 16, w, 32, { fill: C.bg2, stroke: a > 0.1 ? col : C.line, r: 7, glow: 12 * a, glowCol: col });
      if (a > 0.1) k.box(x, y - 16, w, 32, { fill: col, r: 7, alpha: 0.25 * a });
    }
    k.label(x + w / 2, 530, "one step", { col: C.muted, size: 11 });
  }

  storyFilm(fig, {
    label: "Animated explanation of one training step",
    steps, cams,
    draw(k, f) {
      const C = k.C, p = f.p, key = f.key;
      if (key === "batch") {
        // four snippets fly in and stack; the front one is the sentence we follow
        const others = [["Water", "boils", "at", "100", "°C"], ["def", "add", "(", "a", ","], ["In", "1969", ",", "Apollo", "11"]];
        [IN, ...others].forEach((ws, r) => {
          const u = easeOut((p - 0.04 - r * 0.1) / 0.35), y = 640 + r * 52;
          ws.forEach((w, j) => chip(k, colX(j) + (1 - u) * -1000, y, w, r === 0 ? { stroke: p > 0.6 ? C.sig : C.line, glow: p > 0.6 ? 8 : 0 } : { col: C.muted }));
        });
        const ba = clamp01((p - 0.45) / 0.15);
        k.box(colX(0) - 70, 612, 4, 3 * 52 + 56, { fill: C.sig, r: 2, alpha: ba });
        k.label(colX(0) - 82, 640 + 78, "batch", { align: "right", col: C.sig, alpha: ba });
        network(k, f, {});
        // target hint: each word's answer is the next word
        const a = clamp01((p - 0.7) / 0.12);
        if (a > 0) IN.forEach((w, j) => k.label(colX(j) + 32, 604, "→ " + OUT[j], { col: C.sig, size: 11, alpha: a }));
        hud(k, "tr", "tl", "This batch", [["snippets shown", "4"], ["real batches", "a few million tokens", C.sig]], 230, [0]);
        return;
      }
      if (key === "fwd" || key === "loss") {
        const fw = key === "fwd" ? p : 1, wave = fw * (NL + 2) - 1;
        network(k, f, {
          light: i => key === "fwd" ? { col: C.sig, a: clamp01(1 - Math.abs(wave - i) / 1.2) } : null,
          saved: i => key === "fwd" ? clamp01((wave - i) / 0.6) : 0.6
        });
        inputs(k);
        if (key === "fwd") IN.forEach((_, j) => { const x = colX(j), top = 540 - clamp01(fw * 1.1) * 470;
          k.flow(u => [x, lerp(620, Math.min(620, top), u)], 3, f.t * 0.9 + j * 0.21, C.sig, { len: 0.12, size: 3.2 }); });
        const ga = key === "fwd" ? clamp01((p - 0.8) / 0.15) : 1;
        GUESS.forEach((w, j) => chip(k, colX(j), 70, w, { alpha: ga, stroke: key === "loss" && p > 0.2 ? C.amb : C.line }));
        if (!narrow()) k.label(LX0 - 14, 70, "model's guess", { align: "right", col: C.muted, size: 11, alpha: ga });
        if (key === "fwd") { k.label(LX0 - 14, 70, "", { align: "right", col: C.muted, size: 11, alpha: ga }); hud(k, "tr", "bl", "Forward pass", [["cost", "≈ 2 FLOPs / param / token"], ["layers done", String(Math.max(0, Math.min(NL, Math.floor(wave + 0.5)))), C.sig]], 250, [1]); return; }
        // loss step: truth chips, probabilities, penalty flies into the loss box
        const ta = clamp01(p / 0.15);
        OUT.forEach((w, j) => {
          const x = colX(j); chip(k, x, -6, w, { alpha: ta, stroke: C.sig, col: C.sig });
          const pa = clamp01((p - 0.2 - j * 0.06) / 0.12);
          if (!narrow()) k.label(x, 30, "p = " + PTRUE[j].toFixed(2), { col: C.ink, size: 12, alpha: pa, mono: true });
          const fly = clamp01((p - 0.45 - j * 0.04) / 0.25);
          if (fly > 0 && fly < 1) { const pts = []; for (let q = 6; q >= 0; q--) { const uu = Math.max(0, fly - q * 0.04); pts.push(bez([[x, 40], [x, 130], [900, 160], [1000, 90]], uu)); } k.trail(pts, C.amb, { w: 3 }); }
        });
        if (!narrow()) k.label(LX0 - 14, -6, "real next word", { align: "right", col: C.sig, size: 11, alpha: ta });
        const shown = clamp01((p - 0.55) / 0.3);
        lossBox(k, (LOSS0 * easeOut(shown)).toFixed(2), clamp01((p - 0.4) / 0.1), 14 * shown);
        hud(k, "br", "bl", "Cross-entropy", [["penalty per word", "−log p"], ["loss = average", LOSS0.toFixed(2), C.amb]], 210, [0, 1]);
        return;
      }
      if (key === "back") {
        const wave = p * (NL + 2) - 1, dn = i => NL - 1 - i; // top layer first
        network(k, f, {
          light: i => ({ col: C.amb, a: clamp01(1 - Math.abs(wave - dn(i)) / 1.2) }),
          arrows: i => clamp01((wave - dn(i)) / 0.8), saved: i => 0.6 * (1 - clamp01((wave - dn(i)) / 0.8))
        });
        inputs(k, 0.5);
        lossBox(k, LOSS0.toFixed(2), 1, 10);
        IN.forEach((_, j) => { const x = colX(j), bottom = 120 + clamp01(p * 1.1) * 450;
          k.flow(u => [x, lerp(110, bottom, u)], 3, f.t * 0.9 + j * 0.23, C.amb, { len: 0.12, size: 3.2 }); });
        hud(k, "br", "bl", "Backward pass", [["cost", "≈ 2 × forward"], ["per token", "2 + 4 = 6 FLOPs / param"], ["layers done", String(Math.max(0, Math.min(NL, Math.floor(wave + 0.5)))), C.amb]], 250, [0, 2]);
        return;
      }
      if (key === "update") {
        const u = easeIO((p - 0.25) / 0.5), lr = 0.12;
        network(k, f, { arrows: () => 1 - 0.7 * u, value: (i, c) => w0(i, c) - lr * grad(i, c) * u, light: i => i === 3 ? { col: C.sig, a: 0.25 + 0.4 * u } : null });
        // one weight spotlit
        const x = cellX(5), y = layerY(3), a = clamp01(p / 0.15);
        k.box(x - 6, y - CS / 2 - 6, CS + 6, CS + 12, { stroke: C.ink, r: 6, alpha: a, glow: 10 });
        const wOld = 0.4210, g = 0.80, m = 0.9 * 0.50 + 0.1 * g, v = 0.95 * 0.40 + 0.05 * g * g, step = 3e-4 * m / Math.sqrt(v);
        const rows = [["gradient g", g.toFixed(2), C.amb], ["m = 0.9·m + 0.1·g", m.toFixed(3)], ["v = 0.95·v + 0.05·g²", v.toFixed(3)], ["step η·m/√v", "−" + step.toExponential(1)], ["weight", (wOld - step * u).toFixed(5), C.sig]];
        hud(k, "tr", "bl", "AdamW, one weight", rows, 250, [0, 4]);
        return;
      }
      // ---- many steps: the loss curve, then the schedule ----
      const sNow = key === "repeat" ? easeIO(p * 1.02) * 0.995 + 0.005 : 1;
      axes(k, LC, "training steps →", "loss");
      const pts = []; for (let s = 0; s <= sNow; s += 0.0025) pts.push(lPt(s));
      if (pts.length > 1) { const c = k.ctx; c.save(); c.strokeStyle = C.sig; c.lineWidth = k.px(2); c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.restore(); }
      const [hx, hy] = lPt(Math.min(sNow, 1));
      if (key === "repeat") {
        k.dot(hx, hy, k.px(5), C.sig, { glow: 12 });
        miniNet(k, f, (f.t * 1.6) % 1);
        if (sNow > 0.45 && !narrow()) k.label(...lPt(0.42), "a small spike, then recovery", { col: C.muted, size: 11, dy: -26 });
        hud(k, "tr", "tr", "Training run", [["run progress", Math.round(sNow * 100) + "%"], ["loss", lossAt(sNow).toFixed(2), C.sig]], 190, [1]);
        return;
      }
      // schedule
      const sc = clamp01((p - 0.05) / 0.85);
      axes(k, LR, "training steps →", "learning rate");
      const curve = (fn, col, dash, upto) => { const c = k.ctx; c.save(); c.strokeStyle = col; c.lineWidth = k.px(2); if (dash) c.setLineDash(dash.map(k.px)); c.beginPath(); for (let s = 0; s <= upto; s += 0.004) { const x = LR.x + s * LR.w, y = LR.y + LR.h - fn(s) * (LR.h - 30); s ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); };
      curve(lrCos, C.muted, [6, 5], sc); curve(lrWSD, C.amb, null, sc);
      const mx = LR.x + sc * LR.w, my = LR.y + LR.h - lrWSD(sc) * (LR.h - 30);
      k.dot(mx, my, k.px(5), C.amb, { glow: 12 });
      k.line(mx, LC.y + LC.h, mx, LR.y + LR.h, { col: C.line, dash: [3, 4], alpha: 0.8 });
      const [lx, ly] = lPt(Math.max(0.005, sc)); k.dot(lx, ly, k.px(4.5), C.sig, { glow: 10 });
      const la = (x, y, s, col, at) => k.label(x, y, s, { col, size: 11, alpha: clamp01((sc - at) / 0.05) });
      la(LR.x + 0.03 * LR.w, LR.y + LR.h + 20, "warm-up", C.ink, 0.03); la(LR.x + 0.45 * LR.w, LR.y + 14, "stable", C.amb, 0.3); la(LR.x + 0.9 * LR.w, LR.y + LR.h - 70, "decay", C.amb, 0.85);
      if (!narrow()) la(LR.x + 0.62 * LR.w, LR.y + 0.55 * LR.h, "cosine (dashed)", C.muted, 0.6);
      hud(k, "tr", "tr", "Learning-rate schedule", [["peak", "≈ 10⁻⁴ to 10⁻³"], ["now", (lrWSD(sc) * 100).toFixed(0) + "% of peak", C.amb], ["gradient clipping", "norm 1.0"]], 220, [1]);
    }
  });
});
