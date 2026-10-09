/* Chapter 7 film: from a web crawl to packed training sequences.
   64 cards stand for crawled pages; each stage removes some, survivors re-pack into a smaller grid. Every frame is a pure function of t. */
chapter("data", () => {
  const fig = $("#dt-film"); if (!fig) return;
  const narrow = () => (fig.clientWidth || 600) < 640;
  const convCol = ["#5ce1c6", "#ffb547", "#8fb3ff", "#d59cff", "#ff8fa3", "#9be37a", "#7fdcff", "#ffd27a"];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ---- the sample of pages: fates are fixed so the funnel reads 64 -> 52 -> 34 -> 26 -> 25 ----
  const N = 64, perm = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const LANGS = ["fr", "de", "ja", "es", "ru", "pt", "zh", "it"];
  const cards = Array.from({ length: N }, (_, id) => ({ id, drop: Infinity, lang: "en", score: 0, dupOf: -1, pii: false, bench: false,
    lines: [0, 1, 2, 3].map(() => 0.45 + rnd() * 0.55), cloud: [-260 + rnd() * 1540, -160 + rnd() * 960], delay: rnd() * 0.45 }));
  perm.forEach((id, i) => {
    const c = cards[id];
    if (i < 12) { c.drop = 2; c.lang = LANGS[i % LANGS.length]; c.score = 1 + rnd() * 3; }
    else if (i < 30) { c.drop = 3; c.score = 0.4 + rnd() * 1.9; }
    else if (i < 38) { c.drop = 4; c.score = 2.7 + rnd() * 2; }
    else if (i === 38) { c.drop = 5; c.bench = true; c.score = 3.6; }
    else { c.score = 2.7 + rnd() * 2.1; }
  });
  const keepers = perm.slice(39);
  perm.slice(30, 38).forEach((id, i) => { const o = keepers[(i * 3 + 1) % keepers.length]; cards[id].dupOf = o; cards[id].lines = cards[o].lines.slice(); cards[id].score = cards[o].score - 0.1; });
  keepers.filter((_, i) => i % 4 === 1).forEach(id => { cards[id].pii = true; });
  const FUN = [["crawled", 64], ["text extracted", 64], ["English", 52], ["passed quality", 34], ["after dedup", 26], ["private data cleaned", 25]];

  // ---- grid layout of the survivors of a stage ----
  const CW = 104, CHt = 62, PX = 118, PY = 76, COLS = 8, GX = 510, GY = 340;
  const alive = s => cards.filter(c => c.drop > s);
  const layoutCache = {};
  function layout(s) {
    if (layoutCache[s]) return layoutCache[s];
    const L = alive(s), rows = Math.ceil(L.length / COLS), m = new Map(), top = GY - rows * PY / 2;
    L.forEach((c, r) => { const row = Math.floor(r / COLS), inRow = Math.min(COLS, L.length - row * COLS), col = r % COLS; m.set(c.id, [GX - inRow * PX / 2 + col * PX + (PX - CW) / 2, top + row * PY + (PY - CHt) / 2]); });
    return (layoutCache[s] = m);
  }

  const steps = [
    { key: "crawl", short: "Crawl", title: "Start with a crawl of the web", dur: 5.5,
      text: [`It starts with a huge pile of web pages copied by a crawler that follows links from page to page. Each card here stands for one page, still wrapped in menus, ads and code.`,
             `Most pretraining text starts from Common Crawl, a public archive of web snapshots. Hugging Face's FineWeb processed 96 of those snapshots.`], link: "#ref-3" },
    { key: "extract", short: "Extract text", title: "Pull the writing out of the page", dur: 5.5,
      text: [`A web page is mostly menus, buttons, ads and footers. A program keeps the main writing and lets the rest fall away.`,
             `Text extraction parses the HTML and drops markup and boilerplate (navigation, ads, footers), keeping the main content. It is FineWeb's first stage.`], link: "#ref-3" },
    { key: "lang", short: "Language", title: "Keep the language you want", dur: 5.5,
      text: [`A quick check works out which language each page is written in. For an English dataset like FineWeb, the other pages are set aside.`,
             `Language identification labels every page (the demo above uses a stop-word check; production pipelines use a trained classifier). FineWeb keeps English.`], link: "#ref-3" },
    { key: "qual", short: "Quality", title: "Drop the low-quality pages", dur: 6,
      text: [`Simple rules catch junk such as keyword lists and pages full of symbols. A scoring model also rates how useful each page is, and pages below the cut-off go.`,
             `Gopher-style heuristics (word count, symbol ratio, repeated lines) plus a classifier score like FineWeb-Edu's educational-value rating. Here the cut-off is 2.5 out of 5.`], link: "#ref-3" },
    { key: "dedup", short: "Deduplicate", title: "Merge the near-copies", dur: 6,
      text: [`The web is full of copies: the same article on many sites with a different footer. Near-identical pages are merged into one, so the model doesn't read the same thing again and again.`,
             `MinHash estimates the Jaccard overlap of 3-word shingle sets, and locality-sensitive hashing finds likely pairs without comparing every pair. FineWeb deduplicated each snapshot this way.`], link: "#ref-3" },
    { key: "clean", short: "Privacy and tests", title: "Mask private details, remove test questions", dur: 5.5,
      text: [`Email addresses and similar private details are blanked out. Pages that contain the answers to well-known tests are removed, so test scores stay honest.`,
             `FineWeb anonymised email and IP addresses. Labs also respect robots.txt opt-outs and decontaminate by n-gram matching against benchmark sets.`], link: "#ref-3" },
    { key: "tokens", short: "Tokens and mix", title: "Turn text into tokens and blend the sources", dur: 6.5,
      text: [`The clean text is chopped into tokens, the pieces the model actually reads. Web text is then blended with code, maths and more, in amounts chosen by testing on small models.`,
             `At roughly 0.75 words per token, FineWeb's 96 snapshots came to a 15T-token English dataset. Mixture weights (web, code, maths, other languages, synthetic text) are set by ablations: small models trained on each candidate mix.`], link: "#ref-1" },
    { key: "pack", short: "Pack", title: "Pack documents into fixed-length rows", dur: 6.5,
      text: [`Training reads text in rows of exactly the same length. Documents are laid end to end with a stop marker between them, and cut wherever a row ends.`,
             `Documents are concatenated with an end-of-document token and split into fixed-length sequences. Over 80% of documents in several popular datasets are under 2k tokens, so most sequences mix unrelated texts.`], link: "#ref-1" }
  ];
  const wide = {
    default: { x: -10, y: 10, w: 1320, h: 660 },
    crawl: { x: -10, y: 10, w: 1320, h: 660 }, extract: { x: -10, y: 10, w: 1320, h: 660 }, lang: { x: -10, y: 10, w: 1320, h: 660 },
    qual: { x: -10, y: 10, w: 1320, h: 660 }, dedup: { x: -10, y: 10, w: 1320, h: 660 }, clean: { x: -10, y: 10, w: 1320, h: 660 },
    tokens: { x: 1000, y: 10, w: 1320, h: 660 }, pack: { x: 1000, y: 730, w: 1320, h: 660 }
  };
  const tall = {
    default: { x: 20, y: -10, w: 980, h: 880 },
    crawl: { x: 20, y: -10, w: 980, h: 880 }, extract: { x: 20, y: -10, w: 980, h: 880 }, lang: { x: 20, y: -10, w: 980, h: 880 },
    qual: { x: 20, y: -10, w: 980, h: 880 }, dedup: { x: 20, y: -10, w: 980, h: 880 }, clean: { x: 20, y: -10, w: 980, h: 880 },
    tokens: { x: 1060, y: 20, w: 1220, h: 800 }, pack: { x: 1100, y: 560, w: 1140, h: 840 }
  };
  const cams = new Proxy({}, { get: (_, key) => (narrow() ? tall : wide)[key] });

  // ---- one page card ----
  function card(k, c, x, y, o) {
    const C = k.C, a = o.alpha == null ? 1 : o.alpha; if (a <= 0.01) return;
    const edge = o.edge || C.line;
    k.box(x, y, CW, CHt, { fill: C.bg2, stroke: edge, r: 7, alpha: a, glow: o.glow || 0, glowCol: edge });
    const b = o.boiler == null ? 0 : o.boiler, fallen = 1 - b; // boilerplate: nav bar, ad box, footer
    if (b > 0.01) {
      const dy = fallen * 46, ba = a * b;
      k.box(x + 6, y + 6 + dy, CW - 12, 7, { fill: C.muted, r: 2, alpha: ba * 0.7 });
      k.box(x + CW - 30, y + 19 + dy * 1.3, 22, 30, { stroke: C.amb, r: 3, alpha: ba * 0.8, dash: [3, 2] });
      k.box(x + 6, y + CHt - 9 + dy * 0.6, CW - 12, 4, { fill: C.muted, r: 2, alpha: ba * 0.6 });
      k.text(x + CW - 19, y + 34 + dy * 1.3, "ad", { col: C.amb, size: 9, alpha: ba * 0.9 });
    }
    const tx0 = x + 8, full = (CW - 16) - (b > 0.01 ? 26 * b : 0), ty0 = y + 19 - 6 * (1 - b) * (o.boiler == null ? 1 : 1);
    c.lines.forEach((l, i) => k.box(tx0, ty0 + i * 9, full * l, 4, { fill: o.lineCol || C.ink, r: 2, alpha: a * (o.lineA == null ? (0.35 + 0.4 * (1 - b)) : o.lineA) }));
    if (o.tag) k.text(x + CW - 13, y + CHt - 11, o.tag, { col: o.tagCol || C.muted, size: 13, mono: true, weight: "600", alpha: a * (o.tagA == null ? 1 : o.tagA) });
    if (o.badge) { const bw = 40; k.box(x + 6, y + CHt - 20, bw, 15, { fill: o.badgeCol, r: 7, alpha: a * 0.9 }); k.text(x + 6 + bw / 2, y + CHt - 12, o.badge, { col: C.bg, size: 11, mono: true, weight: "700", alpha: a }); }
    if (o.chip) { k.box(x + 34, y + 25, 56, 15, { fill: o.chipCol, r: 4, alpha: a }); k.text(x + 62, y + 33, o.chip, { col: C.bg, size: 10, mono: true, weight: "700", alpha: a }); }
  }

  function funnelHud(k, s, p) {
    const C = k.C, rows = [];
    for (let i = 0; i <= Math.min(s, 5); i++) {
      let v = FUN[i][1];
      if (i === s && i >= 2) v = Math.round(lerp(FUN[i - 1][1], FUN[i][1], easeIO((p - 0.3) / 0.25)));
      rows.push([FUN[i][0], String(v) + (i === 0 ? "" : " (" + Math.round(v / 64 * 100) + "%)"), i === s ? (i >= 2 ? C.amb : C.sig) : C.ink]);
    }
    k.hud(narrow() ? "bl" : "tr", narrow() ? "" : "Pages kept · illustrative sample", narrow() ? rows.slice(-2) : rows, { w: 220 });
  }

  function drawGrid(k, f, s) {
    const C = k.C, p = f.p;
    const prev = layout(Math.max(1, s - 1)), next = layout(Math.max(1, s));
    const markP = clamp01((p - 0.05) / 0.2), fallP = clamp01((p - 0.3) / 0.25), moveP = easeIO((p - 0.55) / 0.2);
    // links between pages during the crawl
    if (s === 0) {
      const L = layout(1);
      for (let i = 0; i < N; i += 3) {
        const a = cards[i], b = cards[(i * 7 + 5) % N];
        const ua = easeOut((p - a.delay) / 0.4), ub = easeOut((p - b.delay) / 0.4); if (ua < 0.9 || ub < 0.9) continue;
        const [x1, y1] = L.get(a.id), [x2, y2] = L.get(b.id);
        k.line(x1 + CW / 2, y1 + CHt / 2, x2 + CW / 2, y2 + CHt / 2, { col: C.sig, lw: 1, alpha: 0.18 });
        if (i % 2 === 0) k.flow(u => [lerp(x1 + CW / 2, x2 + CW / 2, u), lerp(y1 + CHt / 2, y2 + CHt / 2, u)], 1, f.t * 0.6 + i * 0.13, C.sig, { len: 0.18, size: 2.5 });
      }
    }
    for (const c of cards) {
      if (c.drop < s) continue;
      let x, y, alpha = 1, o = {};
      if (s === 0) {
        const L = layout(1), [gx, gy] = L.get(c.id), u = easeOut((p - c.delay) / 0.4);
        x = lerp(c.cloud[0], gx, u); y = lerp(c.cloud[1], gy, u); alpha = clamp01(u * 3) * (0.4 + 0.6 * u);
        o = { boiler: 1, edge: u > 0.98 ? C.line : C.sig, lineA: 0.35 };
      } else if (c.drop === s) {
        [x, y] = prev.get(c.id);
        if (c.dupOf >= 0) { const [ox, oy] = prev.get(c.dupOf), u = easeIO((p - 0.25) / 0.25); x = lerp(x, ox + 8, u); y = lerp(y, oy + 8, u); alpha = 1 - clamp01((p - 0.45) / 0.1); }
        else { y += fallP * fallP * 160; alpha = 1 - fallP; }
        o.edge = markP > 0 ? C.amb : C.line; o.glow = markP > 0 && fallP < 0.5 ? 10 * markP : 0;
      } else {
        const [x0, y0] = prev.get(c.id), [x1, y1] = next.get(c.id);
        x = lerp(x0, x1, s >= 2 && s <= 5 ? moveP : 0); y = lerp(y0, y1, s >= 2 && s <= 5 ? moveP : 0);
      }
      // per-stage decorations
      if (s === 1) o.boiler = 1 - easeIO((p - 0.12) / 0.55), o.lineA = 0.35 + 0.5 * easeIO((p - 0.12) / 0.55), o.edge = p > 0.12 && p < 0.75 ? C.sig : C.line, o.glow = p > 0.2 && p < 0.7 ? 6 : 0;
      if (s >= 2) { o.tag = c.lang; o.tagCol = c.lang === "en" ? C.sig : C.amb; o.tagA = s === 2 ? clamp01(p / 0.12) : 0.45; }
      if (s >= 3 && (c.drop >= 3)) { const show = s === 3 ? clamp01((p - 0.02) / 0.12) : 0.55; if (show > 0) { o.badge = c.score.toFixed(1); o.badgeCol = c.score < 2.5 ? C.amb : C.sig; } }
      if (s === 4 && c.drop > 4 && cards.some(d => d.dupOf === c.id)) { const pulse = clamp01((p - 0.4) / 0.1) * (1 - clamp01((p - 0.8) / 0.15)); o.edge = pulse > 0 ? C.sig : o.edge || C.line; o.glow = 14 * pulse; }
      if (s === 5 && c.pii) { const m = clamp01((p - 0.3) / 0.2); o.chip = m < 0.5 ? "a@b.com" : "[email]"; o.chipCol = m < 0.5 ? C.amb : C.muted; o.edge = m > 0 && m < 1 ? C.sig : C.line; }
      if (s === 5 && c.bench) { o.chip = "test Q"; o.chipCol = C.amb; }
      if (s >= 6) { o.lineCol = C.sig; o.lineA = 0.75; }
      if (o.badge && o.badgeCol === C.amb && s > 3) delete o.badge;
      card(k, c, x, y, { alpha, ...o });
    }
    // near-copy links
    if (s === 4) cards.filter(c => c.dupOf >= 0).forEach(c => { const a = clamp01((p - 0.05) / 0.12) * (1 - clamp01((p - 0.25) / 0.08)); if (a <= 0) return; const [x1, y1] = prev.get(c.id), [x2, y2] = prev.get(c.dupOf); k.line(x1 + CW / 2, y1 + CHt / 2, x2 + CW / 2, y2 + CHt / 2, { col: C.amb, lw: 1.5, alpha: a * 0.8, dash: [5, 4] }); });
    if (s === 3) { const a = clamp01(p / 0.15) * (1 - clamp01((p - 0.85) / 0.15)); k.label(GX, 26, "Keep pages scoring 2.5 or more", { col: C.ink, alpha: a, weight: "600" }); }
    if (s === 2) { const a = clamp01(p / 0.15) * (1 - clamp01((p - 0.85) / 0.15)); k.label(GX, 26, "Keep English pages", { col: C.ink, alpha: a, weight: "600" }); }
    if (s === 4) { const a = clamp01(p / 0.15) * (1 - clamp01((p - 0.85) / 0.15)); k.label(GX, 26, "Near-copies merge into one page", { col: C.ink, alpha: a, weight: "600" }); }
    if (s === 0) k.label(GX, 26, "A web crawl", { col: C.ink, weight: "600", alpha: clamp01(p / 0.2) });
    if (s === 1) { const a = clamp01((p - 0.1) / 0.15) * (1 - clamp01((p - 0.9) / 0.1)); k.label(GX, 26, "Menus, ads and footers fall away", { col: C.ink, alpha: a, weight: "600" }); }
    if (s === 5) { const a = clamp01(p / 0.15) * (1 - clamp01((p - 0.9) / 0.1)); k.label(GX, 26, "Private details masked · test questions removed", { col: C.ink, alpha: a, weight: "600" }); }
  }

  // ---- tokens and mixing ----
  const SENT = ["Water", " boils", " at", " 100", " degrees", "."];
  const SRC = [["Web pages", 0], ["Code", 2], ["Maths", 3], ["Other languages", 4], ["Synthetic text", 7]];
  const TRIALS = [[0.70, 0.08, 0.07, 0.10, 0.05], [0.45, 0.25, 0.12, 0.10, 0.08], [0.58, 0.15, 0.10, 0.10, 0.07]];
  function drawTokens(k, f) {
    const C = k.C, p = f.p, ax = 1080;
    // sentence -> token chips
    const sp = easeIO((p - 0.04) / 0.22);
    k.label(ax, 66, "Clean text becomes tokens", { align: "left", col: C.ink, weight: "600" });
    let x = ax; const y = 110;
    SENT.forEach((w, i) => {
      const wpx = 14 + w.length * 13, gx = x + i * 14 * sp;
      k.box(gx, y - 20, wpx, 40, { fill: sp > 0.5 ? C.bg2 : "rgba(0,0,0,0)", stroke: sp > 0.05 ? convCol[i % 8] : C.bg, r: 8, alpha: 0.35 + 0.65 * sp });
      k.text(gx + wpx / 2, y + 1, w.trim() === "" ? "·" : w.replace(/^ /, "␣"), { col: C.ink, size: 20, mono: true });
      x += wpx;
    });
    const sx = 1080, sy = 230, sh = 74;
    const mixX = 1720, mixY = 300, mixW = 520, mixH = 50;
    // trials: three small candidate mixes, the third wins
    const tp = clamp01((p - 0.35) / 0.4), win = 2, pick = easeIO((p - 0.78) / 0.15);
    const curMix = TRIALS[Math.min(2, Math.floor(tp * 3))].map((v, i) => lerp(v, TRIALS[win][i], pick));
    SRC.forEach(([name, ci], i) => {
      const y0 = sy + i * sh, col = convCol[ci];
      k.box(sx, y0, 210, 50, { fill: C.bg2, stroke: col, r: 10 });
      k.text(sx + 105, y0 + 26, name, { col: C.ink, size: 17 });
      const ty = mixY + mixH / 2;
      const path = u => bez([[sx + 210, y0 + 25], [sx + 420, y0 + 25], [mixX - 200, ty], [mixX, ty]], u);
      k.curve([[sx + 210, y0 + 25], [sx + 420, y0 + 25], [mixX - 200, ty], [mixX, ty]], { col: col, lw: 1, alpha: 0.25 });
      const n = Math.max(1, Math.round(curMix[i] * 14));
      if (p > 0.2) k.flow(path, n, f.t * 0.35 + i * 0.17, col, { len: 0.1, size: 3 });
    });
    // main mixture bar
    k.label(mixX, mixY - 22, "Training mixture", { align: "left", col: C.ink, weight: "600" });
    k.box(mixX, mixY, mixW, mixH, { stroke: C.line, r: 8 });
    let cx = mixX; const fill = easeOut((p - 0.2) / 0.5);
    curMix.forEach((v, i) => { const w = v * mixW * fill; k.box(cx + 2, mixY + 4, Math.max(0, w - 4), mixH - 8, { fill: convCol[SRC[i][1]], r: 5, alpha: 0.85 }); cx += w; });
    // ablation trials
    if (!narrow()) k.label(mixX, 412, "Small test models, one per candidate mix", { align: "left", col: C.muted });
    TRIALS.forEach((mix, j) => {
      const a = clamp01((tp - j / 3) / 0.12); if (a <= 0) return;
      const y0 = 440 + j * 62; let cx2 = mixX;
      mix.forEach((v, i) => { k.box(cx2 + 1, y0, v * 300 - 2, 26, { fill: convCol[SRC[i][1]], r: 4, alpha: 0.75 * a }); cx2 += v * 300; });
      const score = [0.45, 0.62, 0.8][j], sc = j === win && pick > 0 ? C.sig : C.muted;
      k.box(mixX + 320, y0 + 4, 180 * score * a, 18, { fill: sc, r: 4, alpha: 0.8 });
      if (j === 0 && !narrow()) k.label(mixX + 320, y0 - 10, "score", { align: "left", col: C.muted, size: 11 });
      if (j === win && pick > 0) k.box(mixX - 8, y0 - 6, 516, 38, { stroke: C.sig, r: 8, glow: 10 * pick, alpha: pick });
    });
    const tr = [["words per token", "≈ 0.75"], ["FineWeb input", "96 crawl snapshots"], ["FineWeb output", "15T tokens", C.sig]];
    k.hud(narrow() ? "bl" : "tr", narrow() ? "" : "From pages to tokens", narrow() ? tr.slice(0, 1) : tr, { w: narrow() ? 180 : 220 });
  }

  // ---- packing ----
  const DOCS = [7, 15, 4, 22, 9, 3, 12, 18, 6, 10, 26, 5, 8, 14, 11, 20, 4, 9, 16, 7, 13, 30, 6, 12];
  const SEQ = 36, ROWS = 6, SW = 26;
  const slots = []; DOCS.forEach((d, j) => { for (let q = 0; q < d; q++) slots.push(j); slots.push(-1); });
  function drawPack(k, f) {
    const C = k.C, p = f.p, x0 = 1100, y0 = 900, rowH = 70, total = SEQ * ROWS;
    const filled = Math.floor(easeIO((p - 0.05) / 0.85) * total);
    k.label(x0, y0 - 52, "Fixed-length training sequences", { align: "left", col: C.ink, weight: "600" });
    k.line(x0, y0 - 22, x0 + SEQ * SW, y0 - 22, { col: C.muted, lw: 1 }); k.line(x0, y0 - 28, x0, y0 - 16, { col: C.muted, lw: 1 }); k.line(x0 + SEQ * SW, y0 - 28, x0 + SEQ * SW, y0 - 16, { col: C.muted, lw: 1 });
    k.label(x0 + SEQ * SW / 2, y0 - 22, "same length every row", { col: C.muted, size: 11, dy: -10 });
    let docsDone = 0;
    for (let r = 0; r < ROWS; r++) {
      const y = y0 + r * rowH;
      k.label(x0 - 14, y + 20, String(r + 1), { align: "right", col: C.muted, size: 11 });
      for (let q = 0; q < SEQ; q++) {
        const idx = r * SEQ + q, x = x0 + q * SW, d = slots[idx];
        if (idx >= filled) { k.box(x + 2, y + 4, SW - 4, 30, { stroke: C.line, r: 4, alpha: 0.6 }); continue; }
        const head = idx === filled - 1;
        if (d === -1) { k.box(x + 2, y + 4, SW - 4, 30, { fill: C.ink, r: 4, glow: head ? 12 : 0, glowCol: C.ink }); k.box(x + SW / 2 - 1.5, y + 10, 3, 20, { fill: C.bg, r: 1 }); docsDone++; }
        else k.box(x + 2, y + 4, SW - 4, 30, { fill: convCol[d % 8], r: 4, alpha: 0.85, glow: head ? 12 : 0 });
      }
    }
    // point at one separator
    const sepIdx = slots.indexOf(-1, SEQ + 2), sr = Math.floor(sepIdx / SEQ), sq = sepIdx % SEQ;
    if (filled > sepIdx) { const sx = x0 + sq * SW + SW / 2, sy = y0 + sr * rowH + 36; k.line(sx, sy + 4, sx + 40, y0 + ROWS * rowH + 6, { col: C.ink, lw: 1, alpha: 0.7 }); k.label(sx + 44, y0 + ROWS * rowH + 14, "end-of-document token", { align: "left", col: C.ink, size: 12 }); }
    // documents cut at the row boundary
    const cutRow = [0, 1, 2, 3, 4].find(r => slots[r * SEQ + SEQ - 1] !== -1 && slots[r * SEQ + SEQ] === slots[r * SEQ + SEQ - 1] && filled > (r + 1) * SEQ + 1);
    if (cutRow != null && !narrow()) { const cx = x0 + SEQ * SW + 10, cy = y0 + cutRow * rowH + 20; k.label(cx, cy, "document continues", { align: "left", col: C.muted, size: 11 }); k.label(cx, cy + 22, "on the next row", { align: "left", col: C.muted, size: 11 }); }
    const pr = [["sequence length", SEQ + " tokens here"], ["documents finished", String(docsDone), C.sig], ["docs under 2k tokens", "over 80%"]];
    k.hud("tr", narrow() ? "" : "Packing", narrow() ? pr.slice(1) : pr, { w: narrow() ? 190 : 220 });
  }

  storyFilm(fig, {
    label: "Animated explanation of how web pages become training data",
    steps, cams,
    draw(k, f) {
      const s = steps.findIndex(x => x.key === f.key);
      if (s <= 5) { drawGrid(k, f, s); funnelHud(k, s, f.p); return; }
      if (s === 6) { if (f.p < 0.16) drawGrid(k, { ...f, p: 1 }, 6); drawTokens(k, f); return; }
      drawPack(k, f);
    }
  });
});
