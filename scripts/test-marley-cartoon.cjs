const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor(tag) {
    this.tag=tag; this.dataset={}; this.children=[]; this.listeners=new Map(); this.paused=true;
    const names=new Set();
    this.classList={add:n=>names.add(n),toggle:(n,on)=>on?names.add(n):names.delete(n),contains:n=>names.has(n)};
  }
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
const context={window:{},document:{createElement:t=>new Element(t)}};
vm.runInNewContext(fs.readFileSync('marley-cartoon.js','utf8'),context);
const flush=()=>Promise.resolve();
(async()=>{
  const host=new Element('div'); const states=[];
  const scene=await context.window.MarleyCartoonScene.create(host,s=>states.push(s));
  const videos=host.children[0].children.filter(x=>x.tag==='video');
  const active=()=>videos.find(v=>v.classList.contains('is-active'));
  const loaded=()=>videos.find(v=>v.dataset.action===host.dataset.loading)?.emit('loadeddata');
  scene.play('roam'); loaded(); await flush(); assert.equal(scene.getState(),'wag'); assert.equal(active().loop,true);
  assert.equal(active().muted,true); assert.equal(active().playsInline,true);
  scene.play('eat'); loaded(); await flush(); assert.equal(active().dataset.action,'eat'); assert.equal(active().loop,false);
  assert.equal(scene.pause(true),true); assert.equal(active().paused,true);
  active().emit('ended'); assert.equal(scene.getState(),'eat','paused film cannot advance state');
  scene.pause(false); assert.equal(active().paused,false);
  scene.play('smile'); assert.equal(scene.getState(),'eat','reward waits for chewing to finish');
  active().emit('ended'); assert.equal(scene.getState(),'smile'); loaded(); await flush();
  active().emit('ended'); loaded(); await flush(); assert.equal(scene.getState(),'wag');
  scene.play('bed'); loaded(); await flush(); active().emit('ended'); assert.equal(scene.getState(),'sleep');
  loaded(); await flush(); assert.equal(active().loop,true); assert.equal(active().dataset.action,'sleep');
  scene.play('run'); scene.play('smile'); loaded(); await flush(); assert.equal(active().dataset.action,'smile','latest rapid click wins');
  const gear=host.children[0].children.find(x=>x.tag==='div'); scene.setEquipment({eyes:'glasses',head:'cap'});
  assert.equal(gear.hidden,false); assert.equal(gear.children.length,2);
  scene.play('wag'); const next=videos.find(v=>v.dataset.action==='wag'&&!v.classList.contains('is-active')); next.emit('error');
  assert.equal(host.dataset.playbackError,'1'); assert.equal(active().dataset.action,'smile','network error preserves visible film');
  scene.destroy(); assert.equal(host.children.length,0); assert.ok(videos.every(v=>v.paused));
  videos.forEach(v=>v.emit('ended')); assert.equal(host.children.length,0);
  console.log('PASS: film completion, sleep loop, pause, queued rewards, rapid clicks, props, load failure and cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
