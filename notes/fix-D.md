# Fix list D — ch10 production, ch11 datacenters, ch12 data
Files: src/chapters/10-production.html 11-datacenters.html 12-data.html, src/js/ch10-production.js ch11-datacenters.js ch12-data.js, src/refs/ch10.html ch11.html ch12.html

## ch10 production
- [ ] D1 [major] Grey old-version error line rises after everyone moves to the new version (looks like regression), crosses red limit. Hide/grey it with "no traffic" when its share < ~2%; the red line applies to the new version only.
- [ ] D2 [major] Thumbs-down chart shows broken new version with fewer complaints than old. Reduce old-version noise / same baseline.
- [ ] D3 [major] Rollback ~1 s and no warm-up: add "Rollback is fast only because the old version is kept running and warm alongside (blue/green); reloading weights takes minutes." Optionally a few seconds of rollback delay.
- [ ] D4 [minor] Quality panel shows impossible 142.8/1,000 after rollback → attribute flags to the bucket where served, or freeze when share = 0.
- [ ] D5 [minor] Red threshold drawn at 10 but rule is 2×old+5 → draw at the real value.
- [ ] D6 [minor] 1% = 1 server of 24 → label slice "1 server" / say router weights servers. Fact-check: "first 1% and 5% land only on chip A" (not A and B). "garbles about 1 in 75 replies overall (1 in 25 on chip C)".
- [ ] D7 [major] Maths is static → personalise: "Your last rollout: 400 × {a} × {f} × {T} s ≈ {pred}; the sim counted {garbled}"; f depends on a (0 until a chip C server is reached).
- [ ] D8 [minor] On-call: SLOs/error budgets; page someone when the quality signal moves — one sentence.
- [ ] D9 [minor] Fun fact: "Google-made AI chips (TPUs)"; define context length, compiler bug; after auto-rollback show "fixed build v2" label.
- [ ] D10 [minor] Phone: dashboard far from controls (fun facts stacking — engine E2).

## ch11 datacenters
- [ ] D11 [major] Air-rack limit 13 kW (one 8-chip server) understated → use 2–3 servers per air rack (~26–40 kW); keep "4–6 kW typical" for ordinary racks; notice: "In this simulation an air-cooled rack holds N chips (illustrative)".
- [ ] D12 [major] Chip speed 10^15 here vs ~4×10^14 in ch14/18 → say this is a newer Blackwell-class chip (~2.5× an H100) (engine E7).
- [ ] D13 [major] Goal power limit not visible as pass/fail: MW readout red and "over 30 MW" in goal pill when exceeded.
- [ ] D14 [major] Units: "a kilowatt (kW) is what a microwave draws; a megawatt (MW) is 1,000 of them" on first use; comparisons for 1.65 kW and 120 kW.
- [ ] D15 [minor] "about 1.67 kW" (120/72); homes comparison: "running flat out"; "835 MW ≈ 680,000 homes (our calculation from EIA averages)".
- [ ] D16 [minor] Training dips (48 sim-minutes every 13 h) → much narrower spike or call it "a restart after a failure".
- [ ] D17 [minor] Power chart keeps history from previous settings → clear on change or "plan changed" marker.
- [ ] D18 [minor] Site partly idle at night → providers fill troughs with batch/training work (ch9).
- [ ] D19 [minor] Readout "site power at peak"; name the example model in intro ("Meta's largest Llama 3"); tour step 5 should hint, not set the answer.
- [ ] D20 [minor] On-call: cooling/power fault → thermal throttling → latency spike; N+1 redundancy (sets up finale).
- [ ] D21 [minor] Maths: add N = P/(w·PUE).
- [ ] D22 [minor] 390: "limit" label overlap in power chart.

## ch12 data
- [ ] D23 [major] Copy detection: add LSH sentence ("112 numbers split into 14 bands of 8; only pages matching a whole band get compared").
- [ ] D24 [major] MinHash precision: "typically off by about 0.04; 95% of the time within 0.09" (not ±0.05); "(for a perfectly random shuffle)"; winner's-curse note optional.
- [ ] D25 [misleading] "Labs also respect sites that opt out [ref-9]" — Llama 3 paper doesn't say robots.txt; cite FineWeb/Common Crawl robots.txt compliance or drop.
- [ ] D26 [major] Training-set panel contradicts readouts ("3 problem pages got in" vs 0%; "0 pages" vs "13 kept") → re-sort/recolour immediately on settings change, or label scopes.
- [ ] D27 [major] 390: mix bar and test-model bars not drawn; title overlapped; bin labels shrink to "out 5" → compact strip on phones.
- [ ] D28 [minor] Mix segment legend (code/maths/books), avoid red; "drop if ≥ 75% similar"; plain fun facts (details to How it works).
- [ ] D29 [minor] Intro "Each grey bar is a filter" → "Each upright bar is a filter; amber means on"; tap targets on phone / "inspect last dropped page".
- [ ] D30 [minor] Strict copy cut-off lesson weak (30% still reaches goal) → make recipes/copies cost more or raise threshold.
- [ ] D31 [minor] Contamination: how it's done (n-gram overlap with benchmarks) → link to ch15.
