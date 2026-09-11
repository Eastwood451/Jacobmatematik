(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  if (params.get("trial") !== "1") return;

  const LIMIT_MS = 4 * 60 * 1000;
  const STORAGE_KEY = "jacobmatematik.fpsTrialUsedMs";
  const trackedAudioContexts = new Set();
  const nativeRaf = window.requestAnimationFrame.bind(window);
  let paused = false;
  let authenticated = false;
  let usedMs = 0;
  let lastTick = performance.now();
  let badge = null;
  let gate = null;

  try { usedMs = Math.max(0, Number(sessionStorage.getItem(STORAGE_KEY)) || 0); } catch {}

  // Keep the Three.js game loop alive, but do not advance it while the auth gate is open.
  window.requestAnimationFrame = callback => nativeRaf(function guardedFrame(timestamp) {
    if (paused) {
      nativeRaf(guardedFrame);
      return;
    }
    callback(timestamp);
  });

  // Track audio contexts created by the game so music and effects pause with the game.
  for (const key of ["AudioContext", "webkitAudioContext"]) {
    const NativeContext = window[key];
    if (typeof NativeContext !== "function") continue;
    try {
      const WrappedContext = function(...args) {
        const context = new NativeContext(...args);
        trackedAudioContexts.add(context);
        return context;
      };
      WrappedContext.prototype = NativeContext.prototype;
      Object.setPrototypeOf(WrappedContext, NativeContext);
      window[key] = WrappedContext;
    } catch {}
  }

  function injectStyle() {
    if (document.getElementById("fps-trial-style")) return;
    const style = document.createElement("style");
    style.id = "fps-trial-style";
    style.textContent = `
      #fps-trial-badge{position:fixed;z-index:45;left:50%;top:12px;transform:translateX(-50%) rotate(-.5deg);padding:7px 11px;border:2px solid #111820;border-radius:9px;background:#f0c65d;color:#111820;box-shadow:3px 3px 0 #111820;font:900 10px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;pointer-events:none}
      #fps-trial-auth{position:fixed;z-index:120;inset:0;display:none;align-items:center;justify-content:center;padding:18px;background:#091018e8;backdrop-filter:blur(8px)}
      #fps-trial-auth.open{display:flex}
      .fps-trial-card{position:relative;width:min(520px,100%);max-height:calc(100dvh - 36px);overflow:auto;padding:26px;border:5px solid #101317;border-radius:18px;background:#eadfc4;color:#111820;box-shadow:10px 10px 0 #101317;font-family:Inter,system-ui,sans-serif}
      .fps-trial-card::before{content:"4 MINUTTER";position:absolute;right:17px;top:16px;padding:5px 7px;border:2px solid #111820;border-radius:6px;background:#c94b35;color:#fff6dd;font-size:9px;font-weight:900;letter-spacing:.08em;transform:rotate(3deg)}
      .fps-trial-card h2{max-width:380px;margin:4px 0 8px;font:900 clamp(30px,7vw,48px)/.95 'Archivo Black',Inter,system-ui,sans-serif;letter-spacing:-.04em}
      .fps-trial-card>p{margin:0 0 18px;font-weight:750;line-height:1.45}
      .fps-trial-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}
      .fps-trial-tabs button,.fps-trial-submit{border:3px solid #111820;border-radius:9px;box-shadow:3px 3px 0 #111820;padding:10px;background:#fff7df;color:#111820;font-weight:900;cursor:pointer}
      .fps-trial-tabs button.active{background:#f0c65d}
      .fps-trial-form{display:grid;gap:9px}
      .fps-trial-form label{font-size:11px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
      .fps-trial-form input{width:100%;border:3px solid #111820;border-radius:8px;padding:11px 12px;background:#fffdf5;color:#111820;font:800 16px/1.2 Inter,system-ui,sans-serif}
      .fps-trial-submit{margin-top:6px;background:#c94b35;color:#fff6dd;font-size:16px}
      .fps-trial-submit:disabled{opacity:.55;cursor:wait}
      #fps-trial-error{min-height:18px;margin:3px 0;color:#a62e28;font-size:12px;font-weight:900}
      .fps-trial-small{display:block;margin-top:5px;font-size:10px;font-weight:700;opacity:.65}
      .fps-trial-back{display:block;margin-top:15px;color:#111820;text-align:center;font-size:11px;font-weight:900}
      .fps-trial-mode #online-button{display:none!important}
      .fps-trial-mode .touch-device #fps-trial-badge{top:54px}
      @media(max-width:600px){#fps-trial-badge{top:7px;font-size:8px;padding:5px 7px}.fps-trial-card{padding:21px 18px}.fps-trial-card::before{right:10px;top:10px}.fps-trial-card h2{font-size:31px}}
    `;
    document.head.appendChild(style);
  }

  function formatRemaining() {
    const remaining = Math.max(0, LIMIT_MS - usedMs);
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function updateBadge() {
    if (!badge) return;
    badge.textContent = `PRØVESPIL · ${formatRemaining()}`;
  }

  function gameIsActivelyRunning() {
    if (paused || authenticated || document.hidden) return false;
    const start = document.getElementById("start-overlay");
    const gameOver = document.getElementById("game-over");
    const touchPause = document.getElementById("touch-pause-overlay");
    const rotate = document.getElementById("rotate-device");
    if (!start || start.classList.contains("open")) return false;
    if (gameOver?.classList.contains("open")) return false;
    if (touchPause && !touchPause.hidden) return false;
    if (rotate && !rotate.hidden) return false;
    return true;
  }

  async function setPaused(next) {
    paused = Boolean(next);
    if (paused) {
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch {}
      window.dispatchEvent(new Event("blur"));
      for (const context of trackedAudioContexts) {
        try { await context.suspend(); } catch {}
      }
    } else {
      for (const context of trackedAudioContexts) {
        try { await context.resume(); } catch {}
      }
    }
  }

  function setMode(mode) {
    const signup = mode === "signup";
    gate.dataset.mode = mode;
    gate.querySelectorAll("[data-trial-tab]").forEach(button => button.classList.toggle("active", button.dataset.trialTab === mode));
    gate.querySelector("#fps-trial-title").textContent = signup ? "Opret en bruger og fortsæt" : "Log ind og fortsæt";
    gate.querySelector("#fps-trial-copy").textContent = signup
      ? "Vælg brugernavn og adgangskode. Dine fremskridt på Jacob Matematik kan derefter gemmes."
      : "Prøvetiden er slut. Log ind, så åbner skolen igen med det samme.";
    const password = gate.querySelector("#fps-trial-password");
    password.minLength = signup ? 6 : 0;
    password.autocomplete = signup ? "new-password" : "current-password";
    gate.querySelector("#fps-trial-submit").textContent = signup ? "OPRET BRUGER OG FORTSÆT" : "LOG IND OG FORTSÆT";
    gate.querySelector("#fps-trial-error").textContent = "";
  }

  function buildGate() {
    gate = document.createElement("section");
    gate.id = "fps-trial-auth";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "fps-trial-title");
    gate.innerHTML = `
      <div class="fps-trial-card">
        <span class="eyebrow">ERLING FPS · PRØVESPIL</span>
        <h2 id="fps-trial-title">Log ind og fortsæt</h2>
        <p id="fps-trial-copy">Prøvetiden er slut. Log ind, så åbner skolen igen med det samme.</p>
        <div class="fps-trial-tabs" role="tablist" aria-label="Vælg login eller opret bruger">
          <button type="button" class="active" data-trial-tab="login">LOG IND</button>
          <button type="button" data-trial-tab="signup">OPRET BRUGER</button>
        </div>
        <form id="fps-trial-form" class="fps-trial-form">
          <label for="fps-trial-username">Brugernavn</label>
          <input id="fps-trial-username" name="username" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" required>
          <label for="fps-trial-password">Adgangskode</label>
          <input id="fps-trial-password" name="password" type="password" autocomplete="current-password" required>
          <small class="fps-trial-small">Ved oprettelse skal adgangskoden være mindst 6 tegn.</small>
          <p id="fps-trial-error" role="alert"></p>
          <button id="fps-trial-submit" class="fps-trial-submit" type="submit">LOG IND OG FORTSÆT</button>
        </form>
        <a class="fps-trial-back" href="index.html">← Tilbage til Jacob Matematik</a>
      </div>`;
    document.body.appendChild(gate);

    gate.querySelectorAll("[data-trial-tab]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.trialTab)));
    gate.querySelector("#fps-trial-form").addEventListener("submit", handleAuth);
    setMode("login");
  }

  async function handleAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = gate.querySelector("#fps-trial-submit");
    const error = gate.querySelector("#fps-trial-error");
    const username = form.username.value.trim();
    const password = form.password.value;
    const signup = gate.dataset.mode === "signup";
    error.textContent = "";
    if (!window.JacobBackend?.configured) {
      error.textContent = "Login er ikke tilgængeligt lige nu. Prøv igen om lidt.";
      return;
    }
    submit.disabled = true;
    try {
      if (signup) {
        await window.JacobBackend.signUp(username, password);
        await window.JacobBackend.loadDatabase();
      } else {
        await window.JacobBackend.signIn(username, password);
      }
      authenticated = true;
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete("trial");
      history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      gate.classList.remove("open");
      badge?.remove();
      document.documentElement.classList.remove("fps-trial-mode");
      await setPaused(false);
    } catch (authError) {
      const message = String(authError?.message || "");
      if (!signup && /invalid login credentials/i.test(message)) error.textContent = "Forkert brugernavn eller adgangskode.";
      else error.textContent = message || "Det lykkedes ikke. Prøv igen.";
    } finally {
      submit.disabled = false;
    }
  }

  async function expireTrial() {
    if (paused || authenticated) return;
    usedMs = LIMIT_MS;
    try { sessionStorage.setItem(STORAGE_KEY, String(usedMs)); } catch {}
    updateBadge();
    await setPaused(true);
    gate.classList.add("open");
    setMode("login");
    setTimeout(() => gate.querySelector("#fps-trial-username")?.focus(), 50);
  }

  function tick() {
    const now = performance.now();
    const delta = Math.min(1000, Math.max(0, now - lastTick));
    lastTick = now;
    if (gameIsActivelyRunning()) {
      usedMs = Math.min(LIMIT_MS, usedMs + delta);
      try { sessionStorage.setItem(STORAGE_KEY, String(Math.round(usedMs))); } catch {}
      updateBadge();
      if (usedMs >= LIMIT_MS) void expireTrial();
    }
  }

  function init() {
    injectStyle();
    document.documentElement.classList.add("fps-trial-mode");
    badge = document.createElement("div");
    badge.id = "fps-trial-badge";
    badge.setAttribute("aria-live", "polite");
    document.body.appendChild(badge);
    buildGate();
    document.getElementById("online-button")?.setAttribute("hidden", "");
    updateBadge();
    if (usedMs >= LIMIT_MS) void expireTrial();
    setInterval(tick, 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
