/* Guided balance lesson. Practice state is local to this mount.
   Vis udregning (step 5) plays the cancellation: a zero result fades out
   over 2s, the other side shows its remaining value, then x and that value
   move in toward the equals sign. Numbers come from LESSON, not from literals
   inside the animation. */
(() => {
  'use strict';
  const MINUS = ' − ';
  const PLUS = '+';
  const MORPH_MS = 1200;
  // x + added = total. Two guided removals: one unit, then the rest of `added`.
  // The shipped lesson is 2 and 6 (x = 4). The reveal reads these fields.
  const LESSON = { added: 2, total: 6 };
  const COPY = {
    da: { title:'Ligninger', intro:'Ligninger er en vægt i ligevægt!', remove:'Prøv at fjerne en vægt', same:'Du skal gøre det samme på begge sider.', alone:'X skal stå for sig selv.', done:'Nu står X for sig selv. X er lig med fire!', start:'Prøv selv', back:'← Tilbage til sandbox', replay:'Hør igen', reset:'Prøv igen', left:'Fjern en kasse til venstre', right:'Fjern en kasse til højre', balanced:'I ligevægt', unbalanced:'Ikke i ligevægt', finish:'Vis udregning', hint:'Fjern den sidste lille kasse til venstre.', rightHint:'Fjern også én kasse til højre.', zero:'NUL' },
    en: { title:'Equations', intro:'An equation is a balanced scale!', remove:'Try removing a weight', same:'You must do the same on both sides.', alone:'X must stand on its own.', done:'Now X is on its own. X equals four!', start:'Try it', back:'← Back to sandbox', replay:'Listen again', reset:'Try again', left:'Remove a box on the left', right:'Remove a box on the right', balanced:'Balanced', unbalanced:'Not balanced', finish:'Show the calculation', hint:'Remove the last small box on the left.', rightHint:'Remove one box on the right too.', zero:'ZERO' }
  };
  function workingScript(input) {
    const leftResult = input.added - input.leftRemoved;
    const rightResult = input.total - input.rightRemoved;
    return {
      added: input.added,
      total: input.total,
      leftRemoved: input.leftRemoved,
      rightRemoved: input.rightRemoved,
      leftResult,
      rightResult,
      leftFades: leftResult === 0,
      rightFades: rightResult === 0
    };
  }
  function mount(root, {onExit} = {}) {
    let step = 0, disposed = false, serial = 0, flight = null, reveal = null, revealToken = 0;
    const revealAnims = [];
    const lang = () => document.documentElement.lang.startsWith('en') ? 'en' : 'da';
    const t = () => COPY[lang()];
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
    function removedFor(current) {
      return {
        left: current >= 4 ? LESSON.added : current >= 2 ? 1 : 0,
        right: current >= 5 ? LESSON.added : current >= 3 ? 1 : 0
      };
    }
    function scriptNow() {
      const removed = removedFor(step);
      return workingScript({ added: LESSON.added, leftRemoved: removed.left, total: LESSON.total, rightRemoved: removed.right });
    }
    function canAnimate() {
      if (!find('.eq-equation')?.animate) return false;
      return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true;
    }
    function cancelFlight() {
      if (!flight) return;
      const old = flight; flight = null;
      old.animation?.cancel(); old.ghost?.remove();
    }
    function cancelReveal() {
      revealToken++;
      reveal = null;
      const pending = revealAnims.splice(0);
      for (const animation of pending) animation.cancel?.();
    }
    function track(el, frames, options) {
      if (!el?.animate) return Promise.resolve(true);
      const animation = el.animate(frames, options);
      revealAnims.push(animation);
      return animation.finished.then(() => true, () => false);
    }
    function going(token, result) {
      if (disposed || token !== revealToken || !reveal) return false;
      if (result === false) return false;
      return !Array.isArray(result) || !result.includes(false);
    }
    function focusNext() {
      const target=find('.eq-active .eq-box')||find('[data-eq="next"]');
      if(target && !target.hidden && !target.disabled) target.focus({preventScroll:true});
    }
    function removeBox(button, side) {
      if (flight || reveal) return;
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
    function calcMarkup(lead, removed, result, fades) {
      const word = fades ? `<span class="eq-calc-word">${t().zero}</span>` : '';
      return `<span class="eq-calc"><span class="eq-calc-from"><span>${lead}</span><span class="eq-subtraction">${MINUS}${removed}</span></span><span class="eq-calc-to" aria-hidden="true"><span class="eq-calc-value">${result}</span>${word}</span></span>`;
    }
    function phase(name) {
      const equation = find('.eq-equation');
      if (equation) equation.dataset.phase = name;
    }
    function morph(calc) {
      const from = calc.querySelector('.eq-calc-from');
      const to = calc.querySelector('.eq-calc-to');
      to.removeAttribute('aria-hidden');
      const options = { duration: MORPH_MS, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' };
      return Promise.all([
        track(from, [
          { opacity: 1, transform: 'translateY(0px)', offset: 0 },
          { opacity: 1, transform: 'translateY(0px)', offset: .42 },
          { opacity: 0, transform: 'translateY(-18px)', offset: 1 }
        ], options),
        track(to, [
          { opacity: 0, transform: 'translateY(16px) scale(.92)', offset: 0 },
          { opacity: 0, transform: 'translateY(16px) scale(.92)', offset: .42 },
          { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }
        ], options)
      ]);
    }
    function slide(el, dx) {
      if (!el || !Number.isFinite(dx) || Math.abs(dx) < 0.5) return Promise.resolve(true);
      return track(el, [
        { transform: `translateX(${dx}px)` },
        { transform: 'translateX(0px)' }
      ], { duration: 1200, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
    }
    async function approach(script) {
      const equation = find('.eq-equation');
      const leftMover = script.leftFades ? find('.eq-var') : find('.eq-expression-left');
      const rightMover = script.rightFades ? null : find('.eq-expression-right .eq-calc-value');
      const firstLeft = leftMover.getBoundingClientRect();
      const firstRight = rightMover ? rightMover.getBoundingClientRect() : null;
      if (script.leftFades) find('.eq-vanish')?.remove();
      find('.eq-expression-right .eq-calc-from')?.remove();
      if (script.rightFades) find('.eq-expression-right .eq-calc')?.remove();
      equation.classList.add('eq-isolated');
      const lastLeft = leftMover.getBoundingClientRect();
      const lastRight = rightMover ? rightMover.getBoundingClientRect() : null;
      return Promise.all([
        slide(leftMover, firstLeft.left - lastLeft.left),
        slide(rightMover, firstRight && lastRight ? firstRight.left - lastRight.left : 0)
      ]);
    }
    async function showWorking() {
      if (reveal || flight || step !== 5) return;
      stop();
      const script = scriptNow();
      if (!canAnimate()) { step = 6; render(); speak(); focusNext(); return; }
      const token = ++revealToken;
      reveal = script;
      render();
      phase('left');
      let result = await morph(find('.eq-expression-left .eq-calc'));
      if (!going(token, result)) return;
      if (script.leftFades) {
        phase('fade');
        result = await track(find('.eq-vanish'), [
          { opacity: 1 },
          { opacity: 0 }
        ], { duration: 2000, easing: 'ease-in', fill: 'forwards' });
        if (!going(token, result)) return;
      }
      phase('right');
      result = await morph(find('.eq-expression-right .eq-calc'));
      if (!going(token, result)) return;
      if (script.rightFades) {
        phase('fade-right');
        result = await track(find('.eq-expression-right .eq-calc'), [
          { opacity: 1 },
          { opacity: 0 }
        ], { duration: 2000, easing: 'ease-in', fill: 'forwards' });
        if (!going(token, result)) return;
      }
      phase('approach');
      result = await approach(script);
      if (!going(token, result)) return;
      reveal = null;
      step = 6;
      render();
      speak();
      focusNext();
    }
    function render() {
      const c=t();
      const removed = removedFor(step);
      const leftRemoved = removed.left, rightRemoved = removed.right;
      const balanced=leftRemoved===rightRemoved;
      const script = reveal || null;
      find('h1').textContent=c.title; find('.eq-prompt').textContent=c[key()];
      find('.eq-hint').textContent=step===3?c.hint:step===2||step===4?c.rightHint:'';
      for(const action of ['back','replay','reset']) find(`[data-eq="${action}"]`).textContent=c[action];
      find('.eq-scale').classList.toggle('eq-unbalanced',!balanced);
      for(const side of ['left','right']) {
        const count=side==='left'?LESSON.added-leftRemoved:LESSON.total-rightRemoved;
        const enabled=!flight && !reveal && (side==='left'?(step===1||step===3):(step===2||step===4));
        const pan=find('.eq-'+side); pan.classList.toggle('eq-active',enabled);
        pan.querySelector('.eq-boxes').innerHTML=Array.from({length:count},()=>`<button type="button" class="eq-box" data-eq="${side}" aria-label="${c[side]}" ${enabled?'':'disabled'}>1</button>`).join('');
      }
      const answer = String(LESSON.total - LESSON.added);
      if (script) {
        const leftCalc = calcMarkup(script.added, script.leftRemoved, script.leftResult, script.leftFades);
        const leftBody = script.leftFades ? `<span class="eq-vanish"><span class="eq-plus">${PLUS}</span>${leftCalc}</span>` : `<span class="eq-plus">${PLUS}</span>${leftCalc}`;
        find('.eq-expression-left').innerHTML=`<span class="eq-var">x</span>${leftBody}`;
        find('.eq-expression-right').innerHTML=calcMarkup(script.total, script.rightRemoved, script.rightResult, script.rightFades);
      } else {
        for (const [side, removedCount, base] of [['left',leftRemoved,`x + ${LESSON.added}`],['right',rightRemoved,String(LESSON.total)]]) {
          const shown = flight?.side === side ? flight.previous : removedCount;
          find('.eq-expression-'+side).innerHTML=step===6 ? (side==='left'?'x':answer) :
            `<span>${base}</span><span class="eq-subtraction ${shown ? '' : 'eq-empty'}">${shown ? MINUS+shown : ''}</span>`;
        }
      }
      const equation = find('.eq-equation');
      equation.classList.toggle('eq-isolated', step===6);
      equation.classList.toggle('eq-calculating', !!script);
      if (!script) delete equation.dataset.phase;
      const sign=find('.eq-sign'); sign.textContent=balanced?'=':'≠'; sign.classList.toggle('eq-red',!balanced);
      find('.eq-status').textContent=balanced?c.balanced:c.unbalanced;
      const next=find('[data-eq="next"]'); next.disabled=Boolean(flight)||Boolean(script); next.hidden=(step!==0&&step!==5&&step!==6)||Boolean(script); next.textContent=step===0?c.start:step===5?c.finish:c.reset;
      const replay=find('[data-eq="replay"]'); replay.disabled=Boolean(script);
      find('.eq-progress').textContent='●'.repeat(step+1)+'○'.repeat(6-step);
    }
    function click(event) {
      const button=event.target.closest('[data-eq]'); if(!button||!root.contains(button)||button.disabled) return;
      const action=button.dataset.eq;
      if(action==='back') { cancelFlight(); cancelReveal(); stop(); onExit?.(); return; }
      if(action==='replay') { if(reveal) return; speak(); return; }
      if(action==='reset') { cancelFlight(); cancelReveal(); step=0; }
      else if(action==='next' && step===5) { showWorking(); return; }
      else if(action==='next'&&(step===0||step===6)) step=step===6?0:step+1;
      else if(action==='left'&&!flight&&!reveal&&(step===1||step===3)) { removeBox(button,action); return; }
      else if(action==='right'&&!flight&&!reveal&&(step===2||step===4)) { removeBox(button,action); return; }
      else return;
      render(); speak();
      focusNext();
    }
    function languageChanged() {
      const midReveal = !!reveal;
      cancelFlight();
      cancelReveal();
      if (midReveal) step = 6;
      render();
      speak();
    }
    root.addEventListener('click',click); document.addEventListener('jm-langchange',languageChanged);
    for(const line of ['intro','remove','same','alone','done']) clip(lang(),line);
    render(); speak();
    return () => { disposed=true;cancelFlight();cancelReveal();stop();clips.clear();root.removeEventListener('click',click);document.removeEventListener('jm-langchange',languageChanged); };
  }
  window.JacobEquations={mount, workingScript};
})();
