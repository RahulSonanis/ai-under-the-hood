/* Chapter 4 film: one trip through a transformer.
   Left of the world: the whole stack (tokens, residual stream, layers, unembedding at the top).
   Right of the world: a close-up of one layer (attention, heads, MLP, experts, residual adds). */
chapter("inside", () => {
  const fig = $("#in-film"); if (!fig) return;
  const words = ["The", "animal", "was", "tired", "so", "it"], N = words.length;
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const base = (j, r) => 0.15 + 0.85 * hash(j + 1, r + 1);
  const headCol = ["#8fb3ff", "#d59cff", "#ff8fa3"];
  // overview: the whole stack
  const O = { cx: j => 110 + j * 96, x: 50, w: 600, L: 8, sy: l => 456 - l * 44, sh: 34, ZL: 3 };
  const layerName = ["Layer 1", "2", "3", "4", "…", "30", "31", "Layer 32"];
  const OV = { w: 22, h: 10, g: 3 };
  // close-up of one layer
  const D = { x: 700, y: 110, w: 940, h: 630, cx: j => 900 + j * 140, vecY: 600, wordY: 724, attY: 380, attH: 190, keyY: 556, addA: 358, mlpY: 192, mlpH: 136, addM: 170, top: 120 };
  const DV = { w: 28, h: 14, g: 4 };
  const BX = { x: 860, w: 770 };

  const steps = [
    { key: "enter", short: "Tokens in", title: "Each token becomes a column of numbers", dur: 6,
      text: [`Each token is turned into a list of numbers, drawn here as a column of cells. The columns ride up a "residual stream" through a tall stack of identical layers.`,
             `Each token ID selects a row of the embedding matrix: a vector of width d (4,096 in Llama 3 8B). These vectors form the residual stream that passes through all 32 layers.`] },
    { key: "attn", short: "Attention", title: "Attention looks back, never forward", dur: 7,
      text: [`Inside a layer, each word asks a question (its query) and compares it with every earlier word's label (its key). Thicker lines mean more attention. Later words are hidden, so a word can only look back.`,
             `Scores are q·k / √d_k for each earlier position; the causal mask sets future positions to −∞; softmax turns the scores into weights, and the weighted sum of the values updates this position.`], link: "#ref-5" },
    { key: "heads", short: "Many heads", title: "Several heads look for different things", dur: 6,
      text: [`Many attention "heads" run side by side, each free to look for something different. Here one follows the previous word, one links "it" to "animal", and one rests on the first word.`,
             `Multi-head attention runs h heads with their own W_Q, W_K and W_V, concatenates their outputs and projects with W_O. Previous-token, coreference and attention-sink patterns have all been observed in trained models.`], link: "#ref-61" },
    { key: "mlp", short: "MLP", title: "The MLP works on each position alone", dur: 5.5,
      text: [`Next, every word's column goes through the same small network, one column at a time, with no looking around. Most of the model's parameters live here.`,
             `The SwiGLU MLP, W₂(SiLU(W₁x) ⊙ W₃x), is applied independently at each position with shared weights: 3·d·d_ff parameters per layer, most of the model.`], link: "#ref-1" },
    { key: "moe", short: "Experts", title: "Some models send each token to a few experts", dur: 6.5,
      text: [`In a mixture of experts, the MLP is split into many specialist networks. A router sends each word to just 2 of 8 of them. All 8 must be stored, but each word only uses 2.`,
             `The router computes g = softmax(W_r h) and keeps the top-k experts: y = Σ gᵢ·Eᵢ(h). Eight experts with top-2 is a sparsity of 4, as in Mixtral. DeepSeek-V3 activates 37B of its 671B parameters per token.`], link: "#ref-10" },
    { key: "add", short: "Residual add", title: "Each block adds its result to the stream", dur: 6,
      text: [`Nothing gets thrown away. Each block's result is added on top of the column it read, so the column carries everything forward to the next layer.`,
             `A pre-norm block: h ← h + Attn(Norm(h)), then h ← h + MLP(Norm(h)). The residual stream keeps the same width d all the way up.`] },
    { key: "stack", short: "The stack", title: "The same two steps repeat, layer after layer", dur: 6,
      text: [`The same "look around, then think" pair repeats in every layer. Each pass makes every column a little richer.`,
             `Llama 3 8B stacks 32 such layers at width 4,096; the 70B has 80 layers at width 8,192. A forward pass costs roughly 2 FLOPs per parameter per token.`], link: "#ref-7" },
    { key: "out", short: "Next token", title: "The last column becomes next-token odds", dur: 6.5,
      text: [`At the top, only the last word's column is used. It gets a score for every token the model knows, and the scores become probabilities for the next one.`,
             `The final hidden state at the last position is normalised and multiplied by the unembedding matrix (|V| × d) to give one logit per vocabulary entry; softmax turns them into P(next token). Probabilities shown are illustrative.`] }
  ];
  const camsN = {
    enter: { x: -40, y: 120, w: 700, h: 580 },
    attn: { x: 850, y: 330, w: 790, h: 430 }, heads: { x: 850, y: 330, w: 790, h: 430 },
    mlp: { x: 840, y: 140, w: 800, h: 440 }, moe: { x: 840, y: 140, w: 800, h: 440 },
    add: { x: 850, y: 100, w: 790, h: 650 },
    out: { x: 470, y: -250, w: 650, h: 440 }
  };
  const cams = {
    default: { x: -90, y: 110, w: 860, h: 600 },
    enter: { x: -90, y: 110, w: 860, h: 600 },
    attn: { x: 690, y: 300, w: 960, h: 460 }, heads: { x: 690, y: 300, w: 960, h: 460 },
    mlp: { x: 660, y: 110, w: 990, h: 480 }, moe: { x: 660, y: 110, w: 990, h: 480 },
    add: { x: 680, y: 96, w: 970, h: 660 },
    stack: { x: -60, y: 20, w: 1720, h: 760 },
    out: { x: 230, y: -262, w: 880, h: 410 }
  };

  // ---------- helpers ----------
  function vec(k, cx, top, vals, s, o = {}) {
    const C = k.C, a = o.alpha == null ? 1 : o.alpha, H = vals.length * (s.h + s.g) - s.g;
    if (o.glow) k.box(cx - s.w / 2 - 4, top - 4, s.w + 8, H + 8, { stroke: o.glowCol || C.sig, r: 5, glow: o.glow, alpha: a });
    if (o.dash) k.box(cx - s.w / 2 - 4, top - 4, s.w + 8, H + 8, { stroke: C.line, r: 5, dash: [3, 3], alpha: a });
    vals.forEach((v, r) => k.box(cx - s.w / 2, top + r * (s.h + s.g), s.w, s.h, { fill: o.grey ? C.line : (o.col || C.sig), r: 3, alpha: a * (o.grey ? 0.55 : 0.2 + 0.8 * v) }));
  }
  const vals = (j, mix) => [0, 1, 2, 3, 4, 5].map(r => mix ? mix(r) : base(j, r));
  const after = (j, stage) => [0, 1, 2, 3, 4, 5].map(r => clamp01(base(j, r) + (stage >= 1 ? 0.32 * (hash(j + 20, r) - 0.5) : 0) + (stage >= 2 ? 0.32 * (hash(j + 40, r) - 0.5) : 0)));
  function plus(k, x, y, a, hot) {
    const C = k.C, col = hot ? C.amb : C.line;
    k.dot(x, y, 10, C.bg2, { alpha: a }); k.box(x - 10, y - 10, 20, 20, { stroke: col, r: 10, alpha: a, glow: hot ? 14 : 0, glowCol: C.amb });
    k.line(x - 5, y, x + 5, y, { col, alpha: a }); k.line(x, y - 5, x, y + 5, { col, alpha: a });
  }
  const arcP = (xa, xb, y, lift) => [[xa, y], [xa, y - lift], [xb, y - lift], [xb, y]];
  const liftOf = (dx, m = 1) => (30 + 0.25 * Math.abs(dx)) * m;
  function attnW(q) {
    if (q === 5) return [0.07, 0.52, 0.06, 0.13, 0.1, 0.12];
    const s = []; for (let j = 0; j <= q; j++) s.push(Math.exp(2.2 * hash(q * 7, j * 3) + (j === q - 1 ? 0.8 : 0)));
    const z = s.reduce((a, b) => a + b, 0); return s.map(x => x / z);
  }
  const blendOf = q => { const w = attnW(q); return r => clamp01(w.reduce((a, wj, j) => a + wj * base(j, r), 0) * 1.25); };
  const headsW = [[0.03, 0.04, 0.03, 0.08, 0.78, 0.04], [0.05, 0.7, 0.06, 0.1, 0.04, 0.05], [0.72, 0.06, 0.05, 0.06, 0.05, 0.06]];
  const headName = ["previous word", "who is “it”", "first word"];
  const experts = [[1, 4], [6, 2], [3, 7], [0, 5], [2, 6], [1, 3]], gates = [[0.62, 0.38], [0.55, 0.45], [0.7, 0.3], [0.51, 0.49], [0.66, 0.34], [0.58, 0.42]];
  const EX = i => 905 + i * 88, EW = 74;
  const vocab = [["slept", 0.38], ["lay", 0.17], ["stayed", 0.12], ["fell", 0.08], ["went", 0.06], ["was", 0.05]];

  // ---------- overview ----------
  function overview(k, f, o) {
    const C = k.C;
    // streams
    for (let j = 0; j < N; j++) k.line(O.cx(j), 540, O.cx(j), 140, { col: C.sig, alpha: 0.22, lw: 2 });
    for (let l = 0; l < O.L; l++) {
      const y = O.sy(l), hot = o.wave ? Math.max(0, 1 - Math.abs(o.wave - l) / 1.1) : 0, zoom = l === O.ZL && o.zoom;
      k.box(O.x, y, O.w, O.sh, { fill: C.bg2, stroke: zoom ? C.sig : C.line, r: 8, alpha: 0.95, glow: zoom ? 10 : 0 });
      if (hot > 0) k.box(O.x, y, O.w, O.sh, { fill: C.amb, r: 8, alpha: 0.35 * hot, glow: 22 * hot, glowCol: C.amb });
      for (let j = 0; j < N; j++) k.dot(O.cx(j), y + O.sh / 2, 3, C.sig, { alpha: 0.35 + 0.6 * hot });
      k.label(O.x - 10, y + O.sh / 2, layerName[l], { align: "right", size: 11, col: zoom ? C.ink : C.muted });
    }
    // chips and embeddings
    for (let j = 0; j < N; j++) {
      const a = o.chipA ? o.chipA(j) : 1, e = o.embA ? o.embA(j) : 1, x = O.cx(j);
      if (a > 0) { k.box(x - 42, 640 + (1 - a) * 8, 84, 32, { fill: C.bg2, stroke: C.line, r: 8, alpha: a }); k.text(x, 657 + (1 - a) * 8, words[j], { size: 15, weight: "600", alpha: a }); }
      if (e > 0) vec(k, x, 548, vals(j), OV, { alpha: e });
    }
  }
  function funnel(k, a) {
    const C = k.C, y0 = O.sy(O.ZL);
    k.line(O.x + O.w, y0, D.x, D.y, { col: C.sig, alpha: 0.35 * a, dash: [4, 5] });
    k.line(O.x + O.w, y0 + O.sh, D.x, D.y + D.h, { col: C.sig, alpha: 0.35 * a, dash: [4, 5] });
  }
  // ---------- close-up frame ----------
  function frame(k, f, o = {}) {
    const C = k.C;
    k.box(D.x, D.y, D.w, D.h, { fill: C.bg2, alpha: 0.35, r: 18 }); k.box(D.x, D.y, D.w, D.h, { stroke: C.line, r: 18 });
    const nw = k.W < 560, lx = nw ? BX.x + 10 : D.x + 16;
    k.label(nw ? BX.x : lx, D.y + 18, "Inside layer 4", { align: "left", col: C.ink, weight: "600" });
    for (let j = 0; j < N; j++) k.line(D.cx(j), D.vecY, D.cx(j), D.top, { col: C.sig, alpha: 0.18, lw: 2 });
    k.box(BX.x, D.attY, BX.w, D.attH, { fill: C.bg2, stroke: o.attHot ? C.sig : C.line, r: 12, alpha: 0.9 });
    k.box(BX.x, D.mlpY, BX.w, D.mlpH, { fill: C.bg2, stroke: o.mlpHot ? C.amb : C.line, r: 12, alpha: 0.9 });
    k.label(lx, nw ? D.attY + 14 : D.attY + D.attH / 2, "Attention", { align: "left", col: o.attHot ? C.ink : C.muted, weight: o.attHot ? "650" : "500" });
    k.label(lx, nw ? D.mlpY + 14 : D.mlpY + D.mlpH / 2, o.moe ? "Experts" : "MLP", { align: "left", col: o.mlpHot ? C.ink : C.muted, weight: o.mlpHot ? "650" : "500" });
    for (let j = 0; j < N; j++) { plus(k, D.cx(j), D.addA, 1, o.hotA && o.hotA(j)); plus(k, D.cx(j), D.addM, 1, o.hotM && o.hotM(j)); }
    for (let j = 0; j < N; j++) {
      const fut = o.future != null && j > o.future;
      k.text(D.cx(j), D.wordY, words[j], { size: 17, weight: "600", col: fut ? C.muted : C.ink, alpha: fut ? 0.6 : 1 });
      if (!o.hideIn) vec(k, D.cx(j), D.vecY, o.inVals ? o.inVals(j) : vals(j), DV, { grey: fut, alpha: fut ? 0.7 : 1, glow: o.glowCol && o.glowCol(j) ? 12 : 0 });
    }
  }
  function mlpGlyph(k, cx, a, hot, seed) {
    const C = k.C, y0 = D.mlpY + D.mlpH / 2, c = k.ctx;
    c.save(); c.globalAlpha = a; c.beginPath(); c.moveTo(cx - 16, y0 + 52); c.lineTo(cx + 16, y0 + 52); c.lineTo(cx + 48, y0); c.lineTo(cx + 16, y0 - 52); c.lineTo(cx - 16, y0 - 52); c.lineTo(cx - 48, y0); c.closePath();
    c.fillStyle = C.bg; c.fill(); if (hot > 0) { c.save(); c.globalAlpha = a * 0.35 * hot; c.shadowColor = C.amb; c.shadowBlur = 20 * hot; c.fillStyle = C.amb; c.fill(); c.restore(); }
    c.strokeStyle = hot > 0.2 ? C.amb : C.line; c.lineWidth = k.px(1.5); c.stroke(); c.restore();
    for (let q = 0; q < 7; q++) { const on = hot > 0 && hash(seed * 13 + q, Math.floor(hot * 5)) > 0.45; k.dot(cx - 36 + q * 12, y0, 3.5, on ? C.amb : C.line, { alpha: a * (on ? 0.6 + 0.4 * hot : 0.8), glow: on ? 8 : 0 }); }
  }
  function headArcs(k, q, w, col, a, ph, m, off) {
    const C = k.C, xq = D.cx(q) + off;
    for (let j = 0; j < q; j++) {
      const xk = D.cx(j) + off, P = arcP(xq, xk, D.keyY, liftOf(xq - xk, m));
      k.curve(P, { col, lw: 1 + 9 * w[j], alpha: a * (0.3 + 0.65 * Math.min(1, w[j] * 2)) });
      if (ph != null && w[j] > 0.06) { const R = [P[3], P[2], P[1], P[0]]; k.flow(u => bez(R, u), 1 + Math.round(w[j] * 4), ph + j * 0.17, col, { size: 2 + 3 * w[j], alpha: a, len: 0.12 }); }
    }
  }
  function qk(k, x, s, hot, col) {
    const C = k.C; k.dot(x, D.keyY, 10, C.bg2); k.box(x - 10, D.keyY - 10, 20, 20, { stroke: col || (hot ? C.ink : C.sig), r: 10, glow: hot ? 10 : 0 });
    k.text(x, D.keyY + 1, s, { size: 12, mono: true, weight: "600", col: col || (hot ? C.ink : C.sig) });
  }

  const camsW = Object.fromEntries(Object.keys(camsN).map(key => [key, cams[key]]));
  storyFilm(fig, {
    height: () => { const st = $(".scene-stage", fig), h = stageH(st); Object.assign(cams, innerW(st) < 560 ? camsN : camsW); cams.default = cams.enter; return h; },
    label: "Animated explanation of one forward pass through a transformer",
    steps, cams,
    draw(k, f) {
      const C = k.C, wide = k.W >= 560, i = f.i, p = f.p;
      // ---------- overview (always drawn; the camera decides what is seen) ----------
      let wave = null; if (f.key === "stack") wave = p * 1.2 * (O.L + 1) - 0.6;
      overview(k, f, {
        chipA: f.key === "enter" ? j => easeOut((p - j * 0.05) / 0.12) : null,
        embA: f.key === "enter" ? j => easeOut((p - 0.18 - j * 0.05) / 0.12) : null,
        zoom: i >= 1 && i <= 5, wave
      });
      if (f.key === "enter") {
        const a = clamp01((p - 0.42) / 0.15);
        for (let j = 0; j < N; j++) { const x = O.cx(j); k.flow(u => [x, 540 - u * 400], 3, f.t * 0.32 + j * 0.13, C.sig, { alpha: a, size: 3, len: 0.1 }); }
        // token -> vector arrows
        for (let j = 0; j < N; j++) { const e = easeOut((p - 0.18 - j * 0.05) / 0.12); if (e > 0 && e < 1) k.flow(u => [O.cx(j), 640 - u * 20], 1, p * 3, C.sig, { alpha: 1 - e }); }
        if (wide) k.label(O.x + O.w + 14, 586, "embedding", { align: "left", alpha: clamp01((p - 0.2) / 0.1) });
        if (wide) k.label(O.x + O.w + 14, 300, "residual stream", { align: "left", col: C.sig, alpha: a });
        if (wide) k.hud("tr", "One forward pass", [["tokens in", String(N)], ["numbers per token", "4,096"], ["layers", "32"]], { w: 200 });
        return;
      }
      if (i >= 1) funnel(k, f.key === "out" ? 0 : 1);
      // final vectors at the top of the stack
      if (f.key === "stack" || f.key === "out") {
        for (let j = 0; j < N; j++) {
          const a = f.key === "stack" ? clamp01((wave - O.L + 0.6) / 0.5) : 1, last = j === N - 1;
          vec(k, O.cx(j), 50, after(j + 3, 2), OV, { alpha: a * (f.key === "out" && !last ? 0.3 : 1), glow: f.key === "out" && last ? 12 : 0 });
        }
      }
      if (f.key === "stack") {
        for (let j = 0; j < N; j++) { const x = O.cx(j), yw = O.sy(Math.max(0, Math.min(O.L - 1, wave))) + O.sh / 2; if (wave < O.L - 0.4) vec(k, x, yw - 37, after(j, Math.min(2, Math.floor(wave / 2))), OV, { glow: 10 }); }
        const n = Math.max(1, Math.min(32, Math.round(clamp01((wave + 0.5) / O.L) * 32)));
        k.hud("tr", "Through the stack", [["layer", `${n} of 32`, C.amb], ["in each layer", "attention, then MLP"]], { w: 220 });
      }
      if (f.key === "out") {
        frame(k, f, {}); for (let j = 0; j < N; j++) mlpGlyph(k, D.cx(j), 1, 0, j);
        const xv = O.cx(N - 1), mx = 640, my = -70, mw = 54, mh = 110;
        const pa = clamp01((p - 0.08) / 0.15), pb = clamp01((p - 0.3) / 0.35);
        k.flow(u => [xv + 14 + u * (mx - xv - 14), 88 - u * (88 - (my + mh / 2)) * u], 2, f.t * 0.6, C.sig, { alpha: pa });
        // unembedding matrix
        for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) { const on = hash(r * 5 + c, Math.floor(f.t * 6)) > 0.6 && p > 0.15 && p < 0.7; k.box(mx + c * 11, my + r * 12.5, 8, 9.5, { fill: on ? C.amb : C.line, r: 2, alpha: on ? 0.9 : 0.6, glow: on ? 6 : 0 }); }
        k.label(mx + mw / 2 - 3, my + mh + 16, "unembedding", { size: 11, col: p > 0.15 && p < 0.7 ? C.amb : C.muted });
        const bx = 790, b0 = 870, bw = 200;
        vocab.forEach(([w, pr], r) => {
          const y = -205 + r * 38, g = easeOut((pb - r * 0.06) / 0.5), best = r === 0 && p > 0.72;
          k.curve([[mx + mw, my + mh / 2], [mx + mw + 40, my + mh / 2], [bx - 50, y], [bx - 8, y]], { col: C.line, alpha: 0.7 * pa });
          k.text(bx, y, w, { align: "left", size: 15, weight: best ? "700" : "500", col: best ? C.sig : C.ink, alpha: Math.max(0.2, g) });
          k.box(b0, y - 9, Math.max(2, bw * pr / 0.38 * g), 18, { fill: best ? C.sig : C.muted, r: 4, alpha: best ? 1 : 0.7, glow: best ? 12 : 0 });
          if (g > 0.5) k.text(b0 + bw * pr / 0.38 * g + 8, y + 1, Math.round(pr * 100) + "%", { align: "left", size: 13, mono: true, col: C.muted, alpha: (g - 0.5) * 2 });
        });
        k.text(bx, -205 + 6 * 38, "… and every other token", { align: "left", size: 13, col: C.muted, alpha: pb });
        if (p > 0.72) k.label(wide ? xv : xv - 16, -14, "next token: slept", { align: wide ? "center" : "left", col: C.sig, weight: "650", size: 13, alpha: clamp01((p - 0.72) / 0.1) });
        if (wide) k.label(xv, 150 - 8, "only the last position is used", { size: 11, alpha: pa, dy: 0 });
        if (wide) k.hud("tl", "Next-token odds (illustrative)", [["scores computed", "one per token"], ["top choice", p > 0.72 ? "slept" : "…", C.sig], ["probability", p > 0.72 ? "38%" : "…"]], { w: 220 });
        return;
      }

      // ---------- close-up ----------
      if (f.key === "attn") {
        const wins = [[0.03, 0.17], [0.17, 0.31], [0.31, 0.45], [0.45, 0.59], [0.59, 1]];
        let qi = wins.findIndex(w => p < w[1]); if (qi < 0) qi = 4; const q = qi + 1, loc = clamp01((p - wins[qi][0]) / (wins[qi][1] - wins[qi][0]));
        const inVals = j => j < q ? vals(j, blendOf(j)) : j === q ? vals(j, r => lerp(base(j, r), blendOf(j)(r), easeIO((loc - 0.3) / 0.6))) : vals(j);
        frame(k, f, { attHot: true, future: q, inVals: j => j === 0 ? vals(0) : inVals(j), glowCol: j => j === q });
        const w = attnW(q), a = easeOut(loc / 0.25);
        headArcs(k, q, w, C.sig, a, loc > 0.2 ? f.t * 0.7 : null, 1, 0);
        for (let j = 0; j < q; j++) qk(k, D.cx(j), "k", false);
        qk(k, D.cx(q), "q", true);
        if (q < N - 1) { const xa = D.cx(q + 1) - 30, xb = D.cx(N - 1) + 30; k.box(xa, D.attY + 16, xb - xa, D.attH - 32, { stroke: C.line, r: 10, dash: [4, 4] }); k.label((xa + xb) / 2, D.attY + D.attH / 2, "future: masked", { col: C.muted }); }
        if (wide) { const top = w.map((x, j) => [x, j]).filter(([, j]) => j < q).sort((a, b) => b[0] - a[0]).slice(0, 3); k.hud("tl", `“${words[q]}” looks back`, top.map(([x, j]) => [words[j], Math.round(x * 100) + "%", C.sig]), { w: 190 }); }
        return;
      }
      if (f.key === "heads") {
        const q = 5;
        frame(k, f, { attHot: true, inVals: j => j < q ? vals(j, blendOf(j)) : vals(j, r => lerp(base(j, r), blendOf(5)(r), easeIO(p))), glowCol: j => j === q });
        for (let h = 0; h < 3; h++) { const a = easeOut((p - 0.06 - 0.2 * h) / 0.15); if (a > 0) headArcs(k, q, headsW[h], headCol[h], a, f.t * 0.7 + h * 0.3, 0.8 + 0.2 * h, (h - 1) * 8); }
        for (let j = 0; j < q; j++) qk(k, D.cx(j), "k", false);
        qk(k, D.cx(q), "q", true);
        k.hud("tl", "Three heads, one query", [0, 1, 2].map(h => [`head ${h + 1}`, headName[h], easeOut((p - 0.06 - 0.2 * h) / 0.15) > 0.3 ? headCol[h] : C.line]), { w: wide ? 220 : 200 });
        return;
      }
      if (f.key === "mlp" || f.key === "moe" || f.key === "add" || f.key === "stack") {
        const moe = f.key === "moe";
        const order = [3, 0, 5, 1, 4, 2];
        const win = j => { const s = 0.06 + order.indexOf(j) * 0.12; return clamp01((p - s) / 0.34); };
        const stackHot = f.key === "stack" ? Math.max(0, 1 - Math.abs(wave - O.ZL) / 1.1) : 0;
        if (f.key === "add") {
          const u = j => clamp01((p - 0.05 - j * 0.035) / 0.78);
          const cy = j => lerp(D.vecY + 52, D.top - 10, u(j));
          const near = (j, y) => Math.abs(cy(j) - y) < 40;
          frame(k, f, { hideIn: true, hotA: j => near(j, D.addA), hotM: j => near(j, D.addM) });
          for (let j = 0; j < N; j++) {
            mlpGlyph(k, D.cx(j), 1, 0, j);
            vec(k, D.cx(j), D.vecY, vals(j), DV, { dash: true, alpha: 0.25 });
            const y = cy(j), st = y < D.addM ? 2 : y < D.addA ? 1 : 0, x = D.cx(j);
            k.line(x, D.vecY, x, y, { col: C.sig, alpha: 0.5, lw: 2.5, glow: 8 });
            // the block's output joins at the add
            [[D.addA, D.attY + 10], [D.addM, D.mlpY + 10]].forEach(([ay, by]) => { const d = (cy(j) - ay) / 60; if (d > 0 && d < 1.6) { const P = [[x + 52, by + 14], [x + 52, ay], [x + 30, ay], [x + 12, ay]]; k.curve(P, { col: C.amb, alpha: 0.6 }); k.flow(v => bez(P, v), 2, f.t * 1.2, C.amb, { size: 3 }); } });
            const a = u(j) > 0.96 ? clamp01((1 - u(j)) / 0.04) : 1;
            vec(k, x, y - 52, after(j, st), DV, { glow: 12, alpha: a });
          }
          if (wide) k.label(D.x + 16, D.addA, "add", { align: "left", col: C.amb, weight: "600" });
          if (wide) k.label(D.x + 16, D.addM, "add", { align: "left", col: C.amb, weight: "600" });
          k.label(D.cx(N - 1), D.top - 2, "to layer 5", { col: C.muted, size: 11, dx: -60 });
          return;
        }
        frame(k, f, { mlpHot: f.key !== "stack" || stackHot > 0.2, attHot: stackHot > 0.2, moe, inVals: j => vals(j, blendOf(Math.max(1, j))) });
        if (f.key === "stack") {
          for (let j = 0; j < N; j++) mlpGlyph(k, D.cx(j), 1, stackHot, j);
          if (stackHot > 0) headArcs(k, 5, attnW(5), C.sig, stackHot, f.t * 0.7, 1, 0);
          return;
        }
        const mA = moe ? 1 - easeIO(p / 0.15) : 1;
        if (mA > 0) for (let j = 0; j < N; j++) {
          const w = win(j), hot = moe ? 0 : (w > 0.3 && w < 0.7 ? Math.sin((w - 0.3) / 0.4 * Math.PI) : 0);
          mlpGlyph(k, D.cx(j), mA, hot, j);
          if (!moe) { const y = lerp(D.addA, D.addM, easeIO(w)), hid = Math.abs(y - (D.mlpY + D.mlpH / 2)) < 55;
            if (w > 0 && !hid) vec(k, D.cx(j), y - 33, after(j, w > 0.5 ? 2 : 1), { w: 20, h: 8, g: 3 }, { glow: 8, alpha: w >= 1 ? 0.75 : 1 }); }
        }
        if (!moe) {
          if (wide) k.hud("bl", "MLP", [["same weights at", "every position"], ["looks at other words", "never"], ["share of parameters", "most"]], { w: 230 });
          return;
        }
        // experts
        const eA = easeIO((p - 0.08) / 0.15);
        const tw = j => clamp01((p - 0.2 - j * 0.11) / 0.22);
        let cur = -1; for (let j = 0; j < N; j++) if (tw(j) > 0 && tw(j) < 1) cur = j;
        for (let e = 0; e < 8; e++) {
          let use = 0; for (let j = 0; j < N; j++) { const t = tw(j); if (t > 0 && t < 1 && experts[j].includes(e)) use = Math.max(use, Math.sin(t * Math.PI)); }
          k.box(EX(e) - EW / 2, D.mlpY + 22, EW, 64, { fill: use > 0.05 ? C.amb : C.bg, stroke: use > 0.05 ? C.amb : C.line, r: 8, alpha: eA * (use > 0.05 ? 0.25 + 0.6 * use : 1), glow: 16 * use, glowCol: C.amb });
          k.text(EX(e), D.mlpY + 54, "E" + (e + 1), { size: 14, mono: true, weight: "600", col: use > 0.3 ? C.ink : C.muted, alpha: eA });
        }
        for (let j = 0; j < N; j++) {
          const x = D.cx(j), ry = D.mlpY + D.mlpH - 10, t = tw(j);
          // router diamond
          const c = k.ctx; c.save(); c.globalAlpha = eA; c.translate(x, ry); c.rotate(Math.PI / 4); c.fillStyle = t > 0 && t < 1 ? C.ink : C.line; c.fillRect(-6, -6, 12, 12); c.restore();
          if (t <= 0) continue;
          experts[j].forEach((e, n) => {
            const P = [[x, ry - 8], [x, ry - 28], [EX(e), D.mlpY + 110], [EX(e), D.mlpY + 86]], live = t < 1;
            k.curve(P, { col: live ? C.amb : C.line, lw: 1 + 6 * gates[j][n], alpha: live ? 0.9 : 0.45 });
            if (live) k.flow(v => bez(P, v), 2, f.t * 1.1 + n * 0.5, C.amb, { size: 2 + 2 * gates[j][n] });
          });
        }
        if (wide) k.hud("bl", "Mixture of experts", [["experts stored", "8"], ["used per token", "2", C.amb], ["token now", cur >= 0 ? words[cur] : "…", C.sig]], { w: 210 });
        return;
      }
    }
  });
});
