/* Dennis med bind for øjnene – top-down kommandoer med drej X° og gå N. */
(() => {
  "use strict";

  const CORE = () => window.JacobAnglesCore;
  const EX_ID = "dennis_blindfold";
  const EX_NAME = "Dennis med bind for øjnene";
  const CELL = 56;
  const TURN_CHIPS = [15, 30, 45, 60, 90, 120, 180];

  function track(event, extra = {}) {
    try {
      window.jmTrack?.(event, { exercise_id: EX_ID, exercise_name: EX_NAME, ...extra });
    } catch (_) {}
  }

  // Levels: grid w/h, start {x,y,heading}, goal {x,y}, walls [{x,y}], hint
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
    let cmds = []; // {type:'turn'|'go', dir?:'cw'|'ccw', deg?:n, steps?:n}
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
    let turnArc = null; // {from,to} while editing turn

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
      animating = false;
    }

    function cellBlocked(x, y) {
      const L = level();
      if (x < 0 || y < 0 || x >= L.w || y >= L.h) return true;
      return L.walls.some((w) => w.x === x && w.y === y);
    }

    function render() {
      const L = level();
      const W = L.w * CELL;
      const H = L.h * CELL;
      const easy = levelIndex < 3;
      updateTurnPreview();
      stage.innerHTML = `
        <div class="ag-dennis-top">
          <div>
            <h2 class="ang-stage-title">Bane ${levelIndex + 1} / ${LEVELS.length}</h2>
            <p class="ang-sub">${msg}</p>
          </div>
          <div class="ag-heading">Retning: <strong>${Math.round(dennis.h) % 360}°</strong></div>
        </div>
        <div class="ag-map-wrap">
          <svg class="ag-map" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Kort">
            <rect width="${W}" height="${H}" fill="#c8e6c9"/>
            ${Array.from({ length: L.w * L.h }, (_, i) => {
              const x = i % L.w, y = Math.floor(i / L.w);
              return `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="none" stroke="#a5d6a7" stroke-width="1"/>`;
            }).join("")}
            ${L.walls.map((w) => `<rect x="${w.x * CELL + 4}" y="${w.y * CELL + 4}" width="${CELL - 8}" height="${CELL - 8}" rx="8" fill="#5d4037"/>`).join("")}
            <text x="${L.goal.x * CELL + CELL / 2}" y="${L.goal.y * CELL + CELL / 2 + 6}" text-anchor="middle" font-size="28">🐟</text>
            ${trail.map((p, i) => i === 0 ? "" : `<circle cx="${p.x * CELL + CELL / 2}" cy="${p.y * CELL + CELL / 2}" r="4" fill="#117e7988"/>`).join("")}
            ${turnArc ? (() => {
              const cx = dennis.x * CELL + CELL / 2;
              const cy = dennis.y * CELL + CELL / 2;
              const r = 22;
              const a0 = turnArc.from;
              const a1 = turnArc.to;
              const p0 = { x: cx + r * Math.cos(a0 * Math.PI / 180), y: cy - r * Math.sin(a0 * Math.PI / 180) };
              const p1 = { x: cx + r * Math.cos(a1 * Math.PI / 180), y: cy - r * Math.sin(a1 * Math.PI / 180) };
              let delta = a1 - a0;
              while (delta > 180) delta -= 360;
              while (delta < -180) delta += 360;
              const large = Math.abs(delta) > 180 ? 1 : 0;
              const sweep = delta >= 0 ? 0 : 1;
              return `<path d="M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}" fill="none" stroke="#e3a521" stroke-width="3"/>`;
            })() : ""}
            ${easy && cmds.length ? ghostPath() : ""}
            <g transform="translate(${dennis.x * CELL + CELL / 2},${dennis.y * CELL + CELL / 2}) rotate(${-dennis.h})">
              <circle r="18" fill="#4fc3f7" stroke="#01579b" stroke-width="2"/>
              <text x="0" y="6" text-anchor="middle" font-size="20">🐧</text>
              <rect x="-14" y="-6" width="28" height="8" rx="3" fill="#301946" opacity=".85"/>
              <polygon points="18,0 28,-5 28,5" fill="#e3a521"/>
            </g>
          </svg>
        </div>
        <div class="ag-cmd-builder">
          <div class="ag-chips">
            <span class="ag-chip-label">Drej</span>
            <button type="button" class="ag-chip ${draftDir === "ccw" ? "is-on" : ""}" data-ag="dir-ccw">Mod uret</button>
            <button type="button" class="ag-chip ${draftDir === "cw" ? "is-on" : ""}" data-ag="dir-cw">Med uret</button>
            ${TURN_CHIPS.map((d) => `<button type="button" class="ag-chip ${draftDeg === d ? "is-on" : ""}" data-ag="deg" data-v="${d}">${d}°</button>`).join("")}
            <button type="button" class="ang-btn ang-teal ag-add" data-ag="add-turn" ${animating ? "disabled" : ""}>＋ Drej</button>
          </div>
          <div class="ag-chips">
            <span class="ag-chip-label">Gå</span>
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="ag-chip ${draftSteps === n ? "is-on" : ""}" data-ag="steps" data-v="${n}">${n}</button>`).join("")}
            <button type="button" class="ang-btn ang-teal ag-add" data-ag="add-go" ${animating ? "disabled" : ""}>＋ Gå</button>
          </div>
          <ol class="ag-cmd-list">${cmds.map((c, i) => `<li>${c.type === "turn" ? `Drej ${c.deg}° ${c.dir === "cw" ? "med uret" : "mod uret"}` : `Gå ${c.steps}`} <button type="button" data-ag="rm" data-i="${i}" ${animating ? "disabled" : ""}>×</button></li>`).join("") || "<li class='ag-empty'>Ingen ordrer endnu</li>"}</ol>
          <div class="ang-actions">
            <button type="button" class="ang-btn ang-teal" data-ag="run" ${animating || !cmds.length ? "disabled" : ""}>Gå!</button>
            <button type="button" class="ang-btn ang-quiet" data-ag="clear" ${animating ? "disabled" : ""}>Ryd</button>
            <button type="button" class="ang-btn ang-quiet" data-ag="reset" ${animating ? "disabled" : ""}>Nulstil Dennis</button>
          </div>
        </div>`;
    }

    function ghostPath() {
      // Simple preview of final pose after commands (no collision sim for ghost).
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

    function animateTo(target, ms) {
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
          render();
          if (p < 1) raf = requestAnimationFrame(tick);
          else { dennis = { ...target }; resolve(); }
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
          await animateTo({ x: dennis.x, y: dennis.y, h: toH }, 450 + c.deg * 2);
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
            await animateTo({ x: nx, y: ny, h: dennis.h }, 280);
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
