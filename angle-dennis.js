/* Dennis med bind for øjnene – top-down kommandoer med drej X° og gå N. */
(() => {
  "use strict";

  const CORE = () => window.JacobAnglesCore;
  const EX_ID = "dennis_blindfold";
  const EX_NAME = "Dennis med bind for øjnene";
  const CELL = 60;
  const TURN_CHIPS = [15, 30, 45, 60, 90, 120, 180];
  const DENNIS_SRC = "assets/figurer/divisions-dennis.webp";

  function track(event, extra = {}) {
    try {
      window.jmTrack?.(event, { exercise_id: EX_ID, exercise_name: EX_NAME, ...extra });
    } catch (_) {}
  }

  // heading: 0=east, 90=north, 180=west, 270=south (math CCW)
  const LEVELS = [
    { w: 7, h: 5, start: { x: 1, y: 2, h: 0 }, goal: { x: 5, y: 2 }, walls: [], hint: "Drej ikke – gå bare frem til fisken." },
    { w: 7, h: 5, start: { x: 1, y: 3, h: 0 }, goal: { x: 5, y: 1 }, walls: [], hint: "Drej 90° mod uret, og gå frem." },
    { w: 8, h: 6, start: { x: 1, y: 4, h: 90 }, goal: { x: 6, y: 1 }, walls: [{ x: 3, y: 3 }, { x: 3, y: 2 }], hint: "Pas på klipperne. Prøv 45° eller 90°." },
    { w: 8, h: 6, start: { x: 1, y: 1, h: 0 }, goal: { x: 6, y: 4 }, walls: [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 4 }], hint: "Flere drej. Brug 30° og 60°." },
    { w: 9, h: 7, start: { x: 1, y: 5, h: 0 }, goal: { x: 7, y: 1 }, walls: [{ x: 3, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }], hint: "Zigzag udenom forhindringerne." },
    { w: 9, h: 7, start: { x: 4, y: 5, h: 90 }, goal: { x: 4, y: 1 }, walls: [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }], hint: "Du skal rundt om muren – ikke igennem." },
    { w: 10, h: 7, start: { x: 1, y: 3, h: 0 }, goal: { x: 8, y: 3 }, walls: [{ x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 6, y: 1 }, { x: 6, y: 5 }], hint: "Begrænset plads. Tænk i 45°-drej." },
    { w: 10, h: 8, start: { x: 1, y: 6, h: 90 }, goal: { x: 8, y: 1 }, walls: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 5 }, { x: 7, y: 5 }], hint: "Sidste niveau: flere drej i træk." },
  ];

  function mount(root, options = {}) {
    if (!root) return () => {};
    const core = CORE();
    if (!core) throw new Error("JacobAnglesCore mangler");

    let disposed = false;
    let levelIndex = 0;
    let cmds = [];
    let draftDir = "ccw";
    let draftDeg = 90;
    let draftSteps = 2;
    let animating = false;
    let dennis = { x: 0, y: 0, h: 0 };
    let trail = [];
    let msg = "";
    let raf = 0;
    let startedAt = Date.now();
    let tasks = 0;
    let correct = 0;
    let turnArc = null;
    let turnLabel = null; // {cx,cy,deg} shown during turn
    let waddle = 0;
    let sparkle = 0;

    track("exercise_start");

    root.innerHTML = `
      <section class="ang-module ag-game" data-ag-dennis>
        <header class="ang-header">
          <div>
            <span class="ang-eyebrow">VINKEL-SPIL</span>
            <h1>Dennis med bind for øjnene</h1>
            <p>Giv ordrer: drej og gå – så finder Dennis fisken.</p>
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

    function level() { return LEVELS[levelIndex]; }

    function resetDennis() {
      const L = level();
      dennis = { x: L.start.x, y: L.start.y, h: L.start.h };
      trail = [{ x: dennis.x, y: dennis.y }];
      cmds = [];
      msg = L.hint;
      turnArc = null;
      turnLabel = null;
      animating = false;
      waddle = 0;
    }

    function cellBlocked(x, y) {
      const L = level();
      if (x < 0 || y < 0 || x >= L.w || y >= L.h) return true;
      return L.walls.some((w) => w.x === x && w.y === y);
    }

    function cmdChip(c, i) {
      if (c.type === "turn") {
        const arrow = c.dir === "cw" ? "↻" : "↺";
        return `<li class="ag-cmd-chip" data-kind="turn"><span>${arrow} ${c.deg}°</span><button type="button" data-ag="rm" data-i="${i}" aria-label="Slet" ${animating ? "disabled" : ""}>×</button></li>`;
      }
      return `<li class="ag-cmd-chip" data-kind="go"><span>Gå ${c.steps}</span><button type="button" data-ag="rm" data-i="${i}" aria-label="Slet" ${animating ? "disabled" : ""}>×</button></li>`;
    }

    function terrainDefs(W, H) {
      return `
        <defs>
          <linearGradient id="agSnow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e8f4ff"/>
            <stop offset="100%" stop-color="#c5e0f5"/>
          </linearGradient>
          <radialGradient id="agFishGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffe082" stop-opacity=".9"/>
            <stop offset="100%" stop-color="#ffe082" stop-opacity="0"/>
          </radialGradient>
          <filter id="agSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".25"/>
          </filter>
        </defs>`;
    }

    function rockSvg(w) {
      const x = w.x * CELL + 6;
      const y = w.y * CELL + 10;
      const s = CELL - 12;
      // Mix of rock and igloo-ish obstacle
      if ((w.x + w.y) % 2 === 0) {
        return `<g filter="url(#agSoft)">
          <ellipse cx="${x + s / 2}" cy="${y + s * 0.72}" rx="${s * 0.42}" ry="${s * 0.18}" fill="#90a4ae"/>
          <path d="M ${x + 4} ${y + s * 0.7} Q ${x + s / 2} ${y + 2} ${x + s - 4} ${y + s * 0.7} Z" fill="#78909c"/>
          <path d="M ${x + 10} ${y + s * 0.55} Q ${x + s / 2} ${y + 14} ${x + s - 10} ${y + s * 0.55}" fill="none" stroke="#546e7a" stroke-width="2"/>
        </g>`;
      }
      return `<g filter="url(#agSoft)">
        <path d="M ${x + 6} ${y + s * 0.75} A ${s * 0.42} ${s * 0.42} 0 0 1 ${x + s - 6} ${y + s * 0.75} L ${x + s - 6} ${y + s * 0.8} L ${x + 6} ${y + s * 0.8} Z" fill="#eceff1"/>
        <rect x="${x + s * 0.38}" y="${y + s * 0.55}" width="${s * 0.24}" height="${s * 0.25}" rx="3" fill="#37474f"/>
        <ellipse cx="${x + s / 2}" cy="${y + s * 0.78}" rx="${s * 0.4}" ry="${s * 0.1}" fill="#b0bec5"/>
      </g>`;
    }

    function dennisSvg() {
      const bob = Math.sin(waddle) * 3;
      const lean = Math.sin(waddle * 0.5) * 4;
      return `
        <g class="ag-dennis-sprite" transform="translate(${dennis.x * CELL + CELL / 2},${dennis.y * CELL + CELL / 2 + bob}) rotate(${-dennis.h + lean})">
          <!-- heading arrow -->
          <polygon points="26,0 38,-7 38,7" fill="#e3a521" stroke="#301946" stroke-width="1"/>
          <circle r="26" fill="#ffffffee" stroke="#4fc3f7" stroke-width="3"/>
          <clipPath id="agDennisClip"><circle r="24"/></clipPath>
          <image href="${DENNIS_SRC}" x="-24" y="-30" width="48" height="72" clip-path="url(#agDennisClip)" preserveAspectRatio="xMidYMin slice"/>
          <!-- blindfold -->
          <rect x="-22" y="-6" width="44" height="11" rx="3" fill="#301946" opacity=".92"/>
          <rect x="-22" y="-3" width="44" height="4" fill="#5b4bda"/>
          <text data-i18n-key="angles_dennis_marker" x="0" y="34" text-anchor="middle" font-size="9" font-weight="800" fill="#01579b" font-family="system-ui">${window.JacobI18n && JacobI18n.has("angles_dennis_marker") ? JacobI18n.t("angles_dennis_marker") : "Dennis"}</text>
        </g>`;
    }

    function render() {
      const L = level();
      const W = L.w * CELL;
      const H = L.h * CELL;
      const easy = levelIndex < 3;
      updateTurnPreview();
      sparkle = (sparkle + 1) % 360;
      stage.innerHTML = `
        <div class="ag-dennis-top">
          <div>
            <h2 class="ang-stage-title">Bane ${levelIndex + 1} / ${LEVELS.length}</h2>
            <p class="ang-sub">${msg}</p>
          </div>
          <div class="ag-heading">Retning: <strong>${Math.round(((dennis.h % 360) + 360) % 360)}°</strong></div>
        </div>
        <div class="ag-map-wrap ag-map-snow">
          <svg class="ag-map" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Snekort">
            ${terrainDefs(W, H)}
            <rect width="${W}" height="${H}" fill="url(#agSnow)"/>
            ${Array.from({ length: L.w * L.h }, (_, i) => {
              const x = i % L.w, y = Math.floor(i / L.w);
              const flake = (x * 13 + y * 7) % 5 === 0
                ? `<circle cx="${x * CELL + 14}" cy="${y * CELL + 18}" r="1.4" fill="#ffffffaa"/>`
                : "";
              return `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="none" stroke="#90caf980" stroke-width="1"/>${flake}`;
            }).join("")}
            ${L.walls.map(rockSvg).join("")}
            <!-- fish goal with sparkle -->
            <circle cx="${L.goal.x * CELL + CELL / 2}" cy="${L.goal.y * CELL + CELL / 2}" r="26" fill="url(#agFishGlow)"/>
            <text x="${L.goal.x * CELL + CELL / 2}" y="${L.goal.y * CELL + CELL / 2 + 8}" text-anchor="middle" font-size="30">🐟</text>
            ${trail.map((p, i) => {
              if (i === 0) return "";
              const prev = trail[i - 1];
              // footprint pair
              return `<g opacity="${0.35 + (i / trail.length) * 0.5}">
                <ellipse cx="${p.x * CELL + CELL / 2 - 5}" cy="${p.y * CELL + CELL / 2}" rx="4" ry="6" fill="#117e79" transform="rotate(${i * 20} ${p.x * CELL + CELL / 2} ${p.y * CELL + CELL / 2})"/>
                <ellipse cx="${p.x * CELL + CELL / 2 + 5}" cy="${p.y * CELL + CELL / 2}" rx="4" ry="6" fill="#117e79" transform="rotate(${i * 20} ${p.x * CELL + CELL / 2} ${p.y * CELL + CELL / 2})"/>
              </g>`;
            }).join("")}
            ${turnArc ? (() => {
              const cx = dennis.x * CELL + CELL / 2;
              const cy = dennis.y * CELL + CELL / 2;
              const r = 28;
              const a0 = turnArc.from;
              const a1 = turnArc.to;
              const p0 = { x: cx + r * Math.cos(a0 * Math.PI / 180), y: cy - r * Math.sin(a0 * Math.PI / 180) };
              const p1 = { x: cx + r * Math.cos(a1 * Math.PI / 180), y: cy - r * Math.sin(a1 * Math.PI / 180) };
              let delta = a1 - a0;
              while (delta > 180) delta -= 360;
              while (delta < -180) delta += 360;
              const large = Math.abs(delta) > 180 ? 1 : 0;
              const sweep = delta >= 0 ? 0 : 1;
              const mid = a0 + delta / 2;
              const lx = cx + (r + 16) * Math.cos(mid * Math.PI / 180);
              const ly = cy - (r + 16) * Math.sin(mid * Math.PI / 180);
              const shown = turnLabel ? turnLabel.deg : Math.round(Math.abs(delta));
              return `<path d="M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}" fill="none" stroke="#e3a521" stroke-width="4" stroke-linecap="round"/>
                <text x="${lx}" y="${ly}" text-anchor="middle" font-size="13" font-weight="800" fill="#e3a521">${shown}°</text>`;
            })() : ""}
            ${easy && cmds.length ? ghostPath() : ""}
            ${dennisSvg()}
          </svg>
        </div>
        <div class="ag-cmd-builder">
          <div class="ag-chips">
            <span class="ag-chip-label">Drej</span>
            <button type="button" class="ag-chip ${draftDir === "ccw" ? "is-on" : ""}" data-ag="dir-ccw">↺ Mod uret</button>
            <button type="button" class="ag-chip ${draftDir === "cw" ? "is-on" : ""}" data-ag="dir-cw">↻ Med uret</button>
            ${TURN_CHIPS.map((d) => `<button type="button" class="ag-chip ${draftDeg === d ? "is-on" : ""}" data-ag="deg" data-v="${d}">${d}°</button>`).join("")}
            <button type="button" class="ang-btn ang-teal ag-add" data-ag="add-turn" ${animating ? "disabled" : ""}>＋ Drej</button>
          </div>
          <div class="ag-chips">
            <span class="ag-chip-label">Gå</span>
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="ag-chip ${draftSteps === n ? "is-on" : ""}" data-ag="steps" data-v="${n}">${n}</button>`).join("")}
            <button type="button" class="ang-btn ang-teal ag-add" data-ag="add-go" ${animating ? "disabled" : ""}>＋ Gå</button>
          </div>
          <ol class="ag-cmd-list ag-cmd-chips">${cmds.map(cmdChip).join("") || "<li class='ag-empty'>Ingen ordrer endnu – tilføj drej og gå</li>"}</ol>
          <div class="ang-actions">
            <button type="button" class="ang-btn ang-teal" data-ag="run" ${animating || !cmds.length ? "disabled" : ""}>Gå!</button>
            <button type="button" class="ang-btn ang-quiet" data-ag="clear" ${animating ? "disabled" : ""}>Ryd</button>
            <button type="button" class="ang-btn ang-quiet" data-ag="reset" ${animating ? "disabled" : ""}>Nulstil Dennis</button>
          </div>
        </div>`;
    }

    function ghostPath() {
      let x = dennis.x, y = dennis.y, h = dennis.h;
      const pts = [`${x * CELL + CELL / 2},${y * CELL + CELL / 2}`];
      for (const c of cmds) {
        if (c.type === "turn") {
          h = core.normalizeDeg(h + (c.dir === "cw" ? -c.deg : c.deg));
        } else {
          const rad = (h * Math.PI) / 180;
          for (let s = 0; s < c.steps; s++) {
            x += Math.cos(rad);
            y -= Math.sin(rad);
            pts.push(`${x * CELL + CELL / 2},${y * CELL + CELL / 2}`);
          }
        }
      }
      return `<polyline points="${pts.join(" ")}" fill="none" stroke="#5b4bda66" stroke-width="3" stroke-dasharray="6 6"/>`;
    }

    function updateTurnPreview() {
      turnArc = {
        from: dennis.h,
        to: core.normalizeDeg(dennis.h + (draftDir === "cw" ? -draftDeg : draftDeg)),
      };
    }

    function animateTo(target, ms, opts = {}) {
      return new Promise((resolve) => {
        const from = { x: dennis.x, y: dennis.y, h: dennis.h };
        const start = performance.now();
        const tick = (now) => {
          if (disposed) return resolve();
          const p = Math.min(1, (now - start) / ms);
          const e = 1 - Math.pow(1 - p, 3);
          dennis.x = from.x + (target.x - from.x) * e;
          dennis.y = from.y + (target.y - from.y) * e;
          let dh = target.h - from.h;
          while (dh > 180) dh -= 360;
          while (dh < -180) dh += 360;
          dennis.h = core.normalizeDeg(from.h + dh * e);
          if (opts.waddle) waddle = p * Math.PI * 4 * (opts.steps || 1);
          if (opts.turnDeg != null) {
            turnLabel = { deg: Math.round(Math.abs(dh) * e) };
          }
          render();
          if (p < 1) raf = requestAnimationFrame(tick);
          else {
            dennis = { ...target };
            turnLabel = null;
            waddle = 0;
            resolve();
          }
        };
        raf = requestAnimationFrame(tick);
      });
    }

    const runCommands = async () => {
      if (animating || !cmds.length) return;
      const saved = cmds.slice();
      animating = true;
      tasks += 1;
      const L = level();
      dennis = { x: L.start.x, y: L.start.y, h: L.start.h };
      trail = [{ x: dennis.x, y: dennis.y }];
      cmds = saved;
      msg = "Dennis går…";
      turnArc = null;
      render();

      let failed = false;
      for (const c of saved) {
        if (disposed) return;
        if (c.type === "turn") {
          const toH = core.normalizeDeg(dennis.h + (c.dir === "cw" ? -c.deg : c.deg));
          turnArc = { from: dennis.h, to: toH };
          await animateTo({ x: dennis.x, y: dennis.y, h: toH }, 480 + c.deg * 3, { turnDeg: c.deg });
          turnArc = null;
        } else {
          for (let s = 0; s < c.steps; s++) {
            const rad = (dennis.h * Math.PI) / 180;
            const nx = Math.round(dennis.x + Math.cos(rad));
            const ny = Math.round(dennis.y - Math.sin(rad));
            if (cellBlocked(nx, ny)) {
              msg = "Av! Dennis gik ind i noget.";
              const bx = dennis.x, by = dennis.y;
              await animateTo({ x: bx + Math.cos(rad) * 0.3, y: by - Math.sin(rad) * 0.3, h: dennis.h }, 100);
              await animateTo({ x: bx, y: by, h: dennis.h }, 120);
              failed = true;
              break;
            }
            await animateTo({ x: nx, y: ny, h: dennis.h }, 320, { waddle: true, steps: 1 });
            trail.push({ x: nx, y: ny });
          }
        }
        if (failed) break;
      }

      animating = false;
      const atGoal = Math.round(dennis.x) === L.goal.x && Math.round(dennis.y) === L.goal.y;
      if (atGoal && !failed) {
        correct += 1;
        msg = "Yes! Dennis fandt fisken! 🐟";
        render();
        try {
          await options.onResult?.({
            topic: "angles",
            prompt: `Dennis bane ${levelIndex + 1}`,
            answer: saved.map((c) => (c.type === "turn" ? `drej ${c.deg}` : `gå ${c.steps}`)).join(", "),
            correct: true,
            timeSpent: 0,
          });
        } catch (_) {}
        setTimeout(() => {
          if (disposed) return;
          if (levelIndex >= LEVELS.length - 1) {
            endTrack(true);
            stage.innerHTML = `
              <div class="ang-finish">
                <div class="ang-finish-stars">★★★</div>
                <h2>Alle baner klaret!</h2>
                <p>Dennis kan finde vej med grader.</p>
                <div class="ang-actions" style="margin-top:22px">
                  <button type="button" class="ang-btn ang-teal" data-ag="restart">Fra starten</button>
                  <button type="button" class="ang-btn ang-quiet" data-ag="exit">Tilbage</button>
                </div>
              </div>`;
          } else {
            levelIndex += 1;
            resetDennis();
            render();
          }
        }, 900);
      } else {
        if (!failed) msg = "Ikke fremme endnu – prøv andre ordrer.";
        render();
      }
    };

    function onClick(e) {
      const btn = e.target.closest("button");
      if (!btn || !root.contains(btn)) return;
      const act = btn.dataset.ag;
      if (act === "exit") {
        cancelAnimationFrame(raf);
        endTrack(false);
        options.onExit?.();
        return;
      }
      if (act === "restart") { levelIndex = 0; resetDennis(); render(); return; }
      if (act === "dir-cw") { draftDir = "cw"; updateTurnPreview(); render(); return; }
      if (act === "dir-ccw") { draftDir = "ccw"; updateTurnPreview(); render(); return; }
      if (act === "deg") { draftDeg = Number(btn.dataset.v); updateTurnPreview(); render(); return; }
      if (act === "steps") { draftSteps = Number(btn.dataset.v); render(); return; }
      if (act === "add-turn") {
        cmds.push({ type: "turn", dir: draftDir, deg: draftDeg });
        render();
        return;
      }
      if (act === "add-go") {
        cmds.push({ type: "go", steps: draftSteps });
        render();
        return;
      }
      if (act === "rm") {
        cmds.splice(Number(btn.dataset.i), 1);
        render();
        return;
      }
      if (act === "clear") { cmds = []; render(); return; }
      if (act === "reset") { resetDennis(); render(); return; }
      if (act === "run") void runCommands();
    }

    root.addEventListener("click", onClick);
    resetDennis();
    render();

    return function dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    };
  }

  window.JacobAngleDennis = { mount };
})();
