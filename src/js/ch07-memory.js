/* Chapter 7 · Memory. You manage one GPU's memory while conversations arrive.
   Model: Llama 3 8B on one 80 GB H100. Weights 16 GB; KV cache 128 KiB per token
   (2 × 32 layers × 8 KV heads × 128 dims × 2 bytes). One square = 1,024 tokens of notes = 128 MiB. */
chapter("memory", () => {
  const COLS = 30, ROWS = 20, N = COLS * ROWS, CELL = 28, GAP = 4, GX = 300, GY = 110;
  const W_CELLS = 120;                    // ≈ 16 GB of weights at 128 MiB per square
  const TOK_PER_CELL = 1024, SYS = 2000, DECODE = 150; // tokens per second per conversation (time sped up)
  const KIB_PER_TOK = 128, GB = c => c * 128 / 1024 * 1.073741824; // squares -> GB (128 MiB each)
  const cols = ["#5ce1c6", "#ffb547", "#8fb3ff", "#d59cff", "#ff8fa3", "#9be37a", "#7fdcff", "#ffd27a"];
  const cellXY = c => [GX + (c % COLS) * (CELL + GAP), GY + Math.floor(c / COLS) * (CELL + GAP)];
  const fmtGB = g => g < 10 ? g.toFixed(1) + " GB" : Math.round(g) + " GB";

  function init(rand) {
    return { t: 0, convs: [], owner: new Int32Array(N).fill(-1), shared: [], nextId: 0, arriveAcc: 0, done: 0, tokOut: 0,
      preempted: 0, sel: -1, flyOut: [], fullFor: 0, goalFor: 0, longDoc: 0, rand };
  }
  const freeCells = s => { const r = []; for (let c = W_CELLS; c < N; c++) if (s.owner[c] === -1) r.push(c); return r; };
  const tokensOf = (s, cv) => (s.sharePrefix && s.mode === "paged" ? 0 : SYS) + cv.prompt + Math.floor(cv.gen);
  const cellsNeeded = (s, cv, extra = 0) => Math.ceil((tokensOf(s, cv) + extra) / TOK_PER_CELL);
  function release(s, cv) { cv.cells.forEach(c => { s.owner[c] = -1; }); cv.cells = []; }
  function newConv(s, prompt, reply, tag) {
    const cv = { id: s.nextId++, prompt, reply, gen: 0, cells: [], state: "wait", col: cols[s.nextId % cols.length], tag, born: s.t };
    s.convs.push(cv); return cv;
  }
  function ensureShared(s) {
    const need = s.mode === "paged" && s.sharePrefix && s.convs.some(c => c.state === "run");
    if (need && !s.shared.length) { const f = freeCells(s); const k = Math.ceil(SYS / TOK_PER_CELL); if (f.length >= k) { s.shared = f.slice(0, k); s.shared.forEach(c => s.owner[c] = -2); } }
    if (!need && s.shared.length) { s.shared.forEach(c => s.owner[c] = -1); s.shared = []; }
  }
  function admit(s) {
    const waiting = s.convs.filter(c => c.state === "wait");
    for (const cv of waiting) {
      if (s.mode === "reserve") {
        if (SYS + cv.prompt + 64 > s.maxLen) { cv.tooLong = true; continue; } // can never fit its booking
        cv.tooLong = false;
        const k = Math.ceil(s.maxLen / TOK_PER_CELL); let run = 0, start = -1;
        for (let c = W_CELLS; c < N; c++) { if (s.owner[c] === -1) { run++; if (run === k) { start = c - k + 1; break; } } else run = 0; }
        if (start < 0) return; // first in line blocks the rest: no room
        for (let c = start; c < start + k; c++) { s.owner[c] = cv.id; cv.cells.push(c); }
      } else {
        ensureShared(s); const f = freeCells(s), k = cellsNeeded(s, cv, 1);
        if (f.length < k + 1) return;
        f.slice(0, k).forEach(c => { s.owner[c] = cv.id; cv.cells.push(c); });
      }
      cv.state = "run"; cv.admitT = s.t;
    }
  }
  function capReply(s, cv) { const room = s.maxLen - SYS - cv.prompt; return Math.max(64, Math.min(cv.reply, room)); }
  function relayout(s) { // strategy changed: put everyone back in line and re-admit in arrival order
    s.convs.forEach(cv => { release(s, cv); if (cv.state === "run") cv.state = "wait"; }); s.shared.forEach(c => s.owner[c] = -1); s.shared = []; admit(s);
  }

  function step(s, dt) {
    s.t += dt;
    // arrivals (seeded, roughly Poisson)
    s.arriveAcc += dt * s.rate;
    while (s.arriveAcc >= 1) { s.arriveAcc -= 1 + (s.rand() - 0.5) * 0.6; newConv(s, 500 + Math.floor(s.rand() * 4500), 400 + Math.floor(s.rand() * 2600)); }
    if (s.longDoc) { newConv(s, 30000, 1500, "doc"); s.longDoc = 0; }
    // generation
    for (const cv of s.convs) {
      if (cv.state !== "run") continue;
      const target = capReply(s, cv); cv.gen = Math.min(target, cv.gen + DECODE * dt); s.tokOut += DECODE * dt;
      if (s.mode === "paged") {
        const need = cellsNeeded(s, cv);
        while (cv.cells.length < need) {
          const f = freeCells(s);
          if (f.length) { s.owner[f[0]] = cv.id; cv.cells.push(f[0]); continue; }
          // out of memory mid-reply: pause the newest conversation and send it back to the line
          const victim = s.convs.filter(c => c.state === "run" && c !== cv).sort((a, b) => b.admitT - a.admitT)[0];
          if (!victim) break; release(s, victim); victim.state = "wait"; victim.gen = 0; s.preempted++; s.lastPreempt = s.t;
        }
      }
      if (cv.gen >= target) { cv.state = "done"; release(s, cv); s.done++; s.flyOut.push({ t: s.t, col: cv.col, y: GY + 40 + (cv.id * 37) % 560 }); }
    }
    s.convs = s.convs.filter(c => c.state !== "done");
    s.flyOut = s.flyOut.filter(f => s.t - f.t < 1.6);
    admit(s); ensureShared(s);
    const st = stats(s);
    s.goalFor = st.running >= 30 && st.waiting === 0 ? s.goalFor + dt : 0;
  }
  function stats(s) {
    let used = 0, reserved = 0, running = 0, waiting = 0;
    for (const cv of s.convs) { if (cv.state === "run") { running++; reserved += cv.cells.length; used += tokensOf(s, cv); } else waiting++; }
    reserved += s.shared.length; used += s.shared.length ? SYS : 0;
    const usedGB = used * KIB_PER_TOK / 1048576 * 1.073741824, resGB = GB(reserved);
    return { running, waiting, usedGB, resGB, emptyGB: Math.max(0, resGB - usedGB), wastePct: resGB > 0 ? Math.max(0, (resGB - usedGB) / resGB) : 0, freeGB: GB(freeCells(s).length) };
  }

  function hatch(k, x, y, w, h, col) { const c = k.ctx; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = k.px(1.1); for (let d = -h; d < w; d += 7) { c.beginPath(); c.moveTo(x + d, y + h); c.lineTo(x + d + h, y); c.stroke(); } c.restore(); }

  function draw(k, s, sim) {
    const C = k.C, byId = new Map(s.convs.map(c => [c.id, c])), narrow = sim.narrow;
    // grid frame + labels
    k.box(GX - 14, GY - 44, COLS * (CELL + GAP) + 24, ROWS * (CELL + GAP) + 58, { stroke: C.line, r: 16 });
    k.label(GX, GY - 24, narrow ? "GPU memory · 80 GB" : "One GPU's memory · 80 GB · each square holds notes for 1,024 tokens (128 MB)", { align: "left", col: C.ink, weight: "600" });
    for (let c = 0; c < N; c++) {
      const [x, y] = cellXY(c), o = s.owner[c];
      if (c < W_CELLS) { k.box(x, y, CELL, CELL, { fill: C.muted, r: 5, alpha: 0.75 }); continue; }
      if (o === -1) { k.box(x, y, CELL, CELL, { fill: C.line, r: 5, alpha: 0.35 }); continue; }
      if (o === -2) { k.box(x, y, CELL, CELL, { fill: C.ink, r: 5, glow: 12, glowCol: C.ink }); continue; }
      const cv = byId.get(o); if (!cv) continue;
      const idx = cv.cells.indexOf(c), filledCells = tokensOf(s, cv) / TOK_PER_CELL;
      const full = idx + 1 <= filledCells, part = !full && idx < filledCells;
      const sel = s.sel === cv.id;
      if (full || part) {
        k.box(x, y, CELL, CELL, { fill: cv.col, r: 5, alpha: sel || s.sel < 0 ? 0.92 : 0.35 });
        if (part) k.box(x, y, CELL * (filledCells - idx), CELL, { fill: "#ffffff", r: 5, alpha: 0.25 });
      } else { k.box(x, y, CELL, CELL, { stroke: cv.col, r: 5, alpha: 0.75, lw: 1 }); hatch(k, x, y, CELL, CELL, cv.col); }
      if (sel) k.box(x - 2, y - 2, CELL + 4, CELL + 4, { stroke: C.ink, r: 7, lw: 2 });
      if (cv.tag === "doc" && idx === 0) k.label(x + CELL / 2, y + CELL / 2, "doc", { col: C.bg, size: 10, weight: "700" });
    }
    k.label(GX + COLS * (CELL + GAP) / 2, GY + 2 * (CELL + GAP) - 2, "the model itself · 16 GB", { col: C.ink, size: 12, weight: "600", bg: true });
    // waiting line (left)
    const waiting = s.convs.filter(c => c.state === "wait");
    if (!narrow) {
      k.label(150, GY - 24, waiting.length ? `Waiting · ${waiting.length}` : "Waiting · nobody", { col: waiting.length ? C.amb : C.muted, weight: "600" });
      waiting.slice(0, 26).forEach((cv, i) => { const x = 110 + (i % 4) * 26, y = GY + 14 + Math.floor(i / 4) * 30; k.dot(x, y, 9, cv.col, { glow: cv.tag === "doc" ? 14 : 0 }); if (cv.tag === "doc") k.label(x, y, "doc", { col: C.bg, size: 9, weight: "700" }); });
      if (waiting.length > 26) k.label(150, GY + 14 + 7 * 30, `+${waiting.length - 26} more`, { col: C.amb, size: 11 });
      k.line(260, GY - 30, 260, GY + ROWS * (CELL + GAP), { col: C.line, dash: [4, 6] });
      // finished replies leave to the right
      const rx = GX + COLS * (CELL + GAP) + 30;
      k.label(rx + 90, GY - 24, `Replies finished · ${s.done}`, { col: C.sig, weight: "600" });
      s.flyOut.forEach(f => { const u = (s.t - f.t) / 1.6, x = rx + u * 220; k.trail([[x - 40, f.y], [x - 20, f.y], [x, f.y]], f.col, { w: 3, alpha: 1 - u }); k.dot(x, f.y, 5, f.col, { alpha: 1 - u, glow: 8 }); });
    } else k.label(GX, GY + ROWS * (CELL + GAP) + 16, waiting.length ? `${waiting.length} waiting for memory` : "Nobody waiting", { align: "left", col: waiting.length ? C.amb : C.sig, size: 13, weight: "600" });
    // selected conversation readout
    if (s.sel >= 0) { const cv = byId.get(s.sel); if (cv) k.hud(narrow ? "bl" : "tr", "Conversation you picked", [["tokens so far", tokensOf(s, cv).toLocaleString()], ["notes in memory", (tokensOf(s, cv) * KIB_PER_TOK / 1024).toFixed(0) + " MB", C.sig], ["squares held", String(cv.cells.length)], [s.mode === "reserve" ? "reserved, still empty" : "empty space held", (cv.cells.length - tokensOf(s, cv) / TOK_PER_CELL).toFixed(1) + " squares", C.amb]], { w: 230 }); else s.sel = -1; }
  }

  const sim = makeSim($("#mem-sim"), {
    label: "GPU memory simulation. Squares are memory; grey is the model, colours are conversations' notes, striped squares are reserved but empty. Click a coloured square to inspect that conversation.",
    cams: { default: { x: 60, y: 50, w: 1500, h: 720 } },
    camsNarrow: { default: { x: 280, y: 60, w: 990, h: 740 } },
    init, warmup: 14,
    intro: "Conversations arrive and each one fills memory with notes as it writes. Press <b>Run</b> if it isn't moving, then try the controls.",
    controls: [
      { id: "mode", label: "How memory is handed out", type: "choice", value: "reserve", options: [["reserve", "Book the maximum"], ["paged", "Paging"]], help: "Book: room for the longest allowed chat, up front. Paging: small blocks as each chat grows.", apply: (s, v) => { const ch = s.mode && s.mode !== v; s.mode = v; if (ch) relayout(s); } },
      { id: "share", label: "Share the hidden instructions every chat starts with", type: "toggle", value: false, help: "Works with paging: one copy of the 2,000-token system prompt for everyone.", apply: (s, v) => { const ch = s.sharePrefix !== undefined && s.sharePrefix !== v; s.sharePrefix = v; if (ch && s.mode === "paged") relayout(s); } },
      { id: "rate", label: "New people per second", type: "range", min: 0.5, max: 8, step: 0.5, value: 3, fmt: v => v + " / s", apply: (s, v) => { s.rate = v; } },
      { id: "max", label: "Longest conversation allowed", type: "range", min: 8192, max: 32768, step: 4096, value: 16384, fmt: v => (v / 1024) + "k tokens", help: "Reserve mode books this much for everyone.", apply: (s, v) => { const ch = s.maxLen && s.maxLen !== v; s.maxLen = v; if (ch && s.mode === "reserve") relayout(s); } },
      { id: "doc", label: "Paste a 30,000-token document", type: "button", apply: s => { s.longDoc = 1; } }
    ],
    step, draw,
    click: (s, wx, wy) => { const c = Math.floor((wx - GX) / (CELL + GAP)) + COLS * Math.floor((wy - GY) / (CELL + GAP)); const inGrid = wx >= GX && wy >= GY && (wx - GX) < COLS * (CELL + GAP) && (wy - GY) < ROWS * (CELL + GAP); s.sel = inGrid && s.owner[c] >= 0 ? s.owner[c] : -1; },
    stats: s => { const st = stats(s); return [["chatting now", String(st.running), st.running >= 30 ? "ok" : ""], ["waiting for memory", String(st.waiting), st.waiting ? "hot" : "ok"], ["notes actually stored", fmtGB(st.usedGB)], ["reserved but empty", fmtGB(st.emptyGB) + " · " + Math.round(st.wastePct * 100) + "%", st.wastePct > 0.4 ? "bad" : ""], ["replies finished", String(s.done)]]; },
    goal: { text: "keep 30 people chatting at once with nobody waiting, for 5 seconds", check: s => { const st = stats(s); return { done: s.goalFor >= 5, progress: `${st.running} chatting · ${st.waiting} waiting` }; } },
    notices: [
      { id: "shareReserve", when: s => s.sharePrefix && s.mode === "reserve", say: () => "Sharing only works with paging: a reserved block belongs to one conversation, so there's nothing to share. Switch to <b>Paging</b>." },
      { id: "preempt", when: s => s.lastPreempt && s.t - s.lastPreempt < 2, say: s => `Memory ran out in the middle of a reply, so the server paused the newest conversation and sent it back to the line (${s.preempted} so far). Real paged servers do exactly this.` },
      { id: "doc", when: s => s.convs.some(c => c.tag === "doc"), say: s => { const d = s.convs.find(c => c.tag === "doc"); return d.state === "wait" ? `The 30,000-token document needs about <b>${(30000 * KIB_PER_TOK / 1048576 * 1.074).toFixed(1)} GB</b> of notes before it writes a word${s.mode === "reserve" && s.maxLen < 32768 ? ", more than this server lets one conversation reserve, so it can't get in at all. Raise the longest-conversation limit or switch to paging" : ". It's waiting for that much space to free up"}.` : "The document is in. One long conversation takes as much memory as a dozen short ones."; } },
      { id: "wasteR", when: s => s.mode === "reserve" && stats(s).waiting > 2 && stats(s).wastePct > 0.4, say: s => { const st = stats(s); return `Look at the striped squares: <b>${fmtGB(st.emptyGB)}</b> is reserved but holds nothing, while ${st.waiting} people wait. Each chat booked room for ${s.maxLen.toLocaleString()} tokens but most use far less.`; } },
      { id: "paged", when: s => s.mode === "paged" && stats(s).running >= 25, say: s => { const st = stats(s); return `With paging, memory is handed out a square at a time as each reply grows. The same GPU now holds <b>${st.running}</b> conversations, and only ${fmtGB(st.emptyGB)} is reserved but empty.`; } },
      { id: "shared", when: s => s.sharePrefix && s.mode === "paged" && s.shared.length, say: s => { const st = stats(s); return `The white squares are the 2,000-token instructions every chat starts with, stored once and used by all ${st.running}. Without sharing they would take ${fmtGB(st.running * SYS * KIB_PER_TOK / 1048576 * 1.074)}.`; } },
      { id: "calm", when: s => stats(s).waiting === 0 && stats(s).running > 0, say: s => `Everyone fits right now: ${stats(s).running} conversation${stats(s).running === 1 ? "" : "s"}, ${fmtGB(stats(s).freeGB)} free. Turn up "new people per second" to see where this setup breaks.` }
    ],
    facts: [
      { id: "gqa", when: s => stats(s).usedGB > 30, text: "This model saves memory with a trick called grouped-query attention: 32 attention heads share just 8 sets of notes. Without it, every token would need 4× as much memory, 512 KB instead of 128 KB.", ref: "#ref-9" },
      { id: "vllm", when: s => s.mode === "reserve" && stats(s).wastePct > 0.6, text: "When the vLLM team measured servers that reserved memory up front, 60–80% of the memory set aside for notes was wasted. Paging cut the waste to under 4%.", ref: "#ref-34" },
      { id: "mla", when: s => s.mode === "paged" && stats(s).running >= 40, text: "DeepSeek went further: its models squeeze each token's notes into a small compressed vector, which cut the notes' memory by 93% compared with its earlier 67-billion-parameter model.", ref: "#ref-62" }
    ],
    tour: [
      { say: "This server reserves room for the longest allowed conversation (16k tokens) the moment someone arrives. Watch the line on the left.", set: { mode: "reserve", share: false, rate: 3, max: 16384 }, wait: 7 },
      { say: "Striped squares are booked but empty. Most chats are a few thousand tokens, so most of every booking is wasted, and people wait even though memory isn't really full.", wait: 6 },
      { say: "Now switch to <b>paging</b>: each chat gets a square only when its notes need one.", set: { mode: "paged" }, until: s => stats(s).running >= 25, max: 12 },
      { say: "Every chat starts with the same 2,000 tokens of hidden instructions. With sharing on, they're stored once (white squares).", set: { share: true }, wait: 6 },
      { say: "Finally, someone pastes a 30,000-token document. Watch how much memory one long conversation takes.", act: s => { s.longDoc = 1; }, wait: 7 }
    ],
    publish: s => { const st = stats(s); const toks = Math.round(st.usedGB * 1048576 / KIB_PER_TOK / 1.073741824); return { memToks: toks.toLocaleString(), memGB: fmtGB(st.usedGB), memRun: String(st.running), memWaste: Math.round(st.wastePct * 100) + "%", memEmpty: fmtGB(st.emptyGB) }; }
  });
});
