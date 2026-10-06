/* Count, add and feed Marley. Whole-character frames use the existing Marley art. */
(() => {
  'use strict';
  const isEnabled = user => !!user?.id && ['student','teacher','guest'].includes(user.role);
  const bone = '<svg viewBox="0 0 76 48" aria-hidden="true"><path d="M17 12C7-1-5 13 6 23C-5 35 8 49 18 36L58 36C69 49 82 35 71 24C82 13 69-1 59 12Z" fill="#fff2cc" stroke="#995a2c" stroke-width="4"/><path d="M24 20h28" stroke="#e5c69b" stroke-width="4" stroke-linecap="round"/></svg>';
  const bite = '<svg viewBox="0 0 50 48" aria-hidden="true"><path d="M12 7Q24 0 37 9L46 26Q46 39 30 43L13 40Q2 33 5 20Z" fill="#cc7740" stroke="#7c4229" stroke-width="3"/><path d="m15 16 7-3m9 7 4 3m-16 6 5 3" stroke="#f8c77b" stroke-width="4" stroke-linecap="round"/></svg>';
  const art = type => type === 'bone' ? bone : bite;
  function makeDeck() {
    const deck=[];
    for(let a=0;a<=9;a++)for(let b=0;b<=9;b++)if(a!==2||b!==8)deck.push({a,b});
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    return [{a:2,b:8},...deck];
  }
  function mount(root,{user,onExit=()=>{},onResult=async()=>{},tasks}={}) {
    if(!root||!isEnabled(user))return ()=>{};
    const sequence=tasks?.length ? tasks.map(({a,b})=>({a,b})) : makeDeck();
    if(sequence.some(({a,b})=>!Number.isInteger(a)||!Number.isInteger(b)||a<0||a>9||b<0||b>9))throw Error('Marleys plusstykker bruger heltal fra 0 til 9.');
    let index=0,serial=0,items=[],answer='',solved=0,phase='play',pending=false,disposed=false,started=performance.now(),drag=null,ignoreClick=false;
    const timers=new Set(),flights=new Set();
    const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!disposed)fn();},ms);timers.add(id);return id;};
    const task=()=>sequence[index];
    const counts=()=>({bone:items.filter(i=>i.type==='bone').length,bite:items.filter(i=>i.type==='bite').length});
    const ready=()=>{const c=counts();return c.bone===task().a&&c.bite===task().b;};
    const editable=()=>!disposed&&!pending&&phase==='play';
    root.innerHTML=`<section class="ma-game" aria-label="Matematik-Marley: plus med godbidder">
      <nav class="ma-nav"><button type="button" data-ma-exit>← Tilbage</button><span class="ma-score">0 måltider til Marley</span></nav>
      <header class="ma-heading"><span class="ma-eyebrow">Tæl · læg sammen · giv godbidder</span><h1>Godbidder til Marley</h1><p>To slags godbidder. Én glad matematik-hund!</p></header>
      <div class="ma-pet-scene"><div class="ma-dog" role="img" aria-label="Marley, en sød orange hund, der logrer"></div><div class="ma-hearts" aria-hidden="true"><span>♥</span><span>♥</span><span>♥</span><span>♥</span></div><div class="ma-speech"><span>Matematik-Marley</span><strong id="ma-dog-message">Vil du tælle mine godbidder?</strong><small>Du må også trykke på kasserne.</small></div></div>
      <div class="ma-equation" aria-label="Plusstykke"><span class="ma-term ma-bones-term"><b id="ma-a"></b>${bone}</span><span>+</span><span class="ma-term ma-bites-term"><b id="ma-b"></b>${bite}</span><span>=</span><output id="ma-answer" aria-label="Dit svar">?</output></div>
      <div class="ma-workspace"><section class="ma-counting"><h2 id="ma-instruction"></h2><div class="ma-stage">
        <div class="ma-crates"><button type="button" class="ma-crate ma-bone-crate" data-ma-add="bone" aria-label="Læg et kødben i skålen">${bone}<strong>Kødben</strong><small>Træk eller tryk</small></button><button type="button" class="ma-crate ma-bite-crate" data-ma-add="bite" aria-label="Læg en hapser i skålen">${bite}<strong>Hapser</strong><small>Træk eller tryk</small></button></div>
        <div class="ma-bowl" aria-label="Marleys skål. Slip godbidderne her."><span class="ma-bowl-label">MARLEYS SKÅL</span><div class="ma-treats"></div><span class="ma-empty">Slip godbidderne her ↓</span></div>
      </div><div class="ma-count-actions"><button type="button" data-ma-undo>↶ Fortryd én</button><button type="button" data-ma-clear>Tøm skålen</button></div><p class="ma-count-tip">Tryk på godbidderne i skålen, når du tæller. Træk dem tilbage, hvis der er for mange.</p></section>
      <section class="ma-numbers" aria-label="Skriv summen"><h2>Hvor mange i alt?</h2><p>Tæl alle kødben og hapser.</p><div class="ma-keypad">${[1,2,3,4,5,6,7,8,9,0].map(n=>`<button type="button" data-ma-digit="${n}">${n}</button>`).join('')}<button type="button" data-ma-delete aria-label="Slet sidste tal">⌫</button></div><button type="button" class="ma-submit" data-ma-submit>Giv Marley godbidderne ♥</button><button type="button" class="ma-next" data-ma-next hidden>Næste plusstykke →</button></section></div>
      <p class="ma-feedback" id="ma-feedback" role="status" aria-live="polite"></p>
    </section>`;
    const $=selector=>root.querySelector(selector);
    function feedback(text,tone='') {$('#ma-feedback').textContent=text;$('#ma-feedback').dataset.tone=tone;}
    function update() {
      if(disposed)return;
      const c=counts(),ok=ready(),locked=!editable();
      $('#ma-answer').textContent=answer||'?';
      $('.ma-game').classList.toggle('ma-ready',ok);
      $('[data-ma-add="bone"]').disabled=locked||c.bone>=9;
      $('[data-ma-add="bite"]').disabled=locked||c.bite>=9;
      root.querySelectorAll('[data-ma-digit], [data-ma-delete]').forEach(b=>{b.disabled=locked||!ok;});
      $('[data-ma-submit]').disabled=locked||!ok||answer==='';
      $('[data-ma-submit]').hidden=phase!=='play';
      $('[data-ma-next]').hidden=phase!=='done';
      $('[data-ma-undo]').disabled=locked||!items.length;
      $('[data-ma-clear]').disabled=locked||!items.length;
      root.querySelectorAll('[data-ma-item]').forEach(b=>{b.disabled=locked;});
      $('.ma-empty').hidden=items.length>0||phase!=='play';
      $('#ma-instruction').textContent=ok ? 'Tæl godbidderne. Skriv svaret.' : `Læg ${task().a} kødben og ${task().b} hapser i skålen.`;
      $('.ma-score').textContent=`${solved} ${solved===1?'måltid':'måltider'} til Marley`;
    }
    function paintItems() {
      $('.ma-treats').innerHTML=items.map(i=>`<button type="button" class="ma-treat${i.counted?' ma-counted':''}" data-ma-item="${i.id}" aria-pressed="${!!i.counted}" aria-label="${i.type==='bone'?'Kødben':'Hapser'}, ${i.counted?'talt':'ikke talt'}">${art(i.type)}<span class="ma-count-mark" aria-hidden="true">✓</span></button>`).join('');
      update();
    }
    function changeItems() {
      answer='';paintItems();feedback(ready()?'Nu er skålen klar. Tæl alle godbidderne!':'Træk godbidderne fra kasserne til skålen.');
    }
    function add(type) {if(!editable()||counts()[type]>=9)return;items.push({type,id:++serial,counted:false});changeItems();}
    function toggleCount(id) {if(!editable())return;const item=items.find(i=>i.id===id);if(item){item.counted=!item.counted;paintItems();}}
    function enterDigit(digit) {if(!editable()||!ready())return;if(answer.length<2){answer=answer==='0'?digit:answer+digit;update();}}
    function clearFlights(){flights.forEach(el=>el.remove());flights.clear();}
    function startTask() {
      clearFlights();items=[];answer='';phase='play';pending=false;started=performance.now();
      $('.ma-game').classList.remove('ma-feeding','ma-happy');
      $('.ma-dog').setAttribute('aria-label','Marley, en sød orange hund, der logrer');
      $('#ma-dog-message').textContent='Vil du tælle mine godbidder?';
      $('#ma-a').textContent=task().a;$('#ma-b').textContent=task().b;
      paintItems();feedback(ready()?'Skålen er tom. Hvor mange godbidder er der?':'Træk godbidderne fra kasserne til skålen.');
    }
    function feed() {
      phase='feeding';solved++;
      const dog=$('.ma-dog').getBoundingClientRect();
      root.querySelectorAll('.ma-treat').forEach((el,n)=>{
        const box=el.getBoundingClientRect(),fly=document.createElement('div');
        fly.className='ma-flight';fly.innerHTML=el.innerHTML;fly.style.left=`${box.left}px`;fly.style.top=`${box.top}px`;fly.style.width=`${box.width}px`;fly.style.height=`${box.height}px`;
        fly.style.setProperty('--dx',`${dog.left+dog.width*.5-box.left}px`);fly.style.setProperty('--dy',`${dog.top+dog.height*.63-box.top}px`);fly.style.animationDelay=`${n*35}ms`;
        document.body.append(fly);flights.add(fly);
      });
      $('.ma-game').classList.add('ma-happy');
      if(task().a+task().b>0)$('.ma-game').classList.add('ma-feeding');
      $('.ma-dog').setAttribute('aria-label','Marley spiser godbidderne og er glad');
      $('#ma-dog-message').textContent=task().a+task().b===0?'Ingen godbidder denne gang. Men masser af kærlighed!':'Mums! Tak for mine godbidder!';
      feedback(`Sådan! ${task().a} + ${task().b} = ${task().a+task().b}. Marley er glad!`,'success');
      update();
      later(()=>{clearFlights();phase='done';$('.ma-game').classList.remove('ma-feeding');update();},2500);
    }
    async function submit() {
      if(!editable()||!ready()||answer==='')return;
      pending=true;update();
      const value=Number(answer),correct=value===task().a+task().b;
      const result={topic:'marleyAddition',problem:`${task().a} + ${task().b}`,answer:value,correctAnswer:task().a+task().b,correct,responseTime:Math.max(0,(performance.now()-started)/1000),timestamp:new Date().toISOString()};
      try {await onResult(result);}catch(error){if(disposed)return;pending=false;update();feedback('Svaret kunne ikke gemmes. Tryk igen.','error');return;}
      if(disposed)return;
      pending=false;
      if(correct)feed();
      else {answer='';update();feedback('Prøv igen. Tæl alle godbidderne i skålen — én ad gangen.','error');}
    }
    function click(event) {
      if(ignoreClick){ignoreClick=false;return;}
      const button=event.target.closest('button');if(!button||!root.contains(button)||button.disabled)return;
      if(button.hasAttribute('data-ma-exit')){onExit();return;}
      if(button.dataset.maAdd)add(button.dataset.maAdd);
      if(button.dataset.maItem)toggleCount(Number(button.dataset.maItem));
      if(button.hasAttribute('data-ma-digit'))enterDigit(button.dataset.maDigit);
      if(button.hasAttribute('data-ma-delete')&&editable()){answer=answer.slice(0,-1);update();}
      if(button.hasAttribute('data-ma-undo')&&editable()){items.pop();changeItems();}
      if(button.hasAttribute('data-ma-clear')&&editable()){items=[];changeItems();}
      if(button.hasAttribute('data-ma-submit'))void submit();
      if(button.hasAttribute('data-ma-next')&&phase==='done'){index=(index+1)%sequence.length;startTask();}
    }
    function keydown(event) {
      if(event.ctrlKey||event.metaKey||event.altKey||!root.isConnected)return;
      if(event.target.closest('input,textarea,select')||event.target.isContentEditable)return;
      if(/^[0-9]$/.test(event.key)){event.preventDefault();enterDigit(event.key);}
      else if(event.key==='Backspace'&&editable()&&ready()){event.preventDefault();answer=answer.slice(0,-1);update();}
      else if(event.key==='Enter'&&answer!==''&&ready()&&!event.target.closest('[data-ma-exit], [data-ma-next]')){event.preventDefault();void submit();}
      else if(event.key==='Enter'&&(event.target===document.body||event.target===root)){event.preventDefault();void submit();}
    }
    function cancelDrag() {
      if(!drag)return;
      drag.ghost?.remove();$('.ma-bowl').classList.remove('ma-drop-active');
      if(drag.el.hasPointerCapture?.(drag.pointerId))drag.el.releasePointerCapture(drag.pointerId);
      drag=null;
    }
    function pointerdown(event) {
      if(!editable()||drag||event.button>0)return;
      const el=event.target.closest('[data-ma-add], [data-ma-item]');if(!el||el.disabled||!root.contains(el))return;
      const item=items.find(i=>i.id===Number(el.dataset.maItem));
      drag={el,pointerId:event.pointerId,x:event.clientX,y:event.clientY,type:el.dataset.maAdd||item?.type,itemId:item?.id,moved:false,ghost:null};
      el.setPointerCapture(event.pointerId);
    }
    function pointermove(event) {
      if(!drag||event.pointerId!==drag.pointerId)return;
      if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8)return;
      event.preventDefault();
      if(!drag.moved){drag.moved=true;drag.ghost=document.createElement('div');drag.ghost.className='ma-drag-ghost';drag.ghost.innerHTML=art(drag.type);document.body.append(drag.ghost);}
      drag.ghost.style.left=`${event.clientX}px`;drag.ghost.style.top=`${event.clientY}px`;
      const box=$('.ma-bowl').getBoundingClientRect();
      $('.ma-bowl').classList.toggle('ma-drop-active',event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom);
    }
    function pointerup(event) {
      if(!drag||event.pointerId!==drag.pointerId)return;
      const current=drag;
      const hit=el=>{const b=el.getBoundingClientRect();return event.clientX>=b.left&&event.clientX<=b.right&&event.clientY>=b.top&&event.clientY<=b.bottom;};
      cancelDrag();
      if(!current.moved)return;
      ignoreClick=true;later(()=>{ignoreClick=false;},100);
      if(current.itemId){if(hit($(`[data-ma-add="${current.type}"]`))){items=items.filter(i=>i.id!==current.itemId);changeItems();}}
      else if(hit($('.ma-bowl')))add(current.type);
    }
    const pointercancel=()=>cancelDrag();
    root.addEventListener('click',click);root.addEventListener('pointerdown',pointerdown);root.addEventListener('pointermove',pointermove);root.addEventListener('pointerup',pointerup);root.addEventListener('pointercancel',pointercancel);document.addEventListener('keydown',keydown);
    startTask();
    return ()=>{disposed=true;cancelDrag();timers.forEach(clearTimeout);timers.clear();clearFlights();root.removeEventListener('click',click);root.removeEventListener('pointerdown',pointerdown);root.removeEventListener('pointermove',pointermove);root.removeEventListener('pointerup',pointerup);root.removeEventListener('pointercancel',pointercancel);document.removeEventListener('keydown',keydown);root.innerHTML='';};
  }
  window.MarleyAddition={isEnabled,mount,makeDeck};
})();
