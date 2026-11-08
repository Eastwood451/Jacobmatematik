/* Language preference. Danish stays the default. /en/ and ?lang=en are explicit English
   and are never overridden by the browser language. A stored choice wins over the browser. */
(function (root) {
  var KEY = "jm-lang";
  var BOT = /Googlebot|Google-InspectionTool|bingbot|BingPreview|Slurp|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|Applebot|SemrushBot|AhrefsBot|DotBot|MJ12bot|Bytespider|PetalBot|GPTBot|ClaudeBot|CCBot|ia_archiver/i;

  function isScandiTag(raw) {
    var l = String(raw || "").toLowerCase();
    return l === "da" || l.indexOf("da-") === 0
      || l === "nb" || l.indexOf("nb-") === 0
      || l === "nn" || l.indexOf("nn-") === 0
      || l === "no" || l.indexOf("no-") === 0
      || l === "sv" || l.indexOf("sv-") === 0;
  }

  function resolveLang(input) {
    input = input || {};
    var path = input.path || "/";
    var search = input.search || "";
    var stored = input.stored === "en" || input.stored === "da" ? input.stored : null;
    var query = null;
    var queryMatch = search.match(/(?:^|[?&])lang=(en|da)(?:&|$)/);
    if (queryMatch) query = queryMatch[1];
    var onEnglishPath = path === "/en" || path.indexOf("/en/") === 0;
    var explicit = query || (onEnglishPath ? "en" : null);
    var hasStart = /(?:^|[?&])start=/.test(search);
    var scandi = (input.languages || []).some(isScandiTag);
    var persist = explicit;
    var lang = explicit || stored || "da";
    if (!explicit && !stored && hasStart && !input.isBot && !scandi) {
      lang = "en";
      persist = "en";
    }
    var redirect = null;
    if (!explicit && !stored && !hasStart && !input.isBot && !input.hasSession && !scandi && input.allowRedirect) {
      redirect = input.enHref || "/en/";
      if (redirect === path) redirect = null;
    }
    return {
      lang: lang === "en" ? "en" : "da",
      persist: persist === "en" || persist === "da" ? persist : null,
      redirect: redirect,
      stripLang: Boolean(query) && !redirect,
    };
  }

  root.JacobLangResolve = resolveLang;

  if (!root.document || !root.document.documentElement) return;

  function getPref() {
    try { return root.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function setPref(code) {
    try { root.localStorage.setItem(KEY, code); } catch (e) { /* ignore */ }
  }
  function isBot() {
    try {
      if (root.navigator && root.navigator.webdriver) return true;
      return BOT.test((root.navigator && root.navigator.userAgent) || "");
    } catch (e) { return false; }
  }
  function languages() {
    try {
      var nav = root.navigator;
      if (nav.languages && nav.languages.length) return Array.prototype.slice.call(nav.languages);
      if (nav.language) return [nav.language];
    } catch (e) { /* treat as Danish so we do not bounce */ }
    return ["da"];
  }
  function applyDocument(lang) {
    var el = root.document.documentElement;
    el.lang = lang === "en" ? "en" : "da";
    el.classList.toggle("jm-lang-en", lang === "en");
  }
  function current() {
    var pref = getPref();
    return pref === "en" ? "en" : "da";
  }

  var decision = resolveLang({
    path: root.location.pathname || "/",
    search: root.location.search || "",
    stored: getPref(),
    languages: languages(),
    isBot: isBot(),
    hasSession: root.document.documentElement.classList.contains("jm-has-session"),
    allowRedirect: root.document.documentElement.getAttribute("data-lang-redirect") === "da-to-en",
    enHref: root.document.documentElement.getAttribute("data-en-href") || "/en/",
  });
  if (decision.persist) setPref(decision.persist);
  if (decision.redirect) {
    root.location.replace(decision.redirect);
    return;
  }
  if (decision.stripLang) {
    try {
      var url = new URL(root.location.href);
      url.searchParams.delete("lang");
      root.history.replaceState(root.history.state, "", url.pathname + url.search + url.hash);
    } catch (e) { /* keep the query */ }
  }
  applyDocument(decision.lang);

  function set(code) {
    var lang = code === "en" ? "en" : "da";
    setPref(lang);
    applyDocument(lang);
    try {
      root.document.dispatchEvent(new CustomEvent("jm-langchange", { detail: { lang: lang } }));
    } catch (e) { /* ignore */ }
    return lang;
  }

  root.JacobLang = {
    get: function () {
      var pref = getPref();
      return pref === "en" || pref === "da" ? pref : current();
    },
    set: set,
    resolve: resolveLang,
  };

  function wireSwitcher() {
    root.document.addEventListener("click", function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest("[data-set-lang]") : null;
      if (!a) return;
      var code = a.getAttribute("data-set-lang");
      var path = root.location.pathname || "/";
      var onApp = path === "/" || path === "/index.html";
      var inAppSwitch = a.closest ? Boolean(a.closest(".jm-lang-switch, [data-jm-lang-switch]")) : false;
      if (a.tagName === "BUTTON" || onApp || inAppSwitch) ev.preventDefault();
      set(code);
    }, true);
  }
  wireSwitcher();
})(typeof window !== "undefined" ? window : globalThis);
