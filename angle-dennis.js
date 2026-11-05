/* Dennis med bind for øjnene – vælg vinkel, tryk Gå, gentag til målet. */
(() => {
  "use strict";

  const CORE = () => window.JacobAnglesCore;
  const EX_ID = "dennis_blindfold";
  const EX_NAME = "Dennis med bind for øjnene";
  const CELL = 72;
  const DENNIS_SRC = "assets/figurer/divisions-dennis.webp";

  function track(event, extra = {}) {
    try {
      window.jmTrack?.(event, { exercise_id: EX_ID, exercise_name: EX_NAME, ...extra });
    } catch (_) {}
  }

  // heading: 0=east, 90=north, 180=west, 270=south (math CCW)
  // turns = allowed turn degrees (plus 0 = ligeud always available)
  const LEVELS = [
    {
      w: 8, h: 5,
      start: { x: 1, y: 2, h: 0 },
      goal: { x: 6, y: 2 },
      walls: [],
      turns: [90],
      hint: "Vælg vinkel og tryk Gå.",
    },
    {
      w: 8, h: 6,
      start: { x: 1, y: 4, h: 0 },
      goal: { x: 6, y: 1 },
      walls: [{ x: 3, y: 3 }],
      turns: [90],
      hint: "Drej 90°, så gå frem.",
    },
    {
      w: 9, h: 6,
      start: { x: 1, y: 4, h: 90 },
      goal: { x: 7, y: 1 },
      walls: [{ x: 3, y: 3 }, { x: 4, y: 2 }],
      turns: [45, 90],
      hint: "Prøv 45° eller 90°.",
    },
    {
      w: 9, h: 7,
      start: { x: 1, y: 1, h: 0 },
      goal: { x: 7, y: 5 },
      walls: [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 5, y: 4 }, { x: 5, y: 5 }],
      turns: [45, 90, 180],
      hint: "Pas på træerne.",
    },
    {
      w: 10, h: 7,
      start: { x: 1, y: 5, h: 0 },
      goal: { x: 8, y: 1 },
      walls: [{ x: 3, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 3 }, { x: 6, y: 2 }],
      turns: [30, 45, 60, 90],
      hint: "Finerere grader: 30° og 60°.",
    },
    {
      w: 10, h: 8,
      start: { x: 1, y: 6, h: 90 },
      goal: { x: 8, y: 1 },
      walls: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
      turns: [15, 30, 45, 60, 90, 180],
      hint: "Sidste bane – tænk dig om.",
    },
  ];

  function mount(root, options = {}) {
    if (!root) return () => {};
    const core = CORE();
    if (!core) throw new Error("JacobAnglesCore mangler");

    let disposed = false;
    let levelIndex = 0;
    let draftDir = "ccw";
    let draftDeg = 0; // 0 = ligeud
    let animating = false;
    let dennis = { x: 0, y: 0, h: 0 };
    let trail = [];
    let msg = "";
    let raf = 0;
    let startedAt = Date.now();
    let tasks = 0;
    let correct = 0;
    let turnArc = null;
    let turnLabel = null;
    let waddle = 0;
    let tickT = 0;
    let bumpFlash = 0;
    let goalPulse = 0;

    track("exercise_start");

    root.innerHTML = `
      <section class="ang-module ag-game" data-ag-dennis>
        <header class="ang-header">
          <div>
            <span class="ang-eyebrow">VINKEL-SPIL</span>
            <h1>Dennis med bind for øjnene</h1>
            <p>Vælg vinklen, tryk Gå – gentag til Dennis er fremme.</p>
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

    function allowedTurns() {
      return [0, ...level().turns];
    }

    function resetDennis() {
      const L = level();
      dennis = { x: L.start.x, y: L.start.y, h: L.start.h };
      trail = [{ x: dennis.x, y: dennis.y }];
      draftDeg = 0;
      draftDir = "ccw";
      msg = L.hint;
      turnArc = null;
      turnLabel = null;
      animating = false;
      waddle = 0;
      bumpFlash = 0;
    }

    function cellBlocked(x, y) {
      const L = level();
      if (x < 0 || y < 0 || x >= L.w || y >= L.h) return true;
      return L.walls.some((w) => w.x === x && w.y === y);
    }

    function px(gx, gy) {
      return { x: gx * CELL + CELL / 2, y: gy * CELL + CELL / 2 };
    }

    /* —— Landscape art helpers —— */
    function terrainDefs(W, H) {
      return `
        <defs>
          <linearGradient id="agSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#87ceeb"/>
            <stop offset="55%" stop-color="#b8e0a8"/>
            <stop offset="100%" stop-color="#7cbc5c"/>
          </linearGradient>
          <pattern id="agGrass" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#6faf4a"/>
            <path d="M3 20 Q4 10 5 20 M9 22 Q10 12 11 22 M15 19 Q16 9 17 19 M20 21 Q21 13 22 21" stroke="#5a963c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
            <circle cx="6" cy="8" r="1.2" fill="#8bc34a"/>
            <circle cx="18" cy="6" r="1" fill="#a5d66a"/>
          </pattern>
          <pattern id="agPath" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="#d4b483"/>
            <circle cx="4" cy="5" r="1.1" fill="#c49a6c"/>
            <circle cx="11" cy="12" r="0.9" fill="#b8895a"/>
            <circle cx="13" cy="3" r="0.7" fill="#e0c49a"/>
          </pattern>
          <radialGradient id="agPond" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#7ec8e8"/>
            <stop offset="60%" stop-color="#3a9fc9"/>
            <stop offset="100%" stop-color="#1e6f96"/>
          </radialGradient>
          <radialGradient id="agGoalGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffe082" stop-opacity=".95"/>
            <stop offset="100%" stop-color="#ffe082" stop-opacity="0"/>
          </radialGradient>
          <filter id="agSoft" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-opacity=".28"/>
          </filter>
          <filter id="agTreeShadow" x="-40%" y="-20%" width="180%" height="160%">
            <feDropShadow dx="3" dy="4" stdDeviation="2.5" flood-color="#2d5016" flood-opacity=".35"/>
          </filter>
          <clipPath id="agDennisClip"><circle r="26"/></clipPath>
        </defs>`;
    }

    function flower(x, y, hue) {
      return `<g transform="translate(${x},${y})">
        <g class="ag-flower">
          <circle r="3.2" fill="hsl(${hue},70%,62%)"/>
          <circle cx="4" cy="0" r="3.2" fill="hsl(${hue},70%,62%)"/>
          <circle cx="-2" cy="3.5" r="3.2" fill="hsl(${hue},70%,62%)"/>
          <circle cx="-2" cy="-3.5" r="3.2" fill="hsl(${hue},70%,62%)"/>
          <circle r="2.2" fill="#ffe082"/>
        </g>
      </g>`;
    }

    function bush(x, y, s = 1) {
      return `<g transform="translate(${x},${y}) scale(${s})" filter="url(#agSoft)" class="ag-bush">
        <ellipse cx="0" cy="4" rx="16" ry="6" fill="#2d501655"/>
        <circle cx="-8" cy="-2" r="10" fill="#4caf50"/>
        <circle cx="6" cy="-4" r="11" fill="#66bb6a"/>
        <circle cx="0" cy="-8" r="9" fill="#81c784"/>
        <circle cx="-4" cy="2" r="8" fill="#43a047"/>
      </g>`;
    }

    function tree(x, y, variant = 0, scale = 1) {
      const sway = `ag-sway${(variant % 3) + 1}`;
      // Outer g keeps translate; inner g gets CSS sway (CSS transform must not wipe position)
      if (variant % 2 === 0) {
        return `<g transform="translate(${x},${y}) scale(${scale})" filter="url(#agTreeShadow)">
          <g class="${sway}">
            <ellipse cx="4" cy="20" rx="20" ry="6" fill="#2d501650"/>
            <rect x="-5" y="0" width="10" height="26" rx="2" fill="#6d4c41"/>
            <circle cx="0" cy="-16" r="22" fill="#2e7d32"/>
            <circle cx="-12" cy="-6" r="15" fill="#388e3c"/>
            <circle cx="14" cy="-8" r="16" fill="#43a047"/>
            <circle cx="2" cy="-28" r="12" fill="#66bb6a"/>
          </g>
        </g>`;
      }
      return `<g transform="translate(${x},${y}) scale(${scale})" filter="url(#agTreeShadow)">
        <g class="${sway}">
          <ellipse cx="3" cy="18" rx="17" ry="5" fill="#2d501650"/>
          <rect x="-4" y="-2" width="8" height="24" rx="2" fill="#5d4037"/>
          <path d="M0 -34 L20 6 L-20 6 Z" fill="#1b5e20"/>
          <path d="M0 -44 L15 -10 L-15 -10 Z" fill="#2e7d32"/>
          <path d="M0 -52 L10 -24 L-10 -24 Z" fill="#43a047"/>
        </g>
      </g>`;
    }

    function rock(gx, gy) {
      const x = gx * CELL + CELL / 2;
      const y = gy * CELL + CELL / 2 + 6;
      const s = CELL * 0.38;
      return `<g filter="url(#agSoft)" class="ag-rock">
        <ellipse cx="${x + 2}" cy="${y + s * 0.55}" rx="${s * 0.7}" ry="${s * 0.22}" fill="#2d501640"/>
        <path d="M ${x - s} ${y + s * 0.35}
                 Q ${x - s * 0.6} ${y - s * 0.5} ${x} ${y - s * 0.55}
                 Q ${x + s * 0.7} ${y - s * 0.35} ${x + s} ${y + s * 0.3}
                 Q ${x + s * 0.3} ${y + s * 0.55} ${x - s * 0.2} ${y + s * 0.5} Z"
              fill="#8d9aa5"/>
        <path d="M ${x - s * 0.55} ${y + s * 0.1} Q ${x - s * 0.2} ${y - s * 0.25} ${x + s * 0.15} ${y - s * 0.1}"
              fill="none" stroke="#6b7780" stroke-width="2" stroke-linecap="round"/>
      </g>`;
    }

    function house(x, y) {
      return `<g transform="translate(${x},${y})" filter="url(#agSoft)">
        <ellipse cx="18" cy="38" rx="28" ry="6" fill="#2d501640"/>
        <rect x="0" y="12" width="36" height="26" rx="2" fill="#ef9a9a"/>
        <path d="M-4 14 L18 -6 L40 14 Z" fill="#c62828"/>
        <rect x="13" y="22" width="10" height="16" rx="1" fill="#5d4037"/>
        <rect x="4" y="18" width="8" height="8" rx="1" fill="#bbdefb"/>
        <rect x="24" y="18" width="8" height="8" rx="1" fill="#bbdefb"/>
        <rect x="-8" y="30" width="52" height="4" fill="#8d6e63"/>
      </g>`;
    }

    function fence(x, y, n = 4) {
      let posts = "";
      for (let i = 0; i < n; i++) {
        const px = i * 14;
        posts += `<rect x="${px}" y="0" width="3" height="16" rx="1" fill="#a1887f"/>
                  <rect x="${px - 2}" y="-2" width="7" height="3" rx="1" fill="#8d6e63"/>`;
      }
      return `<g transform="translate(${x},${y})" opacity=".9">
        <rect x="-2" y="4" width="${n * 14}" height="2.5" fill="#bcaaa4"/>
        <rect x="-2" y="10" width="${n * 14}" height="2.5" fill="#bcaaa4"/>
        ${posts}
      </g>`;
    }

    function pond(x, y) {
      return `<g transform="translate(${x},${y})" class="ag-pond">
        <ellipse cx="0" cy="4" rx="48" ry="22" fill="#1e6f9633"/>
        <ellipse cx="0" cy="0" rx="44" ry="20" fill="url(#agPond)"/>
        <ellipse cx="-10" cy="-6" rx="14" ry="5" fill="#ffffff44" class="ag-ripple"/>
        <ellipse cx="12" cy="2" rx="10" ry="3.5" fill="#ffffff33" class="ag-ripple2"/>
        <path d="M-30 4 Q-10 -2 8 6 Q20 10 30 2" fill="none" stroke="#ffffff55" stroke-width="1.5" class="ag-ripple"/>
        <!-- lilypad -->
        <ellipse cx="-18" cy="6" rx="8" ry="4" fill="#66bb6a"/>
        <ellipse cx="16" cy="-4" rx="6" ry="3" fill="#81c784"/>
      </g>`;
    }

    function bridge(x, y) {
      return `<g transform="translate(${x},${y})" filter="url(#agSoft)">
        <rect x="0" y="0" width="56" height="10" rx="2" fill="#a1887f"/>
        <rect x="0" y="0" width="56" height="3" fill="#8d6e63"/>
        <rect x="4" y="-6" width="3" height="8" fill="#6d4c41"/>
        <rect x="49" y="-6" width="3" height="8" fill="#6d4c41"/>
        <rect x="4" y="-8" width="48" height="2.5" fill="#5d4037"/>
      </g>`;
    }

    function duck(x, y) {
      return `<g transform="translate(${x},${y})">
        <g class="ag-duck">
          <ellipse cx="0" cy="3" rx="7" ry="4" fill="#ffd54f"/>
          <circle cx="6" cy="-1" r="4" fill="#ffd54f"/>
          <path d="M8 -1 L13 0 L8 1 Z" fill="#ff8f00"/>
          <circle cx="7.5" cy="-2" r="0.8" fill="#301946"/>
        </g>
      </g>`;
    }

    function bunny(x, y) {
      return `<g transform="translate(${x},${y})">
        <g class="ag-bunny">
          <ellipse cx="0" cy="4" rx="6" ry="4.5" fill="#f5f0e6"/>
          <circle cx="0" cy="-2" r="4.5" fill="#f5f0e6"/>
          <ellipse cx="-2.5" cy="-10" rx="1.6" ry="5" fill="#f5f0e6"/>
          <ellipse cx="2.5" cy="-10" rx="1.6" ry="5" fill="#f5f0e6"/>
          <ellipse cx="-2.5" cy="-10" rx="0.7" ry="3.5" fill="#f8bbd0"/>
          <ellipse cx="2.5" cy="-10" rx="0.7" ry="3.5" fill="#f8bbd0"/>
          <circle cx="-1.5" cy="-2.5" r="0.7" fill="#301946"/>
          <circle cx="1.5" cy="-2.5" r="0.7" fill="#301946"/>
          <ellipse cx="0" cy="-0.5" rx="1.2" ry="0.8" fill="#f8bbd0"/>
        </g>
      </g>`;
    }

    function pizzaGoal(gx, gy) {
      const p = px(gx, gy);
      const pulse = 1 + Math.sin(goalPulse) * 0.06;
      return `<g transform="translate(${p.x},${p.y}) scale(${pulse})" filter="url(#agSoft)">
        <circle r="30" fill="url(#agGoalGlow)"/>
        <circle r="20" fill="#f4a261"/>
        <circle r="17" fill="#e76f51"/>
        <circle cx="-5" cy="-4" r="3" fill="#c62828"/>
        <circle cx="6" cy="2" r="2.5" fill="#c62828"/>
        <circle cx="-2" cy="7" r="2.2" fill="#2e7d32"/>
        <circle cx="7" cy="-6" r="2" fill="#fff59d"/>
        <text y="36" text-anchor="middle" font-size="11" font-weight="800" fill="#301946" font-family="system-ui">Pizza!</text>
      </g>`;
    }

    function pathTiles(L) {
      // Soft dirt under start→goal corridor and trail cells
      const cells = new Set();
      trail.forEach((t) => cells.add(`${Math.round(t.x)},${Math.round(t.y)}`));
      cells.add(`${L.start.x},${L.start.y}`);
      cells.add(`${L.goal.x},${L.goal.y}`);
      // Also mark a gentle winding suggestion for empty maps
      const midY = Math.round((L.start.y + L.goal.y) / 2);
      for (let x = Math.min(L.start.x, L.goal.x); x <= Math.max(L.start.x, L.goal.x); x++) {
        cells.add(`${x},${midY}`);
      }
      let out = "";
      for (const key of cells) {
        const [cx, cy] = key.split(",").map(Number);
        if (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) continue;
        if (L.walls.some((w) => w.x === cx && w.y === cy)) continue;
        out += `<rect x="${cx * CELL + 8}" y="${cy * CELL + 8}" width="${CELL - 16}" height="${CELL - 16}" rx="14" fill="url(#agPath)" opacity=".85"/>`;
      }
      return out;
    }

    function landscapeDecor(L, W, H) {
      const items = [];
      // Sun + soft clouds (top of map)
      items.push(`<g class="ag-sun" transform="translate(${W - 36},28)">
        <circle r="16" fill="#ffe082"/>
        <circle r="22" fill="#ffe08255"/>
      </g>`);
      items.push(`<g opacity=".9">
        <ellipse cx="${W * 0.28}" cy="22" rx="28" ry="12" fill="#ffffffcc"/>
        <ellipse cx="${W * 0.28 + 18}" cy="20" rx="18" ry="10" fill="#ffffffdd"/>
        <ellipse cx="${W * 0.55}" cy="30" rx="24" ry="10" fill="#ffffffbb"/>
        <ellipse cx="${W * 0.55 + 14}" cy="28" rx="16" ry="9" fill="#ffffffcc"/>
      </g>`);

      // Pond + bridge
      items.push(pond(W * 0.78, H * 0.78));
      items.push(bridge(W * 0.78 - 28, H * 0.78 - 4));
      items.push(duck(W * 0.78 - 8, H * 0.78 - 2));
      items.push(duck(W * 0.78 + 14, H * 0.78 + 4));

      // House + fence
      items.push(house(8, 4));
      items.push(fence(50, 32, 4));

      // Dense border orchard — keep clear of central path band
      const treeSpots = [
        [28, 48, 0, 1.05],
        [W - 36, 55, 1, 1.15],
        [40, H - 28, 2, 1.0],
        [W - 48, H - 32, 0, 1.1],
        [W * 0.42, 38, 1, 0.95],
        [W * 0.18, H * 0.55, 2, 1.05],
        [W * 0.88, H * 0.42, 0, 1.0],
        [W * 0.62, H * 0.88, 1, 0.9],
        [W * 0.08, H * 0.78, 2, 0.85],
        [W * 0.5, H - 22, 0, 0.8],
      ];
      treeSpots.forEach(([x, y, v, s]) => items.push(tree(x, y, v, s)));

      // Bushes
      items.push(bush(W * 0.3, H * 0.88, 1.0));
      items.push(bush(W * 0.55, H * 0.1, 0.85));
      items.push(bush(W * 0.12, H * 0.62, 0.8));
      items.push(bush(W * 0.7, H * 0.55, 0.7));

      // Flowers
      const flowerSpots = [
        [W * 0.18, H * 0.3, 340], [W * 0.25, H * 0.72, 280],
        [W * 0.7, H * 0.25, 40], [W * 0.88, H * 0.45, 320],
        [W * 0.4, H * 0.9, 10], [W * 0.6, H * 0.7, 300],
        [W * 0.48, H * 0.15, 20], [W * 0.15, H * 0.48, 350],
        [W * 0.92, H * 0.62, 15], [W * 0.33, H * 0.4, 310],
      ];
      flowerSpots.forEach(([x, y, h]) => items.push(flower(x, y, h)));

      items.push(bunny(W * 0.35, H * 0.18));
      items.push(bunny(W * 0.72, H * 0.35));

      L.walls.forEach((w) => items.push(rock(w.x, w.y)));

      return items.join("");
    }

    function dennisSvg() {
      const bob = Math.sin(waddle) * 3.5;
      const lean = Math.sin(waddle * 0.5) * 5;
      const heading = ((dennis.h % 360) + 360) % 360;
      const p = px(dennis.x, dennis.y);
      const flash = bumpFlash > 0 ? `opacity="${0.55 + Math.sin(bumpFlash * 8) * 0.35}"` : "";
      return `
        <g class="ag-dennis-sprite" transform="translate(${p.x},${p.y + bob})" ${flash}>
          <!-- soft ground shadow -->
          <ellipse cx="0" cy="28" rx="18" ry="6" fill="#2d501645"/>
          <!-- heading arrow + angle badge -->
          <g transform="rotate(${-heading + lean})">
            <polygon points="30,0 44,-9 44,9" fill="#e3a521" stroke="#301946" stroke-width="1.5"/>
            <circle r="28" fill="#ffffffee" stroke="#4fc3f7" stroke-width="3.5"/>
            <image href="${DENNIS_SRC}" x="-26" y="-32" width="52" height="78" clip-path="url(#agDennisClip)" preserveAspectRatio="xMidYMin slice"/>
            <!-- blindfold -->
            <rect x="-24" y="-7" width="48" height="12" rx="3" fill="#301946" opacity=".94"/>
            <rect x="-24" y="-3.5" width="48" height="4.5" fill="#5b4bda"/>
            <line x1="-28" y1="-1" x2="-24" y2="-1" stroke="#301946" stroke-width="3" stroke-linecap="round"/>
            <line x1="24" y1="-1" x2="28" y2="-1" stroke="#301946" stroke-width="3" stroke-linecap="round"/>
          </g>
          <g class="ag-heading-badge">
            <rect x="-22" y="30" width="44" height="16" rx="8" fill="#301946"/>
            <text x="0" y="42" text-anchor="middle" font-size="11" font-weight="800" fill="#ffe082" font-family="system-ui">${Math.round(heading)}°</text>
          </g>
        </g>`;
    }

    function footprints() {
      return trail.map((p, i) => {
        if (i === 0) return "";
        const c = px(p.x, p.y);
        const ang = i * 18;
        return `<g opacity="${0.3 + (i / Math.max(1, trail.length)) * 0.5}">
          <ellipse cx="${c.x - 5}" cy="${c.y}" rx="3.5" ry="5.5" fill="#5d4037" transform="rotate(${ang} ${c.x} ${c.y})"/>
          <ellipse cx="${c.x + 5}" cy="${c.y}" rx="3.5" ry="5.5" fill="#5d4037" transform="rotate(${ang} ${c.x} ${c.y})"/>
        </g>`;
      }).join("");
    }

    function turnArcSvg() {
      if (!turnArc) return "";
      const c = px(dennis.x, dennis.y);
      const r = 34;
      const a0 = turnArc.from;
      const a1 = turnArc.to;
      const p0 = { x: c.x + r * Math.cos((a0 * Math.PI) / 180), y: c.y - r * Math.sin((a0 * Math.PI) / 180) };
      const p1 = { x: c.x + r * Math.cos((a1 * Math.PI) / 180), y: c.y - r * Math.sin((a1 * Math.PI) / 180) };
      let delta = a1 - a0;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      const large = Math.abs(delta) > 180 ? 1 : 0;
      const sweep = delta >= 0 ? 0 : 1;
      const mid = a0 + delta / 2;
      const lx = c.x + (r + 18) * Math.cos((mid * Math.PI) / 180);
      const ly = c.y - (r + 18) * Math.sin((mid * Math.PI) / 180);
      const shown = turnLabel ? turnLabel.deg : Math.round(Math.abs(delta));
      if (shown < 1) return "";
      return `<path d="M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}" fill="none" stroke="#e3a521" stroke-width="5" stroke-linecap="round"/>
        <circle cx="${lx}" cy="${ly}" r="14" fill="#301946"/>
        <text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="#ffe082" font-family="system-ui">${shown}°</text>`;
    }

    function previewArc() {
      if (animating || draftDeg === 0) return "";
      const from = dennis.h;
      const to = core.normalizeDeg(dennis.h + (draftDir === "cw" ? -draftDeg : draftDeg));
      const c = px(dennis.x, dennis.y);
      const r = 34;
      const p0 = { x: c.x + r * Math.cos((from * Math.PI) / 180), y: c.y - r * Math.sin((from * Math.PI) / 180) };
      const p1 = { x: c.x + r * Math.cos((to * Math.PI) / 180), y: c.y - r * Math.sin((to * Math.PI) / 180) };
      let delta = to - from;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      const large = Math.abs(delta) > 180 ? 1 : 0;
      const sweep = delta >= 0 ? 0 : 1;
      return `<path d="M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}" fill="none" stroke="#5b4bda88" stroke-width="4" stroke-dasharray="6 5" stroke-linecap="round"/>`;
    }

    function render() {
      const L = level();
      const W = L.w * CELL;
      const H = L.h * CELL;
      goalPulse += 0.08;
      if (bumpFlash > 0) bumpFlash -= 0.05;
      stage.innerHTML = `
        <div class="ag-dennis-top">
          <div>
            <h2 class="ang-stage-title">Bane ${levelIndex + 1} / ${LEVELS.length}</h2>
            <p class="ang-sub" data-ag-msg>${msg}</p>
          </div>
          <div class="ag-heading">Retning: <strong>${Math.round(((dennis.h % 360) + 360) % 360)}°</strong></div>
        </div>
        <div class="ag-map-wrap ag-map-land">
          <svg class="ag-map" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Landskabskort">
            ${terrainDefs(W, H)}
            <rect width="${W}" height="${H}" fill="url(#agSky)"/>
            <rect width="${W}" height="${H}" fill="url(#agGrass)" opacity=".92"/>
            ${pathTiles(L)}
            ${landscapeDecor(L, W, H)}
            ${footprints()}
            ${pizzaGoal(L.goal.x, L.goal.y)}
            ${previewArc()}
            ${turnArcSvg()}
            ${dennisSvg()}
          </svg>
        </div>
        <div class="ag-dennis-controls">
          <div class="ag-chips ag-turn-row">
            <span class="ag-chip-label">Vælg vinkel</span>
            <button type="button" class="ag-chip ${draftDir === "ccw" && draftDeg > 0 ? "is-on" : ""}" data-ag="dir-ccw" ${animating ? "disabled" : ""}>↺ Mod uret</button>
            <button type="button" class="ag-chip ${draftDir === "cw" && draftDeg > 0 ? "is-on" : ""}" data-ag="dir-cw" ${animating ? "disabled" : ""}>↻ Med uret</button>
          </div>
          <div class="ag-chips ag-deg-row">
            ${allowedTurns().map((d) => {
              const label = d === 0 ? "Ligeud" : `${d}°`;
              const on = draftDeg === d ? "is-on" : "";
              return `<button type="button" class="ag-chip ${on}" data-ag="deg" data-v="${d}" ${animating ? "disabled" : ""}>${label}</button>`;
            }).join("")}
          </div>
          <div class="ag-go-row">
            <button type="button" class="ag-go-btn" data-ag="run" ${animating ? "disabled" : ""}>Gå</button>
            <button type="button" class="ang-btn ang-quiet" data-ag="reset" ${animating ? "disabled" : ""}>Nulstil</button>
          </div>
        </div>`;
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
          tickT += 1;
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

    const takeStep = async () => {
      if (animating) return;
      animating = true;
      tasks += 1;
      const L = level();
      const deg = draftDeg;
      const dir = draftDir;
      msg = deg === 0 ? "Dennis går ligeud…" : `Dennis drejer ${deg}°…`;
      render();

      // 1) Turn (if any)
      if (deg > 0) {
        const toH = core.normalizeDeg(dennis.h + (dir === "cw" ? -deg : deg));
        turnArc = { from: dennis.h, to: toH };
        await animateTo({ x: dennis.x, y: dennis.y, h: toH }, 420 + deg * 3.5, { turnDeg: deg });
        turnArc = null;
      }

      if (disposed) return;

      // 2) Walk one stretch forward
      msg = "Dennis går…";
      const rad = (dennis.h * Math.PI) / 180;
      const nx = Math.round(dennis.x + Math.cos(rad));
      const ny = Math.round(dennis.y - Math.sin(rad));

      let failed = false;
      if (cellBlocked(nx, ny)) {
        msg = "Ups! Dennis ramte noget. Prøv en anden vinkel.";
        bumpFlash = 1;
        const bx = dennis.x;
        const by = dennis.y;
        await animateTo({ x: bx + Math.cos(rad) * 0.25, y: by - Math.sin(rad) * 0.25, h: dennis.h }, 110);
        await animateTo({ x: bx, y: by, h: dennis.h }, 140);
        failed = true;
      } else {
        await animateTo({ x: nx, y: ny, h: dennis.h }, 480, { waddle: true, steps: 1 });
        trail.push({ x: nx, y: ny });
      }

      animating = false;
      const atGoal = Math.round(dennis.x) === L.goal.x && Math.round(dennis.y) === L.goal.y;
      if (atGoal && !failed) {
        correct += 1;
        msg = "Yes! Dennis fandt pizzaen!";
        render();
        try {
          await options.onResult?.({
            topic: "angles",
            prompt: `Dennis bane ${levelIndex + 1}`,
            answer: deg === 0 ? "ligeud" : `drej ${deg}° ${dir}`,
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
                <p>Dennis fandt vej med grader.</p>
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
        if (!failed) msg = "Vælg vinkel og tryk Gå igen.";
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
      if (act === "dir-cw") {
        draftDir = "cw";
        if (draftDeg === 0) draftDeg = allowedTurns().find((d) => d > 0) || 90;
        render();
        return;
      }
      if (act === "dir-ccw") {
        draftDir = "ccw";
        if (draftDeg === 0) draftDeg = allowedTurns().find((d) => d > 0) || 90;
        render();
        return;
      }
      if (act === "deg") {
        draftDeg = Number(btn.dataset.v);
        render();
        return;
      }
      if (act === "reset") { resetDennis(); render(); return; }
      if (act === "run") void takeStep();
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
