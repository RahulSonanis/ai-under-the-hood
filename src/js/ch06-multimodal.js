/* Chapter 6 · Beyond text. The learner picks a procedurally drawn picture, sets the resolution it is sent at and the
   patch size, and watches it cut into patches that join the text tokens in the model's input. Optional 4-second voice
   note: waveform -> spectrogram -> one token per 20 ms (as in Whisper's encoder: 10 ms frames, halved by a stride-2
   convolution). Token count = ceil(R/P)^2 per image. Readability rule is ILLUSTRATIVE: letters need ~8 pixels of
   height; patches above 16 px squeeze more pixels into the same-size vector (ViT-Base: 16x16x3 = 768 numbers in,
   768-wide vectors), modelled as a loss of detail by 16/P. Price is illustrative: $3 per million input tokens. */
chapter("multimodal", () => {
  const MASTER = 1024, PROMPT = ["What", " does", " the", " label", " say", "?"], BUDGET = 300, VOICE_S = 4, VOICE_TOK = VOICE_S * 50, PRICE = 3 / 1e6;
  const PICS = {
    bottle: { name: "Pill bottle", letter: 0.034, crop: [0.31, 0.44, 0.38, 0.17], text: "TAKE 2 DAILY" },
    sign: { name: "Shop sign", letter: 0.08, crop: [0.13, 0.28, 0.74, 0.19], text: "BAKERY" },
    cat: { name: "Cat", letter: 0, crop: [0.3, 0.42, 0.4, 0.3], text: "" }
  };
  const fmtN = n => Math.round(n).toLocaleString();
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const ff = () => getComputedStyle(document.documentElement).getPropertyValue("--f-display") || "sans-serif";

  // ---------- procedural pictures (drawn once at 1024 px) ----------
  function drawBottle(g, S) {
    let gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, "#efe7d6"); gr.addColorStop(1, "#d9cfba"); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = "#a47148"; g.fillRect(0, S * 0.8, S, S * 0.2); g.fillStyle = "#8a5a35"; g.fillRect(0, S * 0.8, S, S * 0.015);
    g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.ellipse(S * 0.52, S * 0.86, S * 0.25, S * 0.03, 0, 0, 7); g.fill();
    gr = g.createLinearGradient(S * 0.3, 0, S * 0.7, 0); gr.addColorStop(0, "#b8620a"); gr.addColorStop(0.35, "#e39a2d"); gr.addColorStop(1, "#9c4f06");
    g.fillStyle = gr; rr(g, S * 0.3, S * 0.3, S * 0.4, S * 0.55, S * 0.04); g.fill();
    g.fillStyle = "#fafafa"; rr(g, S * 0.28, S * 0.19, S * 0.44, S * 0.13, S * 0.02); g.fill();
    g.strokeStyle = "#d6d6d6"; g.lineWidth = S * 0.004; for (let x = 0.3; x < 0.71; x += 0.025) { g.beginPath(); g.moveTo(S * x, S * 0.2); g.lineTo(S * x, S * 0.31); g.stroke(); }
    g.fillStyle = "#ffffff"; g.fillRect(S * 0.32, S * 0.44, S * 0.36, S * 0.3);
    g.fillStyle = "#1f2a44"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.font = `800 ${S * 0.047}px ${ff()}`; g.fillText("TAKE 2 DAILY", S * 0.5, S * 0.51);
    g.font = `600 ${S * 0.03}px ${ff()}`; g.fillText("WITH FOOD", S * 0.5, S * 0.565);
    g.fillStyle = "#9aa3b5"; [0.6, 0.63, 0.66, 0.69].forEach((y, i) => g.fillRect(S * 0.35, S * y, S * (i === 3 ? 0.18 : 0.3), S * 0.011));
    g.fillStyle = "#c0392b"; g.fillRect(S * 0.32, S * 0.44, S * 0.36, S * 0.015);
    g.fillStyle = "#ffffff"; [[0.78, 0.83], [0.83, 0.85], [0.2, 0.84]].forEach(([x, y]) => { g.beginPath(); g.ellipse(S * x, S * y, S * 0.03, S * 0.016, 0.3, 0, 7); g.fill(); });
  }
  function drawSign(g, S) {
    let gr = g.createLinearGradient(0, 0, 0, S * 0.3); gr.addColorStop(0, "#7cc4ea"); gr.addColorStop(1, "#bfe3f5"); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = "#ffffff"; [[0.2, 0.1], [0.27, 0.09], [0.7, 0.13]].forEach(([x, y]) => { g.beginPath(); g.ellipse(S * x, S * y, S * 0.07, S * 0.03, 0, 0, 7); g.fill(); });
    g.fillStyle = "#c46a46"; g.fillRect(S * 0.04, S * 0.22, S * 0.92, S * 0.78);
    g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = S * 0.003; for (let y = 0.25; y < 1; y += 0.035) { g.beginPath(); g.moveTo(S * 0.04, S * y); g.lineTo(S * 0.96, S * y); g.stroke(); }
    g.fillStyle = "#2b2d42"; rr(g, S * 0.13, S * 0.28, S * 0.74, S * 0.19, S * 0.02); g.fill();
    g.fillStyle = "#ffd166"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${S * 0.115}px ${ff()}`; g.fillText("BAKERY", S * 0.5, S * 0.38);
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? "#ffffff" : "#d62828"; g.beginPath(); g.moveTo(S * (0.08 + i * 0.084), S * 0.5); g.lineTo(S * (0.08 + (i + 1) * 0.084), S * 0.5); g.lineTo(S * (0.08 + (i + 1) * 0.084), S * 0.57); g.quadraticCurveTo(S * (0.08 + (i + 0.5) * 0.084), S * 0.6, S * (0.08 + i * 0.084), S * 0.57); g.fill(); }
    g.fillStyle = "#fdf0d5"; g.fillRect(S * 0.1, S * 0.63, S * 0.4, S * 0.28); g.strokeStyle = "#5c3d2e"; g.lineWidth = S * 0.012; g.strokeRect(S * 0.1, S * 0.63, S * 0.4, S * 0.28);
    g.fillStyle = "#d4a373"; [[0.2, 0.83], [0.3, 0.84], [0.4, 0.83]].forEach(([x, y]) => { g.beginPath(); g.ellipse(S * x, S * y, S * 0.045, S * 0.03, 0, 0, 7); g.fill(); });
    g.fillStyle = "#5c3d2e"; g.fillRect(S * 0.6, S * 0.63, S * 0.26, S * 0.37); g.fillStyle = "#ffd166"; g.beginPath(); g.arc(S * 0.82, S * 0.82, S * 0.012, 0, 7); g.fill();
  }
  function drawCat(g, S) {
    g.fillStyle = "#1d3557"; g.fillRect(0, 0, S, S);
    g.fillStyle = "#f1faee"; for (let i = 0; i < 40; i++) { const x = (i * 337 % 1000) / 1000, y = (i * 211 % 600) / 1000; g.fillRect(S * x, S * y, S * 0.004, S * 0.004); }
    g.beginPath(); g.arc(S * 0.75, S * 0.2, S * 0.08, 0, 7); g.fill();
    g.fillStyle = "#3d2b1f"; g.fillRect(0, S * 0.8, S, S * 0.2); g.fillStyle = "#6b4f3a"; g.fillRect(0, S * 0.78, S, S * 0.03);
    g.fillStyle = "#0b0b0f";
    g.beginPath(); g.ellipse(S * 0.48, S * 0.67, S * 0.15, S * 0.13, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(S * 0.5, S * 0.5, S * 0.085, 0, 7); g.fill();
    g.beginPath(); g.moveTo(S * 0.43, S * 0.46); g.lineTo(S * 0.44, S * 0.36); g.lineTo(S * 0.49, S * 0.43); g.fill();
    g.beginPath(); g.moveTo(S * 0.57, S * 0.46); g.lineTo(S * 0.56, S * 0.36); g.lineTo(S * 0.51, S * 0.43); g.fill();
    g.strokeStyle = "#0b0b0f"; g.lineWidth = S * 0.03; g.lineCap = "round"; g.beginPath(); g.moveTo(S * 0.6, S * 0.76); g.quadraticCurveTo(S * 0.78, S * 0.78, S * 0.74, S * 0.6); g.stroke();
    g.fillStyle = "#ffd166"; [0.47, 0.53].forEach(x => { g.beginPath(); g.ellipse(S * x, S * 0.49, S * 0.012, S * 0.016, 0, 0, 7); g.fill(); });
  }
  const masters = {};
  function master(pic) { if (!masters[pic]) { const c = mk(MASTER, MASTER), g = c.getContext("2d"); ({ bottle: drawBottle, sign: drawSign, cat: drawCat })[pic](g, MASTER); masters[pic] = c; } return masters[pic]; }
  function down(src, size) { let c = src, w = src.width; while (w / 2 >= size) { const n = mk(w / 2, w / 2); n.getContext("2d").drawImage(c, 0, 0, w / 2, w / 2); c = n; w = w / 2; } const out = mk(size, size), g = out.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, size, size); return out; }
  const views = {};
  function view(pic, res, patch) { // what the model gets: res x res pixels, with detail lost when a patch is squeezed
    const key = pic + "/" + res + "/" + patch; if (views[key]) return views[key];
    let v = down(master(pic), res);
    if (patch > 16) { const eff = Math.max(4, Math.round(res * 16 / patch)), small = down(v, eff), up = mk(res, res), g = up.getContext("2d"); g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, res, res); v = up; }
    return (views[key] = v);
  }

  // ---------- synthetic speech: spectrogram 400 frames (10 ms) x 64 bins ----------
  const FR = VOICE_S * 100, BINS = 64;
  const spec = (() => {
    const r = rng(23), c = mk(FR, BINS), g = c.getContext("2d"), img = g.createImageData(FR, BINS), env = new Float32Array(FR);
    const syl = []; let t = 12; while (t < FR - 20) { const len = 14 + Math.floor(r() * 18); syl.push([t, len, 8 + r() * 10, 22 + r() * 16, 40 + r() * 10]); t += len + (r() < 0.25 ? 18 : 4); }
    for (let f = 0; f < FR; f++) {
      let e = 0, F = null; syl.forEach(s => { const u = (f - s[0]) / s[1]; if (u >= 0 && u <= 1) { e = Math.max(e, Math.sin(Math.PI * u)); F = s; } }); env[f] = e;
      for (let b = 0; b < BINS; b++) {
        let v = 0.06 * r();
        if (F) { [F[2], F[3], F[4]].forEach((fb, i) => { v += e * (1 - i * 0.25) * Math.exp(-Math.pow((b - fb - Math.sin(f / 9) * 2) / 2.6, 2)); }); v += e * 0.25 * (b % 4 === 0 ? 1 : 0.3) * Math.exp(-b / 30); }
        v = Math.min(1, v); const i = ((BINS - 1 - b) * FR + f) * 4;
        img.data[i] = Math.round(20 + 230 * Math.pow(v, 1.4)); img.data[i + 1] = Math.round(30 + 200 * v); img.data[i + 2] = Math.round(70 + 120 * (1 - v) * v * 4 > 255 ? 255 : 70 + 120 * v); img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0); return { c, env };
  })();

  // ---------- model ----------
  const grid = s => Math.ceil(s.res / s.patch);
  const imgTok = s => grid(s) * grid(s);
  const voiceTok = s => s.voice ? VOICE_TOK : 0;
  const total = s => PROMPT.length + imgTok(s) + voiceTok(s);
  const letterPx = s => PICS[s.pic].letter * s.res * Math.min(1, 16 / s.patch);
  const verdict = s => !PICS[s.pic].letter ? "none" : letterPx(s) >= 8 ? "readable" : letterPx(s) >= 5 ? "blurry" : "unreadable";

  function init() { return { t: 0, t0: 0, pic: "bottle", res: 224, patch: 16, voice: false, sel: -1, goalFor: 0 }; }
  const restart = s => { s.t0 = s.t; s.sel = -1; };
  function step(s, dt) { s.t += dt; s.goalFor = s.pic === "bottle" && verdict(s) === "readable" && total(s) <= BUDGET ? s.goalFor + dt : 0; }
  // arrival schedule (seconds since t0): words, then patches, then sound
  const T_TXT = 0.6, T_IMG = 3.2, T_AUD = 1.2;
  function arrived(s) {
    const u = s.t - s.t0, nI = imgTok(s), nA = voiceTok(s);
    const txt = Math.min(PROMPT.length, Math.floor(PROMPT.length * u / T_TXT));
    const img = u < T_TXT ? 0 : Math.min(nI, Math.floor(nI * (u - T_TXT) / T_IMG));
    const aud = u < T_TXT + T_IMG ? 0 : Math.min(nA, Math.floor(nA * (u - T_TXT - T_IMG) / T_AUD));
    return { txt, img, aud, u, fImg: nI * (u - T_TXT) / T_IMG, fAud: nA * (u - T_TXT - T_IMG) / T_AUD };
  }

  // ---------- layout ----------
  function layout(narrow) {
    if (!narrow) return { narrow, P: { x: 20, y: 46, w: 360 }, V: { x: 420, y: 46, w: 230 }, Z: { x: 420, y: 316, w: 230, h: 90 }, A: { x: 20, y: 470, w: 630, h: 140 }, G: { x: 700, y: 100, w: 560, h: 500 }, T: { x: 700, y: 46 } };
    return { narrow, P: { x: 10, y: 40, w: 260 }, V: { x: 290, y: 40, w: 260 }, Z: { x: 10, y: 334, w: 540, h: 76 }, A: { x: 10, y: 790, w: 540, h: 50 }, G: { x: 10, y: 528, w: 540, h: 220 }, T: { x: 10, y: 478 } };
  }
  // token grid geometry (image + audio tokens; the text tokens get their own row of chips)
  function gridGeo(s, L) {
    const n = imgTok(s) + voiceTok(s), G = L.G;
    let cols = Math.max(1, Math.ceil(Math.sqrt(n * G.w / G.h))); let cell = G.w / cols; while (Math.ceil(n / cols) * cell > G.h) { cols++; cell = G.w / cols; }
    return { n, cols, cell, x: G.x, y: G.y };
  }
  const cellXY = (g, i) => [g.x + (i % g.cols) * g.cell, g.y + Math.floor(i / g.cols) * g.cell];

  // offscreen render of the whole token grid, rebuilt when settings change
  let gridCache = { key: "" };
  function gridCanvas(s, L) {
    const geo = gridGeo(s, L), key = [s.pic, s.res, s.patch, s.voice, L.narrow].join("/");
    if (gridCache.key === key) return gridCache;
    const PX = 2, c = mk(Math.ceil(L.G.w * PX), Math.ceil(L.G.h * PX)), g = c.getContext("2d"), v = view(s.pic, s.res, s.patch), n = grid(s), p = s.patch, gap = geo.cell > 6 ? 0.12 : 0.04;
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < geo.n; i++) {
      const [x, y] = cellXY(geo, i), dx = (x - geo.x) * PX, dy = (y - geo.y) * PX, sz = geo.cell * PX * (1 - gap);
      if (i < n * n) g.drawImage(v, (i % n) * p, Math.floor(i / n) * p, p, p, dx, dy, sz, sz);
      else { const j = i - n * n; g.drawImage(spec.c, j * 2, 0, 2, BINS, dx, dy, sz, sz); }
    }
    return (gridCache = { key, c, geo, PX });
  }

  // ---------- drawing ----------
  function drawImg(k, src, x, y, w, h, smooth, alpha = 1) { const c = k.ctx; c.save(); c.globalAlpha = alpha; c.imageSmoothingEnabled = !!smooth; c.drawImage(src, x, y, w, h); c.restore(); }
  function draw(k, s, sim) {
    const C = k.C, L = layout(sim.narrow), nar = L.narrow, a = arrived(s), n = grid(s), P = L.P, V = L.V;
    const pic = PICS[s.pic], vw = view(s.pic, s.res, s.patch);
    // 1) the picture with its patch grid
    k.label(P.x, P.y - 18, nar ? "Your picture" : "Your picture, cut into patches", { align: "left", col: C.ink, weight: "600", size: 13 });
    drawImg(k, master(s.pic), P.x, P.y, P.w, P.w, true);
    const cs = P.w / n * (s.patch * n / s.res) ; // world size of one patch (last row/col may overhang when R isn't a multiple of P)
    const lineA = n > 40 ? 0.18 : n > 24 ? 0.3 : 0.5;
    for (let i = 1; i < n; i++) { const o = i * cs; if (o >= P.w) break; k.line(P.x + o, P.y, P.x + o, P.y + P.w, { col: "#ffffff", lw: 1, alpha: lineA }); k.line(P.x, P.y + o, P.x + P.w, P.y + o, { col: "#ffffff", lw: 1, alpha: lineA }); }
    k.box(P.x, P.y, P.w, P.w, { stroke: C.line, r: 2, lw: 1 });
    // patches already sent are dimmed on the picture
    const nI = n * n, sent = Math.min(nI, a.img);
    if (sent > 0 && sent < nI) { const rows = Math.floor(sent / n); k.box(P.x, P.y, P.w, Math.min(P.w, rows * cs), { fill: C.bg, r: 0, alpha: 0.45 }); k.box(P.x, P.y + rows * cs, Math.min(P.w, (sent % n) * cs), Math.min(cs, P.w - rows * cs), { fill: C.bg, r: 0, alpha: 0.45 }); }
    k.label(nar ? P.x : P.x + P.w / 2, P.y + P.w + 16, nar ? `${s.res}×${s.res} px · ${n}×${n} patches` : `${s.res}×${s.res} pixels · ${n}×${n} patches of ${s.patch}×${s.patch}`, { col: C.muted, size: nar ? 11 : 12, mono: true, align: nar ? "left" : "center" });
    if (s.sel >= 0 && s.sel < nI) { const r = Math.floor(s.sel / n), cc = s.sel % n; k.box(P.x + cc * cs, P.y + r * cs, cs, cs, { stroke: C.amb, lw: 2.5, r: 2, glow: 12 }); }
    // 2) what the model gets
    k.label(V.x, V.y - 18, "What the model gets", { align: "left", col: C.ink, weight: "600", size: 13 });
    drawImg(k, vw, V.x, V.y, V.w, V.w, false);
    k.box(V.x, V.y, V.w, V.w, { stroke: C.line, r: 2, lw: 1 });
    // label close-up
    const Z = L.Z, cr = pic.crop, vd = verdict(s), vcol = vd === "readable" ? C.ok : vd === "blurry" ? C.amb : vd === "unreadable" ? C.crit : C.muted;
    { const c = k.ctx; c.save(); c.imageSmoothingEnabled = false; const zh = Math.min(Z.h, Z.w * cr[3] / cr[2]), zw = zh * cr[2] / cr[3]; c.drawImage(vw, cr[0] * s.res, cr[1] * s.res, cr[2] * s.res, cr[3] * s.res, Z.x, Z.y + 18, Math.min(Z.w, zw), zh); c.restore();
      k.box(Z.x, Z.y + 18, Math.min(Z.w, zw), zh, { stroke: vcol, lw: 2, r: 2 }); }
    k.label(Z.x, Z.y + 4, pic.letter ? `Close-up: ${vd === "readable" ? "label readable" : vd === "blurry" ? "label blurry, a guess at best" : "label unreadable"}` : "Close-up: no text to read", { align: "left", col: vcol, size: 12, weight: "600" });
    if (pic.letter && !nar) k.label(Z.x, Z.y + Z.h + 34, `letters ≈ ${letterPx(s).toFixed(1)} px tall${s.patch > 16 ? " (after squeezing)" : ""}`, { align: "left", col: C.muted, size: 11.5, mono: true });
    // 3) the token stream
    const T = L.T, tot = total(s), over = tot > BUDGET;
    k.label(T.x, T.y - 18, nar ? `The model's input · ${fmtN(tot)} tokens` : `The model's input, in order · ${fmtN(tot)} tokens`, { align: "left", col: over ? C.crit : C.ink, weight: "600", size: 13 });
    let cx = T.x; PROMPT.forEach((w, i) => { const ww = Math.max(34, w.trim().length * 11 + 14); const on = i < a.txt; k.box(cx, T.y, ww, 26, { fill: on ? C.sig : C.line, r: 6, alpha: on ? 0.9 : 0.3 }); if (on) k.label(cx + ww / 2, T.y + 13, w.trim(), { col: C.bg, size: 11.5, weight: "650" }); cx += ww + 5; });
    if (!nar) k.label(cx + 8, T.y + 13, "← your words, then the picture" + (s.voice ? " and the voice note" : ""), { align: "left", col: C.muted, size: 11.5 });
    const gc = gridCanvas(s, L), geo = gc.geo, got = Math.min(geo.n, sent + Math.max(0, a.aud));
    { const c = k.ctx; c.save(); c.beginPath(); const rows = Math.floor(got / geo.cols); if (rows) c.rect(geo.x, geo.y, geo.cols * geo.cell, rows * geo.cell); if (got % geo.cols) c.rect(geo.x, geo.y + rows * geo.cell, (got % geo.cols) * geo.cell, geo.cell); c.clip(); c.imageSmoothingEnabled = geo.cell * gc.PX * k.scale < 3; c.drawImage(gc.c, geo.x, geo.y, L.G.w, L.G.h); c.restore(); }
    // empty slots still to come
    if (got < geo.n) { const [x, y] = cellXY(geo, got); k.box(x, y, geo.cell * 0.88, geo.cell * 0.88, { stroke: C.sig, lw: 1, r: 1, alpha: 0.8 }); }
    // budget marker: where token number 300 falls
    const bi = BUDGET - PROMPT.length;
    if (bi < geo.n) {
      const [bx, by] = cellXY(geo, bi); k.line(bx, by - 3, bx, by + geo.cell + 3, { col: C.crit, lw: 2.5 });
      if (got > bi) { const c = k.ctx; c.save(); c.globalAlpha = 0.35; c.fillStyle = C.crit; const r0 = Math.floor(bi / geo.cols), rows = Math.floor(got / geo.cols); c.fillRect(bx, by, geo.x + geo.cols * geo.cell - bx, geo.cell); if (rows > r0 + 1) c.fillRect(geo.x, by + geo.cell, geo.cols * geo.cell, (rows - r0 - 1) * geo.cell); if (rows > r0 && got % geo.cols) c.fillRect(geo.x, geo.y + rows * geo.cell, (got % geo.cols) * geo.cell, geo.cell); c.restore(); }
      k.label(bx, by - 10, `token ${BUDGET}: budget ends`, { col: C.crit, size: 11, weight: "600", bg: true, align: bx > geo.x + L.G.w * 0.7 ? "right" : "left" });
    }
    // selected patch's token
    if (s.sel >= 0 && s.sel < geo.n && s.sel < got) { const [x, y] = cellXY(geo, s.sel); k.box(x - 2, y - 2, geo.cell + 4, geo.cell + 4, { stroke: C.amb, lw: 2.5, r: 3, glow: 14 }); }
    // patches in flight
    if (a.u > T_TXT && a.img < nI) {
      const lag = Math.max(1, nI * 0.45 / T_IMG), every = Math.max(1, Math.ceil(lag / 22));
      for (let i = Math.max(0, Math.floor(a.fImg - lag)); i < Math.min(nI, a.fImg); i += every) {
        const u = easeIO(clamp01((a.fImg - i) / lag)), r = Math.floor(i / n), cc = i % n;
        const sx = P.x + (cc + 0.5) * cs, sy = P.y + (r + 0.5) * cs, [tx0, ty0] = cellXY(geo, i), tx = tx0 + geo.cell / 2, ty = ty0 + geo.cell / 2;
        const path = t => bez([[sx, sy], [sx + 120, sy - 140], [tx - 120, ty - 120], [tx, ty]], t), [x, y] = path(u), sz = lerp(cs, geo.cell, u);
        const pts = []; for (let q = 6; q >= 0; q--) pts.push(path(Math.max(0, u - q * 0.04)));
        k.trail(pts, C.sig, { w: 2, alpha: 0.6 });
        const c = k.ctx; c.save(); c.imageSmoothingEnabled = false; c.shadowColor = C.sig; c.shadowBlur = 10; c.drawImage(vw, cc * s.patch, r * s.patch, s.patch, s.patch, x - sz / 2, y - sz / 2, sz, sz); c.restore();
      }
    }
    // 4) the voice note
    const A = L.A;
    if (s.voice) {
      const wv = nar ? 0 : A.w * 0.36, sx0 = A.x + wv + (nar ? 0 : 40), sw = A.w - wv - (nar ? 0 : 40);
      if (!nar) {
        k.label(A.x, A.y - 8, `Voice note · ${VOICE_S} s`, { align: "left", col: C.ink, weight: "600", size: 13 });
        const c = k.ctx; c.save(); c.strokeStyle = C.sig; c.lineWidth = k.px(1.2); c.beginPath();
        for (let i = 0; i <= 600; i++) { const f = Math.min(FR - 1, Math.floor(i / 600 * FR)), e = spec.env[f], y = A.y + A.h / 2 + Math.sin(i * 1.7) * Math.sin(i * 0.31) * e * A.h * 0.42; i ? c.lineTo(A.x + wv * i / 600, y) : c.moveTo(A.x, y); }
        c.stroke(); c.restore();
        k.label(A.x + wv / 2, A.y + A.h + 12, "sound wave: 16,000 numbers a second", { col: C.muted, size: 11 });
        k.line(A.x + wv + 8, A.y + A.h / 2, sx0 - 8, A.y + A.h / 2, { col: C.muted, lw: 1.5 });
        k.label(sx0, A.y - 8, "spectrogram: pitch (up) over time (across)", { align: "left", col: C.muted, size: 11.5 });
      } else k.label(A.x, A.y - 8, `Voice note · ${VOICE_S} s · ${VOICE_TOK} tokens`, { align: "left", col: C.ink, weight: "600", size: 12 });
      drawImg(k, spec.c, sx0, A.y, sw, A.h, true);
      const done = Math.max(0, Math.min(VOICE_TOK, a.aud));
      if (done < VOICE_TOK) k.box(sx0 + sw * done / VOICE_TOK, A.y, sw * (1 - done / VOICE_TOK), A.h, { fill: C.bg, r: 0, alpha: done ? 0.0 : 0 });
      for (let j = 0; j <= VOICE_TOK; j += 25) k.line(sx0 + sw * j / VOICE_TOK, A.y + A.h, sx0 + sw * j / VOICE_TOK, A.y + A.h + 5, { col: C.muted, lw: 1 });
      if (!nar) k.label(sx0 + sw / 2, A.y + A.h + 12, `one token per 20 ms slice · ${VOICE_TOK} tokens`, { col: C.muted, size: 11 });
      if (a.aud > 0 && a.aud < VOICE_TOK) { const x = sx0 + sw * a.fAud / VOICE_TOK; k.box(x - 2, A.y - 3, Math.max(4, sw / VOICE_TOK * 2), A.h + 6, { stroke: C.amb, lw: 2, r: 2, glow: 10 }); }
    } else if (!nar) {
      k.box(A.x, A.y - 4, A.w, A.h + 8, { stroke: C.line, dash: [4, 5], r: 12 });
      k.label(A.x + A.w / 2, A.y + A.h / 2, "Turn on the voice note to see how sound becomes tokens", { col: C.muted, size: 12 });
    }
    // selected patch readout
    if (s.sel >= 0 && s.sel < nI) k.hud(nar ? "tl" : "br", "The patch you picked", [["row, column", `${Math.floor(s.sel / n) + 1}, ${s.sel % n + 1}`], ["pixel values in it", fmtN(s.patch * s.patch * 3)], ["position in input", "token " + fmtN(s.sel + PROMPT.length + 1)]], { w: 220 });
  }

  const sim = makeSim($("#mm-sim"), {
    label: "Image tokens simulation. A picture is cut into a grid of patches; each patch flies into the model's input as one token after the words of the question. A close-up shows whether the label can still be read at the chosen resolution. An optional voice note is shown as a sound wave and spectrogram that become tokens too. Click a patch to see which token it becomes.",
    cams: { default: { x: 0, y: 0, w: 1280, h: 640 } },
    camsNarrow: { default: { x: 0, y: 0, w: 560, h: 860 } },
    height: w => w < 640 ? Math.round(w * 1.45) : Math.round(Math.min(580, Math.max(380, w * 0.5))),
    init, step, draw, warmup: 3,
    intro: "The picture is cut into squares. Each square becomes one token in the model's input, right after your words. Change the resolution and watch the token count.",
    controls: [
      { id: "pic", label: "Picture", type: "choice", value: "bottle", options: Object.entries(PICS).map(([k, v]) => [k, v.name]), apply: (s, v) => { const ch = s.pic !== v; s.pic = v; if (ch) restart(s); } },
      { id: "res", label: "Resolution it's sent at", type: "range", min: 64, max: 896, step: 32, value: 224, fmt: v => `${v}×${v} px`, help: "Apps shrink big photos before sending them.", apply: (s, v) => { const ch = s.res !== v; s.res = v; if (ch) restart(s); } },
      { id: "patch", label: "Patch size", type: "choice", value: 16, options: [[14, "14 px"], [16, "16 px"], [32, "32 px"]], help: "Each square of this many pixels becomes one token.", apply: (s, v) => { const ch = s.patch !== v; s.patch = v; if (ch) restart(s); } },
      { id: "voice", label: "Add a 4-second voice note", type: "toggle", value: false, apply: (s, v) => { const ch = s.voice !== v; s.voice = v; if (ch) restart(s); } }
    ],
    click: (s, wx, wy, sim) => { const L = layout(sim.narrow), P = L.P, n = grid(s), cs = P.w / n * (s.patch * n / s.res); if (wx >= P.x && wy >= P.y && wx < P.x + P.w && wy < P.y + P.w) { const c = Math.min(n - 1, Math.floor((wx - P.x) / cs)), r = Math.min(n - 1, Math.floor((wy - P.y) / cs)); s.sel = r * n + c; } else s.sel = -1; },
    stats: s => { const t = total(s), vd = verdict(s); return [
      ["picture tokens", fmtN(imgTok(s))],
      ["total tokens · budget 300", fmtN(t), t > BUDGET ? "bad" : "ok"],
      ["label", vd === "none" ? "no text" : vd, vd === "readable" ? "ok" : vd === "blurry" ? "hot" : vd === "unreadable" ? "bad" : ""],
      ["1,000 requests like this · illustrative", "$" + (t * 1000 * PRICE).toFixed(2)]
    ]; },
    goal: { text: "read the pill bottle's label using 300 tokens or fewer in total, for 3 seconds", check: s => ({ done: s.goalFor >= 3, progress: `${fmtN(total(s))} tokens · ${s.pic === "bottle" ? "label " + verdict(s) : "pick the pill bottle"}` }) },
    notices: [
      { id: "sel", when: s => s.sel >= 0, say: s => { const n = grid(s); return `You picked the patch in row ${Math.floor(s.sel / n) + 1}, column ${s.sel % n + 1}. Its ${s.patch}×${s.patch} pixels (${fmtN(s.patch * s.patch * 3)} colour values) become one list of numbers: token ${fmtN(s.sel + PROMPT.length + 1)} of the input, read exactly like a word.`; } },
      { id: "voice", when: s => s.voice && s.t - s.t0 > 4, say: s => `The ${VOICE_S}-second voice note became <b>${VOICE_TOK}</b> tokens: the sound is turned into a spectrogram, a picture of which pitches are loud at each moment, and every 20 ms slice becomes one token. That's ${VOICE_TOK} tokens of your ${BUDGET}.` },
      { id: "patch32", when: s => s.patch === 32, say: s => `With 32-pixel patches, each token has to hold ${fmtN(32 * 32 * 3)} colour values in a list the same size as before, so fine detail gets squeezed out. Fewer tokens (${fmtN(imgTok(s))}), but the letters are now worth only about ${letterPx(s).toFixed(1)} pixels.` },
      { id: "over", when: s => total(s) > BUDGET, say: s => { const n = grid(s); return `At ${s.res}×${s.res} the picture is ${n} patches across and ${n} down: <b>${fmtN(n * n)}</b> tokens, over your ${BUDGET}-token budget. Double the width and height and you get four times the patches, so four times the tokens.`; } },
      { id: "unread", when: s => verdict(s) === "unreadable" || verdict(s) === "blurry", say: s => `At ${s.res}×${s.res} the label's letters are about <b>${letterPx(s).toFixed(1)} pixels</b> tall. That's too few to tell an E from an F, so the model could only guess. Raise the resolution, but watch the token count.` },
      { id: "cat", when: s => s.pic === "cat" && s.res <= 160, say: s => `Even at ${s.res}×${s.res}, only ${fmtN(imgTok(s))} tokens, the cat is still obviously a cat. Big shapes survive low resolution; small text doesn't.` },
      { id: "calm", when: () => true, say: s => `${fmtN(imgTok(s))} picture tokens, about as many as ${fmtN(imgTok(s) * 0.75)} words of text. Each square on the left became one token on the right, after your ${PROMPT.length} words.` }
    ],
    facts: [
      { id: "claude", when: s => s.res >= 512, text: "Anthropic, the company behind the Claude assistant, says Claude counts one token for every 28 × 28-pixel block of a picture. A 1,000 × 1,000-pixel photo is 36 × 36 = 1,296 tokens, about as many as 1,000 words of text.", ref: "#ref-602" },
      { id: "whisper", when: s => s.voice, text: "OpenAI's Whisper speech recogniser learned from 680,000 hours of audio with transcripts, about 77 years of non-stop listening.", ref: "#ref-603" }
    ],
    tour: [
      { say: "A pill bottle sent at 224×224 pixels with 16-pixel patches, the setup of the original Vision Transformer: 14 × 14 = 196 tokens. Watch them fly in after your words.", set: { pic: "bottle", res: 224, patch: 16, voice: false }, wait: 7 },
      { say: "Send it sharper, at 640×640. The label is crisp, but the picture is now 1,600 tokens, far over budget.", set: { res: 640 }, wait: 7 },
      { say: "Go cheap: 96×96 is just 36 tokens, but look at the close-up. The letters are a smear.", set: { res: 96 }, wait: 7 },
      { say: "The sweet spot: 256×256 is 256 tokens plus 6 words, and the letters are just big enough to read.", set: { res: 256 }, wait: 7 },
      { say: "Now add a 4-second voice note. Sound becomes a spectrogram, and each 20 ms slice becomes a token: 200 more, over budget again.", set: { voice: true }, wait: 9 }
    ],
    publish: s => ({ mmRes: `${s.res}×${s.res}`, mmResN: String(s.res), mmPatch: String(s.patch), mmGrid: String(grid(s)), mmImgTok: fmtN(imgTok(s)), mmTotal: fmtN(total(s)), mmLetter: PICS[s.pic].letter ? letterPx(s).toFixed(1) + " pixels" : "(no text in this picture)", mmWords: fmtN(imgTok(s) * 0.75), mmVoice: s.voice ? ` + ${VOICE_TOK} voice` : "", mmPrompt: String(PROMPT.length) })
  });
});
