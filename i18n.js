/* English overlay for the exercise app. Danish source strings stay in the modules.
   Protected subtrees (clock, Plus-penalhus, parked Marley shop) are left unchanged. */
(function (root) {
  var PHRASES = root.JacobI18nPhrases || {};
  var PATTERNS = root.JacobI18nPatterns || [];
  var NAMES = [
    ["Øbbe Øvdig", "Paul Practice"],
    ["Erling Ærgerlig", "Isaac Isuck"],
    ["Kaptajn Kvadratrod", "Captain Square Root"],
    ["Divisions-Dennis", "Division Dennis"],
    ["Eksamens-Else", "Else the Examiner"],
    ["Gunnar Giderik", "Gunnar the Slacker"],
    ["Luigi Lækkermat", "Luigi"],
    ["Matematikhunden Marley", "Marley the maths dog"],
    ["Matematik-Marley", "Maths Marley"],
    ["Erling", "Isaac Isuck"],
    ["Øbbe", "Paul"],
    ["Gæst", "Guest"],
  ];
  var SKIP = ".pp-game, .cl-module, .marley-page, [data-i18n-skip]";
  var ATTRS = ["aria-label", "title", "placeholder", "alt"];
  var textOriginal = typeof WeakMap === "function" ? new WeakMap() : null;
  var attrOriginal = typeof WeakMap === "function" ? new WeakMap() : null;

  function applyNames(text) {
    var next = text;
    for (var i = 0; i < NAMES.length; i++) {
      if (next.indexOf(NAMES[i][0]) !== -1) next = next.split(NAMES[i][0]).join(NAMES[i][1]);
    }
    return next;
  }

  function translateCore(core, depth) {
    if (!core) return core;
    if (Object.prototype.hasOwnProperty.call(PHRASES, core)) return applyNames(PHRASES[core]);
    for (var i = 0; i < PATTERNS.length; i++) {
      var pattern = PATTERNS[i][0];
      if (!pattern.test(core)) continue;
      var replacement = PATTERNS[i][1];
      var next = typeof replacement === "function"
        ? core.replace(pattern, replacement)
        : core.replace(pattern, replacement);
      return applyNames(next);
    }
    if (depth < 1) {
      var tower = core.match(/^(.+): (\d+) %, ([^.]+)\. ([^.]+)\.(?: (Klik for at øve|Log ind for at øve)\.)?$/);
      if (tower) {
        var topics = tower[4].split(" og ").map(function (part) { return translateCore(part, 1); }).join(" and ");
        var action = tower[5] === "Klik for at øve" ? " Click to practise." : tower[5] ? " Log in to practise." : "";
        return translateCore(tower[1], 1) + ": " + tower[2] + "%, " + translateCore(tower[3], 1) + ". " + topics + "." + action;
      }
    }
    return applyNames(core);
  }

  function translate(raw) {
    if (raw == null) return raw;
    var text = String(raw);
    var lead = (text.match(/^\s*/) || [""])[0];
    var trail = (text.match(/\s*$/) || [""])[0];
    var core = text.trim();
    if (!core) return text;
    var next = translateCore(core, 0);
    if (next === core) return text;
    return lead + next + trail;
  }

  function lang() {
    try {
      if (root.JacobLang && root.JacobLang.get) return root.JacobLang.get() === "en" ? "en" : "da";
    } catch (e) { /* fall through */ }
    return "da";
  }

  function skipped(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    return Boolean(el && el.closest && el.closest(SKIP));
  }

  function applyText(node) {
    if (!node || node.nodeType !== 3 || !textOriginal) return;
    var parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(parent.tagName)) return;
    if (skipped(parent)) {
      if (textOriginal.has(node)) node.nodeValue = textOriginal.get(node);
      return;
    }
    var original = textOriginal.has(node) ? textOriginal.get(node) : node.nodeValue;
    var next = lang() === "en" ? translate(original) : original;
    if (next !== node.nodeValue) {
      if (!textOriginal.has(node)) textOriginal.set(node, original);
      node.nodeValue = next;
    }
  }

  function applyAttrs(el) {
    if (!el || el.nodeType !== 1 || !attrOriginal) return;
    if (skipped(el)) {
      var saved = attrOriginal.get(el);
      if (saved) ATTRS.forEach(function (name) {
        if (Object.prototype.hasOwnProperty.call(saved, name)) el.setAttribute(name, saved[name]);
      });
      return;
    }
    var store = attrOriginal.get(el) || {};
    ATTRS.forEach(function (name) {
      if (!el.hasAttribute(name)) return;
      var original = Object.prototype.hasOwnProperty.call(store, name) ? store[name] : el.getAttribute(name);
      var next = lang() === "en" ? translate(original) : original;
      if (next !== el.getAttribute(name)) {
        store[name] = original;
        el.setAttribute(name, next);
      }
    });
    if (Object.keys(store).length) attrOriginal.set(el, store);
  }

  function walk(node) {
    if (!node || !textOriginal) return;
    if (node.nodeType === 3) { applyText(node); return; }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (node.nodeType === 1 && skipped(node)) return;
    if (node.nodeType === 1) applyAttrs(node);
    if (node.shadowRoot) walk(node.shadowRoot);
    var child = node.firstChild;
    while (child) {
      var next = child.nextSibling;
      walk(child);
      child = next;
    }
  }

  function switcherHtml() {
    var en = lang() === "en";
    return '<nav class="jm-app-lang" data-jm-lang-switch data-i18n-skip aria-label="' + (en ? "Language" : "Sprog") + '">'
      + '<button type="button" data-set-lang="da" aria-pressed="' + (en ? "false" : "true") + '">DA</button>'
      + '<span aria-hidden="true">|</span>'
      + '<button type="button" data-set-lang="en" aria-pressed="' + (en ? "true" : "false") + '">EN</button>'
      + "</nav>";
  }

  function ensureSwitcher() {
    if (!root.document) return;
    var actions = root.document.querySelector(".top-actions");
    if (actions && !actions.querySelector("[data-jm-lang-switch]")) actions.insertAdjacentHTML("afterbegin", switcherHtml());
    var panel = root.document.querySelector(".login-panel .login-card");
    if (panel && !panel.querySelector("[data-jm-lang-switch]")) panel.insertAdjacentHTML("afterbegin", switcherHtml());
    root.document.querySelectorAll("[data-jm-lang-switch]").forEach(function (nav) {
      var en = lang() === "en";
      nav.setAttribute("aria-label", en ? "Language" : "Sprog");
      var da = nav.querySelector('[data-set-lang="da"]');
      var enBtn = nav.querySelector('[data-set-lang="en"]');
      if (da) da.setAttribute("aria-pressed", en ? "false" : "true");
      if (enBtn) enBtn.setAttribute("aria-pressed", en ? "true" : "false");
    });
    root.document.querySelectorAll(".jm-lang-switch [data-set-lang], .lp-lang [data-set-lang]").forEach(function (link) {
      var selected = link.getAttribute("data-set-lang") === lang();
      if (selected) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  var scheduled = false;
  function apply(target) {
    if (!root.document || !textOriginal) return;
    var rootEl = target && target.nodeType ? target : root.document.body;
    if (!rootEl) return;
    walk(rootEl);
    ensureSwitcher();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    var raf = root.requestAnimationFrame || function (fn) { return root.setTimeout(fn, 16); };
    raf(function () { scheduled = false; apply(); });
  }

  var DANSK = /[æøåÆØÅ]|(\b)(opgave|opgaver|rigtig|forkert|næste|tilbage|træning|svar|hjælp|vælg|skriv|lært|driller|gangestykke|brøk)/i;
  function scan(target) {
    var found = [];
    if (!root.document || !root.NodeFilter) return found;
    var scope = target || root.document.body;
    var walker = root.document.createTreeWalker(scope, root.NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.parentElement || skipped(node.parentElement)) return root.NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement.tagName)) return root.NodeFilter.FILTER_REJECT;
        return root.NodeFilter.FILTER_ACCEPT;
      },
    });
    var node;
    while ((node = walker.nextNode())) {
      var value = node.nodeValue.trim();
      if (value.length > 2 && DANSK.test(value)) found.push(value);
    }
    return found;
  }

  root.JacobI18n = {
    translate: translate,
    apply: apply,
    scan: scan,
    lang: lang,
    skipSelector: SKIP,
  };

  if (!root.document || !root.document.documentElement) return;

  function start() {
    apply();
    if (typeof MutationObserver !== "function") return;
    var observer = new MutationObserver(function () { schedule(); });
    observer.observe(root.document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
    root.document.addEventListener("jm-langchange", function () { apply(); });
  }
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start);
  else start();
})(typeof window !== "undefined" ? window : globalThis);
