const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor(tag) {
    this.style={}; this.tag=tag; this.dataset={}; this.children=[]; this.listeners=new Map(); this.paused=true; this.currentTime=0; this.duration=4;
    const names=new Set();
    this.classList={add:n=>names.add(n),toggle:(n,on)=>on?names.add(n):names.delete(n),contains:n=>names.has(n)};
  }
  remove() {}
  append(...xs) {this.children.push(...xs);}
  replaceChildren(...xs) {this.children=xs;}
  setAttribute(k,v) {this[k]=v;}
  removeAttribute(k) {delete this[k];}
  addEventListener(k,f) {if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(f);}
  removeEventListener(k,f) {this.listeners.get(k)?.delete(f);}
  emit(k) {for(const f of [...(this.listeners.get(k)||[])])f({target:this});}
  pause() {this.paused=true;}
  play() {this.paused=false;return Promise.resolve();}
  load() {}
  requestVideoFrameCallback(f) {f();}
}
const timers=new Map(); let timerId=0;
const context={window:{},document:{createElement:t=>new Element(t)},setTimeout:(f,ms)=>{timers.set(++timerId,{f,ms});return timerId},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
vm.runInNewContext(fs.readFileSync("marley-wardrobe.js","utf8"),context);
vm.runInNewContext(fs.readFileSync('marley-cartoon.js','utf8'),context);
const flush=()=>Promise.resolve();
(async()=>{
  const host=new Element('div'); const states=[];
  const scene=await context.window.MarleyCartoonScene.create(host,s=>states.push(s));
  const videos=host.children[0].children.filter(x=>x.tag==='video');
  const active=()=>videos.find(v=>v.classList.contains('is-active'));
  const loaded=()=>videos.find(v=>v.listeners.get('loadeddata')?.size)?.emit('loadeddata');
  scene.play('roam'); loaded(); await flush(); assert.equal(scene.getState(),'wag'); assert.equal(active().loop,false);assert.equal(active().playbackRate,0.4);
  active().emit('ended');assert.equal(active().paused,true);assert.equal([...timers.values()][0].ms,8000);
  scene.pause(true);assert.equal(timers.size,0);scene.pause(false);assert.equal(timers.size,1);
  scene.play('wag');loaded();await flush();
  assert.equal(active().muted,true); assert.equal(active().playsInline,true);
  active().currentTime=1.3;
  scene.setEquipment({body:'bee',head:'cap'});loaded();await flush();
  assert.ok(active().src.includes('/bee/wag.mp4'),'costume uses the painted whole-character film');
  assert.equal(active().currentTime,1.3,'outfit switch preserves animation time');
  assert.equal(host.children[0].dataset.outfit,'bee');
  assert.equal(host.children[0].children.find(x=>x.tag==='div').children.length,1,'only the cap is an overlay');
  scene.setEquipment({body:'bee',feet:'shoes',head:'cap'});loaded();await flush();
  assert.ok(active().src.includes('/bee-shoes/wag.mp4'),'shoes combine with the painted costume');
  assert.equal(active().currentTime,1.3);
  assert.equal(host.children[0].children.find(x=>x.tag==='div').children.length,1,'shoes add no overlay elements');
  scene.pause(true);scene.setEquipment({feet:'shoes'});loaded();await flush();
  assert.ok(active().src.includes('/shoes/wag.mp4'));
  assert.equal(active().paused,true);assert.equal(active().currentTime,1.3);
  scene.pause(false);
  for(const clip of ['run','smile','eat','bed','sleep']) {
    scene.play(clip);loaded();await flush();
    assert.ok(active().src.includes('/shoes/'+clip+'.mp4'),'shoes stay on for '+clip);
  }
  scene.play('wag');loaded();await flush();
  scene.pause(true);scene.setEquipment({});loaded();await flush();
  assert.ok(!active().src.includes('/bee/'));assert.equal(active().paused,true);assert.equal(scene.isPaused(),true);
  scene.pause(false);
  scene.play('eat'); loaded(); await flush(); assert.equal(active().dataset.action,'eat'); assert.equal(active().loop,false);
  assert.equal(scene.pause(true),true); assert.equal(active().paused,true);
  active().emit('ended'); assert.equal(scene.getState(),'eat','paused film cannot advance state');
  scene.pause(false); assert.equal(active().paused,false);
  scene.play('smile'); assert.equal(scene.getState(),'eat','reward waits for chewing to finish');
  scene.setEquipment({body:'bee'});loaded();await flush();
  assert.equal(scene.getState(),'eat');assert.ok(active().src.includes('/bee/eat.mp4'));
  active().emit('ended'); assert.equal(scene.getState(),'smile'); loaded(); await flush();
  active().emit('ended'); loaded(); await flush(); assert.equal(scene.getState(),'wag');
  scene.play('bed'); loaded(); await flush(); active().emit('ended'); assert.equal(scene.getState(),'sleep');
  loaded(); await flush(); assert.equal(active().loop,true); assert.equal(active().dataset.action,'sleep');
  assert.ok(active().src.includes('/bee/sleep.mp4'),'costume remains on in the basket');
  scene.setEquipment({});scene.setEquipment({body:'bee'});loaded();await flush();
  assert.ok(active().src.includes('/bee/sleep.mp4'),'latest rapid outfit toggle wins');
  scene.play('run'); scene.play('smile'); loaded(); await flush(); assert.equal(active().dataset.action,'smile','latest rapid click wins');
  const gear=host.children[0].children.find(x=>x.tag==='div'); scene.setEquipment({eyes:'glasses',head:'cap'});
  assert.equal(gear.children.length,2);assert(gear.children.every(n=>n.innerHTML.includes('<svg')));
  scene.play('bone');loaded();await flush();assert.equal(active().dataset.clip,'eat');active().emit('ended');loaded();await flush();
  scene.play('eat');loaded();await flush();active().emit('ended');loaded();await flush();
  scene.play('eat');loaded();await flush();assert.equal(scene.getState(),'eat','a second treat works immediately after chewing');
  scene.play('smile');active().emit('ended');loaded();await flush();
  scene.play('wag'); const next=videos.find(v=>v.dataset.action==='wag'&&!v.classList.contains('is-active')); next.emit('error');
  assert.equal(host.dataset.playbackError,'1'); assert.equal(active().dataset.action,'smile','network error preserves visible film');
  scene.destroy(); assert.equal(host.children.length,0); assert.ok(videos.every(v=>v.paused));
  videos.forEach(v=>v.emit('ended')); assert.equal(host.children.length,0);
  console.log('PASS: all four outfits, shoes in every film, time/pause/toggles, completion, queued rewards, props, errors and cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});

