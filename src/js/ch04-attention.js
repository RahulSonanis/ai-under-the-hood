/* Chapter 4 · Attention. A toy transformer reads "The animal didn't cross the street because it was too ___".
   Everything is computed for real, with small hand-set weights:
   - each word has a few labelled numbers (living thing, place, pronoun, describes-a-living-thing, describes-a-place, start);
   - three heads make 2-D queries and keys from them; weights = softmax(q·k / √2) over this word and EARLIER words only;
   - the "who is it" head copies the attended nouns' "living"/"place" numbers into the stream (its values);
   - each layer's MLP is two ReLU units that push the stream further towards whichever reading is ahead;
   - the readout at the end turns the last word's stream into odds for "animal" vs "street".
   Real models learn thousands of unlabelled numbers per word; this toy labels them so you can watch. */
chapter("attention", () => {
  const BASE = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "too"];
  const ADJ = { tired: "living", scared: "living", wide: "place" };
  const IT = 7, LAST = 10, R2 = Math.SQRT2;
  const HEADS = { coref: { name: "Who is \"it\"?", layer: 2 }, prev: { name: "Previous word", layer: 1 }, sink: { name: "Sentence start", layer: 1 } };
  const TH = 2 * Math.PI / 12;                       // rotation per position for the previous-word head
  const C_CO = Math.sqrt(3 * R2), C_PR = Math.sqrt(12 * R2), C_SK = Math.sqrt(4 * R2);
  const pc = x => Math.round(x * 100) + "%";

  const words = s => [...BASE, s.adj];
  function feat(w, i) {
    const f = { living: 0, place: 0, pron: 0, dLiving: 0, dPlace: 0, start: 0 };
    if (w === "animal") f.living = 1; if (w === "street") f.place = 1; if (w === "it") f.pron = 1; if (i === 0) f.start = 1;
    if (ADJ[w] === "living") f.dLiving = 1; if (ADJ[w] === "place") f.dPlace = 1; return f;
  }
  /* query and key of word i in a head (the length slider scales queries) */
  function qOf(s, head, i) {
    if (s.qo && s.qo.i === i && s.qo.head === head) return s.qo.v;
    const f = feat(words(s)[i], i), L = s.len;
    if (head === "coref") return [C_CO * L * (f.dLiving + 0.7 * f.pron), C_CO * L * (f.dPlace + 0.7 * f.pron)];
    if (head === "prev") return [C_PR * L * Math.cos(TH * (i - 1)), C_PR * L * Math.sin(TH * (i - 1))];
    return [C_SK * L, 0];
  }
  function kOf(s, head, j) {
    const f = feat(words(s)[j], j);
    if (head === "coref") { const rest = f.living || f.place || f.pron ? 0 : 1; return [C_CO * (f.living + 0.05 * f.place + 0.45 * f.pron - 0.3 * rest), C_CO * (f.place + 0.05 * f.living + 0.45 * f.pron - 0.3 * rest)]; }
    if (head === "prev") return [C_PR * Math.cos(TH * j), C_PR * Math.sin(TH * j)];
    if (f.start) return [C_SK, 0]; const a = j * 2.39 + 0.7; return [0.25 * C_SK * Math.cos(a), 0.25 * C_SK * Math.sin(a)];
  }
  /* causal attention: word i only ever looks at words 0..i */
  function attend(s, head, i) {
    const q = qOf(s, head, i), ks = [], sc = [];
    for (let j = 0; j <= i; j++) { const k = kOf(s, head, j); ks.push(k); sc.push((q[0] * k[0] + q[1] * k[1]) / R2); }
    const mx = Math.max(...sc), e = sc.map(x => Math.exp(x - mx)), Z = e.reduce((a, b) => a + b);
    return { q, ks, sc, w: e.map(x => x / Z) };
  }
  /* the stack, for the last word */
  function stack(s) {
    const out = [], ws = words(s); let living = 0, place = 0;
    for (let l = 1; l <= 4; l++) {
      const on = l <= s.layers, row = { l, on, att: "", mlp: "", dA: [0, 0], dM: [0, 0] };
      if (l === 1) { const a = attend(s, "prev", LAST); const j = a.w.indexOf(Math.max(...a.w)); row.att = `previous word: "${ws[j]}"`; row.attHead = "prev"; }
      if (l === 2) { const a = attend(s, "coref", LAST); let dl = 0, dp = 0; a.w.forEach((x, j) => { const f = feat(ws[j], j); dl += x * f.living; dp += x * f.place; }); row.dA = [dl, dp]; row.attHead = "coref"; }
      if (on) { living += row.dA[0]; place += row.dA[1]; }
      const h1 = Math.max(0, living - place), h2 = Math.max(0, place - living); row.dM = [0.4 * h1, 0.4 * h2];
      if (on) { living += row.dM[0]; place += row.dM[1]; }
      row.after = [living, place]; out.push(row);
    }
    const za = 1.5 * living, zs = 1.5 * place, m = Math.max(za, zs), ea = Math.exp(za - m), es = Math.exp(zs - m);
    return { rows: out, living, place, pA: ea / (ea + es), pS: es / (ea + es) };
  }

  function init() { return { t: 0, adj: "tired", sel: IT, head: "coref", layers: 4, len: 1, qo: null, changedAt: -9, lenAt: -9, qoAt: -9, metAt: -9, met: false, L: null, prevAtt: null }; }
  function step(s, dt) {
    s.t += dt; const st = stack(s);
    const met = st.pS >= 0.75 && !s.qo && s.sel === LAST; if (met && !s.met) s.metAt = s.t; s.met = s.met || met;
  }

  // ---------- layout ----------
  function layout(narrow) {
    return narrow
      ? { n: true, sent: { x: 0, y: 30, w: 700, fs: 34, lh: 120, padX: 14, h: 56 }, plot: { cx: 160, cy: 520, R: 140, lx: 400, ly: 380, lw: 295 }, stk: { x: 0, y: 760, w: 700, h: 600 } }
      : { n: false, sent: { x: 0, y: 150, w: 1200, fs: 25, lh: 0, padX: 12, h: 44 }, plot: { cx: 160, cy: 440, R: 135, lx: 378, ly: 300, lw: 210 }, stk: { x: 618, y: 236, w: 582, h: 364 } };
  }
  function placeTokens(k, s, L) {
    const c = k.ctx, S = L.sent, ws = words(s); font(c, S.fs, "--f-mono", "500");
    const wd = ws.map(w => c.measureText(w).width + S.padX * 2), gap = S.fs * 0.45, rects = [];
    const lines = [[]]; let lw = 0; ws.forEach((w, i) => { if (lw + wd[i] > S.w && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(i); lw += wd[i] + gap; });
    lines.forEach((ln, li) => { const tot = ln.reduce((a, i) => a + wd[i] + gap, -gap); let x = S.x + (S.w - tot) / 2; ln.forEach(i => { rects[i] = { x, y: S.y + li * S.lh, w: wd[i], h: S.h }; x += wd[i] + gap; }); });
    return rects;
  }
  function arrow(k, x0, y0, x1, y1, col, lw, alpha) {
    k.line(x0, y0, x1, y1, { col, lw, alpha }); const a = Math.atan2(y1 - y0, x1 - x0), h = k.px(9);
    const c = k.ctx; c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.fillStyle = col; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4)); c.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4)); c.closePath(); c.fill(); c.restore();
  }

  function draw(k, s, sim) {
    const C = k.C, L = s.L = layout(sim.narrow), ws = words(s), headOff = HEADS[s.head].layer > s.layers;
    const A = attend(s, s.head, s.sel), rects = L.tok = placeTokens(k, s, L), S = L.sent;
    const top = A.w.map((x, j) => [x, j]).filter(([, j]) => j !== s.sel).sort((a, b) => b[0] - a[0]);
    // ---- sentence + attention ----
    k.label(L.n ? 8 : 10, L.n ? 6 : 18, `Attention from "${ws[s.sel]}" · head: ${HEADS[s.head].name} (layer ${HEADS[s.head].layer})${L.n ? "" : " · click any word"}`, { align: "left", size: 12, col: C.ink, weight: "600" });
    if (!headOff && !L.n) A.w.forEach((x, j) => {
      if (j === s.sel || x < 0.02) return; const a = rects[s.sel], b = rects[j], x1 = a.x + a.w / 2, x2 = b.x + b.w / 2, y = a.y - 6, hgt = Math.min(115, 30 + Math.abs(x1 - x2) * 0.3);
      const p = [[x2, y], [x2, y - hgt], [x1, y - hgt], [x1, y]];
      k.curve(p, { col: C.sig, lw: 1 + x * 14, alpha: 0.2 + 0.8 * x });
      if (x > 0.08) k.flow(u => bez(p, u), Math.max(1, Math.round(x * 5)), (s.t * 0.35) % 1, C.sig, { size: 2.5 + x * 3, len: 0.1 });
    });
    rects.forEach((r, i) => {
      const fut = i > s.sel, me = i === s.sel, x = headOff || fut ? 0 : A.w[i];
      k.box(r.x, r.y, r.w, r.h, { fill: me ? C.amb : C.sig, alpha: me ? 0.95 : fut ? 0.04 : 0.08 + 0.8 * x, r: 8, glow: me ? 14 : 0 });
      k.box(r.x, r.y, r.w, r.h, { stroke: fut ? C.line : me ? C.amb : C.sig, alpha: fut ? 0.6 : 0.5 + x * 0.5, r: 8, lw: me ? 2 : 1, dash: fut ? [4, 4] : null });
      k.text(r.x + r.w / 2, r.y + r.h / 2, ws[i], { size: S.fs, mono: true, col: me ? C.bg : fut ? C.muted : C.ink, alpha: fut ? 0.5 : 1, weight: me ? "650" : "500" });
      if (!fut && !headOff && x >= 0.01) k.text(r.x + r.w / 2, r.y + r.h + S.fs * 0.7, pc(x), { size: S.fs * 0.62, mono: true, col: me ? C.amb : C.sig });
    });
    if (s.sel < LAST) { const r = rects[s.sel + 1]; k.label(r.x, r.y - (L.n ? 14 : 16), L.n ? "can't see these →" : `"${ws[s.sel]}" can't see these words yet →`, { align: "left", size: 11, col: C.muted }); }
    if (headOff) k.label(rects[5].x + rects[5].w / 2, rects[0].y - 40, `This head sits in layer ${HEADS[s.head].layer}. With ${s.layers} layer, it doesn't exist.`, { size: 13, col: C.amb, weight: "600", bg: true });

    // ---- query/key plot ----
    const P = L.plot, mags = [Math.hypot(...A.q), ...A.ks.map(v => Math.hypot(...v))], M = Math.max(...mags, 0.001) * 1.05, sc = P.R / M;
    k.label(P.cx - P.R, P.cy - P.R - 26, L.n ? "Query and keys" : "Query (amber) meets keys (teal) · click to aim the query", { align: "left", size: 12, col: C.ink, weight: "600" });
    k.dot(P.cx, P.cy, P.R, C.bg2, { alpha: 0.8 }); k.box(P.cx - P.R, P.cy - P.R, P.R * 2, P.R * 2, { stroke: C.line, r: P.R });
    k.line(P.cx - P.R, P.cy, P.cx + P.R, P.cy, { col: C.line }); k.line(P.cx, P.cy - P.R, P.cx, P.cy + P.R, { col: C.line });
    if (s.head === "coref") { k.label(P.cx + P.R - 4, P.cy + 14, "living thing →", { align: "right", size: 10, col: C.muted }); k.label(P.cx - 6, P.cy - P.R * 0.5, "place ↑", { align: "right", size: 10, col: C.muted }); }
    if (s.head === "sink") k.label(P.cx + P.R - 4, P.cy + 14, "first word →", { align: "right", size: 10, col: C.muted });
    if (s.head === "prev") k.label(P.cx, P.cy + P.R + 14, "keys turn with position, like a clock hand", { size: 10, col: C.muted });
    const order = A.ks.map((v, j) => j).sort((a, b) => A.w[a] - A.w[b]);
    order.forEach(j => { const v = A.ks[j], x = P.cx + v[0] * sc, y = P.cy - v[1] * sc, w = A.w[j];
      arrow(k, P.cx, P.cy, x, y, C.sig, 1.2 + w * 4, headOff ? 0.25 : 0.3 + 0.7 * Math.min(1, w * 2.5));
      const lab = w >= 0.06 || j === 0 || (s.head === "coref" && (ws[j] === "animal" || ws[j] === "street" || ws[j] === "it")) || s.head === "prev";
      if (lab) k.label(x + (v[0] >= 0 ? 6 : -6), y + (v[1] >= 0 ? -10 : 10), ws[j], { align: v[0] >= 0 ? "left" : "right", size: 11, col: w >= 0.2 ? C.ink : C.muted, mono: true }); });
    const qx = P.cx + A.q[0] * sc, qy = P.cy - A.q[1] * sc;
    if (Math.hypot(A.q[0], A.q[1]) > 1e-6) { arrow(k, P.cx, P.cy, qx, qy, C.amb, 3.5, 1); k.dot(qx, qy, k.px(5), C.amb, { glow: 12 }); if (L.n) k.label(P.cx, P.cy + P.R + 16, `amber arrow: query of "${ws[s.sel]}"`, { size: 11, col: C.amb, weight: "600" }); else k.label(qx + (A.q[0] >= 0 ? 8 : -8), qy + (A.q[1] >= 0 ? -14 : 14), `query of "${ws[s.sel]}"`, { align: A.q[0] >= 0 ? "left" : "right", size: 11, col: C.amb, weight: "600", bg: true }); }
    else { k.dot(P.cx, P.cy, k.px(5), C.amb); k.label(P.cx, P.cy + 16, "empty query: nothing to look for", { size: 11, col: C.amb, bg: true }); }
    if (s.qo) k.label(P.cx - P.R, P.cy + P.R + (s.head === "prev" || L.n ? 32 : 16), "query aimed by you · pick another word to undo", { size: 10, col: C.amb, align: "left" });
    // score table
    const rowsT = A.w.map((w, j) => j).sort((a, b) => A.w[b] - A.w[a]).slice(0, L.n ? 5 : 6), rh = L.n ? 50 : 36, fs = L.n ? 27 : 15;
    k.text(P.lx, P.ly, "word", { size: fs * 0.8, align: "left", col: C.muted }); k.text(P.lx + P.lw * 0.62, P.ly, "q·k ÷ √2", { size: fs * 0.8, align: "right", col: C.muted }); k.text(P.lx + P.lw, P.ly, "weight", { size: fs * 0.8, align: "right", col: C.muted });
    rowsT.forEach((j, r) => { const y = P.ly + (r + 1) * rh, w = headOff ? 0 : A.w[j];
      k.box(P.lx, y + fs * 0.55, P.lw * w, 4, { fill: j === s.sel ? C.amb : C.sig, r: 2 });
      k.text(P.lx, y, ws[j], { size: fs, align: "left", mono: true, col: j === s.sel ? C.amb : C.ink });
      k.text(P.lx + P.lw * 0.62, y, A.sc[j].toFixed(2), { size: fs, align: "right", mono: true, col: C.muted });
      k.text(P.lx + P.lw, y, headOff ? "–" : pc(w), { size: fs, align: "right", mono: true, col: j === s.sel ? C.amb : C.sig, weight: "600" }); });
    k.text(P.lx, P.ly + (rowsT.length + 1) * rh + 4, "softmax turns scores into weights", { size: fs * 0.75, align: "left", col: C.muted });

    // ---- layer stack for the last word ----
    const K = L.stk, st = stack(s), sx = K.x + (L.n ? 64 : 30), top0 = K.y + (L.n ? 200 : 112), rowH = (K.h - (top0 - K.y) - (L.n ? 56 : 40)) / 4, fsK = L.n ? 28 : 14;
    k.box(K.x, K.y, K.w, K.h, { stroke: C.line, r: 14 });
    k.label(K.x + 14, K.y + 16, `Inside the stack, for the last word "${s.adj}"`, { align: "left", size: 12, col: C.ink, weight: "600" });
    // odds
    const oy = K.y + (L.n ? 50 : 40), ow = K.w - 260 - (L.n ? 0 : 0);
    k.text(K.x + 16, oy + (L.n ? 6 : 4), L.n ? `"…What was too ${s.adj}? The"` : `Odds if it then read "What was too ${s.adj}? The …"`, { size: fsK * 0.9, align: "left", col: C.muted });
    [["animal", st.pA], ["street", st.pS]].forEach(([w, p], i) => { const y = oy + (L.n ? 44 : 26) + i * (L.n ? 38 : 22), x0 = K.x + (L.n ? 120 : 90), bw = K.w - (L.n ? 220 : 170);
      k.text(x0 - 10, y, w, { size: fsK, align: "right", mono: true, col: C.ink });
      k.box(x0, y - fsK * 0.35, bw, fsK * 0.7, { fill: C.line, alpha: 0.5, r: 3 }); k.box(x0, y - fsK * 0.35, bw * p, fsK * 0.7, { fill: w === "street" ? C.amb : C.sig, r: 3, glow: p > 0.8 ? 8 : 0 });
      k.text(x0 + bw + 10, y, pc(p), { size: fsK, align: "left", mono: true, col: C.ink, weight: "600" }); });
    // stream
    const streamTop = top0 - 6, streamBot = top0 + rowH * 4 + 16;
    k.line(sx, streamBot, sx, streamTop, { col: C.sig, lw: 3, alpha: 0.6 });
    k.flow(u => [sx, streamBot - u * (streamBot - streamTop)], 5, (s.t * 0.25) % 1, C.sig, { size: 3 });
    k.label(sx, streamBot + 14, `"${s.adj}" enters`, { size: 11, col: C.muted });
    if (!L.n) k.label(K.x + K.w - 14, streamTop - 4, "stream after: animal · street", { align: "right", size: 10, col: C.muted });
    const fmtD = d => { const a = d[0], b = d[1]; if (a < 0.005 && b < 0.005) return "adds nothing yet"; return `+${a.toFixed(2)} animal · +${b.toFixed(2)} street`; };
    st.rows.forEach((r, i) => {
      const y = top0 + rowH * (3 - i), al = r.on ? 1 : 0.3, bx = sx + 26, bw = (K.w - 60) * (L.n ? 0.55 : 0.4), mw = (K.w - 60) * (L.n ? 0.3 : 0.17);
      k.text(K.x + 10, y + rowH * 0.3, "L" + r.l, { size: fsK * 0.8, align: "left", col: C.muted, alpha: al });
      k.box(bx, y + 4, bw, rowH * 0.62, { fill: C.bg2, stroke: r.on ? (r.attHead === s.head ? C.amb : C.line) : C.line, r: 8, alpha: al, dash: r.on ? null : [4, 4] });
      if (!L.n) k.text(bx + 10, y + 4 + rowH * 0.2, "attention", { size: fsK * 0.8, align: "left", col: C.muted, alpha: al });
      const attTxt = !r.on ? (L.n ? "not in model" : "not in this model") : r.l === 1 ? (L.n ? r.att.replace("previous word: ", "prev: ") : r.att) : r.l === 2 ? (L.n ? (r.dA[0] + r.dA[1] < 0.01 ? "+0" : `+${r.dA[0].toFixed(2)} · +${r.dA[1].toFixed(2)}`) : fmtD(r.dA)) : (L.n ? "little here" : "other heads, little here");
      k.text(bx + 10, y + 4 + rowH * (L.n ? 0.31 : 0.44), attTxt, { size: fsK * 0.85, align: "left", col: r.on ? C.ink : C.muted, alpha: al, mono: r.l === 2 && r.on });
      const mx0 = bx + bw + 12;
      k.box(mx0, y + 4, mw, rowH * 0.62, { fill: C.bg2, stroke: C.line, r: 8, alpha: al, dash: r.on ? null : [4, 4] });
      if (!L.n) k.text(mx0 + 10, y + 4 + rowH * 0.2, "MLP", { size: fsK * 0.8, align: "left", col: C.muted, alpha: al });
      k.text(mx0 + 10, y + 4 + rowH * (L.n ? 0.31 : 0.44), !r.on ? "–" : (r.dM[0] + r.dM[1] < 0.005 ? "+0" : "+" + (r.dM[0] + r.dM[1]).toFixed(2)), { size: fsK * 0.85, align: "left", col: C.ink, alpha: al, mono: true });
      if (r.on) { const yy = y + 4 + rowH * 0.31; k.line(bx, yy, sx + 3, yy, { col: C.amb, lw: 1.5, alpha: 0.7 }); k.dot(sx, yy, k.px(4), C.amb, { glow: 8 }); }
      const rx = mx0 + mw + 12;
      if (r.on && !L.n) k.text(K.x + K.w - 14, y + 4 + rowH * 0.31, `${r.after[0].toFixed(2)} · ${r.after[1].toFixed(2)}`, { size: fsK * 0.85, align: "right", col: C.ink, mono: true });
    });
    if (L.n) { const hy = top0 - 26; k.text(sx + 36, hy, "attention (animal · street)", { size: fsK * 0.7, align: "left", col: C.muted }); k.text(sx + 26 + (K.w - 60) * 0.55 + 22, hy, "MLP", { size: fsK * 0.7, align: "left", col: C.muted }); }
    if (L.n) k.text(K.x + K.w - 14, streamBot + 14, `stream: animal ${st.living.toFixed(2)} · street ${st.place.toFixed(2)}`, { size: fsK * 0.8, align: "right", col: C.muted, mono: true });
  }

  const sim = makeSim($("#att-sim"), {
    label: "Attention explorer. A sentence of words; arcs show how much the selected word attends to each earlier word. Below, the query and key vectors and the layer stack for the last word. Click a word to select it; click inside the circle to aim the query.",
    cams: { default: { x: -10, y: -6, w: 1220, h: 612 } },
    camsNarrow: { default: { x: -6, y: -8, w: 712, h: 1380 } },
    height: w => w < 640 ? Math.round(w * 1.94) : Math.round(Math.min(600, Math.max(400, w * 0.52))),
    init, step, draw, warmup: 1,
    intro: "\"it\" is selected. The arcs show which earlier words it pulls information from. Click other words, then change the last word.",
    controls: [
      { id: "word", label: "Last word", type: "choice", value: "tired", options: [["tired", "tired"], ["scared", "scared"], ["wide", "wide"]], help: "Was the animal too …, or the street?", apply: (s, v) => { if (s.adj !== v) { s.prevAtt = s.sel < LAST ? attend(s, s.head, s.sel).w.slice() : null; s.prevSel = s.sel; s.prevHead = s.head; s.changedAt = s.t; s.adj = v; if (s.qo && s.qo.i === LAST) s.qo = null; } } },
      { id: "head", label: "Attention head", type: "choice", value: "coref", options: [["coref", "Who is it"], ["prev", "Previous"], ["sink", "Start"]], help: "Each head looks for something different.", apply: (s, v) => { if (s.head !== v) s.qo = null; s.head = v; } },
      { id: "layers", label: "Layers in the model", type: "range", min: 1, max: 4, step: 1, value: 4, fmt: v => v + (v === 1 ? " layer" : " layers"), help: "Each layer: attention, then MLP, each adding to the stream.", apply: (s, v) => { s.layers = v; } },
      { id: "len", label: "Vector length", type: "range", min: 0.3, max: 2, step: 0.1, value: 1, fmt: v => "× " + v.toFixed(1), help: "Longer queries make the softmax pickier.", apply: (s, v) => { if (s.len !== v) s.lenAt = s.t; s.len = v; } }
    ],
    click: (s, wx, wy) => {
      const L = s.L; if (!L) return;
      const i = L.tok.findIndex(r => wx >= r.x - 4 && wx <= r.x + r.w + 4 && wy >= r.y - 6 && wy <= r.y + r.h + 6);
      if (i >= 0) { if (i !== s.sel) s.qo = null; s.sel = i; return; }
      const P = L.plot, dx = wx - P.cx, dy = P.cy - wy;
      if (Math.hypot(dx, dy) <= P.R * 1.05) { const A = attend(s, s.head, s.sel); const M = Math.max(Math.hypot(...A.q), ...A.ks.map(v => Math.hypot(...v)), 0.001) * 1.05, sc = P.R / M; s.qo = { i: s.sel, head: s.head, v: [dx / sc, dy / sc] }; s.qoAt = s.t; }
    },
    stats: s => { const a = attend(s, "coref", IT), b = attend(s, "coref", LAST), st = stack(s);
      return [["\"it\" looks at animal · street", pc(a.w[1]) + " · " + pc(a.w[5])],
        [`"${s.adj}" looks at animal · street`, pc(b.w[1]) + " · " + pc(b.w[5]), b.w[5] > b.w[1] ? "hot" : ""],
        ["the model reads \"it\" as", st.pS > 0.6 ? "street " + pc(st.pS) : st.pA > 0.6 ? "animal " + pc(st.pA) : "undecided", st.pS >= 0.8 ? "ok" : ""],
        ["layers", String(s.layers)]]; },
    goal: { text: "select the word where the model decides who \"it\" is, and change one word so it decides on the street (75% or more)", check: s => { const st = stack(s); return { done: s.met, progress: `selected "${words(s)[s.sel]}" · street ${pc(st.pS)}${s.qo ? " · hand-aimed query" : ""}` }; } },
    notices: [
      { id: "causal", when: s => s.t - s.changedAt < 4.5 && s.prevAtt && s.sel === s.prevSel && s.head === s.prevHead, say: s => { const a = attend(s, s.head, s.sel).w, same = a.every((x, j) => Math.abs(x - s.prevAtt[j]) < 1e-9), t = a.map((x, j) => [x, j]).filter(([, j]) => j !== s.sel).sort((x, y) => y[0] - x[0])[0]; return `You changed the last word, and "<b>${esc(words(s)[s.sel])}</b>" attends ${same ? "exactly as before" : "differently"} (${esc(words(s)[t[1]])} ${pc(t[0])}). A word never sees anything after it, so only the last word's attention can change. Click the last word.`; } },
      { id: "qo", when: s => s.qo && s.t - s.qoAt < 6, say: s => { const A = attend(s, s.head, s.sel), j = A.w.indexOf(Math.max(...A.w)); return `You aimed the query by hand. Its dot product with the key of "<b>${esc(words(s)[j])}</b>" is now the biggest (score ${A.sc[j].toFixed(2)}), so softmax gives it <b>${pc(A.w[j])}</b>. Keys that point the same way as the query win.`; } },
      { id: "len", when: s => s.t - s.lenAt < 4, say: s => { const A = attend(s, s.head, s.sel), m = Math.max(...A.w); return s.len > 1 ? `Longer vectors mean bigger dot products, and softmax of bigger numbers is pickier: the top word now gets <b>${pc(m)}</b>. Real models divide by √d to stop this getting out of hand.` : `Shorter vectors mean smaller scores, so softmax spreads attention more evenly: the top word gets only <b>${pc(m)}</b>.`; } },
      { id: "layers1", when: s => s.layers < 2, say: () => "With one layer, the \"who is it\" head (which sits in layer 2) doesn't exist. Nothing links \"it\" to a noun, so the odds are 50/50. Add a layer." },
      { id: "met", when: s => s.met && s.t - s.metAt < 7, say: s => { const b = attend(s, "coref", LAST); return `"<b>${esc(s.adj)}</b>" describes a place, so its query points along "place" and lines up with the key of "street" (${pc(b.w[5])}). Nothing before it changed: the meaning of "it" is settled here, at the deciding word.`; } },
      { id: "it", when: s => s.head === "coref" && s.sel === IT, say: s => { const a = attend(s, "coref", IT); return `At "it", the deciding word hasn't arrived yet. Its query points halfway between "living thing" and "place", so attention splits: animal <b>${pc(a.w[1])}</b>, street <b>${pc(a.w[5])}</b>. Now click the last word.`; } },
      { id: "coref", when: s => s.head === "coref", say: s => { const a = attend(s, "coref", s.sel), ws = words(s); if (s.sel === LAST) { const lv = ADJ[s.adj] === "living"; return `"<b>${esc(s.adj)}</b>" describes ${lv ? "living things" : "places"}, so its query points along "${lv ? "living thing" : "place"}" and matches the key of "${lv ? "animal" : "street"}" (<b>${pc(a.w[lv ? 1 : 5])}</b>). This is where the model settles who "it" is. Try another last word.`; } return `"${esc(ws[s.sel])}" isn't a pronoun or a describing word, so this head has nothing to look for: its query is empty and attention spreads evenly. Click "it" or the last word.`; } },
      { id: "head", when: s => s.head !== "coref", say: s => { const a = attend(s, s.head, s.sel), ws = words(s); if (s.head === "prev") return s.sel ? `This head's queries and keys are turned by position, like clock hands, so each word's query lines up with the key one step back: "<b>${esc(ws[s.sel - 1])}</b>" gets ${pc(a.w[s.sel - 1])}. It ignores meaning completely.` : "The first word has nothing before it, so it can only look at itself."; return `This head has nothing useful to fetch, so it parks its attention on the first word, "The" (<b>${pc(a.w[0])}</b>). Researchers call this an attention sink.`; } }
    ],
    facts: [
      { id: "sink", when: s => s.head === "sink", text: "Trained models pour a surprising share of attention onto the very first token, even when it means nothing. Researchers found that keeping those first few tokens in memory lets a model read streams of millions of tokens without breaking down.", ref: "#ref-61" },
      { id: "google", when: s => ADJ[s.adj] === "place", text: "This pair of sentences, \"too tired\" and \"too wide\", is the example Google used in 2017 to announce the Transformer, the design today's chatbots are built on.", ref: "#ref-57" }
    ],
    tour: [
      { say: "Start at \"it\". The model hasn't seen the last word yet, so its attention splits between \"animal\" and \"street\".", set: { head: "coref", word: "tired", layers: 4, len: 1 }, act: s => { s.sel = IT; s.qo = null; }, wait: 7 },
      { say: "Now the last word, \"tired\". Its query (amber) points along \"living thing\", the same way as the key of \"animal\". On the right, the stack reads \"it\" as the animal.", act: s => { s.sel = LAST; }, wait: 8 },
      { say: "Change it to \"wide\". The query swings to \"place\", \"street\" wins, and the stack now reads \"it\" as the street.", set: { word: "wide" }, wait: 8 },
      { say: "Back at \"it\": nothing changed. A word never sees what comes after it.", act: s => { s.sel = IT; }, wait: 6 },
      { say: "With one layer, the \"who is it\" head isn't there and the odds fall to 50/50. Understanding builds up layer by layer.", set: { layers: 1 }, act: s => { s.sel = LAST; }, wait: 7 },
      { say: "A head in layer 1 does something simpler: it looks one word back, using position alone.", set: { layers: 4, head: "prev" }, wait: 7 }
    ],
    publish: s => {
      const a = attend(s, "coref", IT), b = attend(s, "coref", LAST), st = stack(s), ws = words(s), A = attend(s, s.head, s.sel);
      const j = A.w.map((x, jj) => [x, jj]).filter(([, jj]) => jj !== s.sel).sort((x, y) => y[0] - x[0])[0];
      const jj = j ? j[1] : 0, q = A.q, kk = A.ks[jj];
      return { atItA: pc(a.w[1]), atItS: pc(a.w[5]), atAdj: s.adj, atAdjA: pc(b.w[1]), atAdjS: pc(b.w[5]), atRead: st.pS > 0.6 ? "the street" : st.pA > 0.6 ? "the animal" : "undecided", atOdd: pc(Math.max(st.pA, st.pS)), atLayers: String(s.layers),
        atSel: ws[s.sel], atTop: ws[jj], atQ: `(${q[0].toFixed(2)}, ${q[1].toFixed(2)})`, atK: `(${kk[0].toFixed(2)}, ${kk[1].toFixed(2)})`, atDot: (q[0] * kk[0] + q[1] * kk[1]).toFixed(2), atSc: A.sc[jj].toFixed(2), atW: pc(A.w[jj]), atN: String(s.sel + 1) };
    }
  });
});
