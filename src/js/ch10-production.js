/* Chapter 10 · Production. You roll a new model version out to a live fleet and watch the dashboard.
   Illustrative model (numbers are made up, time is sped up):
   - 400 replies a second arrive and are split by a router between the old and the new version.
   - 24 servers on three chip types (A, B, C). Servers switch to the new version in the order A0 B0 C0 A1 B1 C1 ...,
     so a tiny canary (1 or 2 servers) never touches chip C.
   - Hidden fault: on chip C, the new version garbles 4% of replies (rare wrong tokens). Errors and speed are unaffected:
     a garbled reply is still a "successful" reply. Only the quality check (an automatic grader reading a sample of
     replies, 4 s later) and thumbs-down (slow, noisy) can see it.
   - After a rollback that has evidence (flags or reports), engineers find the cause and ship a fixed build 12 s later. */
chapter("production", () => {
  const R = 400, SERVERS = 24, PER_ROW = 8, FAULT = 0.04, LIMIT = 20;
  const GRADE = { new: 1 / 2, old: 1 / 50 }, DETECT = 0.9, FLAG_DELAY = 4, THUMB_DELAY = 6;
  const WARM = 12, MIN_REP = 100;               // warm-up seconds; replies needed before a rate is shown
  const BASE_ERR = 0.003, BASE_THUMB = 0.02, FALSE_FLAG = 0.00002;
  const STEPS = [0, 0.01, 0.05, 0.10, 0.25, 0.50, 1];          // slider stops
  const PLAN = [0.01, 0.05, 0.25, 0.50, 1], STAGE_S = 12;         // the careful plan
  const ORDER = []; for (let j = 0; j < PER_ROW; j++) for (let r = 0; r < 3; r++) ORDER.push(r * PER_ROW + j); // A0 B0 C0 A1 ...
  const WIN = 20, BUCKET = 0.5, HIST = 80;                        // 10 s window of 0.5 s buckets; 40 s of history
  const chipName = ["A", "B", "C"];
  const pct = a => a <= 0 ? "0%" : a < 0.995 && a * 100 < 10 ? (a * 100).toFixed(a * 100 < 2 ? 1 : 0).replace(/\.0$/, "") + "%" : Math.round(a * 100) + "%";

  function pois(l, r) { if (l <= 0) return 0; if (l > 25) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss(r))); const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; }
  const emptyB = () => ({ rep: 0, err: 0, graded: 0, flag: 0, thumb: 0, ttft: 0 });
  function init(rand) {
    const s = { t: 0, rand, a: 0, target: 0, fault: true, fixed: false, garbled: 0, flagsSeen: 0, thumbsGarbled: 0,
      halted: false, fixAt: 0, rollbacks: 0, lastRb: null, stage: 0, stageT: 0, shippedFor: 0, won: false,
      pending: [], sparks: [], cur: { new: emptyB(), old: emptyB() }, win: [], bt: 0, firstBad: -1, lastT: 0,
      hist: { err: { new: [], old: [] }, ttft: { new: [], old: [] }, qual: { new: [], old: [] }, thumb: { new: [], old: [] } },
      m: { err: {}, ttft: {}, qual: {}, thumb: {} }, phase: 0, ready: false, plan: "hand", watch: "es" };
    return s;
  }
  const newServers = a => a > 0.001 ? Math.min(SERVERS, Math.max(1, Math.round(a * SERVERS))) : 0;
  const isNew = (s, i) => ORDER.indexOf(i) < newServers(s.a);
  const cFrac = s => { const n = newServers(s.a); if (!n) return 0; let c = 0; for (let j = 0; j < n; j++) if (ORDER[j] >= 16) c++; return c / n; };
  const badRate = s => s.fault ? cFrac(s) * FAULT : 0;     // share of the new version's replies that are garbled
  const watching = (s, key) => (s.watch === "esq" && key === "qual") || ((s.watch === "es" || s.watch === "esq") && (key === "err" || key === "ttft"));

  function windowSum(s, v, f) { let x = 0; for (const b of s.win) x += b[v][f]; return x + s.cur[v][f]; }
  function metrics(s) {
    const m = {};
    ["new", "old"].forEach(v => {
      const rep = windowSum(s, v, "rep"), gr = windowSum(s, v, "graded");
      m[v] = { rep, err: rep >= MIN_REP ? windowSum(s, v, "err") / rep * 1000 : null, errN: windowSum(s, v, "err"),
        qual: gr > 3 ? windowSum(s, v, "flag") / gr * 1000 : null, flagN: windowSum(s, v, "flag"),
        thumb: rep >= MIN_REP ? windowSum(s, v, "thumb") / rep * 1000 : null, ttft: rep > 1 ? windowSum(s, v, "ttft") / rep : null };
    });
    return m;
  }

  function rollback(s, sim, auto, reason) {
    if (s.target === 0 && s.a < 0.001) return;
    s.target = 0; s.rollbacks++; s.stage = 0; s.stageT = 0;
    const lead = s.fault && (s.flagsSeen >= 1 || s.thumbsGarbled >= 3 || s.garbled >= 8);
    s.lastRb = { t: s.t, auto, reason, lead, garbled: s.garbled, T: s.firstBad >= 0 ? s.t - s.firstBad : 0 };
    if (lead) { s.halted = true; s.fixAt = s.t + 12; }
    else if (s.plan !== "hand") { s.driving = true; sim.set("plan", "hand"); s.driving = false; }
    s.driving = true; sim.set("share", 0); s.driving = false;
  }

  function step(s, dt, sim) {
    // a fresh start (or Reset) always begins with everyone on the old version; a chosen plan starts after the warm-up
    if (!s.ready && sim.v.share !== 0) { s.driving = true; sim.set("share", 0); s.driving = false; }
    s.t += dt; s.phase += dt;
    // rollout plan
    if (!s.halted && s.ready && s.t >= WARM + 0.5) {
      if (s.plan === "fast" && s.target < 1) { s.driving = true; sim.set("share", 6); s.driving = false; }
      if (s.plan === "careful") {
        if (Math.abs(s.a - s.target) < 0.002) s.stageT += dt;
        if (s.target === 0 || (s.stageT >= STAGE_S && s.stage < PLAN.length - 1)) {
          if (s.target !== 0) s.stage++; s.stageT = 0;
          s.driving = true; sim.set("share", STEPS.indexOf(PLAN[s.stage])); s.driving = false;
        }
      }
    }
    // the fix arrives
    if (s.halted && s.fixAt && s.t >= s.fixAt && s.a < 0.001) {
      s.fault = false; s.fixed = true; s.halted = false; s.fixAt = 0; s.stage = 0; s.stageT = 0; s.fixedAtT = s.t;
      s.win = []; s.cur = { new: emptyB(), old: emptyB() }; s.pending = s.pending.filter(p => p.v !== "new"); // a new build starts with fresh numbers
    }
    // servers switch over gradually; rollback is quicker than rollout
    const up = 0.3, down = 0.8;
    s.a = s.target > s.a ? Math.min(s.target, s.a + up * dt) : Math.max(s.target, s.a - down * dt);
    // traffic
    const r = s.rand;
    ["new", "old"].forEach(v => {
      const share = v === "new" ? s.a : 1 - s.a, rep = R * share * dt; if (rep <= 0) return;
      const b = s.cur[v]; b.rep += rep; b.err += pois(rep * BASE_ERR, r);
      b.ttft += rep * ((v === "new" ? 0.42 : 0.45) + 0.03 * gauss(r) / Math.sqrt(1 + rep));
      b.graded += rep * GRADE[v]; b.thumb += pois(rep * BASE_THUMB, r);
      const ff = pois(rep * GRADE[v] * FALSE_FLAG, r); if (ff) s.pending.push({ due: s.t + FLAG_DELAY, v, kind: "flag", n: ff, real: false });
    });
    const g = pois(R * s.a * badRate(s) * dt, r);
    for (let i = 0; i < g; i++) {
      s.garbled++; if (s.firstBad < 0 || (s.lastRb && s.firstBad < s.lastRb.t)) s.firstBad = s.t;
      const cs = []; for (let j = 0; j < newServers(s.a); j++) if (ORDER[j] >= 16) cs.push(ORDER[j]);
      s.sparks.push({ t: s.t, srv: cs[Math.floor(r() * cs.length)] });
      if (r() < GRADE.new && r() < DETECT) s.pending.push({ due: s.t + FLAG_DELAY, v: "new", kind: "flag", n: 1, real: true });
      if (r() < 0.3) s.pending.push({ due: s.t + THUMB_DELAY, v: "new", kind: "thumb", n: 1, real: true });
    }
    s.pending = s.pending.filter(p => {
      if (p.due > s.t) return true;
      if (p.kind === "flag") { s.cur[p.v].flag += p.n; if (p.real) s.flagsSeen++; } else { s.cur[p.v].thumb += p.n; if (p.real) s.thumbsGarbled++; }
      return false;
    });
    s.sparks = s.sparks.filter(sp => s.t - sp.t < 1.4);
    // buckets, metrics, history, automatic rollback
    s.bt += dt;
    if (s.bt >= BUCKET) {
      s.bt = 0; s.win.push(s.cur); if (s.win.length > WIN) s.win.shift(); s.cur = { new: emptyB(), old: emptyB() };
      const m = metrics(s); s.m = m;
      ["err", "ttft", "qual", "thumb"].forEach(key => ["new", "old"].forEach(v => { const h = s.hist[key][v]; h.push(m[v][key]); if (h.length > HIST) h.shift(); }));
      if (s.a > 0.001 && s.target > 0) {
        const n = m.new, o = m.old;
        if (watching(s, "qual") && n.qual != null && n.flagN >= 2 && n.qual >= 3) rollback(s, sim, true, "quality");
        else if (watching(s, "err") && n.err != null && n.errN >= 8 && n.err > 2 * (o.err != null ? o.err : BASE_ERR * 1000) + 5) rollback(s, sim, true, "errors");
        else if (watching(s, "ttft") && n.ttft != null && o.ttft != null && n.ttft > 1.5 * o.ttft) rollback(s, sim, true, "speed");
      }
    }
    s.shippedFor = s.fixed && s.a > 0.999 ? s.shippedFor + dt : 0;
    if (s.shippedFor >= 5 && s.garbled <= LIMIT) s.won = true;
    s.ready = true;
  }

  // ---------- drawing ----------
  const WIDE = { people: [60, 380], router: [240, 380], rowsY: [170, 380, 590], sx0: 380, sw: 46, sgap: 12, outX: 880,
    dash: [[950, 30], [1272, 30], [950, 400], [1272, 400]], pw: 306, ph: 340 };
  const NARROW = { people: [450, 40], router: [450, 120], rowsY: [250, 360, 470], sx0: 150, sw: 64, sgap: 22, outX: 860,
    dash: [[20, 570], [462, 570], [20, 940], [462, 940]], pw: 420, ph: 350 };
  const srvXY = (L, i) => [L.sx0 + (i % PER_ROW) * (L.sw + L.sgap), L.rowsY[Math.floor(i / PER_ROW)] - L.sw / 2];
  const PANELS = [
    { key: "err", title: "Errors", sub: "failed, per 1,000 replies", note: "blind to bad content", max: 20, thr: 10, fmt: v => v.toFixed(1) },
    { key: "ttft", title: "Speed", sub: "seconds to the first word", note: "new version starts faster", max: 1, thr: 0.65, fmt: v => v.toFixed(2) + " s" },
    { key: "qual", title: "Quality check", sub: "garbled, per 1,000 read", note: "reads 1 in 2 new replies", max: 30, thr: 3, fmt: v => v.toFixed(1) },
    { key: "thumb", title: "Thumbs-down", sub: "per 1,000 replies", note: "from people: slow, noisy", max: 50, thr: null, fmt: v => v.toFixed(0) }
  ];

  function series(k, pts, x, y, w, h, max, col, lw) {
    const c = k.ctx; c.save(); c.strokeStyle = col; c.lineWidth = k.px(lw); c.lineJoin = "round"; c.beginPath(); let on = false;
    pts.forEach((v, i) => { if (v == null) { on = false; return; } const px = x + (i + HIST - pts.length) / (HIST - 1) * w, py = y + h - Math.min(1, v / max) * h; if (!on) { c.moveTo(px, py); on = true; } else c.lineTo(px, py); });
    c.stroke(); c.restore();
  }
  function panel(k, s, P, x, y, w, h, narrow) {
    const C = k.C, watched = watching(s, P.key), ex = s.hist[P.key];
    k.box(x, y, w, h, { fill: C.bg2, stroke: watched ? C.amb : C.line, r: 14, alpha: 0.95, lw: watched ? 1.6 : 1 });
    k.label(x + 16, y + 22, P.title, { align: "left", col: C.ink, weight: "650", size: narrow ? 11 : 13 });
    if (!narrow) k.label(x + 16, y + 44, P.sub, { align: "left", col: C.muted, size: 11 });
    if (watched) k.label(x + w - 14, y + 22, "watched", { align: "right", col: C.amb, size: 10, weight: "600" });
    const px = x + 16, py = y + (narrow ? 50 : 66), pw = w - 32, ph = h - (narrow ? 110 : 130);
    k.line(px, py + ph, px + pw, py + ph, { col: C.line, lw: 1 });
    k.line(px, py, px + pw, py, { col: C.line, lw: 1, dash: [2, 5], alpha: 0.6 });
    if (P.thr != null) { k.line(px, py + ph - P.thr / P.max * ph, px + pw, py + ph - P.thr / P.max * ph, { col: C.crit, lw: 1.3, dash: [6, 5], alpha: watched ? 0.85 : 0.3 }); }
    series(k, ex.old, px, py, pw, ph, P.max, C.muted, 2);
    series(k, ex.new, px, py, pw, ph, P.max, C.amb, 2.6);
    const n = s.m.new ? s.m.new[P.key] : null, o = s.m.old ? s.m.old[P.key] : null;
    const yy = y + h - (narrow ? 34 : 40);
    k.label(px, yy, "new " + (n == null ? "–" : P.fmt(n)), { align: "left", col: C.amb, size: narrow ? 11 : 12, weight: "650", mono: true });
    k.label(px + pw, yy, "old " + (o == null ? "–" : P.fmt(o)), { align: "right", col: C.muted, size: narrow ? 11 : 12, weight: "600", mono: true });
    if (!narrow) k.label(px, yy + 20, P.note, { align: "left", col: C.muted, size: 10 });
    if (n == null && s.a > 0.001 && s.target > 0) k.label(px + pw / 2, py + ph / 2, "too few new replies to judge", { col: C.amb, size: narrow ? 10 : 11, bg: true });
  }

  function draw(k, s, sim) {
    const C = k.C, narrow = sim.narrow, L = narrow ? NARROW : WIDE, t = s.phase;
    const [rx, ry] = L.router;
    // people -> router
    if (!narrow) {
      for (let i = 0; i < 9; i++) k.dot(L.people[0], 190 + i * 48, 7, C.sig, { alpha: 0.5 });
      k.label(L.people[0], 140, "people", { col: C.muted });
      for (let i = 0; i < 9; i++) { const y0 = 190 + i * 48; k.flow(u => [lerp(L.people[0] + 10, rx - 60, u), lerp(y0, ry, u)], 1, (t * 0.5 + i * 0.27) % 1, C.sig, { size: 2.4, alpha: 0.6 }); }
    } else {
      for (let i = 0; i < 9; i++) k.dot(130 + i * 80, 40, 9, C.sig, { alpha: 0.5 });
      for (let i = 0; i < 9; i++) { const x0 = 130 + i * 80; k.flow(u => [lerp(x0, rx, u), lerp(52, ry - 30, u)], 1, (t * 0.5 + i * 0.27) % 1, C.sig, { size: 2.6, alpha: 0.6 }); }
    }
    // router -> servers
    for (let i = 0; i < SERVERS; i++) {
      const [x, y] = srvXY(L, i), nw = isNew(s, i), cy = y + L.sw / 2;
      const p = narrow ? [[rx, ry + 30], [rx, ry + 80], [x + L.sw / 2, y - 60], [x + L.sw / 2, y]] : [[rx + 60, ry], [rx + 140, ry], [x - 90, cy], [x, cy]];
      if (!narrow || i < PER_ROW) k.curve(p, { col: nw ? C.amb : C.line, lw: 1, alpha: nw ? 0.5 : 0.35 });
      if (!narrow || i < PER_ROW) k.flow(u => bez(p, u), 1, (t * 0.55 + i * 0.137) % 1, nw ? C.amb : C.sig, { size: 2.6, alpha: 0.8 });
    }
    // router
    k.box(rx - 60, ry - 34, 120, 68, { fill: C.bg2, stroke: C.sig, r: 12, lw: 1.4 });
    k.label(rx, ry - 10, "router", { col: C.ink, weight: "650", size: 12 });
    k.label(rx, ry + 10, pct(s.a) + " to new", { col: s.a > 0 ? C.amb : C.muted, size: 11, weight: "600", mono: true });
    if (!narrow) {
      const planTxt = s.halted ? (s.fixAt ? `rolled back · fix in ${Math.max(0, Math.ceil(s.fixAt - s.t))} s` : "rolled back")
        : s.plan === "careful" ? `in steps · step ${s.stage + 1} of ${PLAN.length}` : s.plan === "fast" ? "all at once" : "by hand";
      k.label(rx, ry + 56, planTxt, { col: s.halted ? C.crit : C.muted, size: 11 });
      if (s.plan === "careful" && !s.halted && s.stage < PLAN.length - 1) { k.box(rx - 50, ry + 70, 100, 4, { fill: C.line, r: 2 }); k.box(rx - 50, ry + 70, 100 * clamp01(s.stageT / STAGE_S), 4, { fill: C.amb, r: 2 }); }
    }
    // servers
    const sparkOn = new Set(s.sparks.filter(sp => s.t - sp.t < 0.5).map(sp => sp.srv));
    for (let r = 0; r < 3; r++) {
      const y = L.rowsY[r];
      k.label(narrow ? L.sx0 - 18 : L.sx0 - 16, y - L.sw / 2 - 14, "chip type " + chipName[r], { align: "left", col: C.muted, size: 11, weight: "600" });
      // replies leaving the row
      const x1 = L.sx0 + PER_ROW * (L.sw + L.sgap) - L.sgap;
      if (!narrow) { k.line(x1 + 6, y, L.outX, y, { col: C.line, lw: 1, alpha: 0.6 }); k.flow(u => [lerp(x1 + 6, L.outX, u), y], 3, (t * 0.6 + r * 0.31) % 1, C.sig, { size: 2.4, alpha: 0.7 }); }
    }
    for (let i = 0; i < SERVERS; i++) {
      const [x, y] = srvXY(L, i), nw = isNew(s, i), hot = sparkOn.has(i);
      k.box(x, y, L.sw, L.sw, { fill: nw ? C.amb : C.bg2, stroke: hot ? C.crit : nw ? C.amb : C.line, r: 9, lw: hot ? 2.4 : 1.2, alpha: nw ? 0.9 : 1, glow: hot ? 18 : nw ? 6 : 0, glowCol: hot ? C.crit : C.amb });
      if (!narrow) k.label(x + L.sw / 2, y + L.sw / 2, nw ? "new" : "old", { col: nw ? C.bg : C.muted, size: 10, weight: "650" });
    }
    if (!narrow) k.label(L.outX + 10, 120, "replies to people", { col: C.muted, align: "right" });
    // garbled replies: red sparks flying out of chip C servers
    s.sparks.forEach(sp => {
      const [x, y] = srvXY(L, sp.srv), u = (s.t - sp.t) / 1.4, cy = y + L.sw / 2;
      if (narrow) { k.dot(x + L.sw / 2, y + L.sw + 8 + u * 40, 4, C.crit, { alpha: 1 - u, glow: 10 }); return; }
      const xe = L.outX, x0 = x + L.sw, xx = lerp(x0, xe, easeOut(u));
      k.trail([[Math.max(x0, xx - 50), cy + 6], [Math.max(x0, xx - 20), cy + 6], [xx, cy + 6]], C.crit, { w: 3, alpha: 1 - u * 0.6 });
      k.dot(xx, cy + 6, 4.5, C.crit, { glow: 12, alpha: 1 - u * 0.5 });
    });
    if (!narrow && s.sparks.length) k.label(L.outX - 4, L.rowsY[2] + 46, "garbled reply", { col: C.crit, align: "right", size: 11, weight: "600" });
    // dashboard
    if (!narrow) k.label(L.dash[0][0], 14, "Dashboard · last 40 s · amber = new version, grey = old version", { align: "left", col: C.ink, size: 12, weight: "600" });
    else k.label(20, 548, "Dashboard · amber = new, grey = old", { align: "left", col: C.ink, size: 12, weight: "600" });
    PANELS.forEach((P, i) => panel(k, s, P, L.dash[i][0], L.dash[i][1], L.pw, L.ph, narrow));
    // budget bar
    const bx = narrow ? 20 : 120, by = narrow ? 1330 : 730, bw = narrow ? 862 : 760;
    k.box(bx, by, bw, 10, { fill: C.line, r: 5, alpha: 0.6 });
    k.box(bx, by, bw * Math.min(1, s.garbled / LIMIT), 10, { fill: s.garbled > LIMIT ? C.crit : C.amb, r: 5 });
    k.label(bx, by - 16, `garbled replies that reached people: ${s.garbled} of ${LIMIT} allowed`, { align: "left", col: s.garbled > LIMIT ? C.crit : C.ink, size: 12, weight: "600" });
  }

  const m = (s, v, key) => s.m[v] && s.m[v][key] != null ? s.m[v][key] : null;
  const f1 = x => x == null ? "–" : x.toFixed(1);
  const sim = makeSim($("#prod-sim"), {
    label: "Production rollout simulation. A router sends a share of live traffic to servers running a new model version (amber). Four dashboard charts compare the new and old versions. Red sparks are garbled replies.",
    cams: { default: { x: 0, y: 0, w: 1600, h: 760 } },
    camsNarrow: { default: { x: 0, y: 0, w: 902, h: 1350 } },
    height: w => w < 640 ? Math.round(w * 1.45) : Math.round(Math.min(600, Math.max(400, w * 0.48))),
    init, warmup: WARM, speeds: [1, 3],
    intro: "Everyone is on the old version. Pick a rollout plan, or drag the slider, to start sending people to the new one.",
    controls: [
      { id: "plan", label: "Rollout plan", type: "choice", value: "hand", options: [["hand", "By hand"], ["careful", "In steps"], ["fast", "All at once"]],
        help: "In steps: 1% → 5% → 25% → 50% → 100%, pausing 12 s to watch each one.",
        apply: (s, v) => { const ch = s.plan !== v; s.plan = v; if (ch && !s.driving) { s.stage = 0; s.stageT = 0; if (v === "careful" && !s.halted) s.target = 0; } } },
      { id: "share", label: "Traffic on the new version", type: "range", min: 0, max: 6, step: 1, value: 0, fmt: v => pct(STEPS[v]),
        apply: (s, v, sim) => { s.target = STEPS[v]; if (s.ready && !s.driving && s.plan !== "hand") { s.driving = true; sim.set("plan", "hand"); s.driving = false; } if (s.ready && !s.driving && s.halted && v > 0) { s.halted = false; s.fixAt = 0; } } },
      { id: "watch", label: "Automatic rollback watches", type: "choice", value: "es", options: [["none", "Nothing"], ["es", "Errors + speed"], ["esq", "+ quality"]],
        help: "If a watched line crosses its red dashed line, everyone goes back to the old version.", apply: (s, v) => { s.watch = v; } },
      { id: "rollback", label: "Roll back now", type: "button", apply: (s, v, sim) => rollback(s, sim, false, "you") }
    ],
    step, draw,
    stats: s => {
      const st = [["on the new version", pct(s.a), s.a > 0.999 && s.fixed ? "ok" : ""],
        ["garbled replies sent", `${s.garbled} / ${LIMIT}`, s.garbled > LIMIT ? "bad" : s.garbled > LIMIT / 2 ? "hot" : "ok"],
        ["errors per 1,000 · new / old", `${f1(m(s, "new", "err"))} / ${f1(m(s, "old", "err"))}`],
        ["quality flags per 1,000 · new / old", `${f1(m(s, "new", "qual"))} / ${f1(m(s, "old", "qual"))}`, (m(s, "new", "qual") || 0) >= 3 ? "bad" : ""],
        ["rollbacks", String(s.rollbacks)]];
      return st;
    },
    goal: { text: `ship the new version to 100% of traffic with no more than ${LIMIT} garbled replies reaching people`,
      check: s => ({ done: s.won, progress: s.garbled > LIMIT ? `${s.garbled} garbled · over budget, press Reset` : `${pct(s.a)} · ${s.garbled} garbled` }) },
    notices: [
      { id: "over", when: s => s.garbled > LIMIT && !s.won, say: s => `${s.garbled} garbled replies have reached people, more than the ${LIMIT} allowed. The fault only shows on chip C, so it hid from the error and speed charts. Press <b>Reset</b> and try rolling out <b>in steps</b>, with rollback also watching <b>quality</b>.` },
      { id: "won", when: s => s.won, say: s => `Shipped. The fixed version serves 100% of traffic, and only ${s.garbled} garbled replies ever reached people. A small first slice, the right signal and a fast rollback kept the damage small.` },
      { id: "fixing", when: s => s.halted && s.fixAt > 0, say: s => `${s.lastRb.auto ? "Automatic rollback" : "You rolled back"}: ${s.lastRb.reason === "quality" ? "the quality check flagged garbled replies on the new version and almost none on the old one." : "everyone is back on the old version."} Engineers split the flags by chip type: every one came from chip C. A fixed build arrives in ${Math.max(0, Math.ceil(s.fixAt - s.t))} s.` },
      { id: "fixed", when: s => s.fixed && s.fixedAtT && s.t - s.fixedAtT < 6 && s.a < 0.999, say: s => s.plan === "hand" ? "The fixed build is ready. Roll it out again: drag the slider up, a step at a time." : "The fixed build is ready, and the plan starts again from 1%. Same caution, new code." },
      { id: "noLead", when: s => s.lastRb && !s.lastRb.lead && s.t - s.lastRb.t < 5, say: s => s.fault && s.garbled > 0 ? `Rolled back, but nothing on the dashboard pointed at a cause, so there is nothing for engineers to fix yet. ${s.garbled} garbled replies went out unnoticed. Try watching the quality check.` : "Rolled back. Nothing had gone wrong, so engineers have nothing to fix. Start the rollout again when you're ready." },
      { id: "flagsUnwatched", when: s => s.fault && s.a > 0 && s.watch !== "esq" && (m(s, "new", "qual") || 0) >= 3, say: s => `The quality check shows ${f1(m(s, "new", "qual"))} garbled replies per 1,000 on the new version against ${f1(m(s, "old", "qual"))} on the old, but automatic rollback isn't watching it. Roll back now, or let rollback watch quality checks too.` },
      { id: "hidden", when: s => s.fault && s.garbled >= 3 && s.a > 0, say: s => `Errors and speed look healthy, yet ${s.garbled} garbled replies have gone out (the red sparks). To an error counter, a garbled reply is a success: the server answered on time. All of them come from chip C.` },
      { id: "missC", when: s => s.fault && s.a > 0 && cFrac(s) === 0 && s.t > 3, say: s => `${pct(s.a)} of traffic (${Math.round(R * s.a)} replies a second) runs on ${newServers(s.a)} new server${newServers(s.a) > 1 ? "s" : ""}, none of them on chip C. If a problem only happens on one kind of hardware, this slice can't find it. A useful first slice has to include every kind.` },
      { id: "fast", when: s => s.plan === "fast" && s.a > 0, say: s => `Everyone is moving to the new version at once. If something is wrong, all ${R} replies a second are exposed until it's caught.` },
      { id: "canary", when: s => s.a > 0 && s.a < 0.6, say: s => `${pct(s.a)} of traffic (${Math.round(R * s.a)} replies a second) is on the new version. Compare each amber line with the grey one beside it: the same moment, the same kind of traffic, two versions.` },
      { id: "idle", when: s => s.a === 0, say: () => "Everyone is on the old version. Pick a rollout plan, or drag the slider, to start sending people to the new one." }
    ],
    facts: [
      { id: "pm", when: s => s.garbled >= 2, text: "This really happened. In August 2025, a misconfiguration on some of Anthropic's TPU servers made its Claude models occasionally favour tokens that should rarely appear, such as Thai or Chinese characters in English replies. It was fixed by rolling the change back.", ref: "#ref-30" },
      { id: "sre", when: s => s.rollbacks >= 1, text: "In Google's experience, a majority of incidents are triggered by pushing new code or new settings. Its engineers define canarying as a partial, time-limited deployment of a change and its evaluation.", ref: "#ref-1001" }
    ],
    tour: [
      { say: "This is a live service: 400 replies a second (illustrative, time sped up) go through a router to 24 servers on three kinds of chip. Everyone is on the old version.", set: { plan: "hand", share: 0, watch: "es" }, wait: 5 },
      { say: "Ship the new version to everyone at once, with rollback watching errors and speed. Watch the charts, and the servers on chip C.", set: { plan: "fast" }, wait: 7 },
      { say: "Errors and speed look fine, even better than before. But red sparks fly out of chip C: garbled replies. Only the quality check and, slowly, thumbs-down see them. Nothing rolls back.", wait: 7 },
      { say: "Start again. This time the rollout goes <b>in steps</b>, and rollback also watches the quality check. The first slices (1% and 5%) don't even touch chip C, and are too small for the error chart to judge.", act: (s, sim) => { sim.reset(); }, set: { plan: "careful", watch: "esq" }, until: s => s.rollbacks > 0, max: 50 },
      { say: "At 25% the slice reaches chip C. The quality check sees it within seconds and rollback fires. Engineers trace it to chip C and build a fix.", until: s => s.fixed, max: 20 },
      { say: "The fixed build goes out step by step. Watch the budget bar: only a handful of garbled replies ever reached people.", until: s => s.won, max: 70 }
    ],
    publish: s => {
      const T = s.lastRb && s.lastRb.lead ? s.lastRb.T : null, f = FAULT / 3;
      return { prShare: pct(s.a), prGarbled: String(s.garbled), prLimit: String(LIMIT), prRb: String(s.rollbacks),
        prNewErr: f1(m(s, "new", "err")), prOldErr: f1(m(s, "old", "err")), prNewQ: f1(m(s, "new", "qual")), prOldQ: f1(m(s, "old", "qual")),
        prR: String(R), prSlice: pct(Math.max(0.25, s.a)), prSliceN: String(Math.round(R * Math.max(0.25, s.a))), prT: T != null ? T.toFixed(0) + " s" : "10 s",
        prBad: String(Math.round(R * Math.max(0.25, s.a) * f * (T != null ? T : 10))), prBadAll: String(Math.round(R * f * (T != null ? T : 10))), prF: "1 in 75" };
    }
  });
});
