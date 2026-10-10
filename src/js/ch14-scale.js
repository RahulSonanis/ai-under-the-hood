/* Chapter 14 · Training at scale. The learner plans one training run on a 16,384-GPU cluster and watches it play out.
   Plan: model size N and training tokens D (work = 6·N·D), how each copy of the model is split (tensor × pipeline;
   the rest of the GPUs hold copies = data parallel), and how often to save a checkpoint.
   Loss: Epoch AI's re-fit of the Chinchilla law, L = 1.82 + 482.0/N^0.348 + 2085.4/D^0.366 (ref 50, 8).
   Memory: 16 bytes per parameter for weights, gradients and Adam state (ref 11) + 10 GB working space (illustrative).
   Speed: H100 BF16 peak 989 TFLOPS; 50% of peak before pipeline bubbles and a 5% tensor-parallel overhead (illustrative,
   chosen so Meta's layout lands near its reported 41% MFU, ref 9). Bubble = (p-1)/(m+p-1) with m = 64 micro-batches.
   Failures: 0.47 per 1,000 GPU-days (Llama 3: 419 unexpected interruptions, 54 days, 16,384 GPUs, ref 9) -> one every ~3.1 h.
   Save pauses the job 1 min, restart takes 6 min (illustrative). Time is sped up: 1 s at 1× = 4 hours. */
chapter("scale", () => {
  const LE = 1.82, LA = 482.0, LB = 2085.4, AL = 0.348, BE = 0.366;
  const loss = (N, D) => LE + LA / N ** AL + LB / D ** BE;
  const G = 16384, PEAK = 989e12, MICRO = 64, ACT = 10, HBM = 80, SAVE = 1, RESTART = 6;
  const MTBF = 1 / (G * 0.47 / 1000 / 1440);            // minutes between failures (~187)
  const MIN_PER_S = 240, DEADLINE = 60, TARGET = 1.905;
  const SPLITS = { 1: [1, 1], 8: [8, 1], 32: [8, 4], 128: [8, 16] };
  const CAUSES = [["faulty GPU", 148], ["GPU memory chip", 72], ["network switch or cable", 35], ["GPU on-chip memory", 19], ["GPU system processor", 17], ["CPU", 2], ["software bug or other part", 126]];
  const CSUM = CAUSES.reduce((a, c) => a + c[1], 0);

  const SIZES = [1, 2, 3, 5, 8, 13, 20, 35, 50, 70, 100, 140, 200, 300, 405, 500, 700, 1000].map(x => x * 1e9);
  const TOKS = [0.1, 0.2, 0.5, 1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30].map(x => x * 1e12);
  const fmtN = n => n >= 1e12 ? (n / 1e12).toFixed(n >= 1e13 ? 0 : 1) + "T" : n >= 1e10 ? Math.round(n / 1e9) + "B" : (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  const fmtD = d => d >= 1e12 ? (d / 1e12 >= 10 ? Math.round(d / 1e12) : (d / 1e12).toFixed(1).replace(/\.0$/, "")) + "T" : Math.round(d / 1e9) + "B";
  const fmtMin = m => m < 60 ? Math.round(m) + " min" : (m / 60 % 1 ? (m / 60).toFixed(1) : m / 60) + " h";
  const fmtDays = d => !isFinite(d) ? "—" : d < 10 ? d.toFixed(1) : d < 1000 ? String(Math.round(d)) : fmt(d, 1);
  const supE = x => { const e = Math.floor(Math.log10(x)); return (x / 10 ** e).toFixed(1) + " × 10" + sup(e); };

  // ---------- derived quantities for a plan ----------
  function derive(s) {
    const [t, p] = SPLITS[s.split], tp = t * p;
    const bubble = (p - 1) / (MICRO + p - 1), eff = 0.5 * (1 - bubble) * (t > 1 ? 0.95 : 1);
    const mem = 16 * s.N / tp / 1e9 + ACT, fits = mem <= HBM;
    const flops = 6 * s.N * s.D, workMin = flops / (G * PEAK * eff) / 60;
    const g = Math.max(0.02, 1 - SAVE / s.tau - (s.tau / 2 + RESTART) / MTBF);  // expected share of time kept
    const L = loss(s.N, s.D);
    const C = flops; let best = 0, bl = 9;
    for (let lg = 9; lg <= 12.5; lg += 0.01) { const n = 10 ** lg, l = loss(n, C / 6 / n); if (l < bl) { bl = l; best = n; } }
    return { t, p, tp, copies: G / tp, bubble, eff, mem, fits, flops, workMin, g, L, best, bestL: bl, ratio: s.D / s.N };
  }
  function projDays(s, d) {
    if (!d.fits) return Infinity;
    if (s.phase === "done") return s.doneAt / 1440;
    return (s.t + (1 - s.prog) * d.workMin / d.g) / 1440;
  }

  // ---------- the run ----------
  function newRun(s) {
    Object.assign(s, { t: 0, prog: 0, saved: 0, since: 0, phase: "work", left: 0, segs: [], hist: [[0, 0]], fails: 0, lostMin: 0, saveMin: 0, restMin: 0,
      failDot: -1, lastFail: -1e9, log: [], doneAt: 0, nextFail: expo(s), lastHist: 0, gantt: 0, wave: 0, lastLost: 0, lastCause: "" });
    s.d = derive(s); if (!s.d.fits) s.phase = "nofit";
  }
  const expo = s => -Math.log(Math.max(1e-12, s.rand())) * MTBF;
  function seg(s, kind, a, dur) { const L = s.segs[s.segs.length - 1]; if (L && L[0] === kind && Math.abs(L[1] + L[2] - a) < 1e-6) L[2] += dur; else s.segs.push([kind, a, dur]); }
  function fail(s, forced, dot) {
    const lost = s.since + (s.phase === "save" ? SAVE - s.left : 0);
    s.fails++; s.lostMin += lost; s.prog = s.saved; s.since = 0; s.lastLost = lost;
    s.segs.push(["lost", s.t - lost, lost]);
    let u = s.rand() * CSUM, c = 0; while (u > CAUSES[c][1]) { u -= CAUSES[c][1]; c++; }
    s.lastCause = forced ? "GPU you broke" : CAUSES[c][0];
    s.failDot = dot != null ? dot : Math.floor(s.rand() * 512); s.lastFail = s.t; s.realFail = s.clock;
    s.log.unshift([s.t, `${s.lastCause} · lost ${fmtMin(lost)}`, "bad"]); s.log = s.log.slice(0, 4);
    s.hist.push([s.t, s.prog]);
    s.phase = "restart"; s.left = RESTART; s.nextFail = expo(s);
  }
  function advance(s, dm) {
    const d = s.d;
    while (dm > 1e-9 && (s.phase === "work" || s.phase === "save" || s.phase === "restart")) {
      if (s.phase === "work") {
        const toEnd = (1 - s.prog) * d.workMin, toSave = s.tau - s.since;
        const st = Math.min(dm, s.nextFail, toSave, toEnd);
        seg(s, "work", s.t, st); s.t += st; dm -= st; s.nextFail -= st; s.since += st; s.prog = Math.min(1, s.prog + st / d.workMin);
        if (s.prog >= 1 - 1e-9) { s.phase = "done"; s.doneAt = s.t; s.hist.push([s.t, 1]); s.log.unshift([s.t, "training finished", "ok"]); break; }
        if (s.nextFail <= 1e-9) fail(s);
        else if (s.since >= s.tau - 1e-9) { s.phase = "save"; s.left = SAVE; }
      } else {
        const st = Math.min(dm, s.left, s.phase === "save" ? s.nextFail : Infinity);
        seg(s, s.phase, s.t, st); s.t += st; dm -= st; s.left -= st;
        if (s.phase === "save") { s.saveMin += st; s.nextFail -= st; if (s.nextFail <= 1e-9) { fail(s); continue; } }
        else s.restMin += st;
        if (s.left <= 1e-9) { if (s.phase === "save") { s.saved = s.prog; s.since = 0; } else s.failDot = -1; s.phase = "work"; }
      }
      if (s.t - s.lastHist >= 120) { s.hist.push([s.t, s.prog]); s.lastHist = s.t; }
    }
    if (s.phase === "work" || s.phase === "save" || s.phase === "restart") s.t += 0; // time only moves while the job exists
    const cut = s.t - 1500; if (s.segs.length > 40) s.segs = s.segs.filter(g => g[1] + g[2] > cut);
  }
  function step(s, dt) {
    s.clock += dt;
    s.d.g = Math.max(0.02, 1 - SAVE / s.tau - (s.tau / 2 + RESTART) / MTBF);
    if (s.phase === "work") { s.gantt = (s.gantt + dt * 0.55) % 1; }
    s.wave = (s.wave + dt * 0.8) % 1;
    advance(s, dt * MIN_PER_S);
  }
  const kept = s => s.t > 0 ? Math.max(0, s.prog * s.d.workMin) / s.t : s.d.g;       // share of wall-clock time whose work was kept
  const useful = s => kept(s) * (1 - s.d.bubble);

  // ---------- layout (world units; text spacing uses screen pixels via k.px) ----------
  const LW = { A: [20, 20, 500, 470], B: [540, 20, 520, 470], C: [1080, 20, 500, 470], D: [20, 510, 1560, 350] };
  const LN = { B: [0, 0, 1000, 640], C: [0, 655, 1000, 400], D: [0, 1075, 1000, 560] };
  function panel(k, r, title) {
    const [x, y, w, h] = r; k.box(x, y, w, h, { stroke: k.C.line, r: 16 });
    k.label(x + k.px(14), y + k.px(17), title, { align: "left", col: k.C.ink, weight: "650", size: 13 });
  }

  function drawPlan(k, s, r) {
    const C = k.C, d = s.d, [x, y, w, h] = r, P = k.px;
    panel(k, r, "1 · Model size and data");
    k.label(x + P(14), y + P(40), `${fmtN(s.N)} parameters reading ${fmtD(s.D)} tokens`, { align: "left", col: C.amb, size: 12, weight: "600" });
    k.label(x + P(14), y + P(57), `${Math.round(d.ratio).toLocaleString()} tokens per parameter`, { align: "left", size: 11 });
    k.label(x + P(14), y + P(73), `work: 6 × N × D = ${supE(d.flops)} operations`, { align: "left", size: 11 });
    const px = x + P(36), py = y + P(108), pw = w - P(54), ph = h - P(108) - P(40), lo = 9, hi = 12;
    const pts = []; for (let lg = lo; lg <= hi + 1e-9; lg += 0.02) { const n = 10 ** lg; pts.push([lg, loss(n, d.flops / 6 / n)]); }
    const ymin = Math.min(d.bestL, d.L) - 0.07, ymax = ymin + 0.45;
    const X = lg => px + (lg - lo) / (hi - lo) * pw, Y = l => py + ph - (Math.min(ymax, l) - ymin) / (ymax - ymin) * ph;
    k.line(px, py + ph, px + pw, py + ph, { col: C.line }); k.line(px, py, px, py + ph, { col: C.line });
    [9, 10, 11, 12].forEach(e => k.label(X(e), py + ph + P(11), ["1B", "10B", "100B", "1T"][e - 9], { size: 10 }));
    k.label(px + pw / 2, py + ph + P(26), "model size, for the same amount of work", { size: 10 });
    k.label(px, py - P(10), "predicted loss · lower is better", { align: "left", size: 10 });
    if (TARGET > ymin && TARGET < ymax) { k.line(px, Y(TARGET), px + pw, Y(TARGET), { col: C.ok, dash: [4, 5], alpha: 0.7 }); k.label(px + P(4), Y(TARGET) - P(8), "goal 1.905", { align: "left", col: C.ok, size: 10 }); }
    const c = k.ctx; c.save(); c.strokeStyle = C.sig; c.lineWidth = P(2); c.beginPath(); pts.forEach(([lg, l], i) => i ? c.lineTo(X(lg), Y(l)) : c.moveTo(X(lg), Y(l))); c.stroke(); c.restore();
    const bx = X(Math.log10(d.best)), by = Y(d.bestL); k.dot(bx, by, P(4), C.sig, { glow: 10 });
    k.label(bx, by + P(14), `best size: ${fmtN(d.best)}`, { col: C.sig, size: 10, bg: true });
    const cx = X(Math.min(hi, Math.max(lo, Math.log10(s.N)))), cy = Y(d.L); k.dot(cx, cy, P(6), C.amb, { glow: 14 });
    k.label(cx, cy - P(15), `you: ${d.L.toFixed(3)}`, { col: C.amb, size: 11, weight: "650", bg: true });
  }

  function drawSplit(k, s, r, narrow) {
    const C = k.C, d = s.d, [x, y, w, h] = r, P = k.px;
    panel(k, r, narrow ? `One copy of the model · ${d.tp} GPU${d.tp > 1 ? "s" : ""}` : `2 · One copy of the model on ${d.tp} GPU${d.tp > 1 ? "s" : ""}`);
    const gx = x + P(16), gw = w - P(32), gy = y + P(40);
    const th = P(narrow ? 40 : 44), ty = y + h - P(12) - th;            // pipeline chart at the bottom
    const gh = ty - P(22) - P(26) - gy;                                 // GPU grid fills what's left
    const cw = Math.min(P(70), gw / d.p), ch = Math.min(P(48), gh / d.t), gap = Math.min(P(4), cw * 0.2);
    const ox = gx + (gw - cw * d.p) / 2, oy = gy + (gh - ch * d.t) / 2, memF = Math.min(1, d.mem / HBM), over = !d.fits;
    const cols = MICRO + d.p - 1, head = s.gantt * cols;
    for (let j = 0; j < d.p; j++) {
      const sx = ox + j * cw, active = s.phase === "work" && head - j >= 0 && head - j < MICRO;
      if (d.t > 1 && cw > P(10)) k.box(sx + gap / 2 - P(2), oy - P(2), cw - gap + P(4), ch * d.t + P(4), { stroke: C.line, r: 5, lw: 1 });
      for (let i = 0; i < d.t; i++) {
        const cx = sx + gap / 2 + P(1), cy = oy + i * ch + P(1), cww = cw - gap - P(2), chh = ch - P(2);
        k.box(cx, cy, cww, chh, { fill: C.bg2, stroke: over ? C.crit : active ? C.amb : C.line, r: 3, lw: over || active ? 1.4 : 1 });
        k.box(cx + P(1), cy + chh * (1 - memF), cww - P(2), chh * memF - P(1), { fill: over ? C.crit : C.sig, r: 2, alpha: over ? 0.55 : 0.4 });
      }
    }
    k.label(x + w / 2, oy + ch * d.t + P(15), over ? `each GPU would need ${Math.round(d.mem)} GB · it has ${HBM}` : `each GPU holds 1/${d.tp} of it: ${Math.round(d.mem)} of ${HBM} GB`, { col: over ? C.crit : C.sig, size: 12, weight: "650" });
    // pipeline schedule for one training step
    const colW = gw / cols, rowH = th / d.p;
    k.label(gx, ty - P(10), d.p > 1 ? `one step through ${d.p} stages · grey = waiting (${Math.round(d.bubble * 100)}%)` : "one step: no pipeline, no waiting", { align: "left", size: 11, col: C.ink });
    for (let j = 0; j < d.p; j++) for (let c = 0; c < cols; c++) {
      const busy = c >= j && c < j + MICRO, X = gx + c * colW, Y = ty + j * rowH;
      k.box(X, Y, Math.max(P(0.5), colW - P(1)), Math.max(P(0.5), rowH - P(1)), busy ? { fill: C.amb, r: 1, alpha: c < head && s.phase === "work" ? 0.85 : 0.25 } : { fill: C.muted, r: 1, alpha: 0.2 });
    }
    if (s.phase === "work") k.line(gx + head * colW, ty - P(2), gx + head * colW, ty + th + P(2), { col: C.ink, lw: 1, alpha: 0.6 });
  }

  function dotGeom(r, k, narrow) { const [x, y, w] = r, cols = narrow ? 64 : 32, sp = (w - k.px(28)) / cols; return { cols, rows: 512 / cols, sp, x0: x + k.px(14), y0: y + k.px(34), dy: Math.min(sp, k.px(9)) }; }
  function dotXY(i, g) { return [g.x0 + (i % g.cols + 0.5) * g.sp, g.y0 + (Math.floor(i / g.cols) + 0.5) * g.dy]; }
  function drawCluster(k, s, r, narrow) {
    const C = k.C, d = s.d, [x, y, w, h] = r, P = k.px, g = dotGeom(r, k, narrow);
    panel(k, r, narrow ? "The cluster · 16,384 GPUs" : "3 · The cluster: 16,384 GPUs");
    const per = d.tp / 32;     // dots per copy of the model
    if (per >= 2) for (let c = 0; c < 512 / per; c++) { const [ax, ay] = dotXY(c * per, g), [bx] = dotXY(c * per + per - 1, g); k.box(ax - g.sp * 0.45, ay - g.dy * 0.45, bx - ax + g.sp * 0.9, g.dy * 0.9, { stroke: C.line, r: 3, lw: 1, alpha: 0.8 }); }
    const ph = s.phase, waveRow = s.wave * 20 - 2, rad = Math.min(g.sp, g.dy) * 0.3;
    for (let i = 0; i < 512; i++) {
      const [cx, cy] = dotXY(i, g), row = Math.floor(i / g.cols) * (16 / g.rows);
      if (i === s.failDot) { k.dot(cx, cy, rad * 1.8, C.crit, { glow: 16 }); continue; }
      let col = C.amb, a = 0.7;
      if (ph === "restart") { col = C.muted; a = 0.25; } else if (ph === "save") { col = C.sig; a = 0.9; } else if (ph === "nofit") { col = C.crit; a = 0.25; } else if (ph === "done") { col = C.ok; a = 0.6; }
      else if (Math.abs(row - waveRow) < 1.2) { col = C.sig; a = 0.95; }
      k.dot(cx, cy, rad, col, { alpha: a });
    }
    let ly = g.y0 + g.rows * g.dy + P(14);
    if (narrow) ly -= P(22); else k.label(x + P(14), ly, `1 dot = 32 GPUs · ${d.copies.toLocaleString()} copies of the model` + (narrow ? "" : " · click to break one"), { align: "left", size: 10 });
    const status = ph === "nofit" ? ["Out of memory: the job can't start", C.crit] : ph === "restart" ? ["Stopped: one failure halts every GPU", C.crit] : ph === "save" ? ["Saving a checkpoint", C.sig] : ph === "done" ? ["Finished", C.ok] : ["Working · copies sync after each step", C.amb];
    k.label(x + P(14), ly + P(22), status[0], { align: "left", col: status[1], size: 12, weight: "600" });
    s.log.slice(0, narrow ? 1 : 3).forEach((e, i) => k.label(x + P(14), ly + P(narrow ? 40 : 42) + i * P(17), `day ${(e[0] / 1440).toFixed(1)} · ${e[1]}`, { align: "left", size: 11, col: e[2] === "bad" ? C.crit : C.ok, alpha: 1 - i * 0.25 }));
  }

  function drawTime(k, s, r, narrow) {
    const C = k.C, d = s.d, [x, y, w, h] = r, P = k.px;
    panel(k, r, narrow ? "The run" : "4 · The run");
    if (!narrow) k.label(x + w - P(14), y + P(17), `failures so far: ${s.fails} · work thrown away: ${fmtMin(s.lostMin)}`, { align: "right", size: 11 });
    const sx = x + P(14), sw = w - P(28), sy = y + P(44), sh = P(16), t0 = s.t - 1440;
    k.label(sx, sy - P(7), "last 24 hours", { align: "left", size: 10 });
    k.box(sx, sy, sw, sh, { fill: C.bg2, r: 3 });
    const colOf = { work: C.amb, save: C.sig, restart: C.muted, lost: C.crit };
    ["work", "save", "restart", "lost"].forEach(kind => s.segs.forEach(([kd, a, du]) => { if (kd !== kind) return; const A = Math.max(a, t0), B = Math.min(a + du, s.t); if (B <= A) return; k.box(sx + (A - t0) / 1440 * sw, sy + (kind === "lost" ? 0 : P(2)), Math.max(P(1.5), (B - A) / 1440 * sw), sh - (kind === "lost" ? 0 : P(4)), { fill: colOf[kind], r: 1, alpha: kind === "work" ? 0.6 : 0.95 }); }));
    let lx = sx; [["working", C.amb], ["saving", C.sig], ["work lost", C.crit], ["restarting", C.muted]].forEach(([t, c]) => { k.box(lx, sy + sh + P(6), P(8), P(8), { fill: c, r: 2 }); k.label(lx + P(12), sy + sh + P(10), t, { align: "left", size: 10 }); lx += P(narrow ? 76 : 92); });
    // whole run
    const px = x + P(40), pw = w - P(58), py = sy + sh + P(46), phh = y + h - P(26) - py;
    const pd = projDays(s, d), xmax = Math.min(400, Math.max(DEADLINE * 1.15, isFinite(pd) ? pd * 1.08 : DEADLINE * 1.15));
    const X = days => px + Math.min(1, days / xmax) * pw, Y = f => py + phh - f * phh;
    k.line(px, py + phh, px + pw, py + phh, { col: C.line }); k.line(px, py, px, py + phh, { col: C.line });
    k.label(px - P(6), Y(1), "100%", { align: "right", size: 10 }); k.label(px - P(6), Y(0), "0%", { align: "right", size: 10 });
    k.label(sx, py - P(14), "whole run · share of training done", { align: "left", size: 10 });
    const stp = xmax > 200 ? 100 : xmax > 100 ? 50 : 20; for (let dd = stp; dd < xmax; dd += stp) if (Math.abs(dd - DEADLINE) > xmax * 0.08) k.label(X(dd), py + phh + P(11), "day " + dd, { size: 10 });
    k.line(X(DEADLINE), py, X(DEADLINE), py + phh, { col: C.ok, dash: [5, 5] }); k.label(X(DEADLINE), py + phh + P(11), "deadline · day 60", { col: C.ok, size: 10 });
    if (s.phase !== "nofit") {
      const c = k.ctx; c.save(); c.strokeStyle = C.sig; c.lineWidth = P(2.2); c.beginPath(); s.hist.concat([[s.t, s.prog]]).forEach(([t, f], i) => i ? c.lineTo(X(t / 1440), Y(f)) : c.moveTo(X(t / 1440), Y(f))); c.stroke(); c.restore();
      const nx = X(s.t / 1440), ny = Y(s.prog);
      if (s.phase !== "done" && isFinite(pd)) { k.line(nx, ny, X(pd), Y(1), { col: C.muted, dash: [3, 5] }); k.dot(X(pd), Y(1), P(3), pd > DEADLINE ? C.crit : C.ink); k.label(X(pd) + (X(pd) > px + pw * 0.8 ? -P(8) : P(8)), Y(1) + P(12), pd > 400 ? `finish: day ${fmtDays(pd)} →` : `finish ≈ day ${fmtDays(pd)}`, { col: pd > DEADLINE ? C.crit : C.ink, size: 11, weight: "600", bg: true, align: X(pd) > px + pw * 0.8 ? "right" : "left" }); }
      k.dot(nx, ny, P(4), s.phase === "done" ? C.ok : C.sig, { glow: 12 });
      if (s.phase === "done") k.label(nx + P(8), ny + P(10), `done · day ${fmtDays(s.doneAt / 1440)}`, { col: s.doneAt / 1440 <= DEADLINE ? C.ok : C.crit, size: 11, weight: "650", bg: true, align: "left" });
    } else k.label(px + pw / 2, py + phh / 2, "the job can't start: each GPU's share doesn't fit in its memory", { col: C.crit, size: 12, bg: true });
  }

  function draw(k, s, sim) {
    if (sim.narrow) { drawSplit(k, s, LN.B, true); drawCluster(k, s, LN.C, true); drawTime(k, s, LN.D, true); }
    else { drawPlan(k, s, LW.A); drawSplit(k, s, LW.B); drawCluster(k, s, LW.C); drawTime(k, s, LW.D); }
  }

  const replan = s => { if (s.ready) newRun(s); };
  const sim = makeSim($("#scale-sim"), {
    label: "Training-run simulation. Left: predicted loss against model size. Middle: one copy of the model split across GPUs, with its memory and pipeline schedule. Right: the 16,384-GPU cluster; failures show in red. Bottom: the last 24 hours and the whole run's progress against a 60-day deadline.",
    cams: { default: { x: 10, y: 10, w: 1580, h: 860 }, split: { x: 530, y: 10, w: 1060, h: 490 } },
    camsNarrow: { default: { x: -6, y: -6, w: 1012, h: 1645 } },
    height: w => w < 640 ? Math.round(w * 1.62) : Math.round(Math.min(640, Math.max(400, w * 0.56))),
    camera: s => s.focus || "default",
    speeds: [1, 6, 30],
    seed: 2024,
    init: rand => { for (let i = 0; i < 20; i++) rand(); return { rand, clock: 0, N: 70e9, D: 15e12, split: 32, tau: 120, focus: "default", ready: false }; },
    warmup: 6,
    intro: "A training run is under way. Every 3 hours or so a GPU breaks and the job rolls back. Plan a better run with the controls; changing the model, data or split starts a new run.",
    controls: [
      { id: "size", label: "Model size", type: "range", min: 0, max: SIZES.length - 1, step: 1, value: SIZES.indexOf(70e9), fmt: v => fmtN(SIZES[v]) + " parameters", help: "Bigger models learn more from the same data but need more memory and more maths.", apply: (s, v) => { s.N = SIZES[v]; s.focus = "default"; replan(s); } },
      { id: "tokens", label: "Training data", type: "range", min: 0, max: TOKS.length - 1, step: 1, value: TOKS.indexOf(15e12), fmt: v => fmtD(TOKS[v]) + " tokens", help: "Every parameter reads every token: work grows with size × data.", apply: (s, v) => { s.D = TOKS[v]; replan(s); } },
      { id: "split", label: "GPUs per copy of the model", type: "choice", value: 32, options: [[1, "1"], [8, "8"], [32, "8 × 4"], [128, "8 × 16"]], help: "8 = one server shares every layer (tensor). × 4 or × 16 = layers spread along servers (pipeline). The other GPUs hold more copies (data).", apply: (s, v) => { s.split = v; replan(s); } },
      { id: "save", label: "Save a checkpoint every", type: "range", min: 5, max: 240, step: 5, value: 120, fmt: v => fmtMin(v), help: "A save pauses everything for about a minute. A failure loses everything since the last save.", apply: (s, v) => { s.tau = v; if (s.d) s.d.g = Math.max(0.02, 1 - SAVE / v - (v / 2 + RESTART) / MTBF); } }
    ],
    step: (s, dt, sim) => { if (!s.ready) { s.ready = true; newRun(s); } step(s, dt); },
    draw: (k, s, sim) => { if (!s.ready) { s.ready = true; newRun(s); } draw(k, s, sim); },
    click: (s, wx, wy, sim) => {
      const g = dotGeom(sim.narrow ? LN.C : LW.C, sim.kit, sim.narrow); if (s.phase !== "work" && s.phase !== "save") return;
      let bi = -1, bd = 1e9; for (let i = 0; i < 512; i++) { const [cx, cy] = dotXY(i, g), dd = (cx - wx) ** 2 + (cy - wy) ** 2; if (dd < bd) { bd = dd; bi = i; } }
      if (bd < g.sp * g.sp * 1.5) { fail(s, true, bi); s.forced = (s.forced || 0) + 1; }
    },
    stats: s => {
      if (!s.d) return []; const d = s.d, pd = projDays(s, d), u = useful(s);
      return [["days to finish", d.fits ? (s.phase === "done" ? fmtDays(pd) : "≈ " + fmtDays(pd)) : "—", !d.fits ? "bad" : pd <= DEADLINE ? "ok" : "bad"],
        ["useful GPU time", d.fits ? Math.round(u * 100) + "%" : "—", u >= 0.7 ? "ok" : u >= 0.5 ? "hot" : "bad"],
        ["predicted loss", d.L.toFixed(3), d.L <= TARGET ? "ok" : ""],
        ["memory per GPU", Math.round(d.mem) + " / 80 GB", d.fits ? "" : "bad"],
        ["failures so far", String(s.fails), s.fails ? "hot" : ""]];
    },
    goal: { text: "train a model with predicted loss 1.905 or lower, finished within 60 days", check: s => { if (!s.d) return {}; const pd = projDays(s, s.d); return { done: s.phase === "done" && pd <= DEADLINE && s.d.L <= TARGET, progress: `loss ${s.d.L.toFixed(3)} · ${s.d.fits ? (s.phase === "done" ? "" : "≈ ") + fmtDays(pd) + " days" : "doesn't fit"}` }; } },
    notices: [
      { id: "nofit", when: s => s.d && !s.d.fits, say: s => `Each GPU would need <b>${Math.round(s.d.mem)} GB</b> but has 80. Training keeps about 16 bytes per parameter (the weights plus learning notes), so ${fmtN(s.N)} parameters need ${bytes(16 * s.N)} in total. Spread each copy over more GPUs.` },
      { id: "done", when: s => s.phase === "done", say: s => { const dd = s.doneAt / 1440, L = s.d.L; return dd <= DEADLINE && L <= TARGET ? `Finished in <b>${fmtDays(dd)} days</b> with a predicted loss of <b>${L.toFixed(3)}</b>. That's a plan a real team could defend: big enough, fed enough data, and saved often enough to survive ${s.fails} failures.` : dd > DEADLINE ? `Finished, but on day ${fmtDays(dd)}, after the deadline. Less work (a smaller model or less data) or less waste would bring it in.` : `Finished in ${fmtDays(dd)} days with ${Math.round(DEADLINE - dd)} to spare. The cluster could have trained a bigger model or read more data and reached a lower loss than ${L.toFixed(3)}.`; } },
      { id: "fail1", once: true, when: s => s.fails > 0 && s.clock - s.realFail < 3, say: s => `A ${s.lastCause} failed. One GPU out of 16,384 stopped the whole job: every GPU went back to the last save, throwing away ${fmtMin(s.lastLost)} of work, and waits ${RESTART} minutes to restart.` },
      { id: "late", when: s => s.d.fits && projDays(s, s.d) > DEADLINE * 1.05 && s.t > 200, say: s => `At this pace the run needs about <b>${fmtDays(projDays(s, s.d))} days</b>. 6 × ${fmtN(s.N)} × ${fmtD(s.D)} = ${supE(s.d.flops)} operations is more than this cluster can do in 60 days. Shrink the model or the data, or waste less time.` },
      { id: "rare", when: s => s.tau >= 60 && s.fails > 0 && s.phase !== "done", say: s => `You save every ${fmtMin(s.tau)}, but something breaks about every 3 hours. Each failure throws away everything since the last save, on average ${fmtMin(s.tau / 2)} on all 16,384 GPUs. Only ${Math.round(kept(s) * 100)}% of the time is producing work that's kept.` },
      { id: "often", when: s => s.tau <= 10 && s.phase !== "done", say: s => `Saving every ${s.tau} minutes: each save pauses the job for a minute, so about ${Math.round(SAVE / s.tau * 100)}% of the time goes on saving. Failures are cheap now, but the saves aren't.` },
      { id: "ratio", when: s => s.d.fits && (s.d.ratio < 8 || s.d.ratio > 80) && s.phase !== "done", say: s => s.d.ratio < 8 ? `Only ${s.d.ratio.toFixed(1)} tokens per parameter: a big model that doesn't read enough. For the same work, a ${fmtN(s.d.best)} model reading more would reach a lower loss.` : `${Math.round(s.d.ratio).toLocaleString()} tokens per parameter: a small model reading a lot. For the same work, a ${fmtN(s.d.best)} model would reach a lower loss. (Small models are cheaper to serve, which is why teams do this anyway.)` },
      { id: "bubble", when: s => s.d.fits && s.d.p > 1 && s.phase === "work", say: s => `With ${s.d.p} pipeline stages, each GPU waits at the start and end of every step for work to reach it or drain away (grey cells): ${Math.round(s.d.bubble * 100)}% of its time. It's the price of fitting a ${fmtN(s.N)} model.` },
      { id: "calm", when: s => s.d.fits && s.phase !== "done", say: s => `Day ${(s.t / 1440).toFixed(1)}, ${Math.round(s.prog * 100)}% done. A bigger model or more data lowers the loss but takes longer; the deadline is day 60.` }
    ],
    facts: [
      { id: "meta419", when: s => s.fails >= 4, text: "Meta, the company behind the open Llama models, logged 419 unexpected interruptions in 54 days while training its largest Llama 3 model on 16,384 GPUs: about one every three hours, the rate used here. Automation kept useful training time above 90%.", ref: "#ref-9" },
      { id: "meta405", when: s => s.split === 128 && s.d && s.d.fits, text: "Meta split its 405-billion-parameter Llama 3 model exactly like this: 8 GPUs per layer, 16 pipeline stages and 128 copies on 16,384 GPUs, keeping about 41% of the GPUs' peak maths busy.", ref: "#ref-9" }
    ],
    tour: [
      { say: "This is one training run on 16,384 GPUs: an 8-billion-parameter model reading 15 trillion tokens. The bottom chart shows how much of the training is done. For this cluster it's a small job.", set: { size: SIZES.indexOf(70e9), tokens: TOKS.indexOf(15e12), split: 32, save: 120 }, act: s => { s.focus = "default"; }, wait: 7 },
      { say: "Red means a GPU broke. One failure stops all 16,384 GPUs, and they go back to the last save. Saving every 2 hours throws away about an hour of everyone's work each time (red in the 24-hour strip).", act: s => { if (s.phase === "work") fail(s, false); }, wait: 7 },
      { say: "Save every 20 minutes instead. Each save pauses the job for a minute, but a failure now costs about 10 minutes. Watch useful GPU time climb.", set: { save: 20 }, wait: 7 },
      { say: "Now a big model: 405 billion parameters. Training keeps about 16 bytes per parameter, 6.5 TB in all. Split over 8 GPUs that's over 800 GB each. It doesn't fit.", set: { size: SIZES.indexOf(405e9) }, act: s => { s.focus = "split"; }, wait: 7 },
      { say: "Split each copy over 128 GPUs: 8 share every layer inside one server, and 16 servers each take a slice of the layers, like an assembly line. Each GPU now holds about 60 GB. The cost: grey waiting time at the start and end of each step.", set: { split: 128 }, act: s => { s.focus = "split"; }, wait: 8 },
      { say: "Last dial: data. At 15 trillion tokens this run would end well past day 60. Fewer tokens, or a smaller model, brings it in. Can you get the predicted loss to 1.905 within 60 days?", act: s => { s.focus = "default"; }, wait: 7 }
    ],
    publish: s => {
      if (!s.d) return {}; const d = s.d, pd = projDays(s, d);
      return { scN: fmtN(s.N), scD: fmtD(s.D), scFlops: supE(d.flops), scRatio: Math.round(d.ratio).toLocaleString(), scBest: fmtN(d.best), scLoss: d.L.toFixed(3),
        scMem: Math.round(d.mem) + " GB", scTB: bytes(16 * s.N), scTP: String(d.tp), scCopies: d.copies.toLocaleString(), scBubble: Math.round(d.bubble * 100) + "%", scP: String(d.p),
        scDays: d.fits ? fmtDays(pd) : "—", scTau: fmtMin(s.tau), scHalf: fmtMin(s.tau / 2), scKept: Math.round(kept(s) * 100) + "%", scUseful: Math.round(useful(s) * 100) + "%", scFails: String(s.fails),
        scWaste: Math.round((SAVE / s.tau + (s.tau / 2 + RESTART) / MTBF) * 100) + "%", scSaveCost: (SAVE / s.tau * 100).toFixed(1) + "%", scFailCost: Math.round((s.tau / 2 + RESTART) / MTBF * 100) + "%",
        scGPUdays: fmt(d.flops / (PEAK * d.eff) / 86400, 1), scEff: Math.round(d.eff * 100) + "%" };
    }
  });
});
