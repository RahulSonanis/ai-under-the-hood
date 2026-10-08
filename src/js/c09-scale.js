/* Chapter 9: compute budget splitter + training cost calculator */
chapter("scale", () => {
  const E = 1.69, A = 406.4, B = 410.7, al = 0.34, be = 0.28, loss = (N, D) => E + A / N ** al + B / D ** be;
  const Nlo = 7, Nhi = 12.5;
  const Nof = u => 10 ** (Nlo + u * (Nhi - Nlo));
  function best(C) { let b = [0, 9]; for (let u = 0; u <= 1; u += 0.002) { const N = Nof(u), D = C / 6 / N; if (D < 1e8) continue; const l = loss(N, D); if (l < b[1]) b = [u, l]; } return b; }
  function draw() {
    const C = 10 ** num("bg-c"), u = num("bg-n"), N = Nof(u), D = C / 6 / N, L = loss(N, D), [bu, bl] = best(C);
    const cv = $("#bg-cv"); const { ctx, w } = setupCanvas(cv, 190); ctx.clearRect(0, 0, w, 190);
    // model box: side ∝ log scale of N; data: stack height ∝ log D
    const mN = (Math.log10(N) - 7) / 5.5, mD = Math.max(0, (Math.log10(D) - 8) / 7);
    const half = w / 2; const ms = 30 + mN * 120;
    ctx.fillStyle = css("--accent"); ctx.globalAlpha = 0.85; rr(ctx, half / 2 - ms / 2, 150 - ms, ms, ms, 8); ctx.fill(); ctx.globalAlpha = 1;
    // neuron dots inside
    ctx.fillStyle = css("--surface"); const dots = Math.round(3 + mN * 9); for (let i = 0; i < dots; i++) for (let j = 0; j < dots; j++) { const x = half / 2 - ms / 2 + (i + 0.5) * ms / dots, y = 150 - ms + (j + 0.5) * ms / dots; ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, ms / dots / 5), 0, 7); ctx.fill(); }
    const books = Math.round(2 + mD * 28); const bw2 = Math.min(90, half * 0.5);
    for (let i = 0; i < books; i++) { ctx.fillStyle = i % 3 === 0 ? css("--heat") : i % 3 === 1 ? css("--ok") : css("--l3"); ctx.globalAlpha = 0.85; ctx.fillRect(half + half / 2 - bw2 / 2 + (i % 2) * 4, 150 - (i + 1) * 4.6, bw2 - 4, 3.6); } ctx.globalAlpha = 1;
    font(ctx, 13, "--f-display", "700"); ctx.fillStyle = css("--ink"); ctx.textAlign = "center";
    ctx.fillText(fmt(N, 1) + " parameters", half / 2, 172); ctx.fillText(fmt(D, 1) + " tokens", half + half / 2, 172);
    font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.fillText("model size", half / 2, 186); ctx.fillText("training data", half + half / 2, 186);
    const pen = L - bl;
    $("#bg-read").innerHTML = `<div class="readout ${pen < 0.01 ? "ok" : pen > 0.1 ? "bad" : "hot"}"><div class="k">Predicted loss</div><div class="v">${L.toFixed(3)}</div><div class="s">${pen < 0.005 ? "at the optimum" : "+" + pen.toFixed(3) + " above the best split"}</div></div>
      <div class="readout"><div class="k">Tokens per parameter</div><div class="v">${fmt(D / N, 0)}</div></div>
      <div class="readout"><div class="k">Best split here</div><div class="v">${fmt(Nof(bu), 1)}</div><div class="s">params · ${fmt(C / 6 / Nof(bu) / Nof(bu), 0)} tokens per param</div></div>`;
    const pts = []; for (let v = 0; v <= 1; v += 0.01) { const n = Nof(v), d = C / 6 / n; if (d > 1e8) pts.push([n, loss(n, d)]); }
    const ys = pts.map(p => p[1]); const ymin = Math.min(...ys) - 0.05;
    plot($("#bg-plot"), { height: 170, margin: { b: 34 }, x: { min: 1e7, max: 10 ** 12.5, log: true, label: "model size (parameters, log)" }, y: { min: ymin, max: Math.min(Math.max(...ys), ymin + 2), label: "loss" },
      series: [{ data: pts, color: css("--accent") }, { data: [[Nof(bu), bl]], points: true, color: css("--ok"), r: 5 }, { data: [[N, L]], points: true, color: css("--heat"), r: 6 }] });
  }
  bindCtl("bg-c", draw, e => { const v = +e.value, ex = Math.floor(v + 1e-9); return (10 ** (v - ex)).toFixed(1) + "×10" + sup(ex) + " FLOPs"; });
  bindCtl("bg-n", draw, e => fmt(Nof(+e.value), 1));
  $("#bg-opt").addEventListener("click", () => { setCtl("bg-n", best(10 ** num("bg-c"))[0], e => fmt(Nof(+e.value), 1)); draw(); });
  onRedraw(draw);

  /* ---- cost calculator ---- */
  const chips = { h100: 989e12, h800: 989e12, b200: 2250e12, tpu7: 2307e12 };
  const presets = {
    smol: { n: 3.08, d: 11, chip: "h100", g: 384, mfu: 0.3, p: 2, rep: 276480, lab: "Main run incl. downtime (Hugging Face)", ref: 1 },
    ds: { n: 37, d: 14.8, chip: "h800", g: 2048, mfu: 0.38, p: 2, rep: 2664000, lab: "Pre-training stage (DeepSeek-V3 report)", ref: 10 },
    llama: { n: 405, d: 15.6, chip: "h100", g: 16384, mfu: 0.4, p: 2, rep: 30840000, lab: "Total GPU-hours (Llama 3.1 model card)", ref: 51 }
  };
  const shows = { "tc-n": e => (+e.value).toFixed(1) + "B", "tc-d": e => (+e.value).toFixed(1) + "T", "tc-mfu": e => Math.round(e.value * 100) + "%", "tc-g": e => (+e.value).toLocaleString(), "tc-p": e => "$" + (+e.value).toFixed(2) };
  let cur = "ds";
  function cost() {
    const N = num("tc-n") * 1e9, D = num("tc-d") * 1e12, P = chips[$("#tc-chip").value], mfu = num("tc-mfu"), G = num("tc-g"), pr = num("tc-p");
    const F = 6 * N * D, gh = F / (P * mfu) / 3600, p = presets[cur];
    $("#tc-read").innerHTML = `<div class="readout"><div class="k">Training FLOPs</div><div class="v">${sci(F)}</div></div>
      <div class="readout"><div class="k">GPU-hours (estimate)</div><div class="v">${fmt(gh, 2)}</div></div>
      <div class="readout"><div class="k">Wall-clock</div><div class="v">${dur(gh / G)}</div><div class="s">on ${G.toLocaleString()} chips, no failures</div></div>
      <div class="readout hot"><div class="k">Compute cost</div><div class="v">${money(gh * pr)}</div><div class="s">rental-equivalent</div></div>`;
    const cv = $("#tc-cv"); const { ctx, w } = setupCanvas(cv, p ? 92 : 46); ctx.clearRect(0, 0, w, 92);
    const rows = [["Estimate", gh, css("--accent")]]; if (p) rows.push(["Reported", p.rep, css("--heat")]);
    const mx = Math.max(...rows.map(r => r[1])); rows.forEach(([n, v, c], i) => { const y = i * 40 + 6; font(ctx, 12, "--f-display", "700"); ctx.fillStyle = css("--ink"); ctx.textAlign = "left"; ctx.fillText(n, 0, y + 17);
      ctx.fillStyle = c; ctx.fillRect(80, y + 2, Math.max(2, (w - 200) * v / mx), 22); font(ctx, 11, "--f-mono"); ctx.fillStyle = css("--ink"); ctx.fillText(fmt(v, 2) + " GPU-h", 86 + (w - 200) * v / mx, y + 17); });
    if (p) { font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.fillText(`${p.lab}. Estimate ÷ reported = ${(gh / p.rep).toFixed(2)}`, 80, 88); }
  }
  Object.keys(shows).forEach(id => bindCtl(id, () => { cur = "custom"; $("#tc-preset").value = "custom"; cost(); }, shows[id]));
  $("#tc-chip").addEventListener("change", () => { cur = "custom"; $("#tc-preset").value = "custom"; cost(); });
  $("#tc-preset").addEventListener("change", e => { cur = e.target.value; const p = presets[cur]; if (p) { setCtl("tc-n", p.n, shows["tc-n"]); setCtl("tc-d", p.d, shows["tc-d"]); setCtl("tc-g", p.g, shows["tc-g"]); setCtl("tc-mfu", p.mfu, shows["tc-mfu"]); setCtl("tc-p", p.p, shows["tc-p"]); $("#tc-chip").value = p.chip; } cost(); });
  $("#tc-preset").dispatchEvent(new Event("change")); onRedraw(cost);
});
