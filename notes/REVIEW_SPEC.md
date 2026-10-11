# Reviewing "AI Under the Hood" v4

You are an independent reviewer of an interactive course website. Do NOT edit any project files and do NOT run git.
Report only. The site is built at /home/claude/ai-under-the-hood/docs/index.html (single page, hash-routed:
`index.html#<chapter-id>`). Source: src/chapters/*.html (text), src/js/ch*.js (simulations), references in
src/chapters/99-refs.html and src/refs/*.html.

Chapter ids in order: start, send(1), tokens(2), predict(3), attention(4), thinking(5), multimodal(6), memory(7),
batching(8), cost(9), production(10), datacenters(11), data(12), learning(13), scale(14), assistant(15), agents(16),
security(17), company(18 finale), next.

What the course promises: a course you PLAY. Each chapter: a question → predict → one live simulation the learner
drives (controls change it in real time; goal; "what just happened" notices; fun facts; "Show me" tour) → a short
explanation for everyone with optional "How it works" and "The maths" (words → your numbers → symbols) → one thing
to remember → two check questions. Audience: curious beginner to engineer. Rules: plain language, every term defined
before use, no company/product name without an introduction, no number without a comparison or meaning.

## How to experience a chapter (do this, don't just read source)
- Screenshots of the sim while you play: `python3 /tmp/claude-0/-home-claude-ai-under-the-hood/9f7e82d3-ea99-5405-a9bf-d9eb69cc2336/scratchpad/simshot.py <chapter-id> <sim-id> <width> <scheme> <seconds> "<actions>"`
  actions: comma list of `set:<control>=<value>` | `click:<control>` | `tour` | `wait:N` | `shot:name`.
  Control ids: see each sim's `controls` array in src/js/chNN-*.js; sim id = the `<figure class="sim" id=...>`.
  Output: scratchpad `sim-<sim-id>-<name>-<width>-<scheme>.png` — open them with Read.
- Whole page (all details opened): `python3 .../scratchpad/pageshot.py <chapter-id> <width> dark|light <wait-seconds>`
  → `page-<id>-<width>-<scheme>.png` and `view-<id>-...png`. Large images: crop with PIL before reading.
- Read the chapter HTML text directly too.
- Use phone width 390 for at least some chapters.

## Report format (concise, concrete, prioritised)
For each chapter: up to ~8 findings, each tagged [blocker | major | minor], with the exact place (control, label,
sentence) and a specific suggested fix. Then a 2–3 line overall verdict for the chapter. End with cross-chapter
issues (repetition, inconsistencies between chapters, missing links in the story) and your top 5 fixes overall.
Skip praise except one line per chapter on what works.
