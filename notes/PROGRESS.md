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
- [x] Fix round 1 (engine: notes/fix-engine.md; chapters: notes/fix-A … fix-F.md) — done 2026-10-11, commit 2bd01a7
- [x] Review round 2 (findings: notes/review2-1.md, notes/review2-2.md)
- [x] Fix round 2 (done 2026-10-11): one fixer per review2 file (FIXER_SPEC.md, fix list = review2-N.md); engine CSS already patched (seg wrap, goal pill)
- [ ] README rewrite, meta description, merge to main, confirm Pages rebuild, republish preview artifact

## Resume procedure (after any interruption)
1. `git status` / `git log -3` on branch v4; build; run notes/tools/allcheck.py.
2. Count open items: `grep -c '^- \[ \]' notes/fix-*.md`.
3. Relaunch one fixer agent per fix list that still has open items, with notes/FIXER_SPEC.md (they resume from unticked items).
4. Commit + push v4 after each fixer finishes (and at least every hour).

## Log
- 2026-10-11: fix round 1 interrupted by usage limit; partial fixes in A (6), C (3), F (2) committed; relaunching fixers A–F.

- 2026-10-11: fix round 1 complete. Review round 2 launched: findings go to notes/review2-1.md (start–ch9) and notes/review2-2.md (ch10–facts) as checklists.

- 2026-10-11: review round 2 done (majors: send load shedding, multimodal close-up, company clipped control, assistant flattery). Engine CSS patched (not yet committed at time of writing). Next: launch round-2 fixers.

- 2026-10-11: fix round 2 complete (all items in review2-1/2 ticked; one [~] in agents budget). Next: end-to-end student test, README/meta, merge, deploy.

## Checkpoint rule
Commit and push `v4` after every batch of fixes. Tick items in the fix files as they are done.
