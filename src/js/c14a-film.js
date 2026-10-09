/* Chapter 14 film: one continuous zoom out, from a single accelerator to a gigawatt campus.
   One world, real nesting (chip inside tray inside rack inside hall inside campus); the camera zooms in log space
   and each level draws its detail only when it is big enough on screen. Amber = power, teal = data, blue = coolant. */
chapter("datacenter", () => {
  const fig = $("#dc-film"); if (!fig) return;
  const COOL = "#7ab8ff";
  // ---- geometry (world units; everything is placed relative to its parent) ----
  const GPU = { w: 120, h: 100 }, CPU = { w: 70, h: 70 };
  const TRAY = { w: 900, h: 120, gpus: [115, 250, 555, 690], cpus: [30, 470] };
  const RACK = { w: 1000, h: 4300, pitch: 140, slots: 29 };
  const slotKind = s => s === 0 || s === 28 ? "power" : s >= 11 && s <= 19 ? "switch" : "compute";
  const slotY = s => 120 + s * RACK.pitch;
  const HALL = { rows: 5, perRow: 40, pitch: 1100, rowPitch: 7200, w: 53000, h: 41000, rx: 2000, ry: 3000 };
  const CAMPUS = { cols: 4, rows: 2, px: 64000, py: 56000 };
  const B0 = [64000, 0];                                                   // the building we zoom out through
  const R0 = [B0[0] + HALL.rx + 18 * HALL.pitch, B0[1] + HALL.ry + 2 * HALL.rowPitch]; // its rack
  const T0 = [R0[0] + 50, R0[1] + slotY(5)];                               // its tray
  const G0 = [T0[0] + TRAY.gpus[0], T0[1] + 10];                           // its first GPU
  const SUB = { x: -52000, y: 30000, w: 36000, h: 50000 }, PLANT = { x: 262000, y: 24000, w: 40000, h: 62000 };
  const bldg = (c, r) => [c * CAMPUS.px, r * CAMPUS.py];

  const steps = [
    { key: "chip", short: "One chip", title: "It starts with one accelerator", dur: 6,
      text: [`This is one AI chip. The middle does the maths, and the stacks around it are very fast memory that keep it fed with numbers. It draws about a kilowatt.`,
             `A Blackwell GPU package: compute dies surrounded by HBM3E stacks, about 186 GB at 8 TB/s, in a power class of about 1 kW.`], link: "#ref-22" },
    { key: "tray", short: "Tray", title: "Four GPUs share a liquid-cooled tray", dur: 6,
      text: [`Four of these chips and two ordinary processors sit on one flat tray. Cold liquid flows through metal plates pressed onto each chip and carries the heat away.`,
             `A compute tray holds two GB200 superchips, each one Grace CPU with two Blackwell GPUs, in one rack unit. Coolant flows through cold plates mounted directly on the chips.`], link: "#ref-22" },
    { key: "rack", short: "Rack", title: "A rack of 72 GPUs acts as one", dur: 6.5,
      text: [`Eighteen trays stack into one rack with nine switch trays, so 72 chips can talk to each other as if they were one giant chip. The rack needs about 120 kW, so liquid cooling is a must.`,
             `GB200 NVL72: 18 compute trays and 9 NVLink switch trays form one NVLink domain, 130 TB/s in total and 1.8 TB/s per GPU. About 120 kW per rack (conventional racks: well under 20 kW), cooled direct-to-chip from a coolant distribution unit.`], link: "#ref-60" },
    { key: "hall", short: "Cluster", title: "Hundreds of racks become one cluster", dur: 6.5,
      text: [`Hundreds of racks fill a hall. A second network links all the racks, so tens of thousands of chips can work on one job.`,
             `A scale-out network, InfiniBand or Ethernet in a fat-tree of leaf and spine switches, joins the racks. A cluster draws tens to hundreds of MW; Meta's two 24,576-GPU H100 clusters are an example.`], link: "#ref-14" },
    { key: "campus", short: "Campus", title: "A campus is planned in gigawatts", dur: 6.5,
      text: [`Zoom out again: several buildings like that one, with their own power substation and cooling plant. The Abilene site in Texas is designed for 1.2 gigawatts across eight buildings.`,
             `Abilene (OpenAI and Oracle, built by Crusoe): 1.2 GW across eight buildings connected into a single cluster, set to hold over 450,000 GB200 GPUs, with its own substation, cooling plant and fibre.`], link: "#ref-32" },
    { key: "pue", short: "Power and heat", title: "Every watt in comes out as heat", dur: 6.5,
      text: [`Electricity flows in from the grid and nearly all of it turns into heat, which the cooling plant carries away. Cooling and other overheads use extra power on top of the computers.`,
             `PUE = facility power ÷ IT power. At a PUE of 1.2, 100 MW of IT equipment means 120 MW at the meter. Google reports a fleet-wide PUE of about 1.09.`], link: "#ref-45" }
  ];
  // camera boxes: centre and the box that must fit
  const CAMS = [
    { cx: G0[0] + GPU.w / 2, cy: G0[1] + GPU.h / 2, w: 300, h: 150 },
    { cx: T0[0] + TRAY.w / 2, cy: T0[1] + TRAY.h / 2, w: 1100, h: 330 },
    { cx: R0[0] + RACK.w / 2, cy: R0[1] + RACK.h / 2 - 260, w: 2600, h: 5300 },
    { cx: B0[0] + HALL.w / 2, cy: B0[1] + HALL.h / 2, w: 62000, h: 46000 },
    { cx: 125000, cy: 50000, w: 390000, h: 125000 },
    { cx: 125000, cy: 50000, w: 390000, h: 125000 }
  ];
  const DRIFT = 0.07;
  const camEnd = i => ({ ...CAMS[i], w: CAMS[i].w * (1 + DRIFT), h: CAMS[i].h * (1 + DRIFT) });
  function camAt(i, p) {
    const to = CAMS[i], from = i ? camEnd(i - 1) : CAMS[0], e = easeIO(p / 0.62);
    let w = Math.exp(lerp(Math.log(from.w), Math.log(to.w), e)), h = Math.exp(lerp(Math.log(from.h), Math.log(to.h), e));
    const u = Math.abs(to.w - from.w) < 1e-6 * to.w ? e : (w - from.w) / (to.w - from.w);
    const d = 1 + DRIFT * clamp01((p - 0.62) / 0.38); w *= d; h *= d;
    return { x: lerp(from.cx, to.cx, u) - w / 2, y: lerp(from.cy, to.cy, u) - h / 2, w, h };
  }
  const HUDROWS = 3;
  const hud = (k, corner, title, rows) => k.W < 640 ? k.hud("tl", title, rows.slice(0, HUDROWS), { w: 220 }) : k.hud(corner, title, rows, { w: 230 });

  // ---------- drawing ----------
  let V = null; // visible world rect
  const inView = (x, y, w, h) => x + w >= V.x0 && x <= V.x1 && y + h >= V.y0 && y <= V.y1;
  const sz = n => n * KK.scale; let KK = null;  // world size -> screen px
  const vis = (n, a, b) => clamp01((sz(n) - a) / (b - a));
  let REV = () => 1; // how far the film has revealed a level's flows (0 before its step, fades in during it)

  function drawGPU(k, x, y, f, focus) {
    const C = k.C, s = sz(GPU.w);
    if (s < 2) { k.box(x + 6, y + 6, GPU.w - 12, GPU.h - 12, { fill: C.amb, r: 0, alpha: 0.5 }); return; }
    const pulse = 0.55 + 0.45 * Math.sin(f.t * 5 + x * 0.01);
    k.box(x, y, GPU.w, GPU.h, { fill: C.bg2, stroke: focus && f.key === "chip" ? C.sig : C.line, r: 6, lw: 1.2 });
    // two compute dies (amber = compute, glowing with load)
    [22, 62].forEach(dx => k.box(x + dx, y + 30, 36, 40, { fill: C.amb, r: 3, alpha: 0.55 + 0.35 * pulse, glow: s > 60 ? 12 * pulse : 0, glowCol: C.amb }));
    if (s < 18) return;
    // HBM stacks above and below
    [14, 38, 62, 86].forEach(dx => { [10, 76].forEach(dy => { k.box(x + dx, y + dy, 20, 14, { fill: C.line, stroke: C.sig, r: 2, lw: 0.8, alpha: 0.95 }); }); });
    if (s > 150) { // memory traffic between HBM and the dies
      const v = vis(GPU.w, 150, 400);
      [14, 38, 62, 86].forEach((dx, j) => { [[10 + 14, 30], [76, 70]].forEach(([ya, yb], q) => {
        const xa = x + dx + 10, xb = x + (dx < 60 ? 40 : 80);
        k.flow(u => [lerp(xa, xb, u), lerp(y + ya, y + yb, u)], 2, (f.t * 0.9 + j * 0.13 + q * 0.4) % 1, C.sig, { size: 2.6, len: 0.25, alpha: 0.9 * v, glow: 8 });
        k.flow(u => [lerp(xb, xa, u), lerp(y + yb, y + ya, u)], 1, (f.t * 0.9 + j * 0.29 + q * 0.17) % 1, C.sig, { size: 2.6, len: 0.25, alpha: 0.7 * v, glow: 8 }); }); });
    }
  }
  function drawTray(k, x, y, f, focus, kind) {
    const C = k.C, s = sz(TRAY.h);
    if (kind === "power") { k.box(x, y, TRAY.w, TRAY.h, { fill: C.bg2, stroke: C.amb, r: 4, alpha: 0.8, lw: 1 }); if (s > 6) for (let j = 0; j < 6; j++) k.box(x + 30 + j * 145, y + 30, 110, TRAY.h - 60, { stroke: C.amb, r: 3, alpha: 0.5, lw: 1 }); return; }
    if (kind === "switch") { k.box(x, y, TRAY.w, TRAY.h, { fill: C.bg2, stroke: C.sig, r: 4, alpha: 0.85, lw: 1 }); if (s > 6) for (let j = 0; j < 2; j++) k.box(x + 220 + j * 300, y + 25, 160, TRAY.h - 50, { fill: C.sig, r: 3, alpha: 0.35 }); return; }
    k.box(x, y, TRAY.w, TRAY.h, { fill: C.bg2, stroke: focus && f.key === "tray" ? C.sig : C.line, r: 4, lw: 1 });
    if (s < 3) return;
    TRAY.cpus.forEach(dx => { k.box(x + dx, y + 25, CPU.w, CPU.h, { fill: C.line, stroke: C.muted, r: 4, lw: 0.8 }); });
    TRAY.gpus.forEach((dx, j) => drawGPU(k, x + dx, y + 10, f, focus && j === 0));
    if (s < 25) return;
    // coolant: in along the top, down through a cold plate on each chip, back along the bottom
    const v = vis(TRAY.h, 25, 70) * REV(1);
    k.line(x - 20, y + 5, x + TRAY.w - 20, y + 5, { col: COOL, lw: 2, alpha: 0.5 * v });
    k.line(x - 20, y + TRAY.h - 5, x + TRAY.w - 20, y + TRAY.h - 5, { col: COOL, lw: 2, alpha: 0.5 * v });
    const plates = [...TRAY.cpus.map(d => [d, CPU.w]), ...TRAY.gpus.map(d => [d, GPU.w])];
    plates.forEach(([dx, w], j) => {
      k.box(x + dx - 3, y + (w === CPU.w ? 22 : 7), w + 6, (w === CPU.w ? CPU.h : GPU.h) + 6, { stroke: COOL, r: 6, lw: 1.4, alpha: 0.7 * v });
      const cx = x + dx + w / 2;
      k.flow(u => [cx - 6, lerp(y + 5, y + TRAY.h - 5, u)], 2, (f.t * 0.7 + j * 0.21) % 1, COOL, { size: 2.2, len: 0.2, alpha: 0.9 * v });
    });
    k.flow(u => [lerp(x - 20, x + TRAY.w - 20, u), y + 5], 6, (f.t * 0.25) % 1, COOL, { size: 2.4, len: 0.06, alpha: 0.9 * v });
    k.flow(u => [lerp(x + TRAY.w - 20, x - 20, u), y + TRAY.h - 5], 6, (f.t * 0.25 + 0.5) % 1, COOL, { size: 2.4, len: 0.06, alpha: 0.9 * v });
  }
  function drawRack(k, x, y, f, focus) {
    const C = k.C, s = sz(RACK.pitch);
    if (!inView(x, y, RACK.w, RACK.h)) return;
    if (sz(RACK.w) < 1.5) { k.box(x, y, RACK.w, RACK.h, { fill: C.line, r: 0, alpha: 0.7 }); return; }
    k.box(x, y, RACK.w, RACK.h, { fill: C.bg, stroke: focus && f.key === "rack" ? C.sig : C.line, r: 10, lw: 1.2 });
    if (s < 2.5) { k.box(x + 50, y + 120, RACK.w - 100, RACK.h - 240, { fill: C.line, r: 0, alpha: 0.55 }); k.box(x + 50, y + slotY(11), RACK.w - 100, 9 * RACK.pitch - 20, { fill: C.sig, r: 0, alpha: 0.3 }); return; }
    for (let sl = 0; sl < RACK.slots; sl++) { const ty = y + slotY(sl); if (!inView(x, ty, RACK.w, TRAY.h)) continue; drawTray(k, x + 50, ty, f, focus && sl === 5, slotKind(sl)); }
    if (s < 6) return;
    const v = vis(RACK.pitch, 6, 14) * REV(2);
    // coolant manifolds (left), NVLink spine (right), power feed (top)
    k.line(x + 16, y + 60, x + 16, y + RACK.h - 60, { col: COOL, lw: 3, alpha: 0.7 * v }); k.line(x + 34, y + 60, x + 34, y + RACK.h - 60, { col: COOL, lw: 3, alpha: 0.45 * v });
    k.flow(u => [x + 16, lerp(y + RACK.h - 60, y + 60, u)], 10, (f.t * 0.12) % 1, COOL, { size: 2.6, len: 0.04, alpha: v });
    k.flow(u => [x + 34, lerp(y + 60, y + RACK.h - 60, u)], 10, (f.t * 0.12 + 0.05) % 1, COOL, { size: 2.6, len: 0.04, alpha: 0.7 * v });
    const sx = x + RACK.w - 22;
    k.line(sx, y + slotY(1) + 60, sx, y + slotY(27) + 60, { col: C.sig, lw: 3, alpha: 0.6 * v });
    for (let sl = 1; sl <= 27; sl++) k.line(x + 950, y + slotY(sl) + 60, sx, y + slotY(sl) + 60, { col: C.sig, lw: 1.2, alpha: 0.45 * v });
    // traffic: from compute trays into the switch trays and back out
    for (let j = 0; j < 8; j++) { const a = [1, 3, 5, 7, 9, 21, 24, 27][j], b = 11 + (j * 4) % 9;
      k.flow(u => [sx, lerp(y + slotY(a) + 60, y + slotY(b) + 60, u)], 1, (f.t * 0.5 + j * 0.137) % 1, C.sig, { size: 2.6, len: 0.15, alpha: v, glow: 8 }); }
    k.line(x + RACK.w / 2, y - 400, x + RACK.w / 2, y + 60, { col: C.amb, lw: 3, alpha: 0.7 * v });
    k.flow(u => [x + RACK.w / 2, lerp(y - 400, y + 60, u)], 4, (f.t * 0.6) % 1, C.amb, { size: 3, len: 0.2, alpha: v, glow: 10 });
  }
  const rackXY = (bx, by, r, j) => [bx + HALL.rx + j * HALL.pitch, by + HALL.ry + r * HALL.rowPitch];
  function drawHall(k, bx, by, f, focus) {
    const C = k.C;
    if (!inView(bx, by, HALL.w, HALL.h)) return;
    k.box(bx, by, HALL.w, HALL.h, { fill: C.bg2, stroke: focus && f.key === "hall" ? C.sig : C.line, r: 900, lw: 1.2, alpha: 0.95 });
    const big = sz(RACK.w) >= 1.2;
    for (let r = 0; r < HALL.rows; r++) {
      const [x0, y0] = rackXY(bx, by, r, 0);
      if (!big) { k.box(x0, y0, HALL.perRow * HALL.pitch - 100, RACK.h, { fill: C.line, r: 0, alpha: 0.75 }); }
      else for (let j = 0; j < HALL.perRow; j++) { const [x, y] = rackXY(bx, by, r, j); drawRack(k, x, y, f, focus && r === 2 && j === 18); }
      // network rack at the row end (leaf switches)
      const lx = x0 + HALL.perRow * HALL.pitch + 300;
      k.box(lx, y0, 1300, RACK.h, { fill: C.bg2, stroke: C.sig, r: 200, lw: 1.2, alpha: 0.9 });
    }
    // spine switches and the fat-tree, CDUs, power and coolant along each row
    const v = vis(HALL.w, 120, 300) * REV(3); if (v <= 0) return;
    const spX = bx + HALL.w - 3200, lx = bx + HALL.rx + HALL.perRow * HALL.pitch + 300 + 1300;
    for (let q = 0; q < 4; q++) { const sy = by + 4000 + q * 9000; k.box(spX, sy, 1600, 3000, { fill: C.sig, r: 300, alpha: 0.35 * v + 0.2 }); }
    for (let r = 0; r < HALL.rows; r++) {
      const [, y0] = rackXY(bx, by, r, 0), ly = y0 + RACK.h / 2;
      for (let q = 0; q < 4; q++) { const sy = by + 5500 + q * 9000; k.line(lx, ly, spX, sy, { col: C.sig, lw: 1.2, alpha: 0.5 * v });
        k.flow(u => [lerp(lx, spX, u), lerp(ly, sy, u)], 1, (f.t * 0.45 + r * 0.17 + q * 0.31) % 1, C.sig, { size: 2.6, len: 0.2, alpha: v, glow: 8 }); }
      const xr0 = bx + HALL.rx, xr1 = xr0 + HALL.perRow * HALL.pitch;
      k.line(xr0, y0 - 600, xr1, y0 - 600, { col: C.amb, lw: 2, alpha: 0.6 * v });
      k.flow(u => [lerp(xr0 - 1500, xr1, u), y0 - 600], 5, (f.t * 0.18 + r * 0.1) % 1, C.amb, { size: 2.6, len: 0.05, alpha: v, glow: 8 });
      k.line(xr0 - 1500, y0 + RACK.h + 600, xr1, y0 + RACK.h + 600, { col: COOL, lw: 2, alpha: 0.6 * v });
      k.flow(u => [lerp(xr1, xr0 - 1500, u), y0 + RACK.h + 600], 5, (f.t * 0.18 + r * 0.23) % 1, COOL, { size: 2.6, len: 0.05, alpha: v });
      k.box(bx + 300, y0 + 600, 1300, RACK.h - 1200, { stroke: COOL, fill: C.bg, r: 200, lw: 1.2, alpha: 0.9 });
    }
  }
  function drawCampus(k, f) {
    const C = k.C, v = vis(CAMPUS.px * 4, 300, 700) * REV(4), pue = f.key === "pue" ? clamp01(f.p / 0.3) : 0;
    // grid line -> substation -> buildings (power), buildings -> cooling plant (heat)
    const sx = SUB.x + SUB.w, sy = SUB.y + SUB.h / 2;
    if (v > 0) {
      k.line(SUB.x - 200000, sy - 20000, SUB.x, sy, { col: C.amb, lw: 3, alpha: 0.8 * v });
      k.flow(u => [lerp(SUB.x - 200000, SUB.x, u), lerp(sy - 20000, sy, u)], 6, (f.t * 0.3) % 1, C.amb, { size: 3.5, len: 0.08, alpha: v, glow: 10 });
      k.box(SUB.x, SUB.y, SUB.w, SUB.h, { fill: C.bg2, stroke: C.amb, r: 3000, lw: 1.5, alpha: v });
      for (let j = 0; j < 3; j++) for (let q = 0; q < 2; q++) k.box(SUB.x + 5000 + j * 10000, SUB.y + 8000 + q * 20000, 6000, 12000, { stroke: C.amb, r: 1000, lw: 1, alpha: 0.6 * v });
      k.box(PLANT.x, PLANT.y, PLANT.w, PLANT.h, { fill: C.bg2, stroke: COOL, r: 3000, lw: 1.5, alpha: v });
      for (let j = 0; j < 2; j++) for (let q = 0; q < 4; q++) { const cx = PLANT.x + 11000 + j * 18000, cy = PLANT.y + 9000 + q * 14000; const c = k.ctx; c.save(); c.globalAlpha = 0.7 * v; c.strokeStyle = COOL; c.lineWidth = k.px(1.2); c.beginPath(); c.arc(cx, cy, 5000, 0, Math.PI * 2); c.stroke(); c.restore();
        // heat leaving the plant
        const hk = (f.t * 0.5 + j * 0.3 + q * 0.21) % 1; k.dot(cx, cy - 5000 - hk * 16000, k.px(2.4), C.amb, { alpha: (1 - hk) * 0.7 * v, glow: 6 }); }
    }
    for (let r = 0; r < CAMPUS.rows; r++) for (let c = 0; c < CAMPUS.cols; c++) {
      const [bx, by] = bldg(c, r), focus = c === 1 && r === 0;
      drawHall(k, bx, by, f, focus);
      if (v <= 0) continue;
      const by0 = by + HALL.h / 2, j = r * 4 + c;
      // power feed from the substation
      const pp = u => bez([[sx, sy], [sx + 15000, sy], [bx - 9000, by0 - 6000], [bx, by0 - 6000]], u);
      k.curve([[sx, sy], [sx + 15000, sy], [bx - 9000, by0 - 6000], [bx, by0 - 6000]], { col: C.amb, lw: 1.4, alpha: 0.5 * v });
      k.flow(pp, 2, (f.t * 0.35 + j * 0.11) % 1, C.amb, { size: 2.8, len: 0.12, alpha: v, glow: 8 });
      // coolant to and from the cooling plant
      const xe = bx + HALL.w, cp = u => bez([[xe, by0 + 6000], [xe + 9000, by0 + 6000], [PLANT.x - 15000, PLANT.y + PLANT.h / 2], [PLANT.x, PLANT.y + PLANT.h / 2]], u);
      if (c === 3 || r === 1 || true) { k.curve([[xe, by0 + 6000], [xe + 9000, by0 + 6000], [PLANT.x - 15000, PLANT.y + PLANT.h / 2], [PLANT.x, PLANT.y + PLANT.h / 2]], { col: COOL, lw: 1.2, alpha: 0.35 * v });
        k.flow(cp, 2, (f.t * 0.3 + j * 0.13) % 1, COOL, { size: 2.6, len: 0.12, alpha: 0.9 * v }); }
    }
    // power to the cooling plant itself (the overhead that PUE counts)
    if (pue > 0) { const pp = u => bez([[sx, SUB.y + SUB.h], [sx + 60000, SUB.y + SUB.h + 50000], [PLANT.x - 60000, PLANT.y + PLANT.h + 40000], [PLANT.x + PLANT.w / 2, PLANT.y + PLANT.h]], u);
      k.curve([[sx, SUB.y + SUB.h], [sx + 60000, SUB.y + SUB.h + 50000], [PLANT.x - 60000, PLANT.y + PLANT.h + 40000], [PLANT.x + PLANT.w / 2, PLANT.y + PLANT.h]], { col: C.amb, lw: 1.6, alpha: 0.6 * pue, dash: [6, 5] });
      k.flow(pp, 5, (f.t * 0.2) % 1, C.amb, { size: 3, len: 0.06, alpha: pue, glow: 8 }); }
  }
  function grid(k) { // zoom-aware dot grid: two decades, the finer one fading in
    const ctx = k.ctx, L = Math.log10(34 / k.scale), n = Math.ceil(L), fr = n - L;
    [[Math.pow(10, n), 0.25 + 0.75 * fr], [Math.pow(10, n + 1), 1]].forEach(([g, a]) => {
      ctx.save(); ctx.fillStyle = k.C.line; ctx.globalAlpha = a; const r = 1 / k.scale;
      for (let x = Math.floor(V.x0 / g) * g; x < V.x1; x += g) for (let y = Math.floor(V.y0 / g) * g; y < V.y1; y += g) ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      ctx.restore(); });
  }

  const SPOT = { chip: [G0[0] - 6, G0[1] - 6, GPU.w + 12, GPU.h + 12], tray: [T0[0] - 8, T0[1] - 8, TRAY.w + 16, TRAY.h + 16], rack: [R0[0] - 40, R0[1] - 500, RACK.w + 80, RACK.h + 540], hall: [B0[0] - 1500, B0[1] - 1500, HALL.w + 3000, HALL.h + 3000] };
  function spot(k, key, a) { const r = SPOT[key]; if (!r || a <= 0) return; const [x, y, w, h] = r, o = { fill: k.C.bg, r: 0, alpha: a }, X0 = Math.min(V.x0, x) - 10, Y0 = Math.min(V.y0, y) - 10, X1 = Math.max(V.x1, x + w) + 10, Y1 = Math.max(V.y1, y + h) + 10;
    k.box(X0, Y0, X1 - X0, y - Y0, o); k.box(X0, y + h, X1 - X0, Y1 - y - h, o); k.box(X0, y, x - X0, h, o); k.box(x + w, y, X1 - x - w, h, o); }
  function tag(k, x, y, s, col, o = {}) { // label on a small dark plate so it reads over busy drawings
    const [sx, sy] = k.toScreen(x, y), c = k.ctx; c.save(); k.screen(); font(c, o.size || 12, "--f-display", o.weight || "600");
    const w = c.measureText(s).width + 14, al = o.align || "center", lx = al === "left" ? sx : al === "right" ? sx - w : sx - w / 2;
    c.globalAlpha = 0.88 * (o.alpha == null ? 1 : o.alpha); c.fillStyle = k.C.bg; rr(c, lx, sy - 11, w, 22, 6); c.fill();
    c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.fillStyle = col; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(s, lx + 7, sy + 0.5); c.restore(); k.world(); }

  storyFilm(fig, {
    label: "Animated zoom from one accelerator chip out to a gigawatt datacenter campus",
    steps, cams: { default: { x: 0, y: 0, w: 100, h: 50 } }, grid: false,
    draw(k, f) {
      const C = k.C; KK = k; REV = i => f.i > i ? 1 : f.i === i ? clamp01((f.p - 0.1) / 0.35) : 0;
      let cam = camAt(f.i, f.p);
      if (k.W < 640) { const s = Math.min((k.W - 24) / cam.w, (k.H - 24) / cam.h), hw = (62 + 17 * HUDROWS) / s; cam = { x: cam.x, y: cam.y - hw, w: cam.w, h: cam.h + hw }; }
      k.begin(k.H, cam, { grid: false });
      const [x0, y0] = k.toWorld(0, 0), [x1, y1] = k.toWorld(k.W, k.H); V = { x0, y0, x1, y1 };
      grid(k);
      drawCampus(k, f);
      spot(k, f.key, 0.55 * clamp01((f.p - 0.05) / 0.3));
      if (f.i > 0) spot(k, steps[f.i - 1].key, 0.55 * (1 - clamp01(f.p / 0.3)));
      // labels: each level names its parts while it is on stage
      const L = (key, x, y, s, o = {}) => { const a = key === f.key ? clamp01((f.p - 0.45) / 0.15) : 0; if (a > 0) tag(k, x, y, s, o.col || C.ink, { alpha: a, ...o }); };
      const ph = k.W < 640;
      L("chip", G0[0] + 60, G0[1] + 50, "compute dies", { col: C.amb });
      L("chip", G0[0] + 60, G0[1] + 3, "HBM memory stacks", { col: C.sig });
      L("tray", T0[0] + TRAY.cpus[0] + 35, T0[1] + 60, "Grace CPU", { col: C.ink, size: 11 });
      L("tray", T0[0] + TRAY.gpus[0] + 60, T0[1] + 60, "GPU", { col: C.amb, size: 11 });
      L("tray", T0[0] + TRAY.gpus[1] + 60, T0[1] + 60, "GPU", { col: C.amb, size: 11 });
      L("tray", T0[0] + TRAY.gpus[1] + 72, T0[1] + 5, "coolant through cold plates", { col: COOL, size: 11 });
      if (ph) { const mx = R0[0] + RACK.w / 2;
        L("rack", mx, R0[1] + slotY(4), "18 compute trays", { col: C.ink, size: 11 });
        L("rack", mx, R0[1] + slotY(15), "9 NVLink switches", { col: C.sig, size: 11 });
        L("rack", mx, R0[1] + slotY(24), "liquid cooled", { col: COOL, size: 11 }); }
      else {
        L("rack", R0[0] - 120, R0[1] + slotY(5), "18 compute trays", { align: "right", col: C.ink });
        L("rack", R0[0] - 120, R0[1] + slotY(15), "9 NVLink switch trays", { align: "right", col: C.sig });
        L("rack", R0[0] + RACK.w + 120, R0[1] + slotY(15), "NVLink spine", { align: "left", col: C.sig });
        L("rack", R0[0] - 120, R0[1] + slotY(24), "coolant in and out", { align: "right", col: COOL }); }
      L("rack", R0[0] + RACK.w / 2, R0[1] - 480, "power ~120 kW", { col: C.amb });
      L("hall", B0[0] + HALL.w / 2 - 6000, B0[1] - 1800, ph ? "rows of racks" : "rows of racks · power above, coolant below", { col: C.ink });
      L("hall", B0[0] + HALL.w - 2400, B0[1] + HALL.h + 1800, ph ? "scale-out network" : "leaf and spine switches: the scale-out network", { col: C.sig, align: "right" });
      L("hall", B0[0] + 950, B0[1] + HALL.h + 1800, "CDUs", { col: COOL });
      ["campus", "pue"].forEach(key => {
        L(key, SUB.x + SUB.w / 2, SUB.y + SUB.h + 9000, "substation", { col: C.amb });
        L(key, PLANT.x + PLANT.w / 2, PLANT.y + PLANT.h + 9000, "cooling plant", { col: COOL });
        L(key, SUB.x - 90000, SUB.y - 12000, "from the grid", { col: C.amb });
      });
      L("campus", 125000, -9000, "8 buildings, one cluster", { col: C.ink });
      // readouts
      const P = f.p;
      if (f.key === "chip") hud(k, "tr", "One accelerator (Blackwell GPU)", [["memory", "~186 GB HBM3E", C.sig], ["memory bandwidth", "8 TB/s", C.sig], ["power", "≈ 1 kW class", C.amb]]);
      if (f.key === "tray") hud(k, "tr", "Compute tray", [["holds", "4 GPUs + 2 CPUs"], ["cooling", "cold plates", COOL], ["height", "1 rack unit"]]);
      if (f.key === "rack") hud(k, "tr", "One rack: GB200 NVL72", [["GPUs", "72 · plus 36 CPUs"], ["NVLink in the rack", "130 TB/s", C.sig], ["power", "~120 kW", C.amb], ["ordinary rack", "well under 20 kW"]]);
      if (f.key === "hall") hud(k, "tr", "Cluster", [["holds", "hundreds of racks"], ["network", "InfiniBand or Ethernet", C.sig], ["power", "tens to hundreds of MW", C.amb]]);
      if (f.key === "campus") hud(k, "tr", "Campus · Abilene, Texas", [["designed for", "1.2 GW", C.amb], ["GPUs", "450,000+ GB200"], ["buildings", "8"]]);
      if (f.key === "pue") { const it = 100, fac = Math.round(lerp(100, 120, easeIO((P - 0.15) / 0.5)));
        hud(k, "tr", "Power in, heat out", [["IT equipment", it + " MW"], ["whole facility", fac + " MW", C.amb], ["PUE = facility ÷ IT", (fac / it).toFixed(2), C.amb], ["Google's fleet PUE", "≈ 1.09"]]); }
    }
  });
});
