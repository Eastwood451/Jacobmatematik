(() => {
  "use strict";

  const COOLDOWN_KEY = "jm-suggest-cooldown-v1";
  const COOLDOWN_MS = 60_000;
  const MAX_LEN = 2000;
  let ownClient = null;
  let submitting = false;

  const english = () => {
    if (typeof window.JacobLang?.get === "function") return window.JacobLang.get() === "en";
    if (document.documentElement.lang === "en") return true;
    return location.pathname.startsWith("/en/");
  };

  const t = (da, en) => (english() ? en : da);

  function copy() {
    return {
      button: t("Har du et forslag til jacobmatematik.dk?", "Do you have a suggestion for jacobmatematik.dk?"),
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

  function mountButton() {
    if (document.querySelector("[data-jm-suggest]")) return;
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountButton, { once: true });
  } else {
    mountButton();
  }

  window.JacobSuggestions = { open: openDialog, mount: mountButton };
})();
