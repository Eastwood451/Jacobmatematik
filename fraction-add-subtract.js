/* Guided addition/subtraction pilot. Shares the existing reduction/submission component. */
(() => {
  "use strict";
  const division = window.JacobFractionLesson;
  if (!division) return;
  const gcd = (a,b) => { while (b) [a,b]=[b,a%b]; return a; };
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
  const fraction = (n,d) => `<span class="fl-fraction"><span class="fl-numerator">${n}</span><span class="fl-denominator">${d}</span></span>`;
  const read = value => /^\d{1,4}$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const POOL = [];
  for (const d of [2,3,4,6,8,10,12]) for (let n=1; n<d && n<=5; n++) if (gcd(n,d)===1) POOL.push([n,d]);
  // Bound the actual working, not just the input denominators: 10 and 11
  // otherwise turn into 110. These limits apply to every subsequent problem.
  const PAIRS = POOL.flatMap(([a,b]) => POOL.filter(([c,d]) => {
    const common=b/gcd(b,d)*d;
    return b!==d && a*d>c*b && common<=12
      && common/b<=3 && common/d<=3
      && a*(common/b)+c*(common/d)<=12;
  }).map(([c,d]) => [a,b,c,d]));
  function plan(p) {
    if (!p || !["+","-"].includes(p.op) || ![p.a,p.b,p.c,p.d].every(n => Number.isSafeInteger(n) && n>0 && n<=144)) throw new Error("Invalid fraction problem");
    const denominator=p.b/gcd(p.b,p.d)*p.d;
    const factors=[denominator/p.b,denominator/p.d];
    const numerators=[p.a*factors[0],p.c*factors[1]];
    const numerator=p.op==="+" ? numerators[0]+numerators[1] : numerators[0]-numerators[1];
    if (numerator<=0) throw new Error("This pilot uses positive fraction results");
    return {denominator,factors,numerators,numerator};
  }
  function createProblem(op,index=0,random=Math.random) {
    if (!["+","-"].includes(op)) throw new Error("Expected + or -");
    if (index===0) return op==="+" ? {a:1,b:2,c:1,d:6,op} : {a:5,b:6,c:1,d:2,op};
    const r=random();
    if (!Number.isFinite(r) || r<0 || r>=1) throw new Error("Expected a random value in [0,1)");
    let [a,b,c,d]=PAIRS[Math.floor(r*PAIRS.length)];
    if (op==="+" && index%2) [a,b,c,d]=[c,d,a,b];
    return {a,b,c,d,op};
  }
  function mount(root,{user,op="+",onExit=()=>{},onNext=null,startIndex=0,initialCompleted=0,mixed=false}={}) {
    if (!root || !division.isEnabled(user)) return () => {};
    if (!window.JacobFractionFinish) throw new Error("Fraction finish component is not loaded");
    let index=startIndex,p=createProblem(op,startIndex),q=plan(p),phase="operation",completed=initialCompleted;
    let active=0,converted=[false,false],factor=0,selected="",feedback="",kind="",finish=null;
    let values={numerator:"",denominator:""},status={},disposed=false,locked=false,nextReady=false;
    const timers=new Set();
    const symbol = () => op==="+" ? "+" : "−";
    const pair = () => active===0 ? [p.a,p.b] : [p.c,p.d];
    const ordinal = () => active===0 ? "første" : "anden";
    const answerMode = () => ["extensionAnswer","combine"].includes(phase);
    const steps=["Find regnearten","Find fælles nævner","Forlæng brøkerne","Regn tællerne","Forkort og aflever"];
    function later(fn,ms) {
      const id=setTimeout(()=>{timers.delete(id);if(!disposed) fn();},ms); timers.add(id);
    }
    function move(next,message="") {
      phase=next; selected=""; feedback=message; kind=message ? "correct" : ""; status={};
      values={numerator:"",denominator:""};
    }
    function chooseNextFraction(message) {
      active=converted.findIndex((done,i)=>!done && q.factors[i]>1);
      if (active<0) move("combine",message || "Nu har brøkerne samme nævner.");
      else move("method",message);
    }
    function rules() {
      return [
        ["both",op==="+" ? "Man lægger tæller sammen med tæller og nævner sammen med nævner" : "Man trækker tæller fra tæller og nævner fra nævner"],
        ["keep",op==="+" ? "Man lægger tællerne sammen og beholder nævneren" : "Man trækker tællerne fra hinanden og beholder nævneren"],
        ["common","Man forlænger eller forkorter, så de har samme nævner"]
      ];
    }
    function cards(options,action) {
      return `<div class="fa-choices">${options.map(([id,text])=>`<button type="button" class="fa-choice ${selected===id ? kind : ""}" data-fa-${action}="${id}" ${locked ? "disabled" : ""}>${text}</button>`).join("")}</div>`;
    }
    function field(part) {
      return `<input type="text" class="fl-answer-input ${status[part] || ""}" data-fa-answer="${part}" inputmode="numeric" enterkeyhint="${part==="numerator" && phase==="extensionAnswer" ? "next" : "done"}" maxlength="4" autocomplete="off" spellcheck="false" aria-label="${phase==="extensionAnswer" ? "Den forlængede brøks" : "Resultatets"} ${part==="numerator" ? "tæller" : "nævner"}" aria-invalid="${status[part]==="incorrect"}" aria-describedby="fa-help fl-feedback" value="${escape(values[part])}">`;
    }
    function expression(a,b,c,d) {
      return `${fraction(a,b)}<span class="fl-operator">${symbol()}</span>${fraction(c,d)}`;
    }
    function equation(content,label) {
      return `<div class="fl-solution-equation fa-equation" role="group" aria-label="${label}"><span>${content}</span></div>`;
    }
    function panel() {
      let title="",choices="",work="",help="";
      const [n,d]=pair();
      if(phase==="operation") {
        title="Hvilken type regnestykke er dette?";
        choices=cards([["+","+"],["-","−"],["*","·"],[":",":"]],"operation");
      } else if(phase==="rule") {
        title=op==="+" ? "Hvordan lægger man to brøker sammen?" : "Hvordan trækker man en brøk fra en anden?";
        choices=cards(rules(),"rule");
      } else if(["method","factor","extensionRule","extensionAnswer"].includes(phase)) {
        help=`Vi bruger fællesnævneren ${q.denominator}. Nu arbejder du med den ${ordinal()} brøk.`;
        work=equation(`${fraction(n,d)}<span class="fl-operator">→</span>${fraction('<span class="fa-unknown" aria-label="Ny tæller">?</span>',q.denominator)}`,`Den ${ordinal()} brøk skal have nævneren ${q.denominator}`);
        if(phase==="method") {
          title=`Skal den ${ordinal()} brøk forkortes eller forlænges?`;
          choices=cards([["reduce","Forkortes"],["extend","Forlænges"]],"method");
        } else if(phase==="factor") {
          title="Hvilket tal vil du forlænge med?";
          choices=`<div class="fa-factors" aria-label="Vælg forlængelsestal">${[2,3].map(k=>`<button type="button" class="fa-choice ${selected===String(k) ? kind : ""}" data-fa-factor="${k}">${k}</button>`).join("")}</div>`;
        } else if(phase==="extensionRule") {
          title="Hvordan forlænger man en brøk?";
          help+=` Du har valgt at forlænge med ${factor}.`;
          choices=cards([["addTop","Man lægger tallet til i tælleren"],["addBoth","Man lægger samme tal til i tæller og nævner"],["multiplyBoth","Man ganger med samme tal i tæller og nævner"]],"extension-rule");
        } else {
          title=`Forlæng den ${ordinal()} brøk med ${factor}.`;
          help="Regn de to gangestykker ud. Skriv både den nye tæller og den nye nævner.";
          work=equation(`${fraction(`<span class="fa-term">${n}<small>· ${factor}</small></span>`,`<span class="fa-term">${d}<small>· ${factor}</small></span>`)}<span class="fl-operator">=</span><span class="fl-answer-fraction">${field("numerator")}<span class="fl-target-line" aria-hidden="true"></span>${field("denominator")}</span>`,`Gang både tæller og nævner med ${factor}`);
        }
      } else if(phase==="combine") {
        title=op==="+" ? "Læg tællerne sammen." : "Træk den anden tæller fra den første.";
        help=`${op==="+" ? "Læg" : "Træk"} tællerne ${op==="+" ? "sammen" : "fra hinanden"}, og behold nævneren ${q.denominator}.`;
        work=equation(`${expression(q.numerators[0],q.denominator,q.numerators[1],q.denominator)}<span class="fl-operator">=</span><span class="fl-answer-fraction">${field("numerator")}<span class="fl-target-line" aria-hidden="true"></span><span class="fa-kept-denominator" aria-label="Nævneren beholdes">${q.denominator}</span></span>`,"Regn tællerne, og behold den fælles nævner");
      }
      return `<p class="fl-eyebrow">${phase==="extensionAnswer" ? "Tæller og nævner ganges med samme tal" : "Et trin ad gangen"}</p><h2 id="fl-question" tabindex="-1">${title}</h2><p id="fa-help" class="fa-help">${help}</p>${work}${choices}<div id="fl-feedback" class="fl-feedback ${kind}" role="status" aria-live="polite" aria-atomic="true">${feedback}</div>${answerMode() ? '<button type="button" class="fl-primary" data-fa-check>Tjek svar</button>' : ""}`;
    }
    function render(focus) {
      if(disposed) return;
      const done=phase==="done";
      const step=phase==="operation" ? 1 : phase==="rule" ? 2 : phase==="combine" ? 4 : finish ? 5 : 3;
      const progress=steps.map((label,i)=>`<span class="${done || i+1<step ? "complete" : i+1===step ? "current" : ""}"><b>${done || i+1<step ? "✓" : i+1}</b>${label}</span>`).join("");
      const rewritten=converted.some(Boolean) ? `<div class="fa-rewritten"><span>Brøkerne undervejs</span>${equation(expression(converted[0] ? q.numerators[0] : p.a,converted[0] ? q.denominator : p.b,converted[1] ? q.numerators[1] : p.c,converted[1] ? q.denominator : p.d),"Brøkerne undervejs")}</div>` : "";
      root.innerHTML=`<section class="fl-page fa-page" data-fa-phase="${phase}" aria-labelledby="fl-title"><div class="fl-heading"><button type="button" class="fl-back" data-fa-exit>← Til øvelser</button><span class="fl-pilot">Test · kun Jacob</span></div><div class="fl-title-row"><div><p class="fl-eyebrow">Forstå regnestykket før du regner</p><h1 id="fl-title">Lær brøkregning · ${mixed ? "blandede opgaver" : op==="+" ? "plus" : "minus"}</h1></div><span class="fl-count">${completed} gennemført</span></div><div class="fl-steps" aria-label="Trin ${step} af ${steps.length}">${progress}</div><div class="fl-workspace"><div class="fl-problem-panel"><span class="fl-problem-label">Oprindeligt regnestykke</span><div class="fl-expression" role="math" aria-label="${p.a} over ${p.b} ${op==="+" ? "plus" : "minus"} ${p.c} over ${p.d}"><span class="fl-expression-drawing" aria-hidden="true">${expression(p.a,p.b,p.c,p.d)}</span></div>${rewritten}</div><div class="fl-question-panel">${finish ? finish.html() : panel()}${done ? `<button type="button" class="fl-primary" data-fa-next ${nextReady ? "" : "disabled"}>Næste opgave →</button>` : ""}</div></div></section>`;
      if(focus) root.querySelector(focus)?.focus({preventScroll:true});
    }
    function wrong(message) { kind="incorrect";feedback=message;render("#fl-question"); }
    function chooseOperation(value) {
      if(phase!=="operation" || locked || !["+","-","*",":"].includes(value)) return;
      selected=value;
      if(value!==op) { wrong(`Nej. Tegnet mellem brøkerne er ${op==="+" ? "plus" : "minus"}. Prøv igen.`);return; }
      locked=true;kind="correct";feedback=`Ja! Det er et ${op==="+" ? "plusstykke" : "minusstykke"}.`;render();
      later(()=>{locked=false;move("rule");render("#fl-question");},850);
    }
    function chooseRule(value) {
      if(phase!=="rule" || !rules().some(([id])=>id===value)) return;
      selected=value;
      const same=p.b===p.d;
      if(value!==(same ? "keep" : "common")) {
        wrong(value==="keep" && !same ? "Den regel gælder, når brøkerne allerede har samme nævner. Her skal nævnerne først være ens." : same ? "Brøkerne har allerede samme nævner. Den kan vi beholde." : "Nej. Nævnerne skal ikke regnes sammen. Brøkerne skal først have samme nævner.");return;
      }
      converted=q.factors.map(k=>k===1);
      chooseNextFraction(same ? "Ja! Nævnerne er allerede ens." : `Ja! Først gør vi nævnerne ens. Vi bruger fællesnævneren ${q.denominator}.`);
      render("#fl-question");
    }
    function check() {
      if(!answerMode() || locked || disposed) return;
      const extending=phase==="extensionAnswer", [n,d]=pair();
      for(const part of extending ? ["numerator","denominator"] : ["numerator"]) values[part]=root.querySelector(`[data-fa-answer="${part}"]`)?.value || "";
      const top=read(values.numerator),bottom=extending ? read(values.denominator) : q.denominator;
      const expectedTop=extending ? n*factor : q.numerator,expectedBottom=extending ? d*factor : q.denominator;
      const topOK=top===expectedTop,bottomOK=bottom===expectedBottom;
      status={numerator:topOK ? "correct":"incorrect",denominator:bottomOK ? "correct":"incorrect"};
      if(!topOK || !bottomOK) {
        kind="incorrect";
        if(!values.numerator.trim() || (extending && !values.denominator.trim())) feedback=extending ? "Skriv både tælleren og nævneren." : "Skriv resultatet i tællerens felt.";
        else if(!Number.isFinite(top) || !Number.isFinite(bottom) || top<1 || bottom<1) feedback="Skriv positive hele tal i felterne. Nævneren må ikke være 0.";
        else if(extending && top*expectedBottom===bottom*expectedTop) { kind="";status={};feedback=`Din brøk har samme værdi. Her skal du vise de to produkter, når du forlænger med ${factor}.`; }
        else feedback=extending ? `Prøv igen: ${n} · ${factor} i tælleren og ${d} · ${factor} i nævneren.` : `Prøv igen: ${q.numerators[0]} ${symbol()} ${q.numerators[1]}. Nævneren bliver ved med at være ${q.denominator}.`;
        render(`[data-fa-answer="${topOK && extending ? "denominator":"numerator"}"]`);return;
      }
      if(extending) {
        converted[active]=true;
        chooseNextFraction(`Ja! ${n} · ${factor} = ${expectedTop} og ${d} · ${factor} = ${expectedBottom}.`);
        factor=0;render("#fl-question");
      } else {
        finish=window.JacobFractionFinish.create(q.numerator,q.denominator);
        move("finish");render("#fl-question");
      }
    }
    function finishChanged(focus) {
      if(!focus || disposed || phase!=="finish") return;
      if(finish.done) {
        phase="done";locked=true;completed++;nextReady=false;
        later(()=>{nextReady=true;root.querySelector("[data-fa-next]")?.removeAttribute("disabled");},600);
      }
      render(focus);
    }
    function click(event) {
      const button=event.target.closest("button");
      if(disposed || !button || !root.contains(button) || button.disabled) return;
      if(button.hasAttribute("data-fa-exit")) { onExit();return; }
      if(button.hasAttribute("data-fa-next")) {
        if(phase!=="done" || !nextReady) return;
        if(onNext) { nextReady=false; onNext(completed); return; }
        p=createProblem(op,++index);q=plan(p);converted=[false,false];active=0;factor=0;finish=null;locked=false;nextReady=false;
        move("operation");render("#fl-question");return;
      }
      if(finish && phase==="finish") { finishChanged(finish.action(button,root));return; }
      if(locked) return;
      if(button.hasAttribute("data-fa-check")) { check();return; }
      if(button.dataset.faOperation) { chooseOperation(button.dataset.faOperation);return; }
      if(button.dataset.faRule) { chooseRule(button.dataset.faRule);return; }
      if(phase==="method" && ["reduce","extend"].includes(button.dataset.faMethod)) {
        selected=button.dataset.faMethod;
        if(selected!=="extend") { wrong(`Nævneren skal gå fra ${pair()[1]} til ${q.denominator}. Brøken skal forlænges.`);return; }
        move("factor","Ja! Vi skal forlænge brøken.");render("#fl-question");return;
      }
      if(phase==="factor" && button.hasAttribute("data-fa-factor")) {
        const k=read(button.dataset.faFactor);selected=button.dataset.faFactor;
        if(k!==q.factors[active] || k<=1) { wrong(`Nævneren ${pair()[1]} skal blive til ${q.denominator}. Vælg det tal, du skal gange med.`);return; }
        factor=k;move("extensionRule",`Ja! Vi forlænger med ${factor}.`);render("#fl-question");return;
      }
      if(phase==="extensionRule" && ["addTop","addBoth","multiplyBoth"].includes(button.dataset.faExtensionRule)) {
        selected=button.dataset.faExtensionRule;
        if(selected!=="multiplyBoth") { wrong("Nej. Når du forlænger, ganger du tæller og nævner med det samme tal.");return; }
        move("extensionAnswer","Ja! Gang både tæller og nævner med det samme tal.");render('[data-fa-answer="numerator"]');
      }
    }
    function input(event) {
      if(disposed || locked) return;
      if(finish) {finish.input(event.target);return;}
      const field=event.target,part=field.dataset.faAnswer;
      if(!answerMode() || !["numerator","denominator"].includes(part)) return;
      values[part]=field.value;delete status[part];field.classList.remove("incorrect","correct");field.setAttribute("aria-invalid","false");
    }
    function keydown(event) {
      if(disposed || event.isComposing) return;
      if(finish && phase==="finish") { finishChanged(finish.keydown(event,root));return; }
      if(event.target.matches("[data-fa-answer]")) {
        event.stopPropagation();
        if(event.key!=="Enter") return;
        event.preventDefault();if(event.repeat || locked) return;
        if(phase==="extensionAnswer" && event.target.dataset.faAnswer==="numerator") root.querySelector('[data-fa-answer="denominator"]')?.focus();
        else check();
        return;
      }
      if(phase==="operation" && !locked && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && ["+","-","*",":"].includes(event.key)) {
        event.preventDefault();event.stopPropagation();chooseOperation(event.key);
      }
    }
    root.addEventListener("click",click);root.addEventListener("input",input);root.addEventListener("keydown",keydown);render();
    return ()=>{disposed=true;timers.forEach(clearTimeout);timers.clear();root.removeEventListener("click",click);root.removeEventListener("input",input);root.removeEventListener("keydown",keydown);};
  }
  // The shell shares one multiplication/division engine and keeps the same authorization role.
  function mountPractice(root,options={}) {
    if(!root || !division.isEnabled(options.user)) return ()=>{};
    root.innerHTML='<div class="fa-mode-nav" role="group" aria-label="Vælg øvelse"><span>Øv regneart</span><button type="button" data-fa-mode="mixed" aria-pressed="false">Blandede opgaver</button><button type="button" data-fa-mode="division" aria-pressed="true">: Division</button><button type="button" data-fa-mode="plus" aria-pressed="false">+ Plus</button><button type="button" data-fa-mode="minus" aria-pressed="false">− Minus</button><button type="button" data-fa-mode="multiply" aria-pressed="false">· Gange</button></div><div data-fa-lesson></div>';
    const nav=root.querySelector(".fa-mode-nav"),content=root.querySelector("[data-fa-lesson]");
    const modes=["division","plus","minus","multiply"];
    let mode="division",disposed=false,cleanup=()=>{},bag=[],lastMixed="",mixedCompleted=0;
    function nextMixedMode() {
      if(!bag.length) {
        bag=[...modes];
        for(let i=bag.length-1;i>0;i--) {
          const j=Math.floor(Math.random()*(i+1));
          [bag[i],bag[j]]=[bag[j],bag[i]];
        }
        if(bag[0]===lastMixed) [bag[0],bag[1]]=[bag[1],bag[0]];
      }
      return lastMixed=bag.shift();
    }
    function showLesson() {
      cleanup();
      content.innerHTML="";
      const selected=mode==="mixed" ? nextMixedMode() : mode;
      const config=mode==="mixed" ? {...options,mixed:true,startIndex:mixedCompleted+1,initialCompleted:mixedCompleted,
        onNext(count) {
          if(disposed || mode!=="mixed") return;
          mixedCompleted=count;showLesson();
          content.querySelector("#fl-question")?.focus({preventScroll:true});
        }
      } : options;
      cleanup=["division","multiply"].includes(selected) ? division.mount(content,{...config,operation:selected}) : mount(content,{...config,op:selected==="plus" ? "+":"-"});
    }
    function change(event) {
      const button=event.target.closest("[data-fa-mode]");
      if(disposed || !button || !nav.contains(button) || ![...modes,"mixed"].includes(button.dataset.faMode) || button.dataset.faMode===mode) return;
      mode=button.dataset.faMode;
      bag=[];lastMixed="";mixedCompleted=0;
      nav.querySelectorAll("[data-fa-mode]").forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.faMode===mode)));
      showLesson();
    }
    showLesson();
    nav.addEventListener("click",change);
    return ()=>{if(disposed)return;disposed=true;cleanup();nav.removeEventListener("click",change);};
  }
  window.JacobFractionAddSubtract=Object.freeze({createProblem,plan,mount});
  window.JacobFractionLesson=Object.freeze({...division,mount:mountPractice});
})();
