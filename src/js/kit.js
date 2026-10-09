/* Kit: easing helpers, colours and the scene-drawing kit used by every simulation.
   Draw in "world" units under a camera; k.label() draws fixed-size screen text. */
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = x => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const bez = (p, k) => { const u = 1 - k; return [0, 1].map(i => u * u * u * p[0][i] + 3 * u * u * k * p[1][i] + 3 * u * k * k * p[2][i] + k * k * k * p[3][i]); };
const stageColors = () => ({ crit: "#ff7f72", ok: "#7ee08a", bg: css("--stage"), bg2: css("--stage-2"), line: css("--stage-line"), ink: css("--stage-ink"), muted: css("--stage-muted"), sig: css("--signal"), amb: css("--amber"), you: css("--you") });
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
    if (opt.grid !== false) { let g = opt.grid || 40; while ((cw / s / g) * (h / s / g) > 2500) g *= 2; ctx.fillStyle = k.C.line; const x0 = Math.floor((-k.ox / s) / g) * g, y0 = Math.floor((-k.oy / s) / g) * g, x1 = (cw - k.ox) / s, y1 = (h - k.oy) / s, r = 1 / s; for (let x = x0; x < x1; x += g) for (let y = y0; y < y1; y += g) ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
    return k;
  };
  k.world = () => { const d = dpr(); k.ctx.setTransform(d * k.scale, 0, 0, d * k.scale, d * k.ox, d * k.oy); };
  k.screen = () => { const d = dpr(); k.ctx.setTransform(d, 0, 0, d, 0, 0); };
  k.toScreen = (x, y) => [k.ox + x * k.scale, k.oy + y * k.scale];
  k.toWorld = (sx, sy) => [(sx - k.ox) / k.scale, (sy - k.oy) / k.scale];
  k.px = n => n / k.scale; // world units for n screen pixels
  k.box = (x, y, w, h, o = {}) => { if (!(w > 0 && h > 0)) return; const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; if (o.glow) { c.shadowColor = o.glowCol || o.fill || o.stroke; c.shadowBlur = o.glow; } rr(c, x, y, w, h, Math.min(o.r == null ? 8 : o.r, w / 2, h / 2)); if (o.fill) { c.fillStyle = o.fill; c.fill(); } if (o.stroke) { c.shadowBlur = 0; c.strokeStyle = o.stroke; c.lineWidth = k.px(o.lw || 1.5); if (o.dash) c.setLineDash(o.dash.map(k.px)); c.stroke(); } c.restore(); };
  k.pill = (cx, cy, w, h, col, o = {}) => k.box(cx - w / 2, cy - h / 2, w, h, { fill: col, r: h / 2, glow: o.glow, alpha: o.alpha });
  k.dot = (x, y, r, col, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; if (o.glow) { c.shadowColor = col; c.shadowBlur = o.glow; } c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore(); };
  k.line = (x1, y1, x2, y2, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.strokeStyle = o.col || k.C.line; c.lineWidth = k.px(o.lw || 1.5); if (o.dash) c.setLineDash(o.dash.map(k.px)); if (o.glow) { c.shadowColor = o.col; c.shadowBlur = o.glow; } c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore(); };
  k.curve = (p, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.strokeStyle = o.col || k.C.line; c.lineWidth = k.px(o.lw || 1.5); if (o.dash) c.setLineDash(o.dash.map(k.px)); c.beginPath(); c.moveTo(...p[0]); c.bezierCurveTo(...p[1], ...p[2], ...p[3]); c.stroke(); c.restore(); };
  k.text = (x, y, s, o = {}) => { const c = k.ctx; c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; font(c, o.size || 14, o.mono ? "--f-mono" : o.serif ? "--f-body" : "--f-display", o.weight || "500"); c.fillStyle = o.col || k.C.ink; c.textAlign = o.align || "center"; c.textBaseline = o.baseline || "middle"; c.fillText(s, x, y); c.restore(); };
  k.label = (x, y, s, o = {}) => { const [sx, sy] = k.toScreen(x, y); if (sx < -80 || sx > k.W + 80 || sy < -20 || sy > k.H + 20) return; const c = k.ctx; c.save(); k.screen(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; font(c, o.size || 12, o.mono ? "--f-mono" : "--f-display", o.weight || "500"); c.textAlign = o.align || "center"; c.textBaseline = "middle"; if (o.bg) { const tw = c.measureText(s).width, fs = o.size || 12, bx = sx + (o.dx || 0) - (c.textAlign === "center" ? tw / 2 : c.textAlign === "right" ? tw : 0); c.fillStyle = o.bg === true ? k.C.bg : o.bg; c.globalAlpha = 0.85; rr(c, bx - 4, sy + (o.dy || 0) - fs * 0.7, tw + 8, fs * 1.4, 4); c.fill(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; } c.fillStyle = o.col || k.C.muted; c.fillText(s, sx + (o.dx || 0), sy + (o.dy || 0)); c.restore(); };
  /* A line that fades from transparent (tail) to solid (head); pts = [[x,y], ...] in world units. */
  k.trail = (pts, col, o = {}) => { const c = k.ctx; if (pts.length < 2) return; c.save(); c.strokeStyle = col; c.lineCap = "round"; c.lineWidth = k.px(o.w || 2.5); if (o.glow) { c.shadowColor = col; c.shadowBlur = o.glow; }
    for (let i = 1; i < pts.length; i++) { c.globalAlpha = (o.alpha == null ? 1 : o.alpha) * Math.pow(i / (pts.length - 1), 1.6); c.beginPath(); c.moveTo(...pts[i - 1]); c.lineTo(...pts[i]); c.stroke(); } c.restore(); };
  /* n particles flowing along path(u) -> [x,y], u in 0..1, each with a short glowing trail. phase shifts them over time. */
  k.flow = (path, n, phase, col, o = {}) => { const len = o.len || 0.08, sz = o.size || 3; for (let j = 0; j < n; j++) { const u = ((j / n) + phase) % 1; const pts = []; for (let s = 6; s >= 0; s--) { const uu = u - len * s / 6; if (uu >= 0) pts.push(path(uu)); } if (pts.length > 1) k.trail(pts, col, { w: sz * 0.9, alpha: o.alpha == null ? 0.8 : o.alpha }); const [x, y] = path(u); k.dot(x, y, k.px(sz), col, { glow: o.glow == null ? 8 : o.glow, alpha: o.alpha }); } };
  /* Glass readout panel in screen space. corner: "tl" | "tr" | "bl" | "br". rows: [[key, value], ...] */
  k.hud = (corner, title, rows, o = {}) => {
    const c = k.ctx; c.save(); k.screen(); const sm = k.W < 500, pad = sm ? 7 : 10, lh = sm ? 14 : 17, fs = sm ? 10 : 11, w = sm ? Math.min(o.w || 190, 172) : (o.w || 190), h = pad * 2 + (title ? lh + 1 : 0) + rows.length * lh;
    const m = sm ? 8 : 12, x = corner[1] === "l" ? m : k.W - w - m, y = corner[0] === "t" ? m : k.H - h - m;
    c.globalAlpha = 0.82; c.fillStyle = k.C.bg2; rr(c, x, y, w, h, 10); c.fill(); c.globalAlpha = 1; c.strokeStyle = k.C.line; c.lineWidth = 1; c.stroke();
    let yy = y + pad + 6; c.textBaseline = "middle"; if (title) { font(c, fs, "--f-display", "650"); c.fillStyle = k.C.ink; c.textAlign = "left"; c.fillText(title, x + pad, yy); yy += lh + 1; }
    rows.forEach(([kk, v, col]) => { font(c, fs, "--f-display"); c.fillStyle = k.C.muted; c.textAlign = "left"; c.fillText(kk, x + pad, yy); font(c, fs + 0.5, "--f-mono", "600"); c.fillStyle = col || k.C.ink; c.textAlign = "right"; c.fillText(v, x + w - pad, yy); yy += lh; });
    c.restore(); k.world();
  };
  /* Wrapped text in world units: returns the height used. */
  k.para = (x, y, s, maxW, o = {}) => { const c = k.ctx; c.save(); font(c, o.size || 14, o.mono ? "--f-mono" : o.serif ? "--f-body" : "--f-display", o.weight || "400"); c.fillStyle = o.col || k.C.ink; c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.textAlign = "left"; c.textBaseline = "top"; const lh = (o.size || 14) * (o.lh || 1.35); const lines = wrapLines(c, s, maxW).slice(0, o.maxLines || 99); lines.forEach((l, i) => c.fillText(l, x, y + i * lh)); c.restore(); return lines.length * lh; };
  return k;
}
/* Linear blend of two camera rects. */
function camLerp(a, b, e) { return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e) }; }
/* Camera that eases from the previous step's framing to this step's over the first part of the step. */
function filmCam(cams, segs, i, t, keyOf = s => s.key) {
  const s = segs[i], p = segs[Math.max(0, i - 1)], a = cams[keyOf(p)] || cams.default, b = cams[keyOf(s)] || cams.default;
  const e = easeIO((t - s.t0) / Math.min(1.0, s.dur * 0.45)); return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e) };
}
/* Progress (0..1) through the step with this key; 0 before it, 1 after it. */
function stepK(segs, t, key) { const g = segs.find(x => x.key === key); if (!g) return 0; return clamp01((t - g.t0) / g.dur); }
/* Stage height for a figure: wide screens get a 2:1 stage, phones a near-square one. */
function stageH(el, wide = 0.5, narrow = 0.9) { const w = innerW(el); return w < 640 ? Math.round(Math.max(280, w * narrow)) : Math.round(Math.min(560, Math.max(360, w * wide))); }
