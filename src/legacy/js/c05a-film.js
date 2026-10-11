/* Chapter 5 film: why the KV cache exists, and how serving systems manage it.
   Reference implementation of storyFilm(): world units, one camera per step, every frame a pure function of t. */
chapter("memory", () => {
  const fig = $("#kv-film"); if (!fig) return;
  const words = ["The", "cat", "sat", "on", "the", "mat", "and", "slept"];
  const CH = { x0: 70, dx: 104, y: 70, w: 88, h: 34 };
  const chipX = j => CH.x0 + j * CH.dx;
  // memory panel (HBM of one 80 GB GPU): 16 x 20 cells, 0.25 GB each
  const M = { x: 1120, y: 70, cols: 20, rows: 16, cell: 34, gap: 4 };
  const cellXY = c => [M.x + (c % M.cols) * (M.cell + M.gap), M.y + Math.floor(c / M.cols) * (M.cell + M.gap)];
  const W_CELLS = 64; // 16 GB of Llama 3 8B weights in BF16
  const convCol = ["#5ce1c6", "#ffb547", "#8fb3ff", "#d59cff", "#ff8fa3", "#9be37a", "#7fdcff", "#ffd27a"];

  const steps = [
    { key: "redo", short: "Without notes", title: "Without notes, every step re-reads everything", dur: 6,
      text: [`To write each new word, attention needs a "label" and "message" (key and value) for every earlier word. Without notes, the model would recompute them all, every single step. Watch the work pile up.`,
             `Without caching, step t recomputes K = XW_K and V = XW_V for all t earlier tokens: Θ(t) projection work per step and Θ(T²) over a T-token reply.`] },
    { key: "cache", short: "Keep notes", title: "Keep notes instead: the KV cache", dur: 6,
      text: [`So the model keeps a note card for each word the first time it reads it. Each new word computes only its own card, then looks at the saved ones. The recomputing disappears; only the reading of saved notes grows.`,
             `Keys and values don't change once computed, so the server stores them. Each step computes K and V for one new token and attends over the cached ones.`] },
    { key: "grow", short: "Notes need memory", title: "The notes live in GPU memory", dur: 5.5,
      text: [`Those notes aren't free. They sit in the GPU's memory next to the model itself, and they grow with every word.`,
             `Llama 3 8B: 2 × 32 layers × 8 KV heads × 128 dims × 2 bytes = 128 KiB per token. A 32k-token conversation needs 4 GiB, on top of 16 GB of weights.`], link: "#ref-9" },
    { key: "many", short: "Many people", title: "Every conversation brings its own notes", dur: 5.5,
      text: [`One GPU serves many people at once, and each conversation keeps its own notes. When memory is full, the next person has to wait.`,
             `Batch size is capped by free KV memory: (80 GB − weights) ÷ (KV bytes per token × tokens per conversation).`] },
    { key: "reserve", short: "Reserving the max", title: "The old way: reserve the maximum up front", dur: 5.5,
      text: [`Older servers didn't know how long a reply would be, so they reserved room for the longest possible conversation. Most of that reserved space sat empty (striped).`,
             `Contiguous pre-allocation for the maximum sequence length wasted 60–80% of KV memory in earlier systems, according to the vLLM authors.`], link: "#ref-34" },
    { key: "paged", short: "Paging", title: "Paging: hand out small blocks as needed", dur: 6,
      text: [`Paged memory hands each conversation small blocks only as it grows, from anywhere in memory. Far less waste, so many more people fit.`,
             `PagedAttention stores KV in fixed-size blocks (typically 16 tokens) tracked by a per-request block table, like virtual memory pages; waste drops below 4%.`], link: "#ref-34" },
    { key: "prefix", short: "Sharing a prefix", title: "Shared beginnings are stored once", dur: 5.5,
      text: [`Many conversations start with the same hidden instructions. Their notes can be stored once and shared, so nobody recomputes them.`,
             `Prefix caching hashes full blocks of the token prefix; requests whose prompts start identically point their block tables at the same physical blocks.`] }
  ];
  const cams = {
    default: { x: 30, y: 20, w: 900, h: 470 },
    redo: { x: 30, y: 20, w: 900, h: 470 }, cache: { x: 30, y: 20, w: 900, h: 470 },
    grow: { x: 960, y: 20, w: 1000, h: 660 }, many: { x: 960, y: 20, w: 1000, h: 660 },
    reserve: { x: 960, y: 20, w: 1000, h: 660 }, paged: { x: 960, y: 20, w: 1000, h: 660 }, prefix: { x: 960, y: 20, w: 1000, h: 660 }
  };

  let NW = 8; // tokens shown (fewer on phones)
  function tokensRow(k, f, gen, mode) {
    const C = k.C;
    for (let j = 0; j < NW; j++) {
      const x = chipX(j), live = j < gen, isNew = j === gen;
      if (!live && !isNew) { k.box(x, CH.y, CH.w, CH.h, { stroke: C.line, r: 8, dash: [4, 4] }); continue; }
      k.box(x, CH.y, CH.w, CH.h, { fill: isNew ? C.sig : C.bg2, stroke: isNew ? C.sig : C.line, r: 8, glow: isNew ? 14 : 0 });
      k.text(x + CH.w / 2, CH.y + CH.h / 2 + 1, words[j], { col: isNew ? C.bg : C.ink, size: f.narrow ? 22 : 15, weight: "600" });
    }
  }
  function cards(k, j, a, flash) { // K and V note cards under token j
    const C = k.C, x = chipX(j), y = 250;
    k.box(x + 4, y, 38, 46, { fill: C.bg2, stroke: flash ? C.amb : C.sig, r: 6, alpha: a, glow: flash ? 12 : 0, glowCol: C.amb });
    k.box(x + 46, y, 38, 46, { fill: C.bg2, stroke: flash ? C.amb : C.sig, r: 6, alpha: a, glow: flash ? 12 : 0, glowCol: C.amb });
    k.text(x + 23, y + 24, "K", { col: flash ? C.amb : C.sig, size: 14, mono: true, weight: "600", alpha: a });
    k.text(x + 65, y + 24, "V", { col: flash ? C.amb : C.sig, size: 14, mono: true, weight: "600", alpha: a });
  }
  function workBars(k, gen, mode) {
    const C = k.C, bx = 70, by = 450, bw = 30;
    k.label(bx, by + 22, "Work per step", { align: "left", col: C.muted });
    for (let g = 1; g <= NW - 1; g++) {
      const redo = g, h = 14 * redo;
      if (mode === "cache") k.box(bx + (g - 1) * (bw + 8), by - h, bw, h, { stroke: C.line, r: 3, dash: [3, 3] });
      if (g > gen) continue;
      const hh = mode === "redo" ? h : 14;
      k.box(bx + (g - 1) * (bw + 8), by - hh, bw, hh, { fill: mode === "redo" ? C.amb : C.sig, r: 3, alpha: 0.9 });
    }
  }
  function memoryGrid(k, fillFn) {
    const N = M.cols * M.rows;
    for (let c = 0; c < N; c++) { const [x, y] = cellXY(c); const st = fillFn(c); k.box(x, y, M.cell, M.cell, st || { fill: k.C.line, r: 5, alpha: 0.35 }); }
  }
  function hatch(k, x, y, w, h, col) { const c = k.ctx; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = k.px(1.2); for (let d = -h; d < w; d += 8) { c.beginPath(); c.moveTo(x + d, y + h); c.lineTo(x + d + h, y); c.stroke(); } c.restore(); }

  const mem = { x: 1090, y: -150, w: 800, h: 880 }, tok = { x: 30, y: -130, w: 600, h: 640 };
  const camsNarrow = { default: tok, redo: tok, cache: tok, grow: mem, many: mem, reserve: mem, paged: mem, prefix: mem };
  storyFilm(fig, {
    label: "Animated explanation of the KV cache and paged memory",
    steps, cams, camsNarrow,
    draw(k, f) {
      const C = k.C;
      if (f.key === "redo" || f.key === "cache") {
        NW = f.narrow ? 5 : 8;
        const mode = f.key, gen = 1 + Math.min(NW - 2, Math.floor(f.p * (NW - 0.8))), sub = (f.p * (NW - 0.8)) % 1;
        tokensRow(k, f, gen, mode);
        k.box(CH.x0 - 20, 150, chipX(NW - 1) + CH.w - CH.x0 + 40, 60, { stroke: C.line, r: 12 });
        k.label(CH.x0 - 6, 140, "Attention layer", { align: "left", col: C.muted });
        // which tokens compute K,V this step
        for (let j = 0; j < gen; j++) {
          const computing = mode === "redo" ? true : j === gen - 1;
          const flash = computing && sub < 0.55;
          const x = chipX(j) + CH.w / 2;
          if (flash) k.box(chipX(j) + 6, 160, CH.w - 12, 40, { fill: C.amb, r: 8, alpha: 0.25 + 0.6 * (1 - sub / 0.55), glow: 16, glowCol: C.amb });
          if (mode === "cache") cards(k, j, j === gen - 1 ? clamp01(sub / 0.4) : 1, flash);
          // reading lines from earlier tokens' K/V to the new token
          if (sub > 0.35) { const nx = chipX(gen) + CH.w / 2; k.curve([[x, mode === "cache" ? 250 : 200], [x, 225], [nx, 225], [nx, CH.y + CH.h]], { col: C.sig, lw: 1.2, alpha: 0.55 }); }
        }
        k.label(chipX(gen) + CH.w / 2, CH.y - 18, "next word", { col: C.sig, size: 11 });
        workBars(k, gen, mode);
        k.hud(f.narrow ? "tl" : "br", mode === "redo" ? "Recomputing everything" : "With a KV cache", [["tokens written", String(gen)], ["K,V computed this step", mode === "redo" ? String(gen) : "1", mode === "redo" ? C.amb : C.sig], ["total so far", mode === "redo" ? String(gen * (gen + 1) / 2) : String(gen)]], { w: 210 });
        return;
      }
      // ---- memory panel steps ----
      if (!f.narrow) k.label(M.x, M.y - 24, "One GPU's memory (80 GB) · each square ≈ 0.25 GB", { align: "left", col: C.ink, weight: "600" });
      const N = M.cols * M.rows, free = N - W_CELLS;
      const weights = c => c < W_CELLS ? { fill: C.muted, r: 5, alpha: 0.8 } : null;
      if (f.key === "grow") {
        const tok = Math.round(32768 * easeIO(f.p)), cells = Math.ceil(tok * 128 / 1024 / 1024 / 0.25); // KiB -> GB
        memoryGrid(k, c => weights(c) || (c - W_CELLS < cells ? { fill: C.sig, r: 5, glow: c - W_CELLS === cells - 1 ? 14 : 0 } : null));
        if (!f.narrow) k.label(M.x, cellXY(W_CELLS - 1)[1] + M.cell + 18, "Model weights · 16 GB", { align: "left", col: C.muted });
        k.hud("tl", "One conversation", [["tokens", tok.toLocaleString()], ["KV per token", "128 KiB"], ["KV cache", (tok * 128 / 1048576).toFixed(2) + " GiB", C.sig]], { w: 200 });
        return;
      }
      if (f.key === "many") {
        const sizes = [14, 9, 20, 6, 16, 11, 24, 8, 18, 12, 22, 10, 15, 19, 13, 17, 21, 9, 14, 12];
        const shown = Math.floor(easeIO(f.p) * sizes.length * 1.05);
        let c0 = W_CELLS; const owner = new Map(); let fitted = 0;
        sizes.slice(0, shown).forEach((s, j) => { if (c0 + s > N) return; for (let q = 0; q < s; q++) owner.set(c0 + q, j); c0 += s; fitted++; });
        memoryGrid(k, c => weights(c) || (owner.has(c) ? { fill: convCol[owner.get(c) % 8], r: 5, alpha: 0.9 } : null));
        const waiting = Math.max(0, shown - fitted);
        k.hud("tl", "Conversations", [["fitting in memory", String(fitted), C.sig], ["waiting for space", String(waiting), waiting ? C.amb : C.muted], ["free memory", ((N - c0) * 0.25).toFixed(1) + " GB"]], { w: 210 });
        return;
      }
      if (f.key === "reserve") {
        const RES = 32, used = [9, 6, 11, 7, 10, 5, 8, 8];
        const fits = Math.floor(free / RES); let c0 = W_CELLS;
        const reveal = Math.ceil(easeIO(f.p / 0.7) * fits);
        memoryGrid(k, c => weights(c) || null);
        for (let j = 0; j < Math.min(reveal, fits); j++) {
          for (let q = 0; q < RES; q++) { const c = c0 + q, [x, y] = cellXY(c), u = q < used[j % 8]; if (u) k.box(x, y, M.cell, M.cell, { fill: convCol[j % 8], r: 5 }); else { k.box(x, y, M.cell, M.cell, { stroke: convCol[j % 8], r: 5, alpha: 0.7 }); hatch(k, x, y, M.cell, M.cell, convCol[j % 8]); } }
          c0 += RES;
        }
        const usedCells = used.slice(0, fits).reduce((a, b) => a + b, 0);
        k.hud("tl", "Reserve the maximum", [["conversations", String(fits)], ["memory reserved", (fits * RES * 0.25).toFixed(0) + " GB"], ["actually used", (usedCells * 0.25).toFixed(1) + " GB", C.amb], ["wasted", Math.round((1 - usedCells / (fits * RES)) * 100) + "%", C.amb]], { w: 210 });
        return;
      }
      if (f.key === "paged" || f.key === "prefix") {
        // deterministic scatter: conversation j owns the cells where a hash picks j
        const used = [6, 3, 9, 4, 7, 2, 5, 8], nConv = f.key === "paged" ? Math.min(40, Math.max(8, Math.round(8 + easeIO(f.p / 0.8) * 32))) : 24;
        const order = []; for (let c = W_CELLS; c < N; c++) order.push(c);
        let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const owner = new Map(); let p = 0; const PRE = 6; const shared = f.key === "prefix";
        if (shared) for (let q = 0; q < PRE; q++) owner.set(order[p++], -1);
        const myCells = [];
        for (let j = 0; j < nConv && p < order.length; j++) { const need = used[j % 8] + (shared ? 0 : 0); const mine = []; for (let q = 0; q < need && p < order.length; q++) { owner.set(order[p], j); mine.push(order[p]); p++; } myCells.push(mine); }
        memoryGrid(k, c => weights(c) || (owner.has(c) ? (owner.get(c) === -1 ? { fill: C.ink, r: 5, glow: 10, glowCol: C.ink } : { fill: convCol[owner.get(c) % 8], r: 5, alpha: 0.9 }) : null));
        // block table for conversation 0: lines from a small table to its blocks
        const tx = M.x - 40, ty = M.y + 420;
        if (!shared) { k.box(tx - 70, ty, 60, 26 * Math.min(5, myCells[0].length) + 10, { fill: C.bg2, stroke: convCol[0], r: 6 }); k.label(tx - 40, ty - 14, "block table", { col: C.muted, size: 11 });
          myCells[0].slice(0, 5).forEach((c, q) => { const [x, y] = cellXY(c); k.line(tx - 12, ty + 18 + q * 26, x, y + M.cell / 2, { col: convCol[0], lw: 1, alpha: 0.6 }); k.dot(tx - 40, ty + 18 + q * 26, 4, convCol[0]); }); }
        else { const sharedCells = [...owner.entries()].filter(([, o]) => o === -1).map(([c]) => c); [0, 1, 2, 3].forEach(j => { const mc = myCells[j][0]; if (mc == null) return; const [x1, y1] = cellXY(mc); sharedCells.slice(0, 2).forEach(sc => { const [x2, y2] = cellXY(sc); k.line(x1 + M.cell / 2, y1 + M.cell / 2, x2 + M.cell / 2, y2 + M.cell / 2, { col: convCol[j % 8], lw: 1.2, alpha: 0.5 }); }); }); }
        const usedCells = myCells.reduce((a, m) => a + m.length, 0);
        k.hud("tl", shared ? "Prefix caching" : "Paged memory", shared ? [["conversations", String(nConv)], ["shared instructions", "stored once", C.ink], ["recomputed", "never", C.sig]] : [["conversations", String(myCells.length), C.sig], ["reserved but empty", "≈ 0", C.sig], ["free memory", ((N - W_CELLS - usedCells) * 0.25).toFixed(1) + " GB"]], { w: 210 });
      }
    }
  });
});
