/* Chapter 5: GPU memory map (reserve vs paged, prefix sharing) + KV calculator */
chapter("memory", () => {
  const COLS = 40, ROWS = 12, N = COLS * ROWS, CELL_TOK = 1270, WEIGHT_CELLS = 96, PREFIX_TOK = 2000;
  let cells, reqs, queue, tick, r, served, tokensOut, nextId;
  const getMode = seg($("#kv-mode"), () => reset());
  function reset(warm = true) { if (typeof loop !== "undefined" && loop.running) { loop.stop(); } $("#kv-run").textContent = "Run"; cells = new Array(N).fill(null); for (let i = 0; i < WEIGHT_CELLS; i++) cells[i] = "W"; reqs = []; queue = []; tick = 0; r = rng(17); served = 0; tokensOut = 0; nextId = 1; prefixCells = null; if (warm) for (let k = 0; k < 30; k++) step(); draw(); }
  let prefixCells = null;
  const cellsFor = t => Math.ceil(t / CELL_TOK);
  function newReq() { const target = Math.min(num("kv-max"), Math.round(Math.exp(Math.log(3500) + 0.9 * gauss(r)))) ; return { id: nextId++, len: 0, target: Math.max(600, target), cells: [], hue: (180 + (nextId * 67) % 230) % 360 }; }
  function admit(q) {
    const prefix = checked("kv-prefix"), mode = getMode();
    if (prefix && !prefixCells) { const free = []; for (let i = 0; i < N && free.length < cellsFor(PREFIX_TOK); i++) if (!cells[i]) free.push(i); if (free.length < cellsFor(PREFIX_TOK)) return false; free.forEach(i => cells[i] = "P"); prefixCells = free; }
    const own = prefix ? 0 : PREFIX_TOK; // tokens of prefix stored privately
    q.own = own;
    if (mode === "reserve") {
      const need = cellsFor(num("kv-max") - (prefix ? PREFIX_TOK : 0)); let run = 0, start = -1;
      for (let i = 0; i < N; i++) { if (!cells[i]) { run++; if (run === need) { start = i - need + 1; break; } } else run = 0; }
      if (start < 0) return false; for (let i = start; i < start + need; i++) cells[i] = q.id; q.cells = Array.from({ length: need }, (_, k) => start + k); return true;
    } else {
      q.cells = []; return grow(q, own + 400);
    }
  }
  function grow(q, toks) { const need = cellsFor(toks) - q.cells.length; for (let k = 0; k < need; k++) { const i = cells.indexOf(null); if (i < 0) return false; cells[i] = q.id; q.cells.push(i); } return true; }
  function step() {
    tick++; const prefix = checked("kv-prefix");
    queue.push(newReq()); queue.push(newReq());
    if (r() < 0.6) queue.push(newReq());
    if (r() < 0.6) queue.push(newReq());
    // admit in order
    while (queue.length) { const q = queue[0]; if (q.len === 0) q.len = 400; if (admit(q)) { reqs.push(queue.shift()); } else { if (getMode() === "paged") { q.cells.forEach(i => cells[i] = null); q.cells = []; } break; } }
    // decode
    const stalled = [];
    reqs.forEach(q => { q.len += 260; tokensOut += 260; if (getMode() === "paged") { if (!grow(q, q.own + q.len)) stalled.push(q); } });
    // preempt (paged): if memory full, evict newest request back to queue
    if (stalled.length) { const victim = reqs[reqs.length - 1]; victim.cells.forEach(i => cells[i] = null); victim.cells = []; victim.len = 0; reqs.pop(); queue.unshift(victim); }
    // finish
    reqs = reqs.filter(q => { if (q.len >= q.target - (prefix ? PREFIX_TOK : 0)) { q.cells.forEach(i => cells[i] = null); served++; return false; } return true; });
    if (queue.length > 40) queue.length = 40;
    draw();
  }
  function draw() {
    const cv = $("#kv-cv"); const w0 = innerW(cv.parentElement); const cs = Math.max(6, Math.min(20, Math.floor((w0 - 4) / COLS))); const H = ROWS * cs + 2;
    const { ctx, w } = setupCanvas(cv, H); ctx.clearRect(0, 0, w, H); const ox = Math.max(0, (w - COLS * cs) / 2);
    const dark = getComputedStyle(document.documentElement).colorScheme.includes("dark"); const byId = new Map(reqs.map(q => [q.id, q]));
    let used = 0, reservedEmpty = 0, prefixUsed = 0;
    const prefix = checked("kv-prefix");
    for (let i = 0; i < N; i++) {
      const x = ox + (i % COLS) * cs, y = Math.floor(i / COLS) * cs, c = cells[i];
      let fill = css("--grid"), alpha = 1;
      if (c === "W") fill = css("--muted");
      else if (c === "P") { fill = css("--ok"); prefixUsed++; }
      else if (c) { const q = byId.get(c); if (q) { const k = q.cells.indexOf(i); const filledCells = cellsFor((prefix ? 0 : PREFIX_TOK) + q.len); const real = k < filledCells;
        fill = `hsl(${q.hue} 60% ${dark ? 55 : 48}%)`; alpha = real ? 0.95 : 0.22; if (real) used++; else reservedEmpty++; } }
      ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2); ctx.globalAlpha = 1;
    }
    const kvTotal = N - WEIGHT_CELLS; const waste = reservedEmpty / Math.max(1, used + reservedEmpty + prefixUsed);
    $("#kv-read").innerHTML = `
      <div class="readout ok"><div class="k">Conversations running</div><div class="v">${reqs.length}</div><div class="s">${queue.length} waiting in queue</div></div>
      <div class="readout ${waste > 0.4 ? "bad" : waste > 0.1 ? "hot" : "ok"}"><div class="k">KV memory wasted</div><div class="v">${Math.round(waste * 100)}%</div><div class="s">reserved but holding no tokens</div></div>
      <div class="readout"><div class="k">Memory in use</div><div class="v">${Math.round((used + reservedEmpty + prefixUsed) / kvTotal * 100)}%</div><div class="s">of the ${bytes(kvTotal * 80e9 / N)} left after weights</div></div>
      <div class="readout"><div class="k">Finished</div><div class="v">${served}</div><div class="s">${fmt(tokensOut, 1)} tokens generated</div></div>`;
  }
  const loop = animLoop(dt => { acc += dt; if (acc > 0.18) { acc = 0; step(); } }); let acc = 0;
  $("#kv-run").addEventListener("click", () => { if (loop.running) { loop.stop(); $("#kv-run").textContent = "Run"; } else { loop.start(); $("#kv-run").textContent = "Pause"; } });
  $("#kv-reset").addEventListener("click", reset);
  $("#kv-prefix").addEventListener("change", reset);
  bindCtl("kv-max", reset, e => (+e.value).toLocaleString() + " tokens");
  reset();
  onRedraw(draw);

  /* ---- KV calculator ---- */
  const M = { 8: { L: 32, kv: 8, hd: 128, q: 32 }, 70: { L: 80, kv: 8, hd: 128, q: 64 }, 405: { L: 126, kv: 8, hd: 128, q: 128 }, ds: { L: 61, mla: 576, q: 128, hd: 128 } };
  const prec = seg($("#kc-p"), calc);
  function calc() {
    const m = M[$("#kc-m").value], ctxLen = Math.round(2 ** num("kc-c")), B = 2 ** num("kc-b"), b = +prec();
    setCtl("kc-c", num("kc-c"), () => ctxLen.toLocaleString() + " tokens"); setCtl("kc-b", num("kc-b"), () => B);
    const per = m.mla ? m.L * m.mla * b : 2 * m.L * m.kv * m.hd * b, mha = m.mla ? m.L * m.q * (192 + 128) * b : 2 * m.L * m.q * m.hd * b;
    const tot = per * ctxLen * B;
    $("#kc-read").innerHTML = `<div class="readout"><div class="k">Per token</div><div class="v">${bytes(per)}</div></div>
      <div class="readout hot"><div class="k">One conversation</div><div class="v">${bytes(per * ctxLen)}</div></div>
      <div class="readout ${tot > 80e9 ? "bad" : ""}"><div class="k">All ${B}</div><div class="v">${bytes(tot)}</div><div class="s">${(tot / 80e9).toFixed(1)}× an 80 GB GPU</div></div>`;
    const rows = [["Multi-head (no sharing)", mha * ctxLen, css("--crit")], [m.mla ? "Latent attention (MLA)" : "Grouped-query (actual)", per * ctxLen, css("--ok")]];
    const cv = $("#kc-cv"); const { ctx, w } = setupCanvas(cv, 70); ctx.clearRect(0, 0, w, 70); const mx = rows[0][1];
    rows.forEach(([n, v, c], i) => { const y = i * 32 + 4; ctx.fillStyle = c; ctx.fillRect(170, y, Math.max(2, (w - 260) * v / mx), 20); font(ctx, 12); ctx.fillStyle = css("--ink"); ctx.textAlign = "right"; ctx.fillText(n, 162, y + 15); ctx.textAlign = "left"; font(ctx, 11, "--f-mono"); ctx.fillText(bytes(v), 176 + (w - 260) * v / mx, y + 15); });
  }
  ["kc-c", "kc-b"].forEach(id => $("#" + id).addEventListener("input", calc)); $("#kc-m").addEventListener("change", calc);
  $("#kc").addEventListener("toggle", calc); onRedraw(calc);
});
