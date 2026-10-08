/* Chapter 3: trigram language model, sampling wheel, "be the model" game */
const TinyLM = (() => {
  const text = `the model reads the prompt and predicts the next word .
the model predicts the next token one step at a time .
the model learns from many examples of text .
the model is trained on thousands of gpus .
the model answers the question with a short summary .
the model writes a clear answer for the user .
the cat sat on the warm server rack .
the cat sleeps next to the warm gpu .
the cat likes the quiet datacenter at night .
the cat chased the cable under the rack .
the datacenter needs a lot of power and cooling .
the datacenter has thousands of racks of gpus .
the datacenter uses liquid cooling to remove heat .
the datacenter is built next to a power line .
the gpu reads the weights from memory .
the gpu multiplies large matrices very quickly .
the gpu waits for data from memory .
the gpu is busy with many requests at once .
a good answer is short and clear .
a good answer explains the reason step by step .
a good answer cites a source the user can check .
a good model gives a good answer to the user .
the user sends a prompt to the model .
the user reads the answer on the screen .
the user asks a question about the weather .
the weather is cold and the sky is grey .
the sky is blue because air scatters blue light .
the server sends the next token to the user .
the server streams the answer one token at a time .
the server waits for a free gpu .
the network connects every gpu in the cluster .
the cluster trains the model for many weeks .
the cluster loses a gpu every few hours .
training repeats the same step trillions of times .
training makes the model better at the next word .
each step makes the model a little less surprised .
the loss goes down as the model learns .
the answer is clear and the user is happy .
the rack is hot so the fans spin faster .
the cooling system keeps the gpu from getting too hot .
the cat is happy and the user is happy .
a short prompt gets a quick answer .
a long prompt takes longer to read .
the next word depends on the words before it .
the model can make a mistake when it guesses .
the model checks the answer before it writes .
the power line brings power to the datacenter .
memory holds the weights and the cache .
the cache remembers the earlier tokens .`;
  const sents = text.trim().split("\n").map(s => s.trim().split(/\s+/));
  const tri = new Map(), bi = new Map(), uni = new Map(); let total = 0;
  const add = (m, k, w) => { let e = m.get(k); if (!e) m.set(k, e = new Map()); e.set(w, (e.get(w) || 0) + 1); };
  sents.forEach(s => { const t = ["<s>", "<s>", ...s]; for (let i = 2; i < t.length; i++) { add(tri, t[i - 2] + " " + t[i - 1], t[i]); add(bi, t[i - 1], t[i]); uni.set(t[i], (uni.get(t[i]) || 0) + 1); total++; } });
  const vocab = Array.from(uni.keys());
  function dist(ctx) {
    const a = ctx[ctx.length - 2] || "<s>", b = ctx[ctx.length - 1] || "<s>";
    const T = tri.get(a + " " + b), B = bi.get(b);
    const out = new Map(); const lt = T ? 0.75 : 0, lb = B ? (T ? 0.2 : 0.9) : 0, lu = 1 - lt - lb;
    const norm = m => { let s = 0; m.forEach(v => s += v); return s; };
    const nT = T ? norm(T) : 1, nB = B ? norm(B) : 1;
    vocab.forEach(w => { const p = lt * ((T && T.get(w)) || 0) / nT + lb * ((B && B.get(w)) || 0) / nB + lu * uni.get(w) / total; out.set(w, p); });
    return Array.from(out.entries()).sort((x, y) => y[1] - x[1]);
  }
  return { dist, sents };
})();

chapter("predict", () => {
  let words = [], spinning = false, angle = 0, lastPick = null;
  function shaped() {
    const T = num("lm-t"), k = num("lm-k"), p = num("lm-p");
    const raw = TinyLM.dist(words).slice(0, 20);
    let probs;
    if (T === 0) probs = raw.map((_, i) => i === 0 ? 1 : 0);
    else { const lg = raw.map(([, q]) => Math.log(q) / T), mx = Math.max(...lg), e = lg.map(x => Math.exp(x - mx)), Z = e.reduce((a, b) => a + b); probs = e.map(x => x / Z); }
    const order = probs.map((q, i) => [q, i]).sort((a, b) => b[0] - a[0]); const keep = new Set(); let c = 0;
    for (let j = 0; j < order.length && j < k; j++) { keep.add(order[j][1]); c += order[j][0]; if (c >= p) break; }
    const kept = probs.map((q, i) => keep.has(i) ? q : 0); const Z = kept.reduce((a, b) => a + b);
    return raw.map(([w], i) => ({ w, p: kept[i] / Z, raw: raw[i][1] }));
  }
  const pal = () => [css("--accent"), css("--heat"), css("--ok"), css("--l3"), css("--muted")];
  function draw() {
    const d = shaped().filter(x => x.p > 0);
    // text
    $("#lm-text").innerHTML = words.map((w, i) => i === words.length - 1 && lastPick ? `<b style="color:var(--heat)">${esc(w)}</b>` : esc(w)).join(" ") + ' <span class="muted">▍</span>';
    // wheel
    const wc = $("#lm-wheel"); const size = Math.min(wc.parentElement.clientWidth >= 460 ? (wc.parentElement.clientWidth - 16) / 2 : wc.parentElement.clientWidth, 280);
    wc.style.width = size + "px"; const { ctx } = setupCanvas(wc, size); ctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2 + 6, R = size / 2 - 16; let a0 = angle; const P = pal();
    d.forEach((x, i) => { const a1 = a0 + x.p * Math.PI * 2; ctx.fillStyle = P[i % P.length]; ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, x.p * 3 + 0.2); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = css("--surface-2"); ctx.lineWidth = 2; ctx.stroke();
      if (x.p > 0.06) { const am = (a0 + a1) / 2; font(ctx, 11, "--f-mono", "600"); ctx.fillStyle = css("--ink"); ctx.textAlign = "center"; ctx.fillText(x.w, cx + Math.cos(am) * R * 0.66, cy + Math.sin(am) * R * 0.66 + 4); }
      a0 = a1; });
    ctx.fillStyle = css("--ink"); ctx.beginPath(); ctx.moveTo(cx, cy - R + 14); ctx.lineTo(cx - 9, cy - R - 10); ctx.lineTo(cx + 9, cy - R - 10); ctx.fill();
    // bars
    const bc = $("#lm-bars"); const all = shaped().slice(0, 10); const H = all.length * 22 + 8;
    const g = setupCanvas(bc, H); const c2 = g.ctx; c2.clearRect(0, 0, g.w, H); const lw = 96, maxp = Math.max(...all.map(x => Math.max(x.p, x.raw)));
    all.forEach((x, i) => { const y = i * 22 + 4; font(c2, 12, "--f-mono"); c2.fillStyle = x.p > 0 ? css("--ink") : css("--muted"); c2.textAlign = "right"; c2.fillText(x.w, lw - 8, y + 12);
      c2.fillStyle = css("--grid"); c2.fillRect(lw, y + 2, (g.w - lw - 46) * x.raw / maxp, 4);
      c2.fillStyle = x.p > 0 ? css("--accent") : css("--grid"); c2.fillRect(lw, y + 7, Math.max(1, (g.w - lw - 46) * x.p / maxp), 9);
      c2.fillStyle = css("--muted"); c2.textAlign = "left"; c2.fillText(x.p > 0 ? (x.p * 100).toFixed(0) + "%" : "cut", lw + (g.w - lw - 46) * Math.max(x.p, x.raw) / maxp + 6, y + 15); });
    bc.setAttribute("aria-label", "Next-word probabilities: " + all.filter(x => x.p > 0).map(x => `${x.w} ${(x.p * 100).toFixed(0)}%`).join(", "));
  }
  function pickIdx(d, u) { let i = 0; while (i < d.length - 1 && u > d[i].p) { u -= d[i].p; i++; } return i; }
  function commit(w) { lastPick = w; if (w === ".") { words.push("."); words = words.length > 40 ? words.slice(-20) : words; } else words.push(w); draw(); }
  function spin() {
    if (spinning) return; const d = shaped().filter(x => x.p > 0); const u = Math.random(); const i = pickIdx(d, u);
    if (reduceMotion()) { commit(d[i].w); return; }
    // rotate so that the chosen slice's middle ends under the pointer (-PI/2)
    let before = 0; for (let j = 0; j < i; j++) before += d[j].p; const mid = (before + d[i].p * Math.random() * 0.8 + d[i].p * 0.1) * Math.PI * 2;
    const target = -Math.PI / 2 - mid; const start = angle; let end = target; while (end > start - Math.PI * 6) end -= Math.PI * 2;
    spinning = true; const t0 = performance.now(), D = 1100;
    const f = now => { const k = Math.min(1, (now - t0) / D), e = 1 - (1 - k) ** 3; angle = start + (end - start) * e; draw(); if (k < 1 && Chapters.current === "predict") requestAnimationFrame(f); else { spinning = false; angle = end % (Math.PI * 2); commit(d[i].w); } };
    requestAnimationFrame(f);
  }
  const reset = () => { words = $("#lm-start").value.split(" "); lastPick = null; draw(); };
  $("#lm-spin").addEventListener("click", spin);
  $("#lm-greedy").addEventListener("click", () => commit(shaped().find(x => x.p > 0).w));
  $("#lm-auto").addEventListener("click", () => { for (let n = 0; n < 12; n++) { const d = shaped().filter(x => x.p > 0); commit(d[pickIdx(d, Math.random())].w); } });
  $("#lm-undo").addEventListener("click", () => { if (words.length > 1) words.pop(); lastPick = null; draw(); });
  $("#lm-reset").addEventListener("click", reset); $("#lm-start").addEventListener("change", reset);
  bindCtl("lm-t", draw, e => +e.value === 0 ? "0 · greedy" : (+e.value).toFixed(2)); bindCtl("lm-k", draw); bindCtl("lm-p", draw, e => (+e.value).toFixed(2));
  reset(); onRedraw(draw);

  /* ---- be the model ---- */
  const r = rng(99); let qn = 0, right = 0, modelRight = 0, userLoss = 0, modelLoss = 0, cur = null;
  function newQ() {
    let s, pos; do { s = TinyLM.sents[Math.floor(r() * TinyLM.sents.length)]; pos = 2 + Math.floor(r() * (s.length - 3)); } while (s[pos] === ".");
    const ctx = s.slice(0, pos), truth = s[pos]; const d = TinyLM.dist(ctx);
    const opts = new Set([truth]); d.slice(0, 6).forEach(([w]) => { if (opts.size < 4 && w !== "." && w !== truth) opts.add(w); });
    const list = Array.from(opts).sort(() => r() - 0.5);
    cur = { ctx, truth, d, list };
    $("#bt-q").innerHTML = esc(ctx.join(" ")) + ' <span style="border-bottom:2px solid var(--heat);padding:0 2.5em"> </span>';
    $("#bt-opts").innerHTML = list.map(w => `<button class="btn ghost" type="button" data-w="${esc(w)}">${esc(w)}</button>`).join("");
    $$("#bt-opts button").forEach(b => b.addEventListener("click", () => answer(b.dataset.w)));
    $("#bt-res").textContent = "";
  }
  function answer(w) {
    if (!cur) return; const { truth, d } = cur; const pt = (d.find(x => x[0] === truth) || [0, 1e-6])[1]; const top = d[0][0];
    qn++; if (w === truth) right++; if (top === truth) modelRight++; modelLoss += -Math.log(pt);
    $$("#bt-opts button").forEach(b => { b.disabled = true; if (b.dataset.w === truth) { b.className = "btn"; } });
    const shown = d.slice(0, 4).map(([x, p]) => `${esc(x)} ${(p * 100).toFixed(0)}%`).join(" · ");
    $("#bt-res").innerHTML = `${w === truth ? "<b>Correct.</b>" : `<b>It was "${esc(truth)}".</b>`} The model's top guesses: ${shown}. It gave "${esc(truth)}" ${(pt * 100).toFixed(1)}%, so its surprise was −ln(${pt.toFixed(3)}) = <b>${(-Math.log(pt)).toFixed(2)}</b>. <button class="btn ghost" type="button" id="bt-next">Next word →</button>`;
    $("#bt-next").addEventListener("click", newQ); cur = null; score();
  }
  function score() {
    $("#bt-score").innerHTML = `<div class="readout"><div class="k">Your accuracy</div><div class="v">${qn ? Math.round(right / qn * 100) : 0}%</div><div class="s">${right} of ${qn}</div></div>
      <div class="readout"><div class="k">Model's top-1 accuracy</div><div class="v">${qn ? Math.round(modelRight / qn * 100) : 0}%</div></div>
      <div class="readout hot"><div class="k">Model's average loss</div><div class="v">${qn ? (modelLoss / qn).toFixed(2) : "—"}</div><div class="s">average surprise, the number training lowers</div></div>`;
  }
  newQ(); score();
});
