# Fix list C — ch7 memory, ch8 batching, ch9 cost
Files: src/chapters/07-memory.html 08-batching.html 09-cost.html, src/js/ch07-memory.js ch08-batching.js ch09-cost.js, src/refs/ch08.html ch09.html

## ch7 memory
- [ ] C1 [major] Introduce vLLM ("an open-source serving program from UC Berkeley"); define GPU in the main text.
- [ ] C2 [major] Constant 150 tok/s per conversation regardless of how many share the GPU contradicts ch8 → label "speed not modelled here; chapter 8 shows how sharing slows each person", or derive from ch8 step-time.
- [ ] C3 [major] "Book the maximum" line grows without limit; a document longer than the max is skipped silently → bounce it visibly with an error ("too long for this server", like real "context length exceeded"); cap/time out the waiting line.
- [ ] C4 [minor] Mark the 30k document's squares ("30k document") so tour step 5 is followable; tour "line on the left" → name it.
- [ ] C5 [minor] Phone: striped "reserved but empty" squares indistinguishable → solid tint; "9 waiting" overlays grid.
- [ ] C6 [minor] Byte comparisons: "128 KB ≈ a short email; 80 GB ≈ 20 HD films"; "parameter" defined.
- [ ] C7 [minor] Carry-forward "128 KB" → "for Llama 3 8B (other models differ)"; "In words": 8 key-value heads (32 query heads share them in groups of 4); "128 KiB (about 131 KB)" once.
- [ ] C8 [minor] Say prefill is shown as instant.

## ch8 batching
- [ ] C9 [major] "Refill the seat" truncated to "Refill the s" → shorter label "Refill".
- [ ] C10 [misleading] Predict option "total output rises roughly 60 times" → "roughly 40 times" (sim default 1k chats).
- [ ] C11 [major] Cost per million tokens counts decode only → footnote "prefill not included"; add attention FLOPs (≈4·L·d·ctx per token) to t_sums or note "ignores attention sums, small at these lengths". Maths: "÷ 495 trillion a second (50% of 989)".
- [ ] C12 [major] Cost unit: add human scale ("a million tokens ≈ 1,000 replies") and use per 1,000 replies alongside to match ch9.
- [ ] C13 [minor] Overflow shows three numbers (1040 / 1100 / 1120 GB) → one figure.
- [ ] C14 [minor] Explain "8k", tick mark on "One step" bar, legend clipped "red = no memor…"; gloss BF16/FP8/roofline.
- [ ] C15 [minor] One paragraph: a long prefill joining the batch stalls everyone's next token; chunked prefill.
- [ ] C16 [nitpick] "989 trillion 16-bit sums a second (dense)"; FP8 paper tested weights AND activations (W8A8).

## ch9 cost
- [ ] C17 [blocker] Overload: cost per reply counts arrivals not served replies (drops below floor, turns green). Count served replies.
- [ ] C18 [major] Queue never sheds (20-hour waits). After ~60 s waiting, count as failed/turned away; add error-rate stat; goal "fewer than 1 in 100 failed or waited over 5 s".
- [ ] C19 [major] Goal says "1 in 100 waiting over 5 s" but chart/stat show "unluckiest 1 in 20" → same measure.
- [ ] C20 [minor] Define autoscaling where first used (Predict answer); Erlang C ("engineers' formula for a line with many seats"), headroom.
- [ ] C21 [minor] Clock vs hour counter disagree in tour; "1 new GPUs are starting" grammar; speed buttons 1×/4× vs 1×/3× elsewhere.
- [ ] C22 [minor] 390: chart outside visible stage; stat text awkward "1 in 20 waits longer than · under 1 s".
- [ ] C23 [minor] Batch jobs pausing mid-reply lose KV work or are swapped out (preemption, ch7) — half sentence.
- [ ] C24 [minor] Link to ch1's line: "Remember the line in chapter 1? Here's the many-seat version: waits stay near zero until ~85% busy, then explode." Maths: W formula is exact for M/M/c; approximation = exponential seat time; rename c → P_wait.
- [ ] C25 [nitpick] Batch API: "results come back within 24 hours (most batches in under one)".
