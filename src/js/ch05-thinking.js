/* Chapter 5 · Thinking models. The learner sets a thinking budget and a number of parallel attempts and feeds
   the model a stream of easy, medium and hard problems. The model is ILLUSTRATIVE: its accuracy curve is shaped
   like published test-time-compute results (accuracy rises with thinking tokens, then flattens; majority vote over
   several attempts lifts it further) but the numbers are made up. Writing speed 150 tokens/s per attempt;
   time on screen runs 20x faster than the "real" seconds reported. Price: $10 per million output tokens (illustrative). */
chapter("thinking", () => {
  const SCALE = 20, SPEED = 150, ANSWER = 120, PRICE = 10 / 1e6;
  const BUDGETS = [0, 1000, 2000, 4000, 8000, 16000, 32000];
  const NS = [1, 4, 8, 16];
  // illustrative single-attempt accuracy: base (no thinking) -> max, rising around 2^c tokens; need = tokens it would like to use
  const DIFF = {
    easy:   { b: 0.80, m: 0.99, c: 7.5,  s: 1.2, need: 300,   dots: 1, name: "easy" },
    medium: { b: 0.35, m: 0.95, c: 9.3,  s: 1.2, need: 1800,  dots: 2, name: "medium" },
    hard:   { b: 0.04, m: 0.86, c: 12.8, s: 1.1, need: 12000, dots: 3, name: "hard" }
  };
  const sig = x => 1 / (1 + Math.exp(-x));
  const pRight = (d, T) => { const P = DIFF[d], x = (Math.log2(T + 1) - P.c) / P.s, x0 = -P.c / P.s; return P.b + (P.m - P.b) * (sig(x) - sig(x0)) / (1 - sig(x0)); };
  const NEEDK = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
  const expected = (d, B) => NEEDK.reduce((a, k) => a + pRight(d, Math.min(B, DIFF[d].need * k)), 0) / NEEDK.length;
  const fmtTok = n => n >= 10000 ? Math.round(n / 1000) + "k" : n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(Math.round(n));
  const fmtMoney = x => x < 0.01 ? "$" + x.toFixed(4) : x < 1 ? "$" + x.toFixed(2) : "$" + x.toFixed(2);
  const fmtS = x => x < 10 ? x.toFixed(1) + " s" : Math.round(x) + " s";

  const BANK = {
    easy: [
      { q: "What is 17 + 25?", a: "42", w: ["32", "43", "52"], th: ["17 + 25.", "7 + 5 = 12, write 2, carry 1.", "1 + 2 + 1 = 4.", "So 42."] },
      { q: "What is half of 86?", a: "43", w: ["42", "44", "33"], th: ["Half of 80 is 40.", "Half of 6 is 3.", "40 + 3 = 43."] },
      { q: "What is 9 × 6?", a: "54", w: ["56", "45", "63"], th: ["9 × 6 is 10 × 6, minus 6.", "60 − 6 = 54."] },
      { q: "What comes next: 3, 6, 9, 12, …?", a: "15", w: ["16", "14", "18"], th: ["Each step adds 3.", "12 + 3 = 15."] }
    ],
    medium: [
      { q: "A shirt costs $40 after 20% off. What did it cost before?", a: "$50", w: ["$48", "$60", "$32"], th: ["Adding 20% of 40 gives 48, but that's the wrong base.", "$40 is 80% of the old price.", "40 ÷ 0.8 = 50."] },
      { q: "A train leaves at 2:45 pm and takes 95 minutes. When does it arrive?", a: "4:20 pm", w: ["3:40 pm", "4:40 pm", "4:15 pm"], th: ["95 minutes is 1 hour 35 minutes.", "2:45 plus 1 hour is 3:45.", "3:45 plus 35 minutes is 4:20."] },
      { q: "What is 1 + 2 + 3 + … + 50?", a: "1,275", w: ["1,250", "2,550", "1,225"], th: ["Pair 1 with 50, 2 with 49, and so on.", "Each pair adds up to 51.", "25 pairs × 51 = 1,275."] },
      { q: "3 pens cost $4.50. What do 7 pens cost?", a: "$10.50", w: ["$10.00", "$9.50", "$11.50"], th: ["One pen: 4.50 ÷ 3 = 1.50.", "7 × 1.50 = 10.50."] }
    ],
    hard: [
      { q: "How many 4-digit numbers have digits that add up to 9?", a: "165", w: ["220", "120", "84"], th: ["The first digit is at least 1. Call it a + 1.", "Then a + b + c + d = 8, each from 0 to 9.", "Count ways to split 8 into 4 parts.", "Choose 3 dividers among 11 spots: C(11, 3).", "C(11, 3) = 165.", "No digit can pass 9 since the total is 8. Good."] },
      { q: "In how many ways can you tile a 2 × 8 strip with 1 × 2 dominoes?", a: "34", w: ["21", "55", "16"], th: ["Small cases: width 1 has 1 way, width 2 has 2.", "The strip ends in one upright domino or two flat ones.", "So ways(n) = ways(n − 1) + ways(n − 2).", "1, 2, 3, 5, 8, 13, 21, 34.", "Width 8 gives 34."] },
      { q: "What is the remainder when 2¹⁰⁰ is divided by 7?", a: "2", w: ["4", "1", "3"], th: ["Powers of 2 divided by 7 leave 2, 4, 1, 2, 4, 1…", "The pattern repeats every 3 steps.", "100 = 3 × 33 + 1.", "So 2¹⁰⁰ leaves the same remainder as 2¹.", "Remainder 2."] },
      { q: "What is the smallest number above 1 that leaves remainder 1 when divided by 2, 3, 4, 5 and 6?", a: "61", w: ["31", "121", "41"], th: ["n − 1 must divide evenly by 2, 3, 4, 5 and 6.", "The smallest such number is 60.", "So n = 61.", "Check 31: 30 isn't divisible by 4, so no."] }
    ]
  };
  const FILL = ["Wait, let me check that again.", "Try a smaller case first.", "Hmm, that can't be right. Back up.", "Let me list the cases.", "Is there a pattern here?", "Double-check the arithmetic.", "Another way to see it:", "Does this satisfy every condition?"];

  function makeAttempt(s, d, prob) {
    const need = DIFF[d].need * (0.6 + 0.9 * s.rand()), B = s.budget, cap = Math.min(B, need), cut = B < need;
    const right = s.rand() < pRight(d, cap);
    const ans = right ? prob.a : (s.rand() < 0.4 ? prob.w[0] : prob.w[1 + Math.floor(s.rand() * (prob.w.length - 1))]);
    // the hidden thinking text this attempt writes: reasoning steps interleaved with self-checks
    const steps = right ? prob.th.slice() : prob.th.slice(0, Math.max(1, Math.floor(prob.th.length / 2)));
    const lines = [];
    const fills = d === "hard" ? 2 : d === "medium" ? 1 : 0;
    steps.forEach((t, i) => { lines.push(t); for (let f = 0; f < fills && i < steps.length - 1; f++) lines.push(FILL[Math.floor(s.rand() * FILL.length)]); });
    lines.push(cut ? `Out of budget. Going with ${ans}.` : `Answer: ${ans}.`);
    return { need, cap, cut, used: 0, done: cap === 0, ans, right, lines };
  }
  function newQuestion(s) {
    fillQueue(s); const d = s.queue.shift(); fillQueue(s);
    const prob = BANK[d][s.bankI[d]++ % BANK[d].length];
    const atts = []; for (let i = 0; i < s.n; i++) atts.push(makeAttempt(s, d, prob));
    s.cur = { d: d, prob, atts, phase: "think", real: 0, ansK: 0, hold: 0, budget: s.budget, n: s.n, key: key(s) };
  }
  const key = s => s.budget + "/" + s.n;
  function fillQueue(s) {
    while (s.queue.length < 6) {
      const r = s.rand();
      s.queue.push(s.mix === "easy" ? "easy" : s.mix === "hard" ? "hard" : r < 0.34 ? "easy" : r < 0.67 ? "medium" : "hard");
    }
  }
  function vote(c) {
    const t = {}; c.atts.forEach(a => { t[a.ans] = (t[a.ans] || 0) + 1; });
    const rows = Object.entries(t).sort((a, b) => b[1] - a[1]);
    return { rows, winner: rows[0][0], right: rows[0][0] === c.prob.a };
  }

  function init(rand) {
    return { rand, queue: [], bankI: { easy: 0, medium: 0, hard: 0 }, cur: null, results: [], done: 0, t: 0, budget: 2000, n: 1, mix: "mixed", lastSplit: null };
  }
  function restart(s) { // settings changed: requeue a fresh question with the new settings
    s.queue = []; fillQueue(s); s.cur = null;
  }

  function step(s, dt) {
    s.t += dt;
    if (!s.cur) newQuestion(s);
    const c = s.cur, rdt = dt * SCALE;
    if (c.phase === "think") {
      c.real += rdt;
      let all = true;
      c.atts.forEach(a => { if (a.done) return; a.used = Math.min(a.cap, a.used + SPEED * rdt); if (a.used >= a.cap) a.done = true; else all = false; });
      if (all) { c.phase = "answer"; c.thinkReal = Math.max(0, ...c.atts.map(a => a.cap)) / SPEED; c.v = vote(c); }
    } else if (c.phase === "answer") {
      c.ansK += dt / 0.7; // shown over 0.7 screen-seconds; counted as ANSWER tokens of real time
      if (c.ansK >= 1) {
        c.ansK = 1; c.phase = "show";
        const wait = c.thinkReal + ANSWER / SPEED, tok = c.atts.reduce((a, x) => a + x.cap, 0) + ANSWER;
        s.results.push({ d: c.d, right: c.v.right, wait, tok, key: c.key, ans: c.v.winner, q: c.prob.q, n: c.n });
        if (s.results.length > 400) s.results.shift();
        s.done++;
        if (c.n > 1 && c.v.rows.length > 1) s.lastSplit = { t: s.t, rows: c.v.rows, right: c.v.right, a: c.prob.a, n: c.n };
      }
    } else if (c.phase === "show") {
      c.hold += dt; if (c.hold > 1.1) newQuestion(s);
    }
  }

  // ---------- measures over the current setup ----------
  const cur = s => s.results.filter(r => r.key === key(s));
  function measure(s, d, n = 10) {
    const r = cur(s).filter(x => !d || x.d === d).slice(-n);
    if (!r.length) return { n: 0, right: 0, acc: 0, wait: 0, tok: 0 };
    const right = r.filter(x => x.right).length;
    return { n: r.length, right, acc: right / r.length, wait: r.reduce((a, x) => a + x.wait, 0) / r.length, tok: r.reduce((a, x) => a + x.tok, 0) / r.length };
  }
  const costPerQ = s => { const m = measure(s, null, 20); return m.n ? m.tok * PRICE : null; };

  // ---------- vote curves for the chart (seeded Monte Carlo, computed once) ----------
  const voteCurve = {};
  (function () {
    const r = rng(11);
    NS.forEach(n => { voteCurve[n] = BUDGETS.map(B => { let ok = 0; const T = 500; for (let t = 0; t < T; t++) { const v = {}; for (let i = 0; i < n; i++) { const cap = Math.min(B, DIFF.hard.need * (0.6 + 0.9 * r())); const a = r() < pRight("hard", cap) ? "R" : r() < 0.4 ? "W" : "w" + Math.floor(r() * 3); v[a] = (v[a] || 0) + 1; } const best = Object.entries(v).sort((a, b) => b[1] - a[1] || (a[0] === "R" ? -1 : 1) * (r() < 0.5 ? 1 : -1))[0][0]; if (best === "R") ok++; } return ok / T; }); });
  })();

  // ---------- drawing ----------
  function layout(narrow) {
    if (!narrow) return { narrow, Q: { x: 10, y: 30, w: 190 }, M: { x: 225, y: 10, w: 640, h: 610 }, CH: { x: 935, y: 62, w: 300, h: 220 }, R: { x: 895, y: 360, w: 355 } };
    return { narrow, Q: null, M: { x: 5, y: 5, w: 550, h: 480 }, CH: { x: 52, y: 545, w: 470, h: 140 }, R: null };
  }
  const DIFFCOL = C => ({ easy: C.muted, medium: C.ink, hard: C.sig });
  function dots(k, x, y, d, C, r = 4) { for (let i = 0; i < 3; i++) k.dot(x + i * r * 2.6, y, r, i < DIFF[d].dots ? C.amb : C.line); }

  function drawQueue(k, s, L, C) {
    const Q = L.Q; if (!Q) return;
    k.label(Q.x, Q.y, "Next questions", { align: "left", col: C.ink, weight: "600", size: 13 });
    s.queue.slice(0, 6).forEach((d, i) => {
      const y = Q.y + 24 + i * 76;
      k.box(Q.x, y, Q.w, 60, { fill: C.bg2, stroke: C.line, r: 10, alpha: 1 - i * 0.12 });
      dots(k, Q.x + 18, y + 20, d, C, 5);
      k.label(Q.x + 56, y + 20, DIFF[d].name, { align: "left", col: C.muted, size: 12, alpha: 1 - i * 0.12 });
      k.label(Q.x + 18, y + 42, i === 0 ? "up next" : "waiting", { align: "left", col: C.muted, size: 11, alpha: 0.7 - i * 0.08 });
    });
    k.line(Q.x + Q.w + 14, Q.y + 30, L.M.x - 6, Q.y + 50, { col: C.line, dash: [3, 5] });
    // results feed (right column, under chart)
    const R = L.R; if (!R) return;
    k.label(R.x, R.y, `Finished · ${s.done}`, { align: "left", col: C.ink, weight: "600", size: 13 });
    s.results.slice(-6).reverse().forEach((r, i) => {
      const y = R.y + 26 + i * 40, a = 1 - i * 0.1;
      k.box(R.x, y - 15, R.w, 32, { fill: C.bg2, stroke: r.right ? C.ok : C.crit, r: 8, alpha: a * 0.9, lw: 1 });
      dots(k, R.x + 14, y + 1, r.d, C, 3.5);
      k.label(R.x + 48, y + 1, r.right ? "right" : "wrong", { align: "left", col: r.right ? C.ok : C.crit, size: 12, weight: "600", alpha: a });
      k.label(R.x + 118, y + 1, `${fmtS(r.wait)}`, { align: "left", col: C.ink, size: 12, mono: true, alpha: a });
      k.label(R.x + R.w - 12, y + 1, `${fmtTok(r.tok)} tok${r.n > 1 ? " ×" + r.n : ""}`.replace(/ ×\d+$/, m => r.n > 1 ? " total" : ""), { align: "right", col: C.muted, size: 12, mono: true, alpha: a });
    });
  }

  function drawModel(k, s, L, C) {
    const M = L.M, c = s.cur; if (!c) return;
    const narrow = L.narrow;
    k.box(M.x, M.y, M.w, M.h, { stroke: C.line, r: 16, fill: C.bg2, alpha: 0.35 });
    // question
    dots(k, M.x + 22, M.y + 26, c.d, C, 5);
    k.label(M.x + 58, M.y + 26, `${DIFF[c.d].name} question`, { align: "left", col: C.muted, size: 12 });
    k.para(M.x + 22, M.y + 44, c.prob.q, M.w - 44, { size: narrow ? 24 : 21, weight: "500", maxLines: 2, col: C.ink });
    const top = M.y + (narrow ? 122 : 122);
    // thinking lanes
    const n = c.atts.length, B = c.budget, x0 = M.x + 22, x1 = M.x + M.w - (n > 1 ? 120 : 22);
    k.label(x0, top - 6, B ? (narrow ? `Hidden thinking · ${fmtTok(B)} budget${n > 1 ? ` · ${n} tries` : ""}` : `Hidden thinking · budget ${fmtTok(B)} tokens${n > 1 ? ` · ${n} attempts side by side` : ""}`) : (narrow ? "Thinking off" : "Thinking off · the model must answer straight away"), { align: "left", col: C.muted, size: narrow ? 12 : 12.5, weight: "600" });
    const laneTop = top + 14, laneArea = narrow ? 200 : 320, lh = n === 1 ? 30 : Math.min(36, laneArea / n), bh = Math.max(7, lh * 0.62);
    c.atts.forEach((a, i) => {
      const y = laneTop + i * lh, w = x1 - x0;
      k.box(x0, y, w, bh, { fill: C.line, r: bh / 2, alpha: 0.35 });
      if (B > 0) {
        const fw = w * a.used / B;
        if (fw > 1) {
          k.box(x0, y, fw, bh, { fill: C.muted, r: bh / 2, alpha: 0.75, glow: a.done ? 0 : 10, glowCol: C.amb });
          // token stripes: each tick ≈ 500 tokens
          if (bh > 9) for (let t = 500; t < a.used; t += 500) k.line(x0 + w * t / B, y + 2, x0 + w * t / B, y + bh - 2, { col: C.bg, lw: 1, alpha: 0.5 });
          if (!a.done) k.dot(x0 + fw, y + bh / 2, Math.max(3, bh * 0.35), C.amb, { glow: 14 });
        }
        if (a.cut && a.done) k.line(x1, y - 2, x1, y + bh + 2, { col: C.amb, lw: 2.5 });
        if (n === 1) k.label(x0 + Math.max(w * a.used / B, 0) + 8, y + bh / 2, `${fmtTok(a.used)} hidden tokens${narrow ? "" : a.done && a.cut ? " · hit the budget" : a.done ? " · done" : ""}`, { align: "left", col: C.ink, size: 12, mono: true, bg: true });
      }
      if (n > 1 && a.done) {
        const show = c.phase !== "think";
        k.box(x1 + 12, y - 1, 90, bh + 2, { fill: show ? (a.right ? C.ok : C.crit) : C.muted, r: 5, alpha: show ? 0.85 : 0.5 });
        if (lh >= 16) k.label(x1 + 57, y + bh / 2, a.ans, { col: C.bg, size: narrow ? 11 : Math.min(12, lh * 0.6), weight: "700", mono: true });
      }
    });
    let y = laneTop + (n === 1 ? 46 : n * lh + 10);
    // the hidden text of attempt 1 (only when there is room)
    if (n === 1 && B > 0) {
      const a = c.atts[0], H = narrow ? 190 : 280;
      k.box(x0, y, x1 - x0, H, { stroke: C.line, r: 10, dash: [4, 4], fill: C.bg, alpha: 0.6 });
      k.label(x0 + 12, y + 14, narrow ? "Its hidden working-out" : "What it writes to itself (normally hidden or summarised)", { align: "left", col: C.muted, size: 11.5 });
      const shown = a.lines.filter((_, i) => a.used >= a.need * (i + 1) / a.lines.length || (a.done && i === a.lines.length - 1));
      const last = shown.slice(-(narrow ? 4 : 6));
      last.forEach((t, i) => k.text(x0 + 16, y + (narrow ? 50 : 48) + i * (narrow ? 38 : 38), t, { align: "left", size: narrow ? 20 : 20, serif: true, col: C.ink, alpha: 0.35 + 0.65 * (i + 1) / last.length }));
      y += H + 14;
    } else if (n === 1) { y += 4; }
    // vote
    if (n > 1) {
      const vr = c.phase !== "think" ? c.v.rows : null;
      k.label(x0, y + 8, vr ? "Vote: the most common answer wins" : "Waiting for every attempt to finish…", { align: "left", col: C.muted, size: 12, weight: "600" });
      if (vr) vr.slice(0, 4).forEach(([ans, cnt], i) => {
        const bx = x0 + i * (narrow ? 125 : 150), yy = y + 26;
        if (narrow && i > 3) return;
        k.box(bx, yy, Math.max(10, 7 * cnt), 18, { fill: ans === c.prob.a ? C.ok : C.crit, r: 4, alpha: i === 0 ? 0.95 : 0.55 });
        k.label(bx + Math.max(10, 7 * cnt) + 6, yy + 9, `${ans} ×${cnt}`, { align: "left", col: C.ink, size: 12, mono: true });
      });
    }
    // visible answer
    const A = { x: x0, y: M.y + M.h - (narrow ? 84 : 84), w: x1 - x0 + (n > 1 ? 102 : 0), h: narrow ? 70 : 68 };
    const ans = c.v ? c.v.winner : "";
    const words = ["The", " answer", " is", " " + ans, "."];
    const kk = c.phase === "think" ? 0 : c.ansK;
    k.box(A.x, A.y, A.w, A.h, { stroke: kk > 0 ? C.sig : C.line, r: 12, glow: kk > 0 && kk < 1 ? 12 : 0, fill: C.bg, alpha: 0.9 });
    k.label(A.x + 12, A.y + 13, "Visible answer · what you see", { align: "left", col: kk > 0 ? C.sig : C.muted, size: 11.5, weight: "600" });
    if (kk > 0) {
      const nW = Math.ceil(kk * words.length);
      k.text(A.x + 14, A.y + A.h * 0.64, words.slice(0, nW).join(""), { align: "left", size: narrow ? 22 : 21, col: C.sig, weight: "600" });
      if (c.phase === "show") {
        const ok = c.v.right; k.box(A.x + A.w - 96, A.y + A.h / 2 - 14, 84, 28, { fill: ok ? C.ok : C.crit, r: 14, alpha: 0.9 });
        k.label(A.x + A.w - 54, A.y + A.h / 2, ok ? "right" : "wrong", { col: C.bg, weight: "700", size: 12 });
      }
    } else k.text(A.x + 14, A.y + A.h * 0.64, B ? "…thinking" : "…", { align: "left", size: narrow ? 20 : 19, col: C.muted, alpha: 0.6 + 0.4 * Math.sin(s.t * 5) });
    // timer
    const realNow = c.phase === "think" ? c.real : c.thinkReal + (ANSWER / SPEED) * c.ansK;
    if (!narrow) k.label(M.x + M.w - 18, M.y + 26, `time to answer ${fmtS(realNow)}`, { align: "right", col: realNow > 60 ? C.crit : C.amb, size: 12.5, mono: true, weight: "600" });
    else k.label(M.x + M.w - 18, M.y + 26, fmtS(realNow), { align: "right", col: realNow > 60 ? C.crit : C.amb, size: 12, mono: true, weight: "600" });
  }

  function chartX(CH, u) { return CH.x + CH.w * u / (BUDGETS.length - 1); }
  function drawChart(k, s, L, C) {
    const CH = L.CH, cols = DIFFCOL(C), yOf = p => CH.y + CH.h * (1 - p);
    k.label(CH.x - (L.narrow ? 40 : 0), CH.y - 22, L.narrow ? "Accuracy vs budget · illustrative" : "Accuracy vs thinking budget · illustrative", { align: "left", col: C.ink, size: 12.5, weight: "600" });
    [0, 0.5, 0.8, 1].forEach(p => { k.line(CH.x, yOf(p), CH.x + CH.w, yOf(p), { col: C.line, lw: 1, dash: p === 0.8 ? [4, 4] : null, alpha: p === 0.8 ? 1 : 0.6 }); k.label(CH.x - 8, yOf(p), Math.round(p * 100) + "%", { align: "right", col: C.muted, size: 10.5, mono: true }); });
    BUDGETS.forEach((b, i) => k.label(chartX(CH, i), CH.y + CH.h + 14, b ? fmtTok(b) : "off", { col: i === BUDGETS.indexOf(s.budget) ? C.ink : C.muted, size: 10.5, mono: true }));
    if (!L.narrow) k.label(CH.x + CH.w / 2, CH.y + CH.h + 32, "thinking budget (tokens); click to set", { col: C.muted, size: 10.5 });
    const bi = BUDGETS.indexOf(s.budget);
    k.line(chartX(CH, bi), CH.y - 4, chartX(CH, bi), CH.y + CH.h, { col: C.amb, lw: 1.5, alpha: 0.8 });
    ["easy", "medium", "hard"].forEach(d => {
      const pts = []; for (let u = 0; u <= 6.001; u += 0.1) { const B = u < 1 ? u * 1000 : 1000 * Math.pow(2, u - 1); pts.push([chartX(CH, u), yOf(expected(d, B))]); }
      const c = k.ctx; c.save(); c.strokeStyle = cols[d]; c.lineWidth = k.px(2); c.globalAlpha = d === "medium" ? 0.7 : 1; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.stroke(); c.restore();
      const lu = d === "easy" ? 1.3 : d === "medium" ? 3.6 : 6, lb = lu < 1 ? lu * 1000 : 1000 * Math.pow(2, lu - 1);
      k.label(chartX(CH, lu) - 2, yOf(expected(d, lb)) + (d === "medium" ? 11 : -10), d, { align: "right", col: cols[d], size: 11, bg: true });
    });
    if (s.n > 1) {
      const vc = voteCurve[s.n]; const c = k.ctx; c.save(); c.strokeStyle = C.sig; c.lineWidth = k.px(2); c.setLineDash([k.px(5), k.px(4)]); c.beginPath(); vc.forEach((p, i) => i ? c.lineTo(chartX(CH, i), yOf(p)) : c.moveTo(chartX(CH, i), yOf(p))); c.stroke(); c.restore();
      k.label(chartX(CH, 3), yOf(vc[3]) - 14, `hard, best of ${s.n} by vote`, { col: C.sig, size: 11, bg: true });
    }
    // what you measured with this setup
    ["easy", "medium", "hard"].forEach(d => { const m = measure(s, d, 10); if (m.n >= 2) k.dot(chartX(CH, bi), yOf(m.acc), 6, cols[d], { glow: 12 }); });
  }

  function draw(k, s, sim) {
    const C = k.C, L = layout(sim.narrow);
    drawQueue(k, s, L, C); drawModel(k, s, L, C); drawChart(k, s, L, C);
  }

  const sim = makeSim($("#think-sim"), {
    label: "Thinking model simulation. Questions arrive on the left. The model writes hidden thinking tokens (grey bars) before its visible answer. With several attempts, the answers are put to a vote. A chart on the right shows accuracy against thinking budget. Time runs 20 times faster than the seconds shown.",
    cams: { default: { x: 0, y: 0, w: 1260, h: 630 } },
    camsNarrow: { default: { x: 0, y: 0, w: 560, h: 720 } },
    height: w => w < 640 ? Math.round(w * 1.3) : Math.round(Math.min(580, Math.max(380, w * 0.5))),
    init, warmup: 6, seed: 5,
    intro: "Questions flow in from the left. Grey bars are hidden thinking tokens; the teal box is the answer you'd see. Try a bigger budget, or more attempts.",
    controls: [
      { id: "budget", label: "Thinking budget (hidden tokens per attempt)", type: "range", min: 0, max: 6, step: 1, value: 2, fmt: i => BUDGETS[i] ? fmtTok(BUDGETS[i]) + " tokens" : "off", help: "The most it may write before it must answer.", apply: (s, i) => { const ch = s.budget !== BUDGETS[i]; s.budget = BUDGETS[i]; if (ch && s.cur) restart(s); } },
      { id: "n", label: "Attempts in parallel, then a vote", type: "choice", value: 1, options: NS.map(n => [n, String(n)]), help: "Each attempt thinks on its own; the most common answer wins.", apply: (s, v) => { const ch = s.n !== v; s.n = v; if (ch && s.cur) restart(s); } },
      { id: "mix", label: "Questions", type: "choice", value: "mixed", options: [["easy", "Easy"], ["mixed", "Mixed"], ["hard", "Hard"]], apply: (s, v) => { const ch = s.mix !== v; s.mix = v; if (ch && s.cur) restart(s); } }
    ],
    step, draw,
    click: (s, wx, wy, sim) => { const L = layout(sim.narrow), CH = L.CH; if (wx > CH.x - 30 && wx < CH.x + CH.w + 30 && wy > CH.y - 20 && wy < CH.y + CH.h + 40) { const i = Math.max(0, Math.min(6, Math.round((wx - CH.x) / CH.w * 6))); sim.set("budget", i); } },
    stats: s => {
      const h = measure(s, "hard"), all = measure(s, null, 20), cost = costPerQ(s);
      return [
        ["hard right · last 10", h.n ? `${h.right} / ${h.n}` : "–", h.n >= 5 ? (h.acc >= 0.8 ? "ok" : h.acc < 0.5 ? "bad" : "") : ""],
        ["wait on hard ones", h.n ? fmtS(h.wait) : "–", h.n ? (h.wait <= 60 ? "ok" : "hot") : ""],
        ["tokens per question", all.n ? fmtTok(all.tok) : "–"],
        ["cost per question · illustrative", cost == null ? "–" : fmtMoney(cost), cost != null && cost > 0.2 ? "hot" : ""]
      ];
    },
    goal: { text: "get 8 of the last 10 hard problems right, with hard ones answered in under 60 s on average", check: s => { const h = measure(s, "hard"); return { done: h.n >= 10 && h.right >= 8 && h.wait < 60, progress: h.n ? `${h.right} / ${h.n} right · ${fmtS(h.wait)}` : "no hard ones yet" }; } },
    notices: [
      { id: "split", when: s => s.lastSplit && s.t - s.lastSplit.t < 2.5, say: s => { const v = s.lastSplit; const parts = v.rows.slice(0, 3).map(([a, n]) => `${n} said ${a}`).join(", "); return `The ${v.n} attempts disagreed: ${parts}. ${v.right ? "Right answers tend to agree while wrong ones scatter, so the most common answer won" : "This time a wrong answer was most common, which happens when the attempts are weak"}. That's why voting beats a single attempt on average.`; } },
      { id: "nothink", when: s => s.budget === 0 && measure(s, "hard").n >= 2, say: s => { const h = measure(s, "hard"); return `With thinking off, the model has to write its answer straight away. Hard problems: <b>${h.right} of ${h.n}</b> right. There's no room to try a case, notice a mistake and back up.`; } },
      { id: "slow", when: s => measure(s, "hard").n >= 2 && measure(s, "hard").wait > 60, say: s => { const h = measure(s, "hard"); return `Hard problems now take <b>${fmtS(h.wait)}</b> each. Hidden tokens are written one at a time, about ${SPEED} a second here, so ${fmtTok(Math.round(h.wait * SPEED))} tokens of thinking means a long wait before the first visible word.`; } },
      { id: "plateau", when: s => s.budget >= 16000 && s.n === 1 && measure(s, "hard").n >= 3, say: s => { const h = cur(s).filter(r => r.d === "hard").slice(-10); const used = h.reduce((a, r) => a + r.tok - ANSWER, 0) / h.length; return `A budget of ${fmtTok(s.budget)} barely helps beyond 8k: the model only used about <b>${fmtTok(used)}</b> tokens on hard problems, because it stops once it's done. Accuracy flattens. To go higher, try several attempts and a vote.`; } },
      { id: "cost", when: s => s.n >= 8 && measure(s, null, 20).n >= 2, say: s => { const m = measure(s, null, 20); return `${s.n} attempts write ${s.n}× the tokens: about <b>${fmtTok(m.tok)}</b> per question, roughly <b>${fmtMoney(m.tok * PRICE)}</b> at the illustrative price, ${Math.round(m.tok / ANSWER)}× a direct answer. The wait barely changes, because the attempts run side by side.`; } },
      { id: "easy", when: s => s.budget >= 4000 && measure(s, "easy").n >= 2, say: s => { const e = cur(s).filter(r => r.d === "easy").slice(-10); const used = e.reduce((a, r) => a + (r.tok - ANSWER) / r.n, 0) / e.length; return `On easy questions the model wrote only about <b>${fmtTok(used)}</b> hidden tokens of its ${fmtTok(s.budget)} budget. A budget is a ceiling, not a target: once it's sure, it answers.`; } },
      { id: "calm", when: () => true, say: s => s.budget ? `Each grey bar is hidden reasoning: about ${SPEED} tokens a second, paid for like any other output. The model only shows you the teal answer at the end.` : "Thinking is off: every answer starts straight away. Raise the budget and watch what changes on the hard questions." }
    ],
    facts: [
      { id: "r1", when: s => s.n >= 4, text: "DeepSeek trained a reasoning model only by rewarding right answers to checkable maths and code problems. On a hard maths contest (AIME 2024) its single-try score rose from 15.6% to 71.0%, and a majority vote over 64 tries lifted it to 86.7%.", ref: "#ref-19" },
      { id: "o1", when: s => s.budget >= 16000 && s.n === 1, text: "OpenAI reported that its first reasoning model, o1, solved 74% of AIME problems with one try each, 83% with a vote over 64 tries, against 12% for GPT-4o, its earlier model that answers without long thinking.", ref: "#ref-501" }
    ],
    tour: [
      { say: "Thinking is off. The model answers each question immediately. Easy ones are fine; watch what happens to the hard ones (three amber dots).", set: { budget: 0, n: 1, mix: "mixed" }, wait: 7 },
      { say: "Now give it up to 2,000 hidden tokens. Grey bars fill before any visible word appears: that's the model working the problem out.", set: { budget: 2 }, wait: 8 },
      { say: "Hard problems only, with a huge 32,000-token budget. Accuracy climbs, but each answer takes over a minute, and the model rarely uses the whole budget.", set: { mix: "hard", budget: 6 }, wait: 12 },
      { say: "Another way to spend compute: 8 attempts of up to 8,000 tokens each, side by side, then a vote.", set: { budget: 4, n: 8 }, wait: 12 },
      { say: "Votes reach accuracy that one attempt can't, with less waiting. The bill grows with every attempt, though: look at the cost per question.", wait: 7 }
    ],
    publish: s => {
      const h = measure(s, "hard"), all = measure(s, null, 20);
      return {
        thkBudget: s.budget ? fmtTok(s.budget) + " tokens" : "no thinking", thkN: String(s.n),
        thkHard: h.n ? `${h.right} of ${h.n}` : "none yet", thkWait: h.n ? fmtS(h.wait) : "–",
        thkTok: all.n ? fmtTok(all.tok) : "–", thkTokRaw: all.n ? Math.round(all.tok).toLocaleString() : "–",
        thkCost: all.n ? fmtMoney(all.tok * PRICE) : "–", thkX: all.n ? Math.round(all.tok / ANSWER) + "×" : "–",
        thkSec: all.n ? Math.round(all.tok / s.n / SPEED) + " s" : "–", thkPerAtt: all.n ? Math.round(all.tok / s.n).toLocaleString() : "–"
      };
    }
  });
});
