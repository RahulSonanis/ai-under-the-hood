# End-to-end learner test — "AI Under the Hood" v4

Persona: curious beginner (no ML / hardware background), whole course in order.
Promise tested: "by the end you have an end-to-end picture of how AI assistants work and what it takes to serve them."
Method: read each chapter's built text (incl. How it works / The maths), played each sim with simshot.py, answered recall + checks before peeking.

## One-line learning log (what I could say after each chapter)

- start · The course map: four parts (answering, serving, origins, around the model) + finale; I know the order and that sims are simplified.
- send (1) · A message is a request carrying the whole conversation + hidden app instructions; crosses internet → gateway → safety → queue → GPU; prefill reads all tokens in one pass, decode writes one token at a time; wait = trip + line + reading (+thinking); line explodes as ρ/(1−ρ); a follow-up reuses cached "notes".
- tokens (2) · Text → bytes → BPE merges → token IDs → embedding rows (vectors); ~¾ word per token in English; other languages cost more; special tokens + chat template count; billing/limits are in tokens.
- predict (3) · Model outputs a probability for every token (logits → softmax); sampler (temperature, top-k, top-p) rolls the die; loop; loss = average surprise −ln p; fluent guesses are why models make things up.
- attention (4) · Each token makes query/key/value; softmax shares; causal mask (only looks back); heads + layers + MLP; weights = parameters; reading cost grows with length²; K/V are the notes servers keep.
- thinking (5) · Reasoning models write hidden thinking tokens (billed as output, add wait); helps hard problems then plateaus; parallel attempts + vote; trained with RL on checkable answers.
- multimodal (6) · Images cut into patches → one token-like vector each (via encoder + adapter); 2× resolution = 4× tokens; audio = 1 token / 20 ms; only adds to prefill.
- memory (7) · KV cache = per-token notes (128 KB/token for Llama 3 8B); GPU memory, not maths, caps concurrent users; paging (vLLM) and prefix sharing; too-long requests rejected ("context length exceeded").
- batching (8) · Decode is memory-bandwidth-bound (weights read every step); batching shares the read; long chats' notes erode it; quantisation (8/4-bit) halves/quarters reads; continuous batching, chunked prefill.
- cost (9) · Reply cost = GPU-hour ÷ replies served; empty seats waste money, full seats explode waits (≈85%); diurnal traffic, spikes, autoscaling lag (minutes), headroom filled with discounted batch jobs; output > input > cached input in price; energy per reply.
- production (10) · Changes cause most incidents; canary (small slice, compare to control) + rollback (old version kept warm); watch errors, speed AND a quality check; slice must cover every chip type; SLOs/error budgets/paging on-call; Anthropic Aug-2025 postmortem.
- datacenters (11) · Each AI chip ≈ 1 kW, all of it becomes heat; liquid cooling for 120 kW racks; PUE = site ÷ IT power; power (grid connections take years) limits cluster size; failures show as throttling/latency; N+1 redundancy.
- data (12) · Knowledge source = filtered web crawl (Common Crawl → FineWeb): extract text, language ID, quality rules + classifier, MinHash near-dedup, PII masking, then a mix chosen by small-model ablations; contamination checks.
- learning (13) · Training loop: predict, loss, gradient via backprop, nudge weights (Adam); learning rate too big diverges; held-out loss detects memorising; training ≈ 6 ops/param/token vs 2 to use.
- scale (14) · Compute ≈ 6·N·D; Chinchilla ≈ 20 tokens/param but small models over-trained because serving is cheaper; 16 bytes/param to train; data/tensor/pipeline parallel; a failure every ~3 h on 16k GPUs → checkpoints.
- assistant (15) · Base model → SFT on example chats → reward model from preference pairs → RL with KL "leash" (reward hacking/flattery otherwise); evals need many questions, paired comparison, beware contamination; red-teaming.
- agents (16) · Agent = model in a harness loop; tool calls are structured text; context window is the budget; every call re-reads everything (≈ quadratic); RAG/search, compaction, prompt caching (0.1× read, 1.25× write, 5 min); MCP; timeouts/idempotency/step budgets.
- security (17) · Prompt injection (direct/indirect), jailbreaks; layered defences (marking, allowlists, confirmation, detectors) that don't fail independently; interpretability features; hallucination from once-seen facts + tests rewarding guesses.
- company (18) · Finale: choose size/data/testing/price, then run a launch day (pods, 8-bit, canary, filter, load-shedding); every decision lands as GPU time, waiting, quality or risk.
- next · Build-it-yourself projects per chapter; good bridge to practice but adds no new concepts.

## Gap checklist

- [x] [major] cost · The course never bridges its two price scales: ch9 serves an 8B model at ~$0.26 per 1,000 replies, while ch5 (and later chapters) use $10 per million output tokens (~$10 per 1,000 replies). A beginner can't say what a reply "actually costs" for a frontier assistant. · Add 2 sentences in ch9 "What's going on": a frontier model is ~10–100× more weights (and needs many GPUs per copy), so the same arithmetic gives cents-not-fractions per 1,000 replies, and list prices add margin, R&D and training cost on top.
- [x] [minor] send · Ch1 says "after the first word, the writing pace barely changes", but ch8 shows each person slows as the batch fills and long chats slow every step. · Add "(on a moderately busy server; chapter 8 shows when it does slow)" to the ch1 sentence.
- [x] [minor] thinking · The thinking sim's "Attempts in parallel" claims the wait barely grows, but ch8 shows a bigger batch slows each person and ch7 says each attempt's notes take scarce memory. · One clause: "...as long as the GPU has memory for every attempt's notes (chapter 7)".
- [x] [minor] memory · The chapter title promises "slower and pricier" but the pricier mechanism for users (every turn re-sends and re-bills the whole conversation as input, only partly discounted by caching) is in ch1's How-it-works, not here. · Add one sentence to "What's going on": "You pay too: each new message re-sends the whole chat, billed as input tokens unless it is cached."
- [x] [major] data · Knowledge cut-off is never taught. A beginner can't explain why the model doesn't know last week's news, or why it confidently describes something outdated. · Add to ch12 "What's going on": "The crawl is a snapshot, so a model knows nothing written after its training text was collected (its knowledge cut-off). Newer facts only reach it if a tool pastes them into the prompt (chapter 16)."
- [x] [major] learning · The course never says where the knowledge ends up. Ch14's recall marks "copies facts into the model" wrong but nothing states the right picture: facts survive only as patterns spread across billions of weights, nudged to predict text, not as stored documents to look up. That is the key to "why can it make things up". · Add 2 sentences to ch13 "What's going on" (or ch12's Carry this forward): "To predict 'The capital of France is…' well, the weights must come to encode that fact. Knowledge is a lossy compression spread across the weights, not a library the model can check, so a rare fact can be blurred or missing."
- [x] [minor] agents · RAG and search are taught as ways to save context, but never as the main fix for missing or out-of-date knowledge and for made-up answers (grounding the reply in pasted sources). · One sentence in ch16 RAG paragraph plus a back-link from ch17 "Why it makes things up": "Pasting real sources into the context (chapter 16) lets the model quote rather than recall, which cuts made-up answers."
- [x] [major] production · No single place teaches what an on-call engineer watches. The signals are scattered: TTFT and time per output token (ch1), 429s and shedding (ch1), queue and p99 wait, seat use (ch9), GPU memory or KV-cache fill (ch7), errors, speed, quality and thumbs-down (ch10), latency from thermal throttling (ch11), cache hit rate (ch16). · Add a short "What's on a real dashboard" list to ch10 How it works that names these 8–10 signals with the chapter each one comes from. Or end the finale with a tour step that points at each panel and names its real-world metric.
- [x] [minor] memory · "Memory" means two different things: capacity in ch7 (how much fits) and bandwidth in ch8 (how fast weights are read). Ch7 says "memory, not maths" and ch8 says "limited by memory", which reads to a beginner as the same claim. · In ch8 "What's going on", add: "Chapter 7's limit was memory space; this one is memory speed. Both are memory, and both beat the maths."
- [x] [minor] datacenters · The ch11 sim's "Serve people" counts 10 conversations per chip (illustrative), while ch8 and ch9 seat 64 per GPU. The gap is never explained (a bigger model, split across GPUs, seats fewer per chip). · Add to the readout help: "fewer than chapter 9's 64 seats because a frontier model is far bigger than the 8B model there and is split across many chips".
- [x] [minor] company · Contradiction: ch11 teaches that a cooling fault first shows as throttling, slower replies and a latency jump, with N+1 spares to absorb it. The finale's bullet says "When cooling fails, chips must shut down." · Reword the finale bullet: "When cooling fails, chips throttle and then shut down, so pods go missing (chapter 11)".
- [x] [minor] company · Illustrative constants drift between chapters: $3/GPU-hour (ch8, ch9) vs $2 (finale); 50% useful maths (ch14) vs 40% (ch11, finale). Each is labelled illustrative, but a careful learner notices. · Use one GPU-hour price and one utilisation figure throughout, or add "(cheaper here because pods are reserved in bulk)" in the finale.
- [x] [minor] company · The finale's jailbreak event says "post-training teaches the model what to refuse (chapter 15)", but ch15 never shows refusal or safety training. Its examples are helpfulness only, plus one red-teaming sentence. · Add one sentence to ch15 "Judged": "The same preference training also teaches refusals: raters (or written principles, Constitutional AI) prefer a safe decline to a harmful answer."
- [x] [minor] send · Ch1's path has "a quick safety check screens the message", but ch17's detectors (Constitutional Classifiers) are never linked back to it. · In ch17 Detectors add "(the safety check in chapter 1's path is one of these)".
- [x] [minor] multimodal · Chapters 6 (images and sound) and 5 (thinking) never appear again. The finale's events and the end-to-end check skip them, so they feel like side trips, though both are big cost drivers. · Add one finale end-to-end check: "A user sends a 4,000×3,000 screenshot and turns thinking on: which phases get longer and why?" (prefill from ch6, hidden decode from ch5). Or make the viral post include images.
- [x] [minor] thinking · Ch5 How it works uses "reinforcement learning", "rewarded" and "trained" before ch13 or ch15 explain training. · Add "(chapter 15 shows this kind of training)" after "reinforcement learning".
- [x] [minor] cost · The dollar price of input tokens is never stated. Ch5 gives $10 per million output tokens, and ch9 says output is 5× input, so a learner must derive $2 per million to cost a big pasted document. · State it once in ch9: "so input lists at about $2 per million tokens, and cached input at about $0.20".
- [x] [minor] cost · Busier also means slower writing, not only a longer line (bigger batches, ch8; ch1's sim slows ttok when busy). Ch9's explanation of peaks covers only queueing. · One clause in ch9: "and the people who do get a seat share each step with more others, so their words arrive a little slower too (chapter 8)".

## Contradictions and disconnected chapters (summary)

- Contradiction: a cooling fault means throttling and slower replies (ch11) but shutdown in the finale. Logged above.
- Unexplained mismatch: conversations per chip are 64 (ch8, ch9) vs 10 (ch11 sim). GPU-hour is $3 (ch8, ch9) vs $2 (finale). Useful maths is 50% (ch14) vs 40% (ch11, finale). Logged above.
- The price scales never meet: $0.26 per 1,000 replies (ch9) vs $10 per 1,000 replies list price (ch5) vs $2–15 in the finale. Logged as major.
- "Memory" means capacity in ch7 and bandwidth in ch8. Logged above.
- Weakly connected: ch6 multimodal and ch5 thinking, never used again. Ch13's toy curve fit connects to language models only through the word "loss", but it works because ch3 already defined loss. Ch19 "next" is a practice list, which is fine as an epilogue.
- The recall questions chain well, and every "From the last chapter" was answerable from the previous chapter. The finale's eight end-to-end checks were all answerable from the course. I got 8/8, and each explanation names the right chapters.

## End-to-end answers (using only what the course taught)

Key: **[well]** taught clearly, with numbers I could reuse · **[weak]** present but scattered, implicit or only in How it works · **[gap]** never taught.

### Finale questions (company)
All eight were answered correctly from course material: 50-page agent doc → re-reading plus KV notes; 99% busy → long waits and no headroom; smaller model on more text → cheaper to serve forever; canary despite good offline tests; harness limits beat prompts against injection; 8-bit → about half the cost per reply; editing the first message breaks the prefix cache; low loss on spam ≠ a good assistant. **[well]**. One weakness: none of the checks touches tokens, attention, images or thinking, so Part 1 is barely exercised by the finale **[weak]**.

### (a) A user pastes a 50-page document into a coding agent. What happens and what does it cost?
1. The app builds a request: about 30,000 tokens for the document (ch1: 20 pages ≈ 12,000 tokens), plus about 15,000 tokens of the agent's hidden instructions and tool descriptions, plus the chat so far. The whole thing is sent every turn **[well: ch1, ch2, ch16]**. If the paste is a PDF of page images rather than text, each page costs about 1,300 picture tokens (ch6: a 1,000 × 1,000 photo is 1,296 tokens) **[weak: ch6 never mentions documents or PDFs]**.
2. It goes over HTTPS to the gateway (auth, rate limits or 429), a safety check, then the queue. The request must fit the context limit or it is refused with "context length exceeded" (ch7). About 45k tokens fits a 200k window (ch16) **[well]**.
3. Prefill reads all about 45k tokens in one parallel pass. That is several seconds before the first word (ch1's illustrative 0.08 ms per token gives about 3.6 s). Attention's reading work grows with length² (ch4). Chunked prefill stops this from stalling everyone else on the GPU (ch1, ch8) **[well]**.
4. The KV cache holds about 45k × 128 KB ≈ 5.8 GB of notes for an 8B model, so fewer other people fit on that GPU (ch7). Each decode step also reads those notes, so writing slows (ch8) **[well for 8B]**. The course never gives the per-token note size or GPUs per copy for a frontier model **[gap, minor]**.
5. The agent loop: the model asks for a tool, the harness runs it and appends the result, and every call re-reads everything. Ten calls of about 45–50k tokens is about 470k tokens read (ch16) **[well]**.
6. Cost: input at about $2 per million (I had to derive this from ch5's $10 per million output and ch9's "output costs 5× input") **[weak]**. Uncached, that is about $0.95. With prompt caching, the first write is about 1.25× and later calls about 0.1× of the unchanged start, so roughly $0.20. Output (and any thinking tokens, ch5) is billed at 5× but is small. Compaction or search keeps the window small and the bill lower **[well: ch16, ch9]**. The provider's own GPU cost behind that price, and why list prices are about 40× ch9's serving floor, are **[gap → major item in cost]**.
7. Risks: a document can carry hidden instructions (indirect prompt injection, ch17). Facts in the middle of a long context are used less reliably (ch16, "lost in the middle") **[well]**.

### (b) Why can a company's AI be fast at 3 a.m. and slow at 3 p.m.?
- Demand follows people's day. Night is about ⅓ of the afternoon peak (ch9, ch11) **[well]**.
- Waiting grows like ρ/(1−ρ). Many-seat GPUs stay near zero until about 85% full, then explode (ch1, ch9). At 3 p.m. the seats are near full **[well, with the sim]**.
- Autoscaling lags because a new GPU needs minutes to load the model (ch9; about 25 min in the finale). Peaks and spikes outrun it unless headroom is kept **[well]**.
- Memory: at peak, the KV cache fills and new chats wait for a seat (ch7) **[well]**.
- Busier batches mean each step serves more people and reads more notes, so each person's words come slower too (ch8; ch1's sim shows it) **[weak: never tied to time of day]**.
- Overload protection: rate limits, 429 "try again" and load shedding (ch1, finale) **[well]**.
- Night capacity is filled with batch jobs that step aside for chats, so it isn't wasted (ch9) **[well]**.
- Users in other time zones spreading the peak, and routing to other regions or datacenters **[gap, minor]**.

### (c) Where did the model's knowledge come from, and why can it still make things up?
- From about 15T tokens of mostly web text: crawled, text extracted, filtered for language and quality, near-duplicates removed with MinHash, personal data masked, then mixed with code, maths and books (ch12) **[well]**.
- It is absorbed by next-token prediction: loss, gradient, nudging the weights (ch3, ch13), at 6·N·D compute on thousands of GPUs (ch14). Then SFT and preference training turn the base model into an assistant (ch15) **[well]**.
- That knowledge lives as patterns spread through the weights, not as stored pages **[gap: never stated, logged major]**.
- The model knows nothing after its training data was collected (knowledge cut-off) **[gap: logged major]**.
- Why it makes things up: it writes the most likely-sounding text, so a fluent guess beats "I don't know" (ch3, ch17). Facts seen once in training set a floor on errors. Benchmarks that reward guessing teach guessing. A "can't answer" circuit can misfire on familiar names (ch17). Reward models that like agreeable answers push towards flattery (ch15). Sampling temperature adds randomness (ch3) **[well]**.
- Fixes: pasting sources in via RAG or search **[weak: taught as a context saver, not as grounding]**. Training models to abstain **[weak: one sentence implied in ch17]**.

### (d) What would you watch on a dashboard if you were on call for an AI service?
- Error rate, plus 429s and shed requests (ch1, ch10, finale) **[well]**.
- Time to first token, and its tail (p95/p99 wait), not just the average (ch1, ch9, finale) **[well]**.
- Time per output token or tokens per second per user (defined in ch1, but never named as a dashboard signal) **[weak]**.
- How full the seats or GPUs are, against the ~85% knee and the autoscaler target (ch9) **[well]**. Queue length (ch1, ch9 sims) **[weak]**.
- GPU memory or KV-cache fill and paused or evicted conversations (ch7) **[weak: shown in the sim, never framed as a monitored signal]**.
- A quality check that reads sampled replies, plus thumbs-down, compared between canary and control during rollouts (ch10) **[well, best-taught item]**.
- Prompt-cache hit rate (ch16), cost per 1,000 replies and wasted GPU time (ch9, finale) **[weak]**.
- Hardware: latency jumps from thermal throttling, power and cooling, failed chips (ch11, ch14, finale) **[weak]**.
- Safety: injection and jailbreak detector hits, agent action audit logs (ch17, finale) **[weak]**.
- SLOs, error budgets and paging (ch10) **[well]**.
- Overall, every signal I listed is somewhere in the course, but I had to assemble the list myself from 7 chapters **[gap: logged major in production]**.

## Verdict on the promise

**Mostly kept.** After the 18 chapters a curious beginner can tell a coherent story: the request path → tokens → one parallel prefill → token-by-token decode with sampling → KV memory and batching on GPUs → fleet cost and queueing → canaries and on-call → power and cooling → data, training loop, scale and post-training → agents, tools and injection. The finale ties the serving and operations half together well, and the recall chain makes the order stick. Four of the five big questions could be answered with real numbers.

Three things stop it from being a full end-to-end picture:
1. **Where knowledge lives, and its cut-off date, are never stated.** This undercuts the "how assistants work" half. It is the most likely question a beginner asks, and the course gets 90% of the way there without saying it.
2. **Costs never join up into one dollar picture.** Serving floor, list price and finale price sit on separate scales. "What it costs" ends as ratios, not dollars.
3. **"What it takes to serve them" has no operational summary.** There is no consolidated set of on-call signals, and Part 1 (tokens, attention, thinking, images) is absent from the finale, so the two halves of the course meet only through the KV cache.

Fixing the four majors (two sentences each, plus one dashboard list) would make the promise fully true.
