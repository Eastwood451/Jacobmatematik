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
    if(stageIndex<0){stageIndex=core.LESSONS.length-1;phase='finish';}
    const stage=()=>core.LESSONS[stageIndex];
    const mode=()=>taskMode;
    const needed=()=>core.fields(task,mode());
    const q=s=>root.querySelector(s);
    const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function header(){return `<header class="cl-header"><div><span class="cl-eyebrow">LÆR KLOKKEN MED LUIGI</span><h1>${phase==='finish'?'Du kan aflæse uret!':phase==='explore'?'Prøv selv: OVER eller I?':escape(stage().title)}</h1><p>Én ting ad gangen. Først hver viser for sig.</p></div><div class="cl-course-actions"><button type="button" class="cl-button cl-quiet" data-course="practice">Fri træning</button><button type="button" class="cl-button cl-quiet" data-course="exit">← Tilbage</button></div></header><ol class="cl-chapters" aria-label="Kursets fire dele">${chapters.map((title,i)=>`<li class="${phase==='finish'||stage().chapter>i+1?'is-complete':stage().chapter===i+1?'is-current':''}" ${stage().chapter===i+1&&phase!=='finish'?'aria-current="step"':''}><span>${i+1}</span>${title}</li>`).join('')}</ol>`;}
    function coach(paragraphs,small=false){return `<aside class="cl-coach ${small?'cl-coach-small':''}" aria-label="Luigi Lækkermat forklarer"><img src="${luigi}" alt="Luigi Lækkermat" width="120" height="144"><div><strong>Luigi Lækkermat</strong>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</div></aside>`;}
    function halves(){return stage().type==='whole'?'':`<div class="cl-halves" aria-label="De to måder at sige minutter"><span class="cl-side-to ${stage().type==='to'?'is-active':''}">Minutter I</span><span class="cl-side-over ${stage().type==='over'?'is-active':''}">Minutter OVER</span></div>`;}
    function svg(t){return window.JacobClock.clockSvg(t,stage().hands==='both'&&stage().type!=='whole'&&help,{hands:stage().hands,sectors:stage().type!=='whole'});}
    function renderIntro(){
      const example=core.describe(stage().hands==='minute'?12:stage().id==='hours'?8:stage().id==='whole'?6:3,stage().type==='whole'?0:stage().type==='over'?20:40,stage().type);
      root.innerHTML=`<section class="cl-module cl-course" data-lesson="${stage().id}" data-phase="intro">${header()}<div class="cl-course-intro"><div class="cl-dial">${halves()}${svg(example)}<p class="cl-intro-caption">${stage().hands==='hour'?'Kun den lille timeviser':stage().hands==='minute'?'Kun den store minutviser':stage().type==='whole'?'Stor viser opad · lille viser på timen':'Nu bruger vi begge visere'}</p></div><div>${coach(stage().intro)}<p class="cl-course-goal">${10-counts[stageIndex]} korrekte svar ${counts[stageIndex]?'tilbage i denne del':'i denne del'}. Du kan rette et forkert svar.</p><button type="button" class="cl-button cl-course-start" data-course="start">${counts[stageIndex]?'Fortsæt øvelsen':'Start øvelsen'} →</button></div></div></section>`;
    }
    function beginExploration(){
      phase='explore';exploration={index:0,angle:120,side:'over'};
      const example=core.describe(3,20,'over');
      root.innerHTML=`<section class="cl-module cl-course cl-explore" data-lesson="both-over" data-phase="explore">${header()}<div class="cl-course-intro"><div class="cl-dial"><div class="cl-halves" aria-label="De to måder at sige minutter"><span class="cl-side-to">Minutter I</span><span class="cl-side-over is-active">Minutter OVER</span></div>${window.JacobClock.clockSvg(example,false,{hands:'both',sectors:true,draggableMinute:true})}<p class="cl-intro-caption">Grib den lange viser og træk den rundt.<br>Du kan også bruge piletasterne.</p></div><div>${coach(['',''])}<div class="cl-explore-card"><p class="cl-explore-round"></p><strong class="cl-explore-choice"></strong><p class="cl-explore-progress"></p><p class="cl-explore-status" role="status" aria-live="polite"></p></div><div class="cl-course-actions"><button type="button" class="cl-button cl-quiet" data-course="explore-hour">Prøv mellem 10 og 11</button><button type="button" class="cl-button cl-course-start" data-course="explore-next">Start opgaverne →</button></div></div></div></section>`;
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('class','cl-explore-hour-ring');circle.setAttribute('r','23');circle.setAttribute('fill','none');circle.setAttribute('stroke-width','4');
      q('.cl-clock').insertBefore(circle,q('[data-clock-hour]'));
      q('.cl-minute-ray')?.remove();
      q('.cl-hour-hand').style.transformOrigin='200px 200px';
      updateExploration();
    }
    function updateExploration(){
      const e=exploration,hour=e.index===0?3:10,nextHour=hour+1,namedHour=e.side==='over'?hour:nextHour;
      const color=e.side==='over'?'#c85540':'#356bc3',number=q(`[data-clock-hour="${namedHour}"]`),ring=q('.cl-explore-hour-ring');
      ring.setAttribute('cx',number.getAttribute('x'));ring.setAttribute('cy',number.getAttribute('y'));ring.setAttribute('stroke',color);ring.dataset.highlightHour=String(namedHour);
      const hand=q('[data-clock-drag]');hand.setAttribute('transform',`rotate(${e.angle} 200 200)`);hand.setAttribute('aria-valuenow',String(Math.round(e.angle)%360));hand.setAttribute('aria-valuetext',`Minutter ${e.side==='over'?'OVER':'I'}: vi siger ${namedHour}.`);
      q('.cl-hour-hand').style.transform=`rotate(${hour*30+e.angle/12}deg)`;
      q('.cl-explore').dataset.hour=String(hour);q('.cl-explore').dataset.side=e.side;
      q('.cl-side-over').classList.toggle('is-active',e.side==='over');q('.cl-side-to').classList.toggle('is-active',e.side==='to');
      const paragraphs=root.querySelectorAll('.cl-coach p');
      paragraphs[0].textContent=`Den lille viser står mellem ${hour} og ${nextHour}. På den røde OVER-side siger vi ${hour}. På den blå I-side siger vi ${nextHour}. Se cirklen om tallet!`;
      paragraphs[1].textContent='Grib den lange viser. Før den frem og tilbage mellem den blå og den røde side, så mange gange du vil. Tryk på Start opgaverne, når du er klar.';
      q('.cl-explore-round').textContent=`Ur ${e.index+1} af 2 · mellem ${hour} og ${nextHour}`;
      q('.cl-explore-choice').textContent=`Minutter ${e.side==='over'?'OVER':'I'} → ${namedHour}`;
      q('.cl-explore-progress').textContent='Øv dig så længe, du vil.';
      const message=e.side==='to'?'På den blå side siger vi den næste time. Prøv at føre viseren tilbage.':'På den røde side siger vi den time, den lille viser har passeret.';
      if(q('.cl-explore-status').textContent!==message)q('.cl-explore-status').textContent=message;
      q('[data-course="explore-hour"]').textContent=e.index===0?'Prøv mellem 10 og 11':'Prøv mellem 3 og 4';
    }
    function moveExploration(angle){
      const e=exploration;if(phase!=='explore')return;
      q('.cl-explore').classList.remove('is-changing-hour');
      e.angle=(angle%360+360)%360;
      const horizontal=Math.sin(e.angle*Math.PI/180);
      if(Math.abs(horizontal)>0.0001)e.side=horizontal>0?'over':'to';
      updateExploration();
    }
    function switchExplorationHour(){
      q('.cl-explore').classList.add('is-changing-hour');exploration.index=1-exploration.index;
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
      const explanation=stage().hands==='hour'?'Den lille viser er en pil. Læs tallet ved spidsen.':stage().hands==='minute'?stage().type==='over'?'Brug den røde OVER-halvcirkel. Tæl fra toppen med uret.':'På den blå I-side tæller vi den MODSATTE vej af OVER-siden. Start ved toppen, og tæl ned langs den blå side, indtil du møder den store viser.':stage().type==='whole'?'Den store viser står på 12. Sig bare det tal, den lille viser peger på.':core.hourGuide(task).rule;
      root.innerHTML=`<section class="cl-module cl-course" data-lesson="${stage().id}" data-phase="exercise">${header()}<h2 class="cl-course-question">${stage().prompt}</h2><div class="cl-progress" aria-live="polite"></div><div class="cl-play"><div class="cl-dial">${halves()}<div class="cl-svg"></div><div class="cl-legend">${stage().hands!=='minute'?'<span><i class="cl-hour-dot"></i>Kort, bred pil · timeviser</span>':''}${stage().hands!=='hour'?'<span><i class="cl-minute-dot"></i>Lang, smal pil · minutviser</span>':''}</div>${stage().hands==='both'&&stage().type!=='whole'?'<button type="button" class="cl-button cl-quiet" data-course="help" aria-pressed="true">Skjul hjælpelinjer</button><p class="cl-course-guide"></p>':''}${coach([explanation],true)}</div><div class="cl-answer"><span class="cl-eyebrow">${words}</span><div class="cl-sentence"></div><p class="cl-instruction">${needed().length===2?'Udfyld både minutter og timetal.':needed()[0]==='minutes'?'Skriv antallet af minutter.':'Skriv timetallet.'}</p><div class="cl-keypad">${[1,2,3,4,5,6,7,8,9,'clear',0,'back'].map(k=>`<button type="button" data-course-key="${k}" aria-label="${k==='clear'?'Ryd felt':k==='back'?'Slet sidste ciffer':k}">${k==='clear'?'C':k==='back'?'⌫':k}</button>`).join('')}</div><button type="button" class="cl-button cl-check" data-course="check">Tjek svar</button><p class="cl-feedback" role="status" aria-live="polite"></p></div></div></section>`;
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
      if(!result.correct){failed=true;active=result.wrong[0];help=true;draw();feedback(result.wrong.includes('minutes')?stage().type==='over'?'Start ved toppen. Tæl med uret i den røde halvcirkel. Prøv igen.':'Start ved toppen. Tæl den MODSATTE vej af OVER-siden, ned langs den blå side til den store viser. Prøv igen.':stage().hands==='hour'||stage().type==='whole'?'Følg den lille pils spids til timetallet. Prøv igen.':core.hourGuide(task).rule);return;}
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
      if(action==='start'&&phase==='intro'){if(stage().id==='both-over')beginExploration();else next();}
      if(action==='explore-next'&&phase==='explore')next();
      if(action==='explore-hour'&&phase==='explore')switchExplorationHour();
      if(action==='check')void check();
      if(action==='help'&&!busy){help=!help;draw();}
      if(action==='restart'){counts.fill(0);stageIndex=0;phase='intro';deck=[];previous='';renderIntro();}
    }
    function keyboard(event){
      if(phase==='explore'&&!disposed&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.target.closest('[data-clock-drag]')){
        if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();moveExploration(exploration.angle+(['ArrowRight','ArrowUp'].includes(event.key)?15:-15));}return;
      }
      if(disposed||phase!=='exercise'||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('[data-course="exit"],[data-course="practice"],[data-course="help"]'))return;
      if(/^\d$/.test(event.key)){event.preventDefault();event.stopPropagation();key(event.key);}
      else if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();event.stopPropagation();key(event.key==='Backspace'?'back':'clear');}
      else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();void check();}
      else if((event.key==='ArrowRight'||event.key==='ArrowLeft')&&!done&&!busy){event.preventDefault();active=needed()[(needed().indexOf(active)+1)%needed().length];sentence();}
    }
    root.addEventListener('click',click);document.addEventListener('keydown',keyboard,true);
    root.addEventListener('pointerdown',pointerDown);root.addEventListener('pointermove',pointerMove);root.addEventListener('pointerup',pointerEnd);root.addEventListener('pointercancel',pointerEnd);root.addEventListener('lostpointercapture',pointerEnd);
    if(phase==='finish')renderFinish();else renderIntro();
    return ()=>{disposed=true;root.removeEventListener('click',click);document.removeEventListener('keydown',keyboard,true);const hand=q('[data-clock-drag]');if(dragPointer!==null&&hand?.hasPointerCapture(dragPointer))hand.releasePointerCapture(dragPointer);dragPointer=null;root.removeEventListener('pointerdown',pointerDown);root.removeEventListener('pointermove',pointerMove);root.removeEventListener('pointerup',pointerEnd);root.removeEventListener('pointercancel',pointerEnd);root.removeEventListener('lostpointercapture',pointerEnd);};
  }
  window.JacobClockCourse=Object.freeze({mount});
})();
