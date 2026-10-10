# Fix list E — ch13 learning, ch14 scale, ch15 assistant
Files: src/chapters/13-learning.html 14-scale.html 15-assistant.html, src/js/ch13-learning.js ch14-scale.js ch15-assistant.js, src/refs/ch15.html

## ch13 learning
- [ ] E1 [major] LR 1.0: loss sits flat ~0.042 (tanh saturation) but text says "bounces/never settles" → detect "flat but high, tiny gradients" and explain saturation, or make extreme LR visibly oscillate; align predict answer and notice.
- [ ] E2 [major] Add held-out (validation) dots and a validation loss line that rises when overfitting; goal readout must not say "reached" while overfitting ("reached too late (step 1358)").
- [ ] E3 [major] Maths chain rule doesn't match selectable weights → give formula for the selected weight (output weight: ∂L/∂ŷ · h₂; input weight: sum over paths) or the general rule "multiply along each path, add over paths".
- [ ] E4 [major] Add Adam formula: step ≈ η × (average slope ÷ its typical size) = η·m̂/(√v̂+ε); explains why nudge ≈ η.
- [ ] E5 [major] Log-scale loss axis: add "each line is 10× smaller".
- [ ] E6 [major] "One weight up close" raw numbers → arrows/words ("pushed slightly down") in the sim; numbers stay in maths.
- [ ] E7 [minor] Noisy data makes goal 0.02 impossible (floor ~0.031) → goal text changes when noise on; tour ends on a clean run.
- [ ] E8 [minor] "Loss landscape (a real slice)": "think of a valley seen from above: darker = deeper".
- [ ] E9 [minor] Main text mentions Adam in one clause; "Adam is forgiving: a wide range of step sizes works".
- [ ] E10 [minor] Slope shown from before last update vs value after → say "slope measured at the last step"; use true minus sign.

## ch14 scale
- [ ] E11 [blocker] Tour step 1 says "8-billion-parameter … small job" but sets 70B → fix text to 70B ("about a quarter of the 60 days") or set 8B; fix HTML fallback span "8B".
- [ ] E12 [blocker] Tour step 4 "Split over 8 GPUs that's over 800 GB each" but split is 8×4 = 32 (213 GB) → set split 8 or fix text.
- [ ] E13 [major] "Useful GPU time" omits ~50% MFU → rename "time not lost to waits, saves or failures".
- [ ] E14 [major] Live maths: document ×0.95 tensor factor in u; show "formula: X days · your run: Y days".
- [ ] E15 [major] Add scaling-law maths block: L(N,D) = E + A/N^α + B/D^β with learner's numbers ({scLoss}, {scBest}); how best size for fixed compute is found.
- [ ] E16 [major] 390: panel 1 (loss curve, goal line) not drawn → compact panel 1 on phones.
- [ ] E17 [major] Loss 1.905 vs 1.932 has no felt meaning → translate (e.g. quality score or "X% better guesses").
- [ ] E18 [major] Split labels opaque → "1 GPU", "1 server (8)", "4 servers (32)", "16 servers (128)"; jargon in How it works.
- [ ] E19 [misleading] Predict: "trained … for nearly two months" → "During a 54-day stretch of training…". Async checkpoint claim [ref-15] → cite PyTorch async distributed checkpointing docs or soften.
- [ ] E20 [minor] "Finished in 0.0 days" → minutes/hours; label "1 dot = 32 GPUs …" clipped at 1280; plain meanings for 8B/15T/10^24/GB.
- [ ] E21 [minor] On-call: stragglers, silent data corruption, collective-communication hangs — one sentence.
- [ ] E22 [minor] Hint that the goal needs the biggest split.

## ch15 assistant
- [ ] E23 [major] Default prompt Java NPE → make the everyday "startup idea" prompt the default; add a 3-way prompt choice control.
- [ ] E24 [major] Stats framing: non-overlap rule is strict; real evals compare both models on the same questions (paired), which needs fewer questions. Draw outcomes paired per question and show an interval on the difference, or at least state it in text + maths.
- [ ] E25 [major] Add evaluation maths block: half-width ≈ 1.96·√(p(1−p)/n); difference uncertainty ≈ √2 × one band; ~4,800 questions per side to detect 2 points. Use Wilson consistently (asPm vs bands).
- [ ] E26 [major] Default view: P = 0 but block shows "Boost e^(score/β) = 7.4" then unchanged 28% → "no reward model yet: no boost applied".
- [ ] E27 [major] Readouts: "drift 1.47" → "how far it moved (0 = not at all)"; β explained; "95% band" tooltip "the range the true score is probably in". KL formula in maths.
- [ ] E28 [major] Phone layout broken: reply labels over bars, percentages offset one row, test panel cut off → labels on own line, grow camsNarrow.
- [ ] E29 [minor] Overlaps at 1280 ("2 · Example conversations · 1,000" spills; "fine-tuning teaches the format" cut; β label collides; "8%" dot on "true skill").
- [ ] E30 [minor] Leak applies to "yours" only even when identical to "before" → apply to both.
- [ ] E31 [minor] Introduce GPT-3 and parameter in fun fact; HumanEval cite Chen et al. 2021 (arXiv 2107.03374) as new ref.
- [ ] E32 [minor] Best reachable helpfulness ~62% from 52% undersells → higher starting point for fine-tuned model.
