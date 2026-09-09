// Run with jsdom and three installed in NODE_PATH. DOM tests do not replace a device test.
const {JSDOM}=require('jsdom');
const THREE=require('three');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const test=require('node:test');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'fps.html'),'utf8');
const source=fs.readFileSync(path.join(root,'fps-touch.js'),'utf8').replaceAll('export ','');

function setup(t,touch=true) {
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window;
  w.innerWidth=844;w.innerHeight=390;
  w.matchMedia=()=>({matches:touch});
  w.HTMLElement.prototype.setPointerCapture=function(){};
  const api=w.eval(`${source}\n({createTouchControls,touchInput})`);
  const camera=new THREE.PerspectiveCamera();
  let playing=true,fired=0,cleared=0;
  const keys=[];
  const controls=api.createTouchControls({camera,isPlaying:()=>playing,keydown:e=>keys.push(e.code),fire:()=>fired++,clearKeys:()=>cleared++});
  const get=selector=>w.document.querySelector(selector);
  get('#move-stick').getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  const pointer=(selector,type,id,x=50,y=50)=>{
    const event=new w.Event(type,{bubbles:true,cancelable:true});
    Object.assign(event,{pointerId:id,clientX:x,clientY:y});
    get(selector).dispatchEvent(event);
  };
  return {w,api,camera,controls,get,keys,pointer,setPlaying:v=>playing=v,get fired(){return fired;},get cleared(){return cleared;}};
}

test('independent fingers can move, look, answer and shoot; digit taps never shoot',t=>{
  const s=setup(t);
  assert.equal(s.controls.active,true);
  s.pointer('#move-stick','pointerdown',1,50,18);
  assert.equal(s.api.touchInput.z,-1);
  s.pointer('#look-pad','pointerdown',2,200,150);
  s.pointer('#look-pad','pointermove',2,250,170);
  assert.ok(s.camera.rotation.y<0);assert.ok(s.camera.rotation.x<0);
  s.pointer('[data-key="Digit7"]','pointerdown',3);
  s.pointer('[data-key="Digit7"]','pointerup',3);
  s.pointer('[data-key="Backspace"]','pointerdown',4);
  s.pointer('[data-key="Enter"]','pointerdown',5);
  assert.deepEqual(s.keys,['Digit7','Backspace','Enter']);
  assert.equal(s.fired,0);
  assert.equal(s.api.touchInput.z,-1);
  s.pointer('#touch-fire','pointerdown',6);
  assert.equal(s.fired,1);
  s.pointer('#move-stick','pointercancel',1);
  s.pointer('#look-pad','lostpointercapture',2);
  assert.equal(s.api.touchInput.z,0);
  const yaw=s.camera.rotation.y;
  s.pointer('#look-pad','pointermove',2,800,200);
  assert.equal(s.camera.rotation.y,yaw);
});

test('stick dead zone, analog speed and hold release are bounded',t=>{
  const s=setup(t);
  s.pointer('#move-stick','pointerdown',1,51,51);
  assert.equal(s.api.touchInput.x,0);
  s.pointer('#move-stick','pointermove',1,66,50);
  assert.ok(s.api.touchInput.x>0 && s.api.touchInput.x<.5);
  s.pointer('#move-stick','pointermove',1,900,900);
  assert.ok(Math.hypot(s.api.touchInput.x,s.api.touchInput.z)<=1.00001);
  s.pointer('[data-hold="sprint"]','pointerdown',2);
  s.pointer('[data-hold="crouch"]','pointerdown',3);
  assert.equal(s.api.touchInput.sprint,true);assert.equal(s.api.touchInput.crouch,true);
  s.pointer('[data-hold="sprint"]','lostpointercapture',2);
  s.pointer('[data-hold="crouch"]','pointercancel',3);
  assert.equal(s.api.touchInput.sprint,false);assert.equal(s.api.touchInput.crouch,false);
});

test('rotation, pause, blur and game over clear input; unsupported fullscreen is harmless',async t=>{
  const s=setup(t);
  s.pointer('#move-stick','pointerdown',1,50,18);
  s.w.innerWidth=390;s.w.innerHeight=844;s.w.dispatchEvent(new s.w.Event('resize'));
  assert.equal(s.controls.active,false);assert.equal(s.api.touchInput.z,0);
  assert.equal(s.get('#rotate-device').hidden,false);
  s.pointer('#touch-fire','pointerdown',2);assert.equal(s.fired,0);
  s.w.innerWidth=844;s.w.innerHeight=390;s.w.dispatchEvent(new s.w.Event('resize'));
  s.get('#touch-pause').click();assert.equal(s.controls.active,false);
  assert.equal(s.get('#touch-pause-overlay').hidden,false);
  s.w.document.documentElement.requestFullscreen=()=>Promise.reject(new Error('Unsupported'));
  await s.controls.enter();assert.equal(s.controls.active,true);
  s.w.dispatchEvent(new s.w.Event('blur'));assert.equal(s.controls.active,false);
  s.setPlaying(false);s.controls.sync();
  assert.equal(s.get('#touch-controls').hidden,true);
  assert.equal(s.get('#touch-pause-overlay').hidden,true);
  assert.equal(s.get('#rotate-device').hidden,true);
  s.setPlaying(true);s.controls.sync();assert.equal(s.controls.active,true);
});

test('desktop keeps touch UI hidden and pointer-lock input unblocked',t=>{
  const s=setup(t,false);
  assert.equal(s.controls.enabled,false);assert.equal(s.controls.blocked,false);
  assert.equal(s.get('#touch-controls').hidden,true);
  assert.equal(s.w.document.documentElement.classList.contains('touch-device'),false);
});

function tapClock(s) {
  let now=1000,serial=0;
  const timers=new Map();
  s.w.performance.now=()=>now;
  s.w.setTimeout=(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id;};
  s.w.clearTimeout=id=>timers.delete(id);
  const advance=ms=>{
    now+=ms;
    for(const [id,timer] of [...timers]) if(timer.at<=now) {timers.delete(id);timer.fn();}
  };
  const tap=(id,x=200,y=150)=>{
    s.pointer('#look-pad','pointerdown',id,x,y);advance(40);
    s.pointer('#look-pad','pointerup',id,x,y);
  };
  return {advance,tap};
}

test('single right tap jumps; double tap toggles persistent crouch without jumping',t=>{
  const s=setup(t),{tap,advance}=tapClock(s);
  s.pointer('#move-stick','pointerdown',1,50,18);
  tap(2);assert.equal(s.keys.length,0);advance(281);
  assert.deepEqual(s.keys,['Space']);assert.equal(s.api.touchInput.z,-1);
  tap(3);advance(80);tap(4);advance(300);
  assert.equal(s.api.touchInput.crouch,true);assert.deepEqual(s.keys,['Space']);
  assert.equal(s.get('[data-hold="crouch"]').getAttribute('aria-pressed'),'true');
  s.pointer('[data-hold="crouch"]','pointerdown',5);
  s.pointer('[data-hold="crouch"]','pointerup',5);
  assert.equal(s.api.touchInput.crouch,true); // Releasing the hold button preserves the toggle.
  tap(6);advance(80);tap(7);advance(300);
  assert.equal(s.api.touchInput.crouch,false);assert.deepEqual(s.keys,['Space']);
  tap(8);advance(80);tap(9);assert.equal(s.api.touchInput.crouch,true);
  s.controls.reset();assert.equal(s.api.touchInput.crouch,false);
  assert.equal(s.fired,0);
});

test('drag, long press, cancelled touch and pause cannot leave a delayed jump',t=>{
  const s=setup(t),{tap,advance}=tapClock(s);
  tap(1);
  s.pointer('#look-pad','pointerdown',2,200,150);
  s.pointer('#look-pad','pointermove',2,260,150);
  s.pointer('#look-pad','pointermove',2,200,150);
  s.pointer('#look-pad','pointerup',2,200,150);advance(400);
  assert.equal(s.keys.length,0);
  s.pointer('#look-pad','pointerdown',3,200,150);advance(500);
  s.pointer('#look-pad','pointerup',3,200,150);advance(400);
  assert.equal(s.keys.length,0);
  tap(4);
  s.pointer('#look-pad','pointerdown',5,200,150);
  s.pointer('#look-pad','pointercancel',5,200,150);advance(400);
  assert.equal(s.keys.length,0);
  tap(6);s.get('#touch-pause').click();advance(400);
  assert.equal(s.keys.length,0);assert.equal(s.api.touchInput.crouch,false);
});

test('JacobE gets the courtyard on every solo reset; other users and online keep their rules',async()=>{
  const vm=require('node:vm'),code=fs.readFileSync(path.join(root,'fps.js'),'utf8');
  const load=code.slice(code.indexOf('async function loadPlayerRules()'),code.indexOf('\nloadCharacters();',code.indexOf('async function loadPlayerRules()')));
  const reset=code.slice(code.indexOf('function resetGame('),code.indexOf("\nstartButton.addEventListener",code.indexOf('function resetGame(')));
  for(const username of ['JacobE',' jacobe ','Elev7']) {
    let opens=0,spawns=0;
    const context={URLSearchParams,location:{search:''},console,setTimeout(){},
      window:{JacobBackend:{configured:true,loadDatabase:async()=>({currentUserId:'player',database:{users:[{id:'player',username}]}})}},
      gameVoice:{stop(){}},elseAttacks:{clear(){}},projectiles:[],schoolyardDoor:null,
      playerMovement:{reset(){}},camera:{rotation:{set(){}}},gameNow:()=>0,
      openSchoolyardDoor:()=>opens++,spawnWave:()=>spawns++,
    };
    for(const name of ['refreshStartButton','clearStompWaves','removeProjectile','setSchoolyardLighting','removeMagicCircle','removeSchoolyardArrows','updateHUD','clearEnemies','newProblem'])context[name]=()=>{};
    const api=vm.runInNewContext(`${load}\n${reset}\n({loadPlayerRules,resetGame})`,context);
    await api.loadPlayerRules();api.resetGame();api.resetGame();api.resetGame(true);
    assert.equal(opens,username.trim().toLowerCase()==='jacobe'?2:0);
    assert.equal(spawns,username.trim().toLowerCase()==='jacobe'?0:2);
  }
});

test('Else emits exactly one shockwave per four eligible stomps and a fresh boss resets the count',()=>{
  const vm=require('node:vm');
  const code=fs.readFileSync(path.join(root,'fps-else.js'),'utf8')
    .replace(/^import .*;\n/m,'').replaceAll('export ','');
  const api=vm.runInNewContext(`${code}\n({createElseRig,animateElse})`,{
    createSpriteRig:()=>({stride:Math.PI/2,phase:0}),animateErling(){},disposeErlingRig(){},
  });
  const enemy=api.createElseRig(null);let waves=0;
  for(let i=1;i<=16;i++) {
    api.animateElse(enemy,.1,i*600,0,()=>waves++); // Idle must not count.
    api.animateElse(enemy,.1,i*600,.1,()=>waves++);
    api.animateElse(enemy,.1,i*600+20,.1,()=>waves++); // Cooldown still applies.
    assert.equal(waves,Math.floor(i/4));
  }
  const fresh=api.createElseRig(null);
  api.animateElse(fresh,.1,12000,.1,()=>waves++);
  assert.equal(waves,4);assert.equal(fresh.stompCount,1);
});

test('real shared movement supports analog input, sprint, crouch, jump and collisions',t=>{
  const s=setup(t);s.w.THREE=THREE;
  const movementSource=fs.readFileSync(path.join(root,'fps-movement.js'),'utf8').replace("import * as THREE from 'three';",'').replaceAll('export ','');
  const create=s.w.eval(`${movementSource}\ncreatePlayerMovement`);
  const input={x:1,z:0,sprint:false,crouch:false},keys={};
  const wall=new THREE.Box3(new THREE.Vector3(1,0,-5),new THREE.Vector3(1.2,3,5));
  const m=create({camera:s.camera,colliders:[wall],keys,input});
  m.reset(0,0);m.update(.1);assert.ok(s.camera.position.x<=.52);
  m.reset(0,10);input.x=.5;m.update(.1);assert.ok(Math.abs(s.camera.position.x-.27)<1e-6);
  m.reset(0,10);input.x=1;input.sprint=true;m.update(.1);assert.ok(Math.abs(s.camera.position.x-.86)<1e-6);
  input.crouch=true;m.update(.1);assert.equal(m.crouching,true);assert.equal(s.camera.position.y,.78);
  input.crouch=false;m.jump();m.update(.1);assert.ok(s.camera.position.y>1.7);
  m.reset(0,10);input.x=0;input.sprint=false;keys.KeyW=true;m.update(.1);
  assert.ok(Math.abs(s.camera.position.z-9.46)<1e-6);
});
