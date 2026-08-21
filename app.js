/* Matbootcamp — al logik er almindelig JavaScript uden frameworks. */
(() => {
  "use strict";

  const STORAGE_KEY = "matbootcamp-db-v1";
  const TOPICS = {
    basics: { name: "Basisregler", icon: "0 · 1", description: "Regneregler med 0 og 1" },
    multiplication: { name: "Gangestykker", icon: "7 × 8", description: "Den lille tabel fra 0×0 til 10×10" },
    pemdas: { name: "Regnehierarki", icon: "2 + 3 × 4", description: "Gange før plus og minus" },
    negatives: { name: "Negative tal", icon: "−4 + 7", description: "Plus, minus og gange" },
    distributive: { name: "Distributiv lov", icon: "3(4 + 5)", description: "Gang ind i parentesen" },
  };

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (items) => items[rand(0, items.length - 1)];
  const SMALL_TABLES = Array.from({length:11}, (_,index) => index);
  const makeTask = (topic, expression, answer, hint = "", options = {}) => ({ topic, expression, answer, hint, ...options });

  /* Hvert emne er et selvstændigt modul med generate, calculate og evaluate. */
  const MathModules = {
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
    const multiplicationExamples = [[7,9],[9,7],[6,8],[8,6],[4,7],[7,4],[3,9],[9,3],[5,8],[8,5],[2,6],[6,2]];
    const negativeExamples = [[3,"+",4],[3,"+",-4],[-3,"+",4],[-3,"+",-4],[5,"−",2],[5,"−",-2],[-5,"−",2],[-5,"−",-2],[3,"×",4],[3,"×",-4],[-3,"×",4],[-3,"×",-4]];
    Object.keys(TOPICS).forEach((topic, topicIndex) => {
      const p = patterns[profile[topic] || "steady"];
      const sampleCount = topic === "negatives" ? negativeExamples.length : 8 + topicIndex;
      for (let i = 0; i < sampleCount; i++) {
        const pair = multiplicationExamples[i % multiplicationExamples.length];
        const negative = negativeExamples[i % negativeExamples.length];
        const task = topic === "multiplication"
          ? makeTask("multiplication", `${pair[0]} × ${pair[1]}`, pair[0] * pair[1])
          : topic === "negatives"
          ? makeTask("negatives", `${negative[0]} ${negative[1]} ${negative[2] < 0 ? `(${negative[2]})` : negative[2]}`, MathModules.negatives.calculate(...negative))
          : MathModules[topic].generate(2);
        const correct = ((i * 17 + topicIndex * 7) % 100) / 100 < p.accuracy;
        const sampleTime = +(p.time[0] + ((i * 13) % 10) / 10 * (p.time[1] - p.time[0])).toFixed(1);
        results.push({ topic, problem: task.expression, correct, answer: correct ? task.answer : task.answer + 2, correctAnswer: task.answer, responseTime:topic === "multiplication" ? Math.min(10, sampleTime) : sampleTime, timestamp: new Date(Date.now() - (results.length + 1) * 36e5 * 9).toISOString() });
      }
    });
    return results;
  }

  function defaultDatabase() {
    return {
      classes: [
        { id:"c1", name:"7.A" },
        { id:"c2", name:"8.B" },
      ],
      users: [
        { id: "s1", classId:"c1", role: "student", username: "alma7", password: "1234", name: "Alma", results: seedResults({ basics:"steady", multiplication:"strong", pemdas:"steady", negatives:"needsWork", distributive:"steady" }) },
        { id: "s2", classId:"c1", role: "student", username: "noah4", password: "1234", name: "Noah", results: seedResults({ basics:"needsWork", multiplication:"steady", pemdas:"needsWork", negatives:"steady", distributive:"strong" }) },
        { id: "s3", classId:"c2", role: "student", username: "freja9", password: "1234", name: "Freja", results: seedResults({ basics:"strong", multiplication:"strong", pemdas:"strong", negatives:"steady", distributive:"strong" }) },
        { id: "s4", classId:"c2", role: "student", username: "malik2", password: "1234", name: "Malik", results: seedResults({ basics:"new", multiplication:"new", pemdas:"needsWork", negatives:"needsWork", distributive:"new" }) },
        { id: "t1", role: "teacher", username: "laerer", password: "skole123", name: "Mette" },
      ],
    };
  }

  function loadDatabase() {
    try {
      const legacyStorageKey = Object.keys(localStorage).find(key => key !== STORAGE_KEY && key.endsWith("-db-v1"));
      const stored = localStorage.getItem(STORAGE_KEY) || (legacyStorageKey ? localStorage.getItem(legacyStorageKey) : null);
      if (stored && !localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, stored);
      return JSON.parse(stored) || defaultDatabase();
    }
    catch { return defaultDatabase(); }
  }
  function normalizeDatabase(database) {
    if (!Array.isArray(database.classes) || !database.classes.length) database.classes = [{id:"c1",name:"7.A"},{id:"c2",name:"8.B"}];
    const validIds = new Set(database.classes.map(item => item.id));
    (database.users || []).filter(user => user.role === "student").forEach(user => {
      if (!validIds.has(user.classId)) user.classId = ["s3","s4"].includes(user.id) && validIds.has("c2") ? "c2" : database.classes[0].id;
      if (!Array.isArray(user.assignedTables) || !user.assignedTables.length) user.assignedTables = [...SMALL_TABLES];
      user.assignedTables = [...new Set(user.assignedTables.map(Number).filter(number => SMALL_TABLES.includes(number)))].sort((a,b)=>a-b);
    });
    return database;
  }
  let db = normalizeDatabase(loadDatabase());
  const state = { user: null, view: "login", selectedTopic: "mixed", task: null, taskStartedAt: 0, answered: false, questionNumber: 1, sessionCorrect: 0, sessionAnswers: [], expandedStudent: "s1", activeClassId:null, teacherTopicDetail: null };
  const app = document.getElementById("app");
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  // Gangestykker registreres højst som 10 sekunder – også når ældre data vises.
  const recordedTime = (result) => result.topic === "multiplication"
    ? Math.min(10, Math.max(0, Number(result.responseTime) || 0))
    : Math.max(0, Number(result.responseTime) || 0);

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
    const pool = Object.keys(TOPICS).map(topic => ({ topic, weight:getStats(user, topic).weight }));
    let pointer = Math.random() * pool.reduce((sum, item) => sum + item.weight, 0);
    for (const item of pool) { pointer -= item.weight; if (pointer <= 0) return item.topic; }
    return pool[0].topic;
  }

  function header() {
    return `<header class="topbar"><div class="brand"><span class="brand-mark">∑</span><span>Matbootcamp</span></div><div class="top-actions"><span class="user-pill">${escapeHtml(state.user.name)} · ${state.user.role === "teacher" ? "Lærer" : "Elev"}</span><button class="btn ghost" data-action="logout">Log ud</button></div></header>`;
  }
  function renderLogin() {
    app.innerHTML = `<div class="login-wrap"><section class="login-intro"><span class="eyebrow">Matematik der følger dig</span><h1>Bliv stærkere, ét svar ad gangen.</h1><p>Matbootcamp finder det niveau, der udfordrer dig tilpas — og giver mere træning dér, hvor du har brug for den.</p><div class="math-trail"><span>7 × 8</span><span>−4 + 9</span><span>3(2 + 5)</span><span>6 + 2 × 4</span></div></section><section class="login-panel"><form class="login-card" id="login-form"><h2>Godt at se dig</h2><p>Log ind som elev eller lærer for at fortsætte.</p><div class="field"><label for="username">Brugernavn</label><input id="username" name="username" autocomplete="username" autocapitalize="none" placeholder="fx alma7" required></div><div class="field"><label for="password">Adgangskode</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Din adgangskode" required></div><p id="login-error" class="error" role="alert"></p><button class="btn full" type="submit">Log ind</button><div class="demo-box"><strong>Prøv demoen</strong><br>Elev: alma7 / 1234<br>Lærer: laerer / skole123</div></form></section></div>`;
    document.getElementById("username").focus();
  }
  function renderStudentHome() {
    const stats = Object.keys(TOPICS).map(topic => ({ topic, ...getStats(state.user, topic) }));
    const total = (state.user.results || []).length;
    app.innerHTML = `${header()}<div class="page"><section class="hero-line"><div><span class="eyebrow">Din træning</span><h1>Hej ${escapeHtml(state.user.name)}!</h1><p>Hvad vil du øve i dag?</p></div><div class="streak"><span>I alt løst</span><strong>${total} opgaver</strong></div></section><h2 class="section-label">Vælg et område</h2><section class="topic-grid"><button class="topic-card mixed" data-topic="mixed"><span class="topic-icon">∞</span><strong>Blandet træning</strong><small>Systemet vælger smart for dig</small></button>${Object.entries(TOPICS).map(([key,t]) => `<button class="topic-card" data-topic="${key}"><span class="topic-icon">${t.icon}</span><strong>${t.name}</strong><small>${t.description}</small></button>`).join("")}</section><h2 class="section-label">Dine seneste tal</h2><section class="recent-strip">${stats.map(s => `<article class="mini-stat"><span>${TOPICS[s.topic].name}</span><strong>${s.count ? Math.round(s.accuracy*100)+" %" : "Ny"}</strong><small>${s.count ? s.avgTime.toFixed(1)+" sek. i snit" : "Klar til første opgave"}</small></article>`).join("")}</section></div>`;
  }
  function newTask() {
    const topic = state.selectedTopic === "mixed" ? chooseWeightedTopic(state.user) : state.selectedTopic;
    state.task = MathModules[topic].generate(getStats(state.user, topic).level, state.user);
    state.taskStartedAt = Date.now(); state.answered = false;
    renderExercise();
  }
  function renderExercise() {
    const task = state.task;
    const cycleStart = Math.floor((state.questionNumber - 1) / 10) * 10;
    const cycleAnswers = state.sessionAnswers.slice(cycleStart, cycleStart + 10);
    // Historikken følger det ordnede talpar. 7 × 9 og 9 × 7 har hver sin historik.
    const pairAttempts = task.topic === "multiplication"
      ? (state.user.results || []).filter(item => item.topic === "multiplication" && item.problem === task.expression).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-8)
      : [];
    const attemptHistory = pairAttempts.length ? `<aside class="pair-history" aria-label="Historik for ${escapeHtml(task.expression)}">${pairAttempts.map(item => {
      const fast = item.correct && recordedTime(item) <= 5;
      const kind = !item.correct ? "wrong" : fast ? "fast" : "slow";
      const label = !item.correct ? "Forkert besvaret" : fast ? "Korrekt på højst 5 sekunder" : "Korrekt på over 5 sekunder";
      return `<span class="history-mark ${kind}" role="img" aria-label="${label}" title="${label} · ${recordedTime(item).toFixed(1)} s">${item.correct ? "✓" : "×"}</span>`;
    }).join("")}</aside>` : "";
    const undefinedKey = task.answerType === "undefined" ? `<button class="key utility impossible" type="button" data-key="undefined">Kan ikke beregnes</button>` : "";
    const answerSection = `<form class="answer-area" id="answer-form">
          <label class="sr-only" for="answer">Dit svar</label>
          <input class="answer-input" id="answer" name="answer" inputmode="none" autocomplete="off" placeholder="Dit svar" readonly>
          <div class="keypad" aria-label="Taltastatur">
            ${[1,2,3,4,5,6,7,8,9].map(number => `<button class="key" type="button" data-key="${number}">${number}</button>`).join("")}
            <button class="key utility" type="button" data-key="minus" aria-label="Minustegn">−</button>
            <button class="key" type="button" data-key="0">0</button>
            <button class="key utility" type="button" data-key="delete">Slet</button>
            ${undefinedKey}
            <button class="key enter" type="button" data-key="enter">Enter</button>
          </div>
          <p id="answer-error" class="error" role="alert"></p>
        </form>`;
    const shownAnswer = task.answer === "undefined" ? "Kan ikke beregnes" : task.answer;
    const factors = task.topic === "multiplication" ? task.expression.split(" × ") : [];
    const correctionSection = task.topic === "multiplication" && factors.length === 2
      ? `<section class="correction-area" role="alert"><p>Det korrekte svar er</p><button class="correction-wheel" type="button" data-action="continue-after-correction" aria-label="Det korrekte svar er ${escapeHtml(shownAnswer)}. Tryk for næste opgave"><strong>${escapeHtml(shownAnswer)}</strong><span>${escapeHtml(factors[0])}</span><span>${escapeHtml(factors[1])}</span></button><small>Tryk på svaret for næste opgave</small></section>`
      : `<section class="correction-area" role="alert"><p>Det korrekte svar er</p><button class="correction-answer" type="button" data-action="continue-after-correction">${escapeHtml(shownAnswer)}</button><small>Tryk på svaret for næste opgave</small></section>`;

    app.innerHTML = `${header()}<div class="page exercise-page">
      <div class="exercise-head"><button class="btn secondary" data-action="home">← Vælg emne</button><span class="topic-tag">${TOPICS[task.topic].name}</span></div>
      <section class="question-card">
        <div class="question-top"><span class="question-number">Opgave ${state.questionNumber}</span><div class="question-main ${attemptHistory ? "with-history" : ""}"><div class="expression">${task.expression}</div>${attemptHistory}</div><p class="hint">${escapeHtml(task.hint || "Skriv dit svar nedenfor.")}</p></div>
        ${state.answered ? correctionSection : answerSection}
      </section>
      <div class="progress-row" aria-label="Svar i denne runde">${Array.from({length:10},(_,i)=>`<i class="progress-dot ${cycleAnswers[i] === true ? "correct" : cycleAnswers[i] === false ? "wrong" : ""}"></i>`).join("")}</div>
    </div>`;
  }
  function submitAnswer(form) {
    if (state.answered) return;
    const raw = new FormData(form).get("answer").trim().replace(",", ".");
    const isUndefinedAnswer = raw === "Kan ikke beregnes";
    if (raw === "" || (!isUndefinedAnswer && !Number.isFinite(Number(raw)))) { document.getElementById("answer-error").textContent = "Vælg eller skriv et svar først."; return; }
    const measuredTime = Math.max(.1, (Date.now() - state.taskStartedAt) / 1000);
    const responseTime = state.task.topic === "multiplication" ? Math.min(10, measuredTime) : measuredTime;
    const correct = MathModules[state.task.topic].evaluate(raw, state.task);
    state.answered = true; state.sessionAnswers.push(correct); if (correct) state.sessionCorrect++;
    state.user.results.push({ topic:state.task.topic, problem:state.task.expression, answer:isUndefinedAnswer ? "Kan ikke beregnes" : Number(raw), correctAnswer:state.task.answer === "undefined" ? "Kan ikke beregnes" : state.task.answer, correct, responseTime:+responseTime.toFixed(2), timestamp:new Date().toISOString() });
    save();
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

    if (key === "enter") return submitAnswer(form);
    if (key === "undefined") input.value = "Kan ikke beregnes";
    else if (key === "delete") input.value = input.value === "Kan ikke beregnes" ? "" : input.value.slice(0, -1);
    else if (key === "minus") input.value = input.value === "Kan ikke beregnes" ? "-" : input.value.startsWith("-") ? input.value.slice(1) : `-${input.value}`;
    else if (/^\d$/.test(key) && input.value.replace("-", "").length < 8) input.value = input.value === "Kan ikke beregnes" ? key : input.value + key;

    document.getElementById("answer-error").textContent = "";
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
      basics:"Øv reglerne med 0 og 1 i korte serier. Tal især om, hvorfor division med 0 ikke kan beregnes.",
      multiplication:"Træn korte serier i de tabeller, hvor svartiden er højest. Stop, mens sikkerheden stadig er god.",
      pemdas:"Lad eleven markere gange- og divisionsled før udregningen. Brug få led og øg gradvist.",
      negatives:"Brug tallinje og lad eleven forklare retningen, før svaret tastes. Start med plus og minus.",
      distributive:"Lad eleven sige de to delprodukter højt, før de lægges sammen. Brug små tal først.",
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

  // Et ordnet talpar er lært, når eleven på et tidspunkt har haft tre
  // korrekte besvarelser i træk på højst fem sekunder hver.
  function multiplicationPairMastery(items) {
    const ordered = [...items].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    let streak = 0, learned = false;
    ordered.forEach(item => {
      streak = item.correct && recordedTime(item) <= 5 ? streak + 1 : 0;
      if (streak >= 3) learned = true;
    });
    if (learned) return { learned:true, streak:3 };
    let currentStreak = 0;
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (ordered[i].correct && recordedTime(ordered[i]) <= 5) currentStreak++;
      else break;
    }
    return { learned:false, streak:Math.min(2,currentStreak) };
  }

  const accuracyColor = (accuracy) => `hsl(${Math.round(accuracy * 1.2)} 72% 86%)`;
  const responseTimeColor = (seconds) => {
    const capped = Math.min(10, Math.max(0, seconds));
    return `hsl(${Math.round((1 - capped / 10) * 120)} 72% 86%)`;
  };

  function renderMultiplicationDetail(user) {
    const grouped = multiplicationPairStats(user);
    const columns = Array.from({length:11}, (_,i) => i);
    const learnedCount = [...grouped.values()].filter(items => multiplicationPairMastery(items).learned).length;
    const cells = (a) => columns.map(b => {
      const items = grouped.get(`${a}-${b}`) || [];
      if (!items.length) return `<td class="pair-cell empty-pair" title="${a} × ${b}: ingen svar"><strong>—</strong><small>0 svar</small></td>`;
      const correctCount = items.filter(item => item.correct).length;
      const accuracy = Math.round(correctCount / items.length * 100);
      const avgTime = items.reduce((sum,item) => sum + recordedTime(item), 0) / items.length;
      const mastery = multiplicationPairMastery(items);
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
    let studentDetail = `<div class="empty-class"><span class="empty-class-icon">＋</span><h2>Klassen har ingen elever endnu</h2><p>Vælg en anden klasse og flyt en elev hertil fra elevens klassevælger.</p></div>`;

    if (selected) {
      const current = getOverallStats(selected,20), progress = getProgress(selected), trend = getTrend(selected);
      const topicStats = Object.keys(TOPICS).map(topic => ({ topic, ...getStats(selected,topic) }));
      const ranked = [...topicStats].filter(item => item.count).sort((a,b) => (a.accuracy-a.avgTime/100)-(b.accuracy-b.avgTime/100));
      const challenge = ranked[0] || { topic:"multiplication", accuracy:0, avgTime:0, status:"new" };
      const strength = ranked[ranked.length-1] || challenge;
      const progressCopy = progress.direction === "up" ? `+${progress.delta} procentpoint` : progress.direction === "down" ? `${progress.delta} procentpoint` : "Stabilt niveau";
      studentDetail = `
        <section class="student-profile-head"><div class="student-name"><span class="avatar large">${selected.name.slice(0,1)}</span><div><span class="eyebrow">Elevprofil</span><h2>${escapeHtml(selected.name)}</h2><p>${summaryFor(selected)}</p></div></div><div class="student-profile-actions"><span class="progress-badge ${progress.direction}">${progress.direction==="up"?"↗":progress.direction==="down"?"↘":"→"} ${progressCopy}</span><label>Klasse<select data-student-class="${selected.id}">${classes.map(item => `<option value="${item.id}" ${item.id===selected.classId?"selected":""}>${escapeHtml(item.name)}</option>`).join("")}</select></label></div></section>

        <section class="student-kpis">
          <article><span>Seneste 20</span><strong>${Math.round(current.accuracy*100)} %</strong><small>korrekte svar</small></article>
          <article><span>Svartid</span><strong>${current.avgTime.toFixed(1)} s</strong><small>gennemsnit</small></article>
          <article><span>Stærkest</span><strong>${TOPICS[strength.topic].name}</strong><small>${Math.round(strength.accuracy*100)} % rigtige</small></article>
        </section>

        <section class="table-assignment" aria-labelledby="table-assignment-title">
          <div class="table-assignment-head"><div><span class="eyebrow">Opgavestyring</span><h3 id="table-assignment-title">Lille tabel til ${escapeHtml(selected.name)}</h3><p>Sæt flueben ved de tabeller, eleven skal møde. Det valgte tal står som første faktor.</p></div><button class="btn secondary compact" type="button" data-table-all="${selected.id}">Vælg alle</button></div>
          <div class="table-choices">${SMALL_TABLES.map(number => `<label class="table-choice"><input type="checkbox" value="${number}" data-table-student="${selected.id}" ${selected.assignedTables.includes(number)?"checked":""}><span>${number}</span><small>${number}-tabellen</small></label>`).join("")}</div>
          <p class="table-selection-note"><strong class="table-selection-count">${selected.assignedTables.length}</strong> af 11 tabeller valgt. Mindst én tabel skal være markeret.</p>
        </section>

        <section class="analytics-grid">
          <article class="chart-card"><div class="chart-title"><div><span>Fremskridt</span><h3>Rigtige svar over tid</h3></div><small>6 perioder</small></div>${accuracyChart(trend)}</article>
          <article class="chart-card"><div class="chart-title"><div><span>Tempo</span><h3>Svartid over tid</h3></div><small>Lavere er bedre</small></div>${timeChart(trend)}</article>
        </section>

        <section class="insight-grid">
          <article class="focus-card"><span class="focus-icon">!</span><div><span class="eyebrow">Største udfordring</span><h3>${TOPICS[challenge.topic].name}</h3><p>${recommendationFor(challenge.topic)}</p><div class="evidence"><span>${Math.round(challenge.accuracy*100)} % rigtige</span><span>${challenge.avgTime.toFixed(1)} sek.</span></div></div></article>
          <article class="topic-performance"><div class="chart-title"><div><span>Emner</span><h3>Sikkerhed og tempo</h3></div><small>Seneste 20 pr. emne</small></div>
            ${topicStats.map(stat => { const pct=Math.round(stat.accuracy*100), cls=stat.status==="strong"?"strong":stat.status==="weak"?"weak":"medium"; const detailLabel=stat.topic==="multiplication"?" · Se talpar →":stat.topic==="negatives"?" · Se fortegn →":""; const content=`<div><strong>${TOPICS[stat.topic].name}</strong><small>${stat.count} svar · ${stat.count?stat.avgTime.toFixed(1):"—"} sek.${detailLabel}</small></div><div class="topic-meter"><span><i class="${cls}" style="width:${stat.count?pct:0}%"></i></span><b>${stat.count?pct+" %":"—"}</b></div>`; return ["multiplication","negatives"].includes(stat.topic) ? `<button class="topic-row topic-row-button ${state.teacherTopicDetail===stat.topic?"active":""}" data-report-topic="${stat.topic}" aria-expanded="${state.teacherTopicDetail===stat.topic}">${content}</button>` : `<div class="topic-row">${content}</div>`; }).join("")}
          </article>
        </section>
        ${state.teacherTopicDetail === "multiplication" ? renderMultiplicationDetail(selected) : ""}
        ${state.teacherTopicDetail === "negatives" ? renderNegativeDetail(selected) : ""}`;
    }

    app.innerHTML = `${header()}<div class="page teacher-page">
      <section class="dashboard-head"><div><span class="eyebrow">Lærerportal</span><h1>${escapeHtml(activeClass.name)} lige nu</h1><p>Følg udvikling, opdag udfordringer og vælg næste fokus.</p></div><button class="btn secondary" data-action="reset-demo">Nulstil demodata</button></section>
      <section class="class-manager" aria-label="Klasser">
        <div class="class-manager-title"><div><span class="eyebrow">Dine klasser</span><strong>${classes.length} ${classes.length===1?"klasse":"klasser"}</strong></div><form id="class-form" class="class-form"><label class="sr-only" for="class-name">Navn på ny klasse</label><input id="class-name" name="className" maxlength="30" placeholder="fx 9.A" required><button class="btn" type="submit">Opret klasse</button></form></div>
        <div class="class-tabs" role="tablist">${classes.map(item => { const count=db.users.filter(user=>user.role==="student"&&user.classId===item.id).length; return `<button role="tab" aria-selected="${item.id===activeClass.id}" class="class-tab ${item.id===activeClass.id?"active":""}" data-class="${item.id}"><strong>${escapeHtml(item.name)}</strong><small>${count} ${count===1?"elev":"elever"}</small></button>`; }).join("")}</div>
        <p id="class-error" class="class-error" role="alert"></p>
      </section>
      <section class="class-kpis">
        <article><span>Elever</span><strong>${students.length}</strong><small>aktive profiler</small></article>
        <article><span>Besvarelser</span><strong>${allResults.length}</strong><small>registreret i alt</small></article>
        <article><span>Klassens sikkerhed</span><strong>${classAccuracy} %</strong><small>korrekte svar</small></article>
        <article class="${needsAttention ? "attention" : ""}"><span>Kræver blik</span><strong>${needsAttention}</strong><small>elever med udfordringer</small></article>
      </section>

      <section class="teacher-layout">
        <aside class="roster-panel"><div class="panel-title"><h2>Elever</h2><span>${students.length}</span></div><div class="roster-list">
          ${students.map(student => { const stats=getOverallStats(student,20), weak=Object.keys(TOPICS).some(topic=>getStats(student,topic).status==="weak"); return `<button class="roster-item ${student.id===selected?.id?"active":""}" data-student="${student.id}"><span class="avatar">${student.name.slice(0,1)}</span><span><strong>${student.name}</strong><small>${Math.round(stats.accuracy*100)} % · ${stats.avgTime.toFixed(1)} sek.</small></span><i class="status-light ${weak?"weak":"good"}" aria-label="${weak?"Har udfordringer":"På rette spor"}"></i></button>`; }).join("")}
        </div></aside>
        <div class="teacher-detail">${studentDetail}</div>
      </section>
    </div>`;
  }
  function render() { if (!state.user) renderLogin(); else if (state.view==="teacher") renderTeacher(); else if (state.view==="exercise") newTask(); else renderStudentHome(); }

  document.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.id === "login-form") {
      const data = new FormData(event.target), username=String(data.get("username")).trim().toLowerCase(), password=String(data.get("password"));
      const user = db.users.find(u=>u.username.toLowerCase()===username && u.password===password);
      if (!user) { document.getElementById("login-error").textContent="Brugernavn eller adgangskode passer ikke."; return; }
      state.user=user; state.view=user.role==="teacher"?"teacher":"student"; render();
    } else if (event.target.id === "class-form") {
      const name = String(new FormData(event.target).get("className") || "").trim();
      const error = document.getElementById("class-error");
      if (!name) { error.textContent="Skriv et navn til klassen."; return; }
      if (db.classes.some(item => item.name.toLowerCase() === name.toLowerCase())) { error.textContent="Der findes allerede en klasse med det navn."; return; }
      const newClass = { id:`c-${Date.now().toString(36)}`, name };
      db.classes.push(newClass); state.activeClassId=newClass.id; state.expandedStudent=null; state.teacherTopicDetail=null; save(); renderTeacher();
    } else if (event.target.id === "answer-form") submitAnswer(event.target);
  });
  document.addEventListener("click", (event) => {
    const keyButton=event.target.closest("[data-key]"), topicButton=event.target.closest("[data-topic]"), actionButton=event.target.closest("[data-action]"), studentButton=event.target.closest("[data-student]"), classButton=event.target.closest("[data-class]"), tableAllButton=event.target.closest("[data-table-all]"), reportTopicButton=event.target.closest("[data-report-topic]");
    if (keyButton) { handleKeypad(keyButton.dataset.key); return; }
    if (topicButton) { state.selectedTopic=topicButton.dataset.topic; state.questionNumber=1; state.sessionCorrect=0; state.sessionAnswers=[]; state.view="exercise"; newTask(); }
    if (studentButton) { state.expandedStudent=studentButton.dataset.student; state.teacherTopicDetail=null; renderTeacher(); }
    if (classButton) { state.activeClassId=classButton.dataset.class; state.expandedStudent=null; state.teacherTopicDetail=null; renderTeacher(); return; }
    if (tableAllButton) { const student=db.users.find(user=>user.id===tableAllButton.dataset.tableAll); if (student) { student.assignedTables=[...SMALL_TABLES]; save(); renderTeacher(); } return; }
    if (reportTopicButton) { state.teacherTopicDetail=reportTopicButton.dataset.reportTopic; renderTeacher(); return; }
    if (!actionButton) return;
    const action=actionButton.dataset.action;
    if (action==="logout") { Object.assign(state,{user:null,view:"login",task:null}); renderLogin(); }
    if (action==="home") { state.view="student"; renderStudentHome(); }
    if (action==="continue-after-correction") { state.questionNumber++; newTask(); }
    if (action==="close-topic-detail") { state.teacherTopicDetail=null; renderTeacher(); }
    if (action==="reset-demo") { if (confirm("Vil du nulstille alle demoresultater?")) { db=normalizeDatabase(defaultDatabase()); state.user=db.users.find(u=>u.role==="teacher"); save(); renderTeacher(); } }
  });
  document.addEventListener("change", event => {
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
  render();
})();
