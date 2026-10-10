/* Chapter 8 · Batching. The learner tunes one GPU serving a model to many people at once.
   Model: Llama 3 8B (8.03 billion weights) on one NVIDIA H100 SXM: 80 GB memory, 3.35 TB/s, 989 dense BF16 TFLOPS,
   1,979 dense FP8 TFLOPS (half the "with sparsity" datasheet figures). As in the legacy chapter 6 simulator we assume
   70% of peak bandwidth and 50% of peak compute. Step time = max(bytes read / bandwidth, sums / compute).
   KV cache ("notes") stays 16-bit: 128 KiB per token. 4-bit weights are unpacked to 16-bit for the maths
   (weight-only quantisation), so INT4 uses the BF16 compute rate. 4 GB is kept free as working space (illustrative).
   GPU price $3 per hour is illustrative. The animation runs about 25 times slower than the real step time. */
chapter("batching", () => {
  const N = 8.03e9, KV = 131072, BW = 3.35e12 * 0.7, MEM = 80e9, WORK = 4e9, PRICE = 3, SLOW = 25;
  const PREC = {
    bf16: { b: 2, F: 989e12 * 0.5, name: "16-bit", q: "reference quality" },
    fp8: { b: 1, F: 1979e12 * 0.5, name: "8-bit", q: "about the same quality" },
    int4: { b: 0.5, F: 989e12 * 0.5, name: "4-bit", q: "slightly lower quality" }
  };
  const BS = [1, 2, 4, 8, 16, 32, 48, 64, 96, 128, 192, 256];
  const LS = [256, 512, 1024, 2048, 4096, 8192, 12288, 16384, 24576, 32768];
  const fmtL = v => v < 1024 ? v + " tokens" : (v / 1024) + "k tokens";
  const cols = ["#5ce1c6", "#ffb547", "#8fb3ff", "#d59cff", "#ff8fa3", "#9be37a", "#7fdcff", "#ffd27a"];
  const NOTE = "#d59cff";
  const gb = x => x / 1e9, fGB = x => { const g = gb(x); return g < 10 ? g.toFixed(1) + " GB" : Math.round(g) + " GB"; };
  const fMs = t => { const v = t * 1000; return (v < 0.1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v)) + " ms"; };
  const fTok = v => v >= 10000 ? (v / 1000).toFixed(1) + "k" : Math.round(v).toLocaleString();
  const money = v => "$" + (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(2));

  function calc(s) {
    const pr = PREC[s.prec], W = N * pr.b, perSeat = s.ctx * KV, room = MEM - W - WORK;
    const fit = Math.max(1, Math.floor(room / perSeat)), seated = Math.min(s.B, fit);
    const kv = seated * perSeat, mem = (W + kv) / BW, comp = 2 * N * seated / pr.F, t = Math.max(mem, comp);
    const occ = s.mode === "static" ? s.occ : 1, useful = Math.max(0.05, seated * occ);
    return { pr, W, perSeat, room, fit, seated, kv, mem, comp, t, busy: comp / t, per: 1 / t, total: useful / t,
      cost: PRICE / 3600 * t / useful * 1e6, need: W + WORK + s.B * perSeat, used: W + WORK + kv, over: s.B > fit, wantKV: s.B * perSeat };
  }

  function newReply(s, seat) { seat.left = 3 + Math.floor(s.rand() * s.rand() * 34); seat.len = seat.left; seat.col = cols[(s.nextCol++) % cols.length]; seat.fresh = 1; }
  function init(rand) {
    const s = { rand, seats: [], p: 0, nextCol: 0, occ: 1, steps: 0, goalFor: 0, B: 1, ctx: 1024, prec: "bf16", mode: "cont", tokens: 0 };
    for (let i = 0; i < 256; i++) { const seat = { left: 0, len: 1, col: cols[0], flash: 0, fresh: 0 }; newReply(s, seat); s.seats.push(seat); }
    return s;
  }
  function doStep(s, m) {
    s.steps++;
    let active = 0;
    for (let i = 0; i < m.seated; i++) {
      const seat = s.seats[i];
      if (seat.left <= 0 && s.mode === "cont") newReply(s, seat);
      if (seat.left > 0) { seat.left--; seat.flash = 1; active++; s.tokens++; if (seat.left === 0 && s.mode === "cont") newReply(s, seat); }
    }
    if (s.mode === "static") { let any = false; for (let i = 0; i < m.seated; i++) if (s.seats[i].left > 0) any = true; if (!any) for (let i = 0; i < m.seated; i++) newReply(s, s.seats[i]); }
    s.lastActive = active;
  }
  function step(s, dt) {
    const m = calc(s);
    s.p += dt / (m.t * SLOW);
    let n = 0; while (s.p >= 1 && n++ < 4) { s.p -= 1; doStep(s, m); }
    if (s.p > 1) s.p = 0;
    for (const seat of s.seats) { seat.flash = Math.max(0, seat.flash - dt * 2.5); seat.fresh = Math.max(0, seat.fresh - dt * 1.2); }
    if (s.mode === "static") { let a = 0; for (let i = 0; i < m.seated; i++) if (s.seats[i].left > 0) a++; s.occ = lerp(s.occ, a / m.seated, Math.min(1, dt * 0.8)); } else s.occ = 1;
    const ok = s.ctx >= 8192 && m.seated >= 64 && !m.over && m.per >= 20 && m.cost < 0.5;
    s.goalFor = ok ? s.goalFor + dt : 0;
    s.flow = (s.flow || 0) + dt * 0.35;
  }

  // ---------- layout ----------
  const LW = { mem: { x: 40, y: 150, cols: 10, rows: 16, cell: 30, gap: 5 }, pipe: { x0: 410, x1: 640, y: 420 }, cu: { x: 650, y: 290, n: 8, cell: 26, gap: 6 },
    seat: { x: 1000, y: 150, w: 560, h: 560 }, tl: { x: 470, y: 640, w: 420 } };
  const LN = { mem: { x: 40, y: 130, cols: 8, rows: 10, cell: 40, gap: 6, gbc: 1e9 }, pipe: { x0: 425, x1: 595, y: 360 }, cu: { x: 615, y: 262, n: 8, cell: 19, gap: 5 },
    seat: { x: 40, y: 752, w: 770, h: 290 }, tl: null };

  function draw(k, s, sim) {
    const C = k.C, m = calc(s), L = sim.narrow ? LN : LW, nar = sim.narrow;
    const M = L.mem, cxy = c => [M.x + (c % M.cols) * (M.cell + M.gap), M.y + Math.floor(c / M.cols) * (M.cell + M.gap)];
    const GBCELL = M.gbc || 0.5e9, MEMCELLS = M.cols * M.rows, memW = M.cols * (M.cell + M.gap) - M.gap, memH = M.rows * (M.cell + M.gap) - M.gap;
    // ---- memory ----
    k.box(M.x - 14, M.y - 50, memW + 28, memH + 64, { stroke: m.over ? C.crit : C.line, r: 16, fill: C.bg2, alpha: 1 });
    k.label(M.x, M.y - 28, nar ? "GPU memory · 80 GB" : "GPU memory · 80 GB · one square = 0.5 GB", { align: "left", col: C.ink, weight: "600" });
    const wC = Math.round(m.W / GBCELL), workC = Math.round(WORK / GBCELL), kvC = m.kv / GBCELL;
    for (let c = 0; c < MEMCELLS; c++) {
      const [x, y] = cxy(c);
      if (c < wC) k.box(x, y, M.cell, M.cell, { fill: C.sig, r: 5, alpha: 0.55 });
      else if (c < wC + workC) k.box(x, y, M.cell, M.cell, { stroke: C.muted, r: 5, alpha: 0.6, lw: 1, dash: [3, 3] });
      else if (c < wC + workC + kvC) { const part = Math.min(1, wC + workC + kvC - c); k.box(x, y, M.cell, M.cell, { fill: NOTE, r: 5, alpha: 0.25 + 0.6 * part }); }
      else k.box(x, y, M.cell, M.cell, { fill: C.line, r: 5, alpha: 0.35 });
    }
    k.label(M.x + memW / 2, cxy(Math.max(0, Math.min(wC - 1, Math.floor(wC / 2))))[1] + M.cell / 2, nar ? `model ${fGB(m.W)}` : `the model · ${fGB(m.W)} (${m.pr.name})`, { col: C.ink, size: 12, weight: "600", bg: true });
    if (kvC >= (nar ? 5 : 12)) { const mid = wC + workC + Math.floor(kvC / 2); k.label(M.x + memW / 2, cxy(mid)[1] + M.cell / 2, nar ? `notes ${fGB(m.kv)}` : `notes · ${m.seated} × ${fmtL(s.ctx)} = ${fGB(m.kv)}`, { col: C.ink, size: 12, weight: "600", bg: true }); }
    if (m.over) k.label(M.x + memW / 2, M.y + memH + (nar ? 28 : 26), nar ? `${fGB(m.wantKV - m.room)} won't fit` : `${fGB(m.wantKV - m.room)} of notes won't fit`, { col: C.crit, size: 13, weight: "700" });
    else if (!nar) k.label(M.x + memW / 2, M.y + memH + 26, `${fGB(MEM - m.used)} free · dashed = working space`, { col: C.muted, size: 11 });
    // ---- pipe ----
    const P = L.pipe, memShare = m.mem / m.t, reading = s.p < memShare;
    k.box(P.x0, P.y - 20, P.x1 - P.x0, 40, { fill: C.bg2, stroke: reading ? C.sig : C.line, r: 20, glow: reading ? 10 : 0, glowCol: C.sig });
    const path = u => [P.x0 + 14 + u * (P.x1 - P.x0 - 28), P.y + Math.sin(u * 9 + s.flow) * 4];
    if (reading) {
      const wf = m.W / (m.W + m.kv);
      k.flow(path, Math.max(1, Math.round(9 * wf)), (s.flow * 1.4) % 1, C.sig, { size: 4, len: 0.12 });
      if (m.kv > 0 && wf < 0.97) k.flow(u => { const [x, y] = path(u); return [x, y + 8]; }, Math.max(1, Math.round(9 * (1 - wf))), (s.flow * 1.4 + 0.05) % 1, NOTE, { size: 4, len: 0.12 });
    }
    k.label((P.x0 + P.x1) / 2, P.y - 40, "the pipe", { col: C.ink, weight: "600" });
    k.label((P.x0 + P.x1) / 2, P.y + 40, nar ? `${fGB(m.W + m.kv)} a step` : `reads ${fGB(m.W + m.kv)} per step`, { col: C.muted, size: 11 });
    if (nar) k.label(40, 686, `one step ${fMs(m.t)}: reading ${fMs(m.mem)}, maths ${fMs(m.comp)}`, { align: "left", col: m.comp > m.mem ? C.amb : C.sig, size: 12, weight: "600" });
    // ---- maths units ----
    const U = L.cu, uw = U.n * (U.cell + U.gap) - U.gap, lit = Math.max(m.seated > 0 ? 1 : 0, Math.round(m.busy * U.n * U.n));
    k.box(U.x - 14, U.y - 50, uw + 28, uw + 64, { stroke: m.busy > 0.95 ? C.amb : C.line, r: 16, fill: C.bg2 });
    k.label(U.x, U.y - 28, "maths units", { align: "left", col: C.ink, weight: "600" });
    const pulse = 0.55 + 0.45 * Math.sin(s.p * Math.PI);
    for (let i = 0; i < U.n * U.n; i++) {
      const x = U.x + (i % U.n) * (U.cell + U.gap), y = U.y + Math.floor(i / U.n) * (U.cell + U.gap);
      if (i < lit) k.box(x, y, U.cell, U.cell, { fill: C.amb, r: 5, alpha: pulse, glow: 10, glowCol: C.amb });
      else k.box(x, y, U.cell, U.cell, { fill: C.line, r: 5, alpha: 0.35 });
    }
    k.label(U.x + uw / 2, U.y + uw + 26, `${m.busy < 0.1 ? (m.busy * 100).toFixed(1) : Math.round(m.busy * 100)}% busy`, { col: m.busy > 0.95 ? C.amb : C.muted, size: 13, weight: "600" });
    // ---- one step, to scale ----
    if (L.tl) {
      const T = L.tl, sc = T.w / m.t, rW = m.W / BW * sc, rK = m.kv / BW * sc, cW = m.comp * sc;
      k.label(T.x, T.y - 22, `One step: ${fMs(m.t)}, one token for each person`, { align: "left", col: C.ink, weight: "600" });
      k.box(T.x, T.y, Math.max(2, rW), 18, { fill: C.sig, r: 4, alpha: 0.8 });
      if (rK > 1) k.box(T.x + rW, T.y, rK, 18, { fill: NOTE, r: 4, alpha: 0.8 });
      k.box(T.x, T.y + 30, Math.max(2, cW), 18, { fill: C.amb, r: 4, alpha: 0.85 });
      k.line(T.x + s.p * T.w, T.y - 6, T.x + s.p * T.w, T.y + 54, { col: C.ink, lw: 1.5, alpha: 0.7 });
      k.label(T.x + T.w + 12, T.y + 9, `reading ${fMs(m.mem)}`, { align: "left", col: C.sig, size: 11, weight: "600" });
      k.label(T.x + T.w + 12, T.y + 39, `maths ${fMs(m.comp)}`, { align: "left", col: C.amb, size: 11, weight: "600" });
      k.label(T.x, T.y + 72, `teal = weights · violet = notes · shown about ${SLOW}× slower than real`, { align: "left", col: C.muted, size: 11 });
    }
    // ---- seats ----
    const S = L.seat, n = s.B, colsN = Math.ceil(Math.sqrt(n * S.w / S.h)), rowsN = Math.ceil(n / colsN);
    const pitch = Math.min(S.w / colsN, S.h / Math.max(1, rowsN), 110), r = pitch * 0.36;
    const ox = S.x + (S.w - colsN * pitch) / 2 + pitch / 2, oy = S.y + (nar ? 0 : (S.h - rowsN * pitch) / 2) + pitch / 2;
    k.label(S.x + S.w / 2, S.y - 28, `${n} ${n === 1 ? "person" : "people"} · ${Math.round(m.per)} tokens/s each`, { col: C.ink, weight: "600" });
    for (let i = 0; i < n; i++) {
      const x = ox + (i % colsN) * pitch, y = oy + Math.floor(i / colsN) * pitch, seat = s.seats[i];
      if (i >= m.seated) { k.dot(x, y, r, C.crit, { alpha: 0.18 }); k.line(x - r * 0.5, y - r * 0.5, x + r * 0.5, y + r * 0.5, { col: C.crit, lw: 1.5 }); k.line(x + r * 0.5, y - r * 0.5, x - r * 0.5, y + r * 0.5, { col: C.crit, lw: 1.5 }); continue; }
      if (seat.left <= 0) { k.box(x - r, y - r, 2 * r, 2 * r, { stroke: C.amb, r: r, lw: 1.2, dash: [3, 3], alpha: 0.8 }); continue; }
      const prog = 1 - seat.left / seat.len;
      k.dot(x, y, r, seat.col, { alpha: 0.35 + 0.55 * seat.flash, glow: seat.flash > 0.5 ? 12 : 0 });
      if (r > 7) { const c = k.ctx; c.save(); c.strokeStyle = seat.col; c.lineWidth = k.px(2); c.beginPath(); c.arc(x, y, r + k.px(3), -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); c.stroke(); c.restore(); }
      if (seat.fresh > 0.4 && r > 6) k.dot(x, y, r * 0.35, C.ink, { alpha: seat.fresh });
    }
    if (!nar) k.label(S.x + S.w / 2, S.y + S.h + 26, s.mode === "static" ? "dashed = finished, waiting for the slowest in the batch · red = no memory" : "ring = progress through a reply · red = no memory for their notes", { col: C.muted, size: 11 });
    // ---- precision tag ----
    k.label(M.x, M.y + memH + (nar ? 64 : 50), `${m.pr.name} numbers · ${m.pr.q}`, { align: "left", col: s.prec === "int4" ? C.amb : C.muted, size: nar ? 12 : 11, weight: "600" });
  }

  const sim = makeSim($("#bt-sim"), {
    label: "One GPU serving many people. Left: GPU memory holding the model's weights and each person's notes. Middle: the pipe that carries them to the maths units, and how busy the maths units are. Right: one circle per person, lighting up each time they receive a token.",
    cams: { default: { x: 20, y: 70, w: 1560, h: 720 } },
    camsNarrow: { default: { x: 20, y: 80, w: 820, h: 980 } },
    height: w => w < 640 ? Math.round(Math.max(400, w * 1.22)) : Math.round(Math.min(580, Math.max(380, w * 0.5))),
    init, warmup: 2, speeds: [1, 3],
    intro: "One person is chatting. Each step the GPU reads the whole model through the pipe to write one token. Try adding people.",
    controls: [
      { id: "people", label: "People in the batch", type: "range", min: 0, max: BS.length - 1, step: 1, value: 0, fmt: v => String(BS[v]), help: "Conversations served together in each step.", apply: (s, v) => { s.B = BS[v]; } },
      { id: "len", label: "Conversation length so far", type: "range", min: 0, max: LS.length - 1, step: 1, value: 2, fmt: v => fmtL(LS[v]), help: "Everyone's notes must be read every step.", apply: (s, v) => { s.ctx = LS[v]; } },
      { id: "prec", label: "Size of each weight", type: "choice", value: "bf16", options: [["bf16", "16-bit"], ["fp8", "8-bit"], ["int4", "4-bit"]], help: "Fewer bits: less to read, a little less accurate.", apply: (s, v) => { s.prec = v; } },
      { id: "mode", label: "When a reply finishes", type: "choice", value: "cont", options: [["static", "Wait for the batch"], ["cont", "Refill the seat"]], help: "Wait: new people join only when the whole batch is done.", apply: (s, v, sim) => { const ch = s.mode !== v; s.mode = v; if (ch) { s.occ = 1; s.seats.forEach(x => { if (v === "static" || x.left <= 0) newReply(s, x); }); } } }
    ],
    step, draw,
    stats: s => { const m = calc(s); return [
      ["tokens/s per person", m.over && m.seated < s.B ? `${Math.round(m.per)} (${m.seated} seated)` : String(Math.round(m.per)), m.per >= 20 ? "ok" : "bad"],
      ["tokens/s for the GPU", fTok(m.total)],
      ["per million tokens*", money(m.cost), m.cost < 0.5 ? "ok" : m.cost > 3 ? "hot" : ""],
      ["memory needed", `${Math.round(gb(m.need))} / 80 GB`, m.over ? "bad" : gb(m.need) > 70 ? "hot" : ""],
      ["maths units busy", (m.busy < 0.1 ? (m.busy * 100).toFixed(1) : Math.round(m.busy * 100)) + "%", m.busy > 0.95 ? "hot" : ""]]; },
    goal: { text: "with 8k-token conversations, serve 64 people at 20+ tokens/s each for under $0.50 per million tokens", check: s => { const m = calc(s); return { done: s.goalFor >= 3, progress: `${m.seated} seated · ${Math.round(m.per)} tok/s · ${money(m.cost)}` }; } },
    notices: [
      { id: "oom", when: s => calc(s).over, say: s => { const m = calc(s); return `Out of memory. ${s.B} people × ${fmtL(s.ctx)} need <b>${fGB(m.wantKV)}</b> of notes, but only ${fGB(m.room)} is left after the model, so ${s.B - m.seated} can't be seated (red). Shorter chats, fewer people or smaller weights would make room.`; } },
      { id: "static", when: s => s.mode === "static" && s.B >= 4 && s.occ < 0.85, say: s => { const m = calc(s); return `Waiting for the batch: on average only <b>${Math.round(s.occ * 100)}%</b> of seats are writing. Finished people sit idle (dashed) until the longest reply ends, but every step still costs the same ${fMs(m.t)}, so each token costs ${Math.round((1 / s.occ - 1) * 100)}% more.`; } },
      { id: "compute", when: s => calc(s).comp > calc(s).mem, say: s => { const m = calc(s); return `Now the maths is the slow part: ${fMs(m.comp)} of sums against ${fMs(m.mem)} of reading. ${s.prec === "int4" ? "4-bit weights are unpacked to 16-bit for the sums, so the maths units aren't any faster. " : ""}Adding people now slows everyone down; this is as cheap as tokens get on this GPU.`; } },
      { id: "kv", when: s => { const m = calc(s); return m.kv > m.W * 1.2; }, say: s => { const m = calc(s); return `The notes now outweigh the model: each step reads <b>${fGB(m.kv)}</b> of notes and ${fGB(m.W)} of weights. Notes aren't shared, so every extra person or longer chat slows every step. ${s.prec !== "bf16" ? "Smaller weights barely help here." : ""}`; } },
      { id: "q4", when: s => s.prec === "int4" && s.B <= 64, once: true, say: s => { const m = calc(s); return `4-bit weights: the model shrinks to ${fGB(m.W)}, a quarter of 16-bit, so reading it takes a quarter of the time. The price is a small loss of accuracy, and it varies by model.`; } },
      { id: "q8", when: s => s.prec === "fp8", once: true, say: s => { const m = calc(s); return `8-bit weights: half the bytes, so the model is ${fGB(m.W)} and the read is twice as fast. Tests find 8-bit models almost exactly as accurate as 16-bit ones.`; } },
      { id: "one", when: s => s.B === 1, say: s => { const m = calc(s); return `One person: every step reads all ${fGB(m.W)} of weights to write <b>one</b> token. The maths takes ${fMs(m.comp)}; the reading takes ${fMs(m.mem)}. The maths units are ${(m.busy * 100).toFixed(1)}% busy. Try more people.`; } },
      { id: "share", when: s => s.B >= 2, say: s => { const m = calc(s), one = (m.W + s.ctx * KV) / BW; return `${s.B} people share each read of the weights. A step takes ${fMs(m.t)} instead of ${fMs(one)} for one person, but ${m.seated} tokens come out instead of 1, so each token costs ${money(m.cost)} per million instead of ${money(PRICE / 3600 * one * 1e6)}.`; } }
    ],
    facts: [
      { id: "ridge", when: s => s.B >= 64, text: "An H100 can do about 295 sums in the time it reads one byte from its memory. Writing one token does roughly one sum per byte of weights for each person in the batch, so it takes a batch of a few hundred before the maths keeps up with the reading.", ref: "#ref-23" },
      { id: "fp8", when: s => s.prec !== "bf16", text: "A 2024 study of quantised models found 8-bit floating-point weights (FP8) effectively lossless at every model size tested, and well-tuned 4-bit weights close behind.", ref: "#ref-801" }
    ],
    tour: [
      { say: "One person. Each step streams the whole 16 GB model (teal) through the pipe, does a little maths (amber) and writes one token. The maths units sit almost idle.", set: { people: 0, len: 2, prec: "bf16", mode: "cont" }, wait: 6 },
      { say: "Now 64 people. The weights are read once and used 64 times. Each person barely slows down, and the cost per token falls about forty-fold.", set: { people: 7 }, wait: 7 },
      { say: "Make every conversation 8,000 tokens long. Everyone's notes (violet) must be read every step too, and they no longer fit in memory.", set: { len: 5 }, wait: 7 },
      { say: "Shrink each weight to 4 bits. The model drops from 16 GB to 4 GB, which frees enough memory for all 64 people.", set: { prec: "int4" }, wait: 7 },
      { say: "Finally, make the batch wait for its slowest reply. Seats sit empty (dashed) while still costing a full step each time.", set: { mode: "static" }, wait: 8 },
      { say: "Refilling each seat as soon as a reply ends keeps every seat busy. That's continuous batching, and it's what real servers do.", set: { mode: "cont" }, wait: 5 }
    ],
    publish: s => { const m = calc(s), one = (m.W + s.ctx * KV) / BW; return {
      btPeople: String(m.seated), btPeopleTxt: m.seated === 1 ? "1 person" : m.seated + " people", btStep: fMs(m.t), btOne: fMs(one), btPer: String(Math.round(m.per)), btTotal: fTok(m.total), btCost: money(m.cost), btCost1: money(PRICE / 3600 * one * 1e6),
      btW: fGB(m.W), btKV: fGB(m.kv), btRead: fGB(m.W + m.kv), btMem: fMs(m.mem), btComp: fMs(m.comp), btBusy: (m.busy < 0.1 ? (m.busy * 100).toFixed(1) : Math.round(m.busy * 100)) + "%",
      btBits: m.pr.name, btCtx: s.ctx.toLocaleString(), btKVper: (s.ctx * KV / 1e9).toFixed(2) + " GB" }; }
  });
});
