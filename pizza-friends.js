/* Luigi's ten friends: shared pizza deliveries for every learner. */
(() => {
  'use strict';
  const TRAYS = {"1":{"x":37.12,"y":47.267,"w":45.543,"h":18.672},"2":{"x":25.576,"y":48.318,"w":44.206,"h":18.125},"3":{"x":18.938,"y":48.178,"w":45.543,"h":18.672},"4":{"x":30.633,"y":48.697,"w":49.079,"h":20.69},"5":{"x":26.018,"y":49.193,"w":45.532,"h":19.009},"6":{"x":16.311,"y":47.945,"w":49.805,"h":21.276},"7":{"x":38.296,"y":42.944,"w":44.725,"h":18.671},"8":{"x":25.054,"y":43.595,"w":44.29,"h":19.54},"9":{"x":24.356,"y":43.595,"w":44.725,"h":18.671}}; // Filled from the sprite atlas crop coordinates.
  const numbers = [1,2,3,4,5,6,7,8,9];
  const customers = [
    {name:'Øbbe Øvdig',image:'assets/figurer/obbe-ovdig.png',thanks:'Tak, pizzavenner! Stærkt samarbejde!'},
    {name:'Kaptajn Kvadratrod',image:'assets/figurer/kaptajn-kvadratrod.webp',thanks:'En hel pizza! I er et superhold!'},
    {name:'Matematikhunden Marley',image:'assets/figurer/marley.webp',thanks:'Vuf! Tak, mine gode pizzavenner!'},
    {name:'Divisions-Dennis',image:'assets/figurer/divisions-dennis.webp',thanks:'Tak! Alle 10 slices er med!'}
  ];
  const isEnabled = user => Boolean(user?.id && ['student','teacher','guest'].includes(user.role));
  const shuffle = values => {
    const result = [...values];
    for (let i=result.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  };
  // The held pizza is exact geometry: n adjacent sectors of 36 degrees.
  function heldPizza(n) {
    const point = angle => [100+91*Math.cos(angle),100+91*Math.sin(angle)].map(v=>v.toFixed(3)).join(' ');
    return `<svg class="pf-held-pizza" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true">${Array.from({length:n},(_,i)=>{
      const a=-Math.PI/2+i*Math.PI/5,b=a+Math.PI/5;
      return `<path d="M100 100 L${point(a)} A91 91 0 0 1 ${point(b)} Z" fill="#ffd05b" stroke="#a45a25" stroke-width="2"/><path d="M${point(a)} A91 91 0 0 1 ${point(b)}" fill="none" stroke="#d58432" stroke-width="9"/><circle cx="${(100+57*Math.cos((a+b)/2)).toFixed(3)}" cy="${(100+57*Math.sin((a+b)/2)).toFixed(3)}" r="9" fill="#da5334"/>`;
    }).join('')}</svg>`;
  }
  function character(n, small=false) {
    const tray=TRAYS[n];
    return `<span class="pf-character${small?' pf-character-small':''}"><img src="assets/pizza-friends/courier-${n}-v2.webp" alt="Pizzabud ${n} med ${n} sammenhængende tiendedele af en pizza" width="384" height="384"><span class="pf-held-position" style="left:${tray.x}%;top:${tray.y}%;width:${tray.w}%;height:${tray.h}%">${heldPizza(n)}</span></span>`;
  }
  function pizza(n, complete=false) {
    const point = angle => [100+78*Math.cos(angle),100+78*Math.sin(angle)].map(v=>v.toFixed(3)).join(' ');
    return `<svg class="pf-pizza" viewBox="0 0 200 200" role="img" aria-label="${complete?`${n} plus ${10-n} er 10 pizzastykker`:`Pizza med 10 pladser: ${n} pizzastykker og ${10-n} tomme pladser`}"><circle cx="100" cy="100" r="86" fill="#fff8e7" stroke="#dcb785" stroke-width="3"/>${Array.from({length:10},(_,i)=>{
      const a=-Math.PI/2+i*Math.PI/5, b=a+Math.PI/5;
      const filled=i<n||complete;
      return `<path d="M100 100 L${point(a)} A78 78 0 0 1 ${point(b)} Z" fill="${i<n?'#ffb64f':complete?'#b6a0ed':'#fff8e7'}" stroke="${filled?'#92552d':'#c6b7a0'}" stroke-width="2" ${filled?'':'stroke-dasharray="4 3"'}/>${filled?`<circle cx="${(100+48*Math.cos((a+b)/2)).toFixed(2)}" cy="${(100+48*Math.sin((a+b)/2)).toFixed(2)}" r="6" fill="${i<n?'#e5633c':'#7660ae'}"/>`:''}`;
    }).join('')}</svg>`;
  }
  // One foreground tray hides both individual trays. Both couriers grip its rim.
  // Reuse the same numeral characters, while exact SVG geometry keeps ten slices.
  function carryingPair(n) {
    const m=10-n;
    return `<svg class="pf-carrying-pair" viewBox="0 0 420 250" role="img" aria-label="${n} og ${m} står sammen og bærer én fælles pizzabakke med en hel pizza delt i 10 slices">
      <ellipse cx="210" cy="232" rx="177" ry="11" fill="#302044" opacity=".12"/>
      <image href="assets/pizza-friends/courier-${n}-v2.webp" x="0" y="0" width="230" height="230"/>
      <image href="assets/pizza-friends/courier-${m}-v2.webp" x="190" y="0" width="230" height="230"/>
      <g class="pf-shared-tray">
        <ellipse cx="210" cy="145" rx="195" ry="58" fill="#626568" stroke="#33363a" stroke-width="4"/>
        <ellipse cx="210" cy="138" rx="192" ry="54" fill="#c6c9ca" stroke="#f4f5f5" stroke-width="4"/>
        <g transform="translate(70 82) scale(1.4 .53)">${pizza(n,true).replace(/<svg[^>]*>/,'').replace('</svg>','')}</g>
        <path d="M35 148 C23 134 9 139 12 153 C2 148 0 162 10 170 C9 183 28 186 41 174 L49 164 C54 154 45 151 35 158 Z" fill="#fff" stroke="#34343c" stroke-width="3"/>
        <path d="M385 148 C397 134 411 139 408 153 C418 148 420 162 410 170 C411 183 392 186 379 174 L371 164 C366 154 375 151 385 158 Z" fill="#fff" stroke="#34343c" stroke-width="3"/>
        <path d="M15 157 L27 169 M405 157 L393 169" fill="none" stroke="#a9afb3" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>`;
  }
  function customerCard(customer) {
    return `<div class="pf-customer"><img src="${customer.image}" alt="${customer.name}" width="160" height="160"><strong>${customer.name}</strong></div>`;
  }
  function mount(root,{user,onExit,onResult}={}) {
    if (!isEnabled(user)) { root.replaceChildren(); return ()=>{}; }
    let active=true,phase='intro',order=[],index=0,locked=false,misses=0,hinted=false,firstTry=0,deliveryTimer=null,taskStartedAt=0;
    const q = selector => root.querySelector(selector);
    function layout(content) {
      root.innerHTML=`<section class="pf-page"><nav class="pf-nav"><button type="button" class="pf-back" data-pf-exit>← Tilbage</button><span class="pf-pilot">Luigis 10’er-venner</span></nav><div class="pf-heading"><span class="pf-eyebrow">LUIGIS PIZZERIA</span><h1>10’er-vennerne</h1><p>Find tallenes gode venner.</p></div>${content}</section>`;
    }
    function intro() {
      phase='intro'; locked=false;
      layout(`<div class="pf-story"><img class="pf-luigi" src="assets/figurer/luigi-laekkermat-cutout.webp" alt="Luigi Lækkermat" width="160" height="192"><div><h2>Én pizza. 10 slices. To pizzabude.</h2><p>Luigi Lækkermat skærer hver pizza i <strong>10 stykker</strong>. Hans pizzabude hedder 1 til 9.</p><p>1 bærer 1 af pizzaens 10 stykker. 6 bærer 6 stykker, der sidder sammen. De hjælper hinanden i par, så de har <strong>præcis 10</strong> tilsammen.</p><p>5 skal have en anden 5’er som makker!</p><button type="button" class="pf-primary" data-pf-start>Find pizzamakkerne →</button></div></div><h2 class="pf-roster-title">Mød Luigis ni pizzabude</h2><div class="pf-roster">${numbers.map(n=>`<div class="pf-roster-card">${character(n)}<strong>${n}</strong><span>${n} slice${n===1?'':'s'}</span></div>`).join('')}</div>`);
    }
    function task(focus=false) {
      phase='play'; locked=false; misses=0; hinted=false;
      taskStartedAt=Date.now();
      const n=order[index];
      layout(`<div class="pf-progress"><span>Pizza ${index+1} af 9</span><span>${index} leveret</span><progress value="${index}" max="9" aria-label="Leverede pizzaer"></progress></div><div class="pf-work"><section class="pf-order" aria-labelledby="pf-question"><div class="pf-current">${character(n)}<div><span class="pf-eyebrow">PIZZABUD ${n}</span><h2 id="pf-question">Hvem er ${n}'s gode ven?</h2></div></div><div class="pf-equation" aria-label="${n} plus hvilket tal er 10?"><span>${n}</span><span>+</span><span class="pf-missing">?</span><span>=</span><span>10</span></div><div id="pf-pizza">${pizza(n)}</div><p class="pf-pizza-caption">Fyld de tomme pladser, så pizzaen bliver hel.</p><button type="button" class="pf-hint" data-pf-hint>Hjælp mig med at tælle</button><div id="pf-feedback" class="pf-feedback" role="status" aria-live="polite"></div><div id="pf-next"></div></section><section class="pf-choices" aria-labelledby="pf-choice-title"><h2 id="pf-choice-title">Vælg den gode ven</h2><div class="pf-choice-grid">${numbers.map(m=>`<button type="button" class="pf-choice" data-pf-answer="${m}" aria-label="Vælg pizzabud ${m}, som har ${m} slices">${character(m,true)}<span>${m}</span></button>`).join('')}</div><p class="pf-keyboard">Du kan også bruge tasterne 1–9.</p></section></div>`);
      if(focus) q(`[data-pf-answer="1"]`).focus({preventScroll:true});
    }
    function start() { order=shuffle(numbers); index=0; firstTry=0; task(); }
    async function answer(value) {
      if(!active||phase!=='play'||locked||!numbers.includes(value))return;
      locked=true;
      const n=order[index], feedback=q('#pf-feedback');
      const controls=root.querySelectorAll('[data-pf-answer],[data-pf-hint]');
      controls.forEach(el=>el.disabled=true);
      const correct=n+value===10;
      const result={topic:'tenFriends',problem:`${n} + ? = 10`,answer:value,correctAnswer:10-n,correct,responseTime:Math.max(.1,(Date.now()-taskStartedAt)/1000),timestamp:new Date().toISOString(),hintUsed:hinted};
      try { await onResult?.(result); }
      catch(error) {
        if(!active)return;
        locked=false; controls.forEach(el=>el.disabled=false);
        feedback.className='pf-feedback';
        feedback.textContent='Svaret kunne ikke gemmes. Prøv igen.';
        return;
      }
      if(!active)return;
      q('.pf-choice.is-wrong')?.classList.remove('is-wrong');
      if(!correct) {
        locked=false;controls.forEach(el=>el.disabled=false);taskStartedAt=Date.now();
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
      feedback.textContent=`Sådan! ${n} og ${value} er gode venner. Sammen har de en hel pizza!`;
      const customer=customers[index%customers.length];
      q('#pf-next').innerHTML=`<div class="pf-pair">${carryingPair(n)}</div><p class="pf-carry-caption">${n} og ${value} hjælper hinanden med at bære!</p><button type="button" class="pf-primary" data-pf-next>Levér til ${customer.name} →</button>`;
      q('[data-pf-next]').focus({preventScroll:true});
    }
    function deliver() {
      if(!active||phase!=='play'||!locked)return;
      phase='delivering';
      const n=order[index],customer=customers[index%customers.length];
      layout(`<section class="pf-delivery"><span class="pf-eyebrow">PIZZA ${index+1} AF 9</span><h2>Pizza på vej til ${customer.name}!</h2><p>${n} og ${10-n} bærer pizzabakken sammen.</p><div class="pf-delivery-scene is-delivering"><div class="pf-delivery-team">${carryingPair(n)}</div>${customerCard(customer)}<div class="pf-delivered-tray" hidden>${pizza(n,true)}</div></div><div class="pf-delivery-status" role="status" aria-live="polite">Her kommer jeres pizza!</div><div id="pf-delivery-next"></div></section>`);
      deliveryTimer=setTimeout(()=>{
        deliveryTimer=null;
        if(!active||phase!=='delivering')return;
        phase='delivered';
        q('.pf-delivery-scene').classList.replace('is-delivering','is-delivered');
        q('.pf-delivered-tray').hidden=false;
        q('.pf-delivery h2').textContent=`Pizzaen er leveret til ${customer.name}!`;
        q('.pf-delivery-status').textContent=customer.thanks;
        q('#pf-delivery-next').innerHTML=`<button type="button" class="pf-primary" data-pf-continue>${index===8?'Se alle pizzamakkerne':'Find næste pizzamakker →'}</button>`;
        q('[data-pf-continue]').focus({preventScroll:true});
      },1800);
    }
    function finish() {
      phase='done'; locked=true;
      layout(`<section class="pf-finish"><img class="pf-luigi" src="assets/figurer/luigi-laekkermat-cutout.webp" alt="Luigi Lækkermat" width="160" height="192"><span class="pf-eyebrow">9 PIZZAER LEVERET</span><h2>Perfetto! Du fandt alle makkerne.</h2><p>${firstTry} af 9 fundet uden hjælp eller ekstra forsøg.</p><p>I bar pizzaerne sammen til Øbbe Øvdig, Kaptajn Kvadratrod, Matematikhunden Marley og Divisions-Dennis!</p><div class="pf-pairs">${[1,2,3,4,5].map(n=>`<div>${carryingPair(n)}<strong>${n} + ${10-n} = 10</strong></div>`).join('')}</div><button type="button" class="pf-primary" data-pf-start>Øv pizzamakkerne igen ↻</button><button type="button" class="pf-back" data-pf-exit>Tilbage</button></section>`);
      q('[data-pf-start]').focus({preventScroll:true});
    }
    function click(event) {
      if(event.target.closest('[data-pf-exit]')) { onExit?.(); return; }
      if(event.target.closest('[data-pf-start]')&&(phase==='intro'||phase==='done')) { start(); return; }
      const choice=event.target.closest('[data-pf-answer]');
      if(choice)answer(Number(choice.dataset.pfAnswer));
      if(event.target.closest('[data-pf-hint]')&&phase==='play'&&!locked) {
        hinted=true;const n=order[index];
        q('#pf-feedback').textContent=`Tæl videre fra ${n}: ${Array.from({length:10-n},(_,i)=>n+i+1).join(', ')}. Du talte ${10-n} videre. Find buddet med ${10-n} slices.`;
      }
      if(event.target.closest('[data-pf-next]')) { deliver(); return; }
      if(event.target.closest('[data-pf-continue]')&&phase==='delivered') { index++;if(index===9)finish();else task(true); }
    }
    function key(event) {
      if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
      if(/^[1-9]$/.test(event.key)&&phase==='play'&&!locked) { event.preventDefault();answer(Number(event.key)); }
    }
    root.addEventListener('click',click);document.addEventListener('keydown',key);intro();
    return ()=>{active=false;clearTimeout(deliveryTimer);root.removeEventListener('click',click);document.removeEventListener('keydown',key);};
  }
  window.LuigiTenFriends={isEnabled,mount,pizza,heldPizza,carryingPair};
})();
