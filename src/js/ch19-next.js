/* Build it yourself: chapter tags link to the chapter with that number, whatever its id. */
chapter("next", () => {
  $$("#next a[data-n]").forEach(a => {
    const sec = $(`section.chapter[data-num="${a.dataset.n}"]`);
    if (sec) { a.href = "#" + sec.id; a.title = sec.dataset.title || ""; } else a.removeAttribute("href");
  });
});

/* Fun facts page: after the list is drawn, add "N of M found" and a greyed placeholder for each chapter that still
   hides facts, with a link to where they are. Totals per chapter live in #facts-list[data-totals]. */
(() => {
  const box = $("#facts-list"); if (!box) return;
  let totals = {}; try { totals = JSON.parse(box.dataset.totals || "{}"); } catch (e) {}
  const paint = () => {
    obs.disconnect();
    // only facts from chapters that still have facts count; a renamed fact id can't push a chapter past its total
    const found = store.get("facts", {}), per = {};
    Object.values(found).forEach(f => { if (totals[f.ch]) per[f.ch] = Math.min(totals[f.ch], (per[f.ch] || 0) + 1); });
    $$("li:not(.todo):not(.empty)", box).forEach(li => { const a = $(".from a", li), ch = a && (a.getAttribute("href") || "").slice(1); if (ch && !totals[ch]) li.remove(); });
    const nFound = Object.values(per).reduce((a, b) => a + b, 0), nAll = Object.values(totals).reduce((a, b) => a + b, 0);
    const cnt = $("#facts-count");
    if (cnt) cnt.innerHTML = `${nFound} of ${nAll} found<div class="bar"><i style="width:${nAll ? Math.round(nFound / nAll * 100) : 0}%"></i></div>`;
    $$("li.todo", box).forEach(li => li.remove());
    const todo = $$("section.chapter").filter(s => totals[s.id] && totals[s.id] > (per[s.id] || 0));
    todo.forEach(s => {
      const left = totals[s.id] - (per[s.id] || 0), name = s.dataset.num ? `chapter ${s.dataset.num}, ${s.dataset.title}` : s.dataset.title;
      const li = document.createElement("li"); li.className = "todo";
      li.innerHTML = `<p>${left} more to find in <a href="#${s.id}">${esc(name)}</a>. Play its simulation and try the extremes.</p>`;
      box.appendChild(li);
    });
    if (todo.length) { const e = $("li.empty", box); if (e) e.remove(); }
    obs.observe(box, { childList: true });
  };
  const obs = new MutationObserver(paint);
  obs.observe(box, { childList: true });
  paint();
})();
