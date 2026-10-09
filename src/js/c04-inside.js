/* Chapter 4: attention explorer, drag-the-vectors attention, parameter counter */
chapter("inside", () => {
  const base = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "too", "tired", "."];
  let sel = 10; const head = seg($("#ax-head"), draw), adj = seg($("#ax-adj"), draw);
  function weights(i) {
    const h = head(), a = adj(), n = i + 1, w = new Array(n).fill(0.02);
    if (h === "prev") { w[Math.max(0, i - 1)] += 0.8; w[i] += 0.1; }
    else if (h === "sink") { w[0] += 0.75; w[i] += 0.15; }
    else {
      const subj = a === "tired" ? 1 : 5;
      if (i === 7) { w[1] += 0.4; w[5] += 0.36; }                 // "it": can't see the deciding word yet, so it's split
      else if (i === 10) { w[7] += 0.3; w[subj] += 0.55; }        // "tired"/"wide": links "it" to the right noun
      else if (i === 11) { w[subj] += 0.45; w[7] += 0.3; }
      else if (i === 8 || i === 9) { w[7] += 0.6; }
      else if (i === 3 || i === 2) { w[1] += 0.7; }
      else if (i === 5 || i === 4) { w[3] += 0.4; w[1] += 0.3; }
      else if (i === 6) { w[3] += 0.4; w[5] += 0.3; }
      else { w[i] += 0.7; }
    }
    const s = w.reduce((x, y) => x + y, 0); return w.map(x => x / s);
  }
  const cv = $("#ax-cv");
  cv.tabIndex = 0; cv.style.cursor = "pointer";
  cv.addEventListener("keydown", e => { if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return; e.preventDefault(); sel = Math.max(0, Math.min(base.length - 1, sel + (e.key === "ArrowRight" ? 1 : -1))); draw(); });
  function draw() {
    const toks = base.slice(); toks[10] = adj();
    const w0 = innerW(cv.parentElement);
    const probe = setupCanvas(cv, 10).ctx; font(probe, 15, "--f-mono"); const gap = 8; const widths = toks.map(t => probe.measureText(t).width + 14);
    // wrap into lines that fit
    const lines = [[]]; let lw = 0; toks.forEach((t, i) => { if (lw + widths[i] > w0 - 12 && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(i); lw += widths[i] + gap; });
    const arcRoom = 110, lineH = 70, H = arcRoom + lines.length * lineH; const { ctx, w } = setupCanvas(cv, H); ctx.clearRect(0, 0, w, H);
    const pos = []; lines.forEach((ln, li) => { const tot = ln.reduce((a, i) => a + widths[i] + gap, -gap); let x = Math.max(6, (w - tot) / 2); ln.forEach(i => { pos[i] = [x, widths[i], arcRoom + li * lineH + 16]; x += widths[i] + gap; }); });
    const ww = weights(sel);
    ww.forEach((v, j) => { if (j === sel || v < 0.03) return; const [xa, wa, ya] = pos[sel], [xb, wb, yb] = pos[j]; const x1 = xa + wa / 2, x2 = xb + wb / 2, y1 = ya - 16, y2 = yb - 16;
      const top = Math.min(y1, y2) - Math.min(arcRoom - 10, 30 + Math.abs(x1 - x2) * 0.4);
      ctx.strokeStyle = css("--heat"); ctx.globalAlpha = 0.25 + 0.75 * v; ctx.lineWidth = 1 + v * 14; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(x1, top, x2, top, x2, y2); ctx.stroke(); ctx.globalAlpha = 1; });
    toks.forEach((t, i) => { const [x0, wd, y] = pos[i]; const v = i <= sel ? ww[i] : 0;
      ctx.fillStyle = i === sel ? css("--accent") : i > sel ? css("--surface-2") : css("--heat-soft"); rr(ctx, x0, y - 14, wd, 30, 6); ctx.fill();
      ctx.strokeStyle = i > sel ? css("--grid") : css("--line"); ctx.lineWidth = 1; ctx.stroke();
      font(ctx, 15, "--f-mono", i === sel ? "600" : ""); ctx.fillStyle = i === sel ? css("--surface") : i > sel ? css("--muted") : css("--ink"); ctx.textAlign = "center"; ctx.fillText(t, x0 + wd / 2, y + 6);
      if (i < sel && v >= 0.03) { font(ctx, 11, "--f-mono"); ctx.fillStyle = css("--heat"); ctx.fillText(Math.round(v * 100) + "%", x0 + wd / 2, y + 32); } });
    cv._pos = pos;
    const top = ww.map((v, j) => [v, j]).filter(([, j]) => j !== sel).sort((a, b) => b[0] - a[0])[0];
    const noun = adj() === "tired" ? "animal" : "street";
    let extra = "";
    if (head() === "coref" && sel === 7) extra = ` At this point the deciding word ("${esc(adj())}") hasn't arrived yet, so "it" can't know which noun it means: attention is split between "animal" and "street".`;
    if (head() === "coref" && sel === 10) extra = ` Now the model can settle the question: "${esc(adj())}" links back to "it" and to the <b>${noun}</b>, so the information that "it" means the ${noun} is gathered here, at the word that decides it. Swap tired ↔ wide to see it change.`;
    $("#ax-note").innerHTML = sel === 0 ? "The first word can only look at itself." : `<b>"${esc(toks[sel])}"</b> looks most at <b>"${esc(toks[top[1]])}"</b> (${Math.round(top[0] * 100)}%). Words to its right are greyed out: the model can't see the future.` + extra;
    cv.setAttribute("aria-label", `Attention from "${toks[sel]}". Use left and right arrow keys to pick another word.`);
  }
  cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const i = cv._pos.findIndex(([x0, wd, yy]) => x >= x0 && x <= x0 + wd && y >= yy - 16 && y <= yy + 18); if (i >= 0) { sel = i; draw(); } });
  onRedraw(draw);

  /* ---- drag-the-vectors ---- */
  const vc = $("#vq-cv"); const vecs = { q: [0.45, 0.85], k: [[0.95, 0.15], [-0.75, 0.6], [0.1, -0.95]] };
  const vcolors = () => [css("--crit"), css("--ok"), css("--accent")];
  let drag = null, geo = null;
  function vdraw() {
    const size = Math.min(innerW(vc.parentElement), 340); vc.style.width = size + "px";
    const { ctx } = setupCanvas(vc, size); ctx.clearRect(0, 0, size, size); const c = size / 2, R = size / 2 - 22; geo = { c, R, size };
    ctx.strokeStyle = css("--grid"); ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(c - R, c); ctx.lineTo(c + R, c); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.stroke();
    const arrow = (v, col, lab, wdt) => { const x = c + v[0] * R, y = c - v[1] * R; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); font(ctx, 12, "--f-mono", "600"); ctx.fillStyle = css("--ink"); const left = x > c; ctx.textAlign = left ? "right" : "left"; ctx.fillText(lab, x + (left ? -12 : 12), y + (v[1] >= 0 ? -10 : 18)); ctx.lineWidth = 1; };
    const C = vcolors(); vecs.k.forEach((k, i) => arrow(k, C[i], "key " + (i + 1), 2.5)); arrow(vecs.q, css("--ink"), "query", 3.5);
    const s = num("vq-s"), d = 2; const sc = vecs.k.map(k => (vecs.q[0] * k[0] + vecs.q[1] * k[1]) * s * s / Math.sqrt(d) * 2);
    const mx = Math.max(...sc), e = sc.map(v => Math.exp(v - mx)), Z = e.reduce((a, b) => a + b), a = e.map(v => v / Z);
    const bc = $("#vq-bars"); const g = setupCanvas(bc, 150); const cx = g.ctx; cx.clearRect(0, 0, g.w, 150);
    a.forEach((v, i) => { const y = 8 + i * 30; font(cx, 12, "--f-mono"); cx.fillStyle = css("--ink"); cx.textAlign = "left"; cx.fillText("key " + (i + 1), 0, y + 14); cx.fillStyle = css("--grid"); cx.fillRect(56, y + 3, g.w - 110, 14); cx.fillStyle = C[i]; cx.fillRect(56, y + 3, (g.w - 110) * v, 14); cx.fillStyle = css("--muted"); cx.fillText((v * 100).toFixed(0) + "%", g.w - 46, y + 14); });
    const hex = col => { const t = document.createElement("canvas").getContext("2d"); t.fillStyle = col; const m = t.fillStyle.match(/[0-9a-f]{2}/gi); return m ? m.map(h => parseInt(h, 16)) : [128, 128, 128]; };
    const rgb = C.map(hex); const out = [0, 1, 2].map(ch => Math.round(a.reduce((acc, v, i) => acc + v * rgb[i][ch], 0)));
    font(cx, 12, "--f-display"); cx.fillStyle = css("--ink"); cx.fillText("Output = blend of values", 0, 118); cx.fillStyle = `rgb(${out.join(",")})`; rr(cx, 170, 102, 70, 26, 6); cx.fill();
    $("#vq-eq").innerHTML = `scores = q·k × ${(s * s).toFixed(2)} / √2 → [${sc.map(v => v.toFixed(2)).join(", ")}]<br>softmax → [${a.map(v => v.toFixed(2)).join(", ")}]`;
  }
  const at = e => { const r = vc.getBoundingClientRect(); return [(e.clientX - r.left - geo.c) / geo.R, -(e.clientY - r.top - geo.c) / geo.R]; };
  vc.addEventListener("pointerdown", e => { const [x, y] = at(e); const cands = [["q", vecs.q], ...vecs.k.map((k, i) => [i, k])]; let best = null, bd = 0.18;
    cands.forEach(([n, v]) => { const d = Math.hypot(v[0] - x, v[1] - y); if (d < bd) { bd = d; best = n; } }); if (best !== null) { drag = best; vc.setPointerCapture(e.pointerId); vc.style.cursor = "grabbing"; } });
  vc.addEventListener("pointermove", e => { if (drag === null) return; let [x, y] = at(e); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } if (drag === "q") vecs.q = [x, y]; else vecs.k[drag] = [x, y]; vdraw(); });
  vc.addEventListener("pointerup", () => { drag = null; vc.style.cursor = "grab"; });
  // keyboard: Tab focuses the canvas, Q/1/2/3 pick a vector, arrows rotate it
  let vsel = "q"; const names = { q: "query", 0: "key 1", 1: "key 2", 2: "key 3" };
  const ang = v => Math.round(((Math.atan2(v[1], v[0]) * 180 / Math.PI) + 360) % 360);
  const announce = () => { const v = vsel === "q" ? vecs.q : vecs.k[vsel]; vc.setAttribute("aria-label", `Attention vectors. ${names[vsel]} selected, pointing at ${ang(v)} degrees. Press Q, 1, 2 or 3 to choose a vector and the arrow keys to rotate it.`); };
  vc.tabIndex = 0; announce();
  vc.addEventListener("keydown", e => { const k = e.key.toLowerCase();
    if (k === "q") vsel = "q"; else if (["1", "2", "3"].includes(k)) vsel = +k - 1;
    else if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) { e.preventDefault(); const v = vsel === "q" ? vecs.q : vecs.k[vsel], L = Math.hypot(v[0], v[1]) || 1, a = Math.atan2(v[1], v[0]) + (k === "arrowleft" || k === "arrowup" ? 1 : -1) * Math.PI / 24, nv = [L * Math.cos(a), L * Math.sin(a)]; if (vsel === "q") vecs.q = nv; else vecs.k[vsel] = nv; vdraw(); }
    else return; announce(); });
  bindCtl("vq-s", vdraw, e => (+e.value).toFixed(1));
  onRedraw(vdraw);

  /* ---- parameter counter ---- */
  const presets = { l1b: [2048, 16, 32, 8, 8192, 128256, true], smol3: [2048, 36, 16, 4, 11008, 128256, true], l8b: [4096, 32, 32, 8, 14336, 128256, false], l70b: [8192, 80, 64, 8, 28672, 128256, false] };
  const ids = ["pc-h", "pc-L", "pc-a", "pc-kv", "pc-f", "pc-v"], show = e => (+e.value).toLocaleString();
  function count() {
    const [h, L, a, kv0, f, v] = ids.map(num), kv = Math.min(kv0, a), tie = checked("pc-tie"), hd = h / a;
    const attn = L * (2 * h * h + 2 * h * kv * hd), mlp = L * 3 * h * f, emb = v * h * (tie ? 1 : 2), total = attn + mlp + emb + L * 2 * h + h;
    $("#pc-read").innerHTML = `<div class="readout"><div class="k">Total parameters</div><div class="v">${fmt(total, 2)}</div><div class="s">${total.toLocaleString()}</div></div>
      <div class="readout"><div class="k">Weights in BF16</div><div class="v">${bytes(total * 2)}</div></div>
      <div class="readout"><div class="k">Training FLOPs per token</div><div class="v">${sci(6 * total, 1)}</div><div class="s">≈ 6 × parameters</div></div>`;
    const cv2 = $("#pc-cv"); const { ctx, w } = setupCanvas(cv2, 70); ctx.clearRect(0, 0, w, 70); let x = 0;
    const parts = [["Embeddings", emb, css("--heat")], ["Attention", attn, css("--accent")], ["MLP", mlp, css("--ok")]];
    parts.forEach(([, val, col]) => { const pw = val / total * w; ctx.fillStyle = col; ctx.fillRect(x, 4, Math.max(0, pw - 2), 26); x += pw; });
    let lx = 0; font(ctx, 12); parts.forEach(([n, val, col]) => { ctx.fillStyle = col; ctx.fillRect(lx, 46, 10, 10); ctx.fillStyle = css("--ink"); const t = `${n} ${(val / total * 100).toFixed(1)}%`; ctx.fillText(t, lx + 14, 55); lx += ctx.measureText(t).width + 30; });
  }
  ids.forEach(id => bindCtl(id, () => { $("#pc-preset").value = "custom"; count(); }, show));
  $("#pc-tie").addEventListener("change", () => { $("#pc-preset").value = "custom"; count(); });
  $("#pc-preset").addEventListener("change", e => { const p = presets[e.target.value]; if (!p) return; ids.forEach((id, i) => setCtl(id, p[i], show)); $("#pc-tie").checked = p[6]; count(); });
  $("#pc-preset").dispatchEvent(new Event("change"));
  $("#pc").addEventListener("toggle", count);
  onRedraw(count);
});
