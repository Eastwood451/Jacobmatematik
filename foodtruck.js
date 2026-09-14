/* Luigi's food truck: an isolated game view inside the signed-in app. */
(() => {
  'use strict';
  const INGREDIENTS = [
    {id:'tomato',name:'Tomat',plural:'tomater',unit:'tomat',question:'Hvor meget af en tomat putter Luigi i hver burger?',color:'#e65c43'},
    {id:'patty',name:'Bøf',plural:'kg hakket oksekød',unit:'kg oksekød',question:'Hvor mange kg oksekød bruger Luigi til hver bøf?',color:'#88533d'},
    {id:'cheese',name:'Ost',plural:'skiver ost',unit:'skive ost',question:'Hvor mange skiver ost får hver burger?',color:'#efbb42'},
    {id:'pickle',name:'Agurk',plural:'agurker',unit:'agurk',question:'Hvor meget af en agurk putter Luigi i hver burger?',color:'#658e45'},
    {id:'onion',name:'Rødløg',plural:'rødløg',unit:'rødløg',question:'Hvor meget af et rødløg putter Luigi i hver burger?',color:'#aa6a99'}
  ];
  function createOrder(index) {
    const guests = [5,6,8,10,12][index % 5];
    const amounts = index === 0 ? [3,1,5,2,2] : [Math.max(2,guests-3),Math.ceil(guests/4),guests+Math.floor(guests/2),Math.ceil(guests/3),Math.ceil(guests/4)];
    return {guests,steps:INGREDIENTS.map((item,i)=>({...item,amount:amounts[i]}))};
  }
  function answerMatches(value,numerator,denominator) {
    const match = String(value).trim().match(/^(\d{1,4})(?:\s*\/\s*(\d{1,4}))?$/);
    if (!match) return false;
    const n=Number(match[1]), d=match[2]===undefined?1:Number(match[2]);
    return d>0 && n*denominator===numerator*d;
  }
  function fraction(n,d) {
    const gcd=(a,b)=>b?gcd(b,a%b):a;
    const g=gcd(n,d); return d/g===1?String(n/g):`${n/g}/${d/g}`;
  }
  const tomato = (x,y,r=48) => `<g transform="translate(${x} ${y})"><ellipse rx="${r}" ry="${r*.37}" fill="#de4d38" stroke="#a83026" stroke-width="4"/><ellipse rx="${r*.8}" ry="${r*.27}" fill="#f98158"/>${[-1,1].map(s=>`<path d="M${s*8} -8 L${s*28} -3 L${s*12} 7Z" fill="#ffc283"/>`).join('')}</g>`;
  function burgerSVG(step,done,newest=false) {
    const layer=(n,content)=>step>=n?`<g class="${newest&&step===n?'ft-drop':''}">${content}</g>`:'';
    return `<svg viewBox="0 0 480 340" class="ft-burger" role="img" aria-label="${done?'Færdig burger':`Burger med ${step} af 5 ingredienser`}">
      <defs><linearGradient id="ft-bread" x2="0" y2="1"><stop stop-color="#f6cd7a"/><stop offset="1" stop-color="#d88a3c"/></linearGradient></defs>
      <ellipse cx="240" cy="292" rx="201" ry="29" fill="#a76e48" opacity=".17"/><ellipse cx="240" cy="282" rx="195" ry="27" fill="#fffbef" stroke="#d6b89b" stroke-width="3"/>
      <path d="M92 252 Q95 286 240 286 Q382 286 388 252Z" fill="url(#ft-bread)" stroke="#ab672b" stroke-width="3"/><ellipse cx="240" cy="251" rx="148" ry="29" fill="#ffe0a0" stroke="#c79045" stroke-width="3"/>
      ${layer(1,tomato(158,243)+tomato(242,248)+tomato(321,240))}
      ${layer(2,'<path d="M92 222 Q90 202 240 202 Q389 202 388 222 L386 236 Q240 264 94 237Z" fill="#79442f" stroke="#583827" stroke-width="4"/><ellipse cx="240" cy="219" rx="147" ry="24" fill="#996041"/><path d="M136 222L175 209M203 231L245 211M278 230L319 212" stroke="#613e2f" stroke-width="5" stroke-linecap="round"/>')}
      ${layer(3,'<path d="M110 205L244 187L381 207L315 235L259 221L198 240L169 219Z" fill="#ffcd4e" stroke="#dca233" stroke-width="3"/><path d="M125 205L243 193L357 207" fill="none" stroke="#ffe78b" stroke-width="4"/>')}
      ${layer(4,[153,221,291,342].map((x,i)=>`<ellipse cx="${x}" cy="${201+i%2*6}" rx="29" ry="12" fill="#b4ce72" stroke="#557c36" stroke-width="5"/><path d="M${x-10} 203h20" stroke="#e1eab1" stroke-width="3"/>`).join(''))}
      ${layer(5,[165,245,318].map(x=>`<ellipse cx="${x}" cy="188" rx="39" ry="13" fill="none" stroke="#9a5585" stroke-width="8"/><ellipse cx="${x}" cy="187" rx="39" ry="13" fill="none" stroke="#e4bcd6" stroke-width="4"/>`).join(''))}
      ${done?`<g class="ft-drop"><path d="M90 177C91 69 383 65 390 177Q240 210 90 177Z" fill="url(#ft-bread)" stroke="#ab672b" stroke-width="3"/>${[[151,135],[195,111],[237,141],[284,113],[331,144],[216,171],[301,169]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="7" ry="3" transform="rotate(-25 ${x} ${y})" fill="#fff0be"/>`).join('')}</g>`:`<g class="ft-arrow" transform="translate(240 ${190-step*16})"><path d="M0 -82V-29M-16 -44L0 -27L16 -44" fill="none" stroke="#df6348" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`}
    </svg>`;
  }
  function mount(root) {
    let orderIndex=0, step=0, order=createOrder(0), locked=false, delivered=false, disposed=false;
    const timers=new Set();
    const later=(callback,delay)=>{ const id=setTimeout(()=>{timers.delete(id);if(!disposed&&root.isConnected)callback();},delay);timers.add(id);return id; };
    root.innerHTML=`<section class="ft-game" aria-label="Luigis Foodtruck"><div class="ft-top"><button type="button" class="ft-back" data-action="foodtruck-home">← Tilbage</button><span>BRØKER PÅ MENUEN</span><div class="ft-count">Bestillinger <strong id="ft-served">0</strong></div></div>
      <div class="ft-heading"><p>FRISK MAD · GODT SELSKAB · LIDT MATEMATIK</p><h1>Luigis <em>Foodtruck</em><span class="ft-spark" aria-hidden="true">✦</span></h1><div>Del råvarerne. Byg burgeren. Servér med et smil.</div></div>
      <div class="ft-truck"><div class="ft-roof"><span>LUIGI LÆKKERMAT</span><span class="ft-open">● ÅBEN</span></div><div class="ft-awning" aria-hidden="true"></div>
        <div class="ft-kitchen"><div class="ft-lights" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
          <div class="ft-chef"><div class="ft-speech" id="ft-speech">Ciao! Vi deler alle råvarerne ligeligt.</div><img src="assets/figurer/luigi-laekkermat-cutout.webp" alt="Luigi Lækkermat" width="1024" height="1536"><span class="ft-chef-tag">Din køkkenmakker, Luigi</span></div>
          <div class="ft-station"><div class="ft-station-top"><span>BYG DIN BURGER</span><span id="ft-layer-count">0 / 5 lag</span></div><div id="ft-burger-stage"></div><div class="ft-board-label" id="ft-board-label">Én af de 5 burgere</div></div>
          <section class="ft-ticket" aria-labelledby="ft-question"><div class="ft-ticket-head"><span>BESTILLING <b id="ft-order-number">01</b></span><span id="ft-guests">5 BURGERE</span></div><div id="ft-task"></div></section>
        </div><div class="ft-counter"><span>lavet med omtanke</span><div id="ft-ingredients" class="ft-ingredients"></div><span>fordelt med præcision</span></div><div class="ft-truck-footer"><span>FRISK MAD · LIGE DELE</span><span class="ft-flower" aria-hidden="true">✿</span><span>Luigis køkken · siden i dag</span></div><i class="ft-wheel ft-wheel-left" aria-hidden="true"></i><i class="ft-wheel ft-wheel-right" aria-hidden="true"></i>
      </div><p class="ft-footnote">Ingen tidspres. Du må gerne tænke dig om.</p></section>`;
    const q=selector=>root.querySelector(selector);
    function draw(newest=false) {
      q('#ft-burger-stage').innerHTML=burgerSVG(step,step===5,newest);
      q('#ft-layer-count').textContent=`${step} / 5 lag`;
      q('#ft-ingredients').innerHTML=order.steps.map((item,i)=>`<span class="${i<step?'ft-added':i===step?'ft-current':''}"><i style="background:${item.color}">${i<step?'✓':i+1}</i>${item.name}</span>`).join('');
    }
    function task(focus=false) {
      const item=order.steps[step];
      q('#ft-task').innerHTML=`<span class="ft-step-label">INGREDIENS ${step+1} AF 5 · ${item.name.toLocaleUpperCase('da')}</span><h2 id="ft-question">${item.question}</h2><p class="ft-story">Luigi skal lave <strong>${order.guests} burgere</strong>.<br>Han har <strong>${item.amount} ${item.plural}</strong>, som skal fordeles ligeligt.</p><form id="ft-answer-form" novalidate><label for="ft-answer">I hver burger:</label><div class="ft-answer-row"><input id="ft-answer" name="answer" type="text" inputmode="none" maxlength="11" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="fx a/b" aria-describedby="ft-answer-help ft-feedback"><span>${item.unit}</span></div><p id="ft-answer-help">Skriv en brøk med / eller et helt tal.</p><div class="ft-keypad" aria-label="Tal og brøkstreg">${['1','2','3','4','5','6','7','8','9','/','0','⌫'].map(key=>`<button type="button" data-ft-key="${key}" aria-label="${key==='/'?'Brøkstreg':key==='⌫'?'Slet sidste tegn':key}">${key}</button>`).join('')}</div><button class="ft-submit" type="submit">Læg ${item.name.toLocaleLowerCase('da')} på <span aria-hidden="true">↓</span></button></form><div id="ft-feedback" class="ft-feedback" role="status" aria-live="polite"></div><button class="ft-hint-button" type="button" data-ft-hint>Giv mig et hint</button>`;
      if(focus&&matchMedia('(pointer:fine)').matches)q('#ft-answer').focus({preventScroll:true});
    }
    function finish() {
      q('#ft-speech').textContent='Perfetto! Burgere til hele selskabet.';
      q('#ft-task').innerHTML=`<div class="ft-finished"><span class="ft-step-label">BESTILLINGEN ER KLAR</span><div class="ft-finish-star" aria-hidden="true">✦</div><h2 id="ft-question">Buon appetito!</h2><p>${order.guests} burgere. Fem ingredienser.<br>Og lige meget til alle.</p><ul>${order.steps.map(item=>`<li><span>${item.name}</span><strong>${fraction(item.amount,order.guests)} ${item.unit}</strong></li>`).join('')}</ul><p class="ft-summary-label">Mængder pr. burger</p><button type="button" class="ft-submit" data-ft-next>Servér &amp; tag næste bestilling →</button></div>`;
      q('[data-ft-next]').focus({preventScroll:true});
    }
    function onSubmit(event) {
      if(event.target.id!=='ft-answer-form')return;
      event.preventDefault();
      if(locked||step>=5)return;
      const item=order.steps[step], input=q('#ft-answer'), feedback=q('#ft-feedback');
      if(!answerMatches(input.value,item.amount,order.guests)) {
        input.setAttribute('aria-invalid','true');
        feedback.textContent='Ikke helt endnu. Alle burgere skal have lige meget. Prøv igen.';
        feedback.classList.remove('ft-correct'); input.focus({preventScroll:true});input.select();return;
      }
      locked=true; input.removeAttribute('aria-invalid');
      const accepted=input.value.trim();
      q('#ft-answer-form').querySelectorAll('input,button').forEach(el=>el.disabled=true);
      feedback.classList.add('ft-correct');
      feedback.textContent=`✓ ${accepted} ${item.unit} i hver burger. ${fraction(item.amount,order.guests)!==accepted?`Det svarer til ${fraction(item.amount,order.guests)}.`:'Lige fordelt!'}`;
      q('#ft-speech').textContent=['Sådan! Tomaterne er på.','Bøfferne er klar. Det dufter godt!','Ost på. Det bliver lækkert!','Lidt grønt og sprødt!','Sidste lag. På med overbollen!'][step];
      step++;draw(true);
      later(()=>{if(step===5)finish();else{task(true);locked=false;}},1100);
    }
    function onClick(event) {
      const key=event.target.closest('[data-ft-key]');
      if(key&&!locked) {
        const input=q('#ft-answer'); if(!input)return;
        const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
        if(key.dataset.ftKey==='⌫') {const from=start===end?Math.max(0,start-1):start;input.setRangeText('',from,end,'end');}
        else if(input.value.length-(end-start)<11)input.setRangeText(key.dataset.ftKey,start,end,'end');
        input.focus({preventScroll:true});input.removeAttribute('aria-invalid');
      }
      if(event.target.closest('[data-ft-hint]')&&!locked)q('#ft-feedback').textContent=`Fordel ${order.steps[step].amount} i ${order.guests} lige store portioner. I brøken står hele mængden øverst og antallet af burgere nederst.`;
      if(event.target.closest('[data-ft-next]')&&step===5&&!delivered) {
        delivered=true;orderIndex++;q('#ft-served').textContent=orderIndex;
        order=createOrder(orderIndex);step=0;locked=false;
        q('#ft-order-number').textContent=String(orderIndex+1).padStart(2,'0');q('#ft-guests').textContent=`${order.guests} BURGERE`;
        q('#ft-board-label').textContent=`Én af de ${order.guests} burgere`;
        q('#ft-speech').textContent=`Næste selskab: ${order.guests} sultne gæster!`;
        draw();task(true);delivered=false;
      }
    }
    root.addEventListener('submit',onSubmit);root.addEventListener('click',onClick);draw();task();
    return ()=>{disposed=true;timers.forEach(clearTimeout);timers.clear();root.removeEventListener('submit',onSubmit);root.removeEventListener('click',onClick);};
  }
  window.LuigiFoodtruck=Object.freeze({mount,createOrder,answerMatches,fraction});
})();
