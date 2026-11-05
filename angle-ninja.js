/* Villy Vinkelninja – Fruit Ninja-agtigt vinkelsnit. */
(() => {
  "use strict";

  const CORE = () => window.JacobAnglesCore;
  const EX_ID = "angle_ninja";
  const EX_NAME = "Villy Vinkelninja";

  function track(event, extra = {}) {
    try {
      window.jmTrack?.(event, { exercise_id: EX_ID, exercise_name: EX_NAME, ...extra });
    } catch (_) {}
  }

  const KINDS = [
    { id: "tatami", emoji: "🥋", label: "tatami", color: "#c4a574" },
    { id: "melon", emoji: "🍉", label: "vandmelon", color: "#e85d75" },
    { id: "pizza", emoji: "🍕", label: "pizza", color: "#f0c14a" },
    { id: "bamboo", emoji: "🎋", label: "bambus", color: "#7cb342" },
  ];

  function mount(root, options = {}) {
    if (!root) return () => {};
    const core = CORE();
    if (!core) throw new Error("JacobAnglesCore mangler");

    let disposed = false;
    let running = false;
    let raf = 0;
    let canvas, ctx;
    let W = 720, H = 480;
    let objects = [];
    let particles = [];
    let score = 0;
    let lives = 3;
    let combo = 0;
    let wave = 0; // 0:45, 1:30, 2:15
    let target = 45;
    let spawnTimer = 0;
    let lastT = 0;
    let swipe = null;
    let feedback = null;
    let startedAt = Date.now();
    let tasks = 0;
    let correct = 0;
    let gameOver = false;

    track("exercise_start");

    root.innerHTML = `
      <section class="ang-module ag-game ag-ninja" data-ag-ninja>
        <header class="ang-header">
          <div>
            <span class="ang-eyebrow">VINKEL-SPIL</span>
            <h1>Villy Vinkelninja</h1>
            <p>Swipe i den rigtige vinkel – snit tatami, melon og pizza!</p>
          </div>
          <button type="button" class="ang-btn ang-quiet" data-ag="exit">← Tilbage</button>
        </header>
        <div class="ang-stage ag-ninja-stage" data-ag-stage>
          <div class="ag-ninja-hud">
            <div data-ag-score>Point: 0</div>
            <div class="ag-ninja-target" data-ag-target>Snit <strong>45°</strong></div>
            <div data-ag-lives>❤️❤️❤️</div>
          </div>
          <div class="ag-ninja-canvas-wrap">
            <canvas data-ag-canvas width="720" height="480" aria-label="Ninja-bane"></canvas>
            <div class="ag-ninja-villy" aria-hidden="true">
              <svg viewBox="0 0 80 90" width="72" height="80">
                <ellipse cx="40" cy="78" rx="22" ry="8" fill="#00000033"/>
                <rect x="28" y="48" width="24" height="28" rx="6" fill="#1b1b2f"/>
                <circle cx="40" cy="34" r="16" fill="#f0d5b8"/>
                <path d="M20 28 Q40 8 60 28 L58 36 Q40 22 22 36 Z" fill="#111"/>
                <rect x="22" y="32" width="36" height="8" rx="2" fill="#222"/>
                <rect x="55" y="40" width="22" height="4" rx="1" fill="#c0c0c0" transform="rotate(-25 55 40)"/>
                <text x="40" y="88" text-anchor="middle" font-size="9" fill="#fff9ef" font-family="system-ui">Villy</text>
              </svg>
            </div>
          </div>
          <p class="ag-msg" data-ag-fb role="status"></p>
          <div class="ang-actions">
            <button type="button" class="ang-btn ang-teal" data-ag="start">Start snit!</button>
          </div>
          <p class="ang-sub" style="text-align:center">Den stiplede linje på hver ting er vandret (0°). Swipe i målvinklen. Undgå 🔪 – det er Erlings kniv!</p>
        </div>
      </section>`;

    const stage = root.querySelector("[data-ag-stage]");
    canvas = root.querySelector("[data-ag-canvas]");
    ctx = canvas.getContext("2d");

    function endTrack(completed) {
      track(completed ? "exercise_complete" : "exercise_end", {
        tasks_answered: tasks,
        correct_answers: correct,
        duration_seconds: (Date.now() - startedAt) / 1000,
      });
      if (completed) try { options.onComplete?.(); } catch (_) {}
    }

    function setTargetForWave() {
      const incs = [45, 30, 15];
      const inc = incs[Math.min(wave, incs.length - 1)];
      const opts = core.anglesForIncrement(inc, 8).filter((a) => a >= 15 && a <= 165);
      target = opts[Math.floor(Math.random() * opts.length)] || inc;
      const el = root.querySelector("[data-ag-target]");
      if (el) el.innerHTML = `Snit <strong>${target}°</strong>`;
    }

    function spawn() {
      const bomb = Math.random() < 0.12;
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
      const x = 80 + Math.random() * (W - 160);
      objects.push({
        id: Math.random().toString(36).slice(2),
        bomb,
        kind,
        x,
        y: H + 40,
        vx: (Math.random() - 0.5) * 120,
        vy: -(420 + Math.random() * 160),
        r: bomb ? 28 : 36,
        alive: true,
        split: null,
        rot: (Math.random() - 0.5) * 0.5,
      });
    }

    function loseLife(reason) {
      lives -= 1;
      combo = 0;
      feedback = reason;
      updateHud();
      if (lives <= 0) {
        gameOver = true;
        running = false;
        endTrack(score >= 200);
        showGameOver();
      }
    }

    function updateHud() {
      const s = root.querySelector("[data-ag-score]");
      const l = root.querySelector("[data-ag-lives]");
      if (s) s.textContent = `Point: ${score}` + (combo > 1 ? `  · combo ×${combo}` : "");
      if (l) l.textContent = "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives));
      const fb = root.querySelector("[data-ag-fb]");
      if (fb) fb.textContent = feedback || "";
    }

    function showGameOver() {
      const wrap = root.querySelector(".ag-ninja-canvas-wrap");
      if (!wrap) return;
      const overlay = document.createElement("div");
      overlay.className = "ag-ninja-over";
      overlay.innerHTML = `
        <h2>${score >= 200 ? "Ninja-mester!" : "Game over"}</h2>
        <p>Point: ${score} · Rigtige snit: ${correct}/${tasks}</p>
        <div class="ang-actions">
          <button type="button" class="ang-btn ang-teal" data-ag="start">Prøv igen</button>
          <button type="button" class="ang-btn ang-quiet" data-ag="exit">Tilbage</button>
        </div>`;
      wrap.appendChild(overlay);
    }

    function sliceObject(obj, ang, x0, y0, x1, y1) {
      obj.alive = false;
      obj.split = { ang, x0, y0, x1, y1, t: 0 };
      const perfect = Math.abs(ang - target) <= 3;
      const good = Math.abs(ang - target) <= 8;
      tasks += 1;
      if (perfect || good) {
        correct += 1;
        combo += 1;
        const pts = (perfect ? 100 : 60) + combo * 10;
        score += pts;
        feedback = perfect ? `Perfekt ${ang}°! +${pts}` : `Godt ${ang}°! +${pts}`;
        if (score > (wave + 1) * 250) {
          wave = Math.min(2, wave + 1);
          setTargetForWave();
          feedback += ` · Sværere: trin ${[45, 30, 15][wave]}°`;
        }
        for (let i = 0; i < 14; i++) {
          particles.push({
            x: obj.x, y: obj.y,
            vx: (Math.random() - 0.5) * 220,
            vy: (Math.random() - 0.5) * 220,
            life: 0.5 + Math.random() * 0.4,
            color: obj.kind.color,
          });
        }
      } else {
        combo = 0;
        feedback = `Skævt (${ang}° – skulle være ${target}°)`;
      }
      updateHud();
    }

    function trySwipe(x0, y0, x1, y1) {
      const ang = core.swipeAngleVsReference(x0, y0, x1, y1, 0);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      let hit = null;
      let best = 1e9;
      for (const obj of objects) {
        if (!obj.alive) continue;
        const d = Math.hypot(obj.x - mx, obj.y - my);
        // also check distance to segment
        const dist = distToSeg(obj.x, obj.y, x0, y0, x1, y1);
        if (dist < obj.r + 8 && dist < best) {
          best = dist;
          hit = obj;
        }
      }
      if (!hit) return;
      if (hit.bomb) {
        hit.alive = false;
        loseLife("Av! Du ramte Erlings kniv 🔪");
        return;
      }
      sliceObject(hit, ang, x0, y0, x1, y1);
    }

    function distToSeg(px, py, x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((px - x0) * dx + (py - y0) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // dojo bg
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#2a1840");
      g.addColorStop(1, "#1a0f28");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3d2958";
      ctx.fillRect(0, H - 48, W, 48);

      for (const obj of objects) {
        if (obj.split) {
          drawSplit(obj);
          continue;
        }
        if (!obj.alive) continue;
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.rot);
        if (obj.bomb) {
          ctx.font = "40px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🔪", 0, 0);
        } else {
          // body with horizontal reference edge
          ctx.fillStyle = obj.kind.color;
          ctx.beginPath();
          ctx.arc(0, 0, obj.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff9ef";
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-obj.r + 4, 0);
          ctx.lineTo(obj.r - 4, 0);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = "28px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(obj.kind.emoji, 0, 0);
        }
        ctx.restore();
      }

      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (swipe) {
        ctx.strokeStyle = "#f3c777";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(swipe.x0, swipe.y0);
        ctx.lineTo(swipe.x1, swipe.y1);
        ctx.stroke();
        const ang = core.swipeAngleVsReference(swipe.x0, swipe.y0, swipe.x1, swipe.y1, 0);
        ctx.fillStyle = "#fff9ef";
        ctx.font = "bold 18px system-ui";
        ctx.fillText(ang + "°", swipe.x1 + 8, swipe.y1);
      }
    }

    function drawSplit(obj) {
      const t = obj.split.t;
      const sep = t * 40;
      const ang = (obj.split.ang * Math.PI) / 180;
      // two halves fly apart perpendicular to cut? along cut normal
      const nx = -Math.sin(ang), ny = -Math.cos(ang);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(obj.x + nx * sep * side, obj.y + ny * sep * side);
        ctx.rotate(obj.rot + side * t * 0.6);
        ctx.globalAlpha = 1 - t * 0.5;
        ctx.fillStyle = obj.kind.color;
        ctx.beginPath();
        ctx.arc(0, 0, obj.r, side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 ? -Math.PI / 2 : Math.PI / 2);
        ctx.fill();
        ctx.restore();
      }
      // angle label on cut
      ctx.fillStyle = "#f3c777";
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(obj.split.ang + "°", obj.x, obj.y - 50 + t * 10);
      ctx.globalAlpha = 1;
    }

    function tick(now) {
      if (disposed || !running) return;
      const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
      lastT = now;

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        spawnTimer = Math.max(0.55, 1.35 - wave * 0.25 - score / 2000);
      }

      for (const obj of objects) {
        if (obj.split) {
          obj.split.t += dt * 1.2;
          continue;
        }
        if (!obj.alive) continue;
        obj.vy += 520 * dt;
        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
        obj.rot += 0.8 * dt;
        if (obj.y > H + 80 && obj.alive) {
          obj.alive = false;
          if (!obj.bomb) loseLife("Missed! Noget faldt forbi.");
        }
      }
      objects = objects.filter((o) => o.alive || (o.split && o.split.t < 1));

      for (const p of particles) {
        p.vy += 300 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);

      if (feedback && Math.random() < 0.02) {
        // fade message slowly via hud refresh
      }

      draw();
      raf = requestAnimationFrame(tick);
    }

    function pointerPos(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      const src = e.touches ? e.touches[0] || e.changedTouches[0] : e;
      return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
    }

    function onDown(e) {
      if (!running || gameOver) return;
      e.preventDefault();
      const p = pointerPos(e);
      swipe = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    }
    function onMove(e) {
      if (!swipe) return;
      e.preventDefault();
      const p = pointerPos(e);
      swipe.x1 = p.x;
      swipe.y1 = p.y;
    }
    function onUp(e) {
      if (!swipe) return;
      e.preventDefault();
      const p = pointerPos(e);
      swipe.x1 = p.x;
      swipe.y1 = p.y;
      const len = Math.hypot(swipe.x1 - swipe.x0, swipe.y1 - swipe.y0);
      if (len > 24) trySwipe(swipe.x0, swipe.y0, swipe.x1, swipe.y1);
      swipe = null;
    }

    function startGame() {
      const old = root.querySelector(".ag-ninja-over");
      old?.remove();
      score = 0; lives = 3; combo = 0; wave = 0;
      objects = []; particles = [];
      gameOver = false; running = true;
      startedAt = Date.now(); tasks = 0; correct = 0;
      setTargetForWave();
      updateHud();
      feedback = "Swipe!";
      spawnTimer = 0.4;
      lastT = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
      const startBtn = root.querySelector('[data-ag="start"]');
      if (startBtn) startBtn.hidden = true;
    }

    function onClick(e) {
      const btn = e.target.closest("button");
      if (!btn || !root.contains(btn)) return;
      const act = btn.dataset.ag;
      if (act === "exit") {
        running = false;
        cancelAnimationFrame(raf);
        if (!gameOver) endTrack(false);
        options.onExit?.();
        return;
      }
      if (act === "start") startGame();
    }

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("touchstart", onDown, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onUp, { passive: false });
    root.addEventListener("click", onClick);
    draw();

    return function dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchend", onUp);
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    };
  }

  window.JacobAngleNinja = { mount };
})();
