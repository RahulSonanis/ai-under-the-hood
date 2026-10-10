/* Chapter 9 · What a reply costs. The learner runs a fleet of GPUs through one sped-up day of traffic.
   Each GPU serves the chapter 8 model with 64 seats; a reply holds a seat for 20 s (≈ 600 tokens at 30 tokens/s),
   so one GPU finishes at most 3.2 replies a second. Requests are spread evenly over the GPUs that are on, and each GPU
   is treated as a queue with 64 servers (Erlang C) while it keeps up; when arrivals exceed capacity a backlog builds
   (fluid queue). Traffic shape, peak (100 replies/s), the 11:00 spike (+70% for 30 min), the 10-minute start-up time,
   $3 per GPU-hour, idle power (25% of 700 W) and the 90% batch fill are illustrative. 700 W is the H100's maximum
   power (NVIDIA). One second of simulation is 20 minutes of the day. */
chapter("cost", () => {
  const SEATS = 64, R = 20, MU = SEATS / R, PRICE = 3, PEAK = 100, START = 10 / 60, DOWN = 15 / 60, Y = 5, BFILL = 0.9;
  const PMAX = 700, PIDLE = 0.25, DAYSEC = 72, DT_H = 24 / DAYSEC, MAXG = 60, SPIKE = 1.7, TV_S_PER_WH = 9 / 0.24;
  const BATCH = "#8fb3ff";
  const EDGES = [0, 1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 1200, Infinity];
  const shape = h => 0.65 - 0.35 * Math.cos(2 * Math.PI * (h - 4) / 24);
  function erlangC(c, a) { if (a >= c) return 1; let B = 1; for (let k = 1; k <= c; k++) B = a * B / (k + a * B); const r = a / c; return B / (1 - r * (1 - B)); }
  const curveP95 = (rho) => { const a = SEATS * rho; if (a >= SEATS) return Infinity; const C = erlangC(SEATS, a), th = (SEATS - a) / R; return C <= 0.05 ? 0 : Math.log(C / 0.05) / th; };
  const CURVE = []; for (let r = 0.5; r <= 0.995; r += 0.005) CURVE.push([r, curveP95(r)]);
  const clock = h => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };
  const fSec = w => w < 1 ? "under 1 s" : w >= 120 ? Math.round(w / 60) + " min" : Math.round(w) + " s";
  const money = v => "$" + v.toFixed(2);
  const pct = v => v < 0.01 && v > 0 ? (v * 100).toFixed(1) + "%" : Math.round(v * 100) + "%";
  const late = v => v < 0.1 ? (v * 100).toFixed(2) + "%" : (v * 100).toFixed(1) + "%";

  function newDay(s) { s.day = { t0: s.t, bill: 0, chatBill: 0, replies: 0, late: 0, energy: 0, hist: new Array(EDGES.length).fill(0), sChat: 0, sBatch: 0, sIdle: 0, sStart: 0 }; s.trace = []; }
  function init(rand) {
    const s = { rand, t: 0, h0: 5, on: 30, starting: [], Q: 0, lamE: 0, downFor: 0, noise: 0, spikes: [], parts: [], partAcc: 0, dayN: 1, lastDay: null, lastDayAt: -99, goalMet: false };
    s.lamE = lam(s, s.h0); newDay(s); return s;
  }
  const hourOf = s => (s.h0 + s.t) % 24;
  function lam(s, h) { let l = PEAK * shape(h) * (1 + (s.noise || 0)); const at = s.h0 + s.t; for (const sp of s.spikes) if (at >= sp && at < sp + 0.5) l *= SPIKE; if (h >= 11 && h < 11.5) l *= SPIKE; return l; }
  const spiking = s => { const h = hourOf(s), at = s.h0 + s.t; return (h >= 11 && h < 11.5) || s.spikes.some(sp => at >= sp && at < sp + 0.5); };

  function step(s, dt) {
    const dh = dt * DT_H; s.t += dh; const h = hourOf(s);
    s.noise = s.noise * 0.98 + (s.rand() - 0.5) * 0.012;
    const l = lam(s, h); s.lam = l;
    s.lamE += (l - s.lamE) * Math.min(1, dh / (5 / 60));
    // GPUs finishing start-up
    s.starting = s.starting.map(x => x - dh); const ready = s.starting.filter(x => x <= 0).length; s.on += ready; s.starting = s.starting.filter(x => x > 0);
    if (s.mode === "fixed") {
      if (s.on + s.starting.length < s.fixedG) for (let i = s.on + s.starting.length; i < s.fixedG; i++) s.starting.push(START);
      if (s.on > s.fixedG) s.on = s.fixedG;
      if (s.on + s.starting.length > s.fixedG) s.starting = s.starting.slice(0, Math.max(0, s.fixedG - s.on));
    } else {
      const want = Math.min(MAXG, Math.max(2, Math.ceil(s.lamE / (MU * s.target))));
      if (want > s.on + s.starting.length) for (let i = s.on + s.starting.length; i < want; i++) s.starting.push(START);
      if (want < s.on) { s.downFor += dh; if (s.downFor >= DOWN) { s.on = want; s.downFor = 0; } } else s.downFor = 0;
      if (want < s.on + s.starting.length && s.starting.length) s.starting = s.starting.slice(0, Math.max(0, want - s.on));
    }
    const on = Math.max(1, s.on), cap = on * MU, n = l * dh * 3600, D = s.day;
    let busy, waitNow, fracLate, p95now;
    if (s.Q > 0 || l >= cap) {
      s.Q = Math.max(0, s.Q + (l - cap) * dh * 3600); waitNow = s.Q / cap; busy = on * SEATS; fracLate = waitNow > Y ? 1 : 0; p95now = waitNow;
      let b = 0; while (EDGES[b + 1] <= waitNow) b++; D.hist[b] += n; s.rho = Math.min(1, l / cap);
    } else {
      const a = l / on * R, C = erlangC(SEATS, a), th = (SEATS - a) / R; busy = l * R; s.rho = a / SEATS;
      fracLate = C * Math.exp(-th * Y); waitNow = C / th; p95now = C <= 0.05 ? 0 : Math.log(C / 0.05) / th;
      D.hist[0] += n * (1 - C);
      for (let b = 0; b < EDGES.length - 1; b++) { const p0 = C * Math.exp(-th * EDGES[b]), p1 = EDGES[b + 1] === Infinity ? 0 : C * Math.exp(-th * EDGES[b + 1]); D.hist[b] += n * (p0 - p1); }
    }
    s.waitNow = waitNow; s.p95now = p95now;
    const paid = on + s.starting.length, seatsTot = paid * SEATS, bill = paid * PRICE * dh;
    const batchSeats = s.batch ? Math.max(0, s.on * SEATS * BFILL - busy) : 0, chatFrac = 1 - batchSeats / seatsTot;
    s.busy = busy; s.batchSeats = batchSeats; s.chatFrac = chatFrac;
    D.bill += bill; D.chatBill += bill * chatFrac; D.replies += n; D.late += n * fracLate;
    const busyFrac = (busy + batchSeats) / seatsTot; D.energy += paid * PMAX * (PIDLE + (1 - PIDLE) * busyFrac) * dh * chatFrac;
    D.sChat += busy * dh; D.sBatch += batchSeats * dh; D.sStart += s.starting.length * SEATS * dh; D.sIdle += Math.max(0, s.on * SEATS - busy - batchSeats) * dh;
    if (!s.trace.length || s.t - s.trace[s.trace.length - 1].t > 0.1) s.trace.push({ t: s.t - D.t0, h, l, cap: s.on * MU });
    s.idleCostNow = Math.max(0, s.on * SEATS - busy - batchSeats) / SEATS * PRICE;
    // particles: one dot per ~4 replies a second
    s.partAcc += dt * l / 4;
    while (s.partAcc >= 1) { s.partAcc -= 1; s.parts.push({ age: 0, y: s.rand(), g: Math.floor(s.rand() * on) }); }
    s.parts.forEach(p => p.age += dt); s.parts = s.parts.filter(p => p.age < 1.3);
    // end of a day
    if (s.t - D.t0 >= 24) {
      const r = summary(s); s.lastDay = r; s.lastDayAt = s.t; if (r.ok) s.goalMet = true; s.dayN++; newDay(s);
    }
  }
  function summary(s) {
    const D = s.day, rep = Math.max(1, D.replies); let cum = 0, p95 = 0;
    for (let b = 0; b < EDGES.length; b++) { cum += D.hist[b]; if (cum >= 0.95 * rep) { p95 = b === 0 ? 0 : EDGES[b + 1] === Infinity ? EDGES[b] : EDGES[b + 1]; break; } }
    const per1000 = D.chatBill / rep * 1000, lateF = D.late / rep, Wh = D.energy / rep;
    const tot = D.sChat + D.sBatch + D.sIdle + D.sStart || 1;
    return { per1000, lateF, Wh, p95, replies: D.replies, hours: (s.t - D.t0), ok: per1000 < 0.33 && lateF < 0.01, chat: D.sChat / tot, batch: D.sBatch / tot, idle: D.sIdle / tot, start: D.sStart / tot };
  }

  // ---------- drawing ----------
  const LW = { clock: [40, 84], q: { x: 40, gx: 250, y0: 160, y1: 560 }, grid: { x: 300, y: 150, cols: 10, w: 66, h: 58, gap: 12 }, bar: { x: 300, y: 640, w: 780 },
    tr: { x: 1150, y: 150, w: 400, h: 210 }, wc: { x: 1150, y: 470, w: 400, h: 200 } };
  const LN = { clock: [40, 80], q: { x: 40, gx: 150, y0: 410, y1: 730 }, grid: { x: 172, y: 400, cols: 10, w: 52, h: 46, gap: 11 }, bar: { x: 40, y: 830, w: 760 },
    tr: { x: 70, y: 150, w: 730, h: 140 }, wc: null };
  const gpuXY = (G, i) => [G.x + (i % G.cols) * (G.w + G.gap), G.y + Math.floor(i / G.cols) * (G.h + G.gap)];

  function chart(k, s, T, nar) {
    const C = k.C, X = h => T.x + (h / 24) * T.w, maxL = 180, Yv = v => T.y + T.h - Math.min(1, v / maxL) * T.h;
    k.box(T.x - 10, T.y - 10, T.w + 20, T.h + 20, { stroke: C.line, r: 10 });
    k.label(T.x, T.y - 26, nar ? "Traffic today" : "Replies asked for per second, today", { align: "left", col: C.ink, weight: "600" });
    [0, 6, 12, 18, 24].forEach(h => k.label(X(h), T.y + T.h + 22, clock(h), { col: C.muted, size: 10 }));
    if (!nar) [50, 100, 150].forEach(v => { k.line(T.x, Yv(v), T.x + T.w, Yv(v), { col: C.line, alpha: 0.5, dash: [2, 5] }); k.label(T.x - 14, Yv(v), String(v), { align: "right", col: C.muted, size: 10 }); });
    // forecast (faint)
    const fc = h => { let v = PEAK * shape(h); if (h >= 11 && h < 11.5) v *= SPIKE; return v; };
    const c = k.ctx; c.save(); c.strokeStyle = C.sig; c.globalAlpha = 0.25; c.lineWidth = k.px(1.5); c.beginPath(); for (let i = 0; i <= 240; i++) { const h = i / 10; i ? c.lineTo(X(h), Yv(fc(h))) : c.moveTo(X(h), Yv(fc(h))); } c.stroke(); c.restore();
    // past: demand and capacity, drawn since the day started (wrapping at midnight)
    const tr = s.trace; const seg = (key, col, w, dash) => { c.save(); c.strokeStyle = col; c.lineWidth = k.px(w); if (dash) c.setLineDash(dash.map(k.px)); c.beginPath(); let prev = null; for (const p of tr) { const x = X(p.h), y = Yv(p[key]); if (!prev || p.h < prev.h) c.moveTo(x, y); else c.lineTo(x, y); prev = p; } c.stroke(); c.restore(); };
    seg("cap", C.amb, 1.6, [5, 4]); seg("l", C.sig, 2.4);
    const h = hourOf(s); k.line(X(h), T.y, X(h), T.y + T.h, { col: C.ink, alpha: 0.6 }); k.dot(X(h), Yv(s.lam), k.px(4), C.sig, { glow: 8 });
    k.label(T.x + T.w, nar ? T.y - 26 : T.y + T.h + 42, nar ? "teal asked · amber can serve" : "teal = asked for · amber dashes = what your GPUs can serve", { align: "right", col: C.muted, size: 10 });
    k.label(X(11.25), T.y + 8, "spike", { col: C.muted, size: 10 });
  }
  function waitCurve(k, s, T) {
    const C = k.C, X = r => T.x + (r - 0.5) / 0.5 * T.w, maxW = 60, Yv = w => T.y + T.h - Math.min(1, w / maxW) * T.h;
    k.box(T.x - 10, T.y - 10, T.w + 20, T.h + 20, { stroke: C.line, r: 10 });
    k.label(T.x, T.y - 26, "How long the unluckiest 1 in 20 waits", { align: "left", col: C.ink, weight: "600" });
    [0.5, 0.6, 0.7, 0.8, 0.9, 1].forEach(r => k.label(X(r), T.y + T.h + 22, Math.round(r * 100) + "%", { col: C.muted, size: 10 }));
    k.label(T.x + T.w / 2, T.y + T.h + 42, "how full each GPU's seats are", { col: C.muted, size: 10 });
    [5, 30, 60].forEach(v => { k.line(T.x, Yv(v), T.x + T.w, Yv(v), { col: v === 5 ? C.amb : C.line, alpha: v === 5 ? 0.6 : 0.5, dash: [2, 5] }); k.label(T.x - 14, Yv(v), v + " s", { align: "right", col: v === 5 ? C.amb : C.muted, size: 10 }); });
    const c = k.ctx; c.save(); c.strokeStyle = C.ink; c.globalAlpha = 0.85; c.lineWidth = k.px(2); c.beginPath(); CURVE.forEach(([r, w], i) => { const y = Yv(w); i ? c.lineTo(X(r), y) : c.moveTo(X(r), y); }); c.stroke(); c.restore();
    const r = Math.max(0.5, Math.min(0.995, s.rho || 0)), w = s.Q > 0 ? s.waitNow : curveP95(r);
    const hot = s.Q > 0 || w > Y;
    k.dot(X(r), Yv(w), k.px(7), hot ? C.crit : C.sig, { glow: 14 });
    k.label(X(r), Yv(w) - 18, s.Q > 0 ? "overloaded" : "you", { col: hot ? C.crit : C.sig, size: 11, weight: "700", bg: true });
  }

  function draw(k, s, sim) {
    const C = k.C, nar = sim.narrow, L = nar ? LN : LW, G = L.grid, Q = L.q, on = s.on, st = s.starting.length;
    k.label(L.clock[0], L.clock[1], `Day ${s.dayN} · ${clock(hourOf(s))}${spiking(s) ? " · spike" : ""}`, { align: "left", col: spiking(s) ? C.amb : C.ink, size: nar ? 15 : 17, weight: "700" });
    if (!nar) k.label(L.clock[0] + 370, L.clock[1], `${Math.round(s.lam)} replies asked for per second · one second here is 20 minutes`, { align: "left", col: C.muted, size: 12 });
    chart(k, s, L.tr, nar);
    if (L.wc) waitCurve(k, s, L.wc);
    // GPUs
    k.label(G.x, G.y - 22, `${on} GPUs on${st ? ` · ${st} starting` : ""}${s.mode === "auto" ? " · autoscaling" : ""}`, { align: "left", col: C.ink, weight: "600" });
    const perChat = Math.min(1, s.busy / Math.max(1, on) / SEATS), perBatch = Math.min(1 - perChat, s.batchSeats / Math.max(1, on) / SEATS);
    for (let i = 0; i < MAXG; i++) {
      const [x, y] = gpuXY(G, i);
      if (i < on) {
        const wob = s.Q > 0 ? 0 : 0.06 * Math.sin(i * 7.3 + s.t * 9), fc = Math.max(0, Math.min(1, perChat * (1 + wob))), fb = Math.min(1 - fc, perBatch);
        k.box(x, y, G.w, G.h, { fill: C.bg2, stroke: fc > 0.97 ? C.crit : C.line, r: 8 });
        const ih = G.h - 8; if (fc > 0) k.box(x + 4, y + 4 + ih * (1 - fc), G.w - 8, ih * fc, { fill: C.sig, r: 5, alpha: 0.75 });
        if (fb > 0.01) k.box(x + 4, y + 4 + ih * (1 - fc - fb), G.w - 8, ih * fb, { fill: BATCH, r: 5, alpha: 0.55 });
      } else if (i < on + st) {
        const prog = 1 - s.starting[i - on] / START;
        k.box(x, y, G.w, G.h, { stroke: C.amb, r: 8, dash: [4, 4], lw: 1.3 });
        k.box(x + 6, y + G.h - 12, (G.w - 12) * prog, 5, { fill: C.amb, r: 2 });
      } else k.box(x, y, G.w, G.h, { stroke: C.muted, r: 8, alpha: 0.35, dash: [2, 5], lw: 1 });
    }
    // arrivals and queue
    const gate = [Q.gx, (Q.y0 + Q.y1) / 2];
    for (const p of s.parts) {
      const sy = Q.y0 + p.y * (Q.y1 - Q.y0);
      if (p.age < 0.6) { const u = p.age / 0.6, x = lerp(Q.x, gate[0], u), y = lerp(sy, gate[1], easeIO(u)); k.dot(x, y, k.px(nar ? 3 : 3.5), C.sig, { glow: 6, alpha: 0.9 }); }
      else if (s.Q <= 0) { const u = (p.age - 0.6) / 0.7, gi = Math.min(on - 1, p.g), [gx, gy] = gpuXY(G, gi), x = lerp(gate[0], gx + G.w / 2, easeOut(u)), y = lerp(gate[1], gy + G.h / 2, easeOut(u)); k.dot(x, y, k.px(nar ? 2.5 : 3), C.sig, { alpha: 1 - u * 0.7 }); }
    }
    const qn = s.Q > 0 ? Math.min(48, Math.ceil(s.Q / 150)) : 0;
    for (let i = 0; i < qn; i++) { const x = gate[0] - 20 - (i % 4) * 18, y = Q.y1 - 10 - Math.floor(i / 4) * 18; k.dot(x, y, k.px(nar ? 3.5 : 4.5), C.amb, { glow: 6 }); }
    k.label(gate[0] - 46, Q.y1 + 22, s.Q > 0 ? `${Math.round(s.Q).toLocaleString()} waiting` : "nobody queued", { col: s.Q > 0 ? C.amb : C.muted, size: 11, weight: "600" });
    k.box(gate[0] - 4, gate[1] - 26, 8, 52, { fill: s.Q > 0 ? C.amb : C.sig, r: 4, alpha: 0.7 });
    // where today's GPU time went
    const B = L.bar, sm = summary(s), parts = [[sm.chat, C.sig, "chat"], [sm.batch, BATCH, "batch jobs"], [sm.idle, C.crit, "empty seats"], [sm.start, C.amb, "starting up"]];
    k.label(B.x, B.y - 18, nar ? "Today's GPU time" : "Where today's paid GPU time went", { align: "left", col: C.ink, weight: "600" });
    let x0 = B.x; parts.forEach(([f, col]) => { if (f > 0.002) { k.box(x0, B.y, B.w * f, 22, { fill: col, r: 4, alpha: col === C.crit ? 0.45 : 0.75 }); x0 += B.w * f; } });
    let lx = B.x; parts.forEach(([f, col, name]) => { const t = `${name} ${Math.round(f * 100)}%`; const i = parts.findIndex(p => p[2] === name), px = nar ? B.x + (i % 2) * 380 : lx, py = nar ? B.y + 42 + Math.floor(i / 2) * 30 : B.y + 42; k.label(px, py, t, { align: "left", col: col === C.crit ? C.muted : col, size: 11, weight: "600" }); lx += 170; });
  }

  const sim = makeSim($("#cost-sim"), {
    label: "A fleet of up to 60 GPUs through one sped-up day. Dots are people asking for replies; boxes are GPUs, filled teal by chat and blue by batch jobs. Charts show traffic through the day and how waiting grows as GPUs fill up.",
    cams: { default: { x: 20, y: 60, w: 1560, h: 740 } },
    camsNarrow: { default: { x: 20, y: 50, w: 810, h: 880 } },
    height: w => w < 640 ? Math.round(Math.max(380, w * 1.1)) : Math.round(Math.min(580, Math.max(380, w * 0.5))),
    init, warmup: 2, speeds: [1, 4],
    intro: "It's 5 am and traffic is low. Each second here is 20 minutes of the day. Change the fleet and watch the day play out.",
    controls: [
      { id: "mode", label: "How many GPUs to run", type: "choice", value: "fixed", options: [["fixed", "A fixed number"], ["auto", "Autoscale"]], help: "Autoscale adds and removes GPUs as traffic changes.", apply: (s, v) => { s.mode = v; } },
      { id: "gpus", label: "Fixed number of GPUs", type: "range", min: 4, max: MAXG, step: 1, value: 30, fmt: v => v + " GPUs", help: "Used when the fleet is fixed.", apply: (s, v) => { s.fixedG = v; } },
      { id: "target", label: "Autoscale: how full to run each GPU", type: "range", min: 40, max: 100, step: 5, value: 90, fmt: v => v + "%", help: "Higher is cheaper, but leaves less room for surprises.", apply: (s, v) => { s.target = v / 100; } },
      { id: "batch", label: "Fill empty seats with batch jobs", type: "toggle", value: false, help: "Non-urgent work that steps aside when a chat needs the seat.", apply: (s, v) => { s.batch = v; } },
      { id: "spike", label: "Cause a traffic spike", type: "button", help: "70% more traffic for 30 minutes, starting now.", apply: s => { s.spikes.push(s.h0 + s.t); } }
    ],
    step, draw,
    stats: s => { const sm = summary(s), tv = sm.Wh * TV_S_PER_WH; return [
      ["GPUs on" + (s.starting.length ? ` (+${s.starting.length} starting)` : ""), String(s.on)],
      ["how full the seats are", pct(Math.min(1, s.rho || 0)), s.Q > 0 || s.rho > 0.9 ? "bad" : s.rho > 0.8 ? "hot" : "ok"],
      ["1 in 20 waits longer than", fSec(s.p95now), s.p95now > Y ? "bad" : "ok"],
      ["per 1,000 replies today*", money(sm.per1000), sm.per1000 < 0.33 ? "ok" : sm.per1000 > 0.45 ? "hot" : ""],
      ["energy per reply* ≈ " + tv.toFixed(1) + " s of TV", sm.Wh.toFixed(2) + " Wh"]]; },
    goal: { text: "get through a whole day for under $0.33 per 1,000 replies, with fewer than 1 in 100 people waiting over 5 seconds",
      check: s => { const sm = summary(s); return { done: s.goalMet, progress: s.lastDay && !s.goalMet ? `last day: ${money(s.lastDay.per1000)} · ${late(s.lastDay.lateF)} waited` : `${Math.round(sm.hours)} of 24 hours · ${money(sm.per1000)} · ${late(sm.lateF)} waited over 5 s` }; } },
    notices: [
      { id: "dayEnd", when: s => s.lastDay && s.t - s.lastDayAt < 2.5, say: s => { const d = s.lastDay; return d.ok ? `Day done: <b>${money(d.per1000)}</b> per 1,000 replies and only ${late(d.lateF)} of ${Math.round(d.replies / 1e6 * 10) / 10} million people waited over 5 s. Goal reached.` : `Day done: ${money(d.per1000)} per 1,000 replies, ${late(d.lateF)} waited over 5 s, and ${Math.round(d.idle * 100)}% of the GPU time you paid for sat empty. ${d.lateF >= 0.01 ? "Too many waited: you need more room for the peak and the spike." : "Too expensive: the empty seats cost money."}`; } },
      { id: "backlog", when: s => s.Q > 0, say: s => `More people than seats: <b>${Math.round(s.Q).toLocaleString()}</b> are queued and new arrivals wait about ${fSec(s.waitNow)}. ${s.mode === "auto" ? (s.starting.length ? `${s.starting.length} new GPUs are starting, but loading the model takes 10 minutes, so autoscaling can't catch a sudden jump.` : "The autoscaler's target leaves no room for this.") : "This fleet is too small for this moment."}` },
      { id: "steep", when: s => s.rho >= 0.86, say: s => `Each GPU's seats are <b>${pct(s.rho)}</b> full. Near 100%, waits shoot up: a chat that arrives when every seat is taken has to wait for one to free, and that gets likelier very fast. The unluckiest 1 in 20 now wait ${fSec(s.p95now)}.` },
      { id: "starting", when: s => s.mode === "auto" && s.starting.length > 0, say: s => `Traffic is rising, so the autoscaler is starting ${s.starting.length} more GPU${s.starting.length > 1 ? "s" : ""} (dashed). Each takes 10 minutes to load the model, and you pay from the moment it starts.` },
      { id: "idle", when: s => !s.batch && s.rho < 0.55, say: s => `Only ${pct(s.rho)} of the seats are in use, but you pay for every GPU-hour: about <b>${money(s.idleCostNow)}</b> an hour right now goes on empty seats. Fewer GPUs, autoscaling, or batch work would cut that.` },
      { id: "batch", when: s => s.batch, say: s => `Batch jobs (blue) fill seats the chats aren't using and hand them back the moment a chat needs one. They share the bill, so a chat reply now costs ${money(summary(s).per1000)} per 1,000, and far less GPU time goes to waste.` },
      { id: "spike", when: s => spiking(s), say: s => `A spike: traffic jumped 70% in a minute. ${s.Q > 0 ? "" : "Your spare room absorbed it."}` },
      { id: "calm", when: () => true, say: s => `It's ${clock(hourOf(s))} and ${Math.round(s.lam)} replies a second are being asked for. Traffic peaks in the afternoon at about three times the night-time low, and a spike hits at 11:00.` }
    ],
    facts: [
      { id: "energy", when: s => s.t > 3, text: "Google measured the energy for a typical text prompt to its Gemini assistant at 0.24 watt-hours, counting the whole datacenter: less than a TV uses in nine seconds.", ref: "#ref-901" },
      { id: "batch", when: s => s.batch, text: "Providers sell spare capacity this way. Anthropic, for example, charges half price for requests sent as a batch, which finish within 24 hours and usually in under one.", ref: "#ref-902" }
    ],
    tour: [
      { say: "A fixed fleet of 30 GPUs, enough for most of the day. It's 9 am, traffic is climbing, and a spike is due at 11:00.", set: { mode: "fixed", gpus: 30, batch: false }, act: s => jump(s, 9.4), wait: 8 },
      { say: "The afternoon peak and the spike overflow it. People queue (amber) and waits grow to minutes.", wait: 5 },
      { say: "So buy for the worst moment: 46 GPUs. Nobody waits, but at night most seats are empty (red in the bar) and you still pay.", set: { gpus: 46 }, act: s => jump(s, 0.5), wait: 8 },
      { say: "Autoscaling at 90% full follows traffic, so far less is wasted. But when the spike hits, new GPUs take 10 minutes to start.", set: { mode: "auto", target: 90 }, act: s => jump(s, 10.4), wait: 9 },
      { say: "Run each GPU only 55% full: enough room to absorb the spike while new GPUs start. No more queue, but nearly half of every GPU sits empty.", set: { target: 55 }, act: s => jump(s, 10.4), wait: 9 },
      { say: "Now fill that spare room with batch jobs. The headroom stays, the waste goes, and the cost per reply falls.", set: { batch: true }, wait: 7 }
    ],
    publish: s => { const sm = summary(s), d = s.lastDay; return {
      cstGPUs: String(s.on), cstFull: pct(Math.min(1, s.rho || 0)), cstPer: money(sm.per1000), cstPerReply: "$" + (sm.per1000 / 1000).toFixed(5), cstWh: sm.Wh.toFixed(2) + " Wh", cstTV: (sm.Wh * TV_S_PER_WH).toFixed(1) + " seconds", cstIdle: Math.round(sm.idle * 100) + "%",
      cstLate: late(sm.lateF), cstP95: fSec(s.p95now), cstReplies: Math.round(sm.replies).toLocaleString(), cstHours: String(Math.round(sm.hours)) }; }
  });
  function jump(s, h) { s.h0 = h - s.t; s.Q = 0; s.lamE = lam(s, h); s.trace = []; newDay(s); }
});
