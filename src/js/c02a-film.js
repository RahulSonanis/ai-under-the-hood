/* Chapter 2 film: from text to numbers. Bytes, byte-pair merges, token IDs, embedding lookup, the meaning map. */
chapter("tokens", () => {
  const fig = $("#tk-film"); if (!fig) return;
  const narrow = () => innerW(fig) < 640;

  // ---- the sentence, one byte per character; spaces attach to the next word and show as · ----
  const CHARS = "the·cat·sat·on·the·mat".split("");
  const HEX = c => c === "·" ? "20" : c.charCodeAt(0).toString(16);
  const RULES = [["a", "t"], ["t", "h"], ["th", "e"], ["o", "n"], ["·", "the"], ["·", "on"], ["c", "at"], ["s", "at"], ["m", "at"], ["·", "cat"], ["·", "sat"], ["·", "mat"]];
  const SCHED = [["merge", 0.04, 0.40], ["merge", 0.44, 0.69], ["merge", 0.72, 0.96]];
  for (let r = 3; r < RULES.length; r++) SCHED.push(["more", 0.03 + (r - 3) * 0.088, 0.03 + (r - 3) * 0.088 + 0.08]);
  const TOK = [["the", 1169], ["·cat", 3797], ["·sat", 3332], ["·on", 319], ["·the", 262], ["·mat", 2603]];
  const SLOT = { 262: 5, 319: 8, 1169: 15, 2603: 22, 3332: 28, 3797: 33 };
  // made-up embedding values, deterministic
  const vec = j => [0, 1, 2, 3].map(q => { const v = Math.sin(j * 12.9898 + q * 78.233) * 43758.5453; const r = (v - Math.floor(v)) * 2 - 1; return Math.abs(r) < 0.06 ? r + 0.31 : r; });

  // meaning map, same hand-placed coordinates as the chapter's interactive
  const BG = [["king", 0.70, 0.78], ["queen", 0.86, 0.62], ["man", 0.52, 0.52], ["woman", 0.68, 0.36], ["boy", 0.40, 0.58], ["girl", 0.56, 0.42],
    ["walk", 0.12, 0.26], ["walked", 0.24, 0.12], ["swim", 0.10, 0.44], ["swam", 0.22, 0.30], ["paris", 0.36, 0.92], ["france", 0.20, 0.84],
    ["gpu", 0.90, 0.16], ["chip", 0.84, 0.06], ["dog", 0.50, 0.16]];
  const MINE = [["the", 0.05, 0.62], ["·cat", 0.41, 0.25], ["·sat", 0.36, 0.05], ["·on", 0.06, 0.76], ["·the", 0.15, 0.68], ["·mat", 0.64, 0.12]];

  // ---- layout (desktop and phone) ----
  const L = () => {
    const n = narrow();
    return n ? {
      n, cx: i => 60 + (i < 11 ? i : i - 11) * 46, cy: i => i < 11 ? 250 : 350, CW: 40, CHh: 52, sy: 150,
      tok: j => ({ x: 50 + (j % 3) * 180, y: 200 + Math.floor(j / 3) * 190, w: 160, h: 56 }), fs: 24,
      TB: { x: 740, y: 60, w: 190, n: 40, rh: 14 },
      MP: { x: 620, y: 50, w: 600, h: 600 },
      eng: j => ({ x: 50 + (j % 3) * 180, y: 820 + Math.floor(j / 3) * 76, w: 160, h: 52 }),
      th: b => ({ x: 46 + (b % 14) * 44, y: 1030 + Math.floor(b / 14) * 64 }), ty0: 1000, sx: 360
    } : {
      n, cx: i => 60 + (i < 11 ? i : i - 11) * 46, cy: i => i < 11 ? 250 : 350, CW: 40, CHh: 52, sy: 160,
      tok: j => ({ x: 70 + j * 165, y: 250, w: 145, h: 56 }), fs: 20,
      TB: { x: 1170, y: 40, w: 210, n: 40, rh: 15 },
      MP: { x: 1150, y: 30, w: 820, h: 620 },
      eng: j => ({ x: 120 + j * 160, y: 830, w: 140, h: 52 }),
      th: b => ({ x: 120 + (b % 21) * 44, y: 980 + Math.floor(b / 21) * 64 }), ty0: 950, sx: 580
    };
  };
  const mapPt = (lay, x, y) => [lay.MP.x + 30 + x * (lay.MP.w - 60), lay.MP.y + 30 + (1 - y) * (lay.MP.h - 60)];

  function applyRule(ps, [a, b]) { const out = []; for (let i = 0; i < ps.length; i++) { if (i + 1 < ps.length && ps[i].s === a && ps[i + 1].s === b) { out.push({ s: a + b, i0: ps[i].i0, n: ps[i].n + ps[i + 1].n }); i++; } else out.push(ps[i]); } return out; }
  function pairsOf(ps, [a, b]) { const out = []; for (let i = 0; i + 1 < ps.length; i++) if (ps[i].s === a && ps[i + 1].s === b) { out.push(i); i++; } return out; }
  const base = () => CHARS.map((c, i) => ({ s: c, i0: i, n: 1 }));
  const stateAfter = n => { let ps = base(); for (let r = 0; r < n; r++) ps = applyRule(ps, RULES[r]); return ps; };

  const cams = {
    get default() { return narrow() ? { x: 20, y: 100, w: 600, h: 400 } : { x: -10, y: 105, w: 830, h: 400 }; },
    get bytes() { return this.default; }, get merge() { return this.default; }, get more() { return this.default; },
    get ids() { return narrow() ? { x: 20, y: 120, w: 600, h: 480 } : { x: 30, y: 30, w: 1100, h: 540 }; },
    get lookup() { return narrow() ? { x: 30, y: 40, w: 920, h: 640 } : { x: 40, y: 20, w: 1370, h: 650 }; },
    get map() { return narrow() ? { x: 590, y: 30, w: 660, h: 640 } : { x: 40, y: 0, w: 1960, h: 680 }; },
    get dir() { return narrow() ? { x: 590, y: 30, w: 660, h: 640 } : { x: 760, y: -10, w: 1360, h: 690 }; },
    get lang() { return narrow() ? { x: 20, y: 760, w: 680, h: 600 } : { x: 60, y: 760, w: 1120, h: 470 }; }
  };

  const steps = [
    { key: "bytes", short: "Bytes", title: "Text starts as tiny pieces", dur: 5.5,
      text: [`The computer can't read words, only numbers. So it starts with the smallest pieces: one box per letter, and each space shown as a dot.`,
             `Byte-level BPE starts from the 256 possible byte values, so any input can be encoded. Each character here is one byte (hex below it); spaces attach to the start of the next word, shown as ·.`], link: "#ref-63" },
    { key: "merge", short: "Merge pairs", title: "The most common pair becomes one piece", dur: 7.5,
      text: [`Find the two neighbours that sit together most often and glue them into one piece. Here "a" next to "t" appears 3 times, so it goes first. Each glue step is saved as a rule.`,
             `BPE training is greedy: count every adjacent pair, merge the most frequent one into a new symbol, record the rule, repeat. Here a+t (3), then t+h (2), then th+e (2).`], link: "#ref-4" },
    { key: "more", short: "Keep merging", title: "Keep merging until common words are whole", dur: 6,
      text: [`Repeat this many times and common words become single pieces. A real tokenizer learns its rules from a huge pile of text, then uses them in the same order on everything you type.`,
             `Training stops when the vocabulary reaches its target size: around 50k for English-only models, about 128k for Llama 3. Encoding applies the merges in learned order. Here 22 bytes become 6 tokens.`], link: "#ref-1" },
    { key: "ids", short: "IDs", title: "Each token becomes an ID number", dur: 5.5,
      text: [`Every piece in the vocabulary has its own number, like a page number in a dictionary. Now the sentence is just six numbers.`,
             `The tokenizer outputs integer IDs from 0 to |V| − 1. These IDs are illustrative; every tokenizer numbers its vocabulary differently. "the" and "·the" are different tokens with different IDs.`] },
    { key: "lookup", short: "Look up", title: "Each ID reads one row of a big table", dur: 7,
      text: [`The model keeps a huge table with one row per token. The ID says which row to read, and that row is a long list of numbers.`,
             `The embedding table is vocabulary × d_model: 128,256 × 4,096 in Llama 3 8B, about 525 million numbers. Looking up token i just reads row i (x = e_iᵀE). Values shown are made up.`], link: "#ref-1" },
    { key: "map", short: "Meaning map", title: "Those numbers are a place on a map", dur: 6.5,
      text: [`Treat the numbers as coordinates and every token gets a home on a map. Words with similar meanings live near each other, like "cat" next to "dog".`,
             `Real embeddings have thousands of dimensions, drawn here as two, and positions are learned in training. Closeness is usually measured by cosine similarity, u·v / (‖u‖‖v‖). Positions here are hand-placed.`] },
    { key: "dir", short: "Directions", title: "Directions on the map carry meaning", dur: 6,
      text: [`Going the same way on the map changes meaning the same way. The step from "man" to "woman" also takes you from "king" to "queen", and "walk" to "walked" matches "swim" to "swam".`,
             `Vector offsets like king − man + woman ≈ queen appeared in word2vec embeddings. In large transformers they are messier, but direction can still carry meaning.`], link: "#ref-56" },
    { key: "lang", short: "Other languages", title: "Less familiar text needs more tokens", dur: 6.5,
      text: [`A tokenizer that learned mostly from English has few rules for other languages. A similar sentence in Thai stays in many small pieces, so it uses more tokens and costs more.`,
             `Each Thai character is 3 bytes in UTF-8; with few learned merges they stay as characters or byte fragments (counts here are illustrative). Fertility, tokens per word, varies widely across languages, and pricing and context windows are counted in tokens.`], link: "#ref-64" }
  ];

  const THAI = "แมวนั่งบนเสื่อ";
  const THB = Array.from(new TextEncoder().encode(THAI)).map(b => b.toString(16));
  // illustrative final pieces as byte ranges [start, length]: mostly whole characters, two split, two merged
  const THP = [[0, 2], [2, 1], [3, 3], [6, 3], [9, 3], [12, 6], [18, 3], [21, 6], [27, 3], [30, 2], [32, 1], [33, 3], [36, 3], [39, 3]];

  function pieceBox(k, lay, x, y, w, s, o = {}) {
    const C = k.C, h = lay.CHh;
    k.box(x, y, w, h, { fill: o.fill || C.bg2, stroke: o.stroke || C.line, r: 8, glow: o.glow || 0, glowCol: o.glowCol, alpha: o.alpha == null ? 1 : o.alpha, lw: o.lw });
    k.text(x + w / 2, y + h / 2 + 1, s, { col: o.col || C.ink, size: o.size || lay.fs, mono: true, weight: "600", alpha: o.alpha == null ? 1 : o.alpha });
  }
  const rect = (lay, pc) => ({ x: lay.cx(pc.i0), y: lay.cy(pc.i0), w: lay.cx(pc.i0 + pc.n - 1) + lay.CW - lay.cx(pc.i0) });

  function drawTable(k, lay, a, lit) {
    const C = k.C, T = lay.TB; if (a <= 0) return;
    k.label(T.x + T.w / 2, T.y - 16, "Embedding table", { col: C.ink, weight: "600", alpha: a });
    for (let r = 0; r < T.n; r++) {
      const y = T.y + r * T.rh, L = lit[r] || 0;
      for (let q = 0; q < 10; q++) { const v = Math.sin(r * 3.1 + q * 1.7) * 0.5 + 0.5; k.box(T.x + 4 + q * ((T.w - 8) / 10), y + 2, (T.w - 8) / 10 - 2, T.rh - 4, { fill: L > 0 ? C.sig : C.line, r: 2, alpha: a * (L > 0 ? 0.35 + 0.65 * L : 0.25 + 0.35 * v) }); }
      if (L > 0) k.box(T.x, y, T.w, T.rh, { stroke: C.sig, r: 3, alpha: a * L, glow: 12 * L, lw: 1.5 });
    }
    k.label(T.x + T.w / 2, T.y + T.n * T.rh + 16, "128,256 rows", { col: C.muted, alpha: a, size: 11 });
  }
  function vecCard(k, lay, x, y, w, j, a, glow) {
    const C = k.C, v = vec(j).slice(0, 3), cw = w / 3.6, h = lay.n ? 40 : 34, fs = Math.min(lay.n ? 17 : 14, cw / 2.6);
    k.box(x, y, w, h, { fill: C.bg2, stroke: C.sig, r: 6, alpha: a, glow: glow || 0 });
    v.forEach((n, q) => k.text(x + cw * q + cw / 2 + 3, y + h / 2 + 1, (n < 0 ? "−" : "") + Math.abs(n).toFixed(2).slice(1), { col: C.sig, size: fs, mono: true, alpha: a }));
    k.text(x + cw * 3 + cw * 0.3, y + h / 2 + 1, "…", { col: C.muted, size: fs, alpha: a });
  }

  storyFilm(fig, {
    label: "Animated explanation of tokenization and embeddings",
    steps, cams,
    draw(k, f) {
      const C = k.C, lay = L(), key = f.key;
      // ---- steps 1-3: bytes and merges ----
      if (key === "bytes" || key === "merge" || key === "more") {
        const prog = SCHED.map(([s, a, b]) => clamp01((f.at(s) - a) / (b - a)));
        const done = prog.filter(x => x >= 1).length, cur = done < RULES.length && prog[done] > 0 ? done : -1, sub = cur >= 0 ? prog[cur] : 0;
        const ps = stateAfter(done), pairs = cur >= 0 ? pairsOf(ps, RULES[cur]) : [];
        // the sentence as typed text
        const typed = key === "bytes" ? Math.floor(clamp01(f.p / 0.3) * CHARS.length) : CHARS.length;
        const sent = CHARS.slice(0, typed).join("").replace(/·/g, " ");
        const sentA = lay.n && key !== "bytes" ? 1 - clamp01(f.at("merge") / 0.08) : 1;
        if (sentA > 0) k.text(313, lay.sy, `"${sent}"`, { col: C.ink, size: 28, serif: true, weight: "500", alpha: sentA });
        const isP = new Map(); pairs.forEach(i => { isP.set(i, "a"); isP.set(i + 1, "b"); });
        const slide = easeIO((sub - 0.45) / 0.5), hl = cur >= 0 && sub < 0.98;
        ps.forEach((pc, i) => {
          const R = rect(lay, pc);
          // drop-in during the first step
          const drop = key === "bytes" ? easeOut((f.p - 0.25 - pc.i0 * 0.018) / 0.25) : 1; if (drop <= 0) return;
          const role = isP.get(i);
          let x = R.x; if (role === "a") x += 3 * slide; if (role === "b") x -= 3 * slide;
          const justMade = (() => { if (done === 0) return 0; const r = done - 1, [s, a, b] = SCHED[r]; const since = (f.at(s) - b) / 0.06; return RULES[r][0] + RULES[r][1] === pc.s && since >= 0 && since < 1 ? 1 - since : 0; })();
          pieceBox(k, lay, x, R.y - (1 - drop) * 60, R.w, pc.s, { alpha: drop, stroke: role && hl ? C.amb : justMade > 0 ? C.sig : C.line, glow: role && hl ? 10 + 6 * Math.sin(f.t * 8) : justMade * 16, glowCol: role ? C.amb : C.sig, lw: role ? 2 : 1.5 });
          if (key !== "more" && pc.n === 1) k.text(R.x + R.w / 2, R.y + lay.CHh + 16, HEX(pc.s), { col: C.muted, size: lay.n ? 14 : 12, mono: true, alpha: drop * (key === "bytes" ? 1 : 1 - clamp01(f.at("merge") / 0.1)) });
        });
        if (cur >= 0 && pairs.length && sub < 0.98) {
          const pc = ps[pairs[0]], R = rect(lay, pc), r2 = rect(lay, ps[pairs[0] + 1]);
          const msg = key === "merge" ? `${RULES[cur][0]} + ${RULES[cur][1]} appears ${pairs.length}×` : `rule ${cur + 1}: ${RULES[cur][0]} + ${RULES[cur][1]}`;
          k.label((R.x + r2.x + r2.w) / 2, lay.n ? R.y + lay.CHh + 16 : R.y - 22, msg, { col: C.amb, weight: "600", size: 12, alpha: clamp01(sub / 0.15) });
          // counting sweep across the row during the highlight phase
          if (key === "merge" && sub < 0.45) { const yy = sub / 0.45 < 0.5 ? lay.cy(0) : lay.cy(12), sx2 = lay.cx(0) + ((sub / 0.45) * 2 % 1) * 506; k.line(sx2, yy - 6, sx2, yy + lay.CHh + 6, { col: C.amb, lw: 2, glow: 10, alpha: 0.8 }); }
        }
        const nPieces = ps.length - (cur >= 0 && slide >= 1 ? pairs.length : 0);
        if (key === "bytes") { if (!lay.n) k.hud("tr", "Starting pieces", [["characters", String(CHARS.length)], ["bytes each", "1"], ["possible bytes", "256"]], { w: 170 }); }
        else {
          const shown = RULES.slice(0, done + (cur >= 0 ? 1 : 0)), rows = shown.slice(-(lay.n ? 3 : 5)).map((r, q, arr) => { const idx = shown.length - arr.length + q; return [`${idx + 1}.  ${r[0]} + ${r[1]}`, r[0] + r[1], idx === cur ? C.amb : C.sig]; });
          rows.push(["pieces", String(nPieces), C.ink]);
          k.hud("tr", "Merge rules", rows, { w: 170 });
        }
        return;
      }
      const ps = stateAfter(RULES.length);
      // ---- step 4 onward: tokens with IDs ----
      if (key === "ids" || key === "lookup" || key === "map" || key === "dir") {
        const mv = key === "ids" ? easeIO((f.p - 0.04) / 0.36) : 1;
        const mapA = key === "map" ? easeIO((f.p - 0.05) / 0.3) : key === "dir" ? 1 : 0;
        const tokA = key === "dir" ? 0 : key === "map" ? (lay.n ? 1 - easeIO((f.p - 0.55) / 0.3) : 1) : 1;
        // table
        const tabA = key === "lookup" ? easeIO(f.p / 0.15) : key === "map" ? 1 - easeIO(f.p / 0.35) : 0;
        const lit = {};
        TOK.forEach(([, id], j) => { const st = 0.12 + j * 0.13; const u = (f.at("lookup") - st) / 0.13; if (key === "lookup" && u > 0.35) lit[SLOT[id]] = u < 1.3 ? 1 : 0.4; });
        drawTable(k, lay, tabA, lit);
        if (tabA > 0) TOK.forEach(([, id]) => { if (lit[SLOT[id]]) k.label(lay.TB.x - 8, lay.TB.y + SLOT[id] * lay.TB.rh + lay.TB.rh / 2, "row " + id, { col: C.sig, size: 11, align: "right", alpha: tabA, mono: true }); });
        TOK.forEach(([s, id], j) => {
          const R0 = rect(lay, ps[j]), T = lay.tok(j);
          const x = lerp(R0.x, T.x, mv), y = lerp(R0.y, T.y, mv), w = lerp(R0.w, T.w, mv);
          if (tokA > 0) pieceBox(k, lay, x, y, w, s, { alpha: tokA, stroke: key === "ids" && mv >= 1 ? C.sig : C.line });
          // the ID drops in under the chip
          const ida = key === "ids" ? easeOut((f.p - 0.42 - j * 0.07) / 0.18) : 1;
          const iy = T.y + T.h + (lay.n ? 22 : 24);
          if (ida > 0 && tokA > 0) { k.line(T.x + T.w / 2, T.y + T.h, T.x + T.w / 2, iy - 12 + (1 - ida) * 10, { col: C.sig, alpha: ida * tokA * 0.6 }); k.text(T.x + T.w / 2, iy + (1 - ida) * 14, String(id), { col: C.sig, size: lay.n ? 24 : 20, mono: true, weight: "650", alpha: ida * tokA }); }
          // lookup: a particle runs from the ID to its table row, then the row's numbers fly back under the token
          const st = 0.12 + j * 0.13, u = (f.at("lookup") - st) / 0.13;
          const rowY = lay.TB.y + SLOT[id] * lay.TB.rh + lay.TB.rh / 2;
          const cardY = iy + 22, cardW = T.w;
          if (key === "lookup" && u > 0 && u < 0.4) { const e = easeIO(u / 0.4), p0 = [T.x + T.w / 2, iy + 12], p1 = [lay.TB.x, rowY]; const P = q => bez([p0, [p0[0], p0[1] + 80], [p1[0] - 160, p1[1]], p1], q); const pts = []; for (let q = 0; q <= 8; q++) pts.push(P(Math.max(0, e - 0.25 + q * 0.25 / 8))); k.trail(pts, C.sig, { w: 3, glow: 10 }); k.dot(...P(e), k.px(4), C.sig, { glow: 12 }); }
          if (key === "lookup" && u > 0.45 && u < 1.2) { const e = easeIO((u - 0.45) / 0.6); const x0 = lay.TB.x + 4, x1 = T.x; vecCard(k, lay, lerp(x0, x1, e), lerp(rowY - 14, cardY, e), lerp(lay.TB.w - 8, cardW, e), j, 1, 14 * (1 - e)); }
          const cardA = key === "lookup" ? (u >= 1.2 ? 1 : 0) : key === "map" ? 1 - easeIO((f.p - 0.1) / 0.25) : 0;
          if (cardA > 0) vecCard(k, lay, T.x, cardY, cardW, j, cardA);
          // map: the card collapses into a dot that flies to its place
          if (key === "map" || key === "dir") {
            const e = key === "map" ? easeIO((f.p - 0.15) / 0.5) : 1, [mx, my] = mapPt(lay, MINE[j][1], MINE[j][2]);
            if (e > 0) { const sx = T.x + T.w / 2, sy = cardY + 16, P = q => bez([[sx, sy], [sx + 200, sy - 260], [mx - 200, my - 120], [mx, my]], q);
              if (e < 1) { const pts = []; for (let q = 0; q <= 8; q++) pts.push(P(Math.max(0, e - 0.2 + q * 0.2 / 8))); k.trail(pts, C.sig, { w: 3, glow: 8 }); }
              const [px, py] = P(e); k.dot(px, py, k.px(e >= 1 ? 6 : 5), C.sig, { glow: 12, alpha: key === "dir" ? 0.45 : 1 });
              if (e > 0.9) k.label(px, py, MINE[j][0], { col: C.sig, dy: j === 4 ? 14 : -14, size: 12, weight: "600", alpha: (key === "dir" ? 0.45 : 1) * clamp01((e - 0.9) / 0.1) });
            }
          }
        });
        if (mapA > 0) {
          const M = lay.MP; k.box(M.x, M.y, M.w, M.h, { stroke: C.line, r: 14, alpha: mapA });
          for (let g = 1; g < 6; g++) { k.line(M.x + g * M.w / 6, M.y + 8, M.x + g * M.w / 6, M.y + M.h - 8, { alpha: 0.35 * mapA }); k.line(M.x + 8, M.y + g * M.h / 6, M.x + M.w - 8, M.y + g * M.h / 6, { alpha: 0.35 * mapA }); }
          k.label(M.x + 16, M.y - 16, "Meaning map (2 of thousands of directions)", { col: C.ink, weight: "600", align: "left", alpha: mapA });
          const dirHi = key === "dir" ? ["man", "woman", "king", "queen", "walk", "walked", "swim", "swam"] : [];
          BG.forEach(([w, x, y]) => { const [px, py] = mapPt(lay, x, y), hi = dirHi.includes(w) || (key === "map" && w === "dog" && f.p > 0.7); k.dot(px, py, k.px(hi ? 5 : 3.5), hi ? C.ink : C.muted, { alpha: mapA * (hi ? 1 : 0.7) }); k.label(px, py, w, { dy: -13, size: 11, col: hi ? C.ink : C.muted, alpha: mapA * (hi ? 1 : 0.8) }); });
          if (key === "map" && f.p > 0.72) { const a = clamp01((f.p - 0.72) / 0.12), [cx1, cy1] = mapPt(lay, 0.45, 0.20); k.ctx.save(); k.ctx.globalAlpha = a; k.ctx.strokeStyle = C.amb; k.ctx.lineWidth = k.px(1.5); k.ctx.setLineDash([k.px(4), k.px(4)]); k.ctx.beginPath(); k.ctx.ellipse(cx1, cy1, 70, 46, 0, 0, Math.PI * 2); k.ctx.stroke(); k.ctx.restore(); const by = lay.MP.y + lay.MP.h; k.line(cx1, cy1 + 46, cx1, by + 4, { col: C.amb, dash: [3, 4], alpha: a * 0.7 }); k.label(cx1, by + 18, "close together = related", { col: C.amb, size: 12, weight: "600", alpha: a }); }
          if (key === "dir") {
            const arrow = (a, b, e, col, dash) => { const [x1, y1] = mapPt(lay, a[0], a[1]), [x2, y2] = mapPt(lay, b[0], b[1]); if (e <= 0) return; const xe = lerp(x1, x2, e), ye = lerp(y1, y2, e); k.line(x1, y1, xe, ye, { col, lw: 2.5, dash, glow: 8 }); const an = Math.atan2(ye - y1, xe - x1), h = 14; k.ctx.save(); k.ctx.fillStyle = col; k.ctx.beginPath(); k.ctx.moveTo(xe, ye); k.ctx.lineTo(xe - h * Math.cos(an - 0.45), ye - h * Math.sin(an - 0.45)); k.ctx.lineTo(xe - h * Math.cos(an + 0.45), ye - h * Math.sin(an + 0.45)); k.ctx.fill(); k.ctx.restore(); };
            const P = w => { const r = BG.find(b => b[0] === w); return [r[1], r[2]]; };
            arrow(P("man"), P("woman"), easeIO((f.p - 0.08) / 0.2), C.amb);
            // carry the same arrow over to king: it lands on queen
            const c1 = easeIO((f.p - 0.3) / 0.22), m = P("man"), w = P("woman"), kg = P("king");
            if (c1 > 0) { const ox = lerp(m[0], kg[0], c1), oy = lerp(m[1], kg[1], c1); arrow([ox, oy], [ox + w[0] - m[0], oy + w[1] - m[1]], 1, C.amb, c1 < 1 ? [6, 5] : null); }
            arrow(P("walk"), P("walked"), easeIO((f.p - 0.55) / 0.18), C.sig);
            const c2 = easeIO((f.p - 0.74) / 0.2), wk = P("walk"), wd = P("walked"), sw = P("swim");
            if (c2 > 0) { const ox = lerp(wk[0], sw[0], c2), oy = lerp(wk[1], sw[1], c2); arrow([ox, oy], [ox + wd[0] - wk[0], oy + wd[1] - wk[1]], 1, C.sig, c2 < 1 ? [6, 5] : null); }
            if (!lay.n) k.hud("tl", "Same direction, same change", [["man → woman", "king → queen", C.amb], ["walk → walked", "swim → swam", C.sig]], { w: 230 });
          }
        }
        if (lay.n) return;
        if (key === "ids") k.hud("tr", "Token IDs", [["tokens", "6"], ["vocabulary", "≈128k (Llama 3)"]], { w: 200 });
        if (key === "lookup") k.hud("tl", "Embedding table", [["rows (tokens)", "128,256"], ["numbers per row", "4,096"], ["total", "≈525 million", C.amb]], { w: 210 });
        if (key === "map") k.hud("tl", "Each token's numbers", [["read as", "coordinates"], ["drawn", "2 of 4,096"]], { w: 190 });
        return;
      }
      // ---- step 8: a less familiar language ----
      if (key === "lang") {
        k.label(lay.eng(0).x, lay.eng(0).y - 26, "English: " + TOK.length + " tokens", { col: C.ink, weight: "600", align: "left" });
        TOK.forEach(([s], j) => { const R = lay.eng(j), a = easeOut((f.p - j * 0.03) / 0.15); pieceBox(k, { ...lay, CHh: R.h }, R.x, R.y, R.w, s, { alpha: a, stroke: C.sig }); });
        const th0 = lay.th(0), mrg = easeIO((f.p - 0.4) / 0.35);
        const nNow = mrg >= 1 ? THP.length : THB.length - Math.round((THB.length - THP.length) * mrg);
        k.label(th0.x, lay.ty0, `Similar sentence in Thai: ${mrg > 0 ? nNow + " pieces" : THB.length + " bytes"}`, { col: C.ink, weight: "600", align: "left" });
        THB.forEach((b, i) => { const p = lay.th(i), a = easeOut((f.p - 0.12 - i * 0.004) / 0.15); if (a <= 0) return; k.box(p.x, p.y, 40, 46, { fill: C.bg2, stroke: C.line, r: 6, alpha: a * (1 - 0.6 * mrg) }); k.text(p.x + 20, p.y + 24, b, { col: C.muted, size: 13, mono: true, alpha: a }); });
        if (mrg > 0) THP.forEach(([s, n], q) => { // outline the bytes each piece covers, row by row
          const rows = {}; for (let b = s; b < s + n; b++) { const p = lay.th(b); (rows[p.y] = rows[p.y] || []).push(p.x); }
          const col = q % 2 ? C.amb : C.sig;
          Object.entries(rows).forEach(([y, xs]) => k.box(Math.min(...xs) - 2, +y - 3, Math.max(...xs) + 44 - Math.min(...xs), 52, { stroke: col, r: 8, alpha: mrg, lw: 2 }));
        });
        if (!lay.n) k.hud("tr", "Tokens for one short sentence", [["English", "6"], ["Thai (illustrative)", mrg >= 1 ? String(THP.length) : "…", C.amb]], { w: 220 });
      }
    }
  });
});
