/* Chapter 10: ring all-reduce, pipeline schedules, memory calculator */
chapter("cluster", () => {
  /* ---- ring all-reduce ---- */
  const n = 4, init = [[3, 1, 4, 1], [5, 9, 2, 6], [5, 3, 5, 8], [9, 7, 9, 3]];
  let buf, st, sending = null; const totals = [0, 1, 2, 3].map(c => init.reduce((a, g) => a + g[c], 0));
  const reset = () => { buf = init.map(r => r.slice()); st = 0; sending = null; draw(); };
  function apply() {
    if (st >= 2 * (n - 1)) return; const s = st;
    const msgs = []; for (let g = 0; g < n; g++) { const c = s < n - 1 ? (g - s + n) % n : (g - (s - (n - 1)) + 1 + n) % n; msgs.push([g, (g + 1) % n, c, buf[g][c]]); }
    msgs.forEach(([, to, c, v]) => { if (s < n - 1) buf[to][c] += v; else buf[to][c] = v; });
    sending = msgs; st++;
  }
  const cv = $("#ar-cv");
  function draw(prog = 1) {
    const H = 360; const { ctx, w } = setupCanvas(cv, H); ctx.clearRect(0, 0, w, H); const cx = w / 2, cy = H / 2, R = Math.min(w / 2 - 82, 140);
    const pos = [0, 1, 2, 3].map(g => [cx + R * Math.cos(-Math.PI / 2 + g * Math.PI / 2), cy + R * Math.sin(-Math.PI / 2 + g * Math.PI / 2)]);
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    const cols = [css("--accent"), css("--heat"), css("--ok"), css("--l3")]; const bw = Math.min(34, (w - 20) / 9), bh = 26;
    pos.forEach(([x, y], g) => { ctx.fillStyle = css("--surface"); ctx.strokeStyle = css("--line"); rr(ctx, x - bw * 2 - 8, y - bh / 2 - 18, bw * 4 + 16, bh + 30, 8); ctx.fill(); ctx.stroke();
      font(ctx, 11, "--f-display", "700"); ctx.fillStyle = css("--muted"); ctx.textAlign = "center"; ctx.fillText("GPU " + (g + 1), x, y - bh / 2 - 4);
      for (let c = 0; c < 4; c++) { const bx = x - bw * 2 + c * bw, by = y - bh / 2 + 4; const done = buf[g][c] === totals[c];
        ctx.fillStyle = cols[c]; ctx.globalAlpha = done ? 0.95 : 0.25; rr(ctx, bx + 1, by, bw - 2, bh, 4); ctx.fill(); ctx.globalAlpha = 1;
        font(ctx, 13, "--f-mono", "600"); ctx.fillStyle = done ? css("--surface") : css("--ink"); ctx.fillText(buf[g][c], bx + bw / 2, by + 18); } });
    if (sending && prog < 1) sending.forEach(([from, to, c, v]) => { const [x0, y0] = pos[from], [x1, y1] = pos[to]; const a0 = Math.atan2(y0 - cy, x0 - cx), a1 = a0 + Math.PI / 2 * prog;
      const x = cx + R * Math.cos(a1), y = cy + R * Math.sin(a1); ctx.fillStyle = cols[c]; rr(ctx, x - 16, y - 12, 32, 24, 5); ctx.fill(); font(ctx, 12, "--f-mono", "600"); ctx.fillStyle = css("--surface"); ctx.textAlign = "center"; ctx.fillText(v, x, y + 5); });
    const phase = st === 0 ? "Start: every GPU has different numbers." : st <= n - 1 ? `Reduce-scatter, step ${st} of ${n - 1}: each GPU adds the chunk it receives to its own.` : st < 2 * (n - 1) ? `All-gather, step ${st - (n - 1)} of ${n - 1}: finished totals are copied around the ring.` : "Done: every GPU holds the same totals [" + totals.join(", ") + "], having sent only 6 small messages each.";
    $("#ar-msg").textContent = phase + " Solid blocks hold a final total.";
    $("#ar-next").disabled = st >= 2 * (n - 1);
  }
  function animateStep(then) { apply(); if (reduceMotion()) { draw(1); then && then(); return; } const t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / 700); draw(k); if (k < 1 && Chapters.current === "cluster") requestAnimationFrame(f); else { draw(1); then && then(); } }; requestAnimationFrame(f); }
  $("#ar-next").addEventListener("click", () => animateStep());
  $("#ar-reset").addEventListener("click", reset);
  $("#ar-play").addEventListener("click", () => { reset(); const go = () => { if (st < 2 * (n - 1)) animateStep(() => setTimeout(go, 250)); }; go(); });
  buf = init.map(r => r.slice()); st = 0; onRedraw(() => draw(1));

  /* ---- pipeline ---- */
  const sched = seg($("#pp-s"), () => { tcur = Infinity; pdraw(); });
  let tcur = Infinity;
  function schedule() {
    const p = num("pp-p"), m = num("pp-m"), kind = sched(); const F = 1, B = 2; const ops = []; // {s, mb, kind, start, dur}
    const fEnd = Array.from({ length: p }, () => []), bEnd = Array.from({ length: p }, () => []); const free = new Array(p).fill(0);
    const order = []; // per stage list of ops in order
    for (let s = 0; s < p; s++) { const L = [];
      if (kind === "gpipe") { for (let i = 0; i < m; i++) L.push(["F", i]); for (let i = m - 1; i >= 0; i--) L.push(["B", i]); }
      else { const warm = Math.min(p - s - 1, m); let f = 0, b = 0; for (let i = 0; i < warm; i++) L.push(["F", f++]); while (f < m) { L.push(["F", f++]); L.push(["B", b++]); } while (b < m) L.push(["B", b++]); }
      order.push(L); }
    const idx = new Array(p).fill(0); let progress = true;
    while (progress) { progress = false;
      for (let s = 0; s < p; s++) { while (idx[s] < order[s].length) { const [k, i] = order[s][idx[s]]; let ready;
          if (k === "F") ready = s === 0 ? 0 : fEnd[s - 1][i]; else ready = s === p - 1 ? fEnd[s][i] : bEnd[s + 1][i];
          if (ready === undefined) break; const start = Math.max(ready, free[s]), d = k === "F" ? F : B; ops.push({ s, i, k, start, d }); free[s] = start + d; (k === "F" ? fEnd : bEnd)[s][i] = start + d; idx[s]++; progress = true; } } }
    const total = Math.max(...free); return { ops, total, p, m };
  }
  function pdraw() {
    const S = schedule(); const cv2 = $("#pp-cv"); const rowH = 28, H = S.p * rowH + 26; const { ctx, w } = setupCanvas(cv2, H); ctx.clearRect(0, 0, w, H);
    const lx = 54, sx = (w - lx - 6) / S.total;
    for (let s = 0; s < S.p; s++) { font(ctx, 11, "--f-display", "700"); ctx.fillStyle = css("--ink"); ctx.textAlign = "left"; ctx.fillText("GPU " + (s + 1), 0, s * rowH + 18); ctx.fillStyle = css("--grid"); ctx.fillRect(lx, s * rowH + 3, w - lx - 6, rowH - 6); }
    S.ops.forEach(o => { if (o.start >= tcur) return; const x = lx + o.start * sx, wd = Math.min(o.d, tcur - o.start) * sx; ctx.fillStyle = o.k === "F" ? css("--accent") : css("--heat"); rr(ctx, x + 1, o.s * rowH + 4, Math.max(1, wd - 2), rowH - 8, 3); ctx.fill();
      if (wd > 16) { font(ctx, 11, "--f-mono", "600"); ctx.fillStyle = css("--surface"); ctx.textAlign = "center"; ctx.fillText(o.i + 1, x + wd / 2, o.s * rowH + 18); } });
    font(ctx, 10, "--f-mono"); ctx.fillStyle = css("--muted"); ctx.textAlign = "left"; ctx.fillText("time →", lx, H - 6);
    const work = S.m * 3, bubble = 1 - work / S.total, theory = (S.p - 1) / (S.m + S.p - 1);
    const peak = Math.max(...Array.from({ length: S.p }, (_, s) => { let live = 0, mx = 0; S.ops.filter(o => o.s === s).sort((a, b) => a.start - b.start).forEach(o => { live += o.k === "F" ? 1 : -1; mx = Math.max(mx, live); }); return mx; }));
    $("#pp-read").innerHTML = `<div class="readout ${bubble > 0.4 ? "bad" : bubble < 0.2 ? "ok" : "hot"}"><div class="k">Time idle (bubble)</div><div class="v">${Math.round(bubble * 100)}%</div><div class="s">formula (p−1)/(m+p−1) = ${Math.round(theory * 100)}%</div></div>
      <div class="readout"><div class="k">Activations held, worst GPU</div><div class="v">${peak} micro-batches</div><div class="s">memory for in-flight work</div></div>`;
  }
  const pl = animLoop(dt => { tcur += dt * 6; pdraw(); if (tcur >= schedule().total) { tcur = Infinity; pdraw(); return false; } });
  $("#pp-play").addEventListener("click", () => { tcur = reduceMotion() ? Infinity : 0; pl.start(); });
  bindCtl("pp-p", () => { tcur = Infinity; pdraw(); }); bindCtl("pp-m", () => { tcur = Infinity; pdraw(); });
  onRedraw(pdraw);

  /* ---- memory calculator ---- */
  const models = { 8: { P: 8.03e9, h: 4096, L: 32, a: 32 }, 70: { P: 70.6e9, h: 8192, L: 80, a: 64 }, 405: { P: 405e9, h: 16384, L: 126, a: 128 } };
  const zero = seg($("#mm-zero"), mem), rc = seg($("#mm-rc"), mem);
  function mem() {
    const m = models[$("#mm-model").value], G = num("mm-gpu") * 1e9, d = 2 ** num("mm-dp"), t = 2 ** num("mm-tp"), p = 2 ** num("mm-pp"), s = 2 ** num("mm-s");
    [["mm-dp", d], ["mm-tp", t], ["mm-pp", p], ["mm-s", s.toLocaleString()]].forEach(([id, v]) => $(`output[for="${id}"]`).textContent = v);
    const z = +zero(), mode = rc(), Pm = m.P / (t * p);
    const w = 2 * Pm / (z >= 3 ? d : 1), g = 2 * Pm / (z >= 2 ? d : 1), o = 12 * Pm / (z >= 1 ? d : 1);
    const per = mode === "none" ? s * m.h * (34 + 5 * m.a * s / m.h) / t : mode === "sel" ? s * m.h * 34 / t : 2 * s * m.h / t; const act = per * m.L, tot = w + g + o + act;
    $("#mm-read").innerHTML = `<div class="readout ${tot <= G * 0.9 ? "ok" : "bad"}"><div class="k">Per GPU</div><div class="v">${bytes(tot)}</div><div class="s">${tot <= G * 0.9 ? "fits with headroom" : tot <= G ? "fits, but under 10% headroom" : "does not fit"}</div></div>
      <div class="readout"><div class="k">GPUs in job</div><div class="v">${(d * t * p).toLocaleString()}</div><div class="s">DP ${d} × TP ${t} × PP ${p}</div></div>
      <div class="readout"><div class="k">Unsharded model state</div><div class="v">${bytes(16 * m.P)}</div></div>`;
    const cvm = $("#mm-bar"); const { ctx, w: W } = setupCanvas(cvm, 66); ctx.clearRect(0, 0, W, 66); const sc = (W - 2) / Math.max(tot, G);
    const parts = [["Weights", w, css("--accent")], ["Grads", g, css("--ok")], ["Optimiser", o, css("--heat")], ["Activations", act, css("--muted")]]; let x = 1;
    parts.forEach(([, v, c]) => { ctx.fillStyle = c; ctx.fillRect(x, 4, Math.max(0, v * sc - 1), 22); x += v * sc; });
    ctx.strokeStyle = css("--crit"); ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1 + G * sc, 0); ctx.lineTo(1 + G * sc, 30); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    let lx = 0; font(ctx, 11); parts.forEach(([nm, v, c]) => { ctx.fillStyle = c; ctx.fillRect(lx, 44, 9, 9); ctx.fillStyle = css("--ink"); const tx = `${nm} ${bytes(v)}`; ctx.fillText(tx, lx + 13, 53); lx += ctx.measureText(tx).width + 24; });
  }
  ["mm-dp", "mm-tp", "mm-pp", "mm-s"].forEach(id => $("#" + id).addEventListener("input", mem)); ["mm-model", "mm-gpu"].forEach(id => $("#" + id).addEventListener("change", mem));
  $("#mm").addEventListener("toggle", mem); onRedraw(mem);
});
