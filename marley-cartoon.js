/* Complete drawn Marley performances, encoded as 60 fps films. */
(() => {
  "use strict";
  const CACHE = "20261007-cartoon2";
  const BASE = "assets/figurer/marley-cartoon/";
  const LABELS = {wag:"Marley logrer",smile:"Marley smiler",run:"Marley løber i cirkler",eat:"Marley spiser en godbid",bed:"Marley lægger sig i kurven",sleep:"Marley sover i kurven"};
  const GEAR = {hat:["head","🎉"],cap:["head","🧢"],glasses:["eyes","🕶️"],bee:["body","🐝"],shoes:["feet","👟"],skate:["board","🛹"],ball:["toy","🎾"],bone:["toy","🦴"]};

  async function create(host, onChange = () => {}) {
    const room = document.createElement("div");
    room.className = "marley-cartoon-room";
    room.setAttribute("role", "img");
    const videos = [0,1].map(() => {
      const v = document.createElement("video");
      v.className = "marley-cartoon-film";
      v.muted = true; v.defaultMuted = true; v.playsInline = true;
      v.preload = "auto"; v.poster = BASE + "poster.webp?v=" + CACHE;
      v.setAttribute("aria-hidden", "true");
      return v;
    });
    const gear = document.createElement("div");
    gear.className = "marley-cartoon-gear";
    gear.setAttribute("aria-hidden", "true");
    room.append(...videos,gear);
    host.replaceChildren(room);
    host.dataset.renderer = "cartoon";
    let state = "wag", active = -1, version = 0, paused = false, disposed = false;
    let queuedSmile = false, equipment = {}, pendingCleanup = null;
    videos[0].classList.add("is-active");

    function renderEquipment() {
      gear.replaceChildren();
      // The illustrated props remain attached during the standing reactions.
      // Running and reclining films have different head/body positions.
      gear.hidden = !["wag","smile"].includes(state);
      for (const id of Object.values(equipment)) {
        if (!GEAR[id]) continue;
        const [slot,icon] = GEAR[id];
        const span = document.createElement("span");
        span.className = "marley-cartoon-wear " + slot;
        span.textContent = icon; gear.append(span);
      }
    }

    function play(requested) {
      if (disposed) return;
      const name = requested === "roam" ? "wag" : requested === "outfit" ? "smile" : requested;
      if (!LABELS[name]) return;
      if (name === "smile" && state === "eat") { queuedSmile = true; return; }
      if (name !== "smile") queuedSmile = false;
      pendingCleanup?.(); pendingCleanup = null;
      const token = ++version;
      state = name;
      host.dataset.action = name;
      room.setAttribute("aria-label", LABELS[name]);
      renderEquipment(); onChange(name);
      const index = active === 0 ? 1 : 0;
      const next = videos[index];
      next.pause();
      next.loop = name === "wag" || name === "sleep";
      const ready = () => {
        if (disposed || version !== token) return;
        next.removeEventListener("loadeddata", ready);
        next.removeEventListener("error", failed);
        pendingCleanup = null;
        const reveal = () => {
          if (disposed || version !== token) return;
          for (let i=0;i<videos.length;i++) {
            videos[i].classList.toggle("is-active", i === index);
            if (i !== index) videos[i].pause();
          }
          active = index;
          delete host.dataset.loading;
          delete host.dataset.playbackError;
          if (paused) next.pause();
        };
        if (paused) { reveal(); return; }
        next.play().then(() => {
          if (typeof next.requestVideoFrameCallback === "function") next.requestVideoFrameCallback(reveal);
          else reveal();
        }).catch(() => {
          if (disposed || version !== token) return;
          reveal(); paused = true;
          host.dataset.playbackError = "1";
          onChange(name);
        });
      };
      const failed = () => {
        if (disposed || version !== token) return;
        pendingCleanup?.(); pendingCleanup = null;
        delete host.dataset.loading;
        host.dataset.playbackError = "1";
        state = active >= 0 ? videos[active].dataset.action : "wag";
        host.dataset.action = state;
        room.setAttribute("aria-label", LABELS[state]);
        renderEquipment(); onChange(state);
      };
      next.addEventListener("loadeddata", ready);
      next.addEventListener("error", failed);
      pendingCleanup = () => {
        next.removeEventListener("loadeddata", ready);
        next.removeEventListener("error", failed);
      };
      next.dataset.action = name;
      host.dataset.loading = name;
      next.src = BASE + name + ".mp4?v=" + CACHE;
      next.load();
    }

    const ended = (event) => {
      if (disposed || event.target !== videos[active] || paused || host.dataset.loading) return;
      if (state === "bed") { play("sleep"); return; }
      if (state === "eat" && queuedSmile) {
        queuedSmile = false;
        state = "wag";
        play("smile");
        return;
      }
      play("wag");
    };
    videos.forEach(v => v.addEventListener("ended", ended));
    const scene = {
      play,
      pause(force) {
        if (disposed) return paused;
        paused = typeof force === "boolean" ? force : !paused;
        if (paused) videos.forEach(v => v.pause());
        else if (active >= 0) videos[active].play().catch(() => { paused = true; onChange(state); });
        return paused;
      },
      setEquipment(value) { equipment = value && typeof value === "object" ? {...value} : {}; renderEquipment(); },
      getState() { return state; },
      isPaused() { return paused; },
      destroy() {
        disposed = true; version++; pendingCleanup?.();
        videos.forEach(v => { v.pause(); v.removeEventListener("ended",ended); v.removeAttribute("src"); v.load(); });
        host.replaceChildren(); delete host.dataset.renderer; delete host.dataset.loading;
      }
    };
    return scene;
  }
  window.MarleyCartoonScene = {create,CACHE};
})();
