/* Chapter 1 · Press send. A live service: requests from many people flow from their screens, over the internet,
   through a datacenter's gateway, safety check, queue and router to copies of the model. Yours is highlighted:
   the GPU reads your whole prompt at once, then writes the reply one token at a time and streams it back.
   Timings are illustrative orders of magnitude (from the legacy chapter): network 40 ms each way, gateway 12 ms,
   safety 25 ms, router 4 ms, tokenizing 2 ms, reading 30 ms + 0.08 ms per uncached token, writing 18–26 ms per
   token (slower when busier), 300 hidden thinking tokens. The line is a real M/M/1 queue: mean wait 60 ms·ρ/(1−ρ).
   Shown in slow motion: 1 second on screen = 0.2 s of real time (thinking is fast-forwarded a further 4×). */
chapter("send", () => {
  const SLOW = 0.2, NET = 0.04, GW = 0.012, SAFE = 0.025, ROUTE = 0.004, TOK = 0.002, BACK = 0.04;
  const PRE0 = 0.03, PRE_PER = 0.00008, SVC = 0.06, THINK = 300, DOC_TOK = 12000;
  const SYS = { app: 2000, agent: 15000, api: 0 };
  const SYS_NAME = { app: "the chat app", agent: "the coding agent", api: "your own code" };
  const PROMPTS = {
    sky: ["Why is the sky blue?", "Sunlight contains every colour. Air molecules scatter short, blue wavelengths much more strongly than long, red ones, so blue light reaches your eyes from every part of the sky."],
    haiku: ["Write a haiku about servers.", "Fans hum through the night / a thousand racks hold their breath / your answer, then dawn"],
    doc: ["Summarise this 30-page report. [report attached]", "Summary: a configuration change to the payments service caused 38 minutes of errors. Retries overloaded the database. Rolling back fixed it; next steps are safer rollouts and retry limits."]
  };
  const OWN_REPLY = "Here's a short, clear answer to your question, with the key idea first and a one-line summary at the end.";
  const tpotOf = rho => (18 + 8 * rho) / 1000;
  const pieces = s => { const out = []; (s.match(/\s*\S+/g) || []).forEach(w => { if (w.trim().length <= 6) out.push(w); else { out.push(w.slice(0, 5)); let a = w.slice(5); while (a.length) { out.push(a.slice(0, 4)); a = a.slice(4); } } }); return out; };
  const ms = v => v == null ? "–" : v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(2) + " s";

  // ---------- world layout ----------
  const LAP = { x: 20, y: 250, w: 340, h: 240 };
  const PHONES = [[70, 92], [170, 62], [270, 100], [50, 560], [150, 600]].slice(0, 3);
  const FIB_IN = [[360, 360], [420, 250], [470, 420], [520, 380]];
  const DOOR = [520, 380], GATE = 590, SCAN = 690, QX0 = 752, QX1 = 900, ROUTER = [945, 380], LANE = 380, BACKY = 452;
  const REPS = [{ x: 990, y: 66, w: 200, h: 86 }, { x: 1210, y: 66, w: 250, h: 86 }];
  const GPU = { x: 990, y: 182, w: 470, h: 540 };
  const CH = { x0: 1006, x1: 1444, rows: [228, 254] };
  const LY = { x0: 1012, n: 9, dx: 34, y: 286, h: 186, w: 22 };
  const SAMP = { x: 1340, y: 286, w: 100, h: 186 };
  const CLOCK = { x: 20, y: 540, w: 470, h: 196 };
  const BACK_PATH = [
    { p: [[1390, 286], [1390, 240], [1480, 300], [1475, 420]], len: 190 },
    { p: [[1475, 420], [1470, 452], [1300, 452], [980, BACKY]], len: 500 },
    { a: [980, BACKY], b: [DOOR[0], BACKY], len: 460 },
    { p: [[DOOR[0], BACKY], [470, 470], [420, 320], [360, 420]], len: 260 },
    { a: [360, 420], b: [300, 420], len: 60 }
  ];
  const BACK_LEN = BACK_PATH.reduce((a, r) => a + r.len, 0);
  const TAIL0 = (BACK_PATH[0].len + BACK_PATH[1].len) / BACK_LEN;
  const backPos = u => { let d = clamp01(u) * BACK_LEN; for (const r of BACK_PATH) { if (d <= r.len) { const k = d / r.len; return r.p ? bez(r.p, k) : [lerp(r.a[0], r.b[0], k), lerp(r.a[1], r.b[1], k)]; } d -= r.len; } return [300, 420]; };

  // ---------- clickable parts ----------
  const PARTS = [
    ["you", { x: LAP.x, y: LAP.y, w: LAP.w, h: LAP.h + 30 }, "Your screen", "Your app packs your message, the conversation so far and any hidden instructions into one request, then sends it over an encrypted connection."],
    ["others", { x: 20, y: 30, w: 320, h: 130 }, "Other people", "You're never alone on the service. Other people's requests (grey) use the same internet, the same doors and the same line as yours."],
    ["net", { x: 370, y: 230, w: 145, h: 250 }, "The internet", "Your request travels as light in glass fibre. Light covers 1,000 km of fibre in about 5 ms, so the trip takes tens of milliseconds (thousandths of a second)."],
    ["gw", { x: GATE - 40, y: 300, w: 80, h: 150 }, "Gateway", "The gateway is the front door. It checks who you are and that you haven't sent too many requests (a rate limit), and records usage for billing. It takes a few milliseconds."],
    ["safe", { x: SCAN - 40, y: 300, w: 80, h: 150 }, "Safety check", "A small, fast model screens requests for clearly harmful content. Many providers check replies too. What is checked, and where, differs by provider."],
    ["queue", { x: QX0 - 10, y: 340, w: QX1 - QX0 + 20, h: 80 }, "The line", "Each copy of the model can only work on so many conversations at once. When every place is taken, new requests wait here. The wait grows sharply as the service nears full."],
    ["router", { x: ROUTER[0] - 30, y: 340, w: 60, h: 80 }, "Router", "The router picks a copy of the model with room for you, ideally one that has recently read the start of your conversation, so that work can be reused."],
    ["reps", { x: 980, y: 50, w: 490, h: 116 }, "Other copies of the model", "A big service runs many identical copies of the model, each on its own group of GPUs (chips built for the maths AI needs). Any copy can answer any request."],
    ["tok", { x: GPU.x, y: 200, w: GPU.w, h: 70 }, "Tokens", "Your text is chopped into tokens, common pieces of words, and each piece becomes a number. Chapter 2 shows how."],
    ["layers", { x: LY.x0 - 10, y: LY.y, w: LY.n * LY.dx + 10, h: LY.h + 30 }, "Layers", "The model is a stack of layers. Reading: every token of your prompt goes through all the layers at the same time. Writing: one new token at a time goes through all of them."],
    ["samp", { x: SAMP.x, y: SAMP.y - 30, w: SAMP.w, h: SAMP.h + 60 }, "Next-token odds", "At the end of the stack the model scores every possible next token. One is picked, sent to you, and fed back in to make the next one. Chapter 3 shows how."],
    ["clock", CLOCK, "Your request's clock", "The clock runs from the moment you press send. The timings are made up but realistic in size for a large model on a busy service; the animation runs 5 times slower than real life."]
  ];
  const partOf = key => PARTS.find(p => p[0] === key);

  // ---------- requests ----------
  function newReq(s, mine) {
    const r = { id: s.nextId++, mine, t0: s.t, jit: mine ? 1 : 0.7 + s.rand() * 0.6, src: mine ? [300, 330] : PHONES[Math.floor(s.rand() * PHONES.length)], phase: "net", qArr: 0, admit: null, rep: mine ? 2 : Math.floor(s.rand() * 3) };
    r.door = r.t0 + NET * r.jit; r.gwEnd = r.door + GW; r.qArr = r.gwEnd + SAFE;
    if (!mine) { r.svc = 0.05 + s.rand() * 0.25 + (20 + Math.floor(s.rand() * 60)) * tpotOf(s.rho); r.px = QX0; }
    s.reqs.push(r); return r;
  }
  function send(s) {
    if (s.me) { const old = s.me; s.reqs = s.reqs.filter(r => r !== old); s.q = s.q.filter(r => r !== old); }
    const [prompt, reply] = s.promptKey === "own" ? [s.own || "Hello", OWN_REPLY] : PROMPTS[s.promptKey];
    const userTok = s.promptKey === "doc" ? DOC_TOK : Math.max(1, Math.ceil(prompt.length / 4));
    const me = newReq(s, true);
    Object.assign(me, { prompt, reply, out: pieces(reply), userTok, sys: SYS[s.from], from: s.from, think: s.think ? THINK : 0, rho: s.rho, promptKey: s.promptKey, px: QX0 });
    me.inTok = me.sys + me.userTok; s.me = me; s.sends++;
  }
  const exp = (s, mean) => -Math.log(1 - s.rand() * 0.999) * mean;

  function init(rand) {
    const s = { rand, t: 0, st: 0, nextId: 0, reqs: [], q: [], qFreeAt: 0, nextArr: 0, me: null, last: null, cache: new Set(), sends: 0, picked: null, goal: null, history: [] };
    return s;
  }
  function admitFromQueue(s) {
    while (s.q.length && s.qFreeAt <= s.t) {
      const r = s.q.shift(); r.admit = Math.max(s.qFreeAt, r.qArr); s.qFreeAt = r.admit + exp(s, SVC);
      r.routeEnd = r.admit + ROUTE;
      if (r.mine) startGpu(s, r); else { r.doneAt = r.routeEnd + r.svc; }
    }
  }
  function startGpu(s, r) {
    const sysKey = "sys:" + r.from, docKey = "doc:" + r.from + ":" + r.promptKey + ":" + (r.promptKey === "own" ? r.prompt : "");
    r.cachedSys = r.sys && s.cache.has(sysKey) ? r.sys : 0;
    r.cachedUser = s.cache.has(docKey) && r.userTok > 200 ? r.userTok : 0;
    r.cached = r.cachedSys + r.cachedUser; r.uncached = r.inTok - r.cached;
    r.tpot = tpotOf(s.rho);
    r.tokEnd = r.routeEnd + TOK; r.pre = PRE0 + r.uncached * PRE_PER; r.preEnd = r.tokEnd + r.pre;
    r.thinkEnd = r.preEnd + r.think * r.tpot;
    r.emit = r.out.map((_, j) => r.thinkEnd + (j + 1) * r.tpot);
    r.land = r.emit.map(e => e + BACK);
    r.ttft = r.land[0] - r.t0; r.total = r.land[r.land.length - 1] - r.t0;
    r.qWait = r.admit - r.qArr; r.ahead0 = r.ahead0 || 0;
    if (r.sys) s.cache.add(sysKey); if (r.userTok > 200) s.cache.add(docKey);
  }
  function phaseOf(r, t) {
    if (t < r.door) return "net"; if (t < r.gwEnd) return "gw"; if (t < r.qArr) return "safe";
    if (r.admit == null || t < r.admit) return "queue"; if (t < r.routeEnd) return "route";
    if (!r.mine) return t < r.doneAt ? "gpu" : t < r.doneAt + BACK ? "back" : "gone";
    if (t < r.tokEnd) return "tok"; if (t < r.preEnd) return "prefill"; if (r.think && t < r.thinkEnd) return "think";
    if (t < r.emit[r.emit.length - 1]) return "decode"; if (t < r.land[r.land.length - 1]) return "stream"; return "done";
  }

  function step(s, dt) {
    const warp = s.me && phaseOf(s.me, s.t) === "think" ? 4 : 1; s.warp = warp;
    const rdt = dt * SLOW * warp; s.t += rdt; s.st += dt;
    if (s.sendAt != null && s.t >= s.sendAt) { s.sendAt = null; send(s); }
    // other people's requests: Poisson arrivals at rate λ = ρ·μ
    const lam = s.rho / SVC;
    if (lam > 0) { if (!isFinite(s.nextArr)) s.nextArr = s.t + exp(s, 1 / lam); while (s.t >= s.nextArr) { const r = newReq(s, false); r.t0 = s.nextArr; r.door = r.t0 + NET * r.jit; r.gwEnd = r.door + GW; r.qArr = r.gwEnd + SAFE; s.nextArr += exp(s, 1 / lam); } }
    else s.nextArr = Infinity;
    // requests reaching the line join it in arrival order
    for (const r of s.reqs) if (!r.inQ && r.admit == null && s.t >= r.qArr) { r.inQ = true; if (r.mine) r.ahead0 = s.q.length; s.q.push(r); }
    s.q.sort((a, b) => a.qArr - b.qArr);
    admitFromQueue(s);
    for (const r of s.reqs) if (r.admit != null) r.inQ = false;
    // finish
    const me = s.me;
    if (me && me.land && s.t >= me.land[me.land.length - 1] && !me.finished) {
      me.finished = true;
      s.last = { ttft: me.ttft, total: me.total, rho: me.rho, think: me.think, pre: me.pre, inTok: me.inTok, cached: me.cached, uncached: me.uncached, qWait: me.qWait, ahead: me.ahead0, tpot: me.tpot, from: me.from, promptKey: me.promptKey, sys: me.sys, nOut: me.out.length, at: s.st };
      s.history.push(s.last);
      if (me.ttft < 1 && me.promptKey === "doc" && !s.goal) s.goal = s.last;
    }
    s.reqs = s.reqs.filter(r => r.mine ? r === s.me : phaseOf(r, s.t) !== "gone");
  }

  // ---------- drawing ----------
  function screenText(k, wx, wy, text, maxWpx, o = {}) {
    const [sx, sy] = k.toScreen(wx, wy), c = k.ctx; c.save(); k.screen();
    font(c, o.size || 12, o.mono ? "--f-mono" : "--f-body", o.weight || ""); c.fillStyle = o.col || k.C.ink; c.textAlign = "left"; c.textBaseline = "top";
    let lines = wrapLines(c, text, maxWpx); const lh = (o.size || 12) * 1.35;
    if (o.maxLines && lines.length > o.maxLines) lines = o.tail ? lines.slice(lines.length - o.maxLines) : lines.slice(0, o.maxLines);
    lines.forEach((l, i) => c.fillText(l, sx, sy + i * lh)); c.restore(); k.world(); return lines.length * lh / k.scale;
  }
  function screenOf(s) {
    const me = s.me; if (!me) return { prompt: "", reply: "", status: "" };
    const n = me.land ? me.land.filter(x => s.t >= x).length : 0, ph = phaseOf(me, s.t);
    return { prompt: me.prompt, reply: me.out.slice(0, n).join(""), status: n ? "" : ph === "think" ? `Thinking… (${Math.round((s.t - me.preEnd) / me.tpot)} hidden tokens)` : "…", n };
  }
  function drawScreen(k, s) {
    const C = k.C, L = LAP, pxw = (L.w - 36) * k.scale, sc = screenOf(s), fs = Math.max(10, Math.min(14, Math.round(13 * k.scale / 0.6)));
    k.box(L.x, L.y, L.w, L.h, { fill: C.bg2, stroke: hot(s, "you") ? C.sig : C.line, r: 14 });
    k.box(L.x - 16, L.y + L.h + 6, L.w + 32, 14, { fill: C.line, r: 5 });
    if (!sc.prompt) return;
    // your message bubble (right aligned)
    const c = k.ctx; font(c, fs, "--f-body"); const maxB = pxw * 0.85 - 16;
    const lines = wrapLines(c, sc.prompt, maxB).slice(0, 2), bwPx = Math.max(...lines.map(l => c.measureText(l).width)) + 16, bhPx = lines.length * fs * 1.35 + 10;
    const bx = L.x + L.w - 18 - bwPx / k.scale;
    k.box(bx, L.y + 16, bwPx / k.scale, bhPx / k.scale, { fill: C.line, r: 10 });
    screenText(k, bx + 8 / k.scale, L.y + 16 + 5 / k.scale, sc.prompt, maxB + 1, { size: fs, maxLines: 2 });
    const y0 = L.y + 16 + bhPx / k.scale + 12;
    if (sc.reply) screenText(k, L.x + 18, y0, sc.reply, pxw, { size: fs, maxLines: Math.max(2, Math.floor((L.y + L.h - y0 - 10) * k.scale / (fs * 1.35))), tail: true });
    else screenText(k, L.x + 18, y0, sc.status, pxw, { size: fs, col: C.muted });
  }
  const hot = (s, key) => s.picked && s.picked.key === key && s.st - s.picked.at < 8;
  function reqPos(s, r) {
    const t = s.t, ph = phaseOf(r, t);
    if (ph === "net") { const u = clamp01((t - r.t0) / (r.door - r.t0)), j0 = r.mine ? 0 : 0.35, J = bez(FIB_IN, j0); if (u < 0.3) { const v = easeIO(u / 0.3); return [lerp(r.src[0], J[0], v), lerp(r.src[1], J[1], v)]; } return bez(FIB_IN, j0 + (u - 0.3) / 0.7 * (1 - j0)); }
    if (ph === "gw") return [lerp(DOOR[0], GATE, easeIO((t - r.door) / GW)), LANE];
    if (ph === "safe") return [lerp(GATE, SCAN + 40, easeIO((t - r.gwEnd) / SAFE)), LANE];
    if (ph === "queue") return [r.px, LANE];
    if (ph === "route") { const u = easeIO((t - r.admit) / ROUTE); const tgt = r.rep === 2 ? [GPU.x + 10, LANE] : [REPS[r.rep].x + 30 + (r.id % 6) * 26, REPS[r.rep].y + REPS[r.rep].h]; return [lerp(ROUTER[0], tgt[0], u), lerp(LANE, tgt[1], u)]; }
    if (ph === "gpu") { if (r.rep === 2) return [GPU.x + 40 + (r.id % 14) * 28, GPU.y + 470 + (Math.floor(r.id / 14) % 2) * 26]; const R = REPS[r.rep]; return [R.x + 22 + (r.id % 7) * 24, R.y + 50 + (Math.floor(r.id / 7) % 2) * 16]; }
    if (ph === "back") { const u = easeIO((t - r.doneAt) / BACK); if (r.rep === 2) return backPos(u * 0.98); const R = REPS[r.rep], a = [R.x + 20, R.y + R.h]; if (u < 0.25) { const v = u / 0.25; return [lerp(a[0], 980, v), lerp(a[1], BACKY, v)]; } return backPos(TAIL0 + (u - 0.25) / 0.75 * (0.98 - TAIL0)); }
    return null;
  }
  function draw(k, s, sim) {
    const C = k.C, me = s.me, mph = me ? phaseOf(me, s.t) : "idle", narrow = sim.narrow;
    const lab = (x, y, t, key, o = {}) => k.label(x, y, t, { col: hot(s, key) ? C.sig : o.col || C.muted, weight: hot(s, key) ? "650" : "550", size: o.size || 12, align: o.align, bg: o.bg });
    // other people
    PHONES.forEach(([x, y]) => k.box(x - 14, y - 24, 28, 48, { fill: C.bg2, stroke: hot(s, "others") ? C.sig : C.line, r: 6 }));
    lab(170, 150, "Other people", "others");
    drawScreen(k, s);
    lab(LAP.x + LAP.w / 2, LAP.y - 14, "Your screen", "you", { col: C.ink });
    // internet
    k.curve(FIB_IN, { col: hot(s, "net") ? C.sig : C.line, dash: [5, 5] });
    k.curve([BACK_PATH[3].p[3], BACK_PATH[3].p[2], BACK_PATH[3].p[1], BACK_PATH[3].p[0]], { col: C.line, dash: [5, 5] });
    lab(445, 222, "Internet", "net");
    // datacenter
    k.box(DOOR[0], 40, 960, 700, { fill: C.bg2, alpha: 0.5, r: 24 }); k.box(DOOR[0], 40, 960, 700, { stroke: C.line, r: 24 });
    lab(DOOR[0] + 18, 62, "Datacenter", "", { align: "left", col: C.ink });
    k.box(DOOR[0], LANE - 12, 470, 24, { fill: C.line, alpha: 0.3, r: 0 }); k.box(DOOR[0], BACKY - 8, 470, 16, { fill: C.line, alpha: 0.22, r: 0 });
    // gateway
    const gwOn = s.reqs.some(r => phaseOf(r, s.t) === "gw");
    k.box(GATE - 30, 320, 9, 110, { fill: gwOn || hot(s, "gw") ? C.sig : C.line, r: 2 }); k.box(GATE + 21, 320, 9, 110, { fill: gwOn || hot(s, "gw") ? C.sig : C.line, r: 2 });
    k.box(GATE - 21, 320, 42, 6, { fill: gwOn ? C.amb : C.muted, r: 2, alpha: gwOn ? 0.2 : 1 });
    // safety arch
    const sfOn = s.reqs.some(r => phaseOf(r, s.t) === "safe");
    const c = k.ctx; c.save(); c.strokeStyle = sfOn || hot(s, "safe") ? C.sig : C.line; c.lineWidth = 6; c.beginPath(); c.moveTo(SCAN - 28, 430); c.lineTo(SCAN - 28, 336); c.arc(SCAN, 336, 28, Math.PI, 0); c.lineTo(SCAN + 28, 430); c.stroke(); c.restore();
    if (sfOn) k.box(SCAN - 25, 340 + ((s.st * 160) % 80), 50, 3, { fill: C.sig, glow: 12, r: 1 });
    // queue lane
    k.box(QX0 - 6, LANE - 22, QX1 - QX0 + 12, 44, { stroke: hot(s, "queue") ? C.sig : s.q.length > 4 ? C.amb : C.line, r: 22, dash: [4, 4] });
    // router + routes
    const rOn = s.reqs.some(r => phaseOf(r, s.t) === "route");
    [[REPS[0].x + 100, REPS[0].y + REPS[0].h], [REPS[1].x + 125, REPS[1].y + REPS[1].h], [GPU.x, LANE]].forEach(([x, y], j) => k.curve([[ROUTER[0], LANE], [x - 30, LANE], [x, j < 2 ? LANE - 40 : LANE], [x, y]], { col: j === 2 && me && mph === "route" ? C.sig : C.line, alpha: 0.8 }));
    c.save(); c.translate(ROUTER[0], ROUTER[1]); c.rotate(Math.PI / 4); c.fillStyle = rOn || hot(s, "router") ? C.sig : C.muted; c.fillRect(-11, -11, 22, 22); c.restore();
    // other replicas
    REPS.forEach((R, j) => { k.box(R.x, R.y, R.w, R.h, { fill: C.bg, stroke: hot(s, "reps") ? C.sig : C.line, r: 12 }); const busy = s.reqs.filter(r => r.rep === j && phaseOf(r, s.t) === "gpu").length;
      for (let d = 0; d < 8; d++) k.box(R.x + 14 + d * ((R.w - 28) / 8), R.y + 16, (R.w - 28) / 8 - 5, 8, { fill: C.amb, r: 2, alpha: busy ? 0.25 + 0.6 * ((Math.sin(s.st * 6 + d * 1.7 + j) + 1) / 2) : 0.12 }); });
    // the GPU serving you
    const gpuOn = ["tok", "prefill", "think", "decode"].includes(mph);
    k.box(GPU.x, GPU.y, GPU.w, GPU.h, { fill: C.bg, stroke: gpuOn ? C.sig : C.line, r: 16, lw: gpuOn ? 2 : 1.5, glow: gpuOn ? 10 : 0, glowCol: C.sig });
    for (let j = 0; j < LY.n; j++) k.box(LY.x0 + j * LY.dx, LY.y, LY.w, LY.h, { fill: C.line, r: 5, alpha: hot(s, "layers") ? 1 : 0.8 });
    k.box(SAMP.x, SAMP.y, SAMP.w, SAMP.h, { stroke: hot(s, "samp") ? C.sig : C.line, r: 8 });
    if (me && me.admit != null && s.t >= me.routeEnd) drawGpuWork(k, s, me, mph);
    // other people's requests
    for (const r of s.reqs) { if (r.mine) continue; const ph = phaseOf(r, s.t); if (ph === "queue") continue; const p = reqPos(s, r); if (p) k.dot(p[0], p[1], ph === "gpu" ? 5 : 6, C.muted, { alpha: ph === "gpu" ? 0.7 : 0.85 }); }
    // the line: everyone waiting, in order
    s.q.forEach((r, i) => { const tx = QX1 - 8 - i * 17; r.px = r.px == null ? tx : lerp(r.px, tx, 0.25); if (r.px < QX0 + 4) return; if (r.mine) return; k.dot(r.px, LANE, 6, C.muted, { alpha: 0.9 }); });
    if (s.q.length > 9) lab(QX0 + 14, LANE - 32, `+${s.q.length - 9}`, "queue", { col: C.amb });
    // your request
    if (me && ["net", "gw", "safe", "queue", "route"].includes(mph)) {
      const p = reqPos(s, me); if (mph === "queue") p[0] = Math.max(QX0 + 6, me.px);
      k.dot(p[0], p[1], 11, C.sig, { glow: 22 }); if (!narrow || k.scale > 0.8) k.label(p[0], p[1] - 22, "you", { col: C.sig, weight: "700", size: 11 });
    }
    // tokens flying back to you
    if (me && me.land) me.emit.forEach((e, j) => { const u = (s.t - e) / BACK; if (u <= 0 || u >= 1) return; const [x, y] = backPos(u); k.dot(x, y, 6, C.sig, { glow: 12 }); });
    // other people's finished replies
    // labels
    const q = s.q.length, meAhead = me && mph === "queue" ? s.q.indexOf(me) : -1;
    lab(GATE, 300, "Gateway", "gw"); lab(SCAN, 480, "Safety check", "safe");
    lab((QX0 + QX1) / 2, 416, meAhead >= 0 ? `Line · ${meAhead} ahead of you` : q ? `Line · ${q} waiting` : "Line · empty", "queue", { col: q > 4 || meAhead > 0 ? C.amb : C.muted });
    lab(ROUTER[0], 412, "Router", "router");
    lab(1225, 170, "Other copies of the model", "reps");
    lab(GPU.x + 18, GPU.y + 18, "Your copy of the model, on GPU chips", "tok", { align: "left", col: gpuOn ? C.ink : C.muted });
    lab(LY.x0 + (LY.n * LY.dx) / 2 - 8, LY.y + LY.h + 16, "Layers", "layers");
    lab(SAMP.x + SAMP.w / 2, LY.y + LY.h + 16, "Next-token odds", "samp");
    const others = s.reqs.filter(r => r.rep === 2 && !r.mine && phaseOf(r, s.t) === "gpu").length;
    lab(GPU.x + 18, GPU.y + 444, others ? `Also writing for ${others} other ${others === 1 ? "person" : "people"} at the same time` : "No one else on this copy right now", "", { align: "left", size: 11 });
    drawClock(k, s);
    // picked part outline
    if (hot(s, s.picked && s.picked.key)) { const P = partOf(s.picked.key); if (P) k.box(P[1].x - 6, P[1].y - 6, P[1].w + 12, P[1].h + 12, { stroke: C.sig, r: 12, dash: [6, 5], lw: 1.5 }); }
    // phone: a small copy of your screen while the camera is inside the datacenter
    if (narrow && me && ["tok", "prefill", "think", "decode", "stream"].includes(mph)) {
      const sc = screenOf(s), c2 = k.ctx; c2.save(); k.screen(); const pw = k.W - 24, ph2 = 46;
      c2.globalAlpha = 0.92; c2.fillStyle = C.bg2; rr(c2, 12, k.H - ph2 - 10, pw, ph2, 10); c2.fill(); c2.globalAlpha = 1; c2.strokeStyle = C.sig; c2.lineWidth = 1; c2.stroke();
      font(c2, 10, "--f-display", "600"); c2.fillStyle = C.muted; c2.textAlign = "left"; c2.textBaseline = "top"; c2.fillText("Your screen", 22, k.H - ph2 - 4);
      font(c2, 12, "--f-body"); c2.fillStyle = sc.reply ? C.ink : C.muted; let ls = wrapLines(c2, sc.reply || sc.status, pw - 20); c2.fillText(ls[ls.length - 1] || "", 22, k.H - ph2 + 12); c2.restore(); k.world();
    }
    if (s.warp > 1) k.label(GPU.x + GPU.w / 2, GPU.y + GPU.h + 2, "fast-forwarding 4× while it thinks", { col: C.amb, size: 11, weight: "600", bg: true });
  }
  function drawGpuWork(k, s, me, mph) {
    const C = k.C, t = s.t;
    // token chips: hidden instructions, your prompt, the rest
    const chips = []; let x = CH.x0, row = 0; const c = k.ctx; font(c, 11, "--f-mono");
    const add = (txt, kind) => { const w = (c.measureText(txt).width + 10) / k.scale; if (x + w > CH.x1) { row++; x = CH.x0; } if (row > 1) return false; chips.push({ txt, kind, x, w, y: CH.rows[row] }); x += w + 4; return true; };
    if (me.sys) add(`hidden instructions · ${me.sys.toLocaleString()}${me.cachedSys ? " · cached" : ""}`, "sys");
    const ps = me.promptKey === "doc" ? pieces("Summarise this 30-page report") : pieces(me.prompt); let shown = 0;
    const restTxt = n => `+${n.toLocaleString()} more${me.cachedUser ? " · cached" : ""}`, reserve = (c.measureText(restTxt(me.userTok)).width + 14) / k.scale;
    for (const p of ps) { const w = (c.measureText(p).width + 14) / k.scale; if (shown < ps.length - 1 || me.userTok > ps.length) { if ((row === 1 || x + w > CH.x1) && (row === 1 ? x : CH.x0) + w + reserve > CH.x1) break; } if (!add(p.replace(/\s/g, "·"), "user")) break; shown++; }
    const rest = me.userTok - shown; if (rest > 0) add(restTxt(rest), "more");
    const tokK = clamp01((t - me.routeEnd) / TOK), preK = clamp01((t - me.tokEnd) / me.pre);
    chips.forEach((ch, j) => { const a = clamp01(tokK * 1.2 - j * 0.02); if (a <= 0) return; const read = preK > (ch.x - CH.x0) / (CH.x1 - CH.x0) * 0.6;
      k.box(ch.x, ch.y - 11, ch.w, 22, { fill: ch.kind === "user" ? C.sig : C.line, r: 6, alpha: a * (ch.kind === "user" ? (read ? 0.95 : 0.5) : 0.9) });
      k.label(ch.x + 5 / k.scale, ch.y, ch.txt, { mono: true, size: 11, align: "left", col: ch.kind === "user" ? C.bg : C.ink, alpha: a }); });
    const glow = (j, a) => k.box(LY.x0 + j * LY.dx, LY.y, LY.w, LY.h, { fill: C.amb, r: 5, alpha: a, glow: 18 });
    if (mph === "prefill") { const w = preK * (LY.n + 2) - 1; for (let j = 0; j < LY.n; j++) { const d = Math.abs(w - j); if (d < 1.6) glow(j, (1 - d / 1.6) * 0.95); }
      const xx = Math.min(LY.x0 + LY.n * LY.dx, LY.x0 - 8 + preK * (LY.n * LY.dx + 30)); for (let r = 0; r < 12; r++) k.pill(xx, LY.y + 12 + r * 15, 12, 6, C.sig, { glow: 6, alpha: 0.85 }); }
    const pass = (u, col, sampler) => { const xx = LY.x0 - 10 + u * (LY.n * LY.dx + 4), j = Math.floor((xx - LY.x0) / LY.dx); if (j >= 0 && j < LY.n) glow(j, 0.85); if (u < 0.92) k.dot(Math.min(xx, SAMP.x - 8), LY.y + LY.h / 2, 7, col, { glow: 10 });
      if (sampler) { const sp = clamp01((u - 0.5) / 0.35); [0.62, 0.21, 0.1, 0.07].forEach((p, q) => k.box(SAMP.x + 10, SAMP.y + 30 + q * 38, (SAMP.w - 20) * p / 0.62 * sp, 14, { fill: q === 0 && sp > 0.6 ? C.sig : C.muted, r: 3, alpha: 0.9 })); } };
    if (mph === "think") pass(((t - me.preEnd) / me.tpot) % 1, C.muted, false);
    if (mph === "decode") { let j = me.emit.findIndex(e => e > t); if (j < 0) j = me.emit.length - 1; const start = j ? me.emit[j - 1] : me.thinkEnd; const u = clamp01((t - start) / me.tpot); pass(u, C.sig, true);
      if (u > 0.75) k.label(SAMP.x + SAMP.w / 2, SAMP.y - 14, JSON.stringify(me.out[j].trim() || " "), { col: C.sig, mono: true, size: 12, weight: "650", bg: true }); }
    if (mph === "think") k.label(SAMP.x + SAMP.w / 2, SAMP.y + SAMP.h / 2, `${Math.round((t - me.preEnd) / me.tpot)} hidden`, { col: C.muted, mono: true, size: 11 });
    // what is happening, in words
    const say = { tok: "Chopping your text into tokens", prefill: `Reading all ${me.uncached.toLocaleString()} new tokens at once`, think: "Thinking: writing hidden tokens first", decode: "Writing the reply, one token at a time", stream: "Last tokens on their way", done: "Reply finished" }[mph];
    if (say) k.label(GPU.x + 18, GPU.y + 512, say, { align: "left", col: mph === "prefill" || mph === "think" ? C.amb : C.sig, size: 13, weight: "650" });
  }
  function drawClock(k, s) {
    const C = k.C, me = s.me, B = CLOCK; if (k.cam.x > B.x + B.w || k.cam.y + k.cam.h < B.y) return;
    k.box(B.x, B.y, B.w, B.h, { fill: C.bg2, stroke: hot(s, "clock") ? C.sig : C.line, r: 14 });
    k.label(B.x + 16, B.y + 20, "Your request's clock · illustrative timings", { align: "left", col: C.muted, size: 11, weight: "600" });
    if (!me) return;
    const now = Math.min(s.t, me.land ? me.land[me.land.length - 1] : s.t) - me.t0, first = me.land && s.t >= me.land[0] ? me.ttft : null;
    k.label(B.x + 16, B.y + 54, now.toFixed(2) + " s", { align: "left", col: C.ink, size: 26, weight: "700", mono: true });
    k.label(B.x + B.w - 16, B.y + 54, first != null ? "first word at " + ms(first) : "waiting for the first word", { align: "right", col: first != null ? (first < 1 ? C.ok : C.amb) : C.muted, size: 12, weight: "650" });
    const segs = [["travel and checks", me.t0, me.qArr, C.muted], ["line", me.qArr, me.admit, C.amb], ["reading", me.routeEnd != null ? me.routeEnd : null, me.preEnd, C.amb], ["thinking", me.preEnd, me.think ? me.thinkEnd : null, C.muted], ["writing", me.thinkEnd, me.land ? me.land[me.land.length - 1] : null, C.sig]];
    const total = me.total || 0, span = Math.max(1.5, total * 1.05, now * 1.05), bx = B.x + 16, bw = B.w - 32, by = B.y + 92, X = v => bx + clamp01(v / span) * bw;
    k.box(bx, by, bw, 16, { fill: C.line, r: 4, alpha: 0.4 });
    segs.forEach(([n, a, b, col], i) => { if (a == null || s.t < a) return; const e = b == null ? s.t : Math.min(s.t, b); if (e <= a) return; k.box(X(a - me.t0), by, Math.max(1, X(e - me.t0) - X(a - me.t0)), 16, { fill: col, r: 2, alpha: i === 1 ? 0.55 : i === 3 ? 0.5 : 0.9 }); });
    k.line(X(1), by - 8, X(1), by + 26, { col: C.ok, dash: [3, 3] }); k.label(X(1), by + 34, "1 s", { col: C.ok, size: 10 });
    if (first != null) { k.line(X(first), by - 6, X(first), by + 22, { col: C.ink, lw: 2 }); }
    let lx = bx; const ky = B.y + B.h - 22, c = k.ctx; font(c, 11, "--f-display", "500"); segs.forEach(([n, , , col], i) => { k.box(lx, ky - 5, 10, 10, { fill: col, r: 2, alpha: i === 1 ? 0.55 : i === 3 ? 0.5 : 0.9 }); k.label(lx + 14, ky, n, { align: "left", size: 11 }); lx += 14 + (c.measureText(n).width + 14) / k.scale; });
  }

  // ---------- the simulation ----------
  const lastOr = (s, f, d = "–") => s.last ? f(s.last) : d;
  const sim = makeSim($("#send-sim"), {
    label: "A live view of an AI service. Your request (the bright teal dot) travels from your screen over the internet into a datacenter, through a gateway, a safety check, a line and a router to a GPU that reads your prompt and writes the reply token by token. Grey dots are other people's requests. Click any part to learn what it does.",
    cams: { default: { x: 0, y: 28, w: 1490, h: 728 } },
    camsNarrow: { default: { x: 0, y: 180, w: 540, h: 570 }, you: { x: 0, y: 180, w: 540, h: 570 }, door: { x: 500, y: 170, w: 470, h: 450 }, gpu: { x: 978, y: 170, w: 494, h: 680 } },
    camera: (s) => { const me = s.me; if (!me) return "you"; const ph = phaseOf(me, s.t); if (["net"].includes(ph)) return "you"; if (["gw", "safe", "queue", "route"].includes(ph)) return "door"; if (["tok", "prefill", "think", "decode"].includes(ph)) return "gpu"; return "you"; },
    height: w => w < 640 ? Math.round(Math.max(340, w * 1.05)) : Math.round(Math.min(600, Math.max(400, w * 0.5))),
    init, warmup: 12,
    intro: "Your question is about to leave your screen. Follow the bright teal dot. Grey dots are other people. Click any part of the machine to learn what it does.",
    controls: [
      { id: "prompt", label: "What you send", type: "choice", value: "sky", options: [["sky", "A question"], ["haiku", "A haiku"], ["doc", "A 30-page report"]], help: "Or type your own message and press Enter.", apply: (s, v, sim) => { s.promptKey = v; if (s.ready) send(s); } },
      { id: "from", label: "Sent from", type: "choice", value: "app", options: [["app", "Chat app"], ["agent", "Coding agent"], ["api", "Your code"]], help: "Apps quietly add their own instructions to every message.", apply: (s, v) => { s.from = v; if (s.ready) send(s); } },
      { id: "busy", label: "How busy is the service?", type: "range", min: 0, max: 0.95, step: 0.05, value: 0.5, fmt: v => Math.round(v * 100) + "%", apply: (s, v) => { s.rho = v; s.nextArr = NaN; } },
      { id: "think", label: "Thinking model", type: "toggle", value: false, help: "Writes hidden reasoning before it answers.", apply: (s, v) => { s.think = v; if (s.ready) send(s); } },
      { id: "send", label: "Press send", type: "button", help: "Send the same message again, like a follow-up about the same text.", apply: s => send(s) }
    ],
    step: (s, dt) => { s.ready = true; if (!s.sendAt && !s.me && s.sends === 0) s.sendAt = 12 * SLOW - 0.05; step(s, dt); },
    draw,
    click: (s, wx, wy) => { const P = PARTS.slice().reverse().find(([, r]) => wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h); s.picked = P ? { key: P[0], at: s.st } : null; },
    stats: s => { const me = s.me; const live = me && !(me.land && s.t >= me.land[0]) ? (s.t - me.t0) : null; const f = me && me.land && s.t >= me.land[0] ? me.ttft : live;
      const tp = me && me.tpot ? me.tpot : tpotOf(s.rho || 0.5);
      return [["until your first word", f == null ? "–" : (live != null ? ms(f) + "…" : ms(f)), f == null || live != null ? "" : f < 1 ? "ok" : f < 3 ? "hot" : "bad"],
        ["words per second while writing", "≈ " + Math.round(0.75 / tp), ""],
        ["tokens the model reads", me ? me.inTok.toLocaleString() + (me.cached ? ` · ${me.cached.toLocaleString()} cached` : "") : "–", ""],
        ["waiting in line", String(s.q.length), s.q.length > 5 ? "hot" : ""],
        ["whole reply", me && me.finished ? ms(me.total) : "–", ""]]; },
    goal: { text: "send the 30-page report and get the first word of its summary on screen in under 1 second", check: s => { const d = s.history.filter(h => h.promptKey === "doc"); return { done: !!s.goal, progress: d.length ? `best so far: ${ms(Math.min(...d.map(h => h.ttft)))}` : "" }; } },
    notices: [
      { id: "pick", when: s => s.picked && s.st - s.picked.at < 8, say: s => { const P = partOf(s.picked.key); return `<b>${P[2]}.</b> ${P[3]}`; } },
      { id: "think", when: s => s.me && phaseOf(s.me, s.t) === "think", say: s => { const me = s.me, n = Math.round((s.t - me.preEnd) / me.tpot); return `The model is writing <b>${n}</b> of ${me.think} hidden thinking tokens before the answer. Each takes as long as a visible one (${Math.round(me.tpot * 1000)} ms), so you wait ${ms(me.think * me.tpot)} and see nothing. Shown 4× faster.`; } },
      { id: "missBig", when: s => s.me && phaseOf(s.me, s.t) === "prefill" && s.me.uncached > 5000, say: s => { const me = s.me; return `The model is reading <b>${me.uncached.toLocaleString()}</b> tokens it hasn't seen before${me.sys && !me.cachedSys ? `, including ${me.sys.toLocaleString()} hidden instructions from ${SYS_NAME[me.from]}` : ""}. That takes ${ms(me.pre)}. Press send again: this time the start will already be stored (cached).`; } },
      { id: "line", when: s => s.me && phaseOf(s.me, s.t) === "queue" && s.q.indexOf(s.me) > 0, say: s => `You're in line behind <b>${s.q.indexOf(s.me)}</b> other ${s.q.indexOf(s.me) === 1 ? "request" : "requests"}. At ${Math.round(s.rho * 100)}% busy, a place frees up only when someone else's turn ends, and the line grows much faster than the busyness.` },
      { id: "hit", when: s => s.last && s.st - s.last.at < 7 && s.last.cached > 1000, say: s => { const l = s.last; return `This time ${l.cached.toLocaleString()} tokens were already cached on this copy of the model, so reading took only ${ms(l.pre)} instead of about ${ms(PRE0 + l.inTok * PRE_PER)}. First word: <b>${ms(l.ttft)}</b>.`; } },
      { id: "done", when: s => s.last && s.st - s.last.at < 7, say: s => { const l = s.last; const parts = [["the line", l.qWait], ["reading your prompt", l.pre], ["thinking", l.think * l.tpot], ["the trip there and back", NET + BACK + GW + SAFE]].sort((a, b) => b[1] - a[1]); return `First word after <b>${ms(l.ttft)}</b>, whole reply after ${ms(l.total)}. Most of the wait before the first word was ${parts[0][0]} (${ms(parts[0][1])}). ${l.promptKey !== "doc" ? "Now try the 30-page report." : l.ttft >= 1 && l.uncached > 5000 ? "Ask about the same report again with <b>Press send</b>." : ""}`; } },
      { id: "decode", when: s => s.me && phaseOf(s.me, s.t) === "decode", say: s => { const me = s.me; return `Reading your ${me.inTok.toLocaleString()} tokens took ${ms(me.pre)}, all in one pass. Writing is different: one token every ${Math.round(me.tpot * 1000)} ms, each sent to you the moment it exists.`; } },
      { id: "busy", when: s => s.rho >= 0.85 && s.q.length > 3, say: s => `At ${Math.round(s.rho * 100)}% busy, ${s.q.length} requests are waiting. The average wait in line is now ${ms(SVC * s.rho / (1 - s.rho))}; at 50% busy it was ${ms(SVC)}.` },
      { id: "calm", when: () => true, say: s => s.me ? "Watch your request (bright teal) move through the machine. Click any part to learn what it does." : "Press send." }
    ],
    facts: [
      { id: "stateless", when: s => s.history.length >= 2, text: "The model remembers nothing between messages. Every time you press send, the app sends the whole conversation so far, and the model reads all of it again.", ref: "#ref-70" },
      { id: "sse", when: s => s.me && phaseOf(s.me, s.t) === "decode" && s.history.length >= 1, text: "Replies stream over one web connection that stays open, using a standard called server-sent events. That's how each word can appear the moment it's written.", ref: "#ref-55" }
    ],
    tour: [
      { say: "Your question leaves your screen as a small package of data (bright teal). It crosses the internet to a datacenter, passes a gateway and a safety check, waits in line, and a router sends it to a copy of the model.", set: { prompt: "sky", from: "app", busy: 0.3, think: false }, until: s => s.me && phaseOf(s.me, s.t) === "prefill", max: 12 },
      { say: "Inside the GPU, the model reads every token of your prompt at once (the amber wave). Then it writes the reply one token at a time, and each token flies straight back to your screen.", until: s => s.me && s.me.finished, max: 20 },
      { say: "Now the service gets busy: 90% of its capacity in use. Watch the line.", set: { busy: 0.9 }, act: s => send(s), until: s => s.me && s.me.finished, max: 25 },
      { say: "Paste a 30-page report from the coding agent. The model must read 27,000 tokens before it can write a word.", set: { busy: 0.5, from: "agent", prompt: "doc" }, until: s => s.me && s.me.finished, max: 25 },
      { say: "Send it again. The start is now cached on this copy, so reading is almost free.", act: s => send(s), until: s => s.me && s.me.finished, max: 20 },
      { say: "Finally, a thinking model. It writes hundreds of hidden tokens before the first word you see.", set: { prompt: "sky", from: "app", think: true }, until: s => s.me && s.me.land && s.t >= s.me.land[0], max: 25 }
    ],
    publish: s => { const l = s.last || {}; const tp = tpotOf(s.rho || 0.5); return { ttft: ms(l.ttft), total: ms(l.total), pre: ms(l.pre), inTok: l.inTok != null ? l.inTok.toLocaleString() : "–", cached: (l.cached || 0).toLocaleString(), qwait: ms(l.qWait), busy: Math.round((l.rho != null ? l.rho : s.rho) * 100) + "%", tpot: Math.round((l.tpot || tp) * 1000) + " ms", wps: String(Math.round(0.75 / (l.tpot || tp))), tps: String(Math.round(1 / (l.tpot || tp))), nout: String(l.nOut || "–"), wq: ms(SVC * (l.rho || 0) / (1 - (l.rho || 0))), thinkT: ms((l.think || 0) * (l.tpot || tp)) }; }
  });

  // a text box under "What you send", so you can type your own message
  const ctl = $("#send-sim .sim-controls .sim-choice");
  if (ctl) { const inp = document.createElement("input"); inp.type = "text"; inp.id = "send-sim-own"; inp.placeholder = "Type your own message"; inp.setAttribute("aria-label", "Your own message"); inp.maxLength = 140; inp.style.marginTop = "0.35rem";
    ctl.insertBefore(inp, $("small", ctl));
    const go = () => { const s = sim.state; s.own = inp.value.trim() || "Hello"; sim.set("prompt", "own"); };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } }); inp.addEventListener("change", go); }
});
