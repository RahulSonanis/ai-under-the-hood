/* Start here · the hero simulation and the course map.
   Pick or type a message and watch it become tokens, cross the internet to a GPU, get read in one pass, and come
   back one token at a time. A deliberately light, illustrative cousin of chapter 1: the token split is approximate
   (short words whole, long words cut into pieces), the token IDs and the next-token odds are made up, and it all runs
   in slow motion (the real trip for a short reply takes about a second). */
chapter("start", () => {
  const PROMPTS = {
    sky: ["Why is the sky blue?", "Air scatters blue sunlight far more than red, so blue light reaches your eyes from every part of the sky."],
    haiku: ["Write a haiku about servers.", "Fans hum through the night / a thousand chips hold their breath / your answer, then dawn"],
    gpu: ["What is a GPU?", "A chip with thousands of small cores that all do simple maths at the same time, which is exactly the work an AI model needs."]
  };
  const OWN = "I'm a pretend model, so I can't really answer you. A real one sends its reply back just like this, one token at a time.";
  const ORDER = ["sky", "haiku", "gpu"];
  const T_SPLIT = 0.9, T_OUT = 1.6, FLY = 0.9, T_READ = 1.1, GEN = 0.22, T_BACK = 0.95, IDLE = 4.5;
  const POOL = [" the", " a", " and", " it", " so", " of", " to", ",", ".", " is", " in", " that"];
  const CHIP = ["#5ce1c6", "#8fb3ff", "#d59cff", "#ffb547"];

  // ---------- tokens (approximate) ----------
  const tokenize = str => { const out = []; (str.match(/\s*[A-Za-z']+|\s*\d+|\s*[^\sA-Za-z\d]/g) || []).forEach(w => { const core = w.trim(); if (core.length <= 7) out.push(w); else { const lead = w.slice(0, w.length - core.length); out.push(lead + core.slice(0, 5)); let a = core.slice(5); while (a.length) { out.push(a.slice(0, 4)); a = a.slice(4); } } }); return out; };
  const hash = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const tokId = t => 100 + hash(t) % 127900;                 // made-up IDs in a 128,000-token list
  const frac = (str, salt) => (hash(str + salt) % 1000) / 1000;
  const show = t => t.replace(/^\s/, "·");                    // a leading space is part of the token

  // ---------- layouts (world units) ----------
  const LAY = {
    wide: { W: 1000, H: 380, fs: 17, chipFs: 13.5, sm: 12.5, chat: { x: 14, y: 14, w: 372, h: 352 }, gpu: { x: 620, y: 14, w: 366, h: 352 },
      out: [[386, 124], [480, 40], [540, 200], [664, 198]], back: [[928, 262], [944, 372], [520, 392], [386, 300]],
      stack: { x: 664, y: 104, w: 196, h: 188, n: 8 }, odds: { x: 880, y: 114, w: 92 }, ctx: { x: 640, y: 80, w: 326 }, net: [503, 190], slow: [503, 372] },
    narrow: { W: 360, H: 620, fs: 16.5, chipFs: 14, sm: 12.5, chat: { x: 6, y: 6, w: 348, h: 290 }, gpu: { x: 6, y: 378, w: 348, h: 236 },
      out: [[70, 296], [20, 340], [110, 350], [100, 462]], back: [[296, 458], [312, 400], [300, 340], [280, 296]],
      stack: { x: 24, y: 462, w: 168, h: 118, n: 8 }, odds: { x: 214, y: 470, w: 124 }, ctx: { x: 18, y: 438, w: 330 }, net: [190, 322], slow: [190, 342] }
  };
  const L = sim => sim.narrow ? LAY.narrow : LAY.wide;

  // ---------- one message's timeline ----------
  function send(s, key) {
    const own = key === "own", [prompt, reply] = own ? [s.own || "Hello", OWN] : PROMPTS[key];
    const m = { key, own, prompt, reply, inT: tokenize(prompt), outT: tokenize(reply), t0: s.t };
    m.tOut = m.t0 + T_SPLIT; m.tRead = m.tOut + T_OUT; m.tW = m.tRead + T_READ;
    m.tEnd = m.tW + m.outT.length * GEN + T_BACK;
    s.m = m; s.sends++; s.doneAt = null;
  }
  const chosenAt = (m, j) => m.tW + (j + 1) * GEN;
  const landAt = (m, j) => chosenAt(m, j) + T_BACK;
  const written = (m, t) => Math.max(0, Math.min(m.outT.length, Math.floor((t - m.tW) / GEN)));
  const landed = (m, t) => Math.max(0, Math.min(m.outT.length, Math.floor((t - m.tW - T_BACK) / GEN)));
  const phase = (m, t) => !m ? "none" : t < m.tOut ? "split" : t < m.tRead ? "out" : t < m.tW ? "read" : landed(m, t) < m.outT.length ? "write" : "done";
  const depart = (m, i) => m.tOut + i * (T_OUT - FLY) / Math.max(1, m.inT.length - 1);

  function init() { return { t: 0, m: null, sends: 0, auto: true, own: "", nums: false, numsAt: -9, key: "sky", cyc: false, ready: false, doneAt: null }; }
  function step(s, dt, sim) {
    s.t += dt;
    if (!s.m) send(s, s.key);
    if (phase(s.m, s.t) === "done" && s.doneAt == null) s.doneAt = s.t;
    if (s.auto && s.doneAt != null && s.t - s.doneAt > IDLE) { const nx = ORDER[(ORDER.indexOf(s.key) + 1) % ORDER.length]; s.cyc = true; sim.set("prompt", nx); s.cyc = false; }
  }

  // ---------- drawing ----------
  function wrap(k, text, size, maxW, mono) { const c = k.ctx; c.save(); font(c, size, mono ? "--f-mono" : "--f-display", "400"); const ls = wrapLines(c, text, maxW); const w = Math.max(...ls.map(l => c.measureText(l).width)); c.restore(); return { ls, w }; }
  function chipLayout(k, s, Y, x0, x1, toks) {
    const fs = Y.chipFs, c = k.ctx; c.save(); font(c, fs, "--f-mono", "500");
    const out = []; let x = x0, y = 0; const h = fs + 10;
    toks.forEach((t, i) => { const lab = s.nums ? String(tokId(t)) : show(t); const w = c.measureText(lab).width + 12; if (x + w > x1 && x > x0) { x = x0; y += h + 6; } out.push({ x, y, w, h, lab }); x += w + 5; });
    c.restore(); return { chips: out, h: out.length ? out[out.length - 1].y + h : 0 };
  }
  function draw(k, s, sim) {
    const C = k.C, Y = L(sim), m = s.m, t = s.t, ph = phase(m, t);
    if (!m) return;
    const nIn = m.inT.length, nOut = m.outT.length, wr = written(m, t), ld = landed(m, t);
    const out = u => bez(Y.out, u), back = u => bez(Y.back, u);

    // the internet: two fibres, with other people's traffic as faint dots
    k.curve(Y.out, { col: C.line, lw: 1.5, dash: [4, 6] }); k.curve(Y.back, { col: C.line, lw: 1.5, dash: [4, 6] });
    const amb = sim.narrow ? [[[400, 404], [330, 420], [260, 470], [230, 520]]] : [[[470, 0], [560, 40], [600, 60], [700, 30]], [[440, 420], [520, 360], [590, 380], [640, 330]]];
    amb.forEach((p, i) => k.flow(u => bez(p, u), 3, t * 0.12 + i * 0.4, C.muted, { alpha: 0.35, size: 2, glow: 0 }));
    k.label(Y.net[0], Y.net[1], "the internet", { col: C.muted, size: 11 });

    // ---------- your screen ----------
    const ch = Y.chat, fs = Y.fs;
    k.box(ch.x, ch.y, ch.w, ch.h, { fill: C.bg2, stroke: C.line, r: 16 });
    k.text(ch.x + 18, ch.y + 22, "Your screen", { align: "left", col: C.muted, size: Y.sm + 0.5, weight: "600" });
    // your message
    const mw = wrap(k, m.prompt, fs, ch.w * 0.72), lh = fs * 1.35, bw = mw.w + 24, bh = mw.ls.length * lh + 16, bx = ch.x + ch.w - 16 - bw, by = ch.y + 40;
    k.box(bx, by, bw, bh, { fill: C.sig, alpha: 0.16, r: 12 }); k.box(bx, by, bw, bh, { stroke: C.sig, alpha: 0.6, r: 12 });
    mw.ls.forEach((l, i) => k.text(bx + 12, by + 8 + lh * (i + 0.5), l, { align: "left", size: fs, col: C.ink }));
    // as tokens
    const ty = by + bh + 30, cl = chipLayout(k, s, Y, ch.x + 18, ch.x + ch.w - 16, m.inT);
    k.text(ch.x + 18, ty - 12, s.nums ? "as the numbers the model receives (made-up IDs)" : `as ${nIn} tokens`, { align: "left", col: C.muted, size: Y.sm });
    const chipAt = i => { const c = cl.chips[i]; return [c.x + c.w / 2, ty + c.y + c.h / 2]; };
    cl.chips.forEach((c, i) => {
      const appear = clamp01((t - m.t0 - T_SPLIT * 0.75 * i / Math.max(1, nIn)) / 0.18); if (appear <= 0) return;
      const gone = t > depart(m, i), col = CHIP[i % CHIP.length], a = appear * (gone ? 0.45 : 1);
      k.box(c.x, ty + c.y, c.w, c.h, { fill: col, alpha: 0.16 * a, r: 6 }); k.box(c.x, ty + c.y, c.w, c.h, { stroke: col, alpha: 0.75 * a, r: 6, lw: 1 });
      k.text(c.x + c.w / 2, ty + c.y + c.h / 2 + 0.5, c.lab, { size: Y.chipFs, mono: true, col: C.ink, alpha: a });
    });
    // the reply
    const ry = ty + cl.h + 32, txt = m.outT.slice(0, ld).join("").trim(), rw = ch.w - 48;
    const rl = wrap(k, txt || " ", fs, rw).ls, rbh = Math.max(1, rl.length) * lh + 16, writing = ph === "write" || (ph !== "done" && ld > 0);
    if (ph === "write" || ph === "done" || ph === "read") {
      k.box(ch.x + 16, ry, rw + 20, rbh, { fill: C.bg, stroke: writing ? C.sig : C.line, r: 12, alpha: 0.9 });
      if (txt) rl.forEach((l, i) => k.text(ch.x + 28, ry + 8 + lh * (i + 0.5), l, { align: "left", size: fs, col: C.ink }));
      if (ph !== "done" && Math.floor(t * 2.5) % 2 === 0) { const c = k.ctx; c.save(); font(c, fs, "--f-display", "400"); const lw = txt ? c.measureText(rl[rl.length - 1]).width : 0; c.restore(); k.box(ch.x + 30 + lw, ry + 8 + lh * (rl.length - 1) + 3, 2.5, lh - 6, { fill: C.sig, r: 1 }); }
      k.text(ch.x + 18, ry - 12, ph === "read" ? "reply: waiting for the first token" : ph === "done" ? `reply · ${nOut} tokens` : `reply · ${ld} of ${nOut} tokens`, { align: "left", col: C.muted, size: Y.sm });
    }

    // ---------- the GPU ----------
    const g = Y.gpu, st = Y.stack, busy = ph === "read" || (ph === "write" && wr < nOut);
    k.box(g.x, g.y, g.w, g.h, { fill: C.bg2, stroke: busy ? C.sig : C.line, r: 16, glow: busy ? 14 : 0, glowCol: C.sig });
    k.text(g.x + 18, g.y + 22, "A GPU in a datacenter", { align: "left", col: C.muted, size: Y.sm + 0.5, weight: "600" });
    // tokens in play
    const cx = Y.ctx, arrived = m.inT.filter((_, i) => t >= depart(m, i) + FLY).length, total = arrived + wr, dx = Math.min(9, (cx.w - 10) / Math.max(1, nIn + nOut));
    k.text(cx.x + 4, cx.y - 14, `tokens in play · ${arrived} read + ${wr} written`, { align: "left", col: C.muted, size: Y.sm });
    for (let i = 0; i < total; i++) k.dot(cx.x + 8 + i * dx, cx.y, Math.min(3, dx * 0.38), i < arrived ? C.sig : C.ink, { alpha: i < arrived ? 0.9 : 0.75 });
    // layers
    const bwid = 14, gap = (st.w - bwid) / (st.n - 1), barX = j => st.x + j * gap;
    k.text(st.x, st.y + st.h + 14, "the model's layers", { align: "left", col: C.muted, size: Y.sm });
    let waveX = null, single = null;
    if (ph === "read") waveX = st.x - 10 + easeIO((t - m.tRead) / T_READ) * (st.w + 20);
    if (ph === "write" && wr < nOut) single = st.x - 4 + ((t - m.tW) / GEN - wr) * (st.w + 8);
    for (let j = 0; j < st.n; j++) {
      const x = barX(j), near = v => v == null ? 0 : Math.exp(-Math.pow((x + bwid / 2 - v) / 26, 2));
      const heat = Math.max(near(waveX), 0.7 * near(single));
      k.box(x, st.y, bwid, st.h, { fill: C.bg, stroke: C.line, r: 5, lw: 1 });
      if (heat > 0.02) k.box(x, st.y, bwid, st.h, { fill: C.amb, alpha: 0.85 * heat, r: 5, glow: 16 * heat, glowCol: C.amb });
    }
    if (waveX != null) { const n = Math.min(nIn, 14), sp = (st.h - 24) / Math.max(1, n - 1); for (let i = 0; i < n; i++) k.dot(waveX, st.y + 12 + i * sp, k.px(3.2), C.sig, { glow: 10 }); }
    if (single != null) { k.dot(single, st.y + st.h / 2, k.px(4.2), C.ink, { glow: 12 }); }
    // next-token odds
    const od = Y.odds, last = wr - 1;
    k.text(od.x, od.y - 14 + (sim.narrow ? 0 : 0), "next-token odds", { align: "left", col: C.muted, size: Y.sm });
    if (last >= 0 && ph !== "done") {
      const tok = m.outT[last], alts = POOL.filter(w => w.trim() !== tok.trim()), a1 = alts[hash(tok + last) % alts.length], a2 = alts.filter(w => w !== a1)[hash(tok) % (alts.length - 1)];
      const p1 = 0.5 + 0.42 * frac(tok, last), p2 = (1 - p1) * (0.45 + 0.3 * frac(a1, last)), p3 = (1 - p1 - p2) * 0.5;
      const rows = [[tok, p1, true], [a1, p2], [a2, p3]];
      const fresh = clamp01((t - chosenAt(m, last)) / 0.12), rh = sim.narrow ? 34 : 36;
      rows.forEach(([w, p, pick], i) => {
        const y = od.y + i * rh; k.text(od.x, y + 6, show(w).slice(0, 9), { align: "left", size: Y.sm + 0.5, mono: true, col: pick ? C.ink : C.muted });
        k.text(od.x + od.w, y + 6, Math.round(p * 100) + "%", { align: "right", size: Y.sm - 0.5, mono: true, col: pick ? C.sig : C.muted });
        k.box(od.x, y + 16, od.w, 5, { fill: C.line, r: 2.5 }); k.box(od.x, y + 16, od.w * p * fresh, 5, { fill: pick ? C.sig : C.muted, r: 2.5, glow: pick ? 8 : 0 });
      });
      k.text(od.x, od.y + 3 * rh + 8, "picked: " + show(tok).slice(0, 9), { align: "left", size: Y.sm, col: C.sig, weight: "600" });
    } else if (ph === "done") k.text(od.x, od.y + 8, "reply finished", { align: "left", size: Y.sm, col: C.muted });
    else k.text(od.x, od.y + 8, "waiting", { align: "left", size: Y.sm, col: C.muted });

    // ---------- flights ----------
    if (ph === "split" || ph === "out" || ph === "read") m.inT.forEach((tk, i) => {
      const d = depart(m, i), u = (t - d) / FLY; if (u <= 0 || u >= 1) return;
      const [x0, y0] = chipAt(i), e = easeIO(u), p = u < 0.15 ? [lerp(x0, Y.out[0][0], u / 0.15), lerp(y0, Y.out[0][1], u / 0.15)] : out((e - easeIO(0.15)) / (1 - easeIO(0.15)));
      const pts = []; for (let q = 6; q >= 0; q--) { const uu = u - q * 0.025; if (uu > 0.15) pts.push(out((easeIO(uu) - easeIO(0.15)) / (1 - easeIO(0.15)))); }
      k.trail(pts, CHIP[i % CHIP.length], { w: 2.4, alpha: 0.8 }); k.dot(p[0], p[1], k.px(4), CHIP[i % CHIP.length], { glow: 10 });
    });
    for (let j = Math.max(0, ld - 1); j < wr; j++) {
      const u = (t - chosenAt(m, j)) / T_BACK; if (u <= 0 || u >= 1) continue;
      const pts = []; for (let q = 6; q >= 0; q--) { const uu = u - q * 0.02; if (uu > 0) pts.push(back(uu)); }
      k.trail(pts, C.sig, { w: 2.2, alpha: 0.75 }); const [x, y] = back(u); k.dot(x, y, k.px(3.6), C.ink, { glow: 10 });
      if (!sim.narrow || j === wr - 1) k.label(x, y, s.nums ? String(tokId(m.outT[j])) : show(m.outT[j]), { mono: true, size: 11, col: C.ink, bg: true, dy: -14 });
    }
    // slow-motion note
    k.label(Y.slow[0], Y.slow[1], "slow motion · the real trip takes about a second", { col: C.muted, size: 10.5, alpha: 0.8 });
  }

  const chHref = n => { const sec = $(`section.chapter[data-num="${n}"]`); return sec ? "#" + sec.id : "#start"; };
  const sim = makeSim($("#start-sim"), {
    label: "Your message becomes tokens, travels over the internet to a GPU in a datacenter, is read in one pass through the model's layers, and the reply comes back one token at a time. Click the stage to send the next question.",
    cams: { default: { x: 0, y: 0, w: LAY.wide.W, h: LAY.wide.H } },
    camsNarrow: { default: { x: 0, y: 0, w: LAY.narrow.W, h: LAY.narrow.H } },
    height: w => w < 640 ? Math.round(w * 1.72) : Math.round(Math.min(440, Math.max(320, w * 0.4))),
    grid: 40, init, warmup: 1.4, factDelay: 4,
    intro: "Your question is on its way. Pick another, type your own, or click the picture to send the next one.",
    controls: [
      { id: "prompt", label: "Ask", type: "choice", value: "sky", options: [["sky", "Why is the sky blue?"], ["haiku", "A haiku"], ["gpu", "What's a GPU?"]], help: "Or type your own and press Enter.",
        apply: (s, v) => { s.key = v; if (!s.ready) return; if (!s.cyc) s.auto = false; send(s, v); } },
      { id: "nums", label: "Show tokens as numbers", type: "toggle", value: false, help: "What the model really receives: one number per token.", apply: (s, v) => { s.nums = v; s.numsAt = s.t; if (s.ready && v) s.auto = false; } },
      { id: "again", label: "Send again", type: "button", help: "Same message, same journey.", apply: s => { s.auto = false; send(s, s.key); } }
    ],
    step: (s, dt, sim) => { s.ready = true; step(s, dt, sim); },
    draw,
    click: (s, wx, wy, sim) => { s.auto = false; const nx = s.key === "own" ? "sky" : ORDER[(ORDER.indexOf(s.key) + 1) % ORDER.length]; sim.set("prompt", nx); },
    stats: s => { const m = s.m; if (!m) return []; const wr = written(m, s.t), ph = phase(m, s.t);
      return [["tokens in your message", String(m.inT.length), ""],
        ["passes to read them", ph === "split" || ph === "out" ? "–" : "1", ph === "split" || ph === "out" ? "" : "ok"],
        ["tokens written so far", `${wr} / ${m.outT.length}`, ""],
        ["passes to write them", String(wr), wr > 1 ? "hot" : ""]]; },
    notices: [
      { id: "nums", when: s => s.nums && s.t - s.numsAt < 6, say: s => `The model never sees letters. Each token is looked up in a fixed list and replaced by its number, so your message arrives as <b>${s.m.inT.length} numbers</b>. (These IDs are made up.)` },
      { id: "own", when: s => s.m && s.m.own && ["split", "out"].includes(phase(s.m, s.t)), say: s => `Your message became <b>${s.m.inT.length} tokens</b>. Common words are one token each; rarer ones are cut into pieces. <a href="${chHref(2)}">Chapter 2</a> shows how the pieces are chosen.` },
      { id: "split", when: s => s.m && phase(s.m, s.t) === "split", say: s => `Your message is cut into <b>${s.m.inT.length} tokens</b>: words and pieces of words, the units a model reads and writes.` },
      { id: "out", when: s => s.m && phase(s.m, s.t) === "out", say: s => `The ${s.m.inT.length} tokens leave your screen and cross the internet as pulses of light in glass fibre, to a GPU (a chip built for the maths AI needs) in a datacenter.` },
      { id: "read", when: s => s.m && phase(s.m, s.t) === "read", say: s => `The model reads all <b>${s.m.inT.length} tokens at once</b>: one pass through its layers (the amber wave). Reading is fast because it happens in parallel.` },
      { id: "write", when: s => s.m && phase(s.m, s.t) === "write", say: s => { const w = written(s.m, s.t); return `Writing is different: <b>one token per pass</b>. This is token ${Math.min(w + 1, s.m.outT.length)} of ${s.m.outT.length}. Each time, the model scores every possible next token, picks one, and sends it to you the moment it exists. <a href="${chHref(3)}">Chapter 3</a> shows how it picks.`; } },
      { id: "done", when: s => s.m && phase(s.m, s.t) === "done", say: s => `Done: <b>${s.m.inT.length}</b> tokens read in <b>1 pass</b>, <b>${s.m.outT.length}</b> written in <b>${s.m.outT.length} passes</b>. Read, then write: that's the first idea of the course. <a href="${chHref(1)}">Chapter 1</a> opens up the whole machine.` }
    ],
    facts: [
      { id: "vocab", when: s => s.nums, text: "Meta's openly released Llama 3 models use a fixed list of about 128,000 tokens. Everything you type is spelled out from pieces on that list.", ref: "#ref-9" },
      { id: "transformer", when: s => s.sends >= 2 && s.m && phase(s.m, s.t) === "read", text: "The layer design inside today's chat models, the transformer, was introduced in a 2017 paper by Google researchers called “Attention Is All You Need”.", ref: "#ref-5" }
    ],
    tour: [
      { say: "Your message is cut into tokens: words and pieces of words. Watch them appear under your question.", set: { prompt: "sky", nums: false }, min: 0.3, until: s => phase(s.m, s.t) === "out", max: 6 },
      { say: "The tokens cross the internet to a datacenter, where a GPU runs the model.", min: 0.3, until: s => phase(s.m, s.t) === "read", max: 6 },
      { say: "The model reads every token of your message at once, in a single pass through its layers.", min: 0.3, until: s => phase(s.m, s.t) === "write", max: 6 },
      { say: "Now it writes, one token per pass. For each one it weighs the possible next tokens and picks one (top right).", wait: 2.5 },
      { say: "Switch on numbers: this is what really travels and what the model really reads.", set: { nums: true }, wait: 2.5 },
      { say: "Each new token flies straight back, so the reply appears piece by piece, like typing.", set: { nums: false }, until: s => phase(s.m, s.t) === "done", max: 12 }
    ]
  });

  // a text box under "Ask", so you can type your own message
  const ctl = $("#start-sim .sim-controls .sim-choice");
  if (ctl) {
    const inp = document.createElement("input"); inp.type = "text"; inp.id = "start-sim-own"; inp.placeholder = "Type your own message"; inp.setAttribute("aria-label", "Your own message"); inp.maxLength = 60; inp.style.marginTop = "0.35rem";
    ctl.insertBefore(inp, $("small", ctl));
    const go = () => { const v = inp.value.trim(); if (!v) return; const s = sim.state; s.own = v; s.auto = false; sim.set("prompt", "own"); };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  }

  // ---------- course map: questions and links come from the chapters themselves ----------
  const done = store.get("done", {});
  $$("#start .st-map a[data-n]").forEach(a => {
    const sec = $(`section.chapter[data-num="${a.dataset.n}"]`);
    if (!sec) { a.classList.add("soon"); a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); return; }
    a.href = "#" + sec.id; const h = $("h2", sec), q = $(".q-text", a), tt = $(".t-text", a);
    if (h && q) q.textContent = h.textContent.trim(); if (tt && sec.dataset.title) tt.textContent = sec.dataset.title;
    if (done[sec.id]) a.classList.add("done");
  });
  const nextCh = $$("section.chapter[data-num]").find(sec => !done[sec.id]), cont = $("#st-continue");
  if (cont && nextCh && Object.keys(done).length) { cont.href = "#" + nextCh.id; cont.textContent = `Continue: chapter ${nextCh.dataset.num}, ${nextCh.dataset.title}`; }
  $$("#start [data-scroll]").forEach(b => b.addEventListener("click", () => { const el = document.getElementById(b.dataset.scroll); if (el) el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); }));
});
