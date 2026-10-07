/* Marley premium clip player: WebM (+ MP4) → marley.webp still. No sprites, no gif, no Three.js. */
(() => {
  "use strict";

  const CACHE = "20261007-clips1";
  const STILL_SRC = "assets/figurer/marley-canon.png?v=" + CACHE;
  const VIDEO_DIR = "assets/figurer/marley-premium/";
  const LABELS = {
    wag: "Marley logrer",
    smile: "Marley smiler",
    run: "Marley løber i cirkler",
    eat: "Marley spiser en godbid",
    bed: "Marley lægger sig i kurven",
    sleep: "Marley hviler i kurven"
  };
  const ACTIONS = Object.keys(LABELS);

  function prefersReducedMotion() {
    try {
      return matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function probe(url) {
    return fetch(url, { method: "HEAD", cache: "no-cache" })
      .then((r) => r.ok)
      .catch(() => false);
  }

  function clearHost(host) {
    host.replaceChildren();
    delete host.dataset.renderer;
    delete host.dataset.action;
    delete host.dataset.placeholder;
  }

  function createStill(host, onChange) {
    clearHost(host);
    host.dataset.renderer = "still";
    host.dataset.placeholder = "1";
    const wrap = document.createElement("div");
    wrap.className = "marley-still-wrap";
    const img = document.createElement("img");
    img.className = "marley-still";
    img.src = STILL_SRC;
    img.alt = "Marley";
    img.decoding = "async";
    img.setAttribute("role", "img");
    const badge = document.createElement("span");
    badge.className = "marley-placeholder-badge";
    badge.textContent = "Placeholder · still (premium clips snart)";
    wrap.append(img, badge);
    host.append(wrap);

    let state = "wag";
    let paused = false;
    let disposed = false;

    function play(name) {
      if (disposed || !LABELS[name]) return;
      state = name;
      paused = false;
      host.dataset.action = name;
      img.setAttribute("aria-label", LABELS[name]);
      wrap.classList.toggle("is-sleep", name === "sleep" || name === "bed");
      wrap.classList.toggle("is-smile", name === "smile");
      wrap.classList.toggle("is-run", name === "run");
      wrap.classList.toggle("is-eat", name === "eat");
      wrap.classList.remove("is-paused");
      onChange(name);
    }

    play("wag");
    return {
      play,
      setEquipment() {},
      getState() { return state; },
      pause(force) {
        if (disposed) return paused;
        paused = typeof force === "boolean" ? !!force : !paused;
        wrap.classList.toggle("is-paused", paused);
        return paused;
      },
      destroy() {
        disposed = true;
        clearHost(host);
      }
    };
  }

  function createVideo(host, onChange, sourcesByAction) {
    clearHost(host);
    host.dataset.renderer = "video";
    delete host.dataset.placeholder;
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-label", LABELS.wag);
    video.className = "marley-video";
    const still = document.createElement("img");
    still.className = "marley-still marley-clip-fallback";
    still.src = STILL_SRC;
    still.alt = "Marley";
    still.hidden = true;
    still.decoding = "async";
    host.append(video, still);

    let state = "wag";
    let paused = false;
    let disposed = false;
    let usingStill = false;

    function resume() {
      if (usingStill) return;
      const p = video.play();
      if (p) p.catch(() => {});
    }

    function showStill(name) {
      usingStill = true;
      video.pause();
      video.hidden = true;
      still.hidden = false;
      still.setAttribute("aria-label", LABELS[name]);
      host.dataset.placeholder = "1";
    }

    function showVideo(name, src) {
      usingStill = false;
      still.hidden = true;
      video.hidden = false;
      delete host.dataset.placeholder;
      video.setAttribute("aria-label", LABELS[name]);
      video.loop = name === "wag" || name === "sleep";
      if (video.getAttribute("src") !== src) video.src = src;
      else video.currentTime = 0;
      resume();
    }

    function play(name) {
      if (disposed || !LABELS[name]) return;
      state = name;
      paused = false;
      host.dataset.action = name;
      if (sourcesByAction[name]) showVideo(name, sourcesByAction[name]);
      else showStill(name);
      onChange(name);
    }

    function ended() {
      if (disposed || paused || usingStill) return;
      play(state === "bed" ? "sleep" : "wag");
    }

    video.addEventListener("ended", ended);
    play("wag");

    return {
      play,
      setEquipment() {},
      getState() { return state; },
      pause(force) {
        if (disposed) return paused;
        paused = typeof force === "boolean" ? !!force : !paused;
        if (usingStill) {
          still.classList.toggle("is-paused-still", paused);
        } else if (paused) {
          video.pause();
        } else {
          resume();
        }
        return paused;
      },
      destroy() {
        disposed = true;
        video.pause();
        video.removeEventListener("ended", ended);
        video.removeAttribute("src");
        video.load();
        clearHost(host);
      }
    };
  }

  async function resolveVideoSources() {
    const out = {};
    for (const name of ACTIONS) {
      const webm = VIDEO_DIR + name + ".webm?v=" + CACHE;
      const mp4 = VIDEO_DIR + name + ".mp4?v=" + CACHE;
      if (await probe(webm)) out[name] = webm;
      else if (await probe(mp4)) out[name] = mp4;
    }
    if (!out.wag) throw new Error("wag clip mangler");
    return out;
  }

  /**
   * Primary: premium WebM/MP4 under marley-premium/.
   * Fallback: calm marley.webp still (never sprites/gif).
   * prefers-reduced-motion → still.
   * @returns {Promise<{play,pause,setEquipment,getState,destroy}>}
   */
  async function create(host, onChange = () => {}) {
    if (!host) throw new Error("MarleyPremiumScene kræver en host");
    if (prefersReducedMotion()) return createStill(host, onChange);
    try {
      const sources = await resolveVideoSources();
      return createVideo(host, onChange, sources);
    } catch (err) {
      console.info("Marley premium clips ikke klar, bruger still:", err?.message || err);
      return createStill(host, onChange);
    }
  }

  window.MarleyPremiumScene = { create, ACTIONS, VIDEO_DIR };
  // Alias for earlier Rive-plan API name used in briefs
  window.MarleyRiveScene = window.MarleyPremiumScene;
})();
