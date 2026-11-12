/* Lazy-load game modules on demand. Eager shell stays in index.html. */
(() => {
  "use strict";

  const pending = new Map();

  function loadCss(href) {
    const key = "css:" + href;
    if (pending.has(key)) return pending.get(key);
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(link => {
      const raw = link.getAttribute("href") || "";
      return raw === href || raw.split("?")[0] === href.split("?")[0];
    });
    if (existing) {
      pending.set(key, Promise.resolve());
      return pending.get(key);
    }
    const promise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error("CSS kunne ikke indlæses: " + href));
      document.head.appendChild(link);
    });
    pending.set(key, promise);
    return promise;
  }

  function loadScript(src) {
    const key = "js:" + src;
    if (pending.has(key)) return pending.get(key);
    const existing = Array.from(document.scripts).find(script => {
      const raw = script.getAttribute("src") || "";
      return raw === src || raw.split("?")[0] === src.split("?")[0];
    });
    if (existing) {
      pending.set(key, Promise.resolve());
      return pending.get(key);
    }
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Script kunne ikke indlæses: " + src));
      document.head.appendChild(script);
    });
    pending.set(key, promise);
    return promise;
  }

  async function loadAssets(assets) {
    const css = (assets.css || []).map(loadCss);
    // CSS can load in parallel with first script; scripts stay ordered.
    await Promise.all(css);
    for (const src of assets.js || []) await loadScript(src);
  }

  const MODULES = {
    equations: { css: ["equations.css?v=20261112-udregning1"], js: ["equations.js?v=20261112-udregning1"], ready: () => !!window.JacobEquations },
    clock: {
      css: ["clock.css?v=20261019-clock-tip-dashed1"],
      js: ["clock-core.js?v=20261019-clock-tip-dashed1", "clock-course.js?v=20261019-clock-tip-dashed1", "clock.js?v=20261019-clock-tip-dashed1"],
      ready: () => !!window.JacobClock && !!window.JacobClockCore && !!window.JacobClockCourse,
    },
    marley: {
      css: ["marley.css?v=20261008-bee2"],
      js: ["marley.js?v=20261009-shoes1"],
      ready: () => !!window.MarleyMath,
    },
    "marley-addition": {
      css: ["marley-addition.css?v=20261006-treats1"],
      js: ["marley-addition.js?v=20261006-treats1"],
      ready: () => !!window.MarleyAddition,
    },
    "plus-penalhus": {
      css: ["plus-penalhus.css?v=20261008-stationery1"],
      js: ["plus-penalhus.js?v=20261008-fem-v4"],
      ready: () => !!window.PlusPenalhus,
    },
    "ten-friends": {
      css: ["pizza-friends.css?v=20261006-friends-public1"],
      js: ["pizza-friends.js?v=20261006-friends-public1"],
      ready: () => !!window.LuigiTenFriends,
    },
    foodtruck: {
      css: ["foodtruck.css?v=20260920-game-banners1"],
      js: ["foodtruck.js?v=20260914-food1"],
      ready: () => !!window.LuigiFoodtruck,
    },
    "learn-fractions": {
      css: [
        "fraction-lesson.css?v=20260920-neutral-card1",
        "fraction-multiply.css?v=20260918-fraction6-times",
        "fraction-simplify.css?v=20260918-fraction4-simplify",
        "fraction-add-subtract.css?v=20260918-fraction5-plusminus",
        "fraction-obbe.css?v=20260923-obbe-rail-clean1",
      ],
      // Order matters: lesson base → finish → add/subtract wrapper → obbe wrapper
      js: [
        "fraction-lesson.js?v=20260920-fractions-public",
        "fraction-simplify.js?v=20260918-fraction4-simplify",
        "fraction-add-subtract.js?v=20260920-fractions-public",
        "fraction-obbe.js?v=20261007-lyd1",
      ],
      ready: () => !!window.JacobFractionLesson && !!window.JacobFractionFinish,
    },
    "obbe-coach": {
      css: [],
      js: ["obbe-coach.js?v=20261007-lyd1"],
      ready: () => !!window.ObbeCoach,
    },
    "fps-trial-entry": {
      css: [],
      js: ["fps-trial-entry.js?v=20260920-cinematic-world4"],
      ready: () => true,
    },
    skak: {
      css: ["skak.css?v=20261010-skak-figurer1"],
      // chess.js (BSD-2) → ren spillogik → UI
      js: ["skak-chess-lib.js?v=20261009-skak1", "skak-core.js?v=20261009-skak1", "skak.js?v=20261010-skak-figurer1"],
      ready: () => !!window.JacobSkak && !!window.SkakCore,
    },
    angles: {
      css: ["angles.css?v=20261105-angles2", "angle-games.css?v=20261105-angles2"],
      js: ["angles-core.js?v=20261105-angles2", "angles.js?v=20261108-i18n2"],
      ready: () => !!window.JacobAngles && !!window.JacobAnglesCore,
    },
    "angle-battleship": {
      css: ["angles.css?v=20261105-angles2", "angle-games.css?v=20261105-angles2"],
      js: ["angles-core.js?v=20261105-angles2", "angle-battleship.js?v=20261105-angles2"],
      ready: () => !!window.JacobAngleBattleship && !!window.JacobAnglesCore,
    },
    "angle-dennis": {
      css: ["angles.css?v=20261105-angles2", "angle-games.css?v=20261105-angles2"],
      js: ["angles-core.js?v=20261105-angles2", "angle-dennis.js?v=20261105-angles2"],
      ready: () => !!window.JacobAngleDennis && !!window.JacobAnglesCore,
    },
    "angle-ninja": {
      css: ["angles.css?v=20261105-angles2", "angle-games.css?v=20261105-angles2"],
      js: ["angles-core.js?v=20261105-angles2", "angle-ninja.js?v=20261108-i18n2"],
      ready: () => !!window.JacobAngleNinja && !!window.JacobAnglesCore,
    },
    "angle-words": {
      css: ["angles.css?v=20261105-angles2", "angle-games.css?v=20261105-angles2"],
      js: ["angles-core.js?v=20261105-angles2", "angle-words.js?v=20261105-angles2"],
      ready: () => !!window.JacobAngleWords && !!window.JacobAnglesCore,
    },
    "angle-stop": {
      css: ["angles.css?v=20261105-angles2", "angle-games.css?v=20261105-angles2"],
      js: ["angles-core.js?v=20261105-angles2", "angle-stop.js?v=20261112-degree-toggle2"],
      ready: () => !!window.JacobAngleStop && !!window.JacobAnglesCore,
    },
    "fraction-runner": {
      css: ["brok-loeb.css?v=20261105-runner1"],
      js: ["brok-loeb-core.js?v=20261105-runner1", "brok-loeb.js?v=20261108-i18n2"],
      ready: () => !!window.JacobBrokLoeb && !!window.JacobBrokLoebCore,
    },
    "dennis-audio": {
      css: [],
      js: ["dennis-audio.js?v=20261007-lyd1"],
      ready: () => true,
    },
  };

  const loadedModules = new Set();

  async function load(name) {
    if (loadedModules.has(name)) return;
    const assets = MODULES[name];
    if (!assets) throw new Error("Ukendt modul: " + name);
    if (assets.ready && assets.ready()) {
      loadedModules.add(name);
      return;
    }
    await loadAssets(assets);
    if (assets.ready && !assets.ready()) {
      throw new Error("Modulet indlæste ikke korrekt: " + name);
    }
    loadedModules.add(name);
  }

  window.JacobModules = Object.freeze({
    load,
    loadCss,
    loadScript,
    modules: MODULES,
  });
})();



