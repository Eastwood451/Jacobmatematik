/* Vinkel-ord – vælg det rigtige navn til vinklen (spids/ret/stump/lige). */
(() => {
  "use strict";

  const CORE = () => window.JacobAnglesCore;
  const EX_ID = "angle_words";
  const EX_NAME = "Vinkel-ord";

  // Clear angles first, then closer to boundaries. Occasional 180° for "lige".
  const EASY = [30, 45, 60, 90, 120, 135, 150, 180];
  const HARD = [20, 70, 80, 85, 95, 100, 110, 160, 170, 175, 180];
  const ROUNDS_TOTAL = 10;
  const ROUND_MS = 12000;

  function track(event, extra = {}) {
    try {
      window.jmTrack?.(event, { exercise_id: EX_ID, exercise_name: EX_NAME, ...extra });
    } catch (_) {}
  }

  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function angleSvg(degrees, baseDeg, size = 220) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.36;
    const a0 = baseDeg;
    const a1 = baseDeg + degrees;
    const p0 = polar(cx, cy, r, a0);
    const p1 = polar(cx, cy, r, a1);
    const large = degrees > 180 ? 1 : 0;
    const arc = `M ${cx} ${cy} L ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 ${large} 0 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Z`;
    let square = "";
    if (degrees === 90) {
      const s = r * 0.22;
      const q0 = polar(cx, cy, s, a0);
      const qMid = polar(cx, cy, s * Math.SQRT2, a0 + 45);
      const q1 = polar(cx, cy, s, a1);
      // Approximate right-angle mark as a small square along the rays
      const ux = (q0.x - cx) / s;
      const uy = (q0.y - cy) / s;
      const vx = (q1.x - cx) / s;
      const vy = (q1.y - cy) / s;
      const c1x = cx + ux * s;
      const c1y = cy + uy * s;
      const c2x = cx + ux * s + vx * s;
      const c2y = cy + uy * s + vy * s;
      const c3x = cx + vx * s;
      const c3y = cy + vy * s;
      square = `<path d="M ${c1x.toFixed(1)} ${c1y.toFixed(1)} L ${c2x.toFixed(1)} ${c2y.toFixed(1)} L ${c3x.toFixed(1)} ${c3y.toFixed(1)}" fill="none" stroke="#e3a521" stroke-width="3" stroke-linecap="square"/>`;
    }
    return `<svg class="ag-words-svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="#fff9ef" stroke="#d9cce8" stroke-width="2"/>
      <path d="${arc}" fill="#5b4bda44" stroke="none"/>
      <line x1="${cx}" y1="${cy}" x2="${p0.x.toFixed(1)}" y2="${p0.y.toFixed(1)}" stroke="#301946" stroke-width="5" stroke-linecap="round"/>
      <line x1="${cx}" y1="${cy}" x2="${p1.x.toFixed(1)}" y2="${p1.y.toFixed(1)}" stroke="#117e79" stroke-width="5" stroke-linecap="round"/>
      ${square}
      <circle cx="${cx}" cy="${cy}" r="5" fill="#e3a521"/>
    </svg>`;
  }

  function mount(root, options = {}) {
    if (!root) return () => {};
    const core = CORE();
    if (!core) throw new Error("JacobAnglesCore mangler");

    let disposed = false;
    let round = 0;
    let degrees = 30;
    let baseDeg = 0;
    let kind = "spids";
    let words = [];
    let locked = false;
    let streak = 0;
    let bestStreak = 0;
    let score = 0;
    let tasks = 0;
    let correct = 0;
    let startedAt = Date.now();
    let timerId = 0;
    let endsAt = 0;
    let revealDeg = false;
    let feedback = "";

    track("exercise_start");

    root.innerHTML = `
      <section class="ang-module ag-game" data-ag-words>
        <header class="ang-header">
          <div>
            <span class="ang-eyebrow">VINKEL-SPIL</span>
            <h1>Vinkel-ord</h1>
            <p>Hvad hedder vinklen? Spids, ret, stump eller lige.</p>
          </div>
          <button type="button" class="ang-btn ang-quiet" data-ag="exit">← Tilbage</button>
        </header>
        <div class="ang-stage" data-ag-stage></div>
      </section>`;
    const stage = root.querySelector("[data-ag-stage]");

    function endTrack(completed) {
      const duration_seconds = (Date.now() - startedAt) / 1000;
      track(completed ? "exercise_complete" : "exercise_end", {
        tasks_answered: tasks,
        correct_answers: correct,
        duration_seconds,
      });
      if (completed) {
        try { options.onComplete?.(); } catch (_) {}
      }
    }

    function pickDegrees(r) {
      const pool = r < 4 ? EASY : HARD;
      // Guarantee at least one lige early and one late
      if (r === 2 || r === 8) return 180;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function clearTimer() {
      if (timerId) clearInterval(timerId);
      timerId = 0;
    }

    function nextRound() {
      if (disposed) return;
      if (round >= ROUNDS_TOTAL) {
        renderDone();
        return;
      }
      locked = false;
      revealDeg = false;
      feedback = "";
      degrees = pickDegrees(round);
      // Exclude degenerate 0°
      if (degrees <= 0) degrees = 30;
      baseDeg = Math.floor(Math.random() * 360);
      kind = core.nameAngleKind(degrees);
      words = core.wordsForRound(kind);
      const sec = root.querySelector("[data-ag-words]");
      if (sec) sec.dataset.agCorrect = kind;
      endsAt = Date.now() + ROUND_MS;
      clearTimer();
      timerId = setInterval(() => {
        if (disposed || locked) return;
        const left = endsAt - Date.now();
        const bar = stage.querySelector("[data-ag-timer]");
        if (bar) bar.style.width = `${Math.max(0, (left / ROUND_MS) * 100)}%`;
        if (left <= 0) onTimeout();
      }, 100);
      renderPlay();
    }

    function onTimeout() {
      if (locked) return;
      locked = true;
      streak = 0;
      tasks += 1;
      revealDeg = true;
      feedback = `Tiden løb ud. Det var en ${kind} vinkel (${degrees}°). ${core.explainAngleKind(kind)}`;
      try {
        options.onResult?.({ topic: "angles", exercise_id: EX_ID, ok: false, degrees, kind });
      } catch (_) {}
      renderPlay();
      setTimeout(() => { round += 1; nextRound(); }, 1800);
    }

    function onPick(word) {
      if (locked) return;
      locked = true;
      clearTimer();
      tasks += 1;
      const ok = word === kind;
      if (ok) {
        correct += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        const left = Math.max(0, endsAt - Date.now());
        const speedBonus = Math.round((left / ROUND_MS) * 40);
        score += 100 + speedBonus + Math.min(50, streak * 10);
        feedback = `Rigtigt! ${kind[0].toUpperCase() + kind.slice(1)} vinkel. Streak ${streak} · +${100 + speedBonus}`;
        revealDeg = false;
      } else {
        streak = 0;
        revealDeg = true;
        feedback = `Ikke ${word}. ${core.explainAngleKind(kind)} Vinklen er ${degrees}°.`;
      }
      try {
        options.onResult?.({ topic: "angles", exercise_id: EX_ID, ok, degrees, kind, picked: word });
      } catch (_) {}
      renderPlay();
      setTimeout(() => { round += 1; nextRound(); }, ok ? 900 : 2000);
    }

    function renderPlay() {
      const leftPct = locked ? 0 : Math.max(0, ((endsAt - Date.now()) / ROUND_MS) * 100);
      const degLabel = revealDeg ? `<span class="ag-words-deg">${degrees}°</span>` : `<span class="ag-words-deg is-hidden" aria-hidden="true">?</span>`;
      stage.innerHTML = `
        <div class="ag-words-hud">
          <span>Runde ${round + 1}/${ROUNDS_TOTAL}</span>
          <span>Point ${score}</span>
          <span>Streak ${streak}</span>
        </div>
        <div class="ag-words-timer"><i data-ag-timer style="width:${leftPct}%"></i></div>
        <h2 class="ang-stage-title">Hvad hedder vinklen?</h2>
        <div class="ag-words-figure">
          ${angleSvg(degrees, baseDeg)}
          ${degLabel}
        </div>
        <div class="ag-words-grid" role="group" aria-label="Vælg vinkel-navn">
          ${words.map((w) => {
            let cls = "ag-words-btn";
            if (locked) {
              if (w === kind) cls += " is-right";
              else cls += " is-dim";
            }
            return `<button type="button" class="${cls}" data-ag-word="${w}" ${locked ? "disabled" : ""}>${w}</button>`;
          }).join("")}
        </div>
        <p class="ag-msg" data-ag-msg>${feedback || "Tryk på det rigtige ord – hurtigt!"}</p>`;
      // Mark wrong picked more clearly via feedback text; highlight correct always when locked
    }

    function renderDone() {
      clearTimer();
      endTrack(true);
      stage.innerHTML = `
        <div class="ang-finish">
          <h2>Færdig!</h2>
          <p>Du fik <strong>${correct}</strong> rigtige ud af ${tasks} · Point <strong>${score}</strong> · Bedste streak <strong>${bestStreak}</strong></p>
          <p class="ang-sub">Spids &lt; 90° · Ret = 90° · Stump mellem 90° og 180° · Lige = 180°</p>
          <div class="ang-actions">
            <button type="button" class="ang-btn ang-teal" data-ag="again">Spil igen</button>
            <button type="button" class="ang-btn ang-quiet" data-ag="exit">Tilbage</button>
          </div>
        </div>`;
    }

    function onClick(e) {
      const btn = e.target.closest("button");
      if (!btn || !root.contains(btn)) return;
      if (btn.dataset.ag === "exit") {
        clearTimer();
        endTrack(false);
        options.onExit?.();
        return;
      }
      if (btn.dataset.ag === "again") {
        round = 0;
        streak = 0;
        score = 0;
        tasks = 0;
        correct = 0;
        bestStreak = 0;
        startedAt = Date.now();
        track("exercise_start");
        nextRound();
        return;
      }
      if (btn.dataset.agWord) onPick(btn.dataset.agWord);
    }

    root.addEventListener("click", onClick);
    nextRound();

    return function dispose() {
      disposed = true;
      clearTimer();
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    };
  }

  window.JacobAngleWords = { mount };
})();
