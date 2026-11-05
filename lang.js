/* Language preference + optional DA→EN redirect for landing pages. Free, no deps. */
(function () {
  var KEY = 'jm-lang';
  var BOT = /Googlebot|Google-InspectionTool|bingbot|BingPreview|Slurp|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|Applebot|SemrushBot|AhrefsBot|DotBot|MJ12bot|Bytespider|PetalBot|GPTBot|ClaudeBot|CCBot|ia_archiver/i;

  function getPref() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function setPref(code) {
    try { localStorage.setItem(KEY, code); } catch (e) { /* ignore */ }
  }

  function isBot() {
    try {
      if (navigator.webdriver) return true;
      return BOT.test(navigator.userAgent || '');
    } catch (e) { return false; }
  }

  function hasScandiLang() {
    var list = [];
    try {
      if (navigator.languages && navigator.languages.length) list = Array.prototype.slice.call(navigator.languages);
      else if (navigator.language) list = [navigator.language];
    } catch (e) { return true; }
    return list.some(function (raw) {
      var l = String(raw || '').toLowerCase();
      return l === 'da' || l.indexOf('da-') === 0
        || l === 'nb' || l.indexOf('nb-') === 0
        || l === 'nn' || l.indexOf('nn-') === 0
        || l === 'no' || l.indexOf('no-') === 0
        || l === 'sv' || l.indexOf('sv-') === 0;
    });
  }

  function maybeRedirectToEn() {
    var root = document.documentElement;
    if (root.getAttribute('data-lang-redirect') !== 'da-to-en') return;
    if (getPref()) return;
    if (/\bstart=/.test(location.search || '')) return;
    if (root.classList.contains('jm-has-session')) return;
    if (isBot()) return;
    if (hasScandiLang()) return;
    var target = root.getAttribute('data-en-href') || '/en/';
    if (!target || target === location.pathname) return;
    location.replace(target);
  }

  function wireSwitcher() {
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('[data-set-lang]') : null;
      if (!a) return;
      setPref(a.getAttribute('data-set-lang'));
    }, true);
  }

  maybeRedirectToEn();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireSwitcher);
  else wireSwitcher();
})();
