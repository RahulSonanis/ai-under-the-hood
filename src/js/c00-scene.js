/* Scene engine: deterministic, scrubbable "films" drawn on canvas.
   A film is a list of segments (each with a story duration and, optionally, the real duration it
   stands for). draw(t) is a pure function of the playhead, so play, pause, scrub, back and next
   all work the same way and every frame is reproducible. */

const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = x => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const bez = (p, k) => { const u = 1 - k; return [0, 1].map(i => u * u * u * p[0][i] + 3 * u * u * k * p[1][i] + 3 * u * k * k * p[2][i] + k * k * k * p[3][i]); };
const stageColors = () => ({ bg: css("--stage"), bg2: css("--stage-2"), line: css("--stage-line"), ink: css("--stage-ink"), muted: css("--stage-muted"), sig: css("--signal"), amb: css("--amber"), you: css("--you") });
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let cur = "";
  words.forEach(w => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur); return lines;
}
const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>',
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h2v11H3zM13.5 2.5v11L6 8z"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2.5h2v11h-2zM2.5 2.5v11L10 8z"/></svg>',
  again: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 0 5.4 6.5h-2A3.5 3.5 0 1 1 8 4.5c1 0 1.9.4 2.5 1.1L8.5 7.5H14V2l-2 2A5.5 5.5 0 0 0 8 2.5z"/></svg>'
};

/* makeFilm(root, cfg): playback for a figure.scene.
   cfg.draw(t, i, segs)      draw the frame for playhead t (seconds of story time), step i
   cfg.caption(seg, depth)   HTML for the caption; depth 1-2 = plain, 3-4 = technical
   cfg.realSpeed             show the "Real speed" switch (segments then need rdur, real ms)
   Each segment: { key, title, short?, dur, rdur? } */
function makeFilm(root, cfg) {
  const cv = $("canvas", root), cap = $(".scene-cap", root), bar = $(".scene-bar", root), start = $(".scene-start", root);
  let segs = [], T = 1, t = 0, stopAt = null, real = false, lastSeg = -1, touched = false;
  bar.className = "scene-bar film-controls";
  bar.innerHTML = `<button class="fbtn" type="button" data-a="prev">${ICON.prev}<span>Back</span></button>
    <button class="fbtn primary" type="button" data-a="play">${ICON.play}<span>Play</span></button>
    <button class="fbtn" type="button" data-a="next"><span>Next</span>${ICON.next}</button>
    ${cfg.realSpeed ? `<label class="fswitch"><input type="checkbox" data-a="real"><span class="sw" aria-hidden="true"></span><span>Real speed</span></label><span class="fclock" aria-hidden="true"></span>` : ""}`;
  const strip = document.createElement("ol"); strip.className = "film-steps"; strip.setAttribute("aria-label", "Steps"); bar.after(strip);
  const playBtn = $('[data-a="play"]', bar), clock = $(".fclock", bar);
  if (cfg.realSpeed) $('[data-a="real"]', bar).addEventListener("change", e => { real = e.target.checked; touch(); if (real) { t = 0; api.play(); } });
  const segAt = x => { for (let i = 0; i < segs.length; i++) if (x < segs[i].t1) return i; return segs.length - 1; };
  const realAt = x => { const s = segs[segAt(x)]; return s.r0 + clamp01((x - s.t0) / s.dur) * s.rdur; };
  const playing = () => loop.running;
  function touch() { touched = true; if (start) start.hidden = true; }
  function setPlayUI() {
    const p = playing(), end = t >= T - 1e-6;
    playBtn.innerHTML = (p ? ICON.pause : end ? ICON.again : ICON.play) + `<span>${p ? "Pause" : end ? "Replay" : t > 0 ? "Resume" : "Play"}</span>`;
    $('[data-a="prev"]', bar).disabled = t <= 0.05 && !p;
    $('[data-a="next"]', bar).disabled = end;
  }
  function buildStrip() {
    strip.innerHTML = segs.map((s, i) => `<li><button type="button" data-i="${i}"><i class="fill"></i><span class="n">${i + 1}</span><span class="nm">${esc(s.short || s.title)}</span></button></li>`).join("");
    $$("button", strip).forEach(b => b.addEventListener("click", () => { touch(); api.playSeg(+b.dataset.i); }));
  }
  function paintStrip(i) {
    $$("button", strip).forEach((b, j) => {
      const s = segs[j], k = j < i ? 1 : j > i ? 0 : clamp01((t - s.t0) / s.dur);
      b.querySelector(".fill").style.transform = `scaleX(${k})`;
      if (j === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      b.classList.toggle("done", j < i);
    });
    if (i !== strip._i) { strip._i = i; const b = $$("button", strip)[i]; if (b) { const L = b.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft, R = L + b.offsetWidth; if (L < strip.scrollLeft || R > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: L - 24, behavior: reduceMotion() ? "auto" : "smooth" }); } }
  }
  function frame() {
    const i = segAt(t);
    cfg.draw(t, i, segs);
    paintStrip(i);
    if (clock) { const rt = realAt(t); clock.textContent = rt < 1000 ? Math.round(rt) + " ms" : (rt / 1000).toFixed(2) + " s"; }
    if (i !== lastSeg) { lastSeg = i; caption(i); }
    if (cfg.onFrame) cfg.onFrame(t, i, segs.length ? realAt(t) : 0);
  }
  function caption(i) {
    if (!cap) return; const s = segs[i], c = cfg.caption(s, store.get("depth", 1));
    cap.innerHTML = `<div class="step-n">Step ${i + 1} of ${segs.length}</div><h4>${esc(s.title)}</h4><p>${c}</p>`;
  }
  const loop = animLoop(dt => {
    const s = segs[segAt(t)]; const rate = real ? s.dur / Math.max(0.0005, s.rdur / 1000) : 1;
    t = Math.min(T, t + dt * rate * (cfg.speed || 1));
    if (stopAt !== null && t >= stopAt) { t = stopAt; stopAt = null; frame(); setPlayUI(); return false; }
    if (t >= T) { if (cfg.loopForever) { t = 0; } else { t = T; frame(); setPlayUI(); return false; } }
    frame();
  });
  const api = {
    get t() { return t; }, get segs() { return segs; }, get playing() { return playing(); },
    setSegs(list) {
      segs = list; let a = 0, r = 0; segs.forEach(s => { s.t0 = a; a += s.dur; s.t1 = a; s.r0 = r; s.rdur = s.rdur || 0; r += s.rdur; }); T = a;
      buildStrip(); lastSeg = -1; strip._i = -1; t = Math.min(t, T); frame(); setPlayUI();
    },
    seek(x) { t = Math.max(0, Math.min(T, x)); frame(); setPlayUI(); },
    play() { touch(); if (t >= T - 1e-6) t = 0; stopAt = null; if (reduceMotion() && !real) { api.step(1); return; } loop.start(); setPlayUI(); },
    pause() { loop.stop(); stopAt = null; setPlayUI(); },
    toggle() { playing() ? api.pause() : api.play(); },
    step(d) {
      touch(); const i = segAt(t), s = segs[i], atStart = t - s.t0 < 0.3, atEnd = t >= s.t1 - 1e-3;
      const j = d > 0 ? (atEnd || (!atStart || playing()) ? i + 1 : i) : (atStart && !atEnd ? i - 1 : i - (atEnd ? 0 : 0));
      api.playSeg(d < 0 && !atStart && !atEnd ? i : j);
    },
    playSeg(j) { touch(); j = Math.max(0, Math.min(segs.length - 1, j)); if (reduceMotion()) { loop.stop(); stopAt = null; t = segs[j].t1 - 1e-4; frame(); setPlayUI(); return; } t = segs[j].t0; stopAt = segs[j].t1 - 1e-4; frame(); loop.start(); setPlayUI(); },
    replay(key) { const j = segs.findIndex(s => s.key === key); if (j >= 0) api.playSeg(j); else frame(); },
    refresh() { lastSeg = -1; frame(); },
    segAt, realAt, touch
  };
  playBtn.addEventListener("click", () => api.toggle());
  $('[data-a="prev"]', bar).addEventListener("click", () => api.step(-1));
  $('[data-a="next"]', bar).addEventListener("click", () => api.step(1));
  if (start) start.addEventListener("click", () => { touch(); api.seek(segs.length > 1 && cfg.skipIntro ? segs[1].t0 : 0); api.play(); });
  cv.tabIndex = 0;
  cv.addEventListener("keydown", e => {
    if (e.key === " " || e.key === "k") { e.preventDefault(); api.toggle(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); api.step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); api.step(-1); }
  });
  document.addEventListener("depthchange", () => { if (segs.length) caption(segAt(t)); });
  root._film = api;
  return api;
}

/* ---------- Scene kit: drawing in "world" coordinates with a moving camera ----------
   k.begin(h, cam)    size the canvas to h px tall, clear to the stage colour, fit the camera
                      rect {x,y,w,h} (world units) into the canvas; draws a faint dot grid.
   Shapes take world coordinates; k.label() draws fixed-size screen text at a world point.
   Colours: k.C.bg, bg2, line, ink, muted, sig (teal = data), amb (amber = compute/energy). */
function sceneKit(cv) {
  const k = { C: null, scale: 1, ox: 0, oy: 0, W: 0, H: 0, ctx: null };
  const dpr = () => window.devicePixelRatio || 1;
  k.begin = (h, cam, opt = {}) => {
    const d = dpr(), cw = cv.clientWidth || innerW(cv.parentElement) || 600;
    if (cv._cw !== cw || cv._ch !== h || cv._dpr !== d) { cv.style.height = h + "px"; cv.width = Math.round(cw * d); cv.height = Math.round(h * d); cv._cw = cw; cv._ch = h; cv._dpr = d; }
    const ctx = k.ctx = cv.getContext("2d"); k.W = cw; k.H = h; k.C = stageColors();
    const pad = opt.pad == null ? 12 : opt.pad, s = Math.min((cw - pad * 2) / cam.w, (h - pad * 2) / cam.h);
    k.scale = s; k.ox = (cw - cam.w * s) / 2 - cam.x * s; k.oy = (h - cam.h * s) / 2 - cam.y * s; k.cam = cam;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = k.C.bg; ctx.fillRect(0, 0, cw, h);
    k.world();
    if (opt.grid !== false) { const g = opt.grid || 40; ctx.fillStyle = k.C.line; const x0 = Math.floor((-k.ox / s) / g) * g, y0 = Math.floor((-k.oy / s) / g) * g, x1 = (cw - k.ox) / s, y1 = (h - k.oy) / s, r = 1 / s; for (let x = x0; x < x1; x += g) for (let y = y0; y < y1; y += g) ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
    return k;
  };
  k.world = () => { const d = dpr(); k.ctx.setTransform(d * k.scale, 0, 0, d * k.scale, d * k.ox, d * k.oy); };
  k.screen = () => { const d = dpr(); k.ctx.setTransform(d, 0, 0, d, 0, 0); };
  k.toScreen = (x, y) => [k.ox + x * k.scale, k.oy + y * k.scale];
  k.toWorld = (sx, sy) => [(sx - k.ox) / k.scale, (sy - k.oy) / k.scale];
  k.px = n => n / k.scale; // world units for n screen pixels
  k.box = (x, y, w, h, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; if (o.glow) { c.shadowColor = o.glowCol || o.fill || o.stroke; c.shadowBlur = o.glow; } rr(c, x, y, w, h, Math.min(o.r == null ? 8 : o.r, w / 2, h / 2)); if (o.fill) { c.fillStyle = o.fill; c.fill(); } if (o.stroke) { c.shadowBlur = 0; c.strokeStyle = o.stroke; c.lineWidth = k.px(o.lw || 1.5); if (o.dash) c.setLineDash(o.dash.map(k.px)); c.stroke(); } c.restore(); };
  k.pill = (cx, cy, w, h, col, o = {}) => k.box(cx - w / 2, cy - h / 2, w, h, { fill: col, r: h / 2, glow: o.glow, alpha: o.alpha });
  k.dot = (x, y, r, col, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; if (o.glow) { c.shadowColor = col; c.shadowBlur = o.glow; } c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore(); };
  k.line = (x1, y1, x2, y2, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.strokeStyle = o.col || k.C.line; c.lineWidth = k.px(o.lw || 1.5); if (o.dash) c.setLineDash(o.dash.map(k.px)); if (o.glow) { c.shadowColor = o.col; c.shadowBlur = o.glow; } c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore(); };
  k.curve = (p, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.strokeStyle = o.col || k.C.line; c.lineWidth = k.px(o.lw || 1.5); if (o.dash) c.setLineDash(o.dash.map(k.px)); c.beginPath(); c.moveTo(...p[0]); c.bezierCurveTo(...p[1], ...p[2], ...p[3]); c.stroke(); c.restore(); };
  k.text = (x, y, s, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; font(c, o.size || 14, o.mono ? "--f-mono" : o.serif ? "--f-body" : "--f-display", o.weight || "500"); c.fillStyle = o.col || k.C.ink; c.textAlign = o.align || "center"; c.textBaseline = o.baseline || "middle"; c.fillText(s, x, y); c.restore(); };
  k.label = (x, y, s, o = {}) => { const [sx, sy] = k.toScreen(x, y); if (sx < -80 || sx > k.W + 80 || sy < -20 || sy > k.H + 20) return; const c = k.ctx; c.save(); k.screen(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; font(c, o.size || 12, o.mono ? "--f-mono" : "--f-display", o.weight || "500"); c.fillStyle = o.col || k.C.muted; c.textAlign = o.align || "center"; c.textBaseline = "middle"; c.fillText(s, sx + (o.dx || 0), sy + (o.dy || 0)); c.restore(); };
  /* A line that fades from transparent (tail) to solid (head); pts = [[x,y], ...] in world units. */
  k.trail = (pts, col, o = {}) => { const c = k.ctx; if (pts.length < 2) return; c.save(); c.strokeStyle = col; c.lineCap = "round"; c.lineWidth = k.px(o.w || 2.5); if (o.glow) { c.shadowColor = col; c.shadowBlur = o.glow; }
    for (let i = 1; i < pts.length; i++) { c.globalAlpha = (o.alpha == null ? 1 : o.alpha) * Math.pow(i / (pts.length - 1), 1.6); c.beginPath(); c.moveTo(...pts[i - 1]); c.lineTo(...pts[i]); c.stroke(); } c.restore(); };
  /* n particles flowing along path(u) -> [x,y], u in 0..1, each with a short glowing trail. phase shifts them over time. */
  k.flow = (path, n, phase, col, o = {}) => { const len = o.len || 0.08, sz = o.size || 3; for (let j = 0; j < n; j++) { const u = ((j / n) + phase) % 1; const pts = []; for (let s = 6; s >= 0; s--) { const uu = u - len * s / 6; if (uu >= 0) pts.push(path(uu)); } if (pts.length > 1) k.trail(pts, col, { w: sz * 0.9, alpha: o.alpha == null ? 0.8 : o.alpha }); const [x, y] = path(u); k.dot(x, y, k.px(sz), col, { glow: o.glow == null ? 8 : o.glow, alpha: o.alpha }); } };
  /* Glass readout panel in screen space. corner: "tl" | "tr" | "bl" | "br". rows: [[key, value], ...] */
  k.hud = (corner, title, rows, o = {}) => {
    const c = k.ctx; c.save(); k.screen(); const pad = 10, lh = 17, w = o.w || 190, h = pad * 2 + (title ? 18 : 0) + rows.length * lh;
    const m = 12, x = corner[1] === "l" ? m : k.W - w - m, y = corner[0] === "t" ? m : k.H - h - m;
    c.globalAlpha = 0.82; c.fillStyle = k.C.bg2; rr(c, x, y, w, h, 10); c.fill(); c.globalAlpha = 1; c.strokeStyle = k.C.line; c.lineWidth = 1; c.stroke();
    let yy = y + pad + 6; if (title) { font(c, 11, "--f-display", "650"); c.fillStyle = k.C.ink; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(title, x + pad, yy); yy += 18; }
    rows.forEach(([kk, v, col]) => { font(c, 11, "--f-display"); c.fillStyle = k.C.muted; c.textAlign = "left"; c.fillText(kk, x + pad, yy); font(c, 11.5, "--f-mono", "600"); c.fillStyle = col || k.C.ink; c.textAlign = "right"; c.fillText(v, x + w - pad, yy); yy += lh; });
    c.restore(); k.world();
  };
  return k;
}
/* Camera that eases from the previous step's framing to this step's over the first part of the step. */
function filmCam(cams, segs, i, t, keyOf = s => s.key) {
  const s = segs[i], p = segs[Math.max(0, i - 1)], a = cams[keyOf(p)] || cams.default, b = cams[keyOf(s)] || cams.default;
  const e = easeIO((t - s.t0) / Math.min(1.0, s.dur * 0.45)); return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e) };
}
/* Progress (0..1) through the step with this key; 0 before it, 1 after it. */
function stepK(segs, t, key) { const g = segs.find(x => x.key === key); if (!g) return 0; return clamp01((t - g.t0) / g.dur); }
/* Stage height for a figure: wide screens get a 2:1 stage, phones a near-square one. */
function stageH(el, wide = 0.5, narrow = 0.9) { const w = innerW(el); return w < 640 ? Math.round(Math.max(280, w * narrow)) : Math.round(Math.min(560, Math.max(360, w * wide))); }
/* storyFilm(figure, spec): the one-call way to build a chapter film.
   spec.steps  [{ key, title, short, dur, text: [plain, technical], link: "#chapter" (optional) }]
   spec.cams   { default: {x,y,w,h}, <stepKey>: {x,y,w,h}, ... }  world-space framing per step
   spec.draw(k, f)  k = scene kit (camera already applied); f = { t, i, key, p (0..1 in step),
                    at(key) (0..1 progress of any step), segs, C (colours) }
   spec.height(el) optional; spec.label optional aria label for the canvas. */
function storyFilm(fig, spec) {
  if (spec.label) fig.dataset.label = spec.label;
  filmMarkup(fig);
  const cv = $("canvas", fig), k = sceneKit(cv), stage = $(".scene-stage", fig);
  const hgt = spec.height || (() => stageH(stage));
  const film = makeFilm(fig, {
    draw: (t, i, segs) => {
      const s = segs[i]; k.begin(hgt(), filmCam(spec.cams, segs, i, t), { grid: spec.grid });
      spec.draw(k, { t, i, key: s.key, p: clamp01((t - s.t0) / s.dur), at: key => stepK(segs, t, key), segs, C: k.C });
    },
    caption: (s, depth) => { const tx = s.text || ["", ""]; return (depth >= 3 ? tx[1] || tx[0] : tx[0]) + (s.link ? ` <a href="${s.link}">Read more →</a>` : ""); }
  });
  film.setSegs(spec.steps.map(s => ({ ...s })));
  onRedraw(() => film.refresh());
  return { film, kit: k };
}
/* Standard markup for a film; call inside the chapter's HTML via <figure class="scene" id="x" data-start="Play the story"></figure> */
function filmMarkup(fig) {
  if ($(".scene-stage", fig)) return;
  const setup = $(".scene-setup", fig), note = $("figcaption", fig);
  const lab = fig.dataset.start || "Play";
  fig.insertAdjacentHTML("afterbegin", `<div class="scene-stage"><canvas aria-label="${esc(fig.dataset.label || "Animated explanation")}. Space plays or pauses; left and right arrows step back and forward."></canvas><button class="scene-start" type="button">${ICON.play}<span>${esc(lab)}</span></button><div class="scene-cap" aria-live="polite"></div></div><div class="scene-bar"></div>`);
  if (setup) fig.appendChild(setup); if (note) fig.appendChild(note);
}

/* ---------- The journey of one prompt (chapter 1, and the landing page's hero) ---------- */
function createJourney(cv, opt = {}) {
  const hero = !!opt.hero;
  const P = {
    lap: { x: 40, y: 230, w: 300, h: 200 },
    up: [[340, 335], [420, 200], [490, 480], [560, 345]],
    down: [[560, 398], [490, 570], [420, 262], [340, 392]],
    dc: { x: 560, y: 60, w: 1010, h: 650 },
    gate: [675, 345], scan: [805, 345],
    queue: { x: 868, y: 324, w: 150, h: 42 },
    router: [1052, 345],
    reps: [{ x: 1112, y: 92, w: 118, h: 58 }, { x: 1246, y: 92, w: 118, h: 58 }],
    srv: { x: 1100, y: 176, w: 452, h: 508 },
    tokRows: [231, 255], tokX0: 1120, tokX1: 1532,
    layers: { x0: 1132, n: 9, dx: 36, y: 288, h: 190, w: 22 },
    samp: { x: 1462, y: 288, w: 74, h: 190 },
    kv: { x: 1122, y: 534, cols: 30, rows: 9, cell: 11, gap: 3 }
  };
  const CAM = {
    map: { x: 10, y: 50, w: 1580, h: 680 },
    send: { x: 20, y: 200, w: 600, h: 290 }, net: { x: 290, y: 170, w: 360, h: 380 },
    gw: { x: 600, y: 225, w: 280, h: 235 }, queue: { x: 840, y: 215, w: 300, h: 250 },
    route: { x: 1000, y: 70, w: 420, h: 400 }, tok: { x: 1092, y: 180, w: 470, h: 320 },
    model: { x: 900, y: 168, w: 680, h: 524 }
  };
  const camOf = { map: "map", send: "send", net: "net", gw: "gw", safe: "gw", queue: "queue", route: "route", tok: "tok", prefill: "model", think: "model", decode: "model", stream: "map", done: "map" };
  let S = null; // current scenario

  function pieces(s) { const out = []; (s.match(/\s*\S+/g) || []).forEach(w => { if (w.trim().length <= 6) out.push(w); else { out.push(w.slice(0, 5)); let a = w.slice(5); while (a.length) { out.push(a.slice(0, 4)); a = a.slice(4); } } }); return out; }

  function setup(sc) {
    // sc: { prompt, reply, sys, think, busy, tpot, durs }
    const meas = document.createElement("canvas").getContext("2d"); meas.font = `11px ${css("--f-mono")}`;
    const chips = []; let x = P.tokX0, row = 0;
    const add = (txt, kind) => { const w = Math.max(16, meas.measureText(txt).width + 10); if (x + w > P.tokX1) { row++; x = P.tokX0; } if (row > 1) return false; chips.push({ txt, kind, x, w, y: P.tokRows[row] }); x += w + 4; return true; };
    if (sc.sys) add(`system ${sc.sys.toLocaleString()}`, "sys");
    const ps = pieces(sc.prompt); let shown = 0;
    for (const p of ps) { if (chips.length && x + 70 > P.tokX1 && row === 1) break; if (!add(p.replace(/\s/g, "·"), "user")) break; shown++; }
    if (shown < ps.length) add(`+${Math.max(1, sc.inTok - sc.sys - shown).toLocaleString()} more`, "more");
    const out = pieces(sc.reply);
    const totalTok = sc.inTok + sc.think + out.length;
    const per = Math.max(1, Math.ceil(totalTok / (P.kv.cols * P.kv.rows - 6)));
    const others = Math.min(5, Math.round(sc.busy * 5.4));
    S = { ...sc, chips, out, per, others, lines: [] };
    return S;
  }

  // ---------- drawing helpers ----------
  let ctx, C, view, scale, ox, oy, W, H;
  const toScreen = (x, y) => [ox + x * scale, oy + y * scale];
  function fitCam(r, w, h) { const s = Math.min(w / r.w, h / r.h); return { s, ox: (w - r.w * s) / 2 - r.x * s, oy: (h - r.h * s) / 2 - r.y * s }; }
  function camAt(key, prevKey, k) {
    const a = CAM[camOf[prevKey] || "map"], b = CAM[camOf[key] || "map"], e = easeIO(k);
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e) };
  }
  function label(x, y, text, o = {}) {
    const [sx, sy] = toScreen(x, y); if (sx < -60 || sx > W + 60 || sy < -20 || sy > H + 20) return;
    ctx.save(); ctx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
    font(ctx, o.size || 12, o.mono ? "--f-mono" : "--f-display", o.weight || "500");
    ctx.fillStyle = o.color || C.muted; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, sx, sy); ctx.restore();
  }
  function capsule(x, y, w, h, fillCol, glow, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; if (glow) { ctx.shadowColor = fillCol; ctx.shadowBlur = glow; }
    ctx.fillStyle = fillCol; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.restore();
  }
  function strokeRR(r, col, lw, rad = 14, dash) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw / scale; if (dash) ctx.setLineDash(dash.map(d => d / scale)); rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.stroke(); ctx.restore(); }
  function path(points, col, lw, dash, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw / scale; if (dash) ctx.setLineDash(dash.map(d => d / scale)); ctx.beginPath(); ctx.moveTo(...points[0]); ctx.bezierCurveTo(...points[1], ...points[2], ...points[3]); ctx.stroke(); ctx.restore(); }

  // the return trip of an output token: server -> door -> fibre -> screen
  const RET = [
    { kind: "bez", p: [[1499, 280], [1470, 430], [1250, 432], [1098, 420]], len: 470 },
    { kind: "line", a: [1098, 420], b: [560, 398], len: 540 },
    { kind: "bez", p: P.down, len: 310 },
    { kind: "line", a: [340, 392], b: [200, 360], len: 145 }
  ];
  const RET_LEN = RET.reduce((a, r) => a + r.len, 0);
  function retPos(u) { let d = clamp01(u) * RET_LEN; for (const r of RET) { if (d <= r.len) { const k = d / r.len; return r.kind === "bez" ? bez(r.p, k) : [lerp(r.a[0], r.b[0], k), lerp(r.a[1], r.b[1], k)]; } d -= r.len; } return [200, 360]; }

  function drawScreenContent(landed, sentK, thinkingNow) {
    const L = P.lap, pad = 16; ctx.save();
    ctx.beginPath(); rr(ctx, L.x + 4, L.y + 4, L.w - 8, L.h - 8, 8); ctx.clip();
    font(ctx, 12.5, "--f-body"); const maxW = L.w - pad * 2 - 30;
    const pl = wrapLines(ctx, S.promptShort, maxW).slice(0, 3);
    const bh = pl.length * 16 + 12, bw = Math.min(maxW + 14, Math.max(...pl.map(l => ctx.measureText(l).width)) + 18);
    let y = L.y + pad;
    // user bubble (right aligned); it lifts off as the request is sent, then reappears as "sent"
    const lift = sentK > 0 && sentK < 1 ? easeIO(sentK) : 0;
    ctx.globalAlpha = sentK > 0 && sentK < 1 ? 1 - lift : 1;
    ctx.fillStyle = C.line; rr(ctx, L.x + L.w - pad - bw, y - lift * 20, bw, bh, 10); ctx.fill();
    ctx.fillStyle = C.ink; ctx.textBaseline = "top"; pl.forEach((l, i) => ctx.fillText(l, L.x + L.w - pad - bw + 9, y + 6 + i * 16 - lift * 20));
    ctx.globalAlpha = 1; y += bh + 12;
    if (sentK >= 1) {
      const txt = S.out.slice(0, landed).join("");
      if (!landed) { font(ctx, 12.5, "--f-body"); ctx.fillStyle = C.muted; ctx.fillText(thinkingNow ? "Thinking…" : "…", L.x + pad, y); }
      else {
        font(ctx, 12.5, "--f-body"); ctx.fillStyle = C.ink; const lines = wrapLines(ctx, txt, L.w - pad * 2);
        const maxL = Math.floor((L.y + L.h - pad - y) / 16); lines.slice(Math.max(0, lines.length - maxL)).forEach((l, i) => ctx.fillText(l, L.x + pad, y + i * 16));
      }
    }
    ctx.restore();
  }

  function draw(t, i, segs, extra = {}) {
    const dprA = window.devicePixelRatio || 1, cw = cv.clientWidth || innerW(cv.parentElement) || 600;
    if (cv._cw !== cw || cv._ch !== extra.h || cv._dpr !== dprA) { cv.style.height = extra.h + "px"; cv.width = Math.round(cw * dprA); cv.height = Math.round(extra.h * dprA); cv._cw = cw; cv._ch = extra.h; cv._dpr = dprA; }
    ctx = cv.getContext("2d"); ctx.setTransform(dprA, 0, 0, dprA, 0, 0); W = cw; H = extra.h; C = stageColors();
    const s = segs[i], key = s.key, prev = segs[Math.max(0, i - 1)].key;
    const ph = k => { const g = segs.find(x => x.key === k); if (!g) return k === "think" ? 1 : 0; return clamp01((t - g.t0) / g.dur); };
    const at = k => segs.find(x => x.key === k);
    const capH = extra.capH || 0;
    const cam = hero ? CAM.map : camAt(key, i === 0 ? key : prev, (t - s.t0) / Math.min(1.0, s.dur * 0.45));
    const f = fitCam(cam, W, H - capH); scale = f.s; ox = f.ox; oy = f.oy;
    const dpr = devicePixelRatio || 1;
    // background + dot grid
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    ctx.fillStyle = C.line; const g0x = Math.floor(cam.x / 40) * 40 - 40, g0y = Math.floor(cam.y / 40) * 40 - 40;
    for (let gx = g0x; gx < cam.x + cam.w + 80; gx += 40) for (let gy = g0y; gy < cam.y + cam.h + 80; gy += 40) ctx.fillRect(gx - 1, gy - 1, 2, 2);

    const active = k => key === k || (k === "gw" && key === "safe" && false);
    const hi = k => (key === k) ? C.sig : C.line;

    // ----- static world -----
    // laptop
    const L = P.lap; ctx.fillStyle = C.bg2; rr(ctx, L.x, L.y, L.w, L.h, 12); ctx.fill(); strokeRR(L, key === "send" || key === "done" || key === "stream" ? C.sig : C.line, 1.5, 12);
    ctx.fillStyle = C.line; ctx.beginPath(); ctx.moveTo(L.x - 22, L.y + L.h + 6); ctx.lineTo(L.x + L.w + 22, L.y + L.h + 6); ctx.lineTo(L.x + L.w + 4, L.y + L.h + 26); ctx.lineTo(L.x - 4, L.y + L.h + 26); ctx.closePath(); ctx.fill();
    // fibres
    path(P.up, C.line, 1.5, [5, 5]); path(P.down, C.line, 1.5, [5, 5]);
    // datacenter
    ctx.fillStyle = C.bg2; ctx.globalAlpha = 0.55; rr(ctx, P.dc.x, P.dc.y, P.dc.w, P.dc.h, 26); ctx.fill(); ctx.globalAlpha = 1; strokeRR(P.dc, C.line, 1.2, 26);
    // corridor floor
    ctx.fillStyle = C.line; ctx.globalAlpha = 0.35; ctx.fillRect(560, 333, 540, 24); ctx.fillRect(560, 410, 540, 18); ctx.globalAlpha = 1;
    // gateway: two pillars + bar
    const gk = ph("gw"), gateOpen = easeIO((gk - 0.62) / 0.25);
    ctx.fillStyle = key === "gw" ? C.sig : C.line; ctx.fillRect(P.gate[0] - 34, 300, 10, 140); ctx.fillRect(P.gate[0] + 24, 300, 10, 140);
    ctx.save(); ctx.translate(P.gate[0] - 24, 312); ctx.rotate(-gateOpen * Math.PI / 2.4); ctx.fillStyle = key === "gw" ? C.amb : C.muted; ctx.fillRect(0, -3, 50, 6); ctx.restore();
    // scanner arch
    const sk = ph("safe");
    ctx.save(); ctx.strokeStyle = key === "safe" ? C.sig : C.line; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(P.scan[0] - 30, 440); ctx.lineTo(P.scan[0] - 30, 300); ctx.arc(P.scan[0], 300, 30, Math.PI, 0); ctx.lineTo(P.scan[0] + 30, 440); ctx.stroke(); ctx.restore();
    if (key === "safe" && sk > 0.3 && sk < 0.78) { const by = lerp(300, 380, (Math.sin((sk - 0.3) / 0.48 * Math.PI * 2 - Math.PI / 2) + 1) / 2); ctx.save(); ctx.globalAlpha = 0.85; ctx.shadowColor = C.sig; ctx.shadowBlur = 14; ctx.fillStyle = C.sig; ctx.fillRect(P.scan[0] - 27, by, 54, 3); ctx.restore(); }
    // queue lane
    strokeRR(P.queue, key === "queue" ? C.sig : C.line, 1.2, 21, [4, 4]);
    // router + replicas
    const R = P.router; ctx.save(); ctx.translate(R[0], R[1]); ctx.rotate(Math.PI / 4); ctx.fillStyle = key === "route" ? C.sig : C.line; ctx.fillRect(-11, -11, 22, 22); ctx.restore();
    const rk = ph("route");
    const targets = [[P.reps[0].x + P.reps[0].w / 2, P.reps[0].y + P.reps[0].h], [P.reps[1].x + P.reps[1].w / 2, P.reps[1].y + P.reps[1].h], [P.srv.x, 345]];
    targets.forEach((tg, j) => { ctx.save(); ctx.strokeStyle = j === 2 && rk > 0.35 ? C.sig : C.line; ctx.globalAlpha = key === "route" ? 1 : 0.6; ctx.lineWidth = (j === 2 && rk > 0.35 ? 2.5 : 1.2) / scale; ctx.beginPath(); ctx.moveTo(R[0] + 12, R[1]); ctx.quadraticCurveTo(tg[0] - 20, R[1], tg[0], tg[1]); ctx.stroke(); ctx.restore(); });
    P.reps.forEach((r, j) => { ctx.fillStyle = C.bg2; rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill(); strokeRR(r, C.line, 1.2, 10);
      for (let d = 0; d < 8; d++) { ctx.fillStyle = C.amb; ctx.globalAlpha = 0.25 + 0.6 * ((Math.sin(t * 3 + d * 1.7 + j) + 1) / 2); ctx.fillRect(r.x + 12 + d * 12.5, r.y + r.h - 18, 8, 8); } ctx.globalAlpha = 1; });
    // GPU server
    const V = P.srv; ctx.fillStyle = C.bg2; rr(ctx, V.x, V.y, V.w, V.h, 16); ctx.fill();
    strokeRR(V, ["tok", "prefill", "think", "decode", "route"].includes(key) ? C.sig : C.line, 1.5, 16);
    // layers
    const Ly = P.layers;
    for (let j = 0; j < Ly.n; j++) { ctx.fillStyle = C.line; rr(ctx, Ly.x0 + j * Ly.dx, Ly.y, Ly.w, Ly.h, 5); ctx.fill(); }
    // sampler frame
    strokeRR({ x: P.samp.x, y: P.samp.y, w: P.samp.w, h: P.samp.h }, C.line, 1.2, 8);
    // KV grid frame
    const K = P.kv, kvCells = K.cols * K.rows;
    for (let c = 0; c < kvCells; c++) { const cx = K.x + (c % K.cols) * (K.cell + K.gap), cy = K.y + Math.floor(c / K.cols) * (K.cell + K.gap); ctx.fillStyle = C.line; ctx.globalAlpha = 0.45; ctx.fillRect(cx, cy, K.cell, K.cell); } ctx.globalAlpha = 1;

    // ----- dynamic -----
    const sendK = ph("send"), netK = ph("net"), safeK = ph("safe"), qK = ph("queue"), tokK = ph("tok"), preK = ph("prefill"), thK = ph("think"), decK = ph("decode");
    const decSeg = at("decode"), thinkSeg = at("think");
    // which output tokens have been emitted, and when (story time)
    const nOut = S.out.length, emitT = [];
    if (decSeg) { for (let j = 0; j < nOut; j++) { const u = (j + 1) / nOut; const k = u < 0.12 ? u / 0.12 * 0.45 : 0.45 + (u - 0.12) / 0.88 * 0.55; emitT.push(decSeg.t0 + k * decSeg.dur * 0.97); } }
    const FLY = hero ? 2.2 : 1.7;
    const landedN = emitT.filter(e => t >= e + FLY).length;
    // KV fill
    const sysCells = Math.ceil(S.sys / S.per), userCells = Math.ceil((S.inTok - S.sys) / S.per), thinkCells = Math.ceil(S.think / S.per);
    let filled = { sys: sysCells, user: Math.round(userCells * easeIO((preK - 0.15) / 0.75)), think: Math.round(thinkCells * thK), out: Math.ceil(emitT.filter(e => t >= e).length / S.per) };
    if (!S.cached) { filled.sys = Math.round(sysCells * easeIO((preK - 0.15) / 0.75)); }
    let c = 0; const paint = (n, col, a) => { for (let j = 0; j < n && c < kvCells; j++, c++) { const cx = K.x + (c % K.cols) * (K.cell + K.gap), cy = K.y + Math.floor(c / K.cols) * (K.cell + K.gap); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(cx, cy, K.cell, K.cell); } ctx.globalAlpha = 1; };
    paint(filled.sys, C.muted, 0.9); paint(filled.user, C.sig, 0.55); paint(filled.think, C.muted, 0.45); paint(filled.out, C.sig, 1);

    // prompt token chips
    if (tokK > 0) {
      S.chips.forEach((ch, j) => {
        const appear = clamp01((tokK - 0.25 - j * 0.035) / 0.2); if (appear <= 0) return;
        const read = preK > 0.1 + (ch.x - P.tokX0) / (P.tokX1 - P.tokX0) * 0.4;
        ctx.globalAlpha = appear; ctx.fillStyle = ch.kind === "sys" ? C.muted : ch.kind === "more" ? C.line : C.sig; ctx.globalAlpha = appear * (ch.kind === "user" ? (read ? 0.9 : 0.55) : 0.8);
        rr(ctx, ch.x, ch.y - 9 + (1 - appear) * 6, ch.w, 18, 5); ctx.fill(); ctx.globalAlpha = appear;
        ctx.fillStyle = ch.kind === "user" ? C.bg : C.ink; font(ctx, 11, "--f-mono"); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(ch.txt, ch.x + 5, ch.y + 1 + (1 - appear) * 6); ctx.globalAlpha = 1;
      });
    }
    // prefill wave: every token at once, layer by layer
    const glowLayer = (j, a, col) => { ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillStyle = col; rr(ctx, Ly.x0 + j * Ly.dx, Ly.y, Ly.w, Ly.h, 5); ctx.fill(); ctx.restore(); };
    if (key === "prefill") { const w = (preK - 0.12) / 0.7 * (Ly.n + 2); for (let j = 0; j < Ly.n; j++) { const d = Math.abs(w - j - 0.5); if (d < 1.6) glowLayer(j, (1 - d / 1.6) * 0.95, C.amb); }
      // streams of all tokens entering together
      for (let r = 0; r < 14; r++) { const yy = Ly.y + 10 + r * 13; const xx = Ly.x0 - 8 + ((w / (Ly.n + 2)) * (Ly.n * Ly.dx + 10)); if (preK > 0.12 && preK < 0.82) capsule(Math.min(xx, Ly.x0 + Ly.n * Ly.dx), yy, 10, 5, C.sig, 6, 0.8); } }
    // per-token pass (thinking + decoding): one dot crosses the layers, the sampler picks
    function tokenPass(k, col, showSampler) {
      const x = Ly.x0 - 10 + k * (Ly.n * Ly.dx + 4), j = Math.floor((x - Ly.x0) / Ly.dx);
      if (j >= 0 && j < Ly.n) glowLayer(j, 0.85, C.amb);
      if (k < 0.92) capsule(Math.min(x, P.samp.x - 6), Ly.y + Ly.h / 2, 12, 12, col, 10);
      if (showSampler) {
        const sp = clamp01((k - 0.55) / 0.3); const probs = [0.62, 0.21, 0.1, 0.07];
        probs.forEach((p, q) => { const yy = P.samp.y + 30 + q * 38; ctx.fillStyle = q === 0 && sp > 0.6 ? C.sig : C.muted; ctx.globalAlpha = sp; ctx.fillRect(P.samp.x + 8, yy, (P.samp.w - 16) * p * sp / 0.62, 14); ctx.globalAlpha = 1; });
      }
    }
    if (key === "think" && thinkSeg) { const n = 9, k = (thK * n) % 1; tokenPass(k, C.muted, false);
      label(P.samp.x + P.samp.w / 2, P.samp.y + P.samp.h / 2, `${Math.round(S.think * thK)} hidden`, { color: C.muted, size: 11, mono: true }); }
    if (key === "decode" && decSeg) { let j = emitT.findIndex(e => e > t); if (j < 0) j = nOut - 1; const start = j ? emitT[j - 1] : decSeg.t0; const k = clamp01((t - start) / Math.max(1e-3, emitT[j] - start)); tokenPass(k, C.sig, emitT[j] - start > 0.25);
      if (emitT[j] - start > 0.25 && k > 0.8) label(P.samp.x + P.samp.w / 2, P.samp.y - 14, JSON.stringify(S.out[j].trim() || "␣"), { color: C.sig, mono: true, size: 12, weight: "600" }); }
    // output tokens in flight
    emitT.forEach((e, j) => { const u = (t - e) / FLY; if (u <= 0 || u >= 1) return; const [x, y] = retPos(easeOut(u * 0.95 + 0.05) ); capsule(x, y, 14, 9, C.sig, 8, 0.95); });

    // the request packet
    const pk = (() => {
      if (sendK <= 0.45) return null;
      if (sendK < 1) return { p: [lerp(190, 340, easeIO((sendK - 0.45) / 0.55)), lerp(300, 335, easeIO((sendK - 0.45) / 0.55))], a: easeIO((sendK - 0.45) / 0.2) };
      if (netK < 1) return { p: bez(P.up, easeIO(netK)) };
      const gw = ph("gw"); if (gw < 1) return { p: [gw < 0.3 ? lerp(560, P.gate[0] - 46, easeIO(gw / 0.3)) : gw < 0.65 ? P.gate[0] - 46 : lerp(P.gate[0] - 46, 745, easeIO((gw - 0.65) / 0.35)), 345] };
      if (safeK < 1) return { p: [safeK < 0.3 ? lerp(745, P.scan[0], easeIO(safeK / 0.3)) : safeK < 0.78 ? P.scan[0] : lerp(P.scan[0], 845, easeIO((safeK - 0.78) / 0.22)), 345] };
      const qx = slot => 998 - slot * 24;
      if (qK < 1) { const arrive = easeIO(qK / 0.3), slot = S.others * (1 - easeIO((qK - 0.3) / 0.65)); return { p: [lerp(845, qx(S.others), arrive) + (qK > 0.3 ? qx(slot) - qx(S.others) : 0), 345], small: true }; }
      const rk2 = ph("route"); if (rk2 < 1) return { p: rk2 < 0.35 ? [lerp(998, P.router[0], easeIO(rk2 / 0.35)), 345] : [lerp(P.router[0], P.srv.x + 18, easeIO((rk2 - 0.35) / 0.65)), 345] };
      if (tokK < 0.3) return { p: [lerp(P.srv.x + 18, P.tokX0 + 40, easeIO(tokK / 0.3)), lerp(345, P.tokRows[0], easeIO(tokK / 0.3))], a: 1 - easeIO((tokK - 0.15) / 0.15) };
      return null;
    })();
    // other requests waiting in line
    if (S.others) { for (let j = 0; j < S.others; j++) { const slot = j - S.others * easeIO((qK - 0.3) / 0.65); const x = 998 - Math.max(slot, -2) * 24; const a = slot < 0 ? clamp01(1 + slot * 0.8) : 1; if (a > 0 && t < (at("route") ? at("route").t1 : 0)) capsule(slot < 0 ? x + (-slot) * 10 : x, 345, 18, 14, C.muted, 0, a * 0.9); } }
    if (pk) { const small = pk.small; capsule(pk.p[0], pk.p[1], small ? 22 : 44, small ? 16 : 20, C.sig, 16, pk.a == null ? 1 : pk.a);
      if (!small && !hero && scale > 0.9) { ctx.save(); ctx.globalAlpha = pk.a == null ? 1 : pk.a; font(ctx, 9, "--f-mono", "600"); ctx.fillStyle = C.bg; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("POST", pk.p[0], pk.p[1] + 0.5); ctx.restore(); } }
    // checks
    if (key === "gw" && gk > 0.3) label(P.gate[0], 285, gk > 0.55 ? "key ✓  rate limit ✓" : "checking…", { color: gk > 0.55 ? C.sig : C.muted, size: 11, mono: true });
    if (key === "safe" && sk > 0.78) label(P.scan[0], 285, "allowed ✓", { color: C.sig, size: 11, mono: true });
    if (key === "route" && rk > 0.35 && S.cached) label(P.srv.x + P.srv.w / 2, 516, "system prompt already cached here ✓", { color: C.sig, size: 11, mono: true });

    // screen content
    const thinkingNow = (key === "think") || (key === "decode" && landedN === 0 && S.think);
    drawScreenContent(landedN, sendK >= 1 ? 1 : sendK > 0 ? Math.min(0.999, sendK / 0.5) : 0, thinkingNow);

    // ----- labels (screen space, constant size) -----
    const lab = (x, y, text, keys, o = {}) => (o.minor && scale < 0.42 && !keys.includes(key)) ? null : label(x, y, text, { color: keys.includes(key) ? C.ink : C.muted, weight: keys.includes(key) ? "650" : "500", size: hero ? 11 : 12, ...o });
    lab(190, 478, "You", ["send", "done", "stream"]);
    lab(450, 214, "Internet", ["net"]);
    lab(612, 88, "Datacenter", [], { align: "left" });
    lab(P.gate[0], 462, "Gateway", ["gw"], { minor: true }); lab(P.scan[0], 462, "Safety check", ["safe"], { minor: true });
    lab(943, 392, S.others ? `Queue · ${S.others} ahead` : "Queue · empty", ["queue"], { minor: true });
    lab(P.router[0], 376, "Router", ["route"], { minor: true });
    lab(1238, 166, "Other replicas, full", ["route"], { minor: true });
    lab(P.srv.x + 22, 200, "GPU server · the model", ["tok", "prefill", "decode", "think"], { align: "left" });
    if (!hero && scale > 0.9) {
      lab(Ly.x0 + (Ly.n * Ly.dx) / 2 - 8, Ly.y + Ly.h + 16, "Layers (a real model has 30 to 120+)", ["prefill", "decode", "think"]);
      lab(P.samp.x + P.samp.w / 2, Ly.y + Ly.h + 16, "Next-token odds", ["decode"]);
      lab(K.x, K.y - 14, `KV cache: the model's notes · 1 square ≈ ${S.per} token${S.per > 1 ? "s" : ""}`, ["prefill", "decode", "think", "route"], { align: "left" });
    }

    // picture-in-picture of the screen while the camera is inside the server
    if (!hero && ["think", "decode"].includes(key)) {
      const pw = Math.min(260, W * 0.36), phh = pw * L.h / L.w, px = 14, py = 14;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 20; ctx.fillStyle = C.bg2; rr(ctx, px, py, pw, phh, 10); ctx.fill(); ctx.restore();
      const sc2 = pw / L.w; ctx.setTransform(dpr * sc2, 0, 0, dpr * sc2, dpr * (px - L.x * sc2), dpr * (py - L.y * sc2));
      const sv = scale; scale = sc2; drawScreenContent(landedN, 1, thinkingNow); scale = sv;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.strokeStyle = C.sig; ctx.lineWidth = 1; rr(ctx, px, py, pw, phh, 10); ctx.stroke();
      font(ctx, 10, "--f-display", "600"); ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Your screen", px + 8, py + phh + 14);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // remember the world transform for clicks
    cv._view = { scale, ox, oy };
  }

  // click a part of the machine to jump to its step
  function hitKey(sx, sy) {
    const v = cv._view; if (!v) return null; const x = (sx - v.ox) / v.scale, y = (sy - v.oy) / v.scale;
    const inR = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (inR({ x: 20, y: 220, w: 340, h: 260 })) return "send";
    if (inR({ x: 360, y: 190, w: 190, h: 330 })) return "net";
    if (inR({ x: 620, y: 270, w: 110, h: 190 })) return "gw";
    if (inR({ x: 750, y: 260, w: 110, h: 200 })) return "safe";
    if (inR({ x: 860, y: 300, w: 170, h: 100 })) return "queue";
    if (inR({ x: 1030, y: 80, w: 70, h: 330 }) || inR({ x: 1100, y: 80, w: 280, h: 90 })) return "route";
    if (inR({ x: 1100, y: 210, w: 450, h: 60 })) return "tok";
    if (inR({ x: 1100, y: 280, w: 360, h: 220 }) || inR({ x: 1100, y: 520, w: 450, h: 160 })) return "prefill";
    if (inR({ x: 1450, y: 280, w: 100, h: 220 })) return "decode";
    return null;
  }
  return { setup, draw, hitKey, get S() { return S; } };
}

/* ---------- Landing page hero: the same machine, looping quietly ---------- */
chapter("start", () => {
  const cv = $("#hero-cv"); if (!cv) return;
  const J = createJourney(cv, { hero: true });
  const prompts = [["Why is the sky blue?", "Sunlight contains every colour. Air scatters short blue wavelengths more strongly, so blue reaches your eyes from every part of the sky."],
    ["Write a haiku about servers.", "Fans hum through the night / a thousand racks hold their breath / your answer, then dawn"],
    ["What is 17 × 24?", "17 × 24 = 408. One way: 17 × 20 = 340, plus 17 × 4 = 68."]];
  let n = 0;
  const segsFor = () => [["map", 1.0], ["send", 1.2], ["net", 1.6], ["gw", 0.9], ["safe", 0.9], ["queue", 1.0], ["route", 0.9], ["tok", 1.0], ["prefill", 1.4], ["decode", 4.2], ["stream", 2.4], ["done", 1.4]].map(([key, dur]) => ({ key, dur, title: key }));
  function scen() { const [p, r] = prompts[n % prompts.length]; J.setup({ prompt: p, promptShort: p, reply: r, sys: 400, cached: true, inTok: 410, think: 0, busy: 0.35 }); }
  scen(); let segs = segsFor(), a = 0; segs.forEach(s => { s.t0 = a; a += s.dur; s.t1 = a; }); const T = a; let t = reduceMotion() ? segs[9].t0 + 2.5 : 0;
  const hgt = () => Math.round(Math.max(220, Math.min(440, innerW(cv.parentElement) * 0.46)));
  const segAt = x => segs.findIndex(s => x < s.t1);
  const frame = () => { const i = segAt(t); J.draw(t, i < 0 ? segs.length - 1 : i, segs, { h: hgt() }); };
  const loop = animLoop(dt => { t += dt; if (t >= T) { t = 0; n++; scen(); } frame(); });
  onRedraw(() => { frame(); if (!reduceMotion()) loop.start(); });
  cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Animation: a prompt travels from a laptop over the internet into a datacenter, through a gateway, a safety check, a queue and a router to a GPU server, and the reply streams back token by token.");
});
