(() => {
  "use strict";

  const ANALYTICS_URL =
    "https://analytics.google.com/analytics/web/#/a55168525p552527373/reports/intelligenthome?params=_u..nav%3Dmaui&collectionId=user";

  const BAR_SVG = `<svg class="jm-analytics-icon-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#efe6ff"/>
      <rect x="9" y="27" width="7" height="12" rx="2.2" fill="#6b4ca0"/>
      <rect x="20.5" y="19" width="7" height="20" rx="2.2" fill="#4e357d"/>
      <rect x="32" y="12" width="7" height="27" rx="2.2" fill="#d8ad4f"/>
    </svg>`;

  let observer = null;

  const english = () => {
    if (typeof window.JacobLang?.get === "function") return window.JacobLang.get() === "en";
    if (document.documentElement.lang === "en") return true;
    return location.pathname.startsWith("/en/");
  };

  const t = (da, en) => (english() ? en : da);

  // Same gate as the suggestions admin panel in the teacher portal:
  // only when canManageRegistrations / can_manage_self_registered() is true.
  function allowed() {
    return Boolean(
      document.querySelector("#site-suggestions-panel, [data-action='toggle-site-suggestions']")
    );
  }

  function label() {
    return t("Google Analytics – se besøg og øvelser", "Google Analytics – view visits and exercises");
  }

  function createCard() {
    const text = label();
    const link = document.createElement("a");
    link.className = "jm-analytics-card";
    link.setAttribute("data-jm-analytics-card", "");
    link.href = ANALYTICS_URL;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("aria-label", text);

    const icon = document.createElement("span");
    icon.className = "jm-analytics-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = BAR_SVG;

    const caption = document.createElement("span");
    caption.className = "jm-analytics-text";
    caption.textContent = text;

    link.append(icon, caption);
    return link;
  }

  function mountCard() {
    if (!allowed()) {
      document.querySelectorAll("[data-jm-analytics-card]").forEach((el) => el.remove());
      return;
    }
    const dash = document.querySelector(".dashboard-head");
    if (!dash) return;
    if (dash.querySelector("[data-jm-analytics-card]")) return;

    const card = createCard();
    const aside = dash.querySelector(".jm-suggest-aside");
    const mailbox = dash.querySelector("[data-jm-suggest-mailbox]");
    const right = dash.querySelector("#teacher-live-status, [data-action='reset-demo']");

    if (aside && mailbox) {
      aside.insertBefore(card, mailbox);
      return;
    }
    if (aside && right) {
      aside.insertBefore(card, right);
      return;
    }
    if (right) {
      right.parentElement?.insertBefore(card, right);
      return;
    }
    dash.append(card);
  }

  function observe() {
    if (observer || typeof MutationObserver !== "function") {
      mountCard();
      return;
    }
    const root = document.getElementById("app") || document.body;
    if (!root) {
      mountCard();
      return;
    }
    observer = new MutationObserver(() => mountCard());
    observer.observe(root, { childList: true, subtree: true });
    mountCard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observe, { once: true });
  } else {
    observe();
  }
})();
