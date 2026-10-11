# Building a chapter for "AI Under the Hood" v4

Repo: /home/claude/ai-under-the-hood (branch v4, a static site). Source in `src/`, built by `python3 build.py`
into `docs/index.html`. Do NOT run git. Only create/edit the files named in your assignment.

## What the course is now
A course you *play*. Each chapter answers one question with ONE live simulation the learner drives, then a short
explanation that deepens on demand. The audience is anyone from a curious beginner to an engineer. The promise:
by the end, an end-to-end picture of how AI assistants work and what it takes to serve them.

READ THESE FIRST (they are the standard to match):
- `src/js/sim.js` header comment: the simulation engine API (makeSim).
- `src/js/kit.js`: drawing kit (k.box, k.dot, k.line, k.curve, k.trail, k.flow, k.text, k.label (opt bg:true),
  k.para, k.hud, colours k.C: bg bg2 line ink muted sig(teal=data) amb(amber=compute/energy) crit ok).
- Reference chapter: `src/chapters/07-memory.html` + `src/js/ch07-memory.js`. Copy its structure and quality.
- Old content to reuse (already fact-checked, with references): `src/legacy/chapters/*.html`,
  `src/legacy/js/*.js` (old simulations and films: reuse good logic/visuals), references list in
  `src/chapters/99-refs.html` (cite as `<sup class="ref"><a href="#ref-N">N</a></sup>`).

## Chapter page structure (exact order; see 07-memory.html)
`<section class="chapter" id="<id>" data-num="<n>" data-part="<part>" data-title="<Short title>">`
1. `<header class="ch-head">` with `.ch-num` ("Chapter n · Part name"), `<h2>` = the QUESTION a person would ask,
   `.hook` (2–3 sentences; may open with a surprising fact), `.meta` (minutes · what you'll learn).
2. `.recall` (data-toc="Remember"): one multiple-choice question about the PREVIOUS chapter's carry-forward
   (table below). Chapter 1 has no recall.
3. `.beat` with `.predict` (data-toc="Predict"): one guess before playing; answer revealed after.
4. `.beat` (data-toc="Play"): `<h3>`, one-paragraph `.beat-intro` saying what you are looking at and what to try,
   then `<figure class="sim" id="<x>-sim"></figure>`.
5. `.beat.explain` (data-toc="Explain"): `<h3>What's going on</h3>`, 2–4 short paragraphs for everyone (≤ ~350 words),
   using live numbers from the sim via `<span data-live="key">`. Then
   `<details class="how">` "How it works" (the real mechanism, names, references), containing
   `<details class="maths">` "The maths" with three `.mstep` rows: **In words** → **With your numbers** (live values,
   `.calc`) → **In symbols** (`.eq` + `.sym` legend defining EVERY symbol). Maths must be followable by a non-mathematician.
   Chapters with no real maths may make "The maths" a worked calculation instead.
6. `.carry` (data-toc="Remember this"): `.big` number/phrase + `.lab` "Carry this forward" + one sentence. Use the table.
7. `.quiz` (data-toc="Check yourself") with exactly two `.q` questions (see markup in 07-memory.html).

## The simulation (makeSim)
- It is LIVE: it runs continuously and every input changes it in real time. Not a video, not step-through slides.
- One clear thing the learner controls, with 3–5 controls max (choice / range / toggle / button) and, where natural,
  direct manipulation via `click` (pick an item, break a GPU, select a token...).
- `goal`: one concrete target that requires understanding to reach (not just "press the button").
- `notices`: 5–8, ordered by priority, each reacting to a situation the learner created, explaining WHAT JUST HAPPENED
  and WHY, using the learner's own numbers. This is where most teaching happens. One sentence or two.
- `facts`: 1–2 fun facts, triggered by a related state, each with a reference (`ref: "#ref-N"`). Must be true,
  sourced, and tied to the concept. No trivia without a link to the idea.
- `tour`: 4–6 steps ("Show me") that set controls and narrate; the learner can take over any time.
- `warmup` so the scene starts already in motion and interesting. `publish` live values used by the text and maths.
- `stats`: 3–5 readouts with tones. Camera rects ≈ 2:1 for desktop, plus `camsNarrow` for phones (stage < 640px):
  on phones keep it simple, big and readable; hide minor labels when `sim.narrow`.
- Deterministic: use `s.rand`/the `rand` passed to init, never Math.random(). Time may be sped up; say so if it matters.
- Visual language: dark stage, thin outlines, rounded shapes, glow only on what's active, particles with trails for
  flows (k.flow / k.trail), teal = data, amber = compute/energy, red (k.C.crit) = failure. Sentence-case labels, no emoji.

## Content rules (strict)
- Plain language first. Define every term the first time (in a few words) before using it.
- **No name without an introduction**: a company/product/model appears only as an example of an idea, introduced once
  ("Meta, the company behind the open Llama models, ...").
- **No number without a comparison or meaning** (e.g. "120 kW, about what 40 homes draw"). Fewer numbers is better.
- Every factual claim must come from the legacy chapter text (already referenced) or a primary source you verify
  (WebSearch/WebFetch). Add new references in `src/refs/chNN.html` as
  `<li id="ref-NN01" value="NN01"><a href="URL">Title</a>. Publisher, year.<span class="tag">Paper|Docs|...</span></li>`
  using ids NN01–NN19 for your chapter number NN (e.g. ch 5 → ref-501…; ch 12 → ref-1201…). Cite as usual.
- Illustrative (made-up) numbers must be labelled as illustrative where shown.
- Style: short, direct sentences; no em-dash asides, no "not X but Y", no hype, no exclamation marks.
- Keep each chapter around 12–18 minutes total, including playing.

## Carry-forward table (big · sentence). Your recall question tests the previous row.
1 send — "Read, then write" · The model reads your whole prompt in one parallel pass, then writes the reply one token at a time.
2 tokens — "≈ ¾ of a word" · Models read tokens, not words; in English a token averages about three-quarters of a word.
3 predict — "One token at a time" · The model gives every possible next token a probability; sampling picks one, and the loop repeats.
4 attention — "Look back" · Each token looks back at earlier tokens and pulls in what's relevant; it never looks forward.
5 thinking — "Thinking costs tokens" · Reasoning models write hidden tokens before answering; more thinking buys accuracy with time and money.
6 multimodal — "Patches" · Images and sound are cut into patches that become token-like vectors, so one model can read them all.
7 memory — "128 KB" · Every token in play needs notes in GPU memory; memory decides how many people one GPU can serve.
8 batching — "One read, many people" · Each step reads all the weights once; batching shares that read across many conversations.
9 cost — "Busy, not too busy" · A reply's cost is GPU time; keeping GPUs well used without making people wait is the whole game.
10 production — "Canary first" · New versions go to a small slice of traffic first, watched closely, before reaching everyone.
11 datacenters — "≈ 1 kW per chip" · Each AI chip draws about a kilowatt and turns it all into heat; power and cooling set the limits.
12 data — "Most of the web is thrown away" · Training text is filtered, deduplicated and mixed down to trillions of good tokens.
13 learning — "Guess, measure, nudge" · Training repeats: predict, measure the error, nudge every weight slightly downhill.
14 scale — "6 × N × D" · Training compute ≈ 6 × parameters × tokens, spread over thousands of GPUs that must stay in step.
15 assistant — "Shown, then judged" · Examples teach the format, preferences teach what's better, and a leash keeps the model close to where it started.
16 agents — "A loop with tools" · An agent is a loop: the model asks for a tool, the harness runs it and adds the result to the context.
17 security — "Text can be an instruction" · Models can't reliably tell instructions from data, so anything an agent reads can try to steer it.

## Checking your work (required, iterate until good)
1. `cd /home/claude/ai-under-the-hood && python3 build.py`
2. Screenshots, desktop dark and phone light, with actions that exercise the sim:
   `python3 /tmp/claude-0/-home-claude-ai-under-the-hood/9f7e82d3-ea99-5405-a9bf-d9eb69cc2336/scratchpad/simshot.py <chapter-id> <sim-id> 1280 dark 4 "shot:a,set:<control>=<value>,wait:5,shot:b,tour,wait:20,shot:c"`
   (actions: `set:id=value`, `click:<control-id>` for button controls, `tour`, `wait:N`, `shot:name`).
   Images: scratchpad `sim-<sim-id>-<name>-<width>-<scheme>.png`. LOOK at every one with Read. The script prints
   console/page errors: there must be none.
3. Also screenshot the whole chapter page at 1280 and 390 (write a tiny Playwright snippet or reuse simshot) and
   read the text as a beginner: is every term defined before use? Any number without meaning? Any wall of text?
4. Fix and repeat. Quality bar: a polished interactive explainer (think Bartosz Ciechanowski / Nicky Case) where a
   beginner can figure out what is happening just by playing.

## Report back (short)
Files created/changed; for each chapter: the sim's controls, goal, notices and facts (one line each); new references;
claims you're unsure about; any engine limitation you hit (don't edit sim.js/kit.js/core.js/styles.css; if you
truly need a style, put a small `<style>` scoped with your chapter id at the top of your chapter HTML).
