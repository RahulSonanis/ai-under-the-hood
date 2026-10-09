/* Sim engine: one live simulation per chapter that the learner drives.

   makeSim(figure, spec) builds the stage, controls, goal, "notice" line, stats, fun-fact toasts and the
   "Show me" tour inside <figure class="sim" id="...">, then runs the simulation while it is on screen.

   spec = {
     label:      aria label for the stage
     cams:       { default: {x,y,w,h}, <name>: {...} }      world-space camera rects (≈ 2:1)
     camsNarrow: same for phones (stage < 640 px wide)       optional
     camera(s):  -> name of the cam to use now                optional; eases between cams
     height(w):  -> stage height in px                        optional
     init(rand): -> initial state (use rand() for any randomness; it is seeded, so Reset repeats)
     controls:   [{ id, label, type: "range"|"choice"|"toggle"|"button", min, max, step, value,
                    options: [[value, label], ...], fmt: v => text, help: "short hint",
                    apply(state, value, sim) }]   apply runs on every change (and once at start)
     step(state, dt, sim)     advance by dt seconds of simulation time (called many times a second)
     draw(k, state, sim)      draw one frame with the scene kit (camera already applied)
     stats(state)  -> [[label, value, tone?], ...]   tone: "ok" | "hot" | "bad"
     goal: { text, check(state) -> { done: bool, progress: "12 / 30" } }
     notices: [{ id, when(state, sim) -> bool, say(state) -> html, once: true }]
              the first matching notice is shown in the "What just happened" line
     facts:   [{ id, when(state) -> bool, text: html, ref: "#ref-N" }]   fun facts, unlocked once
     warmup:  seconds of simulation to run before the first frame, so the scene starts "in progress"
     tour:    [{ say: html, set: { controlId: value }, act(state, sim), wait: seconds, until(state) }]
     publish(state) -> { key: text }    fills <span data-live="key"> anywhere in the chapter
     click(state, wx, wy, sim)          optional direct manipulation (world coordinates)
     speeds: [1, 4]                     optional speed choices (default [1, 3])
   }
   sim API: sim.state, sim.v (current control values), sim.set(id, value), sim.reset(), sim.say(html),
            sim.rand (seeded), sim.narrow, sim.kit, sim.time
*/
function makeSim(fig, spec) {
  fig.innerHTML = `
    <div class="sim-stage"><canvas aria-label="${esc(spec.label || "Simulation")}"></canvas><div class="sim-toasts" aria-live="polite"></div></div>
    <div class="sim-status">
      <div class="sim-goal"><span class="dot" aria-hidden="true"></span><span class="gt"></span><span class="gp"></span></div>
      <p class="sim-notice"></p><p class="sr sim-live" aria-live="polite"></p>
    </div>
    <div class="sim-panel">
      <div class="sim-controls"></div>
      <div class="sim-buttons">
        <button type="button" class="fbtn primary" data-a="play"></button>
        <button type="button" class="fbtn" data-a="reset">${ICON.again}<span>Reset</span></button>
        ${spec.tour ? `<button type="button" class="fbtn" data-a="tour">${ICON.play}<span>Show me</span></button>` : ""}
        <div class="seg sim-speed" role="group" aria-label="Simulation speed"></div>
      </div>
    </div>
    <div class="stats sim-stats"></div>`;
  const cv = $("canvas", fig), stage = $(".sim-stage", fig), k = sceneKit(cv), chap = fig.closest(".chapter");
  const S = { state: null, v: {}, kit: k, rand: null, narrow: false, time: 0, speed: 1, playing: !reduceMotion(), tour: null, seen: {}, noticeId: null };
  const seed = spec.seed || 7;
  const height = () => { const w = innerW(stage); return spec.height ? spec.height(w) : (w < 640 ? Math.round(Math.max(300, w * 0.95)) : Math.round(Math.min(580, Math.max(380, w * 0.52)))); };
  let camCur = null;

  // ---------- controls ----------
  const ctlBox = $(".sim-controls", fig);
  (spec.controls || []).forEach(c => {
    const id = fig.id + "-" + c.id; S.v[c.id] = c.value;
    const wrap = document.createElement("div"); wrap.className = "ctl sim-ctl sim-" + c.type;
    if (c.type === "range") {
      wrap.innerHTML = `<div class="row"><label for="${id}">${c.label}</label><output for="${id}"></output></div><input type="range" id="${id}" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${c.value}">${c.help ? `<small>${c.help}</small>` : ""}`;
      const el = $("input", wrap), out = $("output", wrap);
      const show = () => { const t = c.fmt ? c.fmt(+el.value) : el.value; out.textContent = t; el.setAttribute("aria-valuetext", t); };
      el.addEventListener("input", () => { userInput(); S.v[c.id] = +el.value; show(); c.apply && c.apply(S.state, +el.value, api); after(); }); show();
      c._set = v => { el.value = v; S.v[c.id] = +v; show(); };
    } else if (c.type === "choice") {
      wrap.innerHTML = `<span id="${id}-l">${c.label}</span><div class="seg" role="group" aria-labelledby="${id}-l">${c.options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === c.value}">${l}</button>`).join("")}</div>${c.help ? `<small>${c.help}</small>` : ""}`;
      const btns = $$("button", wrap), setUI = v => btns.forEach(b => b.setAttribute("aria-pressed", b.dataset.v === String(v) ? "true" : "false"));
      btns.forEach(b => b.addEventListener("click", () => { userInput(); const opt = c.options.find(o => String(o[0]) === b.dataset.v); S.v[c.id] = opt[0]; setUI(opt[0]); c.apply && c.apply(S.state, opt[0], api); after(); }));
      c._set = v => { S.v[c.id] = v; setUI(v); };
    } else if (c.type === "toggle") {
      wrap.innerHTML = `<label class="toggle"><input type="checkbox" id="${id}" ${c.value ? "checked" : ""}> ${c.label}</label>${c.help ? `<small>${c.help}</small>` : ""}`;
      const el = $("input", wrap);
      el.addEventListener("change", () => { userInput(); S.v[c.id] = el.checked; c.apply && c.apply(S.state, el.checked, api); after(); });
      c._set = v => { el.checked = !!v; S.v[c.id] = !!v; };
    } else if (c.type === "button") {
      wrap.innerHTML = `<button type="button" class="fbtn sim-act" id="${id}">${c.label}</button>${c.help ? `<small>${c.help}</small>` : ""}`;
      $("button", wrap).addEventListener("click", () => { userInput(); c.apply && c.apply(S.state, true, api); after(); });
      c._set = () => {};
    }
    ctlBox.appendChild(wrap);
  });
  function setCtl(id, v, silent) { const c = spec.controls.find(x => x.id === id); if (!c) return; c._set(v); if (c.type === "button") { c.apply && c.apply(S.state, true, api); } else { S.v[id] = v; c.apply && c.apply(S.state, v, api); } if (!silent) after(); }

  // ---------- buttons ----------
  const playBtn = $('[data-a="play"]', fig), tourBtn = $('[data-a="tour"]', fig);
  const paintPlay = () => { playBtn.innerHTML = (S.playing ? ICON.pause + "<span>Pause</span>" : ICON.play + "<span>Run</span>"); };
  playBtn.addEventListener("click", () => { S.playing = !S.playing; paintPlay(); if (S.playing) loop.start(); });
  $('[data-a="reset"]', fig).addEventListener("click", () => { stopTour(); reset(); });
  if (tourBtn) tourBtn.addEventListener("click", () => S.tour ? stopTour() : startTour());
  const speeds = spec.speeds || [1, 3];
  const sp = $(".sim-speed", fig); sp.innerHTML = speeds.map((x, i) => `<button type="button" data-v="${x}" aria-pressed="${i === 0}">${x}×</button>`).join("");
  seg(sp, v => { S.speed = +v; });

  // ---------- state ----------
  function reset() {
    S.rand = rng(seed); S.time = 0; S.seen = {}; S.noticeId = null; S.state = spec.init(S.rand, api);
    (spec.controls || []).forEach(c => { if (c.type !== "button" && c.apply) c.apply(S.state, S.v[c.id], api); });
    if (spec.warmup) { const n = Math.ceil(spec.warmup / 0.05); for (let i = 0; i < n; i++) spec.step(S.state, 0.05, api); }
    $(".sim-notice", fig).innerHTML = spec.intro || ""; after(); frame();
  }
  function userInput() { if (S.tour && !S.tourDriving) stopTour(); if (!S.playing && !reduceMotion()) { S.playing = true; paintPlay(); loop.start(); } }
  function after() { stats(); goal(); publish(); if (!S.playing) frame(); }

  // ---------- readouts ----------
  let statsHTML = "";
  function stats() {
    if (!spec.stats) return; const rows = spec.stats(S.state) || [];
    const html = rows.map(([l, v, tone]) => `<div class="${tone || ""}"><span class="v">${v}</span><span class="k">${l}</span></div>`).join("");
    if (html !== statsHTML) { $(".sim-stats", fig).innerHTML = html; statsHTML = html; }
  }
  let goalDone = false;
  function goal() {
    const g = spec.goal, box = $(".sim-goal", fig); if (!g) { box.hidden = true; return; }
    const r = g.check(S.state) || {}; $(".gt", box).innerHTML = (r.done ? "Goal reached: " : "Goal: ") + g.text; $(".gp", box).textContent = r.progress || "";
    box.classList.toggle("met", !!r.done);
    if (r.done && !goalDone) { goalDone = true; if (chap) markDone(chap.id); }
  }
  function publish() {
    if (!spec.publish || !chap) return; const vals = spec.publish(S.state) || {};
    Object.entries(vals).forEach(([key, val]) => $$(`[data-live="${key}"]`, chap).forEach(el => { if (el.textContent !== String(val)) el.textContent = val; }));
  }
  function notices() {
    if (S.tour) return;
    for (const n of spec.notices || []) {
      if (n.once && S.seen["n:" + n.id]) continue;
      if (n.when(S.state, api)) { const html = n.say(S.state); if (S.noticeId !== n.id) { S.noticeId = n.id; S.seen["n:" + n.id] = 1; say(html); } else { const el = $(".sim-notice", fig); if (el.innerHTML !== html) el.innerHTML = html; } return; }
    }
  }
  function say(html) { const el = $(".sim-notice", fig); el.innerHTML = html; $(".sim-live", fig).innerHTML = html; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  function facts() {
    for (const f of spec.facts || []) {
      if (S.time < (spec.factDelay || 6) || S.seen["f:" + f.id] || !f.when(S.state)) continue; S.seen["f:" + f.id] = 1;
      unlockFact(chap ? chap.id : "", f.id, f.text, f.ref);
      const t = document.createElement("div"); t.className = "fact-toast";
      t.innerHTML = `<b>Fun fact</b><p>${f.text}${f.ref ? ` <sup class="ref"><a href="${f.ref}">${f.ref.replace("#ref-", "")}</a></sup>` : ""}</p><button type="button" aria-label="Dismiss">×</button>`;
      $("button", t).addEventListener("click", () => t.remove());
      $(".sim-toasts", fig).appendChild(t); setTimeout(() => t.remove(), 14000);
      break;
    }
  }

  // ---------- tour ("Show me") ----------
  function startTour() {
    reset(); S.tour = { i: -1, t0: 0 }; tourBtn.innerHTML = ICON.pause + "<span>Stop tour</span>"; fig.classList.add("touring");
    if (!S.playing) { S.playing = true; paintPlay(); } loop.start(); nextTour();
  }
  function nextTour() {
    const T = S.tour; T.i++; const st = spec.tour[T.i];
    if (!st) { stopTour(); say("That's the tour. Now it's yours: change anything and watch what happens."); return; }
    T.t0 = S.time; S.tourDriving = true;
    if (st.set) Object.entries(st.set).forEach(([id, v]) => setCtl(id, v, true));
    if (st.act) st.act(S.state, api);
    S.tourDriving = false; after();
    say(`<span class="tour-n">${T.i + 1} / ${spec.tour.length}</span> ${st.say}`);
  }
  function tourTick() {
    const T = S.tour; if (!T) return; const st = spec.tour[T.i]; if (!st) return;
    const waited = S.time - T.t0, min = st.min || 2.5;
    if ((st.until && waited > min && st.until(S.state)) || (!st.until && waited >= (st.wait || 5)) || waited > (st.max || 30)) nextTour();
  }
  function stopTour() { if (!S.tour) return; S.tour = null; fig.classList.remove("touring"); if (tourBtn) tourBtn.innerHTML = ICON.play + "<span>Show me</span>"; }

  // ---------- drawing ----------
  function frame() {
    const h = height(); S.narrow = innerW(stage) < 640;
    const cams = S.narrow && spec.camsNarrow ? spec.camsNarrow : spec.cams;
    const want = cams[(spec.camera && spec.camera(S.state, api)) || "default"] || cams.default;
    camCur = camCur ? camLerp(camCur, want, reduceMotion() ? 1 : 0.12) : { ...want };
    k.begin(h, camCur, { grid: spec.grid });
    spec.draw(k, S.state, api);
  }
  let acc = 0;
  const loop = animLoop(dt => {
    if (!S.playing) { frame(); return S.tour ? undefined : false; }
    const h = Math.min(0.1, dt) * S.speed; const sub = Math.max(1, Math.ceil(h / 0.05));
    for (let i = 0; i < sub; i++) { spec.step(S.state, h / sub, api); S.time += h / sub; }
    acc += dt; if (acc > 0.15) { acc = 0; stats(); goal(); publish(); notices(); facts(); }
    tourTick(); frame();
  });
  // only run while the figure is on screen
  if ("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => { S.visible = e.isIntersecting; if (S.visible && S.playing) loop.start(); else if (!S.visible) loop.stop(); })).observe(fig);

  // direct manipulation
  cv.tabIndex = 0;
  if (spec.click) cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); const [wx, wy] = k.toWorld(e.clientX - r.left, e.clientY - r.top); userInput(); spec.click(S.state, wx, wy, api); after(); });
  cv.addEventListener("keydown", e => { if (e.key === " ") { e.preventDefault(); playBtn.click(); } });

  const api = {
    get state() { return S.state; }, get v() { return S.v; }, get rand() { return S.rand; }, get narrow() { return S.narrow; }, get time() { return S.time; }, kit: k,
    set: (id, v) => setCtl(id, v), reset, say, refresh: () => { after(); frame(); }, fig
  };
  paintPlay(); reset();
  onRedraw(() => { frame(); if (S.playing && S.visible !== false) loop.start(); });
  fig._sim = api;
  return api;
}

/* ---------- Fun facts collection (shown on the Fun facts page) ---------- */
function unlockFact(ch, id, text, ref) {
  const all = store.get("facts", {}); if (all[ch + ":" + id]) return;
  all[ch + ":" + id] = { ch, text, ref, at: Date.now() }; store.set("facts", all);
  document.dispatchEvent(new CustomEvent("factunlocked"));
}
