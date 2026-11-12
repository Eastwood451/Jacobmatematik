/* Guided balance lesson. Practice state is local to this mount. */
(() => {
  'use strict';
  const copy = {
    da: { title:'Ligninger', intro:'Ligninger er en vægt i ligevægt!', remove:'Prøv at fjerne en vægt', same:'Du skal gøre det samme på begge sider.', alone:'X skal stå for sig selv.', done:'Nu står X for sig selv. X er lig med fire!', start:'Prøv selv', back:'← Tilbage til sandbox', replay:'Hør igen', reset:'Prøv igen', left:'Fjern en kasse til venstre', right:'Fjern en kasse til højre', balanced:'I ligevægt', unbalanced:'Ikke i ligevægt', finish:'Vis resultatet', hint:'Fjern den sidste lille kasse til venstre.', rightHint:'Fjern også én kasse til højre.' },
    en: { title:'Equations', intro:'An equation is a balanced scale!', remove:'Try removing a weight', same:'You must do the same on both sides.', alone:'X must stand on its own.', done:'Now X is on its own. X equals four!', start:'Try it', back:'← Back to sandbox', replay:'Listen again', reset:'Try again', left:'Remove a box on the left', right:'Remove a box on the right', balanced:'Balanced', unbalanced:'Not balanced', finish:'Show the result', hint:'Remove the last small box on the left.', rightHint:'Remove one box on the right too.' }
  };
  function mount(root, {onExit} = {}) {
    let step = 0, disposed = false, serial = 0, flight = null;
    const lang = () => document.documentElement.lang.startsWith('en') ? 'en' : 'da';
    const t = () => copy[lang()];
    const key = () => ['intro','remove','same','alone','same','alone','done'][step];
    function stop() { serial++; window.speechSynthesis?.cancel(); }
    function speak() {
      stop(); const token = serial;
      const fallback = () => {
        if(disposed || token !== serial || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(lang() === 'da' ? t()[key()].replace(/X/g, 'eks') : t()[key()]);
        utterance.lang = lang() === 'da' ? 'da-DK' : 'en-GB'; utterance.rate = .9;
        utterance.voice = speechSynthesis.getVoices().find(v => v.lang === utterance.lang) || null;
        speechSynthesis.speak(utterance);
      };
      fallback();
    }
    root.innerHTML = `<section class="eq-module" data-i18n-skip><nav><button type="button" data-eq="back"></button><div><button type="button" data-eq="replay"></button><button type="button" data-eq="reset"></button></div></nav><h1></h1><p class="eq-prompt" aria-live="polite"></p><p class="eq-hint"></p><div class="eq-scale"><div class="eq-post"></div><div class="eq-foot"></div><div class="eq-beam"></div><div class="eq-pan eq-left"><svg class="eq-cords" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 100 L50 0 L100 100" fill="none" stroke="#d9c9a9" stroke-width="1" vector-effect="non-scaling-stroke"/></svg><div class="eq-load"><div class="eq-x">x</div><div class="eq-boxes"></div></div><div class="eq-tray"></div><span class="eq-arrow" aria-hidden="true">↓</span></div><div class="eq-pan eq-right"><svg class="eq-cords" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 100 L50 0 L100 100" fill="none" stroke="#d9c9a9" stroke-width="1" vector-effect="non-scaling-stroke"/></svg><div class="eq-load"><div class="eq-boxes"></div></div><div class="eq-tray"></div><span class="eq-arrow" aria-hidden="true">↓</span></div><div class="eq-pivot"></div></div><div class="eq-equation" aria-live="polite"><span class="eq-expression eq-expression-left"></span><span class="eq-sign"></span><span class="eq-expression eq-expression-right"></span></div><p class="eq-status"></p><div class="eq-controls"><button type="button" data-eq="next"></button></div><div class="eq-progress" aria-hidden="true"></div></section>`;
    const find = s => root.querySelector(s);
    function cancelFlight() {
      if (!flight) return;
      const old = flight; flight = null;
      old.animation?.cancel(); old.ghost?.remove();
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
      for (const [side, removed, base] of [['left',leftRemoved,'x + 2'],['right',rightRemoved,'6']]) {
        const shown = flight?.side === side ? flight.previous : removed;
        find('.eq-expression-'+side).innerHTML=step===6 ? (side==='left'?'x':'4') :
          `<span>${base}</span><span class="eq-subtraction ${shown ? '' : 'eq-empty'}">${shown ? ' − '+shown : ''}</span>`;
      }
      const sign=find('.eq-sign'); sign.textContent=balanced?'=':'≠'; sign.classList.toggle('eq-red',!balanced);
      find('.eq-status').textContent=balanced?c.balanced:c.unbalanced;
      const next=find('[data-eq="next"]'); next.disabled=Boolean(flight); next.hidden=step!==0&&step!==5&&step!==6; next.textContent=step===0?c.start:step===5?c.finish:c.reset;
      find('.eq-progress').textContent='●'.repeat(step+1)+'○'.repeat(6-step);
    }
    function click(event) {
      const button=event.target.closest('[data-eq]'); if(!button||!root.contains(button)||button.disabled) return;
      const action=button.dataset.eq;
      if(action==='back') { cancelFlight(); stop(); onExit?.(); return; }
      if(action==='replay') { speak(); return; }
      if(action==='reset') { cancelFlight(); step=0; }
      else if(action==='next'&&(step===0||step===5||step===6)) step=step===6?0:step+1;
      else if(action==='left'&&!flight&&(step===1||step===3)) { removeBox(button,action); return; }
      else if(action==='right'&&!flight&&(step===2||step===4)) { removeBox(button,action); return; }
      else return;
      render(); speak();
      focusNext();
    }
    function languageChanged() { cancelFlight(); render(); speak(); }
    root.addEventListener('click',click); document.addEventListener('jm-langchange',languageChanged);
    render(); speak();
    return () => { disposed=true;cancelFlight();stop();root.removeEventListener('click',click);document.removeEventListener('jm-langchange',languageChanged); };
  }
  window.JacobEquations={mount};
})();
