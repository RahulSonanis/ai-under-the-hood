/* Chapter 11 film: one failure stops a synchronous job; checkpoints, restarts and the Llama 3 record. */
chapter("failures", () => {
  const fig = $("#fl-film"); if (!fig) return;
  const FAIL = "#ff7f72";
  const narrow = () => innerW(fig) < 640;
  let nar = false, L = null;
  const cam = (wide, ph) => ({ get x() { return (narrow() ? ph : wide).x; }, get y() { return (narrow() ? ph : wide).y; }, get w() { return (narrow() ? ph : wide).w; }, get h() { return (narrow() ? ph : wide).h; } });
  const hud = (k, cw, cn, title, rows, w, nr = 1) => nar ? k.hud(cn, "", rows.slice(0, nr), { w: Math.min(w, 230) }) : k.hud(cw, title, rows, { w });
  const ease = (p, a, b) => easeIO((p - a) / (b - a));
  const hatch = (k, x, y, w, h, col, a = 0.5) => { const c = k.ctx; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = col; c.globalAlpha = a; c.lineWidth = k.px(1.2); for (let d = -h; d < w; d += 8) { c.beginPath(); c.moveTo(x + d, y + h); c.lineTo(x + d + h, y); c.stroke(); } c.restore(); };

  // two layouts of the same 16,384 GPUs: wide (256 x 64) and phone (128 x 128)
  const LAY = {
    wide: { gx: 40, gy: 70, cols: 256, rows: 64, pitch: 3.6, fc: 150, fr: 30, side: 990, tl: { x: 40, y: 360, w: 1020 } },
    narrow: { gx: 40, gy: 70, cols: 128, rows: 128, pitch: 4, fc: 85, fr: 50, side: 578, tl: { x: 40, y: 640, w: 640 } }
  };
  Object.values(LAY).forEach(l => {
    l.gw = l.cols * l.pitch; l.gh = l.rows * l.pitch; const cs = l.pitch * 0.78;
    l.paths = [new Path2D(), new Path2D()];
    for (let r = 0; r < l.rows; r++) for (let c = 0; c < l.cols; c++) { const h = ((c * 73856093) ^ (r * 19349663)) >>> 0; l.paths[h % 7 === 0 ? 1 : 0].rect(l.gx + c * l.pitch, l.gy + r * l.pitch, cs, cs); }
    l.fx = l.gx + l.fc * l.pitch + cs / 2; l.fy = l.gy + l.fr * l.pitch + cs / 2;
    l.node = { x: l.gx + Math.floor(l.fc / 8) * 8 * l.pitch, y: l.gy + l.fr * l.pitch, w: 8 * l.pitch - l.pitch * 0.22, h: cs };
  });
  const lay = () => narrow() ? LAY.narrow : LAY.wide;
  const camFail = { get x() { return lay().fx - (narrow() ? 210 : 380); }, get y() { return lay().fy - (narrow() ? 190 : 195); }, get w() { return narrow() ? 420 : 760; }, get h() { return narrow() ? 380 : 390; } };

  const steps = [
    { key: "lock", short: "Lockstep", title: "Thousands of GPUs move in lockstep", dur: 6,
      text: [`A big training run is one job spread over 16,384 GPUs (each dot is one). Every step, each chip does its share, then waits for all the others before anyone moves on.`,
             `Training is synchronous: each step ends with collectives across the whole job, so progress is gated by every rank. The job also saves a checkpoint (amber marks) at regular intervals.`] },
    { key: "fail", short: "One fails", title: "One GPU fails, and everything stops", dur: 5.5,
      text: [`Each GPU is quite reliable, but with this many, one breaks every few hours. Because everyone waits for everyone, a single failure stops the entire job.`,
             `Failures add up across components: the job fails at rate nλ, so the mean time between failures M = 1/(nλ). At λ ≈ 0.47 per 1,000 GPU-days and n = 16,384, M ≈ 3.1 hours.`], link: "#ref-9" },
    { key: "back", short: "Roll back", title: "Roll back to the last save", dur: 6,
      text: [`The job goes back to its last saved checkpoint, like reloading a saved game. Everything done since that save is lost and has to be done again.`,
             `A checkpoint holds the full training state: weights, optimiser state and data position. On failure every rank reloads it, so the work since the last checkpoint, on average half an interval, is recomputed.`] },
    { key: "restart", short: "Restart", title: "Swap the bad machine and restart", dur: 6.5,
      text: [`Automation finds the broken machine, swaps in a spare, and every GPU reloads the save. The restart takes time too, then training carries on.`,
             `Lost time per failure ≈ τ/2 + R, where R covers detection, replacing the node from reserved spare capacity and reloading the checkpoint. Meta reserves spare capacity and automates detection to keep R small.`], link: "#ref-15" },
    { key: "tau", short: "How often", title: "How often to save: a sweet spot", dur: 7,
      text: [`Save too often and you waste time saving. Save too rarely and each failure throws away hours of work. There is a sweet spot, and it gets shorter as the cluster gets bigger.`,
             `Waste per unit time ≈ δ/τ + (τ/2 + R)/M. Young's approximation gives τ* ≈ √(2δM): with δ = 5 min and M = 3 h, about 42 min. Daly refined it for when δ is not small relative to M.`], link: "#ref-43" },
    { key: "llama", short: "Llama 3", title: "The real record: Llama 3's 54 days", dur: 7.5,
      text: [`Meta's Llama 3 run on 16,384 GPUs was interrupted without warning 419 times in 54 days, about once every three hours. Automation handled almost all of them, and useful training stayed above 90% of the time.`,
             `466 interruptions: 47 planned and 419 unexpected. About 78% of the unexpected ones were confirmed or suspected hardware, and GPU issues alone were 58.7%. Only three needed significant manual work; effective training time stayed above 90%.`], link: "#ref-9" }
  ];
  const whole = cam({ x: 0, y: 0, w: 1100, h: 560 }, { x: -100, y: -100, w: 915, h: 820 });
  const cams = {
    default: whole, lock: whole, fail: camFail, back: whole, restart: whole,
    tau: cam({ x: 1200, y: 0, w: 1100, h: 560 }, { x: 1225, y: -70, w: 710, h: 640 }),
    llama: cam({ x: 2400, y: 0, w: 1100, h: 560 }, { x: 2405, y: -20, w: 820, h: 740 })
  };

  /* ---------- the job's clock (wall-clock hours) as a function of story time ---------- */
  const SAVE = 1, FAILT = 4.7, RESTART = 0.5; // illustrative: save every hour, failure at 4.7 h, restart 30 min
  function clock(f) {
    if (f.key === "lock") return lerp(3.0, 4.5, f.p);
    if (f.key === "fail") return lerp(4.5, FAILT, clamp01(f.p / 0.25));
    if (f.key === "back") return FAILT;
    if (f.key === "restart") return lerp(FAILT, FAILT + RESTART, ease(f.p, 0.05, 0.72)) + Math.max(0, f.p - 0.72) * 1.0;
    return FAILT + RESTART + 0.28;
  }
  const progress = w => w <= FAILT ? w : w <= FAILT + RESTART ? Math.floor(FAILT / SAVE) * SAVE : Math.floor(FAILT / SAVE) * SAVE + (w - FAILT - RESTART);
  const stepNo = w => Math.floor(progress(w) * 720);

  function drawCluster(k, f) {
    const C = k.C, l = L, ctx = k.ctx, w = clock(f);
    const failed = f.key === "fail" ? f.p > 0.25 : ["back"].includes(f.key) || (f.key === "restart" && f.p < 0.3);
    const stopR = f.key === "fail" ? ease(f.p, 0.28, 0.85) * 1100 : (failed || (f.key === "restart" && f.p < 0.62)) ? 1e4 : 0;
    const running = !failed && !(f.key === "restart" && f.p < 0.62);
    // lockstep pulse: each training step, compute (amber) then sync (teal)
    const ph = (f.t * 1.6) % 1, comp = ph < 0.62;
    const runCol = comp ? C.amb : C.sig, runA = comp ? 0.35 + 0.35 * Math.sin(ph / 0.62 * Math.PI) : 0.55 + 0.35 * Math.sin((ph - 0.62) / 0.38 * Math.PI);
    k.label(l.gx, l.gy - 22, nar ? "16,384 GPUs · one job" : "16,384 GPUs in one training job · each dot is a GPU", { align: "left", col: C.ink, weight: "600" });
    ctx.save(); ctx.fillStyle = runCol; ctx.globalAlpha = running ? runA : 0.5; if (!running && stopR >= 1e4) { ctx.fillStyle = C.line; ctx.globalAlpha = 0.9; } ctx.fill(l.paths[0]); ctx.globalAlpha *= 0.75; ctx.fill(l.paths[1]); ctx.restore();
    if (stopR > 0 && stopR < 1e4) { ctx.save(); ctx.beginPath(); ctx.arc(l.fx, l.fy, stopR, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = C.bg; ctx.fillRect(l.gx - 2, l.gy - 2, l.gw + 4, l.gh + 4); ctx.fillStyle = C.line; ctx.globalAlpha = 0.9; ctx.fill(l.paths[0]); ctx.fill(l.paths[1]); ctx.restore();
      k.ctx.save(); k.ctx.beginPath(); k.ctx.rect(l.gx - 4, l.gy - 4, l.gw + 8, l.gh + 8); k.ctx.clip(); const c = k.ctx; c.strokeStyle = FAIL; c.globalAlpha = 0.5 * (1 - stopR / 1100); c.lineWidth = k.px(2); c.beginPath(); c.arc(l.fx, l.fy, stopR, 0, Math.PI * 2); c.stroke(); k.ctx.restore(); }
    // reload wave during restart (teal sweeping down)
    if (f.key === "restart" && f.p >= 0.3 && f.p < 0.62) { const yy = l.gy + l.gh * ease(f.p, 0.34, 0.6); ctx.save(); ctx.beginPath(); ctx.rect(l.gx - 2, l.gy - 2, l.gw + 4, yy - l.gy + 2); ctx.clip(); ctx.fillStyle = C.sig; ctx.globalAlpha = 0.6; ctx.fill(l.paths[0]); ctx.fill(l.paths[1]); ctx.restore(); k.line(l.gx - 6, yy, l.gx + l.gw + 6, yy, { col: C.sig, lw: 2, glow: 10 }); }
    // the failed GPU and its server (8 GPUs)
    const N = l.node;
    if (failed || (f.key === "restart" && f.p < 0.36)) {
      const out = f.key === "restart" ? ease(f.p, 0.04, 0.3) : 0, pulse = 0.5 + 0.5 * Math.sin(f.t * 8);
      const bx = lerp(N.x, l.side + 10, out), by = lerp(N.y, l.gy + 196, out), bw = lerp(N.w, 80, out), bh = lerp(N.h, 18, out);
      if (!out) { k.box(N.x - 2, N.y - 2, N.w + 4, N.h + 4, { fill: C.line, r: 1 }); }
      k.box(bx, by, bw, bh, { fill: FAIL, r: Math.min(4, bh / 2), glow: 14 + pulse * 10, glowCol: FAIL });
      if (!out) { k.dot(l.fx, l.fy, 1.6, C.bg); const c = k.ctx; c.save(); c.strokeStyle = FAIL; c.globalAlpha = 0.6 + 0.4 * pulse; c.lineWidth = k.px(2); c.beginPath(); c.arc(l.fx, l.fy, 12 + pulse * 6, 0, Math.PI * 2); c.stroke(); c.restore();
        if (f.key === "fail") k.label(l.fx, l.fy - 28, "GPU fails", { col: FAIL, weight: "650", size: 13 }); }
      else k.text(bx + bw / 2, by + bh / 2 + 0.5, "faulty", { col: C.bg, size: 11, weight: "650", alpha: out });
    }
    // side column: spare servers and checkpoint storage
    const sx = l.side, sy = l.gy, sideOn = ["restart", "back"].includes(f.key) || f.key === "lock";
    k.label(sx, sy - 22, "Spares", { align: "left", col: C.muted, size: 11 });
    const swapIn = f.key === "restart" ? ease(f.p, 0.1, 0.32) : (["tau", "llama"].includes(f.key) ? 1 : 0);
    for (let j = 0; j < 3; j++) {
      const moving = j === 0 && swapIn > 0, x0 = sx + 10, y0 = sy + 8 + j * 26;
      if (moving) { const x = lerp(x0, N.x, swapIn), y = lerp(y0, N.y, swapIn), ww = lerp(80, N.w, swapIn), hh = lerp(18, N.h, swapIn); k.box(x, y, ww, hh, { fill: C.sig, r: Math.min(4, hh / 2), glow: swapIn < 1 ? 12 : 0 }); if (swapIn < 0.6) k.text(x + ww / 2, y + hh / 2 + 0.5, "spare", { col: C.bg, size: 11, weight: "650" }); }
      else k.box(x0, y0, 80, 18, { stroke: C.sig, r: 4, alpha: 0.7 });
    }
    // checkpoint storage
    const cy = sy + 100, cyh = 80;
    k.box(sx, cy, 100, cyh, { fill: C.bg2, stroke: f.key === "restart" && f.p > 0.3 && f.p < 0.62 ? C.sig : C.line, r: 10 });
    if (nar) k.label(sx + 50, cy + 22, "Saves", { col: C.ink, size: 11, weight: "600" });
    else { k.label(sx + 50, cy + 20, "Checkpoint", { col: C.ink, size: 11, weight: "600" }); k.label(sx + 50, cy + 36, "storage", { col: C.ink, size: 11, weight: "600" }); }
    const lastSave = Math.floor(Math.min(w, FAILT) / SAVE) * SAVE;
    k.label(sx + 50, cy + (nar ? 58 : 60), nar ? `${lastSave.toFixed(0)} h` : `saved at ${lastSave.toFixed(0)} h`, { col: C.amb, size: 10.5, mono: true });
    // a save in progress: particles from the grid to storage just after each hour
    const sinceSave = w - Math.floor(w / SAVE) * SAVE;
    if (running && sinceSave < 0.12 && w < FAILT) k.flow(u => [lerp(l.gx + l.gw - 40, sx + 10, u), lerp(l.gy + l.gh / 2, cy + cyh / 2, u)], 4, f.t * 1.2, C.amb, { size: 2.6 });
    if (f.key === "restart" && f.p > 0.3 && f.p < 0.62) k.flow(u => [lerp(sx, l.gx + l.gw * 0.6, u), lerp(cy + cyh / 2, l.gy + l.gh * ease(f.p, 0.34, 0.6), u)], 6, f.t * 1.4, C.sig, { size: 3 });
    // timeline
    drawTimeline(k, f, w);
    // HUD
    const job = running ? "running" : f.key === "restart" ? (f.p < 0.3 ? "swapping server" : "reloading checkpoint") : "stopped";
    const rows = [["job", job, running ? C.sig : f.key === "restart" ? C.amb : FAIL], ["training step", stepNo(w).toLocaleString(), f.key === "back" && f.p > 0.3 ? C.amb : C.ink], ["GPUs waiting", running ? "0" : "16,383"]];
    if (f.key === "back") { const rb = ease(f.p, 0.35, 0.75); rows[1][1] = Math.round(lerp(stepNo(FAILT - 1e-6), stepNo(lastSave), rb)).toLocaleString(); }
    if (["lock", "fail", "back", "restart"].includes(f.key)) hud(k, f.key === "fail" ? "tl" : "br", "tl", "Training job", rows, 220, 1);
  }
  function drawTimeline(k, f, w) {
    const C = k.C, T = L.tl, H = 6, ux = T.w / H, y = T.y, h = 40;
    k.label(T.x, y - 16, "Wall clock (hours)", { align: "left", col: C.muted, size: 11 });
    k.box(T.x, y, T.w, h, { stroke: C.line, r: 6, alpha: 0.7 });
    for (let hr = 0; hr <= H; hr++) k.label(T.x + hr * ux, y + h + 14, `${hr} h`, { col: C.muted, size: 10.5, mono: true, align: hr === 0 ? "left" : hr === H ? "right" : "center" });
    const shown = Math.min(w, H);
    // useful work up to failure
    const uEnd = Math.min(shown, FAILT);
    const lostOn = f.key === "back" ? ease(f.p, 0.05, 0.35) : ["restart", "tau", "llama"].includes(f.key) ? 1 : 0;
    const lastSave = Math.floor(FAILT / SAVE) * SAVE;
    k.box(T.x, y + 4, uEnd * ux, h - 8, { fill: C.sig, r: 3, alpha: 0.75 });
    if (lostOn > 0) { k.box(T.x + lastSave * ux, y + 4, (FAILT - lastSave) * ux, h - 8, { fill: C.bg, r: 0 }); k.box(T.x + lastSave * ux, y + 4, (FAILT - lastSave) * ux, h - 8, { fill: FAIL, r: 3, alpha: 0.25 + 0.25 * lostOn }); hatch(k, T.x + lastSave * ux, y + 4, (FAILT - lastSave) * ux, h - 8, FAIL, 0.8 * lostOn);
      k.label(T.x + (lastSave + FAILT) / 2 * ux, y - 14, "lost work", { col: FAIL, weight: "650", alpha: lostOn, size: 11.5 }); }
    // restart, then useful work again
    if (shown > FAILT) { const re = Math.min(shown, FAILT + RESTART) - FAILT; k.box(T.x + FAILT * ux, y + 4, re * ux, h - 8, { fill: C.amb, r: 3, alpha: 0.35 }); hatch(k, T.x + FAILT * ux, y + 4, re * ux, h - 8, C.amb, 0.6);
      if (re > 0.2 && !nar) k.label(T.x + (FAILT + re / 2) * ux, y + h + 30, "restart", { col: C.amb, size: 11 }); }
    if (shown > FAILT + RESTART) k.box(T.x + (FAILT + RESTART) * ux, y + 4, (shown - FAILT - RESTART) * ux, h - 8, { fill: C.sig, r: 3, alpha: 0.75 });
    // checkpoint saves
    for (let s = SAVE; s <= Math.min(shown, FAILT); s += SAVE) k.box(T.x + s * ux - 2, y + 2, 4, h - 4, { fill: C.amb, r: 1 });
    for (let s = FAILT + RESTART + 0.3; s < shown; s += SAVE) k.box(T.x + s * ux - 2, y + 2, 4, h - 4, { fill: C.amb, r: 1 });
    // failure mark
    if (w >= FAILT && f.key !== "lock") { const x = T.x + FAILT * ux; k.line(x, y - 4, x, y + h + 4, { col: FAIL, lw: 2.5, glow: 8 }); }
    // rollback arrow
    if (f.key === "back") { const a = ease(f.p, 0.35, 0.75); if (a > 0) { const x1 = T.x + FAILT * ux, x0 = T.x + lastSave * ux, xm = lerp(x1, x0, a);
      k.curve([[x1, y + h + 2], [x1, y + h + 34], [xm + 10, y + h + 34], [xm, y + h + 4]], { col: C.ink, lw: 2 }); k.dot(xm, y + h + 4, 4, C.ink, { glow: 10 });
      if (a > 0.9) k.label(nar ? x0 : x0 - 8, y + h + (nar ? 52 : 34), "back to the last save", { align: nar ? "center" : "right", col: C.ink, size: 11.5, weight: "600" }); } }
    // playhead
    if (["lock", "fail", "restart"].includes(f.key)) k.line(T.x + shown * ux, y - 6, T.x + shown * ux, y + h + 6, { col: C.ink, lw: 1.5, alpha: 0.8 });
  }

  /* ---------- 5. the checkpoint interval ---------- */
  function drawTau(k, f) {
    const C = k.C, p = f.at("tau"), on = f.key === "tau";
    const d = 5, M = 180; // minutes, the chapter's worked example
    const tStar = Math.sqrt(2 * d * M);
    const tau = p < 0.12 ? 15 : p < 0.48 ? lerp(15, 190, easeIO((p - 0.12) / 0.36)) : lerp(190, tStar, easeIO((p - 0.52) / 0.3));
    // mini timeline: 6 hours, failure at 4.7 h
    const TX = 1260, TW = nar ? 660 : 980, TY = 70, TH = 40, ux = TW / 360, fail = 282;
    k.label(TX, TY - 18, `Saving every ${Math.round(tau)} min`, { align: "left", col: C.ink, weight: "600" });
    k.box(TX, TY, TW, TH, { stroke: C.line, r: 6, alpha: 0.7 });
    k.box(TX, TY + 4, fail * ux, TH - 8, { fill: C.sig, r: 3, alpha: 0.6 });
    let last = 0; for (let s = tau; s < fail; s += tau) { k.box(TX + s * ux, TY + 3, Math.max(3, d * ux), TH - 6, { fill: C.amb, r: 2, alpha: 0.95 }); last = s; }
    k.box(TX + (last + (last ? d : 0)) * ux, TY + 4, (fail - last - (last ? d : 0)) * ux, TH - 8, { fill: C.bg, r: 0 });
    hatch(k, TX + (last + (last ? d : 0)) * ux, TY + 4, (fail - last - (last ? d : 0)) * ux, TH - 8, FAIL, 0.85);
    k.line(TX + fail * ux, TY - 4, TX + fail * ux, TY + TH + 4, { col: FAIL, lw: 2.5, glow: 8 });
    if (!nar) k.label(TX + fail * ux + 8, TY + TH / 2, "failure", { align: "left", col: FAIL, size: 11.5, weight: "600" });
    if (!nar) { k.label(TX, TY + TH + 16, "amber = time spent saving", { align: "left", col: C.amb, size: 11 }); k.label(TX + 220, TY + TH + 16, "red stripes = work lost", { align: "left", col: FAIL, size: 11 }); }
    // U-curve
    const X0 = 1300, X1 = 1900, Y0 = 500, Y1 = 230, tx = v => lerp(X0, X1, (v - 10) / 190), ty = v => lerp(Y0, Y1, v / 0.6);
    k.line(X0, Y0, X1 + 10, Y0, { col: C.line }); k.line(X0, Y0, X0, Y1 - 10, { col: C.line });
    k.label((X0 + X1) / 2, Y0 + 40, "time between saves τ (minutes) →", { col: C.muted, size: 11 });
    k.label(X0 - 10, Y1 - 4, "time wasted", { align: "left", col: C.muted, size: 11, dy: -10 });
    [30, 60, 90, 120, 150, 180].forEach(v => k.label(tx(v), Y0 + 8, String(v), { col: C.muted, size: 10, mono: true, dy: 4 }));
    const curve = (fn, col, lw) => { const pts = []; for (let v = 10; v <= 200; v += 2) pts.push([tx(v), ty(Math.min(0.62, fn(v)))]); const c = k.ctx; c.save(); c.strokeStyle = col; c.lineWidth = k.px(lw); c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(...q) : c.moveTo(...q)); c.stroke(); c.restore(); };
    const save = v => d / v, lost = v => v / (2 * M), tot = v => save(v) + lost(v);
    const a = ease(p, 0, 0.12);
    k.ctx.save(); k.ctx.globalAlpha = a; curve(save, C.amb, 2); curve(lost, FAIL, 2); curve(tot, C.ink, 3); k.ctx.restore();
    k.label(tx(14), ty(save(14)), "saving", { align: "left", col: C.amb, size: 11.5, alpha: a, dx: 10 });
    k.label(tx(196), ty(lost(196)) + 20, "lost to failures", { align: "right", col: FAIL, size: 11.5, alpha: a });
    k.label(tx(150), ty(tot(150)) - 16, "total", { col: C.ink, size: 11.5, alpha: a, weight: "600" });
    // optimum mark
    const sa = ease(p, 0.78, 0.92);
    if (sa > 0) { k.line(tx(tStar), Y0, tx(tStar), ty(tot(tStar)), { col: C.sig, dash: [4, 4], alpha: sa }); k.label(tx(tStar) + 10, ty(tot(tStar)) + 30, "τ* ≈ √(2δM) ≈ 42 min", { align: "left", col: C.sig, weight: "650", alpha: sa }); }
    // the moving dot
    k.line(tx(tau), ty(tot(tau)), tx(tau), Y0, { col: C.ink, alpha: 0.3 });
    k.dot(tx(tau), ty(tot(tau)), 7, sa > 0.5 ? C.sig : C.ink, { glow: 14 });
    if (on) hud(k, "br", "tl", "Young's rule · δ = 5 min, M = 3 h", [["save every τ", Math.round(tau) + " min"], ["share spent saving δ/τ", Math.round(100 * save(tau)) + "%", C.amb], ["expected loss τ/2M", Math.round(100 * lost(tau)) + "%", FAIL]], 270, 1);
  }

  /* ---------- 6. Llama 3: 54 days ---------- */
  const CAUSES = [["Faulty GPUs", 148, FAIL], ["GPU HBM3 memory", 72, "#ffb547"], ["Network switches and cables", 35, "#8fb3ff"], ["GPU SRAM", 19, "#d59cff"], ["GPU system processor", 17, "#ffd27a"], ["CPUs", 2, "#9be37a"], ["Software, host maintenance, NICs, other", 126, null]];
  const SHORT = ["Faulty GPUs", "HBM3 memory", "Network", "GPU SRAM", "GPU sys. processor", "CPUs", "Software and other"];
  const EVENTS = (() => { const r = rng(54), list = []; CAUSES.forEach((c, ci) => { for (let q = 0; q < c[1]; q++) list.push(ci); }); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const times = list.map(() => r() * 54).sort((a, b) => a - b); return list.map((ci, i) => ({ ci, d: times[i] })); })();
  const PLANNED = (() => { const r = rng(7); return Array.from({ length: 47 }, () => r() * 54).sort((a, b) => a - b); })();
  function drawLlama(k, f) {
    const C = k.C, p = f.at("llama"), on = f.key === "llama";
    const day = ease(p, 0.05, 0.8) * 54;
    const TX = 2460, TW = nar ? 720 : 980, TY = 80, TH = 50, ux = TW / 54;
    k.label(TX, TY - 30, nar ? "Llama 3 405B · 16,384 H100s" : "Llama 3 405B pre-training · 16,384 H100s · a 54-day snapshot", { align: "left", col: C.ink, weight: "600" });
    k.box(TX, TY, TW, TH, { stroke: C.line, r: 6, alpha: 0.7 });
    k.box(TX, TY + 4, day * ux, TH - 8, { fill: C.sig, r: 3, alpha: 0.18 });
    for (let dd = 0; dd <= 54; dd += nar ? 18 : 9) k.label(TX + dd * ux, TY + TH + 30, `day ${dd}`, { col: C.muted, size: 10.5, mono: true, align: dd === 0 ? "left" : dd === 54 ? "right" : "center" });
    const counts = CAUSES.map(() => 0); let n = 0;
    EVENTS.forEach(e => { if (e.d > day) return; n++; counts[e.ci]++; const col = CAUSES[e.ci][2] || C.muted; k.line(TX + e.d * ux, TY + 6, TX + e.d * ux, TY + TH - 6, { col, lw: 1.3, alpha: 0.9 }); });
    let np = 0; PLANNED.forEach(d => { if (d > day) return; np++; k.line(TX + d * ux, TY + TH + 4, TX + d * ux, TY + TH + 14, { col: C.muted, lw: 1.3 }); });
    k.line(TX + day * ux, TY - 6, TX + day * ux, TY + TH + 16, { col: C.ink, lw: 1.5, alpha: 0.8 });
    if (!nar) k.label(TX + TW, TY - 14, "unexpected (coloured by cause) above · planned below", { align: "right", col: C.muted, size: 10.5 });
    // cause bars
    const BY = 220, RH = nar ? 44 : 34, LX = nar ? 2700 : 2730, BX = LX + 12, BW = (nar ? 400 : 440) / 148;
    k.label(LX, BY - 24, "Causes of the 419 unexpected interruptions", { align: "right", col: C.muted, size: 11, dx: 0, alpha: nar ? 0 : 1 });
    CAUSES.forEach(([nm, tot, col], i) => {
      const y = BY + i * RH, c = col || C.muted;
      k.label(LX, y + RH / 2 - 2, nar ? SHORT[i] : nm, { align: "right", col: C.ink, size: 11.5 });
      k.box(BX, y + 6, tot * BW, RH - 14, { stroke: C.line, r: 4, alpha: 0.6 });
      if (counts[i]) k.box(BX, y + 6, counts[i] * BW, RH - 14, { fill: c, r: 4, alpha: 0.9 });
      k.label(BX + Math.max(tot, counts[i]) * BW + 10, y + RH / 2 - 2, String(counts[i]), { align: "left", col: counts[i] === tot ? C.ink : C.muted, size: 11.5, mono: true, weight: "600" });
    });
    const hrs = n ? (day * 24 / n) : 0;
    if (on) hud(k, "br", "bl", "Meta, Llama 3 405B", [["interruptions", `${n + np} (${np} planned)`], ["unexpected", String(n), FAIL], ["one every", n > 20 ? hrs.toFixed(1) + " h" : "–"], ["needed manual work", p > 0.85 ? "only 3" : "…"], ["effective training time", p > 0.85 ? "above 90%" : "…", C.sig]], 250, 1);
  }

  storyFilm(fig, {
    label: "Animated explanation of what happens when a GPU fails during training",
    steps, cams,
    draw(k, f) {
      nar = narrow(); L = lay();
      const c = k.cam;
      if (c.x < 1150) drawCluster(k, f);
      if (c.x + c.w > 1150 && c.x < 2350) drawTau(k, f);
      if (c.x + c.w > 2350) drawLlama(k, f);
    }
  });
});
