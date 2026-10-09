/* Chapter 1: trace of one request + rewind timeline */
chapter("send", () => {
  const replies = {
    "Why is the sky blue?": "Sunlight contains every colour. Air molecules scatter short, blue wavelengths much more strongly than long, red ones (Rayleigh scattering), so blue light reaches your eyes from every part of the sky.",
    "Write a haiku about servers.": "Fans hum through the night / a thousand racks hold their breath / your answer, then dawn",
    "What is 17 × 24?": "17 × 24 = 408. One way: 17 × 20 = 340 and 17 × 4 = 68, and 340 + 68 = 408."
  };
  const LONG = "Summarise this incident report for an executive audience. " + "At 09:14 UTC the payments service began returning elevated 5xx errors after a configuration change to the connection pool. Retries amplified load on the primary database, which hit its connection limit; the on-call engineer rolled back the change at 09:41 and error rates returned to normal by 09:52. ".repeat(30);
  const LONG_REPLY = "Summary: a configuration change to the payments service's connection pool caused 38 minutes of elevated errors. Retries overloaded the database. Rolling back fixed it; follow-ups are safer config rollout and retry limits.";
  const sysTok = { app: 400, cli: 3000, api: 0 };
  const sysWhat = { app: "about 400 hidden system-prompt tokens", cli: "about 3,000 tokens of hidden instructions and tool definitions", api: "no hidden tokens: your code sends only what you write" };
  const approxTokens = s => Math.max(1, Math.ceil(s.length / 4));
  const TPOT = 22;
  const chapterOf = { map: "send", send: "send", net: "send", gw: "send", safe: "evals", queue: "sharing", route: "memory", tok: "tokens", prefill: "inside", think: "align", decode: "predict", stream: "send", done: "tokens" };
  const chName = { send: "this chapter", evals: "Chapter 13", sharing: "Chapter 6", memory: "Chapter 5", tokens: "Chapter 2", inside: "Chapter 4", align: "Chapter 12", predict: "Chapter 3" };
  const titles = { map: "The whole trip", send: "You press send", net: "Across the internet", gw: "The front door", safe: "A quick safety check", queue: "Waiting in line", route: "Picking a copy of the model", tok: "Chopping text into tokens", prefill: "Reading the whole prompt at once", think: "Thinking before answering", decode: "Writing one token at a time", stream: "Streaming back to you", done: "Done" };

  const cv = $("#tr-cv"), J = createJourney(cv), stage = cv.parentElement;
  let sc = null;
  const getClient = seg($("#tr-client"), () => rebuild());
  bindCtl("tr-load", () => rebuild(), e => Math.round(e.value * 100) + "%");
  $("#tr-think").addEventListener("change", () => rebuild());
  $$("#tr-presets button").forEach(b => b.addEventListener("click", () => { $$("#tr-presets button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); $("#tr-prompt").value = b.dataset.p === "__long__" ? LONG.trim() : b.dataset.p; rebuild(); }));
  $("#tr-prompt").addEventListener("change", () => { $$("#tr-presets button").forEach(x => x.setAttribute("aria-pressed", "false")); rebuild(); });

  function scenario() {
    const prompt = $("#tr-prompt").value.trim() || "Hello";
    const reply = prompt.startsWith("Summarise this incident") ? LONG_REPLY : replies[prompt] || "Here's a short, clear answer to your question, with the key idea first and a one-line summary at the end.";
    const client = getClient(), sys = sysTok[client], inTok = approxTokens(prompt) + sys, rho = num("tr-load"), think = checked("tr-think") ? 300 : 0;
    const cached = sys > 0, outTok = approxTokens(reply);
    const durs = { net: 40, gw: 12, safe: 25, queue: Math.round(60 * rho / (1 - rho)), route: 4, tok: 2, prefill: Math.round(30 + (inTok - (cached ? sys : 0)) * 0.08), think: think * TPOT, decode: outTok * TPOT, stream: 40 };
    const ttft = durs.net + durs.gw + durs.safe + durs.queue + durs.route + durs.tok + durs.prefill + durs.think + TPOT + durs.stream;
    const total = ttft + (outTok - 1) * TPOT;
    const promptShort = prompt.length > 90 ? prompt.slice(0, 86) + "…" : prompt;
    return { prompt, promptShort, reply, client, sys, inTok, think, cached, outTok, durs, ttft, total, busy: rho };
  }
  function segments(s) {
    const L = [["map", 2.4, 0], ["send", 2.2, 5], ["net", 2.6, s.durs.net], ["gw", 2.2, s.durs.gw], ["safe", 2.2, s.durs.safe], ["queue", 2.0 + J.S.others * 0.35, s.durs.queue], ["route", 2.4, s.durs.route], ["tok", 2.8, s.durs.tok], ["prefill", 3.4, s.durs.prefill]];
    if (s.think) L.push(["think", 3.6, s.durs.think]);
    L.push(["decode", 7, s.durs.decode], ["stream", 2.6, s.durs.stream], ["done", 2.4, 0]);
    return L.map(([key, dur, rdur]) => ({ key, dur, rdur, title: titles[key] }));
  }
  const ms = v => v < 1000 ? Math.round(v) + " ms" : (v / 1000).toFixed(2) + " s";
  function caption(seg, depth) {
    const s = sc, k = seg.key, deep = depth >= 3, ch = chapterOf[k];
    const more = ch && ch !== "send" ? ` <a href="#${ch}">${chName[ch]} goes deeper →</a>` : "";
    const C = {
      map: [`Your prompt's trip: from your screen, across the internet, through a datacenter's front door to a GPU that writes the reply. Press play, or step through with the arrows.`,
            `One request, end to end: client → network → API gateway → safety classifier → queue → router → a model replica on GPUs, then tokens stream back. Press play, or step with ← →.`],
      send: [`You press send. Your words, and the conversation so far, are packed into a request.`,
             `The client POSTs JSON over HTTPS: the message list, model name, max tokens and "stream": true. It carries ${sysWhat[s.client]}.`],
      net: [`The request races through fibre-optic cable to the provider's datacenter. Light covers 1,000 km of fibre in about 5 ms.`,
            `TLS-encrypted, routed to the provider's nearest entry point, then over its network to a region that serves this model. Expect tens of milliseconds.`],
      gw: [`At the front door, a gatekeeper checks who you are and that you haven't sent too many requests.`,
           `The API gateway authenticates the key or session, applies rate limits and records usage for billing.`],
      safe: [`A quick check looks for clearly harmful requests. Many providers check replies too.`,
             `Lightweight classifiers screen inputs (and often outputs) for abuse. What is checked, and where, differs by provider.`],
      queue: [s.busy > 0.05 ? `Every copy of the model is busy, so your request waits its turn. ${J.S.others} ${J.S.others === 1 ? "request is" : "requests are"} ahead of you. Try the "How busy" slider.` : `The service is quiet, so there's no line today. Try the "How busy" slider below.`,
              `Wait time rises sharply as utilisation nears 100% (M/M/1: W_q = ρ/(μ−λ)). Here ρ = ${Math.round(s.busy * 100)}%, adding ${ms(s.durs.queue)}. Providers keep headroom and spread load across regions.`],
      route: [`A router picks one copy of the model with room for you, ideally one that has already read the start of your conversation.`,
              `Load balancers prefer a replica whose prefix cache already holds your prompt's opening tokens${s.cached ? " (here the system prompt), so they needn't be recomputed" : ""}.`],
      tok: [`Your text is chopped into tokens, pieces of words that each become a number.`,
            `${s.inTok.toLocaleString()} input tokens${s.sys ? `, ${s.sys.toLocaleString()} of them hidden instructions` : ""}. Tokenizing is a fast table lookup on a CPU.`],
      prefill: [`The model reads every token at once, layer by layer, and keeps notes about each one (the KV cache, bottom).`,
                `Prefill runs all ${(s.inTok - (s.cached ? s.sys : 0)).toLocaleString()} uncached tokens through every layer in parallel: compute-bound, about 2 × parameters × tokens FLOPs, ${ms(s.durs.prefill)} here.`],
      think: [`A thinking model first writes hidden reasoning. Those tokens take time like any others, but you don't see them.`,
              `${s.think} reasoning tokens are decoded exactly like visible ones (${ms(s.durs.think)} here), and their notes go into the KV cache too.`],
      decode: [`Now it writes the reply one token at a time: score every possible next piece, pick one, add it, repeat. Each token is sent to you the moment it exists.`,
               `Each decode step reads the weights from memory to produce one token: about ${TPOT} ms per token (${Math.round(1000 / TPOT)} tokens/s). It's limited by memory bandwidth, not compute.`],
      stream: [`Tokens keep arriving over the same open connection, and your app shows them as they land.`,
               `Server-sent events: one long HTTP response that delivers each chunk as it's generated. Detokenizing turns IDs back into text.`],
      done: [`Done. The first word appeared after ${ms(s.ttft)}; the full reply took ${ms(s.total)}. Press replay, or change the prompt, the app or how busy it is.`,
             `TTFT ${ms(s.ttft)} (network + queue + prefill${s.think ? " + thinking" : ""}), then ${s.outTok} tokens at ${TPOT} ms each: ${ms(s.total)} in total.`]
    };
    return (C[k] ? C[k][deep ? 1 : 0] : "") + more;
  }
  const hgt = () => { const w = innerW(stage); return w < 640 ? Math.round(Math.max(280, w * 0.9)) : Math.round(Math.min(560, Math.max(380, w * 0.5))); };
  const capH = () => 0;
  const film = makeFilm($("#tr"), {
    draw: (t, i, segs) => J.draw(t, i, segs, { h: hgt(), capH: capH() }),
    caption, onFrame: (t, i, rt) => timebar(rt)
  });
  const bars = [["Network", s => s.durs.net * 2, "--muted"], ["Checks and line", s => s.durs.gw + s.durs.safe + s.durs.queue + s.durs.route + s.durs.tok, "--ink"], ["Reading the prompt", s => s.durs.prefill, "--heat"], ["Thinking", s => s.durs.think, "--l3"], ["Writing the reply", s => s.durs.decode, "--accent"]];
  function timebar(rt) {
    const s = sc; if (!s) return; const tot = bars.reduce((a, b) => a + b[1](s), 0);
    const el = $("#tr-time"); if (!el._built || el._sc !== s) { el._built = 1; el._sc = s;
      el.innerHTML = `<div class="tb-row">${bars.filter(b => b[1](s) > 0).map(b => `<span style="width:${b[1](s) / tot * 100}%;background:var(${b[2]});opacity:0.85"></span>`).join("")}<i class="tb-head"></i></div><div class="tb-keys">${bars.filter(b => b[1](s) > 0).map(b => `<span><i style="background:var(${b[2]})"></i>${b[0]} ${ms(b[1](s))}</span>`).join("")}</div>`; }
    $(".tb-head", el).style.left = Math.min(100, rt / tot * 100) + "%";
  }
  function stats() {
    const s = sc;
    $("#tr-read").innerHTML = `<div><span class="v">${s.inTok.toLocaleString()}</span><span class="k">input tokens</span></div>
      <div><span class="v" style="color:var(--heat)">${ms(s.ttft)}</span><span class="k">until the first word</span></div>
      <div><span class="v">${Math.round(1000 / TPOT)}/s</span><span class="k">tokens while writing</span></div>
      <div><span class="v">${ms(s.total)}</span><span class="k">for the whole reply</span></div>`;
  }
  function rebuild() {
    sc = scenario(); J.setup(sc); film.pause(); film.setSegs(segments(sc)); film.seek(0); stats(); timebar(0);
  }
  rebuild();
  $("#tr-start").addEventListener("click", () => { $("#tr-start").hidden = true; film.seek(film.segs[1].t0); film.play(); });
  stage.addEventListener("click", e => { if (e.target !== cv) return; $("#tr-start").hidden = true; const r = cv.getBoundingClientRect(), k = J.hitKey(e.clientX - r.left, e.clientY - r.top); if (!k) return; const j = film.segs.findIndex(s => s.key === k); if (j >= 0) film.playSeg(j); });
  cv.addEventListener("focus", () => { $("#tr-start").hidden = true; });
  $(".scene-bar", $("#tr")).addEventListener("click", () => { $("#tr-start").hidden = true; });
  $(".scene-bar", $("#tr")).addEventListener("input", () => { $("#tr-start").hidden = true; });
  onRedraw(() => { film.refresh(); });

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
