/* The Quest – fra hvidt til sort bælte. Beta: app.js monterer kun kortet for Jacobs profiler.
   Bælterne følger Matematiktårnets etager nedefra. Et bælte er taget, når etagen når Bindingsværk (60 %),
   og bælterne tages i rækkefølge. Et bælte, man har fået, beholder man (gemt pr. bruger i localStorage).
   Ingen backend: tallene kommer fra tårnets egen progressionsberegning i app.js. */
(function (root) {
  "use strict";

  var THRESHOLD = 60;
  // Siden er ikke færdigbygget: kun hvidt → blåt kan opnås nu (Tælle, Plus, 10’er-venner, Minus, Gange).
  // Lilla og brunt kommer, når flere emner er bygget. Sort = alt, hvad 9. klasses afgangsprøve kræver.
  var ATTAINABLE = 5;
  var STORAGE_PREFIX = "jm-quest-seen-v1:";
  var KAPTAJN = { img: "assets/figurer/skak/w-k.webp", da: "Kaptajn Kvadratrod", en: "Captain Square Root" };

  // Én etage = ét bælte. Rækkefølgen er nedefra i tårnet.
  var BELTS = [
    { key: "white", floor: "Tælle", floorEn: "Counting", color: "#f7f5ee", edge: "#c9c3b2", ink: "#3a3a3a",
      da: "Hvidt bælte", en: "White belt", daOf: "det hvide bælte", enOf: "the white belt",
      buddy: { img: "assets/quest/obbe-ovdig.webp", da: "Øbbe Øvdig", en: "Paul Practice" },
      line: { da: "Din gamle tommelfinger-tælling er hermed pensioneret. Fra i dag tæller du som en mester – og fingrene må holde fri.",
              en: "Your old thumb-counting is hereby retired. From today you count like a master – and your fingers get the day off." },
      reply: { da: "Ti tal. Nul undskyldninger. GODKENDT!", en: "Ten numbers. Zero excuses. APPROVED!" } },
    { key: "yellow", floor: "Plus", floorEn: "Addition", color: "#ffd23f", edge: "#c99a00", ink: "#3b2f00",
      da: "Gult bælte", en: "Yellow belt", daOf: "det gule bælte", enOf: "the yellow belt",
      buddy: { img: "assets/brok-loeb/else.webp", da: "Eksamens-Else", en: "Else the Examiner" },
      line: { da: "Du har lagt sammen, til tallene bad om nåde. Bær dette gule bælte med ydmyghed … og en lille smule pral.",
              en: "You added until the numbers begged for mercy. Wear this yellow belt with humility … and just a little bragging." },
      reply: { da: "Hmpf. Jeg kunne ikke finde én eneste fejl. Det irriterer mig.", en: "Hmph. I couldn't find a single mistake. It annoys me." } },
    { key: "orange", floor: "10’er-venner", floorEn: "Friends of 10", color: "#ff8a1f", edge: "#c25a00", ink: "#3d1b00",
      da: "Orange bælte", en: "Orange belt", daOf: "det orange bælte", enOf: "the orange belt",
      buddy: { img: "assets/figurer/luigi-laekkermat-cutout.webp", da: "Luigi Lækkermat", en: "Luigi" },
      line: { da: "Du kender nu de hemmelige tier-venner. 7 og 3 hilser. 6 og 4 vinker. Du er en af dem nu.",
              en: "You now know the secret friends of ten. 7 and 3 salute you. 6 and 4 wave. You are one of them now." },
      reply: { da: "Mamma mia! Ti stykker pizza – perfekt delt!", en: "Mamma mia! Ten slices – perfectly shared!" } },
    { key: "green", floor: "Minus", floorEn: "Subtraction", color: "#2fb24c", edge: "#1a7a30", ink: "#06290f",
      da: "Grønt bælte", en: "Green belt", daOf: "det grønne bælte", enOf: "the green belt",
      buddy: { img: "assets/brok-loeb/erling.webp", da: "Erling Ærgerlig", en: "Isaac Isuck" },
      line: { da: "Du har lært at tage væk uden at miste fatningen. Selv Erling er … næsten imponeret.",
              en: "You have learned to take away without losing your cool. Even Isaac is … almost impressed." },
      reply: { da: "Det var vel okay. Lidt. Måske. Lad være med at fortælle det til nogen.", en: "That was okay, I guess. A bit. Maybe. Don't tell anyone." } },
    { key: "blue", floor: "Gange", floorEn: "Multiplication", color: "#2f7bf0", edge: "#1a4fa8", ink: "#04193d",
      da: "Blåt bælte", en: "Blue belt", daOf: "det blå bælte", enOf: "the blue belt",
      buddy: { img: "assets/brok-loeb/gunnar.webp", da: "Gunnar Giderik", en: "Gunnar the Slacker" },
      line: { da: "Gangetabellerne bøjer sig for dig. Hvor andre ser 7 × 8, ser du 56 – og en lille, stille sejr.",
              en: "The times tables bow before you. Where others see 7 × 8, you see 56 – and a small, quiet victory." },
      reply: { da: "Jeg gider ik' klappe … øh. Okay. Én gang. Men rygtet siger, at der kommer flere prøver. Suk.", en: "I can't be bothered to clap … uh. Fine. Once. But rumour has it more trials are coming. Sigh." } },
    { key: "purple", floor: null, floorEn: null, locked: true, color: "#8b4fd8", edge: "#5a2a9c", ink: "#1e0640",
      da: "Lilla bælte", en: "Purple belt", daOf: "det lilla bælte", enOf: "the purple belt",
      // Fremtidig (låst): replik gemt til senere, kan ikke udløses nu.
      buddy: { img: "assets/figurer/divisions-dennis.webp", da: "Divisions-Dennis", en: "Division Dennis" },
      line: { da: "Du deler retfærdigt, hurtigt og uden at efterlade krummer. Kagekrigene er forbi. Du har bragt fred.",
              en: "You share fairly, quickly and without leaving crumbs. The cake wars are over. You have brought peace." },
      reply: { da: "Rest nul. Respekt.", en: "Remainder zero. Respect." } },
    { key: "brown", floor: null, floorEn: null, locked: true, color: "#8a5a2b", edge: "#5b3814", ink: "#fff1df",
      da: "Brunt bælte", en: "Brown belt", daOf: "det brune bælte", enOf: "the brown belt",
      buddy: { img: "assets/brok-loeb/dummo.webp", da: "Kejser Dummo", en: "Emperor Dummy" },
      line: { da: "Parentes først, så gange, så plus. Du kender den hellige rækkefølge. Kaos er hermed aflyst.",
              en: "Brackets first, then times, then plus. You know the sacred order. Chaos is hereby cancelled." },
      reply: { da: "Jeg forstår ingenting, men jeg klapper alligevel!", en: "I understand nothing, but I am clapping anyway!" } },
    { key: "black", floor: null, floorEn: null, locked: true, color: "#15151b", edge: "#000000", ink: "#ffd75a",
      da: "Sort bælte", en: "Black belt", daOf: "det sorte bælte", enOf: "the black belt",
      buddy: null,
      line: { da: "Du er gået under nul og kommet tilbage med et smil. Du så minus fire grader i øjnene og sagde: ›Pfft.‹ Det sorte bælte er dit.",
              en: "You went below zero and came back smiling. You looked minus four degrees in the eye and said: ‘Pfft.’ The black belt is yours." },
      reply: { da: "Hele holdet: MESTER! MESTER! MESTER!", en: "The whole crew: MASTER! MASTER! MASTER!" } },
  ];
  var CREW = [
    { img: "assets/quest/obbe-ovdig.webp" }, { img: "assets/brok-loeb/else.webp" }, { img: "assets/figurer/luigi-laekkermat-cutout.webp" },
    { img: "assets/brok-loeb/erling.webp" }, { img: "assets/brok-loeb/gunnar.webp" }, { img: "assets/figurer/divisions-dennis.webp" }, { img: "assets/brok-loeb/dummo.webp" },
  ];

  var TEXT = {
    title: { da: "The Quest", en: "The Quest" },
    tagline: { da: "Fra hvidt til sort bælte i matematik", en: "From white to black belt in maths" },
    yourBelt: { da: "Dit bælte", en: "Your belt" },
    noBelt: { da: "Lærling – intet bælte endnu", en: "Apprentice – no belt yet" },
    firstTrial: { da: "Din første prøve", en: "Your first trial" },
    nextTrial: { da: "Næste prøve", en: "Next trial" },
    train: { da: "Træn til {belt} →", en: "Train for the {belt} →" },
    topNow: { da: "Du har det højeste bælte lige nu. Flere prøver er på vej.", en: "You have the highest belt for now. More trials are on the way." },
    comingSoon: { da: "Kommer, når flere emner er bygget", en: "Coming when more topics are built" },
    blackDesc: { da: "Sort bælte: Du kan alt, hvad 9. klasses afgangsprøve kræver", en: "Black belt: you master everything the Danish 9th-grade final exam requires" },
    lockedSoon: { da: "{belt} – låst. Kommer, når flere emner er bygget", en: "{belt} – locked. Coming when more topics are built" },
    allDone: { da: "Alle otte bælter er dine. Du er en ægte mester i jacobmatematik-universet.", en: "All eight belts are yours. A true master of the jacobmatematik universe." },
    stripe: { da: "Dine bælter", en: "Your belts" },
    replay: { da: "Se ceremonien for {belt} igen", en: "Watch the {belt} ceremony again" },
    locked: { da: "{belt} – låst ({floor})", en: "{belt} – locked ({floor})" },
    kicker: { da: "Den højtidelige bælteceremoni", en: "The solemn belt ceremony" },
    presents: { da: "{captain} overrækker", en: "{captain} presents" },
    floorDone: { da: "{floor} nåede Bindingsværk", en: "{floor} reached Timber frame" },
    ready: { da: "Jeg er klar til næste prøve", en: "I am ready for the next trial" },
    blackTease: { da: "Rygtet siger, at der findes en prøve efter det sorte bælte …", en: "Rumour has it there is a trial beyond the black belt …" },
    close: { da: "Luk ceremonien", en: "Close the ceremony" },
    howTitle: { da: "Sådan får du et bælte", en: "How to earn a belt" },
    how: { da: "Lige nu kan du tage fem bælter: Tælle giver hvidt, Plus gult, 10’er-venner orange, Minus grønt og Gange blåt. Når etagen i Matematiktårnet når Bindingsværk (60 %), får du bæltet. Bælterne tages i rækkefølge, og et bælte, du har fået, beholder du. Lilla og brunt kommer, når flere emner er bygget. Sort bælte får du, når du kan alt, hvad 9. klasses afgangsprøve kræver.",
           en: "Right now you can earn five belts: Counting gives white, Addition yellow, Friends of 10 orange, Subtraction green and Multiplication blue. When the floor in the Maths Tower reaches Timber frame (60%), the belt is yours. Belts come in order, and once earned you keep it. Purple and brown come when more topics are built. The black belt is for mastering everything the Danish 9th-grade final exam requires." },
    unitBricks: { da: "mursten", en: "bricks" },
    unitStones: { da: "sten", en: "stones" },
    missingUnits: { da: "{n} {unit} mere i {floor}", en: "{n} more {unit} in {floor}" },
    missingPct: { da: "{n} procentpoint mere i {floor} (nu {now} %)", en: "{n} more percentage points in {floor} (now {now}%)" },
    progressLabel: { da: "{floor}: {now} af 60 % til næste bælte", en: "{floor}: {now} of 60% to the next belt" },
  };

  function lang() {
    try { return root.JacobLang && root.JacobLang.get && root.JacobLang.get() === "en" ? "en" : "da"; } catch (e) { return "da"; }
  }
  function tx(key, vars, l) {
    var s = TEXT[key][l || lang()];
    return s.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? String(vars[k]) : ""; });
  }
  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function beltName(belt, l) { return (l || lang()) === "en" ? belt.en : belt.da; }
  function beltNameOf(belt, l) { return (l || lang()) === "en" ? belt.enOf : belt.daOf; }
  function floorName(belt, l) { return (l || lang()) === "en" ? belt.floorEn : belt.floor; }

  // ---------- Ren logik (testes i scripts/test-quest.cjs) ----------
  function floorReached(floor) { return Boolean(floor) && Number(floor.score) + 1e-9 >= THRESHOLD; }

  // floors: nedefra, [{ score, units:{built,total,kind}|null, practice }]
  function computeQuest(floors, seenCount) {
    floors = floors || [];
    var earnedNow = 0;
    while (earnedNow < ATTAINABLE && floorReached(floors[earnedNow])) earnedNow++;
    var seen = Math.max(0, Math.min(ATTAINABLE, Number(seenCount) || 0));
    var held = Math.max(earnedNow, seen); // Et bælte, man har fået, beholder man.
    var next = held < ATTAINABLE ? held : -1;
    var missing = null;
    if (next >= 0) {
      var f = floors[next] || { score: 0, units: null };
      var score = Math.max(0, Number(f.score) || 0);
      if (f.units && f.units.total) {
        var needed = Math.ceil(f.units.total * THRESHOLD / 100 - 1e-9);
        missing = { kind: f.units.kind === "stones" ? "stones" : "bricks", n: Math.max(0, needed - f.units.built), built: f.units.built, total: f.units.total, needed: needed, score: score };
      } else {
        missing = { kind: "pct", n: Math.max(0, Math.ceil(THRESHOLD - score - 1e-9)), score: score };
      }
      missing.progress = Math.max(0, Math.min(1, score / THRESHOLD));
    }
    return { earnedNow: earnedNow, held: held, current: held - 1, next: next, missing: missing, top: held >= ATTAINABLE };
  }

  // Ceremonien vises én gang pr. bælte pr. bruger. Ingen kaskade: kun det højeste nye bælte vises.
  function storageKey(userId) { return STORAGE_PREFIX + String(userId || "anon"); }
  function readSeen(storage, userId) {
    try {
      var raw = storage && storage.getItem(storageKey(userId));
      if (raw == null) return null;
      var n = parseInt(raw, 10);
      return isNaN(n) ? null : Math.max(0, Math.min(ATTAINABLE, n));
    } catch (e) { return null; }
  }
  function writeSeen(storage, userId, count) {
    try { storage && storage.setItem(storageKey(userId), String(count)); } catch (e) {}
  }
  // Returnerer bælteindeks (0–7) der skal fejres nu, eller -1. Markerer altid som set.
  function pendingCeremony(storage, userId, earnedNow) {
    earnedNow = Math.max(0, Math.min(ATTAINABLE, Number(earnedNow) || 0));
    var seen = readSeen(storage, userId);
    var already = seen == null ? 0 : seen;
    if (earnedNow > already) {
      writeSeen(storage, userId, earnedNow);
      return earnedNow - 1;
    }
    if (seen == null) writeSeen(storage, userId, 0);
    return -1;
  }

  // ---------- Bælte-SVG ----------
  var svgId = 0;
  function beltSvg(belt, opts) {
    opts = opts || {};
    var id = "qb" + (++svgId);
    var c = belt ? belt.color : "none", e = belt ? belt.edge : "#8b8fa3";
    var dash = belt ? "" : ' stroke-dasharray="5 4"';
    var tip = belt && belt.key === "black" ? '<rect x="62" y="74" width="12" height="9" fill="#d4a017"/><rect x="104" y="74" width="12" height="9" fill="#d4a017"/>' : "";
    var shade = belt ? '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>' : "";
    var gloss = belt ? ' <rect x="4" y="22" width="172" height="20" rx="4" fill="url(#' + id + ')"/>' : "";
    return '<svg class="' + (opts.cls || "quest-belt-svg") + '" viewBox="0 0 180 92" aria-hidden="true" focusable="false">' + shade +
      // bæltet rundt
      '<rect x="4" y="22" width="172" height="20" rx="4" fill="' + c + '" stroke="' + e + '" stroke-width="2.5"' + dash + '/>' + gloss +
      '<path d="M8 27H172M8 37H172" stroke="' + e + '" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="3 3"/>' +
      // hængende ender
      '<path d="M82 40L62 86H76L90 48Z" fill="' + c + '" stroke="' + e + '" stroke-width="2.5" stroke-linejoin="round"' + dash + '/>' +
      '<path d="M98 40L118 86H104L90 48Z" fill="' + c + '" stroke="' + e + '" stroke-width="2.5" stroke-linejoin="round"' + dash + '/>' + tip +
      // knude
      '<rect x="76" y="16" width="28" height="32" rx="6" fill="' + c + '" stroke="' + e + '" stroke-width="2.5"' + dash + '/>' +
      '<path d="M80 22L100 42M100 22L80 42" stroke="' + e + '" stroke-opacity=".55" stroke-width="2"/>' +
      "</svg>";
  }

  var LOCK = '<svg class="quest-lock" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor"/></svg>';
  // ---------- Kortet over tårnet ----------
  function missingText(q, l) {
    var m = q.missing; if (!m) return "";
    var belt = BELTS[q.next];
    if (m.kind === "pct") return tx("missingPct", { n: m.n, floor: floorName(belt, l), now: Math.floor(m.score + 1e-9) }, l);
    return tx("missingUnits", { n: m.n, unit: tx(m.kind === "stones" ? "unitStones" : "unitBricks", null, l), floor: floorName(belt, l) }, l);
  }

  function renderCard(el, ctx) {
    var l = lang();
    var q = ctx.quest;
    var cur = q.current >= 0 ? BELTS[q.current] : null;
    var nxt = q.next >= 0 ? BELTS[q.next] : null;
    var practice = nxt && ctx.floors[q.next] && ctx.floors[q.next].practice;
    var practiceAttr = practice ? (practice.action ? ' data-action="' + esc(practice.action) + '"' : ' data-topic="' + esc(practice.topic) + '"') : "";
    var stripe = BELTS.map(function (b, i) {
      var have = i < q.held;
      var label = have ? tx("replay", { belt: beltName(b, l).toLowerCase() }, l)
        : b.key === "black" ? tx("blackDesc", null, l)
        : b.locked ? tx("lockedSoon", { belt: beltName(b, l) }, l)
        : tx("locked", { belt: beltName(b, l), floor: floorName(b, l) }, l);
      return '<button type="button" class="quest-stripe-belt' + (have ? " is-earned" : "") + (b.locked ? " is-locked" : "") + (i === q.next ? " is-next" : "") + '" style="--belt:' + b.color + ';--edge:' + b.edge + '" data-quest-replay="' + i + '"' + (have ? "" : " disabled") + ' aria-label="' + esc(label) + '" title="' + esc(label) + '"><span></span>' + (b.locked ? LOCK : "") + '</button>';
    }).join("");
    var nextBlock = nxt
      ? '<div class="quest-next"><span class="quest-label">' + esc(q.held ? tx("nextTrial", null, l) : tx("firstTrial", null, l)) + '</span>' +
        '<strong><i class="quest-dot" style="--belt:' + nxt.color + ';--edge:' + nxt.edge + '"></i>' + esc(beltName(nxt, l)) + ' · ' + esc(floorName(nxt, l)) + '</strong>' +
        '<div class="quest-progress" role="progressbar" aria-valuemin="0" aria-valuemax="60" aria-valuenow="' + Math.min(60, Math.floor(q.missing.score)) + '" aria-label="' + esc(tx("progressLabel", { floor: floorName(nxt, l), now: Math.min(60, Math.floor(q.missing.score)) }, l)) + '"><span style="width:' + Math.round(q.missing.progress * 100) + '%;--belt:' + nxt.color + '"></span></div>' +
        '<p class="quest-missing">' + esc(missingText(q, l)) + '</p>' +
        (practiceAttr ? '<button type="button" class="quest-train"' + practiceAttr + '>' + esc(tx("train", { belt: beltName(nxt, l).toLowerCase() }, l)) + '</button>' : "") +
        "</div>"
      : '<p class="quest-done">' + esc(tx("topNow", null, l)) + "</p>";
    el.innerHTML = '<div class="quest-card" data-belt="' + (cur ? cur.key : "none") + '">' +
      '<div class="quest-head"><span class="quest-kicker">' + esc(tx("tagline", null, l)) + '</span><h2 class="quest-title">' + esc(tx("title", null, l)) + "</h2></div>" +
      '<div class="quest-current"><div class="quest-belt-wrap">' + beltSvg(cur) + '</div><div><span class="quest-label">' + esc(tx("yourBelt", null, l)) + '</span><strong class="quest-belt-name">' + esc(cur ? beltName(cur, l) : tx("noBelt", null, l)) + "</strong></div></div>" +
      nextBlock +
      '<div class="quest-stripe" role="group" aria-label="' + esc(tx("stripe", null, l)) + '">' + stripe + "</div>" +
      '<ul class="quest-locked-note"><li><span aria-hidden="true">' + LOCK + '</span>' + esc(beltName(BELTS[5], l)) + " / " + esc(beltName(BELTS[6], l).toLowerCase()) + ": " + esc(tx("comingSoon", null, l)) + '</li><li><span aria-hidden="true">' + LOCK + "</span>" + esc(tx("blackDesc", null, l)) + "</li></ul>" +
      '<details class="quest-how"><summary>' + esc(tx("howTitle", null, l)) + "</summary><p>" + esc(tx("how", null, l)) + "</p></details>" +
      "</div>";
  }

  // ---------- Ceremonien ----------
  var openCeremony = null;
  function closeCeremony() { if (openCeremony) openCeremony(); }

  function showCeremony(index, options) {
    options = options || {};
    closeCeremony();
    var belt = BELTS[index]; if (!belt || belt.locked || index >= ATTAINABLE) return null; // Lilla, brunt og sort kan ikke udløses nu.
    var l = lang();
    var doc = root.document;
    var lastFocus = doc.activeElement;
    var overlay = doc.createElement("div");
    overlay.className = "quest-ceremony quest-belt-" + belt.key;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "quest-ceremony-title");
    overlay.setAttribute("aria-describedby", "quest-ceremony-line");
    overlay.setAttribute("data-i18n-skip", "");
    overlay.style.setProperty("--belt", belt.color);
    overlay.style.setProperty("--edge", belt.edge);
    var captain = l === "en" ? KAPTAJN.en : KAPTAJN.da;
    var buddy = belt.buddy;
    var crew = belt.key === "black"
      ? '<div class="qc-crew" aria-hidden="true">' + CREW.map(function (m, i) { return '<img src="' + m.img + '" alt="" style="--i:' + i + '">'; }).join("") + "</div>"
      : "";
    var buddyHtml = buddy ? '<img class="qc-buddy" src="' + buddy.img + '" alt="' + esc(l === "en" ? buddy.en : buddy.da) + '">' : "";
    var replyWho = buddy ? (l === "en" ? buddy.en : buddy.da) : "";
    overlay.innerHTML =
      '<div class="qc-backdrop" aria-hidden="true"></div>' +
      '<div class="qc-spot" aria-hidden="true"></div>' +
      '<div class="qc-dust" aria-hidden="true">' + Array.from({ length: 14 }, function (_, i) { return '<i style="--d:' + i + '"></i>'; }).join("") + "</div>" +
      '<div class="qc-stage">' +
        '<p class="qc-kicker">' + esc(tx("kicker", null, l)) + "</p>" +
        '<h2 class="qc-title" id="quest-ceremony-title">' + esc(beltName(belt, l)) + "</h2>" +
        '<p class="qc-floor">✓ ' + esc(tx("floorDone", { floor: floorName(belt, l) }, l)) + "</p>" +
        '<div class="qc-scene">' + crew +
          '<img class="qc-captain" src="' + KAPTAJN.img + '" alt="' + esc(captain) + '">' +
          buddyHtml +
          '<div class="qc-belt">' + beltSvg(belt, { cls: "qc-belt-svg" }) + '<span class="qc-flash" aria-hidden="true"></span></div>' +
        "</div>" +
        '<div class="qc-speech"><span class="qc-who">' + esc(tx("presents", { captain: captain }, l)) + ' ' + esc(beltNameOf(belt, l)) + '</span>' +
          '<p class="qc-line" id="quest-ceremony-line">' + (l === "en" ? "“" : "»") + esc(belt.line[l]) + (l === "en" ? "”" : "«") + "</p>" +
          '<p class="qc-reply">' + (replyWho ? "<b>" + esc(replyWho) + ":</b> " : "") + esc(belt.reply[l]) + "</p>" +
          (belt.key === "black" ? '<p class="qc-tease">' + esc(tx("blackTease", null, l)) + "</p>" : "") +
        "</div>" +
        '<button type="button" class="qc-ready">' + esc(tx("ready", null, l)) + "</button>" +
      "</div>" +
      '<button type="button" class="qc-x" aria-label="' + esc(tx("close", null, l)) + '">×</button>';
    doc.body.appendChild(overlay);
    doc.documentElement.classList.add("quest-ceremony-open");
    var readyBtn = overlay.querySelector(".qc-ready");
    function onKey(ev) {
      if (ev.key === "Escape") { ev.preventDefault(); close(); }
      else if (ev.key === "Tab") {
        var f = Array.prototype.slice.call(overlay.querySelectorAll("button"));
        var first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && doc.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && doc.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    }
    function close() {
      doc.removeEventListener("keydown", onKey, true);
      overlay.remove();
      doc.documentElement.classList.remove("quest-ceremony-open");
      openCeremony = null;
      try { lastFocus && lastFocus.focus && lastFocus.focus(); } catch (e) {}
      if (options.onClose) options.onClose();
    }
    openCeremony = close;
    doc.addEventListener("keydown", onKey, true);
    readyBtn.addEventListener("click", close);
    overlay.querySelector(".qc-x").addEventListener("click", close);
    requestAnimationFrame(function () { overlay.classList.add("is-on"); try { readyBtn.focus({ preventScroll: true }); } catch (e) { readyBtn.focus(); } });
    return overlay;
  }

  // ---------- Montering ----------
  // ctx: { userId, floors (nedefra), storage? }
  function mount(el, ctx) {
    if (!el || !ctx) return function () {};
    var storage = ctx.storage || (function () { try { return root.localStorage; } catch (e) { return null; } })();
    var earnedNow = computeQuest(ctx.floors, 0).earnedNow;
    var celebrate = pendingCeremony(storage, ctx.userId, earnedNow);
    var state = { userId: ctx.userId, floors: ctx.floors, quest: computeQuest(ctx.floors, readSeen(storage, ctx.userId)) };
    function draw() { renderCard(el, state); }
    function onClick(ev) {
      var b = ev.target.closest && ev.target.closest("[data-quest-replay]");
      if (b && !b.disabled) { ev.preventDefault(); ev.stopPropagation(); showCeremony(Number(b.getAttribute("data-quest-replay"))); }
    }
    function onLang() { if (el.isConnected) draw(); else cleanup(); }
    function cleanup() { el.removeEventListener("click", onClick); root.document.removeEventListener("jm-langchange", onLang); }
    draw();
    el.addEventListener("click", onClick);
    root.document.addEventListener("jm-langchange", onLang);
    if (celebrate >= 0 && !ctx.noCeremony) setTimeout(function () { if (el.isConnected) showCeremony(celebrate); }, 450);
    return cleanup;
  }

  var api = {
    BELTS: BELTS, THRESHOLD: THRESHOLD, ATTAINABLE: ATTAINABLE, STORAGE_PREFIX: STORAGE_PREFIX,
    computeQuest: computeQuest, pendingCeremony: pendingCeremony, readSeen: readSeen, writeSeen: writeSeen,
    beltSvg: beltSvg, missingText: missingText, mount: mount, showCeremony: showCeremony, closeCeremony: closeCeremony,
  };
  root.JacobQuest = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
