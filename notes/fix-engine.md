# Fix list — engine and cross-chapter (owner: lead)

- [ ] E1 sim.js reset(): fun-fact toasts duplicate after "Show me"/reset (S.seen cleared, toasts left). Remove existing toasts on reset or keep fact keys seen.
- [ ] E2 Fun facts stack (2–3 cards) between sim and controls, worst on phones. Show one fact at a time (newest replaces, small "x more found" link to facts page); never push controls far from the stage.
- [ ] E3 Maths `.eq` lines overflow on phones (page scrolls sideways in send, data, scale, thinking, datacenters). Allow wrapping: `.eq{overflow-x:auto}`, `.sym{overflow-wrap:anywhere}`; chapters should put one equation per line (no &nbsp; joins).
- [ ] E4 Sticky top bar covers top of sim at 390 when scrolled to a sim; add scroll-margin-top to figures/sections.
- [ ] E5 Glossary: core words (GPU, parameter/weight, vector, softmax, compute, token) need a definition on first use in each chapter's main text. Add a tiny glossary mechanism: `<dfn data-g="gpu">GPU</dfn>` → dotted underline + tap/hover popover from one shared dictionary in core.js.
- [ ] E6 Spelling consistency: "datacenter" everywhere (not datacentre / data-centre).
- [ ] E7 Reference service (cross-chapter numbers): one shared box/sentence. Serving chapters 7–9 use Llama 3 8B on one H100; ch1/ch5 "a large model" speeds; explain list price vs serving cost once (ch9). Ch11 chip = newer Blackwell-class (~1.67 kW, ~10^15 useful ops/s, ≈2.5× H100); ch14/18 = H100 at ~4×10^14 useful. Each chapter names its chip + utilisation in one clause.
- [ ] E8 Queueing story: ch1 says it's the single-line simplification; ch9 links back ("remember the line in ch1? here's the many-seat version"); ch18 curve "shaped like chapter 9's".
- [ ] E9 On-call thread: overload = rejections (429/529), timeouts, retries; context-length-exceeded errors; client disconnect stops generation; prefill/decode interference (chunked prefill); cache hit rate as a metric. Touch in ch1 (gateway rate-limits at ≥90%), ch7 (too-long request bounced), ch8 (one paragraph), ch9 (timeouts → failed), ch10 (SLOs/alerting), ch18 (load shedding).
- [ ] E10 Tour copy: no "left/right" directions (phones stack); name the panel instead. (grep tours for "left"/"right")
- [ ] E11 Landing (00-start.html): broken `#finale` link → `#company`; sync map questions with chapter h2s (6, 9, 11, 17, 18); "About 4 to 5 hours"; "12 to 20 minutes"; define GPU in hero paragraph.
- [ ] E12 build.py META description still says "from age 5 to mathematician" → update.
- [ ] E13 Units: one cost unit across ch8/ch9/ch18 (per 1,000 replies, with "≈ 1M tokens" bridge); introduce kW/MW/GW and GB once with comparisons.
- [ ] E14 Notices must describe what is on screen now (prefix "Last roll:", "Last question:" when about a previous event).
