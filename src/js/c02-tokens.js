/* Chapter 2: step-through BPE + embedding map */
chapter("tokens", () => {
  const SP = "·";
  const seg2 = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  const graphemes = w => seg2 ? Array.from(seg2.segment(w), x => x.segment) : Array.from(w);
  const pretok = t => (t.match(/ ?[^\s]+/g) || []).map(w => w.replace(/^ /, SP));
  let corpus, words, learned, history;
  function reset() {
    const text = $("#bp-train").value; words = pretok(text).map(w => graphemes(w));
    learned = []; history = [[0, count()]]; render(null);
  }
  const count = () => words.reduce((a, w) => a + w.length, 0);
  function step() {
    const pairs = new Map();
    words.forEach(s => { for (let i = 0; i + 1 < s.length; i++) { const k = s[i] + "\u0000" + s[i + 1]; pairs.set(k, (pairs.get(k) || 0) + 1); } });
    let best = null, bc = 1; for (const [k, v] of pairs) if (v > bc) { bc = v; best = k; }
    if (!best) return null;
    const [a, b] = best.split("\u0000"); learned.push([a, b, bc]);
    words = words.map(s => { const o = []; for (let i = 0; i < s.length; i++) { if (i + 1 < s.length && s[i] === a && s[i + 1] === b) { o.push(a + b); i++; } else o.push(s[i]); } return o; });
    history.push([learned.length, count()]); return a + b;
  }
  function encode(text) { return pretok(text).flatMap(w => { let s = graphemes(w); learned.forEach(([a, b]) => { const o = []; for (let i = 0; i < s.length; i++) { if (i + 1 < s.length && s[i] === a && s[i + 1] === b) { o.push(a + b); i++; } else o.push(s[i]); } s = o; }); return s; }); }
  const hue = t => { let h = 0; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const dark = () => getComputedStyle(document.documentElement).colorScheme.includes("dark");
  const chip = (t, hl) => `<span style="background:hsl(${hue(t)} 55% ${dark() ? 24 : 88}%);${hl ? "outline:2px solid var(--heat);" : ""}">${esc(t)}</span>`;
  function render(newTok) {
    const all = words.flat(); const chars = $("#bp-train").value.length;
    $("#bp-tok").innerHTML = all.map(t => chip(t, t === newTok)).join("");
    $("#bp-tok2").innerHTML = encode($("#bp-test").value).map(t => chip(t, t === newTok)).join("");
    const base = new Set(graphemes($("#bp-train").value.replace(/\s+/g, SP))).size;
    const last = learned[learned.length - 1];
    $("#bp-last").innerHTML = last ? `Merge ${learned.length}: <b style="color:var(--heat)">${esc(last[0])} + ${esc(last[1])} → ${esc(last[0] + last[1])}</b> (seen ${last[2]}×)` : "Training text, as tokens (single letters to start)";
    $("#bp-read").innerHTML = `<div class="readout"><div class="k">Vocabulary</div><div class="v">${base + learned.length}</div><div class="s">${base} letters + ${learned.length} merges</div></div>
      <div class="readout hot"><div class="k">Tokens in text</div><div class="v">${all.length}</div><div class="s">${(chars / all.length).toFixed(2)} characters per token</div></div>
      <div class="readout"><div class="k">Your sentence</div><div class="v">${encode($("#bp-test").value).length} tokens</div></div>`;
    $("#bp-step").disabled = $("#bp-10").disabled = false;
    plotHist();
  }
  function plotHist() {
    const mx = Math.max(60, history.length + 5);
    plot($("#bp-cv"), { height: 170, x: { min: 0, max: mx, label: "merges learned", fmt: v => v.toFixed(0) }, y: { min: 0, max: history[0][1] * 1.05, label: "tokens", fmt: v => v.toFixed(0) },
      series: [{ data: history, color: css("--heat") }, { data: [history[history.length - 1]], points: true, color: css("--heat"), r: 4 }] });
  }
  $("#bp-step").addEventListener("click", () => { const t = step(); if (t === null) { $("#bp-last").textContent = "No pair appears twice any more: add more training text to keep learning."; $("#bp-step").disabled = $("#bp-10").disabled = true; return; } render(t); });
  $("#bp-10").addEventListener("click", () => { let t; for (let i = 0; i < 10; i++) { const r = step(); if (r === null) break; t = r; } render(t); });
  $("#bp-reset").addEventListener("click", reset);
  $("#bp-train").addEventListener("input", reset); $("#bp-test").addEventListener("input", () => render(null));
  reset(); for (let i = 0; i < 3; i++) step(); render(null);
  onRedraw(() => render(null));

  /* ---- embedding map (illustrative coordinates) ---- */
  const W = [
    ["king", 0.70, 0.78], ["queen", 0.86, 0.62], ["man", 0.52, 0.52], ["woman", 0.68, 0.36], ["prince", 0.62, 0.86], ["princess", 0.78, 0.70],
    ["boy", 0.40, 0.58], ["girl", 0.56, 0.42],
    ["walk", 0.12, 0.26], ["walked", 0.24, 0.12], ["swim", 0.10, 0.44], ["swam", 0.22, 0.30], ["run", 0.04, 0.34], ["ran", 0.16, 0.20],
    ["paris", 0.36, 0.92], ["france", 0.20, 0.84], ["tokyo", 0.46, 0.80], ["japan", 0.30, 0.72],
    ["gpu", 0.90, 0.16], ["tpu", 0.94, 0.26], ["chip", 0.84, 0.08], ["cat", 0.42, 0.22], ["dog", 0.50, 0.16]
  ];
  let picks = [];
  const cv = $("#em-cv");
  function edraw() {
    const w0 = innerW(cv.parentElement); const h = Math.min(380, Math.max(280, w0 * 0.75));
    const { ctx, w } = setupCanvas(cv, h); ctx.clearRect(0, 0, w, h);
    const P = ([, x, y]) => [20 + x * (w - 70), h - 20 - y * (h - 40)];
    ctx.strokeStyle = css("--grid"); for (let i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(20 + i / 10 * (w - 70), 20); ctx.lineTo(20 + i / 10 * (w - 70), h - 20); ctx.stroke(); ctx.beginPath(); ctx.moveTo(20, 20 + i / 10 * (h - 40)); ctx.lineTo(w - 50, 20 + i / 10 * (h - 40)); ctx.stroke(); }
    const arrow = (a, b, col, dash) => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); const an = Math.atan2(b[1] - a[1], b[0] - a[0]); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - 10 * Math.cos(an - 0.4), b[1] - 10 * Math.sin(an - 0.4)); ctx.lineTo(b[0] - 10 * Math.cos(an + 0.4), b[1] - 10 * Math.sin(an + 0.4)); ctx.fill(); ctx.lineWidth = 1; };
    let target = null, near = null;
    if (picks.length >= 2) arrow(P(W[picks[0]]), P(W[picks[1]]), css("--heat"));
    if (picks.length === 3) {
      const [a, b, c] = picks.map(i => W[i]); const tx = c[1] + b[1] - a[1], ty = c[2] + b[2] - a[2]; target = [, tx, ty];
      let bd = 9; W.forEach((v, i) => { if (picks.includes(i)) return; const d = Math.hypot(v[1] - tx, v[2] - ty); if (d < bd) { bd = d; near = i; } });
      arrow(P(c), P(target), css("--heat"), [6, 4]);
      const [x, y] = P(target); ctx.strokeStyle = css("--ok"); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    }
    if (kb && document.activeElement === cv) { const [x, y] = P(W[cursor]); ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.strokeRect(x - 9, y - 9, 18, 18); ctx.lineWidth = 1; $("#em-kb").textContent = "Focused: " + W[cursor][0]; }
    W.forEach((v, i) => { const [x, y] = P(v); const on = picks.includes(i) || i === near;
      ctx.fillStyle = i === near ? css("--ok") : on ? css("--heat") : css("--accent"); ctx.beginPath(); ctx.arc(x, y, on ? 6 : 4.5, 0, 7); ctx.fill();
      font(ctx, 12, "--f-mono", on ? "600" : ""); ctx.fillStyle = css("--ink"); ctx.textAlign = "left"; ctx.fillText(v[0], x + 8, y + 4); });
    cv._P = P;
    const names = picks.map(i => W[i][0]);
    $("#em-read").innerHTML = picks.length < 2 ? `<div class="readout"><div class="k">Step ${picks.length + 1} of 3</div><div class="v" style="font-size:0.95rem">${picks.length ? "Now click a second word" : "Click a word, e.g. man"}</div><div class="s">${picks.length ? "e.g. woman" : ""}</div></div>`
      : picks.length === 2 ? `<div class="readout hot"><div class="k">Arrow</div><div class="v" style="font-size:0.95rem">${names[0]} → ${names[1]}</div><div class="s">Now click a third word, e.g. king</div></div>`
      : `<div class="readout ok"><div class="k">${names[2]} − ${names[0]} + ${names[1]} ≈</div><div class="v">${near !== null ? W[near][0] : "?"}</div><div class="s">nearest word to where the arrow lands</div></div>`;
  }
  cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; let bi = -1, bd = 22;
    W.forEach((v, i) => { const [px, py] = cv._P(v); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) return; if (picks.length >= 3) picks = []; if (!picks.includes(bi)) picks.push(bi); edraw(); });
  $("#em-reset").addEventListener("click", () => { picks = []; edraw(); });
  let cursor = 0; cv.tabIndex = 0; cv.setAttribute("aria-label", "Word map. Use arrow keys to move between words and Enter to pick one.");
  cv.addEventListener("keydown", e => { if (["ArrowRight", "ArrowDown"].includes(e.key)) { cursor = (cursor + 1) % W.length; } else if (["ArrowLeft", "ArrowUp"].includes(e.key)) { cursor = (cursor + W.length - 1) % W.length; } else if (e.key === "Enter" || e.key === " ") { if (picks.length >= 3) picks = []; if (!picks.includes(cursor)) picks.push(cursor); } else return; e.preventDefault(); kb = true; edraw(); });
  let kb = false;
  onRedraw(edraw);
});
