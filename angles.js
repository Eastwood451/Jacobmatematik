/* Vinkler – interaktivt modul: intro-animation, præcis drag, fornemmelse, piberenser. */
(() => {
  "use strict";

  const CORE = () => window.JacobAnglesCore;
  const AUDIO_BASE = "assets/angles/audio/";
  const V = "20261105-angles1";

  const INTRO_SCRIPT = [
    { audio: "intro-piberenser", caption: "Forestil dig, du skal bede nogen om at bøje en piberenser, så den lige præcis kan ligge i en vinklet rille. Hvordan vil du fortælle nogen, hvor meget de skal bøje piberenseren?", anim: "pipe" },
    { audio: "intro-beskriv", caption: "For at kunne det, skal vi kunne beskrive en bøjning – akkurat som vi kan beskrive en længde med centimeter og meter. Hvordan beskriver man en bøjning?", anim: "think" },
    { audio: "intro-grader", caption: "Ligesom en meter er delt i centimeter, er en hel runde delt i 360 små dele. Hver del hedder en grad.", anim: "spin360" },
    { audio: "intro-360", caption: "En hel runde er 360 grader.", anim: "show360" },
    { audio: "intro-180", caption: "En halv runde er 180 grader – som en flad væg eller en lige snor.", anim: "show180" },
    { audio: "intro-90", caption: "En kvart runde er 90 grader – som hjørnet af dit bord.", anim: "show90" },
  ];

  function audioUrl(stem) {
    return `${AUDIO_BASE}angles-${stem}.mp3?v=${V}`;
  }

  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, fromDeg, toDeg) {
    const start = polar(cx, cy, r, fromDeg);
    const end = polar(cx, cy, r, toDeg);
    const sweep = toDeg - fromDeg;
    const large = Math.abs(sweep) > 180 ? 1 : 0;
    const sweepFlag = sweep >= 0 ? 0 : 1; // SVG y-down: CCW visually needs sweep 0 when math deg increases
    // With our polar (y flipped), increasing deg goes CCW on screen → SVG sweep-flag 0 for positive.
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep >= 0 ? 0 : 1} ${end.x} ${end.y} Z`;
  }

  function mountLesson(root, options = {}) {
    if (!root) return () => {};
    const core = CORE();
    if (!core) throw new Error("JacobAnglesCore mangler");

    let disposed = false;
    let screen = 1; // 1 intro, 2 precise, 3 feel, 4 pipe, 5 done
    let introStep = 0;
    let preciseIndex = 0;
    let feelIndex = 0;
    let angle = 35;
    let dragging = false;
    let animating = false;
    let audioEl = null;
    let raf = 0;
    let introAnim = { t: 0, mode: "pipe" };
    let resultsLogged = 0;
    let pipeAngle = 20;
    let reducedMotion = false;
    try { reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) {}

    root.innerHTML = `
      <section class="ang-module" data-ang-root>
        <header class="ang-header">
          <div>
            <span class="ang-eyebrow">VINKLER</span>
            <h1 data-ang-title>Vinkel hvadfornoget?</h1>
            <p data-ang-lead>Lær hvad en vinkel er – og øv dig i at sætte den.</p>
          </div>
          <button type="button" class="ang-btn ang-quiet" data-ang="exit">← Tilbage</button>
        </header>
        <div class="ang-progress" aria-hidden="true">
          <span class="ang-dot is-current" data-ang-dot="1"></span>
          <span class="ang-dot" data-ang-dot="2"></span>
          <span class="ang-dot" data-ang-dot="3"></span>
          <span class="ang-dot" data-ang-dot="4"></span>
        </div>
        <div class="ang-stage" data-ang-stage></div>
      </section>`;

    const stage = root.querySelector("[data-ang-stage]");
    const titleEl = root.querySelector("[data-ang-title]");
    const leadEl = root.querySelector("[data-ang-lead]");

    function stopAudio() {
      if (audioEl) {
        try { audioEl.pause(); audioEl.removeAttribute("src"); audioEl.load(); } catch (_) {}
        audioEl = null;
      }
    }

    function playStem(stem) {
      stopAudio();
      if (!stem) return Promise.resolve();
      return new Promise((resolve) => {
        const a = new Audio(audioUrl(stem));
        audioEl = a;
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          clearTimeout(fallback);
          a.onended = null;
          a.onerror = null;
          resolve();
        };
        // Fallback so a missing/blocked clip never freezes the lesson.
        const fallback = setTimeout(done, 8000);
        a.onended = done;
        a.onerror = done;
        a.play().catch(done);
      });
    }

    function setDots() {
      root.querySelectorAll("[data-ang-dot]").forEach((el) => {
        const n = Number(el.getAttribute("data-ang-dot"));
        el.classList.toggle("is-current", n === Math.min(screen, 4));
        el.classList.toggle("is-done", n < Math.min(screen, 4));
      });
    }

    async function logResult(problem, answer, correctAnswer, correct) {
      resultsLogged += 1;
      try {
        await options.onResult?.({
          topic: "angles",
          problem,
          answer: String(answer),
          correctAnswer: String(correctAnswer),
          correct: !!correct,
          responseTime: 0,
          timestamp: new Date().toISOString(),
        });
      } catch (_) { /* never break lesson */ }
    }

    // ---------- Drawing helpers (canvas) ----------
    function drawAngleScene(ctx, w, h, opts) {
      const cx = w / 2;
      const cy = h / 2 + 8;
      const R = Math.min(w, h) * 0.38;
      const deg = opts.deg;
      const showNumber = opts.showNumber !== false;
      const fill = opts.fill !== false;
      const rightMark = opts.rightMark && Math.abs(deg - 90) < 0.5;

      ctx.clearRect(0, 0, w, h);
      // cream disc
      ctx.beginPath();
      ctx.arc(cx, cy, R + 18, 0, Math.PI * 2);
      ctx.fillStyle = "#fffaf0";
      ctx.fill();
      ctx.strokeStyle = "#e8d9c0";
      ctx.lineWidth = 3;
      ctx.stroke();

      // soft ring ticks every 30°
      for (let d = 0; d < 360; d += 30) {
        const a = polar(cx, cy, R + 6, d);
        const b = polar(cx, cy, R + 14, d);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "#d7c6ae";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (fill && deg > 0.5) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R * 0.55, 0, -deg * Math.PI / 180, true);
        ctx.closePath();
        ctx.fillStyle = "rgba(227,165,33,0.35)";
        ctx.fill();
      }

      // fixed ray (0°)
      const fixed = polar(cx, cy, R, 0);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(fixed.x, fixed.y);
      ctx.strokeStyle = "#301946";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.stroke();

      // movable ray
      const move = polar(cx, cy, R, deg);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(move.x, move.y);
      ctx.strokeStyle = "#5b4bda";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.stroke();

      // handle
      ctx.beginPath();
      ctx.arc(move.x, move.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#5b4bda";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // vertex
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#301946";
      ctx.fill();

      if (rightMark) {
        const s = R * 0.16;
        ctx.beginPath();
        ctx.moveTo(cx + s, cy);
        ctx.lineTo(cx + s, cy - s);
        ctx.lineTo(cx, cy - s);
        ctx.strokeStyle = "#117e79";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (showNumber) {
        const mid = polar(cx, cy, R * 0.32, deg / 2);
        ctx.fillStyle = "#301946";
        ctx.font = `800 ${Math.round(w * 0.07)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${Math.round(deg)}°`, mid.x, mid.y);
      }
      return { cx, cy, R };
    }

    function drawPipeScene(ctx, w, h, bendDeg, grooveDeg, fitted) {
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.55;
      const cy = h * 0.58;
      const len = Math.min(w, h) * 0.34;

      // groove (fixed 60°)
      const g0 = polar(cx, cy, len * 1.05, 0);
      const g1 = polar(cx, cy, len * 1.05, grooveDeg);
      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(cx, cy);
      ctx.lineTo(g1.x, g1.y);
      ctx.strokeStyle = fitted ? "#117e79" : "#c4a574";
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.strokeStyle = fitted ? "#0b7161" : "#8b6432";
      ctx.lineWidth = 4;
      ctx.stroke();

      // pipe cleaner
      const p0 = polar(cx, cy, len, 0);
      const p1 = polar(cx, cy, len, bendDeg);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(cx, cy);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = fitted ? "#28aa78" : "#dc5c58";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // fuzzy ends
      [[p0.x, p0.y], [p1.x, p1.y]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = fitted ? "#28aa78" : "#e07a76";
        ctx.fill();
      });

      // handle on movable arm
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#5b4bda";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#301946";
      ctx.font = "800 18px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`Rille: ${grooveDeg}°`, w / 2, 28);
    }

    function drawIntroFrame(ctx, w, h) {
      const mode = introAnim.mode;
      const t = introAnim.t;
      ctx.clearRect(0, 0, w, h);

      if (mode === "pipe" || mode === "think") {
        // angled groove + pipe cleaner bending
        const groove = 60;
        const bend = mode === "think" ? 60 : 15 + Math.min(45, t * 50);
        drawPipeScene(ctx, w, h, bend, groove, mode === "think" && bend > 55);
        if (mode === "pipe") {
          ctx.fillStyle = "#6d5c7e";
          ctx.font = "700 15px system-ui";
          ctx.textAlign = "center";
          ctx.fillText("Piberenser → rille", w / 2, h - 18);
        }
        return;
      }

      let deg = 40;
      let showNumber = true;
      let rightMark = false;
      if (mode === "spin360") deg = Math.min(360, t * 120);
      if (mode === "show360") deg = 360;
      if (mode === "show180") deg = reducedMotion ? 180 : Math.min(180, 40 + t * 90);
      if (mode === "show90") { deg = reducedMotion ? 90 : Math.min(90, 20 + t * 70); rightMark = Math.abs(deg - 90) < 1; }
      if (deg > 180 && mode !== "spin360" && mode !== "show360") deg = 180;
      // For full turn visualization, draw with special handling
      if (mode === "spin360" || mode === "show360") {
        const cx = w / 2, cy = h / 2 + 8, R = Math.min(w, h) * 0.38;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 18, 0, Math.PI * 2);
        ctx.fillStyle = "#fffaf0";
        ctx.fill();
        ctx.strokeStyle = "#e8d9c0";
        ctx.lineWidth = 3;
        ctx.stroke();
        const sweep = Math.min(360, deg);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R * 0.7, 0, -sweep * Math.PI / 180, true);
        ctx.closePath();
        ctx.fillStyle = "rgba(91,75,218,0.28)";
        ctx.fill();
        const move = polar(cx, cy, R, sweep % 360);
        const fixed = polar(cx, cy, R, 0);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(fixed.x, fixed.y);
        ctx.strokeStyle = "#301946"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(move.x, move.y);
        ctx.strokeStyle = "#5b4bda"; ctx.lineWidth = 5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = "#301946"; ctx.fill();
        ctx.fillStyle = "#301946";
        ctx.font = `800 ${Math.round(w * 0.08)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${Math.round(Math.min(360, deg))}°`, cx, cy - R * 0.25);
        return;
      }
      drawAngleScene(ctx, w, h, { deg, showNumber, rightMark, fill: true });
    }

    function pointerAngle(canvas, clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 + 8;
      return core.angleFromPoint(cx, cy, x, y);
    }

    function bindDrag(canvas, getAngle, setAngle, onRelease) {
      const onDown = (e) => {
        if (animating) return;
        dragging = true;
        canvas.classList.add("is-dragging");
        const pt = e.touches ? e.touches[0] : e;
        setAngle(pointerAngle(canvas, pt.clientX, pt.clientY));
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        const pt = e.touches ? e.touches[0] : e;
        setAngle(pointerAngle(canvas, pt.clientX, pt.clientY));
        e.preventDefault();
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        canvas.classList.remove("is-dragging");
        onRelease?.(getAngle());
      };
      canvas.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return () => {
        canvas.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
    }

    let unbindDrag = null;

    function animateTo(target, duration, onFrame, onDone) {
      animating = true;
      const from = angle;
      const start = performance.now();
      const tick = (now) => {
        if (disposed) return;
        const p = Math.min(1, (now - start) / duration);
        const ease = 1 - Math.pow(1 - p, 3);
        angle = from + (target - from) * ease;
        onFrame?.(angle);
        if (p < 1) raf = requestAnimationFrame(tick);
        else { animating = false; angle = target; onFrame?.(angle); onDone?.(); }
      };
      raf = requestAnimationFrame(tick);
    }

    // ---------- Screens ----------
    function renderIntro() {
      titleEl.textContent = "Vinkel hvadfornoget?";
      leadEl.textContent = "En kort fortælling om bøjninger og grader.";
      setDots();
      const step = INTRO_SCRIPT[introStep];
      stage.innerHTML = `
        <h2 class="ang-stage-title">Del ${introStep + 1} af ${INTRO_SCRIPT.length}</h2>
        <p class="ang-caption" data-ang-caption>${step.caption}</p>
        <div class="ang-canvas-wrap"><canvas width="520" height="520" data-ang-canvas aria-label="Animation om vinkler"></canvas></div>
        <div class="ang-actions">
          <button type="button" class="ang-btn ang-teal" data-ang="intro-next" ${introStep < INTRO_SCRIPT.length - 1 ? "" : "hidden"}>Videre</button>
          <button type="button" class="ang-btn ang-teal" data-ang="intro-start" ${introStep === INTRO_SCRIPT.length - 1 ? "" : "hidden"}>Prøv selv</button>
          <button type="button" class="ang-btn ang-quiet" data-ang="intro-skip">Spring intro over</button>
        </div>`;
      const canvas = stage.querySelector("[data-ang-canvas]");
      const ctx = canvas.getContext("2d");
      introAnim = { t: 0, mode: step.anim };
      const start = performance.now();
      const loop = (now) => {
        if (disposed || screen !== 1) return;
        introAnim.t = (now - start) / 1000;
        drawIntroFrame(ctx, canvas.width, canvas.height);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      playStem(step.audio);
    }

    function renderPrecise() {
      titleEl.textContent = "Sæt vinklen";
      leadEl.textContent = "Træk i det lilla ben. Tallet hjælper dig.";
      setDots();
      const target = core.PRECISE_TASKS[preciseIndex];
      angle = 25;
      stage.innerHTML = `
        <h2 class="ang-stage-title">Opgave ${preciseIndex + 1} af ${core.PRECISE_TASKS.length}</h2>
        <p class="ang-sub" data-ang-prompt>Sæt vinklen på ${target} grader.</p>
        <div class="ang-readout" data-ang-readout>${angle}°<small>grader</small></div>
        <div class="ang-canvas-wrap"><canvas width="520" height="520" data-ang-canvas aria-label="Træk i vinkelbenet"></canvas></div>
        <p class="ang-feedback" data-ang-feedback role="status"></p>
        <div class="ang-actions">
          <button type="button" class="ang-btn ang-teal" data-ang="check-precise">Tjek</button>
        </div>`;
      const canvas = stage.querySelector("[data-ang-canvas]");
      const ctx = canvas.getContext("2d");
      const redraw = () => {
        drawAngleScene(ctx, canvas.width, canvas.height, { deg: angle, showNumber: true });
        const ro = stage.querySelector("[data-ang-readout]");
        if (ro) ro.innerHTML = `${Math.round(angle)}°<small>grader</small>`;
      };
      redraw();
      unbindDrag?.();
      unbindDrag = bindDrag(canvas, () => angle, (a) => { angle = a; redraw(); }, () => {});
      playStem(`task-${target}`);
    }

    async function checkPrecise() {
      if (animating) return;
      const target = core.PRECISE_TASKS[preciseIndex];
      const fb = stage.querySelector("[data-ang-feedback]");
      if (core.withinTolerance(angle, target, core.PRECISE_TOL)) {
        fb.className = "ang-feedback is-good";
        fb.textContent = "Flot!";
        await logResult(`Sæt vinklen på ${target}°`, Math.round(angle), target, true);
        await playStem("good");
        if (disposed) return;
        if (Math.abs(angle - target) > 0.2) {
          await new Promise((r) => animateTo(target, 280, () => {
            drawAngleScene(stage.querySelector("[data-ang-canvas]").getContext("2d"), 520, 520, { deg: angle, showNumber: true });
            stage.querySelector("[data-ang-readout]").innerHTML = `${Math.round(angle)}°<small>grader</small>`;
          }, r));
        }
        preciseIndex += 1;
        if (preciseIndex >= core.PRECISE_TASKS.length) {
          screen = 3; feelIndex = 0; renderFeel();
        } else renderPrecise();
      } else {
        const dir = core.hintDirection(angle, target);
        fb.className = "ang-feedback is-hint";
        fb.textContent = dir === "more" ? "Lidt mere." : "Lidt mindre.";
        playStem(dir === "more" ? "hint-more" : "hint-less");
      }
    }

    function renderFeel() {
      titleEl.textContent = "På fornemmelsen";
      leadEl.textContent = "Nu uden tal. Gæt dig frem – vi hjælper lidt til sidst.";
      setDots();
      const target = core.FEEL_TASKS[feelIndex];
      angle = 20;
      stage.innerHTML = `
        <h2 class="ang-stage-title">Fornemmelse ${feelIndex + 1} af ${core.FEEL_TASKS.length}</h2>
        <p class="ang-sub" data-ang-prompt>Prøv at sætte vinklen på ${target} grader – sådan cirka.</p>
        <div class="ang-readout" data-ang-readout hidden>?°<small>skjult</small></div>
        <div class="ang-canvas-wrap"><canvas width="520" height="520" data-ang-canvas aria-label="Træk i vinkelbenet uden tal"></canvas></div>
        <p class="ang-feedback" data-ang-feedback role="status"></p>
        <div class="ang-actions">
          <button type="button" class="ang-btn ang-teal" data-ang="check-feel">Tjek</button>
        </div>`;
      const canvas = stage.querySelector("[data-ang-canvas]");
      const ctx = canvas.getContext("2d");
      const redraw = () => drawAngleScene(ctx, canvas.width, canvas.height, { deg: angle, showNumber: false });
      redraw();
      unbindDrag?.();
      unbindDrag = bindDrag(canvas, () => angle, (a) => { angle = a; redraw(); }, () => {});
      playStem(`feel-${target}`);
    }

    async function checkFeel() {
      if (animating) return;
      const target = core.FEEL_TASKS[feelIndex];
      const fb = stage.querySelector("[data-ang-feedback]");
      const canvas = stage.querySelector("[data-ang-canvas]");
      const ctx = canvas.getContext("2d");
      if (core.withinTolerance(angle, target, core.FEEL_TOL)) {
        fb.className = "ang-feedback is-good";
        fb.textContent = "Tæt på! Vi retter de sidste grader…";
        await new Promise((r) => animateTo(target, 450, (a) => {
          drawAngleScene(ctx, canvas.width, canvas.height, { deg: a, showNumber: false });
        }, r));
        if (disposed) return;
        drawAngleScene(ctx, canvas.width, canvas.height, { deg: target, showNumber: true, rightMark: target === 90 });
        const ro = stage.querySelector("[data-ang-readout]");
        ro.hidden = false;
        ro.innerHTML = `${target}°<small>grader</small>`;
        fb.textContent = `Det var ${target} grader!`;
        await logResult(`Fornemmelse ${target}°`, Math.round(angle), target, true);
        await playStem(`reveal-${target}`);
        if (disposed) return;
        feelIndex += 1;
        if (feelIndex >= core.FEEL_TASKS.length) {
          screen = 4; pipeAngle = 25; renderPipe();
        } else renderFeel();
      } else {
        const dir = core.hintDirection(angle, target);
        fb.className = "ang-feedback is-hint";
        fb.textContent = dir === "more" ? "Lidt mere." : "Lidt mindre.";
        playStem(dir === "more" ? "hint-more" : "hint-less");
      }
    }

    function renderPipe() {
      titleEl.textContent = "Piberenseren";
      leadEl.textContent = "Luk cirklen: bøj, så den passer i rillen.";
      setDots();
      pipeAngle = 25;
      stage.innerHTML = `
        <h2 class="ang-stage-title">Bøj piberenseren</h2>
        <p class="ang-sub">Træk i enden, så den passer i rillen på ${core.PIPE_TARGET} grader.</p>
        <div class="ang-canvas-wrap"><canvas width="520" height="520" data-ang-canvas aria-label="Bøj piberenseren"></canvas></div>
        <p class="ang-feedback" data-ang-feedback role="status"></p>
        <div class="ang-actions">
          <button type="button" class="ang-btn ang-teal" data-ang="check-pipe">Passer den?</button>
        </div>`;
      const canvas = stage.querySelector("[data-ang-canvas]");
      const ctx = canvas.getContext("2d");
      const redraw = (fitted = false) => drawPipeScene(ctx, canvas.width, canvas.height, pipeAngle, core.PIPE_TARGET, fitted);
      redraw(false);
      unbindDrag?.();
      unbindDrag = bindDrag(canvas, () => pipeAngle, (a) => { pipeAngle = a; redraw(false); }, () => {});
      playStem("pipe-intro");
    }

    async function checkPipe() {
      const fb = stage.querySelector("[data-ang-feedback]");
      const canvas = stage.querySelector("[data-ang-canvas]");
      const ctx = canvas.getContext("2d");
      if (core.withinTolerance(pipeAngle, core.PIPE_TARGET, core.PIPE_TOL)) {
        // snap + drop
        await new Promise((r) => {
          animating = true;
          const from = pipeAngle;
          const start = performance.now();
          const tick = (now) => {
            const p = Math.min(1, (now - start) / 400);
            pipeAngle = from + (core.PIPE_TARGET - from) * (1 - Math.pow(1 - p, 3));
            drawPipeScene(ctx, canvas.width, canvas.height, pipeAngle, core.PIPE_TARGET, p > 0.6);
            if (p < 1) raf = requestAnimationFrame(tick);
            else { animating = false; r(); }
          };
          raf = requestAnimationFrame(tick);
        });
        fb.className = "ang-feedback is-good";
        fb.textContent = "Perfekt! Piberenseren passer!";
        await logResult("Piberenser i 60° rille", Math.round(pipeAngle), core.PIPE_TARGET, true);
        await playStem("pipe-done");
        if (disposed) return;
        screen = 5;
        renderDone();
      } else {
        const dir = core.hintDirection(pipeAngle, core.PIPE_TARGET);
        fb.className = "ang-feedback is-hint";
        fb.textContent = dir === "more" ? "Lidt mere." : "Lidt mindre.";
        playStem(dir === "more" ? "hint-more" : "hint-less");
      }
    }

    function renderDone() {
      titleEl.textContent = "Færdig!";
      leadEl.textContent = "Du kan beskrive en bøjning med grader.";
      setDots();
      unbindDrag?.();
      unbindDrag = null;
      stage.innerHTML = `
        <div class="ang-finish">
          <div class="ang-finish-stars">★★★</div>
          <h2>Du har lært, hvad en vinkel er</h2>
          <p>En hel runde er 360°, en halv er 180°, og et hjørne er 90°.</p>
          <div class="ang-actions" style="margin-top:22px">
            <button type="button" class="ang-btn ang-teal" data-ang="restart">Prøv igen</button>
            <button type="button" class="ang-btn ang-quiet" data-ang="exit">Tilbage</button>
          </div>
        </div>`;
      playStem("done");
      // Mark tracked exercise complete via a successful final result already logged.
      try { options.onComplete?.(); } catch (_) {}
    }

    function onClick(e) {
      const btn = e.target.closest("button");
      if (!btn || !root.contains(btn)) return;
      const act = btn.dataset.ang;
      if (act === "exit") { options.onExit?.(); return; }
      if (act === "intro-skip") { cancelAnimationFrame(raf); stopAudio(); screen = 2; preciseIndex = 0; renderPrecise(); return; }
      if (act === "intro-next") {
        cancelAnimationFrame(raf); stopAudio();
        introStep = Math.min(INTRO_SCRIPT.length - 1, introStep + 1);
        renderIntro();
        return;
      }
      if (act === "intro-start") { cancelAnimationFrame(raf); stopAudio(); screen = 2; preciseIndex = 0; renderPrecise(); return; }
      if (act === "check-precise") void checkPrecise();
      if (act === "check-feel") void checkFeel();
      if (act === "check-pipe") void checkPipe();
      if (act === "restart") {
        stopAudio(); screen = 1; introStep = 0; preciseIndex = 0; feelIndex = 0; resultsLogged = 0;
        renderIntro();
      }
    }

    root.addEventListener("click", onClick);
    renderIntro();

    return function dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      stopAudio();
      unbindDrag?.();
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    };
  }


  const GAME_MODULES = {
    battleship: { name: "angle-battleship", api: "JacobAngleBattleship", title: "Vinkel-slagskibe" },
    dennis: { name: "angle-dennis", api: "JacobAngleDennis", title: "Dennis med bind for øjnene" },
    ninja: { name: "angle-ninja", api: "JacobAngleNinja", title: "Villy Vinkelninja" },
    words: { name: "angle-words", api: "JacobAngleWords", title: "Vinkel-ord" },
    stop: { name: "angle-stop", api: "JacobAngleStop", title: "Ram vinklen" },
  };

  async function loadGameModule(key) {
    const meta = GAME_MODULES[key];
    if (!meta) throw new Error("Ukendt spil: " + key);
    if (window[meta.api]?.mount) return window[meta.api];
    if (!window.JacobModules?.load) throw new Error("Module loader mangler");
    await window.JacobModules.load(meta.name);
    const api = window[meta.api];
    if (!api?.mount) throw new Error("Spillet indlæste ikke: " + meta.title);
    return api;
  }

  function mount(root, options = {}) {
    if (!root) return () => {};
    let childDispose = null;
    let disposed = false;

    function clearChild() {
      try { childDispose?.(); } catch (_) {}
      childDispose = null;
    }

    function showHub() {
      clearChild();
      if (disposed) return;
      root.innerHTML = `
        <section class="ang-module" data-ang-hub>
          <header class="ang-header">
            <div>
              <span class="ang-eyebrow">VINKLER</span>
              <h1>Vinkler</h1>
              <p>Lær hvad en vinkel er – og spil dig til at kunne måle og beskrive dem.</p>
            </div>
            <button type="button" class="ang-btn ang-quiet" data-ang-hub="exit">← Tilbage</button>
          </header>
          <div class="ang-stage">
            <h2 class="ang-stage-title">Vælg</h2>
            <div class="ag-hub">
              <button type="button" class="ag-hub-card" data-ang-hub="lesson">
                <span class="ag-hub-icon">∠</span>
                <strong>Vinkel hvadfornoget?</strong>
                <small>Intro, træk vinklen, fornemmelse og piberenser.</small>
              </button>
              <button type="button" class="ag-hub-card" data-ang-hub="battleship">
                <span class="ag-hub-icon">🚢</span>
                <strong>Vinkel-slagskibe</strong>
                <small>Tryk hurtigt på den rigtige vinkel og sænk skibe.</small>
              </button>
              <button type="button" class="ag-hub-card" data-ang-hub="dennis">
                <span class="ag-hub-icon">🐧</span>
                <strong>Dennis med bind for øjnene</strong>
                <small>Drej og gå – find fisken på kortet.</small>
              </button>
              <button type="button" class="ag-hub-card" data-ang-hub="ninja">
                <span class="ag-hub-icon">🥷</span>
                <strong>Villy Vinkelninja</strong>
                <small>Fruit Ninja-snit: swipe den rigtige vinkel.</small>
              </button>
              <button type="button" class="ag-hub-card" data-ang-hub="words">
                <span class="ag-hub-icon">📝</span>
                <strong>Vinkel-ord</strong>
                <small>Spids, ret, stump eller lige?</small>
              </button>
              <button type="button" class="ag-hub-card" data-ang-hub="stop">
                <span class="ag-hub-icon">🎯</span>
                <strong>Ram vinklen</strong>
                <small>Stop den åbnende vinkel tættest på målet.</small>
              </button>
            </div>
          </div>
        </section>`;
    }

    async function openLesson() {
      clearChild();
      childDispose = mountLesson(root, {
        ...options,
        onExit() { showHub(); },
        // Keep onComplete/onResult from parent for lesson tracking.
      });
    }

    async function openGame(key) {
      clearChild();
      root.innerHTML = `<section class="ang-module"><div class="ang-stage"><p class="ang-sub">Indlæser spil…</p></div></section>`;
      try {
        const api = await loadGameModule(key);
        if (disposed) return;
        childDispose = api.mount(root, {
          user: options.user,
          onResult: options.onResult,
          onComplete: options.onComplete,
          onExit() { showHub(); },
        });
      } catch (err) {
        console.error(err);
        if (disposed) return;
        root.innerHTML = `<section class="ang-module"><div class="ang-stage">
          <p class="ang-sub">Spillet kunne ikke indlæses. Prøv igen.</p>
          <div class="ang-actions"><button type="button" class="ang-btn ang-quiet" data-ang-hub="back">Tilbage</button></div>
        </div></section>`;
      }
    }

    function onClick(e) {
      const btn = e.target.closest("button");
      if (!btn || !root.contains(btn)) return;
      const act = btn.dataset.angHub;
      if (!act) return;
      if (act === "exit") { options.onExit?.(); return; }
      if (act === "back" || act === "hub") { showHub(); return; }
      if (act === "lesson") { void openLesson(); return; }
      if (act === "battleship" || act === "dennis" || act === "ninja" || act === "words" || act === "stop") { void openGame(act); return; }
    }

    root.addEventListener("click", onClick);
    showHub();

    return function dispose() {
      disposed = true;
      clearChild();
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    };
  }

  window.JacobAngles = { mount, mountLesson };
})();

