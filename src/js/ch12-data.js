/* Chapter 12 · Data. Web pages stream through a real cleaning pipeline that the learner tunes.
   Real algorithms, small scale: a stop-word language check, Gopher-style quality rules (word count, symbol ratio,
   repeated lines, keyword stuffing), MinHash over 5-word shingles with 112 hashes (FineWeb's setting) to find copies,
   and regex masking of emails and phone numbers. The pages are written for the demo; the "quality score" stands in for
   a trained classifier such as FineWeb-Edu's (scores are illustrative). The test-model score is illustrative too.
   Dedup is done within one crawl snapshot at a time, as FineWeb did. */
chapter("data", () => {
  // ---------- the pages ----------
  const GOOD = [
    { t: "Photosynthesis", q: 4.5, x: "Photosynthesis is the process plants use to turn light into chemical energy. Inside the chloroplast, chlorophyll absorbs mostly red and blue light. That energy splits water molecules, which releases oxygen as a by-product. The plant then uses the captured energy to build sugars from carbon dioxide in a cycle of reactions known as the Calvin cycle. These sugars feed the plant and, through food chains, almost every animal on Earth." },
    { t: "TCP handshake", q: 4.0, x: "A TCP connection starts with a three-way handshake. The client sends a SYN segment with an initial sequence number. The server answers with SYN-ACK, acknowledging the client's number and choosing its own. The client replies with an ACK, and both sides now agree on the sequence numbers they will use. This exchange lets each side detect lost or reordered segments and is why opening a new connection costs at least one round trip before any data flows." },
    { t: "Ocean algae", q: 4.0, x: "Some algae carry out photosynthesis in the open ocean, and they produce a large share of the oxygen in the air. Like land plants, they use chlorophyll to absorb light and split water, releasing oxygen. Many algae also carry extra pigments that capture the blue-green light that reaches deeper water. Because they grow quickly, scientists study them as a possible source of biofuel and as a way to understand how the earliest plants evolved." },
    { t: "Simple bread", q: 2.0, x: "To make a simple loaf, mix 500 grams of flour with a teaspoon of salt and a sachet of yeast. Add about 300 millilitres of warm water and stir until it forms a rough dough. Knead it for ten minutes until it feels smooth and springs back when pressed. Leave it covered in a warm place for an hour, shape it, let it rise again, and then bake it in a hot oven for about thirty minutes until golden." },
    { t: "Binary search", q: 4.5, x: "Binary search finds a value in a sorted array by repeatedly halving the search range. You compare the target with the middle element. If they match, you are done. If the target is smaller, you keep only the left half; if larger, only the right half. Each step discards half the remaining elements, so an array of one million items needs at most about twenty comparisons. The main bug to avoid is an off-by-one error when updating the low and high bounds." },
    { t: "Printing press", q: 4.0, x: "Around 1440, Johannes Gutenberg combined movable metal type, oil-based ink and a modified wine press into a practical printing system. Before this, most books in Europe were copied by hand, which made them rare and expensive. Printing cut the cost of books dramatically and spread quickly across the continent. Historians link the resulting flood of pamphlets and books to the Reformation, the Scientific Revolution and the rise of literacy among ordinary people." },
    { t: "Rainbows", q: 4.0, x: "A rainbow appears when sunlight enters raindrops, bends, reflects off the back of each drop and bends again on the way out. Each colour bends by a slightly different amount, so white light spreads into bands. You can only see a rainbow with the sun behind you, and the main bow always sits about 42 degrees away from the point directly opposite the sun. A fainter second bow, with its colours reversed, sometimes appears outside the first." },
    { t: "Bike chain", q: 2.5, x: "Had the same problem with my bike chain slipping under load. In my case the chain was worn out and had stretched, so it no longer sat properly on the teeth. A chain checker tool costs very little and tells you in seconds. I replaced the chain and the rear cassette together, because a new chain on old worn teeth still skipped for me. Since then it has been fine for about two thousand kilometres." },
    { t: "Kettle review", q: 2.0, x: "I have used this kettle every day for six months. It boils a full litre in about three minutes, which is quicker than my old one, and the lid opens with one hand. The water window is easy to read from across the kitchen. My only complaint is that the handle gets warm near the top after a few boils in a row. For the price I would still buy it again." },
    { t: "Zero", q: 4.0, x: "The idea of zero as a number in its own right took a long time to develop. Many ancient systems used a gap or a placeholder mark, but did not treat nothing as a quantity you could add or multiply. In India, the mathematician Brahmagupta wrote rules for calculating with zero in the year 628. The idea later travelled through the Arab world to Europe, together with the digits we use today." },
    { t: "Python loops", q: 4.0, x: "In Python, a for loop runs the same block of code once for every item in a list. You write the keyword for, a name for the current item, the keyword in, and the list, followed by a colon. The indented lines below are the body of the loop. If you need the position as well as the item, the built-in enumerate function gives you both, which avoids keeping a separate counter by hand." },
    { t: "The heart", q: 4.0, x: "The human heart has four chambers. The right side pumps blood to the lungs to pick up oxygen, and the left side pumps oxygen-rich blood out to the rest of the body. Valves between the chambers stop blood flowing backwards, and their closing makes the familiar two-part sound of a heartbeat. At rest, an adult heart beats roughly sixty to one hundred times a minute." },
    { t: "Coast trip", q: 2.5, x: "We took the early train along the coast and got off at the third stop, where the path drops down to a small harbour. The walk back over the cliffs took about four hours with a long lunch break. Bring water, because there is nowhere to buy any until the village at the end. The views over the bay were worth every step, and we saw seals resting on the rocks below." },
    { t: "Town library", q: 3.0, x: "The town council voted on Tuesday to keep the public library open until eight in the evening on weekdays. Staff said the change follows a survey in which many residents asked for later hours after work. The library will also add a homework club for children on Wednesdays. The new hours start next month and will be reviewed after one year." },
    { t: "Tomato plants", q: 2.5, x: "Tomato plants need at least six hours of direct sun a day, so pick the brightest spot you have. Water them deeply at the base a few times a week rather than a little every day, and try to keep the leaves dry. Pinch out the small side shoots that grow between the main stem and the branches, so the plant puts its energy into fruit instead of leaves." },
    { t: "Volcanoes", q: 4.0, x: "A volcano forms where melted rock, called magma, rises through cracks in the Earth's crust. Many volcanoes sit along the edges of tectonic plates, where one plate slides beneath another or two plates pull apart. When magma reaches the surface it is called lava. Gas trapped in thick, sticky magma can build up pressure and cause violent explosions, while runny magma tends to flow out more gently." }
  ];
  // three pages from one recipe site: same menu and footer, different recipes
  const SITE_HEAD = "Kitchen Notes home. Recipes, baking, quick dinners and seasonal ideas. Subscribe to our weekly newsletter and get a new tested recipe every Friday.";
  const SITE_FOOT = "If you enjoyed this recipe, leave a comment below and tell us how it turned out for you. Kitchen Notes is written by a small team of home cooks, and every recipe is tested at least twice before we publish it.";
  const SITE = [
    { t: "Pancakes (recipe site)", q: 2.5, x: "Whisk one egg with a cup of milk, then stir in a cup of flour and a pinch of salt until smooth. Rest the batter for ten minutes, then fry thin ladles in a hot buttered pan." },
    { t: "Tomato soup (recipe site)", q: 2.5, x: "Soften an onion in olive oil, add two tins of tomatoes and a little stock, and simmer for twenty minutes. Blend until smooth and season with salt, pepper and a spoon of sugar." },
    { t: "Fluffy rice (recipe site)", q: 2.5, x: "Rinse the rice until the water runs clear. Use one and a half cups of water for each cup of rice, bring it to the boil, cover tightly and cook on the lowest heat for twelve minutes." }
  ].map(p => ({ ...p, x: SITE_HEAD + " " + p.x + " " + SITE_FOOT, site: true }));
  const FOREIGN = [
    { t: "Photosynthèse (French)", lang: "French", q: 3.5, x: "La photosynthèse est le processus par lequel les plantes transforment la lumière en énergie chimique. Dans le chloroplaste, la chlorophylle absorbe surtout la lumière rouge et bleue. Cette énergie sert à scinder les molécules d'eau, ce qui libère de l'oxygène. La plante fabrique ensuite des sucres à partir du dioxyde de carbone grâce au cycle de Calvin, et ces sucres nourrissent presque tous les êtres vivants." },
    { t: "Fotosíntesis (Spanish)", lang: "Spanish", q: 3.5, x: "La fotosíntesis es el proceso mediante el cual las plantas convierten la luz en energía química. En el cloroplasto, la clorofila absorbe sobre todo la luz roja y azul. Esa energía rompe las moléculas de agua y libera oxígeno. Después, la planta fabrica azúcares a partir del dióxido de carbono en el ciclo de Calvin, y esos azúcares alimentan a casi todos los seres vivos del planeta." },
    { t: "Der Rhein (German)", lang: "German", q: 3.5, x: "Der Rhein ist einer der längsten und wichtigsten Flüsse Europas. Er entspringt in den Schweizer Alpen, fließt durch den Bodensee und bildet danach auf einem langen Abschnitt die Grenze zwischen Deutschland und Frankreich. Schließlich mündet er in den Niederlanden in die Nordsee. Seit Jahrhunderten ist er ein wichtiger Weg für Schiffe, die Waren zwischen den Städten am Ufer transportieren." },
    { t: "Il caffè (Italian)", lang: "Italian", q: 3.0, x: "Per preparare un buon caffè con la moka, riempi la caldaia con acqua fino alla valvola e metti il caffè macinato nel filtro senza pressarlo. Chiudi bene la moka e mettila sul fuoco basso. Quando il caffè comincia a salire e senti il tipico gorgoglio, spegni il fuoco e servi subito, mescolando prima di versare nelle tazzine." }
  ];
  const JUNK = [
    { t: "Watch spam", tag: "$$$", q: 0.0, x: "BUY THE CHEAPEST WATCHES!!! $$$ it is the BEST PRICE on the web $$$ >>> click here <<< and click here again!!! ### LIMITED OFFER for the first 100 buyers ### $$$ 99% OFF $$$ !!! act now and save !!! this is a once in a lifetime deal, so do not miss it !!! www.cheap-watches-4u.biz ### $$$" },
    { t: "Menu bar", tag: "menu", q: 0.0, x: "Home | About | Contact | Login\nHome | About | Contact | Login\nHome | About | Contact | Login\nPrivacy | Terms | Cookies\nHome | About | Contact | Login" },
    { t: "Forum chatter", tag: "short", q: 0.5, x: "lol same here, is it just me or is the app broken again? idk tbh" },
    { t: "Laptop keywords", tag: "spam", q: 0.5, x: "the best laptop is the best laptop for the money and the best laptop for students. best laptop best laptop 2024 best laptop deals cheap best laptop best laptop sale best laptop reviews best laptop for students best laptop price best laptop best laptop best laptop offers buy best laptop now best laptop online best laptop store best laptop discount" },
    { t: "Product stub", tag: "short", q: 1.0, x: "The X200 is a wireless mouse. It is black and it ships in two days. In stock." },
    { t: "Lorem ipsum", tag: "lorem", q: 0.5, x: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur." },
    { t: "Filler article", tag: "filler", q: 1.0, x: "In today's fast-paced world, finding the right solution is more important than ever. There are many factors to consider when choosing a solution that works for your needs. It is important to think about all of these factors before making a decision. In this article, we will explore everything you need to know, so that you can feel confident and make the best possible choice for you and your family." },
    { t: "Cookie wall", tag: "short", q: 0.0, x: "Please enable JavaScript and cookies to continue. Checking your browser before accessing this site." },
    { t: "Listing page", tag: "list", q: 0.5, x: "Page 2 of 418 | Results 11-20 | Sort by: price | Filter: >> brand >> colour >> size | << Prev | Next >> | ### Show 20 | 50 | 100 ### $ low to high | $ high to low |" }
  ];
  const PII = ["Questions? Email me at anna.kowalski@example.com or call 07700 900123.", "You can reach me directly at j.smith.1987@example.net if anything is unclear.", "Call our office on 020 7946 0958 and ask for Tom.", "My email is pedro_r@example.org, happy to help."];
  const NEAR = [
    p => p + " Share this article with your friends. Copyright 2024 Daily Science Digest, all rights reserved.",
    p => p.replace(/\. ([A-Z])/, (m, c) => ". In short, " + c.toLowerCase()) + " Related posts: more stories like this one on our blog.",
    p => "Posted on 12 March 2023 by admin. " + p + " Read more stories on our site."
  ];

  // ---------- real filters ----------
  const STOP = new Set("the a an and or of to in is are was were it that this as for with on by be at from which these those its their they them then than so but not into most each only both also can how why who what when there over about you your we our my me i".split(" "));
  const words = t => t.toLowerCase().match(/[\p{L}\p{N}'-]+/gu) || [];
  function langCheck(t) { const w = words(t), s = w.filter(x => STOP.has(x)).length; return s >= 3 && s / Math.max(1, w.length) >= 0.08 ? null : "not English: only " + Math.round(s / Math.max(1, w.length) * 100) + "% common English words"; }
  function rulesCheck(t) {
    const w = words(t); if (w.length < 40) return "too short: " + w.length + " words";
    const sym = (t.match(/[#$!<>|]/g) || []).length / t.length; if (sym > 0.03) return "too many symbols: " + (sym * 100).toFixed(0) + "% of characters";
    const lines = t.split("\n").filter(Boolean); if (lines.length > 2 && 1 - new Set(lines).size / lines.length > 0.3) return "repeated lines";
    const cnt = {}; w.filter(x => !STOP.has(x)).forEach(x => cnt[x] = (cnt[x] || 0) + 1); const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] / w.length > 0.12) return `keyword stuffing: "${top[0]}" is ${Math.round(top[1] / w.length * 100)}% of words`;
    return null;
  }
  const MAIL = "[\\w.+-]+@[\\w-]+\\.[\\w.]*\\w", PHONE = "\\b0\\d{2,4}\\s?\\d{3,4}\\s?\\d{3,6}\\b";
  const RE_MAIL = new RegExp(MAIL, "g"), RE_PHONE = new RegExp(PHONE, "g");
  const hasPII = t => new RegExp(MAIL).test(t) || new RegExp(PHONE).test(t);
  const mask = t => t.replace(RE_MAIL, "[email removed]").replace(RE_PHONE, "[phone removed]");
  // MinHash: 5-word shingles, 112 hash functions (FineWeb's settings)
  const K = 112, SH = 5, HA = [], HB = [];
  { const r = rng(1234); for (let i = 0; i < K; i++) { HA.push((Math.floor(r() * 4294967295) | 1) >>> 0); HB.push(Math.floor(r() * 4294967295) >>> 0); } }
  function fnv(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function shingles(t) { const w = words(t), out = new Set(); for (let i = 0; i + SH <= w.length; i++) out.add(w.slice(i, i + SH).join(" ")); if (!out.size) out.add(w.join(" ")); return out; }
  function minhash(sh) { const sig = new Uint32Array(K).fill(4294967295), hs = [...sh].map(fnv); for (let i = 0; i < K; i++) { let m = 4294967295; for (const h of hs) { const v = (Math.imul(HA[i], h) + HB[i]) >>> 0; if (v < m) m = v; } sig[i] = m; } return sig; }
  const matches = (a, b) => { let n = 0; for (let i = 0; i < K; i++) n += a[i] === b[i]; return n; };
  const exactJ = (A, B) => { let s = 0; A.forEach(x => { if (B.has(x)) s++; }); return { shared: s, union: A.size + B.size - s }; };

  // ---------- one crawl snapshot ----------
  let pid = 0;
  function mkPage(src, kind, extra = {}) {
    const p = { id: ++pid, title: src.t, raw: src.x, kind, lang: src.lang || "English", q0: src.q, tag: src.tag || "", site: !!src.site, ...extra };
    p.lines = [0, 1, 2].map(i => 0.45 + ((p.id * 37 + i * 71) % 50) / 100); return p;
  }
  function finish(p, rand) {
    p.q = Math.max(0, Math.min(5, p.q0 + (rand() - 0.5) * 0.6));
    p.pii = hasPII(p.raw); p.sh = shingles(p.raw); p.sig = minhash(p.sh); return p;
  }
  function makeSnapshot(s) {
    const r = s.rand, shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const goods = shuffle(GOOD.slice()).slice(0, 13).map(g => mkPage(g, "good"));
    shuffle(goods.filter(g => g.q0 <= 3)).slice(0, 2).concat(shuffle(goods.filter(g => g.q0 > 3)).slice(0, 1)).forEach((g, i) => { g.raw += " " + PII[(s.snap + i) % PII.length]; });
    const site = SITE.map(g => mkPage(g, "good"));
    const foreign = FOREIGN.map(g => mkPage(g, "foreign"));
    const junk = JUNK.map(g => mkPage(g, "junk")).concat(shuffle(JUNK.slice()).slice(0, 3).map(g => mkPage(g, "junk")));
    let list = shuffle([...goods, ...site, ...foreign, ...junk]);
    // copies: 3 exact and 4 near-copies of good pages, each placed somewhere after its original
    const srcs = shuffle(goods.slice()).slice(0, 7);
    srcs.forEach((o, i) => {
      const exact = i < 3, txt = exact ? o.raw : NEAR[i % NEAR.length](o.raw);
      const c = mkPage({ t: o.title, x: txt, q: o.q0 - (exact ? 0 : 0.2) }, "copy", { dupOf: o.id, exact, tag: exact ? "copy" : "copy" });
      const at = list.indexOf(o), pos = at + 1 + Math.floor(r() * (list.length - at));
      list.splice(pos, 0, c);
    });
    list.forEach(p => finish(p, r));
    list.forEach((p, i) => { p.idx = i; });
    return list;
  }
  // wanted = a page a good English (or multilingual) model should learn from
  const wanted = (s, p) => p.kind === "good" || (p.kind === "foreign" && s.lang === "all");

  // ---------- run the pipeline over a whole snapshot with the current settings ----------
  function evaluate(s) {
    const pages = s.pages, res = [], kept = [], counts = [pages.length, 0, 0, 0, 0];
    let best = null;
    for (const p of pages) {
      let stage = -1, why = null, sim = 0, simTo = null;
      if (s.lang === "en") { const r = langCheck(p.raw); if (r) { stage = 0; why = r; } }
      if (stage < 0 && s.bar > 0) { const r = rulesCheck(p.raw); if (r) { stage = 1; why = r; } else if (p.q < s.bar) { stage = 1; why = `quality score ${p.q.toFixed(1)} is under your bar of ${s.bar.toFixed(1)}`; } }
      for (const k of kept) { const m = matches(p.sig, k.sig) / K; if (m > sim) { sim = m; simTo = k; } }
      if (stage < 0 && s.sim <= 1 && simTo && sim >= s.sim - 1e-9) { stage = 2; why = sim >= 0.999 ? `exact copy of "${simTo.title}"` : `${Math.round(sim * 100)}% similar to "${simTo.title}", already kept`; }
      if (stage < 0) kept.push(p);
      const masked = stage < 0 && p.pii && s.mask;
      res[p.idx] = { stage, why, sim, simTo, masked };
      for (let g = 1; g <= 4; g++) if (stage < 0 || stage >= g) counts[g]++;
      if (p.kind === "copy" && !p.exact && simTo && (!best || sim > best.sim)) best = { p, o: simTo, sim };
    }
    // a copy only counts as a problem if a version of the same page was already kept
    const keptP = pages.filter(p => res[p.idx].stage < 0), seen = new Set();
    keptP.forEach(p => { const g = p.dupOf || p.id; p.redundant = seen.has(g); seen.add(g); });
    pages.forEach(p => { if (res[p.idx].stage >= 0) p.redundant = p.kind === "copy"; });
    const groups = new Set(pages.filter(p => wanted(s, p)).map(p => p.id)), W = pages.filter(p => groups.has(p.id));
    const bad = p => p.kind === "junk" || (p.kind === "foreign" && s.lang !== "all") || p.redundant || (p.pii && !s.mask);
    const goodKept = [...groups].filter(g => keptP.some(p => (p.dupOf || p.id) === g)).length;
    const probs = keptP.filter(bad), junkKept = keptP.filter(p => p.kind === "junk").length, copyKept = keptP.filter(p => p.redundant).length;
    const piiKept = keptP.filter(p => p.pii && !s.mask).length, foreignKept = keptP.filter(p => p.kind === "foreign").length;
    const goodLostQ = W.filter(p => res[p.idx].stage === 1), goodLostDup = W.filter(p => res[p.idx].stage === 2);
    const G = groups.size ? goodKept / groups.size : 0, P = keptP.length ? probs.length / keptP.length : 0;
    // illustrative test model: more good data helps, junk and copies hurt; the mix decides which skills it has
    const wq = Math.max(0, Math.min(1, Math.sqrt(G) * (1 - 2.5 * P)));
    const m = mixOf(s), sat = (x, k) => (1 - Math.exp(-k * x)) / (1 - Math.exp(-k));
    const general = 100 * (0.2 + 0.8 * wq) * sat(m[0] + m[3], 2.5);
    const code = 100 * (0.08 + 0.92 * sat(m[1], 6)), maths = 100 * (0.12 + 0.88 * sat(m[2], 6)) * (0.6 + 0.4 * wq);
    const score = 0.5 * general + 0.25 * code + 0.25 * maths;
    if (best) { const e = exactJ(best.p.sh, best.o.sh); best.shared = e.shared; best.union = e.union; best.match = Math.round(best.sim * K); }
    return { res, counts, kept: keptP.length, wantedN: groups.size, goodKept, G, P, probs: probs.length, junkKept, copyKept, piiKept, foreignKept, goodLostQ, goodLostDup, general, code, maths, score, best };
  }
  const mixOf = s => { const r = 1 - s.web; return [s.web, r * 0.45, r * 0.35, r * 0.2]; };
  const MIXN = ["web pages", "code", "maths", "books"], MIXC = ["#5ce1c6", "#8fb3ff", "#d59cff", "#ff8fa3"];

  // ---------- layout ----------
  const ARR = 0.42, SPEED = 165;
  function lay(narrow) {
    return narrow
      ? { srcX: 10, endX: 690, y: 120, gx: [150, 295, 440, 585], binY: 196, binH: 172, setX: 10, setY: 386, setW: 680, setH: 128, scoreY: 0, cw: 62, ch: 44, tile: 26, cols: 4, band: 52 }
      : { srcX: 30, endX: 890, y: 200, gx: [210, 385, 560, 735], binY: 312, binH: 214, setX: 960, setY: 286, setW: 350, setH: 290, scoreY: 30, cw: 72, ch: 52, tile: 29, cols: 4, band: 64 };
  }
  const STAGES = ["Language", "Quality", "Copies", "Personal data"];

  function newSnapshot(s) {
    s.snap++; s.pages = makeSnapshot(s); s.next = 0; s.arrT = 0; s.E = evaluate(s);
    s.live = []; s.bins = [[], [], []]; s.set = [];
  }
  function init(rand) {
    const s = { rand, t: 0, snap: 0, lang: "en", bar: 0, sim: 1.05, mask: false, web: 1, sel: null, hits: [], lastDrop: null, lastLeak: null };
    newSnapshot(s); return s;
  }
  const reeval = s => { if (s.pages) s.E = evaluate(s); };

  function step(s, dt, sim) {
    s.t += dt; const L = lay(sim.narrow);
    s.arrT -= dt;
    if (s.next < s.pages.length && s.arrT <= 0) { const p = s.pages[s.next++]; s.live.push({ p, x: L.srcX, gate: 0, st: "belt", t0: s.t }); s.arrT = ARR; }
    for (const c of s.live) {
      if (c.st !== "belt") continue;
      c.x += SPEED * dt;
      const r = s.E.res[c.p.idx];
      while (c.gate < 4 && c.x >= L.gx[c.gate]) {
        if (r.stage === c.gate) { c.st = "drop"; c.t0 = s.t; c.fx = L.gx[c.gate]; c.why = r.why; s.bins[c.gate].push(c); c.slot = s.bins[c.gate].length - 1; s.lastDrop = { c, t: s.t, stage: c.gate }; break; }
        if (c.gate === 3 && c.p.pii) { c.masked = s.mask; c.flash = s.t; }
        c.gate++;
      }
      if (c.st === "belt" && c.x >= L.endX) { c.st = "keep"; c.t0 = s.t; c.fx = L.endX; s.set.push(c); c.slot = s.set.length - 1; c.why = null; if (isBad(s, c.p) || (c.p.pii && !c.masked)) s.lastLeak = { c, t: s.t }; }
    }
    if (s.next >= s.pages.length && s.live.every(c => c.st !== "belt") && s.t - s.live[s.live.length - 1].t0 > 3.5) newSnapshot(s);
    const E = s.E; s.goalFor = E.G >= 0.8 && E.P < 0.05 ? (s.goalFor || 0) + dt : 0;
  }

  // ---------- drawing ----------
  const isBad = (s, p) => p.kind === "junk" || (p.kind === "foreign" && s.lang !== "all") || p.redundant;
  const kindCol = (k, s, p, masked) => isBad(s, p) ? k.C.crit : p.pii && !masked ? k.C.amb : k.C.sig;
  function pageCard(k, x, y, w, h, c, s, o = {}) {
    const C = k.C, p = c.p, a = o.alpha == null ? 1 : o.alpha;
    k.box(x, y, w, h, { fill: C.bg2, stroke: o.edge || C.line, r: 6, alpha: a, lw: o.edge ? 1.8 : 1.2, glow: o.glow || 0, glowCol: o.edge });
    const lc = p.kind === "junk" || p.kind === "copy" ? C.crit : p.kind === "foreign" ? C.muted : C.ink, sc = h / 46;
    p.lines.forEach((l, i) => k.box(x + 7 * sc, y + (9 + i * 9) * sc, (w - 14 * sc) * l, 4 * sc, { fill: lc, r: 2, alpha: a * (p.kind === "good" ? 0.55 : 0.5) }));
    if (p.pii) { const mk = c.masked; k.box(x + 7 * sc, y + h - 13 * sc, 26 * sc, 7 * sc, { fill: mk ? C.ink : C.amb, r: 2, alpha: a * (mk ? 0.9 : 1), glow: mk ? 0 : 6, glowCol: C.amb }); }
    if (!o.notag && k.scale * w > 36) {
      const tag = p.kind === "foreign" ? p.lang.slice(0, 2).toLowerCase() : p.kind === "copy" ? "copy" : p.tag;
      if (tag) k.label(x + w - 5 * sc, y + h - 9 * sc, tag, { align: "right", size: 9.5, col: p.kind === "foreign" ? C.muted : C.crit, alpha: a, mono: true, weight: "600" });
    }
    s.hits.push([x, y, w, h, c]);
  }
  const GAP = 5;
  function binXY(L, g, slot) { const t = L.tile, w = L.cols * (t + GAP) - GAP, rows = Math.floor((L.binH - 36) / (t + GAP)); return [L.gx[g] - w / 2 + (slot % L.cols) * (t + GAP), L.binY + 30 + Math.min(rows - 1, Math.floor(slot / L.cols)) * (t + GAP) - (Math.floor(slot / L.cols) >= rows ? 4 : 0)]; }
  function setXY(L, slot) { const t = L.tile, cols = Math.floor((L.setW - 24) / (t + GAP)); return [L.setX + 12 + (slot % cols) * (t + GAP), L.setY + 34 + Math.floor(slot / cols) * (t + GAP)]; }

  function draw(k, s, sim) {
    const C = k.C, L = lay(sim.narrow), E = s.E, narrow = sim.narrow, n0 = s.pages.length; s.hits = [];
    // funnel band: its height follows how many pages of this snapshot survive each filter at your settings
    const hAt = x => { let n = E.counts[0]; for (let g = 0; g < 4; g++) { const d = x - L.gx[g]; if (d > 0) n = lerp(E.counts[g], E.counts[g + 1], clamp01(d / 40)); } return L.band * Math.max(0.12, n / n0); };
    const c = k.ctx; c.save(); c.beginPath();
    for (let x = L.srcX; x <= L.endX; x += 10) c.lineTo(x, L.y - hAt(x)); for (let x = L.endX; x >= L.srcX; x -= 10) c.lineTo(x, L.y + hAt(x));
    c.closePath(); c.fillStyle = C.sig; c.globalAlpha = 0.07; c.fill(); c.globalAlpha = 0.35; c.strokeStyle = C.sig; c.lineWidth = k.px(1); c.stroke(); c.restore();
    k.label(L.srcX, L.y + L.band + 8, narrow ? `Snapshot ${s.snap}` : `Crawl snapshot ${s.snap} · ${n0} pages · ${s.next} arrived`, { align: "left", col: C.muted, size: narrow ? 10 : 11, dy: 6 });
    // gates
    const setting = [s.lang === "en" ? "English only" : "all languages", s.bar > 0 ? `bar ${s.bar.toFixed(1)}` : "off", s.sim > 1 ? "off" : s.sim >= 0.999 ? "exact only" : `≥ ${Math.round(s.sim * 100)}%`, s.mask ? "masking" : "off"];
    const on = [true, s.bar > 0, s.sim <= 1, s.mask];
    for (let g = 0; g < 4; g++) {
      const x = L.gx[g], hh = L.band + 18;
      k.box(x - 6, L.y - hh, 12, hh * 2, { fill: on[g] ? C.amb : C.bg2, stroke: on[g] ? C.amb : C.muted, alpha: on[g] ? 0.85 : 0.7, r: 6, glow: on[g] ? 10 : 0, dash: on[g] ? null : [4, 4] });
      k.label(x, L.y - hh, narrow && g === 3 ? "Private" : STAGES[g], { col: C.ink, weight: "650", size: narrow ? 11 : 13, dy: -30 });
      k.label(x, L.y - hh, setting[g], { col: on[g] ? C.amb : C.muted, size: narrow ? 10 : 11.5, dy: -13, weight: "600" });
      if (g < 3) {
        const n = s.bins[g].length, [bx] = binXY(L, g, 0), bw = L.cols * (L.tile + GAP) - GAP;
        k.box(bx - 8, L.binY, bw + 16, L.binH, { stroke: C.line, r: 10, dash: [3, 5] });
        k.label(x, L.binY, narrow ? `out ${n}` : `dropped · ${n}`, { col: n ? C.ink : C.muted, size: narrow ? 10 : 11.5, weight: "600", dy: 13 });
      } else k.label(x, L.binY, narrow ? "masks" : "masks, never drops", { col: C.muted, size: narrow ? 10 : 11, dy: 13 });
    }
    // bins (dropped this snapshot)
    for (let g = 0; g < 3; g++) s.bins[g].forEach(cv => {
      const [tx, ty] = binXY(L, g, cv.slot), u = easeIO((s.t - cv.t0) / 0.8);
      if (u < 1) { pageCard(k, lerp(cv.fx - L.cw / 2, tx, u), lerp(L.y - L.ch / 2, ty, u), lerp(L.cw, L.tile, u), lerp(L.ch, L.tile, u), cv, s, { edge: C.crit, notag: u > 0.3 }); return; }
      const good = wanted(s, cv.p);
      k.box(tx, ty, L.tile, L.tile, good ? { stroke: C.sig, lw: 2, r: 5, glow: 6, glowCol: C.sig } : { fill: C.muted, r: 5, alpha: 0.45 });
      if (s.sel === cv) k.box(tx - 3, ty - 3, L.tile + 6, L.tile + 6, { stroke: C.ink, r: 7, lw: 2 });
      s.hits.push([tx, ty, L.tile, L.tile, cv]);
    });
    if (s.lastDrop && s.t - s.lastDrop.t < 3 && !narrow) { const d = s.lastDrop, w = d.c.why; k.label(L.gx[d.stage], L.binY + L.binH, w.length > 44 ? w.slice(0, 42) + "…" : w, { col: C.crit, size: 11, bg: true, dy: 14, alpha: 1 - clamp01((s.t - d.t - 2.2) / 0.8) }); }
    // pages on the belt
    for (const cv of s.live) {
      if (cv.st !== "belt") continue;
      const fl = cv.flash && s.t - cv.flash < 0.6;
      pageCard(k, cv.x - L.cw / 2, L.y - L.ch / 2, L.cw, L.ch, cv, s, { edge: s.sel === cv ? C.ink : fl ? (cv.masked ? C.ink : C.amb) : null, glow: fl ? 12 : 0, notag: narrow });
    }
    // training set (kept this snapshot)
    k.box(L.setX, L.setY, L.setW, L.setH, { stroke: C.sig, r: 14, alpha: 0.7 });
    const nBad = s.set.filter(cv => kindCol(k, s, cv.p, cv.masked) !== C.sig).length;
    k.label(L.setX + 12, L.setY, `Training set · ${s.set.length} page${s.set.length === 1 ? "" : "s"}`, { align: "left", col: C.sig, weight: "650", size: narrow ? 11 : 12.5, dy: 16 });
    if (nBad) k.label(L.setX + 12, L.setY + L.setH, `${nBad} problem page${nBad > 1 ? "s" : ""} got in`, { align: "left", col: C.crit, weight: "650", size: narrow ? 10.5 : 11.5, dy: -14 });
    s.set.forEach(cv => {
      const [tx, ty] = setXY(L, cv.slot), u = easeIO((s.t - cv.t0) / 0.7);
      if (u < 1) { pageCard(k, lerp(cv.fx - L.cw / 2, tx, u), lerp(L.y - L.ch / 2, ty, u), lerp(L.cw, L.tile, u), lerp(L.ch, L.tile, u), cv, s, { notag: true }); return; }
      const col = kindCol(k, s, cv.p, cv.masked), bad = col !== C.sig;
      k.box(tx, ty, L.tile, L.tile, { fill: col, r: 5, alpha: 0.9, glow: bad ? 8 : 0, glowCol: col });
      if (cv.p.redundant) k.label(tx + L.tile / 2, ty + L.tile / 2, "2×", { col: C.bg, size: narrow ? 8 : 9, weight: "700" });
      if (s.sel === cv) k.box(tx - 3, ty - 3, L.tile + 6, L.tile + 6, { stroke: C.ink, r: 7, lw: 2 });
      s.hits.push([tx, ty, L.tile, L.tile, cv]);
    });
    // legend (desktop)
    if (!narrow) {
      const ly = L.binY + L.binH + 44;
      [[C.sig, "good page", 1], [C.crit, "junk, copy (2×) or wrong language", 1], [C.amb, "personal data", 1], [C.sig, "good page thrown away", 0]].reduce((x, [col, t, fill]) => {
        k.box(x, ly - 7, 14, 14, fill ? { fill: col, r: 3 } : { stroke: col, r: 3, lw: 2 }); k.label(x + 20, ly, t, { align: "left", size: 11 });
        k.ctx.save(); font(k.ctx, 11, "--f-display"); const w = k.ctx.measureText(t).width / k.scale; k.ctx.restore(); return x + 20 + w + 30;
      }, L.srcX);
    }
    if (narrow) { if (s.sel) inspector(k, s, sim); return; } // phones: the test score is in the readouts below
    // mix + test model (illustrative)
    const sx = L.setX, sw = L.setW, y0 = L.scoreY, m = mixOf(s);
    k.label(sx, y0, `Training mix · ${Math.round(s.web * 100)}% web`, { align: "left", col: C.ink, weight: "650", size: narrow ? 11 : 12 });
    let acc = 0; m.forEach((f, i) => { if (f <= 0) return; k.box(sx + acc * sw, y0 + 14, Math.max(1, f * sw - 3), 18, { fill: MIXC[i], r: 4, alpha: 0.85 }); if (f * sw * k.scale > 44) k.label(sx + (acc + f / 2) * sw, y0 + 23, MIXN[i], { col: "#0b1220", size: narrow ? 9 : 10, weight: "650" }); acc += f; });
    const ty0 = y0 + (narrow ? 58 : 62);
    k.label(sx, ty0, "Test model · illustrative", { align: "left", col: C.ink, weight: "650", size: narrow ? 11 : 12 });
    const lw = narrow ? 130 : 80, bw = sw - lw - (narrow ? 70 : 46), rh = narrow ? 30 : 27;
    [["general", E.general], ["code", E.code], ["maths", E.maths], ["overall", E.score]].forEach(([lab, v], i) => {
      const yy = ty0 + 24 + i * rh, last = i === 3, col = v >= 65 ? C.ok : v >= 40 ? C.amb : C.crit;
      k.label(sx, yy, lab, { align: "left", size: narrow ? 10.5 : 11.5, col: last ? C.ink : C.muted, weight: last ? "650" : "500" });
      k.box(sx + lw, yy - 6, bw, 12, { fill: C.line, r: 4, alpha: 0.5 });
      k.box(sx + lw, yy - 6, Math.max(2, bw * v / 100), 12, { fill: col, r: 4, alpha: 0.9, glow: last ? 8 : 0, glowCol: col });
      k.label(sx + sw, yy, String(Math.round(v)), { align: "right", size: narrow ? 11 : 12, mono: true, col: last ? col : C.ink, weight: last ? "700" : "500" });
    });
    if (s.sel) inspector(k, s, sim);
  }
  function inspector(k, s, sim) {
    const c = s.sel, p = c.p, r = s.E.res[p.idx], ctx = k.ctx, C = k.C; ctx.save(); k.screen();
    const sm = k.W < 560, w = sm ? k.W - 16 : 360, pad = 12, x = sm ? 8 : 14, fs = sm ? 11 : 12;
    font(ctx, fs, "--f-body"); let txt = p.pii && (c.masked || (c.st !== "keep" && s.mask)) ? mask(p.raw) : p.raw; txt = txt.replace(/\n/g, " / ");
    const lines = wrapLines(ctx, txt.length > 230 ? txt.slice(0, 228) + "…" : txt, w - pad * 2).slice(0, sm ? 4 : 6);
    const verdict = c.st === "belt" ? (r.stage >= 0 ? "will be dropped: " + r.why : "on its way through") : c.st === "drop" ? "dropped: " + c.why : (r.masked || c.masked ? "kept, with personal data masked" : "kept");
    const meta = `${p.lang} · quality score ${p.q.toFixed(1)}${r.simTo ? ` · ${Math.round(r.sim * 100)}% like "${r.simTo.title}"` : ""}`;
    font(ctx, fs - 1, "--f-display"); const vl = wrapLines(ctx, verdict, w - pad * 2).slice(0, 2), ml = wrapLines(ctx, meta, w - pad * 2).slice(0, 2);
    const lh = fs * 1.35, h = pad * 2 + 18 + lines.length * lh + 6 + (vl.length + ml.length) * (lh - 1);
    const y = k.H - h - 10;
    ctx.globalAlpha = 0.94; ctx.fillStyle = C.bg2; rr(ctx, x, y, w, h, 10); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    let yy = y + pad + 6; font(ctx, fs, "--f-display", "650"); ctx.fillStyle = C.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("Page you picked · " + p.title, x + pad, yy); yy += 18;
    font(ctx, fs, "--f-body"); ctx.fillStyle = C.muted; lines.forEach(l => { ctx.fillText(l, x + pad, yy); yy += lh; }); yy += 4;
    font(ctx, fs - 1, "--f-display"); ctx.fillStyle = C.muted; ml.forEach(l => { ctx.fillText(l, x + pad, yy); yy += lh - 1; });
    font(ctx, fs - 1, "--f-display", "650"); ctx.fillStyle = c.st === "drop" || r.stage >= 0 ? C.crit : C.sig; vl.forEach(l => { ctx.fillText(l, x + pad, yy); yy += lh - 1; });
    ctx.restore(); k.world();
  }

  const pct = v => Math.round(v * 100) + "%";
  const sim = makeSim($("#data-sim"), {
    label: "Data cleaning simulation. Web pages flow left to right through four filters: language, quality, copies and personal data. Dropped pages fall into bins under each filter; kept pages fill the training set on the right. Click any page to read it and see why it was kept or dropped.",
    cams: { default: { x: 14, y: 14, w: 1306, h: 610 } },
    camsNarrow: { default: { x: 0, y: 40, w: 700, h: 480 } },
    init, warmup: 9, factDelay: 8,
    intro: "Web pages pour in from the left. Each grey bar is a filter you control. Click any page to read it.",
    controls: [
      { id: "lang", label: "Language", type: "choice", value: "en", options: [["en", "English only"], ["all", "All languages"]], help: "A quick check of how many common English words a page uses.", apply: (s, v) => { s.lang = v; reeval(s); } },
      { id: "bar", label: "Quality bar", type: "range", min: 0, max: 4.5, step: 0.5, value: 0, fmt: v => v === 0 ? "off" : v.toFixed(1) + " / 5", help: "Rules catch spam and menus; pages scoring under the bar are dropped.", apply: (s, v) => { s.bar = v; reeval(s); } },
      { id: "sim", label: "Copy cut-off", type: "range", min: 0.3, max: 1.05, step: 0.05, value: 1.05, fmt: v => v > 1.01 ? "off" : v >= 0.999 ? "exact only" : "≥ " + Math.round(v * 100) + "% similar", help: "Drop a page this similar to one already kept (MinHash estimate).", apply: (s, v) => { s.sim = v > 1.01 ? 1.05 : v; reeval(s); } },
      { id: "mask", label: "Mask emails and phone numbers", type: "toggle", value: false, help: "Replaces them with a placeholder before training.", apply: (s, v) => { s.mask = v; reeval(s); } },
      { id: "web", label: "Web pages in the training mix", type: "range", min: 0.2, max: 1, step: 0.1, value: 1, fmt: v => Math.round(v * 100) + "%", help: "The rest is code, maths and books.", apply: (s, v) => { s.web = v; reeval(s); } }
    ],
    step, draw,
    click: (s, wx, wy) => { let hit = null; for (let i = s.hits.length - 1; i >= 0; i--) { const [x, y, w, h, c] = s.hits[i]; if (wx >= x - 4 && wx <= x + w + 4 && wy >= y - 4 && wy <= y + h + 4) { hit = c; break; } } s.sel = hit && hit !== s.sel ? hit : null; },
    stats: s => { const E = s.E; return [
      ["good pages kept", pct(E.G), E.G >= 0.8 ? "ok" : E.G < 0.6 ? "bad" : "hot"],
      ["junk, copies or personal data in what you keep", pct(E.P), E.P < 0.05 ? "ok" : E.P > 0.15 ? "bad" : "hot"],
      ["pages kept from this snapshot", `${E.kept} of ${s.pages.length}`],
      ["test score · illustrative", Math.round(E.score) + " / 100", E.score >= 65 ? "ok" : E.score < 45 ? "bad" : ""]]; },
    goal: { text: "keep at least 80% of the good pages while under 5% of what you keep is junk, copies or personal data", check: s => ({ done: s.goalFor >= 3, progress: `good kept ${pct(s.E.G)} · problems ${pct(s.E.P)}` }) },
    notices: [
      { id: "strictQ", when: s => s.bar >= 3 && s.E.goodLostQ.length >= 2, say: s => { const E = s.E, ex = E.goodLostQ.slice().sort((a, b) => a.q - b.q)[0]; return `A bar of ${s.bar.toFixed(1)} also throws out ${E.goodLostQ.length} useful pages, like "${ex.title}" (score ${ex.q.toFixed(1)}). Everyday writing teaches a model too, and less data makes it weaker: the test score is ${Math.round(E.score)}.`; } },
      { id: "strictD", when: s => s.sim < 0.6 && s.E.goodLostDup.length >= 1, say: s => { const p = s.E.goodLostDup[0], r = s.E.res[p.idx]; return `Too strict: "${p.title}" was dropped for being ${Math.round(r.sim * 100)}% similar to "${r.simTo.title}". They share the site's menu and footer, but the recipes are different pages.`; } },
      { id: "offQ", when: s => s.bar === 0 && s.E.junkKept >= 3, say: s => `The quality filter is off, so ${s.E.junkKept} junk pages (spam, menus, filler) went straight into the training set: the red tiles. Raise the quality bar.` },
      { id: "looseD", when: s => s.E.copyKept >= 1 && s.sim > 0.999, say: s => { const b = s.E.best; return s.sim > 1 ? `Copy removal is off, so ${s.E.copyKept} copies of pages already kept got in (tiles marked 2×). The model would read the same text twice.` : `Only exact copies are caught. ${s.E.copyKept} near-copies got in: the same article with a new footer${b ? ` scores about ${Math.round(b.sim * 100)}% similar` : ""}, so set the cut-off below that.`; } },
      { id: "pii", when: s => !s.mask && s.E.piiKept >= 1, say: s => `${s.E.piiKept} page${s.E.piiKept > 1 ? "s" : ""} that pass${s.E.piiKept > 1 ? "" : "es"} your filters contain${s.E.piiKept > 1 ? "" : "s"} an email address or phone number (amber). Models can memorise text they see and repeat it later. Switch on masking.` },
      { id: "webOnly", when: s => s.web >= 0.9 && s.E.P < 0.08 && s.E.G >= 0.7, say: s => `The web pages are clean now, but the test model scores only ${Math.round(s.E.code)} on code and ${Math.round(s.E.maths)} on maths: it ${s.web >= 1 ? "never saw any" : "barely saw any"}. Lower "web pages in the training mix" to blend in other sources.` },
      { id: "lowWeb", when: s => s.web <= 0.3, say: s => `With only ${Math.round(s.web * 100)}% web text, code and maths are strong but general knowledge falls to ${Math.round(s.E.general)}: the model has read too little about everything else. Teams look for the balance with small experiments.` },
      { id: "allLang", when: s => s.lang === "all" && s.E.foreignKept >= 1, say: s => `With all languages kept, ${s.E.foreignKept} French, Spanish, German and Italian pages join the set. That's right for a model meant to speak them. Note that lorem ipsum no longer fails the language check, so only the quality bar can catch it.` },
      { id: "calm", when: () => true, say: s => `This snapshot: ${s.pages.length} pages in, ${s.E.kept} kept (${pct(s.E.kept / s.pages.length)}). ${pct(s.E.G)} of the good pages survive, and ${pct(s.E.P)} of what you keep is a problem.` }
    ],
    facts: [
      { id: "minhash", when: s => s.sim >= 0.6 && s.sim <= 0.9, text: "FineWeb, Hugging Face's open web dataset, found copies with MinHash on 5-word shingles and 112 hash functions, aiming at pages about 75% similar or more. It deduplicated each crawl snapshot on its own: deduplicating all 96 snapshots together removed up to 90% of the oldest ones and trained worse models.", ref: "#ref-3" },
      { id: "edu", when: s => s.bar >= 3, text: "FineWeb-Edu kept only pages that a classifier scored 3 or more out of 5 for educational value: 1.3 trillion of FineWeb's 15 trillion tokens. Small test models trained on it did better on school science questions (46% → 57%).", ref: "#ref-3" }
    ],
    tour: [
      { say: "Only the language check is on. Watch the training set on the right fill with red tiles: spam, menus and copies all get through.", set: { lang: "en", bar: 0, sim: 1.05, mask: false, web: 1 }, wait: 8 },
      { say: "Turn on quality at 2 out of 5. Simple rules catch spam and menus, and a scoring model rates everything else. Junk now falls into the middle bin.", set: { bar: 2 }, wait: 8 },
      { say: "Now drop pages that are 70% or more similar to one already kept. Copies of the same article with a new footer fall out.", set: { sim: 0.7 }, wait: 8 },
      { say: "Mask emails and phone numbers: the amber marks turn dark as pages pass the last filter.", set: { mask: true }, wait: 6 },
      { say: "Too strict: a bar of 4 throws away recipes, reviews and travel notes that are perfectly good. Good pages kept falls, and so does the test score.", set: { bar: 4 }, wait: 7 },
      { say: "Back to 2, and blend in code, maths and books. The test model is now good at all three. This balance is what data teams tune.", set: { bar: 2, web: 0.5 }, wait: 7 }
    ],
    publish: s => { const E = s.E, b = E.best; return {
      dIn: String(s.pages.length), dKept: String(E.kept), dKeptPct: pct(E.kept / s.pages.length), dGood: pct(E.G), dProb: pct(E.P), dScore: String(Math.round(E.score)),
      dShared: b ? String(b.shared) : "–", dUnion: b ? String(b.union) : "–", dJ: b ? (b.shared / b.union).toFixed(2) : "–", dMatch: b ? String(b.match) : "–", dEst: b ? (b.match / K).toFixed(2) : "–",
      dCut: s.sim > 1 ? "off" : s.sim.toFixed(2), dVerdict: b ? (s.sim <= 1 && b.match / K >= s.sim ? "dropped as a copy" : "kept: under your cut-off") : "–" }; }
  });
});
