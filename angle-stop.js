/* Ram vinklen – stop den åbnende vinkel tættest muligt på målet. */
(() => {
  "use strict";

  const CORE = () => window.JacobAnglesCore;
  const EX_ID = "angle_stop";
  const EX_NAME = "Ram vinklen";
  const SPEED_DEG_PER_S = 18; // 180° / 10 s
  const MISS_AT = 180;
  const SCORE_ZERO_AT = 20; // ±20° → 0 points
  const TARGETS_PER_ROUND = 3;
  const STORAGE_BEST = "jm_angle_stop_best";
  const ROUND_INCREMENTS = () => CORE().ROUND_INCREMENTS; // 45,30,15,10,5

  function track(event, extra = {}) {
    try {
      window.jmTrack?.(event, { exercise_id: EX_ID, exercise_name: EX_NAME, ...extra });
    } catch (_) {}
  }

  function loadBest() {
    try {
      const n = Number(localStorage.getItem(STORAGE_BEST) || 0);
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBest(score) {
    try {
      const prev = loadBest();
      if (score > prev) localStorage.setItem(STORAGE_BEST, String(score));
    } catch (_) {}
  }

  /** 100 at exact, linear to 0 at ±SCORE_ZERO_AT. */
  function pointsForDelta(delta) {
    const d = Math.abs(Number(delta) || 0);
    if (d >= SCORE_ZERO_AT) return 0;
    return Math.round(100 * (1 - d / SCORE_ZERO_AT));
  }

  function tierLabel(delta) {
    const d = Math.abs(Number(delta) || 0);
    const sign = delta === 0 ? "±0°" : (delta > 0 ? `+${d}°` : `−${d}°`);
    if (d <= 3) return { text: `${sign} PERFEKT`, cls: "is-perfect" };
    if (d <= 8) return { text: `${sign} GODT`, cls: "is-good" };
    if (d <= 14) return { text: `${sign} TÆT PÅ`, cls: "is-ok" };
    if (d < SCORE_ZERO_AT) return { text: `${sign}`, cls: "is-ok" };
    return { text: `${sign} FORBI`, cls: "is-miss" };
  }

  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function mount(root, options = {}) {
    if (!root) return () => {};
    const core = CORE();
    if (!core) throw new Error("JacobAnglesCore mangler");

    let disposed = false;
    let raf = 0;
    let round = 0; // 0..4
    let targetIndex = 0; // 0..2 within round
    let target = 45;
    let baseDeg = 0;
    let current = 0;
    let running = false;
    let lastT = 0;
    let hideLive = false;
    let score = 0;
    let best = loadBest();
    let tasks = 0;
    let correct = 0; // stops within ±8°
    let startedAt = Date.now();
    let lastResult = null; // {actual, target, delta, pts, miss}
    let phase = "ready"; // ready | running | result | done

    track("exercise_start");

    root.innerHTML = `
      <section class="ang-module ag-game" data-ag-stop>
        <header class="ang-header">
          <div>
            <span class="ang-eyebrow">VINKEL-SPIL</span>
            <h1>Ram vinklen</h1>
            <p>Vinklen åbner – tryk STOP! når den rammer målet.</p>
          </div>
          <button type="button" class="ang-btn ang-quiet" data-ag="exit">← Tilbage</button>
        </header>
        <div class="ang-stage" data-ag-stage></div>
      </section>`;
    const stage = root.querySelector("[data-ag-stage]");

    function endTrack(completed) {
      track(completed ? "exercise_complete" : "exercise_end", {
        tasks_answered: tasks,
        correct_answers: correct,
        duration_seconds: (Date.now() - startedAt) / 1000,
      });
      if (completed) try { options.onComplete?.(); } catch (_) {}
    }

    function pickTarget() {
      const incs = ROUND_INCREMENTS();
      const inc = incs[Math.min(round, incs.length - 1)];
      const opts = core.anglesForIncrement(inc, 12).filter((a) => a >= inc && a < 180);
      // Prefer mid-range so the pupil has time to react
      const pool = opts.length ? opts : [inc, Math.min(180 - inc, inc * 2)];
      target = pool[Math.floor(Math.random() * pool.length)];
      baseDeg = round >= 1 ? Math.floor(Math.random() * 360) : 0;
      current = 0;
      lastResult = null;
      phase = "ready";
    }

    function drawFigure(degrees, opts = {}) {
      const size = 260;
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.38;
      const a0 = baseDeg;
      const a1 = baseDeg + degrees;
      const p0 = polar(cx, cy, r, a0);
      const p1 = polar(cx, cy, r, a1);
      const large = degrees > 180 ? 1 : 0;
      const arc = `M ${cx} ${cy} L ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 ${large} 0 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Z`;
      let overlay = "";
      if (opts.showTarget) {
        const t1 = polar(cx, cy, r, baseDeg + opts.targetDeg);
        const tArc = `M ${cx} ${cy} L ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 ${opts.targetDeg > 180 ? 1 : 0} 0 ${t1.x.toFixed(1)} ${t1.y.toFixed(1)} Z`;
        overlay = `<path d="${tArc}" fill="none" stroke="#e3a521" stroke-width="3" stroke-dasharray="6 4"/>
          <line x1="${cx}" y1="${cy}" x2="${t1.x.toFixed(1)}" y2="${t1.y.toFixed(1)}" stroke="#e3a521" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 4"/>`;
      }
      const liveLabel = opts.hideNumber
        ? ""
        : `<text x="${cx}" y="${cy + r + 28}" text-anchor="middle" font-size="22" font-weight="800" fill="#117e79">${Math.round(degrees)}°</text>`;
      return `<svg class="ag-stop-svg" viewBox="0 0 ${size} ${size + 36}" width="${size}" height="${size + 20}" aria-hidden="true">
        <circle cx="${cx}" cy="${cy}" r="${r + 12}" fill="#fff9ef" stroke="#d9cce8" stroke-width="2"/>
        <path d="${arc}" fill="#5b4bda44" stroke="none"/>
        ${overlay}
        <line x1="${cx}" y1="${cy}" x2="${p0.x.toFixed(1)}" y2="${p0.y.toFixed(1)}" stroke="#301946" stroke-width="5" stroke-linecap="round"/>
        <line x1="${cx}" y1="${cy}" x2="${p1.x.toFixed(1)}" y2="${p1.y.toFixed(1)}" stroke="#117e79" stroke-width="5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#e3a521"/>
        ${liveLabel}
      </svg>`;
    }

    function render() {
      const incs = ROUND_INCREMENTS();
      const inc = incs[Math.min(round, incs.length - 1)];
      const roundLabel = `Runde ${Math.min(round + 1, incs.length)} · trin ${inc}° · mål ${targetIndex + 1}/${TARGETS_PER_ROUND}`;

      if (phase === "done") {
        saveBest(score);
        best = loadBest();
        stage.innerHTML = `
          <div class="ang-finish">
            <div class="ang-finish-stars">★★★</div>
            <h2>Færdig!</h2>
            <p>Point: <strong>${score}</strong> · Bedste: <strong>${best}</strong></p>
            <p class="ang-sub">Rigtige stop (±8°): ${correct} / ${tasks}</p>
            <div class="ang-actions" style="margin-top:22px">
              <button type="button" class="ang-btn ang-teal" data-ag="again">Spil igen</button>
              <button type="button" class="ang-btn ang-quiet" data-ag="exit">Tilbage</button>
            </div>
          </div>`;
        endTrack(true);
        return;
      }

      let body = "";
      if (phase === "ready") {
        body = `
          <div class="ag-stop-figure">${drawFigure(0, { hideNumber: hideLive })}</div>
          <p class="ang-sub" style="text-align:center">${hideLive ? "Ingen live-tal – stop på fornemmelsen!" : "Vinklen starter ved 0° og åbner jævnt."}</p>
          <div class="ang-actions">
            <button type="button" class="ang-btn ang-teal" data-ag="go">Start</button>
          </div>`;
      } else if (phase === "running") {
        body = `
          <div class="ag-stop-figure" data-ag-figure>${drawFigure(current, { hideNumber: hideLive })}</div>
          <div class="ang-actions">
            <button type="button" class="ang-btn ag-stop-btn" data-ag="stop">STOP!</button>
          </div>`;
      } else if (phase === "result" && lastResult) {
        const tier = lastResult.miss
          ? { text: "FORBI – den nåede 180°", cls: "is-miss" }
          : tierLabel(lastResult.delta);
        body = `
          <div class="ag-stop-figure">${drawFigure(lastResult.actual, {
            hideNumber: false,
            showTarget: true,
            targetDeg: lastResult.target,
          })}</div>
          <div class="ag-stop-result ${tier.cls}" role="status">
            <div class="ag-stop-tier">${tier.text}</div>
            <p>Du stoppede på <strong>${Math.round(lastResult.actual)}°</strong> · mål <strong>${lastResult.target}°</strong></p>
            <p>+${lastResult.pts} point</p>
          </div>
          <div class="ang-actions">
            <button type="button" class="ang-btn ang-teal" data-ag="next">Næste</button>
          </div>`;
      }

      stage.innerHTML = `
        <div class="ag-stop-hud">
          <div>Point: <strong data-ag-score>${score}</strong></div>
          <div class="ag-stop-target">Stop ved <strong>${target}°</strong></div>
          <div>Bedste: <strong>${best}</strong></div>
        </div>
        <p class="ag-round" style="text-align:center">${roundLabel}</p>
        <div class="ang-actions">
          <button type="button" class="ang-btn ang-quiet" data-ag="toggle-degrees" aria-pressed="${!hideLive}">Vis grader: ${hideLive ? "Fra" : "Til"}</button>
        </div>
        ${body}`;
    }

    function tick(now) {
      if (disposed || !running || phase !== "running") return;
      const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
      lastT = now;
      current = Math.min(MISS_AT, current + SPEED_DEG_PER_S * dt);
      const fig = stage.querySelector("[data-ag-figure]");
      if (fig) fig.innerHTML = drawFigure(current, { hideNumber: hideLive });
      if (current >= MISS_AT - 0.001) {
        running = false;
        finishStop(MISS_AT, true);
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    function startRun() {
      current = 0;
      phase = "running";
      running = true;
      lastResult = null;
      render();
      lastT = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }

    function finishStop(actual, miss) {
      cancelAnimationFrame(raf);
      running = false;
      const snapped = Math.round(actual);
      const delta = snapped - target; // signed: positive = too far open
      const pts = miss ? 0 : pointsForDelta(delta);
      tasks += 1;
      if (!miss && Math.abs(delta) <= 8) correct += 1;
      score += pts;
      if (score > best) {
        saveBest(score);
        best = score;
      }
      lastResult = { actual: snapped, target, delta, pts, miss: !!miss };
      phase = "result";
      try {
        options.onResult?.({
          topic: "angles",
          prompt: `Stop ved ${target}°`,
          answer: String(snapped),
          correct: !miss && Math.abs(delta) <= 8,
          timeSpent: 0,
        });
      } catch (_) {}
      render();
    }

    function advance() {
      targetIndex += 1;
      if (targetIndex >= TARGETS_PER_ROUND) {
        targetIndex = 0;
        round += 1;
      }
      if (round >= ROUND_INCREMENTS().length) {
        phase = "done";
        render();
        return;
      }
      pickTarget();
      render();
    }

    function onClick(e) {
      const btn = e.target.closest("button");
      if (!btn || !root.contains(btn)) return;
      const act = btn.dataset.ag;
      if (act === "toggle-degrees" && phase !== "done") {
        hideLive = !hideLive;
        render();
        stage.querySelector('[data-ag="toggle-degrees"]')?.focus();
        return;
      }
      if (act === "exit") {
        cancelAnimationFrame(raf);
        running = false;
        if (phase !== "done") endTrack(false);
        options.onExit?.();
        return;
      }
      if (act === "again") {
        round = 0; targetIndex = 0; score = 0; tasks = 0; correct = 0;
        startedAt = Date.now();
        best = loadBest();
        pickTarget();
        render();
        return;
      }
      if (act === "go" && phase === "ready") { startRun(); return; }
      if (act === "stop" && phase === "running") {
        finishStop(current, false);
        return;
      }
      if (act === "next" && phase === "result") { advance(); return; }
    }

    root.addEventListener("click", onClick);
    pickTarget();
    render();

    return function dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    };
  }

  // Expose helpers for unit tests
  window.JacobAngleStop = { mount, pointsForDelta, tierLabel, SPEED_DEG_PER_S, SCORE_ZERO_AT };
})();
