/* Chapter 12 film: how a next-token predictor becomes an assistant (SFT, preferences, reward model, RL with a KL leash, DPO). */
chapter("align", () => {
  const fig = $("#al-film"); if (!fig) return;
  const narrow = () => innerW(fig) < 640;
  let nar = false;
  const cam = (wide, ph) => ({ get x() { return (narrow() ? ph : wide).x; }, get y() { return (narrow() ? ph : wide).y; }, get w() { return (narrow() ? ph : wide).w; }, get h() { return (narrow() ? ph : wide).h; } });
  const hud = (k, cw, cn, title, rows, w, nr = 1) => nar && !nr ? null : nar ? k.hud(cn, "", rows.slice(0, nr), { w: Math.min(w, 230) }) : k.hud(cw, title, rows, { w });
  const ease = (p, a, b) => easeIO((p - a) / (b - a));
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ts = () => nar ? 27 : 16; // body text size in world units

  /* wrapped text in world units; reveals the first `chars` characters; truncates to maxLines with an ellipsis */
  function para(k, x, y, w, maxLines, text, size, col, chars = 1e9, o = {}) {
    const c = k.ctx; font(c, size, "--f-display", o.weight || "500");
    let lines = wrapLines(c, text, w);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S+$/, "") + " …"; }
    let left = chars; const lh = size * 1.38;
    lines.forEach((ln, i) => { if (left <= 0) return; const s = ln.slice(0, left); left -= ln.length + 1; k.text(x, y + i * lh, s, { align: "left", baseline: "top", size, col, weight: o.weight }); });
    return lines.length * lh;
  }
  const person = (k, x, y, s, col) => { k.dot(x, y - 26 * s, 13 * s, col); k.box(x - 22 * s, y - 8 * s, 44 * s, 34 * s, { fill: col, r: 16 * s }); };

  const PROMPT = "What is the capital of Australia?";
  const BASE = "What is the capital of Canada? What is the capital of Brazil? Test your geography with these 50 quiz questions, answers at the bottom of the page.";
  const SFT = "The capital of Australia is Canberra. Many people assume it is Sydney or Melbourne, but Canberra was purpose-built as the capital, partly as a compromise between those two cities. It is in the Australian Capital Territory and is home to Parliament House.";
  const P2 = "I think my startup idea is perfect. You agree, right?";
  const ANS_A = "Absolutely! Believing in your idea is the first step to success. With passion and hard work, any startup can succeed. Go for it!";
  const ANS_B = "I'd like to help you test it rather than just agree. Could you tell me the idea, who it's for, and what they use today? Then I can point out its strengths and the risks worth checking before you invest more.";
  // the chapter's five candidate replies to the Java question, with its illustrative reference probabilities and rewards
  const CANDS = [["Finds the null field, shows a fix, explains why", "Finds bug, fixes, explains", 0.30, 2.0], ["Correct fix, no explanation", "Correct fix, no explanation", 0.25, 1.2], ["Confident but wrong fix", "Confident but wrong fix", 0.15, -1.0], ["Flatters: 'your code looks great, probably a JVM bug'", "Flatters: 'probably a JVM bug'", 0.15, -1.5], ["Unhelpful: 'please read the documentation'", "Unhelpful: 'read the docs'", 0.15, -2.0]];
  const policy = beta => { const lg = CANDS.map(c => Math.log(c[2]) + c[3] / beta), m = Math.max(...lg), ex = lg.map(l => Math.exp(l - m)), Z = ex.reduce((a, b) => a + b); return ex.map(e => e / Z); };

  const steps = [
    { key: "base", short: "Base model", title: "A base model just continues text", dur: 6.5,
      text: [`A freshly trained "base" model has read a huge library but never had a conversation. Ask it a question and it continues the text the way a web page might: with more quiz questions.`,
             `Pretraining teaches continuation, not answering. Lists of questions are common online, so more questions is a likely continuation. The knowledge is there; the assistant format is not.`] },
    { key: "sft", short: "Fine-tuning", title: "Supervised fine-tuning on example conversations", dur: 7,
      text: [`So we show it lots of good examples: "when someone asks this, a helpful answer looks like that". Now it answers in the right format, though it can be wordy.`,
             `SFT continues training on carefully written conversations (thousands to millions) instead of raw web text. Chat templates mark system, user and assistant turns, and the loss is usually computed only on the assistant's tokens.`], link: "#ref-16" },
    { key: "prefs", short: "Preferences", title: "People pick the better of two answers", dur: 6.5,
      text: [`It's hard to write the perfect answer but easy to say which of two is better. So people look at two answers and pick the one they prefer.`,
             `Each comparison yields a preferred reply y_w and a rejected reply y_l for the same prompt. Feedback training aims to reward answers people prefer: accurate, appropriately short, honest rather than flattering.`] },
    { key: "rm", short: "Reward model", title: "A reward model learns to score answers", dur: 6.5,
      text: [`A second model learns to predict those choices. Then it can score any answer: high for answers people would pick, low for the rest.`,
             `Reward models are usually fitted with the Bradley–Terry model: P(y_w ≻ y_l) = σ(r(y_w) − r(y_l)). The candidate replies and scores here are the chapter's illustrative ones.`], link: "#ref-16" },
    { key: "rl", short: "RL + leash", title: "Chase the reward, held by a leash", dur: 7,
      text: [`Now the assistant is trained to give answers the reward model scores highly. A leash keeps it close to where it started, so it can't run off chasing quirks in the scores.`,
             `Maximise E[r(x, y)] − β·KL(π ‖ π_ref). The optimum is π*(y) ∝ π_ref(y)·exp(r(y)/β); here β falls from 10 to 1 and the bars show the exact result.`], link: "#ref-18" },
    { key: "dpo", short: "DPO", title: "DPO: learn straight from the pairs", dur: 6.5,
      text: [`DPO is a shortcut. It skips the separate reward model and the reinforcement learning loop, and directly makes preferred answers more likely and rejected ones less likely than in the starting model.`,
             `Substituting r = β log(π/π_ref) + const into Bradley–Terry gives a loss on preference pairs: −log σ(β[log π(y_w)/π_ref(y_w) − log π(y_l)/π_ref(y_l)]).`], link: "#ref-18" }
  ];
  const cams = {
    default: cam({ x: 0, y: 0, w: 1100, h: 560 }, { x: -90, y: -10, w: 780, h: 700 }),
    base: cam({ x: 0, y: 0, w: 1100, h: 560 }, { x: -90, y: -10, w: 780, h: 700 }),
    sft: cam({ x: 0, y: 0, w: 1100, h: 560 }, { x: -90, y: -10, w: 780, h: 700 }),
    prefs: cam({ x: 1200, y: 0, w: 1100, h: 560 }, { x: 1360, y: -20, w: 780, h: 700 }),
    rm: cam({ x: 2400, y: 0, w: 1100, h: 560 }, { x: 2575, y: -40, w: 790, h: 700 }),
    rl: cam({ x: 3600, y: 0, w: 1100, h: 560 }, { x: 3765, y: -30, w: 790, h: 700 }),
    dpo: cam({ x: 4800, y: 0, w: 1100, h: 560 }, { x: 4960, y: -60, w: 780, h: 700 })
  };

  /* ---------- 1-2. base model, then SFT ---------- */
  function drawChat(k, f) {
    const C = k.C, pb = f.at("base"), ps = f.at("sft"), sft = f.key !== "base";
    const Lw = { pr: { x: 40, y: 200, w: 300, h: 110 }, md: { x: 400, y: 160, w: 240, h: 200 }, out: { x: 700, y: 130, w: 380, h: 260 } };
    const Ln = { pr: { x: 20, y: 20, w: 560, h: 96 }, md: { x: 170, y: 160, w: 260, h: 150 }, out: { x: 20, y: 350, w: 560, h: 330 } };
    const L = nar ? Ln : Lw, sz = ts();
    // prompt bubble
    const pa = sft ? 1 : ease(pb, 0, 0.12);
    k.label(L.pr.x, L.pr.y - 14, "Prompt", { align: "left", col: C.muted, size: 11, alpha: pa });
    k.box(L.pr.x, L.pr.y, L.pr.w, L.pr.h, { fill: C.bg2, stroke: C.line, r: 14, alpha: pa });
    k.ctx.save(); k.ctx.globalAlpha = pa; para(k, L.pr.x + 16, L.pr.y + (nar ? 16 : 22), L.pr.w - 32, 3, PROMPT, sz, C.ink); k.ctx.restore();
    // model box
    const md = L.md, trainA = f.key === "sft" ? ease(ps, 0.05, 0.12) * (1 - ease(ps, 0.48, 0.55)) : 0;
    const runK = f.key === "base" ? ease(pb, 0.14, 0.3) : ease(ps, 0.56, 0.66);
    const thinking = (f.key === "base" && pb > 0.18 && pb < 0.34) || (f.key === "sft" && ps > 0.58 && ps < 0.7);
    k.box(md.x, md.y, md.w, md.h, { fill: C.bg2, stroke: thinking ? C.amb : trainA > 0.1 ? C.amb : (sft && ps > 0.5 ? C.sig : C.line), r: 16, glow: thinking || trainA > 0.1 ? 12 : 0, glowCol: C.amb });
    k.label(md.x + md.w / 2, md.y + 20, sft && ps > 0.5 ? "Fine-tuned model" : "Base model", { col: C.ink, weight: "650" });
    const cols = 10, rows = nar ? 4 : 6, cw = (md.w - 40) / cols, chh = (md.h - 56) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, base = hash(i), shifted = hash(i + 500), mix = sft ? ease(ps, 0.08 + base * 0.2, 0.42 + base * 0.1) : 0;
      const v = lerp(base, shifted, mix), flick = trainA > 0 ? 0.5 + 0.5 * Math.sin(f.t * 9 + i * 1.7) : 0;
      k.box(md.x + 20 + c * cw + 1.5, md.y + 40 + r * chh + 1.5, cw - 3, chh - 3, { fill: flick > 0.75 ? C.amb : C.sig, r: 2, alpha: (0.12 + 0.55 * v) * (flick > 0.75 ? trainA : 1) });
    }
    // prompt -> model, model -> output
    const inPath = nar ? (u => [lerp(md.x + md.w / 2, md.x + md.w / 2, u), lerp(L.pr.y + L.pr.h + 4, md.y - 4, u)]) : (u => [lerp(L.pr.x + L.pr.w + 4, md.x - 4, u), lerp(L.pr.y + L.pr.h / 2, md.y + md.h / 2, u)]);
    const outPath = nar ? (u => [md.x + md.w / 2, lerp(md.y + md.h + 4, L.out.y - 4, u)]) : (u => [lerp(md.x + md.w + 4, L.out.x - 4, u), lerp(md.y + md.h / 2, L.out.y + L.out.h / 2, u)]);
    if (runK > 0 && runK < 1) k.flow(inPath, 3, f.t * 1.2, C.sig, { size: 3 });
    // output panel
    const out = L.out;
    k.box(out.x, out.y, out.w, out.h, { fill: C.bg2, stroke: C.line, r: 14 });
    let chars = 0, text = BASE, tag = "It continues the text", col = C.amb;
    if (f.key === "base") chars = Math.floor(ease(pb, 0.32, 0.95) * BASE.length * 1.02);
    else if (ps < 0.04) chars = BASE.length;
    else { chars = Math.floor(ease(ps, 0.66, 0.98) * SFT.length * 1.02); text = SFT; tag = "It answers"; col = C.sig; }
    if (f.key === "sft" && ps > 0.04 && ps < 0.6) { tag = "Learning from examples…"; chars = 0; }
    k.label(out.x + 16, out.y - 14, "Reply · " + tag, { align: "left", col, size: 11.5, weight: "600" });
    const reveal = chars > 0 && chars < text.length;
    if (reveal) k.flow(outPath, 3, f.t * 1.4, col, { size: 3 });
    para(k, out.x + 18, out.y + 18, out.w - 36, Math.floor((out.h - 40) / (sz * 1.38)), text, sz, C.ink, chars);
    // demonstration conversations flow in during SFT
    if (f.key === "sft" && ps < 0.56) {
      for (let j = 0; j < 7; j++) {
        const u = clamp01((ps - 0.04 - j * 0.055) / 0.2); if (u <= 0 || u >= 1) continue;
        const sx = nar ? 680 : md.x + md.w / 2 + (j % 2 ? 120 : -120), sy = nar ? md.y + 20 : -60, tx = md.x + md.w / 2, ty = md.y + md.h / 2;
        const e = easeIO(u), x = lerp(sx, tx, e), y = lerp(sy, ty, e), sc = lerp(1, 0.3, e * e), w = 170 * sc, h = 84 * sc;
        k.box(x - w / 2, y - h / 2, w, h, { fill: C.bg2, stroke: C.sig, r: 10 * sc, alpha: 1 - e * 0.5 });
        if (sc > 0.55) { k.pill(x - w / 2 + 28 * sc, y - h / 4, 40 * sc, 14 * sc, C.muted); k.box(x - w / 2 + 54 * sc, y - h / 4 - 3 * sc, 100 * sc, 6 * sc, { fill: C.line, r: 3 });
          k.pill(x - w / 2 + 28 * sc, y + h / 5, 40 * sc, 14 * sc, C.sig); k.box(x - w / 2 + 54 * sc, y + h / 5 - 3 * sc, 100 * sc, 6 * sc, { fill: C.sig, r: 3, alpha: 0.6 }); }
      }
      k.label(nar ? 600 : md.x + md.w / 2, nar ? md.y - 14 : 30, "Example conversations: user asks, ideal reply", { align: nar ? "right" : "center", col: C.sig, size: 11.5, weight: "600", alpha: ease(ps, 0.03, 0.1) * (1 - ease(ps, 0.5, 0.56)) });
    }
  }

  /* ---------- 3. preferences ---------- */
  function drawPrefs(k, f) {
    const C = k.C, p = f.at("prefs"), on = f.key === "prefs", sz = nar ? 25 : 15;
    const L = nar ? { pr: { x: 1380, y: 0, w: 740, h: 70 }, A: { x: 1380, y: 110, w: 362, h: 330 }, B: { x: 1758, y: 110, w: 362, h: 330 }, me: [1750, 560], pile: { x: 1940, y: 480, w: 180, h: 140 } }
                  : { pr: { x: 1300, y: 22, w: 900, h: 52 }, A: { x: 1270, y: 110, w: 430, h: 220 }, B: { x: 1730, y: 110, w: 430, h: 220 }, me: [1715, 440], pile: { x: 1990, y: 380, w: 170, h: 150 } };
    const a0 = ease(p, 0, 0.12);
    k.box(L.pr.x, L.pr.y, L.pr.w, L.pr.h, { fill: C.bg2, stroke: C.line, r: 14, alpha: a0 });
    k.ctx.save(); k.ctx.globalAlpha = a0; para(k, L.pr.x + 16, L.pr.y + (nar ? 10 : 15), L.pr.w - 32, 2, P2, sz, C.ink); k.ctx.restore();
    const pick = ease(p, 0.48, 0.56), look = p > 0.26 && p < 0.5 ? ((p - 0.26) / 0.24 < 0.5 ? "A" : "B") : null;
    [["A", L.A, ANS_A], ["B", L.B, ANS_B]].forEach(([nm, r, txt], i) => {
      const ap = ease(p, 0.08 + i * 0.05, 0.2 + i * 0.05), win = nm === "B";
      const stroke = pick > 0 ? (win ? C.sig : C.line) : look === nm ? C.ink : C.line;
      k.box(r.x, r.y, r.w, r.h, { fill: C.bg2, stroke, r: 14, alpha: ap * (pick > 0 && !win ? 1 - 0.45 * pick : 1), glow: win && pick > 0 ? 16 * pick : 0, glowCol: C.sig, lw: look === nm || (win && pick) ? 2.2 : 1.5 });
      k.label(r.x + 16, r.y - 14, `Answer ${nm}`, { align: "left", col: C.ink, weight: "650", alpha: ap });
      k.ctx.save(); k.ctx.globalAlpha = ap * (pick > 0 && !win ? 1 - 0.5 * pick : 1);
      para(k, r.x + 16, r.y + 16, r.w - 32, Math.floor((r.h - 26) / (sz * 1.38)), txt, sz, C.ink, Math.floor(ease(p, 0.08 + i * 0.05, 0.3 + i * 0.05) * txt.length * 1.05)); k.ctx.restore();
      if (pick > 0) k.label(r.x + r.w - 16, r.y - 14, win ? "preferred ✓" : "rejected", { align: "right", col: win ? C.sig : C.muted, weight: "650", alpha: pick });
    });
    // the person comparing
    const [mx, my] = L.me, pa = ease(p, 0.18, 0.28);
    if (pa > 0) { person(k, mx, my, nar ? 1.3 : 1, look || pick ? C.ink : C.muted);
      const tgt = look === "A" ? L.A : look === "B" || pick ? L.B : null;
      if (tgt && on) { const tx = tgt.x + tgt.w / 2, ty = tgt.y + tgt.h; k.line(mx, my - 42, tx, ty + 6, { col: C.ink, dash: [4, 5], alpha: 0.5 }); }
      k.label(mx, my + (nar ? 52 : 40), "A person compares", { col: C.muted, size: 11, alpha: pa }); }
    // the comparison goes onto the pile, then more comparisons
    const pl = L.pile, n = Math.min(14, Math.floor(ease(p, 0.66, 0.98) * 14));
    k.box(pl.x, pl.y, pl.w, pl.h, { stroke: C.line, r: 12, dash: [4, 4], alpha: ease(p, 0.55, 0.65) });
    k.label(pl.x + pl.w / 2, pl.y - 14, "Preference data", { col: C.muted, size: 11, alpha: ease(p, 0.55, 0.65) });
    for (let j = 0; j < n; j++) { const x = pl.x + 12 + (j % 2) * ((pl.w - 24) / 2 + 2), y = pl.y + pl.h - 22 - Math.floor(j / 2) * 17; k.box(x, y, (pl.w - 28) / 2, 13, { fill: j === 0 ? C.sig : C.line, r: 3, alpha: 0.9 }); }
    const fly = ease(p, 0.56, 0.68);
    if (fly > 0 && fly < 1) { const s = [L.B.x + L.B.w / 2, L.B.y + L.B.h], e = [pl.x + 40, pl.y + pl.h - 16], x = lerp(s[0], e[0], fly), y = lerp(s[1], e[1], fly) - Math.sin(fly * Math.PI) * 30; k.pill(x, y, 70, 22, C.sig, { glow: 12 }); k.text(x, y + 1, "B ≻ A", { col: C.bg, size: 12, weight: "650" }); }
    if (on) hud(k, "bl", "bl", "Comparisons", [["pairs collected", String(n)], ["each pair holds", "a winner and a loser"]], 250, 0);
  }

  /* ---------- 4. reward model ---------- */
  function drawRM(k, f) {
    const C = k.C, p = f.at("rm"), on = f.key === "rm";
    const RMb = nar ? { x: 2860, y: 0, w: 260, h: 150 } : { x: 2790, y: 20, w: 280, h: 160 }, pile = nar ? { x: 2600, y: 10, w: 160, h: 130 } : { x: 2480, y: 50, w: 170, h: 140 };
    const zero = nar ? 3125 : 3130, unit = nar ? 62 : 85, LX = zero - 2 * unit - 14, RY = nar ? 250 : 300, RH = nar ? 82 : 46;
    // pile of pairs
    k.box(pile.x, pile.y, pile.w, pile.h, { stroke: C.line, r: 12, dash: [4, 4] });
    k.label(pile.x + pile.w / 2, pile.y - 14, "Preference data", { col: C.muted, size: 11 });
    for (let j = 0; j < 14; j++) { const x = pile.x + 12 + (j % 2) * ((pile.w - 24) / 2 + 2), y = pile.y + pile.h - 22 - Math.floor(j / 2) * 15; k.box(x, y, (pile.w - 28) / 2, 11, { fill: j === 0 ? C.sig : C.line, r: 3, alpha: 0.9 }); }
    // reward model box
    const train = on && p < 0.42, scoring = on && p >= 0.42;
    k.box(RMb.x, RMb.y, RMb.w, RMb.h, { fill: C.bg2, stroke: train ? C.amb : scoring ? C.sig : C.line, r: 16, glow: train ? 12 : 0, glowCol: C.amb });
    k.label(RMb.x + RMb.w / 2, RMb.y + 22, "Reward model", { col: C.ink, weight: "650" });
    if (!nar) k.label(RMb.x + RMb.w / 2, RMb.y + 44, "answer in, score out", { col: C.muted, size: 11 });
    for (let c = 0; c < 10; c++) for (let r = 0; r < 3; r++) { const i = c * 3 + r, fl = train && Math.sin(f.t * 8 + i * 2.1) > 0.6; k.box(RMb.x + 20 + c * (RMb.w - 40) / 10 + 1.5, RMb.y + 64 + r * 24, (RMb.w - 40) / 10 - 3, 18, { fill: fl ? C.amb : C.sig, r: 2, alpha: fl ? 0.9 : 0.15 + 0.5 * hash(i + 40) }); }
    if (train) k.flow(u => bez([[pile.x + pile.w, pile.y + pile.h / 2], [pile.x + pile.w + 60, pile.y + pile.h / 2], [RMb.x - 60, RMb.y + RMb.h / 2], [RMb.x, RMb.y + RMb.h / 2]], u), 4, f.t * 0.9, C.sig, { size: 3 });
    if (!nar) k.label(RMb.x + RMb.w / 2, RMb.y + RMb.h + 18, "fitted so that P(B ≻ A) = σ(r_B − r_A)", { col: train ? C.amb : C.muted, size: 11.5, mono: true });
    // candidate answers and their scores
    k.label(nar ? LX : 2480, RY - 34, nar ? "Five replies, scored" : "Prompt: “My Java service throws a NullPointerException on startup. Can you help?”", { align: nar ? "right" : "left", col: C.ink, size: 11.5, weight: "600" });
    k.line(zero, RY - 12, zero, RY + 5 * RH - 6, { col: C.line });
    CANDS.forEach(([long, short, , r], i) => {
      const y = RY + i * RH, s0 = 0.44 + i * 0.1, sk = on ? ease(p, s0, s0 + 0.12) : (["rl", "dpo"].includes(f.key) ? 1 : 0);
      k.label(LX, y + 12, nar ? short : long, { align: "right", col: sk > 0 ? C.ink : C.muted, size: 11.5 });
      const w = r * unit * sk, col = r >= 0 ? C.sig : C.amb;
      if (sk > 0) { k.box(w >= 0 ? zero : zero + w, y + 2, Math.abs(w), 20, { fill: col, r: 4, alpha: 0.9 }); k.label(r >= 0 ? zero + w + 10 : zero + 10, y + 12, (r > 0 ? "+" : "") + (r * sk).toFixed(1), { align: "left", col, size: 11.5, mono: true, weight: "600" }); }
      if (on && p > s0 - 0.04 && p < s0 + 0.06) { const u = (p - s0 + 0.04) / 0.1; k.flow(v => bez([[RMb.x + RMb.w / 2, RMb.y + RMb.h], [RMb.x + RMb.w / 2, y - 30], [zero, y - 20], [zero, y + 12]], v), 3, f.t * 1.6, C.sig, { size: 3, alpha: Math.sin(u * Math.PI) }); }
    });
    if (on) hud(k, "br", "bl", "Reward model", [["now", train ? "learning from pairs" : "scoring answers", train ? C.amb : C.sig], ["scores", "illustrative"]], 230, 0);
  }

  /* ---------- 5. RL with a KL leash ---------- */
  function drawRL(k, f) {
    const C = k.C, p = f.at("rl"), on = f.key === "rl";
    const beta = Math.pow(10, 1 - ease(p, 0.12, 0.72)); // 10 -> 1
    const pi = on || f.key === "dpo" ? policy(beta) : CANDS.map(c => c[2]);
    const kl = pi.reduce((a, q, i) => a + (q > 0 ? q * Math.log(q / CANDS[i][2]) : 0), 0), er = pi.reduce((a, q, i) => a + q * CANDS[i][3], 0);
    // a sketch of "model space": reference model, a high-reward region, the policy on a leash
    const PX = nar ? 3780 : 3680, PY = 60, PW = nar ? 300 : 330, PH = 440;
    k.box(PX, PY, PW, PH, { stroke: C.line, r: 16, alpha: 0.7 });
    k.label(PX + 14, PY - 14, "All possible models", { align: "left", col: C.muted, size: 11 });
    const hill = [PX + 230, PY + 110], ref = [PX + 90, PY + 350];
    for (let r = 5; r >= 1; r--) k.dot(hill[0], hill[1], r * 24, C.amb, { alpha: 0.06 + (5 - r) * 0.02 });
    k.label(hill[0], hill[1] - 6, "high reward", { col: C.amb, size: 11.5, weight: "600" });
    const g = 0.78 * (1 - Math.exp(-kl / 0.35)), wob = on && p > 0.72 ? Math.sin(f.t * 5) * 4 : 0;
    const pos = [lerp(ref[0], hill[0], g) + wob * 0.6, lerp(ref[1], hill[1], g) - wob];
    // leash: slack curve that tightens as KL grows
    const taut = clamp01(g / 0.7), mid = [(ref[0] + pos[0]) / 2 + (1 - taut) * 40, (ref[1] + pos[1]) / 2 + (1 - taut) * 50];
    k.curve([ref, [mid[0], mid[1]], [mid[0], mid[1]], pos], { col: taut > 0.85 ? C.ink : C.muted, lw: 1.5 + taut * 2 });
    k.dot(ref[0], ref[1], 9, C.muted); k.label(ref[0] - (nar ? 20 : 0), ref[1] + 34, "reference (start)", { align: nar ? "left" : "center", col: C.muted, size: 11 });
    k.dot(pos[0], pos[1], 11, C.sig, { glow: 16 }); k.label(pos[0] + 16, pos[1] + 2, "policy", { align: "left", col: C.sig, size: 11.5, weight: "600" });
    if (on && p > 0.12 && p < 0.75) k.flow(u => [lerp(pos[0], hill[0], u), lerp(pos[1], hill[1], u)], 2, f.t * 0.8, C.amb, { size: 2.5, alpha: 0.7 });
    if (!nar) k.label(PX + PW / 2, PY + PH - 18, "leash = KL distance, strength β", { col: C.muted, size: 11 });
    // probability bars: reference (outline) and trained (filled)
    const BX = nar ? 4120 : 4070, BW = nar ? 330 : 360, BY = nar ? 90 : 62, RH = nar ? 100 : 82, lo = nar ? 26 : 24, bh = nar ? 32 : 26;
    k.label(BX, BY - 26, nar ? "Chance of each reply" : "Chance of giving each reply · white tick = before training", { align: "left", col: C.ink, weight: "600" });
    CANDS.forEach(([, short, ref0, r], i) => {
      const y = BY + i * RH;
      k.label(BX, y + 10, short, { align: "left", col: C.muted, size: 11.5 });
      k.box(BX, y + lo, BW, bh, { fill: C.line, r: 5, alpha: 0.3 });
      k.box(BX, y + lo, pi[i] * BW, bh, { fill: r > 0 ? C.sig : C.amb, r: 5, alpha: 0.85 });
      k.box(BX + ref0 * BW - 1.5, y + lo - 4, 3, bh + 8, { fill: C.ink, r: 1 });
      k.label(BX + BW + 8, y + lo + bh / 2, Math.round(pi[i] * 100) + "%", { align: "left", col: C.ink, size: 11.5, mono: true, weight: "600" });
    });
    if (on) hud(k, "br", "bl", "RLHF objective", [["leash β", beta.toFixed(beta < 2 ? 2 : 1)], ["KL from reference", kl.toFixed(2) + " nats"], ["expected reward", (er >= 0 ? "+" : "") + er.toFixed(2), C.sig]], 220, 1);
  }

  /* ---------- 6. DPO ---------- */
  function drawDPO(k, f) {
    const C = k.C, p = f.at("dpo"), on = f.key === "dpo";
    const X0 = 4980, W = 760, bw = nar ? 170 : 160, gap = (W - 4 * bw) / 3, bx = i => X0 + i * (bw + gap), RY = 70, DY = 300, bh = 74;
    const node = (x, y, label, col, a, sub) => { k.box(x, y, bw, bh, { fill: C.bg2, stroke: col, r: 12, alpha: a }); k.text(x + bw / 2, y + bh / 2 - (sub ? 8 : 0), label, { col: C.ink, size: nar ? 22 : 14, weight: "600", alpha: a }); if (sub) k.text(x + bw / 2, y + bh / 2 + 14, sub, { col: C.muted, size: nar ? 18 : 11.5, alpha: a }); };
    const top = ["Preference pairs", "Reward model", "RL + KL leash", "New policy"], dim = 1 - 0.55 * ease(p, 0.4, 0.5);
    k.label(X0, RY - 22, "RLHF: three stages", { align: "left", col: C.muted, weight: "600" });
    top.forEach((t, i) => node(bx(i), RY, t, i === 3 ? C.sig : C.line, dim));
    for (let i = 0; i < 3; i++) { const x1 = bx(i) + bw + 4, x2 = bx(i + 1) - 4, y = RY + bh / 2; k.line(x1, y, x2, y, { col: C.line, alpha: dim });
      const a = ease(p, 0.02 + i * 0.1, 0.08 + i * 0.1) * (1 - ease(p, 0.38, 0.45)); if (a > 0) k.flow(u => [lerp(x1, x2, u), y], 2, f.t * 0.7 + i * 0.3, C.sig, { size: 3, alpha: a }); }
    // DPO row
    const da = ease(p, 0.36, 0.48);
    k.label(X0, DY - 22, "DPO: one step", { align: "left", col: da > 0.5 ? C.sig : C.muted, weight: "600", alpha: Math.max(0.3, da) });
    node(bx(0), DY, "Preference pairs", C.line, Math.max(0.3, da)); node(bx(3), DY, "New policy", C.sig, Math.max(0.3, da));
    const x1 = bx(0) + bw + 4, x2 = lerp(x1, bx(3) - 4, da), y = DY + bh / 2;
    k.line(x1, y, x2, y, { col: C.sig, lw: 2.5, glow: 8 });
    if (da >= 1) { k.flow(u => [lerp(x1, bx(3) - 4, u), y], 3, f.t * 1.2, C.sig, { size: 3.2 });
      if (!nar) k.label((x1 + bx(3)) / 2, y - 16, "a loss on the pairs, compared with the reference model", { col: C.ink, size: 11.5 }); }
    // what the loss does to one pair: preferred up, rejected down, relative to the reference
    const sh = ease(p, 0.55, 0.92), BY = DY + bh + 50, mid = X0 + W / 2, u = nar ? 60 : 70;
    k.label(mid, BY - 14, "log π / π_ref after training on the pair", { col: C.muted, size: 11, alpha: ease(p, 0.5, 0.56) });
    [["preferred B", 1.6, C.sig], ["rejected A", -1.4, C.amb]].forEach(([nm, v, col], i) => {
      const yy = BY + 8 + i * 40, w = v * u * sh;
      k.label(mid - 2.2 * u - 12, yy + 10, nm, { align: "right", col: C.ink, size: 11.5, alpha: ease(p, 0.5, 0.56) });
      k.box(w >= 0 ? mid : mid + w, yy, Math.abs(w), 20, { fill: col, r: 4, alpha: 0.9 });
      if (sh > 0.1) k.label(v > 0 ? mid + w + 10 : mid + 10, yy + 10, v > 0 ? "more likely" : "less likely", { align: "left", col, size: 11.5, weight: "600" });
    });
    k.line(mid, BY + 2, mid, BY + 76, { col: C.ink, alpha: 0.5 * ease(p, 0.5, 0.56) });
    if (on) hud(k, "br", "tl", "DPO", [["reward model", "none", C.sig], ["RL loop", "none", C.sig], ["needs", "pairs + reference model"]], 240, 0);
  }

  storyFilm(fig, {
    label: "Animated explanation of how a base model becomes an assistant",
    steps, cams,
    draw(k, f) {
      nar = narrow();
      const c = k.cam, near = (a, b) => c.x + c.w > a && c.x < b;
      if (near(-200, 1150)) drawChat(k, f);
      if (near(1150, 2350)) drawPrefs(k, f);
      if (near(2350, 3550)) drawRM(k, f);
      if (near(3550, 4750)) drawRL(k, f);
      if (near(4750, 5950)) drawDPO(k, f);
    }
  });
});
