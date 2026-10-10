# Fix list F — ch16 agents, ch17 security, ch18 company (finale), ch19 next, facts page
Files: src/chapters/16-agents.html 17-security.html 18-company.html 19-next.html 98-facts.html, src/js/ch16-agents.js ch17-security.js ch18-company.js ch19-next.js, src/refs/ch16.html ch17.html

## ch16 agents
- [ ] F1 [major] Non-coder on-ramp: one framing sentence ("the files are a shop's website code; 'tests' are automatic checks that it works; .py files are pieces of a program").
- [ ] F2 [major] Billing adds input and output 1:1 → weight output ~5× input and cache writes ~1.25×, or label "token-equivalents at the input price"; maths note on cache-write premium.
- [ ] F3 [major] Context window 12,000 with no anchor → "Real models hold 200,000 tokens or more; the simulation uses a small window so you can see it fill."
- [ ] F4 [minor] Goal too easy (caching mandatory) → tighten budget or add cache-write cost so choices interact.
- [ ] F5 [minor] "Fixed. All tests pass." while counter shows 0 → update counter at the moment the fix lands; stale "Fixed in 5 calls…" notice during next task; "chance the fix works 10%" before code fetched.
- [ ] F6 [minor] Index box caption "each dot is a piece of code; closer = similar meaning" (embedding, chunks, query).
- [ ] F7 [minor] Introduce SWE-bench ("a test made of real bug reports from open-source Python projects"); maths: cached total can span tasks.
- [ ] F8 [minor] On-call: tool timeouts/retries, idempotent tools, runaway loops (step caps), rate limits — one paragraph.
- [ ] F9 [minor] 390: log panel reduced to one line → keep 3 lines.

## ch17 security
- [ ] F10 [major] Missing egress/URL allowlist: add tool option "links only to approved domains" (blocks link exfiltration, keeps real tasks); mention allowlists + audit logs.
- [ ] F11 [major] 390: "Inside the model" lamps panel not drawn but tour/fact reference "bottom panel" → compact lamp row on phones.
- [ ] F12 [major] Detector slider direction (off on right) → left = off, right = strict; label "strictness"; "classifier" → "a separate checking model".
- [ ] F13 [major] Maths conditional vs independent: "With standalone rates q_i, P = Πq_i only if layers fail independently; really P = Πp_i with p_i ≥ q_i because attacks that beat one layer tend to beat the next." Add learner product line (3/5)·(2/3)… .
- [ ] F14 [minor] Constitutional Classifiers: "over 3,000 hours against an early version; the improved version costs 0.38 points more refusals and ~24% more compute".
- [ ] F15 [minor] Readouts scope: label cumulative ones "all inboxes"; dots in arrival order; "quar." → "quarantined"; lamps caption "made-up illustration of what researchers can see inside"; approval fatigue named once; faster default round (3×).

## ch18 company (finale)
- [ ] F16 [blocker] Jailbreak "missed" notice always says "Light testing saved money…" even on Standard → use actual plan (≈ line 364).
- [ ] F17 [blocker] Displayed profit doesn't follow the lines above (fixed costs prorated by h/18) → show "fixed costs so far = (training + testing) × h/18" and put h/18 in symbols; T is a DAILY testing cost (not yearly/365).
- [ ] F18 [error] Predict answer "1 to about 9 seconds" → "about 1 to about 10". Fact "llama": "While Meta trained its largest Llama 3 model on 16,384 GPUs, during a 54-day stretch it logged 419…". Header comment 45 → 30 replies/s.
- [ ] F19 [major] Capacity realism: new pods warm up (20–30 sim-minutes); say most GPU capacity is reserved (paid whether used or not) and idle time is filled with batch work; adjust "switch them off after the peaks" lesson.
- [ ] F20 [major] Load shedding: add "turn away when overloaded" lever (429s) or cap queue, show "turned away" metric; reconcile 618 s waits with "people give up after ~2 minutes".
- [ ] F21 [major] Doing nothing barely punished ($64K vs $72.9K) → abandoned/turned-away users and missed incidents cost more.
- [ ] F22 [major] End-to-end check questions too easy → plausible distractors + 2–3 cross-chapter reasoning items (16→8-bit cost per reply; why failures double with 2× GPUs; lower training loss on noisy data can be worse; why the cache breaks after editing an early message; tokens/attention/thinking).
- [ ] F23 [major] Two p95 on screen → "wait now" vs "slowest 5% today"; drop "p95" from visible UI. Show "goal lost: today's slowest-5% wait is already X s" + suggest Reset.
- [ ] F24 [major] Incident cards "handled ✓" with leaks below → "handled (36 leaked before the filter)" / amber partly handled.
- [ ] F25 [minor] Version naming: introduce "2.1" in fix notice and reset its bad-reply bar; intro "Press Run" but no Run button; units: per 1,000 replies with "≈ 1M tokens" bridge; fleet header overlaps Version-check panel; congestion curve "shaped like chapter 9's"; F = 4×10^14 name the chip.

## ch19 next
- [ ] F26 [major] Beginner path: put no-code resources first (3Blue1Brown, Karpathy intro) and add 2–3 no-code projects (time replies in a chat app; count tokens with an online tokenizer; read a real postmortem against ch10).
- [ ] F27 [minor] Add projects: load-test vLLM past saturation with an admission limit (429) and compare p95; measure prompt caching (cached tokens + latency) with an API.

## facts page
- [ ] F28 [minor] Progress counter "N of M found" and greyed placeholders per chapter with hint where to find them.
