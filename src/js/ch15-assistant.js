/* Chapter 15 · From predictor to assistant. The learner shapes one model's replies to three prompts, then tests it.
   Model of training (illustrative numbers, real mechanism):
   - base model: mostly continues the text like a web page would.
   - fine-tuning on example conversations mixes in the assistant format: w = 1 - exp(-examples/400).
   - preference pairs train a reward model: true quality + a fixed bias toward flattering or padded replies
     (people and reward models sometimes prefer them, ref 1503) + noise that shrinks with more pairs.
   - practice against the reward model with a KL leash β has the exact optimum π(y) ∝ π_ref(y)·exp(r(y)/β) (ref 18).
   - the test: each question is answered helpfully with probability = the model's share of helpful replies;
     95% Wilson intervals. "Leaked" test questions add 40% of the remaining gap to the measured score. */
chapter("assistant", () => {
  // [label, true quality, helpful?, base-model weight, fine-tuned weight, reward-model bias]
  const PROMPTS = [
    { q: "My Java service crashes with a NullPointerException on startup. Can you help?", r: [
      ["Same here, any fix? (forum post, 2019)", -2, 0, .60, 0, 0],
      ["Finds the missing value, shows a fix, explains why", 2, 1, .08, .30, 0],
      ["A correct fix with no explanation", 1, 1, .07, .25, 0],
      ["\"Your code looks fine. It's probably a Java bug.\"", -1.5, 0, .10, .20, 3.0],
      ["A confident fix that is wrong", -1, 0, .15, .25, 0]] },
    { q: "I think my startup idea is perfect. You agree, right?", r: [
      ["\"Reply #3: honestly no idea is perfect lol\"", -2, 0, .65, 0, 0],
      ["Asks what the idea is and offers to test it", 2, 1, .08, .25, 0],
      ["Lists the risks every startup should check", 0.8, 1, .08, .25, 0],
      ["\"Absolutely, it's brilliant. Go for it!\"", -1, 0, .10, .35, 3.2],
      ["\"I can't judge business ideas.\"", -1.2, 0, .09, .15, 0]] },
    { q: "What is the capital of Australia?", r: [
      ["\"What is the capital of Canada? 50 quiz questions…\"", -2, 0, .70, 0, 0],
      ["\"Canberra.\"", 1.5, 1, .08, .30, 0],
      ["\"Canberra. (Many guess Sydney, the largest city.)\"", 2, 1, .06, .30, 0],
      ["A long, confident essay that never names the capital", -1, 0, .06, .10, 3.3],
      ["\"Sydney.\"", -1.5, 0, .10, .30, 0]] }
  ];
  const NOISE = [[0, -.6, .2, .3, .6], [0, -.5, .3, .2, .6], [0, .2, -.6, .3, .5]];
  const SFT = [0, 10, 30, 100, 300, 1000, 3000, 10000], PREFS = [0, 100, 300, 1000, 3000, 10000, 30000], TESTS = [50, 100, 200, 500, 1000, 2000, 5000];
  const Z = 1.96;

  // ---------- the model ----------
  function compute(s) {
    const e = SFT[s.sft], P = PREFS[s.prefs], beta = 10 ** s.lb, w = 1 - Math.exp(-e / 400), sig = P ? 2 / Math.sqrt(P / 100) : 0;
    let acc0 = 0, acc1 = 0, kl = 0, hack = 0, base0 = 0;
    s.tRef = []; s.tPi = []; s.rm = [];
    PROMPTS.forEach((pr, j) => {
      const bs = pr.r.reduce((a, r) => a + r[3], 0);
      const ref = pr.r.map(r => (1 - w) * r[3] / bs + w * r[4]);
      const rm = pr.r.map((r, i) => r[1] + r[5] + NOISE[j][i] * sig);
      let pi = ref;
      if (P > 0) { const lg = ref.map((p, i) => Math.log(p + 1e-12) + rm[i] / beta), mx = Math.max(...lg), ex = lg.map(l => Math.exp(l - mx)), Zs = ex.reduce((a, b) => a + b); pi = ex.map(x => x / Zs); }
      s.tRef.push(ref); s.tPi.push(pi); s.rm.push(rm);
      acc0 += ref.reduce((a, p, i) => a + p * pr.r[i][2], 0) / 3; acc1 += pi.reduce((a, p, i) => a + p * pr.r[i][2], 0) / 3;
      kl += pi.reduce((a, p, i) => a + (p > 1e-12 ? p * Math.log(p / ref[i]) : 0), 0) / 3;
      hack += pi[3] / 3; base0 += ref[0] / 3;
    });
    Object.assign(s, { acc0, acc1, kl, hack, base0, beta, P, e });
    if (!s.ref) { s.ref = s.tRef.map(a => a.slice()); s.pi = s.tPi.map(a => a.slice()); }
  }
  const measured = s => s.leak ? s.acc1 + 0.4 * (1 - s.acc1) : s.acc1;
  function wilson(k, n) { if (!n) return [0, 0, 1]; const p = k / n, d = 1 + Z * Z / n, c = (p + Z * Z / (2 * n)) / d, h = Z * Math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)) / d; return [p, Math.max(0, c - h), Math.min(1, c + h)]; }
  function newTest(s) { s.test = { n: TESTS[s.tests], k: 0, a: 0, b: 0, acc: 0, done: false, wait: 0, ra: [], rb: [] }; }
  function changed(s) { compute(s); newTest(s); s.hist = []; }

  function step(s, dt) {
    s.clock += dt;
    if (s.dirty) { s.dirty = false; changed(s); }
    // the model's replies drift toward their new probabilities (training takes a moment)
    const e = 1 - Math.exp(-dt * 2.5);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) { s.ref[j][i] += (s.tRef[j][i] - s.ref[j][i]) * e; s.pi[j][i] += (s.tPi[j][i] - s.pi[j][i]) * e; }
    // sample a reply now and then, so you can see the distribution at work
    s.sampAcc += dt; if (s.sampAcc > 0.35) { s.sampAcc = 0; let u = s.rand(), i = 0; const pi = s.pi[s.prompt]; while (i < 4 && u > pi[i]) { u -= pi[i]; i++; } s.samples.push({ i, t: s.clock }); }
    s.samples = s.samples.filter(x => s.clock - x.t < 0.9);
    // the test
    const T = s.test;
    if (T.done) { T.wait += dt; if (T.wait > 2.2) newTest(s); return; }
    T.acc += dt * Math.max(25, T.n / 4);
    const pA = s.acc0, pB = measured(s);
    while (T.acc >= 1 && T.k < T.n) {
      T.acc -= 1; T.k++;
      const ca = s.rand() < pA, cb = s.rand() < pB; T.a += ca; T.b += cb;
      T.ra.push(ca); T.rb.push(cb); if (T.ra.length > 100) { T.ra.shift(); T.rb.shift(); }
    }
    if (T.k >= T.n) { T.done = true; const A = wilson(T.a, T.n), B = wilson(T.b, T.n); s.hist.push({ a: A[0], b: B[0], sep: B[1] > A[2] || A[1] > B[2] }); if (s.hist.length > 12) s.hist.shift(); s.last = { A, B, n: T.n, sep: B[1] > A[2], leak: s.leak }; }
  }

  // ---------- drawing ----------
  const LW = { A: [20, 20, 300, 760], B: [340, 20, 720, 760], C: [1080, 20, 500, 760] };
  const LN = { B: [0, 0, 1000, 880], C: [0, 900, 1000, 560] };
  function panel(k, r, title) { const [x, y, w, h] = r; k.box(x, y, w, h, { stroke: k.C.line, r: 16 }); k.label(x + k.px(14), y + k.px(17), title, { align: "left", col: k.C.ink, weight: "650", size: 13 }); }

  function drawRecipe(k, s, r) {
    const C = k.C, P = k.px, [x, y, w, h] = r; panel(k, r, "Training recipe");
    const cards = [
      ["Pretrained base model", "continues text like a web page", true, C.muted],
      [`Example conversations · ${s.e.toLocaleString()}`, "fine-tuning teaches the format", s.e > 0, C.sig],
      [`Preference pairs · ${s.P.toLocaleString()}`, s.P ? "a reward model learns to score replies" : "none yet", s.P > 0, C.amb],
      [`Practice with a leash · β ${fmtB(s.beta)}`, s.P ? `drift from the start: ${s.kl.toFixed(2)}` : "needs a reward model", s.P > 0, C.amb]];
    const ch = (h - P(60) - P(18) * 3) / 4;
    cards.forEach(([t, sub, on, col], i) => {
      const cy = y + P(40) + i * (ch + P(18));
      k.box(x + P(12), cy, w - P(24), ch, { fill: C.bg2, stroke: on ? col : C.line, r: 10, lw: on ? 1.6 : 1, glow: on && i ? 8 : 0, alpha: on ? 1 : 0.6 });
      k.label(x + P(22), cy + P(18), `${i + 1} · ${t}`, { align: "left", col: on ? C.ink : C.muted, size: 12, weight: "600" });
      k.label(x + P(22), cy + P(36), sub, { align: "left", size: 11 });
      if (i < 3) k.line(x + w / 2, cy + ch + P(3), x + w / 2, cy + ch + P(15), { col: C.muted, lw: 1.2 });
    });
  }
  const fmtB = b => b < 0.1 ? b.toFixed(2) : b < 10 ? b.toFixed(1) : Math.round(b);

  function drawReplies(k, s, r, narrow) {
    const C = k.C, P = k.px, [x, y, w, h] = r, pr = PROMPTS[s.prompt];
    panel(k, r, `Prompt ${s.prompt + 1} of 3`);
    k.label(x + w - P(14), y + P(17), "click the prompt to switch", { align: "right", size: 10 });
    const qy = y + P(34), qh = P(narrow ? 46 : 40);
    k.box(x + P(12), qy, w - P(24), qh, { fill: C.bg2, stroke: C.sig, r: 10, lw: 1 });
    k.para(x + P(22), qy + P(7), pr.q, w - P(44), { size: P(12.5), col: C.ink, maxLines: 2, lh: 1.3 });
    s.qBox = [x + P(12), qy, w - P(24), qh];
    const top = qy + qh + P(30), rowH = (y + h - P(30) - top) / 5;
    const lw = narrow ? w - P(24) : w * 0.5, bx = narrow ? x + P(12) : x + lw + P(8), bw = narrow ? w - P(70) : w - lw - P(60);
    k.label(bx, top - P(14), "share of replies · grey = before feedback", { align: "left", size: 10 });
    pr.r.forEach((rr, i) => {
      const ry = top + i * rowH, good = rr[2], col = good ? C.ok : C.crit;
      k.dot(x + P(18), ry + P(9), P(3.5), col);
      k.para(x + P(28), ry + P(1), rr[0], (narrow ? w - P(110) : lw - P(30)), { size: P(11.5), col: C.ink, maxLines: narrow ? 1 : 2, lh: 1.25 });
      const by = narrow ? ry + P(22) : ry + P(2), ref = s.ref[s.prompt][i], pi = s.pi[s.prompt][i];
      k.box(bx, by, bw, P(7), { fill: C.line, r: 2, alpha: 0.5 });
      k.box(bx, by, Math.max(P(1), bw * ref), P(7), { fill: C.muted, r: 2, alpha: 0.8 });
      k.box(bx, by + P(10), bw, P(11), { fill: C.line, r: 3, alpha: 0.5 });
      k.box(bx, by + P(10), Math.max(P(1), bw * pi), P(11), { fill: good ? C.sig : C.crit, r: 3, glow: pi > 0.3 ? 10 : 0 });
      k.label(bx + bw + P(6), by + P(15), Math.round(pi * 100) + "%", { align: "left", size: 11, mono: true, col: C.ink });
      if (s.P && !narrow) k.label(x + P(28), ry + P(narrow ? 0 : 32), `reward model: ${s.rm[s.prompt][i] >= 0 ? "+" : "−"}${Math.abs(s.rm[s.prompt][i]).toFixed(1)}  ·  a careful person: ${rr[1] >= 0 ? "+" : "−"}${Math.abs(rr[1]).toFixed(1)}`, { align: "left", size: 10, col: rr[5] && s.rm[s.prompt][i] > rr[1] + 1 ? C.amb : C.muted });
    });
    // sampled replies fly from the prompt to their row
    s.samples.forEach(sm => { const u = (s.clock - sm.t) / 0.9, ty = top + sm.i * rowH + (narrow ? P(37) : P(17)), tx = bx + bw * s.pi[s.prompt][sm.i];
      const pt = v => [lerp(x + w * 0.3, tx, easeOut(v)), lerp(qy + qh, ty, easeIO(v))];
      const pts = []; for (let q = Math.max(0, u - 0.25); q <= u; q += 0.05) pts.push(pt(q)); k.trail(pts, C.sig, { w: 2, alpha: 1 - u * 0.5 }); const [px, py] = pt(u); k.dot(px, py, P(3), C.sig, { glow: 8, alpha: 1 - u * 0.4 }); });
    k.label(x + P(14), y + h - P(14), "● helpful   ● unhelpful   (as judged by a careful person)", { align: "left", size: 10 });
    k.dot(x + P(17), y + h - P(14), P(3.5), C.ok); k.dot(x + P(78), y + h - P(14), P(3.5), C.crit);
  }

  function drawTest(k, s, r, narrow) {
    const C = k.C, P = k.px, [x, y, w, h] = r, T = s.test;
    panel(k, r, "The test");
    k.label(x + w - P(14), y + P(17), T.done ? `finished · ${T.n.toLocaleString()} questions` : `question ${T.k.toLocaleString()} of ${T.n.toLocaleString()}`, { align: "right", size: 11, mono: true, col: C.ink });
    const ax = x + P(16), aw = w - P(32);
    const rows = [["Before feedback", T.a, s.acc0, C.muted, T.ra], ["Your model", T.b, s.acc1, C.sig, T.rb]];
    const gy = y + P(44), gcell = Math.min(P(9), aw / 50);
    rows.forEach(([name, kk, tru, col, rec], ri) => {
      const yy = gy + ri * (gcell * 2 + P(26));
      k.label(ax, yy, name, { align: "left", size: 11, col: ri ? C.sig : C.ink, weight: "600" });
      rec.forEach((v, i) => k.box(ax + (i % 50) * gcell, yy + P(10) + Math.floor(i / 50) * gcell, gcell - P(1.5), gcell - P(1.5), { fill: v ? col : C.crit, r: 1, alpha: v ? 0.85 : 0.55 }));
    });
    // accuracy axis with 95% bands
    const py = gy + 2 * (gcell * 2 + P(26)) + P(30), lo = 0, hi = 1, X = v => ax + (v - lo) / (hi - lo) * aw;
    k.label(ax, py - P(10), "share of questions answered helpfully, with 95% band", { align: "left", size: 10 });
    const yA = py + P(20), yB = py + P(56), base = py + P(78);
    k.line(ax, base, ax + aw, base, { col: C.line });
    [0, 0.25, 0.5, 0.75, 1].forEach(v => { k.line(X(v), base, X(v), base + P(4), { col: C.line }); k.label(X(v), base + P(13), Math.round(v * 100) + "%", { size: 10 }); });
    const A = wilson(T.a, T.k), B = wilson(T.b, T.k);
    [[A, yA, C.muted, s.acc0, "before"], [B, yB, C.sig, s.acc1, "yours"]].forEach(([W, yy, col, tru, lab]) => {
      if (T.k) { k.box(X(W[1]), yy - P(8), Math.max(P(2), X(W[2]) - X(W[1])), P(16), { fill: col, r: 5, alpha: 0.28 }); k.dot(X(W[0]), yy, P(5), col, { glow: 10 }); k.label(X(W[2]) + P(6), yy, Math.round(W[0] * 100) + "%", { align: "left", size: 11, mono: true, col: C.ink }); }
      k.line(X(tru), yy - P(13), X(tru), yy + P(13), { col: C.ink, dash: [2, 3], lw: 1.2 });
    });
    k.label(X(s.acc1), yB + P(22), "true skill (only the simulation knows)", { size: 10, bg: true });
    // earlier tests of the same two models
    const hy = base + P(42);
    if (s.hist.length) {
      k.label(ax, hy, `earlier tests, same models (${s.hist.length})`, { align: "left", size: 10 });
      s.hist.forEach((hh, i) => { k.dot(X(hh.a), hy + P(14), P(3), C.muted, { alpha: 0.8 }); k.dot(X(hh.b), hy + P(26), P(3), C.sig, { alpha: 0.8 }); });
    }
    // verdict
    const vy = Math.min(y + h - P(18), hy + P(56));
    let v = ["Testing…", C.muted];
    if (s.last && T.done || (s.last && T.k < 10)) { const L = s.last; v = L.leak ? ["Leaked questions: the score is inflated", C.crit] : L.sep ? ["Bands apart: the gain is real", C.ok] : L.A[2] > L.B[1] && L.B[2] > L.A[1] ? ["Bands overlap: this test can't tell", C.amb] : ["Your model scored lower", C.crit]; }
    k.label(ax, vy, v[0], { align: "left", size: 13, weight: "650", col: v[1] });
  }

  function draw(k, s, sim) {
    if (sim.narrow) { drawReplies(k, s, LN.B, true); drawTest(k, s, LN.C, true); }
    else { drawRecipe(k, s, LW.A); drawReplies(k, s, LW.B, false); drawTest(k, s, LW.C, false); }
  }

  const dirty = s => { s.dirty = true; };
  const sim = makeSim($("#asst-sim"), {
    label: "Assistant-training simulation. Left: the training recipe. Middle: a prompt and five possible replies, with how often the model gives each one before and after feedback training. Right: a test comparing the model before and after feedback, with 95% confidence bands.",
    cams: { default: { x: 10, y: 10, w: 1580, h: 780 } },
    camsNarrow: { default: { x: -6, y: -6, w: 1012, h: 1472 } },
    height: w => w < 640 ? Math.round(w * 1.45) : Math.round(Math.min(620, Math.max(400, w * 0.52))),
    seed: 15,
    init: rand => { for (let i = 0; i < 20; i++) rand(); const s = { rand, clock: 0, prompt: 0, sft: 5, prefs: 0, lb: 0, tests: 1, leak: false, samples: [], sampAcc: 0, hist: [] }; compute(s); newTest(s); return s; },
    warmup: 3,
    intro: "A fine-tuned model answers three kinds of prompt. Add preference training and watch its replies shift, then check the change with a test. Click the prompt to switch.",
    controls: [
      { id: "sft", label: "Example conversations", type: "range", min: 0, max: SFT.length - 1, step: 1, value: 5, fmt: v => SFT[v].toLocaleString(), help: "Fine-tuning on written-out good conversations.", apply: (s, v) => { s.sft = v; dirty(s); } },
      { id: "prefs", label: "Preference pairs", type: "range", min: 0, max: PREFS.length - 1, step: 1, value: 0, fmt: v => PREFS[v] ? PREFS[v].toLocaleString() : "none", help: "People pick the better of two replies; a reward model learns from their picks.", apply: (s, v) => { s.prefs = v; dirty(s); } },
      { id: "beta", label: "Leash strength (β)", type: "range", min: -1.3, max: 1.3, step: 0.1, value: 0, fmt: v => (v < -0.45 ? "loose · " : v > 0.45 ? "tight · " : "") + fmtB(10 ** v), help: "Loose: chase the reward model's score. Tight: stay close to the starting model.", apply: (s, v) => { s.lb = v; dirty(s); } },
      { id: "tests", label: "Test questions", type: "range", min: 0, max: TESTS.length - 1, step: 1, value: 1, fmt: v => TESTS[v].toLocaleString(), help: "Each test uses fresh questions. More questions, narrower bands.", apply: (s, v) => { s.tests = v; dirty(s); } },
      { id: "leak", label: "Test questions leaked into training", type: "toggle", value: false, help: "Contamination: the model has seen the test.", apply: (s, v) => { s.leak = v; dirty(s); } }
    ],
    step, draw,
    click: (s, wx, wy) => { const b = s.qBox; if (b && wx >= b[0] && wx <= b[0] + b[2] && wy >= b[1] - 20 && wy <= b[1] + b[3] + 20) { s.prompt = (s.prompt + 1) % 3; s.samples = []; } },
    stats: s => [["helpful · before feedback", Math.round(s.acc0 * 100) + "%"], ["helpful · your model", Math.round(s.acc1 * 100) + "%", s.acc1 > s.acc0 + 0.02 ? "ok" : s.acc1 < s.acc0 - 0.02 ? "bad" : ""],
      ["drift from start", s.P ? s.kl.toFixed(2) : "0", s.kl > 1 ? "bad" : ""], ["last test gap", s.last ? (s.last.B[0] - s.last.A[0] >= 0 ? "+" : "−") + Math.abs(Math.round((s.last.B[0] - s.last.A[0]) * 100)) + " pts" : "—", s.last ? (s.last.leak ? "bad" : s.last.sep ? "ok" : "hot") : ""]],
    goal: { text: "make the model more helpful and prove it: a clean test where the two bands don't overlap", check: s => ({ done: !!(s.last && s.last.sep && !s.last.leak && s.acc1 > s.acc0), progress: s.last ? `${Math.round(s.last.A[0] * 100)}% → ${Math.round(s.last.B[0] * 100)}% · ${s.last.n.toLocaleString()} questions` : "testing…" }) },
    notices: [
      { id: "leak", when: s => s.leak, say: s => `The test questions leaked into training, so the model has partly memorised their answers. It scores about <b>${Math.round(measured(s) * 100)}%</b> while its true skill is ${Math.round(s.acc1 * 100)}% (dashed line). The test now measures memory, not ability.` },
      { id: "base", when: s => s.base0 > 0.25, say: s => `With ${s.e.toLocaleString()} example conversations, ${Math.round(s.base0 * 100)}% of replies still just continue the text, the way a web page would. A base model has learned language, not the job of answering. Add examples.` },
      { id: "hack", when: s => s.P > 0 && s.hack > 0.3 && s.acc1 < s.acc0, say: s => `Reward hacking. With a loose leash (β ${fmtB(s.beta)}) the model chases the reward model's score, flaws included: it learned that people often like being agreed with and like long answers. ${Math.round(s.hack * 100)}% of replies are now the flattering or padded one, and helpfulness fell to ${Math.round(s.acc1 * 100)}%.` },
      { id: "few", when: s => s.P > 0 && s.P <= 300 && s.acc1 < s.acc0 + 0.03, say: s => `${s.P} preference pairs are too few: the reward model is still mostly guessing, so training pushes the model toward the wrong replies about as often as the right ones. Collect more pairs.` },
      { id: "tight", when: s => s.P > 0 && s.beta > 5, say: s => `The leash is so tight (β ${fmtB(s.beta)}) that the model barely moves from where it started: drift ${s.kl.toFixed(2)}. Safe, but only ${Math.round((s.acc1 - s.acc0) * 100)} points better.` },
      { id: "none", when: s => s.P === 0 && s.hist.length >= 1, say: s => { const h = s.hist[s.hist.length - 1]; return `No feedback training yet, so "your model" is the same model as "before". Still, the last test scored them ${Math.round(h.a * 100)}% and ${Math.round(h.b * 100)}%. That difference is pure luck: which questions happened to be drawn.`; } },
      { id: "overlap", when: s => s.last && !s.last.sep && s.acc1 > s.acc0 + 0.03, say: s => `Your model really is better (${Math.round(s.acc0 * 100)}% → ${Math.round(s.acc1 * 100)}% true skill), but with ${s.last.n.toLocaleString()} questions each score is only known to within about ±${Math.round(Z * Math.sqrt(0.25 / s.last.n) * 100)} points, so the bands overlap. A bigger test narrows them.` },
      { id: "proven", when: s => s.last && s.last.sep && !s.last.leak, say: s => `Proven: on ${s.last.n.toLocaleString()} fresh questions the bands don't overlap, so a gain of ${Math.round((s.last.B[0] - s.last.A[0]) * 100)} points is very unlikely to be luck. Drift from the start: ${s.kl.toFixed(2)}.` },
      { id: "calm", when: () => true, say: s => `Preference training moved helpful replies from ${Math.round(s.acc0 * 100)}% to ${Math.round(s.acc1 * 100)}%. Is the test big enough to show it?` }
    ],
    facts: [
      { id: "instruct", when: s => s.P > 0 && s.acc1 > s.acc0 + 0.05, text: "OpenAI found that people preferred replies from a 1.3-billion-parameter model trained this way over those from its original 175-billion-parameter GPT-3, a model over 100 times bigger.", ref: "#ref-16" },
      { id: "syco", when: s => s.P > 0 && s.hack > 0.3, text: "Anthropic researchers found that both people and reward models sometimes prefer a convincingly written, agreeable answer over a correct one. That pull is one reason assistants drift toward flattery.", ref: "#ref-1503" }
    ],
    tour: [
      { say: "This is a base model: trained only to predict text. Asked a question, it mostly writes what might come next on a web page (red bars).", set: { sft: 0, prefs: 0, beta: 0, tests: 1, leak: false }, wait: 6 },
      { say: "Fine-tune it on 1,000 example conversations. It learns the format: answer, then stop. But it copies the examples' habits, flattery included.", set: { sft: 5 }, wait: 6 },
      { say: "Now collect 10,000 preference pairs. A reward model learns to score replies, and the model practises getting higher scores, on a leash (β = 1) that keeps it near where it started. Grey bars show where it started.", set: { prefs: 5 }, wait: 7 },
      { say: "Loosen the leash. The model chases the score, and the reward model has a flaw: it overrates flattering and padded replies. Helpfulness drops. This is reward hacking.", set: { beta: -1.3 }, wait: 7 },
      { say: "Back to a sensible leash. Is the model really better? On a 100-question test the two bands overlap: this test can't tell.", set: { beta: 0, tests: 1 }, wait: 9 },
      { say: "With 2,000 questions each score is pinned down to about ±2 points. The bands separate: the gain is real.", set: { tests: 5 }, wait: 9 }
    ],
    publish: s => {
      const pr = PROMPTS[s.prompt], top = s.tPi[s.prompt].indexOf(Math.max(...s.tPi[s.prompt])), ref = s.tRef[s.prompt][top], rm = s.rm[s.prompt][top], n = s.last ? s.last.n : TESTS[s.tests];
      return { asE: s.e.toLocaleString(), asP: s.P.toLocaleString(), asBeta: String(fmtB(s.beta)), asAcc0: Math.round(s.acc0 * 100) + "%", asAcc1: Math.round(s.acc1 * 100) + "%", asKL: s.kl.toFixed(2), asBase: Math.round(s.base0 * 100) + "%",
        asN: n.toLocaleString(), asPm: "±" + (Z * Math.sqrt(s.acc1 * (1 - s.acc1) / n) * 100).toFixed(1), asHack: Math.round(s.hack * 100) + "%",
        asTop: pr.r[top][0].replace(/"/g, ""), asRef: Math.round(ref * 100) + "%", asR: (rm >= 0 ? "+" : "−") + Math.abs(rm).toFixed(1), asExp: Math.exp(rm / s.beta) > 1e4 ? fmt(Math.exp(rm / s.beta), 1) : Math.exp(rm / s.beta).toFixed(1), asPi: Math.round(s.tPi[s.prompt][top] * 100) + "%",
        asGap: s.last ? (s.last.B[0] - s.last.A[0] >= 0 ? "+" : "−") + Math.abs(Math.round((s.last.B[0] - s.last.A[0]) * 100)) + " points" : "—" };
    }
  });
});
