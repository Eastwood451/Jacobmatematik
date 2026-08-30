/* jacobmatematik — al logik er almindelig JavaScript uden frameworks. */
(() => {
  "use strict";

  const STORAGE_KEY = "jacobmatematik-db-v1";
  const LEGACY_STORAGE_KEYS = ["matbootcamp-db-v1", "talvaerkstedet-db-v1"];
  const TOPICS = {
    letters: { name: "Bogstavlæring", icon: "A B C", description: "Find billedet med den rigtige startlyd" },
    numbers: { name: "Tallene", icon: "● ● ●", description: "Tæl figurer og fingre fra 0 til 10" },
    addition: { name: "Plusstykker", icon: "4 + 5", description: "Plus med etcifrede tal" },
    basics: { name: "Basisregler", icon: "0 · 1", description: "Regneregler med 0 og 1" },
    multiplication: { name: "Lille tabel", icon: "7 × 8", description: "Gangestykker fra 0×0 til 10×10" },
    tableDrill: { name: "Tabel-drill", icon: "3 × 4", description: "Udfyld hele 1–9-tabellen på tid" },
    pemdas: { name: "Regnehierarki", icon: "2 + 3 × 4", description: "Gange før plus og minus" },
    negatives: { name: "Negative tal", icon: "−4 + 7", description: "Plus, minus og gange" },
    distributive: { name: "Distributiv lov", icon: "3(4 + 5)", description: "Gang ind i parentesen" },
  };

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (items) => items[rand(0, items.length - 1)];
  const weightedPick = (items, weightForItem) => {
    const weighted = items.map(item => ({ item, weight:Math.max(0, Number(weightForItem(item)) || 0) }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (!total) return pick(items);
    let target = Math.random() * total;
    for (const entry of weighted) {
      target -= entry.weight;
      if (target <= 0) return entry.item;
    }
    return weighted[weighted.length - 1].item;
  };
  const shuffle = (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const otherIndex = rand(0, index);
      [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
    }
    return shuffled;
  };
  const SMALL_TABLES = Array.from({length:11}, (_,index) => index);
  const SINGLE_DIGITS = Array.from({length:10}, (_,index) => index);
  const ORDERED_NUMBER_KEYS = [...SMALL_TABLES.slice(1), 0];
  const TABLE_DRILL_VALUES = Array.from({length:9}, (_,index) => index + 1);
  const LETTER_ITEMS = [
    ["A","abe","a-abe.webp"],["B","bæver","b-baever.webp"],["C","cacao","c-cacao.webp"],
    ["D","delfin","d-delfin.webp"],["E","egern","e-egern.webp"],["F","fisk","f-fisk.webp"],
    ["G","gris","g-gris.webp"],["H","hund","h-hund.webp"],["I","isbjørn","i-isbjoern.webp"],
    ["J","jaguar","j-jaguar.webp"],["K","kat","k-kat.webp"],["L","løve","l-loeve.webp"],
    ["M","mus","m-mus.webp"],["N","næsehorn","n-naesehorn.webp"],["O","orm","o-orm.webp"],
    ["P","pingvin","p-pingvin.webp"],["Q","quokka","q-quokka.webp"],["R","ræv","r-raev.webp"],
    ["S","sæl","s-sael.webp"],["T","tiger","t-tiger.webp"],["U","ugle","u-ugle.webp"],
    ["V","vaskebjørn","v-vaskebjoern.webp"],["W","wienerhund","w-wienerhund.webp"],["X","x-ray-fisk","x-xray-fisk.webp"],
    ["Y","yver","y-yver.webp"],["Z","zebra","z-zebra.webp"],["Æ","æsel","ae-aesel.webp"],
    ["Ø","økse","oe-oekse.webp"],["Å","ål","aa-aal.webp"],
  ].map(([letter,word,file]) => ({ letter, word, image:`assets/letters/${file}` }));
  const LETTER_KEYS = LETTER_ITEMS.map(item => item.letter);
  const SPEED_DRILLS = new Set(["numbers", "addition", "multiplication", "tableDrill"]);
  const makeTask = (topic, expression, answer, hint = "", options = {}) => ({ topic, expression, answer, hint, ...options });

  /* Hvert emne er et selvstændigt modul med generate, calculate og evaluate. */
  const MathModules = {
    letters: {
      generate(level, user) {
        const assigned = (user?.assignedLetters || LETTER_KEYS).filter(letter => LETTER_KEYS.includes(letter));
        const target = LETTER_ITEMS.find(item => item.letter === pick(assigned.length ? assigned : LETTER_KEYS));
        const distractors = shuffle(LETTER_ITEMS.filter(item => item.letter !== target.letter)).slice(0,3);
        return makeTask("letters", target.letter, target.letter, "Tryk på billedet, der begynder med bogstavets lyd.", { target, choices:shuffle([target,...distractors]) });
      },
      calculate: letter => letter,
      evaluate: (answer, task) => answer === task.answer,
    },
    numbers: {
      generate(level, user) {
        // Antallet vælges blandt lærerens tal. Sølv vises halvt så ofte,
        // og guld vises en tiendedel så ofte som et endnu ikke lært tal.
        const assigned = (user?.assignedNumbers || SMALL_TABLES).filter(number => SMALL_TABLES.includes(number));
        const available = assigned.length ? assigned : SMALL_TABLES;
        const grouped = numberValueStats(user || { results:[] });
        const count = weightedPick(available, number => numberPracticeWeight(numberMastery(grouped.get(String(number)) || [])));
        const shapes = Array.from({length:count}, () => pick(["circle", "square", "triangle", "diamond"]));
        const countingMode = Math.random() < .5 ? "shapes" : "hands";
        const hint = countingMode === "hands" ? "Tæl fingrene på hænderne." : "Tæl figurerne i feltet.";
        return makeTask("numbers", `Antal ${count}`, count, hint, { count, shapes, countingMode });
      },
      calculate: count => count,
      evaluate: (answer, task) => Number(answer) === task.answer,
    },
    addition: {
      generate(level, user) {
        // Begge led vælges kun blandt de tal, læreren har markeret.
        const assignedFirst = (user?.assignedAddends || SINGLE_DIGITS).filter(number => SINGLE_DIGITS.includes(number));
        const assignedSecond = (user?.assignedAddendSeconds || SINGLE_DIGITS).filter(number => SINGLE_DIGITS.includes(number));
        const a = pick(assignedFirst.length ? assignedFirst : SINGLE_DIGITS);
        const b = pick(assignedSecond.length ? assignedSecond : SINGLE_DIGITS);
        return makeTask("addition", `${a} + ${b}`, this.calculate(a, b));
      },
      calculate: (a, b) => a + b,
      evaluate: (answer, task) => Number(answer) === task.answer,
    },
    basics: {
      generate(level) {
        const number = rand(2, level === 1 ? 9 : level === 2 ? 20 : 50);
        const rules = [
          () => makeTask("basics", `${number} × 0`, 0),
          () => makeTask("basics", `0 × ${number}`, 0),
          () => makeTask("basics", `${number} × 1`, number),
          () => makeTask("basics", `1 × ${number}`, number),
          () => makeTask("basics", `${number} ÷ 1`, number),
          () => makeTask("basics", `${number} ÷ ${number}`, 1),
          () => makeTask("basics", `0 ÷ ${number}`, 0),
          () => makeTask("basics", `${number} ÷ 0`, "undefined", "Vælg det svar, der passer til reglen.", { answerType:"undefined" }),
          () => makeTask("basics", `0 ÷ 0`, "undefined", "Vælg det svar, der passer til reglen.", { answerType:"undefined" }),
        ];
        return pick(rules)();
      },
      calculate: (a, operation, b) => operation === "×" ? a * b : b === 0 ? "undefined" : a / b,
      evaluate: (answer, task) => task.answerType === "undefined" ? answer === "Kan ikke beregnes" : Number(answer) === task.answer,
    },
    multiplication: {
      generate(level, user) {
        // Første faktor vælges kun blandt de tabeller, læreren har markeret.
        const assigned = (user?.assignedTables || SMALL_TABLES).filter(number => SMALL_TABLES.includes(number));
        const a = pick(assigned.length ? assigned : SMALL_TABLES), b = rand(0, 10);
        return makeTask("multiplication", `${a} × ${b}`, this.calculate(a, b));
      },
      calculate: (a, b) => a * b,
      evaluate: (answer, task) => Number(answer) === task.answer,
    },
    tableDrill: {
      generate() {
        const row = pick(TABLE_DRILL_VALUES), column = pick(TABLE_DRILL_VALUES);
        return makeTask("tableDrill", `${row} × ${column}`, row * column, "", { row, column });
      },
      calculate: (a, b) => a * b,
      evaluate: (answer, task) => Number(answer) === task.answer,
    },
    pemdas: {
      generate(level) {
        if (level === 1) {
          const a = rand(1, 10), b = rand(2, 6), c = rand(2, 6);
          return makeTask("pemdas", `${a} + ${b} × ${c}`, this.calculate(a, "+", b, "×", c), "Gang før plus.");
        }
        if (level === 2) {
          const a = rand(2, 9), b = rand(2, 8), c = rand(1, 8), op = pick(["+", "−"]);
          return makeTask("pemdas", `${a} × ${b} ${op} ${c}`, this.calculate(a, "×", b, op, c), "Regn gangeleddet først.");
        }
        const a = rand(2, 6), b = rand(1, 7), c = rand(2, 5), d = rand(1, 8);
        return makeTask("pemdas", `(${a} + ${b}) × ${c} − ${d}`, (a + b) * c - d, "Parentesen kommer først.");
      },
      calculate(a, op1, b, op2, c) {
        const apply = (x, op, y) => op === "+" ? x + y : op === "−" ? x - y : x * y;
        if (op1 === "×") return apply(apply(a, op1, b), op2, c);
        return apply(a, op1, apply(b, op2, c));
      },
      evaluate: (answer, task) => Number(answer) === task.answer,
    },
    negatives: {
      generate(level) {
        const limit = level === 1 ? 6 : level === 2 ? 10 : 15;
        const signs = pick([[1,1],[1,-1],[-1,1],[-1,-1]]);
        const a = rand(1, limit) * signs[0], b = rand(1, level === 1 ? 6 : limit) * signs[1];
        const op = level === 1 ? "+" : pick(["+", "−", "×"]);
        const shownB = b < 0 ? `(${b})` : b;
        const hint = op === "×" ? "Se på fortegnene først." : "Tænk på en tallinje.";
        return makeTask("negatives", `${a} ${op} ${shownB}`, this.calculate(a, op, b), hint);
      },
      calculate: (a, op, b) => op === "+" ? a + b : op === "−" ? a - b : a * b,
      evaluate: (answer, task) => Number(answer) === task.answer,
    },
    distributive: {
      generate(level) {
        const outer = rand(2, level === 3 ? 9 : 5), a = rand(2, level === 1 ? 6 : 10), b = rand(1, level === 3 ? 12 : 7);
        const minus = level === 3 && Math.random() > .55;
        const expression = `${outer} × (${a} ${minus ? "−" : "+"} ${b})`;
        return makeTask("distributive", expression, this.calculate(outer, a, minus ? -b : b), `${outer}×${a} ${minus ? "−" : "+"} ${outer}×${b}`);
      },
      calculate: (outer, a, b) => outer * a + outer * b,
      evaluate: (answer, task) => Number(answer) === task.answer,
    },
  };

  function seedResults(profile) {
    const patterns = {
      strong: { accuracy: .92, time: [2.4, 5.3] },
      steady: { accuracy: .74, time: [5.2, 9.4] },
      needsWork: { accuracy: .48, time: [9.2, 14.8] },
      new: { accuracy: .65, time: [6.5, 11.2] },
    };
    const results = [];
    const numberExamples = [3,7,5,9,2,8,4,10,6,1,0];
    const additionExamples = [[4,5],[5,4],[7,2],[2,7],[6,3],[3,6],[8,1],[1,8],[5,3],[3,5]];
    const multiplicationExamples = [[7,9],[9,7],[6,8],[8,6],[4,7],[7,4],[3,9],[9,3],[5,8],[8,5],[2,6],[6,2]];
    const negativeExamples = [[3,"+",4],[3,"+",-4],[-3,"+",4],[-3,"+",-4],[5,"−",2],[5,"−",-2],[-5,"−",2],[-5,"−",-2],[3,"×",4],[3,"×",-4],[-3,"×",4],[-3,"×",-4]];
    Object.keys(TOPICS).forEach((topic, topicIndex) => {
      const p = patterns[profile[topic] || "steady"];
      const sampleCount = topic === "negatives" ? negativeExamples.length : 8 + topicIndex;
      for (let i = 0; i < sampleCount; i++) {
        const number = numberExamples[i % numberExamples.length];
        const addition = additionExamples[i % additionExamples.length];
        const pair = multiplicationExamples[i % multiplicationExamples.length];
        const negative = negativeExamples[i % negativeExamples.length];
        const task = topic === "numbers"
          ? makeTask("numbers", `Antal ${number}`, number)
          : topic === "addition"
          ? makeTask("addition", `${addition[0]} + ${addition[1]}`, addition[0] + addition[1])
          : topic === "multiplication"
          ? makeTask("multiplication", `${pair[0]} × ${pair[1]}`, pair[0] * pair[1])
          : topic === "negatives"
          ? makeTask("negatives", `${negative[0]} ${negative[1]} ${negative[2] < 0 ? `(${negative[2]})` : negative[2]}`, MathModules.negatives.calculate(...negative))
          : MathModules[topic].generate(2);
        const correct = ((i * 17 + topicIndex * 7) % 100) / 100 < p.accuracy;
        const sampleTime = +(p.time[0] + ((i * 13) % 10) / 10 * (p.time[1] - p.time[0])).toFixed(1);
        results.push({ topic, problem: task.expression, correct, answer: correct ? task.answer : task.answer + 2, correctAnswer: task.answer, responseTime:SPEED_DRILLS.has(topic) ? Math.min(10, sampleTime) : sampleTime, timestamp: new Date(Date.now() - (results.length + 1) * 36e5 * 9).toISOString() });
      }
    });
    return results;
  }

  function defaultDatabase() {
    return {
      classes: [{ id:"c1", name:"Demoklasse" }],
      users: [],
    };
  }

  function loadDatabase() {
    try {
      const legacyStorageKey = LEGACY_STORAGE_KEYS.find(key => localStorage.getItem(key));
      const stored = localStorage.getItem(STORAGE_KEY) || (legacyStorageKey ? localStorage.getItem(legacyStorageKey) : null);
      if (stored && !localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, stored);
      return JSON.parse(stored) || defaultDatabase();
    }
    catch { return defaultDatabase(); }
  }
  function normalizeDatabase(database, includeLocalSchoolData = true) {
    if (!Array.isArray(database.classes) || !database.classes.length) database.classes = includeLocalSchoolData
      ? [{id:"c1",name:"7.A"},{id:"c2",name:"8.B"}]
      : [{id:`c-${Date.now().toString(36)}`,name:"Min klasse"}];
    const validIds = new Set(database.classes.map(item => item.id));
    (database.users || []).filter(user => user.role === "student").forEach(user => {
      if (!validIds.has(user.classId)) user.classId = ["s3","s4"].includes(user.id) && validIds.has("c2") ? "c2" : database.classes[0].id;
      if (!Array.isArray(user.assignedTables) || !user.assignedTables.length) user.assignedTables = [...SMALL_TABLES];
      user.assignedTables = [...new Set(user.assignedTables.map(Number).filter(number => SMALL_TABLES.includes(number)))].sort((a,b)=>a-b);
      if (!Array.isArray(user.assignedNumbers) || !user.assignedNumbers.length) user.assignedNumbers = [...SMALL_TABLES];
      user.assignedNumbers = [...new Set(user.assignedNumbers.map(Number).filter(number => SMALL_TABLES.includes(number)))].sort((a,b)=>a-b);
      if (!Array.isArray(user.assignedAddends) || !user.assignedAddends.length) user.assignedAddends = [...SINGLE_DIGITS];
      user.assignedAddends = [...new Set(user.assignedAddends.map(Number).filter(number => SINGLE_DIGITS.includes(number)))].sort((a,b)=>a-b);
      if (!Array.isArray(user.assignedAddendSeconds) || !user.assignedAddendSeconds.length) user.assignedAddendSeconds = [...SINGLE_DIGITS];
      user.assignedAddendSeconds = [...new Set(user.assignedAddendSeconds.map(Number).filter(number => SINGLE_DIGITS.includes(number)))].sort((a,b)=>a-b);
      if (!Array.isArray(user.assignedLetters) || !user.assignedLetters.length) user.assignedLetters = [...LETTER_KEYS];
      user.assignedLetters = LETTER_KEYS.filter(letter => user.assignedLetters.includes(letter));
    });
    return database;
  }
  let db = normalizeDatabase(loadDatabase());
  const state = { user: null, view: "login", selectedTopic: "mixed", task: null, taskStartedAt: 0, answered: false, questionNumber: 1, sessionCorrect: 0, sessionAnswers: [], tableDrill:null, expandedStudent: "s1", activeClassId:null, teacherTopicDetail: null, studentFormOpen: false, teacherPasswordFormOpen: false, teacherUsernameFormOpen: false, classRenameFormOpen: false };
  const app = document.getElementById("app");
  const backend = window.JacobBackend;
  const usingCentralDatabase = Boolean(backend?.configured);
  let remoteSaveQueue = Promise.resolve();
  let tableDrillTimerId = null;
  const save = () => {
    if (!usingCentralDatabase) { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); return Promise.resolve(); }
    if (state.user?.role !== "teacher") return Promise.resolve();
    remoteSaveQueue = remoteSaveQueue
      .then(() => backend.saveSchoolState(db, state.user.id))
      .catch(error => { console.error("Synkronisering mislykkedes", error); });
    return remoteSaveQueue;
  };
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  // Den faktiske svartid bruges til læring. Farveskalaer kan stadig afrunde visuelt ved 10 sekunder.
  const recordedTime = (result) => Math.max(0, Number(result.responseTime) || 0);

  /* De seneste 20 svar pr. emne styrer nøjagtighed, tid, niveau og vægt. */
  function getStats(user, topic) {
    const items = (user.results || []).filter(r => r.topic === topic).slice(-20);
    if (!items.length) return { count:0, accuracy:0, avgTime:0, level:1, weight:1.5, status:"new" };
    const accuracy = items.filter(r => r.correct).length / items.length;
    const avgTime = items.reduce((sum, r) => sum + recordedTime(r), 0) / items.length;
    if (accuracy > .85 && avgTime < 5) return { count:items.length, accuracy, avgTime, level:3, weight:.65, status:"strong" };
    if (accuracy < .60 || avgTime > 10) return { count:items.length, accuracy, avgTime, level:1, weight:2.2, status:"weak" };
    return { count:items.length, accuracy, avgTime, level:2, weight:1.1, status:"medium" };
  }
  function chooseWeightedTopic(user) {
    const pool = Object.keys(TOPICS).filter(topic => topic !== "tableDrill").map(topic => ({ topic, weight:getStats(user, topic).weight }));
    let pointer = Math.random() * pool.reduce((sum, item) => sum + item.weight, 0);
    for (const item of pool) { pointer -= item.weight; if (pointer <= 0) return item.topic; }
    return pool[0].topic;
  }

  function header() {
    const userLabel = state.user.role === "teacher" ? "Lærer" : `${escapeHtml(state.user.name)} · Elev`;
    const passwordButton = state.user.role === "student" ? `<button class="btn ghost" data-action="change-password">Skift adgangskode</button>` : "";
    return `<header class="topbar"><div class="brand"><span class="brand-mark">∑</span><span>jacobmatematik</span></div><div class="top-actions"><span class="user-pill">${userLabel}</span>${passwordButton}<button class="btn ghost" data-action="logout">Log ud</button></div></header>`;
  }
  function renderLogin() {
    app.innerHTML = `<div class="login-wrap"><section class="login-intro"><span class="eyebrow">Matematik der følger dig</span><h1>Bliv stærkere, ét svar ad gangen.</h1><p>jacobmatematik finder det niveau, der udfordrer dig tilpas — og giver mere træning dér, hvor du har brug for den.</p><div class="math-trail"><span>7 × 8</span><span>−4 + 9</span><span>3(2 + 5)</span><span>6 + 2 × 4</span></div></section><section class="login-panel"><form class="login-card" id="login-form"><h2>Godt at se dig</h2><p>Log ind som elev eller lærer for at fortsætte.</p><div class="field"><label for="username">Brugernavn</label><input id="username" name="username" autocomplete="username" autocapitalize="none" placeholder="fx alma7" required></div><div class="field"><label for="password">Adgangskode</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Din adgangskode" required></div><p id="login-error" class="error" role="alert"></p><button class="btn full" type="submit">Log ind</button></form></section></div>`;
    document.getElementById("username").focus();
  }
  function renderStudentHome() {
    const stats = Object.keys(TOPICS).map(topic => ({ topic, ...getStats(state.user, topic) }));
    const total = (state.user.results || []).length;
    app.innerHTML = `${header()}<div class="page"><section class="hero-line"><div><span class="eyebrow">Din træning</span><h1>Hej ${escapeHtml(state.user.name)}!</h1><p>Hvad vil du øve i dag?</p></div><div class="streak"><span>I alt løst</span><strong>${total} opgaver</strong></div></section><h2 class="section-label">Vælg et område</h2><section class="topic-grid">${Object.entries(TOPICS).map(([key,t]) => `<button class="topic-card" data-topic="${key}"><span class="topic-icon">${t.icon}</span><strong>${t.name}</strong><small>${t.description}</small></button>`).join("")}<button class="topic-card mixed" data-topic="mixed"><span class="topic-icon">∞</span><strong>Blandet træning</strong><small>Systemet vælger smart for dig</small></button></section><h2 class="section-label">Dine seneste tal</h2><section class="recent-strip">${stats.map(s => `<article class="mini-stat"><span>${TOPICS[s.topic].name}</span><strong>${s.count ? Math.round(s.accuracy*100)+" %" : "Ny"}</strong><small>${s.count ? s.avgTime.toFixed(1)+" sek. i snit" : "Klar til første opgave"}</small></article>`).join("")}</section></div>`;
  }
  function renderStudentPassword() {
    app.innerHTML = `${header()}<div class="page"><section class="class-manager"><div class="class-manager-title"><div><span class="eyebrow">Min profil</span><h1>Skift adgangskode</h1><p>Vælg en ny adgangskode til din bruger.</p></div></div><form id="student-password-form" class="student-form"><div class="field"><label for="current-password">Nuværende adgangskode</label><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required></div><div class="field"><label for="new-password">Ny adgangskode</label><input id="new-password" name="newPassword" type="password" autocomplete="new-password" required></div><div class="field"><label for="confirm-password">Gentag ny adgangskode</label><input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" required></div><p id="password-error" class="student-error" role="alert"></p><div class="student-manager-buttons"><button class="btn" type="submit">Gem adgangskode</button><button class="btn secondary" type="button" data-action="home">Annuller</button></div></form></section></div>`;
    document.getElementById("current-password").focus();
  }
  function stopTableDrillTimer() {
    if (tableDrillTimerId) clearInterval(tableDrillTimerId);
    tableDrillTimerId = null;
  }
  function formatTableDrillTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
  }
  function updateTableDrillTimer() {
    const timer = document.getElementById("table-drill-time");
    const drill = state.tableDrill;
    if (!timer || !drill) return;
    timer.textContent = formatTableDrillTime((drill.completedAt || Date.now()) - drill.startedAt);
  }
  function startTableDrill(options = {}) {
    stopTableDrillTimer();
    const allPairs = TABLE_DRILL_VALUES.flatMap(row => TABLE_DRILL_VALUES.map(column => ({ row, column })));
    const pairs = options.pairs?.length ? options.pairs : allPairs;
    const cells = { ...(options.cells || {}) };
    pairs.forEach(({row,column}) => delete cells[`${row}-${column}`]);
    state.tableDrill = {
      pairs:shuffle(pairs),
      currentIndex:0,
      cells,
      roundResults:{},
      errors:0,
      startedAt:Date.now(),
      completedAt:null,
      confirmationMode:options.confirmationMode || state.tableDrill?.confirmationMode || "enter",
      troubleRound:Boolean(options.pairs),
    };
    state.selectedTopic="tableDrill"; state.questionNumber=1; state.sessionCorrect=0; state.sessionAnswers=[]; state.view="exercise";
    tableDrillTimerId = setInterval(updateTableDrillTimer, 1000);
    newTask();
  }
  function newTask() {
    const topic = state.selectedTopic === "mixed" ? chooseWeightedTopic(state.user) : state.selectedTopic;
    if (topic === "tableDrill") {
      const drill = state.tableDrill;
      const pair = drill?.pairs[drill.currentIndex];
      if (!pair) {
        if (drill && !drill.completedAt) drill.completedAt=Date.now();
        stopTableDrillTimer(); state.task=null; state.answered=false; renderTableDrill(); return;
      }
      state.task=makeTask("tableDrill", `${pair.row} × ${pair.column}`, pair.row * pair.column, "", pair);
      state.taskStartedAt=Date.now(); state.answered=false; renderTableDrill(); return;
    }
    state.task = MathModules[topic].generate(getStats(state.user, topic).level, state.user);
    state.taskStartedAt = Date.now(); state.answered = false;
    renderExercise();
  }
  function renderExercise() {
    const task = state.task;
    if (task?.topic === "tableDrill") { renderTableDrill(); return; }
    if (task?.topic === "letters") { renderLetterExercise(); return; }
    const cycleStart = Math.floor((state.questionNumber - 1) / 10) * 10;
    const cycleAnswers = state.sessionAnswers.slice(cycleStart, cycleStart + 10);
    // Historikken følger den konkrete opgave. Fx vurderes 7 + 2 og 2 + 7 hver for sig.
    const drillAttempts = SPEED_DRILLS.has(task.topic)
      ? (state.user.results || []).filter(item => item.topic === task.topic && item.problem === task.expression).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-8)
      : [];
    const masterySeconds = task.topic === "numbers" ? 10 : 5;
    const attemptHistory = drillAttempts.length ? `<aside class="pair-history" aria-label="Historik for denne opgave">${drillAttempts.map(item => {
      const fast = item.correct && recordedTime(item) <= masterySeconds;
      const kind = !item.correct ? "wrong" : fast ? "fast" : "slow";
      const label = !item.correct ? "Forkert besvaret" : fast ? `Korrekt på højst ${masterySeconds} sekunder` : `Korrekt på over ${masterySeconds} sekunder`;
      return `<span class="history-mark ${kind}" role="img" aria-label="${label}" title="${label} · ${recordedTime(item).toFixed(1)} s">${item.correct ? "✓" : "×"}</span>`;
    }).join("")}</aside>` : "";
    const learnedPairs = ["multiplication", "addition"].includes(task.topic)
      ? [...(task.topic === "multiplication" ? multiplicationPairStats(state.user) : additionPairStats(state.user)).entries()]
          .filter(([,items]) => drillMastery(items).learned)
          .map(([key]) => key.split("-").map(Number))
          .sort((left,right) => left[0] - right[0] || left[1] - right[1])
      : [];
    const numberCoins = task.topic === "numbers"
      ? [...numberValueStats(state.user).entries()]
          .map(([key,items]) => ({ number:Number(key), ...numberMastery(items) }))
          .filter(item => item.stage !== "none")
          .sort((a,b)=>a.number-b.number)
      : [];
    const operator = task.topic === "addition" ? "+" : "×";
    const learnedSection = learnedPairs.length || numberCoins.length ? `<section class="learned-pairs" aria-label="Lærte opgaver">
      <h2>Lærte</h2>
      <div class="learned-pair-list">${learnedPairs.map(([a,b]) => `<div class="learned-pair" role="img" aria-label="${a} ${operator === "+" ? "plus" : "gange"} ${b} er lært" title="${a} ${operator} ${b} er lært"><strong aria-hidden="true">✓</strong><span>${a}</span><span>${b}</span></div>`).join("")}${numberCoins.map(({number,stage}) => `<div class="learned-number-coin ${stage}" role="img" aria-label="Tallet ${number} er på en ${stage === "gold" ? "guldmønt" : "sølvmønt"}" title="${stage === "gold" ? "Guld" : "Sølv"}: tallet ${number}"><span aria-hidden="true">${number}</span></div>`).join("")}</div>
    </section>` : "";
    const undefinedKey = task.answerType === "undefined"
      ? `<button class="key utility impossible" type="button" data-key="undefined">Kan ikke beregnes</button>`
      : "";
    // I Tallene står svarene 1–10 med 0 til sidst, indtil det aktuelle antal er lært.
    // Derefter blandes alle svarmuligheder fra 0 til 10 ved hver ny opgave.
    const learnedNumberTask = task.topic === "numbers" && numberCoins.some(item => item.number === Number(task.answer));
    const keypadNumbers = task.topic === "numbers"
      ? (learnedNumberTask ? shuffle(SMALL_TABLES) : ORDERED_NUMBER_KEYS)
      : shuffle(SINGLE_DIGITS);
    const signedKey = task.topic === "numbers"
      ? ""
      : `<button class="key utility" type="button" data-key="minus" aria-label="Minustegn">−</button>`;
    const answerSection = `<form class="answer-area" id="answer-form">
          <label class="sr-only" for="answer">Dit svar</label>
          <input class="answer-input" id="answer" name="answer" inputmode="none" autocomplete="off" placeholder="Dit svar" readonly>
          <div class="keypad" aria-label="Taltastatur">
            ${keypadNumbers.map(number => `<button class="key" type="button" data-key="${number}">${number}</button>`).join("")}
            ${signedKey}
            <button class="key utility" type="button" data-key="delete">Slet</button>
            ${undefinedKey}
            <button class="key enter" type="button" data-key="enter">Enter</button>
          </div>
          <p id="answer-error" class="error" role="alert"></p>
        </form>`;
    const shownAnswer = task.answer === "undefined" ? "Kan ikke beregnes" : task.answer;
    const pairParts = task.topic === "multiplication" ? task.expression.split(" × ") : task.topic === "addition" ? task.expression.split(" + ") : [];
    const correctionOperator = task.topic === "addition" ? "+" : "×";
    const correctionSection = ["multiplication", "addition"].includes(task.topic) && pairParts.length === 2
      ? `<section class="correction-area" role="alert"><p>Det korrekte svar er</p><button class="correction-wheel" type="button" data-action="continue-after-correction" aria-label="Det korrekte svar er ${escapeHtml(shownAnswer)}. Tryk for næste opgave"><strong>${escapeHtml(shownAnswer)}</strong><span class="correction-pair"><span>${escapeHtml(pairParts[0])}</span><i class="correction-operator" aria-hidden="true">${correctionOperator}</i><span>${escapeHtml(pairParts[1])}</span></span></button><small>Tryk på svaret for næste opgave</small></section>`
      : `<section class="correction-area" role="alert"><p>Det korrekte svar er</p><button class="correction-answer" type="button" data-action="continue-after-correction">${escapeHtml(shownAnswer)}</button><small>Tryk på svaret for næste opgave</small></section>`;
    const taskVisual = task.topic === "numbers"
      ? task.countingMode === "hands"
        ? renderCountingHands(task.count)
        : `<div class="counting-field" role="img" aria-label="${task.count ? Array.from({length:task.count},()=>"figur").join(", ") : "Et tomt felt"}">${task.shapes.map((shape,index) => `<span class="count-shape ${shape} color-${index%4}" aria-hidden="true"></span>`).join("")}</div>`
      : `<div class="expression">${task.expression}</div>`;

    app.innerHTML = `${header()}<div class="page exercise-page">
      <div class="exercise-head"><button class="btn secondary" data-action="home">← Vælg emne</button><span class="topic-tag">${TOPICS[task.topic].name}</span></div>
      <section class="question-card">
        <div class="question-top"><span class="question-number">Opgave ${state.questionNumber}</span><div class="question-main ${attemptHistory ? "with-history" : ""}">${taskVisual}${attemptHistory}</div><p class="hint">${escapeHtml(task.hint || "Skriv dit svar nedenfor.")}</p></div>
        ${state.answered ? correctionSection : answerSection}
      </section>
      <div class="progress-row" aria-label="Svar i denne runde">${Array.from({length:10},(_,i)=>`<i class="progress-dot ${cycleAnswers[i] === true ? "correct" : cycleAnswers[i] === false ? "wrong" : ""}"></i>`).join("")}</div>
      ${learnedSection}
    </div>`;
  }
  function renderLetterExercise() {
    const task = state.task;
    const cycleStart = Math.floor((state.questionNumber - 1) / 10) * 10;
    const cycleAnswers = state.sessionAnswers.slice(cycleStart, cycleStart + 10);
    app.innerHTML = `${header()}<div class="page exercise-page letter-learning-page">
      <div class="exercise-head"><button class="btn secondary" data-action="home">← Vælg emne</button><span class="topic-tag">Bogstavlæring</span></div>
      <section class="letter-learning-card">
        <div class="letter-prompt"><span class="question-number">Opgave ${state.questionNumber}</span><strong aria-label="Bogstavet ${escapeHtml(task.expression)}">${escapeHtml(task.expression)}</strong><p>${escapeHtml(task.hint)}</p></div>
        <div class="letter-choice-grid" role="group" aria-label="Vælg billedet med den rigtige startlyd">${task.choices.map(item => `<button class="letter-picture-button" type="button" data-letter-choice="${item.letter}" aria-label="${escapeHtml(item.word)}"><img src="${item.image}" alt="${escapeHtml(item.word)}" draggable="false"></button>`).join("")}</div>
        <p id="letter-error" class="error letter-error" role="alert"></p>
      </section>
      <div class="progress-row" aria-label="Svar i denne runde">${Array.from({length:10},(_,i)=>`<i class="progress-dot ${cycleAnswers[i] === true ? "correct" : cycleAnswers[i] === false ? "wrong" : ""}"></i>`).join("")}</div>
    </div>`;
  }
  function persistLetterResult(result) {
    if (!usingCentralDatabase) {
      save().catch(error => console.error("Bogstavsvaret kunne ikke gemmes lokalt", error));
      return;
    }
    // Gem i baggrunden, så en langsom netværksanmodning aldrig låser næste opgave.
    backend.appendResult(state.user.id, result)
      .then(remoteId => { result.remoteId=remoteId; })
      .catch(error => console.error("Bogstavsvaret kunne ikke gemmes", error));
  }
  function submitLetterAnswer(answer) {
    if (state.answered || state.task?.topic !== "letters") return;
    state.answered=true;
    const task=state.task;
    const correct=MathModules.letters.evaluate(answer,task);
    const responseTime=Math.max(.1,(Date.now()-state.taskStartedAt)/1000);
    state.sessionAnswers.push(correct); if (correct) state.sessionCorrect++;
    const choice=LETTER_ITEMS.find(item=>item.letter===answer);
    const result={topic:"letters",problem:`${task.expression} som startlyd`,answer:choice?.word || answer,correctAnswer:task.target.word,correct,responseTime:+responseTime.toFixed(2),timestamp:new Date().toISOString()};
    state.user.results.push(result);
    const pressed=document.querySelector(`[data-letter-choice="${CSS.escape(answer)}"]`);
    if (pressed) pressed.classList.add(correct ? "correct" : "wrong");

    // Gå direkte videre, før lagringen overhovedet startes.
    // Dermed kan hverken en synkron Supabase-fejl eller en langsom anmodning låse øvelsen.
    state.questionNumber++;
    newTask();
    try { persistLetterResult(result); }
    catch (error) { console.error("Bogstavsvaret kunne ikke sættes til lagring", error); }
  }
  function renderTableDrill() {
    const drill = state.tableDrill;
    if (!drill) { startTableDrill(); return; }
    const task = state.task;
    const activeRow = task?.row;
    const activeColumn = task?.column;
    const elapsed = (drill.completedAt || Date.now()) - drill.startedAt;
    const completedInRound = Object.keys(drill.roundResults).length;
    const troublePairs = Object.entries(drill.roundResults)
      .filter(([,attempt]) => !attempt.correct || attempt.responseTime > 4)
      .map(([key]) => { const [row,column]=key.split("-").map(Number); return {row,column}; });
    const cellStyle = attempt => {
      if (!attempt.correct || attempt.responseTime >= 10) return "--cell-color:hsl(0 72% 78%)";
      if (attempt.responseTime <= 4) return "--cell-color:hsl(138 55% 72%)";
      const hue = Math.round(138 * (10 - attempt.responseTime) / 6);
      return `--cell-color:hsl(${hue} 68% 76%)`;
    };
    const grid = `<table class="table-drill-grid" aria-label="Gangetabel fra 1 til 9">
      <thead><tr><th aria-hidden="true"></th>${TABLE_DRILL_VALUES.map(column => `<th class="${column === activeColumn ? "active-axis" : ""}" scope="col">${column}</th>`).join("")}</tr></thead>
      <tbody>${TABLE_DRILL_VALUES.map(row => `<tr><th class="${row === activeRow ? "active-axis" : ""}" scope="row">${row}</th>${TABLE_DRILL_VALUES.map(column => {
        const key=`${row}-${column}`, attempt=drill.cells[key], solved=Boolean(attempt), active=row===activeRow && column===activeColumn;
        const classes=[row===activeRow?"active-row":"",column===activeColumn?"active-column":"",solved?"solved timed":"",attempt && !attempt.correct?"wrong":"",active?"active-cell":""].filter(Boolean).join(" ");
        const contents=active ? `<span>${row}×${column}</span><strong id="table-drill-cell-answer"></strong>` : solved ? `<strong>${row*column}</strong>${attempt.correct ? "" : `<i aria-hidden="true">×</i>`}` : "";
        const timing=solved ? `${attempt.correct ? "korrekt" : "forkert"} på ${attempt.responseTime.toFixed(1)} sekunder` : "";
        return `<td class="${classes}" ${solved ? `style="${cellStyle(attempt)}"` : ""} aria-label="${row} gange ${column}${solved ? ` er ${row*column}, ${timing}` : active ? ", aktiv opgave" : ""}">${contents}</td>`;
      }).join("")}</tr>`).join("")}</tbody>
    </table>`;
    const answerPanel = drill.completedAt
      ? `<section class="table-drill-complete"><span class="complete-mark">${troublePairs.length ? "↻" : "✓"}</span><h2>${troublePairs.length ? `${troublePairs.length} ${troublePairs.length === 1 ? "driller" : "drillere"}` : "Alle sidder hurtigt!"}</h2><p>${troublePairs.length ? "Øv dem, der var forkerte eller tog over 4 sekunder." : "Alle blev besvaret korrekt på højst 4 sekunder."}</p><strong>${formatTableDrillTime(elapsed)}</strong><p>${drill.errors} ${drill.errors === 1 ? "fejl" : "fejl"}</p>${troublePairs.length ? `<button class="btn full" type="button" data-action="practice-table-troubles">Øv drillerne (${troublePairs.length})</button>` : ""}<button class="btn secondary full" type="button" data-action="restart-table-drill">Start hele tabellen igen</button></section>`
      : `<form class="table-drill-answer" id="answer-form"><fieldset class="table-drill-mode"><legend>Svarmetode</legend><button class="${drill.confirmationMode === "enter" ? "active" : ""}" type="button" data-drill-mode="enter" aria-pressed="${drill.confirmationMode === "enter"}">Bekræft med Enter</button><button class="${drill.confirmationMode === "auto" ? "active" : ""}" type="button" data-drill-mode="auto" aria-pressed="${drill.confirmationMode === "auto"}">Autobekræft</button></fieldset><label for="answer">Skriv resultatet</label><input class="sr-only" id="answer" name="answer" inputmode="none" autocomplete="off" readonly><div class="table-drill-answer-preview" aria-live="polite"><span>${task.row} × ${task.column} =</span><strong id="table-drill-answer-preview">?</strong></div><div class="keypad table-drill-keypad ${drill.confirmationMode === "auto" ? "auto" : ""}" aria-label="Taltastatur">${TABLE_DRILL_VALUES.map(number => `<button class="key" type="button" data-key="${number}">${number}</button>`).join("")}<button class="key" type="button" data-key="0">0</button><button class="key utility" type="button" data-key="delete">Slet</button>${drill.confirmationMode === "enter" ? `<button class="key enter" type="button" data-key="enter">Enter</button>` : ""}</div><p id="answer-error" class="error" role="alert"></p></form>`;
    const progressLabel=drill.troubleRound ? "Drillere" : "Udfyldt";
    app.innerHTML = `${header()}<div class="page table-drill-page"><div class="exercise-head"><button class="btn secondary" data-action="home">← Vælg emne</button><span class="topic-tag">${drill.troubleRound ? "Tabel-drill · drillere" : "Tabel-drill"}</span></div><section class="table-drill-card"><div class="table-drill-status"><span>Tid: <strong id="table-drill-time">${formatTableDrillTime(elapsed)}</strong></span><span>Fejl: <strong>${drill.errors}</strong></span><span>${progressLabel}: <strong>${completedInRound}/${drill.pairs.length}</strong></span></div><div class="table-drill-layout"><div class="table-drill-board">${grid}</div>${answerPanel}</div></section></div>`;
  }
  function renderCountingHand(activeFingers, mirrored = false) {
    // Fingrene vises i rækkefølgen tommel, pege-, lange-, ring- og lillefinger.
    const fingers = ["thumb", "index", "middle", "ring", "little"];
    return `<span class="count-hand ${mirrored ? "mirrored" : ""}" aria-hidden="true">
      <i class="hand-wrist"></i><i class="hand-palm"></i>
      ${fingers.slice(0, activeFingers).map(finger => `<i class="hand-finger ${finger}"></i>`).join("")}
    </span>`;
  }
  function renderCountingHands(count) {
    const firstHand = Math.min(count, 5);
    const secondHand = Math.max(0, count - 5);
    const hands = count === 0
      ? `<span class="count-fist" aria-hidden="true"><i></i></span>`
      : `${renderCountingHand(firstHand)}${secondHand ? renderCountingHand(secondHand, true) : ""}`;
    const label = count === 0 ? "En lukket hånd viser nul fingre" : `${count} ${count === 1 ? "finger" : "fingre"}`;
    return `<div class="hand-counting-field" role="img" aria-label="${label}">${hands}</div>`;
  }
  async function submitAnswer(form) {
    if (state.answered) return;
    const raw = new FormData(form).get("answer").trim().replace(",", ".");
    const isUndefinedAnswer = raw === "Kan ikke beregnes";
    if (raw === "" || (!isUndefinedAnswer && !Number.isFinite(Number(raw)))) { document.getElementById("answer-error").textContent = "Vælg eller skriv et svar først."; return; }
    const measuredTime = Math.max(.1, (Date.now() - state.taskStartedAt) / 1000);
    const responseTime = measuredTime;
    const correct = MathModules[state.task.topic].evaluate(raw, state.task);
    state.answered = true; state.sessionAnswers.push(correct); if (correct) state.sessionCorrect++;
    const result = { topic:state.task.topic, problem:state.task.expression, answer:isUndefinedAnswer ? "Kan ikke beregnes" : Number(raw), correctAnswer:state.task.answer === "undefined" ? "Kan ikke beregnes" : state.task.answer, correct, responseTime:+responseTime.toFixed(2), timestamp:new Date().toISOString() };
    state.user.results.push(result);
    try {
      if (usingCentralDatabase) result.remoteId = await backend.appendResult(state.user.id, result);
      else await save();
    } catch (error) {
      state.user.results.pop(); state.sessionAnswers.pop(); if (correct) state.sessionCorrect--; state.answered=false;
      document.getElementById("answer-error").textContent="Svaret kunne ikke gemmes. Kontrollér forbindelsen og prøv igen.";
      console.error(error);
      return;
    }
    if (state.task.topic === "tableDrill") {
      const key=`${state.task.row}-${state.task.column}`;
      const attempt={answer:Number(raw), correct, responseTime:result.responseTime};
      state.tableDrill.cells[key]=attempt;
      state.tableDrill.roundResults[key]=attempt;
      if (!correct) state.tableDrill.errors++;
      state.tableDrill.currentIndex++;
      state.questionNumber++;
      newTask();
      return;
    }
    // Korrekte svar fortsætter straks. Ved fejl skal eleven først trykke på det korrekte svar.
    if (correct) {
      state.questionNumber++;
      newTask();
    } else {
      renderExercise();
    }
  }
  function handleKeypad(key) {
    const input = document.getElementById("answer");
    const form = document.getElementById("answer-form");
    if (!input || !form || state.answered) return;

    if (key === "enter") {
      if (state.task.topic === "tableDrill" && state.tableDrill?.confirmationMode === "auto") return;
      return submitAnswer(form);
    }
    if (key === "undefined") input.value = "Kan ikke beregnes";
    else if (key === "delete") input.value = input.value === "Kan ikke beregnes" ? "" : input.value.slice(0, -1);
    else if (key === "minus") input.value = input.value === "Kan ikke beregnes" ? "-" : input.value.startsWith("-") ? input.value.slice(1) : `-${input.value}`;
    else if (key === "10" && state.task.topic === "numbers") input.value = "10";
    else if (/^\d$/.test(key) && input.value.replace("-", "").length < 8) input.value = input.value === "Kan ikke beregnes" ? key : input.value + key;

    document.getElementById("answer-error").textContent = "";
    const tableCellAnswer=document.getElementById("table-drill-cell-answer"), tablePreview=document.getElementById("table-drill-answer-preview");
    if (tableCellAnswer) tableCellAnswer.textContent=input.value;
    if (tablePreview) tablePreview.textContent=input.value || "?";
    if (state.task.topic === "tableDrill" && state.tableDrill?.confirmationMode === "auto" && /^\d+$/.test(input.value)) {
      const expected=String(state.task.answer);
      if (input.value === expected || !expected.startsWith(input.value)) submitAnswer(form);
    }
  }
  function summaryFor(user) {
    const ranked = Object.keys(TOPICS).map(topic => ({ topic, ...getStats(user,topic) })).filter(s=>s.count).sort((a,b)=>(a.accuracy-a.avgTime/100)-(b.accuracy-b.avgTime/100));
    if (!ranked.length) return `${user.name} har endnu ikke løst nogen opgaver.`;
    const weak = ranked[0], strong = ranked[ranked.length-1];
    if (weak.accuracy < .60 || weak.avgTime > 10) return `${user.name} har særligt brug for træning i ${TOPICS[weak.topic].name.toLowerCase()} (${Math.round(weak.accuracy*100)} % rigtige, ${weak.avgTime.toFixed(1)} sek.).`;
    return `${user.name} arbejder stabilt. Stærkest i ${TOPICS[strong.topic].name.toLowerCase()} med ${Math.round(strong.accuracy*100)} % rigtige.`;
  }
  function getOverallStats(user, limit = null) {
    const sorted = [...(user.results || [])].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const items = limit ? sorted.slice(-limit) : sorted;
    if (!items.length) return { count:0, accuracy:0, avgTime:0 };
    return {
      count: items.length,
      accuracy: items.filter(item => item.correct).length / items.length,
      avgTime: items.reduce((sum,item) => sum + recordedTime(item), 0) / items.length,
    };
  }
  function getTrend(user, groups = 6) {
    const items = [...(user.results || [])].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (!items.length) return [];
    const size = Math.max(1, Math.ceil(items.length / groups));
    const buckets = [];
    for (let i = 0; i < items.length; i += size) {
      const part = items.slice(i, i + size);
      buckets.push({
        accuracy: Math.round(part.filter(item => item.correct).length / part.length * 100),
        time: part.reduce((sum,item) => sum + recordedTime(item), 0) / part.length,
        count: part.length,
      });
    }
    return buckets.slice(-groups);
  }
  function getProgress(user) {
    const items = [...(user.results || [])].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-24);
    if (items.length < 4) return { delta:0, direction:"neutral" };
    const middle = Math.floor(items.length / 2), first = items.slice(0,middle), last = items.slice(middle);
    const accuracy = list => list.filter(item => item.correct).length / list.length * 100;
    const delta = Math.round(accuracy(last) - accuracy(first));
    return { delta, direction:delta > 4 ? "up" : delta < -4 ? "down" : "neutral" };
  }
  function accuracyChart(points) {
    if (!points.length) return `<p class="empty">Ingen data endnu.</p>`;
    const coords = points.map((point,index) => {
      const x = points.length === 1 ? 250 : 24 + index * (452 / (points.length - 1));
      const y = 112 - point.accuracy * .88;
      return { x, y, ...point };
    });
    const line = coords.map(point => `${point.x},${point.y}`).join(" ");
    return `<svg class="trend-chart" viewBox="0 0 500 140" role="img" aria-label="Udvikling i procent korrekte svar">
      <line x1="24" y1="24" x2="476" y2="24" class="chart-grid"/><line x1="24" y1="68" x2="476" y2="68" class="chart-grid"/><line x1="24" y1="112" x2="476" y2="112" class="chart-grid"/>
      <text x="2" y="28">100</text><text x="8" y="72">50</text><text x="14" y="116">0</text>
      <polyline points="${line}" class="trend-line"/>
      ${coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="5" class="trend-dot"><title>${point.accuracy} % rigtige</title></circle>`).join("")}
      ${coords.map((point,index) => `<text x="${point.x}" y="136" text-anchor="middle">${index+1}</text>`).join("")}
    </svg>`;
  }
  function timeChart(points) {
    if (!points.length) return `<p class="empty">Ingen data endnu.</p>`;
    const max = Math.max(12, ...points.map(point => point.time));
    return `<div class="time-chart" role="img" aria-label="Udvikling i gennemsnitlig svartid">${points.map((point,index) => `<div class="time-column"><span>${point.time.toFixed(1)}s</span><i style="height:${Math.max(12, point.time/max*100)}%"></i><small>${index+1}</small></div>`).join("")}</div>`;
  }
  function recommendationFor(topic) {
    return {
      numbers:"Øv små mængder først. Lad eleven pege på hver figur én gang, mens der tælles højt.",
      addition:"Træn korte serier med de valgte tal. Brug konkrete materialer, hvis et bestemt pluspar bliver ved med at drille.",
      basics:"Øv reglerne med 0 og 1 i korte serier. Tal især om, hvorfor division med 0 ikke kan beregnes.",
      multiplication:"Træn korte serier i de tabeller, hvor svartiden er højest. Stop, mens sikkerheden stadig er god.",
      tableDrill:"Brug drillen til at finde de gangestykker, der tager længst tid. Øv derefter netop disse i korte serier.",
      pemdas:"Lad eleven markere gange- og divisionsled før udregningen. Brug få led og øg gradvist.",
      negatives:"Brug tallinje og lad eleven forklare retningen, før svaret tastes. Start med plus og minus.",
      distributive:"Lad eleven sige de to delprodukter højt, før de lægges sammen. Brug små tal først.",
      letters:"Øv få bogstaver ad gangen. Sig bogstavets lyd højt, og lad barnet navngive billedet efter valget.",
    }[topic];
  }

  /* Bevarer rækkefølgen i gangestykket: 7×9 og 9×7 samles hver for sig. */
  function multiplicationPairStats(user) {
    const grouped = new Map();
    (user.results || []).filter(item => item.topic === "multiplication").forEach(item => {
      const match = String(item.problem).match(/^\s*(\d+)\s*[×x*]\s*(\d+)\s*$/);
      if (!match) return;
      const a = Number(match[1]), b = Number(match[2]);
      if (a < 0 || a > 10 || b < 0 || b > 10) return;
      const key = `${a}-${b}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    return grouped;
  }

  /* Pluspar bevarer også rækkefølgen: 7+2 og 2+7 vurderes hver for sig. */
  function additionPairStats(user) {
    const grouped = new Map();
    (user.results || []).filter(item => item.topic === "addition").forEach(item => {
      const match = String(item.problem).match(/^\s*(\d+)\s*\+\s*(\d+)\s*$/);
      if (!match) return;
      const a = Number(match[1]), b = Number(match[2]);
      if (!SINGLE_DIGITS.includes(a) || !SINGLE_DIGITS.includes(b)) return;
      const key = `${a}-${b}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    return grouped;
  }

  function numberValueStats(user) {
    const grouped = new Map();
    (user.results || []).filter(item => item.topic === "numbers").forEach(item => {
      const match = String(item.problem).match(/^Antal\s+(\d+)$/);
      if (!match) return;
      const number = Number(match[1]);
      if (number < 0 || number > 10) return;
      if (!grouped.has(String(number))) grouped.set(String(number), []);
      grouped.get(String(number)).push(item);
    });
    return grouped;
  }

  // En opgave er lært, når eleven på et tidspunkt har haft tre hurtige,
  // korrekte besvarelser i træk. Tidsgrænsen gives af det enkelte emne.
  function drillMastery(items, maxSeconds = 5) {
    const ordered = [...items].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    let streak = 0, learned = false;
    ordered.forEach(item => {
      streak = item.correct && recordedTime(item) <= maxSeconds ? streak + 1 : 0;
      if (streak >= 3) learned = true;
    });
    if (learned) return { learned:true, streak:3 };
    let currentStreak = 0;
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (ordered[i].correct && recordedTime(ordered[i]) <= maxSeconds) currentStreak++;
      else break;
    }
    return { learned:false, streak:Math.min(2,currentStreak) };
  }

  // Tallene har to varige trin. Tre hurtige svar i træk giver sølv;
  // yderligere tre hurtige svar i træk giver guld. En langsom eller forkert
  // besvarelse nulstiller kun fremdriften mod det næste trin.
  function numberMastery(items, maxSeconds = 10) {
    const ordered = [...items].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    let stage = "none", streak = 0;
    ordered.forEach(item => {
      streak = item.correct && recordedTime(item) <= maxSeconds ? streak + 1 : 0;
      if (stage === "none" && streak >= 3) {
        stage = "silver";
        streak = 0;
      } else if (stage === "silver" && streak >= 3) {
        stage = "gold";
        streak = 0;
      }
    });
    return { stage, streak:stage === "gold" ? 3 : Math.min(2, streak) };
  }

  function numberPracticeWeight(mastery) {
    if (mastery.stage === "gold") return .1;
    if (mastery.stage === "silver") return .5;
    return 1;
  }

  const accuracyColor = (accuracy) => `hsl(${Math.round(accuracy * 1.2)} 72% 86%)`;
  const responseTimeColor = (seconds) => {
    const capped = Math.min(10, Math.max(0, seconds));
    return `hsl(${Math.round((1 - capped / 10) * 120)} 72% 86%)`;
  };

  function renderMultiplicationDetail(user) {
    const grouped = multiplicationPairStats(user);
    const columns = Array.from({length:11}, (_,i) => i);
    const learnedCount = [...grouped.values()].filter(items => drillMastery(items).learned).length;
    const cells = (a) => columns.map(b => {
      const items = grouped.get(`${a}-${b}`) || [];
      if (!items.length) return `<td class="pair-cell empty-pair" title="${a} × ${b}: ingen svar"><strong>—</strong><small>0 svar</small></td>`;
      const correctCount = items.filter(item => item.correct).length;
      const accuracy = Math.round(correctCount / items.length * 100);
      const avgTime = items.reduce((sum,item) => sum + recordedTime(item), 0) / items.length;
      const mastery = drillMastery(items);
      return `<td class="pair-cell ${mastery.learned?"learned-pair":""}" style="background:${responseTimeColor(avgTime)}" title="${a} × ${b}: ${accuracy} % rigtige, ${avgTime.toFixed(1)} sekunder i snit"><div class="pair-cell-main"><span class="pair-pie" style="--correct:${accuracy}%" role="img" aria-label="${accuracy} % korrekte og ${100-accuracy} % forkerte"></span><strong>${accuracy} %</strong></div><small>${items.length} svar · ${avgTime.toFixed(1)} s</small><span class="pair-mastery ${mastery.learned?"learned":""}">${mastery.learned?"✓ Lært":`${mastery.streak}/3 hurtige i træk`}</span></td>`;
    }).join("");

    return `<section class="pair-detail" aria-labelledby="pair-detail-title">
      <div class="pair-detail-head"><div><span class="eyebrow">Detaljer</span><h3 id="pair-detail-title">Lille tabel – hvert talpar</h3><p>Et talpar er lært efter 3 grønne flueben i træk: korrekt på højst 5 sekunder. 7 × 9 og 9 × 7 vurderes hver for sig.</p></div><div class="pair-detail-actions"><span class="mastery-summary"><strong>${learnedCount}</strong> af 121 lært</span><button class="btn secondary" data-action="close-topic-detail">Luk</button></div></div>
      <div class="time-scale"><span>0 s</span><i></i><span>10 s</span><small>Grøn = hurtigt, rød = 10 sekunder</small></div>
      <div class="pair-table-scroll" tabindex="0" aria-label="Statistik for gangestykker fra 0 til 10">
        <table class="pair-table"><thead><tr><th scope="col">×</th>${columns.map(b => `<th scope="col">${b}</th>`).join("")}</tr></thead><tbody>
          ${columns.map(a => `<tr><th scope="row">${a}</th>${cells(a)}</tr>`).join("")}
        </tbody></table>
      </div>
    </section>`;
  }

  function renderAdditionDetail(user) {
    const grouped = additionPairStats(user);
    const columns = [...SINGLE_DIGITS];
    const learnedCount = [...grouped.values()].filter(items => drillMastery(items).learned).length;
    const cells = (a) => columns.map(b => {
      const items = grouped.get(`${a}-${b}`) || [];
      if (!items.length) return `<td class="pair-cell empty-pair" title="${a} + ${b}: ingen svar"><strong>—</strong><small>0 svar</small></td>`;
      const accuracy = Math.round(items.filter(item => item.correct).length / items.length * 100);
      const avgTime = items.reduce((sum,item) => sum + recordedTime(item), 0) / items.length;
      const mastery = drillMastery(items);
      return `<td class="pair-cell ${mastery.learned?"learned-pair":""}" style="background:${responseTimeColor(avgTime)}" title="${a} + ${b}: ${accuracy} % rigtige, ${avgTime.toFixed(1)} sekunder i snit"><div class="pair-cell-main"><span class="pair-pie" style="--correct:${accuracy}%" role="img" aria-label="${accuracy} % korrekte og ${100-accuracy} % forkerte"></span><strong>${accuracy} %</strong></div><small>${items.length} svar · ${avgTime.toFixed(1)} s</small><span class="pair-mastery ${mastery.learned?"learned":""}">${mastery.learned?"✓ Lært":`${mastery.streak}/3 hurtige i træk`}</span></td>`;
    }).join("");

    return `<section class="pair-detail" aria-labelledby="addition-detail-title">
      <div class="pair-detail-head"><div><span class="eyebrow">Detaljer</span><h3 id="addition-detail-title">Plusstykker – hvert talpar</h3><p>Et pluspar er lært efter 3 grønne flueben i træk: korrekt på højst 5 sekunder. 7 + 2 og 2 + 7 vurderes hver for sig.</p></div><div class="pair-detail-actions"><span class="mastery-summary"><strong>${learnedCount}</strong> af 100 lært</span><button class="btn secondary" data-action="close-topic-detail">Luk</button></div></div>
      <div class="time-scale"><span>0 s</span><i></i><span>10 s</span><small>Grøn = hurtigt, rød = 10 sekunder</small></div>
      <div class="pair-table-scroll" tabindex="0" aria-label="Statistik for plusstykker med tal fra 0 til 9">
        <table class="pair-table addition-table"><thead><tr><th scope="col">+</th>${columns.map(b => `<th scope="col">${b}</th>`).join("")}</tr></thead><tbody>
          ${columns.map(a => `<tr><th scope="row">${a}</th>${cells(a)}</tr>`).join("")}
        </tbody></table>
      </div>
    </section>`;
  }

  function renderNumbersDetail(user) {
    const grouped = numberValueStats(user);
    const values = Array.from({length:11},(_,index)=>index);
    const stages = [...grouped.values()].map(items => numberMastery(items));
    const silverCount = stages.filter(item => item.stage === "silver").length;
    const goldCount = stages.filter(item => item.stage === "gold").length;
    const cards = values.map(number => {
      const items = grouped.get(String(number)) || [];
      if (!items.length) return `<article class="number-stat-card empty-pair"><strong>${number}</strong><span>—</span><small>0 svar</small><em>0/3 mod sølv</em></article>`;
      const accuracy = Math.round(items.filter(item => item.correct).length / items.length * 100);
      const avgTime = items.reduce((sum,item) => sum + recordedTime(item), 0) / items.length;
      const mastery = numberMastery(items);
      const progress = mastery.stage === "gold" ? "Guld" : mastery.stage === "silver" ? `Sølv · ${mastery.streak}/3 mod guld` : `${mastery.streak}/3 mod sølv`;
      return `<article class="number-stat-card ${mastery.stage === "gold" ? "learned-pair" : mastery.stage === "silver" ? "silver-number" : ""}" style="background:${responseTimeColor(avgTime)}"><strong>${number}</strong><div class="pair-cell-main"><span class="pair-pie" style="--correct:${accuracy}%" role="img" aria-label="${accuracy} % korrekte og ${100-accuracy} % forkerte"></span><span>${accuracy} %</span></div><small>${items.length} svar · ${avgTime.toFixed(1)} s</small><em class="${mastery.stage !== "none" ? "learned" : ""}">${progress}</em></article>`;
    }).join("");
    return `<section class="pair-detail" aria-labelledby="numbers-detail-title">
      <div class="pair-detail-head"><div><span class="eyebrow">Detaljer</span><h3 id="numbers-detail-title">Tallene – hvert antal</h3><p>3 korrekte i træk på højst 10 sekunder giver sølv. De næste 3 giver guld.</p></div><div class="pair-detail-actions"><span class="mastery-summary"><strong>${silverCount}</strong> sølv · <strong>${goldCount}</strong> guld</span><button class="btn secondary" data-action="close-topic-detail">Luk</button></div></div>
      <div class="time-scale"><span>0 s</span><i></i><span>10 s</span><small>Grøn = hurtigt, rød = 10 sekunder</small></div>
      <div class="number-stat-grid">${cards}</div>
    </section>`;
  }

  function negativePatternStats(user) {
    const grouped = new Map();
    (user.results || []).filter(item => item.topic === "negatives").forEach(item => {
      const match = String(item.problem).match(/^\s*\(?([+-]?\d+)\)?\s*([+−×x*])\s*\(?([+-]?\d+)\)?\s*$/);
      if (!match) return;
      const a = Number(match[1]), b = Number(match[3]);
      if (a === 0 || b === 0) return;
      const op = match[2] === "x" || match[2] === "*" ? "×" : match[2];
      const key = `${op}-${a > 0 ? "+" : "−"}${b > 0 ? "+" : "−"}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    return grouped;
  }

  function renderNegativeDetail(user) {
    const grouped = negativePatternStats(user);
    const operations = [{symbol:"+",name:"Addition"},{symbol:"−",name:"Subtraktion"},{symbol:"×",name:"Multiplikation"}];
    const signs = [["+","+"],["+","−"],["−","+"],["−","−"]];
    const card = (op, left, right) => {
      const items = grouped.get(`${op}-${left}${right}`) || [];
      const label = `${left} ${op} ${right}`;
      if (!items.length) return `<article class="sign-card empty-pair"><strong>${label}</strong><span>—</span><small>0 svar</small></article>`;
      const accuracy = Math.round(items.filter(item => item.correct).length / items.length * 100);
      const avgTime = items.reduce((sum,item) => sum + item.responseTime, 0) / items.length;
      return `<article class="sign-card" style="background:${accuracyColor(accuracy)}"><strong>${label}</strong><span>${accuracy} %</span><small>${items.length} svar · ${avgTime.toFixed(1)} s</small></article>`;
    };
    return `<section class="pair-detail" aria-labelledby="negative-detail-title">
      <div class="pair-detail-head"><div><span class="eyebrow">Detaljer</span><h3 id="negative-detail-title">Negative tal – fortegnskombinationer</h3><p>Se præcis hvilke kombinationer af positive og negative tal eleven mestrer.</p></div><button class="btn secondary" data-action="close-topic-detail">Luk</button></div>
      <div class="accuracy-scale"><span>0 %</span><i></i><span>100 %</span><small>Rød = 0 %, grøn = 100 %</small></div>
      <div class="sign-sections">${operations.map(operation => `<section><h4>${operation.name} (${operation.symbol})</h4><div class="sign-grid">${signs.map(sign => card(operation.symbol, sign[0], sign[1])).join("")}</div></section>`).join("")}</div>
    </section>`;
  }

  function renderTeacher() {
    const classes = db.classes || [];
    const activeClass = classes.find(item => item.id === state.activeClassId) || classes[0];
    state.activeClassId = activeClass.id;
    const students = db.users.filter(user => user.role === "student" && user.classId === activeClass.id);
    const selected = students.find(student => student.id === state.expandedStudent) || students[0] || null;
    state.expandedStudent = selected?.id || null;
    const allResults = students.flatMap(student => student.results || []), classCorrect = allResults.filter(item => item.correct).length;
    const classAccuracy = allResults.length ? Math.round(classCorrect / allResults.length * 100) : 0;
    const needsAttention = students.filter(student => Object.keys(TOPICS).some(topic => getStats(student,topic).status === "weak")).length;
    let studentDetail = `<div class="empty-class"><span class="empty-class-icon">＋</span><h2>Klassen har ingen elever endnu</h2><p>Brug knappen “Tilføj elev” ovenfor for at oprette klassens første elev.</p></div>`;

    if (selected) {
      const current = getOverallStats(selected,20), progress = getProgress(selected), trend = getTrend(selected);
      const topicStats = Object.keys(TOPICS).map(topic => ({ topic, ...getStats(selected,topic) }));
      const ranked = [...topicStats].filter(item => item.count).sort((a,b) => (a.accuracy-a.avgTime/100)-(b.accuracy-b.avgTime/100));
      const challenge = ranked[0] || { topic:"multiplication", accuracy:0, avgTime:0, status:"new" };
      const strength = ranked[ranked.length-1] || challenge;
      const progressCopy = progress.direction === "up" ? `+${progress.delta} procentpoint` : progress.direction === "down" ? `${progress.delta} procentpoint` : "Stabilt niveau";
      studentDetail = `
        <section class="student-profile-head"><div class="student-name"><span class="avatar large">${escapeHtml(selected.name.slice(0,1))}</span><div><span class="eyebrow">Elevprofil</span><h2>${escapeHtml(selected.name)}</h2><p>${summaryFor(selected)}</p></div></div><div class="student-profile-actions"><span class="progress-badge ${progress.direction}">${progress.direction==="up"?"↗":progress.direction==="down"?"↘":"→"} ${progressCopy}</span><label>Klasse<select data-student-class="${selected.id}">${classes.map(item => `<option value="${item.id}" ${item.id===selected.classId?"selected":""}>${escapeHtml(item.name)}</option>`).join("")}</select></label></div></section>

        <section class="student-kpis">
          <article><span>Seneste 20</span><strong>${Math.round(current.accuracy*100)} %</strong><small>korrekte svar</small></article>
          <article><span>Svartid</span><strong>${current.avgTime.toFixed(1)} s</strong><small>gennemsnit</small></article>
          <article><span>Stærkest</span><strong>${TOPICS[strength.topic].name}</strong><small>${Math.round(strength.accuracy*100)} % rigtige</small></article>
        </section>

        <section class="table-assignment letter-assignment" aria-labelledby="letter-assignment-title">
          <div class="table-assignment-head"><div><span class="eyebrow">Opgavestyring</span><h3 id="letter-assignment-title">Bogstavlæring til ${escapeHtml(selected.name)}</h3><p>Vælg de bogstaver, barnet må møde i øvelsen.</p></div><div class="table-assignment-actions"><button class="btn secondary compact" type="button" data-letter-all="${selected.id}">Vælg alle</button><button class="btn danger compact" type="button" data-action="reset-topic-progress" data-reset-topic="letters" data-reset-student="${selected.id}">Nulstil fremskridt</button></div></div>
          <div class="letter-assignment-choices">${LETTER_ITEMS.map(item => `<label class="letter-assignment-choice"><input type="checkbox" value="${item.letter}" data-letter-student="${selected.id}" ${selected.assignedLetters.includes(item.letter)?"checked":""}><span>${item.letter}</span><small>${escapeHtml(item.word)}</small></label>`).join("")}</div>
          <p class="table-selection-note"><strong class="letter-selection-count">${selected.assignedLetters.length}</strong> af ${LETTER_ITEMS.length} bogstaver valgt. Mindst ét bogstav skal være markeret.</p>
        </section>

        <section class="table-assignment" aria-labelledby="numbers-assignment-title">
          <div class="table-assignment-head"><div><span class="eyebrow">Opgavestyring</span><h3 id="numbers-assignment-title">Tallene til ${escapeHtml(selected.name)}</h3><p>Sæt flueben ved de tal fra 0 til 10, eleven skal tælle i øvelsen.</p></div><div class="table-assignment-actions"><button class="btn secondary compact" type="button" data-number-all="${selected.id}">Vælg alle</button><button class="btn danger compact" type="button" data-action="reset-topic-progress" data-reset-topic="numbers" data-reset-student="${selected.id}">Nulstil fremskridt</button></div></div>
          <div class="table-choices">${SMALL_TABLES.map(number => `<label class="table-choice"><input type="checkbox" value="${number}" data-number-student="${selected.id}" ${selected.assignedNumbers.includes(number)?"checked":""}><span>${number}</span><small>antal ${number}</small></label>`).join("")}</div>
          <p class="table-selection-note"><strong class="number-selection-count">${selected.assignedNumbers.length}</strong> af 11 tal valgt. Mindst ét tal skal være markeret.</p>
        </section>

        <section class="table-assignment" aria-labelledby="table-assignment-title">
          <div class="table-assignment-head"><div><span class="eyebrow">Opgavestyring</span><h3 id="table-assignment-title">Lille tabel til ${escapeHtml(selected.name)}</h3><p>Sæt flueben ved de tabeller, eleven skal møde. Det valgte tal står som første faktor.</p></div><div class="table-assignment-actions"><button class="btn secondary compact" type="button" data-table-all="${selected.id}">Vælg alle</button><button class="btn danger compact" type="button" data-action="reset-topic-progress" data-reset-topic="multiplication" data-reset-student="${selected.id}">Nulstil fremskridt</button></div></div>
          <div class="table-choices">${SMALL_TABLES.map(number => `<label class="table-choice"><input type="checkbox" value="${number}" data-table-student="${selected.id}" ${selected.assignedTables.includes(number)?"checked":""}><span>${number}</span><small>${number}-tabellen</small></label>`).join("")}</div>
          <p class="table-selection-note"><strong class="table-selection-count">${selected.assignedTables.length}</strong> af 11 tabeller valgt. Mindst én tabel skal være markeret.</p>
        </section>

        <section class="table-assignment addition-assignment" aria-labelledby="addition-assignment-title">
          <div class="table-assignment-head"><div><span class="eyebrow">Opgavestyring</span><h3 id="addition-assignment-title">Plusstykker til ${escapeHtml(selected.name)}</h3><p>Vælg hvilke tal eleven skal øve som både første og andet led.</p></div><div class="table-assignment-actions"><button class="btn danger compact" type="button" data-action="reset-topic-progress" data-reset-topic="addition" data-reset-student="${selected.id}">Nulstil fremskridt</button></div></div>
          <div class="addition-factor"><div class="addition-factor-head"><strong>Første led</strong><button class="btn secondary compact" type="button" data-addend-all="${selected.id}" data-addend-position="first">Vælg alle</button></div><div class="table-choices addition-choices">${SINGLE_DIGITS.map(number => `<label class="table-choice"><input type="checkbox" value="${number}" data-addend-student="${selected.id}" data-addend-position="first" ${selected.assignedAddends.includes(number)?"checked":""}><span>${number}</span><small>første led</small></label>`).join("")}</div><p class="table-selection-note"><strong class="addition-selection-count" data-addend-position="first">${selected.assignedAddends.length}</strong> af 10 tal valgt. Mindst ét tal skal være markeret.</p></div>
          <div class="addition-factor"><div class="addition-factor-head"><strong>Andet led</strong><button class="btn secondary compact" type="button" data-addend-all="${selected.id}" data-addend-position="second">Vælg alle</button></div><div class="table-choices addition-choices">${SINGLE_DIGITS.map(number => `<label class="table-choice"><input type="checkbox" value="${number}" data-addend-student="${selected.id}" data-addend-position="second" ${selected.assignedAddendSeconds.includes(number)?"checked":""}><span>${number}</span><small>andet led</small></label>`).join("")}</div><p class="table-selection-note"><strong class="addition-selection-count" data-addend-position="second">${selected.assignedAddendSeconds.length}</strong> af 10 tal valgt. Mindst ét tal skal være markeret.</p></div>
        </section>

        <section class="analytics-grid">
          <article class="chart-card"><div class="chart-title"><div><span>Fremskridt</span><h3>Rigtige svar over tid</h3></div><small>6 perioder</small></div>${accuracyChart(trend)}</article>
          <article class="chart-card"><div class="chart-title"><div><span>Tempo</span><h3>Svartid over tid</h3></div><small>Lavere er bedre</small></div>${timeChart(trend)}</article>
        </section>

        <section class="insight-grid">
          <article class="focus-card"><span class="focus-icon">!</span><div><span class="eyebrow">Største udfordring</span><h3>${TOPICS[challenge.topic].name}</h3><p>${recommendationFor(challenge.topic)}</p><div class="evidence"><span>${Math.round(challenge.accuracy*100)} % rigtige</span><span>${challenge.avgTime.toFixed(1)} sek.</span></div></div></article>
          <article class="topic-performance"><div class="chart-title"><div><span>Emner</span><h3>Sikkerhed og tempo</h3></div><small>Seneste 20 pr. emne</small></div>
            ${topicStats.map(stat => { const pct=Math.round(stat.accuracy*100), cls=stat.status==="strong"?"strong":stat.status==="weak"?"weak":"medium"; const detailLabel=stat.topic==="multiplication"||stat.topic==="addition"?" · Se talpar →":stat.topic==="numbers"?" · Se antal →":stat.topic==="negatives"?" · Se fortegn →":""; const content=`<div><strong>${TOPICS[stat.topic].name}</strong><small>${stat.count} svar · ${stat.count?stat.avgTime.toFixed(1):"—"} sek.${detailLabel}</small></div><div class="topic-meter"><span><i class="${cls}" style="width:${stat.count?pct:0}%"></i></span><b>${stat.count?pct+" %":"—"}</b></div>`; const topicRow=["numbers","addition","multiplication","negatives"].includes(stat.topic) ? `<button class="topic-row topic-row-button ${state.teacherTopicDetail===stat.topic?"active":""}" data-report-topic="${stat.topic}" aria-expanded="${state.teacherTopicDetail===stat.topic}">${content}</button>` : `<div class="topic-row">${content}</div>`; return `<div class="topic-row-control">${topicRow}<button class="btn danger compact topic-reset" type="button" data-action="reset-topic-progress" data-reset-topic="${stat.topic}" data-reset-student="${selected.id}">Nulstil fremskridt</button></div>`; }).join("")}
          </article>
        </section>
        ${state.teacherTopicDetail === "numbers" ? renderNumbersDetail(selected) : ""}
        ${state.teacherTopicDetail === "addition" ? renderAdditionDetail(selected) : ""}
        ${state.teacherTopicDetail === "multiplication" ? renderMultiplicationDetail(selected) : ""}
        ${state.teacherTopicDetail === "negatives" ? renderNegativeDetail(selected) : ""}`;
    }

    app.innerHTML = `${header()}<div class="page teacher-page">
      <section class="dashboard-head"><div><span class="eyebrow">Lærerportal</span><h1>${escapeHtml(activeClass.name)} lige nu</h1><p>Følg udvikling, opdag udfordringer og vælg næste fokus.</p></div>${usingCentralDatabase ? "" : `<button class="btn secondary" data-action="reset-demo">Nulstil demodata</button>`}</section>
      <section class="class-manager" aria-label="Klasser">
        <div class="class-manager-title"><div><span class="eyebrow">Dine klasser</span><strong>${classes.length} ${classes.length===1?"klasse":"klasser"}</strong></div><form id="class-form" class="class-form"><label class="sr-only" for="class-name">Navn på ny klasse</label><input id="class-name" name="className" maxlength="30" placeholder="fx 9.A" required><button class="btn" type="submit">Opret klasse</button></form></div>
        <div class="class-tabs" role="tablist">${classes.map(item => { const count=db.users.filter(user=>user.role==="student"&&user.classId===item.id).length; return `<button role="tab" aria-selected="${item.id===activeClass.id}" class="class-tab ${item.id===activeClass.id?"active":""}" data-class="${item.id}"><strong>${escapeHtml(item.name)}</strong><small>${count} ${count===1?"elev":"elever"}</small></button>`; }).join("")}</div>
        <p id="class-error" class="class-error" role="alert"></p>
        <div class="student-manager-row">
          <div><strong>Elever i ${escapeHtml(activeClass.name)}</strong><small>${selected ? `${escapeHtml(selected.name)} er valgt` : "Ingen elev er valgt"}</small></div>
          <div class="student-manager-buttons"><button class="btn secondary" type="button" data-action="toggle-class-rename-form" aria-expanded="${state.classRenameFormOpen}">${state.classRenameFormOpen ? "Annuller" : "Omdøb klasse"}</button><button class="btn danger" type="button" data-action="delete-class" ${classes.length > 1 ? "" : "disabled"}>Slet klasse</button><button class="btn secondary" type="button" data-action="toggle-student-username-form" aria-expanded="${state.teacherUsernameFormOpen}" ${selected ? "" : "disabled"}>${state.teacherUsernameFormOpen ? "Annuller" : "Skift brugernavn"}</button><button class="btn secondary" type="button" data-action="toggle-student-password-form" aria-expanded="${state.teacherPasswordFormOpen}" ${selected ? "" : "disabled"}>${state.teacherPasswordFormOpen ? "Annuller" : "Skift adgangskode"}</button><button class="btn secondary" type="button" data-action="toggle-student-form" aria-expanded="${state.studentFormOpen}">${state.studentFormOpen ? "Annuller" : "+ Tilføj elev"}</button><button class="btn danger" type="button" data-action="remove-student" ${selected ? "" : "disabled"}>Fjern elev</button></div>
        </div>
        ${state.classRenameFormOpen ? `<form id="class-rename-form" class="class-rename-form"><label class="sr-only" for="class-rename">Nyt klassenavn</label><input id="class-rename" name="className" maxlength="30" value="${escapeHtml(activeClass.name)}" required><button class="btn" type="submit">Gem navn</button><p id="class-rename-error" class="student-error" role="alert"></p></form>` : ""}
        ${state.studentFormOpen ? `<form id="student-form" class="student-form"><div class="field"><label for="student-name">Elevens navn</label><input id="student-name" name="studentName" maxlength="60" autocomplete="off" placeholder="fx Emma" required></div><div class="field"><label for="student-username">Brugernavn</label><input id="student-username" name="studentUsername" maxlength="40" autocomplete="off" autocapitalize="none" placeholder="fx emma8" required></div><div class="field"><label for="student-password">Adgangskode</label><input id="student-password" name="studentPassword" type="password" maxlength="60" autocomplete="new-password" placeholder="Vælg adgangskode" required></div><button class="btn" type="submit">Opret elev</button><p id="student-error" class="student-error" role="alert"></p></form>` : ""}
        ${state.teacherUsernameFormOpen && selected ? `<form id="teacher-username-form" class="student-form"><input type="hidden" name="studentId" value="${escapeHtml(selected.id)}"><div class="field"><label for="teacher-new-username">Nyt brugernavn til ${escapeHtml(selected.name)}</label><input id="teacher-new-username" name="newUsername" maxlength="40" value="${escapeHtml(selected.username)}" autocomplete="off" autocapitalize="none" required></div><button class="btn" type="submit">Gem brugernavn</button><p id="teacher-username-error" class="student-error" role="alert"></p></form>` : ""}
        ${state.teacherPasswordFormOpen && selected ? `<form id="teacher-password-form" class="student-form"><input type="hidden" name="studentId" value="${escapeHtml(selected.id)}"><div class="field"><label for="teacher-new-password">Ny adgangskode til ${escapeHtml(selected.name)}</label><input id="teacher-new-password" name="newPassword" type="password" maxlength="60" autocomplete="new-password" required></div><div class="field"><label for="teacher-confirm-password">Gentag ny adgangskode</label><input id="teacher-confirm-password" name="confirmPassword" type="password" maxlength="60" autocomplete="new-password" required></div><button class="btn" type="submit">Gem ny adgangskode</button><p id="teacher-password-error" class="student-error" role="alert"></p></form>` : ""}
      </section>
      <section class="class-kpis">
        <article><span>Elever</span><strong>${students.length}</strong><small>aktive profiler</small></article>
        <article><span>Besvarelser</span><strong>${allResults.length}</strong><small>registreret i alt</small></article>
        <article><span>Klassens sikkerhed</span><strong>${classAccuracy} %</strong><small>korrekte svar</small></article>
        <article class="${needsAttention ? "attention" : ""}"><span>Kræver blik</span><strong>${needsAttention}</strong><small>elever med udfordringer</small></article>
      </section>

      <section class="teacher-layout">
        <aside class="roster-panel"><div class="panel-title"><h2>Elever</h2><span>${students.length}</span></div><div class="roster-list">
          ${students.map(student => { const stats=getOverallStats(student,20), weak=Object.keys(TOPICS).some(topic=>getStats(student,topic).status==="weak"); return `<button class="roster-item ${student.id===selected?.id?"active":""}" data-student="${student.id}"><span class="avatar">${escapeHtml(student.name.slice(0,1))}</span><span><strong>${escapeHtml(student.name)}</strong><small>${Math.round(stats.accuracy*100)} % · ${stats.avgTime.toFixed(1)} sek.</small></span><i class="status-light ${weak?"weak":"good"}" aria-label="${weak?"Har udfordringer":"På rette spor"}"></i></button>`; }).join("")}
        </div></aside>
        <div class="teacher-detail">${studentDetail}</div>
      </section>
    </div>`;
  }
  function render() { if (!state.user) renderLogin(); else if (state.view==="teacher") renderTeacher(); else if (state.view==="exercise") newTask(); else if (state.view==="change-password") renderStudentPassword(); else renderStudentHome(); }

  document.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.id === "login-form") {
      const data = new FormData(event.target), username=String(data.get("username")).trim().toLowerCase(), password=String(data.get("password"));
      const error = document.getElementById("login-error");
      try {
        if (usingCentralDatabase) {
          const loaded = await backend.signIn(username, password);
          db = normalizeDatabase(loaded.database, false);
          state.user = db.users.find(user => user.id === loaded.currentUserId);
        } else state.user = db.users.find(user => user.username.toLowerCase() === username && user.password === password);
        if (!state.user) throw new Error("Brugeren blev ikke fundet.");
        if (usingCentralDatabase && state.user.role === "teacher") await save();
        state.view=state.user.role==="teacher"?"teacher":"student"; render();
      } catch (loginError) {
        error.textContent="Brugernavn eller adgangskode passer ikke.";
        console.error(loginError);
      }
    } else if (event.target.id === "student-password-form") {
      const data = new FormData(event.target);
      const currentPassword = String(data.get("currentPassword") || "");
      const newPassword = String(data.get("newPassword") || "");
      const confirmPassword = String(data.get("confirmPassword") || "");
      const error = document.getElementById("password-error");
      if (state.user.role !== "student") return;
      if (!usingCentralDatabase && currentPassword !== state.user.password) { error.textContent="Den nuværende adgangskode er ikke korrekt."; return; }
      if (!newPassword.length) { error.textContent="Skriv en ny adgangskode."; return; }
      if (newPassword !== confirmPassword) { error.textContent="De to nye adgangskoder er ikke ens."; return; }
      try {
        if (usingCentralDatabase) await backend.changeOwnPassword(state.user.username, currentPassword, newPassword);
        else { state.user.password = newPassword; await save(); }
        state.view="student"; renderStudentHome();
      } catch (passwordError) { error.textContent="Adgangskoden kunne ikke ændres. Kontrollér den nuværende adgangskode."; console.error(passwordError); }
    } else if (event.target.id === "teacher-password-form") {
      const data = new FormData(event.target);
      const student = db.users.find(user => user.id === String(data.get("studentId") || "") && user.role === "student" && user.classId === state.activeClassId);
      const newPassword = String(data.get("newPassword") || "");
      const confirmPassword = String(data.get("confirmPassword") || "");
      const error = document.getElementById("teacher-password-error");
      if (state.user.role !== "teacher" || !student) { error.textContent="Eleven blev ikke fundet."; return; }
      if (!newPassword.length) { error.textContent="Skriv en ny adgangskode."; return; }
      if (newPassword !== confirmPassword) { error.textContent="De to adgangskoder er ikke ens."; return; }
      try {
        if (usingCentralDatabase) await backend.manageStudent("password", { studentId:student.id, password:newPassword });
        else student.password = newPassword;
        state.teacherPasswordFormOpen=false; await save(); renderTeacher();
      } catch (passwordError) { error.textContent="Adgangskoden kunne ikke ændres."; console.error(passwordError); }
    } else if (event.target.id === "teacher-username-form") {
      const data = new FormData(event.target);
      const student = db.users.find(user => user.id === String(data.get("studentId") || "") && user.role === "student" && user.classId === state.activeClassId);
      const username = String(data.get("newUsername") || "").trim().toLowerCase();
      const error = document.getElementById("teacher-username-error");
      if (state.user.role !== "teacher" || !student) { error.textContent="Eleven blev ikke fundet."; return; }
      if (!username) { error.textContent="Skriv et nyt brugernavn."; return; }
      if (!/^[a-z0-9._-]+$/i.test(username)) { error.textContent="Brugernavnet må kun indeholde bogstaver, tal, punktum, bindestreg og understregning."; return; }
      if (db.users.some(user => user.id !== student.id && user.username.toLowerCase() === username)) { error.textContent="Brugernavnet er allerede i brug."; return; }
      try {
        if (usingCentralDatabase) await backend.manageStudent("username", { studentId:student.id, username });
        student.username=username; state.teacherUsernameFormOpen=false; await save(); renderTeacher();
      } catch (usernameError) { error.textContent="Brugernavnet kunne ikke ændres."; console.error(usernameError); }
    } else if (event.target.id === "class-form") {
      const name = String(new FormData(event.target).get("className") || "").trim();
      const error = document.getElementById("class-error");
      if (!name) { error.textContent="Skriv et navn til klassen."; return; }
      if (db.classes.some(item => item.name.toLowerCase() === name.toLowerCase())) { error.textContent="Der findes allerede en klasse med det navn."; return; }
      const newClass = { id:`c-${Date.now().toString(36)}`, name };
      db.classes.push(newClass); state.activeClassId=newClass.id; state.expandedStudent=null; state.teacherTopicDetail=null; state.studentFormOpen=false; state.classRenameFormOpen=false; await save(); renderTeacher();
    } else if (event.target.id === "class-rename-form") {
      const name = String(new FormData(event.target).get("className") || "").trim();
      const error = document.getElementById("class-rename-error");
      const activeClass = db.classes.find(item => item.id === state.activeClassId);
      if (!activeClass || !name) { error.textContent="Skriv et navn til klassen."; return; }
      if (db.classes.some(item => item.id !== activeClass.id && item.name.toLowerCase() === name.toLowerCase())) { error.textContent="Der findes allerede en klasse med det navn."; return; }
      activeClass.name=name; state.classRenameFormOpen=false; await save(); renderTeacher();
    } else if (event.target.id === "student-form") {
      const data = new FormData(event.target);
      const name = String(data.get("studentName") || "").trim();
      const username = String(data.get("studentUsername") || "").trim().toLowerCase();
      const password = String(data.get("studentPassword") || "");
      const error = document.getElementById("student-error");
      if (!name || !username || !password) { error.textContent="Udfyld navn, brugernavn og adgangskode."; return; }
      if (!/^[a-z0-9._-]+$/i.test(username)) { error.textContent="Brugernavnet må kun indeholde bogstaver, tal, punktum, bindestreg og understregning."; return; }
      if (db.users.some(user => user.username.toLowerCase() === username)) { error.textContent="Brugernavnet er allerede i brug."; return; }
      try {
        const remoteStudent = usingCentralDatabase ? await backend.manageStudent("create", { username, password, name }) : null;
        const newStudent = { id:remoteStudent?.id || `s-${Date.now().toString(36)}`, classId:state.activeClassId, role:"student", username, ...(usingCentralDatabase ? {} : { password }), name, results:[], assignedLetters:[...LETTER_KEYS], assignedNumbers:[...SMALL_TABLES], assignedTables:[...SMALL_TABLES], assignedAddends:[...SINGLE_DIGITS], assignedAddendSeconds:[...SINGLE_DIGITS] };
        db.users.push(newStudent); state.expandedStudent=newStudent.id; state.teacherTopicDetail=null; state.studentFormOpen=false; await save(); renderTeacher();
      } catch (studentError) { error.textContent="Eleven kunne ikke oprettes. Brugernavnet kan allerede være i brug."; console.error(studentError); }
    } else if (event.target.id === "answer-form") await submitAnswer(event.target);
  });
  document.addEventListener("click", async (event) => {
    const keyButton=event.target.closest("[data-key]"), letterChoiceButton=event.target.closest("[data-letter-choice]"), drillModeButton=event.target.closest("[data-drill-mode]"), topicButton=event.target.closest("[data-topic]"), actionButton=event.target.closest("[data-action]"), studentButton=event.target.closest("[data-student]"), classButton=event.target.closest("[data-class]"), tableAllButton=event.target.closest("[data-table-all]"), numberAllButton=event.target.closest("[data-number-all]"), letterAllButton=event.target.closest("[data-letter-all]"), addendAllButton=event.target.closest("[data-addend-all]"), reportTopicButton=event.target.closest("[data-report-topic]");
    if (keyButton) { handleKeypad(keyButton.dataset.key); return; }
    if (letterChoiceButton) { await submitLetterAnswer(letterChoiceButton.dataset.letterChoice); return; }
    if (drillModeButton && state.tableDrill && !state.tableDrill.completedAt) {
      state.tableDrill.confirmationMode=drillModeButton.dataset.drillMode === "auto" ? "auto" : "enter";
      renderTableDrill();
      return;
    }
    if (topicButton) {
      if (topicButton.dataset.topic === "tableDrill") { startTableDrill(); return; }
      stopTableDrillTimer(); state.tableDrill=null; state.selectedTopic=topicButton.dataset.topic; state.questionNumber=1; state.sessionCorrect=0; state.sessionAnswers=[]; state.view="exercise"; newTask();
    }
    if (studentButton) { state.expandedStudent=studentButton.dataset.student; state.teacherTopicDetail=null; state.teacherPasswordFormOpen=false; state.teacherUsernameFormOpen=false; renderTeacher(); }
    if (classButton) { state.activeClassId=classButton.dataset.class; state.expandedStudent=null; state.teacherTopicDetail=null; state.studentFormOpen=false; state.teacherPasswordFormOpen=false; state.teacherUsernameFormOpen=false; state.classRenameFormOpen=false; renderTeacher(); return; }
    if (tableAllButton) { const student=db.users.find(user=>user.id===tableAllButton.dataset.tableAll); if (student) { student.assignedTables=[...SMALL_TABLES]; save(); renderTeacher(); } return; }
    if (numberAllButton) { const student=db.users.find(user=>user.id===numberAllButton.dataset.numberAll); if (student) { student.assignedNumbers=[...SMALL_TABLES]; save(); renderTeacher(); } return; }
    if (letterAllButton) { const student=db.users.find(user=>user.id===letterAllButton.dataset.letterAll); if (student) { student.assignedLetters=[...LETTER_KEYS]; save(); renderTeacher(); } return; }
    if (addendAllButton) { const student=db.users.find(user=>user.id===addendAllButton.dataset.addendAll); if (student) { addendAllButton.dataset.addendPosition === "second" ? student.assignedAddendSeconds=[...SINGLE_DIGITS] : student.assignedAddends=[...SINGLE_DIGITS]; save(); renderTeacher(); } return; }
    if (reportTopicButton) { state.teacherTopicDetail=reportTopicButton.dataset.reportTopic; renderTeacher(); return; }
    if (!actionButton) return;
    const action=actionButton.dataset.action;
    if (action==="logout") { stopTableDrillTimer(); if (usingCentralDatabase) await backend.signOut(); Object.assign(state,{user:null,view:"login",task:null,tableDrill:null}); renderLogin(); }
    if (action==="change-password" && state.user.role==="student") { state.view="change-password"; renderStudentPassword(); }
    if (action==="home") { stopTableDrillTimer(); state.tableDrill=null; state.task=null; state.view="student"; renderStudentHome(); }
    if (action==="restart-table-drill") { startTableDrill(); }
    if (action==="practice-table-troubles" && state.tableDrill) {
      const drill=state.tableDrill;
      const pairs=Object.entries(drill.roundResults).filter(([,attempt])=>!attempt.correct || attempt.responseTime>4).map(([key])=>{ const [row,column]=key.split("-").map(Number); return {row,column}; });
      if (pairs.length) startTableDrill({pairs,cells:drill.cells,confirmationMode:drill.confirmationMode});
    }
    if (action==="continue-after-correction") { state.questionNumber++; newTask(); }
    if (action==="close-topic-detail") { state.teacherTopicDetail=null; renderTeacher(); }
    if (action==="toggle-class-rename-form") { state.classRenameFormOpen=!state.classRenameFormOpen; state.studentFormOpen=false; state.teacherPasswordFormOpen=false; state.teacherUsernameFormOpen=false; renderTeacher(); if (state.classRenameFormOpen) document.getElementById("class-rename")?.focus(); }
    if (action==="delete-class") {
      const activeClass=db.classes.find(item=>item.id===state.activeClassId);
      if (!activeClass || db.classes.length <= 1) return;
      const classStudents=db.users.filter(user=>user.role==="student" && user.classId===activeClass.id), studentCount=classStudents.length;
      if (confirm(`Vil du slette ${activeClass.name}? ${studentCount} ${studentCount===1?"elev":"elever"} og deres fremskridt slettes permanent.`)) {
        try {
          if (usingCentralDatabase) for (const student of classStudents) await backend.manageStudent("delete", { studentId:student.id });
          db.users=db.users.filter(user=>user.role!=="student" || user.classId!==activeClass.id); db.classes=db.classes.filter(item=>item.id!==activeClass.id);
          state.activeClassId=db.classes[0].id; state.expandedStudent=null; state.teacherTopicDetail=null; state.studentFormOpen=false; state.teacherPasswordFormOpen=false; state.teacherUsernameFormOpen=false; state.classRenameFormOpen=false; await save(); renderTeacher();
        } catch (deleteError) { alert("Klassen kunne ikke slettes fra den centrale database."); console.error(deleteError); }
      }
    }
    if (action==="toggle-student-username-form") { state.teacherUsernameFormOpen=!state.teacherUsernameFormOpen; state.studentFormOpen=false; state.teacherPasswordFormOpen=false; state.classRenameFormOpen=false; renderTeacher(); if (state.teacherUsernameFormOpen) document.getElementById("teacher-new-username")?.focus(); }
    if (action==="toggle-student-password-form") { state.teacherPasswordFormOpen=!state.teacherPasswordFormOpen; state.studentFormOpen=false; state.teacherUsernameFormOpen=false; state.classRenameFormOpen=false; renderTeacher(); if (state.teacherPasswordFormOpen) document.getElementById("teacher-new-password")?.focus(); }
    if (action==="reset-topic-progress") {
      const topic=actionButton.dataset.resetTopic, student=db.users.find(user=>user.id===actionButton.dataset.resetStudent && user.role==="student");
      if (!student || !TOPICS[topic]) return;
      const count=(student.results || []).filter(item=>item.topic===topic).length;
      if (confirm(`Vil du nulstille fremskridtet i ${TOPICS[topic].name} for ${student.name}? ${count} besvarelser slettes permanent.`)) {
        try {
          if (usingCentralDatabase) await backend.deleteResults(student.id, topic);
          student.results=(student.results || []).filter(item=>item.topic!==topic); state.teacherTopicDetail=null; await save(); renderTeacher();
        } catch (resetError) { alert("Fremskridtet kunne ikke nulstilles."); console.error(resetError); }
      }
    }
    if (action==="toggle-student-form") { state.studentFormOpen=!state.studentFormOpen; state.teacherPasswordFormOpen=false; state.teacherUsernameFormOpen=false; state.classRenameFormOpen=false; renderTeacher(); if (state.studentFormOpen) document.getElementById("student-name")?.focus(); }
    if (action==="remove-student") {
      const student=db.users.find(user=>user.id===state.expandedStudent && user.role==="student" && user.classId===state.activeClassId);
      if (student && confirm(`Vil du fjerne ${student.name} fra klassen? Elevens resultater bliver også slettet.`)) {
        try {
          if (usingCentralDatabase) await backend.manageStudent("delete", { studentId:student.id });
          db.users=db.users.filter(user=>user.id!==student.id); state.expandedStudent=null; state.teacherTopicDetail=null; await save(); renderTeacher();
        } catch (removeError) { alert("Eleven kunne ikke fjernes."); console.error(removeError); }
      }
    }
    if (action==="reset-demo") { if (confirm("Vil du nulstille alle demoresultater?")) { db=normalizeDatabase(defaultDatabase()); state.user=db.users.find(u=>u.role==="teacher"); state.studentFormOpen=false; save(); renderTeacher(); } }
  });
  document.addEventListener("change", event => {
    const letterStudentId = event.target.dataset?.letterStudent;
    if (letterStudentId) {
      const student = db.users.find(user => user.id === letterStudentId && user.role === "student");
      if (!student) return;
      const letter = event.target.value, next = new Set(student.assignedLetters);
      event.target.checked ? next.add(letter) : next.delete(letter);
      if (!next.size) { event.target.checked=true; return; }
      student.assignedLetters=LETTER_KEYS.filter(item=>next.has(item)); save();
      const count=document.querySelector(".letter-selection-count"); if (count) count.textContent=student.assignedLetters.length;
      return;
    }
    const numberStudentId = event.target.dataset?.numberStudent;
    if (numberStudentId) {
      const student = db.users.find(user => user.id === numberStudentId && user.role === "student");
      if (!student) return;
      const number = Number(event.target.value), next = new Set(student.assignedNumbers);
      event.target.checked ? next.add(number) : next.delete(number);
      if (!next.size) { event.target.checked=true; return; }
      student.assignedNumbers=[...next].sort((a,b)=>a-b); save();
      const count=document.querySelector(".number-selection-count"); if (count) count.textContent=student.assignedNumbers.length;
      return;
    }
    const addendStudentId = event.target.dataset?.addendStudent;
    if (addendStudentId) {
      const student = db.users.find(user => user.id === addendStudentId && user.role === "student");
      if (!student) return;
      const position = event.target.dataset.addendPosition === "second" ? "second" : "first";
      const key = position === "second" ? "assignedAddendSeconds" : "assignedAddends";
      const addend = Number(event.target.value), next = new Set(student[key]);
      event.target.checked ? next.add(addend) : next.delete(addend);
      if (!next.size) { event.target.checked=true; return; }
      student[key]=[...next].sort((a,b)=>a-b); save();
      const count=document.querySelector(`.addition-selection-count[data-addend-position="${position}"]`); if (count) count.textContent=student[key].length;
      return;
    }
    const tableStudentId = event.target.dataset?.tableStudent;
    if (tableStudentId) {
      const student = db.users.find(user => user.id === tableStudentId && user.role === "student");
      if (!student) return;
      const table = Number(event.target.value), next = new Set(student.assignedTables);
      event.target.checked ? next.add(table) : next.delete(table);
      if (!next.size) { event.target.checked=true; return; }
      student.assignedTables=[...next].sort((a,b)=>a-b); save();
      const count=document.querySelector(".table-selection-count"); if (count) count.textContent=student.assignedTables.length;
      return;
    }
    const studentId = event.target.dataset?.studentClass;
    if (!studentId) return;
    const student = db.users.find(user => user.id === studentId && user.role === "student");
    const targetClass = db.classes.find(item => item.id === event.target.value);
    if (!student || !targetClass) return;
    student.classId=targetClass.id; state.expandedStudent=null; state.teacherTopicDetail=null; save(); renderTeacher();
  });
  document.addEventListener("keydown", event => {
    const student=event.target.closest?.("[data-student]");
    if (student && (event.key==="Enter"||event.key===" ")) { event.preventDefault(); student.click(); return; }
    if (state.view !== "exercise" || state.answered) return;
    if (/^\d$/.test(event.key)) handleKeypad(event.key);
    if (event.key === "-") handleKeypad("minus");
    if (event.key === "Backspace") handleKeypad("delete");
    if (event.key === "Enter") handleKeypad("enter");
  });
  async function start() {
    if (!usingCentralDatabase) { render(); return; }
    try {
      const loaded = await backend.loadDatabase();
      db = normalizeDatabase(loaded.database, false);
      state.user = db.users.find(user => user.id === loaded.currentUserId);
      if (!state.user) throw new Error("Brugerprofilen mangler.");
      state.view = state.user.role === "teacher" ? "teacher" : "student";
      if (state.user.role === "teacher") await save();
      render();
    } catch {
      state.user=null; state.view="login"; renderLogin();
    }
  }
  start();
})();
