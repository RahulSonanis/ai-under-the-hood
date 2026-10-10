# Fix list B — ch4 attention, ch5 thinking, ch6 multimodal
Files: src/chapters/04-attention.html 05-thinking.html 06-multimodal.html, src/js/ch04-attention.js ch05-thinking.js ch06-multimodal.js, src/refs/ch05.html ch06.html

## ch4 attention
- [ ] B1 [major] Too much on screen for beginners (q·k table, MLP boxes, "stream after", L1–L4). Hide stack details and q·k columns behind a "Show the numbers" toggle (default off; keep arcs, percentages, animal/street odds).
- [ ] B2 [major] Goal status confusing: show "decision at last word: street 94%" separately from the selected word.
- [ ] B3 [major] Define softmax (in plain words), MLP ("a small network that processes each word on its own"), parameter ("a learned number") in the main text.
- [ ] B4 [major] "Vector length" slider scales query magnitude but text ties length to d/√d → rename "Query strength (pickiness)"; text: "√d keeps scores steady as vectors get more numbers"; reword check question 2.
- [ ] B5 [minor] Overlapping labels: 390 "it"/"living thing"; 1280 "query of 'it'" clipped when head = Previous.
- [ ] B6 [minor] "double the text, four times the scores" → applies to reading the prompt; writing with stored notes is linear per token (link ch7). "Nothing before it moves" → "which is why servers can keep these notes (chapter 7)".
- [ ] B7 [minor] Maths: "Key of the word it attends to most"; where q,k,v come from (vector × learned W_Q,W_K,W_V); spread of dot product grows like √d.
- [ ] B8 [nitpick] ref-61 supports only the attention sink; add source for previous-token and coreference heads (Clark et al. 2019 "What Does BERT Look At?", arXiv 1906.04341) or move ref-61 next to "attention sink".

## ch5 thinking
- [ ] B9 [blocker] Token/cost count with several attempts counts the answer once: C = N·(T + a)·p; tokens shown must include all attempts' answers. Update maths box.
- [ ] B10 [major] Visible working-out contradicts wrong answers ("smallest number is 60" then "Answer: 31"). Wrong attempts need a plausible wrong path (e.g. "lcm guess: 30 → 31") or cut off before the key line.
- [ ] B11 [major] Vote notice refers to previous question → prefix "Last question (dominoes): …"; tie → "tie: the first answer wins".
- [ ] B12 [major] Live wait wrong: wait = longest attempt (max tokens)/speed + answer; show measured wait; define T as tokens of the longest attempt; "attempts barely change the wait (they run side by side thanks to batching, chapter 8)".
- [ ] B13 [error] budget_tokens claim outdated: → "budget_tokens sets a target (minimum 1,024); newer Claude models decide how much to think themselves, steered by an effort setting; thinking tokens are billed as output [ref-504]". Verify current docs wording.
- [ ] B14 [major] Speed consistency: 150 tok/s here vs ch1 ~45 tok/s vs ch9 30 tok/s — state why (different models/loads) or align; list price $10/M vs serving cost in ch9: one sentence "list prices are for big frontier models and include margin".
- [ ] B15 [minor] "about four times as efficient" → "more than four times as efficient as simply sampling many answers and picking the best [ref-502]".
- [ ] B16 [minor] Define compute (noun), percentage points; introduce AIME ("a hard US high-school maths contest"); write "2,100 tokens" not "2.1k tok"; reassure "you don't need to solve these".
- [ ] B17 [minor] Label accuracy curve "illustrative" in text.

## ch6 multimodal
- [ ] B18 [major] Close-up readability: at 224 px the label looks as crisp as at 256 px but verdict says blurry. Render the close-up at actual pixel size so blur is visible below ~8 px.
- [ ] B19 [minor] Clipped text at 1280 ("Close-up: label blurry, a guess at…", "← your words, then the picture a…"); budget marker anchored to the 300th cell; 896 px with 14 px patches smears → cap drawn grid ("4,096 tokens, first 300 shown").
- [ ] B20 [minor] 300-token budget explained as "a per-request budget your app sets to keep cost and latency down; real models accept far more".
- [ ] B21 [minor] One token per patch is ViT; many production models merge neighbouring patches (Claude's 28×28 ≈ 2×2 of 14 px) — one sentence.
- [ ] B22 [minor] Images/audio are pure prefill load; providers cap image size/count — one line.
- [ ] B23 [nitpick] Whisper: "the encoder's convolutional front end halves that"; images often placed before or alongside text ("alongside the text"). "6 words" → "6 text tokens"; "down: the same" only for square pictures.
