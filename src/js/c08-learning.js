/* Chapter 8: loss landscape + tiny neural network trained with backprop/Adam */
chapter("learning", () => {
  /* ---- landscape ---- */
  const f = (x, y) => 0.6 * ((x - 0.9) ** 2 + 0.6 * (y - 0.5) ** 2) * ((x + 1.0) ** 2 + 0.8 * (y + 0.7) ** 2) + 0.35 * (x + 1.0) ** 2 * 0.1 + 0.18 + 0.1 * Math.sin(3 * x) * Math.cos(2 * y);
  const grad = (x, y) => { const h = 1e-4; return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)]; };
  const R = 2.2; let ball = [1.9, -1.6], vel = [0, 0], path = [ball.slice()], steps = 0, img = null, imgW = 0, diverged = false;
  const cv = $("#gd-cv");
  function render() {
    const size = Math.min(innerW(cv.parentElement), 420); cv.style.width = size + "px"; const { ctx } = setupCanvas(cv, size);
    if (!img || imgW !== size || img._theme !== css("--bg")) {
      const dpr = window.devicePixelRatio || 1, n = Math.round(size * dpr), id = ctx.createImageData(n, n); let mn = Infinity, mx = -Infinity; const vals = new Float32Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = Math.log(f(-R + 2 * R * i / n, R - 2 * R * j / n)); vals[j * n + i] = v; mn = Math.min(mn, v); mx = Math.max(mx, v); }
      const dark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
      for (let k = 0; k < n * n; k++) { const t = (vals[k] - mn) / (mx - mn); const band = Math.abs(((t * 14) % 1) - 0.5) < 0.04 ? 0.85 : 1;
        const a = dark ? [20 + 210 * t, 40 + 150 * t, 70 + 100 * t] : [20 + 225 * t, 60 + 180 * t, 110 + 140 * t];
        id.data[k * 4] = a[0] * band; id.data[k * 4 + 1] = a[1] * band; id.data[k * 4 + 2] = a[2] * band; id.data[k * 4 + 3] = 255; }
      const off = document.createElement("canvas"); off.width = off.height = n; off.getContext("2d").putImageData(id, 0, 0); img = off; img._theme = css("--bg"); imgW = size;
    }
    ctx.drawImage(img, 0, 0, size, size);
    const P = ([x, y]) => [(x + R) / (2 * R) * size, (R - y) / (2 * R) * size];
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.beginPath(); path.forEach((p, i) => { const [a, b] = P(p); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke();
    const [bx, by] = P(ball); ctx.fillStyle = "#f0a43a"; ctx.strokeStyle = "#13212e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.fill(); ctx.stroke();
    cv._size = size;
    const loss = f(ball[0], ball[1]);
    $("#gd-read").innerHTML = `<div class="readout"><div class="k">Steps</div><div class="v">${steps}</div></div><div class="readout ${diverged ? "bad" : loss < 0.25 ? "ok" : ""}"><div class="k">Loss</div><div class="v">${diverged ? "flew off" : loss.toFixed(3)}</div></div>`;
  }
  function step() {
    if (diverged) return; const lr = 10 ** num("gd-lr"), g = grad(ball[0], ball[1]), mom = checked("gd-mom") ? 0.85 : 0;
    vel = [mom * vel[0] - lr * g[0], mom * vel[1] - lr * g[1]]; ball = [ball[0] + vel[0], ball[1] + vel[1]]; steps++;
    if (!isFinite(ball[0]) || Math.abs(ball[0]) > R * 1.5 || Math.abs(ball[1]) > R * 1.5) { diverged = true; ball = [Math.max(-R, Math.min(R, ball[0] || 0)), Math.max(-R, Math.min(R, ball[1] || 0))]; }
    path.push(ball.slice()); if (path.length > 400) path.shift();
  }
  const loop = animLoop(dt => { acc += dt; while (acc > 0.03) { acc -= 0.03; step(); } render(); if (steps > 600 || diverged) { $("#gd-run").textContent = "Run"; return false; } }); let acc = 0;
  $("#gd-run").addEventListener("click", () => { if (loop.running) { loop.stop(); $("#gd-run").textContent = "Run"; } else { loop.start(); $("#gd-run").textContent = "Pause"; } });
  $("#gd-step").addEventListener("click", () => { step(); render(); });
  cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); const s = cv._size; ball = [-R + 2 * R * (e.clientX - r.left) / s, R - 2 * R * (e.clientY - r.top) / s]; vel = [0, 0]; path = [ball.slice()]; steps = 0; diverged = false; render(); });
  // keyboard: arrows move the drop point, Enter runs
  cv.tabIndex = 0;
  const gdLabel = () => cv.setAttribute("aria-label", `Loss landscape. Ball at x ${ball[0].toFixed(2)}, y ${ball[1].toFixed(2)}, loss ${f(ball[0], ball[1]).toFixed(3)}. Arrow keys move the starting point; Enter runs or pauses.`);
  cv.addEventListener("keydown", e => { const d = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key];
    if (d) { e.preventDefault(); if (loop.running) { loop.stop(); $("#gd-run").textContent = "Run"; } ball = [Math.max(-R, Math.min(R, ball[0] + d[0])), Math.max(-R, Math.min(R, ball[1] + d[1]))]; vel = [0, 0]; path = [ball.slice()]; steps = 0; diverged = false; render(); gdLabel(); }
    else if (e.key === "Enter") { e.preventDefault(); $("#gd-run").click(); } });
  cv.addEventListener("blur", gdLabel); gdLabel();
  bindCtl("gd-lr", () => {}, e => (10 ** +e.value).toFixed(3));
  onRedraw(() => { img = null; render(); });

  /* ---- tiny network ---- */
  const targets = { wave: x => Math.sin(3 * x) * 0.8, step: x => (x > 0.1 ? 0.7 : -0.6), bump: x => Math.exp(-((x - 0.6) ** 2) * 12) - 0.8 * Math.exp(-((x + 0.6) ** 2) * 10) };
  let net, data, it, losses, adam;
  function init() {
    const H = num("nn-h"), r = rng(Math.floor(Math.random() * 1e9) + 1), tf = targets[$("#nn-f").value], dr = rng(7);
    data = Array.from({ length: 40 }, (_, i) => { const x = -1 + 2 * i / 39; return [x, tf(x) + 0.06 * gauss(dr)]; });
    net = { W1: Array.from({ length: H }, () => gauss(r) * 1.5), b1: Array.from({ length: H }, () => gauss(r) * 0.5), W2: Array.from({ length: H }, () => gauss(r) / Math.sqrt(H)), b2: 0 };
    const z = () => ({ W1: new Array(H).fill(0), b1: new Array(H).fill(0), W2: new Array(H).fill(0), b2: 0 });
    adam = { m: z(), v: z(), t: 0 }; it = 0; losses = [];
  }
  const fwd = x => { let y = net.b2; const h = net.W1.map((w, j) => Math.tanh(w * x + net.b1[j])); h.forEach((v, j) => y += net.W2[j] * v); return { y, h }; };
  function trainStep() {
    const H = net.W1.length, g = { W1: new Array(H).fill(0), b1: new Array(H).fill(0), W2: new Array(H).fill(0), b2: 0 }; let L = 0;
    data.forEach(([x, t]) => { const { y, h } = fwd(x); const e = y - t; L += e * e; const dy = 2 * e / data.length;
      g.b2 += dy; for (let j = 0; j < H; j++) { g.W2[j] += dy * h[j]; const dh = dy * net.W2[j] * (1 - h[j] * h[j]); g.W1[j] += dh * x; g.b1[j] += dh; } });
    const lr = 10 ** num("nn-lr"), b1 = 0.9, b2 = 0.999; adam.t++;
    const upd = (k, j) => { const gr = j === undefined ? g[k] : g[k][j]; let m = j === undefined ? adam.m[k] : adam.m[k][j], v = j === undefined ? adam.v[k] : adam.v[k][j];
      m = b1 * m + (1 - b1) * gr; v = b2 * v + (1 - b2) * gr * gr; const d = lr * (m / (1 - b1 ** adam.t)) / (Math.sqrt(v / (1 - b2 ** adam.t)) + 1e-8);
      if (j === undefined) { adam.m[k] = m; adam.v[k] = v; net[k] -= d; } else { adam.m[k][j] = m; adam.v[k][j] = v; net[k][j] -= d; } };
    ["W1", "b1", "W2"].forEach(k => { for (let j = 0; j < H; j++) upd(k, j); }); upd("b2");
    it++; losses.push([it, L / data.length]); if (losses.length > 2000) losses.shift();
  }
  function ndraw() {
    const c1 = $("#nn-cv"); const { ctx, w } = setupCanvas(c1, 220); ctx.clearRect(0, 0, w, 220); const X = x => 10 + (x + 1) / 2 * (w - 20), Y = y => 110 - y * 85;
    ctx.strokeStyle = css("--grid"); ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(w, 110); ctx.stroke();
    data.forEach(([x, y]) => { ctx.fillStyle = css("--muted"); ctx.beginPath(); ctx.arc(X(x), Y(y), 3.5, 0, 7); ctx.fill(); });
    ctx.strokeStyle = css("--heat"); ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 200; i++) { const x = -1 + 2 * i / 200, y = Math.max(-1.25, Math.min(1.25, fwd(x).y)); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); } ctx.stroke(); ctx.lineWidth = 1;
    font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.fillText("dots: training data · orange: the network's prediction", 10, 214);
    const last = losses.length ? losses[losses.length - 1][1] : NaN;
    if (losses.length > 1) { const vals = losses.map(p => p[1]), mn = 1e-4; const mx = Math.max(...vals) * 1.2, lo = Math.max(mn, Math.min(...vals) * 0.8);
      plot($("#nn-loss"), { height: 150, margin: { b: 30, l: 60 }, x: { min: losses[0][0], max: Math.max(losses[0][0] + 100, it), label: "training step", fmt: v => v.toFixed(0) }, y: { min: lo, max: Math.max(mx, lo * 2), log: true, label: "loss (log)", fmt: v => v >= 0.01 ? (+v.toPrecision(2)).toString() : v.toExponential(0) }, series: [{ data: losses.map(([i, v]) => [i, Math.max(v, mn)]), color: css("--accent") }] }); }
    else { const g = setupCanvas($("#nn-loss"), 140); g.ctx.clearRect(0, 0, g.w, 140); font(g.ctx, 12); g.ctx.fillStyle = css("--muted"); g.ctx.fillText("The loss curve appears when you press Train.", 10, 70); }
    $("#nn-read").innerHTML = `<div class="readout"><div class="k">Steps</div><div class="v">${it}</div></div><div class="readout ${last < 0.01 ? "ok" : !isFinite(last) || last > 1 ? "bad" : ""}"><div class="k">Loss</div><div class="v">${isFinite(last) ? last.toFixed(4) : "—"}</div></div>
      <div class="readout"><div class="k">Parameters</div><div class="v">${net.W1.length * 3 + 1}</div></div>`;
  }
  const nl = animLoop(() => { for (let k = 0; k < 8; k++) trainStep(); ndraw(); if (it > 6000) { $("#nn-run").textContent = "Train"; return false; } });
  $("#nn-run").addEventListener("click", () => { if (nl.running) { nl.stop(); $("#nn-run").textContent = "Train"; } else { if (it > 6000) init(); nl.start(); $("#nn-run").textContent = "Pause"; } });
  $("#nn-reset").addEventListener("click", () => { init(); ndraw(); });
  bindCtl("nn-lr", () => {}, e => (10 ** +e.value).toFixed(4)); bindCtl("nn-h", () => { init(); ndraw(); }); $("#nn-f").addEventListener("change", () => { init(); ndraw(); });
  init(); onRedraw(ndraw);
});
