/* Luigi's clock course: isolate each hand before combining time language. */
(() => {
  'use strict';
  const core=window.JacobClockCore;
  const chapters=['Timeviseren','Minutviseren','Begge visere','Hele timer'];
  const luigi='assets/figurer/luigi-laekkermat-cutout.webp';
  function mount(root,options={}) {
    const counts=core.LESSONS.map(lesson=>Math.min(10,(options.user?.results||[]).filter(r=>r.topic==='clock'&&String(r.problem).startsWith(`Urkursus [${lesson.id}] `)).length));
    let stageIndex=counts.findIndex(n=>n<10),phase='intro',task=null,taskMode='hour',deck=[],previous='',answers={},active='hour',failed=false,firstAnswers=null,done=false,busy=false,disposed=false,help=true,started=0;
    if(stageIndex<0){stageIndex=core.LESSONS.length-1;phase='finish';}
    const stage=()=>core.LESSONS[stageIndex];
    const mode=()=>taskMode;
    const needed=()=>core.fields(task,mode());
    const q=s=>root.querySelector(s);
    const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function header(){return `<header class="cl-header"><div><span class="cl-eyebrow">LÆR KLOKKEN MED LUIGI</span><h1>${phase==='finish'?'Du kan aflæse uret!':escape(stage().title)}</h1><p>Én ting ad gangen. Først hver viser for sig.</p></div><div class="cl-course-actions"><button type="button" class="cl-button cl-quiet" data-course="practice">Fri træning</button><button type="button" class="cl-button cl-quiet" data-course="exit">← Tilbage</button></div></header><ol class="cl-chapters" aria-label="Kursets fire dele">${chapters.map((title,i)=>`<li class="${phase==='finish'||stage().chapter>i+1?'is-complete':stage().chapter===i+1?'is-current':''}" ${stage().chapter===i+1&&phase!=='finish'?'aria-current="step"':''}><span>${i+1}</span>${title}</li>`).join('')}</ol>`;}
    function coach(paragraphs,small=false){return `<aside class="cl-coach ${small?'cl-coach-small':''}" aria-label="Luigi Lækkermat forklarer"><img src="${luigi}" alt="Luigi Lækkermat" width="120" height="144"><div><strong>Luigi Lækkermat</strong>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</div></aside>`;}
    function halves(){return stage().type==='whole'?'':`<div class="cl-halves" aria-label="De to måder at sige minutter"><span class="cl-side-to ${stage().type==='to'?'is-active':''}">Minutter I</span><span class="cl-side-over ${stage().type==='over'?'is-active':''}">Minutter OVER</span></div>`;}
    function svg(t){return window.JacobClock.clockSvg(t,stage().hands==='both'&&stage().type!=='whole'&&help,{hands:stage().hands,sectors:stage().type!=='whole'});}
    function renderIntro(){
      const example=core.describe(stage().hands==='minute'?12:stage().id==='hours'?8:stage().id==='whole'?6:3,stage().type==='whole'?0:stage().type==='over'?20:40,stage().type);
      root.innerHTML=`<section class="cl-module cl-course" data-lesson="${stage().id}" data-phase="intro">${header()}<div class="cl-course-intro"><div class="cl-dial">${halves()}${svg(example)}<p class="cl-intro-caption">${stage().hands==='hour'?'Kun den lille timeviser':stage().hands==='minute'?'Kun den store minutviser':stage().type==='whole'?'Stor viser opad · lille viser på timen':'Nu bruger vi begge visere'}</p></div><div>${coach(stage().intro)}<p class="cl-course-goal">${10-counts[stageIndex]} korrekte svar ${counts[stageIndex]?'tilbage i denne del':'i denne del'}. Du kan rette et forkert svar.</p><button type="button" class="cl-button cl-course-start" data-course="start">${counts[stageIndex]?'Fortsæt øvelsen':'Start øvelsen'} →</button></div></div></section>`;
    }
    function renderFinish(){root.innerHTML=`<section class="cl-module cl-course" data-phase="finish">${header()}<div class="cl-course-finish"><span class="cl-finish-stars">★★★</span>${coach(['Du har lært timeviseren og minutviseren hver for sig. Du har øvet minutter OVER og minutter I, sat viserne sammen og lært hele timer.','Nu kan du øve videre i fri træning. Her finder du også halv og kvart.'])}<div class="cl-course-actions"><button type="button" class="cl-button" data-course="practice">Gå til fri træning</button><button type="button" class="cl-button cl-quiet" data-course="restart">Begynd kurset forfra</button></div></div></section>`;}
    function sentence(){
      const ns=needed();
      const field=(key,value)=>ns.includes(key)?`<button type="button" class="cl-blank ${active===key?'is-active':''}" data-course-field="${key}" aria-pressed="${active===key}" aria-label="${key==='hour'?'Timetal':'Minutter'}: ${answers[key]||'tomt felt'}" ${busy||done?'disabled':''}>${answers[key]||'?'}</button>`:String(value);
      q('.cl-sentence').innerHTML=stage().hands==='hour'||stage().type==='whole'?field('hour',task.hour):stage().hands==='minute'?`${field('minutes',task.count)} <span>minutter ${stage().type==='over'?'over':'i'}</span>`:`${field('minutes',task.count)} <span>minutter ${stage().type==='over'?'over':'i'}</span> ${field('hour',task.namedHour)}`;
    }
    function progress(){q('.cl-progress').textContent=`${'★'.repeat(counts[stageIndex])}${'☆'.repeat(10-counts[stageIndex])} · ${counts[stageIndex]} af 10 korrekte`;}
    function draw(){
      q('.cl-svg').innerHTML=svg(task);
      const guide=q('.cl-course-guide');
      if(guide){guide.hidden=!help;guide.textContent=core.hourGuide(task).rule;}
      const toggle=q('[data-course="help"]');if(toggle){toggle.textContent=help?'Skjul hjælpelinjer':'Vis hjælpelinjer';toggle.setAttribute('aria-pressed',String(help));}
      sentence();progress();
    }
    function renderTask(){
      const words=stage().hands==='hour'?'TIMEVISEREN PEGER PÅ':stage().hands==='minute'?'DEN STORE VISER VISER':'KLOKKEN ER';
      const explanation=stage().hands==='hour'?'Den lille viser er en pil. Læs tallet ved spidsen.':stage().hands==='minute'?stage().type==='over'?'Brug den røde OVER-halvcirkel. Tæl fra toppen med uret.':'Brug den blå I-halvcirkel. Tæl fra viseren frem mod toppen.':stage().type==='whole'?'Den store viser står på 12. Sig bare det tal, den lille viser peger på.':core.hourGuide(task).rule;
      root.innerHTML=`<section class="cl-module cl-course" data-lesson="${stage().id}" data-phase="exercise">${header()}<h2 class="cl-course-question">${stage().prompt}</h2><div class="cl-progress" aria-live="polite"></div><div class="cl-play"><div class="cl-dial">${halves()}<div class="cl-svg"></div><div class="cl-legend">${stage().hands!=='minute'?'<span><i class="cl-hour-dot"></i>Lille pil · timeviser</span>':''}${stage().hands!=='hour'?'<span><i class="cl-minute-dot"></i>Stor pil · minutviser</span>':''}</div>${stage().hands==='both'&&stage().type!=='whole'?'<button type="button" class="cl-button cl-quiet" data-course="help" aria-pressed="true">Skjul hjælpelinjer</button><p class="cl-course-guide"></p>':''}${coach([explanation],true)}</div><div class="cl-answer"><span class="cl-eyebrow">${words}</span><div class="cl-sentence"></div><p class="cl-instruction">${needed().length===2?'Udfyld både minutter og timetal.':needed()[0]==='minutes'?'Skriv antallet af minutter.':'Skriv timetallet.'}</p><div class="cl-keypad">${[1,2,3,4,5,6,7,8,9,'clear',0,'back'].map(k=>`<button type="button" data-course-key="${k}" aria-label="${k==='clear'?'Ryd felt':k==='back'?'Slet sidste ciffer':k}">${k==='clear'?'C':k==='back'?'⌫':k}</button>`).join('')}</div><button type="button" class="cl-button cl-check" data-course="check">Tjek svar</button><p class="cl-feedback" role="status" aria-live="polite"></p></div></div></section>`;
      draw();
    }
    function next(){
      if(!deck.length)deck=core.lessonDeck(stage().id);
      task=deck.pop();
      const signature=t=>stage().hands==='minute'?String(t.minute):`${t.hour}:${t.minute}`;
      if(signature(task)===previous&&deck.length){deck.unshift(task);task=deck.pop();}
      previous=signature(task);taskMode=core.lessonMode(stage().id,counts[stageIndex]);answers={hour:'',minutes:''};active=needed()[0];failed=false;firstAnswers=null;done=false;started=Date.now();phase='exercise';renderTask();
    }
    function feedback(message,good=false){q('.cl-feedback').textContent=message;q('.cl-feedback').className=`cl-feedback ${good?'is-good':'is-wrong'}`;}
    function key(k){if(busy||done||phase!=='exercise')return;if(k==='clear')answers[active]='';else if(k==='back')answers[active]=answers[active].slice(0,-1);else if(/^\d$/.test(k)&&answers[active].length<2)answers[active]+=k;sentence();}
    function lock(value){busy=value;root.querySelectorAll('[data-course-key],[data-course-field],[data-course="check"]').forEach(el=>{el.disabled=value;});}
    async function check(){
      if(disposed||busy||phase!=='exercise')return;
      if(done){if(counts[stageIndex]>=10){stageIndex++;deck=[];previous='';if(stageIndex>=core.LESSONS.length){stageIndex=core.LESSONS.length-1;phase='finish';renderFinish();}else{phase='intro';renderIntro();}}else next();return;}
      const result=core.validate(task,mode(),answers);
      if(result.missing.length){active=result.missing[0];sentence();feedback('Udfyld det tomme felt først.');return;}
      if(!firstAnswers)firstAnswers={...answers};
      if(!result.correct){failed=true;active=result.wrong[0];help=true;draw();feedback(result.wrong.includes('minutes')?stage().type==='over'?'Start ved toppen. Tæl med uret i den røde halvcirkel. Prøv igen.':'Tæl fra den store viser frem mod toppen i den blå halvcirkel. Prøv igen.':stage().hands==='hour'||stage().type==='whole'?'Følg den lille pils spids til timetallet. Prøv igen.':core.hourGuide(task).rule);return;}
      const usedMode=mode(),keys=needed();
      const record={topic:'clock',problem:`Urkursus [${stage().id}] ${task.hour}:${String(task.minute).padStart(2,'0')} (${usedMode})`,answer:keys.map(k=>Number(firstAnswers[k])).join(' / '),correctAnswer:keys.map(k=>result.expected[k]).join(' / '),correct:!failed,responseTime:(Date.now()-started)/1000,timestamp:new Date().toISOString()};
      lock(true);
      try{await options.onResult?.(record);}catch(error){if(!disposed){lock(false);feedback('Svaret kunne ikke gemmes. Tryk Tjek svar for at prøve igen.');}return;}
      if(disposed)return;
      lock(false);done=true;counts[stageIndex]++;sentence();progress();q('.cl-keypad').hidden=true;
      const phrase=stage().hands==='hour'?`Pilen peger på ${task.hour}.`:stage().hands==='minute'?`${task.count} minutter ${stage().type==='over'?'over':'i'}.`:`Klokken er ${task.phrase}.`;
      feedback(`Rigtigt! ${phrase}`,true);q('[data-course="check"]').textContent=counts[stageIndex]>=10?'Videre til næste del →':'Næste ur';q('[data-course="check"]').focus({preventScroll:true});
    }
    function click(event){
      const button=event.target.closest('button');if(!button||!root.contains(button))return;
      if(button.dataset.courseKey!==undefined)key(button.dataset.courseKey);
      if(button.dataset.courseField&&!busy&&!done){active=button.dataset.courseField;sentence();}
      const action=button.dataset.course;
      if(action==='exit')options.onExit?.();
      if(action==='practice')options.onPractice?.();
      if(action==='start'&&phase==='intro')next();
      if(action==='check')void check();
      if(action==='help'&&!busy){help=!help;draw();}
      if(action==='restart'){counts.fill(0);stageIndex=0;phase='intro';deck=[];previous='';renderIntro();}
    }
    function keyboard(event){
      if(disposed||phase!=='exercise'||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('[data-course="exit"],[data-course="practice"],[data-course="help"]'))return;
      if(/^\d$/.test(event.key)){event.preventDefault();event.stopPropagation();key(event.key);}
      else if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();event.stopPropagation();key(event.key==='Backspace'?'back':'clear');}
      else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();void check();}
      else if((event.key==='ArrowRight'||event.key==='ArrowLeft')&&!done&&!busy){event.preventDefault();active=needed()[(needed().indexOf(active)+1)%needed().length];sentence();}
    }
    root.addEventListener('click',click);document.addEventListener('keydown',keyboard,true);
    if(phase==='finish')renderFinish();else renderIntro();
    return ()=>{disposed=true;root.removeEventListener('click',click);document.removeEventListener('keydown',keyboard,true);};
  }
  window.JacobClockCourse=Object.freeze({mount});
})();
