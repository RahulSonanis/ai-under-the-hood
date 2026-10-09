/* Chapter 13 film: is model B really better? Benchmark noise, confidence intervals, contamination and safety tests.
   Every frame is a pure function of t; all randomness comes from fixed seeds computed once. */
chapter("evals", () => {
  const fig = $("#ev-film"); if (!fig) return;
  const N0 = 300, N1 = 9000, PA = 0.62, PB = 0.64;
  const G = { cols: 20, rows: 15, cell: 18 };
  const GA = { x: 100, y: 130 }, GB = { x: 640, y: 130 };
  const dotXY = (g, q) => [g.x + (q % G.cols) * G.cell + G.cell / 2, g.y + Math.floor(q / G.cols) * G.cell + G.cell / 2];
  const rngOf = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

  // first test: exactly 186 / 300 right for A and 192 / 300 for B, scattered deterministically
  function exact(seed, right) { const r = rngOf(seed), idx = [...Array(N0).keys()]; for (let i = N0 - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } const out = new Array(N0).fill(false); idx.slice(0, right).forEach(q => { out[q] = true; }); return out; }
  const firstA = exact(11, Math.round(PA * N0)), firstB = exact(29, Math.round(PB * N0));
  // reruns with fresh questions: independent right/wrong draws
  const R = 10, rr = rngOf(99);
  const draw = (n, p) => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = rr() < p; return a; };
  const reruns = [{ a: firstA, b: firstB }]; for (let j = 0; j < R; j++) reruns.push({ a: draw(N0, PA), b: draw(N0, PB) });
  const score = arr => arr.reduce((s, x) => s + (x ? 1 : 0), 0) / arr.length * 100;
  reruns.forEach(o => { o.sa = score(o.a); o.sb = score(o.b); });
  const big = []; for (let j = 0; j < R; j++) { let a = 0, b = 0; for (let i = 0; i < N1; i++) { if (rr() < PA) a++; if (rr() < PB) b++; } big.push({ sa: a / N1 * 100, sb: b / N1 * 100 }); }
  const half = (p, n) => 1.96 * Math.sqrt(p * (1 - p) / n) * 100;
  // contamination: 45 leaked questions
  const rl = rngOf(77), leaked = new Set(); while (leaked.size < 45) leaked.add(Math.floor(rl() * N0));
  const leakFixed = [...leaked].filter(q => !firstB[q]).length;
  // safety: 24 attacks from 4 categories; a few get through
  const catsShort = ["Harmful", "Jailbreaks", "Private data", "Weapons, cyber"];
  const cats = ["Harmful requests", "Jailbreak tricks", "Leaking private data", "Weapons and cyber skills"];
  const rs = rngOf(901), attacks = []; for (let j = 0; j < 24; j++) attacks.push({ c: Math.floor(rs() * 4), through: [5, 13, 19].includes(j) });

  // axis for score readouts
  const AX = { x0: 140, x1: 1020, lo: 52, hi: 74, yA: 600, yB: 660, y: 700 };
  const X = s => AX.x0 + (s - AX.lo) / (AX.hi - AX.lo) * (AX.x1 - AX.x0);

  const steps = [
    { key: "bench", short: "A benchmark", title: "A benchmark is an exam with known answers", dur: 5,
      text: [`Each dot is one question whose right answer we already know. We let a model answer all 300 and count how many it gets right.`,
             `A benchmark is a fixed set of questions with reference answers, scored as accuracy. Sizes vary a lot: HumanEval has 164 problems, MMLU about 14,000.`], link: "#ref-1" },
    { key: "modelA", short: "Model A", title: "Model A gets 62% right", dur: 5.5,
      text: [`Model A works through the test. Teal dots are right answers, grey ones are wrong. It gets 186 of 300 right: 62%.`,
             `The observed accuracy p̂ = 186 / 300 = 0.62 is an estimate of the model's true accuracy on questions like these.`] },
    { key: "modelB", short: "Model B", title: "Model B scores 2 points higher", dur: 5.5,
      text: [`Model B takes the same test and gets 192 right: 64%. Two points better. So is B the better model?`,
             `p̂_B = 0.64 versus p̂_A = 0.62, a gap Δ of 2 percentage points on n = 300.`] },
    { key: "rerun", short: "Fresh questions", title: "New questions, different scores", dur: 7,
      text: [`Give both models a fresh set of 300 similar questions and the scores wobble. Some tests even put A ahead of B (amber lines).`,
             `Each score is a binomial sample with standard error √(p(1−p)/n) ≈ 2.8 points at n = 300, so a 2-point gap often flips sign.`] },
    { key: "ci", short: "Error bars", title: "The error bars overlap", dur: 6,
      text: [`Draw a band around each score showing where the true skill probably lies. The two bands overlap a lot, so the test can't tell the models apart.`,
             `95% interval ≈ p̂ ± 1.96·SE ≈ ±5.5 points: A 56.5–67.5%, B 58.6–69.4%. A gap of 2 points is well inside the noise.`] },
    { key: "bigger", short: "Bigger test", title: "A bigger test shrinks the bands", dur: 6.5,
      text: [`More questions make the bands narrower. With about 9,000 questions each, the bands shrink to about one point either side and pull apart.`,
             `SE falls as 1/√n. Detecting 62% vs 64% with 80% power at 5% significance needs n ≈ (1.96 + 0.84)²(p₁q₁ + p₂q₂)/Δ² ≈ 9,000 questions each.`] },
    { key: "leak", short: "Leaked questions", title: "Leaked questions inflate the score", dur: 6,
      text: [`Famous tests get copied around the web. If questions end up in the training data, the model can remember the answers, and the score goes up without any real gain in skill.`,
             `Contamination: benchmark items present in pretraining data. Teams try to remove them, and treat a suspiciously high score on an old benchmark with care.`], link: "#ref-1" },
    { key: "safety", short: "Safety tests", title: "Before release, testers try to break it", dur: 7,
      text: [`Testers try hard to make the model do harmful things, to check it says no and to find weak spots. What they find decides the protections and whether it ships.`,
             `Red-teaming, automated attacks and dangerous-capability evaluations (for example biology and cyber security) feed policies such as Anthropic's Responsible Scaling Policy, which ties capability thresholds to required safeguards.`], link: "#ref-21" }
  ];
  const cams = {
    default: { x: -60, y: 60, w: 680, h: 420 },
    bench: { x: -60, y: 60, w: 680, h: 420 }, modelA: { x: -60, y: 60, w: 680, h: 420 },
    modelB: { x: 40, y: 50, w: 1060, h: 460 },
    rerun: { x: 30, y: 60, w: 1300, h: 690 }, ci: { x: 30, y: 60, w: 1300, h: 690 }, bigger: { x: 30, y: 60, w: 1300, h: 690 },
    leak: { x: 560, y: 50, w: 1040, h: 500 },
    safety: { x: 1180, y: 690, w: 1140, h: 610 }
  };

  function grid(k, g, ans, shown, answered, o = {}) {
    const C = k.C;
    k.box(g.x - 14, g.y - 14, G.cols * G.cell + 28, G.rows * G.cell + 28, { stroke: o.hi ? C.sig : C.line, r: 12, alpha: o.alpha == null ? 1 : o.alpha });
    for (let q = 0; q < N0; q++) {
      if (q >= shown) continue;
      const [x, y] = dotXY(g, q);
      if (q >= answered) { k.dot(x, y, 5, C.line, { alpha: 0.9 }); continue; }
      const head = q >= answered - 6;
      if (ans[q]) k.dot(x, y, 6, (o.col && o.col(q)) || C.sig, { glow: head ? 10 : 0, alpha: 0.95 });
      else { k.dot(x, y, 6, C.muted, { alpha: 0.35 }); }
      if (o.ring && o.ring(q)) { const c = k.ctx; c.save(); c.strokeStyle = C.amb; c.lineWidth = k.px(1.6); c.beginPath(); c.arc(x, y, 8.5, 0, Math.PI * 2); c.stroke(); c.restore(); }
    }
  }
  function dense(k, g, n, p, seed, alpha = 1) { // grid of n questions in the same area, coloured right/wrong deterministically
    const C = k.C, W = G.cols * G.cell, H = G.rows * G.cell, cols = Math.max(20, Math.round(20 * Math.sqrt(n / N0))), rows = Math.ceil(n / cols), cw = W / cols, ch = H / rows;
    k.box(g.x - 14, g.y - 14, W + 28, H + 28, { stroke: C.line, r: 12 });
    const ctx = k.ctx; ctx.save(); ctx.globalAlpha = alpha;
    for (let pass = 0; pass < 2; pass++) { ctx.fillStyle = pass ? C.sig : C.muted; ctx.globalAlpha = alpha * (pass ? 0.95 : 0.35);
      for (let q = 0; q < n; q++) { const h = ((q * 2654435761 + seed * 97) >>> 0) % 1000 / 1000; if ((h < p) !== !!pass) continue; const sz = Math.min(cw, ch) * 0.7; ctx.fillRect(g.x + (q % cols) * cw + (cw - sz) / 2, g.y + Math.floor(q / cols) * ch + (ch - sz) / 2, sz, sz); } }
    ctx.restore();
  }
  function head(k, g, name, s, o = {}) {
    const C = k.C, cx = g.x + G.cols * G.cell / 2;
    k.label(cx, g.y - 32, name, { col: o.hi ? C.ink : C.muted, weight: "650", size: 13 });
    if (s != null) k.text(cx, g.y + G.rows * G.cell + 42, s, { col: o.scol || C.ink, size: 30, weight: "650", mono: true });
  }
  function axis(k, rowsAlpha = 1) {
    const C = k.C;
    k.line(AX.x0, AX.y, AX.x1, AX.y, { col: C.line });
    for (let s = 55; s <= 70; s += 5) { k.line(X(s), AX.y, X(s), AX.y + 8, { col: C.line }); k.label(X(s), AX.y + 22, s + "%", { col: C.muted, size: 11, mono: true }); }
    k.label(AX.x0 - 28, AX.yA, "A", { col: C.ink, weight: "650", size: 13, alpha: rowsAlpha });
    k.label(AX.x0 - 28, AX.yB, "B", { col: C.sig, weight: "650", size: 13, alpha: rowsAlpha });
    k.line(AX.x0, AX.yA, AX.x1, AX.yA, { col: C.line, alpha: 0.35, dash: [3, 5] }); k.line(AX.x0, AX.yB, AX.x1, AX.yB, { col: C.line, alpha: 0.35, dash: [3, 5] });
  }
  function band(k, y, lo, hi, col, a) { k.box(X(lo), y - 16, X(hi) - X(lo), 32, { fill: col, r: 16, alpha: 0.18 * a }); k.box(X(lo), y - 16, X(hi) - X(lo), 32, { stroke: col, r: 16, alpha: 0.9 * a, lw: 1.5 }); }
  function scoreDots(k, list, n, a = 1, big0 = true) {
    const C = k.C;
    list.slice(0, n).forEach((o, j) => {
      const flip = o.sb < o.sa;
      k.line(X(o.sa), AX.yA + 7, X(o.sb), AX.yB - 7, { col: flip ? C.amb : C.line, alpha: (flip ? 0.9 : 0.5) * a, lw: flip ? 1.6 : 1 });
      const r = j === 0 && big0 ? 7 : 5;
      k.dot(X(o.sa), AX.yA, r, C.ink, { alpha: 0.9 * a }); k.dot(X(o.sb), AX.yB, r, C.sig, { alpha: 0.9 * a });
    });
  }

  // phones: the stage is nearly square, so make room for the readout above the action and keep at most 3 rows
  const HUDROWS = { bench: 3, modelA: 3, modelB: 0, rerun: 3, ci: 3, bigger: 3, leak: 3, safety: 3 };
  const pcams = { default: cams.default, bench: { x: 70, y: 70, w: 420, h: 400 }, modelA: { x: 70, y: 70, w: 420, h: 400 }, modelB: { x: 70, y: 70, w: 980, h: 420 },
    rerun: { x: 90, y: 380, w: 960, h: 370 }, ci: { x: 90, y: 380, w: 960, h: 370 }, bigger: { x: 90, y: 380, w: 960, h: 370 }, leak: { x: 600, y: 60, w: 940, h: 480 }, safety: { x: 1200, y: 800, w: 1080, h: 460 } };
  function fitPhone(k, f) { if (k.W >= 640) return; const c = filmCam(pcams, f.segs, f.i, f.t), s = (k.W - 24) / c.w, hw = HUDROWS[f.key] ? (62 + 17 * HUDROWS[f.key]) / s : 0; k.begin(k.H, { x: c.x, y: c.y - hw, w: c.w, h: c.h + hw }); }
  const hud = (k, corner, title, rows, o) => k.W < 640 ? k.hud("t" + corner[1], title, rows.slice(0, 3), o) : k.hud(corner, title, rows, o);
  const nm = (k, long, short) => k.W < 640 ? short : long;

  storyFilm(fig, {
    label: "Animated explanation of benchmark noise, confidence intervals, contamination and safety testing",
    steps, cams,
    draw(k, f) {
      const C = k.C;
      fitPhone(k, f);
      if (f.key === "bench") {
        const shown = Math.round(easeOut(f.p / 0.6) * N0);
        grid(k, GA, firstA, shown, 0, { hi: true });
        head(k, GA, "Benchmark · 300 questions", null, { hi: true });
        // questions arrive one after another (a soft highlight wave)
        const q = Math.min(N0 - 1, shown); const [x, y] = dotXY(GA, q); if (shown < N0) k.dot(x, y, 7, C.ink, { glow: 14 });
        hud(k, "tr", "The test", [["questions", String(shown)], ["HumanEval has", "164"], ["MMLU has", "≈ 14,000"], ["answers known", "yes", C.sig]], { w: 170 });
        return;
      }
      if (f.key === "modelA") {
        const ans = Math.round(easeIO(f.p / 0.85) * N0), right = firstA.slice(0, ans).filter(Boolean).length;
        grid(k, GA, firstA, N0, ans, { hi: true });
        head(k, GA, "Model A", (right / N0 * 100).toFixed(1) + "%", { hi: true });
        hud(k, "tr", "Model A", [["answered", ans + " / 300"], ["right", String(right), C.sig], ["score", (right / N0 * 100).toFixed(1) + "%"], ["wrong", String(ans - right)]], { w: 170 });
        return;
      }
      if (f.key === "modelB") {
        const shown = Math.round(easeOut(f.p / 0.25) * N0), ans = Math.round(easeIO((f.p - 0.2) / 0.6) * N0), right = firstB.slice(0, ans).filter(Boolean).length;
        grid(k, GA, firstA, N0, N0, { alpha: 0.7 }); head(k, GA, "Model A", "62.0%", { scol: C.muted });
        grid(k, GB, firstB, shown, ans, { hi: true }); head(k, GB, "Model B", ans ? (right / N0 * 100).toFixed(1) + "%" : "", { hi: true, scol: C.sig });
        const g = easeOut((f.p - 0.82) / 0.15);
        if (g > 0) { k.pill(550, 265, 92, 36, C.amb, { alpha: g, glow: 14 }); k.text(550, 266, "+2.0", { col: C.bg, size: 17, weight: "700", mono: true, alpha: g }); k.label(550, 265, "points", { col: C.amb, dy: 32, alpha: g, size: 11 }); }
        return;
      }
      if (f.key === "rerun" || f.key === "ci" || f.key === "bigger") {
        // grids: current test's answers
        if (f.key === "rerun") {
          const u = f.p * (R + 0.8), j = Math.min(R, Math.floor(u)), sub = u - j, cur = reruns[j], prev = reruns[Math.max(0, j - 1)];
          const wave = clamp01(sub / 0.45) * N0;
          const mixA = q => q < wave ? cur.a[q] : prev.a[q], mixB = q => q < wave ? cur.b[q] : prev.b[q];
          const A = [...Array(N0).keys()].map(mixA), B = [...Array(N0).keys()].map(mixB);
          grid(k, GA, A, N0, N0); grid(k, GB, B, N0, N0, { hi: true });
          const done = j + (sub > 0.5 ? 1 : 0);
          const shownS = done ? reruns[done - 1] : reruns[0];
          head(k, GA, j ? nm(k, `Model A · test ${j + 1}`, "A") : nm(k, "Model A", "A"), shownS.sa.toFixed(1) + "%"); head(k, GB, j ? nm(k, `Model B · test ${j + 1}`, "B") : nm(k, "Model B", "B"), shownS.sb.toFixed(1) + "%", { hi: true, scol: C.sig });
          axis(k); scoreDots(k, reruns, Math.max(1, done));
          // the newest scores drop from the grids to the axis
          if (j > 0 && sub > 0.45 && sub < 0.75) { const e = easeIO((sub - 0.45) / 0.3); k.dot(lerp(GA.x + 180, X(cur.sa), e), lerp(470, AX.yA, e), 6, C.ink, { glow: 10 }); k.dot(lerp(GB.x + 180, X(cur.sb), e), lerp(470, AX.yB, e), 6, C.sig, { glow: 10 }); }
          const flips = reruns.slice(0, Math.max(1, done)).filter(o => o.sb < o.sa).length;
          hud(k, "tr", "Fresh 300 questions each time", [["tests run", String(Math.max(1, done))], ["A ahead of B", String(flips), flips ? C.amb : C.muted], ["standard error", "≈ 2.8 points"]], { w: 220 });
          return;
        }
        if (f.key === "ci") {
          grid(k, GA, firstA, N0, N0, { alpha: 0.6 }); grid(k, GB, firstB, N0, N0, { alpha: 0.6 });
          head(k, GA, nm(k, "Model A", "A"), "62.0%", { scol: C.muted }); head(k, GB, nm(k, "Model B", "B"), "64.0%", { scol: C.sig });
          axis(k); scoreDots(k, reruns, R + 1, 0.35);
          const g = easeOut(f.p / 0.45), hA = half(PA, N0) * g, hB = half(PB, N0) * g;
          band(k, AX.yA, 62 - hA, 62 + hA, C.ink, 1); band(k, AX.yB, 64 - hB, 64 + hB, C.sig, 1);
          k.dot(X(62), AX.yA, 7, C.ink); k.dot(X(64), AX.yB, 7, C.sig);
          const o = easeOut((f.p - 0.5) / 0.25);
          if (o > 0) { const lo = 64 - half(PB, N0), hi = 62 + half(PA, N0); k.box(X(lo), AX.yA - 26, X(hi) - X(lo), AX.yB - AX.yA + 52, { stroke: C.amb, r: 10, lw: 1.6, dash: [5, 4], alpha: o, glow: 8 }); k.label((X(lo) + X(hi)) / 2, AX.yA - 40,  nm(k, "overlap: the test can't tell them apart", "overlap"), { col: C.amb, size: 12, weight: "600", alpha: o }); }
          hud(k, "tr", "95% intervals · 300 questions", [["model A", "56.5 – 67.5%"], ["model B", "58.6 – 69.4%", C.sig], ["gap", "2.0 points", C.amb]], { w: 220 });
          return;
        }
        // bigger test
        const e = easeIO(f.p / 0.7), n = Math.round(Math.exp(lerp(Math.log(N0), Math.log(N1), e)));
        dense(k, GA, n, PA, 3); dense(k, GB, n, PB, 5);
        head(k, GA, nm(k, `Model A · ${n.toLocaleString()} questions`, "A"), "62.0%", { scol: C.muted }); head(k, GB, nm(k, `Model B · ${n.toLocaleString()} questions`, "B"), "64.0%", { hi: true, scol: C.sig });
        axis(k);
        scoreDots(k, reruns, R + 1, 0.3 * (1 - e));
        const nb = Math.floor(clamp01((f.p - 0.62) / 0.3) * R); scoreDots(k, big, nb, 0.9, false);
        const hA = half(PA, n), hB = half(PB, n);
        band(k, AX.yA, 62 - hA, 62 + hA, C.ink, 1); band(k, AX.yB, 64 - hB, 64 + hB, C.sig, 1);
        k.dot(X(62), AX.yA, 7, C.ink); k.dot(X(64), AX.yB, 7, C.sig);
        const fmt = (p, h) => (p - h).toFixed(1) + " – " + (p + h).toFixed(1) + "%";
        hud(k, "tr", "95% intervals", [["questions each", n.toLocaleString()], ["model A", fmt(62, hA)], ["model B", fmt(64, hB), C.sig], ["half-width", "± " + hA.toFixed(1) + " points"]], { w: 220 });
        return;
      }
      if (f.key === "leak") {
        const B0 = { x: 1110, y: 120, w: 400, h: 300 };
        const fly = clamp01((f.p - 0.08) / 0.42), learn = clamp01((f.p - 0.55) / 0.3);
        const learned = q => leaked.has(q) && learn > 0 && ([...leaked].indexOf(q) / leaked.size) < learn;
        const ans = firstB.map((x, q) => x || learned(q));
        grid(k, GB, ans, N0, N0, { hi: true, ring: q => leaked.has(q) && fly > 0, col: q => learned(q) && !firstB[q] ? C.amb : null });
        const right = ans.filter(Boolean).length;
        head(k, GB, nm(k, "Model B · old, famous benchmark", "Old benchmark"), (right / N0 * 100).toFixed(1) + "%", { hi: true, scol: learn > 0 ? C.amb : C.sig });
        // training data: a stack of web pages
        k.box(B0.x, B0.y, B0.w, B0.h, { fill: C.bg2, stroke: C.line, r: 12 });
        k.label(B0.x + B0.w / 2, B0.y - 18, nm(k, "Training data · text from the web", "Training data"), { col: C.ink, weight: "600" });
        for (let l = 0; l < 13; l++) { const w = 120 + ((l * 73) % 200); k.box(B0.x + 24, B0.y + 22 + l * 20, w, 8, { fill: C.line, r: 4, alpha: 0.6 }); }
        const L = [...leaked];
        L.forEach((q, j) => {
          const st = j / L.length * 0.6, u = clamp01((fly - st) / 0.4); if (u <= 0) return;
          const [x0, y0] = dotXY(GB, q), x1 = B0.x + 40 + (j % 9) * 40, y1 = B0.y + 30 + Math.floor(j / 9) * 52;
          const path = s => bez([[x0, y0], [x0 + 160, y0 - 90], [x1 - 120, y1 - 60], [x1, y1]], easeIO(s));
          if (u < 1) { const pts = []; for (let s = 6; s >= 0; s--) pts.push(path(Math.max(0, u - s * 0.03))); k.trail(pts, C.sig, { w: 2 }); k.dot(...path(u), 4, C.sig, { glow: 8 }); }
          else k.box(x1 - 14, y1 - 5, 28, 10, { fill: C.sig, r: 5, alpha: 0.9 });
        });
        hud(k, "br", "Contamination", [["questions leaked", String(Math.round(fly * leaked.size)), C.sig], ["answers memorised", String(Math.round(learn * leakFixed)), C.amb], ["real skill", "unchanged"]], { w: 200 });
        return;
      }
      if (f.key === "safety") {
        const RT = { x: 1220, y: 840, w: 300, h: 400 }, M = { x: 1640, y: 960, w: 180, h: 160 }, F = { x: 1960, y: 880, w: 300, h: 320 };
        k.box(RT.x, RT.y, RT.w, RT.h, { fill: C.bg2, stroke: C.line, r: 14 });
        k.label(RT.x + RT.w / 2, RT.y - 18, nm(k, "Red team · people and automated attacks", "Red team"), { col: C.ink, weight: "600" });
        const catY = c => RT.y + 60 + c * 90;
        cats.forEach((nm, c) => { k.box(RT.x + 20, catY(c) - 24, RT.w - 40, 48, { stroke: C.amb, r: 10, alpha: 0.55 }); k.label(RT.x + RT.w / 2, catY(c), k.W < 640 ? catsShort[c] : nm, { col: C.ink, size: k.W < 640 ? 10 : 12 }); });
        const mx = M.x + M.w / 2, my = M.y + M.h / 2;
        let refused = 0, found = 0;
        attacks.forEach((a, j) => {
          const st = 0.04 + j / attacks.length * 0.7, u = clamp01((f.p - st) / 0.16); if (u <= 0) return;
          const x0 = RT.x + RT.w - 20, y0 = catY(a.c);
          const p1 = s => bez([[x0, y0], [x0 + 80, y0], [M.x - 90, my], [M.x - 4, my]], s);
          if (u < 0.6) { const s = u / 0.6, pts = []; for (let q = 6; q >= 0; q--) pts.push(p1(Math.max(0, s - q * 0.04))); k.trail(pts, C.amb, { w: 2.2 }); k.dot(...p1(s), 4.5, C.amb, { glow: 10 }); return; }
          const s2 = (u - 0.6) / 0.4;
          if (!a.through) { if (u < 1) { const c = k.ctx; c.save(); c.globalAlpha = 1 - s2; c.strokeStyle = C.sig; c.lineWidth = k.px(2); c.beginPath(); c.arc(M.x - 6, my, 10 + 40 * s2, Math.PI * 0.6, Math.PI * 1.4); c.stroke(); c.restore(); } refused++; return; }
          const p2 = s => bez([[M.x + M.w, my], [M.x + M.w + 70, my], [F.x - 70, F.y + 120], [F.x + 4, F.y + 120]], s);
          if (u < 1) { const pts = []; for (let q = 6; q >= 0; q--) pts.push(p2(Math.max(0, s2 - q * 0.05))); k.trail(pts, C.amb, { w: 2.2 }); k.dot(...p2(s2), 5, C.amb, { glow: 12 }); }
          found++;
        });
        const hit = attacks.some((a, j) => { const st = 0.04 + j / attacks.length * 0.7, u = (f.p - st) / 0.16; return u > 0.55 && u < 0.75; });
        k.box(M.x, M.y, M.w, M.h, { fill: C.bg2, stroke: hit ? C.sig : C.line, r: 16, glow: hit ? 16 : 0, glowCol: C.sig, lw: 2 });
        k.text(mx, my - 10, "Model", { size: 20, weight: "650" });
        k.label(mx, M.y + M.h + 20, "says no to most", { col: C.sig, size: 12 });
        k.box(F.x, F.y, F.w, F.h, { fill: C.bg2, stroke: found ? C.amb : C.line, r: 14 });
        k.label(F.x + F.w / 2, F.y - 18, "Findings", { col: C.ink, weight: "600" });
        for (let j = 0; j < found; j++) k.box(F.x + 24, F.y + 30 + j * 34, F.w - 48, 22, { fill: C.amb, r: 6, alpha: 0.75 });
        const g = easeOut((f.p - 0.86) / 0.12);
        if (g > 0) { k.box(F.x + 24, F.y + F.h - 110, F.w - 48, 40, { fill: C.sig, r: 10, alpha: g, glow: 12 }); k.text(F.x + F.w / 2, F.y + F.h - 90, "Add safeguards", { col: C.bg, size: 15, weight: "650", alpha: g });
          k.box(F.x + 24, F.y + F.h - 60, F.w - 48, 40, { stroke: C.sig, r: 10, alpha: g }); k.text(F.x + F.w / 2, F.y + F.h - 40, "Release decision", { col: C.sig, size: 15, weight: "650", alpha: g }); }
        hud(k, "tr", "Safety evaluation", [["attacks tried", String(refused + found)], ["refused", String(refused), C.sig], ["weak spots found", String(found), found ? C.amb : C.muted]], { w: 200 });
      }
    }
  });
});
