/* Guided balance lesson. Practice state is local to this mount. */
(() => {
  'use strict';
  const copy = {
    da: { title:'Ligninger', intro:'Ligninger er en vægt i ligevægt!', remove:'Prøv at fjerne en vægt', same:'Du skal gøre det samme på begge sider.', alone:'X skal stå for sig selv.', done:'Nu står X for sig selv. X er lig med fire!', start:'Prøv selv', back:'← Tilbage til sandbox', replay:'Hør igen', reset:'Prøv igen', left:'Fjern en kasse til venstre', right:'Fjern en kasse til højre', balanced:'I ligevægt', unbalanced:'Ikke i ligevægt', finish:'Vis resultatet', hint:'Fjern den sidste lille kasse til venstre.', rightHint:'Fjern også én kasse til højre.' },
    en: { title:'Equations', intro:'An equation is a balanced scale!', remove:'Try removing a weight', same:'You must do the same on both sides.', alone:'X must stand on its own.', done:'Now X is on its own. X equals four!', start:'Try it', back:'← Back to sandbox', replay:'Listen again', reset:'Try again', left:'Remove a box on the left', right:'Remove a box on the right', balanced:'Balanced', unbalanced:'Not balanced', finish:'Show the result', hint:'Remove the last small box on the left.', rightHint:'Remove one box on the right too.' }
  };
  function mount(root, {onExit} = {}) {
    let step = 0, disposed = false, serial = 0, flight = null, result = null;
    const lang = () => document.documentElement.lang.startsWith('en') ? 'en' : 'da';
    const t = () => copy[lang()];
    const key = () => ['intro','remove','same','alone','same','alone','done'][step];
    const clips = new Map();
    let playing = null;
    function clip(language, line) {
      const id=language+'-'+line;
      if(!clips.has(id)) {
        const audio=new Audio('assets/equations/'+id+'.mp3?v=20261112-voice1');
        audio.preload='auto'; clips.set(id,audio);
      }
      return clips.get(id);
    }
    function stop() {
      serial++;
      if(playing) { playing.pause(); playing.currentTime=0; playing=null; }
    }
    function speak() {
      stop(); if(disposed) return;
      const token=serial;
      playing=clip(lang(),key());
      playing.play().catch(() => {
        if(disposed || token!==serial) return;
        // Autoplay may be blocked until a user gesture. Replay stays available;
        // never substitute a voice selected by the browser's language.
        const replay=root.querySelector('[data-eq="replay"]');
        if(replay) replay.textContent=lang()==='da'?'▶ Hør igen':'▶ Listen again';
      });
    }
    root.innerHTML = `<section class="eq-module" data-i18n-skip><nav><button type="button" data-eq="back"></button><div><button type="button" data-eq="replay"></button><button type="button" data-eq="reset"></button></div></nav><h1></h1><p class="eq-prompt" aria-live="polite"></p><p class="eq-hint"></p><div class="eq-scale"><div class="eq-post"></div><div class="eq-foot"></div><div class="eq-beam"></div><div class="eq-pan eq-left"><svg class="eq-cords" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 100 L50 0 L100 100" fill="none" stroke="#d9c9a9" stroke-width="1" vector-effect="non-scaling-stroke"/></svg><div class="eq-load"><div class="eq-x">x</div><div class="eq-boxes"></div></div><div class="eq-tray"></div><span class="eq-arrow" aria-hidden="true">↓</span></div><div class="eq-pan eq-right"><svg class="eq-cords" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 100 L50 0 L100 100" fill="none" stroke="#d9c9a9" stroke-width="1" vector-effect="non-scaling-stroke"/></svg><div class="eq-load"><div class="eq-boxes"></div></div><div class="eq-tray"></div><span class="eq-arrow" aria-hidden="true">↓</span></div><div class="eq-pivot"></div></div><div class="eq-equation" aria-live="polite"><span class="eq-expression eq-expression-left"></span><span class="eq-sign"></span><span class="eq-expression eq-expression-right"></span></div><p class="eq-status"></p><div class="eq-controls"><button type="button" data-eq="next"></button></div><div class="eq-progress" aria-hidden="true"></div></section>`;
    const find = s => root.querySelector(s);
    function cancelFlight() {
      if (!flight) return;
      const old = flight; flight = null;
      old.animation?.cancel(); old.ghost?.remove();
    }
    function cancelResult() {
      if(!result) return;
      const old=result; result=null;
      for(const animation of old.animations) animation.cancel();
    }
    async function showResult() {
      if(disposed || flight || result || step!==5) return;
      const current={animations:[],phase:'sliding'}; result=current; stop();
      find('[data-eq="next"]').disabled=true;
      find('.eq-equation').setAttribute('aria-busy','true');
      find('.eq-module').dataset.resultPhase=current.phase;
      const active=()=>!disposed && result===current;
      const finish=()=>{
        if(!active()) return;
        cancelResult(); step=6; render(); speak(); focusNext();
      };
      const animate=(element,frames,options)=>{
        const animation=element.animate(frames,{fill:'forwards',...options});
        current.animations.push(animation); return animation.finished;
      };
      const phase=value=>{current.phase=value;find('.eq-module').dataset.resultPhase=value;};
      if(!find('.eq-subtraction').animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
      const terms=['left','right'].map(side=>({
        value:find('.eq-expression-'+side+' .eq-start-value'),
        subtraction:find('.eq-expression-'+side+' .eq-subtraction')
      }));
      try {
        // Both orange -2 terms move into the number being reduced.
        await Promise.all(terms.map(({value,subtraction})=>{
          const from=subtraction.getBoundingClientRect(),to=value.getBoundingClientRect();
          const dx=to.left+to.width/2-from.left-from.width/2;
          return animate(subtraction,[
            {transform:'translateX(0)',opacity:1},
            {transform:`translateX(${dx}px)`,opacity:1,offset:.8},
            {transform:`translateX(${dx}px)`,opacity:0}
          ],{duration:650,easing:'cubic-bezier(.4,0,.2,1)'});
        }));
        if(!active()) return;
        phase('morphing');
        terms[0].value.textContent='0'; terms[0].value.classList.add('eq-zero');
        terms[1].value.textContent='4';
        await Promise.all(terms.map(({value})=>animate(value,[
          {transform:'scale(.7)',opacity:.25},
          {transform:'scale(1)',opacity:1}
        ],{duration:250,easing:'ease-out'})));
        if(!active()) return;
        phase('fading');
        const cancelled=find('.eq-addition-group'),width=cancelled.getBoundingClientRect().width;
        const fading=[animate(cancelled,[
          {opacity:1,width:width+'px',offset:0},
          {opacity:.2,width:width+'px',offset:.75},
          {opacity:0,width:'0px',offset:1}
        ],{duration:2000,easing:'linear'})];
        // Close the spaces smoothly as +0 disappears; x and 4 settle at the centre.
        for(const {subtraction} of terms) {
          const width=subtraction.getBoundingClientRect().width;
          subtraction.style.minWidth='0'; subtraction.style.overflow='hidden';
          fading.push(animate(subtraction,[
            {width:width+'px',offset:0},
            {width:width+'px',offset:.75},
            {width:'0px',offset:1}
          ],{duration:2000,easing:'linear'}));
        }
        await Promise.all(fading); finish();
      } catch(error) {
        // Reset, language changes and unmount cancel this run without stale updates.
        if(active()) finish();
      }
    }
    function focusNext() {
      const target=find('.eq-active .eq-box')||find('[data-eq="next"]');
      if(!target.hidden) target.focus({preventScroll:true});
    }
    function removeBox(button, side) {
      if (flight) return;
      const start = button.getBoundingClientRect();
      const previous = side === 'left' ? (step === 3 ? 1 : 0) : (step === 4 ? 1 : 0);
      const current = { side, previous, ghost:null, animation:null };
      flight = current; stop(); step++; render();
      const destination = find('.eq-expression-'+side+' .eq-subtraction');
      const end = destination.getBoundingClientRect();
      const ghost = document.createElement('span');
      ghost.className='eq-flying-box'; ghost.setAttribute('aria-hidden','true');
      ghost.innerHTML='<span class="eq-flying-one">1</span><span class="eq-flying-minus">−1</span>';
      Object.assign(ghost.style, { left:start.left+'px', top:start.top+'px', width:start.width+'px', height:start.height+'px' });
      document.body.appendChild(ghost); current.ghost=ghost;
      const finish = () => {
        if(disposed || flight !== current) return;
        cancelFlight(); render(); speak(); focusNext();
        const landed=find('.eq-expression-'+side+' .eq-subtraction');
        landed.classList.add('eq-landed');
      };
      if (!ghost.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
      const dx=end.left+end.width/2-start.left-start.width/2;
      const dy=end.top+end.height/2-start.top-start.height/2;
      current.animation=ghost.animate([
        {transform:'translate(0, 0) scale(1)',offset:0},
        {transform:`translate(${dx*.3}px, ${dy*.48}px) scale(.95)`,offset:.45},
        {transform:`translate(${dx}px, ${dy}px) scale(.8)`,offset:1}
      ],{duration:950,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'});
      current.animation.finished.then(finish,()=>{});
    }
    function render() {
      const c=t(), leftRemoved = step>=4?2:step>=2?1:0, rightRemoved=step>=5?2:step>=3?1:0;
      const balanced=leftRemoved===rightRemoved;
      find('.eq-module').dataset.resultPhase=step===6?'done':'idle';
      find('.eq-equation').setAttribute('aria-busy','false');
      find('h1').textContent=c.title; find('.eq-prompt').textContent=c[key()];
      find('.eq-hint').textContent=step===3?c.hint:step===2||step===4?c.rightHint:'';
      for(const action of ['back','replay','reset']) find(`[data-eq="${action}"]`).textContent=c[action];
      find('.eq-scale').classList.toggle('eq-unbalanced',!balanced);
      for(const side of ['left','right']) {
        const count=side==='left'?2-leftRemoved:6-rightRemoved;
        const enabled=!flight && (side==='left'?(step===1||step===3):(step===2||step===4));
        const pan=find('.eq-'+side); pan.classList.toggle('eq-active',enabled);
        pan.querySelector('.eq-boxes').innerHTML=Array.from({length:count},()=>`<button type="button" class="eq-box" data-eq="${side}" aria-label="${c[side]}" ${enabled?'':'disabled'}>1</button>`).join('');
      }
      for (const [side, removed] of [['left',leftRemoved],['right',rightRemoved]]) {
        const shown = flight?.side === side ? flight.previous : removed;
        const base=side==='left'?'<span class="eq-x-term">x</span><span class="eq-addition-group"><span class="eq-addition-op"> + </span><span class="eq-start-value">2</span></span>':'<span class="eq-start-value">6</span>';
        find('.eq-expression-'+side).innerHTML=step===6 ? (side==='left'?'x':'4') :
          `${base}<span class="eq-subtraction ${shown ? '' : 'eq-empty'}">${shown ? ' − '+shown : ''}</span>`;
      }
      const sign=find('.eq-sign'); sign.textContent=balanced?'=':'≠'; sign.classList.toggle('eq-red',!balanced);
      find('.eq-status').textContent=balanced?c.balanced:c.unbalanced;
      const next=find('[data-eq="next"]'); next.disabled=Boolean(flight || result); next.hidden=step!==0&&step!==5&&step!==6; next.textContent=step===0?c.start:step===5?c.finish:c.reset;
      find('.eq-progress').textContent='●'.repeat(step+1)+'○'.repeat(6-step);
    }
    function click(event) {
      const button=event.target.closest('[data-eq]'); if(!button||!root.contains(button)||button.disabled) return;
      const action=button.dataset.eq;
      if(action==='back') { cancelFlight(); cancelResult(); stop(); onExit?.(); return; }
      if(action==='replay') { speak(); return; }
      if(action==='reset') { cancelFlight(); cancelResult(); step=0; }
      else if(action==='next'&&step===5) { void showResult(); return; }
      else if(action==='next'&&(step===0||step===5||step===6)) step=step===6?0:step+1;
      else if(action==='left'&&!flight&&(step===1||step===3)) { removeBox(button,action); return; }
      else if(action==='right'&&!flight&&(step===2||step===4)) { removeBox(button,action); return; }
      else return;
      render(); speak();
      focusNext();
    }
    function languageChanged() { cancelFlight(); cancelResult(); render(); speak(); }
    root.addEventListener('click',click); document.addEventListener('jm-langchange',languageChanged);
    for(const line of ['intro','remove','same','alone','done']) clip(lang(),line);
    render(); speak();
    return () => { disposed=true;cancelFlight();cancelResult();stop();clips.clear();root.removeEventListener('click',click);document.removeEventListener('jm-langchange',languageChanged); };
  }
  window.JacobEquations={mount};
})();
