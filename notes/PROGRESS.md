# v4 rebuild — progress log (resume from here)

Branch: `v4` (pushed to origin). Live site (`main`) is untouched until v4 is finished.
Build: `python3 build.py` → `docs/index.html`. Specs for builders/reviewers live in the session scratchpad
(V4_SPEC.md, REVIEW_SPEC.md); the essentials are copied below so work can resume without them.

## Plan (agreed with Rahul)
17 chapters + finale ("Run an AI company for a day") + landing + facts page + "Build it yourself" + references.
Each chapter: question → recall → predict → ONE live simulation (real-time controls, goal, notices, 1–2 fun facts,
"Show me" tour) → explain (one text + "How it works" + "The maths": words → your numbers → symbols) → carry forward
→ 2 check questions. Rules: plain language; define every term before use; no name without an introduction; no
number without a comparison; every claim sourced; illustrative numbers labelled.

## Status
- [x] Engine (src/js/sim.js, kit.js), chapter template, collapsible sidebar, reference chapter (memory)
- [x] All chapters 1–17, finale (18), landing, next (19), facts (98), refs (99) built
- [x] Review round 1: beginner ×2, engineer ×2, maths ×1, fact-check ×2 (findings in notes/fix-*.md)
- [ ] Fix round 1 (engine: notes/fix-engine.md; chapters: notes/fix-A … fix-F.md) — tick items as done
- [ ] Review round 2 (quick re-check of blockers/majors, phone layouts)
- [ ] README rewrite, meta description, merge to main, confirm Pages rebuild, republish preview artifact

## Checkpoint rule
Commit and push `v4` after every batch of fixes. Tick items in the fix files as they are done.
