/* Chapter 6 film: one GPU, many conversations.
   A GPU as a memory block (HBM), a pipe (memory bandwidth) and a compute block. Numbers follow the
   chapter's own simulator: Llama 3 8B in BF16 on an H100 at 70% of peak bandwidth and 50% of peak compute. */
chapter("sharing", () => {
  const fig = $("#bt-film"); if (!fig) return;
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const convCol = ["#5ce1c6", "#ffb547", "#8fb3ff", "#d59cff", "#ff8fa3", "#9be37a", "#7fdcff", "#ffd27a"];
  // the GPU
  const M = { x: 40, y: 140, w: 400, h: 420, gx: 62, gy: 200, cols: 20, rows: 16, cell: 14, gap: 3 };
  const cellXY = c => [M.gx + (c % M.cols) * (M.cell + M.gap), M.gy + Math.floor(c / M.cols) * (M.cell + M.gap)];
  const W_CELLS = 64; // 16 GB of weights, 0.25 GB per cell
  const PIPE = { x0: 440, x1: 640, y: 350, h: 36 };
  const CU = { x: 640, y: 190, w: 260, h: 320, gx: 653, gy: 230, n: 8, cell: 24, gap: 6 };
  const SEAT = { x: 960, x1: 1320 };
  // chapter's simulator numbers
  const BW = 3.35e12 * 0.7, FL = 989e12 * 0.5, NP = 8.03e9, WB = NP * 2, KVT = 131072;
  const sim = (B, ctx) => { const kv = B * ctx * KVT, mem = (WB + kv) / BW, comp = 2 * NP * B / FL, t = Math.max(mem, comp); return { B, ctx, kv, t, busy: comp / t }; };
  const SC = { one: sim(1, 1000), batch: sim(16, 1000), long: sim(16, 16000) };
  const SECS_PER_MS = 0.18; // story seconds per real millisecond of step time

  const steps = [
    { key: "gpu", short: "The GPU", title: "A GPU: memory, a pipe, and maths units", dur: 5,
      text: [`A GPU has a big memory that holds the model's weights, and fast maths units that use them. A pipe connects the two, and it is the slow part.`,
             `An H100 SXM has 80 GB of HBM at 3.35 TB/s and 989 dense BF16 TFLOPS. Llama 3 8B's weights take 16 GB in BF16.`], link: "#ref-23" },
    { key: "one", short: "One person", title: "One person: the maths units mostly wait", dur: 6,
      text: [`To write one word for one person, every weight has to travel through the pipe. The maths takes a moment; the reading takes far longer. Most maths units sit idle.`,
             `Each decode step reads all 16 GB of weights: about 6.9 ms at 70% of peak bandwidth. The 16 GFLOPs of maths need about 0.03 ms at 50% of peak compute.`] },
    { key: "batch", short: "Sixteen people", title: "Sixteen people share one read", dur: 6,
      text: [`With 16 short conversations and memory to spare, the weights are read once and used 16 times. The step takes barely longer, and 16 words come out instead of 1.`,
             `Arithmetic intensity is roughly the batch size, far below the H100 ridge point of about 295 FLOPs per byte, so the step stays memory-bound: about 7.7 ms for 16 tokens at 1,000 tokens of context each.`] },
    { key: "long", short: "Long chats", title: "Long conversations add their own reads", dur: 6.5,
      text: [`Each person's notes (the KV cache) must be read every step too. With long conversations the pipe carries much more, so every step slows down.`,
             `At 16,000 tokens each, 16 KV caches at 128 KiB per token add 34 GB of reads per step, so a step takes about 21 ms instead of 7.7 ms.`] },
    { key: "static", short: "Static batching", title: "Static batching waits for the slowest reply", dur: 6.5,
      text: [`If the server waits for the longest reply before letting anyone new in, seats sit empty while one long reply finishes.`,
             `A static batch takes max(ℓ₁…ℓ_B) steps but does only Σℓᵢ useful work, so utilisation is E[ℓ] / E[max ℓ]. Reply lengths here are illustrative.`] },
    { key: "cont", short: "Continuous", title: "Continuous batching refills seats at once", dur: 6.5,
      text: [`A better server lets someone new take a seat the moment a reply finishes. The seats stay full and more people get answers in the same time.`,
             `Iteration-level scheduling, introduced by Orca and standard in vLLM, TensorRT-LLM and SGLang, admits new requests at every decode step.`], link: "#ref-35" }
  ];
  const camsW = {
    gpu: { x: 0, y: 110, w: 1060, h: 530 },
    one: { x: 20, y: 80, w: 1300, h: 640 }, batch: { x: 20, y: 80, w: 1300, h: 640 }, long: { x: 20, y: 80, w: 1300, h: 640 },
    static: { x: 620, y: 60, w: 760, h: 500 }, cont: { x: 620, y: 60, w: 760, h: 500 }
  };
  const camsN = {
    gpu: { x: 20, y: 120, w: 900, h: 460 },
    one: { x: 30, y: 120, w: 1050, h: 480 }, batch: { x: 30, y: 120, w: 1050, h: 480 }, long: { x: 30, y: 120, w: 1050, h: 480 },
    static: { x: 870, y: 50, w: 480, h: 490 }, cont: { x: 870, y: 50, w: 480, h: 490 }
  };
  const cams = { ...camsW, default: camsW.gpu };
  let NAR = false;

  // ---------- requests for the seat timeline (illustrative lengths, in decode steps) ----------
  const LENS = [6, 24, 10, 4, 16, 9, 34, 7, 12, 5, 20, 8, 14, 6, 26, 9, 11, 4, 18, 7, 13, 5, 22, 8, 10, 6, 15, 9, 12, 7, 17, 5];
  const SEATS = 8, HORIZON = 44;
  function schedule(cont) {
    const segs = []; let next = 0;
    if (!cont) {
      let t0 = 0;
      while (t0 < HORIZON) { const b = LENS.slice(next, next + SEATS).map((l, s) => ({ r: next + s, seat: s, a: t0, b: t0 + l })); next += SEATS; segs.push(...b); t0 += Math.max(...b.map(x => x.b - x.a)); }
    } else {
      const free = Array.from({ length: SEATS }, () => 0);
      while (true) { let s = 0; for (let q = 1; q < SEATS; q++) if (free[q] < free[s]) s = q; if (free[s] >= HORIZON || next >= LENS.length) break; segs.push({ r: next, seat: s, a: free[s], b: free[s] + LENS[next] }); free[s] += LENS[next]; next++; }
    }
    return segs;
  }
  const SCHED = { static: schedule(false), cont: schedule(true) };

  // ---------- drawing ----------
  function gpu(k, f, o) {
    const C = k.C, N = M.cols * M.rows, nar = NAR;
    // memory block
    k.box(M.x, M.y, M.w, M.h, { fill: C.bg2, stroke: o.memHot ? C.amb : C.line, r: 16 });
    k.label(M.x + 18, M.y + 24, nar ? "Memory · 80 GB" : "GPU memory (HBM) · 80 GB", { align: "left", col: C.ink, weight: "600" });
    for (let c = 0; c < N; c++) {
      const [x, y] = cellXY(c), st = o.cell ? o.cell(c) : null;
      k.box(x, y, M.cell, M.cell, st || { fill: C.line, r: 3, alpha: 0.35 });
    }
    // pipe
    const py = PIPE.y - PIPE.h / 2;
    k.box(PIPE.x0, py, PIPE.x1 - PIPE.x0, PIPE.h, { fill: C.bg, stroke: o.pipeHot ? C.amb : C.line, r: 8, lw: 2 });
    if (!o.noPipeLabel) k.label((PIPE.x0 + PIPE.x1) / 2, py - 16, nar ? "Bandwidth" : "Memory bandwidth", { col: o.pipeHot ? C.ink : C.muted, weight: o.pipeHot ? "650" : "500" });
    if (!o.noPipeLabel) k.label((PIPE.x0 + PIPE.x1) / 2, py + PIPE.h + 16, "3.35 TB/s", { mono: true, size: 11 });
    // compute block
    k.box(CU.x, CU.y, CU.w, CU.h, { fill: C.bg2, stroke: o.cuHot ? C.amb : C.line, r: 16 });
    k.label(CU.x + CU.w / 2, CU.y - 16, "Maths units", { col: o.cuHot ? C.ink : C.muted, weight: o.cuHot ? "650" : "500" });
    const lit = o.lit || 0;
    for (let q = 0; q < CU.n * CU.n; q++) {
      const x = CU.gx + (q % CU.n) * (CU.cell + CU.gap), y = CU.gy + Math.floor(q / CU.n) * (CU.cell + CU.gap);
      const on = lit > 0 && hash(q, o.tick || 0) < lit;
      k.box(x, y, CU.cell, CU.cell, { fill: on ? C.amb : C.line, r: 4, alpha: on ? 0.95 : 0.4, glow: on ? 12 : 0, glowCol: C.amb });
    }
  }
  function pipeFlow(k, f, frac, kvFrac, a) {
    const C = k.C;
    for (let lane = 0; lane < 3; lane++) {
      const y = PIPE.y - 10 + lane * 10;
      k.flow(u => [lerp(PIPE.x0 - 6, PIPE.x1 + 6, u), y], 5, f.t * 0.9 + lane * 0.21, frac < 1 - kvFrac ? C.amb : C.sig, { alpha: a, size: 2.6, len: 0.1 });
    }
  }
  const seatX = k => NAR ? 920 : SEAT.x;
  function seatRow(k, y, col, n, a, newest) {
    const C = k.C, sx = seatX(k), mx = NAR ? 8 : 18;
    k.dot(sx + 10, y, 7, col, { alpha: a });
    for (let q = 0; q < Math.min(n, mx); q++) k.box(sx + 26 + q * 16, y - 5, 11, 10, { fill: C.sig, r: 2, alpha: a * (q === Math.min(n, mx) - 1 && newest ? 1 : 0.55), glow: q === Math.min(n, mx) - 1 && newest ? 10 : 0 });
  }

  function decodeStep(k, f, sc, B, kvCellsEach) {
    const C = k.C, wide = !NAR;
    const cyc = sc.t * 1000 * SECS_PER_MS, el = f.p * f.segs[f.i].dur, n = Math.floor(el / cyc), u = (el / cyc) % 1;
    const kvCells = Math.ceil(B * kvCellsEach), readCells = W_CELLS + kvCells, kvFrac = kvCells / readCells;
    const head = u * readCells;
    gpu(k, f, {
      memHot: true, pipeHot: true, cuHot: u > 0.85, tick: n * 7 + Math.floor(u * 12),
      lit: Math.max(1.5 / 64, sc.busy) * (u > 0.1 ? 1 : 0),
      cell: c => {
        const isKV = c >= W_CELLS && c < W_CELLS + kvCells, idx = c, d = head - idx;
        if (c >= W_CELLS + kvCells) return null;
        const owner = isKV ? Math.floor((c - W_CELLS) / Math.max(1, kvCellsEach)) : -1;
        const baseCol = isKV ? (kvCellsEach >= 1 ? convCol[owner % 8] : C.sig) : C.muted;
        const hot = d >= 0 && d < 6;
        return { fill: hot ? (isKV ? C.sig : C.amb) : baseCol, r: 3, alpha: hot ? 1 : 0.75, glow: hot ? 10 * (1 - d / 6) : 0, glowCol: isKV ? C.sig : C.amb };
      }
    });
    pipeFlow(k, f, u, kvFrac, 1);
    // legend under the grid
    if (wide) k.box(M.gx, 498, 12, 12, { fill: C.muted, r: 3 }), k.text(M.gx + 20, 505, "weights 16 GB", { align: "left", size: 13, col: C.muted });
    if (kvCells && wide) { k.box(M.gx + 160, 498, 12, 12, { fill: C.sig, r: 3 }); k.text(M.gx + 180, 505, `KV cache ${(B * sc.ctx * KVT / 1e9).toFixed(1)} GB`, { align: "left", size: 13, col: C.muted }); }
    // seats
    const rows = B, rh = B === 1 ? 0 : 24, y0 = B === 1 ? 350 : 170;
    k.label(seatX(k), B === 1 ? 300 : 140, B === 1 ? "One person" : `${B} people`, { align: "left", col: C.ink, weight: "600" });
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * rh;
      seatRow(k, y, convCol[r % 8], n, 1, u < 0.25 && n > 0);
      if (u > 0.85) { const v = (u - 0.85) / 0.15; k.flow(w => [lerp(CU.x + CU.w, seatX(k) + 26 + Math.min(n, wide ? 17 : 7) * 16, w), lerp(350, y, w)], 1, v * 0.999, C.sig, { size: 2.5, len: 0.2 }); }
    }
    const rowsHud = [["time per step", (sc.t * 1000).toFixed(1) + " ms", C.amb], ["tokens per step", String(B), C.sig], ["each person", Math.round(1 / sc.t) + " tok/s"], ["maths units busy", (sc.busy * 100).toFixed(sc.busy < 0.01 ? 1 : 0) + "%"]];
    if (wide) k.hud("br", "One decode step", rowsHud, { w: 200 });
    else k.hud("bl", null, [rowsHud[0], rowsHud[3]], { w: 170 });
  }

  function timeline(k, f, kind) {
    const C = k.C, wide = !NAR, segs = SCHED[kind];
    const X0 = 1000, X1 = 1330, Y0 = 170, RH = 40, sw = (X1 - X0) / HORIZON;
    const now = Math.min(HORIZON, easeIO(f.p / 0.95) * HORIZON), tick = Math.floor(now);
    gpu(k, f, { noPipeLabel: true, cuHot: true, pipeHot: true, tick, lit: 2.5 / 64, cell: c => c < W_CELLS ? { fill: C.muted, r: 3, alpha: 0.75 } : null });
    pipeFlow(k, f, 0, 0, 0.9);
    if (wide) k.label(X0, Y0 - 34, "Eight seats over time", { align: "left", col: C.ink, weight: "600" });
    if (kind === "cont" || now <= 8) k.label(X1, Y0 + SEATS * RH + 6, "decode steps →", { align: "right", size: 11 });
    let busy = 0, done = 0;
    for (let s = 0; s < SEATS; s++) {
      const y = Y0 + s * RH;
      k.box(X0, y, X1 - X0, RH - 10, { stroke: C.line, r: 6, alpha: 0.6 });
      k.text(X0 - 14, y + (RH - 10) / 2, String(s + 1), { size: 12, mono: true, col: C.muted });
    }
    // empty seats: hatched gaps in static batching until the batch ends
    segs.forEach(g => {
      if (g.a >= now) return;
      const y = Y0 + g.seat * RH, xa = X0 + g.a * sw, xb = X0 + Math.min(now, g.b) * sw, col = convCol[g.r % 8];
      k.box(xa + 1, y + 3, Math.max(1, xb - xa - 2), RH - 16, { fill: col, r: 4, alpha: 0.85, glow: now < g.b ? 8 : 0, glowCol: col });
      busy += Math.min(now, g.b) - g.a; if (g.b <= now) done++;
      if (kind === "static" && g.b < now) {
        const end = Math.max(...segs.filter(h => h.a === g.a).map(h => h.b));
        const xe = X0 + Math.min(now, end) * sw;
        if (xe > X0 + g.b * sw + 2) { k.box(X0 + g.b * sw + 1, y + 3, xe - X0 - g.b * sw - 2, RH - 16, { stroke: C.amb, r: 4, dash: [3, 3], alpha: 0.7 }); }
      }
    });
    // playhead
    const xp = X0 + now * sw; k.line(xp, Y0 - 12, xp, Y0 + SEATS * RH - 6, { col: C.ink, alpha: 0.7, lw: 1.5 });
    const util = now > 0 ? busy / (SEATS * now) : 1;
    if (kind === "static" && now > 8) k.label(X0, Y0 + SEATS * RH + 6, "dashed: empty seats waiting", { col: C.amb, size: 11, align: "left" });
    const rowsHud = [["seats in use", Math.round(util * 100) + "%", util > 0.9 ? C.sig : C.amb], ["replies finished", String(done), C.sig]];
    k.hud(wide ? "tr" : "tl", kind === "static" ? "Static batching" : "Continuous batching", rowsHud, { w: 190 });
  }

  storyFilm(fig, {
    camsNarrow: { ...camsN, default: camsN.gpu },
    label: "Animated explanation of how one GPU serves many conversations at once",
    steps, cams,
    draw(k, f) {
      NAR = !!f.narrow;
      const C = k.C, p = f.p;
      if (f.key === "gpu") {
        const a1 = easeOut(p / 0.25), a2 = easeOut((p - 0.25) / 0.25), a3 = easeOut((p - 0.5) / 0.25);
        gpu(k, f, { memHot: p < 0.35, pipeHot: p >= 0.35 && p < 0.6, cuHot: p >= 0.6, tick: Math.floor(f.t * 8), lit: p >= 0.6 ? 0.08 : 0,
          cell: c => c < W_CELLS ? { fill: C.muted, r: 3, alpha: 0.8 * clamp01(a1 * 1.6 - c / W_CELLS * 0.6) } : null });
        if (a1 > 0) k.label(M.x + M.w / 2, cellXY(W_CELLS - 1)[1] + 34, NAR ? "weights · 16 GB" : "the model's weights · 16 GB", { col: C.muted, alpha: a1 });
        if (a2 > 0) pipeFlow(k, f, 0, 0, a2 * 0.8);
        if (!NAR) k.hud("br", "NVIDIA H100", [["memory", "80 GB"], ["bandwidth", "3.35 TB/s", C.amb], ["maths", "989 TFLOPS"]], { w: 180 });
        return;
      }
      if (f.key === "one") return decodeStep(k, f, SC.one, 1, 0);
      if (f.key === "batch") return decodeStep(k, f, SC.batch, 16, 1000 * KVT / 0.25e9);
      if (f.key === "long") return decodeStep(k, f, SC.long, 16, 16000 * KVT / 0.25e9);
      if (f.key === "static" || f.key === "cont") return timeline(k, f, f.key);
    }
  });
});
