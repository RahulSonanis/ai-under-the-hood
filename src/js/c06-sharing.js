/* Chapter 6: decode step animation, static vs continuous batching, roofline tool */
chapter("sharing", () => {
  const BW = 3.35e12 * 0.7, F = 989e12 * 0.5;
  const models = { 8: { N: 8.03e9, gpus: 1, kv: 131072 }, 70: { N: 70.6e9, gpus: 2, kv: 327680 } };
  let phase = 0, emitted = [];
  function calc() {
    const m = models[$("#ds-m").value], B = 2 ** num("ds-b"), c = num("ds-c"), price = num("ds-p");
    const W = m.N * 2, kvB = B * c * m.kv, mem = (W + kvB) / (BW * m.gpus), comp = 2 * m.N * B / (F * m.gpus), t = Math.max(mem, comp);
    const fits = W / m.gpus + kvB / m.gpus <= 80e9 * 0.95;
    return { m, B, c, W, kvB, mem, comp, t, fits, tps: B / t, cost: price * m.gpus / 3600 * t / B * 1e6 };
  }
  function readouts(s) {
    $("#ds-read").innerHTML = `
      <div class="readout ${s.fits ? "" : "bad"}"><div class="k">Each person sees</div><div class="v">${s.fits ? (1 / s.t).toFixed(0) + " tok/s" : "—"}</div><div class="s">${(s.t * 1000).toFixed(1)} ms per step</div></div>
      <div class="readout hot"><div class="k">GPU total</div><div class="v">${s.fits ? fmt(s.tps, 1) + " tok/s" : "—"}</div></div>
      <div class="readout ${s.comp > s.mem ? "ok" : ""}"><div class="k">Bottleneck</div><div class="v" style="font-size:0.95rem">${s.comp > s.mem ? "maths" : s.kvB > s.W ? "reading KV cache" : "reading weights"}</div><div class="s">maths units ${(s.comp / s.t * 100).toFixed(s.comp / s.t < 0.1 ? 1 : 0)}% busy</div></div>
      <div class="readout ${s.fits ? "" : "bad"}"><div class="k">Cost per million tokens</div><div class="v">${s.fits ? "$" + s.cost.toFixed(2) : "won't fit"}</div><div class="s">${s.fits ? "GPU time only" : "KV cache exceeds memory"}</div></div>`;
  }
  const cv = $("#ds-cv");
  function draw(dt) {
    const s = calc(); const { ctx, w } = setupCanvas(cv, 230); ctx.clearRect(0, 0, w, 230);
    if (!s.fits) { ctx.fillStyle = css("--crit-soft"); rr(ctx, 4, 20, w - 8, 190, 8); ctx.fill(); font(ctx, 15, "--f-display", "700"); ctx.fillStyle = css("--crit"); ctx.textAlign = "center";
      ctx.fillText("This batch doesn't fit in GPU memory", w / 2, 100); font(ctx, 13); ctx.fillStyle = css("--ink"); ctx.fillText(`${s.B} conversations × ${s.c.toLocaleString()} tokens of KV cache = ${bytes(s.kvB)}`, w / 2, 126); ctx.fillText("Lower the batch or the conversation length.", w / 2, 148); return s; }
    const hbmW = Math.min(150, w * 0.25), cuX = hbmW + Math.max(60, w * 0.18), cuW = Math.min(150, w * 0.22), outX = cuX + cuW + 24;
    // HBM block
    ctx.fillStyle = css("--surface"); ctx.strokeStyle = css("--line"); rr(ctx, 4, 20, hbmW, 170, 8); ctx.fill(); ctx.stroke();
    const wf = s.W / (s.W + s.kvB); ctx.fillStyle = css("--accent"); ctx.globalAlpha = 0.85; rr(ctx, 12, 30, hbmW - 16, 150 * wf, 4); ctx.fill(); ctx.fillStyle = css("--heat"); if (s.kvB > 0) { rr(ctx, 12, 30 + 150 * wf + 2, hbmW - 16, Math.max(2, 150 * (1 - wf) - 2), 4); ctx.fill(); } ctx.globalAlpha = 1;
    const nar = w < 480; font(ctx, 11, "--f-display", "700"); ctx.fillStyle = css("--ink"); ctx.textAlign = "center"; ctx.fillText(nar ? "Memory" : "GPU memory (HBM)", 4 + hbmW / 2, 14);
    font(ctx, 10, "--f-mono"); ctx.fillStyle = css("--surface"); ctx.fillText(nar ? bytes(s.W) : "weights " + bytes(s.W), 4 + hbmW / 2, 46); if (1 - wf > 0.12) ctx.fillText(nar ? "KV" : "KV " + bytes(s.kvB), 4 + hbmW / 2, 30 + 150 * wf + 16);
    // bus with moving packets: speed so that one sweep = memory time share
    const memShare = s.mem / s.t, compShare = s.comp / s.t;
    const prevPhase = phase; phase = (phase + (dt || 0) * 0.6) % 1; const wrapped = phase < prevPhase;
    const bx0 = 8 + hbmW, bx1 = cuX - 4; ctx.strokeStyle = css("--line"); ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(bx0, 105); ctx.lineTo(bx1, 105); ctx.stroke(); ctx.lineWidth = 1;
    const memPhase = Math.min(1, phase / Math.max(0.05, memShare));
    if (phase <= memShare) for (let k = 0; k < 6; k++) { const u = (memPhase + k / 6) % 1; ctx.fillStyle = k % 3 === 2 && s.kvB > 0.2 * s.W ? css("--heat") : css("--accent"); ctx.fillRect(bx0 + u * (bx1 - bx0) - 5, 100, 10, 10); }
    font(ctx, 10, "--f-mono"); ctx.fillStyle = css("--muted"); ctx.textAlign = "center"; ctx.fillText((nar ? "" : "read ") + (s.mem * 1000).toFixed(1) + " ms", (bx0 + bx1) / 2, 92);
    // compute units grid
    ctx.fillStyle = css("--surface"); ctx.strokeStyle = css("--line"); rr(ctx, cuX, 20, cuW, 170, 8); ctx.fill(); ctx.stroke();
    font(ctx, 11, "--f-display", "700"); ctx.fillStyle = css("--ink"); ctx.fillText(nar ? "Maths" : "Maths units", cuX + cuW / 2, 14);
    const cols = 8, rows = 8, cw = (cuW - 20) / cols, ch = 150 / rows; const busy = compShare; const lit = Math.round(busy * cols * rows);
    const computing = phase > memShare || compShare >= memShare;
    for (let i = 0; i < cols * rows; i++) { const x = cuX + 10 + (i % cols) * cw, y = 30 + Math.floor(i / cols) * ch; ctx.fillStyle = i < lit && computing ? css("--ok") : css("--grid"); ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); }
    font(ctx, 10, "--f-mono"); ctx.fillStyle = css("--muted"); ctx.fillText((nar ? "" : "compute ") + (s.comp * 1000).toFixed(2) + " ms", cuX + cuW / 2, 205);
    // outputs: people lanes
    const lanes = Math.min(s.B, 32); const avail = w - outX - 6; const lh = 170 / Math.max(lanes, 1);
    font(ctx, 11, "--f-display", "700"); ctx.fillStyle = css("--ink"); ctx.textAlign = "left"; if (avail > 60) ctx.fillText(`${s.B} ${s.B === 1 ? "person" : "people"}${s.B > 32 ? " (32 shown)" : ""}`, outX, 14);
    if (wrapped || !emitted.length) emitted.push(0);
    emitted = emitted.map(x => x + (dt || 0) * 0.6).filter(x => x < 1.4);
    for (let l = 0; l < lanes && avail > 40; l++) { const y = 20 + l * lh + lh / 2; ctx.strokeStyle = css("--grid"); ctx.beginPath(); ctx.moveTo(outX, y); ctx.lineTo(w - 6, y); ctx.stroke();
      emitted.forEach(e => { const x = outX + e / 1.4 * avail; ctx.fillStyle = css("--heat"); ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, Math.min(4, lh / 3)), 0, 7); ctx.fill(); }); }
    if (avail > 130) { font(ctx, 10, "--f-mono"); ctx.fillStyle = css("--muted"); ctx.fillText("one token each per step", outX, 205); }
    return s;
  }
  let playing = !reduceMotion();
  const loop = animLoop(dt => { draw(dt); });
  function update() { const s = draw(0); readouts(s); if (playing) loop.start(); }
  $("#ds-play").addEventListener("click", () => { playing = !playing; $("#ds-play").textContent = playing ? "Pause animation" : "Play animation"; if (playing) loop.start(); else loop.stop(); });
  if (!playing) $("#ds-play").textContent = "Play animation";
  bindCtl("ds-b", update, e => 2 ** +e.value); bindCtl("ds-c", update, e => (+e.value).toLocaleString() + " tokens"); bindCtl("ds-p", update, e => "$" + (+e.value).toFixed(2));
  $("#ds-m").addEventListener("change", update);
  onRedraw(update);

  /* ---- static vs continuous ---- */
  const S = 8, T = 240; let seed = 5, res = null, cursor = T;
  function simulate() {
    const r = rng(seed), spread = checked("cb-spread"), reqs = [];
    for (let t = 0; t < T; t++) if (r() < 0.16) reqs.push({ arr: t, len: Math.max(3, Math.min(150, Math.round((spread ? 22 : 26) * Math.exp((spread ? 0.95 : 0.15) * gauss(r))))) });
    const run = cont => {
      const grid = Array.from({ length: S }, () => new Array(T).fill(0)); const q = []; let ai = 0, done = 0, lat = 0, busy = 0; const slots = new Array(S).fill(null);
      for (let t = 0; t < T; t++) {
        while (ai < reqs.length && reqs[ai].arr <= t) q.push({ ...reqs[ai++] });
        if (cont) { for (let s = 0; s < S; s++) if (!slots[s] && q.length) { const x = q.shift(); x.left = x.len; slots[s] = x; } }
        else if (slots.every(x => !x || x.left <= 0) && q.length) for (let s = 0; s < S; s++) { slots[s] = null; if (q.length) { const x = q.shift(); x.left = x.len; slots[s] = x; } }
        for (let s = 0; s < S; s++) { const x = slots[s];
          if (x && x.left > 0) { grid[s][t] = 1; busy++; x.left--; if (x.left === 0) { done++; lat += t + 1 - x.arr; x.doneAt = t; if (cont) slots[s] = null; } }
          else if (x && !cont && slots.some(y => y && y.left > 0)) grid[s][t] = 2; }
        grid.done = grid.done || []; grid.done[t] = done; grid.lat = grid.lat || []; grid.lat[t] = done ? lat / done : 0; grid.busy = grid.busy || []; grid.busy[t] = busy;
      }
      return grid;
    };
    res = { A: run(false), B: run(true), n: reqs.length };
  }
  function cdraw() {
    const cv = $("#cb-cv"); const rowH = 9; const H = 2 * S * rowH + 74; const { ctx, w } = setupCanvas(cv, H); ctx.clearRect(0, 0, w, H);
    const lx = w < 560 ? 0 : 92, cw = (w - lx - 4) / T;
    [[res.A, "Static", 18], [res.B, "Continuous", 18 + S * rowH + 30]].forEach(([g, n, y0]) => {
      font(ctx, 12, "--f-display", "700"); ctx.fillStyle = css("--ink"); ctx.textAlign = "left"; if (lx) ctx.fillText(n, 0, y0 + S * rowH / 2 + 4); else ctx.fillText(n, 0, y0 - 4);
      for (let s = 0; s < S; s++) for (let t = 0; t < Math.min(cursor, T); t++) { const v = g[s][t]; ctx.fillStyle = v === 1 ? css("--accent") : v === 2 ? css("--heat") : css("--grid"); ctx.globalAlpha = v === 2 ? 0.5 : 1; ctx.fillRect(lx + t * cw, y0 + s * rowH, Math.ceil(cw), rowH - 1); ctx.globalAlpha = 1; }
    });
    if (cursor < T) { ctx.strokeStyle = css("--ink"); ctx.beginPath(); ctx.moveTo(lx + cursor * cw, 10); ctx.lineTo(lx + cursor * cw, H - 30); ctx.stroke(); }
    font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.fillText(w < 560 ? "blue writing · amber held · grey empty" : "blue = writing a reply · amber = seat held while waiting for batch-mates · grey = empty seat · time →", w < 560 ? 0 : lx, H - 8);
    const t = Math.max(0, Math.floor(Math.min(cursor, T)) - 1);
    const u = g => Math.round(g.busy[t] / (S * (t + 1)) * 100);
    $("#cb-read").innerHTML = `<div class="readout"><div class="k">Requests arriving</div><div class="v">${res.n}</div></div>
      <div class="readout"><div class="k">Static · finished</div><div class="v">${res.A.done[t]}</div><div class="s">seats used ${u(res.A)}% · avg wait+write ${res.A.lat[t].toFixed(0)} steps</div></div>
      <div class="readout ok"><div class="k">Continuous · finished</div><div class="v">${res.B.done[t]}</div><div class="s">seats used ${u(res.B)}% · avg wait+write ${res.B.lat[t].toFixed(0)} steps</div></div>`;
  }
  const cl = animLoop(dt => { cursor += dt * 40; cdraw(); if (cursor >= T) { cursor = T; cdraw(); $("#cb-play").textContent = "Play again"; return false; } });
  $("#cb-play").addEventListener("click", () => { cursor = reduceMotion() ? T : 0; cdraw(); $("#cb-play").textContent = "Playing…"; cl.start(); });
  $("#cb-new").addEventListener("click", () => { seed = (seed * 48271) % 2147483647; simulate(); cursor = T; cdraw(); });
  $("#cb-spread").addEventListener("change", () => { simulate(); cursor = T; cdraw(); });
  simulate(); onRedraw(cdraw);

  /* ---- roofline tool ---- */
  const chips = { h100: [989e12, 3.35e12, "BF16"], b200: [2250e12, 8e12, "BF16"], tpu7: [2307e12, 7.37e12, "BF16"], trn2: [1300e12, 2.9e12, "FP8"] };
  function roof() {
    const [P, B, prec] = chips[$("#rf-chip").value], b = 2 ** num("rf-b"); setCtl("rf-b", num("rf-b"), () => b);
    const ridge = P / B, pts = []; for (let lg = -1; lg <= 4; lg += 0.02) { const I = 10 ** lg; pts.push([I, Math.min(P, I * B) / 1e12]); } const att = Math.min(P, b * B);
    plot($("#rf-cv"), { height: 240, margin: { r: 30 }, x: { min: 0.1, max: 1e4, log: true, label: "arithmetic intensity (FLOPs per byte, log)", fmt: v => v < 1 ? String(v) : fmt(v, 0) }, y: { min: 0.1, max: 1e4, log: true, label: "TFLOPS (log)", fmt: v => v < 1 ? String(v) : fmt(v, 0) },
      series: [{ data: pts, color: css("--accent"), width: 2.5 }, { data: [[b, att / 1e12]], points: true, color: css("--heat"), r: 6 }, { data: [[2000, P / 1e12]], points: true, color: css("--ok"), r: 5 }],
      labels: [{ x: ridge, y: P / 1e12, text: "ridge " + ridge.toFixed(0), dy: -8, align: "center", color: css("--muted") }, { x: b, y: att / 1e12, text: "decode, batch " + b, dx: 8, dy: 14, color: css("--heat"), bold: true }, { x: 2000, y: P / 1e12, text: "prefill / training", dy: 18, align: "center", color: css("--ok") }] });
    $("#rf-read").innerHTML = `<div class="readout"><div class="k">Ridge point</div><div class="v">${ridge.toFixed(0)} FLOP/B</div><div class="s">peak ${fmt(P / 1e12, 0)} TFLOPS ${prec}</div></div>
      <div class="readout ${b < ridge ? "bad" : "ok"}"><div class="k">Decode at batch ${b}</div><div class="v">${(att / P * 100).toFixed(1)}%</div><div class="s">of peak · ${b < ridge ? "memory-bound" : "compute-bound"}</div></div>`;
  }
  $("#rf-chip").addEventListener("change", roof); $("#rf-b").addEventListener("input", roof); $("#rf").addEventListener("toggle", roof); onRedraw(roof);
});
