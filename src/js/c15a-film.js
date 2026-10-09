/* Chapter 15 film: the agent loop. The harness builds the context, calls the model, runs the tools it asks for,
   appends the results, compacts old output when space runs low, and reuses the cached prefix on every call.
   Token counts follow the chapter's scripted run (c15-harness.js) with a 12,000-token window. */
chapter("harness", () => {
  const fig = $("#ag-film"); if (!fig) return;
  const WIN = 12000, COMPACT_AT = 0.8;
  const items = [
    { who: "system", tok: 5000, text: "System prompt + tools: run_tests, read_file, edit_file" },
    { who: "user", tok: 40, text: "The checkout test is failing. Can you fix it?" },
    { who: "model", tok: 150, text: "run_tests()" },
    { who: "tool", tok: 1200, text: "FAILED test_checkout_total: expected 108.00, got 100.00", small: 120 },
    { who: "model", tok: 80, text: 'read_file("cart.py")' },
    { who: "tool", tok: 2500, text: "def total(items, tax_rate): return sum(i.price for i in items)", small: 120 },
    { who: "model", tok: 300, text: 'edit_file("cart.py", …)' },
    { who: "tool", tok: 30, text: "ok: 1 line changed" },
    { who: "model", tok: 60, text: "run_tests()" },
    { who: "tool", tok: 600, text: "42 passed in 3.1s" },
    { who: "final", tok: 120, text: "Fixed: total() now multiplies the subtotal by (1 + tax_rate). All 42 tests pass." }
  ];
  const term = [ // what the terminal prints for each tool call
    ["$ run_tests", "FAILED test_checkout_total", "  expected 108.00, got 100.00"],
    ["$ read_file cart.py", "def total(items, tax_rate):", "  return sum(i.price for i in items)"],
    ["$ edit_file cart.py", "ok: 1 line changed"],
    ["$ run_tests", "42 passed in 3.1s"]
  ];
  // the five model calls: input tokens and the part that is an unchanged prefix of the previous call
  const calls = [{ inp: 5040, cached: 0 }, { inp: 6390, cached: 5190 }, { inp: 8970, cached: 6470 }, { inp: 9300, cached: 9270 }, { inp: 6500, cached: 5190 }];
  const OUT = 150 + 80 + 300 + 60 + 120, IN = calls.reduce((a, c) => a + c.inp, 0), CACHED = calls.reduce((a, c) => a + c.cached, 0);
  const costRatio = (IN - CACHED + CACHED * 0.1 + OUT * 5) / (IN + OUT * 5);

  // ---- layout (world units) ----
  const USER = { x: 40, y: 200, w: 240, h: 220 }, HAR = { x: 340, y: 80, w: 720, h: 520 };
  const MODEL = { x: 1140, y: 150, w: 320, h: 170 }, TERM = { x: 1140, y: 370, w: 380, h: 230 };
  const BAR = { x: 370, y: 548, w: 660, h: 28 }, ROW = { x: 370, y: 124, h: 28, dy: 36, w: 660 };
  const PAN = { x: 340, y: 650, w: 720, h: 270 };
  const tokX = n => n / WIN * BAR.w;
  const colOf = (C, w) => ({ system: C.muted, user: C.ink, model: C.sig, final: C.sig, tool: C.amb }[w]);

  const steps = [
    { key: "task", short: "A task", title: "You give the agent a task", dur: 5,
      text: [`You ask for something that takes several actions: "The checkout test is failing. Can you fix it?" The model can't touch any files. The program around it, the harness, can.`,
             `The harness is ordinary software around the model. It owns the system prompt, the tools, permissions, sandboxing, retries, budgets and logging.`], link: "#ref-40" },
    { key: "build", short: "Build context", title: "The harness builds the context", dur: 6,
      text: [`The harness writes everything the model needs onto one page: its instructions, a description of each tool it may use, and your task. The bar shows how full that page is.`,
             `Context = system prompt + tool definitions (name, purpose, input schema) + the user message: about 5,040 tokens of a 12,000-token window in this example.`] },
    { key: "call", short: "Tool call", title: "The model asks for a tool; the harness runs it", dur: 7,
      text: [`The model reads the page and answers with a request: "run the tests". The harness runs them in a terminal and adds the result to the page.`,
             `The model emits a structured tool call instead of prose. The harness executes it, appends the output to the conversation and calls the model again.`] },
    { key: "loop", short: "Read and edit", title: "Round and round: read, then edit", dur: 7,
      text: [`Each time, the model sees everything so far and picks the next step: read the file, then fix the line. Every result goes onto the page, so it keeps filling.`,
             `Each model call re-sends the whole conversation, so total input over k steps grows roughly as k·c₀ + g·k(k−1)/2: quadratic in steps.`] },
    { key: "retest", short: "Re-run tests", title: "Check the fix by running the tests again", dur: 5,
      text: [`The model asks to run the tests again to make sure the fix worked. They pass, and the page is now nearly full.`,
             `After four tool calls the context holds 9,960 of 12,000 tokens, past the 80% threshold this harness uses to start compacting.`] },
    { key: "compact", short: "Compaction", title: "Old tool output gets summarised", dur: 6,
      text: [`To make room, the harness shrinks old tool output into short summaries. The model keeps the gist, and the page has space again.`,
             `Compaction replaces stale tool results with summaries (here 1,200 and 2,500 tokens become 120 each), bringing the context from 9,960 to 6,500 tokens.`], link: "#ref-41" },
    { key: "cache", short: "Prompt caching", title: "The unchanged start of the page is reused", dur: 7,
      text: [`Every call starts with the same text as the call before. The server keeps its work on that part (shaded) and only processes what's new, which makes each call cheaper and faster.`,
             `Prefix caching turns the repeated prefix into cheap cache reads: here ${CACHED.toLocaleString()} of ${IN.toLocaleString()} input tokens across five calls. Keeping stable content at the start of the prompt keeps it cached.`], link: "#ref-41" },
    { key: "done", short: "Done", title: "The task is done; the answer goes back", dur: 5.5,
      text: [`The model sees the tests pass and writes its final answer instead of another tool request. The harness hands it back to you.`,
             `The loop ends when the model returns a final message rather than a tool call, or when the harness hits a step, time or cost budget.`] }
  ];
  const cams = {
    default: { x: 20, y: 60, w: 1100, h: 560 },
    task: { x: 20, y: 40, w: 1300, h: 600 }, build: { x: 300, y: 30, w: 1230, h: 600 },
    call: { x: 20, y: 0, w: 1520, h: 640 }, loop: { x: 20, y: 0, w: 1520, h: 640 }, retest: { x: 20, y: 0, w: 1520, h: 640 },
    compact: { x: 320, y: 50, w: 1220, h: 590 }, cache: { x: 300, y: 0, w: 1240, h: 940 }, done: { x: 20, y: 0, w: 1520, h: 640 }
  };
  const pcams = {
    default: cams.default, task: { x: 30, y: 180, w: 1040, h: 440 }, build: { x: 340, y: 90, w: 740, h: 520 },
    call: { x: 340, y: 90, w: 1190, h: 520 }, loop: { x: 340, y: 90, w: 1190, h: 520 }, retest: { x: 340, y: 90, w: 1190, h: 520 },
    compact: { x: 340, y: 90, w: 740, h: 520 }, cache: { x: 330, y: 500, w: 750, h: 440 }, done: { x: 30, y: 90, w: 1060, h: 520 }
  };
  const HUDROWS = 3;
  function fitPhone(k, f) { if (k.W >= 640) return; const c = filmCam(pcams, f.segs, f.i, f.t), s = (k.W - 24) / c.w, hw = (62 + 17 * HUDROWS) / s; k.begin(k.H, { x: c.x, y: c.y - hw, w: c.w, h: c.h + hw }); }
  const hud = (k, title, rows) => k.W < 640 ? k.hud("tl", title, rows.slice(0, HUDROWS), { w: 230 }) : k.hud("tr", title, rows, { w: 240 });

  // ---- state as a function of time ----
  const CYC = { call: [[0, 0.04, 0.96]], loop: [[1, 0.03, 0.5], [2, 0.5, 0.97]], retest: [[3, 0.04, 0.96]] };
  function cycleNow(f) { const list = CYC[f.key]; if (!list) return null; for (const [c, a, b] of list) if (f.p >= a && f.p < b) return { c, q: (f.p - a) / (b - a) }; return null; }
  function state(f) {
    const at = f.at; let n = 0;
    if (at("build") > 0.2) n = 1; if (at("build") > 0.42) n = 2;
    const ord = ["call", "loop", "retest"]; let c = 0;
    // completed cycles before now
    ord.forEach(key => { if (at(key) >= 1) c += CYC[key].length; else if (at(key) > 0 && key === f.key) CYC[key].forEach(([ci, a, b]) => { if (f.p >= b) c++; }); });
    if (at("call") > 0) n = Math.max(n, 2 + 2 * c);
    const cur = cycleNow(f); if (cur && cur.q >= 0.46) n = Math.max(n, 3 + 2 * cur.c);
    if (at("done") > 0.32) n = 11;
    const cp = easeIO((at("compact") - 0.3) / 0.4);
    const toks = items.map((it, i) => it.small ? lerp(it.tok, it.small, cp) : it.tok);
    return { n, cp, toks, used: toks.slice(0, n).reduce((a, b) => a + b, 0), cur, c };
  }

  // ---- drawing helpers ----
  function fit(k, s, maxPx, size) { const c = k.ctx; c.save(); font(c, size, "--f-mono", "500"); let t = s; if (c.measureText(t).width > maxPx) { while (t.length > 1 && c.measureText(t + "…").width > maxPx) t = t.slice(0, -1); t += "…"; } c.restore(); return t; }
  function rowLabel(k, x, y, s, maxW, o = {}) { const size = o.size || 11; k.label(x, y, fit(k, s, maxW * k.scale, size), { align: "left", mono: true, size, col: o.col, alpha: o.alpha }); }
  function chip(k, x, y, s, col, o = {}) { // a message in flight
    const C = k.C, w = o.w || 170, h = 28;
    k.box(x - w / 2, y - h / 2, w, h, { fill: C.bg2, stroke: col, r: 8, glow: 12, glowCol: col, alpha: o.alpha });
    k.label(x, y, fit(k, s, (w - 12) * k.scale, 11), { mono: true, size: 11, col, alpha: o.alpha });
  }
  function travel(k, p0, p1, u, col, label, o = {}) {
    const mid = [(p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - (o.arc == null ? 40 : o.arc)];
    const path = s => bez([p0, [lerp(p0[0], mid[0], 0.7), mid[1]], [lerp(p1[0], mid[0], 0.7), mid[1]], p1], s);
    const e = easeIO(u), pts = []; for (let s = 8; s >= 0; s--) pts.push(path(Math.max(0, e - s * 0.025)));
    k.trail(pts, col, { w: 2.5, glow: 8 });
    const [x, y] = path(e); if (label) chip(k, x, y, label, col, o); else k.dot(x, y, 5, col, { glow: 10 });
  }
  const A = { userR: [USER.x + USER.w, USER.y + 110], harL: [HAR.x, USER.y + 110], harTR: [HAR.x + HAR.w, MODEL.y + 85], modL: [MODEL.x, MODEL.y + 85], harBR: [HAR.x + HAR.w, TERM.y + 115], termL: [TERM.x, TERM.y + 115] };

  function drawUser(k, f, st) {
    const C = k.C, U = USER, active = f.key === "task" || f.key === "done";
    k.box(U.x, U.y, U.w, U.h, { fill: C.bg2, stroke: active ? C.sig : C.line, r: 16 });
    k.dot(U.x + 50, U.y + 50, 18, C.muted); k.box(U.x + 22, U.y + 74, 56, 34, { fill: C.muted, r: 17 });
    k.label(U.x + 50, U.y + 128, "You", { col: active ? C.ink : C.muted, weight: "650" });
    const typed = f.key === "task" ? clamp01(f.p / 0.35) : 1, msg = items[1].text;
    k.box(U.x + 96, U.y + 26, 128, 84, { fill: C.line, r: 10, alpha: 0.7 });
    const words = msg.slice(0, Math.round(msg.length * typed)).split(" "); const lines = []; let cur = "";
    words.forEach(w => { if ((cur + " " + w).length > 15 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }); if (cur) lines.push(cur);
    lines.slice(0, 4).forEach((l, i) => k.text(U.x + 104, U.y + 42 + i * 18, l, { align: "left", size: 12.5, col: C.ink }));
    const ans = clamp01((f.at("done") - 0.72) / 0.2);
    if (ans > 0) { k.box(U.x + 10, U.y + 150, U.w - 20, 60, { fill: C.sig, r: 10, alpha: 0.2 * ans + 0.05, glow: 10 * ans, glowCol: C.sig }); k.text(U.x + 22, U.y + 170, "Fixed: total() now applies", { align: "left", size: 12.5, col: C.ink, alpha: ans }); k.text(U.x + 22, U.y + 190, "tax. All 42 tests pass.", { align: "left", size: 12.5, col: C.ink, alpha: ans }); }
  }
  function drawHarness(k, f, st) {
    const C = k.C, H = HAR;
    k.box(H.x, H.y, H.w, H.h, { fill: C.bg2, stroke: ["build", "compact"].includes(f.key) ? C.sig : C.line, r: 18, alpha: 0.95 });
    k.label(H.x + 30, H.y + 22, k.W < 640 ? "Harness" : "Harness · the context it sends", { align: "left", col: C.ink, weight: "650" });
    // message rows
    for (let i = 0; i < st.n; i++) {
      const it = items[i], y = ROW.y + i * ROW.dy, col = colOf(C, it.who);
      const born = i === st.n - 1 ? 1 : 1;
      const isComp = it.small && st.cp > 0.5, cached = f.key === "cache" && i < 3 ? clamp01((f.p - 0.05) / 0.2) : 0;
      k.box(ROW.x, y, ROW.w, ROW.h, { fill: C.bg, stroke: col, r: 7, alpha: isComp ? 0.45 : 0.9 * born, lw: 1 });
      if (cached > 0) k.box(ROW.x, y, ROW.w, ROW.h, { fill: C.sig, r: 7, alpha: 0.18 * cached });
      if (ROW.h * k.scale < 15) { k.box(ROW.x + 8, y + 9, (ROW.w - 16) * (isComp ? 0.25 : 0.35 + 0.6 * Math.min(1, st.toks[i] / 2500)), 10, { fill: col, r: 4, alpha: isComp ? 0.35 : 0.6 }); continue; }
      const tag = { system: "system", user: "user", model: "model →", tool: "result", final: "model" }[it.who];
      k.label(ROW.x + 12, y + ROW.h / 2, tag, { align: "left", size: 11, col, weight: "650", alpha: isComp ? 0.6 : 1 });
      const txt = isComp ? "[summary] " + (i === 3 ? "test_checkout_total failed: tax missing" : "cart.py: total() ignores tax_rate") : it.text;
      rowLabel(k, ROW.x + 12 + k.px(64), y + ROW.h / 2, txt, ROW.w - 24 - k.px(64) - k.px(52), { col: isComp ? C.muted : C.ink, alpha: isComp ? 0.8 : 1 });
      k.label(ROW.x + ROW.w - 12, y + ROW.h / 2, Math.round(st.toks[i]).toLocaleString(), { align: "right", mono: true, size: 11, col: isComp ? C.sig : C.muted });
    }
    // context bar
    const used = st.used, warn = used > WIN * COMPACT_AT && st.cp < 0.5;
    const narrowBar = BAR.w * k.scale < 300;
    if (!narrowBar) k.label(BAR.x, BAR.y, "Context window", { align: "left", col: C.muted, size: 11, dy: -10 });
    k.label(BAR.x + BAR.w, BAR.y, narrowBar ? `${Math.round(used).toLocaleString()} / ${WIN.toLocaleString()}` : `${Math.round(used).toLocaleString()} of ${WIN.toLocaleString()} tokens`, { align: "right", mono: true, size: 11, col: warn ? C.amb : C.ink, dy: -10 });
    k.box(BAR.x, BAR.y, BAR.w, BAR.h, { fill: C.bg, stroke: C.line, r: 6 });
    let x = BAR.x; for (let i = 0; i < st.n; i++) { const w = Math.max(2, tokX(st.toks[i])); k.box(x, BAR.y + 3, w - 1, BAR.h - 6, { fill: colOf(C, items[i].who), r: 3, alpha: items[i].small && st.cp > 0.5 ? 0.45 : 0.85 }); x += w; }
    if (f.key === "cache" || f.key === "done") { const cw = tokX(5190); const c = k.ctx; c.save(); c.beginPath(); c.rect(BAR.x, BAR.y, cw, BAR.h); c.clip(); c.strokeStyle = C.bg; c.globalAlpha = 0.55; c.lineWidth = k.px(2); for (let d = -BAR.h; d < cw; d += 9) { c.beginPath(); c.moveTo(BAR.x + d, BAR.y + BAR.h); c.lineTo(BAR.x + d + BAR.h, BAR.y); c.stroke(); } c.restore();
      k.label(BAR.x + cw / 2, BAR.y + BAR.h, "cached prefix", { col: C.sig, size: 11, dy: 11 }); }
    const tx = BAR.x + tokX(WIN * COMPACT_AT);
    k.line(tx, BAR.y - 4, tx, BAR.y + BAR.h + 4, { col: C.amb, dash: [3, 3], lw: 1.4, glow: warn ? 8 : 0 });
    if (f.key === "retest" || f.key === "compact") k.label(tx, BAR.y + BAR.h, "80%: summarise", { col: C.amb, size: 11, dy: 11 });
  }
  function drawModel(k, f, think) {
    const C = k.C, M = MODEL;
    k.box(M.x, M.y, M.w, M.h, { fill: C.bg2, stroke: think > 0 ? C.amb : C.line, r: 18, glow: 18 * think, glowCol: C.amb, lw: think > 0 ? 2 : 1.5 });
    k.text(M.x + M.w / 2, M.y + 70, "Model", { size: 24, weight: "650" });
    k.label(M.x + M.w / 2, M.y + 116, "text in → text out", { col: C.muted, size: 11 });
    if (think > 0) for (let j = 0; j < 7; j++) k.dot(M.x + 70 + j * 30, M.y + 140, 4, C.amb, { alpha: 0.3 + 0.7 * think * ((Math.sin(f.t * 9 + j) + 1) / 2) });
  }
  function drawTerm(k, f, st) {
    const C = k.C, T = TERM;
    const active = st.cur && st.cur.q > 0.5 && st.cur.q < 0.9;
    k.box(T.x, T.y, T.w, T.h, { fill: C.bg, stroke: active ? C.amb : C.line, r: 12, glow: active ? 10 : 0, glowCol: C.amb });
    k.box(T.x, T.y, T.w, 30, { fill: C.bg2, r: 12 }); [0, 1, 2].forEach(j => k.dot(T.x + 18 + j * 16, T.y + 15, 4, C.line));
    k.label(T.x + T.w / 2, T.y + 15, k.W < 640 ? "Terminal" : "Terminal · tools run here", { col: C.muted, size: 11 });
    // printed lines: all finished cycles, plus the current one typing out
    let lines = []; const done = Math.min(4, Math.max(0, Math.floor((st.n - 2) / 2)));
    for (let c = 0; c < done; c++) lines.push(...term[c].map(l => [l, 1]));
    if (st.cur && st.cur.q >= 0.58 && st.cur.c >= done) { const u = clamp01((st.cur.q - 0.58) / 0.16); term[st.cur.c].forEach((l, j) => { const a = clamp01(u * term[st.cur.c].length - j); if (a > 0) lines.push([l.slice(0, Math.ceil(l.length * a)), 1]); }); }
    lines = lines.slice(-7);
    lines.forEach(([l, a], j) => { const col = l.startsWith("$") ? C.sig : l.startsWith("FAILED") || l.startsWith("  expected") ? C.amb : l.includes("passed") ? C.sig : C.ink;
      if (24 * k.scale < 13) k.box(T.x + 16, T.y + 46 + j * 24, Math.min(T.w - 32, l.length * 9), 10, { fill: col, r: 4, alpha: 0.7 });
      else rowLabel(k, T.x + 16, T.y + 52 + j * 24, l, T.w - 30, { col, size: 11 }); });
  }
  function drawCycle(k, f, st) {
    const C = k.C, cur = st.cur; if (!cur) return 0; const q = cur.q, c = cur.c, call = items[2 + 2 * c];
    let think = 0;
    if (q < 0.18) { for (let j = 0; j < 4; j++) travel(k, A.harTR, A.modL, clamp01(q / 0.18 - j * 0.12) / (1 - 0.36) , C.sig, null, { arc: 30 }); }
    if (q >= 0.14 && q < 0.34) think = Math.sin(clamp01((q - 0.14) / 0.2) * Math.PI);
    if (q >= 0.32 && q < 0.46) travel(k, A.modL, A.harTR, (q - 0.32) / 0.14, C.sig, call.text, { arc: -30 });
    if (q >= 0.46 && q < 0.58) travel(k, A.harBR, A.termL, (q - 0.46) / 0.12, C.sig, call.text, { arc: 20 });
    if (q >= 0.74 && q < 0.88) travel(k, A.termL, A.harBR, (q - 0.74) / 0.14, C.amb, "result · " + items[3 + 2 * c].tok.toLocaleString() + " tok", { arc: -20, w: 180 });
    return think;
  }
  function drawPanel(k, f) {
    const C = k.C, P = PAN, a = clamp01(f.at("cache") / 0.15) * (1 - clamp01(f.at("done") / 0.2));
    if (a <= 0) return;
    k.box(P.x, P.y, P.w, P.h, { fill: C.bg2, stroke: f.key === "cache" ? C.sig : C.line, r: 16, alpha: a });
    k.label(P.x + 24, P.y + 22, f.narrow ? "Input per call" : "Input the model processes on each call", { align: "left", col: C.ink, weight: "650", alpha: a });
    const bx = P.x + 120, sc = tokX(1) * 0.8;
    calls.forEach((cl, j) => {
      const g = a * clamp01((f.at("cache") - 0.1 - j * 0.12) / 0.12); if (g <= 0) return;
      const y = P.y + 52 + j * 40, w = cl.inp * sc * easeOut(g), cw = Math.min(w, cl.cached * sc);
      k.label(P.x + 24, y + 12, `call ${j + 1}`, { align: "left", col: C.muted, size: 11, alpha: g });
      k.box(bx, y, w, 24, { fill: C.sig, r: 5, alpha: 0.9 * g });
      if (cw > 0) { k.box(bx, y, cw, 24, { fill: C.sig, r: 5, alpha: 0.25 * g }); k.box(bx, y, cw, 24, { fill: C.bg, r: 5, alpha: 0.55 * g }); k.box(bx, y, cw, 24, { stroke: C.sig, r: 5, alpha: 0.6 * g, lw: 1 }); }
      if (!f.narrow) k.label(bx + cl.inp * sc + 10, y + 12, `${cl.inp.toLocaleString()}${cl.cached ? " · " + cl.cached.toLocaleString() + " cached" : ""}`, { align: "left", mono: true, size: 11, col: C.muted, alpha: g });
    });
    const lg = a * clamp01((f.at("cache") - 0.75) / 0.15);
    if (lg > 0) { k.box(bx, P.y + P.h - 30, 18, 14, { fill: C.bg, stroke: C.sig, r: 3, alpha: lg }); k.label(bx + 26, P.y + P.h - 23, "reused from cache", { align: "left", size: 11, col: C.muted, alpha: lg });
      const lx2 = bx + Math.max(180, k.px(140)); k.box(lx2, P.y + P.h - 30, 18, 14, { fill: C.sig, r: 3, alpha: lg }); k.label(lx2 + 26, P.y + P.h - 23, "processed fresh", { align: "left", size: 11, col: C.muted, alpha: lg }); }
  }

  storyFilm(fig, {
    label: "Animated explanation of an agent loop: context, tool calls, compaction and prompt caching",
    steps, cams,
    draw(k, f) {
      const C = k.C; fitPhone(k, f);
      const st = state(f);
      drawPanel(k, f);
      drawUser(k, f, st); drawHarness(k, f, st); drawTerm(k, f, st);
      let think = drawCycle(k, f, st);
      // task: the message flies from you into the harness
      if (f.key === "task" && f.p > 0.4) travel(k, A.userR, A.harL, clamp01((f.p - 0.4) / 0.35), C.ink, "task: fix the test", { arc: 40, w: 200 });
      // build: the pieces drop into place, then the context heads for the model
      if (f.key === "build") {
        if (f.p < 0.25) chip(k, HAR.x + HAR.w / 2, ROW.y + 4 - 40 * (1 - easeOut(f.p / 0.25)) + 10, "system prompt + tool definitions", C.muted, { w: 280, alpha: clamp01(f.p / 0.1) });
        if (f.p > 0.85) for (let j = 0; j < 3; j++) travel(k, A.harTR, A.modL, clamp01((f.p - 0.85) / 0.15 - j * 0.2), C.sig, null, { arc: 30 });
      }
      // cache: the fifth call goes out; only the part after the cached prefix is new work
      if (f.key === "cache") { const q = clamp01((f.p - 0.05) / 0.4); if (q > 0 && q < 1) for (let j = 0; j < 4; j++) travel(k, A.harTR, A.modL, clamp01(q * 1.6 - j * 0.15), j < 3 ? C.muted : C.sig, null, { arc: 30 }); think = Math.max(think, Math.sin(clamp01((f.p - 0.35) / 0.3) * Math.PI)); }
      // done: final answer comes back and goes to you
      if (f.key === "done") {
        think = Math.max(think, Math.sin(clamp01(f.p / 0.2) * Math.PI));
        if (f.p > 0.18 && f.p < 0.34) travel(k, A.modL, A.harTR, (f.p - 0.18) / 0.16, C.sig, "final answer", { arc: -30 });
        if (f.p > 0.4 && f.p < 0.75) travel(k, A.harL, A.userR, (f.p - 0.4) / 0.35, C.sig, f.narrow ? "answer" : "Fixed. All 42 tests pass.", { arc: 40, w: f.narrow ? 100 : 210, alpha: 1 - clamp01((f.p - 0.68) / 0.07) });
      }
      drawModel(k, f, think);
      // flashing warning when the page crosses 80%
      if (f.key === "compact" && f.p < 0.3) { const a = (Math.sin(f.p * 40) + 1) / 2; k.box(BAR.x - 6, BAR.y - 6, BAR.w + 12, BAR.h + 12, { stroke: C.amb, r: 9, alpha: a, glow: 12, lw: 2 }); }
      // readouts
      const pct = Math.round(st.used / WIN * 100), callsSoFar = Math.min(5, st.c + (st.cur ? 1 : 0) + (f.at("cache") > 0.05 ? 1 : 0));
      if (f.key === "task") hud(k, "The request", [["from", "you"], ["tools available", "3"], ["context so far", "0 tokens"]]);
      else if (f.key === "cache") hud(k, "Five calls, one cache", [["input tokens", IN.toLocaleString()], ["read from cache", CACHED.toLocaleString(), C.sig], ["cost with caching", "≈ " + Math.round(costRatio * 100) + "%", C.sig], ["cache price (illustrative)", "10% of fresh"]]);
      else hud(k, "Context", [["in use", `${Math.round(st.used).toLocaleString()} tokens`, st.used > WIN * COMPACT_AT ? C.amb : C.ink], ["window", `${pct}% of ${WIN.toLocaleString()}`, st.used > WIN * COMPACT_AT ? C.amb : C.ink], ["model calls", String(callsSoFar)], ["summaries", st.cp > 0.5 ? "2" : "0", st.cp > 0.5 ? C.sig : C.muted]]);
    }
  });
});
