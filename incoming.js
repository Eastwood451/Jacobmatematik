/* Incoming! Real WebGL geometry; camera preserves the screen's mathematical axes. */
(() => {
  'use strict';
  const LINES = ["Tag dén, dummert!", "Lad klogheden sejre!", "Æd mit sigma!", "Plus på dig, Erling!", "Gå hjem og læs!", "Smag på mit gangetegn!", "Jeg brøk'er dig midt over!", "Kom nærmere - matematik-tæsk på tilbud!"];
  const EN_LINES = ['Take that, dummy!', 'Let knowledge triumph!', 'Eat my sigma!', 'Plus on you, Isaac!', 'Go home and read!', 'Taste my multiplication sign!', 'I will fraction you in half!', 'Come closer! Maths whacks on special offer!'];
  const COPY = {
    da:{subtitle:'Et spil om vinkler!',back:'← Tilbage',kicker:'KAPTAJN KVADRATROD PRÆSENTERER',points:'Kloghedspoint',wave:'Bølge',angle:'Hvilken vinkel?',fire:'Affyr klogskab!',hint:'Skriv 0–360°. Tryk på knappen eller Enter.',pause:'Ⅱ Pause',resume:'▶ Fortsæt',sound:'Lyd',aim:'Vis sigtelinje',helpers:'Vis vinkelhjælp',intro:'Dummerterne kommer!',instructions:'Sigt med et vinkeltal, og affyr et matematik-symbol. Beskyt Kaptajn Kvadratrod mod dummerter, Erlinger, dumpede opgaver, spytkugler og remoulademadder.',difficulty:'Vælg din udfordring',easy:'Retninger · 0°, 90°, 180°, 270°',middle:'Diagonaler · trin på 45°',hard:'Vinkelmester · trin på 5°',start:'Klar, Kaptajn! →',ready:'Find retningen. Skriv vinklen. AFFYR!',readyHint:'Første fjende kommer fra højre. Hvilket vinkeltal passer?',invalid:'Skriv et tal mellem 0 og 360.',angleFeedback:'{angle}° →',hit:'Fuldtræffer! +100 kloghedspoint.',miss:'Forbi! Kig på fjendens retning, og prøv igen.',damage:'Av! Fjenden kom fra {angle}°. Prøv den retning næste gang.',paused:'Kaptajnen holder pause',pauseText:'Fjenderne venter. Fortsæt, når du er klar.',complete:'Bølgen er klaret!',next:'Næste bølge →',over:'Kaptajnen må hjem og læse!',again:'Prøv igen →',summary:'{hits} træffere · {fired} skud · {score} point',right:'Højre',up:'Op',left:'Venstre',down:'Ned',captain:'Kaptajn Kvadratrod',caption:'Fem skjolde. Otte fjender per bølge. Masser af kloghed.',shield:'Skjolde tilbage',arena:'3D-arena. 0 og 360 grader er højre, 90 op, 180 venstre, 270 ned.',engine:'Din enhed kunne ikke starte 3D-grafikken. Prøv en browser med WebGL.',lost:'3D-grafikken blev afbrudt. Gå tilbage og åbn spillet igen.',incoming:'INCOMING',practice:'VINKLER / 360°',noSound:'Stemmen kunne ikke afspilles. Replikken vises i taleboblen.'},
    en:{subtitle:'A game about angles!',back:'← Back',kicker:'CAPTAIN SQUARE ROOT PRESENTS',points:'Knowledge points',wave:'Wave',angle:'Which angle?',fire:'Fire knowledge!',hint:'Enter 0–360°. Press the button or Enter.',pause:'Ⅱ Pause',resume:'▶ Resume',sound:'Sound',aim:'Show aiming line',helpers:'Show angle guides',intro:'The dummies are coming!',instructions:'Aim with an angle and fire a maths symbol. Protect Captain Square Root from dummies, Isaac Isucks, failed papers, spitballs and remoulade sandwiches.',difficulty:'Choose your challenge',easy:'Directions · 0°, 90°, 180°, 270°',middle:'Diagonals · steps of 45°',hard:'Angle master · steps of 5°',start:'Ready, Captain! →',ready:'Find the direction. Enter the angle. FIRE!',readyHint:'The first enemy comes from the right. Which angle fits?',invalid:'Enter a number between 0 and 360.',angleFeedback:'{angle}° →',hit:'Direct hit! +100 knowledge points.',miss:'Missed! Look at the enemy’s direction and try again.',damage:'Ouch! The enemy came from {angle}°. Try that direction next time.',paused:'The Captain is taking a break',pauseText:'The enemies will wait. Continue when you are ready.',complete:'Wave complete!',next:'Next wave →',over:'Time to go home and read!',again:'Try again →',summary:'{hits} hits · {fired} shots · {score} points',right:'Right',up:'Up',left:'Left',down:'Down',captain:'Captain Square Root',caption:'Five shields. Eight enemies per wave. Plenty of knowledge.',shield:'Shields remaining',arena:'3D arena. 0 and 360 degrees point right, 90 up, 180 left, 270 down.',engine:'Your device could not start the 3D graphics. Try a browser with WebGL.',lost:'The 3D graphics were interrupted. Go back and open the game again.',incoming:'INCOMING',practice:'ANGLES / 360°',noSound:'The voice could not play. Read the speech bubble.'}
  };
  function mount(root, {onExit}={}) {
    const T=window.THREE, core=window.JacobIncomingCore;
    if(!T || !core) throw new Error('Incoming modules missing');
    const lang=()=>document.documentElement.lang.startsWith('en')?'en':'da';
    const t=(key,values={})=>COPY[lang()][key].replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');
    let disposed=false,raf=0,last=0,time=0,kick=0,speechUntil=0,lineIndex=0,lastVoice=-10,voice=null,sound=null;
    let difficulty='directions',game=core.createGame({difficulty});
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    root.innerHTML=`<section class="incoming" data-i18n-skip><header class="inc-header"><div><span class="inc-kicker" data-copy="kicker"></span><h1 class="inc-title">INCOMING!</h1><p class="inc-subtitle" data-copy="subtitle"></p></div><button class="inc-back" type="button" data-inc="back" data-copy="back"></button></header><div class="inc-layout"><div class="inc-stage"><canvas class="inc-canvas" role="img"></canvas><div class="inc-topline"><span class="inc-live-badge" data-copy="practice"></span><span class="inc-lives" role="img"></span></div><span class="inc-direction inc-deg0">0° / 360°</span><span class="inc-direction inc-deg90">90°</span><span class="inc-direction inc-deg180">180°</span><span class="inc-direction inc-deg270">270°</span><div class="inc-speech" aria-live="polite"></div><span class="inc-stage-footer" data-copy="ready"></span><div class="inc-overlay"><div class="inc-modal"></div></div></div><aside class="inc-side"><div class="inc-panel inc-stats-panel"><div class="inc-scoreline"><div><span class="inc-label" data-copy="points"></span><strong class="inc-score">0</strong></div><div><span class="inc-label" data-copy="wave"></span><strong class="inc-wave">01</strong></div></div><div class="inc-progress" role="progressbar" aria-valuemin="0" aria-valuemax="8" aria-valuenow="0"><span></span></div></div><div class="inc-panel inc-form-panel"><form class="inc-form" novalidate><label for="incoming-angle" data-copy="angle"></label><div class="inc-angle-wrap"><input id="incoming-angle" type="text" inputmode="decimal" autocomplete="off" maxlength="6" placeholder="0" aria-describedby="incoming-hint incoming-feedback"><span aria-hidden="true">°</span></div><button class="inc-fire" type="submit" data-copy="fire" disabled></button><p class="inc-form-hint" id="incoming-hint" data-copy="hint"></p><p class="inc-feedback" id="incoming-feedback" role="status"></p></form></div><div class="inc-panel inc-settings-panel"><div class="inc-controls"><button class="inc-tool" type="button" data-inc="pause" data-copy="pause" disabled></button><button class="inc-tool" type="button" data-inc="sound" aria-pressed="true">♪ <span data-copy="sound"></span></button></div><label class="inc-control-label"><input type="checkbox" data-inc="aim" checked><span data-copy="aim"></span></label><label class="inc-control-label"><input type="checkbox" data-inc="helpers" checked><span data-copy="helpers"></span></label></div><div class="inc-panel inc-reference-panel"><span class="inc-label">360°</span><div class="inc-reference"><span><strong>0° / 360°</strong> <span data-copy="right"></span> →</span><span><strong>90°</strong> <span data-copy="up"></span> ↑</span><span><strong>180°</strong> <span data-copy="left"></span> ←</span><span><strong>270°</strong> <span data-copy="down"></span> ↓</span></div><div class="inc-mini-captain"><img src="assets/figurer/kaptajn-kvadratrod.webp" alt=""><p data-copy="caption"></p></div></div></aside></div></section>`;
    const $=s=>root.querySelector(s),canvas=$('canvas'),stage=$('.inc-stage'),input=$('input[type=text]'),feedback=$('.inc-feedback'),overlay=$('.inc-overlay'),modal=$('.inc-modal');
    const resources=new Set(),geometries=new Map(),materials=new Map(),textures=new Map(),enemyViews=new Map(),shotViews=new Map(),particles=[];
    const keep=x=>(resources.add(x),x);
    let feedbackState=null;
    function setFeedback(key,values={}) {feedbackState={key,values};feedback.textContent=t(key,values);}
    let renderer;
    function updateCopy() {
      root.querySelectorAll('[data-copy]').forEach(el=>{el.textContent=t(el.dataset.copy);});
      canvas.setAttribute('aria-label',t('arena'));
      input.setAttribute('aria-label',t('angle'));
      $('.inc-progress').setAttribute('aria-label',t('wave'));
      $('.inc-mini-captain img').alt=t('captain');
    }
    updateCopy();
    const back=()=>onExit?.();
    $('[data-inc=back]').addEventListener('click',back);
    try {
      renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    } catch(error) {
      try { renderer=window.JacobIncomingRenderer.create(canvas,T); }
      catch(fallbackError) {
        modal.innerHTML=`<h2>${t('engine')}</h2>`;
        return ()=>{disposed=true;root.innerHTML='';};
      }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-9,9,9,-9,.1,100);
    camera.position.set(0,0,28);camera.lookAt(0,0,0);
    scene.add(new T.HemisphereLight(0xc6c7ff,0x301f42,2.0));
    const key=new T.DirectionalLight(0xffd3a4,3.2);key.position.set(-5,8,16);scene.add(key);
    const rim=new T.PointLight(0x6bc8ff,28,25);rim.position.set(4,-2,7);scene.add(rim);
    const orange=new T.PointLight(0xff6934,20,20);orange.position.set(-7,2,5);scene.add(orange);
    function geo(type,...args) {
      const id=type+args.join(',');
      if(!geometries.has(id)) geometries.set(id,keep(new T[type](...args)));
      return geometries.get(id);
    }
    function mat(color,metalness=.05,emissive=0) {
      const id=[color,metalness,emissive].join(',');
      if(!materials.has(id)) materials.set(id,keep(new T.MeshStandardMaterial({color,metalness,roughness:.58,emissive,emissiveIntensity:.55})));
      return materials.get(id);
    }
    function mesh(parent,geometry,material,x=0,y=0,z=0,scale) {
      const m=new T.Mesh(geometry,material);m.position.set(x,y,z);if(scale)m.scale.set(...scale);parent.add(m);return m;
    }
    const ball=(p,x,y,z,sx,sy,sz,color)=>mesh(p,geo('SphereGeometry',1,18,12),mat(color),x,y,z,[sx,sy,sz]);
    const box=(p,x,y,z,w,h,d,color)=>mesh(p,geo('BoxGeometry',w,h,d),mat(color),x,y,z);
    function textTexture(text,color='#fff',background=null) {
      const id=text+color+background;if(textures.has(id))return textures.get(id);
      const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');
      if(background){ctx.fillStyle=background;ctx.fillRect(0,0,256,256);}
      ctx.fillStyle=color;ctx.font=`900 ${text.length>4?41:150}px system-ui, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,137,240);
      const tex=keep(new T.CanvasTexture(c));tex.colorSpace=T.SRGBColorSpace;textures.set(id,tex);return tex;
    }
    function symbol(text,color,size=1) {
      const id='symbol:'+text+color;
      if(!materials.has(id))materials.set(id,keep(new T.MeshBasicMaterial({map:textTexture(text,color),transparent:true,depthWrite:false,side:T.DoubleSide})));
      const material=materials.get(id);
      return new T.Mesh(geo('PlaneGeometry',size,size),material);
    }
    function limb(parent,x,y,z,color,length=.65,width=.17) {
      const pivot=new T.Group();pivot.position.set(x,y,z);parent.add(pivot);
      ball(pivot,0,-length*.45,0,width,length*.6,width,color);return pivot;
    }
    function makeCaptain() {
      const g=new T.Group();
      const cape=mesh(g,geo('PlaneGeometry',1.8,2.2,9,12),keep(new T.MeshStandardMaterial({color:0xb42b48,side:T.DoubleSide,roughness:.8})),0,-.12,-.37);
      const basePositions=Float32Array.from(cape.geometry.attributes.position.array);
      ball(g,0,-.1,0,.54,.77,.32,0x1475a7); // torso
      ball(g,-.31,.25,.15,.29,.34,.22,0x187eaf);ball(g,.31,.25,.15,.29,.34,.22,0x187eaf);
      box(g,0,-.55,.05,.84,.24,.55,0xb52d49);box(g,0,-.52,.37,.23,.17,.06,0xf5c85c);
      const crest=mesh(g,geo('CircleGeometry',.35,3),mat(0xc63040),0,.07,.35);crest.rotation.z=Math.PI;
      const sqrt=symbol('√','#fff5d5',.55);sqrt.position.set(0,.08,.39);g.add(sqrt);
      const head=new T.Group();head.position.set(0,.87,.05);g.add(head);
      ball(head,0,0,0,.31,.39,.29,0xe2aa83);ball(head,0,.14,-.015,.32,.30,.29,0xb83043);
      box(head,0,.035,.257,.57,.17,.09,0xba253c);
      for(const side of [-1,1]) {const eye=ball(head,side*.14,.045,.32,.095,.037,.035,0xffffff);eye.rotation.z=side*.15;}
      ball(head,0,-.075,.33,.055,.09,.08,0xe8b18c);
      const mouth=box(head,0,-.21,.26,.18,.035,.04,0x552d39);
      const left=limb(g,-.62,.41,0,0x1173a3,.58,.23),right=limb(g,.62,.41,0,0x1173a3,.58,.23);
      left.rotation.z=-.30;right.rotation.z=1.25;
      ball(left,0,-.70,.02,.20,.26,.21,0xc92d45);ball(right,0,-.70,.02,.20,.26,.21,0xc92d45);
      const legL=limb(g,-.25,-.65,0,0x0d5683,.69,.20),legR=limb(g,.25,-.65,0,0x0d5683,.69,.20);
      legL.rotation.z=-.13;legR.rotation.z=.13;
      ball(legL,0,-.75,.08,.22,.35,.26,0xb92b45);ball(legR,0,-.75,.08,.22,.35,.26,0xb92b45);
      g.scale.setScalar(.77);g.position.z=.7;
      return {group:g,cape,basePositions,head,mouth,left,right,legL,legR};
    }
    const hero=makeCaptain();scene.add(hero.group);
    const platform=mesh(scene,geo('CylinderGeometry',1.18,1.36,.20,64),mat(0x34295e,.45),0,0,-.50);platform.rotation.x=Math.PI/2;
    const ring=mesh(scene,geo('TorusGeometry',1.28,.045,8,80),mat(0x83eeff,.5,0x267b9c),0,0,-.27);
    const board=mesh(scene,geo('CircleGeometry',8.45,96),mat(0x19162f,.35),0,0,-1.12);
    function circle(radius,color,opacity) {
      const points=[];for(let n=0;n<=128;n++){const a=n/128*Math.PI*2;points.push(new T.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,-.94));}
      const geometry=keep(new T.BufferGeometry().setFromPoints(points));const line=new T.Line(geometry,keep(new T.LineBasicMaterial({color,transparent:true,opacity})));scene.add(line);return line;
    }
    circle(8.25,0x8873bb,.8);circle(7.7,0xffaa66,.6);circle(6,0x8272ad,.14);circle(4,0x8272ad,.17);circle(2.3,0x8272ad,.20);
    const guides=new T.Group();scene.add(guides);
    for(let angle=0;angle<360;angle+=5) {
      const d=core.direction(angle),large=angle%30===0;
      const points=[new T.Vector3(d.x*(large?7.30:7.50),d.y*(large?7.30:7.50),-.86),new T.Vector3(d.x*7.7,d.y*7.7,-.86)];
      const line=new T.Line(keep(new T.BufferGeometry().setFromPoints(points)),keep(new T.LineBasicMaterial({color:large?0x9e8dce:0x61517e,transparent:true,opacity:large?.7:.5})));guides.add(line);
      if(large&&angle%90!==0) {const label=symbol(String(angle)+'°','#a79cbf',.60);label.position.set(d.x*6.98,d.y*6.98,-.8);guides.add(label);}
    }
    for(const angle of [0,90]) {
      const d=core.direction(angle),line=new T.Line(keep(new T.BufferGeometry().setFromPoints([new T.Vector3(-d.x*7.2,-d.y*7.2,-.9),new T.Vector3(d.x*7.2,d.y*7.2,-.9)])),keep(new T.LineDashedMaterial({color:0x8278af,dashSize:.12,gapSize:.19,transparent:true,opacity:.25})));line.computeLineDistances();guides.add(line);
    }
    const aim=new T.Group();scene.add(aim);
    const aimLine=new T.Line(keep(new T.BufferGeometry().setFromPoints([new T.Vector3(1.35,0,-.05),new T.Vector3(7.15,0,-.05)])),keep(new T.LineDashedMaterial({color:0x6be7ff,dashSize:.19,gapSize:.14,transparent:true,opacity:.50})));aimLine.computeLineDistances();aim.add(aimLine);
    const arrow=mesh(aim,geo('ConeGeometry',.12,.38,12),mat(0x70eaff,.3,0x16657e),1.7,0,.05);arrow.rotation.z=-Math.PI/2;
    const muzzle=new T.PointLight(0x71faff,0,5);muzzle.position.set(0,0,2);scene.add(muzzle);
    const starPositions=[];
    for(let i=0;i<180;i++) {const a=i*2.39996,r=8.5+(i%15)*.31;starPositions.push(Math.cos(a)*r,Math.sin(a)*r,-1.5-(i%3));}
    const stars=new T.Points(keep(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(starPositions,3))),keep(new T.PointsMaterial({color:0xc1a9fa,size:.035,transparent:true,opacity:.5})));scene.add(stars);
    function makePerson(kind) {
      const g=new T.Group(),erling=kind==='erling',skin=erling?0xc4a08a:0xb9a3d0;
      ball(g,0,-.15,0,.32,.45,.24,erling?0xd4cdb0:0x7542a2);
      ball(g,0,.48,0,.32,.40,.27,skin);
      ball(g,0,.40,.28,.13,.10,.15,skin);
      for(const side of [-1,1]) {
        ball(g,side*.125,.55,.235,.09,.10,.065,0xf3efd6);
        ball(g,side*.10,.54,.29,.025,.04,.02,0x211d2b);
        const brow=box(g,side*.13,.66,.28,.19,.045,.045,0x463d39);brow.rotation.z=side*.4;
      }
      const mouth=ball(g,0,.25,.23,.10,.085,.06,0x432836);
      const left=limb(g,-.36,.12,0,skin,.38,.09),right=limb(g,.36,.12,0,skin,.38,.09);
      left.rotation.z=-.9;right.rotation.z=.9;
      const legL=limb(g,-.16,-.48,0,erling?0x46525c:0x4d315e,.32,.12),legR=limb(g,.16,-.48,0,erling?0x46525c:0x4d315e,.32,.12);
      ball(legL,0,-.37,.08,.14,.12,.20,0x443532);ball(legR,0,-.37,.08,.14,.12,.20,0x443532);
      if(erling) {
        for(let i=0;i<7;i++) {const a=i/6*Math.PI;ball(g,Math.cos(a)*.30,.55+Math.sin(a)*.26,-.14,.055,.16,.07,0x73716b);}
        for(let i=0;i<7;i++) ball(g,Math.sin(i)*.19,.20-(i%3)*.035,.25,.027,.035,.022,0x786e5f);
        const hair=box(g,-.10,.91,0,.025,.19,.025,0x514e45);hair.rotation.z=.35;
      } else {
        mesh(g,geo('ConeGeometry',.33,.69,12),mat(0xffc253),0,1.02,0);
        const letter=symbol('D','#622c55',.30);letter.position.set(0,.97,.26);g.add(letter);
      }
      return {group:g,left,right,legL,legR,mouth};
    }
    function makeEnemy(kind) {
      if(kind==='erling'||kind==='dummert')return makePerson(kind);
      const g=new T.Group();
      if(kind==='paper') {
        box(g,0,0,0,.85,1.1,.07,0xfff3d6);
        const ink=symbol(lang()==='en'?'FAILED':'DUMPET','#bd2849',.80);ink.position.set(0,.10,.055);ink.rotation.z=-.18;g.add(ink);
        for(let i=0;i<4;i++) box(g,-.03,-.12-i*.13,.045,.56,.025,.015,0xa3a4b6);
        const fold=box(g,.34,.45,.04,.17,.18,.06,0xddcdb9);fold.rotation.z=.15;
      } else if(kind==='spitball') {
        const spit=mesh(g,geo('IcosahedronGeometry',.43,1),mat(0xe5ebc9),0,0,0);spit.scale.set(1,.82,1);
        for(let i=0;i<5;i++) ball(g,Math.cos(i*2)*.30,Math.sin(i*2)*.26,.15,.13,.10,.12,0xd2d8b4);
      } else {
        box(g,0,0,0,1.02,.78,.20,0x5d3428);box(g,0,0,.13,.92,.68,.13,0x916749);
        for(let i=0;i<9;i++) ball(g,Math.cos(i*2.4)*(.12+i*.036),Math.sin(i*2.4)*(.12+i*.023),.25,.20,.13,.10,0xefc537);
        for(let i=0;i<4;i++) ball(g,Math.sin(i*4)*.30,Math.cos(i*4)*.22,.34,.04,.035,.03,0x859334);
      }
      return {group:g};
    }
    function burst(x,y,color,count=12) {
      for(let n=0;n<count;n++) {
        const piece=new T.Mesh(geo('OctahedronGeometry',.075,0),mat(color,.4,color));piece.position.set(x,y,1);
        const a=n/count*Math.PI*2;const life=.55+(n%4)*.1;
        scene.add(piece);particles.push({mesh:piece,dx:Math.cos(a)*(1.3+n%3),dy:Math.sin(a)*(1.3+n%3),life,maxLife:life});
      }
      const pop=symbol(['+','×','Σ','√'][game.state.hits%4],'#ffda8d',1.2);pop.position.set(x,y,1.5);scene.add(pop);particles.push({mesh:pop,dx:0,dy:1,life:.75,maxLife:.75});
    }
    function beep(kind) {
      if(!$('[data-inc=sound]').matches('[aria-pressed=true]'))return;
      try {
        sound??=new (window.AudioContext||window.webkitAudioContext)();
        if(sound.state==='suspended')void sound.resume();
        const now=sound.currentTime,o=sound.createOscillator(),gain=sound.createGain();o.connect(gain);gain.connect(sound.destination);
        o.type=kind==='damage'?'sawtooth':'sine';o.frequency.setValueAtTime(kind==='fire'?750:kind==='hit'?1100:160,now);o.frequency.exponentialRampToValueAtTime(kind==='damage'?50:kind==='hit'?1600:180,now+.15);
        gain.gain.setValueAtTime(.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+.20);o.start();o.stop(now+.21);
      } catch(_) {}
    }
    function stopVoice() {if(voice){voice.pause();voice.currentTime=0;voice=null;}}
    function say(force=false) {
      if(!force&&time-lastVoice<2.8)return;
      const index=lineIndex++%LINES.length;lastVoice=time;
      $('.inc-speech').textContent=(lang()==='en'?EN_LINES:LINES)[index];$('.inc-speech').classList.add('visible');speechUntil=time+3;
      if($('[data-inc=sound]').getAttribute('aria-pressed')!=='true')return;
      stopVoice();
      // Authored Danish MP3s prevent the device/browser language from changing pronunciation.
      if(lang()==='da') {
        voice=new Audio(`assets/incoming/audio/captain-${index+1}.mp3?v=20261113-1`);voice.volume=.85;
        const currentVoice=voice;
        voice.play().catch(()=>{if(!disposed&&voice===currentVoice)setFeedback('noSound');});
      }
    }
    function syncViews() {
      const enemyIds=new Set(game.state.enemies.map(e=>e.id));
      for(const [id,v] of enemyViews)if(!enemyIds.has(id)){scene.remove(v.group);enemyViews.delete(id);}
      for(const e of game.state.enemies) {
        if(!enemyViews.has(e.id)) {const v=makeEnemy(e.kind);enemyViews.set(e.id,v);scene.add(v.group);}
        const v=enemyViews.get(e.id);v.group.position.set(e.x,e.y,.3);
        const wobble=reduced?0:Math.sin(time*3.2+e.id)*.14;
        v.group.rotation.set(wobble*.7,Math.sin(time*1.7+e.id)*.23,wobble);
        if(e.kind==='sandwich'||e.kind==='spitball'||e.kind==='paper') {v.group.rotation.z=time*(e.kind==='paper'?.7:1.8)+e.id;v.group.rotation.y=Math.sin(time*2+e.id)*.65;}
        if(v.left) {v.left.rotation.z=-.6+Math.sin(time*6+e.id)*.35;v.right.rotation.z=.6-Math.sin(time*6+e.id)*.35;v.legL.rotation.z=Math.sin(time*5+e.id)*.25;v.legR.rotation.z=-Math.sin(time*5+e.id)*.25;}
        const scale=1+(reduced?0:Math.sin(time*2+e.id)*.025);v.group.scale.setScalar(scale);
      }
      const shotIds=new Set(game.state.shots.map(s=>s.id));
      for(const [id,v] of shotViews)if(!shotIds.has(id)){scene.remove(v);shotViews.delete(id);}
      for(const s of game.state.shots) {
        if(!shotViews.has(s.id)) {
          const g=new T.Group();const char=symbol(['Σ','+','×','√','π','÷'][s.id%6],'#9ff8ff',.85);g.add(char);
          mesh(g,geo('TorusGeometry',.36,.025,6,24),mat(0x8defff,.5,0x348bad));shotViews.set(s.id,g);scene.add(g);
        }
        const v=shotViews.get(s.id);v.position.set(s.x,s.y,1.35);v.rotation.z=time*4;
      }
    }
    function syncHud() {
      const s=game.state;$('.inc-score').textContent=s.score;$('.inc-wave').textContent=String(s.wave).padStart(2,'0');
      $('.inc-lives').textContent='◆'.repeat(Math.max(0,s.lives))+'◇'.repeat(5-Math.max(0,s.lives));$('.inc-lives').setAttribute('aria-label',`${t('shield')}: ${s.lives}`);
      const done=s.spawned-s.enemies.length;$('.inc-progress span').style.width=(done/8*100)+'%';$('.inc-progress').setAttribute('aria-valuenow',done);
      $('.inc-fire').disabled=s.phase!=='playing';$('[data-inc=pause]').disabled=!['playing','paused'].includes(s.phase);
      $('[data-inc=pause]').textContent=t(s.phase==='paused'?'resume':'pause');
    }
    function showOverlay() {
      const phase=game.state.phase;overlay.hidden=phase==='playing';
      if(phase==='playing')return;
      let title='intro',body='instructions',action='start',icon='∠';
      if(phase==='paused') {title='paused';body='pauseText';action='resume';icon='Ⅱ';}
      if(phase==='between') {title='complete';body='summary';action='next';icon='Σ';}
      if(phase==='over') {title='over';body='summary';action='again';icon='√';}
      modal.innerHTML=`<div class="inc-modal-icon" aria-hidden="true">${icon}</div><h2>${t(title)}</h2><p>${t(body,game.state)}</p>${phase==='ready'?`<label for="incoming-difficulty">${t('difficulty')}</label><select id="incoming-difficulty"><option value="directions">${t('easy')}</option><option value="diagonals">${t('middle')}</option><option value="expert">${t('hard')}</option></select>`:''}<button class="inc-primary" type="button" data-inc="continue">${t(action)}</button>`;
      if(phase==='ready')modal.querySelector('select').value=difficulty;
    }
    function clearViews() {
      for(const v of enemyViews.values())scene.remove(v.group);for(const v of shotViews.values())scene.remove(v);
      enemyViews.clear();shotViews.clear();for(const p of particles)scene.remove(p.mesh);particles.length=0;
    }
    function processEvents() {
      let changed=false;
      for(const e of game.drainEvents()) {
        changed=true;
        if(e.type==='fire') {kick=1;beep('fire');if(game.state.fired===1||time-lastVoice>5)say();}
        if(e.type==='hit') {burst(e.enemy.x,e.enemy.y,0xffb65e,reduced?6:14);beep('hit');setFeedback('hit');say();}
        if(e.type==='miss') setFeedback('miss');
        if(e.type==='damage') {burst(0,0,0xff5377,8);beep('damage');setFeedback('damage',{angle:e.angle});stage.classList.remove('inc-hurt');void stage.offsetWidth;stage.classList.add('inc-hurt');}
        if(['pause','over','waveComplete'].includes(e.type))stopVoice();
        if(['over','waveComplete'].includes(e.type))showOverlay();
      }
      if(changed)syncHud();
    }
    function startOrContinue() {
      if(game.state.phase==='ready') {
        difficulty=modal.querySelector('select').value;game=core.createGame({difficulty});game.start();setFeedback(difficulty==='directions'?'readyHint':'ready');
      } else if(game.state.phase==='paused')game.resume();
      else if(game.state.phase==='between')game.nextWave();
      else if(game.state.phase==='over'){clearViews();game=core.createGame({difficulty});input.value='';game.start();setFeedback('ready');}
      overlay.hidden=true;processEvents();last=performance.now();
      // Unlock sound on the actual user gesture; never queue a backlog of voices.
      beep('fire');if(window.innerWidth>800)input.focus({preventScroll:true});
    }
    function pauseToggle() {
      if(game.state.phase==='playing'){game.pause();stopVoice();}else if(game.state.phase==='paused')game.resume();
      processEvents();showOverlay();last=performance.now();
    }
    function submit(event) {
      event.preventDefault();
      if(core.parseAngle(input.value)===null){setFeedback('invalid');input.setAttribute('aria-invalid','true');return;}
      input.removeAttribute('aria-invalid');
      if(game.fire(input.value)) {setFeedback('angleFeedback',{angle:input.value});processEvents();input.focus({preventScroll:true});input.select();}
    }
    function click(event) {
      const action=event.target.closest('[data-inc]')?.dataset.inc;
      if(action==='continue')startOrContinue();
      if(action==='pause')pauseToggle();
      if(action==='sound') {const b=$('[data-inc=sound]');b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')==='true'?'false':'true');if(b.getAttribute('aria-pressed')==='false'){stopVoice();if(sound)void sound.suspend();}}
    }
    function keydown(event) {if(event.key==='Escape'&&['playing','paused'].includes(game.state.phase)){event.preventDefault();pauseToggle();}}
    function hidden(){if(document.hidden&&game.state.phase==='playing'){game.pause();processEvents();showOverlay();}}
    function contextLost(event){event.preventDefault();game.pause();stopVoice();modal.innerHTML=`<h2>${t('lost')}</h2>`;overlay.hidden=false;syncHud();}
    root.addEventListener('click',click);$('.inc-form').addEventListener('submit',submit);document.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',hidden);canvas.addEventListener('webglcontextlost',contextLost);
    function resize() {
      if(disposed)return;const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
      renderer.setSize(w,h,false);const aspect=w/h,half=8.9;
      camera.left=-half*Math.max(1,aspect);camera.right=-camera.left;camera.top=half*Math.max(1,1/aspect);camera.bottom=-camera.top;camera.updateProjectionMatrix();
      // Labels follow the actual world coordinates even in a wide desktop arena.
      for(const [angle,selector] of [[0,'.inc-deg0'],[90,'.inc-deg90'],[180,'.inc-deg180'],[270,'.inc-deg270']]) {
        const d=core.direction(angle),v=new T.Vector3(d.x*8.12,d.y*8.12,0).project(camera),el=$(selector);
        el.style.left=(v.x*.5+.5)*100+'%';el.style.top=(-v.y*.5+.5)*100+'%';
      }
    }
    const observer=new ResizeObserver(resize);observer.observe(stage);resize();
    const languageObserver=new MutationObserver(()=>{if(game.state.phase==='ready')difficulty=modal.querySelector('select')?.value||difficulty;updateCopy();syncHud();showOverlay();stopVoice();if(feedbackState)feedback.textContent=t(feedbackState.key,feedbackState.values);$('.inc-speech').textContent='';$('.inc-speech').classList.remove('visible');});languageObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    function frame(now) {
      if(disposed)return;
      const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
      const running=game.state.phase==='playing',ambient=game.state.phase==='ready';
      if(running||ambient)time+=dt;
      game.update(dt);processEvents();syncViews();
      const current=core.parseAngle(input.value),angle=current??0;aim.visible=$('[data-inc=aim]').checked&&current!==null;aim.rotation.z=angle*Math.PI/180;guides.visible=$('[data-inc=helpers]').checked;
      const animationDt=running||ambient?dt:0;
      kick=Math.max(0,kick-animationDt*4);hero.group.position.x=-Math.cos(angle*Math.PI/180)*kick*.10;hero.group.position.y=(reduced?0:Math.sin(time*2)*.035)-Math.sin(angle*Math.PI/180)*kick*.10;
      hero.group.rotation.y=Math.sin(time*1.7)*.055;hero.head.rotation.y=Math.cos(angle*Math.PI/180)*.12;
      hero.right.rotation.z=1.1+Math.sin(angle*Math.PI/180)*.38+kick*.6;hero.left.rotation.z=-.33-Math.sin(time*2)*.08;
      hero.mouth.scale.y=voice&&!voice.paused?1+Math.abs(Math.sin(time*22))*3:1;
      const positions=hero.cape.geometry.attributes.position;
      for(let i=0;i<positions.count;i++) {const y=hero.basePositions[i*3+1],influence=(1.1-y)/2.2;positions.setZ(i,Math.sin(time*4+hero.basePositions[i*3]*2+y*1.4)*.15*influence);}
      positions.needsUpdate=true;hero.cape.geometry.computeVertexNormals();
      muzzle.intensity=kick*18;ring.material.emissiveIntensity=.45+Math.sin(time*2)*.15;
      if(time>speechUntil)$('.inc-speech').classList.remove('visible');
      const fxDt=running||ambient?dt:0;
      for(let i=particles.length-1;i>=0;i--) {const p=particles[i];p.life-=fxDt;p.mesh.position.x+=p.dx*fxDt;p.mesh.position.y+=p.dy*fxDt;p.mesh.rotation.z+=fxDt*3;p.mesh.scale.setScalar(Math.max(0,p.life/p.maxLife));if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}
      if(!document.hidden)renderer.render(scene,camera);raf=requestAnimationFrame(frame);
    }
    syncHud();showOverlay();raf=requestAnimationFrame(frame);
    return ()=>{
      disposed=true;cancelAnimationFrame(raf);observer.disconnect();languageObserver.disconnect();stopVoice();if(sound)void sound.close();
      document.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',hidden);canvas.removeEventListener('webglcontextlost',contextLost);root.removeEventListener('click',click);
      clearViews();for(const resource of resources)resource.dispose?.();renderer.dispose();renderer.forceContextLoss();root.innerHTML='';
    };
  }
  window.JacobIncoming={mount};
})();
