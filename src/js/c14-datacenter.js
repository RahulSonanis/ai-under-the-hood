/* Chapter 14: chip-to-campus zoom + power calculator */
chapter("datacenter", () => {
  const L = [
    { t: "One accelerator (GPU)", r: [["Memory", "~186 GB HBM3E"], ["Memory bandwidth", "8 TB/s"], ["Power", "≈1 kW class"]], d: "A Blackwell GPU: a silicon package with compute dies surrounded by stacks of high-bandwidth memory. It does the matrix maths. In the GB200 NVL72, 72 of these share one NVLink domain; 13.4 TB of HBM3E across 72 GPUs is about 186 GB each." },
    { t: "Compute tray", r: [["Holds", "4 GPUs + 2 Grace CPUs"], ["Cooling", "cold plates on chips"], ["Height", "1 rack unit"]], d: "Each GB200 superchip pairs one Grace CPU with two Blackwell GPUs; a liquid-cooled tray carries two superchips. The CPUs handle data loading and orchestration, and coolant flows through cold plates mounted directly on the chips." },
    { t: "One rack: GB200 NVL72", r: [["Holds", "72 GPUs · 36 CPUs"], ["NVLink", "130 TB/s inside the rack"], ["Power", "~120 kW"]], d: "18 compute trays plus 9 NVLink switch trays act as one big accelerator: any GPU can reach any other at 1.8 TB/s. Liquid cooling is required. For comparison, conventional server racks have typically been designed for well under 20 kW." },
    { t: "Cluster", r: [["Holds", "hundreds of racks"], ["Network", "InfiniBand or Ethernet fat-tree"], ["Power", "tens to hundreds of MW"]], d: "Racks are joined by a second, scale-out network so tens of thousands of GPUs can work on one job. Meta's two 24,576-GPU H100 clusters, one InfiniBand and one RoCE Ethernet, are an example. Storage systems feed data and absorb terabyte-scale checkpoints." },
    { t: "Campus", r: [["Holds", "450,000+ GB200 GPUs"], ["Power", "1.2 GW"], ["Buildings", "8"]], d: "Abilene, Texas: OpenAI and Oracle's Stargate site, built by Crusoe, designed for 1.2 GW across eight buildings connected into a single cluster. Its own substation, cooling plant and fibre make it as much an energy project as a computing one." }
  ];
  let lvl = 0, anim = 1;
  const cv = $("#zm-cv"); const getL = seg($("#zm-lvl"), v => go(+v));
  function setSeg() { $$("#zm-lvl button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.v === lvl ? "true" : "false")); }
  function go(n) { if (n < 0 || n > 4) return; lvl = n; setSeg(); anim = 0; if (reduceMotion()) { anim = 1; draw(); } else loop.start(); info(); }
  function info() { const l = L[lvl]; $("#zm-t").textContent = l.t; $("#zm-read").innerHTML = l.r.map(([k, v]) => `<div class="readout"><div class="k">${k}</div><div class="v" style="font-size:0.98rem">${v}</div></div>`).join(""); $("#zm-d").textContent = l.d; $("#zm-in").disabled = lvl === 0; $("#zm-out").disabled = lvl === 4; }
  const loop = animLoop(dt => { anim = Math.min(1, anim + dt * 2.2); draw(); if (anim >= 1) return false; });
  function chip(ctx, x, y, s, detail) { ctx.fillStyle = css("--surface"); ctx.strokeStyle = css("--line"); rr(ctx, x, y, s, s, s * 0.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = css("--accent"); ctx.globalAlpha = 0.85; rr(ctx, x + s * 0.28, y + s * 0.18, s * 0.44, s * 0.64, s * 0.03); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = css("--heat"); for (let i = 0; i < 4; i++) { rr(ctx, x + s * 0.06, y + s * (0.16 + i * 0.17), s * 0.17, s * 0.13, s * 0.02); ctx.fill(); rr(ctx, x + s * 0.77, y + s * (0.16 + i * 0.17), s * 0.17, s * 0.13, s * 0.02); ctx.fill(); }
    if (detail) { font(ctx, 12, "--f-mono"); ctx.fillStyle = css("--surface"); ctx.textAlign = "center"; ctx.fillText("compute", x + s / 2, y + s / 2); ctx.fillStyle = css("--ink"); ctx.fillText("HBM", x + s * 0.145, y + s * 0.95); ctx.fillText("HBM", x + s * 0.855, y + s * 0.95); } }
  function draw() {
    const W = innerW(cv.parentElement), H = Math.min(360, Math.max(260, W * 0.62)); const { ctx, w } = setupCanvas(cv, H); ctx.clearRect(0, 0, w, H);
    const e = 1 - (1 - anim) ** 3; const sc = 0.55 + 0.45 * e; ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * e; ctx.translate(w / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-w / 2, -H / 2);
    const cx = w / 2, cy = H / 2;
    if (lvl === 0) { const s = Math.min(w, H) * 0.7; chip(ctx, cx - s / 2, cy - s / 2, s, true); }
    else if (lvl === 1) { const tw = Math.min(w * 0.92, 520), th = tw * 0.42; ctx.fillStyle = css("--surface-2"); ctx.strokeStyle = css("--line"); rr(ctx, cx - tw / 2, cy - th / 2, tw, th, 8); ctx.fill(); ctx.stroke();
      const s = th * 0.5; for (let i = 0; i < 4; i++) chip(ctx, cx - tw / 2 + tw * 0.06 + i * (tw * 0.88 / 4) + (i >= 2 ? 0 : 0), cy - s / 2 - th * 0.08, s, false);
      ctx.fillStyle = css("--ok"); for (let i = 0; i < 2; i++) { rr(ctx, cx - tw * 0.36 + i * tw * 0.44, cy + th * 0.25, tw * 0.24, th * 0.14, 4); ctx.fill(); }
      font(ctx, 12, "--f-mono"); ctx.fillStyle = css("--ink"); ctx.textAlign = "center"; ctx.fillText("Grace CPU", cx - tw * 0.24, cy + th * 0.36 + 18); ctx.fillText("Grace CPU", cx + tw * 0.2, cy + th * 0.36 + 18);
      ctx.strokeStyle = css("--accent"); ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(cx - tw / 2 - 10, cy - th / 2 + 10); ctx.lineTo(cx + tw / 2 + 10, cy - th / 2 + 10); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
      font(ctx, 11); ctx.fillStyle = css("--accent"); ctx.fillText("coolant loop", cx, cy - th / 2 - 4); }
    else if (lvl === 2) { const rh = H * 0.86, rw = rh * 0.42; ctx.fillStyle = css("--surface-2"); ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; rr(ctx, cx - rw / 2, cy - rh / 2, rw, rh, 6); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
      const slots = 27, sh = (rh - 16) / slots; let k = 0;
      for (let i = 0; i < slots; i++) { const isSw = i >= 10 && i < 19; const y = cy - rh / 2 + 8 + i * sh; ctx.fillStyle = isSw ? css("--heat") : css("--accent"); ctx.globalAlpha = 0.8; ctx.fillRect(cx - rw / 2 + 8, y + 1, rw - 16, sh - 2); ctx.globalAlpha = 1; if (!isSw) k++; }
      font(ctx, 12, "--f-display", "700"); ctx.textAlign = "left"; ctx.fillStyle = css("--accent"); ctx.fillText("18 compute trays", cx + rw / 2 + 12, cy - rh / 4); ctx.fillStyle = css("--heat"); ctx.fillText("9 NVLink switch trays", cx + rw / 2 + 12, cy + 4); ctx.fillStyle = css("--ok"); ctx.fillText("liquid in / out", cx + rw / 2 + 12, cy + rh / 4);
      ctx.strokeStyle = css("--ok"); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - rw / 2 - 12, cy + rh / 2); ctx.lineTo(cx - rw / 2 - 12, cy - rh / 2 + 10); ctx.stroke(); ctx.lineWidth = 1; }
    else if (lvl === 3) { const rows = 6, per = Math.max(10, Math.floor(w / 26)); const rw = (w - 40) / per, gap = (H - 60) / rows;
      for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) { ctx.fillStyle = css("--accent"); ctx.globalAlpha = 0.75; ctx.fillRect(20 + i * rw + 2, 30 + r * gap, rw - 4, gap * 0.5); } ctx.globalAlpha = 1;
      ctx.strokeStyle = css("--heat"); ctx.lineWidth = 1.5; for (let r = 0; r < rows; r++) { const y = 30 + r * gap + gap * 0.5 + 4; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(w - 20, y); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(w - 14, 30); ctx.lineTo(w - 14, H - 26); ctx.stroke(); ctx.lineWidth = 1;
      font(ctx, 12, "--f-display", "700"); ctx.fillStyle = css("--heat"); ctx.textAlign = "center"; ctx.fillText("scale-out network (InfiniBand / Ethernet)", w / 2, H - 8); }
    else { const bw = Math.min(110, (w - 80) / 4.6), bh = bw * 0.6; ctx.fillStyle = css("--ok"); ctx.globalAlpha = 0.12; rr(ctx, 10, 10, w - 20, H - 20, 12); ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0; i < 8; i++) { const x = 30 + (i % 4) * (bw + 18), y = 40 + Math.floor(i / 4) * (bh + 36); ctx.fillStyle = css("--surface"); ctx.strokeStyle = css("--ink"); rr(ctx, x, y, bw, bh, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = css("--accent"); ctx.globalAlpha = 0.7; for (let k = 0; k < 6; k++) ctx.fillRect(x + 6 + k * (bw - 12) / 6, y + 6, (bw - 12) / 6 - 3, bh - 12); ctx.globalAlpha = 1; }
      const sx = 30 + 4 * (bw + 18); if (sx + 60 < w) { ctx.strokeStyle = css("--heat"); ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(sx + 10 + k * 14, H - 30); ctx.lineTo(sx + 24 + k * 14, 50); ctx.stroke(); } ctx.lineWidth = 1;
        font(ctx, 11, "--f-display", "700"); ctx.fillStyle = css("--heat"); ctx.textAlign = "left"; ctx.fillText("substation", sx + 4, H - 14); }
      font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.textAlign = "left"; ctx.fillText("8 buildings, wired as one cluster", 30, H - 14); }
    ctx.restore();
  }
  $("#zm-in").addEventListener("click", () => go(lvl - 1)); $("#zm-out").addEventListener("click", () => go(lvl + 1));
  info(); onRedraw(draw);

  /* ---- power ---- */
  const presets = { smol: [384, 700, 1.45, 1.2], meta: [24576, 700, 1.45, 1.2], abilene: [450000, 1200, 1.45, 1.2] };
  const showN = e => Math.round(10 ** +e.value).toLocaleString(), showW = e => (+e.value).toLocaleString() + " W", showO = e => "×" + (+e.value).toFixed(2), showP = e => (+e.value).toFixed(2);
  function power() {
    const n = Math.round(10 ** num("pw-n")), w = num("pw-w"), o = num("pw-o"), p = num("pw-p"), e = num("pw-e"); const it = n * w * o, fac = it * p, gwh = fac * 8760 / 1e9;
    $("#pw-read").innerHTML = `<div class="readout"><div class="k">IT power</div><div class="v">${fmt(it / 1e6, 1)} MW</div></div>
      <div class="readout hot"><div class="k">Whole facility</div><div class="v">${fac >= 1e9 ? (fac / 1e9).toFixed(2) + " GW" : fmt(fac / 1e6, 1) + " MW"}</div><div class="s">cooling and losses ${fmt((fac - it) / 1e6, 1)} MW</div></div>
      <div class="readout"><div class="k">Energy per year</div><div class="v">${fmt(gwh, 1)} GWh</div><div class="s">${money(gwh * 1000 * e)} at full load</div></div>
      <div class="readout"><div class="k">Like powering</div><div class="v">${fmt(fac / 1200, 0)}</div><div class="s">US homes</div></div>`;
    const refs = [["One NVL72 rack", 120e3], ["Meta 24k cluster (est.)", 24576 * 700 * 1.45 * 1.2], ["Abilene campus", 1.2e9], ["Your cluster", fac]];
    const cv2 = $("#pw-cv"); const { ctx, w: W } = setupCanvas(cv2, refs.length * 28 + 4); ctx.clearRect(0, 0, W, 200); const lx = Math.min(170, W * 0.38), mx = Math.log10(2e9), mn = Math.log10(5e4);
    refs.forEach(([nm, v], i) => { const y = i * 28 + 4, fr = (Math.log10(Math.max(v, 5e4)) - mn) / (mx - mn); ctx.fillStyle = i === 3 ? css("--heat") : css("--accent"); ctx.globalAlpha = i === 3 ? 1 : 0.6; ctx.fillRect(lx, y, (W - lx - 74) * fr, 18); ctx.globalAlpha = 1;
      font(ctx, 12); ctx.fillStyle = css("--ink"); ctx.textAlign = "right"; ctx.fillText(nm, lx - 8, y + 13); font(ctx, 11, "--f-mono"); ctx.textAlign = "left"; ctx.fillStyle = css("--muted"); ctx.fillText(v >= 1e9 ? (v / 1e9).toFixed(2) + " GW" : v >= 1e6 ? fmt(v / 1e6, 1) + " MW" : fmt(v / 1e3, 0) + " kW", lx + (W - lx - 74) * fr + 6, y + 13); });
    font(ctx, 10); ctx.fillStyle = css("--muted"); ctx.textAlign = "left";
  }
  const custom = () => { $("#pw-preset").value = "custom"; power(); };
  bindCtl("pw-n", custom, showN); bindCtl("pw-w", custom, showW); bindCtl("pw-o", custom, showO); bindCtl("pw-p", custom, showP); bindCtl("pw-e", power, e => "$" + e.value);
  $("#pw-preset").addEventListener("change", ev => { const p = presets[ev.target.value]; if (!p) return; setCtl("pw-n", Math.log10(p[0]), showN); setCtl("pw-w", p[1], showW); setCtl("pw-o", p[2], showO); setCtl("pw-p", p[3], showP); power(); });
  $("#pw-preset").dispatchEvent(new Event("change")); onRedraw(power);
});
