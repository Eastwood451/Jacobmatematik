/* Final fraction-lesson steps. No network, storage, timers, or global event listeners. */
(() => {
  "use strict";
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
  const gcd = (a,b) => { while(b) [a,b]=[b,a%b]; return a; };
  const fraction = (n,d) => `<span class="fl-fraction"><span class="fl-numerator">${n}</span><span class="fl-denominator">${d}</span></span>`;
  const TITLES = {
    assess:"Vil du aflevere brøken sådan her?", rule:"Hvordan forkorter man en brøk?",
    divisor:"Hvilket tal vil du dividere med?", answer:"Skriv den forkortede brøk.", ready:"Er du klar til at aflevere?"
  };
  function create(numerator, denominator) {
    if (![numerator,denominator].every(n => Number.isSafeInteger(n) && n>0)) throw new Error("Expected positive integer fraction terms");
    let n=numerator, d=denominator, stage="assess", divisor=0, selected="", feedback="", kind="", finalMessage="";
    let values={numerator:"",denominator:""}, status={};
    const read = text => /^\d{1,6}$/.test(text.trim()) ? Number(text.trim()) : NaN;
    const change = next => { stage=next; selected=""; feedback=""; kind=""; status={}; };
    function choose(value) {
      selected=value; kind="incorrect";
      if (stage==="assess" && ["fine","extend","reduce"].includes(value)) {
        if (gcd(n,d)>1) {
          if (value==="reduce") { change("rule"); kind="correct"; feedback="Ja! Brøken kan forkortes."; }
          else feedback=value==="fine" ? "Ikke endnu. Der er et tal større end 1, som går op i både tæller og nævner." : "Nej. Her skal brøken forkortes, ikke forlænges.";
        } else if(value==="fine") { change("ready"); kind="correct"; feedback="Ja! Brøken kan ikke forkortes yderligere."; }
        else feedback="Brøken er allerede forkortet helt. Den behøver hverken at blive forlænget eller forkortet.";
      } else if(stage==="rule" && ["subtractTop","subtractBoth","divideBoth"].includes(value)) {
        if(value==="divideBoth") { change("divisor"); kind="correct"; feedback="Ja! Du skal dividere med samme tal i tæller og nævner."; }
        else feedback="Nej. At trække fra er ikke reglen for forkortning. Prøv igen.";
      } else if(stage==="ready" && ["yes","no"].includes(value) && gcd(n,d)===1) {
        change("done"); finalMessage=value==="yes" ? "FLOT! Du cooker de brøker!" : "JO, champ! Brøken kan ikke forkortes yderligere! Du har gjort det godt!";
      }
    }
    function chooseDivisor(value) {
      if(stage!=="divisor") return;
      const candidate=read(String(value)); selected=String(value);
      if(!Number.isSafeInteger(candidate) || candidate<=1 || n%candidate || d%candidate) {
        kind="incorrect";
        feedback="Vælg et helt tal større end 1, som går op i både tælleren og nævneren.";
        return;
      }
      divisor=candidate; change("answer"); values={numerator:"",denominator:""};
      kind="correct"; feedback=`Ja! Divider både tæller og nævner med ${divisor}.`;
    }
    function check() {
      if(stage!=="answer") return;
      const top=read(values.numerator), bottom=read(values.denominator);
      const topOK=top===n/divisor, bottomOK=bottom===d/divisor;
      status={numerator:topOK ? "correct":"incorrect", denominator:bottomOK ? "correct":"incorrect"};
      if(!topOK || !bottomOK) {
        kind="incorrect";
        if(!values.numerator.trim() || !values.denominator.trim()) feedback="Skriv både tælleren og nævneren.";
        else if(!Number.isFinite(top) || !Number.isFinite(bottom) || top<1 || bottom<1) feedback="Skriv positive hele tal i begge felter. Nævneren må ikke være 0.";
        else if(top*d===bottom*n) { kind=""; status={}; feedback=`Din brøk har samme værdi. Her skal du vise resultatet af at dividere begge tal med ${divisor}.`; }
        else feedback=topOK ? `Tælleren er rigtig. Regn ${d} ÷ ${divisor} igen.` : bottomOK ? `Nævneren er rigtig. Regn ${n} ÷ ${divisor} igen.` : `Prøv igen: ${n} ÷ ${divisor} i tælleren og ${d} ÷ ${divisor} i nævneren.`;
        return;
      }
      const calculation=`Ja! ${n} ÷ ${divisor} = ${top} og ${d} ÷ ${divisor} = ${bottom}.`;
      n=top; d=bottom;
      // Any common divisor is valid. Repeat when a pupil reduces in several steps.
      change(gcd(n,d)===1 ? "ready":"assess"); divisor=0; values={numerator:"",denominator:""}; kind="correct"; feedback=calculation;
    }
    function input(field) {
      const part=field?.dataset?.ffAnswer;
      if(stage!=="answer" || !["numerator","denominator"].includes(part)) return;
      values[part]=field.value; delete status[part];
      field.classList.remove("correct","incorrect"); field.setAttribute("aria-invalid","false");
    }
    function action(button, root) {
      if(stage==="done") return null;
      if(button.hasAttribute("data-ff-choice")) choose(button.dataset.ffChoice);
      else if(button.hasAttribute("data-ff-divisor")) chooseDivisor(button.dataset.ffDivisor);
      else if(button.hasAttribute("data-ff-check") && stage==="answer") {
        for(const part of ["numerator","denominator"]) values[part]=root.querySelector(`[data-ff-answer="${part}"]`)?.value || "";
        check();
      } else return null;
      if(stage==="answer") return `[data-ff-answer="${status.numerator==="correct" ? "denominator":"numerator"}"]`;
      return "#fl-question";
    }
    function keydown(event, root) {
      const field=event.target.closest("[data-ff-answer]");
      if(!field || stage!=="answer" || event.key!=="Enter") return null;
      event.preventDefault(); event.stopPropagation();
      if(event.repeat || event.isComposing) return null;
      input(field);
      if(field.dataset.ffAnswer==="numerator") { root.querySelector('[data-ff-answer="denominator"]')?.focus(); return null; }
      return action(root.querySelector("[data-ff-check]"),root);
    }
    function cards(options) {
      return `<div class="ff-cards">${options.map(([id,text]) => `<button type="button" class="ff-card ${id===selected ? kind:""}" data-ff-choice="${id}">${text}</button>`).join("")}</div>`;
    }
    function answer(part) {
      return `<input type="text" class="fl-answer-input ${status[part] || ""}" data-ff-answer="${part}" inputmode="numeric" enterkeyhint="${part==="numerator" ? "next":"done"}" maxlength="6" autocomplete="off" spellcheck="false" aria-label="Den forkortede brøks ${part==="numerator" ? "tæller":"nævner"}" aria-describedby="ff-help fl-feedback" aria-invalid="${status[part]==="incorrect"}" value="${escape(values[part])}">`;
    }
    function html() {
      let choices="", equation=fraction(n,d), help="";
      if(stage==="assess") choices=cards([["fine","Ja - den er fin!"],["extend","Nej - den skal først forlænges!"],["reduce","Nej - den skal først forkortes!"]]);
      if(stage==="rule") choices=cards([["subtractTop","Man trækker fra i tælleren"],["subtractBoth","Man trækker fra i tæller og nævner"],["divideBoth","Man dividerer med samme tal i tæller og nævner"]]);
      if(stage==="divisor") {
        const options=new Set([2,3,4,5,6,7,8,9,10]);
        const common=gcd(n,d);
        for(let i=2;i<=common;i++) if(common%i===0) options.add(i);
        choices=`<div class="ff-divisors" aria-label="Vælg divisor">${[...options].sort((a,b)=>a-b).map(value=>`<button type="button" class="ff-divisor ${String(value)===selected ? kind:""}" data-ff-divisor="${value}">${value}</button>`).join("")}</div>`;
        help="Vælg et tal større end 1, som går op i begge tal.";
      }
      if(stage==="answer") {
        equation=`${fraction(`<span class="ff-term">${n}<small>÷ ${divisor}</small></span>`,`<span class="ff-term">${d}<small>÷ ${divisor}</small></span>`)}<span class="fl-operator" aria-label="er lig med">=</span><span class="fl-answer-fraction">${answer("numerator")}<span class="fl-target-line" aria-hidden="true"></span>${answer("denominator")}</span>`;
        help="Regn de to divisioner ud. Skriv resultatet over og under brøkstregen.";
      }
      if(stage==="ready") choices=cards([["yes","Ja"],["no","Nej"]]);
      return `<div class="ff-panel" data-ff-stage="${stage}"><p class="fl-eyebrow">${stage==="done" ? "Brøken er afleveret":"Forkort og aflever"}</p><h2 id="fl-question" tabindex="-1">${stage==="done" ? finalMessage:TITLES[stage]}</h2><p id="ff-help" class="ff-help">${help}</p><div class="fl-solution-equation ff-equation" role="group" aria-label="${stage==="answer" ? `${n} divideret med ${divisor} over ${d} divideret med ${divisor}. Skriv svarbrøken.`:`Brøken ${n} over ${d}`}"><span>${equation}</span></div>${choices}<div id="fl-feedback" class="fl-feedback ${kind}" role="status" aria-live="polite" aria-atomic="true">${feedback}</div>${stage==="answer" ? '<button type="button" class="fl-primary" data-ff-check>Tjek svar</button>':""}</div>`;
    }
    return Object.freeze({ html, input, action, keydown, get done(){return stage==="done";} });
  }
  window.JacobFractionFinish=Object.freeze({create});
})();
