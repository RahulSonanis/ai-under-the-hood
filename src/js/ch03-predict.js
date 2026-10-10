/* Chapter 3 · Next word. A real (tiny) language model writes live, one word at a time.
   TinyLM: a trigram model trained in the browser on 49 sentences written for this course (155 words).
   It counts which word follows each pair of words, backing off to one-word and zero-word contexts
   (interpolated: 0.75 / 0.2 / 0.05). The learner shapes the odds (temperature, top-k, top-p), forces
   words by clicking them, and can make it "study" sentences to see its surprise (loss, −ln p). */
const TinyLM = (() => {
  const text = `the model reads the prompt and predicts the next word .
the model predicts the next token one step at a time .
the model learns from many examples of text .
the model is trained on thousands of gpus .
the model answers the question with a short summary .
the model writes a clear answer for the user .
the cat sat on the warm server rack .
the cat sleeps next to the warm gpu .
the cat likes the quiet datacenter at night .
the cat chased the cable under the rack .
the datacenter needs a lot of power and cooling .
the datacenter has thousands of racks of gpus .
the datacenter uses liquid cooling to remove heat .
the datacenter is built next to a power line .
the gpu reads the weights from memory .
the gpu multiplies large matrices very quickly .
the gpu waits for data from memory .
the gpu is busy with many requests at once .
a good answer is short and clear .
a good answer explains the reason step by step .
a good answer cites a source the user can check .
a good model gives a good answer to the user .
the user sends a prompt to the model .
the user reads the answer on the screen .
the user asks a question about the weather .
the weather is cold and the sky is grey .
the sky is blue because air scatters blue light .
the server sends the next token to the user .
the server streams the answer one token at a time .
the server waits for a free gpu .
the network connects every gpu in the cluster .
the cluster trains the model for many weeks .
the cluster loses a gpu every few hours .
training repeats the same step trillions of times .
training makes the model better at the next word .
each step makes the model a little less surprised .
the loss goes down as the model learns .
the answer is clear and the user is happy .
the rack is hot so the fans spin faster .
the cooling system keeps the gpu from getting too hot .
the cat is happy and the user is happy .
a short prompt gets a quick answer .
a long prompt takes longer to read .
the next word depends on the words before it .
the model can make a mistake when it guesses .
the model checks the answer before it writes .
the power line brings power to the datacenter .
memory holds the weights and the cache .
the cache remembers the earlier tokens .`;
  const sents = text.trim().split("\n").map(s => s.trim().split(/\s+/));
  const tri = new Map(), bi = new Map(), uni = new Map(), pairs = new Set(); let total = 0;
  const add = (m, k, w) => { let e = m.get(k); if (!e) m.set(k, e = new Map()); e.set(w, (e.get(w) || 0) + 1); };
  sents.forEach(s => { const t = ["<s>", "<s>", ...s]; for (let i = 2; i < t.length; i++) { add(tri, t[i - 2] + " " + t[i - 1], t[i]); add(bi, t[i - 1], t[i]); pairs.add(t[i - 1] + " " + t[i]); uni.set(t[i], (uni.get(t[i]) || 0) + 1); total++; } });
  const vocab = Array.from(uni.keys());
  function dist(ctx) {
    const a = ctx[ctx.length - 2] || "<s>", b = ctx[ctx.length - 1] || "<s>";
    const T = tri.get(a + " " + b), B = bi.get(b);
    const lt = T ? 0.75 : 0, lb = B ? (T ? 0.2 : 0.9) : 0, lu = 1 - lt - lb;
    const norm = m => { let s = 0; m.forEach(v => s += v); return s; };
    const nT = T ? norm(T) : 1, nB = B ? norm(B) : 1;
    return vocab.map(w => [w, lt * ((T && T.get(w)) || 0) / nT + lb * ((B && B.get(w)) || 0) / nB + lu * uni.get(w) / total]).sort((x, y) => y[1] - x[1]);
  }
  const seenPair = (prev, w) => pairs.has((prev || "<s>") + " " + w);
  return { dist, sents, seenPair, vocab };
})();

chapter("predict", () => {
  const STEP = 0.7, WIN = 40, TOPN = 20, HOT = 1.5;
  const NEW = ["the cat sleeps on the warm rack .", "the user waits for a quick answer .", "the gpu needs a lot of cooling .", "a long answer takes longer to read .",
    "the server is busy at night .", "the cluster needs power and cooling .", "the cat reads the answer on the screen ."].map(s => s.split(" "));
  const YOU = "#8fb3ff";
  const pct = p => p >= 0.995 ? "100%" : p >= 0.1 ? Math.round(p * 100) + "%" : p >= 0.01 ? (p * 100).toFixed(1) + "%" : p > 0 ? "<1%" : "0%";
  const f2 = x => x.toFixed(2);

  function init(rand) {
    const s = { t: 0, toks: [], ctxStart: 0, ph: 0, u: rand(), rand, mode: "write", T: 0, k: TOPN, p: 1, sent: null, si: 0,
      surp: [], loss: { studied: [0, 0], new: [0, 0] }, forced: null, studyClick: -9, last: null, win: { rep: 0, un: 0, streak: 0, pair: "" }, metAt: -9, met: false, L: null };
    refresh(s); return s;
  }
  const ctxOf = s => { const a = s.toks.slice(s.ctxStart).map(t => t.w); const d = a.lastIndexOf("."); return d >= 0 ? a.slice(d + 1) : a; };
  function refresh(s) { s.full = TinyLM.dist(ctxOf(s)); s.raw = s.full.slice(0, TOPN); }
  /* temperature, then top-k, then top-p, then renormalise (the order most samplers use) */
  function shaped(s, plain) {
    const raw = s.raw; let probs;
    if (plain) { const Z = raw.reduce((a, e) => a + e[1], 0); return raw.map(([w, q]) => ({ w, raw: q, temp: q, p: q / Z })); }
    if (s.T === 0) probs = raw.map((_, i) => i === 0 ? 1 : 0);
    else { const lg = raw.map(([, q]) => Math.log(q) / s.T), mx = Math.max(...lg), e = lg.map(x => Math.exp(x - mx)), Z = e.reduce((a, b) => a + b); probs = e.map(x => x / Z); }
    const keep = new Set(); let c = 0;
    for (let j = 0; j < probs.length && j < s.k; j++) { keep.add(j); c += probs[j]; if (c >= s.p - 1e-9) break; }
    const kept = probs.map((q, i) => keep.has(i) ? q : 0), Z = kept.reduce((a, b) => a + b);
    return raw.map(([w, q], i) => ({ w, raw: q, temp: probs[i], p: kept[i] / Z }));
  }
  const pickIdx = (d, u) => { let i = 0, acc = 0; for (; i < d.length; i++) { acc += d[i].p; if (u < acc) return i; } let j = d.length - 1; while (j > 0 && d[j].p === 0) j--; return j; };

  function newSentence(s) { const pool = s.mode === "studied" ? TinyLM.sents : NEW; let n; do { n = pool[Math.floor(s.rand() * pool.length)]; } while (pool.length > 1 && n === s.sent); s.sent = n; s.si = 0; }
  function push(s, tok) { tok.t0 = s.t; s.toks.push(tok); if (s.toks.length > 260) { const cut = s.toks.length - 200; s.toks = s.toks.slice(cut); s.ctxStart = Math.max(0, s.ctxStart - cut); } }
  function commit(s) {
    const ctx = ctxOf(s), prev = ctx.length ? ctx[ctx.length - 1] : null;
    if (s.mode === "write") {
      const d = shaped(s), i = pickIdx(d, s.u), w = d[i].w;
      push(s, { w, src: "model", T: s.T, un: !TinyLM.seenPair(prev, w), p: d[i].p, raw: d[i].raw });
      s.last = { w, p: d[i].p, raw: d[i].raw, u: s.u };
    } else {
      if (!s.sent || s.si >= s.sent.length) newSentence(s);
      const w = s.sent[s.si++], q = (s.full.find(e => e[0] === w) || [w, 1e-6])[1], sur = -Math.log(q);
      push(s, { w, src: s.mode, un: false, p: q, raw: q, sur });
      const L = s.loss[s.mode]; L[0] += sur; L[1]++;
      s.surp.push({ w, sur, q, mode: s.mode }); if (s.surp.length > 16) s.surp.shift();
      s.last = { w, p: q, raw: q, sur, mode: s.mode };
      if (s.si >= s.sent.length) s.sent = null;
    }
    score(s); s.u = s.rand(); s.ph = 0; refresh(s);
  }
  function score(s) {
    const win = s.toks.filter(t => t.src === "model" || t.src === "you").slice(-WIN), seen = new Set(); let rep = 0, un = 0, pair = "";
    win.forEach((t, i) => { t.rep = false; if (i >= 3) { const g = win.slice(i - 3, i + 1).map(x => x.w).join(" "); if (seen.has(g)) { rep++; t.rep = true; } seen.add(g); } if (t.un && t.src === "model") { un++; pair = (win[i - 1] ? win[i - 1].w : "") + " " + t.w; } });
    let streak = 0; for (let i = s.toks.length - 1; i >= 0; i--) { const t = s.toks[i]; if (t.src !== "model" || t.T < HOT || t.un) break; streak++; }
    s.win = { rep: win.length > 3 ? rep / (win.length - 3) : 0, un, streak, pair, n: win.length };
    const met = streak >= WIN && s.win.rep <= 0.15; if (met && !s.met) s.metAt = s.t; s.met = s.met || met;
  }
  function setMode(s, m) {
    if (s.mode === m) return; s.mode = m; s.ctxStart = s.toks.length; s.nl = true; s.sent = null; s.surp = [];
    if (s.toks.length) s.toks[s.toks.length - 1].brk = true; s.ph = 0; refresh(s);
  }
  function step(s, dt) { s.t += dt; if (s.degenAt == null && s.win.rep > 0.5 && s.t > 6) s.degenAt = s.t; s.ph += dt / STEP; if (s.ph >= 1) commit(s); }

  // ---------- layout ----------
  function layout(narrow) {
    return narrow
      ? { n: true, W: 700, text: { x: 0, y: 0, w: 700, h: 250, fs: 30, lh: 44, lines: 4 }, bars: { x: 0, y: 290, w: 700, rows: 6, rh: 56, lw: 170, fs: 26 }, strip: { x: 0, y: 690, w: 700, h: 46 }, panel: { x: 0, y: 790, w: 700, h: 262 } }
      : { n: false, W: 1200, text: { x: 0, y: 0, w: 1200, h: 170, fs: 24, lh: 36, lines: 3 }, bars: { x: 0, y: 200, w: 640, rows: 8, rh: 44, lw: 150, fs: 19 }, strip: { x: 690, y: 250, w: 510, h: 40 }, panel: { x: 690, y: 330, w: 510, h: 250 } };
  }

  function draw(k, s, sim) {
    const C = k.C, L = s.L = layout(sim.narrow), c = k.ctx, studying = s.mode !== "write", d = shaped(s, studying);
    const pick = studying ? d.findIndex(x => x.w === (s.sent ? s.sent[s.si] : null)) : pickIdx(d, s.u);
    const nextTrue = studying ? (s.sent && s.si < s.sent.length ? s.sent[s.si] : null) : null;
    // ---- the text so far ----
    const T = L.text;
    k.box(T.x, T.y, T.w, T.h, { fill: C.bg2, stroke: C.line, r: 14 });
    k.label(T.x + 16, T.y + 16, studying ? (s.mode === "studied" ? "Reading a sentence it studied (it is not writing now)" : "Reading a new sentence it never saw") : "What it has written", { align: "left", size: 12, col: studying ? C.amb : C.muted, weight: "600" });
    if (!L.n) k.label(T.x + T.w - 16, T.y + 16, "red underline: a word pair it never saw · amber: repeating itself · blue: your pick", { align: "right", size: 11, col: C.muted });
    font(c, T.fs, "--f-display", "500");
    const sp = c.measureText(" ").width, maxW = T.w - 40, lines = [[]]; let lw = 0;
    const toks = s.toks.slice(-120);
    toks.forEach((t, i) => { const w = c.measureText(t.w).width; if ((lw + w > maxW && lines[lines.length - 1].length) || (i > 0 && toks[i - 1].brk)) { lines.push([]); lw = 0; } lines[lines.length - 1].push([t, w, lw]); lw += w + sp; });
    const cur = lines[lines.length - 1]; let curX = cur.length ? cur[cur.length - 1][2] + cur[cur.length - 1][1] + sp : 0;
    const shown = lines.slice(-T.lines), y0 = T.y + 34 + T.lh * 0.55 + (T.lines - shown.length) * 0;
    shown.forEach((ln, li) => ln.forEach(([t, w, x]) => {
      const X = T.x + 20 + x, Y = y0 + li * T.lh, age = s.t - t.t0;
      if (t.rep) k.box(X - 3, Y - T.fs * 0.62, w + 6, T.fs * 1.24, { fill: C.amb, alpha: 0.2, r: 5 });
      if (t.sur != null) k.box(X - 3, Y - T.fs * 0.62, w + 6, T.fs * 1.24, { fill: t.sur > 1.5 ? C.amb : C.sig, alpha: Math.min(0.35, 0.08 + t.sur / 10), r: 5 });
      const col = t.src === "you" ? YOU : C.ink;
      k.text(X, Y, t.w, { size: T.fs, align: "left", col, alpha: t.src === "studied" || t.src === "new" ? 0.9 : 1 });
      if (age < 0.5) k.box(X - 3, Y - T.fs * 0.62, w + 6, T.fs * 1.24, { stroke: C.sig, r: 5, alpha: 1 - age * 2, glow: 10 });
      if (t.un && t.src === "model") k.line(X, Y + T.fs * 0.55, X + w, Y + T.fs * 0.55, { col: C.crit, lw: 2.5 });
    }));
    // cursor + ghost of the word about to be added
    const lastLine = Math.min(shown.length, T.lines) - 1, cy = y0 + Math.max(0, lastLine) * T.lh;
    let gx = T.x + 20 + curX; if (s.toks.length && s.toks[s.toks.length - 1].brk) { gx = T.x + 20; }
    const ghost = studying ? nextTrue : (pick >= 0 ? d[pick].w : null);
    if (ghost && s.ph > 0.45 && !(s.toks.length && s.toks[s.toks.length - 1].brk)) k.text(gx, cy, ghost, { size: T.fs, align: "left", col: studying ? C.amb : C.sig, alpha: 0.25 + 0.5 * (s.ph - 0.45) });
    else if (Math.floor(s.t * 2.2) % 2 === 0 && !(s.toks.length && s.toks[s.toks.length - 1].brk)) k.box(gx, cy - T.fs * 0.5, 3, T.fs, { fill: C.sig, r: 1 });

    // ---- next-word bars ----
    const B = L.bars, rows = d.slice(0, B.rows), maxp = Math.max(0.01, ...rows.map(x => Math.max(x.p, x.raw)));
    k.label(B.x + 4, B.y + 6, studying ? "What it expected next (the ring marks the true word)" : (L.n ? "What could come next · tap one to force it" : "What could come next · click a word to make it write that"), { align: "left", size: 12, col: C.ink, weight: "600" });
    if (!L.n) k.label(B.x + 4, B.y + 30 + B.rows * B.rh + 8, studying ? "the model's own odds (your temperature and cuts don't apply when reading)" : "thin grey: the model's own odds · teal: after your temperature and cuts", { align: "left", size: 11, col: C.muted });
    const bx = B.x + B.lw + 12, bw = B.w - B.lw - 90;
    rows.forEach((x, i) => {
      const y = B.y + 30 + i * B.rh, cut = x.p === 0, hl = i === pick, cyy = y + B.rh / 2;
      if (hl) k.box(B.x, y + 2, B.w, B.rh - 4, { fill: studying ? C.amb : C.sig, alpha: 0.1 + (studying ? 0.05 : 0.12 * Math.min(1, s.ph * 2)), r: 8 });
      k.text(B.x + B.lw, cyy, x.w, { size: B.fs, align: "right", col: cut ? C.muted : C.ink, mono: true, alpha: cut ? 0.6 : 1 });
      k.box(bx, cyy - B.rh * 0.3, bw * x.raw / maxp, B.rh * 0.12, { fill: C.muted, alpha: 0.55, r: 2 });
      if (!cut) k.box(bx, cyy - B.rh * 0.12, Math.max(2, bw * x.p / maxp), B.rh * 0.36, { fill: C.sig, r: 4, glow: hl && !studying ? 10 : 0, alpha: hl || studying ? 1 : 0.85 });
      k.text(bx + bw * Math.max(x.p, x.raw) / maxp + 10, cyy, cut ? "cut" : pct(x.p), { size: B.fs * 0.82, align: "left", col: cut ? C.muted : C.ink, mono: true });
      if (studying && hl) k.box(B.x + 2, y + 3, B.w - 4, B.rh - 6, { stroke: C.amb, r: 8, lw: 2 });
    });
    if (studying && nextTrue && pick < 0 || (studying && pick >= B.rows)) {
      const rk = s.full.findIndex(e => e[0] === nextTrue), q = rk >= 0 ? s.full[rk][1] : 0;
      k.label(B.x + 4, B.y + 30 + B.rows * B.rh + 10, `true word "${nextTrue}" is further down: number ${rk + 1} of ${TinyLM.vocab.length}, ${pct(q)}`, { align: "left", size: 12, col: C.amb });
    }

    // ---- dice strip ----
    const S = L.strip; let acc = 0;
    k.label(S.x + 2, S.y - 26, studying ? "No dice while reading: the true word is fixed" : (s.T === 0 ? "The dice roll (temperature 0: the top word always wins)" : "The dice roll: each word's slice is its chance"), { align: "left", size: 12, col: C.ink, weight: "600" });
    k.box(S.x, S.y, S.w, S.h, { fill: C.bg2, stroke: C.line, r: 8 });
    const pal = [C.sig, "#7fdcff", "#8fb3ff", "#9be37a", "#d59cff", "#ffd27a", "#ff8fa3", "#5ce1c6"];
    d.forEach((x, i) => { if (x.p <= 0) return; const w = S.w * x.p, X = S.x + S.w * acc; acc += x.p;
      k.box(X + 1, S.y + 2, Math.max(1, w - 2), S.h - 4, { fill: pal[i % pal.length], alpha: i === pick ? 0.95 : 0.45, r: 5, glow: i === pick && !studying && s.ph > 0.4 ? 12 : 0 });
      if (w > (L.n ? 70 : 52)) k.text(X + w / 2, S.y + S.h / 2, x.w, { size: L.n ? 20 : 14, col: C.bg, weight: "650", mono: true }); });
    if (!studying) {
      const drop = easeOut(Math.min(1, s.ph / 0.4)), ux = S.x + S.w * s.u, uy = S.y - 34 + 34 * drop;
      k.line(ux, S.y - 6, ux, S.y + S.h + 6, { col: C.ink, lw: 2, alpha: drop });
      k.dot(ux, uy - 6, L.n ? 9 : 7, C.amb, { glow: 12 });
      k.label(ux, S.y + S.h + 16, "dice: " + s.u.toFixed(2), { size: 11, col: C.amb, mono: true });
    }

    // ---- lower-right panel ----
    const P = L.panel;
    k.box(P.x, P.y, P.w, P.h, { stroke: C.line, r: 14 });
    if (!studying) {
      const w = s.win, pad = 20, fs = L.n ? 27 : 16;
      k.label(P.x + pad, P.y + 20, "Last 40 words", { align: "left", size: 12, col: C.ink, weight: "600" });
      const rowsP = [
        ["repeating itself", w.rep, 0.15, pct(w.rep), w.rep > 0.15 ? C.amb : C.ok],
        ["word pairs it never saw", Math.min(1, w.un / 8), 0.0001, String(w.un), w.un ? C.crit : C.ok],
        [`clean words in a row at temperature ≥ ${HOT}`, Math.min(1, w.streak / WIN), 1, `${Math.min(w.streak, WIN)} / ${WIN}`, w.streak >= WIN ? C.ok : C.sig]];
      rowsP.forEach(([lab, v, thr, txt, col], i) => {
        const y = P.y + 54 + i * (P.h - 70) / 3, bw2 = P.w - pad * 2;
        k.text(P.x + pad, y, lab, { size: fs * 0.9, align: "left", col: C.muted });
        k.text(P.x + P.w - pad, y, txt, { size: fs, align: "right", col, mono: true, weight: "600" });
        k.box(P.x + pad, y + fs * 0.9, bw2, 8, { fill: C.line, alpha: 0.6, r: 4 });
        k.box(P.x + pad, y + fs * 0.9, Math.max(0, bw2 * v), 8, { fill: col, r: 4 });
        if (thr < 1 && thr > 0.001) k.line(P.x + pad + bw2 * thr, y + fs * 0.9 - 4, P.x + pad + bw2 * thr, y + fs * 0.9 + 12, { col: C.ink, lw: 1.5 });
      });
    } else {
      const pad = 20, list = s.surp.slice(L.n ? -8 : -12), n = Math.max(list.length, L.n ? 8 : 12), bw2 = (P.w - pad * 2) / n, base = P.y + P.h - 40, top = P.y + 50, sc = (base - top) / 5;
      k.label(P.x + pad, P.y + 20, "Surprise at each true word (−ln p)", { align: "left", size: 12, col: C.ink, weight: "600" });
      list.forEach((e, i) => { const h = Math.min(5, e.sur) * sc, x = P.x + pad + i * bw2; k.box(x + 3, base - h, bw2 - 6, Math.max(2, h), { fill: e.sur > 1.5 ? C.amb : C.sig, r: 3, alpha: i === list.length - 1 ? 1 : 0.75 });
        k.label(x + bw2 / 2, base + 12 + (i % 2) * 13, e.w.length > 8 ? e.w.slice(0, 7) + "…" : e.w, { size: 10, col: i === list.length - 1 ? C.ink : C.muted, mono: true }); });
      const avg = s.loss[s.mode][1] ? s.loss[s.mode][0] / s.loss[s.mode][1] : 0;
      if (avg) { const y = base - Math.min(5, avg) * sc; k.line(P.x + pad, y, P.x + P.w - pad, y, { col: C.ink, dash: [5, 5], lw: 1.2 }); k.label(P.x + P.w - pad, y - 10, "average " + f2(avg), { align: "right", size: 11, col: C.ink, bg: true }); }
      k.line(P.x + pad, base, P.x + P.w - pad, base, { col: C.line });
    }
  }

  const avgOf = (s, m) => s.loss[m][1] ? s.loss[m][0] / s.loss[m][1] : null;
  const kept = s => shaped(s).filter(x => x.p > 0).length;

  makeSim($("#pred-sim"), {
    label: "A tiny language model writing one word at a time. Bars show its odds for the next word; a dice roll on the strip picks one. Click a word in the bars to make it write that word.",
    cams: { default: { x: -10, y: -10, w: 1220, h: 610 } },
    camsNarrow: { default: { x: -6, y: -6, w: 712, h: 1062 } },
    height: w => w < 640 ? Math.round(w * 1.48) : Math.round(Math.min(600, Math.max(400, w * 0.52))),
    init, step, draw, warmup: 9,
    intro: "The model is writing with temperature 0: it always takes its most likely next word. Watch what happens, then try the controls.",
    controls: [
      { id: "mode", label: "What the model does", type: "choice", value: "write", options: [["write", "Write"], ["studied", "Read old"], ["new", "Read new"]], help: "Or make it read sentences it learned from (old) or never saw (new), and measure its surprise.", apply: (s, v) => setMode(s, v) },
      { id: "temp", label: "Temperature", type: "range", min: 0, max: 2, step: 0.05, value: 0, fmt: v => v === 0 ? "0 · always the top word" : v.toFixed(2), help: "Low: safe and repetitive. High: surprising, then nonsense.", apply: (s, v) => { s.T = v; } },
      { id: "topk", label: "Top-k", type: "range", min: 1, max: 20, step: 1, value: 20, fmt: v => v === 20 ? "20 · off" : "keep " + v, help: "Keep only the k most likely words.", apply: (s, v) => { s.k = v; } },
      { id: "topp", label: "Top-p", type: "range", min: 0.05, max: 1, step: 0.05, value: 1, fmt: v => v >= 1 ? "1 · off" : v.toFixed(2), help: "Keep the fewest top words whose chances add up to p.", apply: (s, v) => { s.p = v; } }
    ],
    click: (s, wx, wy) => {
      const B = s.L && s.L.bars; if (!B) return;
      const i = Math.floor((wy - B.y - 30) / B.rh); if (wx < B.x || wx > B.x + B.w || i < 0 || i >= B.rows) return;
      if (s.mode !== "write") { s.studyClick = s.t; return; }
      const d = shaped(s), x = d[i]; if (!x) return; const ctx = ctxOf(s);
      push(s, { w: x.w, src: "you", T: s.T, un: !TinyLM.seenPair(ctx[ctx.length - 1], x.w), p: x.p, raw: x.raw });
      s.forced = { w: x.w, p: x.p, raw: x.raw, t: s.t }; score(s); s.u = s.rand(); s.ph = 0; refresh(s);
    },
    stats: s => { const st = s.mode !== "write"; const a = avgOf(s, "studied"), b = avgOf(s, "new");
      return [["words still in the running", String(kept(s)), kept(s) === 1 ? "hot" : ""],
        ["repeating (last 40 words)", pct(s.win.rep), s.win.rep > 0.15 ? "hot" : "ok"],
        ["word pairs it never saw", String(s.win.un), s.win.un ? "bad" : "ok"],
        ["average surprise: studied · new", (a == null ? "–" : f2(a)) + " · " + (b == null ? "–" : f2(b)), st ? "hot" : ""]]; },
    goal: { text: `at temperature ${HOT} or more, write 40 words in a row with no word pair it never saw, and few repeats`,
      check: s => ({ done: s.met, progress: s.T < HOT ? `temperature ${s.T.toFixed(2)}` : `${Math.min(s.win.streak, WIN)} / ${WIN} clean · ${pct(s.win.rep)} repeats` }) },
    notices: [
      { id: "studyClick", when: s => s.t - s.studyClick < 3, say: () => "It's reading a fixed sentence now, so you can't steer it. Switch to <b>Write</b> to pick words yourself." },
      { id: "forced", when: s => s.forced && s.t - s.forced.t < 3.5, say: s => `You made it write "<b>${esc(s.forced.w)}</b>", a word it gave ${pct(s.forced.raw)}. It carries on from your word as if it had chosen it: it only ever sees the text so far.` },
      { id: "studied", when: s => s.mode === "studied" && s.last && s.last.mode === "studied", say: s => `It gave the true word "<b>${esc(s.last.w)}</b>" ${pct(s.last.p)}, so its surprise was −ln(${s.last.p.toFixed(2)}) = <b>${f2(s.last.sur)}</b>. Averaged over every word, surprise is the <b>loss</b>: ${f2(avgOf(s, "studied"))} so far. Training exists to push it down.` },
      { id: "new", when: s => s.mode === "new" && s.last && s.last.mode === "new", say: s => { const a = avgOf(s, "studied"); return `This sentence was never in its training text. "<b>${esc(s.last.w)}</b>" got ${pct(s.last.p)} (surprise ${f2(s.last.sur)}). Average here: <b>${f2(avgOf(s, "new"))}</b>${a != null ? `, against ${f2(a)} on sentences it studied` : ""}. Doing well on text it never saw is what really counts.`; } },
      { id: "met", when: s => s.met && s.t - s.metAt < 8, say: s => `Goal reached: hot enough to vary (temperature ${s.T.toFixed(2)}), with the long tail cut so nothing it never saw slips in. Real chatbots tune exactly these two kinds of knob.` },
      { id: "loop", when: s => (s.T === 0 || s.k === 1) && s.win.rep > 0.3, say: s => `With ${s.T === 0 ? "temperature 0" : "top-k 1"} it always takes the top word. The same words always lead to the same next word, so it's stuck in a loop: <b>${pct(s.win.rep)}</b> of the last 40 words repeat. Raise the temperature so a dice roll decides.` },
      { id: "nonsense", when: s => s.win.un >= 2, say: s => `At temperature ${s.T.toFixed(2)} unlikely words get real chances. "<b>${esc(s.win.pair)}</b>" is a word pair it never saw in training (red underline). Cut the tail with <b>top-p</b> or <b>top-k</b>, or cool it down.` },
      { id: "cut", when: s => (s.k < 20 || s.p < 1) && s.T > 0, say: s => `${s.p < 1 ? `Top-p ${s.p.toFixed(2)}` : `Top-k ${s.k}`} keeps only <b>${kept(s)}</b> word${kept(s) === 1 ? "" : "s"} for this step. The rest are cut before the dice roll, so they can never be picked. The kept odds are scaled back up to add to 100%.` },
      { id: "dice", when: s => s.mode === "write" && s.T > 0 && s.last, say: s => `The dice landed at ${s.last.u.toFixed(2)} and picked "<b>${esc(s.last.w)}</b>", which held ${pct(s.last.p)} of the strip. A word's chance of being picked is exactly the width of its slice.` }
    ],
    facts: [
      { id: "degen", when: s => s.win.rep > 0.5, text: "Researchers who studied this found the same thing in big models: always choosing the most likely words gives bland text that falls into repetitive loops. Their fix was top-p, also called nucleus sampling.", ref: "#ref-39" },
      { id: "topkbug", when: s => (s.k < 20 || s.p < 1) && (s.degenAt == null || s.t - s.degenAt > 16), text: "This small step can go wrong in production. In 2025 Anthropic, the company that makes Claude, traced one of three quality bugs to a top-k operation that was miscompiled on some of its chips and sometimes dropped the most likely token.", ref: "#ref-30" }
    ],
    tour: [
      { say: "Temperature 0: it always takes the most likely word. Watch it fall into a loop.", set: { mode: "write", temp: 0, topk: 20, topp: 1 }, wait: 7 },
      { say: "Temperature 1: now a dice roll picks, in proportion to the bars. The writing varies, and mostly still makes sense.", set: { temp: 1 }, wait: 8 },
      { say: "Temperature 2 flattens the bars. Unlikely words get real chances, and red underlines appear: word pairs it never saw.", set: { temp: 2 }, wait: 9 },
      { say: "Keep temperature 2, but set top-p to 0.6: only the top words that make up 60% survive. Varied, without the nonsense.", set: { topp: 0.6 }, wait: 9 },
      { say: "Now it reads sentences it studied. The ring marks the true next word. Its surprise is −ln p, and the average is the loss.", set: { mode: "studied" }, wait: 9 },
      { say: "Sentences it never saw: surprise jumps. Lowering surprise on new text is what training is really after.", set: { mode: "new" }, wait: 9 }
    ],
    publish: s => {
      const d = shaped(s), a = avgOf(s, "studied"), b = avgOf(s, "new"), r = s.raw, T = s.T;
      const z1 = Math.log(r[0][1]), z2 = Math.log(r[1][1]);
      const ratioT = T === 0 ? "all or nothing: the top word always wins" : Math.exp((z1 - z2) / T).toFixed(1) + "×";
      const ctx = ctxOf(s);
      return { pdT: T === 0 ? "0" : T.toFixed(2), pdKept: String(kept(s)), pdRep: pct(s.win.rep), pdUn: String(s.win.un),
        pdCtx: ctx.length ? "“…" + ctx.slice(-2).join(" ") + "”" : "the start of a sentence", pdW1: r[0][0], pdW2: r[1][0], pdP1: pct(r[0][1]), pdP2: pct(r[1][1]),
        pdR1: (r[0][1] / r[1][1]).toFixed(1), pdRT: ratioT, pdS1: pct(d[0].p), pdS2: pct(d[1].p),
        pdLossA: a == null ? "not measured yet (try Read old)" : f2(a), pdLossB: b == null ? "not measured yet (try Read new)" : f2(b),
        pdLastW: s.last ? s.last.w : "–", pdLastP: s.last ? s.last.p.toFixed(3) : "–", pdLastS: s.last ? (-Math.log(Math.max(1e-6, s.last.p))).toFixed(2) : "–" };
    }
  });
});
