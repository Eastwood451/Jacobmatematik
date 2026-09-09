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
