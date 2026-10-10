/* Build it yourself: chapter tags link to the chapter with that number, whatever its id. */
chapter("next", () => {
  $$("#next a[data-n]").forEach(a => {
    const sec = $(`section.chapter[data-num="${a.dataset.n}"]`);
    if (sec) { a.href = "#" + sec.id; a.title = sec.dataset.title || ""; } else a.removeAttribute("href");
  });
});
