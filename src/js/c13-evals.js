/* Chapter 13: noise machine + significance calculator */
chapter("evals", () => {
  let diffs = [], pending = 0, r = rng(3);
  const N = () => Math.round(10 ** num("nm-n"));
  function binom(n, p) { if (n > 400) { return Math.max(0, Math.min(n, Math.round(n * p + Math.sqrt(n * p * (1 - p)) * gauss(r)))); } let k = 0; for (let i = 0; i < n; i++) if (r() < p) k++; return k; }
  function one() { const n = N(); return (binom(n, num("nm-b")) - binom(n, num("nm-a"))) / n * 100; }
  function draw() {
    const a = num("nm-a"), b = num("nm-b"), n = N(); const se = Math.sqrt(a * (1 - a) / n + b * (1 - b) / n) * 100; const span = Math.max(6, Math.abs(b - a) * 100 + 4 * se);
    const cv = $("#nm-cv"); const { ctx, w } = setupCanvas(cv, 220); ctx.clearRect(0, 0, w, 220); const X = v => 20 + (v + span) / (2 * span) * (w - 40); const base = 180;
    ctx.fillStyle = css("--crit"); ctx.globalAlpha = 0.08; ctx.fillRect(20, 10, X(0) - 20, base - 10); ctx.globalAlpha = 1;
    ctx.strokeStyle = css("--line"); ctx.beginPath(); ctx.moveTo(20, base); ctx.lineTo(w - 20, base); ctx.stroke();
    font(ctx, 10, "--f-mono"); ctx.fillStyle = css("--muted"); ctx.textAlign = "center"; const st = span > 20 ? 10 : span > 8 ? 4 : 2;
    for (let v = -Math.floor(span / st) * st; v <= span; v += st) { ctx.fillText((v > 0 ? "+" : "") + v, X(v), base + 14); ctx.fillRect(X(v), base, 1, 4); }
    font(ctx, 11); ctx.fillText("observed score of B minus A (percentage points)", w / 2, base + 32);
    ctx.strokeStyle = css("--ink"); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(0), 10); ctx.lineTo(X(0), base); ctx.stroke(); ctx.strokeStyle = css("--ok"); ctx.beginPath(); ctx.moveTo(X((b - a) * 100), 10); ctx.lineTo(X((b - a) * 100), base); ctx.stroke(); ctx.setLineDash([]);
    font(ctx, 11, "--f-display", "700"); ctx.fillStyle = css("--crit"); ctx.textAlign = "left"; ctx.fillText("B looks worse", 24, 22); ctx.fillStyle = css("--ok"); ctx.textAlign = "center"; ctx.fillText("true gap", X((b - a) * 100), 22);
    const bins = new Map(), bw = 6; diffs.forEach(d => { const bx = Math.round(X(d) / bw); const c = bins.get(bx) || 0; bins.set(bx, c + 1); ctx.fillStyle = d < 0 ? css("--crit") : css("--accent"); ctx.beginPath(); ctx.arc(bx * bw, base - 4 - c * 5, 2.4, 0, 7); ctx.fill(); });
    const worse = diffs.filter(d => d < 0).length;
    $("#nm-read").innerHTML = `<div class="readout"><div class="k">Tests run</div><div class="v">${diffs.length}</div><div class="s">${n.toLocaleString()} questions each</div></div>
      <div class="readout ${diffs.length && worse / diffs.length > 0.1 ? "bad" : "ok"}"><div class="k">Times B looked worse</div><div class="v">${diffs.length ? Math.round(worse / diffs.length * 100) + "%" : "—"}</div><div class="s">even though it ${b > a ? "is better" : b < a ? "is worse" : "is equal"}</div></div>
      <div class="readout"><div class="k">Typical wobble</div><div class="v">±${(1.96 * se).toFixed(1)} pts</div><div class="s">95% of tests fall within this of the true gap</div></div>`;
  }
  const loop = animLoop(() => { for (let k = 0; k < 4 && pending > 0; k++, pending--) diffs.push(one()); draw(); if (pending <= 0) return false; });
  $("#nm-run").addEventListener("click", () => { diffs = []; pending = 200; if (reduceMotion()) { while (pending-- > 0) diffs.push(one()); draw(); return; } loop.start(); });
  const reset = () => { diffs = []; pending = 0; draw(); };
  bindCtl("nm-a", reset, e => (e.value * 100).toFixed(1) + "%"); bindCtl("nm-b", reset, e => (e.value * 100).toFixed(1) + "%"); bindCtl("nm-n", reset, e => Math.round(10 ** +e.value).toLocaleString());
  onRedraw(draw);

  function wilson(p, n, z = 1.96) { const d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [c - h, c + h]; }
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  function calc() {
    const n = num("ev-n"), a = num("ev-a"), b = num("ev-b"), ia = wilson(a, n), ib = wilson(b, n), p = (a + b) / 2, z = (b - a) / Math.sqrt(2 * p * (1 - p) / n), pv = 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));
    const d = Math.abs(b - a), need = d > 0 ? Math.ceil(((1.96 + 0.8416) ** 2) * (a * (1 - a) + b * (1 - b)) / (d * d)) : Infinity;
    const lo = Math.max(0, Math.min(ia[0], ib[0]) - 0.03), hi = Math.min(1, Math.max(ia[1], ib[1]) + 0.03);
    const g = plot($("#ev-cv"), { height: 130, margin: { l: 70, b: 34 }, x: { min: lo, max: hi, label: "accuracy", fmt: v => (v * 100).toFixed(0) + "%" }, y: { min: 0, max: 3, ticks: [] }, series: [] });
    [[ia, a, 2, "Model A", css("--muted")], [ib, b, 1, "Model B", css("--accent")]].forEach(([iv, v, y, nm, c]) => { g.ctx.strokeStyle = c; g.ctx.fillStyle = c; g.ctx.lineWidth = 3; g.ctx.beginPath(); g.ctx.moveTo(g.px(iv[0]), g.py(y)); g.ctx.lineTo(g.px(iv[1]), g.py(y)); g.ctx.stroke(); g.ctx.beginPath(); g.ctx.arc(g.px(v), g.py(y), 6, 0, 7); g.ctx.fill(); font(g.ctx, 12); g.ctx.textAlign = "right"; g.ctx.fillText(nm, g.m.l - 8, g.py(y) + 4); g.ctx.lineWidth = 1; });
    $("#ev-read").innerHTML = `<div class="readout ${pv < 0.05 ? "ok" : "bad"}"><div class="k">p-value</div><div class="v">${pv < 1e-4 ? "<0.0001" : pv.toFixed(3)}</div><div class="s">${pv < 0.05 ? "significant at 5%" : "could easily be noise"}</div></div>
      <div class="readout"><div class="k">Questions needed</div><div class="v">${isFinite(need) ? need.toLocaleString() : "∞"}</div><div class="s">to detect this gap 80% of the time</div></div>`;
  }
  bindCtl("ev-n", calc, e => (+e.value).toLocaleString()); bindCtl("ev-a", calc, e => (e.value * 100).toFixed(1) + "%"); bindCtl("ev-b", calc, e => (e.value * 100).toFixed(1) + "%");
  $("#ev").addEventListener("toggle", calc); onRedraw(calc);
});
