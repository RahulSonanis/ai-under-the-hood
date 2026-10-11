# Fixing chapters for "AI Under the Hood" v4

Repo /home/claude/ai-under-the-hood, branch v4. Do NOT run git. Edit only your chapters' files listed at the top
of your fix list (notes/fix-X.md) plus that fix list itself. Never edit src/js/sim.js, kit.js, core.js, styles.css
(if you truly need a style, add a small <style> scoped by your chapter id at the top of the chapter HTML).
Background: notes/V4_SPEC.md (how chapters are built; follow its rules), notes/REVIEW_SPEC.md (how to play/screenshot).
Tools: notes/tools/simshot.py and pageshot.py (usage in REVIEW_SPEC.md; outputs land in the session scratchpad
/tmp/claude-0/-home-claude-ai-under-the-hood/9f7e82d3-ea99-5405-a9bf-d9eb69cc2336/scratchpad/), notes/tools/allcheck.py,
notes/tools/widecheck.py. Build: `python3 build.py`.

## Do
1. Work through every unchecked item in your fix list, in order of severity (blocker, error, major, then minor,
   nitpick). After finishing each item, change its `- [ ]` to `- [x]` in the fix list immediately (this is our
   checkpoint if you're interrupted). If you decide not to do an item, mark `- [~]` and add a short reason.
2. Also apply these cross-chapter rules to your chapters:
   - Glossary: wrap the FIRST use in each chapter's main text of these terms with `<dfn data-g="KEY">word</dfn>`:
     token, gpu, parameter, weight, vector, softmax, compute, layer, kv-cache, prefill, decode, context, latency,
     throughput, bandwidth, watt (for kW/MW/GW), byte (for KB/GB/TB), flops, benchmark, harness. Only where the term
     appears and isn't already explained in that sentence.
   - Tours and text must never say "on the left/right/top/bottom" (phones stack panels); name the panel instead.
   - Notices must describe what's on screen now; if about a past event, say so ("Last roll: …").
   - Reference numbers across chapters: serving chapters (7–9) use Llama 3 8B on one H100 (989 trillion 16-bit
     sums/s dense, 3.35 TB/s, 80 GB). Training chapters 14 and 18 use H100s at ~4×10^14 useful sums/s (≈40–45% of peak).
     Chapter 11's chip is a newer Blackwell-class part (~1.67 kW, ~10^15 useful/s, about 2.5× an H100). Name the
     chip and the assumed utilisation in one clause wherever a speed is used.
   - One cost unit for people: "per 1,000 replies" (bridge once: 1,000 replies ≈ 1 million tokens).
   - Every number has a comparison or meaning; every name is introduced once; illustrative numbers are labelled.
3. Verify facts you add (WebSearch/WebFetch primary sources); add new references in src/refs/chNN.html with ids
   NN01–NN19 (check which are already used).
4. Check: build; allcheck.py (no errors); widecheck.py (no overflow); screenshot each sim at 1280 dark and 390
   light including the tour, and LOOK at them; re-read your text as a beginner.

## Report (short)
Items done / skipped (with reason), anything you couldn't fix, anything that needs an engine change.
