/* Core: helpers, router (one chapter per screen), concept ladders, quizzes, progress. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const store = { get(k, d) { try { const v = localStorage.getItem("auth:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("auth:" + k, JSON.stringify(v)); } catch (e) {} } };
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function fmt(n, d = 1) {
  if (!isFinite(n)) return "—"; const a = Math.abs(n);
  if (a >= 1e15) return (n / 1e15).toFixed(d) + "P"; if (a >= 1e12) return (n / 1e12).toFixed(d) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(d) + "B"; if (a >= 1e6) return (n / 1e6).toFixed(d) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(d) + "K"; return n.toFixed(d);
}
function sci(n, d = 2) { if (!isFinite(n) || n === 0) return "0"; const e = Math.floor(Math.log10(Math.abs(n))); return (n / 10 ** e).toFixed(d) + "×10" + sup(e); }
function sup(n) { return String(n).replace(/[-0-9]/g, c => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]); }
function money(n) { if (!isFinite(n)) return "—"; if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B"; if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M"; if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K"; return "$" + n.toFixed(0); }
function bytes(n) { if (!isFinite(n)) return "—"; const u = ["B", "KB", "MB", "GB", "TB", "PB"]; let i = 0; while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; } return n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2) + " " + u[i]; }
function dur(h) { if (!isFinite(h)) return "—"; if (h < 1) return (h * 60).toFixed(0) + " min"; if (h < 48) return h.toFixed(1) + " h"; if (h < 24 * 365) return (h / 24).toFixed(1) + " days"; return (h / 8760).toFixed(2) + " years"; }
function num(id) { return parseFloat(document.getElementById(id).value); }
function checked(id) { return document.getElementById(id).checked; }
function bindCtl(id, cb, show) {
  const el = document.getElementById(id); if (!el) return null;
  const out = document.querySelector(`output[for="${id}"]`);
  const upd = () => { if (out) out.textContent = show ? show(el) : el.value; cb(); };
  el.addEventListener("input", upd); if (out) out.textContent = show ? show(el) : el.value; return el;
}
/* Mirror each slider's displayed value into aria-valuetext, whoever writes the <output>. */
function syncValueText(root = document) {
  $$("output[for]", root).forEach(o => { const el = document.getElementById(o.htmlFor.value || o.getAttribute("for")); if (!el || el.type !== "range" || o._vt) return; o._vt = 1;
    const up = () => { const t = o.textContent.trim(); if (t) el.setAttribute("aria-valuetext", t); };
    new MutationObserver(up).observe(o, { childList: true, characterData: true, subtree: true }); up(); });
}
function setCtl(id, v, show) { const el = document.getElementById(id); el.value = v; const o = document.querySelector(`output[for="${id}"]`); if (o) o.textContent = show ? show(el) : el.value; }
function seg(container, cb) {
  const btns = $$("button", container);
  btns.forEach(b => b.addEventListener("click", () => { btns.forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); container.dataset.value = b.dataset.v; cb(b.dataset.v); }));
  const on = btns.find(b => b.getAttribute("aria-pressed") === "true") || btns[0]; container.dataset.value = on.dataset.v;
  return () => container.dataset.value;
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function gauss(r) { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function innerW(el) { const st = getComputedStyle(el); return Math.max(0, el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)); }
function setupCanvas(cv, h) {
  const dpr = window.devicePixelRatio || 1; const w = cv.clientWidth || innerW(cv.parentElement) || 600;
  cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w, h };
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function font(ctx, size, fam = "--f-display", w = "") { ctx.font = `${w} ${size}px ${css(fam)}`; }

/* Small axis plot (used by engineer tools). */
function plot(cv, opt) {
  const { ctx, w, h } = setupCanvas(cv, opt.height || 240);
  const m = Object.assign({ l: 56, r: 16, t: 14, b: 40 }, opt.margin || {}); const X = opt.x, Y = opt.y;
  const tx = v => X.log ? Math.log10(v) : v, ty = v => Y.log ? Math.log10(v) : v;
  const px = v => m.l + (tx(v) - tx(X.min)) / (tx(X.max) - tx(X.min)) * (w - m.l - m.r);
  const py = v => h - m.b - (ty(v) - ty(Y.min)) / (ty(Y.max) - ty(Y.min)) * (h - m.t - m.b);
  ctx.clearRect(0, 0, w, h); font(ctx, 11, "--f-mono"); ctx.lineWidth = 1;
  const ticks = (A) => { if (A.ticks) return A.ticks; if (A.log) { let r = []; for (let e = Math.ceil(Math.log10(A.min)); e <= Math.floor(Math.log10(A.max)); e++) r.push(10 ** e); if (r.length < 2) { r = []; for (let e = Math.floor(Math.log10(A.min)); e <= Math.ceil(Math.log10(A.max)); e++) [1, 2, 5].forEach(k => { const v = k * 10 ** e; if (v >= A.min && v <= A.max) r.push(v); }); } return r; }
    const span = A.max - A.min, st = 10 ** Math.floor(Math.log10(span / 5)); const k = [1, 2, 5, 10].find(k => span / (k * st) <= 6) * st; const r = []; for (let v = Math.ceil(A.min / k) * k; v <= A.max + 1e-9; v += k) r.push(+v.toFixed(10)); return r; };
  ctx.fillStyle = css("--muted"); ctx.strokeStyle = css("--grid");
  ticks(X).forEach(v => { const x = px(v); ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, h - m.b); ctx.stroke(); ctx.textAlign = "center"; ctx.fillText((X.fmt || fmt)(v), x, h - m.b + 14); });
  ticks(Y).forEach(v => { const y = py(v); ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(w - m.r, y); ctx.stroke(); ctx.textAlign = "right"; ctx.fillText((Y.fmt || (v => v.toFixed(2)))(v), m.l - 6, y + 4); });
  font(ctx, 11); ctx.textAlign = "center"; if (X.label) ctx.fillText(X.label, m.l + (w - m.l - m.r) / 2, h - 6);
  if (Y.label) { ctx.save(); ctx.translate(12, m.t + (h - m.t - m.b) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(Y.label, 0, 0); ctx.restore(); }
  ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, w - m.l - m.r, h - m.t - m.b); ctx.clip();
  (opt.series || []).forEach(s => { ctx.strokeStyle = s.color || css("--accent"); ctx.fillStyle = s.color || css("--accent"); ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []);
    if (s.points) s.data.forEach(([a, b]) => { ctx.beginPath(); ctx.arc(px(a), py(b), s.r || 4, 0, 7); ctx.fill(); });
    else { ctx.beginPath(); s.data.forEach(([a, b], i) => { const x = px(a), y = py(b); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); } ctx.setLineDash([]); });
  ctx.restore();
  (opt.labels || []).forEach(L => { ctx.fillStyle = L.color || css("--ink"); font(ctx, 11, "--f-mono", L.bold ? "600" : ""); ctx.textAlign = L.align || "left"; ctx.fillText(L.text, px(L.x) + (L.dx || 0), py(L.y) + (L.dy || 0)); });
  return { px, py, ctx, w, h, m };
}

/* ---------- Chapter registry: lazy init, visibility-aware redraw and animation ---------- */
const Chapters = { inits: {}, done: {}, redraw: {}, current: null };
function chapter(id, init) { Chapters.inits[id] = init; }
function onRedraw(fn) { const id = Chapters.initing; (Chapters.redraw[id] = Chapters.redraw[id] || []).push(fn); fn(); }
function redrawCurrent() { (Chapters.redraw[Chapters.current] || []).forEach(f => f()); }
/* Animation loop that only runs while its chapter is on screen and the tab is visible. */
function animLoop(step) {
  const id = Chapters.initing; let on = false, last = 0;
  const tick = t => { if (!on) return; if (Chapters.current !== id || document.hidden) { on = false; return; } const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t; if (step(dt) === false) { on = false; return; } requestAnimationFrame(tick); };
  return { start() { if (on) return; on = true; last = 0; requestAnimationFrame(tick); }, stop() { on = false; }, get running() { return on; } };
}
let rzT; window.addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(redrawCurrent, 120); });
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawCurrent); } catch (e) {}
new MutationObserver(redrawCurrent).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

/* ---------- Concept ladders: one rung at a time ---------- */
const LEVELS = ["Age 5", "Curious", "Engineer", "Mathematician"];
function setupLadders(root) {
  $$(".concept", root).forEach(card => {
    if (card.dataset.ready) return; card.dataset.ready = 1;
    const levels = $$(".level", card); const max = levels.length;
    levels.forEach(l => { const lv = document.createElement("div"); lv.className = "lv"; lv.textContent = LEVELS[+l.dataset.l - 1]; l.prepend(lv); l.setAttribute("aria-live", "polite"); });
    const head = $(".concept-head", card); const lad = document.createElement("div"); lad.className = "ladder"; lad.setAttribute("role", "group"); lad.setAttribute("aria-label", "Explanation depth for " + $("h3", card).textContent);
    levels.forEach(l => { const b = document.createElement("button"); b.type = "button"; b.dataset.l = l.dataset.l; b.textContent = LEVELS[+l.dataset.l - 1]; b.addEventListener("click", () => show(+l.dataset.l)); lad.appendChild(b); });
    head.appendChild(lad);
    const nav = document.createElement("div"); nav.className = "ladder-nav";
    const simpler = document.createElement("button"); simpler.type = "button"; simpler.className = "deeper";
    const deeper = document.createElement("button"); deeper.type = "button"; deeper.className = "deeper";
    const capNote = document.createElement("span"); capNote.className = "note";
    nav.append(simpler, deeper, capNote); card.appendChild(nav);
    simpler.addEventListener("click", () => show(card._lvl - 1)); deeper.addEventListener("click", () => show(card._lvl + 1));
    function show(n, fromGlobal) {
      card._lvl = Math.max(1, Math.min(max, n));
      levels.forEach(l => l.hidden = +l.dataset.l !== card._lvl);
      $$("button", lad).forEach(b => { const on = +b.dataset.l === card._lvl; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      simpler.hidden = card._lvl <= 1; simpler.textContent = `← Simpler: ${LEVELS[card._lvl - 2] || ""}`;
      deeper.hidden = card._lvl >= max; deeper.textContent = `Go deeper: ${LEVELS[card._lvl] || ""} →`;
      capNote.textContent = fromGlobal && n > max ? `This idea stops at ${LEVELS[max - 1]} level.` : "";
    }
    card._show = show; show(store.get("depth", 1), true);
  });
}
function setDepth(n) {
  store.set("depth", n); $$(".concept").forEach(c => c._show && c._show(n, true));
  $$("#depth button, #start-depth button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.v === n ? "true" : "false"));
}

/* ---------- Quizzes ---------- */
function setupPredicts(root) {
  $$(".predict", root).forEach(pr => {
    if (pr.dataset.ready) return; pr.dataset.ready = 1;
    const btns = $$(".opts button", pr), after = $(".predict-after", pr), ans = +pr.dataset.answer, key = "pred:" +(pr.nextElementSibling ? pr.nextElementSibling.id : "");
    const pick = i => { btns.forEach((b, j) => b.setAttribute("aria-pressed", j === i ? "true" : "false")); after.hidden = false; };
    btns.forEach((b, i) => { b.setAttribute("aria-pressed", "false"); b.addEventListener("click", () => { pick(i); store.set(key, i); }); });
    const prev = store.get(key); if (prev !== null && prev !== undefined && btns[+prev]) pick(+prev);
  });
}
function setupQuizzes(root) {
  $$(".q", root).forEach(q => {
    if (q.dataset.ready) return; q.dataset.ready = 1;
    const ans = +q.dataset.answer, btns = $$(".opts button", q), why = $(".why", q);
    why.setAttribute("role", "status");
    btns.forEach((b, i) => { b.type = "button"; b.addEventListener("click", () => {
      btns.forEach((x, j) => { x.classList.toggle("right", j === ans && i === ans); x.classList.toggle("wrong", j === i && i !== ans); });
      why.hidden = false; why.textContent = (i === ans ? "Right. " : "Not quite. ") + why.dataset.text;
      q.dataset.ok = i === ans ? "1" : "";
      const sec = q.closest(".chapter"); if ($$(".q", sec).every(x => x.dataset.ok)) markDone(sec.id);
    }); });
    why.dataset.text = why.textContent; why.textContent = ""; why.hidden = true;
  });
}

/* ---------- Footnote popovers ---------- */
let pop = null;
function closePop() { if (pop) { pop.remove(); pop = null; } }
function openPop(a) {
  closePop(); const id = a.getAttribute("href").slice(1); const li = document.getElementById(id); if (!li) return;
  pop = document.createElement("div"); pop.className = "refpop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Source " + a.textContent);
  pop.innerHTML = `<div class="label">Source [${esc(a.textContent)}]</div><div>${li.innerHTML}</div><div class="btn-row" style="margin-top:0.5rem"><a href="#${id}">All references</a><button type="button" class="deeper" data-close>Close</button></div>`;
  document.body.appendChild(pop);
  const r = a.getBoundingClientRect(), pw = Math.min(380, window.innerWidth - 24);
  pop.style.width = pw + "px"; pop.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left - pw / 2)) + "px";
  const below = r.bottom + 8 + pop.offsetHeight < window.innerHeight; pop.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - pop.offsetHeight - 8)) + "px";
  $("[data-close]", pop).addEventListener("click", () => { closePop(); a.focus(); });
  const first = $("a", pop); if (first) first.focus();
}
document.addEventListener("click", e => {
  const a = e.target.closest("sup.ref a"); if (a && Chapters.current !== "refs") { e.preventDefault(); openPop(a); return; }
  if (pop && !e.target.closest(".refpop")) closePop();
});

/* ---------- Progress + router ---------- */
const scrollMemo = {};
function markDone(id) { const d = store.get("done", {}); d[id] = 1; store.set("done", d); paintProgress(); }
function paintProgress() {
  const d = store.get("done", {}); const links = $$(".rail a[data-ch]").filter(a => { const s = document.getElementById(a.dataset.ch); return s && $(".q", s); });
  $$(".rail a[data-ch]").forEach(a => a.classList.toggle("done", !!d[a.dataset.ch]));
  const n = links.filter(a => d[a.dataset.ch]).length; const p = $(".rail .progress");
  if (p) p.innerHTML = `${n} of ${links.length} chapter checks passed<div class="bar"><i style="width:${n / links.length * 100}%"></i></div>`;
}
const isDrawer = () => matchMedia("(max-width: 960px)").matches;
function setDrawer(open) {
  const rail = $(".rail"); rail.classList.toggle("open", open); $("#menu").setAttribute("aria-expanded", open ? "true" : "false");
  if (isDrawer()) rail.inert = !open; else rail.inert = false;
  $(".backdrop").hidden = !open;
  if (open) { const cur = $(".rail a[aria-current]") || $(".rail a"); cur && cur.focus(); }
}
function route() {
  if (Chapters.current) scrollMemo[Chapters.current] = window.scrollY;
  let h = location.hash.slice(1) || "start"; let target = null;
  if (h.startsWith("ref-")) { target = h; h = "refs"; }
  const sec = document.getElementById(h);
  if (!sec || !sec.classList.contains("chapter")) { h = "start"; }
  closePop();
  $$(".chapter").forEach(s => s.hidden = s.id !== h);
  Chapters.current = h;
  $$(".rail a").forEach(a => { if (a.getAttribute("href") === "#" + h) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if ($(".rail").classList.contains("open")) setDrawer(false);
  const el = document.getElementById(h); setupLadders(el); setupQuizzes(el); setupPredicts(el);
  if (Chapters.inits[h] && !Chapters.done[h]) { Chapters.done[h] = 1; Chapters.initing = h; try { Chapters.inits[h](); } catch (e) { console.error(e); } Chapters.initing = null; }
  else redrawCurrent();
  $$("canvas.cv", el).forEach(c => { if (!c.hasAttribute("role")) c.setAttribute("role", "img"); });
  if (target) { const t = document.getElementById(target); if (t) t.scrollIntoView({ block: "center" }); }
  else window.scrollTo(0, scrollMemo[h] || 0);
  const hd = el.querySelector("h2, h1"); if (hd && Route.moved) { hd.tabIndex = -1; hd.focus({ preventScroll: true }); }
  Route.moved = true;
  document.title = (el.dataset.title ? el.dataset.title + " · " : "") + "AI Under the Hood";
}
const Route = { moved: false };
function buildPagers() {
  const chs = $$(".rail a[data-ch]").map(a => ({ id: a.dataset.ch, t: a.querySelector(".t").textContent }));
  chs.forEach((c, i) => {
    const sec = document.getElementById(c.id); if (!sec) return; const p = document.createElement("nav"); p.className = "pager"; p.setAttribute("aria-label", "Chapter navigation");
    const prev = chs[i - 1], next = chs[i + 1];
    p.innerHTML = (prev ? `<a href="#${prev.id}" class="prev"><span class="label">← Previous</span>${esc(prev.t)}</a>` : "") + (next ? `<a href="#${next.id}" class="next"><span class="label">Next →</span>${esc(next.t)}</a>` : "");
    sec.appendChild(p);
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = store.get("theme", null); if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  buildPagers(); paintProgress(); syncValueText();
  $$("#depth, #start-depth").forEach(dp => { $$("button", dp).forEach(b => b.setAttribute("aria-pressed", +b.dataset.v === store.get("depth", 1) ? "true" : "false")); seg(dp, v => setDepth(+v)); });
  const tb = $("#theme"); const cur = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const lab = () => tb.textContent = cur() === "dark" ? "Light" : "Dark"; lab();
  tb.addEventListener("click", () => { const t = cur() === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; store.set("theme", t); lab(); });
  $("#menu").addEventListener("click", () => setDrawer(!$(".rail").classList.contains("open")));
  $(".backdrop").addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape") { if (pop) { closePop(); } else if ($(".rail").classList.contains("open")) { setDrawer(false); $("#menu").focus(); } } });
  const syncRail = () => { if (!isDrawer()) { $(".rail").inert = false; $(".backdrop").hidden = true; $(".rail").classList.remove("open"); } else if (!$(".rail").classList.contains("open")) $(".rail").inert = true; };
  window.addEventListener("resize", syncRail); syncRail();
  $(".skip").addEventListener("click", e => { e.preventDefault(); const hd = $(`#${Chapters.current} h2, #${Chapters.current} h1`); if (hd) { hd.tabIndex = -1; hd.focus(); } });
  window.addEventListener("hashchange", route); route();
});
