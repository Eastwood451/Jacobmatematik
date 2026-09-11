(() => {
  "use strict";

  const STYLE_ID = "fps-trial-entry-style";
  const CARD_ID = "fps-trial-entry";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .login-intro.has-fps-trial-entry{grid-template-rows:auto minmax(0,1fr) auto auto auto;overflow:auto;align-content:start}
      .fps-trial-entry{position:relative;display:block;isolation:isolate;overflow:hidden;width:100%;max-width:660px;margin:4px 0 12px;min-height:176px;border:4px solid #171c22;border-radius:18px;background:linear-gradient(135deg,#1b2730 0%,#243b43 52%,#ba4937 100%);box-shadow:8px 8px 0 #171c22;color:#fff5dd;text-decoration:none;transform:rotate(-.35deg);transition:transform .16s ease,box-shadow .16s ease}
      .fps-trial-entry:hover,.fps-trial-entry:focus-visible{transform:translate(2px,2px) rotate(0);box-shadow:5px 5px 0 #171c22;outline:none}
      .fps-trial-entry::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 70% 18%,#ffe6912b,transparent 26%),repeating-linear-gradient(115deg,transparent 0 28px,#ffffff08 29px 31px);z-index:-1}
      .fps-trial-entry-copy{position:relative;z-index:5;width:58%;padding:18px 14px 18px 20px;text-shadow:0 2px 0 #101317}
      .fps-trial-entry-kicker{display:inline-block;margin-bottom:4px;padding:4px 7px;border:2px solid #f5d989;border-radius:6px;background:#111820cc;color:#f5d989;font:900 10px/1 system-ui,sans-serif;letter-spacing:.14em}
      .fps-trial-entry h3{margin:3px 0 5px;font:900 clamp(28px,4vw,42px)/.92 system-ui,sans-serif;letter-spacing:-.05em;text-transform:uppercase}
      .fps-trial-entry p{margin:0;max-width:290px;color:#fff5dd;font:800 12px/1.35 system-ui,sans-serif}
      .fps-trial-entry-cta{display:inline-block;margin-top:12px;padding:8px 11px;border:2px solid #171c22;border-radius:8px;background:#f0c65d;color:#171c22;box-shadow:3px 3px 0 #171c22;font:900 12px/1 system-ui,sans-serif;text-shadow:none}
      .fps-trial-entry-scene{position:absolute;z-index:2;right:0;top:0;width:51%;height:100%}
      .fps-trial-entry-scene img{position:absolute;bottom:-9px;object-fit:contain;filter:drop-shadow(0 6px 2px #0007);user-select:none;pointer-events:none}
      .fps-trial-entry-erling{z-index:3;right:24%;height:118%;transform:rotate(2deg)}
      .fps-trial-entry-gunnar{z-index:2;left:-7%;height:78%;transform:rotate(-7deg)}
      .fps-trial-entry-else{z-index:1;right:-12%;height:88%;transform:rotate(7deg)}
      @media(max-width:700px){.fps-trial-entry{min-height:164px}.fps-trial-entry-copy{width:64%;padding:15px 10px 15px 15px}.fps-trial-entry h3{font-size:29px}.fps-trial-entry-scene{width:48%}.fps-trial-entry-erling{right:14%;height:110%}.fps-trial-entry-gunnar{display:none}.fps-trial-entry-else{right:-22%;height:80%}.fps-trial-entry p{font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  function addCard() {
    const loginForm = document.getElementById("login-form");
    const intro = document.querySelector(".login-intro");
    if (!loginForm || !intro || document.getElementById(CARD_ID)) return;
    ensureStyle();
    intro.classList.add("has-fps-trial-entry");
    const card = document.createElement("a");
    card.id = CARD_ID;
    card.className = "fps-trial-entry";
    card.href = "fps.html?trial=1";
    card.setAttribute("aria-label", "Prøv Erling FPS uden login");
    card.innerHTML = `
      <div class="fps-trial-entry-copy">
        <span class="fps-trial-entry-kicker">PRØV UDEN LOGIN</span>
        <h3>ERLING FPS</h3>
        <p>Regn. Tjen blyanter. Overlev skolen.</p>
        <span class="fps-trial-entry-cta">SPIL NU ✎</span>
      </div>
      <div class="fps-trial-entry-scene" aria-hidden="true">
        <img class="fps-trial-entry-gunnar" src="assets/figurer/gunnar-gider-ik.webp" alt="">
        <img class="fps-trial-entry-erling" src="assets/figurer/erling-aergerlig.webp" alt="">
        <img class="fps-trial-entry-else" src="assets/figurer/eksamens-else.webp" alt="">
      </div>`;
    intro.appendChild(card);
  }

  const app = document.getElementById("app");
  if (!app) return;
  const observer = new MutationObserver(addCard);
  observer.observe(app, { childList:true, subtree:true });
  addCard();
})();
