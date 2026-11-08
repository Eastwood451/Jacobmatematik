/* Brøk-løb – Øbbe Øvdig løber (Subway Surfers-stil). Canvas 2D pseudo-3D, ingen eksterne biblioteker.
   Forhindringer: brandhaner, mursten, bannere, kæmpe-appelsiner og de dumme skakbrikker
   (Surling-bønder, Erling, Broder Brok, Gunnar, Else og Kejser Dummo).
   Erling, Gunnar, Else og Kejser Dummo spærrer også vejen med et brøkspørgsmål i slowmotion. */
(() => {
  "use strict";

  const CORE = () => window.JacobBrokLoebCore;
  const BEST_KEY = "jm_brok_loeb_best";
  const ASSET = "assets/brok-loeb/";
  const LANE_W = 1.3;
  const CAM_D = 3.4;
  const CAM_H = 2.25;
  const FAR = 72;
  const GATE_EVERY = 115;
  const FIRST_GATE = 60;
  const MAX_LIVES = 3;

  const CHARS = {
    erling: { src: "erling.webp", name: "Erling Ærgerlig", h: 2.05, line: "Brøker er DUMME!" },
    gunnar: { src: "gunnar.webp", name: "Gunnar Giderik", h: 1.95, line: "Gider ik' flytte mig…" },
    else: { src: "else.webp", name: "Eksamens-Else", h: 1.95, line: "Tid til eksamen!" },
    dummo: { src: "dummo.webp", name: "Kejser Dummo", h: 2.05, line: "NEJ! 2 + 2 = 5!" },
  };
  const CHAR_ORDER = ["erling", "gunnar", "else", "dummo"];
  // De dumme (sorte) brikker fra skakspillet. Samme navne og originalkunst som skak.js.
  // Hoppets top er 8.2²/(2·24) ≈ 1,40, så højderne ligger over et hop: typen "tall" matcher det, man ser.
  const PIECE_ART = "assets/figurer/skak/";
  const EVIL_PIECES = Object.freeze([
    { id: "p", file: "b-p.webp", name: "Surling", role: "bonde", h: 1.72 },
    { id: "n", file: "b-n.webp", name: "Erling Ærgerlig", role: "springer", h: 1.78 },
    { id: "b", file: "b-b.webp", name: "Broder Brok", role: "løber", h: 1.88 },
    { id: "r", file: "b-r.webp", name: "Gunnar Giderik", role: "tårn", h: 1.76 },
    { id: "q", file: "b-q.webp", name: "Eksamens-Else", role: "dronning", h: 1.84 },
    { id: "k", file: "b-k.webp", name: "Kejser Dummo", role: "konge", h: 1.96 },
  ]);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const laneX = (lane) => (lane - 1) * LANE_W;

  function loadBest() {
    try { const n = Number(localStorage.getItem(BEST_KEY) || 0); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; } catch (_) { return 0; }
  }
  function saveBest(score) {
    try { if (score > loadBest()) { localStorage.setItem(BEST_KEY, String(Math.floor(score))); return true; } } catch (_) {}
    return false;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  // Klip gennemsigtig kant af originalkunsten, så perspektiv og hitbox følger selve brikken.
  function trimSprite(image) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return null;
    const src = makeCanvas(width, height);
    const sx = src.getContext("2d", { willReadFrequently: true });
    sx.drawImage(image, 0, 0);
    const data = sx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (data[row + x * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const out = makeCanvas(w, h);
    out.getContext("2d").drawImage(src, minX, minY, w, h, 0, 0, w, h);
    return out;
  }

  // ---------- Procedurale sprites (tegnes én gang) ----------
  function outlineStyle(ctx, w = 6) { ctx.lineWidth = w; ctx.strokeStyle = "#1d1630"; ctx.lineJoin = "round"; ctx.lineCap = "round"; }

  function spriteHydrant() {
    const c = makeCanvas(160, 220), x = c.getContext("2d");
    outlineStyle(x);
    x.fillStyle = "#e5403b";
    x.beginPath(); x.roundRect(40, 60, 80, 150, 14); x.fill(); x.stroke();
    x.beginPath(); x.roundRect(14, 100, 132, 34, 14); x.fill(); x.stroke();
    x.beginPath(); x.ellipse(80, 60, 46, 30, 0, Math.PI, 0); x.fill(); x.stroke();
    x.fillStyle = "#ffcf3f"; x.beginPath(); x.roundRect(66, 14, 28, 26, 8); x.fill(); x.stroke();
    x.beginPath(); x.roundRect(28, 196, 104, 20, 8); x.fillStyle = "#a82b2b"; x.fill(); x.stroke();
    x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(52, 70, 10, 120);
    return c;
  }
  function spriteWall() {
    const c = makeCanvas(260, 150), x = c.getContext("2d");
    x.fillStyle = "#7a2f26"; x.fillRect(0, 0, 260, 150);
    const bw = 52, bh = 25;
    for (let r = 0; r < 6; r++) {
      for (let k = -1; k < 6; k++) {
        const bx = k * bw + (r % 2 ? bw / 2 : 0), by = r * bh;
        x.fillStyle = ["#c4553f", "#b24a37", "#d0644a"][(r * 7 + k * 3 + 9) % 3];
        x.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
      }
    }
    outlineStyle(x, 8); x.strokeRect(4, 4, 252, 142);
    return c;
  }
  function spriteBar() {
    const c = makeCanvas(260, 200), x = c.getContext("2d");
    outlineStyle(x);
    x.fillStyle = "#4b3fbf"; x.fillRect(16, 40, 14, 160); x.fillRect(230, 40, 14, 160);
    x.strokeRect(16, 40, 14, 160); x.strokeRect(230, 40, 14, 160);
    x.fillStyle = "#fff7e6"; x.beginPath(); x.roundRect(4, 10, 252, 78, 14); x.fill(); x.stroke();
    x.save(); x.beginPath(); x.roundRect(4, 10, 252, 78, 14); x.clip();
    x.fillStyle = "#5b4bda"; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 30, 88); x.lineTo(i * 30 + 16, 88); x.lineTo(i * 30 + 46, 10); x.lineTo(i * 30 + 30, 10); x.fill(); }
    x.restore();
    x.fillStyle = "#fff7e6"; x.beginPath(); x.roundRect(64, 24, 132, 50, 10); x.fill(); x.stroke();
    x.fillStyle = "#1d1630"; x.font = "900 34px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("DUK!", 130, 50);
    return c;
  }
  function spriteOrange() {
    const c = makeCanvas(220, 220), x = c.getContext("2d");
    outlineStyle(x);
    const g = x.createRadialGradient(80, 80, 10, 110, 110, 104);
    g.addColorStop(0, "#ffc163"); g.addColorStop(1, "#f07b16");
    x.fillStyle = g; x.beginPath(); x.arc(110, 112, 100, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = "#e46a0e"; for (let i = 0; i < 40; i++) { const a = i * 2.4, r = 20 + (i * 37) % 70; x.beginPath(); x.arc(110 + Math.cos(a) * r, 112 + Math.sin(a) * r, 2.4, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = "#3f9a3a"; x.beginPath(); x.ellipse(126, 18, 26, 11, -0.5, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = "#fff8"; x.beginPath(); x.ellipse(72, 62, 22, 12, -0.7, 0, Math.PI * 2); x.fill();
    return c;
  }
  function spriteStar() {
    const c = makeCanvas(96, 96), x = c.getContext("2d");
    outlineStyle(x, 5);
    x.fillStyle = "#ffd23f";
    x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 19 : 42, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(48 + Math.cos(a) * r, 50 + Math.sin(a) * r); }
    x.closePath(); x.fill(); x.stroke();
    x.fillStyle = "#fff6"; x.beginPath(); x.ellipse(40, 36, 9, 5, -0.6, 0, Math.PI * 2); x.fill();
    return c;
  }
  function spriteHouse(seed) {
    const walls = ["#f2c48d", "#e9a7a0", "#a8d5c2", "#c9b8ea", "#f5e2a8", "#b9d3f0"];
    const c = makeCanvas(220, 260), x = c.getContext("2d");
    outlineStyle(x, 5);
    const wall = walls[seed % walls.length];
    x.fillStyle = wall; x.fillRect(14, 90, 192, 166); x.strokeRect(14, 90, 192, 166);
    x.fillStyle = seed % 2 ? "#7b3b3b" : "#4a3f73";
    x.beginPath(); x.moveTo(4, 96); x.lineTo(110, 10); x.lineTo(216, 96); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = "#fff8d8";
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) { x.fillRect(30 + k * 60, 110 + r * 62, 40, 40); x.strokeRect(30 + k * 60, 110 + r * 62, 40, 40); }
    x.fillStyle = "#6b4a2b"; x.fillRect(92, 206, 36, 50); x.strokeRect(92, 206, 36, 50);
    return c;
  }
  function spriteSchool() {
    const c = makeCanvas(300, 300), x = c.getContext("2d");
    outlineStyle(x, 5);
    x.fillStyle = "#c4553f"; x.fillRect(10, 70, 280, 226); x.strokeRect(10, 70, 280, 226);
    x.fillStyle = "#b24a37"; x.fillRect(120, 10, 60, 70); x.strokeRect(120, 10, 60, 70);
    x.fillStyle = "#fff"; x.beginPath(); x.arc(150, 44, 20, 0, Math.PI * 2); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(150, 44); x.lineTo(150, 30); x.moveTo(150, 44); x.lineTo(160, 48); x.stroke();
    x.fillStyle = "#fff7e6"; x.fillRect(70, 84, 160, 34); x.strokeRect(70, 84, 160, 34);
    x.fillStyle = "#4032ba"; x.font = "900 26px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("SKOLE", 150, 102);
    x.fillStyle = "#cfe6ff";
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { x.fillRect(28 + k * 66, 136 + r * 66, 44, 44); x.strokeRect(28 + k * 66, 136 + r * 66, 44, 44); }
    return c;
  }
  function spriteTree(seed) {
    const c = makeCanvas(160, 240), x = c.getContext("2d");
    outlineStyle(x, 5);
    x.fillStyle = "#7a5230"; x.fillRect(68, 140, 24, 96); x.strokeRect(68, 140, 24, 96);
    x.fillStyle = seed % 2 ? "#4fa64a" : "#5db85a";
    for (const [cx, cy, r] of [[80, 70, 60], [44, 110, 42], [116, 110, 42]]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.stroke(); }
    x.fillStyle = "#ffffff30"; x.beginPath(); x.arc(64, 50, 18, 0, Math.PI * 2); x.fill();
    return c;
  }
  function spriteLamp() {
    const c = makeCanvas(60, 260), x = c.getContext("2d");
    outlineStyle(x, 4);
    x.fillStyle = "#3d3557"; x.fillRect(26, 30, 8, 226); x.strokeRect(26, 30, 8, 226);
    x.fillStyle = "#ffe48a"; x.beginPath(); x.roundRect(12, 6, 36, 30, 8); x.fill(); x.stroke();
    return c;
  }

  // ---------- Lyd (WebAudio, selvlavet) ----------
  function createSound() {
    let ctx = null, muted = false;
    function ensure() {
      if (ctx || muted) return ctx;
      try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); } catch (_) { ctx = null; }
      return ctx;
    }
    function tone(freq, dur, type = "sine", vol = 0.12, slide = 0) {
      if (muted) return;
      const c = ensure(); if (!c) return;
      try {
        const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
        o.type = type; o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
      } catch (_) {}
    }
    return {
      unlock() { const c = ensure(); try { c?.resume?.(); } catch (_) {} },
      coin() { tone(988, 0.08, "square", 0.05); setTimeout(() => tone(1319, 0.12, "square", 0.05), 60); },
      jump() { tone(420, 0.16, "triangle", 0.08, 320); },
      hit() { tone(180, 0.3, "sawtooth", 0.09, -120); },
      slow() { tone(520, 0.6, "sine", 0.07, -380); },
      good() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.14, "triangle", 0.09), i * 70)); },
      bad() { tone(300, 0.22, "square", 0.06, -80); setTimeout(() => tone(220, 0.3, "square", 0.06, -60), 160); },
      setMuted(v) { muted = !!v; if (muted && ctx) { try { ctx.suspend(); } catch (_) {} } else if (ctx) { try { ctx.resume(); } catch (_) {} } },
      get muted() { return muted; },
      close() { try { ctx?.close(); } catch (_) {} ctx = null; },
    };
  }

  function mount(root, options = {}) {
    if (!root) return () => {};
    const C = CORE();
    const rand = options.random || Math.random;
    root.innerHTML = `
      <section class="bl-app" aria-label="Brøk-løb">
        <div class="bl-stage" data-bl-stage>
          <canvas class="bl-canvas" data-bl-canvas aria-label="Øbbe løber på banen. Swipe eller brug piletasterne."></canvas>
          <div class="bl-vignette" data-bl-vignette></div>
          <div class="bl-hud" data-bl-hud hidden>
            <div class="bl-hud-left">
              <span class="bl-chip"><b data-bl-score>0</b> point</span>
              <span class="bl-chip"><b data-bl-dist>0</b> m</span>
              <span class="bl-chip">★ <b data-bl-stars>0</b></span>
            </div>
            <div class="bl-hud-right">
              <span class="bl-lives" data-bl-lives aria-label="Liv"></span>
              <button type="button" class="bl-icon" data-bl-mute aria-label="Lyd til/fra">🔊</button>
              <button type="button" class="bl-icon" data-bl-pause aria-label="Pause">⏸</button>
            </div>
            <div class="bl-level" data-bl-level></div>
          </div>
          <div class="bl-toast" data-bl-toast></div>
          <div class="bl-question" data-bl-question hidden role="dialog" aria-live="polite">
            <div class="bl-q-who"><img data-bl-q-img alt=""><span data-bl-q-who></span></div>
            <p class="bl-q-text" data-bl-q-text></p>
            <div class="bl-q-options" data-bl-q-options></div>
            <div class="bl-q-feedback" data-bl-q-feedback hidden></div>
          </div>
          <div class="bl-overlay" data-bl-start>
            <div class="bl-card">
              <img class="bl-hero" src="assets/figurer/obbe-ovdig.png" alt="Øbbe Øvdig" width="150" height="150">
              <span class="bl-eyebrow">Øbbe Øvdig</span>
              <h1>Brøk-løb</h1>
              <p>Løb, saml stjerner og undgå forhindringerne. Når Erling, Gunnar, Else eller Kejser Dummo spærrer vejen, går tiden i slowmotion – svar rigtigt på brøkreglen, så buldrer Øbbe igennem!</p>
              <ul class="bl-how">
                <li><b>← →</b> skift bane</li><li><b>↑</b> hop</li><li><b>↓</b> duk</li>
              </ul>
              <p class="bl-small">På mobil og tablet: swipe til siden, op eller ned.</p>
              <p class="bl-small" data-bl-best-start></p>
              <div class="bl-actions"><button type="button" class="btn bl-go" data-bl-go>Start løbet</button><button type="button" class="btn secondary" data-bl-exit>Tilbage</button></div>
            </div>
          </div>
          <div class="bl-overlay" data-bl-paused hidden>
            <div class="bl-card bl-card-small"><h2>Pause</h2><div class="bl-actions"><button type="button" class="btn" data-bl-resume>Fortsæt</button><button type="button" class="btn secondary" data-bl-quit>Afslut løbet</button></div></div>
          </div>
          <div class="bl-overlay" data-bl-over hidden><div class="bl-card" data-bl-over-card></div></div>
        </div>
      </section>`;

    const $ = (sel) => root.querySelector(sel);
    const stage = $("[data-bl-stage]");
    const canvas = $("[data-bl-canvas]");
    const ctx = canvas.getContext("2d");
    const vignette = $("[data-bl-vignette]");
    const hud = $("[data-bl-hud]");
    const qBox = $("[data-bl-question]");
    const toastEl = $("[data-bl-toast]");
    const sound = createSound();
    let disposed = false;

    // Billeder
    const img = { obbe: null, chars: {} };
    const pieces = EVIL_PIECES.map((d) => ({ ...d, src: PIECE_ART + d.file, sp: null, aspect: 0.75 }));
    let pieceBag = [];
    const ready = Promise.all([
      loadImage(ASSET + "obbe-back.webp").then((i) => { img.obbe = i; }),
      ...CHAR_ORDER.map((k) => loadImage(ASSET + CHARS[k].src).then((i) => { img.chars[k] = i; })),
      ...pieces.map((p) => loadImage(p.src).then((i) => {
        const sp = i ? trimSprite(i) : null;
        if (!sp) return;
        p.sp = sp;
        p.aspect = sp.width / sp.height;
      })),
    ]);
    const spr = {
      hydrant: spriteHydrant(), wall: spriteWall(), bar: spriteBar(), orange: spriteOrange(), star: spriteStar(),
      houses: [0, 1, 2, 3, 4, 5].map(spriteHouse), school: spriteSchool(), trees: [0, 1].map(spriteTree), lamp: spriteLamp(),
    };
    $("[data-bl-best-start]").textContent = loadBest() ? `Din bedste score: ${loadBest()} point` : "";

    // ---------- Størrelse ----------
    let W = 0, H = 0, DPR = 1, F = 600, HY = 200, vignetteGrad = null, skyCanvas = null, skylineCanvas = null;
    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(280, Math.round(r.width)); H = Math.max(240, Math.round(r.height));
      DPR = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.75 : 2);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      // Brændvidde: hold banen pæn i både portræt og landskab.
      F = Math.min(H * 0.95, W * 1.05);
      HY = H * (H > W ? 0.36 : 0.3);
      buildSky();
    }
    function buildSky() {
      skyCanvas = makeCanvas(Math.max(2, Math.round(W * DPR)), Math.max(2, Math.round((HY + 4) * DPR)));
      const s = skyCanvas.getContext("2d");
      const g = s.createLinearGradient(0, 0, 0, skyCanvas.height);
      g.addColorStop(0, "#7d6cf0"); g.addColorStop(0.55, "#b9b0ff"); g.addColorStop(1, "#ffe9c9");
      s.fillStyle = g; s.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
      s.fillStyle = "rgba(255,255,255,.85)";
      for (let i = 0; i < 6; i++) {
        const cx = (i * 0.19 + 0.05) * skyCanvas.width, cy = (0.15 + (i % 3) * 0.13) * skyCanvas.height, r = (18 + (i % 2) * 10) * DPR;
        s.beginPath(); s.arc(cx, cy, r, 0, Math.PI * 2); s.arc(cx + r, cy + 4 * DPR, r * 0.8, 0, Math.PI * 2); s.arc(cx - r, cy + 6 * DPR, r * 0.7, 0, Math.PI * 2); s.fill();
      }
      // Skyline (parallakse)
      const sw = Math.round(W * DPR * 1.6), sh = Math.round(Math.min(HY * 0.55, 140) * DPR);
      skylineCanvas = makeCanvas(sw, Math.max(2, sh));
      const k = skylineCanvas.getContext("2d");
      let x = 0, i = 0;
      while (x < sw) {
        const bw = (30 + ((i * 37) % 50)) * DPR, bh = sh * (0.35 + ((i * 53) % 60) / 100);
        k.fillStyle = i % 3 === 0 ? "#8f86d6" : i % 3 === 1 ? "#a39ae0" : "#9a90da";
        k.fillRect(x, sh - bh, bw, bh);
        k.fillStyle = "rgba(255,247,210,.6)";
        for (let wy = sh - bh + 8 * DPR; wy < sh - 8 * DPR; wy += 14 * DPR) for (let wx = x + 6 * DPR; wx < x + bw - 8 * DPR; wx += 12 * DPR) if (((wx + wy) | 0) % 3) k.fillRect(wx, wy, 4 * DPR, 6 * DPR);
        x += bw + 4 * DPR; i++;
      }
      vignetteGrad = null;
    }

    // ---------- Spiltilstand ----------
    let S = null;
    function newState() {
      pieceBag = [];
      return {
        mode: "ready", // ready | run | question | feedback | over
        paused: false,
        t: 0, dist: 0, speed: 10, timeScale: 1, tsTarget: 1,
        score: 0, stars: 0, lives: MAX_LIVES, invuln: 0, shake: 0,
        lane: 1, x: 0, y: 0, vy: 0, slide: 0, stumble: 0, phase: 0, vault: 0,
        obstacles: [], coins: [], scenery: [], particles: [], popups: [],
        nextPattern: 22, nextGate: FIRST_GATE, nextScenery: [0, 3],
        deck: C.createDeck(rand), correct: 0, wrong: 0, streak: 0, asked: 0,
        seen: {}, // rule -> {ok, bad}
        question: null, gate: null, qStartedAt: 0, feedbackTimer: 0, charIdx: Math.floor(rand() * CHAR_ORDER.length),
        frameMs: [], seenPieces: [],
      };
    }
    S = newState();
    for (let z = 0; z < FAR; z += 5) spawnScenery(z, true);

    function level() { return C.levelFor(S.correct); }

    // ---------- Spawning ----------
    function spawnScenery(at) {
      for (const side of [-1, 1]) {
        const r = rand();
        let kind, w, h, sp;
        if (r < 0.08) { kind = "school"; sp = spr.school; w = 6; h = 6; }
        else if (r < 0.5) { kind = "house"; sp = spr.houses[Math.floor(rand() * spr.houses.length)]; w = 3.6; h = 4.2; }
        else if (r < 0.82) { kind = "tree"; sp = spr.trees[Math.floor(rand() * 2)]; w = 2.1; h = 3.2; }
        else { kind = "lamp"; sp = spr.lamp; w = 0.5; h = 3.3; }
        const off = kind === "lamp" ? 0.4 : kind === "school" ? 4.2 : kind === "house" ? 2.6 + rand() * 1.2 : 1.4 + rand();
        S.scenery.push({ kind, sp, w, h, x: side * (LANE_W * 1.5 + 0.9 + off), at: at + rand() * 2 });
      }
    }

    function addObstacle(kind, lane, at) {
      const defs = {
        hydrant: { type: "low", w: 0.8, h: 1.05, sp: spr.hydrant },
        wall: { type: "low", w: 1.2, h: 0.85, sp: spr.wall },
        bar: { type: "high", w: 1.3, h: 2.0, sp: spr.bar },
        orange: { type: "tall", w: 1.25, h: 1.25, sp: spr.orange, roll: 4.5 },
      };
      const d = defs[kind];
      S.obstacles.push({ kind, lane, at, ...d, rot: 0, hit: false, vy: 0, fly: 0 });
    }
    function nextEvilPiece() {
      const ready = pieces.filter((p) => p.sp);
      if (!ready.length) return null;
      if (!pieceBag.length) pieceBag = C.shuffle(ready, rand);
      return pieceBag.pop();
    }
    function addEvilPiece(lane, at) {
      const piece = nextEvilPiece();
      if (!piece) { addObstacle("wall", lane, at); return null; }
      const h = piece.h, w = h * piece.aspect;
      const obstacle = { kind: "piece", pieceId: piece.id, name: piece.name, role: piece.role, lane, at, type: "tall", w, h, sp: piece.sp, rot: 0, hit: false, vy: 0, fly: 0 };
      S.obstacles.push(obstacle);
      S.seenPieces.push(piece.id);
      if (S.seenPieces.length > 240) S.seenPieces.shift();
      return obstacle;
    }
    function addCoins(lane, at, n, arc = false) {
      for (let i = 0; i < n; i++) {
        const y = arc ? 0.6 + Math.sin((i / (n - 1)) * Math.PI) * 1.2 : 0.6;
        S.coins.push({ lane, at: at + i * 1.6, y, got: false });
      }
    }
    function freeAround(at) { return Math.abs(at - S.nextGate) > 12; }

    function spawnPattern(at) {
      if (!freeAround(at)) return;
      const lv = level();
      const r = rand();
      const lanes = C.shuffle([0, 1, 2], rand);
      if (r < 0.28) {
        const kind = ["hydrant", "wall"][Math.floor(rand() * 2)];
        addObstacle(kind, lanes[0], at); addCoins(lanes[0], at - 4, 6, true); addCoins(lanes[1], at - 3, 4);
      } else if (r < 0.5) {
        if (rand() < 0.5) addEvilPiece(lanes[0], at); else addObstacle("wall", lanes[0], at);
        if (rand() < 0.5) addObstacle("hydrant", lanes[1], at); else addEvilPiece(lanes[1], at);
        addCoins(lanes[2], at - 5, 6);
      } else if (r < 0.68) {
        addObstacle("bar", lanes[0], at); addCoins(lanes[0], at - 2, 4); if (lv > 1) addObstacle("hydrant", lanes[1], at + 6);
      } else if (r < 0.85) {
        addObstacle("orange", lanes[0], at + 10); addCoins(lanes[1], at, 6);
      } else {
        addEvilPiece(lanes[0], at); addObstacle("bar", lanes[1], at + 7); addCoins(lanes[2], at - 2, 8);
      }
    }

    function spawnGate(at) {
      const key = CHAR_ORDER[S.charIdx % CHAR_ORDER.length]; S.charIdx++;
      S.gate = { at, key, triggered: false, smashed: false, sx: 0, sy: 0, rot: 0, vx: 0, vy: 0, vz: 0, alpha: 1 };
      // Ryd forhindringer tæt på porten.
      S.obstacles = S.obstacles.filter((o) => Math.abs(o.at - at) > 10);
      S.coins = S.coins.filter((c) => Math.abs(c.at - at) > 6);
      addCoins(1, at + 3, 5);
    }

    // ---------- Input ----------
    function act(dir) {
      if (S.mode !== "run" || S.paused) return;
      if (dir === "left") S.lane = clamp(S.lane - 1, 0, 2);
      else if (dir === "right") S.lane = clamp(S.lane + 1, 0, 2);
      else if (dir === "up" && S.y <= 0.001 && S.vy === 0) { S.vy = 8.2; S.slide = 0; sound.jump(); }
      else if (dir === "down") { if (S.y > 0.05) S.vy = -12; S.slide = 0.75; }
    }
    function onKey(e) {
      if (disposed) return;
      const k = e.key;
      if (S.mode === "question") {
        const n = Number(k);
        if (n >= 1 && n <= 4) { e.preventDefault(); answer(n - 1); }
        return;
      }
      if (S.mode === "feedback" && (k === "Enter" || k === " ")) { e.preventDefault(); finishFeedback(); return; }
      if (k === "Escape" || k === "p" || k === "P") { if (S.mode === "run") { e.preventDefault(); setPaused(!S.paused); } return; }
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
      if (map[k] && S.mode === "run") { e.preventDefault(); act(map[k]); }
    }
    window.addEventListener("keydown", onKey);

    let swipe = null;
    canvas.addEventListener("pointerdown", (e) => { swipe = { x: e.clientX, y: e.clientY, done: false, id: e.pointerId }; });
    canvas.addEventListener("pointermove", (e) => {
      if (!swipe || swipe.done || swipe.id !== e.pointerId) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
      swipe.done = true;
      act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down");
    });
    const endSwipe = () => { swipe = null; };
    canvas.addEventListener("pointerup", endSwipe);
    canvas.addEventListener("pointercancel", endSwipe);

    function onVisibility() { if (document.hidden && S.mode === "run") setPaused(true); }
    document.addEventListener("visibilitychange", onVisibility);

    root.addEventListener("click", (e) => {
      const t = e.target.closest("button"); if (!t || !root.contains(t)) return;
      if (t.matches("[data-bl-go],[data-bl-again]")) startRun();
      else if (t.matches("[data-bl-exit]")) { dispose(); options.onExit?.(); }
      else if (t.matches("[data-bl-pause]")) setPaused(true);
      else if (t.matches("[data-bl-resume]")) setPaused(false);
      else if (t.matches("[data-bl-quit]")) { setPaused(false); gameOver(); }
      else if (t.matches("[data-bl-mute]")) { sound.setMuted(!sound.muted); t.textContent = sound.muted ? "🔇" : "🔊"; }
      else if (t.matches("[data-bl-opt]")) answer(Number(t.dataset.blOpt));
      else if (t.matches("[data-bl-next]")) finishFeedback();
    });

    function setPaused(v) {
      if (S.mode !== "run" && v) return;
      S.paused = v;
      $("[data-bl-paused]").hidden = !v;
      if (v) $("[data-bl-resume]")?.focus();
    }

    function startRun() {
      sound.unlock();
      S = newState();
      for (let z = 0; z < FAR; z += 5) spawnScenery(z);
      S.mode = "run";
      $("[data-bl-start]").hidden = true; $("[data-bl-over]").hidden = true; $("[data-bl-paused]").hidden = true;
      hud.hidden = false; qBox.hidden = true;
      updateHud(true);
      toast("Løb, Øbbe!");
      canvas.focus?.();
    }

    // ---------- Spørgsmål ----------
    function openQuestion() {
      const lv = level();
      const q = S.deck.next(lv);
      S.question = q; S.mode = "question"; S.qStartedAt = performance.now(); S.asked++;
      const who = CHARS[S.gate.key];
      $("[data-bl-q-img]").src = ASSET + who.src;
      $("[data-bl-q-who]").textContent = `${who.name} spærrer vejen! Svar rigtigt for at komme forbi.`;
      $("[data-bl-q-text]").innerHTML = C.fracHtml(q.q);
      $("[data-bl-q-options]").innerHTML = q.options.map((o, i) => `<button type="button" class="bl-opt" data-bl-opt="${i}"><span class="bl-key">${i + 1}</span><span>${C.fracHtml(o)}</span></button>`).join("");
      const fb = $("[data-bl-q-feedback]"); fb.hidden = true; fb.innerHTML = "";
      qBox.hidden = false; qBox.classList.remove("is-right", "is-wrong");
      requestAnimationFrame(() => qBox.querySelector(".bl-opt")?.focus({ preventScroll: true }));
    }

    function answer(i) {
      if (S.mode !== "question" || !S.question) return;
      const q = S.question;
      const ok = i === q.correctIndex;
      const secs = (performance.now() - S.qStartedAt) / 1000;
      const seen = S.seen[q.rule] || (S.seen[q.rule] = { ok: 0, bad: 0 });
      const buttons = qBox.querySelectorAll(".bl-opt");
      buttons.forEach((b, k) => { b.disabled = true; if (k === q.correctIndex) b.classList.add("is-correct"); else if (k === i) b.classList.add("is-wrong"); });
      try {
        options.onResult?.({ topic: "fractionRunner", problem: q.q, answer: String(q.options[i] ?? ""), correctAnswer: q.a, correct: ok, responseTime: Math.round(secs * 10) / 10, timestamp: new Date().toISOString() });
      } catch (_) {}
      if (ok) {
        seen.ok++; S.correct++; S.streak++;
        const bonus = 100 * level() + Math.max(0, Math.round(60 - secs * 6)) + (S.streak > 1 ? 25 * S.streak : 0);
        S.score += bonus;
        qBox.classList.add("is-right");
        sound.good();
        popup(`Rigtigt! +${bonus}`, "#28aa78");
        S.gate.smashed = true; S.gate.vy = 7; S.gate.vz = 9; S.gate.vx = (rand() < 0.5 ? -1 : 1) * 3.5;
        burst(0, 1.2, S.gate.at - S.dist, ["#ffd23f", "#5b4bda", "#28aa78", "#fff"], 26);
        S.vault = 1; S.vy = 9; sound.jump();
        const prevLevel = C.levelFor(S.correct - 1);
        setTimeout(() => { if (!disposed && S.mode === "question") { qBox.hidden = true; S.mode = "run"; S.tsTarget = 1; if (level() > prevLevel) toast(`Nyt niveau: ${C.LEVELS[level() - 1].name}`); } }, 650);
      } else {
        seen.bad++; S.wrong++; S.streak = 0;
        qBox.classList.add("is-wrong");
        sound.bad();
        const rule = C.RULES[q.rule];
        const fb = $("[data-bl-q-feedback]");
        fb.innerHTML = `<p class="bl-fb-title">Ikke helt! Det rigtige svar er <b>${C.fracHtml(q.a)}</b></p><p class="bl-fb-rule"><b>${esc(rule.title)}:</b> ${C.fracHtml(rule.rule)}</p><p class="bl-fb-ex">Eksempel: ${C.fracHtml(rule.ex)}</p><button type="button" class="btn bl-next" data-bl-next>Videre</button>`;
        fb.hidden = false;
        S.mode = "feedback"; S.feedbackTimer = 9;
        requestAnimationFrame(() => fb.querySelector("[data-bl-next]")?.focus({ preventScroll: true }));
      }
      updateHud(true);
    }

    function finishFeedback() {
      if (S.mode !== "feedback") return;
      qBox.hidden = true;
      // Øbbe snubler, men kommer forbi; porten skubbes væk.
      S.gate.smashed = true; S.gate.vy = 3; S.gate.vz = 4; S.gate.vx = 4;
      loseLife(true);
      if (S.lives <= 0) { gameOver(); return; }
      S.mode = "run"; S.tsTarget = 1;
    }

    function loseLife(fromQuestion) {
      S.lives--; S.invuln = 1.6; S.stumble = 0.7; S.shake = 0.35; S.streak = fromQuestion ? 0 : S.streak;
      sound.hit();
      popup("Av!", "#dc5c58");
      updateHud(true);
    }

    function gameOver() {
      if (S.mode === "over") return;
      S.mode = "over"; S.tsTarget = 1; qBox.hidden = true;
      const score = Math.floor(S.score), record = saveBest(score), best = loadBest();
      const rules = Object.keys(S.seen);
      const recap = rules.length
        ? rules.map((k) => { const r = C.RULES[k], s = S.seen[k]; return `<li><span class="bl-rc-head"><b>${esc(r.title)}</b><span class="bl-rc-score">${s.ok} ✓ · ${s.bad} ✗</span></span><span>${C.fracHtml(r.rule)}</span><small>${C.fracHtml(r.ex)}</small></li>`; }).join("")
        : `<li><span>Du nåede ikke frem til en brøk-forhindring denne gang. Løb igen – Erling venter!</span></li>`;
      $("[data-bl-over-card]").innerHTML = `
        <img class="bl-hero" src="assets/figurer/obbe-ovdig.png" alt="" width="110" height="110">
        <h2>${S.lives <= 0 ? "Øbbe er løbet tør for liv" : "Løbet er slut"}</h2>
        <div class="bl-stats">
          <div><b>${score}</b><span>point</span></div>
          <div><b>${Math.floor(S.dist)}</b><span>meter</span></div>
          <div><b>${S.stars}</b><span>stjerner</span></div>
          <div><b>${S.correct}/${S.correct + S.wrong}</b><span>brøksvar</span></div>
        </div>
        <p class="bl-best">${record && score > 0 ? "🏆 Ny rekord!" : `Bedste score: ${best} point`}</p>
        <h3>Det har du øvet</h3>
        <ul class="bl-recap">${recap}</ul>
        <div class="bl-actions"><button type="button" class="btn" data-bl-again>Løb igen</button><button type="button" class="btn secondary" data-bl-exit>Tilbage</button></div>`;
      $("[data-bl-over]").hidden = false;
      hud.hidden = true;
      try { options.onComplete?.({ score, distance: Math.floor(S.dist), correct: S.correct, wrong: S.wrong }); } catch (_) {}
      requestAnimationFrame(() => root.querySelector("[data-bl-again]")?.focus({ preventScroll: true }));
    }

    // ---------- HUD ----------
    let hudCache = "";
    function updateHud(force) {
      const key = `${Math.floor(S.score)}|${Math.floor(S.dist)}|${S.stars}|${S.lives}|${level()}`;
      if (!force && key === hudCache) return;
      hudCache = key;
      $("[data-bl-score]").textContent = Math.floor(S.score);
      $("[data-bl-dist]").textContent = Math.floor(S.dist);
      $("[data-bl-stars]").textContent = S.stars;
      $("[data-bl-lives]").innerHTML = Array.from({ length: MAX_LIVES }, (_, i) => `<span class="${i < S.lives ? "" : "is-lost"}">❤</span>`).join("");
      $("[data-bl-level]").textContent = `Niveau ${level()}: ${C.LEVELS[level() - 1].name}`;
    }
    let toastTimer = 0;
    function toast(text) {
      toastEl.textContent = text; toastEl.classList.add("is-on");
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 1600);
    }
    function popup(text, color) { S.popups.push({ text, color, life: 1.1 }); }
    function burst(x, y, z, colors, n) {
      for (let i = 0; i < n; i++) S.particles.push({ x, y, z, vx: (rand() - 0.5) * 6, vy: rand() * 6 + 2, vz: 2 + rand() * 5, life: 0.9 + rand() * 0.5, c: colors[i % colors.length], s: 0.08 + rand() * 0.08 });
    }

    // Brikker bruger deres synlige halvbredde. Øvrige forhindringer beholder banetjekket på 0,75.
    function hitsPlayer(o) {
      const z = o.at - S.dist;
      if (z >= 0.55 || z <= -0.45) return false;
      const half = o.kind === "piece" ? clamp(o.w * 0.5, 0.36, 0.68) : 0.75;
      if (Math.abs(laneX(o.lane) - S.x) >= half) return false;
      if (S.invuln > 0) return false;
      if (o.type === "low") return S.y <= 0.75;
      if (o.type === "high") return !(S.slide > 0 && S.y < 0.3);
      return true;
    }

    // ---------- Opdatering ----------
    function update(realDt) {
      // Slowmotion udglattes i realtid.
      S.timeScale = lerp(S.timeScale, S.tsTarget, 1 - Math.pow(0.0005, realDt));
      const dt = realDt * S.timeScale;
      S.t += realDt;
      if (S.mode === "feedback") { S.feedbackTimer -= realDt; if (S.feedbackTimer <= 0) finishFeedback(); }
      if (S.mode === "ready" || S.mode === "over") { S.dist += dt * 4; S.phase += dt * 6; updateScenery(); return; }

      S.speed = Math.min(22, 10 + S.dist * 0.011);
      let move = S.speed * dt;
      // Porten stopper ved Øbbe, mens spørgsmålet er åbent.
      if (S.gate && !S.gate.smashed) {
        const gz = S.gate.at - S.dist;
        if (!S.gate.triggered && gz < 13) { S.gate.triggered = true; S.tsTarget = 0.18; sound.slow(); }
        if (S.gate.triggered && S.mode === "run" && gz < 7.5) { S.tsTarget = 0.04; openQuestion(); }
        if (gz - move < 3.2) move = Math.max(0, gz - 3.2);
      }
      S.dist += move;
      S.score += move * 1;
      S.phase += dt * S.speed * 0.95;

      // Spiller
      const tx = laneX(S.lane);
      S.x = lerp(S.x, tx, 1 - Math.pow(0.000002, dt));
      if (S.y > 0 || S.vy !== 0) {
        S.vy -= 24 * dt; S.y += S.vy * dt;
        if (S.y <= 0) { S.y = 0; S.vy = 0; S.vault = 0; }
      }
      if (S.slide > 0) S.slide = Math.max(0, S.slide - dt);
      if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);
      if (S.stumble > 0) S.stumble = Math.max(0, S.stumble - dt);
      if (S.shake > 0) S.shake = Math.max(0, S.shake - realDt);

      // Spawning
      while (S.nextPattern < S.dist + FAR) { spawnPattern(S.nextPattern); S.nextPattern += Math.max(13, 22 - S.speed * 0.4) + rand() * 6; }
      if (!S.gate || (S.gate.smashed && S.gate.alpha <= 0) || S.gate.at < S.dist - 10) {
        if (S.nextGate < S.dist + FAR) { spawnGate(S.nextGate); S.nextGate += GATE_EVERY + rand() * 30; }
        else if (S.gate && (S.gate.alpha <= 0 || S.gate.at < S.dist - 10)) S.gate = null;
      }
      updateScenery();

      // Forhindringer
      const px = S.x;
      for (const o of S.obstacles) {
        if (o.roll && !o.hit) { o.at -= o.roll * dt; o.rot -= dt * 5; }
        if (o.hit) { o.fly += dt; o.vy -= 18 * dt; o.y = (o.y || 0) + o.vy * dt; o.rot += dt * 8; continue; }
        if (!hitsPlayer(o)) continue;
        o.hit = true; o.vy = 6; loseLife(false); if (S.lives <= 0) { gameOver(); return; }
      }
      S.obstacles = S.obstacles.filter((o) => o.at - S.dist > -6 && (o.y || 0) > -4);
      // Stjerner
      for (const c of S.coins) {
        if (c.got) continue;
        const z = c.at - S.dist;
        if (Math.abs(z) < 0.7 && Math.abs(laneX(c.lane) - px) < 0.7 && Math.abs(c.y - (S.y + 0.6)) < 0.9) {
          c.got = true; S.stars++; S.score += 10; sound.coin();
          burst(laneX(c.lane), c.y, z, ["#ffd23f", "#fff2a8"], 5);
        }
      }
      S.coins = S.coins.filter((c) => !c.got && c.at - S.dist > -4);
      // Port i luften
      if (S.gate && S.gate.smashed) {
        const g = S.gate;
        g.vy -= 14 * dt; g.sy += g.vy * dt; g.sx += g.vx * dt; g.at += g.vz * dt; g.rot += dt * 6 * Math.sign(g.vx || 1); g.alpha = Math.max(0, g.alpha - dt * 0.9);
      }
      // Partikler og popups
      for (const p of S.particles) { p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt - move; p.life -= realDt; }
      S.particles = S.particles.filter((p) => p.life > 0);
      for (const p of S.popups) p.life -= realDt;
      S.popups = S.popups.filter((p) => p.life > 0);
      updateHud(false);
    }
    function updateScenery() {
      S.scenery = S.scenery.filter((s) => s.at - S.dist > -CAM_D);
      let maxAt = S.scenery.reduce((m, s) => Math.max(m, s.at), S.dist);
      while (maxAt < S.dist + FAR) { maxAt += 4.5 + rand() * 2; spawnScenery(maxAt); }
    }

    // ---------- Tegning ----------
    let camX = 0;
    function project(x, y, z) {
      const d = z + CAM_D;
      if (d < 0.35) return null;
      const s = F / d;
      return { x: W / 2 + (x - camX) * s, y: HY + (CAM_H - y) * s, s };
    }
    function drawQuad(xl1, xr1, z1, xl2, xr2, z2, color) {
      const a = project(xl1, 0, z1), b = project(xr1, 0, z1), c = project(xr2, 0, z2), d = project(xl2, 0, z2);
      if (!a || !b || !c || !d) return;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    }
    function billboard(sp, x, y, z, w, h, opts = {}) {
      const p = project(x, y, z); if (!p || !sp || !sp.width) return;
      const pw = w * p.s, ph = h * p.s;
      if (p.x + pw < -50 || p.x - pw > W + 50) return;
      const fade = z > FAR - 18 ? clamp((FAR - z) / 18, 0, 1) : 1;
      ctx.globalAlpha = fade * (opts.alpha ?? 1);
      if (opts.rot) {
        ctx.save(); ctx.translate(p.x, p.y - ph / 2); ctx.rotate(opts.rot); ctx.drawImage(sp, -pw / 2, -ph / 2, pw, ph); ctx.restore();
      } else ctx.drawImage(sp, p.x - pw / 2, p.y - ph, pw, ph);
      ctx.globalAlpha = 1;
      return p;
    }
    function shadow(x, z, w) {
      const p = project(x, 0, z); if (!p) return;
      ctx.fillStyle = "rgba(20,14,40,.22)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y, w * p.s * 0.5, w * p.s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    }

    function drawGround() {
      const edge = LANE_W * 1.5;
      const bandLen = 2.4;
      const off = S.dist % (bandLen * 2);
      for (let k = 30; k >= 0; k--) {
        let z1 = k * bandLen - off - bandLen, z2 = z1 + bandLen;
        if (z2 < -CAM_D + 0.4) continue;
        z1 = Math.max(z1, -CAM_D + 0.4);
        const even = (k % 2) === 0;
        drawQuad(-60, -edge - 1.4, z1, -60, -edge - 1.4, z2, even ? "#7cc46b" : "#73bb62");
        drawQuad(edge + 1.4, 60, z1, edge + 1.4, 60, z2, even ? "#7cc46b" : "#73bb62");
        drawQuad(-edge - 1.4, -edge - 0.12, z1, -edge - 1.4, -edge - 0.12, z2, even ? "#efe3cb" : "#e4d6ba");
        drawQuad(edge + 0.12, edge + 1.4, z1, edge + 0.12, edge + 1.4, z2, even ? "#efe3cb" : "#e4d6ba");
        drawQuad(-edge - 0.12, -edge, z1, -edge - 0.12, -edge, z2, "#5b4bda");
        drawQuad(edge, edge + 0.12, z1, edge, edge + 0.12, z2, "#5b4bda");
        drawQuad(-edge, edge, z1, -edge, edge, z2, even ? "#6d6680" : "#655e78");
        if (even) {
          for (const lx of [-LANE_W / 2, LANE_W / 2]) drawQuad(lx - 0.05, lx + 0.05, z1 + 0.3, lx - 0.05, lx + 0.05, z2 - 0.3, "rgba(255,247,230,.85)");
        }
      }
      // Dis ved horisonten
      const fog = ctx.createLinearGradient(0, HY - 2, 0, HY + H * 0.12);
      fog.addColorStop(0, "rgba(255,233,201,1)"); fog.addColorStop(1, "rgba(255,233,201,0)");
      ctx.fillStyle = fog; ctx.fillRect(0, HY - 2, W, H * 0.12);
    }

    function drawPlayer() {
      const sprite = img.obbe; if (!sprite) return;
      const p = project(S.x, 0, 0); if (!p) return;
      shadow(S.x, 0, 1.0 - Math.min(0.5, S.y * 0.25));
      const hWorld = 1.85, wWorld = hWorld * (sprite.width / sprite.height);
      let ph = hWorld * p.s, pw = wWorld * p.s;
      const running = S.y <= 0.001 && S.slide <= 0 && S.mode !== "ready" && S.mode !== "over";
      const bob = running ? Math.abs(Math.sin(S.phase * 1.1)) * 0.07 : 0;
      const yy = project(S.x, S.y + bob, 0).y;
      ctx.save();
      ctx.translate(p.x, yy);
      let rot = (laneX(S.lane) - S.x) * -0.12;
      if (S.stumble > 0) rot += Math.sin(S.stumble * 30) * 0.18;
      if (S.vault) rot += Math.sin(clamp(S.y / 1.6, 0, 1) * Math.PI) * 0.15;
      ctx.rotate(rot);
      if (S.slide > 0) { ph *= 0.55; pw *= 1.12; }
      else if (S.y > 0.02) { ph *= 1.04; pw *= 0.96; }
      const flip = running ? Math.sin(S.phase * 0.55) < 0 : false;
      if (flip) ctx.scale(-1, 1);
      if (S.invuln > 0 && S.invuln < 1e6 && Math.floor(S.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.45;
      ctx.drawImage(sprite, -pw / 2, -ph, pw, ph);
      ctx.restore();
      ctx.globalAlpha = 1;
      if (S.slide > 0 && rand() < 0.5) S.particles.push({ x: S.x + (rand() - 0.5) * 0.6, y: 0.05, z: 0.5, vx: (rand() - 0.5) * 2, vy: 1.5, vz: 1, life: 0.4, c: "#d8cdb5", s: 0.1 });
    }

    function drawGate(g) {
      const z = g.at - S.dist;
      if (z > FAR || z < -CAM_D + 0.5) return;
      const ch = img.chars[g.key], def = CHARS[g.key];
      if (!g.smashed) {
        // Bom på tværs af alle tre baner
        const edge = LANE_W * 1.5;
        const a = project(-edge, 1.0, z), b = project(edge, 0.7, z);
        if (a && b) {
          const hpx = 0.28 * a.s;
          ctx.save();
          ctx.beginPath(); ctx.rect(a.x, a.y, b.x - a.x, hpx); ctx.clip();
          ctx.fillStyle = "#fff7e6"; ctx.fillRect(a.x, a.y, b.x - a.x, hpx);
          ctx.fillStyle = "#dc5c58";
          const step = hpx * 1.6;
          for (let x0 = a.x - hpx; x0 < b.x; x0 += step * 2) { ctx.beginPath(); ctx.moveTo(x0, a.y + hpx); ctx.lineTo(x0 + step, a.y + hpx); ctx.lineTo(x0 + step + hpx, a.y); ctx.lineTo(x0 + hpx, a.y); ctx.fill(); }
          ctx.restore();
          ctx.lineWidth = Math.max(1, a.s * 0.03); ctx.strokeStyle = "#1d1630"; ctx.strokeRect(a.x, a.y, b.x - a.x, hpx);
          for (const sx of [-edge, edge]) { const q = project(sx, 0, z), q2 = project(sx, 1.0, z); if (q && q2) { ctx.fillStyle = "#4032ba"; ctx.fillRect(q.x - a.s * 0.05, q2.y, a.s * 0.1, q.y - q2.y); } }
          // Spørgsmålstegn-skilt
          const sgn = project(0, 2.65, z);
          if (sgn && z < 40) {
            const r = 0.32 * sgn.s;
            ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = "#1d1630"; ctx.lineWidth = Math.max(1.5, r * 0.12);
            ctx.beginPath(); ctx.arc(sgn.x + 0.95 * sgn.s, sgn.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#1d1630"; ctx.font = `900 ${Math.round(r * 1.3)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("½?", sgn.x + 0.95 * sgn.s, sgn.y + r * 0.05);
          }
        }
      }
      if (ch) {
        const h = def.h, w = h * (ch.width / ch.height);
        shadow(g.sx, z, w * 0.9);
        const p = billboard(ch, g.sx, g.sy, z + 0.4, w, h, { rot: g.smashed ? g.rot : 0, alpha: g.alpha });
        // Talebobbel
        if (p && !g.smashed && z < 18) {
          const fs = clamp(0.16 * p.s, 11, 22);
          ctx.font = `800 ${fs}px system-ui, sans-serif`;
          const tw = ctx.measureText(def.line).width + fs * 1.2;
          const bx = p.x - tw / 2, by = p.y - h * p.s - fs * 2.4;
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1d1630"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(bx, by, tw, fs * 1.8, fs * 0.6); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#1d1630"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(def.line, p.x, by + fs * 0.92);
        }
      }
    }

    function render() {
      camX = lerp(camX, S.x * 0.55, 0.15);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (S.shake > 0) ctx.translate((rand() - 0.5) * 10 * S.shake, (rand() - 0.5) * 10 * S.shake);
      // Himmel + skyline
      if (skyCanvas) ctx.drawImage(skyCanvas, 0, 0, W, HY + 4);
      if (skylineCanvas) {
        const sw = skylineCanvas.width / DPR, sh = skylineCanvas.height / DPR;
        const ox = -((S.dist * 0.6 + camX * 30) % (sw - W));
        ctx.drawImage(skylineCanvas, ox - (sw - W) * 0.3, HY - sh + 2, sw, sh);
      }
      drawGround();
      // Alle objekter sorteret langt → nært
      const list = [];
      for (const s of S.scenery) list.push({ z: s.at - S.dist, s });
      for (const o of S.obstacles) list.push({ z: o.at - S.dist, o });
      for (const c of S.coins) list.push({ z: c.at - S.dist, c });
      if (S.gate) list.push({ z: S.gate.at - S.dist + 0.4, g: S.gate });
      list.sort((a, b) => b.z - a.z);
      let playerDrawn = false;
      for (const it of list) {
        if (!playerDrawn && it.z < 0) { drawPlayer(); playerDrawn = true; }
        if (it.z > FAR || it.z < -CAM_D + 0.5) continue;
        if (it.s) billboard(it.s.sp, it.s.x, 0, it.z, it.s.w, it.s.h);
        else if (it.o) {
          const o = it.o, x = laneX(o.lane) + (o.hit ? o.fly * 3 : 0);
          if (!o.hit) shadow(x, it.z, o.w);
          if (o.kind === "orange") billboard(o.sp, x, o.y || 0, it.z, o.w, o.h, { rot: o.rot });
          else billboard(o.sp, x, o.y || 0, it.z, o.w, o.h, o.hit ? { rot: o.rot, alpha: 0.85 } : {});
        } else if (it.c) {
          const sp = Math.abs(Math.cos(S.t * 4 + it.c.at));
          const p = project(laneX(it.c.lane), it.c.y, it.z);
          if (p) { const s = 0.55 * p.s; ctx.drawImage(spr.star, p.x - (s * (0.25 + 0.75 * sp)) / 2, p.y - s / 2, s * (0.25 + 0.75 * sp), s); }
        } else if (it.g) drawGate(it.g);
      }
      if (!playerDrawn) drawPlayer();
      // Partikler
      for (const p of S.particles) {
        if (p.z < 0.35) continue;
        const q = project(p.x, p.y, p.z); if (!q) continue;
        ctx.globalAlpha = clamp(p.life * 1.5, 0, 1); ctx.fillStyle = p.c;
        const r = clamp(p.s * q.s, 1.5, Math.max(6, W * 0.012));
        ctx.beginPath(); ctx.arc(q.x, q.y, r / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Popups over Øbbe
      for (const p of S.popups) {
        const q = project(S.x, 2.3 + (1.1 - p.life) * 0.8, 0); if (!q) continue;
        ctx.globalAlpha = clamp(p.life * 2, 0, 1);
        ctx.font = `900 ${Math.round(clamp(W / 22, 18, 34))}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 5; ctx.strokeStyle = "#fff"; ctx.strokeText(p.text, q.x, q.y); ctx.fillStyle = p.color; ctx.fillText(p.text, q.x, q.y);
      }
      ctx.globalAlpha = 1;
      // Slowmotion-vignet (CSS-lag, billigt)
      const slow = clamp((1 - S.timeScale) / 0.9, 0, 1);
      vignette.style.opacity = slow.toFixed(3);
    }

    // ---------- Løkke ----------
    let last = performance.now(), raf = 0;
    function frame(now) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const realDt = Math.min(0.05, (now - last) / 1000); last = now;
      S.frameMs.push(now); if (S.frameMs.length > 120) S.frameMs.shift();
      if (!S.paused) update(realDt);
      render();
    }

    let ro = null;
    ready.then(() => {
      if (disposed) return;
      resize();
      if (typeof ResizeObserver === "function") { ro = new ResizeObserver(() => resize()); ro.observe(stage); }
      else window.addEventListener("resize", resize);
      last = performance.now();
      raf = requestAnimationFrame(frame);
      root.dataset.blReady = "1";
    });

    function fps() {
      const f = S.frameMs; if (f.length < 10) return 0;
      return Math.round(((f.length - 1) * 1000) / (f[f.length - 1] - f[0]));
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      ro?.disconnect();
      clearTimeout(toastTimer);
      sound.close();
    }
    // Test-krog (bruges af headless tests og preview-siden).
    function pieceRecord(p) {
      const ctx2 = p.sp ? p.sp.getContext("2d") : null;
      let clear = 0, opaque = 0, mid = null;
      if (ctx2) {
        const width = p.sp.width, height = p.sp.height;
        const data = ctx2.getImageData(0, 0, width, height).data;
        for (let i = 3; i < data.length; i += 4) { if (data[i] < 8) clear++; else if (data[i] > 200) opaque++; }
        const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
        mid = Array.from(ctx2.getImageData(cx, cy, 1, 1).data);
      }
      return {
        id: p.id, name: p.name, role: p.role, src: p.src, loaded: !!p.sp,
        w: p.sp ? p.sp.width : 0, h: p.sp ? p.sp.height : 0,
        worldH: p.h, worldW: p.sp ? p.h * p.aspect : 0,
        clear, opaque, mid,
      };
    }
    dispose.debug = {
      get state() { return S; },
      start: startRun, act, answer, fps,
      gateSoon() { if (S.gate && !S.gate.smashed) S.gate.at = S.dist + 16; else { S.nextGate = S.dist + 16; spawnGate(S.nextGate); S.nextGate += GATE_EVERY; } },
      setInvulnerable(v) { S.invuln = v ? 1e9 : 0; },
      pieces: () => pieces.map(pieceRecord),
      spawnPieces(n = 6, lane = 1, gap = 8) {
        const ids = [];
        for (let i = 0; i < n; i++) {
          const made = addEvilPiece(lane, S.dist + 24 + i * gap);
          if (made) ids.push(made.pieceId);
        }
        return ids;
      },
      spawnPatternAt(at) {
        const prev = S.nextGate;
        S.nextGate = at + 10000;
        spawnPattern(at);
        S.nextGate = prev;
      },
      lineup(ahead = 5.6) {
        const loaded = pieces.filter((p) => p.sp);
        loaded.forEach((piece, i) => {
          const h = piece.h, w = h * piece.aspect;
          const lane = i % 3, row = Math.floor(i / 3);
          S.obstacles.push({
            kind: "piece", pieceId: piece.id, name: piece.name, role: piece.role, lane,
            at: S.dist + ahead + row * 6.4 + lane * 0.4,
            type: "tall", w, h, sp: piece.sp, rot: 0, hit: false, vy: 0, fly: 0,
          });
        });
        return loaded.map((p) => p.id);
      },
      tick(dt = 1 / 60) { if (S.mode !== "over") update(dt); },
      park() {
        S.obstacles = []; S.coins = []; S.gate = null; S.paused = false;
        if (S.mode !== "over") S.mode = "run";
        S.nextPattern = S.dist + 8000; S.nextGate = S.dist + 8000; S.invuln = 0;
      },
    };
    return dispose;
  }

  window.JacobBrokLoeb = Object.freeze({ mount, CHARS, EVIL_PIECES });
})();
