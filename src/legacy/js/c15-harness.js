/* Chapter 15: agent loop terminal with context accounting */
chapter("harness", () => {
  const script = [
    { kind: "prefix", base: 5000, who: "system", text: "System prompt + tool definitions: run_tests, read_file, edit_file (5,000 tokens)" },
    { kind: "msg", base: 40, who: "user", text: "The checkout test is failing. Can you fix it?" },
    { kind: "call", base: 150, who: "model", text: "I'll run the tests to see the failure.", tool: "run_tests()" },
    { kind: "tool", base: 1200, scale: true, who: "tool", text: "FAILED test_checkout_total: expected 108.00, got 100.00\n  at cart.py:14 in total() … (stack trace)" },
    { kind: "call", base: 80, who: "model", text: "Tax isn't being applied. Let me read the cart module.", tool: 'read_file("cart.py")' },
    { kind: "tool", base: 2500, scale: true, who: "tool", text: "def total(items, tax_rate):\n    return sum(i.price for i in items)   # tax never applied\n… (rest of file)" },
    { kind: "call", base: 300, who: "model", text: "Apply the tax rate to the subtotal.", tool: 'edit_file("cart.py", …)' },
    { kind: "tool", base: 30, who: "tool", text: "ok: 1 line changed" },
    { kind: "call", base: 60, who: "model", text: "Re-running the tests to confirm.", tool: "run_tests()" },
    { kind: "tool", base: 600, scale: true, who: "tool", text: "42 passed in 3.1s" },
    { kind: "final", base: 120, who: "model", text: "Fixed: total() now multiplies the subtotal by (1 + tax_rate). All 42 tests pass." }
  ];
  let pos = 2;
  function sim(upto) {
    const v = num("ag-v"), W = Math.round(10 ** num("ag-w")), cmp = checked("ag-cmp"), cache = checked("ag-cache"), cp = num("ag-cp");
    const ctx = []; let calls = 0, inTot = 0, inCached = 0, outTot = 0, comp = 0, over = false, prev = 0;
    for (let i = 0; i < upto; i++) { const s = script[i], tok = Math.round(s.base * (s.scale ? v : 1));
      if (s.who === "model") { const len = ctx.reduce((a, m) => a + m.tok, 0); calls++; inTot += len; inCached += cache ? Math.min(prev, len) : 0; outTot += tok; prev = len + tok; }
      ctx.push({ ...s, tok, compacted: false }); let used = ctx.reduce((a, m) => a + m.tok, 0);
      if (used > W * 0.8 && cmp) for (const m of ctx) { if (used <= W * 0.6) break; if (m.kind === "tool" && !m.compacted && m.tok > 150) { used -= m.tok - 120; m.tok = 120; m.compacted = true; comp++; prev = 0; } }
      if (used > W) over = true; }
    return { ctx, calls, inTot, inCached, outTot, comp, over, W, cp };
  }
  const colOf = k => ({ prefix: css("--muted"), msg: css("--ok"), call: css("--accent"), final: css("--accent"), tool: css("--heat") }[k]);
  const termCol = { system: "#8696a8", user: "#7ad39b", model: "#7fbef0", tool: "#f0b860" };
  function render() {
    const s = sim(pos), used = s.ctx.reduce((a, m) => a + m.tok, 0);
    $(`output[for="ag-w"]`).textContent = s.W.toLocaleString() + " tokens";
    $("#ag-term").innerHTML = s.ctx.map(m => {
      const head = m.who === "system" ? "[system]" : m.who === "user" ? "user ›" : m.who === "tool" ? "  ⎿ result" : "model ›";
      const body = m.compacted ? "[summarised: " + m.text.split("\n")[0].slice(0, 46) + "…]" : m.text;
      return `<div style="margin-bottom:0.45rem"><span style="color:${termCol[m.who]};font-weight:600">${head}</span> <span style="color:#8696a8">(${m.tok.toLocaleString()} tok)</span><div style="white-space:pre-wrap;${m.compacted ? "opacity:0.6;font-style:italic" : ""}">${esc(body)}${m.tool ? `\n<span style="color:${termCol.tool}">→ ${esc(m.tool)}</span>` : ""}</div></div>`; }).join("") + (s.over ? `<div style="color:#ff7b6e">✕ Context window exceeded: the next call would be rejected.</div>` : pos >= script.length ? `<div style="color:#7ad39b">✓ Task complete.</div>` : `<div style="color:#8696a8">▍</div>`);
    $("#ag-term").scrollTop = 1e6;
    const cv = $("#ag-cv"); const { ctx, w } = setupCanvas(cv, 54); ctx.clearRect(0, 0, w, 54); const sc = (w - 2) / Math.max(s.W, used); let x = 1;
    s.ctx.forEach(m => { ctx.fillStyle = colOf(m.kind); ctx.globalAlpha = m.compacted ? 0.35 : 0.85; ctx.fillRect(x, 4, Math.max(1, m.tok * sc - 1), 20); x += m.tok * sc; }); ctx.globalAlpha = 1;
    ctx.strokeStyle = css("--crit"); ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1 + s.W * sc, 0); ctx.lineTo(1 + s.W * sc, 28); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.fillText(w < 560 ? "grey system · green you · blue model · amber tools" : "grey system · green user · blue model · amber tool output · red line = window", 0, 46);
    const costNo = s.inTot + s.outTot * 5, costYes = s.inTot - s.inCached + s.inCached * s.cp + s.outTot * 5;
    $("#ag-read").innerHTML = `<div class="readout ${s.over ? "bad" : used > s.W * 0.8 ? "hot" : ""}"><div class="k">Context in use</div><div class="v">${Math.round(used / s.W * 100)}%</div><div class="s">${used.toLocaleString()} of ${s.W.toLocaleString()}</div></div>
      <div class="readout"><div class="k">Model calls</div><div class="v">${s.calls}</div><div class="s">${s.comp} summaries</div></div>
      <div class="readout"><div class="k">Input tokens processed</div><div class="v">${s.inTot.toLocaleString()}</div><div class="s">${s.inCached.toLocaleString()} from cache</div></div>
      <div class="readout ok"><div class="k">Cost with caching</div><div class="v">${costNo ? Math.round(costYes / costNo * 100) : 100}%</div><div class="s">of the cost without it</div></div>`;
    $("#ag-step").disabled = pos >= script.length;
  }
  $("#ag-step").addEventListener("click", () => { pos = Math.min(script.length, pos + 1); render(); });
  $("#ag-all").addEventListener("click", () => { pos = script.length; render(); });
  $("#ag-reset").addEventListener("click", () => { pos = 2; render(); });
  bindCtl("ag-v", render, e => "×" + (+e.value).toFixed(2)); $("#ag-w").addEventListener("input", render); bindCtl("ag-cp", render, e => Math.round(e.value * 100) + "%");
  ["ag-cmp", "ag-cache"].forEach(id => $("#" + id).addEventListener("change", render));
  onRedraw(render);
});
