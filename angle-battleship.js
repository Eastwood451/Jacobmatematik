/* Vinkel-slagskibe – tryk hurtigt på den rigtige vinkel (45–180°, ingen 0°). */
(() => {
  "use strict";

  const CORE = () => window.JacobAnglesCore;
  const EX_ID = "angle_battleship";
  const EX_NAME = "Vinkel-slagskibe";

  function track(event, extra = {}) {
    try {
      window.jmTrack?.(event, { exercise_id: EX_ID, exercise_name: EX_NAME, ...extra });
    } catch (_) {}
  }

  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function tileSvg(tile, size = 88) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;
    const a0 = tile.baseDeg;
    const a1 = tile.baseDeg + tile.degrees;
    const p0 = polar(cx, cy, r, a0);
    const p1 = polar(cx, cy, r, a1);
    const large = tile.degrees > 180 ? 1 : 0;
    // SVG y grows down; our polar flips y so increasing deg is CCW on screen → sweep 0.
    const arc = `M ${cx} ${cy} L ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 ${large} 0 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Z`;
    return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="#fff9ef" stroke="#d9cce8" stroke-width="1.5"/>
      <path d="${arc}" fill="#5b4bda33" stroke="none"/>
      <line x1="${cx}" y1="${cy}" x2="${p0.x.toFixed(1)}" y2="${p0.y.toFixed(1)}" stroke="#301946" stroke-width="3" stroke-linecap="round"/>
      <line x1="${cx}" y1="${cy}" x2="${p1.x.toFixed(1)}" y2="${p1.y.toFixed(1)}" stroke="#117e79" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="3.5" fill="#e3a521"/>
    </svg>`;
  }

  function fleetHtml(shipsLeft, label, side, justSank) {
    const ships = Array.from({ length: CORE().SHIP_COUNT }, (_, i) => {
      const sunk = i >= shipsLeft;
      const sinking = justSank && sunk && i === shipsLeft; // the ship that just went under
      return `<span class="ag-ship ${sunk ? "is-sunk" : ""} ${sinking ? "is-sinking" : ""}" title="${sunk ? "sænket" : "afloat"}">🚢</span>`;
    }).join("");
    return `<div class="ag-fleet ${justSank ? "is-splash" : ""}" data-side="${side}"><strong>${label}</strong><div class="ag-ships">${ships}</div><small>${shipsLeft} skib${shipsLeft === 1 ? "" : "e"} tilbage</small></div>`;
  }

  function mount(root, options = {}) {
    if (!root) return () => {};
    const core = CORE();
    if (!core) throw new Error("JacobAnglesCore mangler");

    let disposed = false;
    let mode = null; // "cpu" | "pvp"
    let round = 0; // 0..4
    let tiles = [];
    let target = 0;
    let playerShips = core.SHIP_COUNT;
    let foeShips = core.SHIP_COUNT;
    let frozenUntil = 0;
    let awaiting = false;
    let cpuTimer = 0;
    let startedAt = Date.now();
    let tasks = 0;
    let correct = 0;
    let winner = null;
    let lastMsg = "";
    let lastSinkSide = null;

    track("exercise_start");

    root.innerHTML = `
      <section class="ang-module ag-game" data-ag-battleship>
        <header class="ang-header">
          <div>
            <span class="ang-eyebrow">VINKEL-SPIL</span>
            <h1>Vinkel-slagskibe</h1>
            <p>Tryk hurtigt på den rigtige vinkel og sænk modstanderens skibe.</p>
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

    function renderMenu() {
      stage.innerHTML = `
        <h2 class="ang-stage-title">Vælg spiltype</h2>
        <p class="ang-sub">16 knapper med vinkler. Find den, der matcher målet – før din modstander!</p>
        <div class="ag-menu">
          <button type="button" class="ang-btn ang-teal" data-ag="mode-cpu">Mod computeren</button>
          <button type="button" class="ang-btn" data-ag="mode-pvp">2 spillere (samme skærm)</button>
        </div>
        <p class="ang-sub" style="margin-top:18px">Runder: 45° → 30° → 15° → 10° → 5°. Hvert rigtigt hurtige tryk sænker et skib.</p>`;
    }

    function startMatch(chosen) {
      mode = chosen;
      round = 0;
      playerShips = core.SHIP_COUNT;
      foeShips = core.SHIP_COUNT;
      winner = null;
      lastMsg = "";
      nextRound();
    }

    function nextRound() {
      if (winner) return renderWinner();
      if (round >= core.ROUND_INCREMENTS.length) {
        // sudden death on 5° if both still have ships
        round = core.ROUND_INCREMENTS.length - 1;
      }
      const inc = core.ROUND_INCREMENTS[Math.min(round, core.ROUND_INCREMENTS.length - 1)];
      // Always rotate tiles so duplicate angles look different (esp. round 1).
      tiles = core.makeAngleTiles(inc, 16, true);
      // Prefer a target that appears on the board
      const pool = [...new Set(tiles.map((t) => t.degrees))];
      target = pool[Math.floor(Math.random() * pool.length)];
      awaiting = true;
      frozenUntil = 0;
      lastSinkSide = null;
      clearTimeout(cpuTimer);
      renderBoard();
      if (mode === "cpu") scheduleCpu();
    }

    function scheduleCpu() {
      clearTimeout(cpuTimer);
      // Reaction scales with difficulty; occasional mistakes.
      const base = 1600 - round * 180;
      const jitter = 200 + Math.random() * 700;
      const delay = Math.max(450, base + jitter);
      cpuTimer = setTimeout(() => {
        if (disposed || !awaiting || winner) return;
        const mistake = Math.random() < 0.18 - round * 0.02;
        if (mistake) {
          lastMsg = "Computeren ramte forkert!";
          renderBoard();
          scheduleCpu();
          return;
        }
        resolveTap("cpu", true);
      }, delay);
    }

    function resolveTap(who, ok) {
      if (!awaiting || winner) return;
      const now = Date.now();
      if (who === "player" && now < frozenUntil) return;
      tasks += 1;
      if (!ok) {
        if (who === "player") {
          frozenUntil = now + 900;
          lastMsg = "Forkert! Du er frosset et øjeblik.";
          renderBoard();
        }
        return;
      }
      correct += 1;
      awaiting = false;
      clearTimeout(cpuTimer);
      if (who === "player") {
        foeShips = Math.max(0, foeShips - 1);
        lastMsg = "Ram! Du sænkede et skib 🚢💥";
        lastSinkSide = "foe";
      } else {
        playerShips = Math.max(0, playerShips - 1);
        lastMsg = mode === "cpu" ? "Computeren sænkede dit skib!" : "Spiller 2 sænkede et skib!";
        lastSinkSide = "you";
      }
      if (foeShips <= 0) {
        winner = "player";
        renderBoard();
        setTimeout(() => { if (!disposed) renderWinner(); }, 700);
        return;
      }
      if (playerShips <= 0) {
        winner = mode === "cpu" ? "cpu" : "p2";
        renderBoard();
        setTimeout(() => { if (!disposed) renderWinner(); }, 700);
        return;
      }
      round += 1;
      renderBoard();
      setTimeout(() => { if (!disposed && !winner) nextRound(); }, 850);
    }

    function renderBoard() {
      const inc = core.ROUND_INCREMENTS[Math.min(round, core.ROUND_INCREMENTS.length - 1)];
      const foeLabel = mode === "cpu" ? "Computer" : "Spiller 2";
      const youLabel = mode === "cpu" ? "Dig" : "Spiller 1";
      const frozen = Date.now() < frozenUntil;
      stage.innerHTML = `
        <div class="ag-hud">
          ${fleetHtml(playerShips, youLabel, "you", lastSinkSide === "you")}
          <div class="ag-target-wrap">
            <div class="ag-round">Runde ${Math.min(round + 1, 5)} · trin ${inc}°</div>
            <div class="ag-target" aria-live="assertive">Tryk på <strong>${target}°</strong></div>
            <p class="ag-msg" role="status">${lastMsg}${frozen ? " (frosset)" : ""}</p>
          </div>
          ${fleetHtml(foeShips, foeLabel, "foe", lastSinkSide === "foe")}
        </div>
        <div class="ag-grid ag-sea" role="group" aria-label="Vinkelknapper">
          ${tiles.map((t) => `
            <button type="button" class="ag-tile" data-ag-tile="${t.id}" data-deg="${t.degrees}" ${!awaiting || frozen ? "disabled" : ""}>
              ${tileSvg(t)}
              <span class="ag-tile-sr">${t.degrees} grader</span>
            </button>`).join("")}
        </div>
        ${mode === "pvp" ? `<p class="ang-sub" style="text-align:center">Spiller 1 trykker. Spiller 2: tryk <kbd>2</kbd> + knap, eller brug knappen herunder efter et tryk.</p>
          <div class="ag-actions"><button type="button" class="ang-btn ang-quiet" data-ag="p2-steal" ${!awaiting ? "disabled" : ""}>Spiller 2 snupper den rigtige</button></div>` : ""}`;
    }

    function renderWinner() {
      awaiting = false;
      clearTimeout(cpuTimer);
      const winText =
        winner === "player" ? (mode === "cpu" ? "Du vandt!" : "Spiller 1 vandt!") :
        winner === "cpu" ? "Computeren vandt!" : "Spiller 2 vandt!";
      stage.innerHTML = `
        <div class="ang-finish">
          <div class="ang-finish-stars">★★★</div>
          <h2>${winText}</h2>
          <p>Rigtige tryk: ${correct} / ${tasks}</p>
          <div class="ang-actions" style="margin-top:22px">
            <button type="button" class="ang-btn ang-teal" data-ag="again">Spil igen</button>
            <button type="button" class="ang-btn ang-quiet" data-ag="menu">Vælg mode</button>
            <button type="button" class="ang-btn ang-quiet" data-ag="exit">Tilbage</button>
          </div>
        </div>`;
      endTrack(winner === "player");
    }

    function onClick(e) {
      const btn = e.target.closest("button");
      if (!btn || !root.contains(btn)) return;
      const act = btn.dataset.ag;
      if (act === "exit") {
        clearTimeout(cpuTimer);
        if (!winner) endTrack(false);
        options.onExit?.();
        return;
      }
      if (act === "mode-cpu") { startMatch("cpu"); return; }
      if (act === "mode-pvp") { startMatch("pvp"); return; }
      if (act === "again") { startMatch(mode || "cpu"); return; }
      if (act === "menu") { winner = null; renderMenu(); return; }
      if (act === "p2-steal") {
        // P2 auto-hits the correct tile (hotseat helper on one tablet).
        resolveTap("cpu", true);
        return;
      }
      if (btn.dataset.agTile != null) {
        const deg = Number(btn.dataset.deg);
        resolveTap("player", deg === target);
        if (deg !== target) {
          // flash wrong
          btn.classList.add("is-wrong");
          setTimeout(() => btn.classList.remove("is-wrong"), 400);
        } else {
          btn.classList.add("is-right");
        }
      }
    }

    root.addEventListener("click", onClick);
    renderMenu();

    return function dispose() {
      disposed = true;
      clearTimeout(cpuTimer);
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    };
  }

  window.JacobAngleBattleship = { mount };
})();
