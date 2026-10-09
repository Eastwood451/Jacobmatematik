/* Complete drawn Marley performances, encoded as 60 fps films. */
(() => {
  "use strict";
  const CACHE = "20261009-shoes1";
  const BASE = "assets/figurer/marley-cartoon/";
  const LABELS = {wag:"Marley logrer",smile:"Marley smiler",run:"Marley løber i cirkler",eat:"Marley spiser en godbid",bed:"Marley lægger sig i kurven",sleep:"Marley sover i kurven",bone:"Marley gumler på sit kødben",ball:"Marley leger med sin bold",skate:"Marley kører på skateboard"};


  async function create(host, onChange = () => {}) {
    const room = document.createElement("div");
    room.className = "marley-cartoon-room";
    room.setAttribute("role", "group");
    const videos = [0,1].map(() => {
      const v = document.createElement("video");
      v.className = "marley-cartoon-film";
      v.muted = true; v.defaultMuted = true; v.playsInline = true;
      v.preload = "auto"; v.poster = BASE + "poster.webp?v=" + CACHE;
      v.setAttribute("aria-hidden", "true");
      return v;
    });
    room.append(...videos);
    host.replaceChildren(room);
    host.dataset.renderer = "cartoon";
    let state = "wag", active = -1, version = 0, paused = false, disposed = false, bee = false, shoes = false;
    const outfitPath = () => bee && shoes ? "bee-shoes/" : bee ? "bee/" : shoes ? "shoes/" : "";
    let queuedSmile = false, pendingCleanup = null, restTimer = null, resting = false, raf = null;
    const wardrobe = window.MarleyWardrobe.create(room, name => { if (!paused) play(name); });
    function track() {
      if (disposed) return;
      const v = videos[active];
      wardrobe.frame(v?.dataset.clip || "wag", v?.duration ? v.currentTime/v.duration : 0, state, paused);
      raf = requestAnimationFrame(track);
    }
    raf = requestAnimationFrame(track);
    function rest() {
      resting = true;
      if (active >= 0) videos[active].pause();
      clearTimeout(restTimer);
      if (!paused) restTimer = setTimeout(() => {
        if (disposed || paused || state !== "wag") return;
        resting = false;
        videos[active].play().catch(() => { paused=true; onChange(state); });
      }, 8000);
    }
    videos[0].classList.add("is-active");

    function play(requested, resume = null) {
      if (disposed) return;
      const name = requested === "roam" ? "wag" : requested === "outfit" ? "smile" : requested;
      if (!LABELS[name]) return;
      clearTimeout(restTimer); resting = false;
      const clip = ({bone:"eat",ball:"run",skate:"run"})[name] || name;
      if (name === "smile" && state === "eat") { queuedSmile = true; return; }
      if (!resume && name !== "smile") queuedSmile = false;
      pendingCleanup?.(); pendingCleanup = null;
      const token = ++version;
      state = name;
      host.dataset.action = name;
      room.setAttribute("aria-label", LABELS[name]);
      if (!resume) onChange(name);
      const index = active === 0 ? 1 : 0;
      const next = videos[index];
      next.pause();
      next.loop = name === "sleep";
      next.playbackRate = name === "wag" ? 0.4 : name === "smile" ? 0.7 : 0.85;
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
          room.dataset.outfit = outfitPath().replace("/", "") || "plain";
          delete host.dataset.loading;
          delete host.dataset.playbackError;
          if (paused) next.pause();
          if (resume?.resting && name === "wag") {
            resting = true;
            if (!paused) rest();
          }
        };
        if (resume?.time && Number.isFinite(next.duration)) next.currentTime = Math.min(resume.time, Math.max(0, next.duration - .02));
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
        onChange(state);
      };
      next.addEventListener("loadeddata", ready);
      next.addEventListener("error", failed);
      pendingCleanup = () => {
        next.removeEventListener("loadeddata", ready);
        next.removeEventListener("error", failed);
      };
      next.dataset.action = name;
      next.dataset.clip = clip;
      host.dataset.loading = name;
      next.poster = BASE + outfitPath() + "poster.webp?v=" + CACHE;
      next.src = BASE + outfitPath() + clip + ".mp4?v=" + CACHE;
      next.load();
    }

    const ended = (event) => {
      if (disposed || event.target !== videos[active] || paused || host.dataset.loading) return;
      if (state === "wag") { videos[active].currentTime = 0; rest(); return; }
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
        if (paused) { clearTimeout(restTimer); videos.forEach(v => v.pause()); }
        else if (resting) rest();
        else if (active >= 0) videos[active].play().catch(() => { paused = true; onChange(state); });
        return paused;
      },
      setEquipment(value) {
        wardrobe.set(value);
        const wearingBee = value?.body === "bee";
        const wearingShoes = value?.feet === "shoes";
        if (wearingBee === bee && wearingShoes === shoes) return;
        bee = wearingBee;
        shoes = wearingShoes;
        // Costume is painted into every whole-character performance. Continue
        // the current action, including pauses and the quiet idle interval.
        if (active >= 0 || host.dataset.loading) {
          const current = videos[active];
          play(state, {time: current?.currentTime || 0, resting});
        }
      },
      getState() { return state; },
      isPaused() { return paused; },
      destroy() {
        disposed = true; version++; pendingCleanup?.(); clearTimeout(restTimer); cancelAnimationFrame(raf); wardrobe.destroy();
        videos.forEach(v => { v.pause(); v.removeEventListener("ended",ended); v.removeAttribute("src"); v.load(); });
        host.replaceChildren(); delete host.dataset.renderer; delete host.dataset.loading;
      }
    };
    return scene;
  }
  window.MarleyCartoonScene = {create,CACHE};
})();



