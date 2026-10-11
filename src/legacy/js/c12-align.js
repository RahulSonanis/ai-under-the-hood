/* Chapter 12: training stages + KL-regularised optimum */
chapter("align", () => {
  const P = [
    ["What is the capital of Australia? What is the capital of Canada? What is the capital of Brazil? Test your geography with these 50 quiz questions, answers at the bottom of the page.",
     "The capital of Australia is Canberra. Many people assume it is Sydney or Melbourne, but Canberra was purpose-built as the capital, partly as a compromise between those two cities. It is in the Australian Capital Territory and is home to Parliament House.",
     "Canberra. (A common mix-up is Sydney, which is the largest city.)"],
    ["I think my startup idea is perfect. You agree, right? Reply #3: honestly no idea is perfect lol. Reply #4: what's the idea?? Reply #5: posted from my phone",
     "Absolutely! Believing in your idea is the first step to success. With passion and hard work, any startup can succeed. Go for it!",
     "I'd like to help you test it rather than just agree. Could you tell me the idea, who it's for, and what they use today? Then I can point out its strengths and the risks worth checking before you invest more."],
    ["Explain what a GPU is in one sentence. Explain what a CPU is in one sentence. Explain what RAM is in one sentence. Explain what an SSD is",
     "A GPU, or graphics processing unit, is a specialized electronic circuit originally designed to accelerate the creation of images for display, which has since become essential for many computing tasks including scientific simulation, cryptocurrency mining, machine learning, video editing, and gaming, thanks to its massively parallel architecture with thousands of cores.",
     "A GPU is a chip with thousands of small cores that do many calculations at once, which makes it fast at graphics and at the matrix maths behind AI."]
  ];
  const WHY = ["The base model continues the text the way a web page might. It has the knowledge, but no idea it's supposed to answer.", "After fine-tuning on example conversations it answers in the right format, but can be wordy, ignore constraints like 'one sentence', or tell people what they want to hear.", "Feedback training rewards answers people prefer: accurate, appropriately short, honest rather than flattering."];
  const NAMES = ["Base model (pretraining only)", "After supervised fine-tuning", "After learning from feedback"];
  const stage = seg($("#st-s"), show);
  function show() { const s = +stage(), p = +$("#st-p").value; $("#st-who").textContent = NAMES[s]; $("#st-out").textContent = P[p][s]; $("#st-why").textContent = WHY[s]; }
  $("#st-p").addEventListener("change", show); show();

  const cands = [
    { n: "Finds the null field, shows a fix, explains why", ref: 0.30, r: 2.0 },
    { n: "Correct fix, no explanation", ref: 0.25, r: 1.2 },
    { n: "Confident but wrong fix", ref: 0.15, r: -1.0 },
    { n: "Flatters: 'your code looks great, probably a JVM bug'", ref: 0.15, r: -1.5, flaw: 2.6 },
    { n: "Unhelpful: 'please read the documentation'", ref: 0.15, r: -2.0 }
  ];
  function run() {
    const beta = 10 ** num("kl-b"), flaw = checked("kl-flaw");
    const rm = cands.map(c => flaw && c.flaw !== undefined ? c.flaw : c.r), lg = cands.map((c, i) => Math.log(c.ref) + rm[i] / beta), mx = Math.max(...lg);
    const ex = lg.map(l => Math.exp(l - mx)), Z = ex.reduce((a, b) => a + b), pi = ex.map(e => e / Z);
    const kl = pi.reduce((a, p, i) => a + (p > 0 ? p * Math.log(p / cands[i].ref) : 0), 0), trueR = pi.reduce((a, p, i) => a + p * cands[i].r, 0), refR = cands.reduce((a, c) => a + c.ref * c.r, 0), proxy = pi.reduce((a, p, i) => a + p * rm[i], 0);
    const cv = $("#kl-cv"); const W = innerW(cv.parentElement), narrow = W < 520, rowH = narrow ? 58 : 44, H = cands.length * rowH + 24; const { ctx, w } = setupCanvas(cv, H); ctx.clearRect(0, 0, w, H);
    const lw = narrow ? 0 : Math.min(250, w * 0.42), bx = lw + 8, bw = w - bx - 44;
    cands.forEach((c, i) => { const y = i * rowH + 4; font(ctx, 12); ctx.fillStyle = css("--ink"); ctx.textAlign = "left"; const lab = c.n.length > (narrow ? 64 : 40) ? c.n.slice(0, narrow ? 62 : 38) + "…" : c.n; ctx.fillText(lab, 0, narrow ? y + 10 : y + 18);
      const by = narrow ? y + 18 : y + 4; ctx.fillStyle = css("--grid"); ctx.fillRect(bx, by, bw, 12); ctx.fillRect(bx, by + 15, bw, 12);
      ctx.fillStyle = css("--muted"); ctx.fillRect(bx, by, bw * c.ref, 12); ctx.fillStyle = c.flaw !== undefined && flaw ? css("--crit") : css("--accent"); ctx.fillRect(bx, by + 15, bw * pi[i], 12);
      font(ctx, 11, "--f-mono"); ctx.fillStyle = css("--muted"); ctx.textAlign = "right"; ctx.fillText(Math.round(pi[i] * 100) + "%", w, by + 25); });
    font(ctx, 11); ctx.fillStyle = css("--muted"); ctx.textAlign = "left"; ctx.fillText(flaw ? "grey = before training · after: blue, red for the flattering reply" : "grey = before training · blue = after", bx, H - 4);
    $("#kl-read").innerHTML = `<div class="readout"><div class="k">Reward-model score</div><div class="v">${proxy.toFixed(2)}</div><div class="s">what training sees</div></div>
      <div class="readout ${trueR > refR ? "ok" : "bad"}"><div class="k">True quality</div><div class="v">${trueR.toFixed(2)}</div><div class="s">before training: ${refR.toFixed(2)}</div></div>
      <div class="readout"><div class="k">Drift (KL)</div><div class="v">${kl.toFixed(2)}</div></div>`;
  }
  bindCtl("kl-b", run, e => (10 ** +e.value).toFixed(2)); $("#kl-flaw").addEventListener("change", run); onRedraw(run);
});
