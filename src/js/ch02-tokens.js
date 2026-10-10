/* Chapter 2 · Tokens. The learner trains a real byte-pair-encoding (BPE) tokenizer, live.
   Byte-level, as in GPT-2: text is split into "words" with GPT-2's pre-tokenizer pattern (a space sticks to the start
   of the next word), every word starts as its UTF-8 bytes (token IDs 0-255), and each merge glues the most frequent
   neighbouring pair in the training text into a new token (ID 256 + merge number). Training text is either a built-in
   ~1,850-word sample of everyday English written for this course, or the learner's own text. Encoding applies the
   learned merges in order. The embedding numbers shown are illustrative (deterministic pseudo-random). */
chapter("tokens", () => {
  const CORPUS = [
    "Every summer my grandmother grew strawberries in the long garden behind her house. The strawberry beds ran along the wall where the sun was warmest, and by the end of June the plants were heavy with fruit.",
    "We picked them in the morning, before the heat, and carried them to the kitchen in a wide basket. She made strawberry jam in a large pot on the stove, and the whole house smelled of sugar and fruit for days.",
    "People have eaten wild strawberries for thousands of years, but the garden strawberry we know today is quite new. It was bred in France in the eighteenth century from two wild plants, one from North America and one from Chile.",
    "The town is small, but it has everything you need. There is a market in the square on Saturday, a library by the river, and a school at the top of the hill. In the evening people sit outside the cafe and talk about the weather.",
    "The river runs through the middle of the town and under three old stone bridges. In the spring the water is high and fast, and in the summer children swim in the deep pools near the mill.",
    "When the train arrived, the station was already full of people. Some were going to work in the city, some were going home, and some were just waiting for a friend. The doors opened and everyone tried to get on at the same time.",
    "She looked at the map again and then at the road in front of her. It was not the road she had expected. The sign said the village was only four miles away, but the road turned into the forest and there was no one to ask.",
    "Learning to cook is mostly learning to pay attention. You watch the pan, you smell the onions, you taste the sauce and you change something. After a while you stop reading the recipe and start trusting what you notice.",
    "The children in the class were asked to write a short story about an animal. One wrote about a cat that could talk, one wrote about a dog that was afraid of the dark, and one wrote about a horse that wanted to be a train.",
    "Computers store everything as numbers. A letter, a colour, a sound and a photograph all end up as long lists of numbers in the computer's memory. The program decides what the numbers mean.",
    "It had been raining for three days when the letter came. My father read it at the kitchen table, folded it carefully and put it in his pocket. He did not say anything, but he smiled for the rest of the evening.",
    "The new library opened last year. It has more than a hundred thousand books, a room for children, a quiet room for study and a garden on the roof where you can read in the sun.",
    "In the winter the days are short and the nights are long. People stay inside, light the fire and tell stories. In the summer the evenings are light until late, and nobody wants to go to bed.",
    "He was not the fastest runner in the team, but he never stopped. In the last part of the race, when the others were tired, he was still running at the same speed, and one by one he passed them.",
    "The best way to learn a language is to use it. Talk to people, read the news, listen to the radio and make mistakes. Every mistake you notice is something you will not get wrong again.",
    "Our neighbours have a small farm at the edge of the town. They keep chickens, two goats and an old horse, and they sell eggs and honey from a table by the gate. In June they sell strawberries too.",
    "The meeting started late because the room was too small. Someone brought more chairs, someone opened the windows, and after twenty minutes everyone could finally see the screen.",
    "There are many kinds of fruit in the market: apples, pears, plums, cherries and, in early summer, the first strawberries. The strawberry season is short, so people buy as much as they can.",
    "I remember the first time I saw the sea. We had driven all night, and in the morning my mother woke me and pointed out of the window. The water was grey and bright and it went on for ever.",
    "Good writing is clear writing. Use short words when you can, say one thing in each sentence, and read your work out loud. If you get lost reading it, your reader will get lost too.",
    "Most mornings I walk to work. It takes about half an hour, and I like the time to think. I pass the bakery, the bank and the park, and I always stop at the corner to buy a newspaper from the same old man.",
    "The house was very quiet after the guests had gone. We washed the plates, put the chairs back in the garden and sat down for the first time all day. Nobody said much, but it had been a good day.",
    "If you want to grow vegetables, start small. Choose a sunny place, dig the soil well and plant only what you like to eat. Water the plants in the evening, and pull out the weeds before they get too big.",
    "The doctor asked him how he was feeling. He said he was tired and that his head hurt when he stood up. She listened to his heart, looked at his eyes and told him to rest for a week and drink more water.",
    "My sister lives in a flat on the fourth floor of an old building in the centre of the city. From her window you can see the river, the cathedral and the mountains far away on a clear day.",
    "On Sunday we went for a long walk in the hills. The path was steep and wet, and we stopped often to look back at the valley. At the top there was a small hut where we ate our lunch and watched the clouds.",
    "Every country has its own way of making bread. Some bread is soft and white, some is dark and heavy, and some is flat and baked on a hot stone. But almost everywhere, people share bread when they eat together.",
    "The company was founded by two friends who met at university. They started in a small office above a shop, with one computer and a lot of ideas. Ten years later they had offices in four countries.",
    "When I was young I wanted to be a pilot. I read every book about planes that I could find, and I built models of them in my bedroom. In the end I became a teacher, but I still look up when a plane goes over.",
    "The storm came in the night. The wind broke branches from the trees and the rain ran down the street like a river. In the morning the sky was clear and blue, and the whole town came out to clean up.",
    "A good friend is someone who listens. They do not always agree with you, and they tell you when you are wrong, but they are there when you need them and they are happy when things go well for you.",
    "The museum has a large collection of old maps. Some of them show the world as people imagined it hundreds of years ago, with strange animals in the sea and whole countries in the wrong place.",
    "We had to change trains twice, and the second train was late. By the time we arrived it was dark and the hotel was closed. A kind woman at the station called the owner, who came down to open the door for us.",
    "Music was always part of our family. My father played the piano, my mother sang, and on long winter evenings we sat around the fire and played songs that everyone knew.",
    "The new road will make the trip to the coast shorter, but many people in the village are against it. They are afraid that it will bring more traffic, more noise and fewer birds to the fields around the town.",
    "She opened the box slowly. Inside, wrapped in old paper, was a small silver watch. It had belonged to her grandfather, and on the back were his initials and the year he was born.",
    "It is important to sleep well. Most adults need about eight hours each night. Try to go to bed at the same time every day, keep your room dark and cool, and put your phone away an hour before you sleep.",
    "The football match was the most important of the season. The whole town was there, and when the home team scored in the last minute the noise could be heard on the other side of the river.",
    "After dinner we played cards at the kitchen table. My grandfather always won, and we never understood how. Years later he told us his secret: he simply remembered every card that had been played.",
    "The shop on the corner sells everything: bread, milk, newspapers, stamps, light bulbs and birthday cards. The owner knows the name of every customer and always asks about their family.",
    "Writing a letter by hand takes time, and that is why people like to receive one. You can see that the writer sat down, thought about you and chose every word.",
    "In the autumn the leaves turn red and gold and fall from the trees. Children kick them along the path on the way to school, and the air smells of smoke and rain.",
    "The plan was simple. We would leave early, drive to the lake, rent a boat and spend the whole day on the water. Of course, nothing went to plan, but it was still one of the best days of the summer.",
    "Many animals sleep through the cold months. They eat as much as they can in the autumn, find a safe place and slow their hearts down until the spring comes and there is food again.",
    "The teacher wrote a question on the board and waited. For a long time nobody spoke. Then a girl at the back of the room put up her hand and gave an answer that surprised everyone, including the teacher.",
    "Cities grow because people come looking for work. They bring their families, their food and their languages, and over time the city becomes a mix of all the places they came from.",
    "I had never been on a boat before, and for the first hour I felt terrible. Then the sea became calm, the sun came out and I started to enjoy the trip. By the evening I did not want to go back to land.",
    "Our cat sleeps most of the day. In the morning she lies in the sun by the kitchen window, in the afternoon she moves to the sofa, and at night she sits on the end of my bed and watches the door."
  ].join(" ");
  const PRE = /'(?:s|t|re|ve|m|ll|d)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu; // GPT-2's pre-tokenizer
  const ENC = new TextEncoder(), DEC = new TextDecoder("utf-8", { fatal: true });
  const MAXM = 700, KEY = (a, b) => a * 65536 + b;
  const TEXTS = {
    en: { name: "English", text: "The weather turned cold on the night of the harvest festival. Families walked into town to buy bread, apples and warm cider, while children ran between the stalls. By morning the square was quiet again, and the only sound was the bell of the old church." },
    code: { name: "Code", text: "def total_price(items, tax_rate):\n    total = 0\n    for item in items:\n        total += item.price * item.count\n    return total * (1 + tax_rate)" },
    hi: { name: "Hindi", text: "मुझे चाय बहुत पसंद है। हर सुबह मैं चाय पीता हूँ और अख़बार पढ़ता हूँ।", gloss: "“I like tea a lot. Every morning I drink tea and read the newspaper.” (15 words in English)" },
    straw: { name: "strawberry", text: "How many r's are in strawberry?" },
    own: { name: "Yours", text: "Type anything here, in any language." }
  };
  const fmtN = n => Math.round(n).toLocaleString("en-US");

  // ---------- a byte-level BPE learner that learns merges on demand ----------
  function learner(text) {
    const freq = new Map(); for (const w of text.match(PRE) || []) freq.set(w, (freq.get(w) || 0) + 1);
    const words = [...freq].map(([w, f]) => ({ s: Array.from(ENC.encode(w)), f }));
    const L = { merges: [], saved: [], start: words.reduce((a, w) => a + w.s.length * w.f, 0), done: false, words: words.reduce((a, w) => a + w.f, 0), rank: new Map() };
    L.learnTo = m => {
      while (!L.done && L.merges.length < m) {
        const pc = new Map();
        for (const w of words) for (let i = 0; i + 1 < w.s.length; i++) { const k = KEY(w.s[i], w.s[i + 1]); pc.set(k, (pc.get(k) || 0) + w.f); }
        let best = -1, bc = 1; for (const [k, c] of pc) if (c > bc) { bc = c; best = k; }
        if (best < 0) { L.done = true; break; }
        const a = Math.floor(best / 65536), b = best % 65536, id = 256 + L.merges.length; let sv = 0;
        for (const w of words) { const o = []; for (let i = 0; i < w.s.length; i++) { if (i + 1 < w.s.length && w.s[i] === a && w.s[i + 1] === b) { o.push(id); i++; sv += w.f; } else o.push(w.s[i]); } w.s = o; }
        L.rank.set(best, L.merges.length); L.merges.push([a, b, bc]); L.saved.push(sv);
      }
      return Math.min(m, L.merges.length);
    };
    L.tokensAt = m => { let t = L.start; for (let i = 0; i < m && i < L.saved.length; i++) t -= L.saved[i]; return t; };
    L.bytes = id => { const out = []; const go = x => { if (x < 256) out.push(x); else { const [a, b] = L.merges[x - 256]; go(a); go(b); } }; go(id); return out; };
    L.encode = (txt, m) => {
      const out = [];
      for (const w of txt.match(PRE) || []) {
        const s = Array.from(ENC.encode(w));
        for (;;) { let bi = -1, br = 1e9; for (let i = 0; i + 1 < s.length; i++) { const r = L.rank.get(KEY(s[i], s[i + 1])); if (r !== undefined && r < m && r < br) { br = r; bi = i; } } if (bi < 0) break; s.splice(bi, 2, 256 + br); }
        out.push(...s);
      }
      return out;
    };
    return L;
  }
  const WEB = learner(CORPUS);
  const selfCache = new Map();
  const selfL = t => { if (!selfCache.has(t)) { if (selfCache.size > 8) selfCache.clear(); selfCache.set(t, learner(t)); } return selfCache.get(t); };
  const L_ = s => s.src === "web" ? WEB : selfL(s.text);

  // token display: decoded text, spaces as ·, newlines as ↵; a piece of a character shows its byte in hex
  function label(L, id) {
    const b = L.bytes(id); let out = "", part = false, i = 0;
    while (i < b.length) {
      const x = b[i], n = x < 0x80 ? 1 : (x & 0xe0) === 0xc0 ? 2 : (x & 0xf0) === 0xe0 ? 3 : (x & 0xf8) === 0xf0 ? 4 : 0;
      let ok = n > 0 && i + n <= b.length; for (let j = 1; ok && j < n; j++) if ((b[i + j] & 0xc0) !== 0x80) ok = false;
      if (ok) { try { out += DEC.decode(new Uint8Array(b.slice(i, i + n))); i += n; continue; } catch (e) {} }
      out += (out ? "\u2009" : "") + x.toString(16); part = true; i++;
    }
    return { t: out.replace(/ /g, "·").replace(/\n/g, "↵").replace(/\t/g, "→"), part, nl: b.includes(10) };
  }
  // the illustrative embedding row for a token
  const emb = (id, q) => { const v = Math.sin(id * 12.9898 + q * 78.233) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };

  function retok(s) {
    const L = L_(s), ids = L.encode(s.text, s.m); let off = 0;
    s.toks = ids.map(id => { const lb = label(L, id), n = L.bytes(id).length, t = { id, ...lb, b0: off, b1: off + n }; off += n; return t; });
    s.layoutKey = ""; if (s.rc >= s.toks.length) s.rc = 0; if (s.sel >= s.toks.length) s.sel = -1;
  }
  const words = s => (s.text.match(/\S+/g) || []).length;
  const nonAscii = s => /[^\x00-\x7f]/.test(s.text);
  // how many tokens cover the word "strawberry" (0 if it isn't in the text)
  function strawToks(s) {
    const tb = ENC.encode(s.text.toLowerCase()), w = ENC.encode("strawberry");
    let at = -1; for (let i = 0; i + w.length <= tb.length && at < 0; i++) { let ok = true; for (let j = 0; j < w.length; j++) if (tb[i + j] !== w[j]) { ok = false; break; } if (ok) at = i; }
    if (at < 0) return 0; return s.toks.filter(t => t.b1 > at && t.b0 < at + w.length).length;
  }

  function init() { return { t: 0, text: TEXTS.en.text, key: "en", src: "web", target: 60, m: 0, ph: 0, toks: [], rc: 0, rcT: 0, sel: -1, selT: -99, lastT: -99, goalFor: 0, layoutKey: "" }; }
  function step(s, dt) {
    s.t += dt;
    const L = L_(s), eff = L.learnTo(s.target);
    if (s.m > eff) { s.m = eff; s.ph = 0; retok(s); }
    else if (s.m < eff) {
      const rate = Math.max(3, (eff - s.m) * 1.6); s.ph += dt * rate; let ch = false;
      while (s.ph >= 1 && s.m < eff) { s.m++; s.ph -= 1; ch = true; s.lastT = s.t; }
      if (s.m >= eff) s.ph = 0; if (ch) retok(s);
    } else s.ph = 0;
    if (!s.toks.length) retok(s);
    s.rcT += dt; const hold = s.sel >= 0 && s.t - s.selT < 6;
    if (hold) s.rc = s.sel; else { if (s.sel >= 0) s.sel = -1; if (s.rcT > 0.9) { s.rcT = 0; s.rc = s.toks.length ? (s.rc + 1) % s.toks.length : 0; } }
    s.goalFor = strawToks(s) === 1 ? s.goalFor + dt : 0;
  }
  const pairNow = s => { const L = L_(s); return s.m < L.merges.length && s.m < s.target ? L.merges[s.m] : null; };

  // ---------- layout ----------
  function lay(narrow) {
    if (!narrow) return { n: false, T: { x: 20, y: 52, w: 820, h: 340 }, M: { x: 880, y: 20, w: 380, rows: 9, rh: 30 }, I: { x: 20, y: 470, w: 820, n: 9 }, E: { x: 905, y: 372, w: 255, h: 228 }, V: { x: 20, y: 572, w: 820 }, fs: [26, 11] };
    return { n: true, T: { x: 6, y: 40, w: 388, h: 300 }, M: { x: 6, y: 368, w: 388, rows: 3, rh: 28 }, I: { x: 6, y: 520, w: 270, n: 4 }, E: { x: 300, y: 488, w: 94, h: 150 }, V: { x: 6, y: 604, w: 280 }, fs: [22, 10] };
  }
  let LAY = null;
  function layoutChips(k, s, G) {
    const key = [s.text, s.src, s.m, G.n, k.ctx.canvas.width].join("|"); if (s.layoutKey === key && LAY) return LAY;
    const c = k.ctx, B = G.T, top = nonAscii(s) ? (G.n ? 58 : 40) : 0;
    let best = null;
    for (let fs = G.fs[0]; fs >= G.fs[1]; fs--) {
      c.font = `600 ${fs}px ${css("--f-mono")}`;
      const px = fs * 0.32, gap = fs * 0.24, h = fs * 1.45, lh = h + fs * 0.32; let x = B.x, y = B.y + top; const r = [];
      for (const t of s.toks) { c.font = `600 ${t.part ? fs * 0.78 : fs}px ${css("--f-mono")}`; const w = c.measureText(t.t).width + px * 2; if (x + w > B.x + B.w && x > B.x) { x = B.x; y += lh; } r.push({ x, y, w, h }); x += w + gap; if (t.nl) { x = B.x; y += lh; } }
      best = { fs, h, r, top, over: y + h > B.y + B.h };
      if (!best.over) break;
    }
    s.layoutKey = key; return (LAY = best);
  }
  const hue = id => (id * 137.508) % 360;

  function chip(k, t, R, fs, o = {}) {
    const C = k.C, merged = t.id >= 256;
    k.box(R.x, R.y, R.w, R.h, { fill: merged ? `hsl(${hue(t.id)} 42% 26%)` : C.bg2, stroke: o.stroke || (merged ? `hsl(${hue(t.id)} 55% 52%)` : C.line), lw: o.lw || 1.2, r: Math.min(7, fs * 0.3), glow: o.glow || 0, glowCol: o.glowCol, dash: t.part ? [3, 3] : null, alpha: o.alpha });
    k.text(R.x + R.w / 2, R.y + R.h / 2 + 1, t.t, { mono: true, size: t.part ? fs * 0.78 : fs, weight: "600", col: t.part ? C.muted : C.ink, alpha: o.alpha });
  }

  function draw(k, s, sim) {
    const C = k.C, G = lay(sim.narrow), L = L_(s), A = layoutChips(k, s, G), B = G.T, pr = pairNow(s);
    // 1) the text as tokens
    k.label(B.x, B.y - (G.n ? 22 : 26), `${G.n ? "Your text" : "Your text, cut into tokens"} · ${fmtN(s.toks.length)} tokens`, { align: "left", col: C.ink, weight: "650", size: 13 });
    if (A.top) { k.para(B.x, B.y - 4, s.text, B.w, { size: G.n ? 15 : 17, serif: true, col: C.ink, maxLines: 1 }); if (s.key === "hi") k.para(B.x, B.y + 18, TEXTS.hi.gloss, B.w, { size: G.n ? 11 : 12, col: C.muted, maxLines: G.n ? 2 : 1 }); }
    const hl = new Set(); if (pr && s.ph > 0) for (let i = 0; i + 1 < s.toks.length; i++) if (s.toks[i].id === pr[0] && s.toks[i + 1].id === pr[1]) { hl.add(i); hl.add(i + 1); i++; }
    const fresh = s.t - s.lastT < 0.6 ? 256 + s.m - 1 : -1;
    s.toks.forEach((t, i) => {
      const R = A.r[i]; if (!R || R.y + R.h > B.y + B.h + 2) return;
      let o = {};
      if (hl.has(i)) { const sl = easeIO(s.ph) * A.fs * 0.12 * (hl.has(i - 1) && !hl.has(i + 1) ? -1 : hl.has(i + 1) ? 1 : -1); o = { stroke: C.amb, lw: 2, glow: 6 + 10 * s.ph, glowCol: C.amb }; R.dx = sl; }
      else R.dx = 0;
      if (t.id === fresh) o = { stroke: C.sig, lw: 2, glow: 14 * (1 - (s.t - s.lastT) / 0.6), glowCol: C.sig };
      if (i === s.rc) o = { ...o, stroke: s.sel === i ? C.amb : C.sig, lw: 2.4, glow: 10, glowCol: s.sel === i ? C.amb : C.sig };
      chip(k, t, { x: R.x + (R.dx || 0), y: R.y, w: R.w, h: R.h }, A.fs, o);
    });
    if (A.over) k.label(B.x + B.w, B.y + B.h + 8, "… (text continues)", { align: "right", col: C.muted, size: 11 });
    // 2) merge rules
    const M = G.M, srcName = s.src === "web" ? "1,850 words of everyday English" : "your text only";
    k.label(M.x, M.y + 6, `Merges learned · ${fmtN(s.m)}`, { align: "left", col: C.ink, weight: "650", size: 13 });
    if (!G.n) k.label(M.x, M.y + 26, `learned from ${srcName}`, { align: "left", col: C.muted, size: 11.5 });
    const rows = []; if (pr) rows.push({ i: s.m, p: pr, live: true }); for (let i = s.m - 1; i >= 0 && rows.length < M.rows; i--) rows.push({ i, p: L.merges[i] });
    const y0 = M.y + (G.n ? 24 : 46);
    rows.forEach((r, j) => {
      const y = y0 + j * M.rh, a = label(L, r.p[0]).t, b = label(L, r.p[1]).t, ab = label(L, 256 + r.i).t, live = r.live;
      k.box(M.x, y, M.w, M.rh - 5, { fill: C.bg2, stroke: live ? C.amb : r.i === s.m - 1 && s.t - s.lastT < 0.6 ? C.sig : C.line, lw: live ? 1.8 : 1, r: 7, alpha: live ? 1 : Math.max(0.35, 1 - j * 0.08), glow: live ? 8 : 0, glowCol: C.amb });
      if (live) k.box(M.x, y + M.rh - 8, M.w * s.ph, 3, { fill: C.amb, r: 1.5 });
      k.text(M.x + 10, y + (M.rh - 5) / 2 + 1, `${r.i + 1}`, { mono: true, size: 12, col: C.muted, align: "left" });
      k.text(M.x + 56, y + (M.rh - 5) / 2 + 1, `${a} + ${b} → ${ab}`.slice(0, G.n ? 30 : 34), { mono: true, size: G.n ? 13 : 14, col: live ? C.amb : C.ink, align: "left", weight: "600" });
      k.text(M.x + M.w - 10, y + (M.rh - 5) / 2 + 1, `×${r.p[2]}`, { mono: true, size: 12, col: C.muted, align: "right" });
    });
    if (!rows.length) k.para(M.x, y0 + 4, s.src === "self" && L.done ? "No pair of neighbours appears twice in this text, so there is nothing to learn." : "No merges yet: every byte is its own token. Drag the merges slider.", M.w, { size: 13, col: C.muted });
    // 3) what the model receives: IDs -> rows of the embedding table
    const I = G.I, E = G.E, V = 256 + s.m, n = Math.min(I.n, s.toks.length);
    k.label(I.x, I.y - (G.n ? 26 : 32), G.n ? "What the model receives" : "What the model receives: one ID number per token", { align: "left", col: C.ink, weight: "650", size: 13 });
    let i0 = Math.max(0, Math.min(s.rc - Math.floor(n / 2), s.toks.length - n)); const cw = (I.w - (n - 1) * 8) / Math.max(1, n);
    for (let q = 0; q < n; q++) {
      const i = i0 + q, t = s.toks[i], x = I.x + q * (cw + 8), cur = i === s.rc;
      const fs = Math.min(G.n ? 15 : 17, cw / Math.max(2, (t.part ? t.t.length * 0.6 : t.t.length)) / 0.62);
      chip(k, t, { x, y: I.y, w: cw, h: G.n ? 30 : 34 }, fs, cur ? { stroke: s.sel === i ? C.amb : C.sig, lw: 2.2, glow: 10, glowCol: C.sig } : { alpha: 0.75 });
      k.text(x + cw / 2, I.y + (G.n ? 48 : 54), String(t.id), { mono: true, size: G.n ? 15 : 18, weight: "650", col: cur ? C.sig : C.muted });
    }
    // the table
    k.label(E.x + E.w / 2, E.y - (G.n ? 12 : 16), G.n ? `table · ${fmtN(V)} rows` : `Embedding table · ${fmtN(V)} rows`, { col: C.ink, weight: "650", size: G.n ? 11 : 13 });
    k.box(E.x, E.y, E.w, E.h, { fill: C.bg2, stroke: C.line, r: 6 });
    const yb = E.y + E.h * 256 / V, cols = G.n ? 6 : 12, bands = G.n ? 26 : 40;
    for (let b = 0; b < bands; b++) { const y = E.y + 3 + b * (E.h - 6) / bands, rid = Math.floor((b + 0.5) / bands * V); for (let q = 0; q < cols; q++) { const v = emb(rid, q); k.box(E.x + 4 + q * (E.w - 8) / cols, y, (E.w - 8) / cols - 1.5, (E.h - 6) / bands - 1.5, { fill: rid < 256 ? C.muted : C.sig, r: 1, alpha: 0.12 + 0.28 * Math.abs(v) }); } }
    if (s.m > 0) { k.line(E.x - 4, yb, E.x + E.w + 4, yb, { col: C.ink, lw: 1, dash: [3, 3], alpha: 0.6 }); }
    if (!G.n) { k.label(E.x - 8, E.y + (yb - E.y) / 2, "256 bytes", { align: "right", col: C.muted, size: 11 }); if (s.m > 0) k.label(E.x - 8, yb + (E.y + E.h - yb) / 2, `${fmtN(s.m)} merges`, { align: "right", col: C.sig, size: 11 }); }
    const ct = s.toks[s.rc];
    if (ct) {
      const ry = E.y + E.h * (ct.id + 0.5) / V, q = s.rc - i0, sx = I.x + q * (cw + 8) + cw / 2, sy = I.y + (G.n ? 60 : 66), by = G.n ? 636 : 614, bx = E.x - (G.n ? 12 : 30);
      k.box(E.x - 2, ry - 3, E.w + 4, 6, { fill: C.sig, r: 3, glow: 14, glowCol: C.sig });
      k.label(E.x + E.w + (G.n ? -4 : 8), ry, G.n ? "" : `row ${ct.id}`, { align: "left", col: C.sig, size: 12, weight: "600" });
      const pts = [[sx, sy], [sx, by], [bx, by], [bx, ry], [E.x - 2, ry]], seg = pts.slice(1).map((p, j) => Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1])), tot = seg.reduce((a, b) => a + b, 0);
      const path = u => { let d = u * tot; for (let j = 0; j < seg.length; j++) { if (d <= seg[j] || j === seg.length - 1) { const f = Math.min(1, d / seg[j]); return [lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f)]; } d -= seg[j]; } };
      if (q >= 0 && q < n) { for (let j = 0; j + 1 < pts.length; j++) k.line(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], { col: C.sig, lw: 1, alpha: 0.25 }); }
      if (q >= 0 && q < n) k.flow(path, 3, (s.t * 0.6) % 1, C.sig, { len: 0.06, size: 3 });
      // the row's numbers
      const Vv = G.V, nums = G.n ? 4 : 6, txt = Array.from({ length: nums }, (_, j) => { const v = emb(ct.id, j); return (v < 0 ? "−" : "") + Math.abs(v).toFixed(2); }).join("  ");
      k.label(Vv.x, Vv.y, G.n ? `row ${ct.id}: ${txt} …` : `“${ct.t}” → ID ${ct.id} → row ${ct.id}:  ${txt}  …`, { align: "left", col: C.sig, mono: true, size: G.n ? 11 : 13 });
      if (!G.n) k.label(Vv.x, Vv.y + 22, "the numbers are illustrative; in a real model they are learned, and there are thousands per row", { align: "left", col: C.muted, size: 11 });
    }
  }

  function stats(s) {
    const t = s.toks.length, w = words(s), tpw = w ? t / w : 0;
    return [["tokens in your text", fmtN(t), s.key === "straw" && strawToks(s) === 1 ? "ok" : ""], ["characters per token", (Array.from(s.text).length / Math.max(1, t)).toFixed(1)], ["tokens per word", tpw.toFixed(1), tpw > 4 ? "bad" : tpw > 2 ? "hot" : "ok"], ["vocabulary", fmtN(256 + s.m) + " tokens"]];
  }

  const fig = $("#tok-sim");
  const sim = makeSim(fig, {
    label: "Tokenizer simulation. Your text is shown as a row of tokens. A byte-pair-encoding tokenizer learns merge rules one at a time, and each rule glues a frequent pair of neighbouring tokens into one. Below, each token's ID picks a row of the embedding table. Click a token to inspect it.",
    cams: { default: { x: 0, y: -10, w: 1280, h: 640 } },
    camsNarrow: { default: { x: 0, y: 0, w: 400, h: 640 } },
    height: w => w < 640 ? Math.round(w * 1.55) : Math.round(Math.min(580, Math.max(380, w * 0.52))),
    init, step, draw, warmup: 1,
    intro: "This tokenizer is learning, one merge at a time. Each merge glues the most common pair of neighbours into a new token. Drag <b>Merges learned</b> and watch your text fall into fewer, bigger pieces.",
    controls: [
      { id: "text", label: "Text to cut up", type: "choice", value: "en", options: Object.entries(TEXTS).filter(([k]) => k !== "own").map(([k, v]) => [k, v.name]), help: "Or type your own text in the box.", apply: (s, v) => { s.key = v; s.text = TEXTS[v].text; s.sel = -1; s.rc = 0; retok(s); } },
      { id: "src", label: "Learn the merges from", type: "choice", value: "web", options: [["web", "Everyday English"], ["self", "This text only"]], help: "A real tokenizer learns once, from a huge pile of text, then cuts up everything with the same rules.", apply: (s, v) => { const ch = s.src !== v; s.src = v; if (ch) { s.m = 0; s.ph = 0; s.sel = -1; retok(s); } } },
      { id: "merges", label: "Merges learned", type: "range", min: 0, max: MAXM, step: 10, value: 60, fmt: v => `${v} → vocabulary ${fmtN(256 + v)}`, help: "Vocabulary = the 256 possible bytes + one new token per merge.", apply: (s, v) => { s.target = v; } }
    ],
    click: (s, wx, wy, sim) => {
      const A = LAY; if (!A) return; s.sel = -1;
      A.r.forEach((R, i) => { if (wx >= R.x && wx <= R.x + R.w && wy >= R.y && wy <= R.y + R.h) s.sel = i; });
      if (s.sel >= 0) { s.rc = s.sel; s.selT = s.t; }
    },
    stats,
    goal: { text: "make “strawberry” a single token", check: s => { const n = strawToks(s); return { done: s.goalFor >= 1.5, progress: n ? `“strawberry” = ${n} token${n === 1 ? "" : "s"}` : "pick a text with “strawberry” in it" }; } },
    notices: [
      { id: "sel", when: s => s.sel >= 0 && s.t - s.selT < 6, say: s => { const t = s.toks[s.sel]; return `“${esc(t.t)}” is token <b>${t.id}</b>${t.id < 256 ? ", one raw byte" : `, made by merge ${t.id - 255}`}. The model never sees its letters. It receives only the number ${t.id}, which picks row ${t.id} of the embedding table: a list of numbers learned for this token.`; } },
      { id: "straw", when: s => strawToks(s) === 1, say: s => { const t = s.toks.find(x => /strawberry/i.test(x.t)); return `“strawberry” is now one token, number <b>${t ? t.id : ""}</b>. That number is all the model receives. The letters, and the three r's, are no longer visible to it: to count them it must remember how token ${t ? t.id : ""} is spelled.`; } },
      { id: "nonEn", when: s => nonAscii(s) && s.src === "web" && words(s) > 0 && s.toks.length / words(s) > 3, say: s => `Your text is <b>${fmtN(s.toks.length)}</b> tokens for ${words(s)} words, ${(s.toks.length / words(s)).toFixed(1)} per word. This vocabulary learned only from English, so it has no merges for these letters: each one stays as its raw bytes (dashed boxes). Switch to <b>This text only</b> and watch the bytes fuse into letters.` },
      { id: "out", when: s => s.src === "self" && L_(s).done && s.target > L_(s).merges.length && s.m >= L_(s).merges.length, say: s => { const L = L_(s), web = WEB.encode(s.text, WEB.learnTo(s.m)).length; return /strawberry/i.test(s.text) && strawToks(s) > 1 ? `Learning from this one sentence ran out after ${L.merges.length} merges. “strawberry” appears only once, and a merge needs a pair seen at least twice, so the word can never be learned here. Learn from everyday English instead.` : `Learning ran out after <b>${L.merges.length}</b> merges: no pair of neighbours appears twice any more. The vocabulary now fits this text snugly (${fmtN(s.toks.length)} tokens), but it learned from just ${L.words} words. The same number of merges learned from everyday English gives ${fmtN(web)}.`; } },
      { id: "code", when: s => s.key === "code" && s.src === "web" && s.m >= 100, say: s => { const L = L_(s), n = L.encode(" total_price", s.m).length; return `Code is full of symbols and made-up names. This vocabulary learned from stories, so “total_price” still takes ${n} tokens, and every space of indentation is a token of its own. Tokenizers for coding models learn from lots of code.`; } },
      { id: "rare", when: s => s.m >= 150 && s.m === Math.min(s.target, L_(s).merges.length) && L_(s).merges[s.m - 1] && L_(s).merges[s.m - 1][2] <= 3, say: s => { const L = L_(s), a = L.encode(s.text, Math.max(0, s.m - 100)).length, b = s.toks.length, z = L.encode(s.text, Math.min(100, s.m)).length, z0 = L.encode(s.text, 0).length; return `Merge ${s.m} glued a pair seen only ${L.merges[s.m - 1][2]} times in the training text. Late merges buy little: the last 100 merges saved your text ${a - b} tokens, the first 100 saved ${z0 - z}. That's why real vocabularies stop at tens of thousands of tokens.`; } },
      { id: "space", when: s => s.m >= 20 && s.m <= 300 && s.toks.some(t => /^·\p{L}{2,}/u.test(t.t)), say: s => { const t = s.toks.find(t => /^·\p{L}{2,}/u.test(t.t)); return `See the dot at the start of “${esc(t.t)}”? The space before a word belongs to the word, so “${esc(t.t)}” is one token (ID ${t.id}) instead of two. A word at the start of a sentence, with no space, is a different token with a different ID.`; } },
      { id: "calm", when: () => true, say: s => `${fmtN(s.m)} merges learned. Your text: ${fmtN(Array.from(s.text).length)} characters became <b>${fmtN(s.toks.length)}</b> tokens. Drag the merges slider and watch pairs glue together, or click any token.` }
    ],
    facts: [
      { id: "gage", when: s => s.m >= 30, text: "Byte-pair encoding started life in 1994 as a way to compress files. In 2015 researchers repurposed it to split rare words into pieces for machine translation, and language models have used versions of it ever since.", ref: "#ref-4" },
      { id: "llama", when: s => s.m >= 500 || s.sel >= 0, text: "Meta's open Llama 3 models have a vocabulary of about 128,000 tokens, and each row of the 8-billion-parameter model's embedding table holds 4,096 numbers: over 500 million numbers just to look tokens up.", ref: "#ref-9" }
    ],
    tour: [
      { say: "With no merges, every letter is its own token (strictly, every byte). This short paragraph is over 250 tokens.", set: { text: "en", src: "web", merges: 0 }, wait: 6 },
      { say: "Now the tokenizer learns. It counts every pair of neighbours in its training text, glues the most common pair into a new token, and repeats. Watch the list on the right and the pieces on the left.", set: { merges: 150 }, until: s => s.m >= 150, max: 14, min: 6 },
      { say: "More merges, bigger pieces. Common words like “·the” and “·and” are single tokens now, while rare words like “harvest” stay in pieces.", set: { merges: 600 }, wait: 8 },
      { say: "The same English-trained rules on a Hindi sentence. They have never seen these letters, so each letter stays as 3 raw bytes: more than 10 tokens per word.", set: { text: "hi" }, wait: 8 },
      { say: "Learn from this text instead. First the bytes fuse into whole letters, then a few letters into common syllables. A short text runs out of repeated pairs quickly.", set: { src: "self", merges: 200 }, wait: 9 },
      { say: "Finally, “strawberry”, learned from everyday English. It becomes a single token: one number. The r's inside it are hidden from the model.", set: { text: "straw", src: "web", merges: 300 }, until: s => strawToks(s) === 1, max: 16, min: 6 }
    ],
    publish: s => {
      const L = L_(s), t = s.toks.length, w = words(s), last = s.m > 0 ? L.merges[s.m - 1] : null, sel = s.toks[s.rc];
      return { tkTok: fmtN(t), tkChars: fmtN(Array.from(s.text).length), tkWords: fmtN(w), tkTpw: w ? (t / w).toFixed(1) : "–", tkWpt: t ? (w / t).toFixed(2) : "–",
        tkMerges: fmtN(s.m), tkVocab: fmtN(256 + s.m), tkSrc: s.src === "web" ? "everyday English" : "your text",
        tkPair: last ? `“${label(L, last[0]).t}” + “${label(L, last[1]).t}”` : "(no merge yet)", tkPairNew: last ? `“${label(L, 256 + s.m - 1).t}”` : "–", tkPairCount: last ? fmtN(L.saved[s.m - 1]) : "0",
        tkTrainStart: fmtN(L.start), tkTrainNow: fmtN(L.tokensAt(s.m)), tkTrainSaved: fmtN(L.start - L.tokensAt(s.m)),
        tkSel: sel ? `“${sel.t}”` : "–", tkSelId: sel ? String(sel.id) : "–" };
    }
  });

  // free text: an extra input beside the controls
  const box = document.createElement("div"); box.className = "ctl sim-ctl sim-text";
  box.innerHTML = `<label for="tok-sim-own">Or type your own text</label><input type="text" id="tok-sim-own" maxlength="240" spellcheck="false" value="${esc(TEXTS.own.text)}"><small>Try your name, an emoji, or a sentence in another language.</small>`;
  $(".sim-controls", fig).appendChild(box);
  $("input", box).addEventListener("input", e => { TEXTS.own.text = e.target.value || " "; sim.set("text", "own"); });
});
