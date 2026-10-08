/* Chapter 7: cleaning pipeline funnel + packing tool */
chapter("data", () => {
  const docs = [
    { q: 4.5, t: "Photosynthesis is the process plants use to turn light into chemical energy. Inside the chloroplast, chlorophyll absorbs mostly red and blue light. That energy splits water molecules, which releases oxygen as a by-product. The plant then uses the captured energy to build sugars from carbon dioxide in a cycle of reactions known as the Calvin cycle. These sugars feed the plant and, through food chains, almost every animal on Earth." },
    { q: 4.5, t: "Photosynthesis is the process plants use to turn light into chemical energy. Inside the chloroplast, chlorophyll absorbs mostly red and blue light. That energy splits water molecules, which releases oxygen as a by-product. The plant then uses the captured energy to build sugars from carbon dioxide in a cycle of reactions known as the Calvin cycle. These sugars feed the plant and, through food chains, almost every animal on Earth." },
    { q: 4.0, t: "Photosynthesis is the process plants use to turn light into chemical energy. Inside the chloroplast, chlorophyll absorbs mostly red and blue light. That energy splits water molecules, which releases oxygen as a by-product. The plant then uses the captured energy to build sugars from carbon dioxide in a cycle of reactions known as the Calvin cycle. These sugars feed the plant and most animals. Share this article with your friends. Copyright SciDaily, all rights reserved." },
    { q: 3.5, t: "La photosynthèse est le processus par lequel les plantes transforment la lumière en énergie chimique. Dans le chloroplaste, la chlorophylle absorbe surtout la lumière rouge et bleue. Cette énergie sert à scinder les molécules d'eau, ce qui libère de l'oxygène. La plante fabrique ensuite des sucres à partir du dioxyde de carbone grâce au cycle de Calvin, et ces sucres nourrissent presque tous les êtres vivants." },
    { q: 0.0, t: "BUY THE CHEAPEST WATCHES!!! $$$ it is the BEST PRICE on the web $$$ >>> click here <<< and click here again!!! ### LIMITED OFFER for the first 100 buyers ### $$$ 99% OFF $$$ !!! act now and save !!! this is a once in a lifetime deal, so do not miss it !!! www.cheap-watches-4u.biz ### $$$" },
    { q: 0.0, t: "Home | About | Contact | Login\nHome | About | Contact | Login\nHome | About | Contact | Login\nPrivacy | Terms | Cookies\nHome | About | Contact | Login" },
    { q: 4.0, t: "A TCP connection starts with a three-way handshake. The client sends a SYN segment with an initial sequence number. The server answers with SYN-ACK, acknowledging the client's number and choosing its own. The client replies with an ACK, and both sides now agree on the sequence numbers they will use. This exchange lets each side detect lost or reordered segments and is why opening a new connection costs at least one round trip before any data flows." },
    { q: 0.5, t: "lol same here, is it just me or is the app broken again? idk tbh" },
    { q: 4.0, t: "Some algae carry out photosynthesis in the open ocean, and they produce a large share of the oxygen in the air. Like land plants, they use chlorophyll to absorb light and split water, releasing oxygen. Many algae also carry extra pigments that capture the blue-green light that reaches deeper water. Because they grow quickly, scientists study them as a possible source of biofuel and as a way to understand how the earliest plants evolved." },
    { q: 2.0, t: "To make a simple loaf, mix 500 grams of flour with a teaspoon of salt and a sachet of yeast. Add about 300 millilitres of warm water and stir until it forms a rough dough. Knead it for ten minutes until it feels smooth and springs back when pressed. Leave it covered in a warm place for an hour, shape it, let it rise again, and then bake it in a hot oven for about thirty minutes until golden." },
    { q: 3.5, t: "La fotosíntesis es el proceso mediante el cual las plantas convierten la luz en energía química. En el cloroplasto, la clorofila absorbe sobre todo la luz roja y azul. Esa energía rompe las moléculas de agua y libera oxígeno. Después, la planta fabrica azúcares a partir del dióxido de carbono en el ciclo de Calvin, y esos azúcares alimentan a casi todos los seres vivos del planeta." },
    { q: 4.5, t: "Binary search finds a value in a sorted array by repeatedly halving the search range. You compare the target with the middle element. If they match, you are done. If the target is smaller, you keep only the left half; if larger, only the right half. Each step discards half the remaining elements, so an array of one million items needs at most about twenty comparisons. The main bug to avoid is an off-by-one error when updating the low and high bounds." },
    { q: 0.5, t: "the best laptop is the best laptop for the money and the best laptop for students. best laptop best laptop 2024 best laptop deals cheap best laptop best laptop sale best laptop reviews best laptop for students best laptop price best laptop best laptop best laptop offers buy best laptop now best laptop online best laptop store best laptop discount" },
    { q: 1.0, t: "The X200 is a wireless mouse. It is black and it ships in two days. In stock." },
    { q: 4.0, t: "Around 1440, Johannes Gutenberg combined movable metal type, oil-based ink and a modified wine press into a practical printing system. Before this, most books in Europe were copied by hand, which made them rare and expensive. Printing cut the cost of books dramatically and spread quickly across the continent. Historians link the resulting flood of pamphlets and books to the Reformation, the Scientific Revolution and the rise of literacy among ordinary people." },
    { q: 1.0, t: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur." }
  ];
  const STOP = new Set("the a an and or of to in is are was were it that this as for with on by be at from which these those its their they them then than so but not into most each only both also can how why who what when there over about".split(" "));
  const words = t => t.toLowerCase().match(/[\p{L}\p{N}'-]+/gu) || [];
  function langOK(t) { const w = words(t), s = w.filter(x => STOP.has(x)).length; return s >= 2 && s / Math.max(1, w.length) >= 0.06 ? null : "not English (few common English words)"; }
  function rulesOK(t) {
    const w = words(t); if (w.length < 40) return "too short (" + w.length + " words)";
    const sym = (t.match(/[#$!<>|]/g) || []).length / t.length; if (sym > 0.03) return "too many symbols (" + (sym * 100).toFixed(0) + "%)";
    const lines = t.split("\n").filter(Boolean); if (lines.length > 2 && 1 - new Set(lines).size / lines.length > 0.3) return "repeated lines";
    const cnt = {}; w.filter(x => !STOP.has(x)).forEach(x => cnt[x] = (cnt[x] || 0) + 1); if (Math.max(...Object.values(cnt)) / w.length > 0.12) return "keyword stuffing";
    return null;
  }
  function fnv(str, seed) { let h = 2166136261 ^ seed; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function minhash(t) { const w = words(t), sh = []; for (let i = 0; i + 2 < w.length; i++) sh.push(w[i] + " " + w[i + 1] + " " + w[i + 2]); const sig = []; for (let s = 0; s < 64; s++) { let m = Infinity; for (const x of sh) { const h = fnv(x, s * 2654435761); if (h < m) m = h; } sig.push(m); } return sig; }
  const sigs = docs.map(d => minhash(d.t)), hashes = docs.map(d => fnv(d.t, 0)), jac = (a, b) => a.reduce((n, x, i) => n + (x === b[i]), 0) / a.length;
  function run() {
    const L = checked("dp-lang"), R = checked("dp-rules"), E = checked("dp-exact"), Nn = checked("dp-near"), J = num("dp-jac"), Q = num("dp-q");
    const stages = [16, 0, 0, 0, 0, 0]; const kept = []; const seen = new Set(); const res = [];
    docs.forEach((d, i) => {
      let why = null, st = 0;
      if (L) { const r = langOK(d.t); if (r) { why = r; st = 1; } }
      if (!why && R) { const r = rulesOK(d.t); if (r) { why = r; st = 2; } }
      if (!why && E && seen.has(hashes[i])) { why = "exact copy of an earlier page"; st = 3; }
      if (!why && Nn) { let best = 0, who = -1; kept.forEach(k => { const j = jac(sigs[i], sigs[k]); if (j > best) { best = j; who = k; } }); if (best >= J) { why = `near-copy of page ${who + 1} (similarity ≈ ${best.toFixed(2)})`; st = 4; } }
      if (!why && d.q < Q) { why = `educational score ${d.q.toFixed(1)} below cut-off`; st = 5; }
      seen.add(hashes[i]); if (!why) kept.push(i);
      res.push({ i, why, st });
      for (let s = 1; s <= 5; s++) if (!why || st > s) stages[s]++;
    });
    const cv = $("#dp-funnel"); const { ctx, w } = setupCanvas(cv, 168); ctx.clearRect(0, 0, w, 168);
    const labels = ["Raw pages", "Language", "Quality rules", "Exact dedup", "Near dedup", "Educational"]; const bw = w / 6;
    stages.forEach((n, s) => { const h = n / 16 * 96; const x = s * bw + 6; ctx.fillStyle = s === 5 ? css("--ok") : css("--accent"); ctx.globalAlpha = 0.35 + 0.65 * (s / 5); rr(ctx, x, 124 - h, bw - 12, Math.max(h, 2), 4); ctx.fill(); ctx.globalAlpha = 1;
      font(ctx, 16, "--f-mono", "600"); ctx.fillStyle = css("--ink"); ctx.textAlign = "center"; ctx.fillText(n, x + (bw - 12) / 2, 118 - h); font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.fillText(labels[s], x + (bw - 12) / 2, 142); });
    font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.textAlign = "left"; const kw = res.filter(r => !r.why).reduce((a, r) => a + words(docs[r.i].t).length, 0), tw = docs.reduce((a, d) => a + words(d.t).length, 0);
    ctx.fillText(`Words kept: ${Math.round(kw / tw * 100)}%`, 6, 162);
    $("#dp-cards").innerHTML = res.map(r => { const d = docs[r.i]; const prev = esc(d.t.replace(/\n/g, " ").slice(0, 90)) + "…";
      return `<div style="border:1px solid ${r.why ? "var(--line)" : "var(--ok)"};border-radius:6px;padding:0.5rem 0.6rem;background:var(--surface);opacity:${r.why ? 0.62 : 1};font-size:0.82rem;line-height:1.35">
        <div style="display:flex;justify-content:space-between;gap:0.4rem"><b class="mono">#${r.i + 1}</b><span class="pill ${r.why ? (r.st === 5 ? "warn" : "bad") : "ok"}">${r.why ? "dropped" : "kept"}</span></div>
        <div style="margin:0.25rem 0;${r.why ? "text-decoration:line-through;text-decoration-color:var(--muted)" : ""}">${prev}</div>
        <div class="muted" style="font-family:var(--f-display);font-size:0.74rem">${r.why ? esc(r.why) : "score " + d.q.toFixed(1)}</div></div>`; }).join("");
  }
  ["dp-lang", "dp-rules", "dp-exact", "dp-near"].forEach(id => $("#" + id).addEventListener("change", run));
  bindCtl("dp-jac", run, e => (+e.value).toFixed(2)); bindCtl("dp-q", run, e => (+e.value).toFixed(1));
  onRedraw(run);

  /* ---- packing ---- */
  let seed = 42;
  function pack() {
    const S = num("pk-seq"), med = num("pk-med"), mask = checked("pk-mask"), r = rng(seed); const segs = []; let used = 0;
    while (used < S) { let l = Math.max(16, Math.round(med * Math.exp(0.9 * gauss(r)))); l = Math.min(l, S - used); segs.push(l); used += l; }
    const causal = S * (S + 1) / 2, intra = segs.reduce((a, l) => a + l * (l + 1) / 2, 0);
    const cv = $("#pk-cv"); const size = Math.min(innerW(cv.parentElement), 320); cv.style.width = size + "px"; const { ctx } = setupCanvas(cv, size); const n = 100, c = size / n;
    const bounds = []; let acc = 0; segs.forEach(l => { bounds.push([acc, acc + l]); acc += l; }); const docOf = t => bounds.findIndex(([a, b]) => t >= a && t < b);
    const pal = [css("--accent"), css("--heat"), css("--ok"), css("--l3")]; ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { const di = docOf(Math.floor((i + 0.5) / n * S)), dj = docOf(Math.floor((j + 0.5) / n * S));
      if (di !== dj && mask) ctx.fillStyle = css("--grid"); else { ctx.fillStyle = di === dj ? pal[di % 4] : css("--crit"); ctx.globalAlpha = di === dj ? 0.8 : 0.45; }
      ctx.fillRect(j * c, i * c, c + 0.5, c + 0.5); ctx.globalAlpha = 1; }
    $("#pk-read").innerHTML = `<div class="readout"><div class="k">Documents in sequence</div><div class="v">${segs.length}</div></div>
      <div class="readout ${mask ? "ok" : "bad"}"><div class="k">Cross-document attention</div><div class="v">${Math.round((1 - intra / causal) * 100)}%</div><div class="s">${mask ? "blocked by the mask" : "of attention pairs, wasted"}</div></div>`;
  }
  $("#pk-mask").addEventListener("change", pack); bindCtl("pk-seq", pack, e => (+e.value).toLocaleString()); bindCtl("pk-med", pack, e => (+e.value).toLocaleString());
  $("#pk-new").addEventListener("click", () => { seed = (seed * 48271) % 2147483647; pack(); }); $("#pk").addEventListener("toggle", pack); onRedraw(pack);
});
