/* Chapter 11: keep-the-cluster-alive game */
chapter("failures", () => {
  const causes = [["Faulty GPU", 148], ["GPU HBM3 memory", 72], ["Network switch or cable", 35], ["GPU SRAM", 19], ["GPU system processor", 17], ["CPU", 2], ["Software bug, host maintenance or other", 126]];
  const csum = causes.reduce((a, c) => a + c[1], 0); const SPAN = 72 * 60; // minutes
  let r, t, sinceSave, state, stateLeft, segs, useful, fails, failedTile, log, saves;
  const G = () => Math.round(10 ** num("fg-g"));
  function reset() { r = rng(2024); t = 0; sinceSave = 0; state = "work"; stateLeft = 0; segs = []; useful = 0; fails = 0; failedTile = null; log = []; saves = 0; nextFail = draw_exp(); draw(); $("#fg-run").textContent = "Start"; }
  let nextFail = 0;
  function rate() { return 0.47 / 1000 / (24 * 60) * G(); } // failures per minute
  function draw_exp() { return -Math.log(Math.max(1e-12, r())) / rate(); }
  function pushSeg(kind, d) { const last = segs[segs.length - 1]; if (last && last[0] === kind && Math.abs(last[1] + last[2] - t) < 1e-6) last[2] += d; else segs.push([kind, t, d]); }
  function advance(dm) {
    while (dm > 0 && t < SPAN) {
      if (state === "work") { const step = Math.min(dm, nextFail, num("fg-t") - sinceSave, SPAN - t);
        pushSeg("work", step); t += step; dm -= step; nextFail -= step; sinceSave += step; useful += step;
        if (nextFail <= 1e-9) { fails++; const lost = sinceSave; useful -= lost; segs.push(["lost", t - lost, lost]); let u = r() * csum, c = 0; while (u > causes[c][1]) { u -= causes[c][1]; c++; }
          failedTile = Math.floor(r() * 256); log.unshift(`${fmtT(t)}  ${causes[c][0]} failed on one of ${G().toLocaleString()} GPUs. Lost ${Math.round(lost)} min of work.`);
          state = "restart"; stateLeft = num("fg-r"); sinceSave = 0; nextFail = draw_exp(); }
        else if (sinceSave >= num("fg-t") - 1e-9) { state = "save"; stateLeft = num("fg-d"); } }
      else { const step = Math.min(dm, stateLeft, SPAN - t); pushSeg(state, step); t += step; dm -= step; stateLeft -= step;
        if (state === "save") { nextFail -= step; if (nextFail <= 1e-9) { fails++; const lost = sinceSave; useful -= lost; segs.push(["lost", t - lost - (num("fg-d") - stateLeft), lost]); failedTile = Math.floor(r() * 256); log.unshift(`${fmtT(t)}  Failure during a save. Lost ${Math.round(lost)} min.`); state = "restart"; stateLeft = num("fg-r"); sinceSave = 0; nextFail = draw_exp(); continue; } }
        if (stateLeft <= 1e-9) { if (state === "save") { sinceSave = 0; saves++; } else { failedTile = null; log.unshift(`${fmtT(t)}  Job restarted from the last checkpoint.`); } state = "work"; } }
    }
  }
  const fmtT = m => `day ${Math.floor(m / 1440)} ${String(Math.floor(m % 1440 / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
  function draw() {
    const cg = $("#fg-grid"); const w0 = innerW(cg.parentElement); const cols = 32, rows = 8; const cs = Math.min(18, Math.floor(w0 / cols)); const { ctx } = setupCanvas(cg, rows * cs + 4);
    ctx.clearRect(0, 0, w0, rows * cs + 4); const st = state;
    for (let i = 0; i < 256; i++) { const x = (i % cols) * cs, y = Math.floor(i / cols) * cs; ctx.fillStyle = i === failedTile ? css("--crit") : st === "restart" ? css("--muted") : st === "save" ? css("--l3") : css("--ok"); ctx.globalAlpha = i === failedTile ? 1 : st === "work" ? 0.75 : 0.45; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2); }
    ctx.globalAlpha = 1;
    const ct = $("#fg-tl"); const { ctx: c2, w } = setupCanvas(ct, 54); c2.clearRect(0, 0, w, 54); const sc = w / SPAN;
    const col = { work: css("--accent"), save: css("--l3"), restart: css("--heat"), lost: css("--crit") };
    c2.fillStyle = css("--grid"); c2.fillRect(0, 6, w, 20);
    segs.forEach(([k, a, d]) => { if (k === "lost") return; c2.fillStyle = col[k]; c2.fillRect(a * sc, 6, Math.max(1, d * sc), 20); });
    segs.forEach(([k, a, d]) => { if (k !== "lost") return; c2.fillStyle = col.lost; c2.fillRect(a * sc, 6, Math.max(1, d * sc), 20); });
    font(c2, 10, "--f-mono"); c2.fillStyle = css("--muted"); for (let d = 0; d <= 3; d++) { c2.textAlign = d === 0 ? "left" : d === 3 ? "right" : "center"; c2.fillText("day " + d, d * 1440 * sc, 42); }
    c2.textAlign = "left"; font(c2, 10); c2.fillText("blue work · purple saving · red lost · amber restarting", 0, 53);
    const M = 1 / rate(), opt = Math.sqrt(2 * num("fg-d") * M), gp = t ? Math.max(0, useful) / t : 0;
    $("#fg-read").innerHTML = `<div class="readout ${gp >= 0.9 ? "ok" : gp && gp < 0.75 ? "bad" : "hot"}"><div class="k">Useful work so far</div><div class="v">${t ? Math.round(gp * 100) + "%" : "—"}</div><div class="s">${fmtT(t)}</div></div>
      <div class="readout"><div class="k">Failures</div><div class="v">${fails}</div><div class="s">expect one every ${dur(M / 60)}</div></div>
      <div class="readout"><div class="k">Suggested save interval</div><div class="v">${Math.round(opt)} min</div><div class="s">√(2 × save time × MTBF)</div></div>`;
    $("#fg-log").innerHTML = log.slice(0, 30).map(esc).join("<br>") || "Event log: failures and restarts will appear here.";
  }
  const loop = animLoop(dt => { advance(dt * 200); draw(); if (t >= SPAN) { $("#fg-run").textContent = "Run again"; return false; } });
  $("#fg-run").addEventListener("click", () => { if (loop.running) { loop.stop(); $("#fg-run").textContent = "Resume"; return; } if (t >= SPAN) reset(); if (reduceMotion()) { advance(SPAN); draw(); return; } loop.start(); $("#fg-run").textContent = "Pause"; });
  $("#fg-save").addEventListener("click", () => { if (state === "work") { state = "save"; stateLeft = num("fg-d"); log.unshift(`${fmtT(t)}  Manual save started.`); draw(); } });
  $("#fg-reset").addEventListener("click", reset);
  bindCtl("fg-t", draw, e => e.value + " min"); bindCtl("fg-d", draw, e => (+e.value).toFixed(1) + " min"); bindCtl("fg-r", draw, e => e.value + " min");
  bindCtl("fg-g", () => { nextFail = draw_exp(); draw(); }, e => Math.round(10 ** +e.value).toLocaleString());
  reset(); onRedraw(draw);
});
