/* Guided fraction division pilot. The teacher keeps the same authenticated role. */
(() => {
  "use strict";
  const TESTER_ID = "c8b8e1c4-3264-40e9-a43d-0eb6214a0183";
  const FRACTIONS = [[1,2],[1,3],[2,3],[1,4],[3,4],[2,5],[3,5],[4,5],[5,6],[3,8],[5,8],[7,10]];
  const RULES = [
    { id:"add", text:"Gør ensbenævnte og læg tællerne sammen", caption:"Samme nævner først", symbol:"+" },
    { id:"multiply", text:"Tæller gange tæller og nævner gange nævner", caption:"Gang brøkerne direkte", symbol:"·" },
    { id:"reciprocal", text:"Gange med den omvendte", caption:"Vend den anden brøk", symbol:"↕" },
  ];
  const STEPS = ["Find regnearten", "Vælg regnereglen", "Vend brøken", "Vælg gangereglen", "Skriv resultatet", "Vurder brøken", "Forkort brøken", "Aflever brøken"];
  const SUBMISSION_OPTIONS = [["submit","Ja - den er fin!"],["extend","Nej - den skal først forlænges!"],["reduce","Nej - den skal først forkortes!"]];
  const REDUCE_RULES = [["subtractNumerator","Man trækker fra i tælleren"],["subtractBoth","Man trækker fra i tæller og nævner"],["divideBoth","Man dividerer med samme tal i tæller og nævner"]];
  function gcd(a,b) {
    while (b) [a,b]=[b,a%b];
    return a;
  }
  const isEnabled = user => Boolean(user && user.id === TESTER_ID && user.role === "teacher");
  const fractionHTML = (n,d) => `<span class="fl-fraction"><span class="fl-numerator">${n}</span><span class="fl-denominator">${d}</span></span>`;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
  function createProblem(index, random = Math.random) {
    const notation = index % 2 === 0 ? "stacked" : "colon";
    if (index === 0) return { a:1,b:2,c:3,d:4,notation };
    const first = Math.min(FRACTIONS.length-1, Math.floor(random()*FRACTIONS.length));
    const offset = 1 + Math.min(FRACTIONS.length-2, Math.floor(random()*(FRACTIONS.length-1)));
    const [a,b] = FRACTIONS[first];
    const [c,d] = FRACTIONS[(first+offset)%FRACTIONS.length];
    return { a,b,c,d,notation };
  }
  function expressionHTML(p, sourceHTML = "") {
    const first = fractionHTML(p.a,p.b), second = sourceHTML || fractionHTML(p.c,p.d);
    const drawing = p.notation === "stacked"
      ? `<span class="fl-compound"><span>${first}</span><span>${second}</span></span>`
      : `${first}<span class="fl-operator">:</span>${second}`;
    // Interactive numbers must not be hidden from keyboard/screen-reader users.
    return `<div class="fl-expression" role="${sourceHTML ? "group" : "math"}" aria-label="${p.a} over ${p.b} divideret med ${p.c} over ${p.d}"><span class="fl-expression-drawing" ${sourceHTML ? "" : 'aria-hidden="true"'}>${drawing}</span></div>`;
  }
  function mount(root, { user, onExit = () => {} } = {}) {
    // Pilot gating, not a replacement for Supabase authorization.
    if (!root || !isEnabled(user)) return () => {};
    let index=0, problem=createProblem(0), phase="operation", feedback="", feedbackKind="", selected="";
    let locked=false, disposed=false, completed=0, nextReady=false;
    let placements={numerator:null,denominator:null}, activeToken="", wrongSlot="", drag=null, ignoreClickUntil=0;
    let answers={numerator:"",denominator:""}, answerStatus={};
    // The current fraction changes only after the pupil supplies both quotients.
    let reduction=null, finalReply="yes";
    const answeringNow=() => ["multiplyAnswer","simplifyAnswer"].includes(phase);
    const doc=root.ownerDocument, view=doc.defaultView, timers=new Set();
    const used = token => Object.values(placements).includes(token);
    const tokenValue = token => problem[token];
    function later(callback, milliseconds) {
      const id=setTimeout(() => { timers.delete(id); if (!disposed) callback(); },milliseconds);
      timers.add(id);
    }
    function sourceHTML() {
      const token = (id, name) => `<button type="button" class="fl-token fl-token-${id} ${activeToken===id ? "is-selected" : ""}" data-fl-token="${id}" aria-pressed="${activeToken===id}" aria-label="${tokenValue(id)}, ${name} i den anden brøk${used(id) ? ", placeret" : ". Træk eller vælg tallet"}" ${used(id) || phase!=="arrange" ? "disabled" : ""}>${tokenValue(id)}</button>`;
      return fractionHTML(token("c","tæller"),token("d","nævner"));
    }
    function slotHTML(slot) {
      const token=placements[slot], name=slot === "numerator" ? "Tæller" : "Nævner";
      return `<button type="button" class="fl-slot ${token ? "is-filled" : ""} ${wrongSlot===slot ? "is-wrong" : ""}" data-fl-slot="${slot}" aria-label="${name}: ${token ? tokenValue(token)+", korrekt placeret" : "tomt felt"}" ${token || phase!=="arrange" ? "disabled" : ""}>${token ? `<span class="fl-token-${token}">${tokenValue(token)}</span>` : '<span aria-hidden="true">&nbsp;</span>'}</button>`;
    }
    function answerHTML(slot) {
      const name=slot === "numerator" ? "tæller" : "nævner";
      return `<input type="text" class="fl-answer-input ${answerStatus[slot] || ""}" data-fl-answer="${slot}" inputmode="numeric" enterkeyhint="${slot === "numerator" ? "next" : "done"}" autocomplete="off" spellcheck="false" maxlength="4" aria-label="Resultatets ${name}" aria-describedby="fl-answer-help fl-feedback" aria-invalid="${answerStatus[slot] === "incorrect"}" value="${escapeHTML(answers[slot])}">`;
    }
    function choiceCards(items, attribute) {
      return `<div class="fl-choice-cards">${items.map(([id,text]) => `<button type="button" class="fl-choice-card ${selected===id ? feedbackKind : ""}" data-${attribute}="${id}">${text}</button>`).join("")}</div>`;
    }
    function divisorOptions() {
      // Include distractors and every valid common divisor, not only the greatest one.
      const values=new Set([1,2,3,4,5,6,7,8,9,10]);
      const common=gcd(reduction.n,reduction.d);
      for (let value=11;value<=common;value++) if (common%value===0) values.add(value);
      return [...values].sort((a,b)=>a-b);
    }
    function reductionChoicesHTML() {
      if (phase==="submitCheck") return choiceCards(SUBMISSION_OPTIONS,"fl-submit-check");
      if (phase==="simplifyRule") return choiceCards(REDUCE_RULES,"fl-reduce-rule");
      if (phase==="simplifyDivisor") return `<div class="fl-divisor-row" aria-label="Vælg et tal at dividere med">${divisorOptions().map(n => `<button type="button" class="fl-divisor-button ${selected===String(n) ? feedbackKind : ""}" data-fl-divisor="${n}">${n}</button>`).join("")}</div>`;
      if (phase==="readyToSubmit") return choiceCards([["yes","Ja"],["no","Nej"]],"fl-ready");
      return "";
    }
    function reductionSolutionHTML() {
      const answering=phase==="simplifyAnswer", done=phase==="done";
      const {n,d,divisor}=reduction;
      const help=answering ? "Divider tæller og nævner med det valgte tal. Skriv de to resultater i felterne."
        : phase==="simplifyDivisor" ? "Vælg et tal større end 1, som går op i både tælleren og nævneren."
        : phase==="simplifyRule" ? "Vælg reglen for at forkorte en brøk."
        : phase==="submitCheck" ? "Se på brøken, før du afleverer den." : "Brøken kan ikke forkortes yderligere.";
      const row=value => `<span class="fl-division-number">${value}<span class="fl-inline-divisor">÷ ${divisor}</span></span>`;
      const current=answering ? fractionHTML(row(n),row(d)) : `<span class="fl-result" role="math" aria-label="${n} over ${d}">${fractionHTML(n,d)}</span>`;
      const result=answering ? `<span class="fl-operator" aria-label="er lig med">=</span><span class="fl-answer-fraction">${answerHTML("numerator")}<span class="fl-target-line" aria-hidden="true"></span>${answerHTML("denominator")}</span>` : "";
      return `<div class="fl-solution"><p id="fl-answer-help">${help}</p><div class="fl-solution-equation fl-reduction-equation" role="group" aria-label="${answering ? `${n} divideret med ${divisor} over ${d} divideret med ${divisor}. Skriv resultatet` : `Brøken ${n} over ${d}`}"><span>${current}${result}</span></div>${answering ? '<button type="button" class="fl-primary" data-fl-check-answer>Tjek svar</button>' : `<button type="button" class="fl-primary" data-fl-next ${done && nextReady ? "" : "disabled"}>Næste opgave →</button>`}</div>`;
    }
    function solutionHTML() {
      if (reduction) return reductionSolutionHTML();
      const done=phase === "done", answering=phase === "multiplyAnswer";
      const reciprocal=`<span class="fl-target-fraction">${slotHTML("numerator")}<span class="fl-target-line" aria-hidden="true"></span>${slotHTML("denominator")}</span>`;
      const result=answering ? `<span class="fl-answer-fraction">${answerHTML("numerator")}<span class="fl-target-line" aria-hidden="true"></span>${answerHTML("denominator")}</span>`
        : done ? `<span class="fl-result" role="math" aria-label="${problem.a*problem.d} over ${problem.b*problem.c}">${fractionHTML(problem.a*problem.d,problem.b*problem.c)}</span>` : "";
      const help=phase === "arrange" ? "Træk tallene fra den anden brøk over i de tomme felter, så brøken bliver vendt."
        : phase === "multiplyRule" ? "Brøken er vendt. Nu skal du vælge reglen til dette gangestykke."
        : answering ? "Skriv gange-resultaterne i tælleren og nævneren uden at forkorte." : "Du har både vendt brøken og regnet gangestykket.";
      return `<div class="fl-solution"><p id="${answering ? "fl-answer-help" : "fl-drag-help"}">${help}</p><div class="fl-solution-equation ${answering || done ? "fl-multiplication-equation" : ""}" role="group" aria-label="${problem.a} over ${problem.b} gange den omvendte brøk${answering ? ". Skriv resultatet i de to felter" : ""}"><span><span role="math" aria-label="${problem.a} over ${problem.b}">${fractionHTML(problem.a,problem.b)}</span><span class="fl-operator" aria-label="gange">·</span>${reciprocal}${result ? `<span class="fl-operator" aria-label="er lig med">=</span>${result}` : ""}</span></div>${phase === "arrange" ? '<p class="fl-drag-hint">Du kan også trykke på et tal og derefter på et felt.</p>' : ""}${answering ? '<button type="button" class="fl-primary" data-fl-check-answer>Tjek svar</button>' : `<button type="button" class="fl-primary" data-fl-next ${done && nextReady ? "" : "disabled"}>Næste opgave →</button>`}</div>`;
    }
    function render(focusSelector) {
      if (disposed) return;
      const done=phase === "done", applying=!["operation","rule"].includes(phase);
      const step=({operation:1,rule:2,arrange:3,multiplyRule:4,multiplyAnswer:5,submitCheck:6,simplifyRule:7,simplifyDivisor:7,simplifyAnswer:7,readyToSubmit:8,done:8})[phase];
      const title=({operation:"Hvilken type regnestykke er dette?",rule:"Hvilken regneregel skal vi så bruge?",arrange:"Ja! Gange med den omvendte.",multiplyRule:"Hvordan ganger du en brøk med en brøk?",multiplyAnswer:"Skriv resultatet af gangestykket.",submitCheck:"Vil du aflevere brøken sådan her?",simplifyRule:"Hvordan forkorter man en brøk?",simplifyDivisor:"Hvilket tal vil du dividere med?",simplifyAnswer:"Skriv den forkortede brøk.",readyToSubmit:"Er du klar til at aflevere?",done:finalReply==="yes" ? "FLOT! Du cooker de brøker!" : "JO, champ! Brøken kan ikke forkortes yderligere! Du har gjort det godt!"})[phase];
      const operations = [["+","+","Plus"],["-","−","Minus"],["*","*","Gange"],[":",":","Division"]];
      const choices=phase === "operation"
        ? `<div class="fl-operations" aria-label="Vælg regneart">${operations.map(([id,symbol,name]) => `<button type="button" data-fl-operation="${id}" class="fl-operation ${selected===id ? feedbackKind : ""}" aria-label="${name} (${symbol})" ${locked ? "disabled" : ""}>${symbol}</button>`).join("")}</div>`
        : ["rule","multiplyRule"].includes(phase) ? `<div class="fl-rules" aria-label="Vælg regneregel">${RULES.map(rule => `<button type="button" data-fl-rule="${rule.id}" class="fl-rule ${selected===rule.id ? feedbackKind : ""}" ${locked ? "disabled" : ""}><span class="fl-rule-symbol" aria-hidden="true">${rule.symbol}</span><strong>${rule.text}</strong><small>${rule.caption}</small></button>`).join("")}</div>` : reductionChoicesHTML();
      const steps=STEPS.map((label,i) => {
        const skipped=i===6 && step===8 && reduction?.rounds===0;
        return `<span class="${skipped ? "skipped" : done || i+1<step ? "complete" : i+1===step ? "current" : ""}"><b>${skipped ? "·" : done || i+1<step ? "✓" : i+1}</b> ${label}${skipped ? " (ikke nødvendig)" : ""}</span>`;
      }).join("");
      root.innerHTML=`<section class="fl-page" data-fl-phase="${phase}" aria-labelledby="fl-title"><div class="fl-heading"><button type="button" class="fl-back" data-fl-exit>← Til øvelser</button><span class="fl-pilot">Test · kun Jacob</span></div><div class="fl-title-row"><div><p class="fl-eyebrow">Forstå regnestykket før du regner</p><h1 id="fl-title">Lær brøkregning</h1></div><span class="fl-count">${completed} gennemført</span></div><div class="fl-steps" aria-label="${done ? "Opgaven er gennemført" : `Trin ${step} af ${STEPS.length}`}">${steps}</div><div class="fl-workspace"><div class="fl-problem-panel"><span class="fl-problem-label">Regnestykket</span>${expressionHTML(problem,applying ? sourceHTML() : "")}<button type="button" class="fl-notation" data-fl-notation ${locked && !done ? "disabled" : ""}>Vis ${problem.notation === "stacked" ? "med kolon" : "som brøk over brøk"}</button>${phase !== "operation" ? `<span class="fl-identified">✓ Division</span>` : ""}</div><div class="fl-question-panel"><p class="fl-eyebrow">${done ? "Opgaven er løst" : `Trin ${step} af ${STEPS.length}`}</p><h2 id="fl-question" tabindex="-1">${title}</h2>${choices}<div id="fl-feedback" class="fl-feedback ${feedbackKind}" role="status" aria-live="polite" aria-atomic="true">${feedback}</div>${applying ? solutionHTML() : ""}</div></div></section>`;
      if (focusSelector) root.querySelector(focusSelector)?.focus({preventScroll:true});
    }
    function chooseOperation(value) {
      if (disposed || locked || phase !== "operation") return;
      selected=value;
      if (value !== ":") {
        feedbackKind="incorrect";
        feedback=problem.notation === "stacked" ? "Nej. Den lange brøkstreg mellem de to brøker betyder division. Prøv igen." : "Nej. Kolonet mellem de to brøker betyder division. Prøv igen.";
        render(`[data-fl-operation="${value}"]`); return;
      }
      locked=true; feedbackKind="correct"; feedback="Ja! Det er et divisionsstykke.";
      render();
      later(() => { phase="rule"; locked=false; feedback=""; feedbackKind=""; selected=""; render("#fl-question"); },850);
    }
    function chooseRule(value) {
      if (disposed || locked || !["rule","multiplyRule"].includes(phase) || !RULES.some(rule => rule.id===value)) return;
      selected=value;
      if (phase === "multiplyRule") {
        if (value !== "multiply") {
          feedbackKind="incorrect";
          feedback=value === "add" ? "Nej. Den regel bruges til plus med brøker. Nu skal vi gange. Prøv igen." : "Nej. Den regel brugte vi til division. Brøken er allerede vendt, og nu skal vi gange. Prøv igen.";
          render(`[data-fl-rule="${value}"]`); return;
        }
        phase="multiplyAnswer"; selected=""; feedbackKind="correct";
        feedback="Ja! Tæller gange tæller og nævner gange nævner.";
        render('[data-fl-answer="numerator"]'); return;
      }
      if (value !== "reciprocal") {
        feedbackKind="incorrect";
        feedback=value === "add" ? "Nej. Denne regel bruges til plus med brøker. Her skal vi dividere. Prøv igen." : "Nej. Denne regel bruges, når vi ganger to brøker. Ved division skal den anden brøk først vendes. Prøv igen.";
        render(`[data-fl-rule="${value}"]`); return;
      }
      phase="arrange"; selected=""; feedbackKind="correct";
      feedback="Korrekt regel! Nu skal du selv vende den anden brøk.";
      render("#fl-question");
    }
    function placeToken(token, slot) {
      if (disposed || locked || phase!=="arrange" || !["c","d"].includes(token) || !["numerator","denominator"].includes(slot) || used(token) || placements[slot]) return;
      activeToken="";
      if (token !== (slot === "numerator" ? "d" : "c")) {
        wrongSlot=slot; feedbackKind="incorrect";
        feedback="Ikke dér. Tælleren og nævneren skal bytte plads. Prøv igen.";
        render(`[data-fl-token="${token}"]`); return;
      }
      placements[slot]=token; wrongSlot=""; feedbackKind="correct";
      if (placements.numerator && placements.denominator) {
        // A built reciprocal advances to multiplication, but does not complete or score.
        phase="multiplyRule"; selected="";
        feedback="Korrekt! Du har selv vendt den anden brøk.";
        render("#fl-question");
      } else {
        feedback="Godt! Træk også det sidste tal på plads.";
        render(`[data-fl-token="${token === "c" ? "d" : "c"}"]`);
      }
    }
    function checkAnswer() {
      if (disposed || locked || !answeringNow()) return;
      // Read the actual fields as well as input events (autofill and assistive input).
      for (const slot of ["numerator","denominator"]) answers[slot]=root.querySelector(`[data-fl-answer="${slot}"]`).value;
      const parse=value => /^\d{1,4}$/.test(value.trim()) ? Number(value.trim()) : NaN;
      const n=parse(answers.numerator), d=parse(answers.denominator);
      const simplifying=phase==="simplifyAnswer";
      const expectedN=simplifying ? reduction.n/reduction.divisor : problem.a*problem.d;
      const expectedD=simplifying ? reduction.d/reduction.divisor : problem.b*problem.c;
      const topOK=n===expectedN, bottomOK=d===expectedD;
      answerStatus={numerator:topOK ? "correct" : "incorrect",denominator:bottomOK ? "correct" : "incorrect"};
      if (!topOK || !bottomOK) {
        feedbackKind="incorrect";
        if (!answers.numerator.trim() || !answers.denominator.trim()) feedback="Skriv både tælleren og nævneren, før du tjekker svaret.";
        else if (!Number.isFinite(n) || !Number.isFinite(d)) feedback="Skriv et helt tal i hvert felt.";
        else if (d===0) feedback="Nævneren kan ikke være 0. Prøv igen.";
        else if (n*expectedD===d*expectedN) {
          // Equivalent fractions are mathematically right; this step practices the two products.
          feedbackKind=""; answerStatus={};
          feedback=simplifying ? "Din brøk har den rigtige værdi. Skriv resultaterne af de to viste divisioner." : "Din brøk har den rigtige værdi. I dette trin skal du skrive de to gange-resultater uden at forkorte.";
        } else feedback=simplifying ? `Prøv igen: ${reduction.n} ÷ ${reduction.divisor} i tælleren og ${reduction.d} ÷ ${reduction.divisor} i nævneren.` : `Ikke helt endnu. Gang ${problem.a} med ${problem.d} i tælleren og ${problem.b} med ${problem.c} i nævneren.`;
        render(`[data-fl-answer="${topOK ? "denominator" : "numerator"}"]`); return;
      }
      // Arithmetic alone does not score. First assess, simplify and confirm submission.
      feedbackKind="correct"; selected=""; answers={numerator:"",denominator:""}; answerStatus={};
      if (simplifying) {
        feedback=`Ja! ${reduction.n} ÷ ${reduction.divisor} = ${expectedN} og ${reduction.d} ÷ ${reduction.divisor} = ${expectedD}.`;
        reduction={n:expectedN,d:expectedD,divisor:0,rounds:reduction.rounds+1};
        phase=gcd(expectedN,expectedD)>1 ? "submitCheck" : "readyToSubmit";
      } else {
        reduction={n:expectedN,d:expectedD,divisor:0,rounds:0}; phase="submitCheck";
        feedback=`Ja! ${problem.a} · ${problem.d} = ${expectedN} og ${problem.b} · ${problem.c} = ${expectedD}.`;
      }
      render("#fl-question");
    }
    function chooseSubmissionCheck(value) {
      if (disposed || locked || phase!=="submitCheck" || !SUBMISSION_OPTIONS.some(([id])=>id===value)) return;
      const reducible=gcd(reduction.n,reduction.d)>1;
      selected=value;
      if (value===(reducible ? "reduce" : "submit")) {
        phase=reducible ? "simplifyRule" : "readyToSubmit"; selected=""; feedbackKind="correct";
        feedback=reducible ? "Ja! Brøken skal først forkortes." : "Ja! Brøken kan ikke forkortes yderligere.";
        render("#fl-question"); return;
      }
      feedbackKind="incorrect";
      feedback=value==="extend" ? "Nej. Brøken skal ikke forlænges. Prøv igen."
        : reducible ? "Ikke endnu. Tæller og nævner kan divideres med samme tal større end 1."
        : "Brøken kan ikke forkortes yderligere. Prøv igen.";
      render(`[data-fl-submit-check="${value}"]`);
    }
    function chooseReduceRule(value) {
      if (disposed || locked || phase!=="simplifyRule" || !REDUCE_RULES.some(([id])=>id===value)) return;
      selected=value;
      if (value!=="divideBoth") {
        feedbackKind="incorrect"; feedback="Nej. Man forkorter ikke ved at trække fra. Prøv igen.";
        render(`[data-fl-reduce-rule="${value}"]`); return;
      }
      phase="simplifyDivisor"; selected=""; feedbackKind="correct";
      feedback="Ja! Man dividerer med samme tal i tæller og nævner.";
      render("#fl-question");
    }
    function chooseDivisor(value) {
      if (disposed || locked || phase!=="simplifyDivisor" || !/^\d+$/.test(value)) return;
      const divisor=Number(value);
      if (!divisorOptions().includes(divisor)) return;
      selected=value;
      if (divisor<=1 || reduction.n%divisor!==0 || reduction.d%divisor!==0) {
        feedbackKind="incorrect";
        feedback=divisor===1 ? "Division med 1 ændrer ikke brøken. Vælg et større tal."
          : `Tallet skal gå op i både ${reduction.n} og ${reduction.d}. Prøv igen.`;
        render(`[data-fl-divisor="${value}"]`); return;
      }
      // Any common divisor is valid; smaller choices lead to another reduction round.
      reduction.divisor=divisor; phase="simplifyAnswer"; selected=""; feedbackKind="correct";
      feedback=`Ja! Divider både tæller og nævner med ${divisor}.`;
      answers={numerator:"",denominator:""}; answerStatus={};
      render('[data-fl-answer="numerator"]');
    }
    function chooseReady(value) {
      if (disposed || locked || phase!=="readyToSubmit" || !["yes","no"].includes(value) || gcd(reduction.n,reduction.d)!==1) return;
      finalReply=value; phase="done"; locked=true; completed++; nextReady=false;
      feedback=""; feedbackKind="correct"; selected="";
      render("#fl-question");
      later(() => { nextReady=true; root.querySelector("[data-fl-next]")?.removeAttribute("disabled"); },600);
    }
    function input(event) {
      const field=event.target.closest("[data-fl-answer]");
      if (!field || !root.contains(field) || disposed || locked || !answeringNow() || !["numerator","denominator"].includes(field.dataset.flAnswer)) return;
      answers[field.dataset.flAnswer]=field.value;
      delete answerStatus[field.dataset.flAnswer];
      field.classList.remove("incorrect","correct"); field.setAttribute("aria-invalid","false");
    }
    function click(event) {
      const button=event.target.closest("button");
      if (!button || !root.contains(button) || button.disabled || disposed || drag) return;
      if ((button.hasAttribute("data-fl-token") || button.hasAttribute("data-fl-slot")) && Date.now()<ignoreClickUntil) return;
      if (button.hasAttribute("data-fl-exit")) { onExit(); return; }
      if (button.hasAttribute("data-fl-check-answer")) { checkAnswer(); return; }
      if (button.hasAttribute("data-fl-next")) {
        if (phase !== "done" || !nextReady) return;
        problem=createProblem(++index); phase="operation"; locked=false; nextReady=false;
        placements={numerator:null,denominator:null}; activeToken=""; wrongSlot=""; ignoreClickUntil=0;
        answers={numerator:"",denominator:""}; answerStatus={}; reduction=null; finalReply="yes";
        feedback=""; feedbackKind=""; selected=""; render("#fl-question"); return;
      }
      if (button.hasAttribute("data-fl-notation")) {
        if (locked && phase!=="done") return;
        problem.notation=problem.notation === "stacked" ? "colon" : "stacked";
        if (phase === "operation") { feedback=""; feedbackKind=""; selected=""; }
        render("[data-fl-notation]"); return;
      }
      if (button.dataset.flToken && phase==="arrange") {
        activeToken=activeToken===button.dataset.flToken ? "" : button.dataset.flToken;
        wrongSlot=""; feedbackKind="";
        feedback=activeToken ? `Tallet ${tokenValue(activeToken)} er valgt. Vælg et tomt felt.` : "Vælg et tal, eller træk det over i et tomt felt.";
        render(`[data-fl-token="${button.dataset.flToken}"]`); return;
      }
      if (button.dataset.flSlot && phase==="arrange") {
        if (activeToken) placeToken(activeToken,button.dataset.flSlot);
        else { feedbackKind=""; feedback="Vælg først et af tallene i den anden brøk."; render(`[data-fl-slot="${button.dataset.flSlot}"]`); }
        return;
      }
      if (button.dataset.flOperation) chooseOperation(button.dataset.flOperation);
      if (button.dataset.flRule) chooseRule(button.dataset.flRule);
      if (button.dataset.flSubmitCheck) chooseSubmissionCheck(button.dataset.flSubmitCheck);
      if (button.dataset.flReduceRule) chooseReduceRule(button.dataset.flReduceRule);
      if (button.dataset.flDivisor) chooseDivisor(button.dataset.flDivisor);
      if (button.dataset.flReady) chooseReady(button.dataset.flReady);
    }
    function targetAt(x,y) {
      const target=doc.elementFromPoint(x,y)?.closest("[data-fl-slot]");
      return target && root.contains(target) && !target.disabled ? target : null;
    }
    function updateHover() {
      root.querySelectorAll(".fl-slot.is-over").forEach(el => el.classList.remove("is-over"));
      if (drag) targetAt(drag.x,drag.y)?.classList.add("is-over");
    }
    function stopDrag() {
      if (!drag) return;
      const old=drag; drag=null;
      if (old.frame) view.cancelAnimationFrame(old.frame);
      old.ghost?.remove(); old.button.classList.remove("is-dragging");
      if (old.button.hasPointerCapture?.(old.id)) old.button.releasePointerCapture(old.id);
      updateHover();
    }
    function scrollDrag() {
      if (!drag || !drag.moved) return;
      if (disposed || !root.isConnected) { stopDrag(); return; }
      // Keep touch dragging usable when the destination is below the viewport.
      const edge=70, y=drag.y, height=view.innerHeight;
      const speed=y<edge ? -Math.min(16,(edge-y)/4) : y>height-edge ? Math.min(16,(y-height+edge)/4) : 0;
      if (speed) { view.scrollBy(0,speed); updateHover(); }
      drag.frame=view.requestAnimationFrame(scrollDrag);
    }
    function pointerdown(event) {
      const button=event.target.closest("[data-fl-token]");
      if (!button || !root.contains(button) || button.disabled || disposed || locked || phase!=="arrange" || drag || event.button!==0 || event.isPrimary===false) return;
      drag={id:event.pointerId,token:button.dataset.flToken,button,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,moved:false,ghost:null,frame:null};
      button.setPointerCapture?.(event.pointerId);
    }
    function pointermove(event) {
      if (!drag || event.pointerId!==drag.id) return;
      drag.x=event.clientX; drag.y=event.clientY;
      if (!drag.moved && Math.hypot(drag.x-drag.startX,drag.y-drag.startY)<6) return;
      if (!drag.moved) {
        drag.moved=true; activeToken=drag.token; drag.button.classList.add("is-dragging");
        const ghost=doc.createElement("span");
        ghost.className=`fl-drag-ghost fl-token-${drag.token}`; ghost.textContent=tokenValue(drag.token); ghost.setAttribute("aria-hidden","true");
        doc.body.append(ghost); drag.ghost=ghost; drag.frame=view.requestAnimationFrame(scrollDrag);
      }
      if (event.cancelable) event.preventDefault();
      drag.ghost.style.left=`${drag.x}px`; drag.ghost.style.top=`${drag.y}px`; updateHover();
    }
    function pointerup(event) {
      if (!drag || event.pointerId!==drag.id) return;
      const {token,moved}=drag, target=targetAt(event.clientX,event.clientY);
      stopDrag();
      if (!moved) return; // A tap/click is handled by the normal accessible button path.
      ignoreClickUntil=Date.now()+350;
      if (event.cancelable) event.preventDefault();
      if (target) placeToken(token,target.dataset.flSlot);
      else {
        activeToken=""; feedbackKind=""; wrongSlot="";
        feedback="Slip tallet i et af de tomme felter. Prøv igen.";
        render(`[data-fl-token="${token}"]`);
      }
    }
    function pointercancel(event) {
      if (!drag || event.pointerId!==drag.id) return;
      const token=drag.token; stopDrag(); activeToken=""; render(`[data-fl-token="${token}"]`);
    }
    function preventNativeDrag(event) {
      if (event.target.closest("[data-fl-token]")) event.preventDefault();
    }
    function keydown(event) {
      if (disposed || event.isComposing) return;
      if (event.key==="Escape" && (drag || activeToken)) {
        event.preventDefault(); stopDrag(); activeToken=""; wrongSlot=""; feedback=""; feedbackKind="";
        render("#fl-question"); return;
      }
      const field=event.target.closest("[data-fl-answer]");
      if (field && answeringNow() && event.key==="Enter") {
        event.preventDefault(); event.stopPropagation();
        if (event.repeat || locked) return;
        answers[field.dataset.flAnswer]=field.value;
        if (field.dataset.flAnswer==="numerator") root.querySelector('[data-fl-answer="denominator"]')?.focus();
        else checkAnswer();
        return;
      }
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || locked || phase !== "operation") return;
      const value=({"+":"+","-":"-","*":"*","x":"*","X":"*",":":":","/":":"})[event.key];
      if (!value) return;
      event.preventDefault(); event.stopPropagation(); chooseOperation(value);
    }
    root.addEventListener("click",click);
    root.addEventListener("keydown",keydown);
    root.addEventListener("input",input);
    root.addEventListener("pointerdown",pointerdown);
    root.addEventListener("lostpointercapture",pointercancel);
    root.addEventListener("dragstart",preventNativeDrag);
    doc.addEventListener("pointermove",pointermove,{passive:false});
    doc.addEventListener("pointerup",pointerup);
    doc.addEventListener("pointercancel",pointercancel);
    render();
    return () => {
      disposed=true; stopDrag(); timers.forEach(clearTimeout); timers.clear();
      root.removeEventListener("click",click); root.removeEventListener("keydown",keydown); root.removeEventListener("input",input);
      root.removeEventListener("pointerdown",pointerdown); root.removeEventListener("lostpointercapture",pointercancel);
      root.removeEventListener("dragstart",preventNativeDrag);
      doc.removeEventListener("pointermove",pointermove); doc.removeEventListener("pointerup",pointerup); doc.removeEventListener("pointercancel",pointercancel);
    };
  }
  window.JacobFractionLesson=Object.freeze({ isEnabled, createProblem, expressionHTML, mount });
})();
