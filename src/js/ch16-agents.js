/* Chapter 16 · Agents. You are the harness: a coding task arrives, the model asks for tools, and your settings decide
   what goes into its 12,000-token context window. Token arithmetic follows the legacy chapter's scripted run
   (5,000-token system prompt, 1,200-token test output, ...). Cached input is billed at 10% of fresh input (ref 71).
   The model's chance of writing a correct fix is illustrative: high when the broken code is in view, lower with
   clutter, low when it has to guess. */
chapter("agents", () => {
  const WIN = 12000, BUDGET = 20000, SYS = 5000, CHUNK = 400, FILE = 1500, SUMM = 120, CACHE_R = 0.1, STREAK = 3;
  const CALL_T = 1.4, TOOL_T = 1.0, DONE_T = 2.4;
  const FILES = ["cart.py", "auth.py", "pricing.py", "dates.py", "mailer.py", "api.py"];
  const TASKS = [
    { ask: "The checkout test fails. Fix it.", file: 0, test: "test_checkout_total", fail: "expected 108.00, got 100.00", q: "checkout total tax" },
    { ask: "People with capital letters in their email can't log in.", file: 1, test: "test_login_case", fail: "Ana@x.com was rejected", q: "login email compare" },
    { ask: "Discount codes are being applied twice.", file: 2, test: "test_discount_once", fail: "expected 90.00, got 81.00", q: "apply discount code" },
    { ask: "Orders placed in Tokyo show tomorrow's date.", file: 3, test: "test_order_date", fail: "expected 1 March, got 2 March", q: "order date time zone" }
  ];
  const CENT = [[0.18, 0.28], [0.5, 0.2], [0.84, 0.3], [0.24, 0.74], [0.56, 0.7], [0.86, 0.76]];
  const CODE = "#8fb3ff";
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const pct = x => Math.round(x * 100) + "%";

  function init(rand) {
    const pts = [];
    FILES.forEach((f, fi) => { for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2 + rand() * 1.2, r = 0.06 + rand() * 0.05; pts.push({ fi, j, x: CENT[fi][0] + Math.cos(a) * r, y: CENT[fi][1] + Math.sin(a) * r * 1.1 }); } });
    const s = { t: 0, rand, pts, taskN: 0, history: [], streak: 0, best: 0, prevSig: [], log: [], fly: null, last: null, ev: {}, nid: 0 };
    newTask(s); return s;
  }
  const used = s => s.ctx.reduce((a, it) => a + it.tok, 0);
  const sig = it => it.id + ":" + it.tok;
  function add(s, kind, tok, label, extra = {}) { const it = { id: "i" + (s.nid++), kind, tok, full: tok, label, ...extra }; s.ctx.push(it); return it; }
  function logl(s, who, text, tok) { s.log.push({ who, text, tok }); if (s.log.length > 40) s.log.shift(); }

  function newTask(s) {
    const T = TASKS[s.taskN % TASKS.length]; s.taskN++;
    s.task = T; s.ctx = [{ id: "sys", kind: "sys", tok: SYS, full: SYS, label: "instructions + tool list" }];
    add(s, "user", 40, T.ask);
    s.stage = "tests1"; s.attempt = 0; s.phase = "call"; s.pt = 0; s.calls = []; s.billed = 0; s.noCache = 0; s.peak = used(s);
    s.fixOk = false; s.pLocked = null; s.req = ""; s.outcome = null; s.overBudget = false; s.compacted = 0; s.manual = 0; s.lostCode = false;
    s.log = []; logl(s, "user", T.ask);
    // where the search query lands in the index this time: near the broken chunk, but not always nearest
    const rel = s.pts.find(p => p.fi === T.file && p.j === 1), a = s.rand() * Math.PI * 2, r = Math.pow(s.rand(), 0.85) * 0.26;
    s.q = { x: rel.x + Math.cos(a) * r, y: rel.y + Math.sin(a) * r };
    rankChunks(s); startCall(s);
  }
  function rankChunks(s) {
    s.order = s.pts.map((p, i) => ({ i, d: Math.hypot(p.x - s.q.x, p.y - s.q.y) })).sort((a, b) => a.d - b.d).map(o => o.i);
    s.relIdx = s.pts.findIndex(p => p.fi === s.task.file && p.j === 1); s.rank = s.order.indexOf(s.relIdx) + 1;
  }
  const hasCode = s => s.ctx.some(it => it.rel && it.tok === it.full);
  function clutter(s) { let noise = 0, all = 0; s.ctx.forEach(it => { if (it.kind === "sys") return; all += it.tok; if ((it.kind === "chunk" || it.kind === "file") && !it.rel) noise += it.tok; }); return all ? noise / all : 0; }
  function pFix(s) { if (!hasCode(s)) return 0.1; return Math.max(0.3, 0.97 - 0.45 * clutter(s)); }

  // ---- one model call: the harness tidies the context, checks it fits, then the model reads it all ----
  function compact(s, target) {
    let u = used(s), n = 0, lastCall = -1; s.ctx.forEach((it, i) => { if (it.kind === "call") lastCall = i; });
    for (const it of s.ctx.slice(0, Math.max(0, lastCall))) { if (u <= target) break; if ((it.kind === "tool" || it.kind === "chunk" || it.kind === "file") && it.tok === it.full && it.full > SUMM) { if (it.rel && s.stage !== "final") s.lostCode = true; u -= it.tok - SUMM; it.tok = SUMM; n++; } }
    if (n) { s.compacted += n; s.ev.compact = s.t; logl(s, "harness", `summarised ${n} old output${n > 1 ? "s" : ""} to make room`); }
  }
  function startCall(s) {
    if (s.stage === "find" && s.mode === "none") s.stage = "edit";
    if (s.compactOn && used(s) > WIN * 0.8) compact(s, WIN * 0.6);
    const n = used(s); s.peak = Math.max(s.peak, n);
    if (n > WIN) { s.phase = "over"; s.pt = 0; s.outcome = "overflow"; s.ev.over = s.t; logl(s, "harness", `context is ${fmt(n)} tokens, over the ${fmt(WIN)} window: the call is rejected`); return; }
    let cached = 0;
    if (s.cacheOn) { for (let i = 0; i < s.ctx.length && i < s.prevSig.length; i++) { if (sig(s.ctx[i]) !== s.prevSig[i]) break; cached += s.ctx[i].tok; } }
    s.prevSig = s.ctx.map(sig);
    s.cur = { n, cached }; s.phase = "call"; s.pt = 0;
    if (s.stage === "edit") s.pLocked = pFix(s);
  }
  function endCall(s) {
    const T = s.task, st = s.stage, sk = s.mode;
    let out = 0, req = "", tool = null;
    if (st === "tests1") { out = 150; req = "run_tests()"; tool = "run"; }
    else if (st === "find") { out = 80; if (sk === "all") { req = "read_files(\"*\")"; tool = "read"; } else { req = `search_code("${s.attempt ? T.test : T.q}")`; tool = "search"; } }
    else if (st === "edit") { out = 300; req = `edit_file("${FILES[T.file]}")`; tool = "edit"; s.fixOk = s.rand() < s.pLocked; }
    else if (st === "tests2") { out = 60; req = "run_tests()"; tool = "run"; }
    else if (st === "final") { out = 120; req = s.fixOk ? "Fixed. All tests pass." : "I couldn't fix it."; }
    const { n, cached } = s.cur;
    s.calls.push({ n, cached, out }); s.billed += (n - cached) + cached * CACHE_R + out; s.noCache += n + out;
    if (s.billed > BUDGET && !s.overBudget) { s.overBudget = true; s.ev.budget = s.t; logl(s, "harness", `budget of ${fmt(BUDGET)} tokens used up`); }
    add(s, "call", out, req); s.req = req; logl(s, "model", (tool ? "→ " : "") + req, out);
    if (!tool) { s.phase = "done"; s.pt = 0; s.outcome = s.fixOk ? (s.overBudget ? "budget" : "fixed") : "gaveup"; return; }
    s.tool = tool; s.phase = "tool"; s.pt = 0;
  }
  function endTool(s) {
    const T = s.task, st = s.stage;
    if (st === "tests1") { add(s, "tool", 1200, "test output", { test: true }); logl(s, "tool", `FAILED ${T.test}: ${T.fail}`, 1200); s.stage = s.mode === "none" ? "edit" : "find"; }
    else if (st === "find") {
      if (s.mode === "all") { FILES.forEach((f, i) => add(s, "file", FILE, f, { rel: i === T.file })); logl(s, "tool", `6 whole files, ${fmt(6 * FILE)} tokens`, 6 * FILE); }
      else {
        if (s.attempt) { s.q = { x: s.pts[s.relIdx].x + 0.01, y: s.pts[s.relIdx].y + 0.01 }; rankChunks(s); }
        const k = s.k, top = s.order.slice(0, k); top.forEach(i => { const p = s.pts[i]; add(s, "chunk", CHUNK, FILES[p.fi] + " part " + (p.j + 1), { rel: i === s.relIdx }); });
        const hit = top.includes(s.relIdx); s.lastHit = hit; s.lastRank = s.rank;
        logl(s, "tool", `${k} best match${k > 1 ? "es" : ""} (${fmt(k * CHUNK)} tokens)${hit ? `, broken code is #${s.rank}` : ", broken code not among them"}`, k * CHUNK);
      }
      s.stage = "edit";
    }
    else if (st === "edit") { add(s, "tool", 30, "ok: 1 line changed"); logl(s, "tool", "ok: 1 line changed", 30); s.stage = "tests2"; }
    else if (st === "tests2") {
      if (s.fixOk) { add(s, "tool", 600, "tests pass", { test: true }); logl(s, "tool", "all 42 tests pass", 600); s.stage = "final"; }
      else { add(s, "tool", 1200, "test output", { test: true }); logl(s, "tool", `FAILED again: ${T.fail}`, 1200); s.attempt++; s.stage = s.attempt >= 2 ? "final" : (s.mode === "none" ? "edit" : "find"); }
    }
    startCall(s);
  }
  function finish(s) {
    const o = s.outcome; s.history.push(o); if (s.history.length > 14) s.history.shift();
    s.streak = o === "fixed" ? s.streak + 1 : 0; s.best = Math.max(s.best, s.streak);
    s.last = { outcome: o, calls: s.calls.slice(), billed: s.billed, noCache: s.noCache, peak: s.peak, compacted: s.compacted, mode: s.mode, k: s.k, hit: s.lastHit, rank: s.lastRank, lostCode: s.lostCode, p: s.pLocked, cacheOn: s.cacheOn };
    if (o === "fixed") s.ev.fixed = s.t;
    newTask(s);
  }
  function step(s, dt) {
    s.t += dt; s.pt += dt;
    if (s.phase === "call" && s.pt >= CALL_T) endCall(s);
    else if (s.phase === "tool" && s.pt >= TOOL_T) endTool(s);
    else if ((s.phase === "done" || s.phase === "over") && s.pt >= DONE_T) finish(s);
  }

  // ---------- layout (world units; labels are fixed-size screen text, so offsets use k.px) ----------
  function L(narrow) {
    if (!narrow) return { narrow, task: { x: 0, y: 0, w: 430, h: 104 }, log: { x: 0, y: 118, w: 430, h: 382 }, model: { x: 462, y: 0, w: 270, h: 126 }, gauge: { x: 462, y: 160, w: 270 },
      tools: { x: 764, y: 0, w: 536, rh: 50 }, index: { x: 764, y: 236, w: 536, h: 264 }, bar: { x: 0, y: 590, h: 60, ww: 1060, maxX: 1300 } };
    return { narrow, task: null, log: null, model: { x: 0, y: 0, w: 280, h: 156 }, gauge: { x: 0, y: 196, w: 280 },
      tools: { x: 304, y: 0, w: 296, rh: 62 }, index: { x: 0, y: 360, w: 600, h: 200 }, bar: { x: 0, y: 640, h: 58, ww: 470, maxX: 600 } };
  }
  const TOOLS = [["run", "run_tests", "runs the tests"], ["search", "search_code", "finds the chunks nearest a query"], ["read", "read_files", "returns whole files"], ["edit", "edit_file", "changes a line"]];
  const kindCol = (C, it) => ({ sys: C.muted, user: C.ink, call: C.sig, tool: C.amb, chunk: CODE, file: CODE }[it.kind]);
  const cut = (t, n) => t.length > n ? t.slice(0, Math.max(1, n - 1)) + "…" : t;
  function barGeom(s, lay) { const B = lay.bar, sc = B.ww / WIN; let x = B.x; return s.ctx.map(it => { const g = { it, x, w: it.tok * sc }; x += it.tok * sc; return g; }); }

  function draw(k, s, sim) {
    const C = k.C, lay = L(sim.narrow); s.narrow = sim.narrow; const nar = sim.narrow, B = lay.bar, P = k.px;
    // ---- task card + history ----
    if (lay.task) {
      const T = lay.task; k.box(T.x, T.y, T.w, T.h, { fill: C.bg2, stroke: C.line, r: 14 });
      k.label(T.x + 16, T.y + P(18), `Task ${s.taskN}`, { align: "left", col: C.muted, size: 12, weight: "600" });
      k.label(T.x + 16, T.y + P(40), cut(`"${s.task.ask}"`, Math.floor((T.w - 32) * k.scale / 7.4)), { align: "left", col: C.ink, size: 13, weight: "600" });
      k.label(T.x + 16, T.y + P(62), "Last tasks", { align: "left", col: C.muted, size: 12 });
      s.history.forEach((o, i) => { const col = o === "fixed" ? C.ok : o === "budget" ? C.amb : C.crit; k.dot(T.x + 16 + P(80 + i * 16), T.y + P(62), P(5), col); });
      if (!s.history.length) k.label(T.x + 16 + P(80), T.y + P(62), "none yet", { align: "left", col: C.muted, size: 12 });
      // log (terminal)
      const G = lay.log; k.box(G.x, G.y, G.w, G.h, { fill: C.bg2, stroke: C.line, r: 14, alpha: 0.9 });
      k.label(G.x + 16, G.y + P(18), "What the harness sees", { align: "left", col: C.muted, size: 12, weight: "600" });
      const lh = P(17), col = { user: C.ink, model: C.sig, tool: C.amb, harness: C.crit }, chars = Math.max(12, Math.floor((G.w * k.scale - 32 - 58) / 7.3));
      const lines = []; s.log.forEach(r => { const words = r.text.split(" "); let cur = "", first = true; const push = () => { lines.push({ who: first ? r.who : null, c: r.who, t: cur }); first = false; cur = ""; };
        words.forEach(w => { if ((cur + " " + w).trim().length > chars && cur) push(); cur = (cur ? cur + " " : "") + w; }); if (cur) push(); lines.push(null); });
      const maxL = Math.floor((G.h - P(40)) / lh), view = lines.slice(-maxL - 1, -1);
      view.forEach((r, i) => { if (!r) return; const y = G.y + P(42) + i * lh; const who = { user: "you", model: "model", tool: "tool", harness: "harness" }[r.who];
        if (who) k.label(G.x + 14, y, who, { align: "left", col: col[r.c], size: 11, weight: "600", mono: true });
        k.label(G.x + 14, y, cut(r.t, chars + 2), { align: "left", col: r.c === "harness" ? C.crit : C.ink, size: 12, mono: true, dx: 58 }); });
    }
    // ---- model ----
    const M = lay.model, thinking = s.phase === "call";
    k.box(M.x, M.y, M.w, M.h, { fill: C.bg2, stroke: thinking ? C.amb : C.line, r: 18, lw: thinking ? 2.5 : 1.5, glow: thinking ? 22 : 0, glowCol: C.amb });
    k.label(M.x + M.w / 2, M.y + P(22), "Model", { col: C.ink, size: 16, weight: "650" });
    const sub = s.phase === "call" ? `reading ${fmt(s.cur.n)} tokens` : s.phase === "over" ? "call rejected: too long" : s.phase === "done" ? (s.outcome === "fixed" ? "done: fixed" : s.outcome === "budget" ? "fixed, over budget" : "gave up") : "waiting for the tool";
    k.label(M.x + M.w / 2, M.y + P(46), sub, { col: s.phase === "over" || s.outcome === "gaveup" && s.phase === "done" ? C.crit : C.muted, size: 12 });
    if (s.phase === "call" && s.cur.cached) k.label(M.x + M.w / 2, M.y + P(64), `${fmt(s.cur.cached)} of them cached`, { col: C.sig, size: 12 });
    if (s.req && s.phase !== "call") k.label(M.x + M.w / 2, M.y + M.h - P(20), cut(s.req, Math.floor(M.w * k.scale / 7.6)), { col: C.sig, size: 12, mono: true, bg: true });
    // ---- tools ----
    const TL = lay.tools;
    TOOLS.forEach(([id, name, what], i) => {
      const y = TL.y + i * (TL.rh + 8), act = s.phase === "tool" && s.tool === id, avail = !(id === "search" && s.mode !== "search") && !(id === "read" && s.mode !== "all");
      k.box(TL.x, y, TL.w, TL.rh, { fill: C.bg2, stroke: act ? C.amb : C.line, r: 12, lw: act ? 2.5 : 1.2, glow: act ? 16 : 0, glowCol: C.amb, alpha: avail ? 1 : 0.45 });
      k.label(TL.x + 14, y + TL.rh / 2, name, { align: "left", col: act ? C.amb : C.ink, size: 13, mono: true, weight: "600", alpha: avail ? 1 : 0.5 });
      if (!nar) k.label(TL.x + 14, y + TL.rh / 2, avail ? what : "not offered", { align: "left", col: C.muted, size: 12, alpha: avail ? 1 : 0.7, dx: 112 });
      if (act) { const ph = s.pt / TOOL_T; const path = u => bez([[M.x + M.w, M.y + M.h / 2], [M.x + M.w + 30, M.y + M.h / 2], [TL.x - 30, y + TL.rh / 2], [TL.x, y + TL.rh / 2]], u); k.flow(path, 3, ph, C.amb, { size: 3 }); }
    });
    // ---- search index ----
    const I = lay.index, useIdx = s.mode === "search";
    k.box(I.x, I.y, I.w, I.h, { fill: C.bg2, stroke: C.line, r: 14, alpha: useIdx ? 1 : 0.5 });
    k.label(I.x + 14, I.y + P(16), "Search index: similar code sits close", { align: "left", col: useIdx ? C.ink : C.muted, size: 12, weight: "600" });
    const px = p => I.x + 30 + p.x * (I.w - 60), py = p => I.y + P(30) + 10 + p.y * (I.h - P(30) - 30);
    if (useIdx) {
      const showQ = s.stage !== "tests1" || s.phase === "tool", top = s.order.slice(0, s.k);
      if (showQ) top.forEach(i => k.line(px(s.q), py(s.q), px(s.pts[i]), py(s.pts[i]), { col: C.sig, alpha: 0.6, lw: 1.5 }));
      s.pts.forEach((p, i) => { const inTop = showQ && top.includes(i), rel = i === s.relIdx; if (rel) k.dot(px(p), py(p), P(11), C.ok, { alpha: 0.3 }); k.dot(px(p), py(p), P(rel ? 6 : 4.5), inTop ? CODE : C.muted, { alpha: inTop ? 1 : 0.6, glow: inTop ? 8 : 0 }); });
      if (!nar) CENT.forEach((c, fi) => { if (fi !== s.task.file) k.label(px({ x: c[0] }), py({ y: c[1] }) + P(22), FILES[fi], { col: C.muted, size: 11, mono: true, alpha: 0.8 }); });
      const relp = s.pts[s.relIdx]; k.label(px(relp), py(relp) - P(16), (nar ? "" : FILES[s.task.file] + ": ") + "the bug", { col: C.ok, size: 11, weight: "600", bg: true });
      if (showQ) { k.dot(px(s.q), py(s.q), P(5.5), C.sig, { glow: 14 }); k.label(px(s.q), py(s.q) + P(16), "query", { col: C.sig, size: 11, weight: "600", bg: true }); }
    } else k.label(I.x + I.w / 2, I.y + I.h / 2 + P(8), s.mode === "all" ? "Not used: every file is pasted instead" : "Not used: the model sees no code", { col: C.muted, size: 12 });
    // ---- chance gauge (illustrative) ----
    const Gg = lay.gauge, p = s.phase === "call" && s.stage === "edit" ? s.pLocked : pFix(s);
    k.label(Gg.x, Gg.y, nar ? "Fix chance" : "Chance the fix works",{ align: "left", col: C.muted, size: 12, weight: "600" });
    k.label(Gg.x + Gg.w, Gg.y, pct(p), { align: "right", col: C.ink, size: 13, weight: "650", mono: true });
    k.box(Gg.x, Gg.y + P(12), Gg.w, P(12), { fill: C.line, r: 6, alpha: 0.6 });
    k.box(Gg.x, Gg.y + P(12), Gg.w * p, P(12), { fill: p > 0.75 ? C.ok : p > 0.4 ? C.amb : C.crit, r: 6 });
    k.label(Gg.x, Gg.y + P(40), `Broken code in view: ${hasCode(s) ? "yes" : "no"}`, { align: "left", col: hasCode(s) ? C.ok : C.crit, size: 12 });
    k.label(Gg.x, Gg.y + P(58), `Unrelated code: ${pct(clutter(s))}`, { align: "left", col: C.muted, size: 12 });
    if (!nar) k.label(Gg.x, Gg.y + P(76), "(illustrative)", { align: "left", col: C.muted, size: 11, alpha: 0.8 });
    // ---- context window bar ----
    const n = used(s), geo = barGeom(s, lay), winX = B.x + B.ww;
    k.label(B.x, B.y - P(30), nar ? "Context window" : "Context window: what the model reads on every call. Click a block to summarise it.", { align: "left", col: C.ink, size: 13, weight: "600" });
    k.label(B.maxX, B.y - P(30), `${fmt(n)} / ${fmt(WIN)}`, { align: "right", col: n > WIN ? C.crit : n > WIN * 0.8 ? C.amb : C.ink, size: 13, weight: "650", mono: true });
    k.box(B.x, B.y, B.ww, B.h, { fill: C.line, r: 8, alpha: 0.25 });
    k.ctx.save(); k.ctx.beginPath(); k.ctx.rect(B.x - 4, B.y - 6, B.maxX - B.x + 4, B.h + 12); k.ctx.clip();
    geo.forEach(g => { const it = g.it, sm = it.tok !== it.full;
      k.box(g.x + 0.5, B.y, Math.max(1.5, g.w - 1.5), B.h, { fill: kindCol(C, it), r: 4, alpha: sm ? 0.3 : g.x > winX ? 0.5 : 0.9 });
      if (it.rel && !sm) k.box(g.x - 1, B.y - 3, g.w + 1, B.h + 6, { stroke: C.ok, r: 5, lw: 2.5 });
      const name = it.kind === "sys" ? (nar ? "instructions" : "instructions + tools") : it.kind === "user" ? "task" : it.kind === "call" ? "" : it.kind === "chunk" ? it.label.split(" ")[0] : it.label;
      if (name && !sm && g.w * k.scale > name.length * 6.4 + 8) k.label(g.x + g.w / 2, B.y + B.h / 2, name, { col: C.bg, size: 11, weight: "650" });
    });
    k.ctx.restore();
    if (n * B.ww / WIN > B.maxX - B.x) k.label(B.maxX, B.y + B.h + P(14), "more →", { align: "right", col: C.crit, size: 11, weight: "600" });
    k.line(winX, B.y - P(10), winX, B.y + B.h + P(10), { col: C.crit, lw: 2, dash: [5, 4] });
    k.label(winX, B.y + B.h + P(22), "limit", { col: C.crit, size: 11 });
    if (s.phase === "call" && s.cur.cached > 0) { const cx = B.x + s.cur.cached * B.ww / WIN; k.line(B.x, B.y - P(7), cx, B.y - P(7), { col: C.sig, lw: 3, glow: 8 }); }
    const rg = geo.find(g => g.it.rel && g.it.tok === g.it.full); if (rg) k.label(rg.x + rg.w / 2, B.y + B.h + P(12), "the bug", { col: C.ok, size: 11, weight: "600" });
    if (!nar) { const lg = [["instructions", C.muted], ["task", C.ink], ["model's requests", C.sig], ["tool output", C.amb], ["code", CODE], ["summarised", C.line], ["cached part", C.sig]]; let x = B.x; const y = B.y + B.h + P(42);
      lg.forEach(([t, c], i) => { if (i === 6) k.line(x, y, x + P(14), y, { col: c, lw: 3 }); else k.box(x, y - P(6), P(12), P(12), { fill: c, r: 3, alpha: i === 5 ? 0.6 : 1 }); k.label(x, y, t, { align: "left", col: C.muted, size: 11, dx: 18 }); x += P(30 + t.length * 6.2); }); }
    // flows: context -> model while reading; result card tool -> context
    if (s.phase === "call") { const mid = B.x + Math.min(n, WIN) * B.ww / WIN * 0.55; const path = u => bez([[mid, B.y], [mid, B.y - 140], [M.x + M.w / 2, M.y + M.h + 140], [M.x + M.w / 2, M.y + M.h]], u); k.flow(path, 6, s.pt / CALL_T * 1.5, C.sig, { size: 3 }); }
    if (s.phase === "tool") { const ti = TOOLS.findIndex(t => t[0] === s.tool), y = TL.y + ti * (TL.rh + 8) + TL.rh / 2, ex = Math.min(B.maxX - 30, B.x + n * B.ww / WIN + 30), u = easeIO(s.pt / TOOL_T);
      const [fx, fy] = bez([[TL.x, y], [TL.x - 80, y + 160], [ex + 40, B.y - 180], [ex, B.y - 10]], u); k.box(fx - P(20), fy - P(9), P(40), P(18), { fill: C.amb, r: 5, alpha: 0.95, glow: 12 }); }
    if (nar) { const last = s.log[s.log.length - 1]; if (last) k.label(B.x, B.y + B.h + P(30), cut((last.who === "harness" ? "harness: " : last.who + ": ") + last.text, Math.floor(600 * k.scale / 7.3)), { align: "left", col: last.who === "harness" ? C.crit : C.ink, size: 12, mono: true }); }
  }
  const over = s => used(s) > WIN;

  function click(s, wx, wy) {
    const lay = L(s.narrow), B = lay.bar; if (wy < B.y - 6 || wy > B.y + B.h + 6) return;
    const g = barGeom(s, lay).find(g => wx >= g.x && wx <= g.x + g.w); if (!g) return; const it = g.it;
    if (!(it.kind === "tool" || it.kind === "chunk" || it.kind === "file")) { s.ev.clickFixed = s.t; s.clickWhat = it.kind; return; }
    if (it.tok !== it.full) return;
    if (it.rel && (s.stage === "edit" || s.stage === "find")) s.lostCode = true;
    it.tok = Math.min(SUMM, it.tok); s.manual++; s.ev.manual = s.t; s.manualWhat = it; logl(s, "harness", `you summarised ${it.label} (${fmt(it.full)} → ${fmt(it.tok)})`);
  }

  const lastOr = (s, key, d) => s.last ? s.last[key] : d;
  makeSim($("#agent-sim"), {
    label: "Agent harness simulation. A coding task arrives; the model asks for tools; the bar at the bottom is the context window the model reads on every call. Click a block in the bar to summarise it.",
    cams: { default: { x: -10, y: -10, w: 1320, h: 720 } },
    camsNarrow: { default: { x: -6, y: -6, w: 612, h: 770 } },
    height: w => w < 640 ? Math.round(w * 1.3) : Math.round(Math.min(660, Math.max(420, w * 0.58))),
    init, warmup: 2, speeds: [1, 3],
    intro: "A bug report arrives. The model asks for tools; the harness runs them and pastes the results into the context window at the bottom. Press <b>Run</b> if nothing moves.",
    controls: [
      { id: "mode", label: "How the model gets to see the code", type: "choice", value: "all", options: [["none", "Nothing"], ["all", "All files"], ["search", "Search"]], help: "Search finds the chunks of code that best match a query and pastes only those.", apply: (s, v) => { s.mode = v; } },
      { id: "k", label: "Search results to paste in", type: "range", min: 1, max: 10, step: 1, value: 3, fmt: v => v + (v === 1 ? " chunk" : " chunks") + " · " + fmt(v * CHUNK) + " tokens", help: "Only used by Search.", apply: (s, v) => { s.k = v; } },
      { id: "compact", label: "Summarise old tool output when the window is 80% full", type: "toggle", value: false, apply: (s, v) => { s.compactOn = v; } },
      { id: "cache", label: "Prompt caching", type: "toggle", value: false, help: "Reuse the server's work on the unchanged start of the context; cached tokens are billed at a tenth.", apply: (s, v) => { s.cacheOn = v; } }
    ],
    step, draw, click,
    stats: s => { const n = used(s); return [
      ["context now", fmt(n) + " / " + fmt(WIN), n > WIN ? "bad" : n > WIN * 0.8 ? "hot" : ""],
      ["billed this task", fmt(s.billed) + " / " + fmt(BUDGET), s.billed > BUDGET ? "bad" : s.billed > BUDGET * 0.8 ? "hot" : ""],
      ["read from cache", s.calls.length ? pct(s.calls.reduce((a, c) => a + c.cached, 0) / Math.max(1, s.calls.reduce((a, c) => a + c.n, 0))) : "–", ""],
      ["chance the fix works", pct(pFix(s)), pFix(s) > 0.75 ? "ok" : pFix(s) < 0.4 ? "bad" : "hot"],
      ["fixed in a row", String(s.streak), s.streak >= STREAK ? "ok" : ""]]; },
    goal: { text: `fix ${STREAK} tasks in a row, each inside the ${fmt(WIN)}-token window and under ${fmt(BUDGET)} billed tokens`, check: s => ({ done: s.best >= STREAK, progress: `${Math.min(s.streak, STREAK)} / ${STREAK} in a row` }) },
    notices: [
      { id: "over", when: s => s.phase === "over", say: s => `The context reached <b>${fmt(used(s))} tokens</b>, past the ${fmt(WIN)}-token window, so the model call was rejected and the task failed. ${s.mode === "all" ? `Pasting every file added ${fmt(6 * FILE)} tokens at once. Try <b>Search</b>.` : s.compactOn ? "Even summarising couldn't free enough room." : "Turn on summarising so old output shrinks before it overflows."}` },
      { id: "lost", when: s => s.lostCode && (s.stage === "edit" || s.stage === "tests2") && !hasCode(s), say: s => `Summarising made room, but it also squashed the broken code into a one-line summary. The model now has to guess the fix: <b>${pct(pFix(s))}</b> chance. Summaries keep the gist and lose the details.` },
      { id: "budget", when: s => s.overBudget && !s.cacheOn, say: s => `This task has billed <b>${fmt(s.billed)}</b> tokens, over the ${fmt(BUDGET)} budget. Every call re-reads the whole context from scratch, and the start never changes. Turn on <b>prompt caching</b>.` },
      { id: "miss", when: s => s.mode === "search" && s.lastHit === false && s.stage !== "find" && s.attempt === 0 && !hasCode(s), say: s => `The search's closest match to the broken code was result <b>#${s.lastRank}</b>, but you paste only ${s.k}. The model never saw the broken line, so it has a ${pct(pFix(s))} chance of guessing right. It will search again with the test's name if this fails.` },
      { id: "none", when: s => s.mode === "none" && s.stage !== "tests1", say: s => `With no code in its context, the model can only guess what the file looks like: <b>${pct(pFix(s))}</b> chance its edit works. A model can't use what isn't on the page.` },
      { id: "clutter", when: s => s.mode === "search" && s.k >= 7 && hasCode(s), say: s => `${s.k} results put ${fmt((s.k - 1) * CHUNK)} tokens of unrelated code next to the broken chunk. The model still has what it needs, but the clutter lowers its chance to ${pct(pFix(s))}, and every later call re-reads those tokens.` },
      { id: "manual", when: s => s.ev.manual && s.t - s.ev.manual < 4, say: s => { const it = s.manualWhat; return it.rel ? `You summarised <b>${it.label}</b>, the code with the bug in it. It now takes ${SUMM} tokens, but the model can no longer see the exact line: ${pct(pFix(s))} chance.` : `You summarised <b>${it.label}</b>: ${fmt(it.full)} tokens became ${SUMM}. Less to re-read on every call. The cache now breaks at that point, so the next call pays full price from there on.`; } },
      { id: "clickFixed", when: s => s.ev.clickFixed && s.t - s.ev.clickFixed < 3, say: s => s.clickWhat === "sys" ? "That's the system prompt: instructions and tool descriptions the model needs on every call. The harness never summarises it." : "Your task and the model's own requests are short and needed; only tool output can be summarised." },
      { id: "fixed", when: s => s.last && s.last.outcome === "fixed" && s.phase !== "over", say: s => { const L = s.last; return `Fixed in ${L.calls.length} calls. The context peaked at ${fmt(L.peak)} of ${fmt(WIN)} tokens, and the task billed <b>${fmt(L.billed)}</b> tokens${L.cacheOn ? ` instead of ${fmt(L.noCache)} without caching` : ""}.`; } },
      { id: "calm", when: () => true, say: s => `Each call, the model reads the whole context, ${fmt(used(s))} tokens now, and asks for one tool. The harness runs it and adds the result. Watch the bar grow.` }
    ],
    facts: [
      { id: "swe", when: s => s.last && s.last.outcome === "fixed", text: "When SWE-bench, a test made of 2,294 real bug reports from open-source Python projects, came out in 2023, the best model solved under 2% of them. Agent harnesses that let models run tests and edit files are a big part of why scores have climbed since.", ref: "#ref-1602" },
      { id: "middle", when: s => used(s) > 9000 && s.ctx.some(it => it.kind === "chunk" || it.kind === "file"), text: "Researchers found that models use information at the start or end of a long context more reliably than information buried in the middle, one reason harnesses paste a few good results rather than everything.", ref: "#ref-1603" }
    ],
    tour: [
      { say: "This harness pastes every file into the context. Watch the bar: the files alone are 9,000 tokens, and the window is 12,000.", set: { mode: "all", compact: false, cache: false, k: 3 }, act: s => { newTask(s); }, until: s => s.phase === "over", min: 7, max: 14 },
      { say: "Switch to <b>search</b>. The code is cut into chunks, each stored as a point; the harness pastes only the 3 chunks nearest the model's query (right).", set: { mode: "search" }, act: s => { newTask(s); }, until: s => s.stage === "edit" && s.phase === "call", min: 6, max: 12 },
      { say: "Each call re-reads everything, so the bill grows fast. Turn on <b>prompt caching</b>: the unchanged start (teal line above the bar) is billed at a tenth.", set: { cache: true }, wait: 9 },
      { say: "Paste 10 results instead of 3: the broken code is almost certainly there, but so is a lot of clutter. Watch the chance gauge.", set: { k: 10 }, act: s => { newTask(s); }, until: s => s.stage === "edit" && s.phase === "call", min: 8, max: 14 },
      { say: "With summarising on, the harness shrinks old tool output once the window is 80% full. Back to 3 results: now try to fix 3 tasks in a row.", set: { compact: true, k: 3 }, wait: 8 }
    ],
    publish: s => { const L = s.last; if (!L) return { agPeak: fmt(s.peak), agBilled: fmt(s.billed), agNoCache: fmt(s.noCache), agCalls: String(s.calls.length), agList: s.calls.map(c => fmt(c.n)).join(" + ") || "–", agIn: fmt(s.calls.reduce((a, c) => a + c.n, 0)), agCached: fmt(s.calls.reduce((a, c) => a + c.cached, 0)), agFresh: fmt(s.calls.reduce((a, c) => a + c.n - c.cached, 0)), agOut: fmt(s.calls.reduce((a, c) => a + c.out, 0)), agCachedTenth: fmt(s.calls.reduce((a, c) => a + c.cached, 0) * CACHE_R), agP: pct(pFix(s)), agK: String(s.k) };
      const tin = L.calls.reduce((a, c) => a + c.n, 0), tc = L.calls.reduce((a, c) => a + c.cached, 0), to = L.calls.reduce((a, c) => a + c.out, 0);
      return { agPeak: fmt(L.peak), agBilled: fmt(L.billed), agNoCache: fmt(L.noCache), agCalls: String(L.calls.length), agList: L.calls.map(c => fmt(c.n)).join(" + "), agIn: fmt(tin), agCached: fmt(tc), agFresh: fmt(tin - tc), agCachedTenth: fmt(tc * CACHE_R), agOut: fmt(to), agP: pct(pFix(s)), agK: String(s.k) }; }
  });
});
