(() => {
  "use strict";
  const items=[
    {id:"bee",name:"Humlebikostume",price:20,icon:"🐝",slot:"body"},
    {id:"hat",name:"Festhat",price:8,icon:"🎉",slot:"head"},
    {id:"cap",name:"Kasket",price:12,icon:"🧢",slot:"head"},
    {id:"glasses",name:"Solbriller",price:10,icon:"🕶️",slot:"eyes"},
    {id:"shoes",name:"Sko",price:15,icon:"👟",slot:"feet"},
    {id:"skate",name:"Skateboard",price:25,icon:"🛹",slot:"board"},
    {id:"ball",name:"Bold",price:6,icon:"🎾",slot:"toy"},
    {id:"bone",name:"Kødben",price:5,icon:"🦴",slot:"toy"},
    {id:"treat",name:"Godbid",price:3,icon:"🍪",slot:"treat"}
  ];
  const messages={wag:"Marley logrer glad!",smile:"Se Marleys store smil!",run:"Marley løber i cirkler!",bed:"Marley går hen til kurven og lægger sig.",sleep:"Marley hviler i sin kurv. Tryk på Logre for at kalde ham op.",eat:"Mums! Marley spiser godbidden. 💛"};
  let enginePromise;
  const loadScript=src=>new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src=src;script.onload=resolve;script.onerror=()=>reject(Error("Kunne ikke hente "+src));document.head.append(script);
  });
  function engine(){
    if(!enginePromise)enginePromise=(async()=>{
      if(!window.THREE)await loadScript("assets/vendor/three-r158.min.js");
      if(!window.MarleyScene)await loadScript("marley-scene.js?v=20261005-3d1");
      if(!window.MarleyVideoScene)await loadScript("marley-video.js?v=20261006-video1");
    })().catch(error=>{enginePromise=null;throw error;});
    return enginePromise;
  }
  function mount(root,{onExit,storageKey="jacobmatematik-marley-jacob-v1",initialCoins=0}) {
    let data;
    const blank=()=>({coins:initialCoins,owned:[],equipped:{},correct:0});
    try{data={...blank(),...JSON.parse(localStorage.getItem(storageKey))};if(!Array.isArray(data.owned)||!Number.isSafeInteger(data.coins)||data.coins<0)throw Error();}
    catch{data=blank();}
    let task,feedback="Regn et stykke og tjen mønter til Marley!",action="wag",scene=null,disposed=false;
    const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(data));}catch{feedback="Denne browser kunne ikke gemme dit spil.";}};
    root.innerHTML=`<div class="marley-page"><header class="marley-top"><button type="button" data-marley="exit">← Tilbage</button><h1>Matematikhunden Marley</h1><strong class="marley-coins" aria-label="Mønter"></strong></header><main class="marley-grid"><section class="marley-play" aria-label="Regn og tjen mønter"><div class="marley-scene marley-scene-3d" data-action="wag"><p class="marley-loading" role="status">Marley vågner …</p></div><div class="marley-actions" role="group" aria-label="Leg med Marley"><button type="button" data-marley="action" data-action="wag" disabled>🐕 Logre</button><button type="button" data-marley="action" data-action="smile" disabled>😊 Smil</button><button type="button" data-marley="action" data-action="run" disabled>🐾 Løb i cirkler</button><button type="button" data-marley="action" data-action="bed" disabled>🧺 I kurven</button><button type="button" data-marley="pause" disabled>⏸ Pause</button></div><p class="marley-speech" aria-live="polite"></p><form id="marley-answer"><label for="marley-input"></label><div class="marley-answer-row"><input id="marley-input" type="number" inputmode="numeric" min="0" max="18" required autocomplete="off" aria-label="Dit svar"><button type="submit">Svar</button></div></form><p class="marley-progress"></p></section><section class="marley-shop" aria-label="Butik"><h2>Marleys butik</h2><p>Giv Marley en godbid for 3 mønter. Regn opgaver for at tjene flere.</p><div class="marley-items"></div><div class="marley-wardrobe" aria-label="Marleys udstyr"></div></section></main></div>`;
    const q=selector=>root.querySelector(selector);
    const host=q(".marley-scene");
    function update(){
      if(disposed)return;
      scene?.setEquipment(data.equipped);
      q(".marley-coins").textContent="🪙 "+data.coins;
      q(".marley-speech").textContent=feedback;
      q(".marley-progress").textContent=data.correct+" rigtige svar i alt · 1 mønt pr. rigtigt svar";
      q(".marley-play label").textContent="Hvad er "+task.a+" "+task.sign+" "+task.b+"?";
      root.querySelectorAll('[data-marley="action"]').forEach(b=>{b.disabled=!scene;b.setAttribute("aria-pressed",String(b.dataset.action===action));});
      q('[data-marley="pause"]').disabled=!scene;
      q(".marley-items").innerHTML=items.map(item=>{
        const treat=item.id==="treat",owned=!treat&&data.owned.includes(item.id),worn=data.equipped[item.slot]===item.id;
        return `<button type="button" data-marley="buy" data-item="${item.id}" ${(!owned&&data.coins<item.price)||treat&&(!scene||action==="eat")?"disabled":""}><span class="marley-item-icon">${item.icon}</span><strong>${item.name}</strong><small>${treat?"Giv nu · 🪙 3":owned?worn?"På ✓":"Tag på":"🪙 "+item.price}</small></button>`;
      }).join("");
      q(".marley-wardrobe").textContent=Object.values(data.equipped).filter(Boolean).map(id=>items.find(i=>i.id===id)?.icon||"").join(" ");
    }
    function next(){
      const a=Math.floor(Math.random()*10),b=Math.floor(Math.random()*10);
      task=Math.random()<.5?{a,b,sign:"+",answer:a+b}:{a:Math.max(a,b),b:Math.min(a,b),sign:"−",answer:Math.abs(a-b)};
      q("#marley-input").value="";
    }
    function play(name){
      if(!scene)return;
      feedback=messages[name];q('[data-marley="pause"]').textContent="⏸ Pause";scene.play(name);update();
    }
    next();update();
    engine().then(()=>{
      if(disposed)return;
      const changed=name=>{
        action=name;
        if(name==="sleep")feedback=messages.sleep;
        update();
      };
      try { scene=window.MarleyScene.create(host,changed); }
      catch(error) { host.querySelectorAll("canvas").forEach(canvas=>canvas.remove()); scene=window.MarleyVideoScene.create(host,changed); }
      q(".marley-loading")?.remove();
      scene.play("wag");update();
    }).catch(error=>{
      if(disposed)return;
      const loading=q(".marley-loading");
      if(loading)loading.textContent="Animationen kunne ikke starte. Prøv at genindlæse siden.";
      console.error("Marley:",error);
    });
    function submit(event){
      if(event.target.id!=="marley-answer")return;event.preventDefault();
      const raw=q("#marley-input").value.trim();if(!/^\d+$/.test(raw))return;
      if(Number(raw)===task.answer){data.coins++;data.correct++;feedback="Rigtigt! En mønt til Marley. 🪙";save();if(scene)scene.play("smile");}
      else feedback="Prøv igen: "+task.a+" "+task.sign+" "+task.b+" = "+task.answer+".";
      next();update();q("#marley-input").focus({preventScroll:true});
    }
    function click(event){
      const button=event.target.closest("[data-marley]");if(!button||!root.contains(button))return;
      if(button.dataset.marley==="exit"){onExit();return;}
      if(button.dataset.marley==="action"){play(button.dataset.action);return;}
      if(button.dataset.marley==="pause"){
        if(scene)button.textContent=scene.pause()?"▶ Fortsæt":"⏸ Pause";return;
      }
      const item=items.find(x=>x.id===button.dataset.item);if(!item)return;
      if(item.id==="treat"){
        if(!scene||action==="eat"||data.coins<3)return;data.coins-=3;save();play("eat");return;
      }
      if(!data.owned.includes(item.id)){if(data.coins<item.price)return;data.coins-=item.price;data.owned.push(item.id);}
      data.equipped[item.slot]=data.equipped[item.slot]===item.id?null:item.id;
      feedback=item.name+(data.equipped[item.slot]?" er valgt.":" er taget af.");
      save();update();
    }
    root.addEventListener("submit",submit);root.addEventListener("click",click);
    return()=>{disposed=true;scene?.destroy();root.removeEventListener("submit",submit);root.removeEventListener("click",click);};
  }
  window.MarleyMath={mount};
})();
