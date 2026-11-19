/* Skak-animationer — rent visuelt lag (FLIP + WAAPI + CSS/DOM).
   Hver slået brik dør på sin egen måde: bonde=grøn slim, springer=lyn,
   løber=ildkugle, tårn=smuldrer til sten, dronning=stjerner, konge=sort hul.
   Ingen spillogik. Lazy-loades sammen med skak-modulet. */
(() => {
  "use strict";

  const GLIDE_MS = 450;
  const CAPTURE_EXTRA_MS = 720;
  const DROP_MS = 280;
  const SLIME = ["#8cdb28", "#50a51e", "#b4ed42", "#6bcf2a", "#347518"];

  function prefersReducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (_) { return false; }
  }

  function sqBtn(board, sq) {
    return board?.querySelector?.(`[data-sq="${sq}"]`) || null;
  }

  function pieceIn(board, sq) {
    return sqBtn(board, sq)?.querySelector(".sk-piece") || null;
  }

  /** Snapshot positions BEFORE the board re-renders. */
  function captureFirsts(board, info) {
    if (!board || !info?.from || !info?.to) return null;
    const map = {};
    const fromPiece = pieceIn(board, info.from);
    if (fromPiece) map[info.from] = fromPiece.getBoundingClientRect();
    if (info.rookFrom) {
      const rook = pieceIn(board, info.rookFrom);
      if (rook) map[info.rookFrom] = rook.getBoundingClientRect();
    }
    let victimHtml = null;
    let victimRect = null;
    const captSq = info.capturedSq || null;
    if (captSq) {
      const victim = pieceIn(board, captSq);
      if (victim) {
        victimHtml = victim.outerHTML;
        victimRect = victim.getBoundingClientRect();
      }
    }
    return { map, victimHtml, victimRect, capturedSq: captSq, capturedType: info.captured || null, to: info.to, from: info.from };
  }

  function softSplatSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = softSplatSound._ctx || (softSplatSound._ctx = new Ctx());
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, t0);
      osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.18);
      filter.type = "lowpass";
      filter.frequency.value = 900;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.25);
    } catch (_) { /* lyd er valgfri */ }
  }

  /* ---------- Fælles hjælpere til døds-effekter ---------- */
  function fxStage(board, firsts) {
    const wrap = board.closest(".sk-board-wrap") || board.parentElement || board;
    const layer = document.createElement("div");
    layer.className = "sk-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    wrap.appendChild(layer);
    const wrapRect = wrap.getBoundingClientRect();
    const vr = firsts.victimRect;
    const cx = vr.left + vr.width / 2 - wrapRect.left;
    const cy = vr.top + vr.height / 2 - wrapRect.top;
    const unit = Math.max(28, vr.width); // ét felts bredde (skalerer på mobil)
    return { wrap, layer, wrapRect, vr, cx, cy, unit };
  }

  function makeGhost(st, firsts) {
    if (!firsts.victimHtml) return null;
    const ghost = document.createElement("div");
    ghost.className = "sk-victim-ghost";
    ghost.innerHTML = firsts.victimHtml;
    ghost.style.left = `${st.vr.left - st.wrapRect.left}px`;
    ghost.style.top = `${st.vr.top - st.wrapRect.top}px`;
    ghost.style.width = `${st.vr.width}px`;
    ghost.style.height = `${st.vr.height}px`;
    st.layer.appendChild(ghost);
    return ghost;
  }

  function particle(st, cls, { x = st.cx, y = st.cy, w = 8, h = w, bg = "", text = "", color = "" } = {}) {
    const el = document.createElement("span");
    el.className = `sk-fx-p ${cls}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    if (bg) el.style.background = bg;
    if (color) el.style.color = color;
    if (text) { el.textContent = text; el.style.fontSize = `${h}px`; }
    st.layer.appendChild(el);
    return el;
  }

  function anim(el, frames, opts) {
    try { return el.animate(frames, { fill: "forwards", ...opts }); } catch (_) { return null; }
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- Lyde (valgfri, korte, WebAudio) ---------- */
  function audioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = audioCtx._ctx || (audioCtx._ctx = new Ctx());
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(type, f0, f1, dur, vol = 0.1, delay = 0) {
    try {
      const ctx = audioCtx(); if (!ctx) return;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (_) { /* lyd er valgfri */ }
  }
  function noise(dur, vol = 0.1, freq = 1200, delay = 0) {
    try {
      const ctx = audioCtx(); if (!ctx) return;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start(ctx.currentTime + delay);
    } catch (_) { /* lyd er valgfri */ }
  }

  /* ---------- Bonde: grøn slim ---------- */
  function spawnSlime(board, firsts) {
    if (!board || !firsts?.victimRect) return () => {};
    const st = fxStage(board, firsts);
    const { layer, cx, cy, wrapRect, vr } = st;

    // Ghost of the captured piece that squashes into goo
    if (firsts.victimHtml) {
      const ghost = document.createElement("div");
      ghost.className = "sk-victim-ghost";
      ghost.innerHTML = firsts.victimHtml;
      ghost.style.left = `${vr.left - wrapRect.left}px`;
      ghost.style.top = `${vr.top - wrapRect.top}px`;
      ghost.style.width = `${vr.width}px`;
      ghost.style.height = `${vr.height}px`;
      layer.appendChild(ghost);
      ghost.animate([
        { transform: "scale(1) rotate(0deg)", opacity: 1, filter: "none" },
        { transform: "scale(1.15, 0.7) rotate(-8deg)", opacity: 1, offset: 0.25 },
        { transform: "scale(1.4, 0.25) rotate(12deg)", opacity: 0.5, offset: 0.55 },
        { transform: "scale(0.2) rotate(0deg)", opacity: 0 },
      ], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    }

    // Gooey blobs
    const count = 14;
    for (let i = 0; i < count; i++) {
      const blob = document.createElement("span");
      blob.className = "sk-slime-blob";
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 18 + Math.random() * 42;
      const size = 10 + Math.random() * 18;
      blob.style.width = `${size}px`;
      blob.style.height = `${size * (0.7 + Math.random() * 0.6)}px`;
      blob.style.left = `${cx}px`;
      blob.style.top = `${cy}px`;
      blob.style.background = SLIME[i % SLIME.length];
      blob.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      blob.style.setProperty("--dy", `${Math.sin(ang) * dist + 8}px`);
      blob.style.animationDelay = `${i * 12}ms`;
      layer.appendChild(blob);
    }

    // Drips
    for (let i = 0; i < 5; i++) {
      const drip = document.createElement("span");
      drip.className = "sk-slime-drip";
      drip.style.left = `${cx - 10 + Math.random() * 20}px`;
      drip.style.top = `${cy}px`;
      drip.style.background = SLIME[i % SLIME.length];
      drip.style.animationDelay = `${80 + i * 40}ms`;
      layer.appendChild(drip);
    }

    // Stain on the square (fades)
    const stain = document.createElement("span");
    stain.className = "sk-slime-stain";
    stain.style.left = `${cx}px`;
    stain.style.top = `${cy + 6}px`;
    layer.appendChild(stain);

    softSplatSound();

    const ttl = CAPTURE_EXTRA_MS + 200;
    layer.dataset.death = "slime";
    const timer = setTimeout(() => layer.remove(), ttl);
    return () => { clearTimeout(timer); layer.remove(); };
  }

  /* ---------- Springer: lynnedslag ---------- */
  function spawnLightning(board, firsts) {
    const st = fxStage(board, firsts);
    const { layer, cx, cy, unit } = st;
    const flash = document.createElement("span");
    flash.className = "sk-fx-flash";
    layer.appendChild(flash);
    anim(flash, [{ opacity: 0 }, { opacity: 0.85, offset: 0.15 }, { opacity: 0.1, offset: 0.35 }, { opacity: 0.6, offset: 0.5 }, { opacity: 0 }], { duration: 380 });

    // Takket lyn fra toppen af brættet ned i offeret
    const top = Math.max(-unit * 0.5, cy - unit * 4.5);
    const pts = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = i === 0 || i === steps ? 0 : rand(-0.45, 0.45) * unit;
      pts.push(`${(cx + jitter + (1 - t) * unit * 0.6).toFixed(1)},${(top + (cy - top) * t).toFixed(1)}`);
    }
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "sk-fx-bolt");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    for (const [w, c] of [[unit * 0.22, "#7fd3ff"], [unit * 0.08, "#fffbe0"]]) {
      const pl = document.createElementNS(svgNS, "polyline");
      pl.setAttribute("points", pts.join(" "));
      pl.setAttribute("fill", "none");
      pl.setAttribute("stroke", c);
      pl.setAttribute("stroke-width", String(Math.max(2, w)));
      pl.setAttribute("stroke-linejoin", "round");
      pl.setAttribute("stroke-linecap", "round");
      svg.appendChild(pl);
    }
    layer.appendChild(svg);
    anim(svg, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 0.25, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0.9, offset: 0.7 }, { opacity: 0 }], { duration: 420, easing: "steps(12, end)" });

    const ghost = makeGhost(st, firsts);
    if (ghost) {
      anim(ghost, [
        { transform: "translate(0,0) scale(1)", filter: "brightness(1)", opacity: 1 },
        { transform: "translate(-3px,1px) scale(1.06)", filter: "brightness(3) saturate(0)", opacity: 1, offset: 0.12 },
        { transform: "translate(3px,-1px) scale(1.02)", filter: "brightness(0.35) sepia(1)", opacity: 1, offset: 0.3 },
        { transform: "translate(-2px,0) scale(1)", filter: "brightness(0.15) sepia(1)", opacity: 1, offset: 0.55 },
        { transform: "translate(0,8px) scale(0.85,0.3)", filter: "brightness(0.1)", opacity: 0 },
      ], { duration: 760, easing: "ease-out" });
    }
    // Gnister
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12 + rand(-0.2, 0.2);
      const d = unit * rand(0.5, 1.1);
      const p = particle(st, "sk-fx-spark", { w: 3, h: unit * 0.22, bg: i % 2 ? "#fff6a8" : "#7fd3ff" });
      const deg = (a * 180) / Math.PI + 90;
      anim(p, [
        { transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(0) scaleY(1)`, opacity: 1 },
        { transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(${-d}px) scaleY(0.3)`, opacity: 0 },
      ], { duration: 420, delay: 60, easing: "cubic-bezier(.1,.8,.3,1)" });
    }
    // Røg
    for (let i = 0; i < 4; i++) {
      const p = particle(st, "sk-fx-smoke", { x: cx + rand(-0.25, 0.25) * unit, y: cy, w: unit * 0.45, bg: "#5b5560" });
      anim(p, [
        { transform: "translate(-50%,-50%) scale(0.3)", opacity: 0 },
        { transform: "translate(-50%,-80%) scale(0.8)", opacity: 0.55, offset: 0.35 },
        { transform: `translate(-50%,${-150 - i * 30}%) scale(1.4)`, opacity: 0 },
      ], { duration: 650, delay: 200 + i * 50, easing: "ease-out" });
    }
    noise(0.28, 0.14, 5000);
    tone("sawtooth", 110, 35, 0.4, 0.07, 0.03);
    return st;
  }

  /* ---------- Løber: ildkugle ---------- */
  function spawnFireball(board, firsts) {
    const st = fxStage(board, firsts);
    const { layer, cx, cy, unit } = st;
    const IMPACT = 260;
    const ball = particle(st, "sk-fx-fireball", { w: unit * 0.75 });
    const sx = -unit * 2.6, sy = -unit * 3;
    anim(ball, [
      { transform: `translate(-50%,-50%) translate(${sx}px,${sy}px) scale(0.5) rotate(0deg)`, opacity: 0.2 },
      { transform: `translate(-50%,-50%) translate(${sx * 0.5}px,${sy * 0.5}px) scale(0.8) rotate(180deg)`, opacity: 1, offset: 0.5 },
      { transform: "translate(-50%,-50%) translate(0,0) scale(1.1) rotate(360deg)", opacity: 1, offset: 0.95 },
      { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 },
    ], { duration: IMPACT + 40, easing: "cubic-bezier(.5,0,.9,.6)" });
    // Glødende hale
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const p = particle(st, "sk-fx-ember", { x: cx + sx * (1 - t * 0.9), y: cy + sy * (1 - t * 0.9), w: unit * (0.15 + t * 0.2), bg: i % 2 ? "#ffcf3a" : "#ff6a00" });
      anim(p, [
        { transform: "translate(-50%,-50%) scale(0)", opacity: 0 },
        { transform: "translate(-50%,-50%) scale(1)", opacity: 0.9, offset: 0.3 },
        { transform: "translate(-50%,-90%) scale(0.2)", opacity: 0 },
      ], { duration: 320, delay: t * IMPACT * 0.9 });
    }
    // Eksplosion
    const ring = particle(st, "sk-fx-blast", { w: unit * 1.1 });
    anim(ring, [
      { transform: "translate(-50%,-50%) scale(0.2)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%,-50%) scale(1.9)", opacity: 0 },
    ], { duration: 460, delay: IMPACT, easing: "ease-out" });
    const FLAME = ["#fff3a0", "#ffcf3a", "#ff8c1a", "#ff4d00", "#d92a00"];
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 * i) / 18 + rand(-0.2, 0.2);
      const d = unit * rand(0.45, 1.05);
      const p = particle(st, "sk-fx-flame", { w: unit * rand(0.14, 0.3), bg: FLAME[i % FLAME.length] });
      anim(p, [
        { transform: "translate(-50%,-50%) scale(0.4)", opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${Math.cos(a) * d}px,${Math.sin(a) * d - unit * 0.35}px) scale(1)`, opacity: 0.9, offset: 0.55 },
        { transform: `translate(-50%,-50%) translate(${Math.cos(a) * d * 1.1}px,${Math.sin(a) * d - unit * 0.7}px) scale(0.1)`, opacity: 0 },
      ], { duration: 480, delay: IMPACT + rand(0, 40), easing: "cubic-bezier(.15,.8,.3,1)" });
    }
    const ghost = makeGhost(st, firsts);
    if (ghost) {
      anim(ghost, [
        { transform: "scale(1)", filter: "none", opacity: 1, offset: 0 },
        { transform: "scale(1)", filter: "none", opacity: 1, offset: 0.3 },
        { transform: "scale(1.12) rotate(-6deg)", filter: "brightness(1.8) sepia(1) saturate(4) hue-rotate(-20deg)", opacity: 1, offset: 0.45 },
        { transform: "scale(0.8) rotate(4deg)", filter: "brightness(0.25) sepia(1)", opacity: 0.9, offset: 0.7 },
        { transform: "scale(0.3) translateY(20%)", filter: "brightness(0.1)", opacity: 0 },
      ], { duration: 780, easing: "ease-in" });
    }
    for (let i = 0; i < 4; i++) {
      const p = particle(st, "sk-fx-smoke", { x: cx + rand(-0.3, 0.3) * unit, y: cy, w: unit * 0.5, bg: "#3d3438" });
      anim(p, [
        { transform: "translate(-50%,-50%) scale(0.3)", opacity: 0 },
        { transform: "translate(-50%,-90%) scale(0.9)", opacity: 0.5, offset: 0.4 },
        { transform: `translate(-50%,${-170 - i * 25}%) scale(1.5)`, opacity: 0 },
      ], { duration: 600, delay: IMPACT + 140 + i * 40, easing: "ease-out" });
    }
    noise(0.3, 0.06, 700);
    tone("sine", 140, 35, 0.4, 0.14, 0.26);
    noise(0.35, 0.12, 1200, 0.26);
    return st;
  }

  /* ---------- Tårn: smuldrer til sten ---------- */
  function spawnRubble(board, firsts) {
    const st = fxStage(board, firsts);
    const { layer, cx, cy, unit, vr } = st;
    const ghost = makeGhost(st, firsts);
    if (ghost) {
      anim(ghost, [
        { transform: "translate(0,0)", filter: "none", opacity: 1 },
        { transform: "translate(-3px,0) rotate(-2deg)", filter: "grayscale(.4)", opacity: 1, offset: 0.1 },
        { transform: "translate(3px,0) rotate(2deg)", filter: "grayscale(.6)", opacity: 1, offset: 0.2 },
        { transform: "translate(-2px,0) rotate(-1deg)", filter: "grayscale(.8)", opacity: 1, offset: 0.3 },
        { transform: "translate(0,15%) scale(1,0.55)", filter: "grayscale(1) brightness(.7)", opacity: 0.6, offset: 0.55 },
        { transform: "translate(0,40%) scale(1.1,0.1)", filter: "grayscale(1) brightness(.6)", opacity: 0 },
      ], { duration: 640, easing: "ease-in" });
    }
    const STONE = ["#8d8478", "#a39a8c", "#6f675d", "#b9b0a1", "#5a534b"];
    const SHAPES = [
      "polygon(10% 20%, 60% 0, 100% 35%, 85% 90%, 25% 100%, 0 60%)",
      "polygon(0 30%, 45% 0, 100% 15%, 90% 80%, 40% 100%, 5% 85%)",
      "polygon(20% 0, 90% 10%, 100% 70%, 55% 100%, 0 80%)",
    ];
    for (let i = 0; i < 16; i++) {
      const x0 = cx + rand(-0.32, 0.32) * vr.width;
      const y0 = cy + rand(-0.4, 0.2) * vr.height;
      const s = unit * rand(0.1, 0.24);
      const p = particle(st, "sk-fx-stone", { x: x0, y: y0, w: s, h: s * rand(0.7, 1), bg: STONE[i % STONE.length] });
      p.style.clipPath = SHAPES[i % SHAPES.length];
      const dx = (x0 - cx) * rand(1.2, 2.4) + rand(-0.2, 0.2) * unit;
      const floor = cy + vr.height * 0.42 - y0 + rand(-0.06, 0.06) * unit;
      const rot = rand(-260, 260);
      anim(p, [
        { transform: "translate(-50%,-50%) translate(0,0) rotate(0deg)", opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${dx * 0.35}px,${-unit * rand(0.1, 0.35)}px) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(-50%,-50%) translate(${dx}px,${floor}px) rotate(${rot}deg)`, opacity: 1, offset: 0.75 },
        { transform: `translate(-50%,-50%) translate(${dx * 1.05}px,${floor - 2}px) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 620, delay: 150 + i * 12, easing: "cubic-bezier(.4,0,.8,.5)" });
    }
    for (let i = 0; i < 6; i++) {
      const p = particle(st, "sk-fx-dust", { x: cx + rand(-0.4, 0.4) * unit, y: cy + vr.height * 0.35, w: unit * 0.5, h: unit * 0.3, bg: "#cbbca3" });
      anim(p, [
        { transform: "translate(-50%,-50%) scale(0.2)", opacity: 0 },
        { transform: `translate(-50%,-70%) translateX(${rand(-0.4, 0.4) * unit}px) scale(1)`, opacity: 0.6, offset: 0.4 },
        { transform: `translate(-50%,-110%) translateX(${rand(-0.6, 0.6) * unit}px) scale(1.6)`, opacity: 0 },
      ], { duration: 620, delay: 260 + i * 25, easing: "ease-out" });
    }
    noise(0.5, 0.18, 320, 0.12);
    for (let i = 0; i < 4; i++) tone("square", rand(180, 320), 90, 0.05, 0.03, 0.25 + i * 0.07);
    return st;
  }

  /* ---------- Dronning: eksploderer i stjerner ---------- */
  function spawnStars(board, firsts) {
    const st = fxStage(board, firsts);
    const { layer, cx, cy, unit } = st;
    const POP = 280;
    const ghost = makeGhost(st, firsts);
    if (ghost) {
      anim(ghost, [
        { transform: "scale(1) rotate(0deg)", filter: "brightness(1)", opacity: 1 },
        { transform: "scale(1.25) rotate(-6deg)", filter: "brightness(1.8) drop-shadow(0 0 10px #ffe56a)", opacity: 1, offset: 0.33 },
        { transform: "scale(1.35) rotate(6deg)", filter: "brightness(3) drop-shadow(0 0 16px #fff)", opacity: 1, offset: 0.4 },
        { transform: "scale(0.1) rotate(0deg)", filter: "brightness(3)", opacity: 0 },
      ], { duration: 520, easing: "ease-in" });
    }
    const glow = particle(st, "sk-fx-glow", { w: unit * 1.8 });
    anim(glow, [
      { transform: "translate(-50%,-50%) scale(0.2)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1.2)", opacity: 1, offset: 0.3 },
      { transform: "translate(-50%,-50%) scale(2)", opacity: 0 },
    ], { duration: 520, delay: POP - 60, easing: "ease-out" });
    const COLORS = ["#ffd93b", "#ff7ad9", "#7fe3ff", "#ffffff", "#b58cff", "#ffb13b"];
    for (let i = 0; i < 22; i++) {
      const a = (Math.PI * 2 * i) / 22 + rand(-0.15, 0.15);
      const d = unit * rand(0.8, 1.8);
      const size = unit * rand(0.35, 0.6);
      const p = particle(st, i % 4 === 3 ? "sk-fx-star sk-fx-star4" : "sk-fx-star", { w: size, h: size, bg: COLORS[i % COLORS.length] });
      const rot = rand(-220, 220);
      anim(p, [
        { transform: "translate(-50%,-50%) scale(0.2) rotate(0deg)", opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${Math.cos(a) * d * 0.7}px,${Math.sin(a) * d * 0.7}px) scale(1.2) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(-50%,-50%) translate(${Math.cos(a) * d}px,${Math.sin(a) * d + unit * 0.25}px) scale(0.3) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 600, delay: POP + rand(0, 40), easing: "cubic-bezier(.1,.9,.3,1)" });
    }
    for (let i = 0; i < 8; i++) {
      const p = particle(st, "sk-fx-star sk-fx-star4", { x: cx + rand(-1.1, 1.1) * unit, y: cy + rand(-1.1, 0.8) * unit, w: unit * 0.32, h: unit * 0.32, bg: "#fff6b0" });
      anim(p, [
        { transform: "translate(-50%,-50%) scale(0) rotate(0deg)", opacity: 0 },
        { transform: "translate(-50%,-50%) scale(1.3) rotate(90deg)", opacity: 1, offset: 0.5 },
        { transform: "translate(-50%,-50%) scale(0) rotate(180deg)", opacity: 0 },
      ], { duration: 320, delay: POP + 120 + i * 35 });
    }
    [1047, 1319, 1568, 2093].forEach((f, i) => tone("triangle", f, f * 1.01, 0.18, 0.06, 0.26 + i * 0.06));
    return st;
  }

  /* ---------- Konge: sort hul (kun hvis en konge nogensinde bliver slået) ---------- */
  function spawnBlackHole(board, firsts) {
    const st = fxStage(board, firsts);
    const { layer, cx, cy, unit } = st;
    const hole = particle(st, "sk-fx-hole", { w: unit * 1.5 });
    anim(hole, [
      { transform: "translate(-50%,-50%) scale(0) rotate(0deg)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1) rotate(180deg)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%,-50%) scale(1.05) rotate(540deg)", opacity: 1, offset: 0.75 },
      { transform: "translate(-50%,-50%) scale(0) rotate(720deg)", opacity: 0 },
    ], { duration: 820, easing: "ease-in-out" });
    const ghost = makeGhost(st, firsts);
    if (ghost) {
      anim(ghost, [
        { transform: "scale(1) rotate(0deg)", filter: "none", opacity: 1 },
        { transform: "scale(1.05,0.9) rotate(-20deg)", filter: "hue-rotate(40deg)", opacity: 1, offset: 0.2 },
        { transform: "scale(0.55) rotate(-360deg)", filter: "hue-rotate(120deg) brightness(.6)", opacity: 0.9, offset: 0.55 },
        { transform: "scale(0) rotate(-900deg)", filter: "brightness(0)", opacity: 0 },
      ], { duration: 700, delay: 80, easing: "cubic-bezier(.5,0,.9,.5)" });
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, 360);
      const r = unit * rand(0.9, 1.6);
      const p = particle(st, "sk-fx-debris", { w: unit * rand(0.05, 0.12), bg: i % 3 ? "#c6a8ff" : "#ffffff" });
      anim(p, [
        { transform: `translate(-50%,-50%) rotate(${a}deg) translateX(${r}px)`, opacity: 0 },
        { transform: `translate(-50%,-50%) rotate(${a - 200}deg) translateX(${r * 0.5}px)`, opacity: 1, offset: 0.5 },
        { transform: `translate(-50%,-50%) rotate(${a - 420}deg) translateX(0px) scale(0.2)`, opacity: 0 },
      ], { duration: 640, delay: 60 + i * 15, easing: "cubic-bezier(.5,0,.9,.6)" });
    }
    tone("sine", 420, 38, 0.75, 0.12);
    return st;
  }

  const DEATH_KINDS = Object.freeze({ p: "slime", n: "lightning", b: "fireball", r: "rubble", q: "stars", k: "blackhole" });
  const DEATH_FNS = { slime: null, lightning: spawnLightning, fireball: spawnFireball, rubble: spawnRubble, stars: spawnStars, blackhole: spawnBlackHole };
  const DEATH_TTL = 950;

  function deathKind(type) {
    return DEATH_KINDS[String(type || "p").toLowerCase()] || "slime";
  }

  /** Vælg døds-effekt efter den slåede briks type (p/n/b/r/q/k). Rent visuelt. */
  function spawnDeath(board, firsts, type) {
    if (!board || !firsts?.victimRect) return () => {};
    const kind = deathKind(type);
    if (kind === "slime") return spawnSlime(board, firsts);
    let st = null;
    try { st = DEATH_FNS[kind](board, firsts); } catch (_) { st = null; }
    if (!st) return () => {};
    st.layer.dataset.death = kind;
    const timer = setTimeout(() => st.layer.remove(), DEATH_TTL);
    return () => { clearTimeout(timer); st.layer.remove(); };
  }

  /* ---------- Atomangreb: missil + svampesky (+ døds-effekt hvis brikken dør) ---------- */
  const STRIKE_FLY_MS = 450;
  const STRIKE_TOTAL_MS = 1400;
  // fromTop: modstanderens angreb (online) kommer fra modstanderens side af brættet.
  function playStrike(board, firsts, { square, killed = false, type = "p", fromTop = false } = {}) {
    if (!board || prefersReducedMotion()) return 0;
    let f = firsts;
    if (!f?.victimRect) {
      const btn = sqBtn(board, square);
      const piece = pieceIn(board, square);
      const el = piece || btn;
      if (!el) return 0;
      f = { map: {}, victimHtml: piece ? piece.outerHTML : null, victimRect: el.getBoundingClientRect(), capturedSq: square, capturedType: type, to: square, from: square };
    }
    const st = fxStage(board, f);
    const { layer, cx, cy, unit } = st;
    layer.dataset.strike = killed ? "kill" : "hit";
    // Offeret står stille, til missilet rammer
    const hold = killed ? makeGhost(st, f) : null;

    // Affyres fra spillerens side (nederst på brættet) i en bue op mod målet
    const boardH = board.getBoundingClientRect().height || unit * 8;
    const sx = cx < unit * 4 ? cx + unit * 2.5 : cx - unit * 2.5;
    const sy = fromTop ? Math.min(cy - unit * 2.5, unit * 0.3) : Math.max(cy + unit * 2.5, boardH - unit * 0.3);
    const mx = (sx + cx) / 2, my = fromTop ? (sy + cy) / 2 - unit * 0.8 : Math.min(sy, cy) - unit * 1.6;
    const angA = (Math.atan2(my - sy, mx - sx) * 180) / Math.PI + 90;
    const ang = (Math.atan2(cy - my, cx - mx) * 180) / Math.PI + 90;
    const missile = document.createElement("span");
    missile.className = "sk-fx-missile";
    missile.innerHTML = "<b></b><u></u>";
    missile.style.left = `${cx}px`;
    missile.style.top = `${cy}px`;
    layer.appendChild(missile);
    anim(missile, [
      { transform: `translate(${sx - cx}px,${sy - cy}px) rotate(${angA}deg) scale(.8)`, opacity: 1 },
      { transform: `translate(${mx - cx}px,${my - cy}px) rotate(${(angA + ang) / 2}deg) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(0,0) rotate(${ang}deg) scale(1)`, opacity: 1, offset: 0.97 },
      { transform: `translate(0,0) rotate(${ang}deg) scale(.2)`, opacity: 0 },
    ], { duration: STRIKE_FLY_MS, easing: "cubic-bezier(.55,0,1,.6)" });
    // Røgspor
    for (let i = 0; i < 8; i++) {
      const t = i / 8, u = 1 - t;
      const px = u * u * sx + 2 * u * t * (2 * mx - (sx + cx) / 2) + t * t * cx;
      const py = u * u * sy + 2 * u * t * (2 * my - (sy + cy) / 2) + t * t * cy;
      const p = particle(st, "sk-fx-smoke", { x: px, y: py, w: unit * 0.22, bg: "#d8d2cc" });
      anim(p, [
        { transform: "translate(-50%,-50%) scale(.3)", opacity: 0 },
        { transform: "translate(-50%,-50%) scale(1)", opacity: 0.6, offset: 0.2 },
        { transform: "translate(-50%,-70%) scale(1.6)", opacity: 0 },
      ], { duration: 600, delay: t * STRIKE_FLY_MS });
    }
    tone("sine", 1400, 420, STRIKE_FLY_MS / 1000, 0.05);

    const flash = document.createElement("span");
    flash.className = "sk-fx-flash";
    flash.style.background = "#fff3c0";
    layer.appendChild(flash);
    anim(flash, [{ opacity: 0 }, { opacity: 0.9, offset: 0.1 }, { opacity: 0 }], { duration: 380, delay: STRIKE_FLY_MS });

    const shock = particle(st, "sk-fx-shock", { w: unit * 0.6 });
    anim(shock, [
      { transform: "translate(-50%,-50%) scale(.3)", opacity: 1 },
      { transform: "translate(-50%,-50%) scale(4)", opacity: 0 },
    ], { duration: 520, delay: STRIKE_FLY_MS, easing: "ease-out" });

    const cloud = document.createElement("span");
    cloud.className = "sk-fx-mushroom";
    cloud.innerHTML = '<span class="base"></span><span class="stem"></span><span class="ring"></span><span class="cap"></span>';
    const cw = unit * 2, ch = unit * 2.3;
    Object.assign(cloud.style, { width: `${cw}px`, height: `${ch}px`, left: `${cx - cw / 2}px`, top: `${cy + unit * 0.45 - ch}px` });
    layer.appendChild(cloud);
    anim(cloud, [
      { transform: "scale(.15,.1)", opacity: 0, easing: "cubic-bezier(.2,.8,.3,1)" },
      { transform: "scale(.85,.75)", opacity: 1, offset: 0.15, easing: "ease-out" },
      { transform: "scale(1,1)", opacity: 1, offset: 0.65, easing: "ease-in" },
      { transform: "scale(1.08,1.04) translateY(-6%)", opacity: 0 },
    ], { duration: 950, delay: STRIKE_FLY_MS });
    noise(0.7, 0.2, 400, STRIKE_FLY_MS / 1000);
    tone("sine", 90, 30, 0.6, 0.16, STRIKE_FLY_MS / 1000);

    let deathCleanup = () => {};
    const impact = setTimeout(() => {
      if (!layer.isConnected) return;
      hold?.remove();
      if (killed) {
        deathCleanup = spawnDeath(board, f, type);
      } else {
        const piece = pieceIn(board, square);
        piece && anim(piece, [
          { transform: "translate(0,0)" }, { transform: "translate(-4px,1px) rotate(-6deg)" },
          { transform: "translate(4px,-1px) rotate(6deg)" }, { transform: "translate(0,0)" },
        ], { duration: 300, iterations: 2, fill: "none" });
        sqBtn(board, square)?.querySelector(".sk-hp")?.classList.add("sk-hp-hit");
      }
    }, STRIKE_FLY_MS);
    const timer = setTimeout(() => layer.remove(), STRIKE_TOTAL_MS + 100);
    playStrike._cleanup = () => { clearTimeout(impact); clearTimeout(timer); layer.remove(); deathCleanup(); };
    return STRIKE_TOTAL_MS;
  }

  /** Demo/test: lad brikken på `square` dø med effekten for `type` (ændrer ikke spillet). */
  function playDeath(board, square, type) {
    if (!board || prefersReducedMotion()) return () => {};
    const victim = pieceIn(board, square);
    if (!victim) return () => {};
    const firsts = { map: {}, victimHtml: victim.outerHTML, victimRect: victim.getBoundingClientRect(), capturedSq: square, capturedType: type, to: square, from: square };
    return spawnDeath(board, firsts, type);
  }

  function flipPiece(el, firstRect, { capture = false } = {}) {
    if (!el || !firstRect) return Promise.resolve();
    const last = el.getBoundingClientRect();
    const dx = firstRect.left + firstRect.width / 2 - (last.left + last.width / 2);
    const dy = firstRect.top + firstRect.height / 2 - (last.top + last.height / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return Promise.resolve();

    el.classList.add("sk-flying");
    const lift = Math.min(34, Math.hypot(dx, dy) * 0.12 + 16);
    const keyframes = [
      { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(0deg)`, offset: 0 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - lift}px) scale(1.18) rotate(${dx > 0 ? -6 : 6}deg)`, offset: 0.42 },
      { transform: "translate(0, 0) scale(1) rotate(0deg)", offset: 1 },
    ];
    const anim = el.animate(keyframes, {
      duration: prefersReducedMotion() ? 1 : GLIDE_MS,
      easing: "cubic-bezier(.22,.72,.18,1)",
      fill: "none",
    });
    return anim.finished.then(() => {
      el.classList.remove("sk-flying");
      if (capture && !prefersReducedMotion()) return victoryPose(el);
    }).catch(() => { el.classList.remove("sk-flying"); });
  }

  function victoryPose(el) {
    el.classList.add("sk-victory");
    return el.animate([
      { transform: "translateY(0) scale(1, 1) rotate(0deg)" },
      { transform: "translateY(-10px) scale(1.08, 0.92) rotate(-8deg)", offset: 0.22 },
      { transform: "translateY(-16px) scale(0.95, 1.12) rotate(8deg)", offset: 0.45 },
      { transform: "translateY(-4px) scale(1.12, 0.88) rotate(-4deg)", offset: 0.7 },
      { transform: "translateY(0) scale(1, 1) rotate(0deg)" },
    ], { duration: 520, easing: "cubic-bezier(.34,1.4,.64,1)" }).finished
      .catch(() => {})
      .finally(() => el.classList.remove("sk-victory"));
  }

  /**
   * Run FLIP glide (+ optional slime) on the board AFTER it has been re-rendered
   * to the post-move position. Purely visual; never touches game state.
   */
  function playFlip(board, firsts, info = {}) {
    if (!board || !firsts || prefersReducedMotion()) return Promise.resolve();
    const tasks = [];
    const main = pieceIn(board, info.to || firsts.to);
    if (main && firsts.map[firsts.from || info.from]) {
      tasks.push(flipPiece(main, firsts.map[firsts.from || info.from], { capture: Boolean(info.captured || firsts.victimHtml) }));
    }
    if (info.rookFrom && info.rookTo && firsts.map[info.rookFrom]) {
      const rook = pieceIn(board, info.rookTo);
      if (rook) tasks.push(flipPiece(rook, firsts.map[info.rookFrom], { capture: false }));
    }
    let cleanup = () => {};
    if (info.captured || firsts.victimHtml) {
      cleanup = spawnDeath(board, firsts, info.captured || firsts.capturedType);
    }
    // Flash last-move squares a bit brighter during the glide
    const fromBtn = sqBtn(board, info.from || firsts.from);
    const toBtn = sqBtn(board, info.to || firsts.to);
    fromBtn?.classList.add("sk-anim-flash");
    toBtn?.classList.add("sk-anim-flash");
    return Promise.all(tasks).finally(() => {
      fromBtn?.classList.remove("sk-anim-flash");
      toBtn?.classList.remove("sk-anim-flash");
      // stain lingers via its own timer inside spawnSlime
      void cleanup;
    });
  }

  function playDropPop(board, square) {
    if (!board || !square || prefersReducedMotion()) return Promise.resolve();
    const el = pieceIn(board, square);
    if (!el) return Promise.resolve();
    el.classList.add("sk-drop-pop");
    return el.animate([
      { transform: "scale(0.2)", opacity: 0.2 },
      { transform: "scale(1.18)", opacity: 1, offset: 0.55 },
      { transform: "scale(1)", opacity: 1 },
    ], { duration: DROP_MS, easing: "cubic-bezier(.2,1.4,.4,1)" }).finished
      .catch(() => {})
      .finally(() => el.classList.remove("sk-drop-pop"));
  }

  function timingFor(info) {
    if (prefersReducedMotion()) return 0;
    if (info?.captured) return GLIDE_MS + CAPTURE_EXTRA_MS;
    return GLIDE_MS + 40;
  }

  window.SkakAnim = Object.freeze({
    prefersReducedMotion,
    captureFirsts,
    playFlip,
    playDropPop,
    playDeath,
    playStrike,
    deathKind,
    DEATHS: DEATH_KINDS,
    timingFor,
    GLIDE_MS,
    CAPTURE_EXTRA_MS,
  });
})();
