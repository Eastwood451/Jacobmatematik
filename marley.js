(() => {
  "use strict";
  const KEY = "jacobmatematik-marley-jacob-v1";
  const CACHE = "20261008-bee2";
  const items = [
    { id: "bee", name: "Humlebikostume", price: 20, icon: "🐝", slot: "body" },
    { id: "hat", name: "Festhat", price: 8, icon: "🎉", slot: "head" },
    { id: "cap", name: "Kasket", price: 12, icon: "🧢", slot: "head" },
    { id: "glasses", name: "Solbriller", price: 10, icon: "🕶️", slot: "eyes" },
    { id: "shoes", name: "Sko", price: 15, icon: "👟", slot: "feet" },
    { id: "skate", name: "Skateboard", price: 25, icon: "🛹", slot: "board" },
    { id: "ball", name: "Bold", price: 6, icon: "🎾", slot: "toy" },
    { id: "bone", name: "Kødben", price: 5, icon: "🦴", slot: "toy" },
    { id: "treat", name: "Godbid", price: 3, icon: "🍪", slot: "treat" }
  ];
  const blank = () => ({ coins: 0, owned: [], equipped: {}, correct: 0 });
  const random = (n) => Math.floor(Math.random() * n);
  const messages = {
    wag: "Marley logrer glad!",
    smile: "Se Marleys store smil!",
    eat: "Mums! Marley spiser godbidden. 💛",
    run: "Marley løber en glad runde!",
    bed: "Marley lægger sig i sin kurv. Tryk på Logre, når han skal op igen.",
    bone: "Marley holder kødbenet i munden og gumler!",
    ball: "Tril, tril! Marley løber efter bolden!",
    skate: "Se Marley køre på sit skateboard!",
    sleep: "Marley sover i sin kurv. Tryk på Logre for at kalde ham op."
  };

  function loadScript(src, ready) {
    return new Promise((resolve, reject) => {
      if (ready()) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Kunne ikke hente " + src));
      document.head.append(script);
    });
  }

  function mount(root, { onExit, storageKey = KEY, initialCoins = 0 }) {
    let data;
    const start = () => ({ ...blank(), coins: initialCoins });
    try {
      data = { ...start(), ...JSON.parse(localStorage.getItem(storageKey)) };
      if (!data.equipped || typeof data.equipped !== "object") data.equipped = {};
      if (!Array.isArray(data.owned) || !Number.isSafeInteger(data.coins) || data.coins < 0) throw Error();
    } catch {
      data = start();
    }

    let task;
    let feedback = "Regn et stykke og tjen en mønt til Marley!";
    let action = "wag";
    let paused = false;
    let scene = null;
    let disposed = false;
    let focusAnswer = true;

    const save = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        feedback = "Denne browser kunne ikke gemme dit spil.";
      }
    };

    root.innerHTML = `<div class="marley-page"><header class="marley-top"><button type="button" data-marley="exit">← Tilbage</button><h1>Matematikhunden Marley</h1><strong class="marley-coins" aria-label="Mønter"></strong></header>
    <main class="marley-grid"><section class="marley-play" aria-label="Regn og tjen mønter"><div class="marley-dog" data-action="wag"><div class="marley-scene" data-action="wag"><p class="marley-loading" role="status">Marley vågner …</p></div><div class="marley-accessories" aria-hidden="true"></div></div>
    <div class="marley-actions" role="group" aria-label="Leg med Marley"><button type="button" data-marley="action" data-action="wag" disabled>🐕 Logre</button><button type="button" data-marley="action" data-action="smile" disabled>😊 Smil</button><button type="button" data-marley="action" data-action="run" disabled>🐾 Løb i cirkler</button><button type="button" data-marley="action" data-action="bed" disabled>🧺 I kurven</button><button type="button" data-marley="pause" disabled>⏸ Pause</button></div>
    <p class="marley-speech" aria-live="polite"></p><form id="marley-answer"><label for="marley-input"></label><div class="marley-answer-row"><input id="marley-input" type="number" inputmode="numeric" min="0" max="18" required autocomplete="off" aria-label="Dit svar"><button type="submit">Svar</button></div></form><p class="marley-progress"></p></section>
    <section class="marley-shop" aria-label="Butik"><h2>Marleys butik</h2><p>Klæd Marley på, og leg med ham! Tryk på købt legetøj for at lege igen. Du kan give en ny godbid, når han har spist færdig.</p><div class="marley-items"></div></section></main></div>`;

    const q = (sel) => root.querySelector(sel);
    const host = q(".marley-scene");

    function update() {
      if (disposed) return;
      scene?.setEquipment?.(data.equipped);
      q(".marley-coins").textContent = "🪙 " + data.coins;
      q(".marley-speech").textContent = feedback;
      q(".marley-progress").textContent = data.correct + " rigtige svar i alt · 1 mønt pr. rigtigt svar";
      q(".marley-play label").textContent = "Hvad er " + task.a + " " + task.sign + " " + task.b + "?";
      const lock = !scene || paused;
      root.querySelectorAll('[data-marley="action"]').forEach((b) => {
        b.disabled = lock;
        b.setAttribute("aria-pressed", String(b.dataset.action === action));
      });
      const pauseBtn = q('[data-marley="pause"]');
      pauseBtn.disabled = !scene;
      pauseBtn.textContent = paused ? "▶ Fortsæt" : "⏸ Pause";
      q(".marley-items").innerHTML = items
        .map((item) => {
          const treat = item.id === "treat";
          const owned = !treat && data.owned.includes(item.id);
          const worn = data.equipped[item.slot] === item.id;
          const disabled =
            (!owned && data.coins < item.price) ||
            (treat && (["eat","bone"].includes(action) || paused || !scene));
          return `<button type="button" data-marley="buy" data-item="${item.id}" ${disabled ? "disabled" : ""} aria-label="${item.name}"><span class="marley-item-icon">${item.icon}</span><strong>${item.name}</strong><small>${treat ? "Giv nu · 🪙 " + item.price : owned ? (["toy","board"].includes(item.slot) ? "Leg igen" : worn ? "Tag af ✓" : "Tag på") : "🪙 " + item.price}</small></button>`;
        })
        .join("");
      if (focusAnswer) {
        q("#marley-input")?.focus({ preventScroll: true });
        focusAnswer = false;
      }
    }

    function next() {
      const minus = random(2) === 0;
      const a = random(10);
      const b = random(10);
      task = minus
        ? { a: Math.max(a, b), b: Math.min(a, b), sign: "−", answer: Math.abs(a - b) }
        : { a, b, sign: "+", answer: a + b };
      const input = q("#marley-input");
      if (input) input.value = "";
      focusAnswer = true;
    }

    function play(name) {
      if (!scene || disposed) return;
      action = name;
      paused = false;
      if (messages[name]) feedback = messages[name];
      scene.pause(false);
      scene.play(name);
      action = scene.getState();
      host.dataset.action = action;
      const dog = q(".marley-dog");
      if (dog) dog.dataset.action = name;
      update();
    }

    next();
    update();

    loadScript("marley-wardrobe.js?v=" + CACHE, () => window.MarleyWardrobe)
      .then(() => loadScript("marley-cartoon.js?v=" + CACHE, () => window.MarleyCartoonScene))
      .then(() => {
        const Scene = window.MarleyCartoonScene;
        if (disposed || !Scene) throw new Error("MarleyCartoonScene mangler");
        return Scene.create(host, (name) => {
          action = name;
          if (scene) paused = scene.isPaused();
          host.dataset.action = name;
          const dog = q(".marley-dog");
          if (dog) dog.dataset.action = name;
          if (name === "sleep") feedback = messages.sleep;
          update();
        });
      })
      .then((created) => {
        if (disposed) {
          created.destroy();
          return;
        }
        scene = created;
        q(".marley-loading")?.remove();
        scene.setEquipment?.(data.equipped);
        scene.play("roam");
        action = "wag";
        update();
      })
      .catch((err) => {
        if (disposed) return;
        const loading = q(".marley-loading");
        if (loading) loading.textContent = "Animationen kunne ikke starte. Prøv at genindlæse siden.";
        console.error("Marley:", err);
      });

    function submit(event) {
      if (event.target.id !== "marley-answer") return;
      event.preventDefault();
      const raw = q("#marley-input").value.trim();
      if (!/^\d+$/.test(raw)) return;
      if (Number(raw) === task.answer) {
        data.coins++;
        data.correct++;
        feedback = "Rigtigt! Marley fik en mønt. 🪙";
        save();
        next();
        play("smile");
        q("#marley-input")?.focus({ preventScroll: true });
      } else {
        feedback = "Prøv igen: " + task.a + " " + task.sign + " " + task.b + " = " + task.answer + ".";
        next();
        update();
      }
    }

    function click(event) {
      const button = event.target.closest("[data-marley]");
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.dataset.marley === "exit") {
        onExit();
        return;
      }
      if (button.dataset.marley === "pause") {
        if (!scene) return;
        if (!paused) {
          paused = true;
          scene.pause(true);
        } else {
          paused = false;
          scene.pause(false);
        }
        update();
        return;
      }
      if (button.dataset.marley === "action") {
        const chosen = button.dataset.action;
        if (chosen === "wag") play("wag");
        if (chosen === "smile") play("smile");
        if (chosen === "run") play("run");
        if (chosen === "bed") play("bed");
        return;
      }
      const item = items.find((x) => x.id === button.dataset.item);
      if (!item) return;
      if (item.id === "treat") {
        if (!scene || ["eat","bone"].includes(action) || paused || data.coins < item.price) return;
        data.coins -= item.price;
        feedback = messages.eat;
        save();
        play("eat");
        return;
      }
      if (!data.owned.includes(item.id)) {
        if (data.coins < item.price) return;
        data.coins -= item.price;
        data.owned.push(item.id);
        feedback = item.name + " er købt til Marley!";
      } else {
        feedback =
          data.equipped[item.slot] === item.id
            ? item.name + " er taget af."
            : "Marley har " + item.name.toLowerCase() + " på!";
      }
      const interactive = ["toy","board"].includes(item.slot);
      const wasOn = !interactive && data.equipped[item.slot] === item.id;
      data.equipped[item.slot] = wasOn ? null : item.id;
      save();
      scene?.setEquipment?.(data.equipped);
      if (interactive) { play(item.id); return; }
      // Show the newly fitted outfit.
      if (!paused && !wasOn && (item.id === "glasses" || item.id === "hat" || item.id === "cap" || item.id === "bee")) {
        if (item.id === "glasses") feedback = "Se! Marley har solbriller på! 😎";
        play("outfit");
        return;
      }
      update();
    }

    root.addEventListener("submit", submit);
    root.addEventListener("click", click);
    return () => {
      disposed = true;
      scene?.destroy();
      scene = null;
      root.removeEventListener("submit", submit);
      root.removeEventListener("click", click);
    };
  }

  window.MarleyMath = { mount };
})();


