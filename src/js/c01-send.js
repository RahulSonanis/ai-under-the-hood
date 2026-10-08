/* Chapter 1: trace of one request + rewind timeline */
chapter("send", () => {
  const replies = {
    "Why is the sky blue?": "Sunlight contains every colour. Air molecules scatter short, blue wavelengths much more strongly than long, red ones (Rayleigh scattering), so blue light reaches your eyes from every part of the sky.",
    "Write a haiku about servers.": "Fans hum through the night / a thousand racks hold their breath / your answer, then dawn",
    "What is 17 × 24?": "17 × 24 = 408. One way: 17 × 20 = 340 and 17 × 4 = 68, and 340 + 68 = 408."
  };
  const clients = { app: "Chat app", cli: "Terminal (CLI)", api: "Your code (API call)" };
  const spans = [
    { k: "net", name: "Network to datacenter", dev: "net", ch: "send", d: "Your encrypted request travels over the internet to the provider's nearest entry point, then on to a region that runs the model." },
    { k: "gw", name: "API gateway", dev: "cpu", ch: "send", d: "Checks your API key or login, applies rate limits, and records usage for billing." },
    { k: "safe", name: "Policy checks", dev: "cpu", ch: "evals", d: "Many providers run lightweight classifiers on inputs and outputs to catch abuse. Exact checks differ by provider." },
    { k: "queue", name: "Queue", dev: "cpu", ch: "sharing", d: "If every model replica is full, your request waits for a free slot. This grows quickly as the service gets busy." },
    { k: "route", name: "Router", dev: "cpu", ch: "memory", d: "Picks a model replica, ideally one that already has the start of your conversation in its cache." },
    { k: "tok", name: "Tokenize", dev: "cpu", ch: "tokens", d: "Your text is split into tokens, the integer IDs the model works with." },
    { k: "prefill", name: "Prefill: read the whole prompt", dev: "gpu", ch: "inside", d: "All prompt tokens pass through the model together. This fills the attention cache and produces the first output token." },
    { k: "decode", name: "Decode: write one token at a time", dev: "gpu", ch: "predict", d: "Each step reads the model's weights (for mixture-of-experts models, only the experts it uses) to produce the next token, which is sampled, sent back and appended to the input." },
    { k: "stream", name: "Stream back", dev: "net", ch: "send", d: "Each token is turned back into text and sent to you as soon as it exists, over the same open connection." }
  ];
  const thinkSpan = { k: "think", name: "Thinking: hidden reasoning", dev: "gpu", ch: "align", d: "Reasoning models first generate tokens you may not see (or see only as a summary), working through the problem before writing the answer. These are decoded exactly like normal tokens, so they add time and cost before the first visible word." };
  const sysTok = { app: 400, cli: 3000, api: 0 };
  const sysNote = { app: "incl. ~400 hidden system-prompt tokens", cli: "incl. ~3,000 tokens of instructions and tool definitions", api: "only what your code sends" };
  const LONG = "Summarise this incident report for an executive audience. " + "At 09:14 UTC the payments service began returning elevated 5xx errors after a configuration change to the connection pool. Retries amplified load on the primary database, which hit its connection limit; the on-call engineer rolled back the change at 09:41 and error rates returned to normal by 09:52. ".repeat(30);
  const cv = $("#tr-cv"); let trace = null, t0 = 0, playing = false, chosen = null;
  const getClient = seg($("#tr-client"), v => { $("#tr-client-label").textContent = clients[v]; if (!playing) { trace = build(); draw(null); readouts(trace, null); } });
  const getSpeed = seg($("#tr-speed"), () => {});
  bindCtl("tr-load", () => {}, e => Math.round(e.value * 100) + "%");
  $$("#tr-presets button").forEach(b => b.addEventListener("click", () => { $("#tr-prompt").value = b.dataset.p === "__long__" ? LONG.trim() : b.dataset.p; if (!playing) { trace = build(); draw(null); readouts(trace, null); } }));
  $("#tr-think").addEventListener("change", () => { if (!playing) { trace = build(); draw(null); readouts(trace, null); } });
  const approxTokens = s => Math.max(1, Math.ceil(s.length / 4));

  function build() {
    const prompt = $("#tr-prompt").value.trim() || "Hello";
    const reply = prompt.startsWith("Summarise this incident") ? "Summary: a configuration change to the payments service's connection pool caused 38 minutes of elevated errors. Retries overloaded the database. Rolling back fixed it; follow-ups are safer config rollout and retry limits." : replies[prompt] || "(Illustrative reply.) I'd start by breaking the question into parts, then answer each one clearly, and finish with a short summary you can act on.";
    const sys = sysTok[getClient()], inTok = approxTokens(prompt) + sys, rho = num("tr-load"), think = checked("tr-think") ? 300 : 0;
    const words = reply.match(/\S+\s*/g) || [reply];
    const outTok = approxTokens(reply);
    const durs = { net: 40, gw: 12, safe: 25, queue: Math.round(60 * rho / (1 - rho)), route: 4, tok: 2, prefill: Math.round(30 + inTok * 0.08), think: think * 22, decode: outTok * 22, stream: 40 };
    const list = think ? [...spans.slice(0, 7), thinkSpan, ...spans.slice(7)] : spans;
    let t = 0; const out = list.map(s => { const sp = { ...s, start: t, dur: durs[s.k] }; if (s.k === "decode") { sp.start = t; } if (s.k === "stream") { sp.start = durs.net + durs.gw + durs.safe + durs.queue + durs.route + durs.tok + durs.prefill + durs.think; sp.dur = durs.decode + durs.stream; } else t += durs[s.k]; return sp; });
    const ttft = durs.net + durs.gw + durs.safe + durs.queue + durs.route + durs.tok + durs.prefill + durs.think + durs.stream;
    const total = out[out.length - 1].start + out[out.length - 1].dur;
    return { spans: out, words, inTok, outTok, ttft, total, prompt: prompt.length > 160 ? prompt.slice(0, 160) + "… (" + inTok.toLocaleString() + " tokens)" : prompt, reply, tpot: 22, think, client: getClient() };
  }
  function draw(now) {
    const W = innerW(cv.parentElement); const narrow = W < 560; const labW = narrow ? 0 : 230;
    const tr0 = trace || build(); const rowH = narrow ? 34 : 24; const H = tr0.spans.length * rowH + 36;
    const { ctx, w } = setupCanvas(cv, H); ctx.clearRect(0, 0, w, H);
    const tr = tr0; const T = tr.total * 1.04; const sx = v => labW + v / T * (w - labW - 6);
    font(ctx, 10, "--f-mono"); ctx.fillStyle = css("--muted"); ctx.strokeStyle = css("--grid");
    const maxTicks = Math.max(3, Math.floor((w - labW) / 70)); const stepMs = [100, 200, 250, 500, 1000, 2000, 5000].find(s => T / s <= maxTicks) || 10000;
    for (let v = 0; v <= T; v += stepMs) { const x = sx(v); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 18); ctx.stroke(); ctx.textAlign = "center"; ctx.fillText(v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + " s" : v + " ms", Math.max(14, Math.min(w - 16, x)), H - 5); }
    tr.spans.forEach((s, i) => {
      const y = i * rowH + 4; const col = s.dev === "gpu" ? css("--accent") : s.dev === "net" ? css("--muted") : css("--ink");
      font(ctx, 12, "--f-display", chosen === i ? "700" : ""); ctx.fillStyle = chosen === i ? css("--accent") : css("--ink"); ctx.textAlign = "left";
      if (narrow) ctx.fillText(s.name, 2, y + 10); else ctx.fillText(s.name, 2, y + 13);
      const by = narrow ? y + 15 : y + 3, bh = narrow ? 12 : 14;
      ctx.fillStyle = css("--grid"); ctx.fillRect(sx(s.start), by, Math.max(2, sx(s.start + s.dur) - sx(s.start)), bh);
      const prog = now == null ? s.dur : Math.max(0, Math.min(s.dur, now - s.start));
      if (prog > 0) { ctx.fillStyle = col; ctx.globalAlpha = s.dev === "cpu" ? 0.55 : 0.9; ctx.fillRect(sx(s.start), by, Math.max(2, sx(s.start + prog) - sx(s.start)), bh); ctx.globalAlpha = 1; }
      if (s.k === "decode" && prog > 0) { ctx.fillStyle = css("--surface"); const n = Math.floor(prog / tr.tpot); for (let j = 1; j <= n; j++) { const x = sx(s.start + j * tr.tpot); if (x - sx(s.start) > 3) ctx.fillRect(x, by, 1, bh); } }
    });
    if (now != null) { const x = sx(Math.min(now, tr.total)); ctx.strokeStyle = css("--heat"); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 18); ctx.stroke(); ctx.lineWidth = 1; }
    cv._hit = { rowH, n: tr.spans.length };
  }
  function readouts(tr, now) {
    const done = now == null || now >= tr.total;
    $("#tr-read").innerHTML = `
      <div class="readout"><div class="k">Prompt tokens</div><div class="v">≈${tr.inTok}</div><div class="s">${sysNote[tr.client]}</div></div>
      <div class="readout hot"><div class="k">Time to first token</div><div class="v">${(tr.ttft / 1000).toFixed(2)} s</div></div>
      <div class="readout"><div class="k">Output speed</div><div class="v">${(1000 / tr.tpot).toFixed(0)} tok/s</div><div class="s">${tr.think ? tr.think + " hidden thinking tokens first" : "visible tokens only"}</div></div>
      <div class="readout ${done ? "ok" : ""}"><div class="k">Total</div><div class="v">${done ? (tr.total / 1000).toFixed(2) + " s" : "…"}</div><div class="s">${tr.outTok} output tokens</div></div>`;
  }
  function explain(i) { const s = (trace || build()).spans[i]; $("#tr-now-t").textContent = s.name; $("#tr-now").innerHTML = `${esc(s.d)} <a href="#${s.ch}">Learn more →</a>`; }
  const loop = animLoop(() => {
    const speed = +getSpeed(); const now = (performance.now() - t0) / speed;
    draw(now); const tr = trace; const firstAt = tr.ttft, n = now < firstAt ? 0 : Math.min(tr.words.length, Math.floor((now - firstAt) / (tr.total - firstAt) * tr.words.length) + 1);
    $("#tr-screen").innerHTML = `<div class="muted" style="font-size:0.9rem">You: ${esc(tr.prompt)}</div><div style="margin-top:0.4rem">${n ? esc(tr.words.slice(0, n).join("")) : `<span class="muted">${tr.think && now > tr.ttft - tr.think * 22 - 40 ? "thinking…" : "waiting for the first token…"}</span>`}</div>`;
    const cur = tr.spans.findIndex(s => now >= s.start && now < s.start + s.dur && s.k !== "stream");
    if (cur >= 0 && chosen === null) explain(cur);
    readouts(tr, now);
    if (now >= tr.total) { playing = false; $("#tr-go").disabled = false; $("#tr-go").textContent = "Send again"; $("#tr-now-t").textContent = "Done"; $("#tr-now").innerHTML = "Reply complete. Click any bar to read about that step, or <a href=\"#tokens\">start with tokens →</a>"; return false; }
  });
  $("#tr-go").addEventListener("click", () => {
    trace = build(); chosen = null; playing = true; $("#tr-go").disabled = true;
    if (reduceMotion()) { draw(null); $("#tr-screen").innerHTML = `<div class="muted" style="font-size:0.9rem">You: ${esc(trace.prompt)}</div><div style="margin-top:0.4rem">${esc(trace.reply)}</div>`; readouts(trace, null); $("#tr-go").disabled = false; playing = false; return; }
    t0 = performance.now(); loop.start();
  });
  cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); const i = Math.floor((e.clientY - r.top - 4) / cv._hit.rowH); if (i >= 0 && i < cv._hit.n) { chosen = i; explain(i); if (!playing) draw(null); } });
  cv.style.cursor = "pointer"; cv.tabIndex = 0; cv.setAttribute("aria-label", "Request trace. Use the up and down arrow keys to step through the stages.");
  cv.addEventListener("keydown", e => { if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return; e.preventDefault(); const n = cv._hit.n; chosen = chosen === null ? 0 : (chosen + (e.key === "ArrowDown" ? 1 : n - 1)) % n; explain(chosen); if (!playing) draw(null); });
  onRedraw(() => { if (!playing) { draw(trace ? null : null); readouts(trace || build(), null); } });
  $("#tr-screen").innerHTML = '<span class="muted">Your conversation will appear here.</span>';

  /* ---- rewind ---- */
  const ev = [
    { t: 1.5, n: "Your reply streams back", d: "About a second or two from send to the end of a short answer.", ch: "send" },
    { t: 3600 * 24 * 14, n: "Model released and served", d: "Weights are copied to serving clusters across regions and hardware types, then load-tested.", ch: "sharing" },
    { t: 3600 * 24 * 40, n: "Safety and capability evaluations", d: "Benchmarks, red-teaming and dangerous-capability tests decide whether and how the model ships.", ch: "evals" },
    { t: 3600 * 24 * 75, n: "Post-training", d: "Fine-tuning and reinforcement learning turn a text predictor into a helpful, careful assistant.", ch: "align" },
    { t: 3600 * 24 * 160, n: "Pretraining run", d: "Months on thousands of accelerators predicting the next token over trillions of tokens. Llama 3's 54-day snapshot alone saw 419 unexpected interruptions.", ch: "scale" },
    { t: 3600 * 24 * 300, n: "Data collection and cleaning", d: "Web crawls, code, books and more are filtered, deduplicated and mixed.", ch: "data" },
    { t: 3600 * 24 * 600, n: "Datacenter built and powered", d: "AWS brought Project Rainier online less than a year after announcing it; gigawatt campuses take a year or more.", ch: "datacenter" },
    { t: 3600 * 24 * 365 * 4, n: "Chips designed and manufactured", d: "Accelerator generations take years from design to volume production.", ch: "datacenter" }
  ];
  const rcv = $("#rw-cv"); let sel = 0;
  function rdraw() {
    const { ctx, w } = setupCanvas(rcv, 120); ctx.clearRect(0, 0, w, 120);
    const lo = Math.log10(0.5), hi = Math.log10(3600 * 24 * 365 * 8); const X = t => 20 + (Math.log10(t) - lo) / (hi - lo) * (w - 40);
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, 60); ctx.lineTo(w - 14, 60); ctx.stroke();
    font(ctx, 10, "--f-mono"); ctx.fillStyle = css("--muted"); ctx.textAlign = "center";
    let lastX = -99; [[1, "1 s"], [60, "1 min"], [3600, "1 hour"], [86400, "1 day"], [86400 * 30, "1 month"], [86400 * 365, "1 year"]].forEach(([t, l]) => { const x = X(t); ctx.fillRect(x - 0.5, 54, 1, 12); if (x - lastX > 52) { ctx.fillText(l, x, 84); lastX = x; } });
    font(ctx, 11); ctx.fillText("further back in time →  (log scale)", w / 2, 108);
    ev.forEach((e, i) => { const x = X(e.t); ctx.fillStyle = i === sel ? css("--heat") : css("--accent"); ctx.beginPath(); ctx.arc(x, 60, i === sel ? 9 : 6.5, 0, 7); ctx.fill(); });
    const e = ev[sel]; font(ctx, 12, "--f-display", "700"); ctx.fillStyle = css("--ink"); const x = X(e.t); ctx.textAlign = x < 100 ? "left" : x > w - 100 ? "right" : "center"; ctx.fillText(e.n, x, 36);
    rcv._X = X;
    $$("#rw-list button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.i === sel ? "true" : "false"));
    $("#rw-t").textContent = e.n; $("#rw-d").innerHTML = esc(e.d) + ` <a href="#${e.ch}">Go to chapter →</a>`;
  }
  const ago = t => t < 60 ? "seconds ago" : t < 86400 * 30 ? Math.round(t / 86400 / 7) + " weeks before" : t < 86400 * 365 ? Math.round(t / 86400 / 30) + " months before" : "years before";
  $("#rw-list").innerHTML = ev.map((e, i) => `<li><button type="button" data-i="${i}" aria-pressed="${i === 0}"><span>${esc(e.n)}</span><span class="ago">${ago(e.t)}</span></button></li>`).join("");
  $$("#rw-list button").forEach(b => b.addEventListener("click", () => { sel = +b.dataset.i; rdraw(); }));
  rcv.style.cursor = "pointer"; rcv.tabIndex = 0;
  rcv.addEventListener("keydown", e => { if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return; e.preventDefault(); sel = Math.max(0, Math.min(ev.length - 1, sel + (e.key === "ArrowRight" ? 1 : -1))); rdraw(); });
  rcv.addEventListener("click", e => { const r = rcv.getBoundingClientRect(); const x = e.clientX - r.left; let best = 0, bd = 1e9; ev.forEach((v, i) => { const d = Math.abs(rcv._X(v.t) - x); if (d < bd) { bd = d; best = i; } }); sel = best; rdraw(); });
  onRedraw(rdraw);
});
