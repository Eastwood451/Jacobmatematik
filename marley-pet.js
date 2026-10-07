/* Marley living pet-scene M1: layered 2D roam (canon PNG + transforms). No soft-bob WebM, no FLUX/I2V. */
(() => {
  "use strict";

  const CACHE = "20261007-pet2";
  const CANON = "assets/figurer/marley-canon.png?v=" + CACHE;
  const ART = 900;
  const HOME = { x: 450, y: 700 };
  const X_MIN = 160;
  const X_MAX = 740;
  const FOOT_W = 420;
  const FOOT_H = 480;
  const EAT_THROTTLE_MS = 90_000;
  const CROSSFADE_MS = 200;
  const FADE_OUT_MS = 120;

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

  /** Legacy UI → living-scene names */
  const ALIAS = {
    wag: "roam",
    smile: "celebrate",
    run: "run"
  };

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

  // ── Path playlist (§10) ──────────────────────────────────────────
  const PATH_A = [
    { name: "walk_l", ms: 3200, from: { x: 450, y: 700 }, to: { x: 220, y: 700 }, ease: true, face: -1 },
    { name: "sniff", ms: 2400, hold: { x: 220, y: 700 }, tilt: -6, face: -1 },
    { name: "walk_c", ms: 2800, from: { x: 220, y: 700 }, to: { x: 450, y: 700 }, ease: true, face: 1 },
    { name: "wag", ms: 2200, hold: { x: 450, y: 700 }, pose: "wag", face: 1 }
  ];
  const PATH_B = [
    { name: "walk_r", ms: 3000, from: { x: 450, y: 700 }, to: { x: 680, y: 700 }, ease: true, face: 1 },
    { name: "sit", ms: 2200, hold: { x: 680, y: 700 }, scale: 0.96, pose: "sit", face: 1 },
    { name: "lie", ms: 2800, hold: { x: 680, y: 712 }, scale: 0.92, pose: "lie", face: 1 },
    { name: "up", ms: 1600, hold: { x: 680, y: 700 }, scale: 1, pose: "stand", face: 1 },
    { name: "walk_c", ms: 2800, from: { x: 680, y: 700 }, to: { x: 450, y: 700 }, ease: true, face: -1 },
    { name: "look_cam", ms: 1800, hold: { x: 450, y: 700 }, pose: "look", face: 1 }
  ];
  const PATH_C = [
    {
      name: "arc",
      ms: 4500,
      quad: [
        { x: 450, y: 700 },
        { x: 560, y: 680 },
        { x: 450, y: 700 }
      ],
      face: 1
    },
    { name: "face", ms: 2800, hold: { x: 450, y: 700 }, pose: "wag", face: 1 }
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
    const floor = document.createElement("div");
    floor.className = "marley-pet-floor";
    const ground = document.createElement("div");
    ground.className = "marley-pet-ground";
    const basket = document.createElement("div");
    basket.className = "marley-pet-basket";
    basket.setAttribute("aria-hidden", "true");
    basket.textContent = "🧺";

    const actor = document.createElement("div");
    actor.className = "marley-pet-actor";
    const shadow = document.createElement("div");
    shadow.className = "marley-pet-shadow";
    const sprite = document.createElement("img");
    sprite.className = "marley-pet-sprite";
    sprite.src = CANON;
    sprite.alt = "Marley";
    sprite.decoding = "async";
    sprite.draggable = false;
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

    actor.append(shadow, sprite, gear, fx);
    room.append(wall, floor, ground, basket, treat, actor);
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
    let opacity = 1;
    let equipped = {};
    let lastEatAt = 0;
    let queuedCelebrate = false;
    let pathIndex = 0;
    let segIndex = 0;
    let segStart = 0;
    let segFrom = { x: HOME.x, y: HOME.y };
    let reaction = null; // { kind, t0, duration }
    let raf = 0;
    let fade = null; // { mode, t0, ms, then }
    const reduced = !!opts.reduced;

    function pct(n) {
      return (n / ART) * 100 + "%";
    }

    function applyTransform() {
      const flip = face < 0 ? -1 : 1;
      actor.style.left = pct(x);
      actor.style.top = pct(y);
      actor.style.opacity = String(opacity);
      actor.style.transform =
        "translate(-50%, -100%) scale(" +
        flip * scale +
        ", " +
        scale +
        ") rotate(" +
        tilt +
        "deg)";
      actor.dataset.pose = pose;
      actor.dataset.face = String(face);
      host.dataset.pose = pose;
      basket.classList.toggle("is-visible", state === "bed" || state === "sleep");
      treat.classList.toggle("is-visible", state === "eat" && reaction && reaction.phase !== "return");
    }

    function renderGear() {
      const parts = [];
      const map = equipped || {};
      // Prefer id keys; also accept sunglasses boolean + slot map from marley.js
      const ids = new Set();
      if (map.sunglasses || map.eyes === "glasses") ids.add("glasses");
      if (map.hat || map.head === "hat") ids.add("hat");
      if (map.head === "cap") ids.add("cap");
      if (map.body === "bee") ids.add("bee");
      if (map.feet === "shoes") ids.add("shoes");
      if (map.board === "skate") ids.add("skate");
      if (map.toy === "ball") ids.add("ball");
      if (map.toy === "bone") ids.add("bone");
      // Direct id flags
      for (const id of Object.keys(GEAR)) {
        if (map[id] === true) ids.add(id);
      }
      for (const id of ids) {
        const g = GEAR[id];
        if (!g) continue;
        parts.push('<span class="marley-pet-wear ' + g.className + '">' + g.emoji + "</span>");
      }
      gear.innerHTML = parts.join("");
      gear.hidden = parts.length === 0;
    }

    function setLabel(name) {
      room.setAttribute("aria-label", LABELS[name] || LABELS.roam);
      host.dataset.action = name === "roam" ? "wag" : name === "celebrate" ? "smile" : name;
    }

    function emit(name) {
      onChange(name === "roam" ? "wag" : name === "celebrate" ? "smile" : name);
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
      if (seg.from) {
        // snap soft from current; prefer continuity
        segFrom = { x, y };
      }
      if (seg.face) face = seg.face;
      pose = seg.pose || (seg.name && seg.name.indexOf("walk") === 0 ? "walk" : seg.name === "arc" ? "walk" : "stand");
      if (seg.hold && !seg.from && !seg.quad) {
        // hold starts at current; target hold pos via small settle if needed
      }
      segStart = performance.now();
    }

    function tickRoam(now) {
      const path = PLAYLIST[pathIndex];
      const seg = path[segIndex];
      const t = clamp((now - segStart) / seg.ms, 0, 1);
      const e = seg.ease ? easeInOut(t) : t;

      if (seg.quad) {
        const p = quadAt(seg.quad[0], seg.quad[1], seg.quad[2], e);
        x = clamp(p.x, X_MIN, X_MAX);
        y = p.y;
        // face by tangent-ish
        if (t < 0.5) face = 1;
        else face = -1;
        pose = "walk";
        scale = 1;
        tilt = 0;
      } else if (seg.from && seg.to) {
        x = clamp(segFrom.x + (seg.to.x - segFrom.x) * e, X_MIN, X_MAX);
        y = segFrom.y + (seg.to.y - segFrom.y) * e;
        pose = "walk";
        scale = 1;
        tilt = 0;
        if (seg.face) face = seg.face;
      } else {
        const hx = seg.hold ? seg.hold.x : x;
        const hy = seg.hold ? seg.hold.y : y;
        x = clamp(hx, X_MIN, X_MAX);
        y = hy;
        if (typeof seg.scale === "number") scale = seg.scale;
        else scale = 1;
        tilt = typeof seg.tilt === "number" ? seg.tilt : 0;
        pose = seg.pose || (seg.name === "sniff" ? "sniff" : pose);
        if (seg.face) face = seg.face;
      }

      if (t >= 1) advanceSegment();
    }

    function beginReaction(kind) {
      reaction = { kind, t0: performance.now(), phase: "start" };
      opacity = 1;
      if (kind === "eat") {
        treat.classList.add("is-visible");
        x = HOME.x;
        y = HOME.y;
        scale = 1;
        tilt = 0;
        face = 1;
        pose = "notice";
      } else if (kind === "celebrate") {
        x = HOME.x;
        y = HOME.y;
        face = 1;
        pose = "celebrate";
        scale = 1;
        fx.textContent = "✨";
        fx.classList.add("is-on");
      } else if (kind === "outfit") {
        x = HOME.x;
        y = HOME.y;
        face = 1;
        pose = "outfit";
        fx.textContent = "✨😎";
        fx.classList.add("is-on");
        renderGear();
      } else if (kind === "bed") {
        pose = "bed";
        x = HOME.x;
        y = HOME.y + 8;
        scale = 0.94;
      } else if (kind === "sleep") {
        pose = "sleep";
        x = HOME.x;
        y = HOME.y + 16;
        scale = 0.9;
        tilt = -4;
      } else if (kind === "run") {
        pose = "walk";
        face = 1;
      }
    }

    function tickReaction(now) {
      const r = reaction;
      if (!r) return;
      const elapsed = now - r.t0;

      if (r.kind === "eat") {
        // notice 0–0.4 → approach 0.4–1.6 → happy 1.6–2.8 → return 2.8–3.5
        if (elapsed < 400) {
          r.phase = "notice";
          pose = "notice";
          tilt = -4;
          scale = 1;
          treat.style.left = "58%";
          treat.style.top = "52%";
        } else if (elapsed < 1600) {
          r.phase = "approach";
          pose = "eat";
          const u = (elapsed - 400) / 1200;
          scale = 1 + 0.04 * Math.sin(u * Math.PI);
          x = HOME.x + 20 * u;
          treat.style.left = 58 - 12 * u + "%";
          treat.style.top = 52 + 8 * u + "%";
          tilt = -8 * u;
        } else if (elapsed < 2800) {
          r.phase = "happy";
          pose = "wag";
          const u = (elapsed - 1600) / 1200;
          scale = 1.06 + 0.04 * Math.sin(u * Math.PI * 3);
          tilt = Math.sin(u * Math.PI * 4) * 3;
          treat.style.opacity = String(1 - u);
        } else if (elapsed < 3500) {
          r.phase = "return";
          pose = "stand";
          const u = (elapsed - 2800) / 700;
          scale = 1.06 + (1 - 1.06) * u;
          tilt = 0;
          x = HOME.x;
          y = HOME.y;
          opacity = 1;
          treat.classList.remove("is-visible");
          treat.style.opacity = "1";
        } else {
          endReactionToRoam();
        }
        return;
      }

      if (r.kind === "celebrate") {
        if (elapsed < 1600) {
          const u = elapsed / 1600;
          scale = 1 + 0.08 * Math.sin(u * Math.PI * 2);
          tilt = Math.sin(u * Math.PI * 3) * 4;
          pose = "celebrate";
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
          scale = 1.02;
          gear.style.opacity = String(elapsed / 500);
        } else if (elapsed < 1800) {
          r.phase = "proud";
          pose = "celebrate";
          const u = (elapsed - 500) / 1300;
          scale = 1.05 + 0.03 * Math.sin(u * Math.PI * 2);
          gear.style.opacity = "1";
        } else if (elapsed < 2500) {
          r.phase = "settle";
          scale = 1;
          tilt = 0;
        } else {
          fx.classList.remove("is-on");
          fx.textContent = "";
          gear.style.opacity = "1";
          endReactionToRoam();
        }
        return;
      }

      if (r.kind === "bed") {
        if (elapsed < 2400) {
          const u = elapsed / 2400;
          scale = 1 - 0.06 * u;
          y = HOME.y + 12 * u;
          pose = "bed";
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
        scale = 0.9;
        y = HOME.y + 16;
        tilt = -4 + Math.sin(elapsed / 900) * 1.2;
        return;
      }

      if (r.kind === "run") {
        // short arc-like dash ~3.2s then roam
        if (elapsed < 3200) {
          const u = elapsed / 3200;
          const p = quadAt(
            { x: HOME.x, y: HOME.y },
            { x: 620, y: 680 },
            { x: HOME.x, y: HOME.y },
            easeInOut(u)
          );
          x = clamp(p.x, X_MIN, X_MAX);
          y = p.y;
          face = u < 0.5 ? 1 : -1;
          pose = "walk";
          scale = 1;
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
      pose = "stand";
      state = "roam";
      setLabel("roam");
      startPath(0, true);
      emit("wag");
      if (queuedCelebrate) {
        queuedCelebrate = false;
        // small delay then celebrate
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
      if (paused) {
        applyTransform();
        return;
      }
      tickFade(now);
      if (state === "roam" && !reaction) tickRoam(now);
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

      // Eat throttle
      if (n === "eat") {
        const now = Date.now();
        if (now - lastEatAt < EAT_THROTTLE_MS && lastEatAt > 0) {
          if (typeof opts.onThrottled === "function") opts.onThrottled("eat");
          return;
        }
        // Cut celebrate → eat
        if (state === "celebrate") {
          queuedCelebrate = false;
        } else if (state === "eat" && reaction) {
          return; // ignore stacked eat
        }
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
        state = "sleep";
        setLabel("sleep");
        beginReaction("sleep");
        emit("sleep");
        return;
      }

      if (n === "run") {
        interruptTo("run");
        return;
      }

      // roam / wag
      if (state === "sleep" || state === "bed") {
        interruptTo("roam");
        return;
      }
      if (state === "roam" && !reaction) return; // already roaming
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
          startPath(0, true);
          emit("wag");
          return;
        }
        state = kind;
        setLabel(kind);
        beginReaction(kind);
        emit(kind === "celebrate" ? "smile" : kind === "roam" ? "wag" : kind);
      };
      if (reduced) {
        go();
        opacity = 1;
        applyTransform();
        return;
      }
      fadeThen(go);
    }

    function setEquipment(eq) {
      equipped = eq && typeof eq === "object" ? { ...eq } : {};
      // Normalize sunglasses flag from slot map
      if (equipped.eyes === "glasses") equipped.sunglasses = true;
      if (equipped.head === "hat") equipped.hat = true;
      renderGear();
      // Outfit oneshot when glasses newly equipped is triggered by marley.js via play('outfit')
    }

    // Boot
    renderGear();
    if (reduced) {
      host.dataset.placeholder = "1";
      x = HOME.x;
      y = HOME.y;
      pose = "stand";
      state = "roam";
      setLabel("roam");
      applyTransform();
      emit("wag");
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
          state = n === "roam" ? "roam" : n;
          setLabel(n === "roam" ? "roam" : n);
          pose = n === "sleep" || n === "bed" ? "sleep" : n === "eat" ? "eat" : "stand";
          scale = n === "sleep" || n === "bed" ? 0.92 : 1;
          applyTransform();
          emit(n === "roam" ? "wag" : n === "celebrate" ? "smile" : n);
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
        return state === "roam" ? "wag" : state === "celebrate" ? "smile" : state;
      },
      destroy() {
        disposed = true;
        cancelAnimationFrame(raf);
        clearHost(host);
      }
    };
  }

  /**
   * @returns {Promise<{play,pause,setEquipment,getState,destroy}>}
   */
  async function create(host, onChange = () => {}, opts = {}) {
    if (!host) throw new Error("MarleyPetScene kræver en host");
    return createPet(host, onChange, {
      reduced: prefersReducedMotion(),
      onThrottled: opts.onThrottled
    });
  }

  window.MarleyPetScene = { create, HOME, PLAYLIST, CANON, CACHE };
})();
