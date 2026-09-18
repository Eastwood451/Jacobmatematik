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
    function render(focusSelector) {
      if (disposed) return;
      const done=phase === "done", arranging=phase === "arrange", applying=arranging || done;
      const step=phase === "operation" ? 1 : phase === "rule" ? 2 : 3;
      const title=phase === "operation" ? "Hvilken type regnestykke er dette?" : applying ? (done ? "Ja! Du har vendt brøken." : "Ja! Gange med den omvendte.") : "Hvilken regneregel skal vi så bruge?";
      const operations = [["+","+","Plus"],["-","−","Minus"],["*","*","Gange"],[":",":","Division"]];
      const choices=phase === "operation"
        ? `<div class="fl-operations" aria-label="Vælg regneart">${operations.map(([id,symbol,name]) => `<button type="button" data-fl-operation="${id}" class="fl-operation ${selected===id ? feedbackKind : ""}" aria-label="${name} (${symbol})" ${locked ? "disabled" : ""}>${symbol}</button>`).join("")}</div>`
        : phase === "rule" ? `<div class="fl-rules" aria-label="Vælg regneregel">${RULES.map(rule => `<button type="button" data-fl-rule="${rule.id}" class="fl-rule ${selected===rule.id ? feedbackKind : ""}" ${locked ? "disabled" : ""}><span class="fl-rule-symbol" aria-hidden="true">${rule.symbol}</span><strong>${rule.text}</strong><small>${rule.caption}</small></button>`).join("")}</div>` : "";
      const solution=applying ? `<div class="fl-solution"><p id="fl-drag-help">${done ? "Behold den første brøk, og gang med den omvendte." : "Træk tallene fra den anden brøk over i de tomme felter, så brøken bliver vendt."}</p><div class="fl-solution-equation" role="group" aria-label="${problem.a} over ${problem.b} gange den omvendte brøk" aria-describedby="fl-drag-help"><span><span role="math" aria-label="${problem.a} over ${problem.b}">${fractionHTML(problem.a,problem.b)}</span><span class="fl-operator" aria-label="gange">·</span><span class="fl-target-fraction">${slotHTML("numerator")}<span class="fl-target-line" aria-hidden="true"></span>${slotHTML("denominator")}</span></span></div>${done ? `<p class="fl-flip-explanation">Den anden brøk er vendt: <span>${fractionHTML(problem.c,problem.d)} <span aria-hidden="true">→</span> ${fractionHTML(problem.d,problem.c)}</span></p>` : '<p class="fl-drag-hint">Du kan også trykke på et tal og derefter på et felt.</p>'}<button type="button" class="fl-primary" data-fl-next ${done && nextReady ? "" : "disabled"}>Næste opgave →</button></div>` : "";
      const steps=["Find regnearten","Vælg regnereglen","Vend brøken"].map((label,i) => `<span class="${done || i+1<step ? "complete" : i+1===step ? "current" : ""}"><b>${done || i+1<step ? "✓" : i+1}</b> ${label}</span>`).join("");
      root.innerHTML=`<section class="fl-page" aria-labelledby="fl-title"><div class="fl-heading"><button type="button" class="fl-back" data-fl-exit>← Til øvelser</button><span class="fl-pilot">Test · kun Jacob</span></div><div class="fl-title-row"><div><p class="fl-eyebrow">Forstå regnestykket før du regner</p><h1 id="fl-title">Lær brøkregning</h1></div><span class="fl-count">${completed} gennemført</span></div><div class="fl-steps" aria-label="${done ? "Alle tre trin gennemført" : `Trin ${step} af 3`}">${steps}</div><div class="fl-workspace"><div class="fl-problem-panel"><span class="fl-problem-label">Regnestykket</span>${expressionHTML(problem,applying ? sourceHTML() : "")}<button type="button" class="fl-notation" data-fl-notation ${locked && !done ? "disabled" : ""}>Vis ${problem.notation === "stacked" ? "med kolon" : "som brøk over brøk"}</button>${phase !== "operation" ? `<span class="fl-identified">✓ Division</span>` : ""}</div><div class="fl-question-panel"><p class="fl-eyebrow">${done ? "Reglen er brugt" : `Trin ${step} af 3`}</p><h2 id="fl-question" tabindex="-1">${title}</h2>${choices}<div class="fl-feedback ${feedbackKind}" role="status" aria-live="polite" aria-atomic="true">${feedback}</div>${solution}</div></div></section>`;
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
        // Only a fully built reciprocal completes the exercise; repeated drops cannot score.
        phase="done"; locked=true; completed++; nextReady=false;
        feedback="Korrekt! Du har selv vendt den anden brøk.";
        render("#fl-question");
        later(() => { nextReady=true; root.querySelector("[data-fl-next]")?.removeAttribute("disabled"); },600);
      } else {
        feedback="Godt! Træk også det sidste tal på plads.";
        render(`[data-fl-token="${token === "c" ? "d" : "c"}"]`);
      }
    }
    function click(event) {
      const button=event.target.closest("button");
      if (!button || !root.contains(button) || button.disabled || disposed || drag) return;
      if ((button.hasAttribute("data-fl-token") || button.hasAttribute("data-fl-slot")) && Date.now()<ignoreClickUntil) return;
      if (button.hasAttribute("data-fl-exit")) { onExit(); return; }
      if (button.hasAttribute("data-fl-next")) {
        if (phase !== "done" || !nextReady) return;
        problem=createProblem(++index); phase="operation"; locked=false; nextReady=false;
        placements={numerator:null,denominator:null}; activeToken=""; wrongSlot="";
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
      if (event.key==="Escape" && (drag || activeToken)) {
        event.preventDefault(); stopDrag(); activeToken=""; wrongSlot=""; feedback=""; feedbackKind="";
        render("#fl-question"); return;
      }
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || locked || phase !== "operation") return;
      const value=({"+":"+","-":"-","*":"*","x":"*","X":"*",":":":","/":":"})[event.key];
      if (!value) return;
      event.preventDefault(); event.stopPropagation(); chooseOperation(value);
    }
    root.addEventListener("click",click);
    root.addEventListener("keydown",keydown);
    root.addEventListener("pointerdown",pointerdown);
    root.addEventListener("lostpointercapture",pointercancel);
    root.addEventListener("dragstart",preventNativeDrag);
    doc.addEventListener("pointermove",pointermove,{passive:false});
    doc.addEventListener("pointerup",pointerup);
    doc.addEventListener("pointercancel",pointercancel);
    render();
    return () => {
      disposed=true; stopDrag(); timers.forEach(clearTimeout); timers.clear();
      root.removeEventListener("click",click); root.removeEventListener("keydown",keydown);
      root.removeEventListener("pointerdown",pointerdown); root.removeEventListener("lostpointercapture",pointercancel);
      root.removeEventListener("dragstart",preventNativeDrag);
      doc.removeEventListener("pointermove",pointermove); doc.removeEventListener("pointerup",pointerup); doc.removeEventListener("pointercancel",pointercancel);
    };
  }
  window.JacobFractionLesson=Object.freeze({ isEnabled, createProblem, expressionHTML, mount });
})();
