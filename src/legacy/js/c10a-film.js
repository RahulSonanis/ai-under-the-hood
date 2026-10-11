/* Chapter 10 film: why one GPU is not enough, and the three ways training is split across thousands. */
chapter("cluster", () => {
  const fig = $("#cl-film"); if (!fig) return;
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const col4 = ["#5ce1c6", "#8fb3ff", "#d59cff", "#ffd27a"];
  const narrow = () => innerW(fig) < 640;
  let nar = false; // set once per frame
  // camera rect with a separate, near-square framing for phones
  const cam = (wide, ph) => ({ get x() { return (narrow() ? ph : wide).x; }, get y() { return (narrow() ? ph : wide).y; }, get w() { return (narrow() ? ph : wide).w; }, get h() { return (narrow() ? ph : wide).h; } });
  const hud = (k, cw, cn, title, rows, w, nr = 1) => nar ? k.hud(cn, title, rows.slice(0, nr), { w: Math.min(w, 240) }) : k.hud(cw, title, rows, { w });

  const steps = [
    { key: "mem", short: "Too big", title: "One GPU can't hold the training state", dur: 6.5,
      text: [`Training needs more than the model itself: for every parameter it also keeps its slope and running averages, about 16 bytes in all. For a 70-billion-parameter model that is over a terabyte. One H100 holds 80 GB.`,
             `Mixed-precision Adam keeps BF16 weights and gradients (2 + 2 bytes) plus FP32 master weights and two moments (12 bytes): 16 B × 70B parameters = 1.12 TB of model state before any activations, against 80 GB of HBM on an H100.`], link: "#ref-11" },
    { key: "dp", short: "Data parallel", title: "Data parallel: same model, different data", dur: 6,
      text: [`So we put a copy of the model on many GPUs. Each copy reads a different slice of the batch and works out its own slopes.`,
             `Each data-parallel rank runs forward and backward on its own share of the global batch and produces a local gradient. ZeRO and FSDP go further and shard the 16 bytes per parameter across the ranks.`] },
    { key: "ring", short: "All-reduce", title: "Ring all-reduce: every copy ends with the same sum", dur: 7,
      text: [`Before the next step, every copy must make the same update. Each GPU passes one chunk to its neighbour around a ring, adding as it goes, until all of them hold the same totals.`,
             `Reduce-scatter (n−1 steps) then all-gather (n−1 steps). Each GPU sends about 2·(n−1)/n of its gradient data, so per-GPU bandwidth barely changes with n. NCCL chooses between rings, trees and other patterns.`], link: "#ref-2" },
    { key: "tp", short: "Tensor parallel", title: "Tensor parallel: one layer's matrix is cut up", dur: 6.5,
      text: [`Big matrix maths can be cut up too. One layer's matrix is split into slices, one per GPU in the same server, and the GPUs combine their partial answers inside every layer over a super-fast private link.`,
             `Each GPU multiplies by its slice of the weight matrix; partial results are combined with collectives inside every layer, many times per step, so tensor parallelism is kept within one NVLink domain.`], link: "#ref-12" },
    { key: "pp", short: "Pipeline", title: "Pipeline parallel: layers along an assembly line", dur: 7,
      text: [`The layers are spread across servers like stations on an assembly line, and the batch is cut into micro-batches that flow through. At the start and the end some stations have nothing to do: those gaps are bubbles.`,
             `GPipe schedule, backward taken as twice as long as forward. The bubble is (p−1)/(m+p−1) of the time: 3/11 ≈ 27% with p = 4 stages and m = 8 micro-batches. More micro-batches shrink it.`], link: "#ref-13" },
    { key: "grid", short: "3-D grid", title: "All three at once, on two networks", dur: 7,
      text: [`Real jobs use all three together, arranged as a 3-D grid of GPUs. The chattiest work stays on the super-fast road inside each server. Pipeline and data traffic travel the big network between servers.`,
             `Total GPUs = d·t·p, here 4 × 8 × 4 = 128. Scale-up: NVLink inside an 8-GPU server or a 72-GPU NVL72 rack. Scale-out: InfiniBand or RoCE in fat-tree topologies; Meta built a 24,576-GPU cluster on each.`], link: "#ref-14" }
  ];
  const cams = {
    default: cam({ x: 0, y: 0, w: 1100, h: 560 }, { x: 400, y: 20, w: 680, h: 610 }),
    mem: cam({ x: 0, y: 0, w: 1100, h: 560 }, { x: 400, y: 20, w: 680, h: 610 }),
    dp: cam({ x: 1200, y: 0, w: 1100, h: 560 }, { x: 1235, y: -100, w: 810, h: 720 }),
    ring: cam({ x: 1420, y: 40, w: 960, h: 490 }, { x: 1495, y: -40, w: 610, h: 545 }),
    tp: cam({ x: 2400, y: 0, w: 1100, h: 560 }, { x: 2430, y: -190, w: 1040, h: 930 }),
    pp: cam({ x: 2380, y: 1000, w: 1100, h: 560 }, { x: 2380, y: 760, w: 1100, h: 980 }),
    grid: cam({ x: 1200, y: 1000, w: 1100, h: 560 }, { x: 1170, y: 810, w: 950, h: 850 })
  };
  const vis = (k, x0, y0, x1, y1) => { const c = k.cam; return x1 > c.x - 50 && x0 < c.x + c.w + 50 && y1 > c.y - 50 && y0 < c.y + c.h + 50; };
  const hatch = (k, x, y, w, h, col, a = 0.5) => { const c = k.ctx; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = col; c.globalAlpha = a; c.lineWidth = k.px(1.2); for (let d = -h; d < w; d += 9) { c.beginPath(); c.moveTo(x + d, y + h); c.lineTo(x + d + h, y); c.stroke(); } c.restore(); };
  const ease = (p, a, b) => easeIO((p - a) / (b - a));

  /* ---------- 1. memory ---------- */
  function drawMem(k, f) {
    const C = k.C, p = f.at("mem"), on = f.key === "mem";
    // parameter grid: 70 squares, 1B parameters each
    k.label(60, 54, "70 billion parameters", { align: "left", col: on ? C.ink : C.muted, weight: "600" });
    k.label(60, 300, "each square = 1 billion", { align: "left", col: C.muted, size: 11 });
    for (let i = 0; i < 70; i++) {
      const x = 60 + (i % 10) * 29, y = 76 + Math.floor(i / 10) * 29, lit = ease(p, 0.02 + i * 0.0015, 0.12 + i * 0.0015);
      k.box(x, y, 23, 23, { fill: C.line, r: 5, alpha: 0.5 });
      if (lit > 0) k.box(x, y, 23, 23, { fill: C.sig, r: 5, alpha: 0.25 + 0.55 * lit });
    }
    // 16 bytes per parameter
    const BX = 440, BW = 33, BG = 5, BY = 104;
    const groups = [["weights", "2 B", 2, C.sig], ["gradients", "2 B", 2, "#8fb3ff"], ["master weights + 2 moments", "12 B", 12, C.amb]];
    k.label(BX, 40, "Bytes kept for every parameter", { align: "left", col: on ? C.ink : C.muted, weight: "600" });
    const bytes = ease(p, 0.15, 0.62) * 16, nb = Math.floor(bytes + 1e-6);
    let b = 0;
    groups.forEach(([nm, sz, n, col], gi) => {
      const gx = BX + b * (BW + BG);
      for (let q = 0; q < n; q++, b++) {
        const x = BX + b * (BW + BG), part = clamp01(bytes - b);
        k.box(x, BY, BW, 42, { stroke: C.line, r: 5, dash: [3, 3] });
        if (part > 0) k.box(x, BY, BW, 42, { fill: col, r: 5, alpha: 0.9 * part, glow: part < 1 && on ? 14 : 0 });
      }
      const gw = n * (BW + BG) - BG, a = b - n < nb ? 1 : 0.4, ly = gi === 0 ? BY - 16 : BY + 60;
      k.line(gx, gi === 0 ? BY - 5 : BY + 49, gx + gw, gi === 0 ? BY - 5 : BY + 49, { col, alpha: a });
      k.label(gi === 2 ? gx + gw : gx + gw / 2, ly, `${nm} ${sz}`, { align: gi === 2 ? "right" : "center", col: a === 1 ? C.ink : C.muted, size: 11.5, alpha: 0.5 + 0.5 * a });
    });
    if (!nar) { k.label(BX + 2 * (BW + BG) - BG / 2, BY + 78, "BF16", { col: C.muted, size: 10.5, mono: true }); k.label(BX + 16 * (BW + BG) - BG, BY + 78, "FP32", { align: "right", col: C.muted, size: 10.5, mono: true }); }
    // 14 GPU-sized boxes of 80 GB
    const need = bytes * 70, gb = n => [440 + (n % 7) * 88, 262 + Math.floor(n / 7) * 96], bounds = [[0, 140, groups[0][3]], [140, 280, groups[1][3]], [280, 1120, groups[2][3]]];
    k.label(440, 246, "One H100 = 80 GB", { align: "left", col: need > 80 ? C.amb : C.ink, weight: "650" });
    let filling = 0;
    for (let n = 0; n < 14; n++) {
      const [x, y] = gb(n), lo = n * 80, hi = lo + 80, h = 80, used = clamp01((need - lo) / 80);
      if (used > 0) filling = n;
      if (n === 0) { const full = need >= 80, fl = full && on ? 0.5 + 0.5 * Math.sin(f.t * 7) : 0; k.box(x - 4, y - 4, 88, h + 8, { stroke: full ? C.amb : C.ink, lw: 2.2, r: 10, glow: full ? 8 + fl * 10 : 0, glowCol: C.amb }); }
      k.box(x, y, 80, h, { fill: C.bg2, stroke: used > 0 ? (n ? C.amb : C.line) : C.line, r: 8, dash: used > 0 ? null : [4, 4], alpha: used > 0 ? 1 : 0.7 });
      bounds.forEach(([a0, a1, col]) => { const s0 = Math.max(a0, lo), s1 = Math.min(a1, hi, need); if (s1 <= s0) return; k.box(x + 4, y + h - 4 - (s1 - lo) / 80 * (h - 8), 72, (s1 - s0) / 80 * (h - 8), { fill: col, r: 3, alpha: 0.85 }); });
      if (used > 0 && n) k.text(x + 40, y + h / 2, String(n + 1), { col: C.bg, size: 16, weight: "650", alpha: used > 0.5 ? 0.9 : 0 });
    }
    if (on && p > 0.15 && p < 0.64) { const [tx, ty] = gb(filling); k.flow(u => bez([[350, 180], [400, 180], [tx - 20, ty - 60], [tx + 40, ty + 30]], u), 5, f.t * 0.9, C.sig, { size: 3 }); }
    if (on) hud(k, "bl", "bl", "Model state, 70B model", [["memory needed", need >= 1000 ? (need / 1000).toFixed(2) + " TB" : Math.round(need) + " GB", need > 80 ? C.amb : C.sig], ["H100s just to hold it", String(Math.max(1, Math.ceil(need / 80 - 1e-9))), need > 80 ? C.amb : C.ink], ["bytes per parameter", String(nb)]], 220);
  }

  /* ---------- 2 + 3. data parallel and ring all-reduce ---------- */
  const G = [[1660, 160], [1940, 160], [1940, 400], [1660, 400]]; // centres, clockwise ring
  const GW = 170, GH = 120;
  function ringState(sub) { // counts[g][c] after `sub` complete ring steps (0..6)
    const n = [0, 1, 2, 3].map(() => [1, 1, 1, 1]);
    for (let s = 0; s < sub; s++) {
      const prev = n.map(r => r.slice());
      for (let g = 0; g < 4; g++) { const to = (g + 1) % 4; if (s < 3) { const c = (g - s + 4) % 4; n[to][c] = prev[to][c] + prev[g][c]; } else { const c = (g + 1 - (s - 3) + 4) % 4; n[to][c] = 4; } }
    }
    return n;
  }
  const sentChunk = (g, s) => s < 3 ? (g - s + 4) % 4 : (g + 1 - (s - 3) + 4) % 4;
  const cellPos = (g, c) => [G[g][0] - 66 + c * 34, G[g][1] + 20];
  function drawDP(k, f) {
    const C = k.C, pd = f.at("dp"), pr = f.at("ring"), onD = f.key === "dp", onR = f.key === "ring";
    // the batch
    const BX = 1250, BY = 70;
    if (!nar) k.label(BX, BY - 22, "One batch · 16 examples", { align: "left", col: onD ? C.ink : C.muted, weight: "600" });
    for (let j = 0; j < 16; j++) {
      const s = Math.floor(j / 4), y0 = BY + j * 25 + s * 10, x0 = BX;
      const go = ease(pd, 0.08 + j * 0.022, 0.3 + j * 0.022);
      k.box(x0, y0, 80, 19, { stroke: col4[s], r: 5, alpha: 0.35 });
      if (go < 1) { const [gx, gy] = G[s], tx = gx + 34, ty = gy - GH / 2 + 22;
        const path = [[x0 + 40, y0 + 10], [x0 + 220, y0 + 10], [tx - 80, ty - 60], [tx, ty]];
        if (go > 0) k.trail([0.12, 0.08, 0.04, 0].map(d => bez(path, Math.max(0, go - d))), col4[s], { w: 2.5 });
        const pt = bez(path, go), sw = 80 * (1 - go * 0.7), sh = 19 * (1 - go * 0.4);
        k.box(pt[0] - sw / 2, pt[1] - sh / 2, sw, sh, { fill: col4[s], r: 5, alpha: 0.9 });
      }
    }
    // ring links
    for (let g = 0; g < 4; g++) {
      const a = G[g], b2 = G[(g + 1) % 4], dx = Math.sign(b2[0] - a[0]), dy = Math.sign(b2[1] - a[1]);
      const x1 = a[0] + dx * (GW / 2 + 6), y1 = a[1] + dy * (GH / 2 + 6), x2 = b2[0] - dx * (GW / 2 + 10), y2 = b2[1] - dy * (GH / 2 + 10);
      k.line(x1, y1, x2, y2, { col: onR ? C.sig : C.line, lw: onR ? 2 : 1.5, alpha: onR ? 0.6 : 0.8, dash: onR ? null : [5, 5] });
      if (onR) { const ang = Math.atan2(y2 - y1, x2 - x1); [-0.45, 0.45].forEach(d => k.line(x2, y2, x2 - 12 * Math.cos(ang + d), y2 - 12 * Math.sin(ang + d), { col: C.sig, lw: 2, alpha: 0.7 })); }
    }
    // ring progress
    const rp = clamp01((pr - 0.06) / 0.86) * 6, sub = Math.min(6, Math.floor(rp)), u = rp - sub;
    const counts = ringState(pr >= 0.92 ? 6 : sub);
    for (let g = 0; g < 4; g++) {
      const [cx, cy] = G[g], x = cx - GW / 2, y = cy - GH / 2, arrived = Math.min(4, Math.floor(ease(pd, 0.1, 0.55) * 4.99));
      const busy = onD && pd > 0.5 && pd < 0.84;
      k.box(x, y, GW, GH, { fill: C.bg2, stroke: busy ? C.amb : onR ? C.sig : C.line, r: 12, glow: busy ? 12 : 0, glowCol: C.amb });
      k.label(x + 8, y - 12, `GPU ${g + 1}`, { align: "left", col: C.muted, size: 11 });
      // the model copy: six layer bars; a forward-then-backward sweep while computing
      const sweep = (pd - 0.5) / 0.34 * 12;
      for (let l = 0; l < 6; l++) {
        const lx = x + 14 + l * 14, act = busy && (Math.abs(sweep - l) < 0.8 || Math.abs(sweep - (11 - l)) < 0.8);
        k.box(lx, y + 12, 9, 56, { fill: act ? C.amb : C.line, r: 3, glow: act ? 10 : 0 });
      }
      // the data slice it received
      for (let q = 0; q < arrived; q++) k.box(x + 104 + (q % 2) * 28, y + 14 + Math.floor(q / 2) * 18, 24, 13, { fill: col4[g], r: 3, alpha: 0.85 });
      // gradient chunks (4 cells), filled by how many GPUs' contributions they hold
      const gOn = onR ? 1 : ease(pd, 0.8, 0.95);
      if (gOn > 0) for (let c = 0; c < 4; c++) {
        const [px, py] = cellPos(g, c), n = counts[g][c], hh = 28 * n / 4;
        k.box(px, py, 30, 28, { stroke: C.line, r: 4, alpha: gOn });
        k.box(px, py + 28 - hh, 30, hh, { fill: col4[c], r: 4, alpha: 0.9 * gOn, glow: n === 4 && onR ? 10 : 0 });
      }
    }
    if ((pd > 0.8 || onR) && !nar) k.label(G[0][0] - GW / 2 - 10, G[0][1] + 34, "gradient chunks", { align: "right", col: C.muted, size: 11, alpha: onR ? 1 : ease(pd, 0.8, 0.95) });
    if (onD && !nar) k.label((G[0][0] + G[1][0]) / 2, G[0][1] - GH / 2 - 36, "The same model copy on every GPU", { col: C.ink, weight: "600" });
    // chunks in flight
    if (onR && pr > 0.06 && pr < 0.92 && u < 0.85) {
      for (let g = 0; g < 4; g++) {
        const c = sentChunk(g, sub), to = (g + 1) % 4, a = cellPos(g, c), b2 = cellPos(to, c), e = easeIO(u / 0.85);
        const pt = s => [lerp(a[0] + 15, b2[0] + 15, s), lerp(a[1] + 14, b2[1] + 14, s) - Math.sin(s * Math.PI) * 34];
        k.trail([0.15, 0.1, 0.05, 0].map(d => pt(Math.max(0, e - d))), col4[c], { w: 3, glow: 8 });
        const [mx, my] = pt(e); k.box(mx - 12, my - 11, 24, 22, { fill: col4[c], r: 4, glow: 14 });
      }
    }
    if (onR) {
      const done = pr >= 0.92, phase = done ? "all GPUs agree" : sub < 3 ? "reduce-scatter (add)" : "all-gather (copy)";
      hud(k, "br", "tl", "Ring all-reduce · 4 GPUs", [["step", `${done ? 6 : sub + 1} of 6`], ["phase", phase, done ? C.sig : C.ink], ["sent per GPU", "2·(n−1)/n = 1.5×"]], 240);
    } else if (onD) {
      const busy = pd > 0.5 && pd < 0.84;
      hud(k, "br", "tl", nar ? "Data parallel · batch of 16" : "Data parallel", [["examples per GPU", String(Math.min(4, Math.floor(ease(pd, 0.1, 0.55) * 4.99)))], ["model copies", "4"], ["now", busy ? "forward + backward" : pd >= 0.84 ? "gradients ready" : "reading data", busy ? C.amb : C.ink]], 240);
    }
  }

  /* ---------- 4. tensor parallel ---------- */
  function drawTP(k, f) {
    const C = k.C, p = f.at("tp"), on = f.key === "tp";
    const SX = 2440, SY = 290, SW = 1020, gx = i => SX + 22 + i * 125, GY = SY + 46, GWd = 105, GHt = 124;
    const MX = 2790, MY = 50, cw = 40, chh = 24;
    const split = ease(p, 0.05, 0.35);
    k.label(MX + 160, MY - 20, "One layer's weight matrix", { col: on ? C.ink : C.muted, weight: "600" });
    if (split > 0) { k.box(MX, MY, 8 * cw, 8 * chh, { stroke: C.line, r: 6, dash: [4, 4], alpha: split * 0.6 }); k.label(MX + 160, MY + 96, "cut into 8 slices, one per GPU", { col: C.muted, size: 11.5, alpha: split }); }
    // server with 8 GPUs
    k.box(SX, SY, SW, 250, { fill: C.bg2, stroke: on ? C.sig : C.line, r: 16, alpha: 0.9 });
    k.label(SX + 18, SY + 20, "One server · 8 GPUs", { align: "left", col: on ? C.ink : C.muted, weight: "600" });
    const cycle = on && p > 0.45 ? ((p - 0.45) / 0.55 * 3) % 1 : -1; // three layers: compute, then exchange
    const comp = cycle >= 0 && cycle < 0.45, xch = cycle >= 0.45;
    for (let i = 0; i < 8; i++) {
      const x1 = gx(i) + 22, y1 = GY + 14, sw = lerp(cw - 2, 60, split), sh = lerp(chh - 2, 11, split);
      const dx = lerp(MX + i * cw + 1, x1, split), dy = lerp(MY + 1, y1, split) - Math.sin(split * Math.PI) * 24;
      for (let r = 0; r < 8; r++) {
        const v = hash(i * 8 + r), rowY = dy + r * lerp(chh, 12.5, split);
        k.box(dx, rowY, sw, sh, { fill: comp ? C.amb : col4[i % 4], r: 3, alpha: comp ? 0.5 + 0.4 * v : 0.35 + 0.5 * v, glow: comp && r === 0 ? 12 : 0, glowCol: C.amb });
      }
    }
    const busY = SY + 220;
    for (let i = 0; i < 8; i++) {
      k.box(gx(i), GY, GWd, GHt, { stroke: comp ? C.amb : C.line, r: 10, glow: comp ? 8 : 0, glowCol: C.amb });
      if (!nar) k.label(gx(i) + GWd / 2, GY + GHt + 12, `GPU ${i + 1}`, { col: C.muted, size: 10.5 });
      k.line(gx(i) + GWd / 2, GY + GHt + 22, gx(i) + GWd / 2, busY, { col: C.sig, alpha: 0.5 });
    }
    k.box(SX + 40, busY - 3, SW - 80, 6, { fill: C.sig, r: 3, alpha: 0.6, glow: xch ? 14 : 0 });
    k.label(SX + SW / 2, busY + 18, nar ? "NVLink inside the server" : "NVLink: the super-fast network inside the server", { col: C.sig, size: 11.5, weight: "600" });
    // inputs arrive at every GPU
    const inA = ease(p, 0.32, 0.4) * (1 - ease(p, 0.46, 0.5));
    if (on && inA > 0) for (let i = 0; i < 8; i++) k.flow(u => [lerp(MX + 160, gx(i) + GWd / 2, u), lerp(MY + 200, GY + 6, u)], 2, f.t * 0.8 + i * 0.1, C.sig, { size: 2.5, alpha: inA });
    // partial results exchanged over NVLink, once per layer
    if (xch) for (let i = 0; i < 8; i++) {
      const xi = gx(i) + GWd / 2, tgt = gx((i + 3) % 8) + GWd / 2;
      k.flow(u => [xi, lerp(GY + GHt + 22, busY, u)], 2, f.t * 1.6 + i * 0.13, C.sig, { size: 2.5 });
      k.flow(u => [lerp(xi, tgt, u), busY], 2, f.t * 1.2 + i * 0.29, C.sig, { size: 3 });
    }
    if (on) { const layer = cycle < 0 ? 0 : Math.min(3, Math.floor((p - 0.45) / 0.55 * 3) + 1);
      hud(k, "tr", "tl", "Tensor parallel", [["each GPU holds", "1/8 of the matrix"], ["now", cycle < 0 ? "splitting" : comp ? `layer ${layer}: multiply` : `layer ${layer}: combine`, comp ? C.amb : C.sig], ["link", "NVLink (scale-up)", C.sig]], 230); }
  }

  /* ---------- 5. pipeline parallel ---------- */
  const P = 4, MB = 8, TU = 3 * (MB + P - 1); // time units in a GPipe step
  const sched = (() => { const out = []; for (let s = 0; s < P; s++) for (let j = 0; j < MB; j++) { out.push({ s, j, a: s + j, d: 1, f: true }); out.push({ s, j, a: (MB + P - 1) + 2 * (j + (P - 1 - s)), d: 2, f: false }); } return out; })();
  function drawPP(k, f) {
    const C = k.C, p = f.at("pp"), on = f.key === "pp";
    const sx = s => 2450 + s * 255, SY = 1040, SWd = 205, SHt = 92;
    const tt = clamp01((p - 0.04) / 0.86) * TU;
    for (let s = 0; s < P; s++) {
      const blk = on ? sched.find(b => b.s === s && tt >= b.a && tt < b.a + b.d) : null;
      const col = blk ? (blk.f ? C.sig : C.amb) : C.line;
      k.box(sx(s), SY, SWd, SHt, { fill: C.bg2, stroke: blk ? col : C.line, r: 12, glow: blk ? 12 : 0, glowCol: col });
      k.label(sx(s) + 10, SY - 12, nar ? `Server ${s + 1}` : `Server ${s + 1} · layers ${s * 4 + 1}–${s * 4 + 4}`, { align: "left", col: C.muted, size: 11 });
      for (let l = 0; l < 4; l++) k.box(sx(s) + 16 + l * 20, SY + 16, 12, SHt - 32, { fill: blk ? col : C.line, r: 3, alpha: blk ? 0.75 : 1 });
      if (blk) { k.box(sx(s) + 110, SY + 24, 74, 44, { fill: col, r: 8, alpha: 0.95 }); k.text(sx(s) + 147, SY + 46, String(blk.j + 1), { col: C.bg, size: 20, weight: "650" }); }
      else if (on) { hatch(k, sx(s) + 110, SY + 24, 74, 44, C.muted, 0.45); k.text(sx(s) + 147, SY + 46, "idle", { col: C.muted, size: 14 }); }
      if (s < P - 1) { const x1 = sx(s) + SWd + 6, x2 = sx(s + 1) - 6, ym = SY + SHt / 2; k.line(x1, ym, x2, ym, { col: C.line, dash: [4, 4] });
        const fwd = sched.some(b => b.s === s && b.f && tt >= b.a + 0.6 && tt < b.a + 1.1), bwd = sched.some(b => b.s === s + 1 && !b.f && tt >= b.a + 1.5 && tt < b.a + 2.1);
        if (on && fwd) k.flow(u => [lerp(x1, x2, u), ym - 7], 2, f.t * 1.4, C.sig, { size: 3 });
        if (on && bwd) k.flow(u => [lerp(x2, x1, u), ym + 7], 2, f.t * 1.4, C.amb, { size: 3 }); }
    }
    // timeline
    const TX = 2470, TW = 760, TY = 1215, RH = 46, RG = 14, ux = TW / TU;
    k.label(TX, TY - 20, nar ? "Time →" : "Time →   forward teal · backward amber · stripes = bubbles", { align: "left", col: on ? C.ink : C.muted, size: 11.5, weight: "600" });
    for (let s = 0; s < P; s++) {
      const y = TY + s * (RH + RG);
      k.label(TX - 10, y + RH / 2, `GPU ${s + 1}`, { align: "right", col: C.muted, size: 11 });
      k.box(TX, y, TW, RH, { stroke: C.line, r: 6, alpha: 0.6 });
      const busy = sched.filter(b => b.s === s).sort((a, b) => a.a - b.a); let cur = 0; const idle = [];
      busy.forEach(b => { if (b.a > cur) idle.push([cur, b.a]); cur = Math.max(cur, b.a + b.d); }); if (cur < TU) idle.push([cur, TU]);
      idle.forEach(([a, b]) => { const e = Math.min(b, tt); if (e > a) hatch(k, TX + a * ux, y, (e - a) * ux, RH, C.muted, 0.45); });
      busy.forEach(b => { const e = Math.min(b.a + b.d, tt); if (e <= b.a) return; const w = (e - b.a) * ux;
        k.box(TX + b.a * ux + 1, y + 3, w - 2, RH - 6, { fill: b.f ? C.sig : C.amb, r: 4, alpha: 0.85 });
        if (e >= b.a + b.d * 0.9) k.text(TX + (b.a + b.d / 2) * ux, y + RH / 2 + 1, String(b.j + 1), { col: C.bg, size: 13, weight: "650" }); });
    }
    if (p > 0.04 && p < 0.92) k.line(TX + tt * ux, TY - 6, TX + tt * ux, TY + P * (RH + RG) - RG + 6, { col: C.ink, lw: 1.5, alpha: 0.8 });
    if (on) {
      let idleT = 0; const now = Math.min(tt, TU); for (let s = 0; s < P; s++) { const bs = sched.filter(b => b.s === s); idleT += now - bs.reduce((a, b) => a + Math.max(0, Math.min(b.a + b.d, now) - b.a), 0); }
      hud(k, "br", "tl", "Pipeline · GPipe", [["bubble (p−1)/(m+p−1)", "3/11 ≈ 27%", C.amb], ["idle so far", now > 0 ? Math.round(100 * idleT / (P * now)) + "%" : "–"], ["stages p · micro-batches m", "4 · 8"]], 240);
    }
  }

  /* ---------- 6. the 3-D grid ---------- */
  function drawGrid(k, f) {
    const C = k.C, p = f.at("grid"), on = f.key === "grid";
    const FX = 1390, FY = 1135, RW = 62, RHt = 216, RS = 122, DX = 70, DY = -48;
    const plane = r => { const a = ease(p, 0.02 + (3 - r) * 0.05, 0.2 + (3 - r) * 0.05); return { a, ox: r * DX + (1 - a) * 160, oy: r * DY - (1 - a) * 60 }; };
    const up = ease(p, 0.25, 0.35), pip = ease(p, 0.45, 0.55), dat = ease(p, 0.66, 0.76);
    for (let r = 3; r >= 0; r--) {
      const { a, ox, oy } = plane(r); if (a <= 0) continue;
      const depthA = a * (1 - r * 0.22);
      for (let s = 0; s < 4; s++) {
        const x = FX + ox + s * RS, y = FY + oy;
        k.box(x, y, RW, RHt, { fill: C.bg2, stroke: C.line, r: 8, alpha: Math.min(1, depthA + 0.2) });
        for (let g = 0; g < 8; g++) k.box(x + 10, y + 10 + g * 25.5, RW - 22, 19, { fill: col4[s], r: 4, alpha: depthA * (r ? 0.35 : 0.6) });
        if (up > 0) { k.box(x + RW - 8, y + 12, 3, RHt - 24, { fill: C.sig, r: 2, alpha: depthA * up }); if (r === 0) k.flow(u => [x + RW - 6.5, lerp(y + 14, y + RHt - 14, (u * 2) % 1 * (u < 0.5 ? 1 : 1))], 3, f.t * 2.2 + s * 0.17, C.sig, { size: 2.2, alpha: up }); }
      }
      if (pip > 0) for (let s = 0; s < 3; s++) { const x1 = FX + ox + s * RS + RW, x2 = x1 + RS - RW, ym = FY + oy + RHt / 2;
        k.line(x1 + 2, ym, x2 - 2, ym, { col: C.amb, alpha: depthA * pip * 0.7, lw: 2 });
        if (r === 0) k.flow(u => [lerp(x1 + 2, x2 - 2, u), ym], 1, f.t * 0.7 + s * 0.3, C.amb, { size: 3, alpha: pip }); }
    }
    if (dat > 0) for (let s = 0; s < 4; s++) for (let r = 0; r < 3; r++) {
      const A = plane(r), B = plane(r + 1), x1 = FX + A.ox + s * RS + RW / 2, y1 = FY + A.oy - 2, x2 = FX + B.ox + s * RS + RW / 2, y2 = FY + B.oy + 4;
      k.line(x1, y1, x2, y2, { col: C.amb, alpha: dat * 0.6, lw: 2 });
      k.flow(u => [lerp(x1, x2, u), lerp(y1, y2, u)], 1, f.t * 0.6 + s * 0.23 + r * 0.4, C.amb, { size: 2.6, alpha: dat });
    }
    // axes
    const a0 = ease(p, 0.15, 0.3), lx = FX - 22;
    k.line(lx, FY + RHt, lx, FY, { col: C.sig, lw: 2, alpha: a0 * (0.4 + 0.6 * up) });
    if (nar) k.label(lx, FY - 16, "tensor ×8", { col: up ? C.sig : C.muted, alpha: a0, weight: "600" });
    else { k.label(lx - 8, FY + RHt / 2 - 9, "tensor ×8", { align: "right", col: up ? C.sig : C.muted, alpha: a0, weight: "600" });
      k.label(lx - 8, FY + RHt / 2 + 9, "in a server", { align: "right", col: C.muted, alpha: a0, size: 11 }); }
    k.line(FX, FY + RHt + 18, FX + 3 * RS + RW, FY + RHt + 18, { col: C.amb, lw: 2, alpha: a0 * (0.4 + 0.6 * pip) });
    k.label(FX + (3 * RS + RW) / 2, FY + RHt + 36, "pipeline ×4 across servers", { col: pip ? C.amb : C.muted, alpha: a0, weight: "600" });
    const bx = FX + 3 * RS + RW + 14, by = FY + RHt;
    k.line(bx, by, bx + 3 * DX, by + 3 * DY, { col: C.amb, lw: 2, alpha: a0 * (0.4 + 0.6 * dat) });
    k.label(bx + 3 * DX * 0.5 + 12, by + 3 * DY * 0.5 + 14, "data ×4", { align: "left", col: dat ? C.amb : C.muted, alpha: a0, weight: "600" });
    if (on) hud(k, "tr", "tl", "Two networks", [["scale-up · NVLink", "tensor", C.sig], ["scale-out · InfiniBand/RoCE", "pipeline, data", C.amb], ["GPUs = d × t × p", "4 × 8 × 4 = 128"]], 280);
  }

  storyFilm(fig, {
    label: "Animated explanation of how training is split across many GPUs",
    steps, cams,
    draw(k, f) {
      nar = narrow();
      if (vis(k, 0, 0, 1100, 560)) drawMem(k, f);
      if (vis(k, 1200, 0, 2300, 560)) drawDP(k, f);
      if (vis(k, 2400, 0, 3500, 560)) drawTP(k, f);
      if (vis(k, 2380, 1000, 3500, 1560)) drawPP(k, f);
      if (vis(k, 1200, 1000, 2300, 1560)) drawGrid(k, f);
    }
  });
});
