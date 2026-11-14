(() => {
  "use strict";

  const COOLDOWN_KEY = "jm-suggest-cooldown-v1";
  const COOLDOWN_MS = 60_000;
  const MAX_LEN = 2000;
  let ownClient = null;
  let submitting = false;
  let mailboxObserver = null;

  const english = () => {
    if (typeof window.JacobLang?.get === "function") return window.JacobLang.get() === "en";
    if (document.documentElement.lang === "en") return true;
    return location.pathname.startsWith("/en/");
  };

  const t = (da, en) => (english() ? en : da);

  function copy() {
    return {
      button: t("Forbedringsforslag - skriv til jacobmatematik.dk", "Suggestions - write to jacobmatematik.dk"),
      title: t("Send et forslag til Jacob", "Send a suggestion to Jacob"),
      lead: t(
        "Skriv din idé eller feedback. Er du logget ind, gemmes dit brugernavn sammen med beskeden. Ellers står der Gæst.",
        "Write your idea or feedback. If you are signed in, your username is stored with the message. Otherwise it shows as Guest."
      ),
      label: t("Din besked", "Your message"),
      placeholder: t("Skriv dit forslag her…", "Write your suggestion here…"),
      send: t("Send forslag", "Send suggestion"),
      close: t("Luk", "Close"),
      sending: t("Sender…", "Sending…"),
      thanks: t("Tak! Dit forslag er sendt.", "Thanks! Your suggestion was sent."),
      empty: t("Skriv en besked først.", "Please write a message first."),
      tooLong: t(`Beskeden må højst være ${MAX_LEN} tegn.`, `The message may be at most ${MAX_LEN} characters.`),
      cooldown: t("Vent et øjeblik, før du sender et nyt forslag.", "Please wait a moment before sending another suggestion."),
      offline: t("Forslag kan ikke sendes lige nu. Prøv igen senere.", "Suggestions cannot be sent right now. Try again later."),
      failed: t("Forslaget kunne ikke sendes. Prøv igen.", "The suggestion could not be sent. Please try again."),
      rateLimited: t("Du har sendt for mange forslag. Prøv igen senere.", "You have sent too many suggestions. Try again later."),
    };
  }

  let mailboxSvgSeq = 0;

  function mailboxSvg() {
    const clipId = `jm-postkasse-slot-${++mailboxSvgSeq}`;
    return `<svg class="jm-postkasse" viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <defs>
        <clipPath id="${clipId}">
          <rect x="0" y="0" width="64" height="36.5"/>
        </clipPath>
      </defs>
      <ellipse cx="32" cy="68.5" rx="18" ry="2.6" fill="#5a3a1a" opacity=".16"/>
      <path d="M8 25.5 V17.5 C8 12.2 12.8 10 18 10 h28 c5.2 0 10 2.2 10 7.5 v8 Z" fill="#9f1218"/>
      <path d="M8 25.5 h48 v3.2 c0 1.4-1 2.3-2.2 2.3 H10.2 C9 31 8 30.1 8 28.7 Z" fill="#7a0d12"/>
      <rect x="10" y="24" width="44" height="40" rx="6" fill="#d61f26"/>
      <rect x="13.5" y="28" width="7" height="30" rx="3.5" fill="#fff" opacity=".16"/>
      <rect x="17.5" y="33" width="29" height="6.5" rx="2.2" fill="#6d0c12"/>
      <circle cx="32" cy="50.5" r="7.2" fill="#f2d27a"/>
      <path d="M27.6 50.2 c0-2.6 1.8-4.4 4.4-4.4 1.5 0 2.6.6 3.3 1.5 l-1.6 1.2 c-.4-.5-1-.8-1.7-.8-1.4 0-2.3 1.1-2.3 2.5 s.9 2.5 2.3 2.5 c.7 0 1.3-.3 1.7-.8 l1.6 1.2 c-.7.9-1.8 1.5-3.3 1.5-2.6 0-4.4-1.8-4.4-4.4 Z" fill="#9f1218"/>
      <g clip-path="url(#${clipId})">
        <g class="jm-postkasse-letter">
          <rect x="21" y="24" width="22" height="18" rx="1.8" fill="#fff8e8" stroke="#c9b896" stroke-width="1.2"/>
          <path d="M22 26.2 32 35.5 42 26.2" fill="none" stroke="#d4a017" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="38.5" cy="31.5" r="1.3" fill="#c8102e"/>
        </g>
      </g>
      <rect x="16.5" y="32" width="31" height="2.2" rx="1.1" fill="#f2d27a"/>
    </svg>`;
  }

  function mountButton() {
    if (document.querySelector(".jm-suggest-entry")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jm-suggest-entry";
    button.setAttribute("data-jm-suggest", "");
    button.setAttribute("data-i18n-key", "suggest_button");
    button.textContent = copy().button;

    const footer = document.querySelector("footer.site-links") || document.querySelector("footer.lp-footer");
    if (footer) {
      footer.append(button);
      return;
    }
    // Fallback: keep the control in document flow (never fixed over exercise UI).
    const wrap = document.createElement("p");
    wrap.className = "site-links";
    wrap.style.cssText = "text-align:center;padding:12px 16px 48px;margin:0";
    wrap.append(button);
    document.body.append(wrap);
  }

  function createMailboxButton() {
    const label = copy().button;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jm-suggest-mailbox";
    button.setAttribute("data-jm-suggest", "");
    button.setAttribute("data-jm-suggest-mailbox", "");
    button.setAttribute("data-i18n-aria-label", "suggest_button");
    button.setAttribute("aria-label", label);
    const icon = document.createElement("span");
    icon.className = "jm-suggest-mailbox-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = mailboxSvg();
    const text = document.createElement("span");
    text.className = "jm-suggest-mailbox-text";
    text.setAttribute("data-i18n-key", "suggest_button");
    text.textContent = label;
    button.append(icon, text);
    return button;
  }

  function ensureAside(anchor) {
    const parent = anchor.parentElement;
    if (!parent) return null;
    if (parent.classList.contains("jm-suggest-aside")) return parent;
    const wrap = document.createElement("div");
    wrap.className = "jm-suggest-aside";
    parent.insertBefore(wrap, anchor);
    wrap.append(anchor);
    return wrap;
  }

  function mountMailboxAt(anchor) {
    if (!anchor) return;
    const host = anchor.parentElement;
    if (host?.querySelector("[data-jm-suggest-mailbox]")) return;
    const aside = ensureAside(anchor);
    if (!aside) return;
    aside.insertBefore(createMailboxButton(), anchor);
  }

  function mountMailboxCards() {
    mountMailboxAt(document.querySelector(".hero-line .streak"));
    const dash = document.querySelector(".dashboard-head");
    if (!dash) return;
    if (dash.querySelector("[data-jm-suggest-mailbox]")) return;
    const right = dash.querySelector("#teacher-live-status, [data-action='reset-demo']");
    if (right) {
      mountMailboxAt(right);
      return;
    }
    const aside = document.createElement("div");
    aside.className = "jm-suggest-aside";
    aside.append(createMailboxButton());
    dash.append(aside);
  }

  function observeMailboxMount() {
    if (mailboxObserver || typeof MutationObserver !== "function") {
      mountMailboxCards();
      return;
    }
    const root = document.getElementById("app") || document.body;
    if (!root) {
      mountMailboxCards();
      return;
    }
    mailboxObserver = new MutationObserver(() => mountMailboxCards());
    mailboxObserver.observe(root, { childList: true, subtree: true });
    mountMailboxCards();
  }

  function setStatus(dialog, text, tone) {
    const status = dialog.querySelector(".jm-suggest-status");
    if (!status) return;
    status.textContent = text || "";
    status.dataset.tone = tone || "";
  }

  function ensureDialog() {
    let dialog = document.getElementById("jm-suggest-dialog");
    if (dialog) return dialog;
    const c = copy();
    dialog = document.createElement("dialog");
    dialog.id = "jm-suggest-dialog";
    dialog.setAttribute("aria-labelledby", "jm-suggest-title");
    dialog.innerHTML = `
      <h2 id="jm-suggest-title" data-i18n-key="suggest_title">${c.title}</h2>
      <p data-i18n-key="suggest_lead">${c.lead}</p>
      <form id="jm-suggest-form" novalidate>
        <div class="jm-suggest-honeypot" aria-hidden="true">
          <label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <label for="jm-suggest-message" data-i18n-key="suggest_label">${c.label}</label>
        <textarea id="jm-suggest-message" name="message" maxlength="${MAX_LEN}" required placeholder="${c.placeholder}" data-i18n-key="suggest_placeholder" data-i18n-attr="placeholder"></textarea>
        <p class="jm-suggest-status" role="status"></p>
        <div class="jm-suggest-actions">
          <button type="submit" class="btn primary" data-i18n-key="suggest_send">${c.send}</button>
          <button type="button" class="btn secondary" data-jm-suggest-close data-i18n-key="suggest_close">${c.close}</button>
        </div>
      </form>`;
    document.body.append(dialog);
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        dialog.close();
      }
    });
    dialog.querySelector("[data-jm-suggest-close]")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("#jm-suggest-form")?.addEventListener("submit", onSubmit);
    return dialog;
  }

  function openDialog() {
    const dialog = ensureDialog();
    const c = copy();
    dialog.querySelector("#jm-suggest-title").textContent = c.title;
    dialog.querySelector("[data-i18n-key='suggest_lead']").textContent = c.lead;
    dialog.querySelector("[data-i18n-key='suggest_label']").textContent = c.label;
    const textarea = dialog.querySelector("#jm-suggest-message");
    textarea.placeholder = c.placeholder;
    dialog.querySelector("[data-i18n-key='suggest_send']").textContent = c.send;
    dialog.querySelector("[data-i18n-key='suggest_close']").textContent = c.close;
    setStatus(dialog, "", "");
    if (!dialog.open) dialog.showModal();
    textarea.focus();
  }

  async function getClient() {
    if (window.JacobBackend?.realtimeClient) return window.JacobBackend.realtimeClient;
    if (ownClient) return ownClient;
    const config = window.JACOBMATEMATIK_SUPABASE || {};
    if (!config.url || !config.publishableKey || !window.supabase?.createClient) return null;
    ownClient = window.supabase.createClient(config.url, config.publishableKey);
    return ownClient;
  }

  function cooldownActive() {
    try {
      const until = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }

  function markCooldown() {
    try {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
    } catch { /* ignore quota */ }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const form = event.target;
    const dialog = form.closest("dialog");
    const c = copy();
    const honeypot = String(new FormData(form).get("website") || "").trim();
    if (honeypot) {
      setStatus(dialog, c.thanks, "ok");
      form.reset();
      return;
    }
    const message = String(new FormData(form).get("message") || "").trim();
    if (!message) {
      setStatus(dialog, c.empty, "error");
      return;
    }
    if (message.length > MAX_LEN) {
      setStatus(dialog, c.tooLong, "error");
      return;
    }
    if (cooldownActive()) {
      setStatus(dialog, c.cooldown, "error");
      return;
    }

    const client = await getClient();
    if (!client) {
      setStatus(dialog, c.offline, "error");
      return;
    }

    submitting = true;
    const sendBtn = form.querySelector('button[type="submit"]');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = c.sending;
    }
    setStatus(dialog, "", "");
    try {
      if (typeof window.JacobBackend?.submitSiteSuggestion === "function") {
        await window.JacobBackend.submitSiteSuggestion(message);
      } else {
        const response = await client.rpc("submit_site_suggestion", { p_message: message });
        if (response.error) throw response.error;
      }
      markCooldown();
      form.reset();
      setStatus(dialog, c.thanks, "ok");
    } catch (error) {
      const code = error?.code || error?.message || "";
      const text = /for mange|too many|P0001/i.test(String(code)) ? c.rateLimited : c.failed;
      setStatus(dialog, text, "error");
    } finally {
      submitting = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = c.send;
      }
    }
  }

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-jm-suggest]")) return;
    openDialog();
  });

  function start() {
    mountButton();
    observeMailboxMount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.JacobSuggestions = { open: openDialog, mount: mountButton, mountMailbox: mountMailboxCards };
})();
