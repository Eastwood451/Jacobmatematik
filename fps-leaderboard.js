(() => {
  "use strict";

  const AWARDS = [
    { name:"Kaptajn Kvadratrod-prisen", image:"assets/figurer/kaptajn-kvadratrod.webp", className:"captain" },
    { name:"Øbbe Øvdig-prisen", image:"assets/figurer/obbe-ovdig.png", className:"obbe" },
    { name:"Luigi Lækkermat-prisen", image:"assets/figurer/luigi-laekkermat-cutout.webp", className:"luigi" },
    { name:"Divisions-Dennis-prisen", image:"assets/figurer/divisions-dennis.webp", className:"dennis" },
    { name:"Trøstepræmien", emoji:"🏅", className:"comfort" },
  ];

  let client = null;
  let authenticated = false;
  let persistedBest = 0;
  let currentScore = 0;
  let leaderboard = [];
  let submitTimer = null;
  let submitting = false;
  let queuedScore = 0;
  let panelOpen = false;
  let initialized = false;

  const soloScoreEligible = () => document.getElementById("online-hud")?.hidden !== false;

  function injectStyle() {
    if (document.getElementById("fps-leaderboard-style")) return;
    const style = document.createElement("style");
    style.id = "fps-leaderboard-style";
    style.textContent = `
      #fps-highscore-pill strong{color:#946000}
      #fps-highscore-pill.is-record strong{color:#197642}
      #fps-leaderboard-toggle{pointer-events:auto;border:3px solid #101317;border-radius:12px;background:#f0c65d;color:#121820;box-shadow:5px 5px 0 #101317;padding:8px 11px;font:900 12px/1 Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
      #fps-leaderboard-toggle:hover{transform:translate(2px,2px);box-shadow:3px 3px 0 #101317}
      #fps-leaderboard{position:fixed;z-index:42;right:18px;top:86px;width:min(430px,calc(100vw - 36px));max-height:calc(100dvh - 108px);overflow:auto;padding:16px;border:4px solid #101317;border-radius:16px;background:#eee2c5;color:#121820;box-shadow:8px 8px 0 #101317;font-family:Inter,system-ui,sans-serif}
      #fps-leaderboard[hidden]{display:none!important}
      .fps-leaderboard-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .fps-leaderboard-head h2{margin:2px 0 0;font:900 27px/.95 'Archivo Black',Inter,system-ui,sans-serif;letter-spacing:-.04em}
      .fps-leaderboard-head button{border:2px solid #101317;border-radius:8px;background:#fff8e5;color:#101317;padding:5px 8px;font-weight:900;cursor:pointer}
      .fps-leaderboard-self{display:flex;justify-content:space-between;gap:10px;margin:0 0 12px;padding:9px 11px;border:2px solid #101317;border-radius:10px;background:#fff7df;font-size:12px;font-weight:900}
      .fps-leaderboard-self strong{font-size:18px}
      .fps-leaderboard-list{display:grid;gap:8px}
      .fps-leaderboard-row{display:grid;grid-template-columns:34px 42px minmax(0,1fr) auto;align-items:center;gap:8px;min-height:58px;padding:6px 8px;border:2px solid #101317;border-radius:10px;background:#fffaf0;box-shadow:2px 2px 0 #101317}
      .fps-leaderboard-row.is-me{background:#d9efdf;outline:3px solid #2b7e61;outline-offset:-3px}
      .fps-leaderboard-rank{font:900 19px/1 'Archivo Black',Inter,sans-serif;text-align:center}
      .fps-award-icon{width:42px;height:46px;display:grid;place-items:center;overflow:hidden;border-radius:8px;background:#e6d6b2;font-size:26px}
      .fps-award-icon img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 1px #0003)}
      .fps-leaderboard-name{min-width:0}
      .fps-leaderboard-name strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
      .fps-leaderboard-name small{display:block;margin-top:3px;color:#5d594e;font-size:9px;font-weight:900;line-height:1.2}
      .fps-leaderboard-score{font:900 23px/1 'Archivo Black',Inter,sans-serif}
      .fps-leaderboard-empty{margin:8px 0;padding:16px;border:2px dashed #857d6d;border-radius:10px;text-align:center;font-size:12px;font-weight:800;line-height:1.45}
      .fps-leaderboard-lock{margin:8px 0 0;color:#6c6558;font-size:11px;font-weight:800;line-height:1.45}
      .touch-device #fps-highscore-pill{padding-inline:7px}
      .touch-device #fps-highscore-pill span{font-size:7px}
      .touch-device #fps-highscore-pill strong{font-size:12px}
      .touch-device #fps-leaderboard-toggle{border-width:2px;border-radius:9px;box-shadow:2px 2px 0 #101317;padding:6px 7px;font-size:0}
      .touch-device #fps-leaderboard-toggle::after{content:"🏆";font-size:18px}
      .touch-device #fps-leaderboard{right:8px;top:54px;width:min(390px,calc(100vw - 16px));max-height:calc(100dvh - 64px);padding:10px}
      @media(max-width:760px){#fps-highscore-pill span{display:none}#fps-highscore-pill strong::before{content:"REKORD ";font:900 7px/1 Inter,sans-serif;opacity:.62}#fps-leaderboard-toggle{padding-inline:8px}.fps-leaderboard-row{grid-template-columns:29px 36px minmax(0,1fr) auto}.fps-award-icon{width:36px;height:40px}.fps-leaderboard-score{font-size:19px}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    if (initialized) return;
    const hud = document.querySelector(".hud-top");
    if (!hud) return;
    injectStyle();

    const highscore = document.createElement("div");
    highscore.id = "fps-highscore-pill";
    highscore.className = "hud-pill";
    highscore.innerHTML = '<span>Highscore</span><strong id="fps-highscore-value">—</strong>';
    hud.appendChild(highscore);

    const toggle = document.createElement("button");
    toggle.id = "fps-leaderboard-toggle";
    toggle.type = "button";
    toggle.textContent = "🏆 TOP 5";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "fps-leaderboard");
    hud.appendChild(toggle);

    const panel = document.createElement("aside");
    panel.id = "fps-leaderboard";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Erling FPS leaderboard");
    panel.innerHTML = `
      <div class="fps-leaderboard-head">
        <div><span class="eyebrow">ERLING FPS</span><h2>TOP 5</h2></div>
        <button type="button" id="fps-leaderboard-close" aria-label="Luk leaderboard">✕</button>
      </div>
      <div class="fps-leaderboard-self"><span>DIN HIGHSCORE</span><strong id="fps-leaderboard-self-score">—</strong></div>
      <div id="fps-leaderboard-list" class="fps-leaderboard-list"></div>
      <p id="fps-leaderboard-lock" class="fps-leaderboard-lock"></p>`;
    document.body.appendChild(panel);

    toggle.addEventListener("click", () => setPanelOpen(!panelOpen));
    panel.querySelector("#fps-leaderboard-close").addEventListener("click", () => setPanelOpen(false));
    document.addEventListener("keydown", event => { if (event.key === "Escape" && panelOpen) setPanelOpen(false); });
    initialized = true;
    render();
  }

  function setPanelOpen(open) {
    ensureUI();
    const panel = document.getElementById("fps-leaderboard");
    const toggle = document.getElementById("fps-leaderboard-toggle");
    if (!panel || !toggle) return;
    panelOpen = Boolean(open);
    panel.hidden = !panelOpen;
    toggle.setAttribute("aria-expanded", String(panelOpen));
    if (panelOpen) void refresh();
  }

  function render() {
    ensureUI();
    const value = document.getElementById("fps-highscore-value");
    const pill = document.getElementById("fps-highscore-pill");
    const self = document.getElementById("fps-leaderboard-self-score");
    const list = document.getElementById("fps-leaderboard-list");
    const lock = document.getElementById("fps-leaderboard-lock");
    if (!value || !pill || !self || !list || !lock) return;

    const eligibleCurrent = soloScoreEligible() ? currentScore : 0;
    const visibleBest = authenticated ? Math.max(persistedBest, eligibleCurrent) : 0;
    value.textContent = authenticated ? String(visibleBest) : "—";
    self.textContent = authenticated ? String(visibleBest) : "—";
    pill.classList.toggle("is-record", authenticated && eligibleCurrent > persistedBest);
    list.replaceChildren();

    if (!authenticated) {
      const empty = document.createElement("div");
      empty.className = "fps-leaderboard-empty";
      empty.textContent = "Log ind eller opret en bruger for at få en highscore og se TOP 5.";
      list.appendChild(empty);
      lock.textContent = "Prøvespil gemmes ikke på leaderboardet.";
      return;
    }

    lock.textContent = "Kun solo-spil tæller. Ved pointlighed vinder den, der nåede scoren først.";
    if (!leaderboard.length) {
      const empty = document.createElement("div");
      empty.className = "fps-leaderboard-empty";
      empty.textContent = "Leaderboardet er tomt. Første rekord får Kaptajn Kvadratrod-prisen.";
      list.appendChild(empty);
      return;
    }

    leaderboard.slice(0,5).forEach((entry, index) => {
      const award = AWARDS[index];
      const row = document.createElement("div");
      row.className = `fps-leaderboard-row ${entry.is_me ? "is-me" : ""}`.trim();

      const rank = document.createElement("span");
      rank.className = "fps-leaderboard-rank";
      rank.textContent = `${index + 1}.`;

      const icon = document.createElement("span");
      icon.className = `fps-award-icon ${award.className}`;
      if (award.image) {
        const image = document.createElement("img");
        image.src = award.image;
        image.alt = "";
        image.decoding = "async";
        icon.appendChild(image);
      } else icon.textContent = award.emoji;

      const name = document.createElement("span");
      name.className = "fps-leaderboard-name";
      const username = document.createElement("strong");
      username.textContent = String(entry.username || "Ukendt");
      const prize = document.createElement("small");
      prize.textContent = award.name;
      name.append(username, prize);

      const score = document.createElement("span");
      score.className = "fps-leaderboard-score";
      score.textContent = String(Number(entry.best_score) || 0);

      row.append(rank, icon, name, score);
      list.appendChild(row);
    });
  }

  async function resolveClient() {
    client = window.JacobBackend?.realtimeClient || client;
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user) {
        authenticated = false;
        return client;
      }
      authenticated = true;
      return client;
    } catch {
      authenticated = false;
      return client;
    }
  }

  async function refresh() {
    ensureUI();
    const activeClient = await resolveClient();
    if (!activeClient || !authenticated) {
      persistedBest = 0;
      leaderboard = [];
      render();
      return { highscore:0, leaderboard:[] };
    }
    try {
      const [mine, leaders] = await Promise.all([
        activeClient.rpc("get_my_fps_highscore"),
        activeClient.rpc("get_fps_leaderboard"),
      ]);
      if (mine.error) throw mine.error;
      if (leaders.error) throw leaders.error;
      persistedBest = Math.max(0, Number(mine.data) || 0);
      leaderboard = Array.isArray(leaders.data) ? leaders.data : [];
      render();
      return { highscore:persistedBest, leaderboard };
    } catch (error) {
      console.info("FPS leaderboard kunne ikke hentes.", error);
      render();
      return { highscore:persistedBest, leaderboard };
    }
  }

  async function submit(score, { force = false } = {}) {
    const candidate = Math.max(0, Math.floor(Number(score) || 0));
    if (!soloScoreEligible()) return null;
    currentScore = candidate;
    render();
    const activeClient = await resolveClient();
    if (!activeClient || !authenticated || (!force && candidate <= persistedBest)) return null;
    if (candidate <= persistedBest) return { best_score:persistedBest, improved:false };
    if (submitting) {
      queuedScore = Math.max(queuedScore, candidate);
      return null;
    }
    submitting = true;
    try {
      const response = await activeClient.rpc("submit_fps_score", { p_score:candidate });
      if (response.error) throw response.error;
      const result = Array.isArray(response.data) ? response.data[0] : response.data;
      persistedBest = Math.max(persistedBest, Number(result?.best_score) || candidate);
      render();
      if (result?.improved) await refresh();
      return result;
    } catch (error) {
      console.info("FPS highscore kunne ikke gemmes.", error);
      return null;
    } finally {
      submitting = false;
      if (queuedScore > persistedBest) {
        const next = queuedScore;
        queuedScore = 0;
        void submit(next, { force:true });
      } else queuedScore = 0;
    }
  }

  function setCurrentScore(score) {
    currentScore = Math.max(0, Math.floor(Number(score) || 0));
    render();
    if (!soloScoreEligible() || !authenticated || currentScore <= persistedBest) return;
    const candidate = currentScore;
    clearTimeout(submitTimer);
    submitTimer = setTimeout(() => { submitTimer = null; void submit(candidate); }, 900);
  }

  function observeScore() {
    const score = document.getElementById("score");
    if (!score) return;
    const sync = () => setCurrentScore(score.textContent);
    new MutationObserver(sync).observe(score, { childList:true, characterData:true, subtree:true });
    sync();
  }

  async function init() {
    ensureUI();
    observeScore();
    await refresh();
    client = window.JacobBackend?.realtimeClient || client;
    client?.auth?.onAuthStateChange?.(() => setTimeout(() => void refresh(), 0));
  }

  window.FpsLeaderboard = { refresh, submit, setCurrentScore, open:() => setPanelOpen(true) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else void init();
})();
