/* Luigi's clock course: isolate each hand before combining time language. */
(() => {
  'use strict';
  const core=window.JacobClockCore;
  const chapters=['Timeviseren','Minutviseren','Begge visere','Hele timer'];
  const luigi='assets/figurer/luigi-laekkermat-cutout.webp';
  function mount(root,options={}) {
    const counts=core.LESSONS.map(lesson=>Math.min(10,(options.user?.results||[]).filter(r=>r.topic==='clock'&&String(r.problem).startsWith(`Urkursus [${lesson.id}] `)).length));
    let stageIndex=counts.findIndex(n=>n<10),phase='intro',task=null,taskMode='hour',deck=[],previous='',answers={},active='hour',failed=false,firstAnswers=null,done=false,busy=false,disposed=false,help=true,started=0;
    let exploration=null,dragPointer=null;
    const savedLessons=new Map();
    if(stageIndex<0){stageIndex=core.LESSONS.length-1;phase='finish';}
    const stage=()=>core.LESSONS[stageIndex];
    const mode=()=>taskMode;
    const needed=()=>core.fields(task,mode());
    const q=s=>root.querySelector(s);
    const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function header(){return `<header class="cl-header"><div><span class="cl-eyebrow">LÆR KLOKKEN MED LUIGI</span><h1>${phase==='finish'?'Du kan aflæse uret!':phase==='explore'?'Prøv selv: OVER eller I?':escape(stage().title)}</h1><p>Én ting ad gangen. Først hver viser for sig.</p></div><div class="cl-course-toolbar"><nav class="cl-course-nav" aria-label="Skift øvelse"><button type="button" class="cl-button" data-course="previous" aria-label="Forrige øvelse" ${busy||stageIndex===0&&phase!=='finish'?'disabled':''}>← Tilbage</button><button type="button" class="cl-button" data-course="forward" aria-label="Næste øvelse" ${busy||stageIndex===core.LESSONS.length-1?'disabled':''}>Frem →</button></nav><div class="cl-course-actions"><button type="button" class="cl-button cl-quiet" data-course="practice">Fri træning</button><button type="button" class="cl-button cl-quiet" data-course="exit">Til oversigten</button></div></div></header><ol class="cl-chapters" aria-label="Kursets fire dele">${chapters.map((title,i)=>`<li class="${core.LESSONS.every((lesson,j)=>lesson.chapter!==i+1||counts[j]>=10)?'is-complete':stage().chapter===i+1?'is-current':''}" ${stage().chapter===i+1&&phase!=='finish'?'aria-current="step"':''}><span>${i+1}</span>${title}</li>`).join('')}</ol>`;}
    function coach(paragraphs,small=false){return `<aside class="cl-coach ${small?'cl-coach-small':''}" aria-label="Luigi Lækkermat forklarer"><img src="${luigi}" alt="Luigi Lækkermat" width="120" height="144"><div><strong>Luigi Lækkermat</strong>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</div></aside>`;}
    function halves(){return stage().type==='whole'?'':`<div class="cl-halves" aria-label="De to måder at sige minutter"><span class="cl-side-to ${stage().type==='to'?'is-active':''}">Minutter I</span><span class="cl-side-over ${stage().type==='over'?'is-active':''}">Minutter OVER</span></div>`;}
    function svg(t){return window.JacobClock.clockSvg(t,stage().hands==='both'&&stage().type!=='whole'&&help,{hands:stage().hands,sectors:stage().type!=='whole'});}
    function renderIntro(){
      const example=core.describe(stage().hands==='minute'?12:stage().id==='hours'?8:stage().id==='whole'?6:3,stage().type==='whole'?0:stage().type==='over'?20:40,stage().type);
      root.innerHTML=`<section class="cl-module cl-course" data-lesson="${stage().id}" data-phase="intro">${header()}<div class="cl-course-intro"><div class="cl-dial">${halves()}${svg(example)}<p class="cl-intro-caption">${stage().hands==='hour'?'Kun den lille timeviser':stage().hands==='minute'?'Kun den store minutviser':stage().type==='whole'?'Stor viser opad · lille viser på timen':'Nu bruger vi begge visere'}</p></div><div>${coach(stage().intro)}<p class="cl-course-goal">${counts[stageIndex]===10?'Du har klaret denne del. Du kan øve den igen.':`${10-counts[stageIndex]} korrekte svar ${counts[stageIndex]?'tilbage i denne del':'i denne del'}. Du kan rette et forkert svar.`}</p><button type="button" class="cl-button cl-course-start" data-course="start">${counts[stageIndex]===10?'Øv igen':counts[stageIndex]?'Fortsæt øvelsen':'Start øvelsen'} →</button></div></div></section>`;
    }
    function beginExploration(resume=false){
      phase='explore';if(!resume||!exploration)exploration={index:0,angle:120,turns:0,side:'over'};
      const example=core.describe(3,20,'over');
      root.innerHTML=`<section class="cl-module cl-course cl-explore" data-lesson="both-over" data-phase="explore">${header()}<div class="cl-course-intro"><div class="cl-dial"><div class="cl-halves" aria-label="De to måder at sige minutter"><span class="cl-side-to">Minutter I</span><span class="cl-side-over is-active">Minutter OVER</span></div><div class="cl-interactive-dial"><div class="cl-drag-tip" id="cl-minute-drag-tip"><svg class="cl-drag-tip-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5a2 2 0 0 1 4 0v7m0-4a2 2 0 0 1 4 0v5m0-3a2 2 0 0 1 4 0v5c0 4-2.5 6-6 6h-1c-2 0-3.3-.8-4.5-2.5L4 13a2 2 0 0 1 3-2l1 2"/></svg><span>Grib og flyt minutviseren</span></div>${window.JacobClock.clockSvg(example,false,{hands:'both',sectors:true,draggableMinute:true})}</div><p class="cl-intro-caption">Du kan også bruge piletasterne.</p></div><div>${coach(['',''])}<div class="cl-explore-card"><p class="cl-explore-round"></p><strong class="cl-explore-choice"></strong><p class="cl-explore-progress"></p><p class="cl-explore-status" role="status" aria-live="polite"></p></div><div class="cl-course-actions"><button type="button" class="cl-button cl-quiet" data-course="explore-hour">Prøv mellem 10 og 11</button><button type="button" class="cl-button cl-course-start" data-course="explore-next">Start opgaverne →</button></div></div></div></section>`;
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('class','cl-explore-hour-ring');circle.setAttribute('r','23');circle.setAttribute('fill','none');circle.setAttribute('stroke-width','4');
      q('.cl-clock').insertBefore(circle,q('[data-clock-hour]'));
      q('.cl-minute-ray')?.remove();
      q('.cl-hour-hand').style.transformOrigin='200px 200px';
      q('[data-clock-drag]').setAttribute('aria-describedby','cl-minute-drag-tip');
      updateExploration();
    }
    function updateExploration(){
      const e=exploration,baseHour=e.index===0?3:10;
      const hour=((baseHour+e.turns-1)%12+12)%12+1,nextHour=hour===12?1:hour+1,namedHour=e.side==='over'?hour:nextHour;
      const color=e.side==='over'?'#c85540':'#356bc3',number=q(`[data-clock-hour="${namedHour}"]`),ring=q('.cl-explore-hour-ring');
      ring.setAttribute('cx',number.getAttribute('x'));ring.setAttribute('cy',number.getAttribute('y'));ring.setAttribute('stroke',color);ring.dataset.highlightHour=String(namedHour);
      const hand=q('[data-clock-drag]');hand.setAttribute('transform',`rotate(${e.turns*360+e.angle} 200 200)`);hand.setAttribute('aria-valuenow',String(Math.round(e.angle)%360));hand.setAttribute('aria-valuetext',`Minutter ${e.side==='over'?'OVER':'I'}: vi siger ${namedHour}.`);
      q('.cl-hour-hand').style.transform=`rotate(${(baseHour+e.turns)*30+e.angle/12}deg)`;
      q('.cl-explore').dataset.hour=String(hour);q('.cl-explore').dataset.side=e.side;
      q('.cl-side-over').classList.toggle('is-active',e.side==='over');q('.cl-side-to').classList.toggle('is-active',e.side==='to');
      const paragraphs=root.querySelectorAll('.cl-coach p');
      paragraphs[0].textContent=`Den lille viser står mellem ${hour} og ${nextHour}. På den røde OVER-side siger vi ${hour}. På den blå I-side siger vi ${nextHour}. Se cirklen om tallet!`;
      paragraphs[1].textContent='Grib den lange viser. Drej den rundt, og udforsk alle 12 timer! Den lille viser følger med. Du kan dreje både frem og tilbage, så længe du vil. Tryk på Start opgaverne, når du er klar.';
      q('.cl-explore-round').textContent='Fri øvelse · udforsk alle 12 timer';
      q('.cl-explore-choice').textContent=`Minutter ${e.side==='over'?'OVER':'I'} → ${namedHour}`;
      q('.cl-explore-progress').textContent='Øv dig så længe, du vil.';
      const message=e.side==='to'?'På den blå side siger vi den næste time. Prøv at føre viseren tilbage.':'På den røde side siger vi den time, den lille viser har passeret.';
      if(q('.cl-explore-status').textContent!==message)q('.cl-explore-status').textContent=message;
      q('[data-course="explore-hour"]').textContent=e.index===0?'Begynd ved 10':'Begynd ved 3';
      positionDragTip();
    }
    function positionDragTip(){
      if(disposed||phase!=='explore')return;
      const dial=q('.cl-interactive-dial'),bubble=q('.cl-drag-tip'),svg=q('.cl-clock'),shape=q('.cl-minute-hand path:not(.cl-minute-grip)');
      if(!dial||!bubble||!svg||!shape)return;
      const parent=dial.getBoundingClientRect(),clock=svg.getBoundingClientRect(),view=svg.viewBox.baseVal;
      if(!parent.width||!parent.height)return;
      const radius=200-shape.getBBox().y,angle=exploration.angle*Math.PI/180;
      const x=clock.left-parent.left+(200+Math.sin(angle)*radius-view.x)*clock.width/view.width;
      const y=clock.top-parent.top+(200-Math.cos(angle)*radius-view.y)*clock.height/view.height;
      bubble.classList.toggle('is-compact',parent.width<360);
      const width=bubble.offsetWidth,height=bubble.offsetHeight,below=y>=clock.top-parent.top+clock.height/2;
      const left=Math.max(8,Math.min(parent.width-width-8,x-width/2));
      const top=Math.max(8,Math.min(parent.height-height-8,below?y+12:y-height-12));
      bubble.dataset.placement=below?'below':'above';
      bubble.style.left=`clamp(8px, ${left}px, calc(100% - ${width}px - 8px))`;bubble.style.top=`${top}px`;
      bubble.style.setProperty('--cl-tip-arrow-x',`${Math.max(12,Math.min(width-12,x-left))}px`);
    }
    function moveExploration(angle){
      const e=exploration;if(phase!=='explore')return;
      q('.cl-explore').classList.remove('is-changing-hour');
      const nextAngle=(angle%360+360)%360,delta=nextAngle-e.angle;
      // Crossing 12 advances or reverses the hour instead of resetting it.
      if(delta < -180)e.turns++;else if(delta > 180)e.turns--;
      e.angle=nextAngle;e.side=e.angle<180?'over':'to';
      updateExploration();
    }
    function switchExplorationHour(){
      q('.cl-explore').classList.add('is-changing-hour');exploration.index=1-exploration.index;exploration.turns=0;
      updateExploration();
    }
    function pointerDown(event){
      if(phase!=='explore'||event.button!==0||dragPointer!==null)return;
      const hand=event.target.closest('[data-clock-drag]');if(!hand||!root.contains(hand))return;
      event.preventDefault();dragPointer=event.pointerId;hand.setPointerCapture(dragPointer);hand.focus({preventScroll:true});hand.classList.add('is-dragging');
    }
    function pointerMove(event){
      if(phase!=='explore'||event.pointerId!==dragPointer)return;
      const svg=q('.cl-clock'),matrix=svg.getScreenCTM();if(!matrix)return;
      const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const local=p.matrixTransform(matrix.inverse());
      const dx=local.x-200,dy=local.y-200;if(Math.hypot(dx,dy)<40)return;
      event.preventDefault();moveExploration(Math.atan2(dx,-dy)*180/Math.PI);
    }
    function pointerEnd(event){
      if(disposed||event.pointerId!==dragPointer)return;
      const hand=q('[data-clock-drag]');dragPointer=null;hand?.classList.remove('is-dragging');
      if(hand?.hasPointerCapture(event.pointerId))hand.releasePointerCapture(event.pointerId);
    }
    function navigateLesson(direction){
      if(disposed||busy)return;
      const destination=phase==='finish'&&direction<0?stageIndex:stageIndex+direction;
      if(destination<0||destination>=core.LESSONS.length)return;
      if(phase!=='finish')savedLessons.set(stageIndex,{phase,task,taskMode,deck:[...deck],previous,answers:{...answers},active,failed,firstAnswers:firstAnswers&&{...firstAnswers},done,help,elapsed:Date.now()-started,exploration:exploration&&{...exploration},feedback:q('.cl-feedback')?.textContent,feedbackClass:q('.cl-feedback')?.className,checkText:q('[data-course="check"]')?.textContent});
      if(dragPointer!==null)pointerEnd({pointerId:dragPointer});
      stageIndex=destination;
      const saved=savedLessons.get(stageIndex);
      if(!saved){phase='intro';task=null;deck=[];previous='';answers={};done=false;help=true;renderIntro();}
      else{
        ({phase,task,taskMode,previous,active,failed,done,help}=saved);deck=[...saved.deck];answers={...saved.answers};firstAnswers=saved.firstAnswers&&{...saved.firstAnswers};exploration=saved.exploration&&{...saved.exploration};started=Date.now()-saved.elapsed;
        if(phase==='explore')beginExploration(true);
        else if(phase==='intro')renderIntro();
        else{renderTask();q('.cl-feedback').textContent=saved.feedback;q('.cl-feedback').className=saved.feedbackClass;q('[data-course="check"]').textContent=saved.checkText;q('.cl-keypad').hidden=done;}
      }
      const focus=q(`[data-course="${direction<0?'previous':'forward'}"]`);
      (focus.disabled?q(`[data-course="${direction<0?'forward':'previous'}"]`):focus).focus({preventScroll:true});
    }
    function renderFinish(){root.innerHTML=`<section class="cl-module cl-course" data-phase="finish">${header()}<div class="cl-course-finish"><span class="cl-finish-stars">★★★</span>${coach(['Du har lært timeviseren og minutviseren hver for sig. Du har øvet minutter OVER og minutter I, sat viserne sammen og lært hele timer.','Nu kan du øve videre i fri træning. Her finder du også halv og kvart.'])}<div class="cl-course-actions"><button type="button" class="cl-button" data-course="practice">Gå til fri træning</button><button type="button" class="cl-button cl-quiet" data-course="restart">Begynd kurset forfra</button></div></div></section>`;}
    function sentence(){
      const ns=needed();
      const field=(key,value)=>ns.includes(key)?`<button type="button" class="cl-blank ${active===key?'is-active':''}" data-course-field="${key}" aria-pressed="${active===key}" aria-label="${key==='hour'?'Timetal':'Minutter'}: ${answers[key]||'tomt felt'}" ${busy||done?'disabled':''}>${answers[key]||'?'}</button>`:String(value);
      q('.cl-sentence').innerHTML=stage().hands==='hour'||stage().type==='whole'?field('hour',task.hour):stage().hands==='minute'?`${field('minutes',task.count)} <span>${task.count===1?'minut':'minutter'} ${stage().type==='over'?'over':'i'}</span>`:`${field('minutes',task.count)} <span>minutter ${stage().type==='over'?'over':'i'}</span> ${field('hour',task.namedHour)}`;
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
      const explanation=stage().hands==='hour'?'Den lille viser er en pil. Læs tallet ved spidsen.':stage().hands==='minute'?stage().type==='over'?'Brug den røde OVER-halvcirkel. Tæl fra toppen med uret.':'På den blå I-side tæller vi den MODSATTE vej af OVER-siden. Start ved toppen, og tæl ned langs den blå side, indtil du møder den store viser.':stage().type==='whole'?'Den store viser står på 12. Sig bare det tal, den lille viser peger på.':core.hourGuide(task).rule;
      const minuteDetail=stage().hands==='minute'&&counts[stageIndex]>=5?' Nu peger viseren mellem de store tal. Hver lille streg er 1 minut. Tæl stregerne med.':'';
      root.innerHTML=`<section class="cl-module cl-course" data-lesson="${stage().id}" data-phase="exercise">${header()}<h2 class="cl-course-question">${stage().prompt}</h2><div class="cl-progress" aria-live="polite"></div><div class="cl-play"><div class="cl-dial">${halves()}<div class="cl-svg"></div><div class="cl-legend">${stage().hands!=='minute'?'<span><i class="cl-hour-dot"></i>Kort pil · timeviser</span>':''}${stage().hands!=='hour'?'<span><i class="cl-minute-dot"></i>Lang pil · minutviser</span>':''}</div>${stage().hands==='both'&&stage().type!=='whole'?'<button type="button" class="cl-button cl-quiet" data-course="help" aria-pressed="true">Skjul hjælpelinjer</button><p class="cl-course-guide"></p>':''}${coach([explanation+minuteDetail],true)}</div><div class="cl-answer"><span class="cl-eyebrow">${words}</span><div class="cl-sentence"></div><p class="cl-instruction">${needed().length===2?'Udfyld både minutter og timetal.':needed()[0]==='minutes'?'Skriv antallet af minutter.':'Skriv timetallet.'}</p><div class="cl-keypad">${[1,2,3,4,5,6,7,8,9,'clear',0,'back'].map(k=>`<button type="button" data-course-key="${k}" aria-label="${k==='clear'?'Ryd felt':k==='back'?'Slet sidste ciffer':k}">${k==='clear'?'C':k==='back'?'⌫':k}</button>`).join('')}</div><button type="button" class="cl-button cl-check" data-course="check">Tjek svar</button><p class="cl-feedback" role="status" aria-live="polite"></p></div></div></section>`;
      draw();
    }
    function next(){
      if(stage().hands==='minute'&&counts[stageIndex]===5)deck=[];
      if(!deck.length)deck=core.lessonDeck(stage().id,Math.random,counts[stageIndex]);
      task=deck.pop();
      const signature=t=>stage().hands==='minute'?String(t.minute):`${t.hour}:${t.minute}`;
      if(signature(task)===previous&&deck.length){deck.unshift(task);task=deck.pop();}
      previous=signature(task);taskMode=core.lessonMode(stage().id,counts[stageIndex]);answers={hour:'',minutes:''};active=needed()[0];failed=false;firstAnswers=null;done=false;started=Date.now();phase='exercise';renderTask();
    }
    function feedback(message,good=false){q('.cl-feedback').textContent=message;q('.cl-feedback').className=`cl-feedback ${good?'is-good':'is-wrong'}`;}
    function key(k){if(busy||done||phase!=='exercise')return;if(k==='clear')answers[active]='';else if(k==='back')answers[active]=answers[active].slice(0,-1);else if(/^\d$/.test(k)&&answers[active].length<2)answers[active]+=k;sentence();}
    function lock(value){busy=value;root.querySelectorAll('[data-course-key],[data-course-field],[data-course="check"]').forEach(el=>{el.disabled=value;});q('[data-course="previous"]').disabled=value||stageIndex===0;q('[data-course="forward"]').disabled=value||stageIndex===core.LESSONS.length-1;}
    async function check(){
      if(disposed||busy||phase!=='exercise')return;
      if(done){if(counts[stageIndex]>=10){stageIndex++;deck=[];previous='';if(stageIndex>=core.LESSONS.length){const remaining=counts.findIndex(n=>n<10);if(remaining<0){stageIndex=core.LESSONS.length-1;phase='finish';renderFinish();}else{stageIndex=remaining;phase='intro';renderIntro();}}else{phase='intro';renderIntro();}}else next();return;}
      const result=core.validate(task,mode(),answers);
      if(result.missing.length){active=result.missing[0];sentence();feedback('Udfyld det tomme felt først.');return;}
      if(!firstAnswers)firstAnswers={...answers};
      if(!result.correct){failed=true;active=result.wrong[0];help=true;draw();feedback(result.wrong.includes('minutes')?stage().type==='over'?'Start ved toppen. Tæl med uret i den røde halvcirkel. Prøv igen.':'Start ved toppen. Tæl den MODSATTE vej af OVER-siden, ned langs den blå side til den store viser. Prøv igen.':stage().hands==='hour'||stage().type==='whole'?'Følg den lille pils spids til timetallet. Prøv igen.':core.hourGuide(task).rule);return;}
      const usedMode=mode(),keys=needed();
      const record={topic:'clock',problem:`Urkursus [${stage().id}] ${task.hour}:${String(task.minute).padStart(2,'0')} (${usedMode})`,answer:keys.map(k=>Number(firstAnswers[k])).join(' / '),correctAnswer:keys.map(k=>result.expected[k]).join(' / '),correct:!failed,responseTime:(Date.now()-started)/1000,timestamp:new Date().toISOString()};
      lock(true);
      try{await options.onResult?.(record);}catch(error){if(!disposed){lock(false);feedback('Svaret kunne ikke gemmes. Tryk Tjek svar for at prøve igen.');}return;}
      if(disposed)return;
      lock(false);done=true;counts[stageIndex]=Math.min(10,counts[stageIndex]+1);sentence();progress();q('.cl-keypad').hidden=true;
      const phrase=stage().hands==='hour'?`Pilen peger på ${task.hour}.`:stage().hands==='minute'?`${task.count} ${task.count===1?'minut':'minutter'} ${stage().type==='over'?'over':'i'}.`:`Klokken er ${task.phrase}.`;
      feedback(`Rigtigt! ${phrase}`,true);q('[data-course="check"]').textContent=counts[stageIndex]>=10?'Videre til næste del →':'Næste ur';q('[data-course="check"]').focus({preventScroll:true});
    }
    function click(event){
      const button=event.target.closest('button');if(!button||!root.contains(button))return;
      if(button.dataset.courseKey!==undefined)key(button.dataset.courseKey);
      if(button.dataset.courseField&&!busy&&!done){active=button.dataset.courseField;sentence();}
      const action=button.dataset.course;
      if(action==='previous')navigateLesson(-1);
      if(action==='forward')navigateLesson(1);
      if(action==='exit')options.onExit?.();
      if(action==='practice')options.onPractice?.();
      if(action==='start'&&phase==='intro'){if(stage().id==='both-over')beginExploration();else next();}
      if(action==='explore-next'&&phase==='explore')next();
      if(action==='explore-hour'&&phase==='explore')switchExplorationHour();
      if(action==='check')void check();
      if(action==='help'&&!busy){help=!help;draw();}
      if(action==='restart'){savedLessons.clear();counts.fill(0);stageIndex=0;phase='intro';deck=[];previous='';renderIntro();}
    }
    function keyboard(event){
      if(phase==='explore'&&!disposed&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.target.closest('[data-clock-drag]')){
        if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();moveExploration(exploration.angle+(['ArrowRight','ArrowUp'].includes(event.key)?15:-15));}return;
      }
      if(disposed||phase!=='exercise'||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('[data-course="exit"],[data-course="practice"],[data-course="help"],.cl-course-nav'))return;
      if(/^\d$/.test(event.key)){event.preventDefault();event.stopPropagation();key(event.key);}
      else if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();event.stopPropagation();key(event.key==='Backspace'?'back':'clear');}
      else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();void check();}
      else if((event.key==='ArrowRight'||event.key==='ArrowLeft')&&!done&&!busy){event.preventDefault();active=needed()[(needed().indexOf(active)+1)%needed().length];sentence();}
    }
    root.addEventListener('click',click);document.addEventListener('keydown',keyboard,true);
    root.addEventListener('pointerdown',pointerDown);root.addEventListener('pointermove',pointerMove);root.addEventListener('pointerup',pointerEnd);root.addEventListener('pointercancel',pointerEnd);root.addEventListener('lostpointercapture',pointerEnd);
    const tipResizeObserver=new ResizeObserver(positionDragTip);tipResizeObserver.observe(root);
    if(phase==='finish')renderFinish();else renderIntro();
    return ()=>{disposed=true;tipResizeObserver.disconnect();root.removeEventListener('click',click);document.removeEventListener('keydown',keyboard,true);const hand=q('[data-clock-drag]');if(dragPointer!==null&&hand?.hasPointerCapture(dragPointer))hand.releasePointerCapture(dragPointer);dragPointer=null;root.removeEventListener('pointerdown',pointerDown);root.removeEventListener('pointermove',pointerMove);root.removeEventListener('pointerup',pointerEnd);root.removeEventListener('pointercancel',pointerEnd);root.removeEventListener('lostpointercapture',pointerEnd);};
  }
  window.JacobClockCourse=Object.freeze({mount});
})();
