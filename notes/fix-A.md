# Fix list A — landing (start), ch1 send, ch2 tokens, ch3 predict
Files: src/chapters/00-start.html 01-send.html 02-tokens.html 03-predict.html, src/js/ch00-start.js ch01-send.js ch02-tokens.js ch03-predict.js

## start (landing hero sim)
- [ ] A1 [major] Hero shows tokens cut on "Your screen" and token IDs flying over the internet ("this is what really travels"). Wrong: text travels; tokenizing happens in the datacenter. Send text; split into tokens inside the datacenter; toggle help "what the model receives".
- [ ] A2 [minor] "24 written in 24 passes": the reading pass also writes the first token → say so (1 + 23).
- [ ] A3 [minor] Define "pass" ("one trip through the model"), "layers", and the "·" = space marker in the hero; add "(plus hidden instructions, see chapter 1)" to "6 tokens read".
- [ ] A4 [minor] "about 128,000 tokens" needs a comparison (≈ a 300-page novel… compute: 128k tokens ≈ 96k words ≈ a long novel).
- [ ] A5 [minor] 390: "slow motion…" label overlaps "the internet" label.

## ch1 send
- [ ] A6 [major] Cache-hit notice says "Reading your 14,000/27,000 tokens took 30 ms, all in one pass" → "12,000 of your 14,000 tokens were already cached; only N new tokens were read (30 ms)."
- [ ] A7 [major] Cache model: a follow-up adds ~200 uncached tokens (previous reply + new question); cache expires after a few minutes; mention routing to the same copy (affinity). Keep the goal reachable.
- [ ] A8 [major] Goal hint after first failed try with the long report: "Try sending again: the server may remember the start."
- [ ] A9 [major] Queue: say it's a single-line simplification that chapter 9 refines (many seats keep waits near zero until ~85% busy). Maths: show the learner's sampled wait AND the average (publish already has `wq`): "line: {qwait} (average at {busy} busy = {wq})".
- [ ] A10 [major] On-call: at ≥90% busy, the gateway turns some requests away (429 "overloaded"); one "How it works" paragraph on rate limits, timeouts and retry storms.
- [ ] A11 [major] Phone: keep a mini clock (time to first word) pinned when the camera follows the request into the GPU; clock legend cropped ("wri…").
- [ ] A12 [minor] T_first formula counts first token twice (adds t_tok after t_read) → reading pass produces the first token.
- [ ] A13 [minor] "30-page report" = 12,000 tokens is wrong (30 pages ≈ 20k tokens) → "a 20-page report" or ~20k tokens.
- [ ] A14 [minor] Thinking: "hundreds of hidden tokens" → "hundreds to thousands" and label the 300 illustrative.
- [ ] A15 [minor] Prefill time linear: label "linear approximation; very long prompts grow faster" and one sentence that a long prefill slows others (chunked prefill).
- [ ] A16 [minor] Define HTTPS, server-sent events, M/M/1 ("engineers' name for a single-line queue"), GPU; label gateway/safety arches ("ID check", "content check"); "Your screen" reply text in sans font.
- [ ] A17 [nitpick] ref-70 title → "Using the Messages API". "With most chat APIs, the whole conversation is sent again; some keep it on the server [ref-73]".
- [ ] A18 [minor] Show nout in the maths third equation (T_all with learner's numbers).

## ch2 tokens
- [ ] A19 [error] Hindi gloss "(15 words in English)" → "(14 words in English)".
- [ ] A20 [major] Hex bytes "e0 a4 ae" unexplained → show decimal or add "bytes written in a short code called hex; e0 = 224".
- [ ] A21 [major] "strawberry" becomes one token because the toy corpus is strawberry-heavy: say so in goal/tour ("In real tokenizers like GPT-4's it is ~3 tokens").
- [ ] A22 [minor] Merge-count label overlaps ID numbers at 1280; "What the model receives" overlaps "Embedding table" label at 390 (clipped "table · 316 rows"); empty band at 390.
- [ ] A23 [minor] Tour step 2 "list on the right… pieces on the left" → name panels.
- [ ] A24 [minor] "×22" column header "times found"; slider label clamp to merges actually learned ("700 (675 learned)"), and in "This text only" mode show the real vocabulary.
- [ ] A25 [minor] Note training text is only ~1,850 words (why "weather" stays split).
- [ ] A26 [minor] How it works: special tokens/chat-template role markers are tokens too; counting happens on the server (limits and bills).
- [ ] A27 [minor] Maths: pairs never cross a word boundary; cm can be less than count(a,b) for self-overlapping pairs.
- [ ] A28 [nitpick] BPE for language 2015 vs ref-4 2016 — pick one (2016, ACL).

## ch3 predict
- [ ] A29 [major] "Top-k off" still truncates to top 20 (TOPN). Sample over the full vocabulary when off, or label "20 (simulation limit)"; maths: "(the simulation keeps the top 20)".
- [ ] A30 [major] Goal wording jargon → "Write 40 words without any made-up word pairs (red underlines) and few repeats".
- [ ] A31 [major] Tour step 4 promises "varied, without the nonsense" while nonsense shows → "much less nonsense".
- [ ] A32 [major] Greedy "goes round the same loop for ever" → "small models loop quickly; large ones loop less but drift into repetitive, bland text".
- [ ] A33 [major] Write-mode maths uses shaped p of sampled word as "surprise" → show "chance after shaping" and hide surprise in Write mode (surprise is for Read-new/study mode). Loss formula conditional: −(1/N) Σ ln p(x_t | x_1…x_{t−1}).
- [ ] A34 [minor] "cut" labels at T=0 → "0% at T=0"; keep "cut" for top-k/top-p.
- [ ] A35 [minor] Dice notice vs strip mismatch → notice describes the newest roll ("Last roll: …").
- [ ] A36 [minor] Surprise scale: "0 = no surprise; 4.6 = a 1-in-100 guess; random guess among 155 words = 5.0".
- [ ] A37 [minor] Define neural network, long tail, miscompiled; "rolls a die".
- [ ] A38 [minor] "Read new" should clear the text or show a divider.
- [ ] A39 [nitpick] Fallback sentence: it mixes in last-word-only and overall frequencies on every step (interpolation), not only for unseen pairs. T=0: "tiny numeric differences can still make replies differ".
- [ ] A40 [error] Landing map: broken `#finale` link → `#company`; sync map questions with chapter h2s (6, 9, 11, 17, 18); "About 4 to 5 hours"; "12 to 20 minutes"; define GPU in the hero paragraph.
