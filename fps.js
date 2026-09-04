import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const canvas=document.getElementById('game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8eb5c4);
scene.fog=new THREE.Fog(0x8eb5c4,36,78);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,110);
camera.position.set(0,1.7,18);
const controls=new PointerLockControls(camera,document.body);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xdcefff,0x62594c,2.4));
const sun=new THREE.DirectionalLight(0xfff1cf,2.6);sun.position.set(-18,28,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;scene.add(sun);

const WORLD=54,WALL_H=3.7,PLAYER_R=.48,EYE=1.7;
const colliders=[];
let erlingTexture=null;

function makeTransparentErlingTexture(image){
  const c=document.createElement('canvas');c.width=image.naturalWidth||image.width;c.height=image.naturalHeight||image.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);
  const img=ctx.getImageData(0,0,c.width,c.height),data=img.data,w=c.width,h=c.height;
  const seen=new Uint8Array(w*h),stack=[];
  const nearWhite=i=>{const p=i*4,r=data[p],g=data[p+1],b=data[p+2];return r>220&&g>220&&b>220&&Math.max(r,g,b)-Math.min(r,g,b)<28;};
  const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const i=y*w+x;if(seen[i]||!nearWhite(i))return;seen[i]=1;stack.push(i);};
  for(let x=0;x<w;x++){push(x,0);push(x,h-1);}for(let y=0;y<h;y++){push(0,y);push(w-1,y);}
  while(stack.length){const i=stack.pop(),x=i%w,y=(i/w)|0,p=i*4;data[p+3]=0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}
  ctx.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}
new THREE.TextureLoader().load('assets/figurer/erling-aergerlig.webp',tex=>{erlingTexture=makeTransparentErlingTexture(tex.image);tex.dispose();});

function mat(color){return new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.02});}
const floorMat=mat(0xc8b992),wallMat=mat(0xe7dfc8),trimMat=mat(0x375d67),deskMat=mat(0x9a633e),lockerMat=mat(0x66838a);
function box(x,y,z,w,h,d,material=wallMat,solid=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);if(solid)colliders.push(new THREE.Box3().setFromObject(m));return m;}
box(0,-.12,0,WORLD,.24,WORLD,floorMat,false);
box(0,WALL_H/2,-WORLD/2,WORLD,WALL_H,.45);box(0,WALL_H/2,WORLD/2,WORLD,WALL_H,.45);box(-WORLD/2,WALL_H/2,0,.45,WALL_H,WORLD);box(WORLD/2,WALL_H/2,0,.45,WALL_H,WORLD);
[[-13,-17,18,.35],[-13,1,18,.35],[-13,20,14,.35],[13,-20,13,.35],[13,-4,13,.35],[13,13,18,.35],[-20,-10,.35,13],[-5,-10,.35,13],[10,-10,.35,11],[22,-10,.35,9],[-21,10,.35,14],[-6,10,.35,12],[9,10,.35,10],[21,10,.35,11]].forEach(([x,z,w,d])=>box(x,WALL_H/2,z,w,WALL_H,d,wallMat));
box(-26,1.15,-2,.08,1.25,8,trimMat,false);box(26,1.15,5,.08,1.25,9,trimMat,false);box(-19,1.65,-26.7,8,1.55,.08,mat(0x29483e),false);box(19,1.65,26.7,8,1.55,.08,mat(0x29483e),false);
[[-20,-19],[-16,-19],[-20,-15],[-16,-15],[18,-18],[22,-18],[18,-14],[22,-14],[-20,18],[-16,18],[-20,22],[-16,22],[18,17],[22,17],[18,21],[22,21]].forEach(([x,z])=>{box(x,.55,z,2.3,.12,1.25,deskMat,true);box(x-.85,.27,z,.12,.55,1,deskMat,true);box(x+.85,.27,z,.12,.55,1,deskMat,true);});
for(let z=-20;z<=20;z+=2.2)box(-25.4,1,z,.8,2,1.7,lockerMat,true);
for(let z=-21;z<=21;z+=7){box(0,3.48,z,4,.08,.7,mat(0xf6e6ae),false);const light=new THREE.PointLight(0xffe8ad,.85,10);light.position.set(0,3.15,z);scene.add(light);}

const keys={};let vy=0,onGround=true,last=performance.now(),lives=5,ammo=0,score=0,answer='',gameActive=false,problem=null,invulnerableUntil=0;
let enemies=[],projectiles=[],spawnVoiceIndex=0,moveVoiceIndex=0,lastMoveVoiceAt=0,musicMuted=false,audioCtx=null,musicGain=null,musicTimer=null,musicStep=0;
const livesEl=document.getElementById('lives'),ammoEl=document.getElementById('ammo'),scoreEl=document.getElementById('score'),problemEl=document.getElementById('problem'),answerEl=document.getElementById('answer'),feedbackEl=document.getElementById('feedback');

function newProblem(){const a=1+Math.floor(Math.random()*9),b=1+Math.floor(Math.random()*9);problem={a,b,result:a*b};problemEl.textContent=`${a} × ${b}`;answer='';answerEl.textContent='_';feedbackEl.textContent='Svar rigtigt for at få en blyant. · M = musik';feedbackEl.className='feedback';}
function pickSpawnPosition(){const candidates=[[-21,-22],[20,-22],[-20,22],[20,22],[0,-23],[0,23],[-23,0],[23,0],[-7,-22],[8,22]];const valid=candidates.filter(p=>new THREE.Vector2(p[0]-camera.position.x,p[1]-camera.position.z).length()>11);const pool=valid.length?valid:candidates;const p=pool[Math.floor(Math.random()*pool.length)];return new THREE.Vector3(p[0]+(Math.random()-.5)*2.4,0,p[1]+(Math.random()-.5)*2.4);}
function createErling(){const group=new THREE.Group();const material=new THREE.SpriteMaterial({map:erlingTexture,transparent:true,alphaTest:.04});const body=new THREE.Sprite(material);body.scale.set(2.65,3.5,1);body.position.y=1.72;group.add(body);const enemy={group,body};group.position.copy(pickSpawnPosition());scene.add(group);enemies.push(enemy);return enemy;}
function removeEnemy(enemy){const i=enemies.indexOf(enemy);if(i>=0)enemies.splice(i,1);enemy.body.material.dispose();scene.remove(enemy.group);}
function clearEnemies(){[...enemies].forEach(removeEnemy);}

function speakLine(text,opts={}){if(!('speechSynthesis' in window))return;const u=new SpeechSynthesisUtterance(text);u.lang='da-DK';u.rate=opts.rate||.86;u.pitch=opts.pitch||.68;u.volume=opts.volume||.92;const voices=speechSynthesis.getVoices();const danish=voices.find(v=>/^da(-|_)/i.test(v.lang))||voices.find(v=>/danish/i.test(v.name));if(danish)u.voice=danish;speechSynthesis.speak(u);}
function speakSpawn(){const lines=['Nu kommer Erling!','Ned med de dygtige!'];speakLine(lines[spawnVoiceIndex++%lines.length],{rate:.82,pitch:.64,volume:.96});}
function maybeSpeakWhileMoving(now){if(!enemies.length||now-lastMoveVoiceAt<6500||speechSynthesis.speaking)return;lastMoveVoiceAt=now;const lines=['Nu har jeg dig!','Jeg slapper din matematik-eksamen!','Du skal være et nul ligesom mig!'];speakLine(lines[moveVoiceIndex++%lines.length],{rate:.88,pitch:.67,volume:.9});}
function spawnWave(count=1,announce=true){for(let i=0;i<count;i++)createErling();if(announce)speakSpawn();}

function ensureMusic(){if(audioCtx)return;audioCtx=new (window.AudioContext||window.webkitAudioContext)();musicGain=audioCtx.createGain();musicGain.gain.value=musicMuted?0:.12;musicGain.connect(audioCtx.destination);const bass=[55,55,65.41,55,73.42,65.41,55,49],lead=[220,261.63,293.66,329.63,293.66,261.63,220,196];musicTimer=setInterval(()=>{if(!gameActive||musicMuted||audioCtx.state!=='running')return;const now=audioCtx.currentTime;const hit=(freq,duration,type,gainValue)=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,now);g.gain.setValueAtTime(gainValue,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(g);g.connect(musicGain);osc.start(now);osc.stop(now+duration);};hit(bass[musicStep%bass.length],.19,'sawtooth',.5);if(musicStep%2===0)hit(lead[musicStep%lead.length],.11,'square',.18);const noise=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.045),audioCtx.sampleRate),data=buf.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;noise.buffer=buf;const ng=audioCtx.createGain();ng.gain.setValueAtTime(.07,now);ng.gain.exponentialRampToValueAtTime(.0001,now+.045);noise.connect(ng);ng.connect(musicGain);noise.start(now);musicStep++;},170);}
function toggleMusic(){musicMuted=!musicMuted;if(musicGain)musicGain.gain.setTargetAtTime(musicMuted?0:.12,audioCtx.currentTime,.03);feedbackEl.textContent=musicMuted?'Musik: SLUKKET (M)':'Musik: TÆNDT (M)';feedbackEl.className='feedback';}

function makePencil(){const group=new THREE.Group();const wood=new THREE.MeshStandardMaterial({color:0xf4b522,roughness:.6}),graphite=new THREE.MeshStandardMaterial({color:0x292929,roughness:.8}),pink=new THREE.MeshStandardMaterial({color:0xdb7f8e,roughness:.65}),metal=new THREE.MeshStandardMaterial({color:0xb7a986,roughness:.4,metalness:.5});const body=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.9,8),wood);body.rotation.z=Math.PI/2;group.add(body);const ferrule=new THREE.Mesh(new THREE.CylinderGeometry(.062,.062,.14,10),metal);ferrule.rotation.z=Math.PI/2;ferrule.position.x=-.51;group.add(ferrule);const eraser=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.16,10),pink);eraser.rotation.z=Math.PI/2;eraser.position.x=-.66;group.add(eraser);const tip=new THREE.Mesh(new THREE.ConeGeometry(.08,.24,10),wood);tip.rotation.z=-Math.PI/2;tip.position.x=.57;group.add(tip);const lead=new THREE.Mesh(new THREE.ConeGeometry(.032,.09,8),graphite);lead.rotation.z=-Math.PI/2;lead.position.x=.72;group.add(lead);group.scale.setScalar(1.35);return group;}
function firePencil(){if(!gameActive||!controls.isLocked||ammo<=0)return;ammo--;updateHUD();flash('shot-flash');const dir=new THREE.Vector3();camera.getWorldDirection(dir);dir.normalize();const mesh=makePencil();mesh.position.copy(camera.position).add(dir.clone().multiplyScalar(.8)).add(new THREE.Vector3(0,-.12,0));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),dir);scene.add(mesh);projectiles.push({mesh,velocity:dir.multiplyScalar(24),life:1.8});}
function removeProjectile(p){const i=projectiles.indexOf(p);if(i>=0)projectiles.splice(i,1);p.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});scene.remove(p.mesh);}
function updateProjectiles(dt){for(const p of [...projectiles]){const old=p.mesh.position.clone();p.mesh.position.addScaledVector(p.velocity,dt);p.life-=dt;const sphere=new THREE.Sphere(p.mesh.position,.32);const hitWall=colliders.some(c=>c.intersectsSphere(sphere));if(hitWall||p.life<=0){removeProjectile(p);continue;}let hitEnemy=null;for(const enemy of enemies){const pos=enemy.group.position.clone();pos.y=1.65;if(p.mesh.position.distanceTo(pos)<1.05){hitEnemy=enemy;break;}}if(hitEnemy){removeProjectile(p);removeEnemy(hitEnemy);score++;updateHUD();spawnWave(2,true);}}
}

function playerBlocked(next){const sphere=new THREE.Sphere(new THREE.Vector3(next.x,1,next.z),PLAYER_R);return colliders.some(c=>c.intersectsSphere(sphere));}
function enemyBlocked(next){const sphere=new THREE.Sphere(new THREE.Vector3(next.x,1,next.z),.5);return colliders.some(c=>c.intersectsSphere(sphere));}
function updateHUD(){livesEl.textContent='♥ '.repeat(lives).trim()||'0';ammoEl.textContent=ammo;scoreEl.textContent=score;}
function flash(id){const el=document.getElementById(id);el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}
function hurt(enemy){const now=performance.now();if(now<invulnerableUntil)return;invulnerableUntil=now+1200;lives--;flash('damage-flash');updateHUD();if(enemy)removeEnemy(enemy);if(lives<=0){gameActive=false;controls.unlock();document.getElementById('final-score').textContent=score;document.getElementById('game-over').classList.add('open');return;}if(enemies.length===0)spawnWave(1,true);}
function submitAnswer(){if(!problem||!answer)return;if(Number(answer)===problem.result){ammo++;feedbackEl.textContent='KORREKT! +1 BLYANT ✎';feedbackEl.className='feedback good';updateHUD();setTimeout(()=>{if(gameActive)newProblem();},420);}else{feedbackEl.textContent='Forkert. Prøv igen.';feedbackEl.className='feedback bad';answer='';answerEl.textContent='_';}}

addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyM'&&!e.repeat){toggleMusic();return;}if(e.code==='Space'&&onGround&&gameActive){vy=6.4;onGround=false;e.preventDefault();}if(/^Digit\d$/.test(e.code)&&gameActive){if(answer.length<3){answer+=e.key;answerEl.textContent=answer;}}if(e.code==='Backspace'&&gameActive){answer=answer.slice(0,-1);answerEl.textContent=answer||'_';}if(e.code==='Enter'&&gameActive)submitAnswer();});
addEventListener('keyup',e=>keys[e.code]=false);addEventListener('mousedown',e=>{if(e.button===0)firePencil();});canvas.addEventListener('click',()=>{if(gameActive&&!controls.isLocked)controls.lock();});controls.addEventListener('lock',()=>document.getElementById('pointer-note').classList.remove('show'));controls.addEventListener('unlock',()=>{if(gameActive)document.getElementById('pointer-note').classList.add('show');});
document.getElementById('start-button').addEventListener('click',()=>{document.getElementById('start-overlay').classList.remove('open');gameActive=true;ensureMusic();audioCtx?.resume();clearEnemies();newProblem();spawnWave(1,true);controls.lock();});
document.getElementById('restart-button').addEventListener('click',()=>{document.getElementById('game-over').classList.remove('open');lives=5;ammo=0;score=0;camera.position.set(0,EYE,18);updateHUD();gameActive=true;ensureMusic();audioCtx?.resume();clearEnemies();newProblem();spawnWave(1,true);controls.lock();});

function update(dt,time){if(!gameActive)return;const old=camera.position.clone();const speed=5.4;let dx=0,dz=0;if(keys.KeyW)dz-=1;if(keys.KeyS)dz+=1;if(keys.KeyA)dx-=1;if(keys.KeyD)dx+=1;if(dx||dz){const len=Math.hypot(dx,dz);dx/=len;dz/=len;const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();const move=forward.multiplyScalar(-dz*speed*dt).add(right.multiplyScalar(dx*speed*dt));const nx=old.clone().add(new THREE.Vector3(move.x,0,0));if(!playerBlocked(nx))camera.position.x=nx.x;const nz=camera.position.clone().add(new THREE.Vector3(0,0,move.z));if(!playerBlocked(nz))camera.position.z=nz.z;}vy-=17*dt;camera.position.y+=vy*dt;if(camera.position.y<=EYE){camera.position.y=EYE;vy=0;onGround=true;}for(const enemy of [...enemies]){if(!enemies.includes(enemy))continue;const ep=enemy.group.position;const toPlayer=new THREE.Vector3(camera.position.x-ep.x,0,camera.position.z-ep.z);const dist=toPlayer.length();if(dist>.01){toPlayer.normalize();const step=toPlayer.multiplyScalar(1.35*dt);const nx=ep.clone().add(new THREE.Vector3(step.x,0,0));const nz=ep.clone().add(new THREE.Vector3(0,0,step.z));if(!enemyBlocked(nx))ep.x=nx.x;if(!enemyBlocked(nz))ep.z=nz.z;}enemy.body.position.y=1.72+Math.sin(time*.004+enemies.indexOf(enemy))*.045;enemy.group.lookAt(camera.position.x,0,camera.position.z);if(dist<1.15)hurt(enemy);}updateProjectiles(dt);maybeSpeakWhileMoving(time);}
function loop(t){const dt=Math.min((t-last)/1000,.04);last=t;update(dt,t);renderer.render(scene,camera);requestAnimationFrame(loop);}requestAnimationFrame(loop);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});updateHUD();
