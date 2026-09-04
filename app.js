/* jacobmatematik — al logik er almindelig JavaScript uden frameworks. */
(() => {
  "use strict";

  const STORAGE_KEY = "jacobmatematik-db-v1";
  const TIMER_VISIBILITY_KEY = "jacobmatematik-show-exercise-timer";
  const LEGACY_STORAGE_KEYS = ["matbootcamp-db-v1", "talvaerkstedet-db-v1"];
  const TOPICS = {
    letters: { name: "Bogstavlæring", icon: "A B C", description: "Find billedet med den rigtige startlyd" },
    numbers: { name: "Tallene", icon: "● ● ●", description: "Tæl figurer og fingre fra 0 til 10" },
    addition: { name: "Plusstykker", icon: "4 + 5", description: "Plus med etcifrede tal" },
    basics: { name: "Basisregler", icon: "0 · 1", description: "Regneregler med 0 og 1" },
    multiplication: { name: "Lille tabel", icon: "7 × 8", description: "Gangestykker fra 0×0 til 10×10" },
    tableDrill: { name: "Tabel-drill", icon: "3 × 4", description: "Udfyld hele 1–9-tabellen på tid" },
    divisionDrill: { name: "Division-drill", icon: "63 ÷ 7", description: "Find den manglende faktor i hele 1–9-tabellen" },
    divisionLollipops: { name: "Divisions-slikkepinde", icon: "9 │ 63", description: "Træk cifret ned og løs divisionen trin for trin" },
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
  const DIVISION_LOLLIPOP_FACTS = TABLE_DRILL_VALUES.flatMap(divisor => TABLE_DRILL_VALUES.map(quotient => ({
    divisor,
    quotient,
    dividend:divisor * quotient,
  })));
  const MATRIX_DRILL_TOPICS = new Set(["tableDrill", "divisionDrill"]);
  const DRILL_SESSION_TOPICS = { tableDrill:"tableDrillSession", divisionDrill:"divisionDrillSession" };
  const LETTER_ITEMS = [
    ["A","abe","a-abe.webp"],["B","bæver","b-baever.webp"],["C","cacao","c-cacao.webp"],
    ["D","delfin","d-delfin.webp"],["E","egern","e-egern.webp"],["F","fisk","f-fisk.webp"],
    ["G","gris","g-gris.webp"],["H","hund","h-hund.webp"],["I","isbjørn","i-isbjoern.webp"],
    ["J","jaguar","j-jaguar.webp"],["K","kat","k-kat.webp"],["L","løve","l-loeve.webp"],
    ["M","mus","m-mus.webp"],["N","næsehorn","n-naesehorn.webp"],["O","orm","o-orm.webp"],
    ["P","pingvin","p-pingvin.webp"],["Q","quokka","q-quokka.webp"],["R","ræv","r-raev.webp"],
    ["S","sæl","s-sael.webp"],["T","tiger","t-tiger.webp"],["U","ugle","u-ugle.webp"],
    ["V","vaskebjørn","v-vaskebjoern.webp"],["W","wok","w-wok.webp"],["X","xylofon","x-xylofon.webp"],
    ["Y","yver","y-yver.webp"],["Z","zebra","z-zebra.webp"],["Æ","æsel","ae-aesel.webp"],
    ["Ø","økse","oe-oekse.webp"],["Å","ål","aa-aal.webp"],
  ].map(([letter,word,file]) => ({
    letter,
    word,
    image:`assets/letters/${file}`,
    audio:`assets/letters/audio/${file.replace(/\.webp$/, ".mp3")}`,
  }));
  const LETTER_KEYS = LETTER_ITEMS.map(item => item.letter);
  let activeLetterAudio = null;
  const ERLING_AUDIO_CLIPS = [
    "assets/figurer/audio/erling-hvad-skal-jeg-bruge-det-til.mp3",
    "assets/figurer/audio/erling-det-er-kedeligt.mp3",
    "assets/figurer/audio/erling-det-er-kun-skyer-der-regner.mp3",
    "assets/figurer/audio/erling-tal-er-for-tumper.mp3",
    "assets/figurer/audio/erling-kloge-mennesker-er-dumme.mp3",
    "assets/figurer/audio/erling-jeg-kan-godt-jeg-gider-bare-ikke.mp3",
  ];
  let activeErlingAudio = null;
  let lastErlingAudioIndex = -1;
  const KAPTAJN_AUDIO_CLIP = "assets/figurer/audio/kaptajn-tyggegummi-og-regnestykker.mp3";
  let activeKaptajnAudio = null;
  const SPEED_DRILLS = new Set(["numbers", "addition", "multiplication", "tableDrill", "divisionDrill"]);
  const LUIGI_SURPRISE_LINES = [
    "Mamma mia! 6 × 8 = 48!",
    "7 × 9 = 63 — pizza klar!",
    "Multiplikation med ekstra ost!",
    "Perfetto! Endnu en pizza!",
  ];
  let luigiSurpriseIndex = 0;
  let luigiSurpriseTimer = null;
  let divisionLollipopDeck = [];
  let divisionLollipopDrag = null;
  const makeTask = (topic, expression, answer, hint = "", options = {}) => ({ topic, expression, answer, hint, ...options });

  /* Hvert emne er et selvstændigt modul med generate, calculate og evaluate. */
  const MathModules = {
    letters: {
      generate(level, user) {
        const assigned = (user?.assignedLetters || LETTER_KEYS).filter(letter => LETTER_KEYS.includes(letter));
        const targetLetter = pick(assigned.length ? assigned : LETTER_KEYS);
        const target = LETTER_ITEMS.find(item => item.letter === targetLetter) || LETTER_ITEMS[0];
        const distractors = shuffle(LETTER_ITEMS.filter(item => item.letter !== target.letter)).slice(0,3);
        const letterDistractors = shuffle(LETTER_ITEMS.filter(item => item.letter !== target.letter)).slice(0,3);
        return makeTask("letters", target.letter, target.letter, "", { target, phase:"learn", choices:shuffle([target,...distractors]), letterChoices:shuffle([target,...letterDistractors]) });
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
    divisionDrill: {
      generate() {
        const knownFactor = pick(TABLE_DRILL_VALUES), quotient = pick(TABLE_DRILL_VALUES);
        return makeTask("divisionDrill", `${knownFactor * quotient} ÷ ${knownFactor}`, quotient, "", { knownFactor, quotient, dividend:knownFactor * quotient });
      },
      calculate: (dividend, divisor) => dividend / divisor,
      evaluate: (answer, task) => Number(answer) === task.answer,
    },
    divisionLollipops: {
      generate() {
        if (!divisionLollipopDeck.length) divisionLollipopDeck = shuffle(DIVISION_LOLLIPOP_FACTS);
        const fact = divisionLollipopDeck.pop();
        const digits = String(fact.dividend).split("").map(Number);
        const twoDigit = digits.length === 2;
        return makeTask("divisionLollipops", `${fact.dividend} ÷ ${fact.divisor}`, fact.quotient, "", {
          ...fact,
          digits,
          twoDigit,
          stage:twoDigit ? "leading-zero" : "quotient",
          leadingAnswer:"",
          quotientAnswer:"",
          pulledDown:false,
          stepError:"",
          resultCorrect:null,
          pizzaVariant:rand(1, 3),
        });
      },
      calculate: (dividend, divisor) => dividend / divisor,
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
  function loadTimerVisibility() {
    try { return sessionStorage.getItem(TIMER_VISIBILITY_KEY) === "true"; }
    catch { return false; }
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
  const state = { user: null, view: "login", selectedTopic: "mixed", task: null, taskStartedAt: 0, answered: false, questionNumber: 1, sessionCorrect: 0, sessionAnswers: [], matrixDrill:null, showExerciseTimer:loadTimerVisibility(), expandedStudent: "s1", activeClassId:null, teacherTopicDetail: null, studentFormOpen: false, classRenameFormOpen: false, studentProfileNotice:"" };
  const app = document.getElementById("app");
  const backend = window.JacobBackend;
  const usingCentralDatabase = Boolean(backend?.configured);
  const GUEST_TOPICS = new Set(["multiplication", "tableDrill", "divisionDrill", "divisionLollipops"]);
  const isGuest = () => state.user?.role === "guest";
  const createGuest = () => ({
    id:`guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
    role:"guest", username:"guest", name:"Gæst", results:[],
    assignedNumbers:[...SMALL_TABLES], assignedTables:[...SMALL_TABLES],
    assignedAddends:[...SINGLE_DIGITS], assignedAddendSeconds:[...SINGLE_DIGITS],
    assignedLetters:[...LETTER_KEYS],
  });
  let remoteSaveQueue = Promise.resolve();
  let matrixDrillTimerId = null;
  let teacherLiveTimerId = null;
  let teacherLiveRefreshInFlight = false;
  let teacherResultsSignature = "";
  let teacherResultsCursor = null;
  const save = () => {
    if (!usingCentralDatabase) { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); return Promise.resolve(); }
    if (state.user?.role !== "teacher") return Promise.resolve();
    remoteSaveQueue = remoteSaveQueue
      .then(() => backend.saveSchoolState(db, state.user.id))
      .catch(error => { console.error("Synkronisering mislykkedes", error); });
    return remoteSaveQueue;
  };
  const currentResultsSignature = () => db.users
    .filter(user => user.role === "student")
    .flatMap(user => (user.results || []).map(result => `${user.id}:${result.remoteId || `${result.timestamp}:${result.problem}`}`))
    .sort()
    .join("|");
  function setTeacherLiveStatus(kind, text) {
    const indicator=document.getElementById("teacher-live-status");
    if (!indicator) return;
    indicator.className=`teacher-live-status ${kind}`;
    indicator.lastElementChild.textContent=text;
  }
  async function refreshTeacherResults() {
    if (!usingCentralDatabase || state.user?.role !== "teacher" || state.view !== "teacher" || teacherLiveRefreshInFlight || document.hidden) return;
    teacherLiveRefreshInFlight=true;
    try {
      const rows=await backend.loadResults(teacherResultsCursor);
      if (rows.length) teacherResultsCursor=rows[rows.length-1].createdAt;
      const existingIds=new Set(db.users.flatMap(user=>(user.results || []).map(result=>result.remoteId)).filter(Boolean));
      rows.forEach(({studentId,createdAt,...result})=>{
        if (existingIds.has(result.remoteId)) return;
        const student=db.users.find(user=>user.id===studentId && user.role==="student");
        if (student) student.results.push(result);
      });
      const nextSignature=currentResultsSignature();
      if (nextSignature !== teacherResultsSignature) {
        // Lad læreren skrive elevoplysninger færdig, selv når nye resultater
        // strømmer ind og normalt ville genopbygge hele lærerportalen.
        if (document.activeElement?.closest?.("#student-profile-form")) return;
        teacherResultsSignature=nextSignature;
        const scrollTop=window.scrollY;
        renderTeacher();
        requestAnimationFrame(()=>window.scrollTo({top:scrollTop,left:0,behavior:"auto"}));
      }
      setTeacherLiveStatus("online","Live · opdateret nu");
    } catch (error) {
      setTeacherLiveStatus("offline","Forbindelsen afbrudt · prøver igen");
      console.error("Live-resultater kunne ikke hentes",error);
    } finally { teacherLiveRefreshInFlight=false; }
  }
  function startTeacherLiveUpdates() {
    if (!usingCentralDatabase || state.user?.role !== "teacher" || teacherLiveTimerId) return;
    teacherResultsSignature=currentResultsSignature();
    teacherLiveTimerId=window.setInterval(refreshTeacherResults,2000);
    refreshTeacherResults();
  }
  function stopTeacherLiveUpdates() {
    if (teacherLiveTimerId) window.clearInterval(teacherLiveTimerId);
    teacherLiveTimerId=null; teacherLiveRefreshInFlight=false; teacherResultsSignature=""; teacherResultsCursor=null;
  }
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  // Den faktiske svartid bruges til læring. Farveskalaer kan stadig afrunde visuelt ved 10 sekunder.
  const recordedTime = (result) => Math.max(0, Number(result.responseTime) || 0);
  const isPracticeResult = result => Boolean(TOPICS[result?.topic]) && !Object.values(DRILL_SESSION_TOPICS).includes(result?.topic);
  const practiceResults = user => (user.results || []).filter(isPracticeResult);

  /* De seneste 20 svar pr. emne styrer nøjagtighed, tid, niveau og vægt. */
  function getStats(user, topic) {
    const items = practiceResults(user).filter(r => r.topic === topic).slice(-20);
    if (!items.length) return { count:0, accuracy:0, avgTime:0, level:1, weight:1.5, status:"new" };
    const accuracy = items.filter(r => r.correct).length / items.length;
    const avgTime = items.reduce((sum, r) => sum + recordedTime(r), 0) / items.length;
    if (accuracy > .85 && avgTime < 5) return { count:items.length, accuracy, avgTime, level:3, weight:.65, status:"strong" };
    if (accuracy < .60 || avgTime > 10) return { count:items.length, accuracy, avgTime, level:1, weight:2.2, status:"weak" };
    return { count:items.length, accuracy, avgTime, level:2, weight:1.1, status:"medium" };
  }
  function chooseWeightedTopic(user) {
    const pool = Object.keys(TOPICS).filter(topic => !MATRIX_DRILL_TOPICS.has(topic)).map(topic => ({ topic, weight:getStats(user, topic).weight }));
    let pointer = Math.random() * pool.reduce((sum, item) => sum + item.weight, 0);
    for (const item of pool) { pointer -= item.weight; if (pointer <= 0) return item.topic; }
    return pool[0].topic;
  }

  function header() {
    const userLabel = state.user.role === "teacher" ? "Lærer" : isGuest() ? "Gæst" : `${escapeHtml(state.user.name)} · Elev`;
    const passwordButton = state.user.role === "student" ? `<button class="btn ghost" data-action="change-password">Skift adgangskode</button>` : "";
    return `<header class="topbar"><div class="brand"><span class="brand-mark">∑</span><span>jacobmatematik</span></div><div class="top-actions"><span class="user-pill">${userLabel}</span>${passwordButton}<button class="btn ghost" data-action="logout">Log ud</button></div></header>`;
  }
  function stopErlingAudio() {
    if (activeErlingAudio) {
      activeErlingAudio.pause();
      activeErlingAudio.currentTime=0;
      activeErlingAudio=null;
    }
    document.querySelector("[data-erling-audio]")?.classList.remove("is-speaking");
  }
  function playErlingAudio(card) {
    stopKaptajnAudio();
    stopErlingAudio();
    const choices=ERLING_AUDIO_CLIPS.map((_,index)=>index).filter(index=>index!==lastErlingAudioIndex);
    const nextIndex=pick(choices.length ? choices : ERLING_AUDIO_CLIPS.map((_,index)=>index));
    lastErlingAudioIndex=nextIndex;
    const audio=new Audio(ERLING_AUDIO_CLIPS[nextIndex]);
    activeErlingAudio=audio;
    card.classList.add("is-speaking");
    const finish=()=>{
      if (activeErlingAudio===audio) activeErlingAudio=null;
      card.classList.remove("is-speaking");
    };
    audio.addEventListener("ended",finish,{once:true});
    audio.addEventListener("error",finish,{once:true});
    audio.play().catch(finish);
  }
  function stopKaptajnAudio() {
    if (activeKaptajnAudio) {
      activeKaptajnAudio.pause();
      activeKaptajnAudio.currentTime=0;
      activeKaptajnAudio=null;
    }
    document.querySelector("[data-kaptajn-audio]")?.classList.remove("is-speaking");
  }
  function playKaptajnAudio(card) {
    stopErlingAudio();
    stopKaptajnAudio();
    const audio=new Audio(KAPTAJN_AUDIO_CLIP);
    activeKaptajnAudio=audio;
    card.classList.add("is-speaking");
    const finish=()=>{
      if (activeKaptajnAudio===audio) activeKaptajnAudio=null;
      card.classList.remove("is-speaking");
    };
    audio.addEventListener("ended",finish,{once:true});
    audio.addEventListener("error",finish,{once:true});
    audio.play().catch(finish);
  }
  function renderLogin() {
    app.innerHTML = `
      <div class="login-wrap">
        <section class="login-intro">
          <div class="login-copy">
            <h1>Matematik på solidt fundament</h1>
          </div>
          <div class="login-mastery-tower">
            <img class="login-mastery-tower-image" src="assets/figurer/matematik-mestringstaarn.webp" width="858" height="1832" alt="Matematik-mestringstårn med Erling Ærgerlig nederst, Luigi Lækkermat med sine pizzaer, Divisions-Dennis med slikkepinde og Kaptajn Kvadratrod øverst" fetchpriority="high" decoding="async">
          </div>
          <div class="character-stage" aria-label="Figurerne fra Jacob Matematik">
            <figure class="character-card captain" data-kaptajn-audio role="button" tabindex="0" aria-label="Afspil Kaptajn Kvadratrods superheltereplik">
              <div class="character-frame"><img src="assets/figurer/kaptajn-kvadratrod.webp" width="900" height="1350" alt="Kaptajn Kvadratrod med passer og lommeregner" decoding="async"></div>
              <figcaption>Kaptajn Kvadratrod</figcaption>
            </figure>
            <figure class="character-card dennis">
              <div class="character-frame"><img src="assets/figurer/divisions-dennis.webp" width="900" height="1350" alt="Divisions-Dennis med divisionsslikkepinde" decoding="async"></div>
              <figcaption>Divisions-Dennis</figcaption>
            </figure>
            <figure class="character-card luigi">
              <div class="character-frame"><img src="assets/figurer/luigi-laekkermat.webp" width="900" height="1350" alt="Luigi Lækkermat med multiplikationspizzaer" decoding="async"></div>
              <figcaption>Luigi Lækkermat</figcaption>
            </figure>
            <figure class="character-card erling" data-erling-audio role="button" tabindex="0" aria-label="Afspil en sur kommentar fra Erling Ærgerlig">
              <div class="character-frame"><img src="assets/figurer/erling-aergerlig.webp" width="630" height="1080" alt="Erling Ærgerlig" decoding="async"></div>
              <figcaption>Erling Ærgerlig</figcaption>
            </figure>
          </div>
        </section>
        <section class="login-panel">
          <form class="login-card" id="login-form">
            <div class="login-brand"><span class="brand-mark" aria-hidden="true">∑</span><span>jacobmatematik</span></div>
            <h2>Godt at se dig</h2>
            <p>Log ind som elev eller lærer for at fortsætte.</p>
            <div class="field"><label for="username">Brugernavn</label><input id="username" name="username" autocomplete="username" autocapitalize="none" placeholder="fx alma7" required></div>
            <div class="field"><label for="password">Adgangskode</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Din adgangskode" required></div>
            <p id="login-error" class="error" role="alert"></p>
            <button class="btn full" type="submit">Log ind</button>
            <div class="login-divider"><span>eller</span></div>
            <button class="btn secondary full guest-login" type="button" data-action="guest-login">Gæst</button>
            <small class="guest-note">Prøv Tabel-drill, Division-drill, Divisions-slikkepinde og Lille tabel uden bruger. Fremskridt gemmes ikke.</small>
          </form>
        </section>
      </div>`;
    if (window.matchMedia("(min-width: 901px) and (pointer: fine)").matches) document.getElementById("username").focus();
  }
  function renderStudentHome() {
    const availableTopics = isGuest() ? Object.keys(TOPICS).filter(topic => GUEST_TOPICS.has(topic)) : Object.keys(TOPICS);
    const stats = availableTopics.map(topic => ({ topic, ...getStats(state.user, topic) }));
    const total = practiceResults(state.user).length;
    const guestCopy = isGuest() ? `<p class="guest-session-note">Din træning er midlertidig og slettes, når du forlader siden.</p>` : "";
    app.innerHTML = `${header()}<div class="page"><section class="hero-line"><div><span class="eyebrow">Din træning</span><h1>Hej ${escapeHtml(state.user.name)}!</h1><p>Hvad vil du øve i dag?</p>${guestCopy}</div><div class="streak"><span>I alt løst</span><strong>${total} opgaver</strong></div></section><h2 class="section-label">Vælg et område</h2><section class="topic-grid">${availableTopics.map(key => { const t=TOPICS[key]; return `<button class="topic-card" data-topic="${key}"><span class="topic-icon">${t.icon}</span><strong>${t.name}</strong><small>${t.description}</small></button>`; }).join("")}${isGuest() ? "" : `<button class="topic-card mixed" data-topic="mixed"><span class="topic-icon">∞</span><strong>Blandet træning</strong><small>Systemet vælger smart for dig</small></button>`}</section><h2 class="section-label">Dine seneste tal</h2><section class="recent-strip">${stats.map(s => `<article class="mini-stat"><span>${TOPICS[s.topic].name}</span><strong>${s.count ? Math.round(s.accuracy*100)+" %" : "Ny"}</strong><small>${s.count ? s.avgTime.toFixed(1)+" sek. i snit" : "Klar til første opgave"}</small></article>`).join("")}</section></div>`;
  }
  function renderStudentPassword() {
    app.innerHTML = `${header()}<div class="page"><section class="class-manager"><div class="class-manager-title"><div><span class="eyebrow">Min profil</span><h1>Skift adgangskode</h1><p>Vælg en ny adgangskode til din bruger.</p></div></div><form id="student-password-form" class="student-form"><div class="field"><label for="current-password">Nuværende adgangskode</label><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required></div><div class="field"><label for="new-password">Ny adgangskode</label><input id="new-password" name="newPassword" type="password" autocomplete="new-password" required></div><div class="field"><label for="confirm-password">Gentag ny adgangskode</label><input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" required></div><p id="password-error" class="student-error" role="alert"></p><div class="student-manager-buttons"><button class="btn" type="submit">Gem adgangskode</button><button class="btn secondary" type="button" data-action="home">Annuller</button></div></form></section></div>`;
    document.getElementById("current-password").focus();
  }
  function stopMatrixDrillTimer() {
    if (matrixDrillTimerId) clearInterval(matrixDrillTimerId);
    matrixDrillTimerId = null;
  }
  function formatMatrixDrillTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
  }
  function matrixDrillCellStyle(attempt) {
    if (!attempt?.correct || recordedTime(attempt) >= 10) return "--cell-color:hsl(0 72% 78%)";
    if (recordedTime(attempt) <= 4) return "--cell-color:hsl(138 55% 72%)";
    const hue = Math.round(138 * (10 - recordedTime(attempt)) / 6);
    return `--cell-color:hsl(${hue} 68% 76%)`;
  }
  function matrixDrillPairKey(topic, pair) {
    return topic === "divisionDrill" ? `${pair.knownFactor}-${pair.quotient}` : `${pair.row}-${pair.column}`;
  }
  function createDivisionDrillLayout() {
    const facts = TABLE_DRILL_VALUES.flatMap(knownFactor => TABLE_DRILL_VALUES.map(quotient => ({
      knownFactor,
      quotient,
      dividend:knownFactor * quotient,
      unknownAxis:Math.random() < .5 ? "row" : "column",
    })));
    return shuffle(facts).map((fact,index) => ({ ...fact, gridRow:Math.floor(index / 9) + 1, gridColumn:index % 9 + 1 }));
  }
  function divisionDrillLayoutData(layout) {
    return (layout || []).map(({knownFactor,quotient,unknownAxis}) => [knownFactor,quotient,unknownAxis]);
  }
  function matrixDrillPairFromKey(drill, key) {
    if (drill.topic === "divisionDrill") return drill.layout.find(pair => matrixDrillPairKey(drill.topic,pair) === key);
    const [row,column]=key.split("-").map(Number);
    return { row, column };
  }
  async function finalizeMatrixDrillSession(status = "abandoned") {
    const drill=state.matrixDrill;
    if (!drill || drill.finalizedAt || isGuest()) return;
    const endedAt=Date.now();
    drill.finalizedAt=endedAt;
    const sessionTopic=DRILL_SESSION_TOPICS[drill.topic];
    const marker={topic:sessionTopic,recordType:sessionTopic,problem:`${TOPICS[drill.topic].name} session`,correct:true,responseTime:0,timestamp:new Date(endedAt).toISOString(),drillSessionId:drill.sessionId,drillStartedAt:new Date(drill.startedAt).toISOString(),drillEndedAt:new Date(endedAt).toISOString(),drillStatus:status,drillExpectedCells:drill.pairs.length,drillTroubleRound:drill.troubleRound,drillType:drill.topic};
    if (drill.topic === "divisionDrill") marker.divisionDrillLayout=divisionDrillLayoutData(drill.layout);
    try {
      if (usingCentralDatabase) marker.remoteId=await backend.appendResult(state.user.id,marker);
      else { state.user.results.push(marker); await save(); }
    } catch (error) {
      drill.finalizedAt=null;
      console.error(`${TOPICS[drill.topic].name}-sessionen kunne ikke afsluttes`,error);
    }
  }
  function updateMatrixDrillTimer() {
    const timer = document.getElementById("matrix-drill-time");
    const drill = state.matrixDrill;
    if (!timer || !drill) return;
    timer.textContent = formatMatrixDrillTime((drill.completedAt || Date.now()) - drill.startedAt);
  }
  function startMatrixDrill(topic, options = {}) {
    if (!MATRIX_DRILL_TOPICS.has(topic)) return;
    const previousMode=state.matrixDrill?.confirmationMode || "enter";
    stopMatrixDrillTimer();
    const layout = topic === "divisionDrill" ? (options.layout || createDivisionDrillLayout()) : null;
    const allPairs = topic === "divisionDrill" ? layout : TABLE_DRILL_VALUES.flatMap(row => TABLE_DRILL_VALUES.map(column => ({ row, column })));
    const pairs = options.pairs?.length ? options.pairs : allPairs;
    const cells = { ...(options.cells || {}) };
    pairs.forEach(pair => delete cells[matrixDrillPairKey(topic,pair)]);
    state.matrixDrill = {
      topic,
      sessionId:`${topic === "divisionDrill" ? "dd" : "td"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
      layout,
      pairs:shuffle(pairs),
      currentIndex:0,
      cells,
      roundResults:{},
      errors:0,
      startedAt:Date.now(),
      completedAt:null,
      finalizedAt:null,
      confirmationMode:options.confirmationMode || previousMode,
      troubleRound:Boolean(options.pairs),
    };
    state.selectedTopic=topic; state.questionNumber=1; state.sessionCorrect=0; state.sessionAnswers=[]; state.view="exercise";
    matrixDrillTimerId = setInterval(updateMatrixDrillTimer, 1000);
    newTask();
  }
  function newTask() {
    const topic = state.selectedTopic === "mixed" ? chooseWeightedTopic(state.user) : state.selectedTopic;
    if (MATRIX_DRILL_TOPICS.has(topic)) {
      const drill = state.matrixDrill;
      const pair = drill?.pairs[drill.currentIndex];
      if (!pair) {
        if (drill && !drill.completedAt) { drill.completedAt=Date.now(); finalizeMatrixDrillSession("completed"); }
        stopMatrixDrillTimer(); state.task=null; state.answered=false; renderMatrixDrill(); return;
      }
      state.task = topic === "divisionDrill"
        ? makeTask("divisionDrill", `${pair.dividend} ÷ ${pair.knownFactor}`, pair.quotient, "", pair)
        : makeTask("tableDrill", `${pair.row} × ${pair.column}`, pair.row * pair.column, "", pair);
      state.taskStartedAt=Date.now(); state.answered=false; renderMatrixDrill(); return;
    }
    state.task = MathModules[topic].generate(getStats(state.user, topic).level, state.user);
    state.taskStartedAt = Date.now(); state.answered = false;
    renderExercise();
  }
  function renderExercise() {
    const task = state.task;
    if (MATRIX_DRILL_TOPICS.has(task?.topic)) { renderMatrixDrill(); return; }
    if (task?.topic === "divisionLollipops") { renderDivisionLollipop(); return; }
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
    const luigiPlayground = task.topic === "multiplication" ? `<section class="luigi-playground" aria-label="Luigi Lækkermats pizzakøkken">
      <button class="luigi-surprise" type="button" data-luigi-surprise aria-label="Få Luigi Lækkermat til at jonglere med pizzaerne">
        <span class="luigi-speech" aria-live="polite">Tryk på Luigi!</span>
        <span class="luigi-pizza-pop pizza-one" aria-hidden="true">🍕</span>
        <span class="luigi-pizza-pop pizza-two" aria-hidden="true">🍕</span>
        <span class="luigi-pizza-pop pizza-three" aria-hidden="true">🍕</span>
        <img class="luigi-character" src="assets/figurer/luigi-laekkermat-cutout.webp" width="1024" height="1536" loading="lazy" decoding="async" alt="Luigi Lækkermat holder pizzaerne 48 delt i 6 og 8 samt 63 delt i 7 og 9">
      </button>
    </section>` : "";

    app.innerHTML = `${header()}<div class="page exercise-page">
      <div class="exercise-head"><button class="btn secondary" data-action="home">← Vælg emne</button><span class="topic-tag">${TOPICS[task.topic].name}</span></div>
      <section class="question-card">
        <div class="question-top"><span class="question-number">Opgave ${state.questionNumber}</span><div class="question-main ${attemptHistory ? "with-history" : ""}">${taskVisual}${attemptHistory}</div><p class="hint">${escapeHtml(task.hint || "Skriv dit svar nedenfor.")}</p></div>
        ${state.answered ? correctionSection : answerSection}
      </section>
      <div class="progress-row" aria-label="Svar i denne runde">${Array.from({length:10},(_,i)=>`<i class="progress-dot ${cycleAnswers[i] === true ? "correct" : cycleAnswers[i] === false ? "wrong" : ""}"></i>`).join("")}</div>
      ${luigiPlayground}
      ${learnedSection}
    </div>`;
  }

  function triggerLuigiSurprise(button) {
    const speech = button.querySelector(".luigi-speech");
    if (speech) speech.textContent = LUIGI_SURPRISE_LINES[luigiSurpriseIndex++ % LUIGI_SURPRISE_LINES.length];
    button.classList.remove("celebrating");
    void button.offsetWidth;
    button.classList.add("celebrating");
    if (luigiSurpriseTimer) clearTimeout(luigiSurpriseTimer);
    luigiSurpriseTimer = setTimeout(() => {
      button.classList.remove("celebrating");
      luigiSurpriseTimer = null;
    }, 1100);
  }

  function divisionLollipopKeypad(task) {
    const selected = task.stage === "leading-zero" ? task.leadingAnswer : task.quotientAnswer;
    return `<div class="lollipop-keypad" role="group" aria-label="Taltastatur">
      ${[...TABLE_DRILL_VALUES,0].map(number => `<button class="key ${String(number) === selected ? "selected" : ""}" type="button" data-lollipop-key="${number}" aria-pressed="${String(number) === selected}">${number}</button>`).join("")}
      <button class="key utility lollipop-delete" type="button" data-lollipop-key="delete">Slet</button>
    </div>`;
  }

  function divisionLollipopSteps(task) {
    const labels = task.twoDigit ? ["Første ciffer", "Træk ned", "Svar"] : ["Svar"];
    const currentIndex = task.twoDigit
      ? task.stage === "leading-zero" ? 0 : task.stage === "pull-down" ? 1 : 2
      : 0;
    return `<ol class="lollipop-steps" aria-label="Opgavens trin">${labels.map((label,index) => {
      const status = state.answered
        ? index === labels.length - 1 && task.resultCorrect === false ? "wrong" : "complete"
        : index < currentIndex ? "complete" : index === currentIndex ? "active" : "";
      return `<li class="${status}" ${!state.answered && index === currentIndex ? `aria-current="step"` : ""}><span>${status === "complete" ? "✓" : index + 1}</span><small>${label}</small></li>`;
    }).join("")}</ol>`;
  }

  function divisionLollipopFigure(task) {
    const [firstDigit, secondDigit] = task.twoDigit ? task.digits : [null, task.digits[0]];
    const leadingComplete = task.leadingAnswer === "0";
    const resultClass = state.answered ? task.resultCorrect ? "correct" : "wrong" : "";
    const topLeft = task.twoDigit
      ? task.pulledDown
        ? `<span class="lollipop-source-digit moved" aria-hidden="true">${firstDigit}</span>`
        : `<button class="lollipop-source-digit ${task.stage === "pull-down" ? "ready" : ""}" type="button" data-pull-digit aria-label="Træk ${firstDigit} ned foran ${secondDigit}" aria-grabbed="false" ${task.stage === "pull-down" ? "" : "disabled"}>${firstDigit}</button>`
      : "";
    const topRight = task.twoDigit
      ? `<output class="lollipop-answer-slot ${task.stage === "leading-zero" ? "active" : ""} ${leadingComplete ? "complete" : ""}" aria-label="Det øverste svarfelt">${escapeHtml(task.leadingAnswer)}</output>`
      : `<span aria-hidden="true"></span>`;
    const lowerNumber = task.twoDigit
      ? `<span class="lollipop-combined-number"><span class="lollipop-drop-zone ${task.stage === "pull-down" ? "active" : ""} ${task.pulledDown ? "filled" : ""}" data-drop-digit aria-label="Slip ${firstDigit} her">${task.pulledDown ? firstDigit : ""}</span><span class="lollipop-ones-digit">${secondDigit}</span></span>`
      : `<span class="lollipop-ones-digit">${secondDigit}</span>`;
    const lowerRight = `<output class="lollipop-answer-slot ${task.stage === "quotient" && !state.answered ? "active" : ""} ${resultClass}" aria-label="Det nederste svarfelt">${escapeHtml(task.quotientAnswer)}</output>`;
    return `<div class="division-lollipop-figure ${task.twoDigit ? "two-digit" : "single-digit"}" role="group" aria-label="${task.dividend} divideret med ${task.divisor} vist som divisions-slikkepind">
      <div class="lollipop-divisor">${task.divisor}</div>
      <span class="lollipop-stick" aria-hidden="true"></span>
      <div class="lollipop-work">
        <div class="lollipop-work-row"><span class="lollipop-left">${topLeft}</span><span aria-hidden="true"></span><span class="lollipop-right">${topRight}</span></div>
        <div class="lollipop-work-row"><span class="lollipop-left">${lowerNumber}</span><span aria-hidden="true"></span><span class="lollipop-right">${lowerRight}</span></div>
      </div>
    </div>`;
  }

  function divisionLollipopInstruction(task) {
    if (state.answered && task.resultCorrect) return `<div class="lollipop-message success"><strong>Hele slikkepinden er rigtig!</strong><span>${task.dividend} ÷ ${task.divisor} = ${task.quotient}</span></div>`;
    if (state.answered) return `<div class="lollipop-message correction" role="alert"><strong>Ikke helt.</strong><span>${task.divisor} × ${task.quotient} = ${task.dividend}, så det nederste felt skulle være ${task.quotient}.</span><button class="btn secondary full" type="button" data-action="next-division-lollipop">Næste slikkepind</button></div>`;
    if (task.stage === "leading-zero") return `<div class="lollipop-prompt"><span class="eyebrow">Trin 1</span><h2>Hvor mange gange går ${task.divisor} op i ${task.digits[0]}?</h2><p>Skriv svaret i det øverste felt.</p>${divisionLollipopKeypad(task)}</div>`;
    if (task.stage === "pull-down") return `<div class="lollipop-prompt"><span class="eyebrow">Trin 2</span><h2>Træk ${task.digits[0]} ned foran ${task.digits[1]}</h2><p>Tag fat i ${task.digits[0]}-tallet på slikkepinden, og slip det i det stiplede felt.</p><div class="lollipop-drag-cue" aria-hidden="true"><strong>${task.digits[0]}</strong><span>↓</span><strong>${task.digits[0]}${task.digits[1]}</strong></div></div>`;
    const prompt = `<div class="lollipop-prompt"><span class="eyebrow">${task.twoDigit ? "Trin 3" : "Division"}</span><h2>Hvor mange gange går ${task.divisor} op i ${task.dividend}?</h2><p>Skriv svaret i ${task.twoDigit ? "det nederste" : "feltet"}.</p>${divisionLollipopKeypad(task)}<form id="division-lollipop-form"><input type="hidden" name="answer" value="${escapeHtml(task.quotientAnswer)}"><button class="btn full lollipop-finish" type="submit" ${task.quotientAnswer === "" ? "disabled" : ""}>Færdig!</button></form></div>`;
    return prompt;
  }

  function luigiCalculationPizza(task) {
    return `<section class="luigi-pizza-reward" aria-labelledby="luigi-pizza-title">
      <div class="luigi-pizza-copy"><span class="eyebrow">Belønning låst op</span><h2 id="luigi-pizza-title">Luigis regnepizza</h2><p>Øverst står hele pizzaen. Nederst står de to tal, der kan ganges sammen til den.</p><button class="btn" type="button" data-action="next-division-lollipop">Næste slikkepind →</button></div>
      <div class="calculation-pizza pizza-variant-${task.pizzaVariant}" role="img" aria-label="Regnepizza med ${task.dividend} øverst, ${task.divisor} nederst til venstre og ${task.quotient} nederst til højre">
        <strong class="pizza-value pizza-value-top">${task.dividend}</strong>
        <strong class="pizza-value pizza-value-left">${task.divisor}</strong>
        <strong class="pizza-value pizza-value-right">${task.quotient}</strong>
      </div>
    </section>`;
  }

  function renderDivisionLollipop() {
    const task = state.task;
    const cycleStart = Math.floor((state.questionNumber - 1) / 10) * 10;
    const cycleAnswers = state.sessionAnswers.slice(cycleStart, cycleStart + 10);
    app.innerHTML = `${header()}<div class="page division-lollipop-page">
      <div class="exercise-head"><button class="btn secondary" data-action="home">← Vælg emne</button><span class="topic-tag">${TOPICS[task.topic].name}</span></div>
      <section class="division-lollipop-card">
        <div class="lollipop-card-head"><span class="question-number">Opgave ${state.questionNumber}</span><strong>${task.dividend} ÷ ${task.divisor}</strong></div>
        <div class="division-lollipop-layout">
          <div class="lollipop-board">${divisionLollipopFigure(task)}</div>
          <div class="lollipop-controls">${divisionLollipopSteps(task)}${divisionLollipopInstruction(task)}<p id="lollipop-error" class="lollipop-error" role="alert">${escapeHtml(task.stepError || "")}</p></div>
        </div>
      </section>
      <div class="progress-row" aria-label="Svar i denne runde">${Array.from({length:10},(_,i)=>`<i class="progress-dot ${cycleAnswers[i] === true ? "correct" : cycleAnswers[i] === false ? "wrong" : ""}"></i>`).join("")}</div>
      ${state.answered && task.resultCorrect ? luigiCalculationPizza(task) : ""}
    </div>`;
  }

  function handleDivisionLollipopKey(key) {
    const task = state.task;
    if (!task || task.topic !== "divisionLollipops" || state.answered || task.stage === "pull-down") return;
    task.stepError="";
    if (key === "delete") {
      if (task.stage === "leading-zero") task.leadingAnswer="";
      else task.quotientAnswer="";
      renderDivisionLollipop();
      return;
    }
    if (!/^\d$/.test(key)) return;
    if (task.stage === "leading-zero") {
      if (key !== "0") {
        task.stepError=`${task.divisor} går ikke op i ${task.digits[0]}. Prøv igen.`;
        renderDivisionLollipop();
        return;
      }
      task.leadingAnswer="0";
      task.stage="pull-down";
      renderDivisionLollipop();
      return;
    }
    task.quotientAnswer=key;
    renderDivisionLollipop();
  }

  function completeDivisionLollipopPull() {
    const task = state.task;
    if (!task || task.topic !== "divisionLollipops" || state.answered || task.stage !== "pull-down") return;
    task.pulledDown=true;
    task.stage="quotient";
    task.stepError="";
    renderDivisionLollipop();
  }

  function positionDivisionLollipopGhost(event) {
    if (!divisionLollipopDrag?.ghost) return;
    divisionLollipopDrag.ghost.style.left=`${event.clientX - divisionLollipopDrag.width / 2}px`;
    divisionLollipopDrag.ghost.style.top=`${event.clientY - divisionLollipopDrag.height / 2}px`;
  }

  function beginDivisionLollipopDrag(event, source) {
    if (event.button !== undefined && event.button !== 0) return;
    const task=state.task;
    if (!task || task.topic !== "divisionLollipops" || state.answered || task.stage !== "pull-down") return;
    event.preventDefault();
    const rect=source.getBoundingClientRect();
    const ghost=source.cloneNode(true);
    ghost.removeAttribute("data-pull-digit");
    ghost.removeAttribute("disabled");
    ghost.setAttribute("aria-hidden","true");
    ghost.tabIndex=-1;
    ghost.className="lollipop-drag-ghost";
    ghost.style.width=`${rect.width}px`;
    ghost.style.height=`${rect.height}px`;
    document.body.appendChild(ghost);
    source.classList.add("dragging");
    source.setAttribute("aria-grabbed","true");
    try { source.setPointerCapture(event.pointerId); } catch { /* Pointer capture er kun ekstra robusthed. */ }
    divisionLollipopDrag={pointerId:event.pointerId,source,ghost,width:rect.width,height:rect.height,moved:false};
    positionDivisionLollipopGhost(event);
  }

  function moveDivisionLollipopDrag(event) {
    if (!divisionLollipopDrag || event.pointerId !== divisionLollipopDrag.pointerId) return;
    event.preventDefault();
    divisionLollipopDrag.moved=true;
    positionDivisionLollipopGhost(event);
  }

  function clearDivisionLollipopDrag() {
    if (!divisionLollipopDrag) return;
    const {source,ghost,pointerId}=divisionLollipopDrag;
    source?.classList.remove("dragging");
    source?.setAttribute("aria-grabbed","false");
    try { if (source?.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId); } catch { /* Kilden kan være fjernet ved en ny visning. */ }
    ghost?.remove();
    divisionLollipopDrag=null;
  }

  function finishDivisionLollipopDrag(event, cancelled = false) {
    if (!divisionLollipopDrag || event.pointerId !== divisionLollipopDrag.pointerId) return;
    const task=state.task;
    const dropZone=document.querySelector("[data-drop-digit]");
    const rect=dropZone?.getBoundingClientRect();
    const dropped=!cancelled && rect && event.clientX >= rect.left - 16 && event.clientX <= rect.right + 16 && event.clientY >= rect.top - 16 && event.clientY <= rect.bottom + 16;
    clearDivisionLollipopDrag();
    if (dropped) { completeDivisionLollipopPull(); return; }
    if (!cancelled && task?.topic === "divisionLollipops" && task.stage === "pull-down") {
      task.stepError=`Slip ${task.digits[0]} i feltet foran ${task.digits[1]}.`;
      renderDivisionLollipop();
    }
  }

  async function submitDivisionLollipop() {
    const task=state.task;
    if (!task || task.topic !== "divisionLollipops" || state.answered || task.stage !== "quotient") return;
    if (task.quotientAnswer === "") { task.stepError="Skriv et svar først."; renderDivisionLollipop(); return; }
    const correct=MathModules.divisionLollipops.evaluate(task.quotientAnswer,task);
    const responseTime=Math.max(.1,(Date.now()-state.taskStartedAt)/1000);
    const result={topic:task.topic,problem:task.expression,answer:Number(task.quotientAnswer),correctAnswer:task.answer,correct,responseTime:+responseTime.toFixed(2),timestamp:new Date().toISOString(),divisionDividend:task.dividend,divisionKnownDivisor:task.divisor,divisionQuotient:task.quotient,divisionMethod:"lollipop",divisionPulledDown:task.pulledDown};
    state.answered=true;
    task.resultCorrect=correct;
    task.stepError="";
    state.sessionAnswers.push(correct);
    if (correct) state.sessionCorrect++;
    state.user.results.push(result);
    try {
      if (usingCentralDatabase && !isGuest()) result.remoteId=await backend.appendResult(state.user.id,result);
      else await save();
    } catch (error) {
      state.user.results.pop();
      state.sessionAnswers.pop();
      if (correct) state.sessionCorrect--;
      state.answered=false;
      task.resultCorrect=null;
      task.stepError="Svaret kunne ikke gemmes. Kontrollér forbindelsen og prøv igen.";
      console.error(error);
    }
    renderDivisionLollipop();
  }

  function renderLetterExercise() {
    const task = state.task;
    const cycleStart = Math.floor((state.questionNumber - 1) / 10) * 10;
    const cycleAnswers = state.sessionAnswers.slice(cycleStart, cycleStart + 10);
    const phase=task.phase || "learn";
    const learn=`<div class="letter-pair-intro"><strong>${escapeHtml(task.target.letter)}</strong><div><img src="${task.target.image}" alt="${escapeHtml(task.target.word)}"><span>${escapeHtml(task.target.word)}</span></div></div><p class="letter-instruction">${escapeHtml(task.target.letter)} som i ${escapeHtml(task.target.word)}</p><audio id="letter-learning-audio" src="${task.target.audio}" preload="auto"></audio><div class="letter-learning-actions"><button class="btn secondary letter-audio-replay" type="button" data-letter-audio aria-label="Hør ${escapeHtml(task.target.letter)} som i ${escapeHtml(task.target.word)} igen"><span aria-hidden="true">🔊</span> Hør igen</button><button class="btn letter-continue" type="button" data-letter-continue>Prøv selv →</button></div>`;
    const images=`<div class="letter-prompt"><strong>${escapeHtml(task.target.letter)}</strong><p>Hvilket billede begynder med ${escapeHtml(task.target.letter)}?</p></div><div class="letter-choice-grid" role="group">${task.choices.map(item => `<button class="letter-picture-button" type="button" data-letter-answer="${item.letter}" aria-label="${escapeHtml(item.word)}"><img src="${item.image}" alt="${escapeHtml(item.word)}"></button>`).join("")}</div>`;
    const letters=`<div class="letter-prompt letter-image-prompt"><div><img src="${task.target.image}" alt="Billede til bogstavøvelsen"></div></div><div class="letter-choice-grid letter-key-grid" role="group" aria-label="Vælg det rigtige bogstav">${task.letterChoices.map(item => `<button class="letter-key-button" type="button" data-letter-answer="${item.letter}">${escapeHtml(item.letter)}</button>`).join("")}</div>`;
    app.innerHTML = `${header()}<div class="page exercise-page letter-learning-page">
      <div class="exercise-head"><button class="btn secondary" data-action="home">← Vælg emne</button><span class="topic-tag">Bogstavlæring</span></div>
      <section class="letter-learning-card">
        <span class="question-number letter-step">Bogstav ${state.questionNumber} · trin ${phase === "learn" ? 1 : phase === "image-choice" ? 2 : 3} af 3</span>
        ${phase === "learn" ? learn : phase === "image-choice" ? images : letters}
        <p id="letter-error" class="error letter-error" role="alert"></p>
      </section>
      <div class="progress-row" aria-label="Svar i denne runde">${Array.from({length:10},(_,i)=>`<i class="progress-dot ${cycleAnswers[i] === true ? "correct" : cycleAnswers[i] === false ? "wrong" : ""}"></i>`).join("")}</div>
    </div>`;
    if (phase === "learn") requestAnimationFrame(playLetterLearningAudio);
  }
  function stopLetterLearningAudio() {
    if (!activeLetterAudio) return;
    activeLetterAudio.pause();
    activeLetterAudio.currentTime=0;
    activeLetterAudio=null;
  }
  function playLetterLearningAudio() {
    const audio=document.getElementById("letter-learning-audio");
    if (!audio) return;
    if (activeLetterAudio && activeLetterAudio !== audio) stopLetterLearningAudio();
    activeLetterAudio=audio;
    audio.currentTime=0;
    audio.play().catch(() => {
      document.querySelector("[data-letter-audio]")?.classList.add("needs-tap");
    });
    audio.addEventListener("ended", () => { if (activeLetterAudio === audio) activeLetterAudio=null; }, {once:true});
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
    if (state.answered || state.task?.topic !== "letters" || state.task.phase === "learn") return;
    state.answered=true;
    const task=state.task;
    const correct=MathModules.letters.evaluate(answer,task);
    const responseTime=Math.max(.1,(Date.now()-state.taskStartedAt)/1000);
    state.sessionAnswers.push(correct); if (correct) state.sessionCorrect++;
    const choice=LETTER_ITEMS.find(item=>item.letter===answer);
    const imagePhase=task.phase === "image-choice";
    const result={topic:"letters",problem:imagePhase ? `${task.expression} som startlyd` : `${task.target.word} begynder med`,answer:imagePhase ? choice?.word || answer : answer,correctAnswer:imagePhase ? task.target.word : task.target.letter,correct,responseTime:+responseTime.toFixed(2),timestamp:new Date().toISOString()};
    state.user.results.push(result);
    const choiceButtons=[...document.querySelectorAll("[data-letter-answer]")];
    const pressed=choiceButtons.find(button=>button.dataset.letterAnswer===answer);
    if (pressed) pressed.classList.add(correct ? "correct" : "wrong");

    // Gem i baggrunden; fremdriften må aldrig afhænge af netværket.
    try { persistLetterResult(result); }
    catch (error) { console.error("Bogstavsvaret kunne ikke sættes til lagring", error); }
    if (!correct) {
      window.setTimeout(()=>{ if (pressed) pressed.classList.remove("wrong"); state.answered=false; },520);
      return;
    }
    choiceButtons.forEach(button=>{ button.disabled=true; });
    window.setTimeout(() => {
      try {
        if (task.phase === "image-choice") { task.phase="letter-choice"; state.taskStartedAt=Date.now(); state.answered=false; renderLetterExercise(); }
        else { state.questionNumber++; newTask(); }
      }
      catch (error) {
        state.answered=false;
        const message=document.getElementById("letter-error");
        if (message) message.textContent="Næste opgave kunne ikke indlæses. Prøv igen.";
        console.error("Næste bogstavopgave kunne ikke genereres", error);
      }
    },320);
  }
  function renderMatrixDrill() {
    const drill = state.matrixDrill;
    if (!drill) { startMatrixDrill(MATRIX_DRILL_TOPICS.has(state.selectedTopic) ? state.selectedTopic : "tableDrill"); return; }
    const isDivision = drill.topic === "divisionDrill";
    const task = state.task;
    const activeRow = isDivision ? task?.gridRow : task?.row;
    const activeColumn = isDivision ? task?.gridColumn : task?.column;
    const elapsed = (drill.completedAt || Date.now()) - drill.startedAt;
    const completedInRound = Object.keys(drill.roundResults).length;
    const troublePairs = Object.entries(drill.roundResults)
      .filter(([,attempt]) => !attempt.correct || attempt.responseTime > 4)
      .map(([key]) => matrixDrillPairFromKey(drill,key))
      .filter(Boolean);
    const placementAt = (row,column) => isDivision ? drill.layout.find(pair => pair.gridRow === row && pair.gridColumn === column) : { row, column };
    const columnHeading = column => {
      if (!isDivision) return column;
      if (column !== activeColumn || !task) return "";
      return task.unknownAxis === "column" ? `<span id="matrix-drill-axis-answer" class="division-axis-question">?</span>` : task.knownFactor;
    };
    const rowHeading = row => {
      if (!isDivision) return row;
      if (row !== activeRow || !task) return "";
      return task.unknownAxis === "row" ? `<span id="matrix-drill-axis-answer" class="division-axis-question">?</span>` : task.knownFactor;
    };
    const grid = `<table class="table-drill-grid ${isDivision ? "division-drill-grid" : ""}" aria-label="${isDivision ? "Division med produkter fra 1–9-tabellen" : "Gangetabel fra 1 til 9"}">
      <thead><tr><th aria-hidden="true">${isDivision ? "÷" : ""}</th>${TABLE_DRILL_VALUES.map(column => `<th class="${column === activeColumn ? "active-axis" : ""}" scope="col">${columnHeading(column)}</th>`).join("")}</tr></thead>
      <tbody>${TABLE_DRILL_VALUES.map(row => `<tr><th class="${row === activeRow ? "active-axis" : ""}" scope="row">${rowHeading(row)}</th>${TABLE_DRILL_VALUES.map(column => {
        const pair=placementAt(row,column), key=matrixDrillPairKey(drill.topic,pair), attempt=drill.cells[key], solved=Boolean(attempt), active=row===activeRow && column===activeColumn;
        const classes=[row===activeRow?"active-row":"",column===activeColumn?"active-column":"",solved?"solved timed":"",attempt && !attempt.correct?"wrong":"",active?"active-cell":""].filter(Boolean).join(" ");
        const shownValue=isDivision ? pair.dividend : row * column;
        const contents=isDivision
          ? `<strong>${shownValue}</strong>${attempt && !attempt.correct ? `<i aria-hidden="true">×</i>` : ""}`
          : active ? `<span>${row}×${column}</span><strong id="matrix-drill-cell-answer"></strong>` : solved ? `<strong>${shownValue}</strong>${attempt.correct ? "" : `<i aria-hidden="true">×</i>`}` : "";
        const timing=solved ? `${attempt.correct ? "korrekt" : "forkert"} på ${attempt.responseTime.toFixed(1)} sekunder` : "";
        const taskLabel=isDivision ? `${pair.dividend} divideret med ${pair.knownFactor} er ${pair.quotient}` : `${row} gange ${column} er ${shownValue}`;
        return `<td class="${classes}" ${solved ? `style="${matrixDrillCellStyle(attempt)}"` : ""} aria-label="${taskLabel}${solved ? `, ${timing}` : active ? ", aktiv opgave" : ""}">${contents}</td>`;
      }).join("")}</tr>`).join("")}</tbody>
    </table>`;
    const drillName=TOPICS[drill.topic].name;
    const troubleAction=isDivision ? "practice-division-troubles" : "practice-table-troubles";
    const restartAction=isDivision ? "restart-division-drill" : "restart-table-drill";
    const answerPanel = drill.completedAt
      ? `<section class="table-drill-complete"><span class="complete-mark">${troublePairs.length ? "↻" : "✓"}</span><h2>${troublePairs.length ? `${troublePairs.length} ${troublePairs.length === 1 ? "driller" : "drillere"}` : "Alle sidder hurtigt!"}</h2><p>${troublePairs.length ? "Øv dem, der var forkerte eller tog over 4 sekunder." : "Alle blev besvaret korrekt på højst 4 sekunder."}</p><strong>${formatMatrixDrillTime(elapsed)}</strong><p>${drill.errors} ${drill.errors === 1 ? "fejl" : "fejl"}</p>${troublePairs.length ? `<button class="btn full" type="button" data-action="${troubleAction}">Øv drillerne (${troublePairs.length})</button>` : ""}<button class="btn secondary full" type="button" data-action="${restartAction}">Start hele tabellen igen</button></section>`
      : `<form class="table-drill-answer" id="answer-form"><fieldset class="table-drill-mode"><legend>Svarmetode</legend><button class="${drill.confirmationMode === "enter" ? "active" : ""}" type="button" data-drill-mode="enter" aria-pressed="${drill.confirmationMode === "enter"}">Bekræft med Enter</button><button class="${drill.confirmationMode === "auto" ? "active" : ""}" type="button" data-drill-mode="auto" aria-pressed="${drill.confirmationMode === "auto"}">Autobekræft</button></fieldset><label for="answer">${isDivision ? "Skriv det manglende tal" : "Skriv resultatet"}</label><input class="sr-only" id="answer" name="answer" inputmode="none" autocomplete="off" readonly><div class="table-drill-answer-preview" aria-live="polite"><span>${isDivision ? `${task.dividend} ÷ ${task.knownFactor}` : `${task.row} × ${task.column}`} =</span><strong id="matrix-drill-answer-preview">?</strong></div><div class="keypad table-drill-keypad ${drill.confirmationMode === "auto" ? "auto" : ""}" aria-label="Taltastatur">${TABLE_DRILL_VALUES.map(number => `<button class="key" type="button" data-key="${number}">${number}</button>`).join("")}<button class="key" type="button" data-key="0">0</button><button class="key utility" type="button" data-key="delete">Slet</button>${drill.confirmationMode === "enter" ? `<button class="key enter" type="button" data-key="enter">Enter</button>` : ""}</div><p id="answer-error" class="error" role="alert"></p></form>`;
    const progressLabel=drill.troubleRound ? "Drillere" : "Udfyldt";
    const timerStatus = state.showExerciseTimer
      ? `<span>Tid: <strong id="matrix-drill-time">${formatMatrixDrillTime(elapsed)}</strong></span>`
      : `<span class="table-drill-time-hidden">Tid skjult</span>`;
    app.innerHTML = `${header()}<div class="page table-drill-page"><div class="exercise-head"><button class="btn secondary" data-action="home">← Vælg emne</button><span class="topic-tag">${drill.troubleRound ? `${drillName} · drillere` : drillName}</span></div><section class="table-drill-card"><div class="table-drill-status">${timerStatus}<button class="table-drill-timer-toggle" type="button" data-action="toggle-exercise-timer" aria-pressed="${state.showExerciseTimer}">${state.showExerciseTimer ? "Skjul tid" : "Vis tid"}</button><span>Fejl: <strong>${drill.errors}</strong></span><span>${progressLabel}: <strong>${completedInRound}/${drill.pairs.length}</strong></span></div><div class="table-drill-layout"><div class="table-drill-board">${grid}</div>${answerPanel}</div></section></div>`;
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
    if (MATRIX_DRILL_TOPICS.has(state.task.topic) && state.matrixDrill) {
      const drill=state.matrixDrill;
      Object.assign(result,{drillSessionId:drill.sessionId,drillStartedAt:new Date(drill.startedAt).toISOString(),drillExpectedCells:drill.pairs.length,drillTroubleRound:drill.troubleRound,drillType:drill.topic});
      if (drill.topic === "tableDrill") Object.assign(result,{drillRow:state.task.row,drillColumn:state.task.column});
      else {
        Object.assign(result,{drillGridRow:state.task.gridRow,drillGridColumn:state.task.gridColumn,divisionDividend:state.task.dividend,divisionKnownDivisor:state.task.knownFactor,divisionQuotient:state.task.quotient,divisionUnknownAxis:state.task.unknownAxis});
        if (drill.currentIndex === 0) result.divisionDrillLayout=divisionDrillLayoutData(drill.layout);
      }
    }
    state.user.results.push(result);
    try {
      if (usingCentralDatabase && !isGuest()) result.remoteId = await backend.appendResult(state.user.id, result);
      else await save();
    } catch (error) {
      state.user.results.pop(); state.sessionAnswers.pop(); if (correct) state.sessionCorrect--; state.answered=false;
      document.getElementById("answer-error").textContent="Svaret kunne ikke gemmes. Kontrollér forbindelsen og prøv igen.";
      console.error(error);
      return;
    }
    if (MATRIX_DRILL_TOPICS.has(state.task.topic)) {
      const drill=state.matrixDrill;
      const key=matrixDrillPairKey(drill.topic,state.task);
      const attempt={answer:Number(raw), correct, responseTime:result.responseTime};
      drill.cells[key]=attempt;
      drill.roundResults[key]=attempt;
      if (!correct) drill.errors++;
      drill.currentIndex++;
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
      if (MATRIX_DRILL_TOPICS.has(state.task.topic) && state.matrixDrill?.confirmationMode === "auto") return;
      return submitAnswer(form);
    }
    if (key === "undefined") input.value = "Kan ikke beregnes";
    else if (key === "delete") input.value = input.value === "Kan ikke beregnes" ? "" : input.value.slice(0, -1);
    else if (key === "minus") input.value = input.value === "Kan ikke beregnes" ? "-" : input.value.startsWith("-") ? input.value.slice(1) : `-${input.value}`;
    else if (key === "10" && state.task.topic === "numbers") input.value = "10";
    else if (/^\d$/.test(key) && input.value.replace("-", "").length < 8) input.value = input.value === "Kan ikke beregnes" ? key : input.value + key;

    document.getElementById("answer-error").textContent = "";
    const cellAnswer=document.getElementById("matrix-drill-cell-answer"), axisAnswer=document.getElementById("matrix-drill-axis-answer"), drillPreview=document.getElementById("matrix-drill-answer-preview");
    if (cellAnswer) cellAnswer.textContent=input.value;
    if (axisAnswer) axisAnswer.textContent=input.value || "?";
    if (drillPreview) drillPreview.textContent=input.value || "?";
    if (MATRIX_DRILL_TOPICS.has(state.task.topic) && state.matrixDrill?.confirmationMode === "auto" && /^\d+$/.test(input.value)) {
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
    const sorted = practiceResults(user).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const items = limit ? sorted.slice(-limit) : sorted;
    if (!items.length) return { count:0, accuracy:0, avgTime:0 };
    return {
      count: items.length,
      accuracy: items.filter(item => item.correct).length / items.length,
      avgTime: items.reduce((sum,item) => sum + recordedTime(item), 0) / items.length,
    };
  }
  function getTrend(user, groups = 6) {
    const items = practiceResults(user).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
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
    const items = practiceResults(user).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-24);
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
      divisionDrill:"Brug drillen til at finde de divisionsstykker, der tager længst tid. Knyt hvert stykke tilbage til det tilsvarende gangestykke.",
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

  function tableDrillSessions(user) {
    const sessions=new Map();
    (user.results || []).filter(item => item.drillSessionId && ["tableDrill","tableDrillSession"].includes(item.topic)).forEach(item => {
      const id=String(item.drillSessionId);
      if (!sessions.has(id)) sessions.set(id,{id,startedAt:item.drillStartedAt || item.timestamp,lastActivity:item.timestamp,endedAt:null,status:null,expected:Number(item.drillExpectedCells)||81,troubleRound:Boolean(item.drillTroubleRound),attempts:{}});
      const session=sessions.get(id);
      if (new Date(item.drillStartedAt || item.timestamp) < new Date(session.startedAt)) session.startedAt=item.drillStartedAt || item.timestamp;
      if (new Date(item.timestamp) > new Date(session.lastActivity)) session.lastActivity=item.timestamp;
      session.expected=Math.max(session.expected,Number(item.drillExpectedCells)||0);
      session.troubleRound=session.troubleRound || Boolean(item.drillTroubleRound);
      if (item.recordType === "tableDrillSession") { session.endedAt=item.drillEndedAt || item.timestamp; session.status=item.drillStatus || "abandoned"; return; }
      const match=String(item.problem || "").match(/^(\d+)\s*×\s*(\d+)$/);
      const row=Number(item.drillRow || match?.[1]), column=Number(item.drillColumn || match?.[2]);
      if (TABLE_DRILL_VALUES.includes(row) && TABLE_DRILL_VALUES.includes(column)) session.attempts[`${row}-${column}`]=item;
    });
    return [...sessions.values()].sort((left,right) => new Date(right.startedAt) - new Date(left.startedAt));
  }

  function renderTableDrillHistory(user) {
    const sessions=tableDrillSessions(user).slice(0,8);
    const dateLabel=value => new Intl.DateTimeFormat("da-DK",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(value));
    const timeLabel=value => new Intl.DateTimeFormat("da-DK",{hour:"2-digit",minute:"2-digit"}).format(new Date(value));
    const heatmap=session => `<table class="table-drill-history-grid" aria-label="Heatmap for tabel-drill startet ${dateLabel(session.startedAt)} klokken ${timeLabel(session.startedAt)}"><thead><tr><th aria-hidden="true"></th>${TABLE_DRILL_VALUES.map(column => `<th scope="col">${column}</th>`).join("")}</tr></thead><tbody>${TABLE_DRILL_VALUES.map(row => `<tr><th scope="row">${row}</th>${TABLE_DRILL_VALUES.map(column => { const attempt=session.attempts[`${row}-${column}`]; const label=attempt ? `${row} gange ${column}: ${attempt.correct ? "korrekt" : "forkert"} på ${recordedTime(attempt).toFixed(1)} sekunder` : `${row} gange ${column}: ikke besvaret`; return `<td class="${attempt ? "answered" : ""} ${attempt && !attempt.correct ? "wrong" : ""}" ${attempt ? `style="${matrixDrillCellStyle(attempt)}"` : ""} title="${label}" aria-label="${label}">${attempt ? `<strong>${row*column}</strong>${attempt.correct ? "" : "<i>×</i>"}` : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
    const cards=sessions.map(session => {
      const answered=Object.keys(session.attempts).length;
      const completed=session.status === "completed" || answered >= session.expected;
      const active=!completed && !session.endedAt && Date.now()-new Date(session.lastActivity).getTime() < 120000;
      const status=completed ? "Afsluttet" : active ? "I gang" : "Forladt";
      const end=session.endedAt || (!active ? session.lastActivity : null);
      return `<article class="table-drill-history-card"><header><div><span class="eyebrow">${dateLabel(session.startedAt)}</span><h4>${session.troubleRound ? "Drillerunde" : "Tabel-drill"}</h4><p>Start ${timeLabel(session.startedAt)} · ${end ? `slut ${timeLabel(end)}` : `senest aktiv ${timeLabel(session.lastActivity)}`}</p></div><div class="table-drill-history-status ${completed ? "completed" : active ? "active" : "abandoned"}"><strong>${status}</strong><span>${answered}/${session.expected}</span></div></header>${heatmap(session)}</article>`;
    }).join("");
    return `<section class="pair-detail table-drill-history" aria-labelledby="table-drill-history-title"><div class="pair-detail-head"><div><span class="eyebrow">Sessionshistorik</span><h3 id="table-drill-history-title">Seneste heatmaps</h3><p>Afsluttede drills og seneste status fra forladte sessioner.</p></div><button class="btn secondary" data-action="close-topic-detail">Luk</button></div>${cards ? `<div class="table-drill-history-list">${cards}</div>` : `<p class="empty">Ingen gemte Tabel-drill-sessioner endnu. Nye drills vises her, så snart eleven har besvaret den første opgave.</p>`}</section>`;
  }

  function normalizeDivisionDrillLayout(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0,81).map((entry,index) => {
      const knownFactor=Number(Array.isArray(entry) ? entry[0] : entry?.knownFactor);
      const quotient=Number(Array.isArray(entry) ? entry[1] : entry?.quotient);
      const unknownAxis=(Array.isArray(entry) ? entry[2] : entry?.unknownAxis) === "row" ? "row" : "column";
      if (!TABLE_DRILL_VALUES.includes(knownFactor) || !TABLE_DRILL_VALUES.includes(quotient)) return null;
      return {knownFactor,quotient,dividend:knownFactor*quotient,unknownAxis,gridRow:Math.floor(index/9)+1,gridColumn:index%9+1};
    }).filter(Boolean);
  }

  function divisionDrillSessions(user) {
    const sessions=new Map();
    (user.results || []).filter(item => item.drillSessionId && ["divisionDrill","divisionDrillSession"].includes(item.topic)).forEach(item => {
      const id=String(item.drillSessionId);
      if (!sessions.has(id)) sessions.set(id,{id,startedAt:item.drillStartedAt || item.timestamp,lastActivity:item.timestamp,endedAt:null,status:null,expected:Number(item.drillExpectedCells)||81,troubleRound:Boolean(item.drillTroubleRound),attempts:{},layout:[]});
      const session=sessions.get(id);
      if (new Date(item.drillStartedAt || item.timestamp) < new Date(session.startedAt)) session.startedAt=item.drillStartedAt || item.timestamp;
      if (new Date(item.timestamp) > new Date(session.lastActivity)) session.lastActivity=item.timestamp;
      session.expected=Math.max(session.expected,Number(item.drillExpectedCells)||0);
      session.troubleRound=session.troubleRound || Boolean(item.drillTroubleRound);
      const layout=normalizeDivisionDrillLayout(item.divisionDrillLayout);
      if (layout.length === 81) session.layout=layout;
      if (item.recordType === "divisionDrillSession") { session.endedAt=item.drillEndedAt || item.timestamp; session.status=item.drillStatus || "abandoned"; return; }
      const gridRow=Number(item.drillGridRow), gridColumn=Number(item.drillGridColumn);
      if (TABLE_DRILL_VALUES.includes(gridRow) && TABLE_DRILL_VALUES.includes(gridColumn)) session.attempts[`${gridRow}-${gridColumn}`]=item;
    });
    return [...sessions.values()].sort((left,right) => new Date(right.startedAt) - new Date(left.startedAt));
  }

  function renderDivisionDrillHistory(user) {
    const sessions=divisionDrillSessions(user).slice(0,8);
    const dateLabel=value => new Intl.DateTimeFormat("da-DK",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(value));
    const timeLabel=value => new Intl.DateTimeFormat("da-DK",{hour:"2-digit",minute:"2-digit"}).format(new Date(value));
    const heatmap=session => `<table class="table-drill-history-grid division-drill-history-grid" aria-label="Heatmap for division-drill startet ${dateLabel(session.startedAt)} klokken ${timeLabel(session.startedAt)}"><thead><tr><th aria-hidden="true">÷</th>${TABLE_DRILL_VALUES.map(() => `<th aria-hidden="true"></th>`).join("")}</tr></thead><tbody>${TABLE_DRILL_VALUES.map(row => `<tr><th aria-hidden="true"></th>${TABLE_DRILL_VALUES.map(column => { const pair=session.layout.find(item=>item.gridRow===row&&item.gridColumn===column), attempt=session.attempts[`${row}-${column}`]; const dividend=pair?.dividend ?? Number(attempt?.divisionDividend); const divisor=pair?.knownFactor ?? Number(attempt?.divisionKnownDivisor); const quotient=pair?.quotient ?? Number(attempt?.divisionQuotient); const hasFact=Number.isFinite(dividend)&&Number.isFinite(divisor)&&Number.isFinite(quotient); const label=hasFact ? `${dividend} divideret med ${divisor} er ${quotient}${attempt ? `: ${attempt.correct ? "korrekt" : "forkert"} på ${recordedTime(attempt).toFixed(1)} sekunder` : ": ikke besvaret"}` : "Placering uden registreret opgave"; return `<td class="${attempt ? "answered" : ""} ${attempt && !attempt.correct ? "wrong" : ""}" ${attempt ? `style="${matrixDrillCellStyle(attempt)}"` : ""} title="${label}" aria-label="${label}">${hasFact ? `<strong>${dividend}</strong>${attempt && !attempt.correct ? "<i>×</i>" : ""}` : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
    const cards=sessions.map(session => {
      const answered=Object.keys(session.attempts).length;
      const completed=session.status === "completed" || answered >= session.expected;
      const active=!completed && !session.endedAt && Date.now()-new Date(session.lastActivity).getTime() < 120000;
      const status=completed ? "Afsluttet" : active ? "I gang" : "Forladt";
      const end=session.endedAt || (!active ? session.lastActivity : null);
      return `<article class="table-drill-history-card"><header><div><span class="eyebrow">${dateLabel(session.startedAt)}</span><h4>${session.troubleRound ? "Drillerunde" : "Division-drill"}</h4><p>Start ${timeLabel(session.startedAt)} · ${end ? `slut ${timeLabel(end)}` : `senest aktiv ${timeLabel(session.lastActivity)}`}</p></div><div class="table-drill-history-status ${completed ? "completed" : active ? "active" : "abandoned"}"><strong>${status}</strong><span>${answered}/${session.expected}</span></div></header>${heatmap(session)}</article>`;
    }).join("");
    return `<section class="pair-detail table-drill-history" aria-labelledby="division-drill-history-title"><div class="pair-detail-head"><div><span class="eyebrow">Sessionshistorik</span><h3 id="division-drill-history-title">Seneste Division-heatmaps</h3><p>Farverne viser elevens svartid og fejl for hvert divisionsstykke.</p></div><button class="btn secondary" data-action="close-topic-detail">Luk</button></div>${cards ? `<div class="table-drill-history-list">${cards}</div>` : `<p class="empty">Ingen gemte Division-drill-sessioner endnu. Nye drills vises her, så snart eleven har besvaret den første opgave.</p>`}</section>`;
  }

  function renderTeacher() {
    const classes = db.classes || [];
    const activeClass = classes.find(item => item.id === state.activeClassId) || classes[0];
    state.activeClassId = activeClass.id;
    const students = db.users.filter(user => user.role === "student" && user.classId === activeClass.id);
    const selected = students.find(student => student.id === state.expandedStudent) || students[0] || null;
    state.expandedStudent = selected?.id || null;
    const allResults = students.flatMap(practiceResults), classCorrect = allResults.filter(item => item.correct).length;
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
      const studentInsights = `<section class="insight-grid">
          <article class="focus-card"><span class="focus-icon">!</span><div><span class="eyebrow">Største udfordring</span><h3>${TOPICS[challenge.topic].name}</h3><p>${recommendationFor(challenge.topic)}</p><div class="evidence"><span>${Math.round(challenge.accuracy*100)} % rigtige</span><span>${challenge.avgTime.toFixed(1)} sek.</span></div></div></article>
          <article class="topic-performance"><div class="chart-title"><div><span>Emner</span><h3>Sikkerhed og tempo</h3></div><small>Seneste 20 pr. emne</small></div>
            ${topicStats.map(stat => { const pct=Math.round(stat.accuracy*100), cls=stat.status==="strong"?"strong":stat.status==="weak"?"weak":"medium"; const detailLabel=stat.topic==="multiplication"||stat.topic==="addition"?" · Se talpar →":stat.topic==="numbers"?" · Se antal →":stat.topic==="negatives"?" · Se fortegn →":MATRIX_DRILL_TOPICS.has(stat.topic)?" · Se heatmaps →":""; const content=`<div><strong>${TOPICS[stat.topic].name}</strong><small>${stat.count} svar · ${stat.count?stat.avgTime.toFixed(1):"—"} sek.${detailLabel}</small></div><div class="topic-meter"><span><i class="${cls}" style="width:${stat.count?pct:0}%"></i></span><b>${stat.count?pct+" %":"—"}</b></div>`; const topicRow=["numbers","addition","multiplication","tableDrill","divisionDrill","negatives"].includes(stat.topic) ? `<button class="topic-row topic-row-button ${state.teacherTopicDetail===stat.topic?"active":""}" data-report-topic="${stat.topic}" aria-expanded="${state.teacherTopicDetail===stat.topic}">${content}</button>` : `<div class="topic-row">${content}</div>`; return `<div class="topic-row-control">${topicRow}<button class="btn danger compact topic-reset" type="button" data-action="reset-topic-progress" data-reset-topic="${stat.topic}" data-reset-student="${selected.id}">Nulstil fremskridt</button></div>`; }).join("")}
          </article>
        </section>`;
      studentDetail = `
        <section class="student-profile-head"><div class="student-name"><span class="avatar large">${escapeHtml(selected.name.slice(0,1))}</span><div><span class="eyebrow">Elevprofil</span><h2>${escapeHtml(selected.name)}</h2><p>${summaryFor(selected)}</p></div></div><div class="student-profile-actions"><span class="progress-badge ${progress.direction}">${progress.direction==="up"?"↗":progress.direction==="down"?"↘":"→"} ${progressCopy}</span><label>Klasse<select data-student-class="${selected.id}">${classes.map(item => `<option value="${item.id}" ${item.id===selected.classId?"selected":""}>${escapeHtml(item.name)}</option>`).join("")}</select></label></div><form id="student-profile-form" class="student-profile-editor" data-student-id="${escapeHtml(selected.id)}"><input type="hidden" name="studentId" value="${escapeHtml(selected.id)}"><div class="field"><label for="profile-student-name">Elevens navn</label><input id="profile-student-name" name="studentName" maxlength="60" value="${escapeHtml(selected.name)}" autocomplete="off" required></div><div class="field"><label for="profile-student-username">Brugernavn</label><input id="profile-student-username" name="studentUsername" maxlength="40" value="${escapeHtml(selected.username)}" autocomplete="off" autocapitalize="none" required></div><div class="field"><label for="profile-student-password">Adgangskode</label><input id="profile-student-password" name="studentPassword" type="password" maxlength="60" autocomplete="new-password" placeholder="Lad stå tomt for at beholde den nuværende"></div><button class="btn" type="submit">Gem elev</button><p id="student-profile-message" class="student-profile-message ${state.studentProfileNotice ? "success" : ""}" role="status">${escapeHtml(state.studentProfileNotice)}</p></form></section>

        ${studentInsights}
        ${state.teacherTopicDetail === "tableDrill" ? renderTableDrillHistory(selected) : ""}
        ${state.teacherTopicDetail === "divisionDrill" ? renderDivisionDrillHistory(selected) : ""}

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

        ${state.teacherTopicDetail === "numbers" ? renderNumbersDetail(selected) : ""}
        ${state.teacherTopicDetail === "addition" ? renderAdditionDetail(selected) : ""}
        ${state.teacherTopicDetail === "multiplication" ? renderMultiplicationDetail(selected) : ""}
        ${state.teacherTopicDetail === "negatives" ? renderNegativeDetail(selected) : ""}`;
    }

    app.innerHTML = `${header()}<div class="page teacher-page">
      <section class="dashboard-head"><div><span class="eyebrow">Lærerportal</span><h1>${escapeHtml(activeClass.name)} lige nu</h1><p>Følg udvikling, opdag udfordringer og vælg næste fokus.</p></div>${usingCentralDatabase ? `<div id="teacher-live-status" class="teacher-live-status online" role="status"><i aria-hidden="true"></i><span>Live · opdaterer automatisk</span></div>` : `<button class="btn secondary" data-action="reset-demo">Nulstil demodata</button>`}</section>
      <section class="class-manager" aria-label="Klasser">
        <div class="class-manager-title"><div><span class="eyebrow">Dine klasser</span><strong>${classes.length} ${classes.length===1?"klasse":"klasser"}</strong></div><form id="class-form" class="class-form"><label class="sr-only" for="class-name">Navn på ny klasse</label><input id="class-name" name="className" maxlength="30" placeholder="fx 9.A" required><button class="btn" type="submit">Opret klasse</button></form></div>
        <div class="class-tabs" role="tablist">${classes.map(item => { const count=db.users.filter(user=>user.role==="student"&&user.classId===item.id).length; return `<button role="tab" aria-selected="${item.id===activeClass.id}" class="class-tab ${item.id===activeClass.id?"active":""}" data-class="${item.id}"><strong>${escapeHtml(item.name)}</strong><small>${count} ${count===1?"elev":"elever"}</small></button>`; }).join("")}</div>
        <p id="class-error" class="class-error" role="alert"></p>
        <div class="student-manager-row">
          <div><strong>Elever i ${escapeHtml(activeClass.name)}</strong><small>${selected ? `${escapeHtml(selected.name)} er valgt` : "Ingen elev er valgt"}</small></div>
          <div class="student-manager-buttons"><button class="btn secondary" type="button" data-action="toggle-class-rename-form" aria-expanded="${state.classRenameFormOpen}">${state.classRenameFormOpen ? "Annuller" : "Omdøb klasse"}</button><button class="btn danger" type="button" data-action="delete-class" ${classes.length > 1 ? "" : "disabled"}>Slet klasse</button><button class="btn secondary" type="button" data-action="toggle-student-form" aria-expanded="${state.studentFormOpen}">${state.studentFormOpen ? "Annuller" : "+ Tilføj elev"}</button><button class="btn danger" type="button" data-action="remove-student" ${selected ? "" : "disabled"}>Fjern elev</button></div>
        </div>
        ${state.classRenameFormOpen ? `<form id="class-rename-form" class="class-rename-form"><label class="sr-only" for="class-rename">Nyt klassenavn</label><input id="class-rename" name="className" maxlength="30" value="${escapeHtml(activeClass.name)}" required><button class="btn" type="submit">Gem navn</button><p id="class-rename-error" class="student-error" role="alert"></p></form>` : ""}
        ${state.studentFormOpen ? `<form id="student-form" class="student-form"><div class="field"><label for="student-name">Elevens navn</label><input id="student-name" name="studentName" maxlength="60" autocomplete="off" placeholder="fx Emma" required></div><div class="field"><label for="student-username">Brugernavn</label><input id="student-username" name="studentUsername" maxlength="40" autocomplete="off" autocapitalize="none" placeholder="fx emma8" required></div><div class="field"><label for="student-password">Adgangskode</label><input id="student-password" name="studentPassword" type="password" maxlength="60" autocomplete="new-password" placeholder="Vælg adgangskode" required></div><button class="btn" type="submit">Opret elev</button><p id="student-error" class="student-error" role="alert"></p></form>` : ""}
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
    startTeacherLiveUpdates();
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
        stopErlingAudio(); stopKaptajnAudio();
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
    } else if (event.target.id === "student-profile-form") {
      const data = new FormData(event.target);
      const student = db.users.find(user => user.id === String(data.get("studentId") || "") && user.role === "student" && user.classId === state.activeClassId);
      const name = String(data.get("studentName") || "").trim();
      const username = String(data.get("studentUsername") || "").trim().toLowerCase();
      const password = String(data.get("studentPassword") || "");
      const message = document.getElementById("student-profile-message");
      message.classList.remove("success");
      if (state.user.role !== "teacher" || !student) { message.textContent="Eleven blev ikke fundet."; return; }
      if (!name || !username) { message.textContent="Navn og brugernavn skal udfyldes."; return; }
      if (!/^[a-z0-9._-]+$/i.test(username)) { message.textContent="Brugernavnet må kun indeholde bogstaver, tal, punktum, bindestreg og understregning."; return; }
      if (db.users.some(user => user.id !== student.id && user.username.toLowerCase() === username)) { message.textContent="Brugernavnet er allerede i brug."; return; }
      try {
        if (usingCentralDatabase) {
          await backend.manageStudent("profile", { studentId:student.id, username, name, password });
        } else if (password) student.password=password;
        student.name=name; student.username=username; state.studentProfileNotice="Ændringerne er gemt."; await save(); renderTeacher();
      } catch (profileError) { message.textContent="Elevoplysningerne kunne ikke gemmes."; console.error(profileError); }
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
    } else if (event.target.id === "division-lollipop-form") await submitDivisionLollipop();
    else if (event.target.id === "answer-form") await submitAnswer(event.target);
  });
  document.addEventListener("click", async (event) => {
    const lollipopKeyButton=event.target.closest("[data-lollipop-key]"), pullDigitButton=event.target.closest("[data-pull-digit]"), keyButton=event.target.closest("[data-key]"), luigiButton=event.target.closest("[data-luigi-surprise]"), erlingButton=event.target.closest("[data-erling-audio]"), kaptajnButton=event.target.closest("[data-kaptajn-audio]"), letterChoiceButton=event.target.closest("[data-letter-answer]"), letterContinueButton=event.target.closest("[data-letter-continue]"), letterAudioButton=event.target.closest("[data-letter-audio]"), drillModeButton=event.target.closest("[data-drill-mode]"), topicButton=event.target.closest("[data-topic]"), actionButton=event.target.closest("[data-action]"), studentButton=event.target.closest("[data-student]"), classButton=event.target.closest("[data-class]"), tableAllButton=event.target.closest("[data-table-all]"), numberAllButton=event.target.closest("[data-number-all]"), letterAllButton=event.target.closest("[data-letter-all]"), addendAllButton=event.target.closest("[data-addend-all]"), reportTopicButton=event.target.closest("[data-report-topic]");
    if (lollipopKeyButton) { handleDivisionLollipopKey(lollipopKeyButton.dataset.lollipopKey); return; }
    if (pullDigitButton && event.detail === 0) { completeDivisionLollipopPull(); return; }
    if (keyButton) { handleKeypad(keyButton.dataset.key); return; }
    if (luigiButton) { triggerLuigiSurprise(luigiButton); return; }
    if (erlingButton) { playErlingAudio(erlingButton); return; }
    if (kaptajnButton) { playKaptajnAudio(kaptajnButton); return; }
    if (letterAudioButton && state.task?.topic === "letters") { letterAudioButton.classList.remove("needs-tap"); playLetterLearningAudio(); return; }
    if (letterContinueButton && state.task?.topic === "letters") { stopLetterLearningAudio(); state.task.phase="image-choice"; state.taskStartedAt=Date.now(); renderLetterExercise(); return; }
    if (letterChoiceButton) { submitLetterAnswer(letterChoiceButton.dataset.letterAnswer); return; }
    if (drillModeButton && state.matrixDrill && !state.matrixDrill.completedAt) {
      state.matrixDrill.confirmationMode=drillModeButton.dataset.drillMode === "auto" ? "auto" : "enter";
      renderMatrixDrill();
      return;
    }
    if (topicButton) {
      if (isGuest() && !GUEST_TOPICS.has(topicButton.dataset.topic)) return;
      clearDivisionLollipopDrag();
      if (state.matrixDrill && !state.matrixDrill.finalizedAt) await finalizeMatrixDrillSession("abandoned");
      if (MATRIX_DRILL_TOPICS.has(topicButton.dataset.topic)) { startMatrixDrill(topicButton.dataset.topic); return; }
      if (topicButton.dataset.topic === "divisionLollipops") divisionLollipopDeck=[];
      stopMatrixDrillTimer(); state.matrixDrill=null; state.selectedTopic=topicButton.dataset.topic; state.questionNumber=1; state.sessionCorrect=0; state.sessionAnswers=[]; state.view="exercise"; newTask();
    }
    if (studentButton) { state.expandedStudent=studentButton.dataset.student; state.teacherTopicDetail=null; state.studentProfileNotice=""; renderTeacher(); }
    if (classButton) { state.activeClassId=classButton.dataset.class; state.expandedStudent=null; state.teacherTopicDetail=null; state.studentFormOpen=false; state.classRenameFormOpen=false; state.studentProfileNotice=""; renderTeacher(); return; }
    if (tableAllButton) { const student=db.users.find(user=>user.id===tableAllButton.dataset.tableAll); if (student) { student.assignedTables=[...SMALL_TABLES]; save(); renderTeacher(); } return; }
    if (numberAllButton) { const student=db.users.find(user=>user.id===numberAllButton.dataset.numberAll); if (student) { student.assignedNumbers=[...SMALL_TABLES]; save(); renderTeacher(); } return; }
    if (letterAllButton) { const student=db.users.find(user=>user.id===letterAllButton.dataset.letterAll); if (student) { student.assignedLetters=[...LETTER_KEYS]; save(); renderTeacher(); } return; }
    if (addendAllButton) { const student=db.users.find(user=>user.id===addendAllButton.dataset.addendAll); if (student) { addendAllButton.dataset.addendPosition === "second" ? student.assignedAddendSeconds=[...SINGLE_DIGITS] : student.assignedAddends=[...SINGLE_DIGITS]; save(); renderTeacher(); } return; }
    if (reportTopicButton) { state.teacherTopicDetail=reportTopicButton.dataset.reportTopic; renderTeacher(); return; }
    if (!actionButton) return;
    const action=actionButton.dataset.action;
    if (action==="guest-login") { stopErlingAudio(); stopKaptajnAudio(); stopMatrixDrillTimer(); Object.assign(state,{user:createGuest(),view:"student",task:null,matrixDrill:null,questionNumber:1,sessionCorrect:0,sessionAnswers:[]}); renderStudentHome(); return; }
    if (action==="logout") { clearDivisionLollipopDrag(); if (state.matrixDrill && !state.matrixDrill.finalizedAt) await finalizeMatrixDrillSession("abandoned"); stopMatrixDrillTimer(); stopTeacherLiveUpdates(); if (usingCentralDatabase && !isGuest()) await backend.signOut(); Object.assign(state,{user:null,view:"login",task:null,matrixDrill:null,sessionAnswers:[],sessionCorrect:0}); renderLogin(); }
    if (action==="change-password" && state.user.role==="student") { state.view="change-password"; renderStudentPassword(); }
    if (action==="home") { clearDivisionLollipopDrag(); if (state.matrixDrill && !state.matrixDrill.finalizedAt) await finalizeMatrixDrillSession("abandoned"); stopMatrixDrillTimer(); state.matrixDrill=null; state.task=null; state.view="student"; renderStudentHome(); }
    if (action==="next-division-lollipop" && state.task?.topic === "divisionLollipops" && state.answered) { state.questionNumber++; newTask(); }
    if (action==="toggle-exercise-timer" && state.matrixDrill) {
      state.showExerciseTimer=!state.showExerciseTimer;
      try { sessionStorage.setItem(TIMER_VISIBILITY_KEY,String(state.showExerciseTimer)); }
      catch { /* Indstillingen gælder stadig i den aktuelle sidevisning. */ }
      renderMatrixDrill();
    }
    if (["restart-table-drill","restart-division-drill"].includes(action)) {
      const topic=action === "restart-division-drill" ? "divisionDrill" : "tableDrill";
      if (state.matrixDrill && !state.matrixDrill.finalizedAt) await finalizeMatrixDrillSession(state.matrixDrill.completedAt ? "completed" : "abandoned");
      startMatrixDrill(topic);
    }
    if (["practice-table-troubles","practice-division-troubles"].includes(action) && state.matrixDrill) {
      const drill=state.matrixDrill;
      const pairs=Object.entries(drill.roundResults).filter(([,attempt])=>!attempt.correct || attempt.responseTime>4).map(([key])=>matrixDrillPairFromKey(drill,key)).filter(Boolean);
      if (pairs.length) startMatrixDrill(drill.topic,{pairs,cells:drill.cells,confirmationMode:drill.confirmationMode,layout:drill.layout});
    }
    if (action==="continue-after-correction") { state.questionNumber++; newTask(); }
    if (action==="close-topic-detail") { state.teacherTopicDetail=null; renderTeacher(); }
    if (action==="toggle-class-rename-form") { state.classRenameFormOpen=!state.classRenameFormOpen; state.studentFormOpen=false; renderTeacher(); if (state.classRenameFormOpen) document.getElementById("class-rename")?.focus(); }
    if (action==="delete-class") {
      const activeClass=db.classes.find(item=>item.id===state.activeClassId);
      if (!activeClass || db.classes.length <= 1) return;
      const classStudents=db.users.filter(user=>user.role==="student" && user.classId===activeClass.id), studentCount=classStudents.length;
      if (confirm(`Vil du slette ${activeClass.name}? ${studentCount} ${studentCount===1?"elev":"elever"} og deres fremskridt slettes permanent.`)) {
        try {
          if (usingCentralDatabase) for (const student of classStudents) await backend.manageStudent("delete", { studentId:student.id });
          db.users=db.users.filter(user=>user.role!=="student" || user.classId!==activeClass.id); db.classes=db.classes.filter(item=>item.id!==activeClass.id);
          state.activeClassId=db.classes[0].id; state.expandedStudent=null; state.teacherTopicDetail=null; state.studentFormOpen=false; state.classRenameFormOpen=false; state.studentProfileNotice=""; await save(); renderTeacher();
        } catch (deleteError) { alert("Klassen kunne ikke slettes fra den centrale database."); console.error(deleteError); }
      }
    }
    if (action==="reset-topic-progress") {
      const topic=actionButton.dataset.resetTopic, student=db.users.find(user=>user.id===actionButton.dataset.resetStudent && user.role==="student");
      if (!student || !TOPICS[topic]) return;
      const count=(student.results || []).filter(item=>item.topic===topic && isPracticeResult(item)).length;
      if (confirm(`Vil du nulstille fremskridtet i ${TOPICS[topic].name} for ${student.name}? ${count} besvarelser slettes permanent.`)) {
        try {
          const sessionTopic=DRILL_SESSION_TOPICS[topic];
          if (usingCentralDatabase) { await backend.deleteResults(student.id, topic); if (sessionTopic) await backend.deleteResults(student.id, sessionTopic); }
          student.results=(student.results || []).filter(item=>item.topic!==topic && (!sessionTopic || item.topic!==sessionTopic)); state.teacherTopicDetail=null; await save(); renderTeacher();
        } catch (resetError) { alert("Fremskridtet kunne ikke nulstilles."); console.error(resetError); }
      }
    }
    if (action==="toggle-student-form") { state.studentFormOpen=!state.studentFormOpen; state.classRenameFormOpen=false; renderTeacher(); if (state.studentFormOpen) document.getElementById("student-name")?.focus(); }
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
  document.addEventListener("pointerdown", event => {
    const source=event.target.closest?.("[data-pull-digit]");
    if (source) beginDivisionLollipopDrag(event,source);
  });
  document.addEventListener("pointermove", moveDivisionLollipopDrag, {passive:false});
  document.addEventListener("pointerup", event => finishDivisionLollipopDrag(event));
  document.addEventListener("pointercancel", event => finishDivisionLollipopDrag(event,true));
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
    const kaptajn=event.target.closest?.("[data-kaptajn-audio]");
    if (kaptajn && (event.key==="Enter"||event.key===" ")) { event.preventDefault(); kaptajn.click(); return; }
    const erling=event.target.closest?.("[data-erling-audio]");
    if (erling && (event.key==="Enter"||event.key===" ")) { event.preventDefault(); erling.click(); return; }
    const student=event.target.closest?.("[data-student]");
    if (student && (event.key==="Enter"||event.key===" ")) { event.preventDefault(); student.click(); return; }
    if (state.view !== "exercise" || state.answered) return;
    if (state.task?.topic === "divisionLollipops") {
      if (event.target.closest?.("[data-pull-digit]")) return;
      if (/^\d$/.test(event.key)) { event.preventDefault(); handleDivisionLollipopKey(event.key); }
      else if (event.key === "Backspace") { event.preventDefault(); handleDivisionLollipopKey("delete"); }
      else if (event.key === "Enter" && state.task.stage === "quotient") { event.preventDefault(); document.getElementById("division-lollipop-form")?.requestSubmit(); }
      return;
    }
    if (/^\d$/.test(event.key)) handleKeypad(event.key);
    if (event.key === "-") handleKeypad("minus");
    if (event.key === "Backspace") handleKeypad("delete");
    if (event.key === "Enter") handleKeypad("enter");
  });
  window.addEventListener("pagehide", () => {
    stopErlingAudio();
    stopKaptajnAudio();
    clearDivisionLollipopDrag();
    if (state.matrixDrill && !state.matrixDrill.finalizedAt) finalizeMatrixDrillSession("abandoned");
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
