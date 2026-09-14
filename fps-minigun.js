import * as THREE from 'three';
import { MINIGUN_PICKUP } from './fps-powerup-rules.js?v=20260914-gun1';

export function createMinigunView(scene,camera) {
  const steel=new THREE.MeshStandardMaterial({color:0x29363e,metalness:.6,roughness:.35});
  const yellow=new THREE.MeshStandardMaterial({color:0xf2c545,roughness:.5});
  const graphite=new THREE.MeshStandardMaterial({color:0x151a20});
  function weapon(){
    const group=new THREE.Group(),rotor=new THREE.Group();group.add(rotor);
    for(let i=0;i<6;i++){
      const angle=i*Math.PI/3,x=Math.cos(angle)*.16,y=Math.sin(angle)*.16;
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.86,6),yellow);
      barrel.rotation.x=Math.PI/2;barrel.position.set(x,y,-.28);rotor.add(barrel);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.052,.12,6),graphite);
      tip.rotation.x=-Math.PI/2;tip.position.set(x,y,-.77);rotor.add(tip);
    }
    const body=new THREE.Mesh(new THREE.BoxGeometry(.5,.46,.35),steel);body.position.z=.22;group.add(body);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.16,.4,.18),steel);grip.position.set(0,-.32,.23);group.add(grip);
    return {group,rotor};
  }
  const pickup=weapon();pickup.group.position.set(MINIGUN_PICKUP.x,MINIGUN_PICKUP.y+.16,MINIGUN_PICKUP.z);
  pickup.group.scale.setScalar(.6);scene.add(pickup.group);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.028,6,32),new THREE.MeshBasicMaterial({color:0xffdf66}));
  ring.rotation.x=Math.PI/2;ring.position.set(MINIGUN_PICKUP.x,1.01,MINIGUN_PICKUP.z);scene.add(ring);
  const hand=weapon();hand.group.position.set(.44,-.36,-.73);hand.group.scale.setScalar(.54);
  hand.group.visible=false;camera.add(hand.group);
  const muzzle=new THREE.Mesh(new THREE.ConeGeometry(.22,.7,7),new THREE.MeshBasicMaterial({color:0xffd268,transparent:true,opacity:.8}));
  muzzle.rotation.x=-Math.PI/2;muzzle.position.z=-1.05;muzzle.visible=false;hand.group.add(muzzle);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#18262e';ctx.fillRect(0,0,768,160);
  ctx.strokeStyle='#f7cf53';ctx.lineWidth=10;ctx.strokeRect(5,5,758,150);
  ctx.fillStyle='#f7cf53';ctx.textAlign='center';ctx.font='900 46px sans-serif';ctx.fillText('BLYANT-MINIGUN',384,64);
  ctx.fillStyle='#fff3d3';ctx.font='700 28px sans-serif';ctx.fillText('5 minusstykker → 10 sekunders autofire',384,116);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:true}));
  label.position.set(MINIGUN_PICKUP.x,2.25,MINIGUN_PICKUP.z);label.scale.set(2.55,.53,1);scene.add(label);
  const badge=document.createElement('div');badge.id='minigun-status';badge.hidden=true;badge.setAttribute('role','status');
  badge.style.cssText='position:fixed;z-index:18;top:105px;left:50%;transform:translateX(-50%);padding:6px 12px;border:2px solid #121820;border-radius:8px;background:#f5ce59;color:#121820;font:900 12px system-ui;text-align:center;pointer-events:none;max-width:65vw';
  document.body.appendChild(badge);
  let spin=0,flashLeft=0;
  function sync(state,available,dt=0){
    spin+=dt;flashLeft=Math.max(0,flashLeft-dt);
    pickup.group.visible=ring.visible=label.visible=available;
    pickup.group.rotation.y=spin*1.1;pickup.group.position.y=MINIGUN_PICKUP.y+.16+Math.sin(spin*2)*.08;
    const active=state?.phase==='active';hand.group.visible=active;hand.rotor.rotation.z-=active?dt*42:0;
    muzzle.visible=active&&flashLeft>0;muzzle.rotation.z=spin*43;
    badge.hidden=!active&&state?.phase!=='challenge';
    if(!badge.hidden)badge.textContent=active?`BLYANT-MINIGUN · ${state.remaining.toFixed(1)} s · AUTOFIRE`:`MINIGUN · ${state.correct}/5 minusstykker`;
  }
  return {sync,flash(){flashLeft=.055;},hide(){sync(null,false);}};
}

// Short noise bursts plus a low mechanical thump give a rapid, heavy gun sound.
export function createMinigunSound(getContext){
  let context=null,noise=null,bus=null,nextShotAt=0;const playing=new Set();
  function stop(){for(const node of playing){try{node.stop();}catch{}}playing.clear();nextShotAt=0;}
  function shot(){
    const ctx=getContext();if(!ctx||ctx.state!=='running')return;
    if(context!==ctx){
      context=ctx;noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.09),ctx.sampleRate);
      const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*3);
      bus=ctx.createDynamicsCompressor();bus.threshold.value=-12;bus.knee.value=10;bus.ratio.value=8;bus.attack.value=.002;bus.release.value=.05;bus.connect(ctx.destination);
    }
    // Network snapshots may contain two shots; play them 100 ms apart.
    const now=Math.max(ctx.currentTime,nextShotAt);nextShotAt=now+.1;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=noise;filter.type='highpass';filter.frequency.value=350;
    gain.gain.setValueAtTime(.65,now);gain.gain.exponentialRampToValueAtTime(.001,now+.085);
    source.connect(filter);filter.connect(gain);gain.connect(bus);
    const thump=ctx.createOscillator(),bass=ctx.createGain();thump.type='sawtooth';thump.frequency.setValueAtTime(120,now);thump.frequency.exponentialRampToValueAtTime(45,now+.07);
    bass.gain.setValueAtTime(.24,now);bass.gain.exponentialRampToValueAtTime(.001,now+.085);thump.connect(bass);bass.connect(bus);
    for(const node of [source,thump]){playing.add(node);node.onended=()=>{playing.delete(node);node.disconnect();};node.start(now);node.stop(now+.09);}
    source.addEventListener('ended',()=>{filter.disconnect();gain.disconnect();});thump.addEventListener('ended',()=>bass.disconnect());
  }
  return {shot,stop};
}
