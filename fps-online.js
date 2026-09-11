import * as THREE from 'three';
import { createPlayerMovement } from './fps-movement.js?v=20260909-touch1';
import { GameRoom, roomCode } from './fps-room.js?v=20260911-path1';
import { AVATARS, avatarFor, normalizeAvatar } from './fps-avatars.js?v=20260907-avatar1';
import { createErlingRig, animateErling, disposeErlingRig } from './fps-visuals.js?v=20260907-sprites1';
import { createGunnarRig } from './fps-gunnar.js?v=20260910-slime1';

const $=id=>document.getElementById(id);
const colours=[0x43cbb7,0xf6b94d,0xa3a0ff,0xfc8c93];
const text=(el,value)=>{if(el.textContent!==String(value)) el.textContent=String(value);};

export function createOnlineGame({scene,camera,controls,colliders,makePencil,prepare,ready,textures,startAudio,flash,inputReady,touchInput,touchEnabled,gunnarSlime}) {
  let room=null, state=null, me=null, epoch=-1, answer='';
  let busy=false, lastPhase='', previousHp=5, problemId=null, syncing=false;
  const keys={}, objects=new Map();
  const seenSplats=new Set();
  const avatarTextures=new Map();
  let selectedAvatar='dennis';
  try {selectedAvatar=normalizeAvatar(localStorage.getItem('erling-avatar'));} catch {}
  for(const avatar of AVATARS) {
    const label=document.createElement('label');label.className='avatar-card';
    const input=document.createElement('input');input.type='radio';input.name='online-avatar';input.value=avatar.id;input.checked=avatar.id===selectedAvatar;
    const img=document.createElement('img');img.src=avatar.image;img.alt='';img.width=100;img.height=112;
    const title=document.createElement('span');title.textContent=avatar.name;
    label.append(input,img,title);$('avatar-options').append(label);
    input.addEventListener('change',()=>{
      selectedAvatar=avatar.id;
      try {localStorage.setItem('erling-avatar',selectedAvatar);} catch {}
    });
  }
  async function loadAvatars() {
    await Promise.all(AVATARS.map(async avatar=>{
      if(avatarTextures.has(avatar.id)) return;
      const texture=await new THREE.TextureLoader().loadAsync(avatar.image);
      texture.colorSpace=THREE.SRGBColorSpace;
      avatarTextures.set(avatar.id,texture);
    }));
  }
  const movement=createPlayerMovement({camera,colliders,keys,input:touchInput});
  const blocked=(x,z,r=.48,y=0,height=1.95)=>colliders.some(c=>x+r>c.min.x && x-r<c.max.x && z+r>c.min.z && z-r<c.max.z && c.max.y>y+.025 && c.min.y<y+height);

  function clearObjects() {
    gunnarSlime.clear();seenSplats.clear();
    for(const object of objects.values()) dispose(object);
    objects.clear();
  }
  function dispose(object) {
    scene.remove(object.group);
    if(object.rig) disposeErlingRig(object.rig);
    else object.group.traverse(o=>{o.geometry?.dispose();if(o.material){if(!o.userData.sharedAvatarTexture)o.material.map?.dispose();o.material.dispose();}});
  }
  function stop(message='') {
    const previous=room; room=null; void previous?.close();
    clearObjects(); state=null; me=null; epoch=-1; lastPhase=''; problemId=null;
    movement.reset(0,18); answer=''; syncing=false;
    for(const key of Object.keys(keys)) delete keys[key];
    controls.unlock(); $('online-hud').hidden=true;
    $('online-setup').hidden=false; $('online-lobby').hidden=true;
    $('online-overlay').classList.add('open'); $('start-overlay').classList.remove('open');
    text($('online-title'),'Sammen eller mod hinanden?'); text($('online-status'),message);
    text($('pointer-note'),'Klik i spillet for at fange musen'); $('pointer-note').classList.remove('show');
  }
  function showSetup() {
    $('start-overlay').classList.remove('open'); $('online-overlay').classList.add('open');
    $('online-name').focus();
  }
  function setBusy(value) {
    busy=value; $('create-room').disabled=value; $('join-room').disabled=value;
  }
  async function connect(host) {
    if(busy || room) return;
    if(!ready()) {text($('online-status'),'Figurerne indlæses stadig. Prøv igen om et øjeblik.');return;}
    setBusy(true); text($('online-status'),host?'Starter server…':'Finder server…');
    const next=new GameRoom(window.JacobBackend?.realtimeClient,{blocked,onState:receive,onError:message=>stop(message)});
    room=next;
    try {
      text($('online-status'),'Henter avatarer…');
      await loadAvatars();
      if(room!==next) return;
      await next.open({host,code:host?roomCode():$('room-code').value,mode:document.querySelector('[name=online-mode]:checked').value,name:$('online-name').value||`Elev ${Math.floor(Math.random()*90)+10}`,avatar:selectedAvatar});
      if(room!==next) return;
      $('online-setup').hidden=true; $('online-lobby').hidden=false;
      text($('lobby-code'),next.code);
      text($('online-status'),host?'Serveren er klar. Del koden eller linket.':'Venter på svar fra værten…');
    } catch(error) { if(room===next) stop(error.message||'Avatarerne kunne ikke hentes. Prøv igen.'); }
    finally {setBusy(false);}
  }
  function receive(next,player) {
    if(!room || !player) return;
    const phaseChanged=next.phase!==lastPhase;
    state=next; me=player;
    if(next.phase==='playing' && phaseChanged) {
      prepare(); clearObjects(); startAudio();
      $('online-overlay').classList.remove('open'); $('online-hud').hidden=false;
      text($('pointer-note'),'Klik i spillet for at fange musen'); $('pointer-note').classList.add('show');
    }
    if(next.phase!=='playing') {
      if(phaseChanged) controls.unlock();
      $('online-overlay').classList.add('open'); $('online-setup').hidden=true; $('online-lobby').hidden=false;
      $('online-hud').hidden=true;
      text($('online-title'),next.phase==='finished'?next.result:'Serveren er klar');
      text($('lobby-code'),room.code);
      text($('lobby-mode'),next.mode==='coop'?'CO-OP · Fem bølger med Erling og Gunnar · Ingen skade på holdkammerater':'DEATHMATCH · Først til 10 point · Fem liv pr. genopståen');
      $('begin-match').hidden=!room.host;
      $('begin-match').disabled=next.players.length<2;
      text($('begin-match'),next.phase==='finished'?'SPIL IGEN':'START KAMPEN');
      text($('lobby-instructions'),room.host?(next.players.length<2?'Venter på mindst én klassekammerat…':'Alle er med. Start kampen, når I er klar.'):'Venter på at værten starter kampen.');
      text($('online-status'),'');
    }
    for(const splat of next.splats||[]) if(!seenSplats.has(splat.id)) {
      seenSplats.add(splat.id);
      if(next.clock-splat.at<2.8) gunnarSlime.burst(splat);
    }
    const activeSplats=new Set((next.splats||[]).map(s=>s.id));
    for(const id of seenSplats) if(!activeSplats.has(id)) seenSplats.delete(id);
    const rows=next.players.map(p=>`${p.name}${p.id===room.id?' (dig)':''}${p.id===room.hostId?' · vært':''} — ${p.score} point · ${p.hp} ♥`);
    for(const id of ['lobby-players','online-scores']) {
      const list=$(id), joined=rows.join('\n')+next.players.map(p=>normalizeAvatar(p.avatar)).join(',');
      if(list.dataset.rows!==joined) {
        list.replaceChildren(...rows.map((row,index)=>{
          const li=document.createElement('li'),img=document.createElement('img'),span=document.createElement('span');
          const avatar=avatarFor(next.players[index].avatar);
          img.src=avatar.image;img.alt='';img.title=avatar.name;img.className='player-avatar';
          span.textContent=id==='lobby-players'?`${row} · ${avatar.name}`:row;
          li.dataset.avatar=avatar.id;li.append(img,span);return li;
        }));list.dataset.rows=joined;
      }
    }
    if(player.epoch!==epoch) {
      epoch=player.epoch; room.epoch=epoch; room.actions=[];
      movement.reset(player.x,player.z);camera.rotation.set(0,player.yaw,0);
      answer='';previousHp=player.hp;
    } else if(Math.hypot(camera.position.x-player.x,camera.position.z-player.z)>1.6) {
      movement.reset(player.x,player.z);
    }
    if(player.hp<previousHp) flash('damage-flash');
    previousHp=player.hp;
    if(problemId!==player.problem.id) {problemId=player.problem.id;answer='';syncing=false;}
    if(player.note==='Forkert. Prøv igen.') syncing=false;
    text($('lives'),'♥ '.repeat(Math.max(0,player.hp)).trim()||'0');
    text($('ammo'),player.ammo);text($('score'),player.score);
    text($('problem'),`${player.problem.a} × ${player.problem.b}`);text($('answer'),answer||'_');
    text(document.querySelector('.math-kicker'),next.mode==='coop'?'HOLDETS BLYANTER · GANGESTYKKER':'DEATHMATCH · GANGESTYKKER');
    text($('feedback'),player.hp<=0?(next.mode==='coop'?'Du genoplives ved næste bølge. Hep på holdet!':'Du genopstår om et øjeblik…'):(player.note||'Svar rigtigt for at få en blyant.'));
    text($('online-match-label'),`${next.mode==='coop'?'CO-OP':'DEATHMATCH'} · ${room.code}`);
    const ownAvatar=avatarFor(player.avatar);
    if($('self-avatar').dataset.avatar!==ownAvatar.id) {
      $('self-avatar').src=ownAvatar.image;$('self-avatar').dataset.avatar=ownAvatar.id;
      text($('self-avatar-name'),`Du er ${ownAvatar.name}`);
    }
    text($('online-objective'),next.mode==='coop'?`Bølge ${Math.min(next.wave,5)}/5 · ${next.enemies.length} fjender tilbage · ${next.kills} besejret`:'Først til 10 point. Tre sekunders beskyttelse efter genopståen.');
    lastPhase=next.phase;
  }
  function playerObject(p,index) {
    const group=new THREE.Group(), colour=colours[index%colours.length];
    const avatar=avatarFor(p.avatar),map=avatarTextures.get(avatar.id);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,alphaTest:.12,depthWrite:true,toneMapped:false}));
    sprite.name=`avatar:${avatar.id}`;sprite.userData.sharedAvatarTexture=true;sprite.center.set(.5,0);
    sprite.scale.set(1.95*map.image.width/map.image.height,1.95,1);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.45,.52,32),new THREE.MeshBasicMaterial({color:colour,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.025;
    group.add(sprite,ring);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#14252f';ctx.fillRect(0,0,512,80);ctx.fillStyle='#fff6df';ctx.font='bold 38px Arial';ctx.textAlign='center';ctx.fillText(p.name,256,54,490);
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:true}));label.position.y=2.3;label.scale.set(2.8,.44,1);group.add(label);
    scene.add(group);return {group,sprite};
  }
  function renderObjects(dt,time) {
    if(!state || state.phase!=='playing') return;
    const wanted=new Set();
    const list=[...state.players.filter(p=>p.id!==room.id).map(p=>({...p,kind:'player'})),...state.enemies.map(e=>({...e,kind:'enemy'})),...state.shots.map(s=>({...s,kind:'shot'}))];
    for(const item of list) {
      const id=`${item.kind}:${item.id}`;wanted.add(id);
      let object=objects.get(id);
      if(!object) {
        if(item.kind==='player') object=playerObject(item,state.players.findIndex(p=>p.id===item.id));
        else if(item.kind==='enemy') {
          const rig=item.type==='gunnar'?createGunnarRig(textures().gunnar):createErlingRig(textures().erling);
          object={group:rig.group,rig};scene.add(object.group);
        } else {object={group:makePencil()};scene.add(object.group);}
        object.group.position.set(item.x,item.kind==='player'?item.y-(item.crouching?.78:1.7):item.y||0,item.z);objects.set(id,object);
      }
      object.group.visible=item.hp!==0;
      const old=object.group.position.clone();
      const target=new THREE.Vector3(item.x,item.kind==='player'?item.y-(item.crouching?.78:1.7):item.y||0,item.z);
      object.group.position.lerp(target,1-Math.exp(-18*dt));
      if(item.kind==='shot') object.group.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),new THREE.Vector3(item.dx,item.dy,item.dz));
      else if(item.kind==='player') {
        object.group.rotation.y=item.yaw;object.group.scale.y=item.crouching?.55:1;
        object.sprite.position.y=Math.sin(time*.012)*Math.min(.035,object.group.position.distanceTo(old)*.4);
      }
      else {
        object.group.lookAt(camera.position.x,0,camera.position.z);
        animateErling(object.rig,dt,time,object.group.position.distanceTo(old));
      }
    }
    for(const [id,object] of objects) if(!wanted.has(id)) {dispose(object);objects.delete(id);}
  }
  function update(dt,time) {
    if(!room || !state || state.phase!=='playing') return;
    if(me?.hp>0 && inputReady()) {
      movement.update(dt);
    }
    room.pose={x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:camera.rotation.y,crouching:movement.crouching,sprinting:Boolean(keys.ShiftLeft||keys.ShiftRight||touchInput.sprint)};
    renderObjects(dt,time);
  }
  function keydown(e) {
    if(!state || state.phase!=='playing' || /INPUT|TEXTAREA/.test(e.target?.tagName)) return;
    if(e.code==='Escape') {controls.unlock();return;}
    keys[e.code]=true;
    if(/^(Control|Shift|Key[WASD]|Space|Digit|Numpad|Enter|Backspace)/.test(e.code)) e.preventDefault();
    if(me?.hp<=0) return;
    if(e.code==='Space' && !e.repeat && inputReady()) movement.jump();
    if(/^Digit\d$/.test(e.code) && answer.length<3) {answer+=e.code.slice(-1);text($('answer'),answer);}
    if(e.code==='Backspace') {e.preventDefault();answer=answer.slice(0,-1);text($('answer'),answer||'_');}
    if(e.code==='Enter' && answer && !e.repeat && !syncing) {
      room.action({type:'answer',problem:me.problem.id,value:answer});answer='';syncing=true;text($('answer'),'_');
      // No repeated credit while awaiting the next host-assigned problem.
      setTimeout(()=>{syncing=false;},1200);
    }
  }
  function fire() {
    if(!room || state?.phase!=='playing' || !inputReady() || !me || me.hp<=0 || me.ammo<=0) return;
    const dir=new THREE.Vector3();camera.getWorldDirection(dir);
    room.action({type:'shoot',dir:{x:dir.x,y:dir.y,z:dir.z}});flash('shot-flash');
  }
  $('online-button').addEventListener('click',showSetup);
  $('create-room').addEventListener('click',()=>void connect(true));
  $('join-room').addEventListener('click',()=>void connect(false));
  $('begin-match').addEventListener('click',()=>room?.start());
  $('leave-room').addEventListener('click',()=>{stop();$('online-overlay').classList.remove('open');$('start-overlay').classList.add('open');});
  $('exit-match').addEventListener('click',()=>stop('Du har forladt serveren.'));
  $('copy-room').addEventListener('click',async()=>{
    if(!room) return;
    const url=new URL(location.href);url.search='';url.searchParams.set('room',room.code);url.hash='';
    try {await navigator.clipboard.writeText(url.href);text($('online-status'),'Linket er kopieret. Send det til dine klassekammerater.');}
    catch {text($('online-status'),`Del koden ${room.code}. Browseren kunne ikke kopiere linket.`);}
  });
  addEventListener('keyup',e=>delete keys[e.code]);
  const clearKeys=()=>{for(const key of Object.keys(keys)) delete keys[key];};
  addEventListener('blur',clearKeys);controls.addEventListener('unlock',clearKeys);
  addEventListener('pagehide',()=>void room?.close());
  $('game').addEventListener('click',()=>{if(room && state?.phase==='playing' && !touchEnabled() && !controls.isLocked) controls.lock();});
  controls.addEventListener('lock',()=>$('pointer-note').classList.remove('show'));
  controls.addEventListener('unlock',()=>{if(room && state?.phase==='playing') $('pointer-note').classList.add('show');});
  const supplied=new URLSearchParams(location.search).get('room');
  if(supplied) {$('room-code').value=supplied.slice(0,8).toUpperCase();showSetup();}
  return {get active(){return Boolean(room);},get playing(){return state?.phase==='playing';},clearKeys,update,keydown,fire};
}
