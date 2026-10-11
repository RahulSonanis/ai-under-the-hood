# Review round 2 — reviewer 1 (start, send, tokens, predict, attention, thinking, multimodal, memory, batching, cost)

## start
- [x] [minor] start · hero sim, "read" phase · while the amber reading wave runs, "tokens in play · 0 read + 0 written" and stat "passes through the model 0" (at 390 and 1280) contradict the notice "The model reads all 6 tokens at once…" · count the reading pass as in progress: "tokens in play · reading 6…" and passes "1 (reading)" during the read phase.
- [x] [minor] start · hero sim 1280, write phase · flying reply-token labels ("·sunli", "ght") pass over "the model's layers" and "picked: ght" labels and over the "slow motion…" note at the bottom of the back path · start the back flight below the odds column / move "slow motion" note to top-centre.
(A1–A5, A40 verified: text travels as text, tokenizing in datacenter, 1 + 23 = 24 passes, map links/titles match h2s, no console errors.)

## send
- [x] [major] send · busy slider at 95% (A10 regression) — FIXED by lead: shed only when ≥12 waiting, 50% of those arrivals · load shedding drops (ρ−0.85)×4 = 40% of arrivals at 95% (20% at 90%), so the effective load falls to ~57%: at 95% the line is EMPTY (screenshot: "Line · empty", 0 waiting) while at 85% it has 2–3 waiting. This contradicts the text ("at 95% it is over a second"), the "busy" notice (which prints 60 ms·ρ/(1−ρ) = 1.14 s) and check question 2 ("about twenty times"). · Shed only when the line is already long (e.g. reject an arrival if s.q.length ≥ 12), which is also how real gateways shed, so the line still grows visibly at 90–95% but is capped; or shed a small fraction (≤5%).
- [x] [minor] send · 390, GPU camera · user-prompt token chips never appear: the "hidden instructions · 2,000 · cached" chip is measured in screen px / small scale, fills row 1 and overflows the GPU box's right edge; the "Summa / rise / +12,000 more" chips are dropped. Also "Reading all 12,000 new tokens at once" and "Also writing for 3 other people at the same time" run over the GPU box border; "Other copies of the model" clipped at top. · On narrow, shorten the chip ("hidden · 2,000") and allow 3 rows, or reduce chip font; wrap/shorten the status lines ("Reading 12,000 new tokens").
- [x] [minor] send · follow-up (Press send) · the screen shows the same message bubble "Summarise this 20-page report." and the same reply, and the GPU chips show no chip for the ~200 new tokens, so a beginner can't see what the "follow-up" was · show a follow-up bubble (e.g. "And the main cause?") and a "+200 new" chip next to the cached ones.
(A6, A7, A8, A9, A11, A12 verified working: cache notice correct, goal reachable via follow-up (2.36 s → 272 ms), mini clock pinned on phone.)

## tokens
- [x] [minor] tokens · notice "out" (Hindi + "This text only") · says "it learned from just 42 words" for a 14–15-word sentence; L.words counts GPT-2 pre-tokenizer chunks, which split Hindi vowel signs off as separate chunks (stats at the same time say 4.2 tokens/word → 15 words) · use words(s) (whitespace words) in the notice, or say "42 chunks".
- [x] [minor] tokens · 390, "What the model receives" · with strawberry text the "·strawberry" chip is squeezed to an unreadable font; the vector line "row 257: −0.29 … −0.17 …" runs under the embedding-table graphic · allow the chip to grow/wrap, cut the vector to 3 numbers on narrow.
- [x] [minor] tokens · 1280, embedding table · "21 merges" label sits on the highlighted "row 262" line when the selected row is near the bottom · offset the merges label when the highlight is within ~12 px.
(A19–A24 verified: 14 words gloss, hex explained (e0 = 224), strawberry caveat in goal/notice/tour, "times found" header, "700 (675 learned)" clamp, ~1,850-word note.)

## predict
- [x] [minor] predict · 1280, Read old / Read new · the text panel's legend still reads "red underline: a word pair it never saw · amber: repeating itself · blue: your pick" while the words are now tinted amber/teal by surprise (amber = high surprise), so the legend contradicts what is shown · in read modes switch the legend to "amber: surprising word · teal: expected word".
- [x] [minor] predict · How it works › "Your tiny model" · "The last two give every word a small chance" reads as "the last two words" right after "what followed the last two words" · "The last-word odds and the overall word counts give every word a small chance…".
- [x] [minor] predict · 1280 controls · temperature value "0 · always the top word" wraps onto two lines under the label · shorten to "0 · greedy" or "0 · top word".
(A29–A38 verified: top-k off samples all 155 words ("142 rare words" slice), goal reachable at T 1.5 with top-p 0.6 or top-k 4 (40/40), "0% at T=0" labels, surprise scale "0 / 4.6 / 5.0", Read new clears the page, write-mode maths no longer calls shaped p "surprise".)

## attention
- [x] [minor] attention · 390, "Show the numbers" on, Previous head · the word "because" collides with its score ("because12.00") in the word / q·k column · narrow the word column or right-align scores with a min gap; truncate long words ("becau…").
- [x] [minor] attention · 1280, numbers on · the column header "stream after: animal · street" sits directly under the 94% street bar and touches it · move it down to the first layer row or add 6–8 px gap.
- [x] [minor] attention · How it works › "Your toy model" · "That first Transformer read in both directions" — the 2017 Transformer was an encoder–decoder; only its encoder (where the tired/wide picture comes from) read both ways · "The picture came from the part of that first Transformer that reads in both directions (the encoder); a model that writes left to right…".
(B1–B7 verified: numbers hidden by default, goal shows "decision at last word: street 94% · selected word", softmax/MLP/parameter defined, "Query strength (pickiness)" + √d text and Q2 reworded, previous-token/coref heads cited.)

## thinking
- [x] [minor] thinking · 390, question panel · the hard question is cut off mid-sentence ("…leaves remainder 1 when divided by 2, 3, 4,") and the budget bar's label "8,900 hidden tokens" runs past the panel's right edge · allow 3 lines for the question on narrow (or shrink font); put the token count under the bar on narrow.
- [x] [minor] thinking · stat "cost per 1,000 questions" · large values print without a thousands separator ("$1295.79") while every other number in the course uses commas · format with toLocaleString ("$1,295.79"); consider rounding to whole dollars above $100.
(B9, B10, B11, B12, B13 verified: 4 × (8,000 + 120) = 32,500 tokens; wait 54 s = longest attempt; visible working-out of wrong attempts is plausible ("60 … back up … n = 61"); vote notice prefixed "Last question (digit sums)"; budget_tokens wording matches current Anthropic docs (target, min 1,024, adaptive thinking + effort). Goal reachable (8/10 at 8k × 16, 54 s).)

## multimodal
- [x] [major] multimodal · "Actual size" close-up vs verdict (B18 only partly fixed) · at 224 px the close-up says "blurry, a guess" (letters 7.6 px) yet "TAKE 2 DAILY / WITH FOOD" is clearly legible on screen, and it looks the same as 256 px ("readable", 8.7 px). The learner sees no difference at the threshold the goal depends on. On 390 the close-up is not actual size at all (the 896 px "readable" close-up is shrunk to ~90 px and "WITH FOOD" is illegible, contradicting "one pixel the model gets is one pixel on your screen"). · Render the close-up from the downsampled bitmap and magnify it with nearest-neighbour (e.g. "magnified 3×, pixels as the model gets them") so pixelation is visible below ~8 px; base the verdict on the small "WITH FOOD" line, and drop the "one pixel = one pixel" sentence or keep it true only on wide screens.
(B19–B23 verified: no clipped captions at 1280, "token 300: budget ends" anchored to the 300th cell (incl. with voice note after the animation), "4,096 picture tokens, first 400 drawn", budget explained, 28×28 / 1,296-token and 100–600 images facts match Anthropic's current vision docs, Whisper front-end wording.)

## memory
- [x] [minor] memory · notice "wasteR", tour step 2, sim label, How it works › "Booking the maximum" · all say "pale striped squares", but in dark mode the reserved-empty squares are dark hatched and on 390 (C5 fix) they are solid dark tints, never pale · say "the dim, hollow squares (booked but empty)" or whatever single description fits both themes and widths.
- [x] [minor] memory · Predict answer "two to three times as many here" vs the sim at default 3 people/s: reserve shows 30 chatting + 7 waiting, paging 34–36 chatting; arrivals, not memory, limit paging, so the learner never sees 2–3× · add to the paging notice/tour: "raise New people per second to 8 to see how many fit" (or make the tour set rate 8 when switching to paging).
(C1–C8 verified: vLLM introduced, speed-not-modelled note, too-long document bounced with a "context length exceeded" notice and a turned-away counter, byte comparisons, 128 KiB (≈131 KB) once, prefill shown as instant; 600 squares × 128 MiB ≈ 80 GB consistent.)

## batching
- [x] [minor] batching · notice when notes dominate (64 people × 8k, 4-bit) · "Smaller weights barely help here" appears at the very moment the goal is reached only BECAUSE 4-bit weights freed the last seats (8-bit: 81/80 GB, 1 person unseated; 4-bit: 77/80 GB, goal reached) · "Smaller weights barely speed this step up now, but they free memory for more seats."
- [x] [minor] batching · 1280 stage · "needs 89 GB of 80 GB" sits on the memory box's bottom border; "maths 2.3 ms" label is crossed by the white step-progress tick at the end of the reading bar · move the overflow label below the box (where "16-bit numbers" is) and offset the bar labels to the right of the tick.
(C9–C16 verified: "Refill" label, Predict "roughly 40 times", prefill-not-included footnote, attention sums in t_sums, "≈1,000 replies" scale, single overflow figure, chunked-prefill paragraph, "dense" 989 T and W8A8 wording. Goal reachable (64 seated · 32 tok/s · $0.40 with 4-bit).)

## cost
- [x] [minor] cost · overload (fixed 8 GPUs) · stage label "2689k gave up today" (raw k-format) while the notice says "2,680,253 failed today" · format as "2.7 million gave up today".
- [x] [minor] cost · overload · stat "per 1,000 replies today" shows $0.32 in green (good) while 96% of people fail; goal progress also shows $0.32 · colour the cost stat neutral/red when the failed share is ≥ 1%, or add "(only 4% served)".
- [x] [minor] cost · 390, fixed 30 GPUs at ~14:40 · stage says "nobody queued" while the "steep" notice says "The unluckiest 1 in 100 now wait 52 s" (formula-based p99 vs simulated queue of 0) · derive the notice's wait from the same queue model as the stage, or phrase it as "would wait up to 52 s at this fullness".
- [x] [minor] cost · 1280 overload · the "overloaded" badge covers the end of the chart title ("How long the unluckiest 1 in 100 w…ts") · place the badge inside the plot area below the title.
- [x] [minor] cost · goal tuning · goal is reachable but only in a narrow band: autoscale 50% + batch jobs → $0.32, 0.00% (reached); 60% → 1.60%, 65% → 2.08%, 75% → 2.53% failed; fixed 40 + batch → 2.64%. Nothing tells the learner the 11:00 spike is what breaks 60–75% · add to the dayEnd "too many waited" notice: "most of them during the 11:00 spike: new GPUs take 10 minutes to start, so lower the target to keep headroom."
(C17–C25 verified: cost counts served replies (overload $0.32 > $0.26 floor), 60 s give-up with failed counter and "failed or waited 5 s+" stat, goal and chart use the same 1-in-100 measure, autoscaling/Erlang C/headroom defined, chapter-1 link, batch-API wording, 390 shows the traffic chart.)

## Verdicts
- start: ready (two cosmetic counters).
- send: needs the load-shedding fix (95% busy currently shows an empty line, contradicting text and check question 2); rest minor.
- tokens: ready (minor wording/overlaps).
- predict: ready (fix the read-mode legend).
- attention: ready (minor overlaps at 390 with numbers on).
- thinking: ready (390 question clipping, $ formatting).
- multimodal: needs the close-up to visibly show the 8-px threshold (verdict "blurry" while the label is legible; not actual size on phone).
- memory: ready (pale/striped wording; Predict 2–3× not visible at default arrival rate).
- batching: ready (one contradictory notice, two label overlaps).
- cost: ready (formatting, green cost during overload, goal hint for the spike).

## Cross-chapter
- [x] [minor] all · goal pill at 1280 (lead: engine CSS, grid layout) when the goal text wraps to two lines (predict, batching, cost) · the status dot detaches and sits on the pill's top-left border, and the pill becomes a huge rounded blob · align the dot with the first text line (flex-start + top margin) and use a smaller border-radius once the pill wraps.
(No console errors in any of the 10 chapters at 1280 dark or 390 light with all controls exercised; no horizontal overflow at 390 with all details open.)
