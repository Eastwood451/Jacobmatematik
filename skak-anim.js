/* Skak-animationer — rent visuelt lag (FLIP + WAAPI + CSS/canvas-slim).
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
    return { map, victimHtml, victimRect, capturedSq: captSq, to: info.to, from: info.from };
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

  function spawnSlime(board, firsts) {
    if (!board || !firsts?.victimRect) return () => {};
    const wrap = board.closest(".sk-board-wrap") || board.parentElement || board;
    const layer = document.createElement("div");
    layer.className = "sk-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    wrap.appendChild(layer);

    const wrapRect = wrap.getBoundingClientRect();
    const vr = firsts.victimRect;
    const cx = vr.left + vr.width / 2 - wrapRect.left;
    const cy = vr.top + vr.height / 2 - wrapRect.top;

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
    const timer = setTimeout(() => layer.remove(), ttl);
    return () => { clearTimeout(timer); layer.remove(); };
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
      cleanup = spawnSlime(board, firsts);
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
    timingFor,
    GLIDE_MS,
    CAPTURE_EXTRA_MS,
  });
})();
