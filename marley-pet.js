/* Marley living pet-scene M2a: transparent cutout + room + pose swaps. No floating photo card. */
(() => {
  "use strict";

  const CACHE = "20261007-act2";
  const BASE = "assets/figurer/marley-pet/";
  const POSES = {
    stand: BASE + "stand.png?v=" + CACHE,
    walkA: BASE + "walk-a.png?v=" + CACHE,
    walkB: BASE + "walk-b.png?v=" + CACHE,
    wagA: BASE + "wag-a.png?v=" + CACHE,
    wagB: BASE + "wag-b.png?v=" + CACHE,
    sit: BASE + "sit.png?v=" + CACHE,
    lie: BASE + "lie.png?v=" + CACHE
  };
  const CUTOUT = "assets/figurer/marley-cutout.png?v=" + CACHE;
  const SUNGLASSES = BASE + "sunglasses.png?v=" + CACHE;
  const ART = 900;
  const HOME = { x: 450, y: 710 };
  const X_MIN = 160;
  const X_MAX = 740;
  const EAT_THROTTLE_MS = 90_000;
  const CROSSFADE_MS = 200;
  const FADE_OUT_MS = 120;
  const WALK_FRAME_MS = 160;
  const WAG_FRAME_MS = 140;
  const RUN_FRAME_MS = 110;

  const LABELS = {
    roam: "Marley går rundt",
    wag: "Marley logrer",
    celebrate: "Marley smiler",
    smile: "Marley smiler",
    run: "Marley løber en glad runde",
    eat: "Marley spiser en godbid",
    outfit: "Marley prøver tøj",
    bed: "Marley lægger sig i kurven",
    sleep: "Marley sover i kurven"
  };

  const ALIAS = { smile: "celebrate" };

  const GEAR = {
    glasses: { slot: "eyes", emoji: "🕶️", className: "eyes", persist: true },
    hat: { slot: "head", emoji: "🎉", className: "head", persist: true },
    cap: { slot: "head", emoji: "🧢", className: "head", persist: true },
    bee: { slot: "body", emoji: "🐝", className: "body", persist: true },
    shoes: { slot: "feet", emoji: "👟", className: "feet", persist: true },
    skate: { slot: "board", emoji: "🛹", className: "board", persist: true },
    ball: { slot: "toy", emoji: "🎾", className: "toy", persist: true },
    bone: { slot: "toy", emoji: "🦴", className: "toy", persist: true }
  };

  function prefersReducedMotion() {
    try {
      return matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function clearHost(host) {
    host.replaceChildren();
    delete host.dataset.renderer;
    delete host.dataset.action;
    delete host.dataset.placeholder;
    delete host.dataset.pose;
  }

  const PATH_A = [
    { name: "walk_l", ms: 3200, from: { x: 450, y: 710 }, to: { x: 220, y: 710 }, ease: true, face: -1 },
    { name: "sniff", ms: 2400, hold: { x: 220, y: 710 }, tilt: -6, face: -1 },
    { name: "walk_c", ms: 2800, from: { x: 220, y: 710 }, to: { x: 450, y: 710 }, ease: true, face: 1 },
    { name: "wag", ms: 2200, hold: { x: 450, y: 710 }, pose: "wag", face: 1 }
  ];
  const PATH_B = [
    { name: "walk_r", ms: 3000, from: { x: 450, y: 710 }, to: { x: 680, y: 710 }, ease: true, face: 1 },
    { name: "sit", ms: 2200, hold: { x: 680, y: 715 }, pose: "sit", face: 1 },
    { name: "lie", ms: 2800, hold: { x: 680, y: 720 }, pose: "lie", face: 1 },
    { name: "up", ms: 1600, hold: { x: 680, y: 710 }, pose: "stand", face: 1 },
    { name: "walk_c", ms: 2800, from: { x: 680, y: 710 }, to: { x: 450, y: 710 }, ease: true, face: -1 },
    { name: "look_cam", ms: 1800, hold: { x: 450, y: 710 }, pose: "look", face: 1 }
  ];
  const PATH_C = [
    {
      name: "arc",
      ms: 4500,
      quad: [
        { x: 450, y: 710 },
        { x: 560, y: 700 },
        { x: 450, y: 710 }
      ],
      face: 1
    },
    { name: "face", ms: 2800, hold: { x: 450, y: 710 }, pose: "wag", face: 1 }
  ];
  const PLAYLIST = [PATH_A, PATH_B, PATH_C];

  function quadAt(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }

  function createPet(host, onChange, opts = {}) {
    clearHost(host);
    host.dataset.renderer = "pet";
    delete host.dataset.placeholder;

    const room = document.createElement("div");
    room.className = "marley-pet-room";
    room.setAttribute("role", "img");
    room.setAttribute("aria-label", LABELS.roam);

    const wall = document.createElement("div");
    wall.className = "marley-pet-wall";
    wall.setAttribute("aria-hidden", "true");
    const windowEl = document.createElement("div");
    windowEl.className = "marley-pet-window";
    windowEl.setAttribute("aria-hidden", "true");
    const floor = document.createElement("div");
    floor.className = "marley-pet-floor";
    floor.setAttribute("aria-hidden", "true");
    const rug = document.createElement("div");
    rug.className = "marley-pet-rug";
    rug.setAttribute("aria-hidden", "true");
    const basket = document.createElement("div");
    basket.className = "marley-pet-basket";
    basket.setAttribute("aria-hidden", "true");
    basket.innerHTML = '<span class="marley-pet-basket-emoji">🧺</span>';

    const actor = document.createElement("div");
    actor.className = "marley-pet-actor";
    const shadow = document.createElement("div");
    shadow.className = "marley-pet-shadow";
    const sprite = document.createElement("img");
    sprite.className = "marley-pet-sprite";
    sprite.src = POSES.stand;
    sprite.alt = "Marley";
    sprite.decoding = "async";
    sprite.draggable = false;
    sprite.onerror = () => {
      if (sprite.src.indexOf("marley-cutout") === -1) sprite.src = CUTOUT;
    };
    const glassesImg = document.createElement("img");
    glassesImg.className = "marley-pet-sunglasses";
    glassesImg.src = SUNGLASSES;
    glassesImg.alt = "";
    glassesImg.decoding = "async";
    glassesImg.draggable = false;
    glassesImg.hidden = true;
    const gear = document.createElement("div");
    gear.className = "marley-pet-gear";
    gear.setAttribute("aria-hidden", "true");
    const fx = document.createElement("div");
    fx.className = "marley-pet-fx";
    fx.setAttribute("aria-hidden", "true");
    const treat = document.createElement("div");
    treat.className = "marley-pet-treat";
    treat.setAttribute("aria-hidden", "true");
    treat.textContent = "🍪";

    actor.append(shadow, sprite, glassesImg, gear, fx);
    room.append(wall, windowEl, floor, rug, basket, treat, actor);
    host.append(room);

    let disposed = false;
    let paused = false;
    let state = "roam";
    let pose = "stand";
    let face = 1;
    let x = HOME.x;
    let y = HOME.y;
    let scale = 1;
    let tilt = 0;
    let bob = 0;
    let opacity = 1;
    let equipped = {};
    let lastEatAt = 0;
    let queuedCelebrate = false;
    let pathIndex = 0;
    let segIndex = 0;
    let segStart = 0;
    let segFrom = { x: HOME.x, y: HOME.y };
    let reaction = null;
    let raf = 0;
    let fade = null;
    let walkFrame = 0;
    let walkFrameAt = 0;
    let currentSrc = POSES.stand;
    const reduced = !!opts.reduced;

    function pct(n) {
      return (n / ART) * 100 + "%";
    }

    function poseSrc(p, walking) {
      if (p === "sit" || p === "bed") return POSES.sit;
      if (p === "lie" || p === "sleep") return POSES.lie;
      if (p === "wag") {
        return walkFrame % 2 === 0 ? POSES.wagA : POSES.wagB;
      }
      if (walking || p === "walk") {
        return walkFrame % 2 === 0 ? POSES.walkA : POSES.walkB;
      }
      return POSES.stand;
    }

    function setSprite(src) {
      if (src === currentSrc) return;
      currentSrc = src;
      sprite.src = src;
    }

    function applyTransform() {
      const flip = face < 0 ? -1 : 1;
      const shadowW = pose === "lie" || pose === "sleep" ? 0.72 : pose === "sit" || pose === "bed" ? 0.55 : 0.42;
      const shadowH = pose === "lie" || pose === "sleep" ? 0.08 : 0.055;
      actor.style.left = pct(x);
      actor.style.top = pct(y - bob);
      actor.style.opacity = String(opacity);
      actor.style.transform =
        "translate(-50%, -100%) scale(" + flip * scale + ", " + scale + ") rotate(" + tilt + "deg)";
      actor.dataset.pose = pose;
      actor.dataset.face = String(face);
      host.dataset.pose = pose;
      shadow.style.width = shadowW * 100 + "%";
      shadow.style.height = shadowH * 100 + "%";
      shadow.style.left = (50 - shadowW * 50) + "%";
      basket.classList.toggle("is-visible", state === "bed" || state === "sleep" || pose === "bed" || pose === "sleep");
      treat.classList.toggle("is-visible", state === "eat" && reaction && reaction.phase !== "return");
    }

    function renderGear() {
      const map = equipped || {};
      const ids = new Set();
      if (map.sunglasses || map.eyes === "glasses") ids.add("glasses");
      if (map.hat || map.head === "hat") ids.add("hat");
      if (map.head === "cap") ids.add("cap");
      if (map.body === "bee") ids.add("bee");
      if (map.feet === "shoes") ids.add("shoes");
      if (map.board === "skate") ids.add("skate");
      if (map.toy === "ball") ids.add("ball");
      if (map.toy === "bone") ids.add("bone");
      for (const id of Object.keys(GEAR)) {
        if (map[id] === true) ids.add(id);
      }
      const showGlasses = ids.has("glasses");
      glassesImg.hidden = !showGlasses;
      glassesImg.classList.toggle("is-on", showGlasses);
      const parts = [];
      for (const id of ids) {
        if (id === "glasses") continue; // PNG overlay
        const g = GEAR[id];
        if (!g) continue;
        parts.push('<span class="marley-pet-wear ' + g.className + '">' + g.emoji + "</span>");
      }
      gear.innerHTML = parts.join("");
      gear.hidden = parts.length === 0;
    }

    function setLabel(name) {
      room.setAttribute("aria-label", LABELS[name] || LABELS.roam);
      host.dataset.action =
        name === "roam" || name === "wag" ? "wag" : name === "celebrate" ? "smile" : name;
    }

    function emit(name) {
      onChange(name === "roam" || name === "wag" ? "wag" : name === "celebrate" ? "smile" : name);
    }

    function startPath(index, fromCenter) {
      pathIndex = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
      segIndex = 0;
      const path = PLAYLIST[pathIndex];
      const seg = path[0];
      if (fromCenter) {
        x = HOME.x;
        y = HOME.y;
        scale = 1;
        tilt = 0;
        bob = 0;
        pose = "stand";
      }
      segFrom = { x, y };
      if (seg.from) segFrom = { x: seg.from.x, y: seg.from.y };
      if (seg.hold) {
        x = seg.hold.x;
        y = seg.hold.y;
      }
      if (seg.face) face = seg.face;
      segStart = performance.now();
      walkFrameAt = segStart;
      pose = seg.pose || (seg.name && seg.name.startsWith("walk") ? "walk" : pose);
    }

    function advanceSegment() {
      const path = PLAYLIST[pathIndex];
      segIndex++;
      if (segIndex >= path.length) {
        pathIndex = (pathIndex + 1) % PLAYLIST.length;
        segIndex = 0;
      }
      const seg = PLAYLIST[pathIndex][segIndex];
      segFrom = { x, y };
      if (seg.face) face = seg.face;
      pose =
        seg.pose ||
        (seg.name && seg.name.indexOf("walk") === 0 ? "walk" : seg.name === "arc" ? "walk" : "stand");
      bob = 0;
      segStart = performance.now();
      walkFrameAt = segStart;
    }

    function tickRoam(now) {
      const path = PLAYLIST[pathIndex];
      const seg = path[segIndex];
      const t = clamp((now - segStart) / seg.ms, 0, 1);
      const e = seg.ease ? easeInOut(t) : t;
      const walking = !!(seg.quad || (seg.from && seg.to) || (seg.name && seg.name.indexOf("walk") === 0) || seg.name === "arc");

      if (walking) {
        if (now - walkFrameAt >= WALK_FRAME_MS) {
          walkFrame = (walkFrame + 1) % 2;
          walkFrameAt = now;
        }
        bob = 10 * Math.sin(((now - segStart) / 150) * Math.PI);
        pose = "walk";
        scale = 1;
        tilt = 0;
      } else if (pose === "wag" || seg.pose === "wag") {
        if (now - walkFrameAt >= WAG_FRAME_MS) {
          walkFrame = (walkFrame + 1) % 2;
          walkFrameAt = now;
        }
        bob = 16 * Math.sin(((now - segStart) / 140) * Math.PI);
        tilt = Math.sin(((now - segStart) / 160) * Math.PI) * 6;
        pose = "wag";
        scale = 1;
      } else {
        bob = 0;
      }

      if (seg.quad) {
        const p = quadAt(seg.quad[0], seg.quad[1], seg.quad[2], e);
        x = clamp(p.x, X_MIN, X_MAX);
        y = p.y;
        face = t < 0.5 ? 1 : -1;
      } else if (seg.from && seg.to) {
        x = clamp(segFrom.x + (seg.to.x - segFrom.x) * e, X_MIN, X_MAX);
        y = segFrom.y + (seg.to.y - segFrom.y) * e;
        if (seg.face) face = seg.face;
      } else {
        const hx = seg.hold ? seg.hold.x : x;
        const hy = seg.hold ? seg.hold.y : y;
        // Idle wag hold: slight x sway so it never reads as a still photo
        if (pose === "wag" || seg.pose === "wag") {
          x = clamp(hx + Math.sin(((now - segStart) / 280) * Math.PI) * 36, X_MIN, X_MAX);
        } else {
          x = clamp(hx, X_MIN, X_MAX);
        }
        y = hy;
        tilt = typeof seg.tilt === "number" ? seg.tilt : tilt;
        pose = seg.pose || (seg.name === "sniff" ? "sniff" : pose);
        if (seg.face) face = seg.face;
        scale = 1;
      }

      setSprite(poseSrc(pose, walking));
      if (t >= 1) advanceSegment();
    }

    function beginReaction(kind) {
      reaction = { kind, t0: performance.now(), phase: "start" };
      opacity = 1;
      bob = 0;
      fade = null;
      if (kind === "eat") {
        treat.classList.add("is-visible");
        x = HOME.x;
        y = HOME.y;
        scale = 1;
        tilt = 0;
        face = 1;
        pose = "notice";
        setSprite(POSES.stand);
      } else if (kind === "wag") {
        x = HOME.x;
        y = HOME.y;
        face = 1;
        pose = "wag";
        scale = 1;
        tilt = 0;
        walkFrame = 0;
        walkFrameAt = performance.now();
        setSprite(POSES.wagA);
      } else if (kind === "celebrate") {
        x = HOME.x;
        y = HOME.y;
        face = 1;
        pose = "sit";
        scale = 1;
        tilt = 0;
        setSprite(POSES.sit);
        fx.textContent = "✨";
        fx.classList.add("is-on");
      } else if (kind === "outfit") {
        x = HOME.x;
        y = HOME.y;
        face = 1;
        pose = "outfit";
        setSprite(POSES.stand);
        fx.textContent = "✨😎";
        fx.classList.add("is-on");
        renderGear();
      } else if (kind === "bed") {
        pose = "bed";
        x = HOME.x;
        y = HOME.y + 5;
        tilt = 0;
        setSprite(POSES.sit);
      } else if (kind === "sleep") {
        pose = "sleep";
        x = HOME.x;
        y = HOME.y + 10;
        tilt = -4;
        setSprite(POSES.lie);
      } else if (kind === "run") {
        pose = "walk";
        face = 1;
        x = HOME.x;
        y = HOME.y;
        walkFrame = 0;
        walkFrameAt = performance.now();
        setSprite(POSES.walkA);
      }
    }

    function tickReaction(now) {
      const r = reaction;
      if (!r) return;
      const elapsed = now - r.t0;

      if (r.kind === "eat") {
        if (elapsed < 400) {
          r.phase = "notice";
          pose = "notice";
          tilt = -4;
          scale = 1;
          treat.style.left = "62%";
          treat.style.top = "58%";
          setSprite(POSES.stand);
        } else if (elapsed < 1600) {
          r.phase = "approach";
          pose = "eat";
          const u = (elapsed - 400) / 1200;
          bob = 8 * Math.sin(u * Math.PI * 4);
          x = HOME.x + 40 * u;
          y = HOME.y;
          treat.style.left = 62 - 14 * u + "%";
          treat.style.top = 58 + 6 * u + "%";
          tilt = -6 * u;
          setSprite(POSES.stand);
        } else if (elapsed < 2800) {
          r.phase = "happy";
          pose = "wag";
          const u = (elapsed - 1600) / 1200;
          bob = 10 * Math.sin(u * Math.PI * 5);
          tilt = Math.sin(u * Math.PI * 4) * 3;
          treat.style.opacity = String(1 - u);
          setSprite(POSES.stand);
        } else if (elapsed < 3500) {
          r.phase = "return";
          pose = "stand";
          const u = (elapsed - 2800) / 700;
          bob = 0;
          tilt = 0;
          x = HOME.x;
          y = HOME.y;
          treat.classList.remove("is-visible");
          treat.style.opacity = "1";
          setSprite(POSES.stand);
        } else {
          endReactionToRoam();
        }
        return;
      }

      if (r.kind === "wag") {
        if (elapsed < 2400) {
          if (now - walkFrameAt >= WAG_FRAME_MS) {
            walkFrame = (walkFrame + 1) % 2;
            walkFrameAt = now;
          }
          bob = 22 * Math.sin(((now - r.t0) / 120) * Math.PI);
          tilt = Math.sin(((now - r.t0) / 140) * Math.PI) * 10;
          x = HOME.x + Math.sin(((now - r.t0) / 220) * Math.PI) * 70;
          y = HOME.y;
          pose = "wag";
          setSprite(poseSrc("wag", false));
        } else {
          endReactionToRoam();
        }
        return;
      }

      if (r.kind === "celebrate") {
        if (elapsed < 1800) {
          const u = elapsed / 1800;
          bob = 14 * Math.sin(u * Math.PI * 3);
          tilt = Math.sin(u * Math.PI * 3) * 5;
          pose = "sit";
          setSprite(POSES.sit);
        } else {
          fx.classList.remove("is-on");
          fx.textContent = "";
          endReactionToRoam();
        }
        return;
      }

      if (r.kind === "outfit") {
        if (elapsed < 500) {
          r.phase = "tryon";
          pose = "outfit";
          glassesImg.style.opacity = String(elapsed / 500);
          setSprite(POSES.stand);
        } else if (elapsed < 1800) {
          r.phase = "proud";
          pose = "celebrate";
          const u = (elapsed - 500) / 1300;
          bob = 8 * Math.sin(u * Math.PI * 2);
          glassesImg.style.opacity = "1";
          setSprite(POSES.stand);
        } else if (elapsed < 2500) {
          r.phase = "settle";
          bob = 0;
          tilt = 0;
        } else {
          fx.classList.remove("is-on");
          fx.textContent = "";
          glassesImg.style.opacity = "1";
          endReactionToRoam();
        }
        return;
      }

      if (r.kind === "bed") {
        if (elapsed < 2400) {
          pose = "bed";
          y = HOME.y + 5;
          setSprite(POSES.sit);
        } else {
          reaction = null;
          state = "sleep";
          setLabel("sleep");
          beginReaction("sleep");
          emit("sleep");
        }
        return;
      }

      if (r.kind === "sleep") {
        pose = "sleep";
        y = HOME.y + 10;
        tilt = -4 + Math.sin(elapsed / 900) * 1.2;
        setSprite(POSES.lie);
        return;
      }

      if (r.kind === "run") {
        if (elapsed < 3200) {
          const u = elapsed / 3200;
          // Full oval lap — clear left/right travel (walk alone feels still)
          const ang = u * Math.PI * 2;
          x = clamp(HOME.x + Math.cos(ang) * 240, X_MIN, X_MAX);
          y = HOME.y + Math.sin(ang) * 56;
          face = Math.cos(ang) >= 0 ? 1 : -1;
          pose = "walk";
          if (now - walkFrameAt >= RUN_FRAME_MS) {
            walkFrame = (walkFrame + 1) % 2;
            walkFrameAt = now;
          }
          bob = 16 * Math.sin(((now - r.t0) / 100) * Math.PI);
          setSprite(poseSrc("walk", true));
        } else {
          endReactionToRoam();
        }
      }
    }

    function endReactionToRoam() {
      reaction = null;
      treat.classList.remove("is-visible");
      fx.classList.remove("is-on");
      fx.textContent = "";
      opacity = 1;
      x = HOME.x;
      y = HOME.y;
      scale = 1;
      tilt = 0;
      bob = 0;
      pose = "stand";
      state = "roam";
      setLabel("roam");
      setSprite(POSES.stand);
      startPath(0, true);
      emit("wag");
      if (queuedCelebrate) {
        queuedCelebrate = false;
        fade = {
          mode: "out",
          t0: performance.now(),
          ms: FADE_OUT_MS,
          then: () => {
            state = "celebrate";
            setLabel("celebrate");
            beginReaction("celebrate");
            emit("smile");
          }
        };
      }
    }

    function fadeThen(then) {
      fade = { mode: "out", t0: performance.now(), ms: FADE_OUT_MS, then };
    }

    function tickFade(now) {
      if (!fade) return false;
      const t = clamp((now - fade.t0) / fade.ms, 0, 1);
      if (fade.mode === "out") {
        opacity = 1 - t;
        if (t >= 1) {
          const fn = fade.then;
          fade = { mode: "in", t0: now, ms: CROSSFADE_MS, then: null };
          opacity = 0;
          if (fn) fn();
        }
        return true;
      }
      if (fade.mode === "in") {
        opacity = t;
        if (t >= 1) {
          opacity = 1;
          fade = null;
        }
        return true;
      }
      return false;
    }

    function frame(now) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      // Keep crossfades moving while paused so Smil/Logre never stick mid-fade.
      tickFade(now);
      if (paused) {
        applyTransform();
        return;
      }
      if ((state === "roam" || state === "wag") && !reaction) tickRoam(now);
      else if (reaction) tickReaction(now);
      applyTransform();
    }

    function normalize(name) {
      return ALIAS[name] || name;
    }

    function play(name) {
      if (disposed || !name) return;
      const n = normalize(name);
      if (!LABELS[n] && n !== "roam") return;

      if (n === "eat") {
        const now = Date.now();
        if (now - lastEatAt < EAT_THROTTLE_MS && lastEatAt > 0) {
          if (typeof opts.onThrottled === "function") opts.onThrottled("eat");
          return;
        }
        if (state === "celebrate") queuedCelebrate = false;
        else if (state === "eat" && reaction) return;
        lastEatAt = now;
        interruptTo("eat");
        return;
      }

      if (n === "celebrate" || n === "smile") {
        if (state === "eat" && reaction) {
          queuedCelebrate = true;
          return;
        }
        interruptTo("celebrate");
        return;
      }

      if (n === "outfit") {
        interruptTo("outfit");
        return;
      }

      if (n === "bed") {
        interruptTo("bed");
        return;
      }

      if (n === "sleep") {
        interruptTo("sleep");
        return;
      }

      if (n === "run") {
        interruptTo("run");
        return;
      }

      // Logre: always restart visible wag (wag-a/b + bob + x sway) — never a no-op
      if (n === "wag") {
        interruptTo("wag");
        return;
      }

      // Idle roam path (auto / wake from bed)
      interruptTo("roam");
    }

    function interruptTo(kind) {
      const go = () => {
        if (kind === "roam") {
          reaction = null;
          state = "roam";
          setLabel("roam");
          x = HOME.x;
          y = HOME.y;
          scale = 1;
          tilt = 0;
          bob = 0;
          opacity = 1;
          pose = "walk";
          walkFrame = 0;
          walkFrameAt = performance.now();
          setSprite(POSES.walkA);
          startPath(0, true);
          emit("wag");
          applyTransform();
          return;
        }
        if (kind === "sleep") {
          reaction = null;
          state = "sleep";
          setLabel("sleep");
          beginReaction("sleep");
          emit("sleep");
          applyTransform();
          return;
        }
        state = kind;
        setLabel(kind);
        beginReaction(kind);
        emit(kind === "celebrate" ? "smile" : kind === "wag" ? "wag" : kind);
        applyTransform();
      };
      // Instant sprite change on button press — no fade delay
      fade = null;
      opacity = 1;
      go();
    }

    function setEquipment(eq) {
      equipped = eq && typeof eq === "object" ? { ...eq } : {};
      if (equipped.eyes === "glasses") equipped.sunglasses = true;
      if (equipped.head === "hat") equipped.hat = true;
      renderGear();
    }

    renderGear();
    if (reduced) {
      // Still swap poses on every button — no continuous roam travel
      host.dataset.placeholder = "1";
      x = HOME.x;
      y = HOME.y;
      pose = "stand";
      state = "wag";
      let poseTimer = 0;
      setLabel("wag");
      setSprite(POSES.stand);
      applyTransform();
      emit("wag");

      function clearPoseTimer() {
        if (poseTimer) {
          clearInterval(poseTimer);
          clearTimeout(poseTimer);
          poseTimer = 0;
        }
      }

      function startPoseSwap(opts) {
        clearPoseTimer();
        const ms = opts.ms;
        const duration = opts.duration;
        const doneState = opts.doneState || "wag";
        const srcA = opts.srcA;
        const srcB = opts.srcB;
        const poseName = opts.pose || "walk";
        const travel = !!opts.travel;
        const sway = !!opts.sway;
        let f = 0;
        let step = 0;
        pose = poseName;
        x = HOME.x;
        y = HOME.y;
        bob = 0;
        tilt = 0;
        setSprite(srcA);
        applyTransform();
        const t0 = Date.now();
        poseTimer = setInterval(() => {
          if (disposed || paused) return;
          f = 1 - f;
          step++;
          setSprite(f ? srcB : srcA);
          const elapsed = Date.now() - t0;
          if (travel) {
            // Reduced-motion still needs visible x-travel on Løb
            const ang = (elapsed / duration) * Math.PI * 2;
            x = clamp(HOME.x + Math.cos(ang) * 180, X_MIN, X_MAX);
            y = HOME.y + Math.sin(ang) * 36;
            face = Math.cos(ang) >= 0 ? 1 : -1;
            bob = 10 * Math.sin(step * 0.9);
          } else if (sway) {
            x = HOME.x + Math.sin(elapsed / 220) * 50;
            bob = 14 * Math.sin(step * 0.8);
            tilt = Math.sin(step * 0.7) * 8;
          }
          applyTransform();
          if (elapsed >= duration) {
            clearPoseTimer();
            state = doneState;
            pose = "stand";
            x = HOME.x;
            y = HOME.y;
            bob = 0;
            tilt = 0;
            setSprite(POSES.stand);
            setLabel(state === "wag" ? "wag" : state);
            applyTransform();
            emit(state === "celebrate" ? "smile" : state);
          }
        }, ms);
      }

      return {
        play(name) {
          if (disposed) return;
          const n = normalize(name);
          if (n === "eat") {
            const now = Date.now();
            if (lastEatAt && now - lastEatAt < EAT_THROTTLE_MS) {
              opts.onThrottled?.("eat");
              return;
            }
            lastEatAt = now;
          }
          clearPoseTimer();
          state = n === "roam" ? "wag" : n;
          setLabel(n === "roam" ? "wag" : n === "celebrate" ? "celebrate" : n);
          if (n === "wag" || n === "roam") {
            startPoseSwap({
              ms: WAG_FRAME_MS,
              duration: 2400,
              doneState: "wag",
              srcA: POSES.wagA,
              srcB: POSES.wagB,
              pose: "wag",
              sway: true
            });
            emit("wag");
            return;
          }
          if (n === "run") {
            startPoseSwap({
              ms: RUN_FRAME_MS,
              duration: 3200,
              doneState: "wag",
              srcA: POSES.walkA,
              srcB: POSES.walkB,
              pose: "walk",
              travel: true
            });
            emit("run");
            return;
          }
          if (n === "celebrate" || n === "smile") {
            pose = "sit";
            setSprite(POSES.sit);
            applyTransform();
            emit("smile");
            poseTimer = setTimeout(() => {
              poseTimer = 0;
              if (disposed) return;
              pose = "stand";
              state = "wag";
              setSprite(POSES.stand);
              setLabel("wag");
              applyTransform();
              emit("wag");
            }, 1800);
            return;
          }
          if (n === "bed") {
            pose = "bed";
            setSprite(POSES.sit);
            applyTransform();
            emit("bed");
            poseTimer = setTimeout(() => {
              poseTimer = 0;
              if (disposed) return;
              state = "sleep";
              pose = "sleep";
              setSprite(POSES.lie);
              setLabel("sleep");
              applyTransform();
              emit("sleep");
            }, 2400);
            return;
          }
          if (n === "sleep") {
            pose = "sleep";
            setSprite(POSES.lie);
            applyTransform();
            emit("sleep");
            return;
          }
          pose = n === "eat" ? "eat" : "stand";
          setSprite(n === "eat" ? POSES.sit : POSES.stand);
          applyTransform();
          emit(n === "celebrate" ? "smile" : n);
        },
        pause(force) {
          if (disposed) return paused;
          paused = typeof force === "boolean" ? !!force : !paused;
          actor.classList.toggle("is-paused", paused);
          return paused;
        },
        setEquipment,
        getState() {
          return state === "roam" ? "wag" : state === "celebrate" ? "smile" : state;
        },
        destroy() {
          disposed = true;
          clearPoseTimer();
          clearHost(host);
        }
      };
    }

    state = "roam";
    setLabel("roam");
    startPath(0, true);
    applyTransform();
    emit("wag");
    raf = requestAnimationFrame(frame);

    return {
      play,
      pause(force) {
        if (disposed) return paused;
        paused = typeof force === "boolean" ? !!force : !paused;
        actor.classList.toggle("is-paused", paused);
        room.classList.toggle("is-paused", paused);
        return paused;
      },
      setEquipment,
      getState() {
        return state === "roam" || state === "wag" ? "wag" : state === "celebrate" ? "smile" : state;
      },
      destroy() {
        disposed = true;
        cancelAnimationFrame(raf);
        clearHost(host);
      }
    };
  }

  async function create(host, onChange = () => {}, opts = {}) {
    if (!host) throw new Error("MarleyPetScene kræver en host");
    return createPet(host, onChange, {
      reduced: prefersReducedMotion(),
      onThrottled: opts.onThrottled
    });
  }

  window.MarleyPetScene = { create, HOME, PLAYLIST, POSES, CUTOUT, CACHE };
})();
