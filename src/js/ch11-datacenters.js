/* Chapter 11 · Datacenters and power. You plan an AI cluster on one site to a power budget.
   Model (illustrative where marked):
   - Each AI chip with its share of the rack (processors, network, switches) needs 1.65 kW of IT power:
     a ~120 kW liquid-cooled rack holds 72 GPUs (ref-60), 120 / 72 ≈ 1.65.
   - Air cooling: one 8-GPU server per rack, 13 kW (illustrative, "well under 20 kW"). Liquid: 72 GPUs, ≈ 119 kW.
   - The site has 4 halls × 150 rack spaces = 600 spaces (illustrative).
   - Site power = IT power × PUE. Every watt of IT power ends as heat that the cooling plant removes.
   - Example training job: 3.8 × 10^25 calculations (the published work of Meta's largest Llama 3 model, ref-9);
     each chip does 10^15 useful calculations a second (illustrative). Serving: 10 conversations per chip (illustrative).
   - Homes: an average US home uses 10,791 kWh a year (EIA, 2022) ≈ 1.23 kW average draw.
   - Time is sped up: one second is one hour. */
chapter("datacenters", () => {
  const KW_GPU = 1.65, PER = { air: 8, liquid: 72 }, HALLS = 4, COLS = 15, ROWS = 10, SPACES = HALLS * COLS * ROWS;
  const WORK = 3.8e25, RATE = 1e15, CHATS = 10, HOME_KW = 10791 / 8760;
  const GOAL_DAYS = 30, GOAL_MW = 30, HIST = 192, HSTEP = 0.25;
  const COOL = "#6cb8ff";
  const fmtMW = mw => mw >= 1000 ? (mw / 1000).toFixed(2) + " GW" : mw >= 100 ? Math.round(mw) + " MW" : mw >= 10 ? mw.toFixed(1).replace(/\.0$/, "") + " MW" : mw.toFixed(1) + " MW";
  const round = (n, d) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - d + 1); return Math.round(n / p) * p; };
  const big = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + " million" : round(n, 2).toLocaleString();
  const place = h => h < 3000 ? "a village" : h < 30000 ? "a small town" : h < 150000 ? "a town" : h < 600000 ? "a city" : "a big city";

  function plan(s) {
    const per = PER[s.cool], itMax = s.power / s.pue;                  // MW of IT power the budget allows
    const byPower = Math.floor(itMax * 1000 / KW_GPU / 8) * 8, byFloor = SPACES * per;
    const gpus = Math.max(0, Math.min(byPower, byFloor)), racks = Math.ceil(gpus / per);
    const it = gpus * KW_GPU / 1000, site = it * s.pue;
    return { per, gpus, racks, it, site, floorFull: byPower > byFloor, unused: s.power - site, rackKW: per * KW_GPU,
      days: gpus ? WORK / (gpus * RATE) / 86400 : Infinity, people: gpus * CHATS, homes: site * 1000 / HOME_KW };
  }
  function init() {
    return { t: 0, power: 20, cool: "air", pue: 1.5, use: "train", shown: 0, hist: [], hAcc: 0, load: 1, dipAt: -99, nextDip: 5, lastDipMW: 0, dips: 0, phase: 0 };
  }
  function loadAt(s) {
    if (s.use === "serve") { const h = (s.t % 24) / 24; return 0.6 - 0.32 * Math.cos(2 * Math.PI * (h - 0.08)); } // low at night, high in the afternoon
    return s.t - s.dipAt < 0.8 ? 0.4 : 0.97;
  }
  function step(s, dt) {
    s.t += dt; s.phase += dt;
    const p = plan(s);
    // build-out animation: racks appear (or are removed) a few at a time
    s.shown = s.shown < p.racks ? Math.min(p.racks, s.shown + Math.max(40, p.racks) * dt * 0.9) : Math.max(p.racks, s.shown - 400 * dt);
    if (s.use === "train" && s.t >= s.nextDip) { s.dipAt = s.t; s.nextDip = s.t + 13; s.dips++; s.lastDipMW = p.site * (0.97 - 0.4); }
    s.load = loadAt(s);
    s.hAcc += dt;
    while (s.hAcc >= HSTEP) { s.hAcc -= HSTEP; s.hist.push(p.site * s.load); if (s.hist.length > HIST) s.hist.shift(); }
    s.goalFor = goalMet(s) ? (s.goalFor || 0) + dt : 0;
  }
  const goalMet = s => { const p = plan(s); return s.use === "train" && p.days <= GOAL_DAYS && p.site <= GOAL_MW + 1e-9; };

  // ---------- layout ----------
  // Wide: four tall halls in a row; power bus along the top, heat header along the bottom, cooling plant on the right.
  // Narrow (phones): halls in a 2 × 2 block; power from the top, cooling plant and chart at the bottom.
  const WIDE = (() => {
    const hx = i => 370 + i * 215, HY = 110, HW = 200, HH = 610, P = [1250, 290, 160, 200], S = [150, 345, 170, 130];
    return { cols: 10, rows: 15, hw: HW, hh: HH, hall: i => [hx(i), HY], sub: S, plant: P, chart: [1262, 40, 350, 200],
      grid: [[-40, 410], [S[0], 410]], gridLabel: [0, 386],
      bus: i => [[S[0] + S[2] / 2, S[1]], [S[0] + S[2] / 2, 60], [hx(i) + HW / 2, 60], [hx(i) + HW / 2, HY]],
      ovh: [[S[0] + S[2] / 2, S[1]], [S[0] + S[2] / 2, 60], [1232, 60], [1232, P[1] + 40], [P[0], P[1] + 40]], ovhLabel: [800, 34],
      heat: i => [[hx(i) + HW / 2, HY + HH], [hx(i) + HW / 2, 755], [P[0] + P[2] / 2, 755], [P[0] + P[2] / 2, P[1] + P[3]]],
      out: [[P[0] + P[2], P[1] + P[3] / 2], [1660, P[1] + P[3] / 2]], outLabel: [1530, P[1] + P[3] / 2 - 22],
      cam: { x: -30, y: 0, w: 1660, h: 790 } };
  })();
  const NARROW = (() => {
    const hx = i => 20 + (i % 2) * 440, hy = i => 200 + Math.floor(i / 2) * 330, HW = 420, HH = 300, P = [20, 870, 280, 150], S = [350, 18, 200, 142];
    return { cols: 15, rows: 10, hw: HW, hh: HH, hall: i => [hx(i), hy(i)], sub: S, plant: P, chart: [330, 870, 550, 230],
      grid: [[450, -60], [450, S[1]]],
      bus: i => i < 2 ? [[450, S[1] + S[3]], [450, 175], [hx(i) + HW / 2, 175], [hx(i) + HW / 2, hy(i)]] : [[450, S[1] + S[3]], [450, 515], [hx(i) + HW / 2, 515], [hx(i) + HW / 2, hy(i)]],
      heat: i => i === 0 ? [[20, 350], [4, 350], [4, 920], [P[0], 920]] : i === 1 ? [[880, 350], [896, 350], [896, 850], [160, 850], [160, P[1]]] : [[hx(i) + HW / 2, hy(i) + HH], [hx(i) + HW / 2, 850], [160, 850], [160, P[1]]],
      out: [[160, P[1] + P[3]], [160, 1150]], outLabel: [176, 1120],
      cam: { x: -20, y: -50, w: 940, h: 1200 } };
  })();
  const slotXY = (L, n) => { const per = L.cols * L.rows, h = Math.floor(n / per), r = n % per, [hx, hy] = L.hall(h); const pw = (L.hw - 24) / L.cols, ph = (L.hh - 48) / L.rows; return [hx + 12 + (r % L.cols) * pw + 2, hy + 38 + Math.floor(r / L.cols) * ph + 2, pw - 5, ph - 5]; };
  // position along a polyline, u in 0..1 (by length)
  function along(pts) {
    const seg = []; let T = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); T += d; }
    return u => { let d = clamp01(u) * T; for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const k = seg[i] ? Math.min(1, d / seg[i]) : 0; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]; } d -= seg[i]; } return pts[pts.length - 1]; };
  }
  function poly(k, pts, o) { for (let i = 1; i < pts.length; i++) k.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], o); }

  function draw(k, s, sim) {
    const C = k.C, narrow = sim.narrow, L = narrow ? NARROW : WIDE, p = plan(s), t = s.phase, liquid = s.cool === "liquid";
    const [sx, sy, sw, sh] = L.sub, [px, py, pw, ph] = L.plant, intensity = Math.min(1, p.site / 40) * s.load, per = L.cols * L.rows;
    const shown = Math.round(s.shown), usedIn = h => Math.max(0, Math.min(per, shown - h * per)), n = x => Math.max(1, Math.round(x));
    // power from the grid
    poly(k, L.grid, { col: C.amb, lw: 2, alpha: 0.5 });
    k.flow(along(L.grid), n(2 + 6 * intensity), (t * 0.7) % 1, C.amb, { size: 3 });
    if (!narrow) k.label(L.gridLabel[0], L.gridLabel[1], "from the grid", { align: "left", col: C.amb, weight: "600" });
    // buses to the halls, and the overhead branch to the cooling plant
    if (L.ovh && p.site > 0) { poly(k, L.ovh, { col: C.amb, alpha: 0.3 }); k.flow(along(L.ovh), n((s.pue - 1) * 16 * Math.min(1, p.site / 15)), (t * 0.22) % 1, C.amb, { size: 2.4, alpha: 0.75, len: 0.025 }); }
    for (let h = 0; h < HALLS; h++) {
      const used = usedIn(h), bp = L.bus(h);
      poly(k, bp, { col: used ? C.amb : C.line, lw: 1.2, alpha: used ? 0.45 : 0.4 });
      if (used) k.flow(along(bp), n(1 + 4 * intensity * used / per), (t * 0.5 + h * 0.23) % 1, C.amb, { size: 2.6, len: 0.05 });
      const hp = L.heat(h);
      poly(k, hp, { col: used ? COOL : C.line, lw: 1.2, alpha: used ? 0.4 : 0.3 });
      if (used) k.flow(along(hp), n(1 + 4 * intensity * used / per), (t * 0.4 + h * 0.31) % 1, COOL, { size: 2.6, len: 0.05 });
    }
    // halls and racks
    for (let h = 0; h < HALLS; h++) {
      const [hx, hy] = L.hall(h), used = usedIn(h);
      k.box(hx, hy, L.hw, L.hh, { fill: C.bg2, stroke: C.line, r: 12, alpha: 0.95 });
      k.label(hx + 10, hy + 18, narrow ? `hall ${h + 1}` : `hall ${h + 1} · ${used}/${per}`, { align: "left", col: used ? C.ink : C.muted, size: 10, weight: "600" });
    }
    for (let i = 0; i < SPACES; i++) {
      const [x, y, w, hg] = slotXY(L, i);
      if (i >= shown) { k.box(x, y, w, hg, { stroke: C.line, r: 2, lw: 1, alpha: 0.45 }); continue; }
      if (liquid) k.box(x, y, w, hg, { fill: C.amb, r: 2, alpha: 0.55 + 0.4 * s.load });
      else { k.box(x, y, w, hg, { stroke: C.amb, r: 2, lw: 1.1, alpha: 0.85 }); k.box(x + w * 0.25, y + hg * 0.3, w * 0.5, hg * 0.4, { fill: C.amb, r: 1, alpha: 0.35 + 0.4 * s.load }); }
    }
    if (liquid) for (let h = 0; h < HALLS; h++) { // coolant pipes along each row of racks
      const rowsUsed = Math.ceil(usedIn(h) / L.cols);
      for (let r = 0; r < rowsUsed; r++) { const [x0, y0, , hg] = slotXY(L, h * per + r * L.cols), [x1, , w1] = slotXY(L, h * per + r * L.cols + L.cols - 1); k.line(x0 - 3, y0 + hg + 2, x1 + w1 + 3, y0 + hg + 2, { col: COOL, lw: 1.3, alpha: 0.75 }); }
    }
    // substation and cooling plant
    k.box(sx, sy, sw, sh, { fill: C.bg2, stroke: C.amb, r: 12, lw: 1.4, glow: 10 * intensity, glowCol: C.amb });
    k.label(sx + sw / 2, sy + sh / 2, "substation", { col: C.ink, weight: "650", size: 11, dy: -15 });
    k.label(sx + sw / 2, sy + sh / 2, fmtMW(p.site * s.load), { col: C.amb, size: 12, weight: "650", mono: true, dy: 1 });
    k.label(sx + sw / 2, sy + sh / 2, "limit " + fmtMW(s.power), { col: C.muted, size: 10, dy: 16 });
    k.box(px, py, pw, ph, { fill: C.bg2, stroke: COOL, r: 12, lw: 1.4, glow: 10 * intensity, glowCol: COOL });
    k.label(px + pw / 2, py + ph / 2, "cooling plant", { col: C.ink, weight: "650", size: 11, dy: -15 });
    k.label(px + pw / 2, py + ph / 2, fmtMW(p.site * s.load), { col: COOL, size: 12, weight: "650", mono: true, dy: 1 });
    k.label(px + pw / 2, py + ph / 2, "of heat removed", { col: C.muted, size: 10, dy: 16 });
    poly(k, L.out, { col: COOL, lw: 2, alpha: 0.4 });
    k.flow(along(L.out), n(2 + 6 * intensity), (t * 0.55) % 1, COOL, { size: 3 });
    k.label(L.outLabel[0], L.outLabel[1], "heat out", { align: narrow ? "left" : "center", col: COOL, weight: "600" });
    if (L.ovhLabel && p.site > 0) k.label(L.ovhLabel[0], L.ovhLabel[1], `${fmtMW(p.it * (s.pue - 1) * s.load)} never reaches a chip: it runs cooling, fans and power conversion`, { col: C.amb, size: 11, bg: true });
    // power chart
    const [cx, cy, cw, ch] = L.chart;
    k.box(cx, cy, cw, ch, { fill: C.bg2, stroke: C.line, r: 12, alpha: 0.95 });
    k.label(cx + 12, cy + 18, "power drawn · last 48 h", { align: "left", col: C.ink, size: 11, weight: "650" });
    const gx = cx + 12, gy = cy + 40, gw = cw - 24, gh = ch - (narrow ? 56 : 66), mx = Math.max(s.power, ...s.hist, 1) * 1.2;
    k.line(gx, gy + gh, gx + gw, gy + gh, { col: C.line, lw: 1 });
    const ly = gy + gh - s.power / mx * gh; k.line(gx, ly, gx + gw, ly, { col: C.crit, lw: 1.2, dash: [5, 4], alpha: 0.8 });
    k.label(gx + gw, ly - 9, "limit", { align: "right", col: C.crit, size: 10 });
    const c = k.ctx; c.save(); c.strokeStyle = C.amb; c.lineWidth = k.px(2); c.lineJoin = "round"; c.beginPath();
    s.hist.forEach((v, i) => { const xx = gx + (i + HIST - s.hist.length) / (HIST - 1) * gw, yy = gy + gh - Math.min(1, v / mx) * gh; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }); c.stroke(); c.restore();
    k.label(cx + 12, cy + ch - 13, s.use === "train" ? "training: flat, with sudden dips" : "serving: follows people's day", { align: "left", col: C.muted, size: 10 });
  }

  const sim = makeSim($("#dc-sim"), {
    label: "Datacenter planning simulation. Power flows from the grid through a substation into four halls of rack spaces; heat flows out through a cooling plant. Racks fill the halls as the power budget allows.",
    cams: { default: WIDE.cam }, camsNarrow: { default: NARROW.cam },
    height: w => w < 640 ? Math.round(w * 1.35) : Math.round(Math.min(600, Math.max(400, w * 0.5))),
    init, warmup: 30, speeds: [1, 4],
    intro: "This site has 20 MW of power and air cooling. Every square in the halls is a space for one rack. Try the controls.",
    controls: [
      { id: "power", label: "Power available from the grid", type: "range", min: 5, max: 150, step: 5, value: 20, fmt: v => v + " MW · " + big(v * 1000 / HOME_KW) + " homes", apply: (s, v) => { s.power = v; } },
      { id: "cool", label: "Cooling", type: "choice", value: "air", options: [["air", "Air"], ["liquid", "Liquid"]], help: "Air: fans, one 8-chip server per rack. Liquid: coolant piped onto the chips, 72 chips per rack.", apply: (s, v) => { s.cool = v; } },
      { id: "pue", label: "Building overhead (PUE)", type: "range", min: 1.1, max: 1.8, step: 0.05, value: 1.5, fmt: v => v.toFixed(2), help: "Site power ÷ power that reaches the computers. 1.0 would mean no overhead at all.", apply: (s, v) => { s.pue = v; } },
      { id: "use", label: "What the cluster is for", type: "choice", value: "train", options: [["train", "Train one model"], ["serve", "Serve people"]], apply: (s, v) => { s.use = v; if (v === "train") s.nextDip = s.t + 3; } }
    ],
    step, draw,
    stats: s => { const p = plan(s); return [
      ["AI chips", p.gpus.toLocaleString(), goalMet(s) ? "ok" : ""],
      ["racks · of 600 spaces", `${p.racks} · ${p.per} chips each`, p.floorFull ? "hot" : ""],
      ["site power · of " + fmtMW(s.power), fmtMW(p.site), p.floorFull && p.unused > 2 ? "hot" : ""],
      s.use === "train" ? ["example model trained in", isFinite(p.days) ? Math.ceil(p.days) + " days" : "–", p.days <= GOAL_DAYS ? "ok" : ""] : ["people at once (illustrative)", big(p.people)],
      ["like powering", big(p.homes) + " homes"]]; },
    goal: { text: `train the example model in ${GOAL_DAYS} days or less, with the whole site drawing no more than ${GOAL_MW} MW`,
      check: s => { const p = plan(s); return { done: (s.goalFor || 0) >= 2, progress: s.use === "train" ? `${isFinite(p.days) ? Math.ceil(p.days) : "–"} days · ${fmtMW(p.site)}` : "switch to training" }; } },
    notices: [
      { id: "won", when: s => goalMet(s), say: s => { const p = plan(s); return `Done: ${p.gpus.toLocaleString()} chips in ${p.racks} liquid-cooled racks finish the example model in ${Math.ceil(p.days)} days on ${fmtMW(p.site)}. A leaner building (PUE ${s.pue.toFixed(2)}) meant more of the power reached chips.`; } },
      { id: "floor", when: s => plan(s).floorFull && plan(s).unused >= 3, say: s => { const p = plan(s); return s.cool === "air" ? `All 600 rack spaces are full, yet <b>${fmtMW(p.unused)}</b> of your power is unused. Air can only carry away about ${Math.round(p.rackKW)} kW from a rack, so each holds just ${p.per} chips. Liquid cooling packs 72 chips into the same space.` : `All 600 rack spaces are full, so ${fmtMW(p.unused)} of power has nowhere to go. You'd need a bigger site, which is how campuses grow to many buildings.`; } },
      { id: "dip", once: true, when: s => s.use === "train" && s.t - s.dipAt < 2.5 && plan(s).site > 3, say: s => `The training job paused to save its progress, and every chip stopped at once. The site's draw fell by about <b>${fmtMW(s.lastDipMW)}</b> in a moment, like ${big(s.lastDipMW * 1000 / HOME_KW)} homes switching off together. Then it jumps back.` },
      { id: "pue", when: s => s.pue >= 1.4 && plan(s).site > 3, say: s => { const p = plan(s); return `At PUE ${s.pue.toFixed(2)}, <b>${fmtMW(p.site - p.it)}</b> of the ${fmtMW(p.site)} never reaches a chip: it runs chillers, fans and power conversion. Lower the overhead and the same power runs more chips.`; } },
      { id: "serve", when: s => s.use === "serve", say: s => { const p = plan(s); return `Serving follows people's day: draw swings between about ${fmtMW(p.site * 0.28)} at night and ${fmtMW(p.site * 0.92)} in the afternoon. The site must still be built for the peak.`; } },
      { id: "liquid", when: s => s.cool === "liquid", say: s => { const p = plan(s); return `Each liquid-cooled rack holds ${p.per} chips and draws about <b>${Math.round(p.rackKW)} kW</b>, as much as ${Math.round(p.rackKW / HOME_KW)} homes, in the floor space of a wardrobe. All of it leaves as heat through the coolant pipes.`; } },
      { id: "heat", when: () => true, say: s => { const p = plan(s); return `${p.gpus.toLocaleString()} chips draw ${fmtMW(p.it)} and turn all of it into heat, which the cooling plant pumps out. The whole site draws ${fmtMW(p.site)}, as much as ${place(p.homes)} (${big(p.homes)} homes).`; } }
    ],
    facts: [
      { id: "iea", when: s => plan(s).homes >= 40000, text: "The International Energy Agency estimates that a typical AI-focused datacenter uses as much electricity as 100,000 households, and that the largest ones under construction will use 20 times as much.", ref: "#ref-1102" },
      { id: "swing", when: s => s.dips >= 2 && s.use === "train", text: "This happens for real. Meta reported that when its 16,384-GPU training job for Llama 3 paused or restarted all at once, the datacenter's power swung by tens of megawatts, stretching the limits of the power grid.", ref: "#ref-9" }
    ],
    tour: [
      { say: "This site has 20 MW and air cooling. Each square is a space for one rack, and each air-cooled rack holds one 8-chip server. Power comes in on the left; heat leaves on the right.", set: { power: 20, cool: "air", pue: 1.5, use: "train" }, wait: 7 },
      { say: "Triple the power to 60 MW. The halls fill up, and then stop: there's no room left, so most of the new power can't be used.", set: { power: 60 }, wait: 7 },
      { say: "Switch to liquid cooling. Coolant piped onto the chips can carry away about 120 kW per rack, so 72 chips fit where 8 did.", set: { cool: "liquid" }, wait: 7 },
      { say: "Now make the building leaner: PUE 1.15 means only 15% extra for cooling and power conversion. The same 60 MW runs thousands more chips.", set: { pue: 1.15 }, wait: 7 },
      { say: "The challenge: train the example model in 30 days on 30 MW. Liquid cooling and a lean building make it just possible.", set: { power: 30, pue: 1.2 }, wait: 7 },
      { say: "Finally, use the same cluster to serve people instead. Watch the power chart follow the day: busy afternoons, quiet nights.", set: { use: "serve" }, wait: 9 }
    ],
    publish: s => { const p = plan(s); return { dcGpus: p.gpus.toLocaleString(), dcRacks: String(p.racks), dcPer: String(p.per), dcRackKW: Math.round(p.rackKW) + " kW", dcIT: fmtMW(p.it), dcSite: fmtMW(p.site), dcOvh: fmtMW(p.site - p.it), dcPue: s.pue.toFixed(2), dcHomes: big(p.homes), dcPlace: place(p.homes), dcPower: fmtMW(s.power), dcDays: isFinite(p.days) ? String(Math.ceil(p.days)) : "–", dcPeople: big(p.people), dcCool: s.cool === "air" ? "air" : "liquid" }; }
  });
});
