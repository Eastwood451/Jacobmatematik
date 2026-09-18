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
  const isEnabled = user => Boolean(user && user.id === TESTER_ID && user.role === "teacher");
  const fractionHTML = (n,d) => `<span class="fl-fraction"><span class="fl-numerator">${n}</span><span class="fl-denominator">${d}</span></span>`;
  function createProblem(index, random = Math.random) {
    const notation = index % 2 === 0 ? "stacked" : "colon";
    if (index === 0) return { a:1,b:2,c:3,d:4,notation };
    const first = Math.min(FRACTIONS.length-1, Math.floor(random()*FRACTIONS.length));
    const offset = 1 + Math.min(FRACTIONS.length-2, Math.floor(random()*(FRACTIONS.length-1)));
    const [a,b] = FRACTIONS[first];
    const [c,d] = FRACTIONS[(first+offset)%FRACTIONS.length];
    return { a,b,c,d,notation };
  }
  function expressionHTML(p) {
    const first = fractionHTML(p.a,p.b), second = fractionHTML(p.c,p.d);
    const drawing = p.notation === "stacked"
      ? `<span class="fl-compound"><span>${first}</span><span>${second}</span></span>`
      : `${first}<span class="fl-operator">:</span>${second}`;
    return `<div class="fl-expression" role="math" aria-label="${p.a} over ${p.b} divideret med ${p.c} over ${p.d}"><span class="fl-expression-drawing" aria-hidden="true">${drawing}</span></div>`;
  }
  function mount(root, { user, onExit = () => {} } = {}) {
    // Pilot gating, not a replacement for Supabase authorization.
    if (!root || !isEnabled(user)) return () => {};
    let index=0, problem=createProblem(0), phase="operation", feedback="", feedbackKind="", selected="";
    let locked=false, disposed=false, completed=0, nextReady=false;
    const timers=new Set();
    function later(callback, milliseconds) {
      const id=setTimeout(() => { timers.delete(id); if (!disposed) callback(); },milliseconds);
      timers.add(id);
    }
    function render(focusSelector) {
      if (disposed) return;
      const done=phase === "done";
      const title=phase === "operation" ? "Hvilken type regnestykke er dette?" : done ? "Ja! Gange med den omvendte." : "Hvilken regneregel skal vi så bruge?";
      const operations = [["+","+","Plus"],["-","−","Minus"],["*","*","Gange"],[":",":","Division"]];
      const choices=phase === "operation"
        ? `<div class="fl-operations" aria-label="Vælg regneart">${operations.map(([id,symbol,name]) => `<button type="button" data-fl-operation="${id}" class="fl-operation ${selected===id ? feedbackKind : ""}" aria-label="${name} (${symbol})" ${locked ? "disabled" : ""}>${symbol}</button>`).join("")}</div>`
        : !done ? `<div class="fl-rules" aria-label="Vælg regneregel">${RULES.map(rule => `<button type="button" data-fl-rule="${rule.id}" class="fl-rule ${selected===rule.id ? feedbackKind : ""}" ${locked ? "disabled" : ""}><span class="fl-rule-symbol" aria-hidden="true">${rule.symbol}</span><strong>${rule.text}</strong><small>${rule.caption}</small></button>`).join("")}</div>` : "";
      const solution=done ? `<div class="fl-solution"><p>Behold den første brøk. Vend den anden brøk, og skift <strong>:</strong> til <strong>·</strong>.</p><div class="fl-solution-equation" role="math" aria-label="${problem.a} over ${problem.b} gange ${problem.d} over ${problem.c}"><span aria-hidden="true">${fractionHTML(problem.a,problem.b)}<span class="fl-operator">·</span><span class="fl-flipped">${fractionHTML(problem.d,problem.c)}</span></span></div><p class="fl-flip-explanation">Den anden brøk vendes: <span>${fractionHTML(problem.c,problem.d)} <span aria-hidden="true">→</span> ${fractionHTML(problem.d,problem.c)}</span></p><button type="button" class="fl-primary" data-fl-next ${nextReady ? "" : "disabled"}>Næste opgave →</button></div>` : "";
      root.innerHTML=`<section class="fl-page" aria-labelledby="fl-title"><div class="fl-heading"><button type="button" class="fl-back" data-fl-exit>← Til øvelser</button><span class="fl-pilot">Test · kun Jacob</span></div><div class="fl-title-row"><div><p class="fl-eyebrow">Forstå regnestykket før du regner</p><h1 id="fl-title">Lær brøkregning</h1></div><span class="fl-count">${completed} gennemført</span></div><div class="fl-steps" aria-label="${done ? "Begge trin gennemført" : `Trin ${phase === "operation" ? 1 : 2} af 2`}"><span class="${phase === "operation" ? "current" : "complete"}"><b>${phase === "operation" ? "1" : "✓"}</b> Find regnearten</span><span class="${phase === "rule" ? "current" : done ? "complete" : ""}"><b>${done ? "✓" : "2"}</b> Vælg regnereglen</span></div><div class="fl-workspace"><div class="fl-problem-panel"><span class="fl-problem-label">Regnestykket</span>${expressionHTML(problem)}<button type="button" class="fl-notation" data-fl-notation ${locked ? "disabled" : ""}>Vis ${problem.notation === "stacked" ? "med kolon" : "som brøk over brøk"}</button>${phase !== "operation" ? `<span class="fl-identified">✓ Division</span>` : ""}</div><div class="fl-question-panel"><p class="fl-eyebrow">${done ? "Reglen er valgt" : `Trin ${phase === "operation" ? 1 : 2} af 2`}</p><h2 id="fl-question" tabindex="-1">${title}</h2>${choices}<div class="fl-feedback ${feedbackKind}" role="status" aria-live="polite" aria-atomic="true">${feedback}</div>${solution}</div></div></section>`;
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
      if (disposed || locked || phase !== "rule") return;
      selected=value;
      if (value !== "reciprocal") {
        feedbackKind="incorrect";
        feedback=value === "add" ? "Nej. Denne regel bruges til plus med brøker. Her skal vi dividere. Prøv igen." : "Nej. Denne regel bruges, når vi ganger to brøker. Ved division skal den anden brøk først vendes. Prøv igen.";
        render(`[data-fl-rule="${value}"]`); return;
      }
      locked=true; phase="done"; completed++; feedbackKind="correct";
      feedback="Korrekt! Vi dividerer med en brøk ved at gange med den omvendte.";
      nextReady=false; render("#fl-question");
      later(() => { nextReady=true; root.querySelector("[data-fl-next]")?.removeAttribute("disabled"); },600);
    }
    function click(event) {
      const button=event.target.closest("button");
      if (!button || !root.contains(button) || button.disabled || disposed) return;
      if (button.hasAttribute("data-fl-exit")) { onExit(); return; }
      if (button.hasAttribute("data-fl-next")) {
        if (phase !== "done" || !nextReady) return;
        problem=createProblem(++index); phase="operation"; locked=false; nextReady=false;
        feedback=""; feedbackKind=""; selected=""; render("#fl-question"); return;
      }
      if (button.hasAttribute("data-fl-notation")) {
        if (locked) return;
        problem.notation=problem.notation === "stacked" ? "colon" : "stacked";
        // A wrong-answer hint must describe the notation currently on screen.
        if (phase === "operation") { feedback=""; feedbackKind=""; selected=""; }
        render("[data-fl-notation]"); return;
      }
      if (button.dataset.flOperation) chooseOperation(button.dataset.flOperation);
      if (button.dataset.flRule) chooseRule(button.dataset.flRule);
    }
    function keydown(event) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || locked || phase !== "operation") return;
      const value=({"+":"+","-":"-","*":"*","x":"*","X":"*",":":":","/":":"})[event.key];
      if (!value) return;
      event.preventDefault(); event.stopPropagation(); chooseOperation(value);
    }
    root.addEventListener("click",click);
    root.addEventListener("keydown",keydown);
    render();
    return () => { disposed=true; timers.forEach(clearTimeout); timers.clear(); root.removeEventListener("click",click); root.removeEventListener("keydown",keydown); };
  }
  window.JacobFractionLesson=Object.freeze({ isEnabled, createProblem, expressionHTML, mount });
})();
