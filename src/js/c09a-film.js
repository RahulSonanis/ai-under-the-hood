/* Chapter 9 film: spending a compute budget. Compute is drawn as a fixed-area rectangle (width = parameters N,
   height = tokens D); predicted loss uses the Epoch AI re-fit of the Chinchilla law quoted in the chapter.
   Every frame is a pure function of t. */
chapter("scale", () => {
  const fig = $("#sc-film"); if (!fig) return;
  const narrow = () => (fig.clientWidth || 600) < 640;
  const Lfit = (N, D) => 1.82 + 482.0 / Math.pow(N, 0.348) + 2085.4 / Math.pow(D, 0.366);
  const BUDGET = 1e22, Dof = N => BUDGET / (6 * N);
  // compute-optimal N for this budget (golden-section search on log N)
  const NOPT = (() => { let a = Math.log(1e8), b = Math.log(1e12); const g = (Math.sqrt(5) - 1) / 2; for (let i = 0; i < 80; i++) { const c = b - g * (b - a), d = a + g * (b - a); if (Lfit(Math.exp(c), Dof(Math.exp(c))) < Lfit(Math.exp(d), Dof(Math.exp(d)))) b = d; else a = c; } return Math.exp((a + b) / 2); })();
  const RATIO = Dof(NOPT) / NOPT;
  const fmtN = n => n >= 1e12 ? (n / 1e12).toFixed(n >= 1e13 ? 0 : 1) + "T" : n >= 1e9 ? (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + "B" : (n / 1e6).toFixed(0) + "M";
  const sci = x => { const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); return m.toFixed(1) + " × 10" + String(e).split("").map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c]).join(""); };

  // rectangle geometry: width = S·N/Nopt, height = S·D/Dopt, so area is constant
  const S = 260, O = { x: 380, y: 820 }, F = 3;
  const CHW = { x: 1240, y: 300, w: 500, h: 400 }, CHN = { x: 730, y: 210, w: 420, h: 320 }, CH = { ...CHW }, fMin = 1 / 3.6, fMax = 3.6;
  const lossF = f => Lfit(NOPT * f, Dof(NOPT * f));
  const LLO = lossF(1), LHI = Math.max(lossF(fMin), lossF(fMax));
  const chartXY = f => [CH.x + (Math.log(f) - Math.log(fMin)) / (Math.log(fMax) - Math.log(fMin)) * CH.w, CH.y + CH.h - (lossF(f) - LLO) / (LHI - LLO) * (CH.h - 40) - 20];

  // DeepSeek-V3 numbers quoted in the chapter (37B active, 14.8T tokens, H800 989 TFLOPS BF16, $2/hour, 2.788M GPU-hours, $5.6M)
  const DS = { N: 37e9, D: 14.8e12, peak: 989e12, mfu: 0.38, price: 2 };
  DS.F = 6 * DS.N * DS.D; DS.hours = DS.F / (DS.peak * DS.mfu) / 3600; DS.cost = DS.hours * DS.price;
  const LL = { N: 8e9, D: 15e12 }; LL.C = 6 * LL.N * LL.D; LL.Nopt = Math.sqrt(LL.C / (6 * 20));

  const steps = [
    { key: "area", short: "6·N·D", title: "Training compute is size times reading", dur: 6,
      text: [`The work of training is roughly the model's size times how much text it reads. Draw it as a rectangle: one side is size, the other is text, and the area is the compute you can afford.`,
             `C ≈ 6·N·D FLOPs (about 2 per parameter per token forward, 4 backward). This film spends a budget of 10²² FLOPs.`], link: "#ref-7" },
    { key: "big", short: "Too big", title: "A big model on too little text", dur: 5.5,
      text: [`With the same budget you could build a much bigger model. But then it only reads a little, and it never finishes learning.`,
             `Stretch N by 3× and D shrinks by 3×. With L(N, D) = 1.82 + 482.0/N^0.348 + 2085.4/D^0.366, the data term grows: the model is under-trained.`], link: "#ref-50" },
    { key: "small", short: "Too small", title: "A small model on lots of text", dur: 5.5,
      text: [`Or build a small model that reads a mountain of text. It reads plenty, but it's too small to absorb everything it sees.`,
             `Divide N by 3 and D triples. Now the parameter term 482.0/N^0.348 dominates and the predicted loss rises again.`], link: "#ref-50" },
    { key: "balance", short: "Balance", title: "The best split: about 20 tokens per parameter", dur: 7,
      text: [`Somewhere in between is the best shape. For this kind of model it comes out at about 20 tokens of text for every parameter.`,
             `Minimising L subject to C = 6ND gives N_opt ∝ C^(β/(α+β)) and D_opt ∝ C^(α/(α+β)). Chinchilla's results imply around 20 tokens per parameter; this fit gives ${RATIO.toFixed(0)} at 10²² FLOPs.`], link: "#ref-8" },
    { key: "over", short: "Train past it", title: "Why real models read far more", dur: 7,
      text: [`Training happens once, but the model then answers questions for millions of people. A smaller model is cheaper every time it answers, so teams train small models on far more text.`,
             `Llama 3 8B saw about 15T tokens, close to 1,900 per parameter, and SmolLM3 saw 11T at 3B. The same compute at 20:1 would buy a ~${Math.round(LL.Nopt / 1e9)}B model, and a forward pass costs about 2 FLOPs per parameter per token.`], link: "#ref-9" },
    { key: "hours", short: "GPU-hours", title: "From FLOPs to GPU-hours and dollars", dur: 7,
      text: [`Divide the total work by how fast the chips really run, and you get GPU-hours. Multiply by the price per hour, and you get the bill.`,
             `DeepSeek-V3: 6 × 37B active × 14.8T ≈ ${sci(DS.F)} FLOPs. At 989 TFLOPS and an assumed 38% utilisation that is ≈ ${(DS.hours / 1e6).toFixed(2)}M GPU-hours, ≈ $${(DS.cost / 1e6).toFixed(1)}M at $2/hour. The report's official total: 2.788M GPU-hours, $5.6M.`], link: "#ref-10" },
    { key: "hidden", short: "Hidden bill", title: "The final run is only part of the bill", dur: 6,
      text: [`Before the big run, teams train lots of small test models, and things break along the way. That extra work can add more than half again.`,
             `SmolLM3: about 276k H100-hours for the main run plus 161k for ablations and recovering from a mid-run problem. DeepSeek's $5.6M excludes prior research and ablation experiments.`], link: "#ref-1" }
  ];
  const wide = {
    default: { x: 80, y: -10, w: 1760, h: 880 },
    area: { x: 80, y: -10, w: 1760, h: 880 }, big: { x: 80, y: -10, w: 1760, h: 880 }, small: { x: 80, y: -10, w: 1760, h: 880 }, balance: { x: 80, y: -10, w: 1760, h: 880 },
    over: { x: 2000, y: 20, w: 1760, h: 880 }, hours: { x: 2000, y: 1020, w: 1760, h: 880 }, hidden: { x: 3900, y: 1020, w: 1760, h: 880 }
  };
  const tall = {
    default: { x: 110, y: -30, w: 1080, h: 920 },
    area: { x: 110, y: -30, w: 1080, h: 920 }, big: { x: 110, y: -30, w: 1080, h: 920 }, small: { x: 110, y: -30, w: 1080, h: 920 }, balance: { x: 110, y: -30, w: 1080, h: 920 },
    over: { x: 2400, y: 30, w: 1440, h: 900 }, hours: { x: 2070, y: 1220, w: 1020, h: 940 }, hidden: { x: 4300, y: 1060, w: 1060, h: 900 }
  };
  const cams = new Proxy({}, { get: (_, key) => (narrow() ? tall : wide)[key] });
  const hud = (k, corner, nCorner, title, rows, w, keep) => narrow() ? keep.length && k.hud(nCorner, "", keep.map(i => rows[i]), { w: 190 }) : k.hud(corner, title, rows, { w });

  function rect(k, f, t, a = 1) { // budget rectangle for N = NOPT·f
    const C = k.C, w = S * f, h = S / f, x = O.x, y = O.y - h;
    k.box(x, y, w, h, { fill: C.amb, r: 4, alpha: 0.16 * a });
    k.box(x, y, w, h, { stroke: C.amb, r: 4, lw: 2, glow: 12, alpha: a });
    // drifting sparks inside: the compute being spent
    for (let i = 0; i < 26; i++) { const hx = ((i * 0.618 + t * 0.05 * (1 + (i % 3))) % 1), hy = ((i * 0.377 + t * 0.11) % 1); k.dot(x + 6 + hx * (w - 12), y + h - 6 - hy * (h - 12), k.px(1.8), C.amb, { alpha: 0.6 * a * Math.sin(Math.PI * hy), glow: 6 }); }
    const N = NOPT * f, D = Dof(N);
    k.label(x + w / 2, O.y + 22, (narrow() ? "" : "N = ") + fmtN(N) + " parameters", { col: C.ink, alpha: a, weight: "600", size: narrow() ? 11 : 12 });
    k.label(x - 12, y + h / 2, (narrow() ? "" : "D = ") + fmtN(D) + " tokens", { col: C.ink, alpha: a, align: "right", weight: "600", size: narrow() ? 11 : 12 });
    if (w > 150 && h > 50) k.text(x + w / 2, y + h / 2, "C = 10²²", { col: C.amb, size: Math.min(30, h * 0.4), mono: true, weight: "700", alpha: a });
    else k.label(x + w + 14, y + 14, "C = 10²² FLOPs", { col: C.amb, alpha: a, align: "left", mono: true });
  }
  function axes(k, a) {
    const C = k.C;
    k.line(O.x, O.y, O.x + S * F + 60, O.y, { col: C.line, alpha: a }); k.line(O.x, O.y, O.x, O.y - S * F - 40, { col: C.line, alpha: a });
    k.label(O.x + S * F + 60, O.y + 22, "parameters →", { col: C.muted, align: "right", alpha: a });
    k.label(O.x + 8, O.y - S * F - 52, "↑ training tokens", { col: C.muted, align: "left", alpha: a });
  }
  function chart(k, fNow, upto, pts, a = 1) {
    const C = k.C;
    k.line(CH.x, CH.y + CH.h, CH.x + CH.w, CH.y + CH.h, { col: C.line, alpha: a }); k.line(CH.x, CH.y, CH.x, CH.y + CH.h, { col: C.line, alpha: a });
    k.label(CH.x + CH.w, CH.y + CH.h, "bigger model →", { col: C.muted, align: "right", size: 11, alpha: a, dy: 12 });
    k.label(CH.x, CH.y - 16, "predicted loss", { col: C.muted, align: "left", size: 11, alpha: a });
    if (upto) { const c = k.ctx; c.save(); c.globalAlpha = a; c.strokeStyle = C.sig; c.lineWidth = k.px(2); c.beginPath(); let first = true; for (let u = 0; u <= 1.0001; u += 0.01) { const lf = lerp(Math.log(fMin), Math.log(fMax), u); if (lf < upto[0] || lf > upto[1]) continue; const [x, y] = chartXY(Math.exp(lf)); first ? c.moveTo(x, y) : c.lineTo(x, y); first = false; } c.stroke(); c.restore(); }
    pts.forEach(([f, col]) => { const [x, y] = chartXY(f); k.dot(x, y, k.px(5), col, { glow: 10, alpha: a }); });
    if (fNow) { const [x, y] = chartXY(fNow); k.dot(x, y, k.px(6), C.amb, { glow: 14, alpha: a }); k.line(x, y + 8, x, CH.y + CH.h, { col: C.amb, dash: [3, 4], alpha: 0.6 * a }); }
  }
  function budgetHud(k, f, title) {
    const C = k.C, N = NOPT * f, D = Dof(N), L = Lfit(N, D);
    hud(k, "tr", "tr", title, [["parameters N", fmtN(N)], ["tokens D", fmtN(D)], ["tokens per parameter", (D / N).toFixed(D / N < 10 ? 1 : 0)], ["predicted loss", L.toFixed(3), C.amb]], 230, [2, 3]);
  }
  const logBar = v => Math.log10(v) / Math.log10(5000) * 1080;

  storyFilm(fig, {
    label: "Animated explanation of how a compute budget is split between model size and data",
    steps, cams,
    draw(k, f) {
      const C = k.C, p = f.p, key = f.key, nw = narrow();
      Object.assign(CH, nw ? CHN : CHW);
      if (key === "area") {
        axes(k, clamp01(p / 0.15));
        const gw = easeIO((p - 0.08) / 0.3), gh = easeIO((p - 0.32) / 0.3), x = O.x, w = S * gw, h = S * gh;
        if (gh < 1) {
          k.line(x, O.y, x + w, O.y, { col: C.sig, lw: 3, glow: 10 }); if (gw > 0.5) k.label(x + w / 2, O.y + 22, "N: parameters (model size)", { col: C.ink, weight: "600" });
          if (gh > 0) { k.line(x, O.y, x, O.y - h, { col: C.sig, lw: 3, glow: 10 }); k.label(x - 12, O.y - h / 2, "D: tokens read", { col: C.ink, align: "right", weight: "600" }); k.box(x, O.y - h, w, h, { fill: C.amb, r: 4, alpha: 0.16 * gh }); }
        } else rect(k, 1, f.t, 1);
        const fa = clamp01((p - 0.7) / 0.12);
        if (fa > 0) { k.text(CH.x + CH.w / 2, CH.y + 80, "compute ≈ 6 × N × D", { col: C.ink, size: 34, weight: "600", alpha: fa }); k.text(CH.x + CH.w / 2, CH.y + 140, "6 = 2 forward + 4 backward", { col: C.muted, size: 26, alpha: fa }); k.text(CH.x + CH.w / 2, CH.y + 230, "budget: 10²² FLOPs", { col: C.amb, size: 30, mono: true, weight: "600", alpha: fa }); }
        if (gh >= 1) budgetHud(k, 1, "Compute budget");
        return;
      }
      if (key === "big" || key === "small" || key === "balance") {
        axes(k, 1);
        let fNow, pts = [], upto = null;
        if (key === "big") { fNow = Math.exp(Math.log(F) * easeIO((p - 0.05) / 0.4)); pts = [[1, C.muted]]; }
        else if (key === "small") { fNow = Math.exp(lerp(Math.log(F), -Math.log(F), easeIO((p - 0.05) / 0.45))); pts = [[1, C.muted], [F, C.muted]]; }
        else {
          const a1 = easeIO((p - 0.04) / 0.42), a2 = easeIO((p - 0.5) / 0.3);
          const lf = p < 0.48 ? lerp(-Math.log(F), Math.log(F), a1) : lerp(Math.log(F), 0, a2);
          fNow = Math.exp(lf); pts = [[F, C.muted], [1 / F, C.muted]];
          upto = [Math.log(fMin), lerp(Math.log(fMin), Math.log(fMax), clamp01((p - 0.02) / 0.46))];
        }
        rect(k, fNow, f.t, 1);
        chart(k, fNow, upto, pts, 1);
        if (key === "balance" && p > 0.82) { const [x, y] = chartXY(1), a = clamp01((p - 0.82) / 0.08); k.label(x, CH.y + CH.h, "≈ " + RATIO.toFixed(0) + " tokens per parameter", { col: C.sig, weight: "600", alpha: a, dy: 30 }); k.box(O.x - 6, O.y - S - 6, S + 12, S + 12, { stroke: C.sig, r: 8, alpha: a, glow: 12 }); }
        if (key === "big" && p > 0.5) k.label(O.x + S * fNow / 2, O.y - S / fNow - 22, "reads too little: under-trained", { col: C.ink, alpha: clamp01((p - 0.5) / 0.1) });
        if (key === "small" && p > 0.55) k.label(O.x + S * fNow + 16, O.y - S / fNow / 2, "too small to absorb it all", { col: C.ink, align: "left", alpha: clamp01((p - 0.55) / 0.1) });
        budgetHud(k, fNow, key === "balance" ? "Finding the best split" : key === "big" ? "Bigger model, less text" : "Smaller model, more text");
        return;
      }
      if (key === "over") {
        const x0 = 2440, gy = clamp01(p / 0.45);
        if (!nw) k.label(x0, 70, "Tokens read per parameter (log scale)", { align: "left", col: C.ink, weight: "600" });
        [10, 100, 1000].forEach(v => { const x = x0 + logBar(v); k.line(x, 100, x, nw ? 470 : 430, { col: C.line, dash: [3, 5], alpha: 0.7 }); k.label(x, nw ? 486 : 446, v.toLocaleString(), { col: C.muted, size: 11 }); });
        const rows = [["Compute-optimal (Chinchilla)", 20, C.sig], ["Llama 3 8B · 15T tokens", 1900, C.amb], ["SmolLM3 3B · 11T tokens", 11e12 / 3e9, C.amb]];
        rows.forEach(([name, v, col], i) => {
          const y = (nw ? 120 : 140) + i * (nw ? 120 : 95), u = easeOut((gy - i * 0.2) / 0.6), w = logBar(v) * u;
          k.box(x0, y, Math.max(2, w), 44, { fill: col, r: 6, alpha: 0.85, glow: u < 1 && u > 0 ? 10 : 0 });
          if (nw) k.label(x0, y, name, { align: "left", col: C.ink, dy: -10 }); else k.label(x0 - 14, y + 22, name, { align: "right", col: C.ink });
          if (u > 0.95) k.label(x0 + w + 12, y + 22, "≈ " + (Math.round(v / (v > 100 ? 100 : 1)) * (v > 100 ? 100 : 1)).toLocaleString(), { align: "left", col: col, mono: true, weight: "600" });
        });
        // serving cost: same training compute as Llama 3 8B
        const sa = clamp01((p - 0.45) / 0.12);
        k.label(x0, nw ? 580 : 520, nw ? "Cost to serve each token, same training compute" : "Same training compute, cost to serve each token (∝ parameters)", { align: "left", col: C.ink, weight: "600", alpha: sa });
        const big = Math.round(LL.Nopt / 1e9), srv = [["~" + big + "B model, trained 20:1", big, C.muted], ["Llama 3 8B, trained far longer", 8, C.sig]];
        srv.forEach(([name, n, col], i) => {
          const y = (nw ? 680 : 580) + i * (nw ? 120 : 90), u = easeOut((p - 0.5 - i * 0.08) / 0.3), w = n / big * 1080 * u;
          k.box(x0, y, Math.max(2, w), 44, { fill: col, r: 6, alpha: 0.8 * sa });
          if (nw) k.label(x0, y, name, { align: "left", col: C.ink, alpha: sa, dy: -10 }); else k.label(x0 - 14, y + 22, name, { align: "right", col: C.ink, alpha: sa });
          if (sa > 0) k.flow(uu => [lerp(x0 - 4, x0 + Math.max(30, w) - 6, uu), y + 22], i ? 8 : 2, f.t * (i ? 0.9 : 0.25) + i * 0.3, C.sig, { len: 0.1, size: 2.5, alpha: sa });
        });
        hud(k, "tr", "tl", "Llama 3 8B", [["training compute", sci(LL.C) + " FLOPs"], ["tokens per parameter", "≈ 1,900", C.amb], ["20:1 model, same compute", "~" + big + "B params"]], 270, []);
        return;
      }
      if (key === "hours") {
        const y0 = 1290, drain = easeIO((p - 0.12) / 0.6), hrs = DS.hours * drain;
        // FLOPs block draining into one GPU
        const bx = 2120, bw = 420, bh = 380 * (1 - drain * 0.92);
        k.box(bx, y0, bw, 380, { stroke: C.line, r: 10, dash: [5, 5] });
        k.box(bx, y0 + 380 - bh, bw, bh, { fill: C.amb, r: 10, alpha: 0.22 }); k.box(bx, y0 + 380 - bh, bw, bh, { stroke: C.amb, r: 10, glow: 12 });
        k.text(bx + bw / 2, y0 + 180, sci(DS.F), { col: C.ink, size: 44, mono: true, weight: "700" });
        k.text(bx + bw / 2, y0 + 236, "FLOPs to do", { col: C.muted, size: 28 });
        k.label(bx + bw / 2, y0 - 26, "DeepSeek-V3: 6 × 37B × 14.8T", { col: C.ink, weight: "600" });
        const gx = 2800, gyy = y0 + 80, G = 220;
        k.flow(u => bez([[bx + bw, y0 + 190], [bx + bw + 140, y0 + 190], [gx - 140, gyy + G / 2], [gx, gyy + G / 2]], u), 7, f.t * 0.7, C.amb, { len: 0.12, size: 3 });
        k.box(gx, gyy, G, G, { fill: C.bg2, stroke: C.sig, r: 14, glow: 10 + 6 * Math.sin(f.t * 6) });
        for (let i = 0; i < 7; i++) { const lx = gx + 26 + i * 28; k.line(lx, gyy - 18, lx, gyy, { col: C.line, lw: 2 }); k.line(lx, gyy + G, lx, gyy + G + 18, { col: C.line, lw: 2 }); }
        k.text(gx + G / 2, gyy + G / 2 - 14, "H800", { col: C.ink, size: 40, weight: "700" }); k.text(gx + G / 2, gyy + G / 2 + 28, "GPU", { col: C.muted, size: 24 });
        k.label(gx + G / 2, gyy + G + 46, "989 TFLOPS peak × 38% used", { col: C.ink, size: 12 });
        // counters
        const cx = nw ? 2120 : 3150, cy = nw ? y0 + 470 : y0;
        k.text(cx, cy + 110, (hrs / 1e6).toFixed(2) + "M", { col: C.amb, size: 80, mono: true, weight: "700", align: "left" });
        k.text(cx, cy + 175, "GPU-hours", { col: C.muted, size: 28, align: "left" });
        const ca = clamp01((p - 0.74) / 0.1);
        k.text(cx, cy + 260, "× $2 / hour = $" + (DS.cost / 1e6).toFixed(1) + "M", { col: C.ink, size: 36, mono: true, weight: "600", align: "left", alpha: ca });
        const ra = clamp01((p - 0.85) / 0.1);
        k.text(cx, cy + 330, "Reported: 2.788M GPU-hours, $5.6M", { col: C.sig, size: 28, align: "left", alpha: ra });
        hud(k, "tr", "tl", "GPU-hours = FLOPs ÷ (peak × MFU) ÷ 3,600", [["useful speed per GPU", Math.round(DS.peak * DS.mfu / 1e12) + " TFLOPS"], ["GPU-hours", (hrs / 1e6).toFixed(2) + "M", C.amb], ["cost at $2/hour", "$" + (DS.cost * drain / 1e6).toFixed(1) + "M"]], 300, []);
        return;
      }
      // hidden bill: SmolLM3 accounting
      const bx = 4560, base = 1840, sc = 440 / 276, main = easeOut((p - 0.05) / 0.35), extra = easeOut((p - 0.45) / 0.35);
      k.label(bx + 120, 1100, "SmolLM3 · H100-hours", { col: C.ink, weight: "600" });
      k.line(bx - 60, base, bx + 300, base, { col: C.line });
      const hM = 276 * sc * main, hE = 161 * sc * extra;
      k.box(bx, base - hM, 240, hM, { fill: C.amb, r: 6, alpha: 0.85 });
      const lx = nw ? bx + 258 : bx - 18, al = nw ? "left" : "right";
      if (main > 0.9) { k.label(lx, base - hM / 2, "main run", { align: al, col: C.ink, weight: "600" }); k.label(lx, base - hM / 2, "≈ 276k", { align: al, col: C.amb, mono: true, dy: 18 }); }
      if (extra > 0) {
        k.box(bx, base - hM - hE, 240, hE, { stroke: C.amb, r: 6, lw: 2, glow: 10 });
        const c = k.ctx; c.save(); c.beginPath(); c.rect(bx, base - hM - hE, 240, hE); c.clip(); c.strokeStyle = C.amb; c.globalAlpha = 0.5; c.lineWidth = k.px(1.2); for (let d = -hE; d < 240; d += 14) { c.beginPath(); c.moveTo(bx + d, base - hM); c.lineTo(bx + d + hE, base - hM - hE); c.stroke(); } c.restore();
        k.label(lx, base - hM - hE / 2, nw ? "tests, recovery" : "ablations and recovery", { align: al, col: C.ink, weight: "600", alpha: extra });
        k.label(lx, base - hM - hE / 2, "≈ 161k more", { align: al, col: C.amb, mono: true, alpha: extra, dy: 18 });
      }
      // small test runs flying into the extra block
      for (let i = 0; i < 9; i++) { const u = clamp01((p - 0.42 - i * 0.04) / 0.18); if (u <= 0 || u >= 1) continue; const sx = 5100 + (i % 3) * 70, sy = 1300 + Math.floor(i / 3) * 70, tx = bx + 120, ty = base - hM - hE / 2; k.box(lerp(sx, tx, easeIO(u)) - 22, lerp(sy, ty, easeIO(u)) - 16, 44, 32, { stroke: C.amb, r: 5, alpha: 1 - u * 0.7 }); }
      const ta = clamp01((p - 0.2) / 0.1);
      if (!narrow()) { k.label(5170, 1230, "small test runs", { col: C.muted, alpha: ta }); for (let i = 0; i < 9; i++) { const u = clamp01((p - 0.42 - i * 0.04) / 0.18); if (u > 0) continue; k.box(5100 + (i % 3) * 70 - 22, 1300 + Math.floor(i / 3) * 70 - 16, 44, 32, { stroke: C.amb, r: 5, alpha: ta }); } }
      const da = clamp01((p - 0.82) / 0.1);
      if (!nw) { k.label(5150, 1640, "DeepSeek-V3's $5.6M also", { col: C.ink, alpha: da, dy: -9 }); k.label(5150, 1640, "leaves out research and ablations", { col: C.ink, alpha: da, dy: 9 }); }
      hud(k, "tr", "tl", "The full training bill", [["main run", "≈ 276k H100-hours"], ["extra work", "+" + Math.round(161 * extra) + "k", C.amb], ["extra vs main", Math.round(161 / 276 * 100 * extra) + "%", C.amb]], 250, []);
    }
  });
});
