/* Analog clock exercise: fill the missing parts of a Danish phrase. */
(() => {
  "use strict";
  const core = window.JacobClockCore;
  function clockSvg(task, help, settings = {}) {
    const hands=settings.hands || 'both', hours=hands!=='minute', minutes=hands!=='hour';
    const sectors=settings.sectors ?? (help && hands!=='hour' && task.type!=='whole');
    const targets=help && hands==='both' && task.type!=='whole';
    const point=(angle,radius)=>{const a=angle*Math.PI/180;return [200+Math.sin(a)*radius,200-Math.cos(a)*radius];};
    const guide=core.hourGuide(task),color=guide.side==='right'?'#c85540':guide.side==='left'?'#356bc3':'#6d43a4';
    const line=(angle,from,to,stroke,name)=>{const a=point(angle,from),b=point(angle,to);return `<line class="cl-guide-ray cl-${name}-ray" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${stroke}" stroke-width="2.5" stroke-dasharray="5 6" stroke-linecap="round"/>`;};
    const ticks=Array.from({length:60},(_,i)=>i).filter(i=>minutes||i%5===0).map(i=>{const a=point(i*6,i%5===0?155:162),b=point(i*6,170);return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#817493" stroke-width="${i%5===0?3:1.3}"/>`;}).join('');
    const numbers=hours?Array.from({length:12},(_,i)=>{const n=i+1,p=point(n*30,133);return `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="central" fill="#301946" font-size="27" font-weight="800">${n}</text>`;}).join(''):'';
    const minuteNumbers=sectors?Array.from({length:11},(_,i)=>i+1).filter(n=>hours||n!==6).map(n=>{const p=point(n*30,hours?187:174);return `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="central" fill="${n<=6?'#c85540':'#356bc3'}" font-size="${hours?13:22}" font-weight="800">${n<=6?n*5:60-n*5}</text>`;}).join(''):'';
    const halves=sectors?`<g class="cl-guide-sectors"><path class="cl-over-half" d="M200 -27 A227 227 0 0 1 200 427" fill="none" stroke="#c85540" stroke-width="${task.type==='over'?5:3}"/><path class="cl-to-half" d="M200 427 A227 227 0 0 1 200 -27" fill="none" stroke="#356bc3" stroke-width="${task.type==='to'?5:3}"/></g><path d="M200 200 L200 22 A178 178 0 0 1 200 378 Z" fill="#fff0e9"/><path d="M200 200 L200 378 A178 178 0 0 1 200 22 Z" fill="#eaf0ff"/>`:'';
    let guides='';
    if(targets){const start=point(guide.startAngle,212),end=point(guide.endAngle,212),chosen=point(guide.endAngle,133);guides=`<defs><marker id="cl-hour-guide-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>${line(task.minuteAngle,162,218,color,'minute')}${line(task.hourAngle,82,219,'#6d43a4','hour')}<path class="cl-hour-guide-arc" data-direction="${guide.direction}" data-target-hour="${guide.namedHour}" data-side="${guide.side}" d="M${start.join(' ')} A212 212 0 0 ${guide.direction==='before'?0:1} ${end.join(' ')}" fill="none" stroke="${color}" stroke-width="3" marker-end="url(#cl-hour-guide-arrow)"/>${line(guide.endAngle,157,202,color,'target')}<circle class="cl-hour-target" cx="${chosen[0]}" cy="${chosen[1]}" r="19" fill="${guide.side==='right'?'#ffddd5':guide.side==='left'?'#dfeaff':'#ede0ff'}" stroke="${color}" stroke-width="2.5"/>`;}
    else if(sectors && minutes)guides=line(task.minuteAngle,162,218,color,'minute');
    const hourHand=hours?`<g class="cl-hour-hand" transform="rotate(${task.hourAngle} 200 200)"><path d="M191 218 L191 155 L176 155 L200 120 L224 155 L209 155 L209 218 Z" fill="#6d43a4" stroke="#4c2a78" stroke-width="1.5" stroke-linejoin="round"/></g>`:'';
    const minuteHand=minutes?`<g class="cl-minute-hand" transform="rotate(${task.minuteAngle} 200 200)"><path d="M197.5 224 L197.5 65 L191 65 L200 40 L209 65 L202.5 65 L202.5 224 Z" fill="#117e79" stroke="#0b6460" stroke-width="1.3" stroke-linejoin="round"/></g>`:'';
    const description=hands==='hour'?'Ur med kun timeviser. Pilen peger direkte på et timetal.':hands==='minute'?'Ur med kun minutviser. De to halvcirkler viser minutter OVER og minutter I.':`Analogt ur med begge visere.${help?' '+guide.rule:''}`;
    return `<svg class="cl-clock" data-hands="${hands}" viewBox="-40 -40 480 480" role="img" aria-label="${description}"><circle cx="200" cy="200" r="195" fill="#fffaf0" stroke="#eec37b" stroke-width="8"/>${halves}${guides}${ticks}${numbers}${minuteNumbers}${hourHand}${minuteHand}<circle cx="200" cy="200" r="11" fill="#301946"/><circle cx="200" cy="200" r="4" fill="#efbd69"/></svg>`;
  }
  function mountPractice(root, options = {}) {
    let mode="minutes", type="mixed", step=5, deck=[], task=null, previous=null, answers={}, active="minutes", help=true, solved=0, firstCorrect=0, failed=false, firstAnswers=null, busy=false, done=false, disposed=false, started=0;
    root.innerHTML=`<section class="cl-module"><header class="cl-header"><div><span class="cl-eyebrow">LÆR KLOKKEN</span><h1>Hvad er klokken?</h1><p>Læs uret. Gør sætningen færdig.</p></div><button type="button" class="cl-button cl-quiet" data-cl="exit">← Tilbage</button></header><div class="cl-controls"><label>Udfyld<select data-cl-setting="mode"><option value="minutes">Minutter</option><option value="hour">Timetal</option><option value="both">Minutter og timetal</option></select></label><label>Træn<select data-cl-setting="type"><option value="mixed">Alle vendinger</option><option value="whole">Hele timer</option><option value="over">Minutter over</option><option value="to">Minutter i</option><option value="half">Halv</option><option value="quarter-over">Kvart over</option><option value="quarter-to">Kvart i</option></select></label><label>Minutter<select data-cl-setting="step"><option value="5">5 ad gangen</option><option value="1">1 ad gangen</option></select></label></div><div class="cl-progress" aria-live="polite"></div><div class="cl-play"><div class="cl-dial"><div class="cl-svg"></div><div class="cl-legend"><span><i class="cl-minute-dot"></i>Lang, smal viser · minutter</span><span><i class="cl-hour-dot"></i>Kort, bred viser · timer</span></div><button type="button" class="cl-button cl-quiet" data-cl="help" aria-pressed="false">Vis hjælp</button><p class="cl-hint" hidden></p></div><div class="cl-answer"><span class="cl-eyebrow">KLOKKEN ER</span><div class="cl-sentence" aria-label="Udfyld de manglende tal"></div><p class="cl-instruction"></p><div class="cl-keypad" aria-label="Taltastatur">${[1,2,3,4,5,6,7,8,9,"clear",0,"back"].map(k=>`<button type="button" data-cl-key="${k}" aria-label="${k==='clear'?'Ryd felt':k==='back'?'Slet sidste ciffer':k}">${k==='clear'?'C':k==='back'?'⌫':k}</button>`).join("")}</div><button type="button" class="cl-button cl-check" data-cl="check">Tjek svar</button><p class="cl-feedback" role="status" aria-live="polite"></p></div></div><div class="cl-finish" hidden></div></section>`;
    const q = selector => root.querySelector(selector);
    const needed = () => core.fields(task, mode);
    function progress() { q('.cl-progress').textContent=`${'★'.repeat(solved)}${'☆'.repeat(10-solved)} · ${solved} af 10 ure`; }
    function sentence() {
      const ns=needed();
      const field=(key,value)=>ns.includes(key)?`<button type="button" class="cl-blank ${active===key?'is-active':''}" data-cl-field="${key}" aria-label="${key==='minutes'?'Minutter':'Timetal'}: ${answers[key]||'tomt felt'}" aria-pressed="${active===key}">${answers[key]||'?'}</button>`:String(value);
      q('.cl-sentence').innerHTML=['over','to'].includes(task.type)?`${field('minutes',task.count)} <span>${task.count===1?'minut':'minutter'} ${task.type==='over'?'over':'i'}</span> ${field('hour',task.namedHour)}`:`<span>${task.prefix}</span> ${field('hour',task.namedHour)}`;
    }
    q('.cl-svg').insertAdjacentHTML('afterend','<div class="cl-direction"><div class="cl-side-key"><span class="cl-side-to">Venstre: I</span><span class="cl-side-over">Højre: OVER</span></div><strong class="cl-direction-title"></strong><p class="cl-direction-rule"></p></div>');
    function drawHelp() {
      const guide=core.hourGuide(task);
      q('.cl-svg').innerHTML=clockSvg(task,help);
      q('.cl-direction').hidden=!help;
      q('.cl-direction').dataset.side=guide.side;
      q('.cl-direction-title').textContent=guide.label;
      q('.cl-direction-rule').textContent=guide.rule;
      q('.cl-hint').hidden=!help||(!failed&&!done);
      q('.cl-hint').textContent=core.explain(task);
      q('[data-cl="help"]').textContent=help?'Skjul hjælpelinjer':'Vis hjælpelinjer';
      q('[data-cl="help"]').setAttribute('aria-pressed',String(help));
    }
    function next() {
      if (!deck.length) deck=core.makeDeck(type,step);
      task=deck.pop();
      if(previous===`${task.hour}:${task.minute}` && deck.length) { deck.unshift(task); task=deck.pop(); }
      previous=`${task.hour}:${task.minute}`; answers={minutes:'',hour:''}; active=needed()[0]; failed=false; firstAnswers=null; done=false; started=Date.now();
      q('.cl-feedback').textContent=''; q('.cl-feedback').className='cl-feedback'; q('[data-cl="check"]').textContent='Tjek svar'; q('[data-cl="check"]').disabled=false;
      q('.cl-instruction').textContent=needed().length===2?'Udfyld begge felter. Tryk på det felt, du vil skrive i.':needed()[0]==='minutes'?'Hvor mange minutter?':'Hvilket timetal siger vi?';
      q('.cl-keypad').hidden=false; sentence(); drawHelp(); progress();
    }
    function reset() { deck=[]; solved=0; firstCorrect=0; q('.cl-play').hidden=false; q('.cl-finish').hidden=true; next(); }
    function feedback(text, good=false) { q('.cl-feedback').textContent=text; q('.cl-feedback').className=`cl-feedback ${good?'is-good':'is-wrong'}`; }
    function key(k) {
      if(busy||done)return;
      if(k==='clear')answers[active]=''; else if(k==='back')answers[active]=answers[active].slice(0,-1); else if(/^\d$/.test(k)&&answers[active].length<2)answers[active]+=k;
      sentence();
    }
    function setBusy(value) { busy=value; root.querySelectorAll('select, [data-cl-key], [data-cl-field], [data-cl="check"]').forEach(el=>{el.disabled=value;}); }
    async function check() {
      if(disposed||busy)return;
      if(done) { if(solved===10) {q('.cl-play').hidden=true;q('.cl-finish').hidden=false;q('.cl-finish').innerHTML=`<span class="cl-finish-stars">★★★</span><h2>Du har læst 10 ure!</h2><p>${firstCorrect} rigtige i første forsøg. Godt arbejdet!</p><button type="button" class="cl-button" data-cl="restart">Øv 10 nye ure</button>`;}else next();return; }
      const result=core.validate(task,mode,answers);
      if(result.missing.length) {active=result.missing[0];sentence();feedback('Udfyld det tomme felt først.');return;}
      if(!firstAnswers)firstAnswers={...answers};
      if(!result.correct) {failed=true;active=result.wrong[0];help=true;drawHelp();sentence();feedback(result.wrong.includes('minutes')?'Kig på den lange viser. Prøv minut-feltet igen.':'Kig på den korte viser. Ved “i” og “halv” bruger vi den kommende time.');return;}
      setBusy(true);
      const first=core.validate(task,mode,firstAnswers);
      const record={topic:'clock',problem:`Hvad er klokken? (${task.hour}:${String(task.minute).padStart(2,'0')}; ${task.type}; ${mode})`,answer:needed().map(k=>Number(firstAnswers[k])).join(' / '),correctAnswer:needed().map(k=>result.expected[k]).join(' / '),correct:!failed,responseTime:(Date.now()-started)/1000,timestamp:new Date().toISOString()};
      try {await options.onResult?.(record);}catch(error){if(!disposed){setBusy(false);feedback('Svaret kunne ikke gemmes. Tryk Tjek svar for at prøve igen.');}return;}
      if(disposed)return;
      setBusy(false);done=true;solved++;if(first.correct&&!failed)firstCorrect++;help=true;drawHelp();progress();q('.cl-keypad').hidden=true;
      root.querySelectorAll('[data-cl-field]').forEach(el=>{el.disabled=true;});feedback(`Rigtigt! Klokken er ${task.phrase}.`,true);q('[data-cl="check"]').textContent=solved===10?'Se din runde':'Næste ur';q('[data-cl="check"]').focus({preventScroll:true});
    }
    function click(event) {
      const button=event.target.closest('button');if(!button||!root.contains(button))return;
      if(button.dataset.clKey!==undefined)key(button.dataset.clKey);
      if(button.dataset.clField&&!busy&&!done){active=button.dataset.clField;sentence();}
      if(button.dataset.cl==='exit')options.onExit?.();
      if(button.dataset.cl==='help'){help=!help;drawHelp();}
      if(button.dataset.cl==='check')void check();
      if(button.dataset.cl==='restart'&&!busy)reset();
    }
    function change(event) { if(busy)return;const setting=event.target.dataset.clSetting;if(setting==='mode')mode=event.target.value;if(setting==='type')type=event.target.value;if(setting==='step')step=Number(event.target.value);if(setting)reset(); }
    function keyboard(event) {
      if(disposed||event.ctrlKey||event.metaKey||event.altKey||event.target.tagName==='SELECT')return;
      if(event.target.closest('[data-cl="exit"], [data-cl="help"], [data-cl="restart"]'))return;
      if(/^\d$/.test(event.key)){event.preventDefault();event.stopPropagation();key(event.key);}
      else if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();event.stopPropagation();key(event.key==='Backspace'?'back':'clear');}
      else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();void check();}
      else if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();if(!busy&&!done){active=needed()[(needed().indexOf(active)+1)%needed().length];sentence();}}
    }
    root.addEventListener('click',click);root.addEventListener('change',change);document.addEventListener('keydown',keyboard,true);reset();
    return () => {disposed=true;root.removeEventListener('click',click);root.removeEventListener('change',change);document.removeEventListener('keydown',keyboard,true);};
  }
  function mount(root,options={}) {
    let disposeChild=null,disposed=false;
    function course(){if(disposed)return;disposeChild?.();disposeChild=window.JacobClockCourse.mount(root,{...options,onPractice:practice});}
    function practice(){if(disposed)return;disposeChild?.();disposeChild=mountPractice(root,{...options,onExit:course});}
    course();
    return ()=>{disposed=true;disposeChild?.();disposeChild=null;};
  }
  window.JacobClock=Object.freeze({mount,clockSvg});
})();
