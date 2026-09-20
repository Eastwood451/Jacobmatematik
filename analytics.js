/* Basic consent mode: no Google requests before an explicit opt-in. */
(() => {
  'use strict';
  if (document.getElementById('jm-cookie-settings')) return;
  const measurementId = 'G-G4CQCVHLVR';
  const storageKey = 'jm-analytics-consent-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const production = ['jacobmatematik.dk', 'www.jacobmatematik.dk'].includes(location.hostname);
  const disabledKey = 'ga-disable-' + measurementId;
  let started = false;
  let expiryTimer;
  let choice = readChoice();

  function readChoice() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && ['granted', 'denied'].includes(saved.value) &&
          Number.isFinite(saved.at) && saved.at <= Date.now() && Date.now() - saved.at < lifetime) return saved;
    } catch (_) { /* Storage may be blocked. Default to no consent. */ }
    return null;
  }

  window[disabledKey] = true;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  const denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  gtag('consent', 'default', denied);

  function clearAnalyticsCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (name !== '_ga' && !name.startsWith('_ga_')) continue;
      for (const domain of ['', location.hostname, '.jacobmatematik.dk', 'jacobmatematik.dk']) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax' + (domain ? '; Domain=' + domain : '');
      }
    }
  }

  function applyChoice() {
    const granted = choice?.value === 'granted';
    window[disabledKey] = !granted || !production;
    gtag('consent', 'update', { ...denied, analytics_storage: granted ? 'granted' : 'denied' });
    clearTimeout(expiryTimer);
    if (choice) expiryTimer = setTimeout(checkExpiry, Math.min(lifetime - (Date.now() - choice.at), 2147483647));
    if (!granted) { clearAnalyticsCookies(); return; }
    if (!production || started) return;
    started = true;
    // Fixed page names and URLs exclude login tokens, query strings, pupil names and scores.
    const path = location.pathname === '/fps.html' ? '/fps.html' : location.pathname === '/privatliv.html' ? '/privatliv.html' : '/';
    gtag('js', new Date());
    gtag('config', measurementId, {
      page_location: 'https://jacobmatematik.dk' + path,
      page_title: path === '/fps.html' ? 'Erling FPS' : path === '/privatliv.html' ? 'Cookies og privatliv' : 'Jacob Matematik',
      page_referrer: '',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: lifetime / 1000,
      cookie_update: false,
      cookie_flags: 'SameSite=Lax;Secure',
      send_page_view: true
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    script.referrerPolicy = 'no-referrer';
    document.head.append(script);
  }

  const host = document.createElement('div');
  host.id = 'jm-cookie-settings';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { font: 14px/1.5 system-ui, sans-serif; color: #202b28; }
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      .panel { position: fixed; z-index: 2147483647; left: 16px; bottom: 72px; width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 100px); overflow: auto; padding: 22px; background: #fffdf7; border: 1px solid #bbc8bd; border-radius: 16px; box-shadow: 0 8px 36px #0003; }
      h2 { margin: 0 0 10px; font-size: 20px; line-height: 1.3; }
      p { margin: 0 0 12px; }
      a { color: #245d49; text-decoration: underline; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
      button { font: 600 14px/1.3 system-ui, sans-serif; cursor: pointer; border: 1px solid #245d49; border-radius: 8px; padding: 12px 16px; background: #fffdf7; color: #245d49; min-height: 44px; }
      .actions button { flex: 1; }
      button:hover { background: #e3eee7; }
      button:focus-visible, a:focus-visible { outline: 3px solid #b56014; outline-offset: 3px; }
      .settings { position: fixed; z-index: 2147483646; left: 12px; bottom: 28px; padding: 6px 10px; min-height: 32px; font-size: 12px; box-shadow: 0 2px 8px #0002; }
      .close { display: block; margin: 12px 0 0 auto; padding: 6px 10px; }
      @media (max-width: 400px) { .panel { padding: 18px; } .actions { flex-direction: column; } }
    </style>
    <button class="settings" type="button" aria-expanded="false" aria-controls="consent-panel">Cookieindstillinger</button>
    <section class="panel" id="consent-panel" role="region" aria-labelledby="consent-title" hidden>
      <h2 id="consent-title" tabindex="-1">Må vi måle besøg?</h2>
      <p>Vi bruger Google Analytics til at se, hvor mange der besøger siden, og hvilke sider der bliver brugt. Det kræver statistikcookies og sender oplysninger om besøg, browser og enhed til Google.</p>
      <p>Vi sender ikke elevnavne, loginoplysninger eller opgaveresultater til Google Analytics. Du kan bruge alle øvelser uden statistikcookies og ændre dit valg her når som helst.</p>
      <a href="/privatliv.html">Læs om cookies og privatliv</a>
      <div class="actions">
        <button type="button" data-choice="denied">Afvis statistik</button>
        <button type="button" data-choice="granted">Accepter statistik</button>
      </div>
      <button type="button" class="close" hidden>Luk</button>
    </section>`;
  document.body.append(host);
  const panel = root.querySelector('.panel');
  const settings = root.querySelector('.settings');
  const close = root.querySelector('.close');
  function showPanel(focus = false) {
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    close.hidden = !choice;
    if (focus) root.querySelector('h2').focus();
  }
  function hidePanel() {
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
  }
  settings.addEventListener('click', () => panel.hidden ? showPanel(true) : hidePanel());
  close.addEventListener('click', () => { hidePanel(); settings.focus(); });
  root.addEventListener('keydown', event => {
    // Keep the game's global keyboard handlers out of the consent controls.
    event.stopPropagation();
    if (event.key === 'Escape') { hidePanel(); settings.focus(); }
  });
  root.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
    choice = { value: button.dataset.choice, at: Date.now() };
    try { localStorage.setItem(storageKey, JSON.stringify(choice)); } catch (_) { /* Session-only choice. */ }
    applyChoice();
    hidePanel();
    settings.focus();
  }));
  function checkExpiry() {
    if (choice && Date.now() - choice.at >= lifetime) { choice = null; applyChoice(); showPanel(); }
    else if (choice) {
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(checkExpiry, Math.min(lifetime - (Date.now() - choice.at), 2147483647));
    }
  }
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = readChoice();
    applyChoice();
    if (!choice) showPanel(); else hidePanel();
  });
  document.addEventListener('visibilitychange', checkExpiry);
  applyChoice();
  if (!choice) showPanel();
})();
