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
    ["Kejser Dummo", "Emperor Dummy"],
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

  var resourceByDanish = null;
  var templateMatchers = null;
  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function ensureIndexes() {
    if (resourceByDanish && templateMatchers) return;
    resourceByDanish = {};
    templateMatchers = [];
    var strings = root.JacobI18nStrings || {};
    Object.keys(strings).forEach(function (key) {
      var entry = strings[key];
      var da = entry && entry.da;
      var en = entry && entry.en;
      if (typeof da !== "string" || typeof en !== "string") return;
      if (!Object.prototype.hasOwnProperty.call(resourceByDanish, da)) resourceByDanish[da] = key;
      if (da.indexOf("{") !== -1 && /\{\w+\}/.test(da)) {
        var vars = [];
        var parts = da.split(/\{(\w+)\}/);
        var regexStr = "^";
        var literalLen = 0;
        for (var p = 0; p < parts.length; p++) {
          if (p % 2 === 0) {
            literalLen += parts[p].length;
            regexStr += escapeRegex(parts[p]);
          } else {
            vars.push(parts[p]);
            regexStr += "(.+?)";
          }
        }
        regexStr += "$";
        if (literalLen >= 3) {
          templateMatchers.push({
            key: key,
            re: new RegExp(regexStr),
            vars: vars,
            en: en,
            literalLen: literalLen,
          });
        }
      }
    });
    templateMatchers.sort(function (a, b) { return b.literalLen - a.literalLen; });
  }

  function danishResourceKey(core) {
    ensureIndexes();
    return resourceByDanish[core] || null;
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, name) {
      return vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : "{" + name + "}";
    });
  }

  function has(key) {
    var entry = (root.JacobI18nStrings || {})[key];
    return Boolean(entry && typeof entry.da === "string" && typeof entry.en === "string");
  }

  function t(key, vars) {
    var entry = (root.JacobI18nStrings || {})[key];
    if (!entry) return null;
    var text = entry[lang()];
    if (typeof text !== "string") text = entry.da;
    if (typeof text !== "string") return null;
    return vars ? fill(text, vars) : text;
  }

  function translateCore(core, depth) {
    if (!core) return core;
    var fromObject = danishResourceKey(core);
    if (fromObject && has(fromObject)) return applyNames(root.JacobI18nStrings[fromObject].en);
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
    ensureIndexes();
    for (var m = 0; m < templateMatchers.length; m++) {
      var tm = templateMatchers[m];
      var match = core.match(tm.re);
      if (!match) continue;
      var vars = {};
      for (var v = 0; v < tm.vars.length; v++) {
        var captured = match[v + 1];
        if ((depth || 0) < 1) {
          var subKey = danishResourceKey(captured);
          if (subKey && has(subKey)) captured = root.JacobI18nStrings[subKey].en;
          else if (Object.prototype.hasOwnProperty.call(PHRASES, captured)) captured = PHRASES[captured];
        }
        vars[tm.vars[v]] = captured;
      }
      return applyNames(fill(tm.en, vars));
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
    if (parent.closest && parent.closest("[data-i18n-key]")) return;
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
      if (el.hasAttribute("data-i18n-" + name) && has(el.getAttribute("data-i18n-" + name))) return;
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

  function argsFrom(el) {
    var vars = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var name = el.attributes[i].name;
      if (name.indexOf("data-i18n-arg-") === 0) vars[name.slice(14)] = el.attributes[i].value;
    }
    return vars;
  }

  function applyKeyed(scope) {
    if (!scope || !scope.querySelectorAll) return;
    var keyed = scope.querySelectorAll("[data-i18n-key]");
    for (var i = 0; i < keyed.length; i++) {
      var el = keyed[i];
      if (skipped(el)) continue;
      var key = el.getAttribute("data-i18n-key");
      if (!has(key) || (el.children && el.children.length)) continue;
      var next = t(key, argsFrom(el));
      if (next == null || el.textContent === next) continue;
      el.textContent = next;
    }
    ATTRS.forEach(function (name) {
      var marked = scope.querySelectorAll("[data-i18n-" + name + "]");
      for (var j = 0; j < marked.length; j++) {
        var node = marked[j];
        if (skipped(node)) continue;
        var attrKey = node.getAttribute("data-i18n-" + name);
        if (!has(attrKey)) continue;
        var value = t(attrKey, argsFrom(node));
        if (value == null || node.getAttribute(name) === value) continue;
        node.setAttribute(name, value);
      }
    });
    var answerInput = scope.querySelector ? scope.querySelector("#answer") : null;
    if (answerInput && (answerInput.value === "Kan ikke beregnes" || answerInput.value === "Cannot be calculated")) {
      var undefLabel = t("exercise_undefined_answer") || (lang() === "en" ? "Cannot be calculated" : "Kan ikke beregnes");
      if (answerInput.value !== undefLabel) answerInput.value = undefLabel;
    }
  }

  var scheduled = false;
  function apply(target) {
    if (!root.document || !textOriginal) return;
    var rootEl = target && target.nodeType ? target : root.document.body;
    if (!rootEl) return;
    applyKeyed(rootEl);
    walk(rootEl);
    ensureSwitcher();
  }

  function switchLang(code) {
    if (!root.JacobLang || typeof root.JacobLang.set !== "function") return null;
    return root.JacobLang.set(code);
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
    strings: function () { return root.JacobI18nStrings || {}; },
    t: t,
    has: has,
    translate: translate,
    apply: apply,
    refresh: apply,
    switchLang: switchLang,
    scan: scan,
    lang: lang,
    skipSelector: SKIP,
    coverage: function () {
      return {
        semanticKeys: Object.keys(root.JacobI18nStrings || {}),
        legacyPhrases: Object.keys(PHRASES).length,
        legacyPatterns: PATTERNS.length,
        legacyIsNotSemantic: Object.keys(PHRASES).length > 0,
      };
    },
  };

  if (!root.document || !root.document.documentElement) return;

  function wrapDialog(name) {
    var native = root[name];
    if (typeof native !== "function" || native.__jmI18n) return;
    var wrapped = function (message) {
      var text = message;
      try { if (lang() === "en") text = translate(message); } catch (e) { text = message; }
      return native.call(root, text);
    };
    wrapped.__jmI18n = true;
    root[name] = wrapped;
  }

  function start() {
    wrapDialog("confirm");
    wrapDialog("alert");
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
