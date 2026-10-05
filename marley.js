(() => {
  "use strict";
  const KEY = "jacobmatematik-marley-jacob-v1";
  const items = [
    {id:"bee",name:"Humlebikostume",price:20,icon:"🐝",slot:"body"},
    {id:"hat",name:"Festhat",price:8,icon:"🎉",slot:"head"},
    {id:"cap",name:"Kasket",price:12,icon:"🧢",slot:"head"},
    {id:"glasses",name:"Solbriller",price:10,icon:"🕶️",slot:"eyes"},
    {id:"shoes",name:"Sko",price:15,icon:"👟",slot:"feet"},
    {id:"skate",name:"Skateboard",price:25,icon:"🛹",slot:"board"},
    {id:"ball",name:"Bold",price:6,icon:"🎾",slot:"toy"},
    {id:"bone",name:"Kødben",price:5,icon:"🦴",slot:"toy"},
    {id:"treat",name:"Godbid",price:3,icon:"🍪",slot:"treat"},
  ];
  const blank = () => ({coins:0,owned:[],equipped:{},correct:0});
  const random = n => Math.floor(Math.random()*n);
  function mount(root,{onExit}) {
    let data;
    try { const saved=JSON.parse(localStorage.getItem(KEY)); data={...blank(),...saved}; if(!Array.isArray(data.owned)||!Number.isSafeInteger(data.coins)||data.coins<0) throw Error(); }
    catch { data=blank(); }
    let task,locked=false,feedback="",focusAnswer=true,feeding=false,feedTimer=null;
    const save=()=>{try { localStorage.setItem(KEY,JSON.stringify(data)); } catch { feedback="Denne browser kunne ikke gemme dit spil."; }};
    function next() {
      const minus=random(2)===0;
      const a=random(10), b=random(10);
      task=minus?{a:Math.max(a,b),b:Math.min(a,b),sign:"−",answer:Math.abs(a-b)}:{a,b,sign:"+",answer:a+b};
      locked=false; focusAnswer=true;
    }
    function render() {
      const equipped=data.equipped||{};
      root.innerHTML=`<div class="marley-page"><header class="marley-top"><button type="button" data-marley="exit">← Tilbage</button><h1>Matematikhunden Marley</h1><strong aria-label="Mønter">🪙 ${data.coins}</strong></header>
      <main class="marley-grid"><section class="marley-play" aria-label="Regn og tjen mønter"><div class="marley-scene"><div class="marley-dog ${feeding?"is-eating":""}"><img class="marley-tail" src="assets/figurer/marley-tail.webp" alt="" aria-hidden="true"><div class="marley-body"><img src="assets/figurer/marley-body.webp" alt="Marley, den glade matematik-hund"><span class="marley-wear head">${equipped.head?items.find(x=>x.id===equipped.head)?.icon||"":""}</span><span class="marley-wear eyes">${equipped.eyes?"🕶️":""}</span><span class="marley-wear body">${equipped.body?"🐝":""}</span><span class="marley-wear feet">${equipped.feet?"👟":""}</span><span class="marley-wear board">${equipped.board?"🛹":""}</span><span class="marley-wear toy">${equipped.toy?items.find(x=>x.id===equipped.toy)?.icon||"":""}</span></div><span class="marley-treat-flight" aria-hidden="true">🍪</span><span class="marley-heart heart-one" aria-hidden="true">💛</span><span class="marley-heart heart-two" aria-hidden="true">❤️</span><span class="marley-heart heart-three" aria-hidden="true">💜</span></div></div><p class="marley-speech" aria-live="polite">${feedback||"Regn et stykke og tjen en mønt til Marley!"}</p><form id="marley-answer"><label for="marley-input">Hvad er ${task.a} ${task.sign} ${task.b}?</label><div class="marley-answer-row"><input id="marley-input" type="number" inputmode="numeric" min="0" max="18" required autocomplete="off" aria-label="Dit svar"><button type="submit" ${locked?"disabled":""}>Svar</button></div></form><p class="marley-progress">${data.correct} rigtige svar i alt · 1 mønt pr. rigtigt svar</p></section>
      <section class="marley-shop" aria-label="Butik"><h2>Marleys butik</h2><p>Køb udstyr, og tryk på det igen for at tage det af eller på. Godbidder spiser Marley med det samme.</p><div class="marley-items">${items.map(item=>{const treat=item.id==="treat",owned=!treat&&data.owned.includes(item.id),worn=equipped[item.slot]===item.id;return `<button type="button" data-marley="buy" data-item="${item.id}" ${(!owned&&data.coins<item.price)||treat&&feeding?"disabled":""} aria-label="${item.name}, ${treat?item.price+" mønter, giv til Marley":owned?worn?"på, tag af":"købt, tag på":item.price+" mønter"}"><span class="marley-item-icon">${item.icon}</span><strong>${item.name}</strong><small>${treat?`Giv nu · 🪙 ${item.price}`:owned?worn?"På ✓":"Tag på":`🪙 ${item.price}`}</small></button>`}).join("")}</div></section></main></div>`;
      if(focusAnswer) {root.querySelector("#marley-input")?.focus({preventScroll:true});focusAnswer=false;}
    }
    next();render();
    function submit(event){if(event.target.id!=="marley-answer")return;event.preventDefault();if(locked)return;const raw=root.querySelector("#marley-input").value.trim();if(!/^\d+$/.test(raw))return;locked=true;if(Number(raw)===task.answer){data.coins++;data.correct++;feedback="Rigtigt! Marley fik en mønt. 🪙";save();}else feedback=`Prøv igen: ${task.a} ${task.sign} ${task.b} = ${task.answer}.`;next();render();}
    function click(event){const button=event.target.closest("[data-marley]");if(!button||!root.contains(button))return;if(button.dataset.marley==="exit"){onExit();return;}const item=items.find(x=>x.id===button.dataset.item);if(!item)return;if(item.id==="treat") {if(feeding||data.coins<item.price)return;data.coins-=item.price;feedback="Mums! Marley spiser godbidden. 💛";feeding=true;focusAnswer=false;save();render();feedTimer=setTimeout(()=>{feeding=false;root.querySelector(".marley-dog")?.classList.remove("is-eating");root.querySelector('[data-item="treat"]')?.removeAttribute("disabled");},2600);return;}if(!data.owned.includes(item.id)){if(data.coins<item.price)return;data.coins-=item.price;data.owned.push(item.id);feedback=`${item.name} er købt til Marley!`;}else feedback=data.equipped[item.slot]===item.id?`${item.name} er taget af.`:`Marley har ${item.name.toLowerCase()} på!`;data.equipped[item.slot]=data.equipped[item.slot]===item.id?null:item.id;save();render();}
    root.addEventListener("submit",submit);root.addEventListener("click",click);
    return ()=>{clearTimeout(feedTimer);root.removeEventListener("submit",submit);root.removeEventListener("click",click);};
  }
  window.MarleyMath={mount};
})();
