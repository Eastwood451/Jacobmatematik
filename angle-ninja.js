/* Villy Vinkelninja – Fruit Ninja-agtigt vinkelsnit (juicy canvas). */
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
    { id: "tatami", label: "tatami", juice: ["#c4a574", "#a67c52", "#8b6914"] },
    { id: "melon", label: "vandmelon", juice: ["#e85d75", "#2e7d32", "#c62828"] },
    { id: "pizza", label: "pizza", juice: ["#f0c14a", "#e85d4c", "#fff9ef"] },
    { id: "bamboo", label: "bambus", juice: ["#7cb342", "#558b2f", "#dcedc8"] },
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
    let trails = []; // blade trail segments
    let popups = []; // PERFEKT/GODT/FORBI floating text
    let score = 0;
    let lives = 3;
    let combo = 0;
    let wave = 0;
    let target = 45;
    let spawnTimer = 0;
    let lastT = 0;
    let swipe = null;
    let trailPoints = [];
    let feedback = null;
    let startedAt = Date.now();
    let tasks = 0;
    let correct = 0;
    let gameOver = false;
    let slowMo = 0; // >0 = time scale reduced
    let villyPose = 0; // 0 idle, 1 slash (decays)
    let cutMarks = []; // {x,y,ang,life} measured angle drawn on cut

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
            <div class="ag-ninja-target" data-ag-target>
              <span>Snit <strong>45°</strong></span>
              <svg class="ag-ninja-example" viewBox="0 0 56 40" width="56" height="40" aria-hidden="true" data-ag-example></svg>
            </div>
            <div data-ag-lives>❤️❤️❤️</div>
          </div>
          <div class="ag-ninja-canvas-wrap">
            <canvas data-ag-canvas width="720" height="480" aria-label="Ninja-bane"></canvas>
            <div class="ag-ninja-villy" data-ag-villy aria-hidden="true"></div>
          </div>
          <p class="ag-msg" data-ag-fb role="status"></p>
          <div class="ang-actions">
            <button type="button" class="ang-btn ang-teal" data-ag="start">Start snit!</button>
          </div>
          <p class="ang-sub" style="text-align:center">Den stiplede linje på hver ting er vandret (0°). Vinklen måles mod uret 0–180°. Swipe-retning betyder ikke noget. Undgå 🔪 – det er Erlings kniv!</p>
        </div>
      </section>`;

    canvas = root.querySelector("[data-ag-canvas]");
    ctx = canvas.getContext("2d");
    const villyEl = root.querySelector("[data-ag-villy]");

    function paintVilly(slash) {
      // Kid-friendly SVG ninja; slash pose tilts katana.
      const tilt = slash ? -55 : -18;
      const arm = slash ? 1 : 0;
      villyEl.innerHTML = `
        <svg viewBox="0 0 110 120" width="108" height="118">
          <ellipse cx="48" cy="108" rx="28" ry="8" fill="#00000044"/>
          <rect x="34" y="62" width="28" height="36" rx="8" fill="#1b1b2f"/>
          <rect x="30" y="66" width="10" height="22" rx="4" fill="#111"/>
          <rect x="56" y="66" width="10" height="22" rx="4" fill="#111"/>
          <circle cx="48" cy="42" r="20" fill="#f0d5b8"/>
          <path d="M22 36 Q48 8 74 36 L70 46 Q48 28 26 46 Z" fill="#111"/>
          <rect x="26" y="40" width="44" height="12" rx="3" fill="#1a1a28"/>
          <circle cx="38" cy="46" r="3" fill="#fff"/>
          <circle cx="58" cy="46" r="3" fill="#fff"/>
          <circle cx="39" cy="46" r="1.4" fill="#111"/>
          <circle cx="59" cy="46" r="1.4" fill="#111"/>
          <g transform="translate(68,58) rotate(${tilt})">
            <rect x="0" y="-4" width="46" height="7" rx="2" fill="#cfd8dc"/>
            <rect x="40" y="-5.5" width="8" height="10" rx="1" fill="#90a4ae"/>
            <rect x="-10" y="-5" width="12" height="9" rx="2" fill="#5d4037"/>
            <rect x="-14" y="-3" width="6" height="5" rx="1" fill="#e3a521"/>
          </g>
          <text x="48" y="118" text-anchor="middle" font-size="11" fill="#fff9ef" font-family="system-ui,sans-serif" font-weight="700">Villy</text>
        </svg>`;
      villyEl.classList.toggle("is-slash", !!slash);
    }
    paintVilly(false);

    function exampleIcon(deg) {
      const el = root.querySelector("[data-ag-example]");
      if (!el) return;
      const cx = 18, cy = 28, r = 16;
      const rad = (deg * Math.PI) / 180;
      const x1 = cx + r;
      const y1 = cy;
      const x2 = cx + r * Math.cos(rad);
      const y2 = cy - r * Math.sin(rad);
      const large = deg > 180 ? 1 : 0;
      el.innerHTML = `
        <line x1="${cx - 14}" y1="${cy}" x2="${cx + 18}" y2="${cy}" stroke="#fff9ef88" stroke-width="1.5" stroke-dasharray="3 2"/>
        <path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="#e3a52155"/>
        <line x1="${cx}" y1="${cy}" x2="${x1}" y2="${y1}" stroke="#fff9ef" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e3a521" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="2.5" fill="#e3a521"/>
        <text x="48" y="18" text-anchor="middle" font-size="11" fill="#fff9ef" font-weight="800">${deg}°</text>`;
    }

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
      if (el) {
        const strong = el.querySelector("strong");
        if (strong) strong.textContent = target + "°";
        else el.innerHTML = `Snit <strong>${target}°</strong>`;
      }
      exampleIcon(target);
    }

    function spawn() {
      const bomb = Math.random() < 0.11;
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
      const x = 90 + Math.random() * (W - 180);
      // Prefer spawning several in air: sometimes spawn a pair
      const makeOne = (ox) => ({
        id: Math.random().toString(36).slice(2),
        bomb,
        kind,
        x: ox,
        y: H + 50 + Math.random() * 30,
        vx: (Math.random() - 0.5) * 160,
        vy: -(460 + Math.random() * 200),
        r: bomb ? 30 : 48 + Math.random() * 10,
        alive: true,
        split: null,
        rot: (Math.random() - 0.5) * 0.8,
        spin: (Math.random() - 0.5) * 2.2,
      });
      objects.push(makeOne(x));
      if (!bomb && Math.random() < 0.55) {
        objects.push(makeOne(Math.min(W - 80, Math.max(80, x + 70 + Math.random() * 80))));
      }
    }

    function loseLife(reason) {
      lives -= 1;
      combo = 0;
      feedback = reason;
      popups.push({ text: "FORBI", color: "#ff8a80", x: W / 2, y: H * 0.35, life: 0.9, vy: -40 });
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

    function burst(obj, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.4 + Math.random());
        particles.push({
          x: obj.x, y: obj.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 40,
          life: 0.45 + Math.random() * 0.55,
          r: 3 + Math.random() * 5,
          color: obj.kind.juice[i % obj.kind.juice.length],
        });
      }
    }

    function sliceObject(obj, ang, x0, y0, x1, y1) {
      obj.alive = false;
      const cutHeading = core.headingFromPoint(x0, y0, x1, y1);
      // Store undirected cut angle (0–180) and a stable line direction for drawing
      obj.split = {
        ang,
        cutHeading,
        x0, y0, x1, y1,
        t: 0,
        vx1: obj.vx - 80, vy1: obj.vy - 40,
        vx2: obj.vx + 80, vy2: obj.vy - 40,
      };
      cutMarks.push({ x: obj.x, y: obj.y, ang, life: 1.1 });
      const perfect = Math.abs(ang - target) <= 3;
      const good = Math.abs(ang - target) <= 8;
      tasks += 1;
      villyPose = 0.35;
      paintVilly(true);
      if (perfect || good) {
        correct += 1;
        combo += 1;
        const pts = (perfect ? 100 : 60) + combo * 10;
        score += pts;
        feedback = perfect ? `Perfekt ${ang}°! +${pts}` : `Godt ${ang}°! +${pts}`;
        popups.push({
          text: perfect ? "PERFEKT" : "GODT",
          color: perfect ? "#ffd54f" : "#80cbc4",
          x: obj.x, y: obj.y - 30, life: 0.95, vy: -55,
        });
        if (combo > 1) {
          popups.push({ text: `COMBO ×${combo}`, color: "#ce93d8", x: obj.x + 20, y: obj.y - 55, life: 0.8, vy: -40 });
        }
        slowMo = perfect ? 0.28 : 0.16;
        burst(obj, perfect ? 28 : 18, 260);
        if (score > (wave + 1) * 250) {
          wave = Math.min(2, wave + 1);
          setTargetForWave();
          feedback += ` · Sværere: trin ${[45, 30, 15][wave]}°`;
        }
      } else {
        combo = 0;
        feedback = `Skævt (${ang}° – skulle være ${target}°)`;
        popups.push({ text: "FORBI", color: "#ff8a80", x: obj.x, y: obj.y - 20, life: 0.8, vy: -35 });
        burst(obj, 8, 120);
      }
      updateHud();
    }

    function trySwipe(x0, y0, x1, y1) {
      const ang = core.swipeAngleVsReference(x0, y0, x1, y1, 0);
      let hit = null;
      let best = 1e9;
      for (const obj of objects) {
        if (!obj.alive) continue;
        const dist = distToSeg(obj.x, obj.y, x0, y0, x1, y1);
        if (dist < obj.r + 10 && dist < best) {
          best = dist;
          hit = obj;
        }
      }
      if (!hit) return;
      if (hit.bomb) {
        hit.alive = false;
        burst(hit, 20, 300);
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

    /* ---------- drawing helpers for recognizable objects ---------- */
    function drawTatami(r) {
      const w = r * 1.7, h = r * 1.05;
      ctx.fillStyle = "#c4a574";
      ctx.strokeStyle = "#8b6914";
      ctx.lineWidth = 2;
      roundRect(-w / 2, -h / 2, w, h, 4);
      ctx.fill();
      ctx.stroke();
      // weave
      ctx.strokeStyle = "#a67c5288";
      ctx.lineWidth = 1;
      for (let i = -w / 2 + 4; i < w / 2; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, -h / 2 + 2);
        ctx.lineTo(i, h / 2 - 2);
        ctx.stroke();
      }
      for (let j = -h / 2 + 4; j < h / 2; j += 5) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 2, j);
        ctx.lineTo(w / 2 - 2, j);
        ctx.stroke();
      }
      // border stitching
      ctx.strokeStyle = "#6d4c2b";
      ctx.lineWidth = 3;
      roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 2);
      ctx.stroke();
    }

    function drawMelon(r) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "#43a047";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.fillStyle = "#e85d75";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = "#ef9a9a";
      ctx.fill();
      // seeds
      ctx.fillStyle = "#3e2723";
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        const sx = Math.cos(a) * r * 0.4;
        const sy = Math.sin(a) * r * 0.35;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 3, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      // rind stripes
      ctx.strokeStyle = "#2e7d32";
      ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.96, -0.4 + i * 0.05, 0.4 + i * 0.05);
        ctx.stroke();
      }
    }

    function drawPizza(r) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "#f0c14a";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = "#e85d4c";
      ctx.fill();
      // cheese blobs
      ctx.fillStyle = "#ffe082";
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.3, 6 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      // pepperoni
      ctx.fillStyle = "#c62828";
      [[-12, -8], [10, 6], [0, 14], [14, -10], [-8, 10]].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px * r / 40, py * r / 40, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      // crust highlight
      ctx.strokeStyle = "#d4a017";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawBamboo(r) {
      const h = r * 2.1, w = r * 0.55;
      ctx.fillStyle = "#7cb342";
      roundRect(-w / 2, -h / 2, w, h, w / 2);
      ctx.fill();
      ctx.strokeStyle = "#558b2f";
      ctx.lineWidth = 2;
      roundRect(-w / 2, -h / 2, w, h, w / 2);
      ctx.stroke();
      // segments
      ctx.strokeStyle = "#33691e";
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const y = (i / 2.5) * (h / 2);
        ctx.beginPath();
        ctx.moveTo(-w / 2, y);
        ctx.lineTo(w / 2, y);
        ctx.stroke();
        ctx.fillStyle = "#dcedc8";
        ctx.beginPath();
        ctx.arc(0, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // leaf
      ctx.fillStyle = "#9ccc65";
      ctx.beginPath();
      ctx.ellipse(w / 2 + 8, -h / 4, 10, 4, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    function roundRect(x, y, w, h, rad) {
      const rr = Math.min(rad, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function drawObjectBody(obj) {
      if (obj.bomb) {
        ctx.font = `${Math.round(obj.r * 1.5)}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🔪", 0, 0);
        return;
      }
      if (obj.kind.id === "tatami") drawTatami(obj.r);
      else if (obj.kind.id === "melon") drawMelon(obj.r);
      else if (obj.kind.id === "pizza") drawPizza(obj.r);
      else drawBamboo(obj.r);
      // dashed horizontal reference = 0°
      ctx.strokeStyle = "#fff9ef";
      ctx.setLineDash([7, 5]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-obj.r * 0.95, 0);
      ctx.lineTo(obj.r * 0.95, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      // tiny 0° tick
      ctx.fillStyle = "#fff9efcc";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("0°", obj.r * 0.55, -6);
    }

    function drawDojoBg() {
      // paper walls
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#3d2a55");
      g.addColorStop(0.55, "#2a1840");
      g.addColorStop(1, "#1a1024");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // shoji panels
      ctx.strokeStyle = "#5a406888";
      ctx.lineWidth = 3;
      const cols = 4;
      for (let i = 0; i <= cols; i++) {
        const x = (i / cols) * W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H - 70);
        ctx.stroke();
      }
      for (let j = 0; j < 3; j++) {
        const y = 30 + j * ((H - 100) / 3);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // paper glow
      ctx.fillStyle = "#fff9ef0a";
      for (let i = 0; i < cols; i++) {
        ctx.fillRect((i / cols) * W + 4, 34, W / cols - 8, H - 110);
      }
      // wooden floor
      const floorY = H - 64;
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(0, floorY, W, 64);
      ctx.strokeStyle = "#3e2723";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(0, floorY + 8 + i * 7);
        ctx.lineTo(W, floorY + 8 + i * 7);
        ctx.stroke();
      }
      // floor planks
      ctx.strokeStyle = "#4e342e";
      for (let i = 0; i < 10; i++) {
        const x = i * (W / 10);
        ctx.beginPath();
        ctx.moveTo(x, floorY);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
    }

    function drawAngleOnCut(mark) {
      const { x, y, ang, life } = mark;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, life));
      ctx.translate(x, y);
      const r = 28;
      const rad = (ang * Math.PI) / 180;
      ctx.strokeStyle = "#fff9ef88";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-36, 0);
      ctx.lineTo(36, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rad) * 36, -Math.sin(rad) * 36);
      ctx.strokeStyle = "#e3a521";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, -rad, true);
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffd54f";
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(ang + "°", Math.cos(rad / 2) * (r + 14), -Math.sin(rad / 2) * (r + 14));
      ctx.restore();
    }

    function drawSplit(obj) {
      const t = Math.min(1, obj.split.t);
      // Cut is an undirected line at `ang` from horizontal; normal separates halves.
      const angRad = (obj.split.ang * Math.PI) / 180;
      const nx = -Math.sin(angRad);
      const ny = Math.cos(angRad);
      for (const side of [-1, 1]) {
        ctx.save();
        const ox = obj.x + nx * t * 58 * side + (side < 0 ? obj.split.vx1 : obj.split.vx2) * t * 0.12;
        const oy = obj.y + ny * t * 58 * side + 110 * t * t;
        ctx.translate(ox, oy);
        ctx.rotate(obj.rot + side * t * 1.6);
        ctx.globalAlpha = 1 - t * 0.5;
        // Clip to half-plane of the cut (in object space before body rotation of cut)
        ctx.save();
        ctx.rotate(-angRad + Math.PI / 2); // make cut vertical in clip space
        ctx.beginPath();
        ctx.rect(side < 0 ? -obj.r * 3 : 0, -obj.r * 3, obj.r * 3, obj.r * 6);
        ctx.clip();
        ctx.rotate(angRad - Math.PI / 2);
        drawObjectBody(obj);
        ctx.restore();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function drawBladeTrail() {
      if (trailPoints.length < 2) return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < trailPoints.length; i++) {
        const a = trailPoints[i - 1];
        const b = trailPoints[i];
        const age = i / trailPoints.length;
        ctx.strokeStyle = `rgba(255, 213, 79, ${0.15 + age * 0.75})`;
        ctx.lineWidth = 2 + age * 8;
        ctx.shadowColor = "#ffd54f";
        ctx.shadowBlur = 12 * age;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // bright core
      ctx.strokeStyle = "#fffde7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
      for (let i = 1; i < trailPoints.length; i++) ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
      ctx.stroke();
    }

    function draw() {
      drawDojoBg();

      for (const obj of objects) {
        if (obj.split) {
          drawSplit(obj);
          continue;
        }
        if (!obj.alive) continue;
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.rot);
        // soft shadow
        ctx.fillStyle = "#00000044";
        ctx.beginPath();
        ctx.ellipse(4, obj.r * 0.85, obj.r * 0.7, obj.r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        drawObjectBody(obj);
        ctx.restore();
      }

      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r || 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const m of cutMarks) drawAngleOnCut(m);

      drawBladeTrail();

      if (swipe && trailPoints.length < 2) {
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(swipe.x0, swipe.y0);
        ctx.lineTo(swipe.x1, swipe.y1);
        ctx.stroke();
      }

      for (const pop of popups) {
        ctx.globalAlpha = Math.max(0, Math.min(1, pop.life * 1.5));
        ctx.fillStyle = pop.color;
        ctx.font = "bold 28px system-ui";
        ctx.textAlign = "center";
        ctx.strokeStyle = "#1a0f28";
        ctx.lineWidth = 4;
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;
    }

    function tick(now) {
      if (disposed || !running) return;
      let dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
      lastT = now;
      if (slowMo > 0) {
        dt *= 0.35;
        slowMo -= (now - (now - dt * 1000)) / 1000 * (1 / 0.35) * 0.02;
        // simpler: decay slowMo in real time
      }
      // decay slow-mo with wall clock approx
      if (slowMo > 0) slowMo = Math.max(0, slowMo - 0.016);

      if (villyPose > 0) {
        villyPose -= 0.016;
        if (villyPose <= 0) paintVilly(false);
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        spawnTimer = Math.max(0.45, 1.15 - wave * 0.22 - score / 2200);
      }

      for (const obj of objects) {
        if (obj.split) {
          obj.split.t += dt * (slowMo > 0 ? 0.7 : 1.35);
          obj.x += (obj.split.vx1 + obj.split.vx2) * 0.5 * dt * 0.2;
          obj.y += 60 * dt;
          continue;
        }
        if (!obj.alive) continue;
        obj.vy += 560 * dt;
        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
        obj.rot += obj.spin * dt;
        if (obj.y > H + 90 && obj.alive) {
          obj.alive = false;
          if (!obj.bomb) loseLife("Missed! Noget faldt forbi.");
        }
      }
      objects = objects.filter((o) => o.alive || (o.split && o.split.t < 1.05));

      for (const p of particles) {
        p.vy += 320 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);

      for (const m of cutMarks) m.life -= dt * 0.9;
      cutMarks = cutMarks.filter((m) => m.life > 0);

      for (const pop of popups) {
        pop.y += pop.vy * dt;
        pop.life -= dt;
      }
      popups = popups.filter((p) => p.life > 0);

      // fade trail points
      if (!swipe && trailPoints.length) {
        trailPoints.shift();
        if (trailPoints.length) trailPoints.shift();
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
      trailPoints = [{ x: p.x, y: p.y }];
    }
    function onMove(e) {
      if (!swipe) return;
      e.preventDefault();
      const p = pointerPos(e);
      swipe.x1 = p.x;
      swipe.y1 = p.y;
      trailPoints.push({ x: p.x, y: p.y });
      if (trailPoints.length > 18) trailPoints.shift();
    }
    function onUp(e) {
      if (!swipe) return;
      e.preventDefault();
      const p = pointerPos(e);
      swipe.x1 = p.x;
      swipe.y1 = p.y;
      trailPoints.push({ x: p.x, y: p.y });
      const len = Math.hypot(swipe.x1 - swipe.x0, swipe.y1 - swipe.y0);
      if (len > 24) trySwipe(swipe.x0, swipe.y0, swipe.x1, swipe.y1);
      swipe = null;
      // keep trail briefly via tick fade
    }

    function startGame() {
      const old = root.querySelector(".ag-ninja-over");
      old?.remove();
      score = 0; lives = 3; combo = 0; wave = 0;
      objects = []; particles = []; popups = []; cutMarks = []; trailPoints = [];
      gameOver = false; running = true; slowMo = 0;
      startedAt = Date.now(); tasks = 0; correct = 0;
      setTargetForWave();
      updateHud();
      feedback = "Swipe!";
      spawnTimer = 0.25;
      lastT = performance.now();
      // Pre-seed a couple objects so the first screenshot isn't empty
      spawn();
      spawn();
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
    exampleIcon(45);
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
