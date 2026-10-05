/* Luigi's ten friends: Jacob-only pilot. All progress is session-only. */
(() => {
  'use strict';
  const PILOT_ID = 'c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
  const numbers = [1,2,3,4,5,6,7,8,9];
  const isEnabled = user => user?.id === PILOT_ID && user.role === 'teacher';
  const shuffle = values => {
    const result = [...values];
    for (let i=result.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  };
  function character(n, small=false) {
    return `<span class="pf-character${small?' pf-character-small':''}"><img src="assets/pizza-friends/courier-${n}.webp" alt="Pizzabud ${n} med ${n} pizzastykke${n===1?'':'r'}" width="384" height="384"></span>`;
  }
  function pizza(n, complete=false) {
    const point = angle => [100+78*Math.cos(angle),100+78*Math.sin(angle)].map(v=>v.toFixed(3)).join(' ');
    return `<svg class="pf-pizza" viewBox="0 0 200 200" role="img" aria-label="${complete?`${n} plus ${10-n} er 10 pizzastykker`:`Pizza med 10 pladser: ${n} pizzastykker og ${10-n} tomme pladser`}"><circle cx="100" cy="100" r="86" fill="#fff8e7" stroke="#dcb785" stroke-width="3"/>${Array.from({length:10},(_,i)=>{
      const a=-Math.PI/2+i*Math.PI/5, b=a+Math.PI/5;
      const filled=i<n||complete;
      return `<path d="M100 100 L${point(a)} A78 78 0 0 1 ${point(b)} Z" fill="${i<n?'#ffb64f':complete?'#b6a0ed':'#fff8e7'}" stroke="${filled?'#92552d':'#c6b7a0'}" stroke-width="2" ${filled?'':'stroke-dasharray="4 3"'}/>${filled?`<circle cx="${(100+48*Math.cos((a+b)/2)).toFixed(2)}" cy="${(100+48*Math.sin((a+b)/2)).toFixed(2)}" r="6" fill="${i<n?'#e5633c':'#7660ae'}"/>`:''}`;
    }).join('')}</svg>`;
  }
  function mount(root,{user,onExit}={}) {
    if (!isEnabled(user)) { root.replaceChildren(); return ()=>{}; }
    let active=true,phase='intro',order=[],index=0,locked=false,misses=0,hinted=false,firstTry=0;
    const q = selector => root.querySelector(selector);
    function layout(content) {
      root.innerHTML=`<section class="pf-page"><nav class="pf-nav"><button type="button" class="pf-back" data-pf-exit>← Tilbage</button><span class="pf-pilot">Testversion · Jacob</span></nav><div class="pf-heading"><span class="pf-eyebrow">LUIGIS PIZZERIA</span><h1>10’er-vennerne</h1><p>Hvem er dit tals pizzamakker?</p></div>${content}</section>`;
    }
    function intro() {
      phase='intro'; locked=false;
      layout(`<div class="pf-story"><img class="pf-luigi" src="assets/figurer/luigi-laekkermat-cutout.webp" alt="Luigi Lækkermat" width="160" height="192"><div><h2>Én pizza. 10 slices. To pizzabude.</h2><p>Luigi Lækkermat skærer hver pizza i <strong>10 stykker</strong>. Hans pizzabude hedder 1 til 9.</p><p>1 bærer ét stykke. 6 bærer seks. De hjælper hinanden i par, så de har <strong>præcis 10</strong> tilsammen.</p><p>5 skal have en anden 5’er som makker!</p><button type="button" class="pf-primary" data-pf-start>Find pizzamakkerne →</button></div></div><h2 class="pf-roster-title">Mød Luigis ni pizzabude</h2><div class="pf-roster">${numbers.map(n=>`<div class="pf-roster-card">${character(n)}<strong>${n}</strong><span>${n} slice${n===1?'':'s'}</span></div>`).join('')}</div>`);
    }
    function task(focus=false) {
      phase='play'; locked=false; misses=0; hinted=false;
      const n=order[index];
      layout(`<div class="pf-progress"><span>Pizza ${index+1} af 9</span><span>${index} leveret</span><progress value="${index}" max="9" aria-label="Leverede pizzaer"></progress></div><div class="pf-work"><section class="pf-order" aria-labelledby="pf-question"><div class="pf-current">${character(n)}<div><span class="pf-eyebrow">PIZZABUD ${n}</span><h2 id="pf-question">${n} har ${n} slice${n===1?'':'s'}.<br>Hvem har resten?</h2></div></div><div class="pf-equation" aria-label="${n} plus hvilket tal er 10?"><span>${n}</span><span>+</span><span class="pf-missing">?</span><span>=</span><span>10</span></div><div id="pf-pizza">${pizza(n)}</div><p class="pf-pizza-caption">Fyld de tomme pladser, så pizzaen bliver hel.</p><button type="button" class="pf-hint" data-pf-hint>Hjælp mig med at tælle</button><div id="pf-feedback" class="pf-feedback" role="status" aria-live="polite"></div><div id="pf-next"></div></section><section class="pf-choices" aria-labelledby="pf-choice-title"><h2 id="pf-choice-title">Vælg pizzamakkeren</h2><div class="pf-choice-grid">${numbers.map(m=>`<button type="button" class="pf-choice" data-pf-answer="${m}" aria-label="Vælg pizzabud ${m}, som har ${m} slices">${character(m,true)}<span>${m}</span></button>`).join('')}</div><p class="pf-keyboard">Du kan også bruge tasterne 1–9.</p></section></div>`);
      if(focus) q(`[data-pf-answer="1"]`).focus({preventScroll:true});
    }
    function start() { order=shuffle(numbers); index=0; firstTry=0; task(); }
    function answer(value) {
      if(!active||phase!=='play'||locked||!numbers.includes(value))return;
      const n=order[index], feedback=q('#pf-feedback');
      q('.pf-choice.is-wrong')?.classList.remove('is-wrong');
      if(n+value!==10) {
        misses++;
        q(`[data-pf-answer="${value}"]`).classList.add('is-wrong');
        feedback.className='pf-feedback';
        feedback.textContent=`${n} + ${value} = ${n+value}. ${n+value<10?'Der mangler stadig pizzastykker.':'Det er flere end 10 pizzastykker.'} Prøv en anden makker.`;
        return;
      }
      locked=true;
      if(!misses&&!hinted)firstTry++;
      q('.pf-missing').textContent=value;
      q('.pf-missing').classList.add('pf-found');
      q('#pf-pizza').innerHTML=pizza(n,true);
      q(`[data-pf-answer="${value}"]`).classList.add('is-correct');
      root.querySelectorAll('[data-pf-answer],[data-pf-hint]').forEach(el=>el.disabled=true);
      feedback.className='pf-feedback pf-success';
      feedback.textContent=`Sådan! ${n} og ${value} er 10’er-venner. Sammen har de en hel pizza!`;
      q('#pf-next').innerHTML=`<div class="pf-pair">${character(n,true)}<span>+</span>${character(value,true)}</div><button type="button" class="pf-primary" data-pf-next>${index===8?'Se alle pizzamakkerne':'Levér pizzaen →'}</button>`;
      q('[data-pf-next]').focus({preventScroll:true});
    }
    function finish() {
      phase='done'; locked=true;
      layout(`<section class="pf-finish"><img class="pf-luigi" src="assets/figurer/luigi-laekkermat-cutout.webp" alt="Luigi Lækkermat" width="160" height="192"><span class="pf-eyebrow">9 PIZZAER LEVERET</span><h2>Perfetto! Du fandt alle makkerne.</h2><p>${firstTry} af 9 fundet uden hjælp eller ekstra forsøg.</p><div class="pf-pairs">${[1,2,3,4,5].map(n=>`<div>${character(n,true)}<strong>${n} + ${10-n} = 10</strong>${character(10-n,true)}</div>`).join('')}</div><button type="button" class="pf-primary" data-pf-start>Øv pizzamakkerne igen ↻</button><button type="button" class="pf-back" data-pf-exit>Tilbage</button></section>`);
      q('[data-pf-start]').focus({preventScroll:true});
    }
    function click(event) {
      if(event.target.closest('[data-pf-exit]')) { onExit?.(); return; }
      if(event.target.closest('[data-pf-start]')&&phase!=='play') { start(); return; }
      const choice=event.target.closest('[data-pf-answer]');
      if(choice)answer(Number(choice.dataset.pfAnswer));
      if(event.target.closest('[data-pf-hint]')&&phase==='play'&&!locked) {
        hinted=true;const n=order[index];
        q('#pf-feedback').textContent=`Tæl videre fra ${n}: ${Array.from({length:10-n},(_,i)=>n+i+1).join(', ')}. Du talte ${10-n} videre. Find buddet med ${10-n} slices.`;
      }
      if(event.target.closest('[data-pf-next]')&&phase==='play'&&locked) { index++;if(index===9)finish();else task(true); }
    }
    function key(event) {
      if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
      if(/^[1-9]$/.test(event.key)&&phase==='play'&&!locked) { event.preventDefault();answer(Number(event.key)); }
    }
    root.addEventListener('click',click);document.addEventListener('keydown',key);intro();
    return ()=>{active=false;root.removeEventListener('click',click);document.removeEventListener('keydown',key);};
  }
  window.LuigiTenFriends={isEnabled,mount,pizza};
})();
