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
const sun=new THREE.DirectionalLight(0xfff1cf,2.6); sun.position.set(-18,28,12); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45; scene.add(sun);

const WORLD=54, WALL_H=3.7, PLAYER_R=.48, EYE=1.7;
const colliders=[];
const erlingTexture=new THREE.TextureLoader().load('assets/figurer/erling-aergerlig.webp');
erlingTexture.colorSpace=THREE.SRGBColorSpace;

function mat(color){return new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.02});}
const floorMat=mat(0xc8b992), wallMat=mat(0xe7dfc8), trimMat=mat(0x375d67), deskMat=mat(0x9a633e), lockerMat=mat(0x66838a);
function box(x,y,z,w,h,d,material=wallMat,solid=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);if(solid)colliders.push(new THREE.Box3().setFromObject(m));return m;}

box(0,-.12,0,WORLD,.24,WORLD,floorMat,false);
box(0,WALL_H/2,-WORLD/2,WORLD,WALL_H,.45); box(0,WALL_H/2,WORLD/2,WORLD,WALL_H,.45); box(-WORLD/2,WALL_H/2,0,.45,WALL_H,WORLD); box(WORLD/2,WALL_H/2,0,.45,WALL_H,WORLD);
[
 [-13,-17,18,.35],[-13,1,18,.35],[-13,20,14,.35],[13,-20,13,.35],[13,-4,13,.35],[13,13,18,.35],
 [-20,-10,.35,13],[-5,-10,.35,13],[10,-10,.35,11],[22,-10,.35,9],[-21,10,.35,14],[-6,10,.35,12],[9,10,.35,10],[21,10,.35,11]
].forEach(([x,z,w,d])=>box(x,WALL_H/2,z,w,WALL_H,d,wallMat));
box(-26,1.15,-2,.08,1.25,8,trimMat,false);box(26,1.15,5,.08,1.25,9,trimMat,false);
box(-19,1.65,-26.7,8,1.55,.08,mat(0x29483e),false);box(19,1.65,26.7,8,1.55,.08,mat(0x29483e),false);
[[-20,-19],[-16,-19],[-20,-15],[-16,-15],[18,-18],[22,-18],[18,-14],[22,-14],[-20,18],[-16,18],[-20,22],[-16,22],[18,17],[22,17],[18,21],[22,21]].forEach(([x,z])=>{
 box(x,.55,z,2.3,.12,1.25,deskMat,true); box(x-.85,.27,z,.12,.55,1,deskMat,true);box(x+.85,.27,z,.12,.55,1,deskMat,true);
});
for(let z=-20;z<=20;z+=2.2)box(-25.4,1,z,.8,2,1.7,lockerMat,true);
for(let z=-21;z<=21;z+=7){box(0,3.48,z,4,.08,.7,mat(0xf6e6ae),false);const light=new THREE.PointLight(0xffe8ad,.85,10);light.position.set(0,3.15,z);scene.add(light);}

const keys={}; let vy=0,onGround=true,last=performance.now(),lives=5,ammo=0,score=0,answer='',gameActive=false,enemy=null,problem=null,invulnerableUntil=0;
const livesEl=document.getElementById('lives'),ammoEl=document.getElementById('ammo'),scoreEl=document.getElementById('score'),problemEl=document.getElementById('problem'),answerEl=document.getElementById('answer'),feedbackEl=document.getElementById('feedback');
const raycaster=new THREE.Raycaster();

function makeTextSprite(text){const c=document.createElement('canvas');c.width=512;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#f4e8ca';ctx.strokeStyle='#111820';ctx.lineWidth=14;ctx.beginPath();ctx.roundRect(12,12,488,168,28);ctx.fill();ctx.stroke();ctx.fillStyle='#111820';ctx.font='900 70px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,96);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true}));s.scale.set(3.7,1.4,1);return s;}
function newProblem(){const a=1+Math.floor(Math.random()*9),b=1+Math.floor(Math.random()*9);problem={a,b,result:a*b};problemEl.textContent=`${a} × ${b}`;answer='';answerEl.textContent='_';feedbackEl.textContent='Svar rigtigt for at få en blyant.';feedbackEl.className='feedback';if(enemy){enemy.label.material.map.dispose();enemy.group.remove(enemy.label);enemy.label=makeTextSprite(`${a} × ${b}`);enemy.label.position.set(0,3.05,0);enemy.group.add(enemy.label);}}
function spawnErling(){if(enemy)scene.remove(enemy.group);const group=new THREE.Group();const body=new THREE.Sprite(new THREE.SpriteMaterial({map:erlingTexture,transparent:true,alphaTest:.08}));body.scale.set(2.65,3.5,1);body.position.y=1.72;group.add(body);const label=makeTextSprite('');label.position.set(0,3.05,0);group.add(label);const candidates=[[-21,-22],[20,-22],[-20,22],[20,22],[0,-23],[0,23]];let p=candidates[Math.floor(Math.random()*candidates.length)];if(new THREE.Vector2(p[0]-camera.position.x,p[1]-camera.position.z).length()<13)p=candidates[(candidates.indexOf(p)+2)%candidates.length];group.position.set(p[0],0,p[1]);scene.add(group);enemy={group,body,label};newProblem();}
function playerBlocked(next){const sphere=new THREE.Sphere(new THREE.Vector3(next.x,1,next.z),PLAYER_R);return colliders.some(c=>c.intersectsSphere(sphere));}
function enemyBlocked(next){const sphere=new THREE.Sphere(new THREE.Vector3(next.x,1,next.z),.5);return colliders.some(c=>c.intersectsSphere(sphere));}
function updateHUD(){livesEl.textContent='♥ '.repeat(lives).trim()||'0';ammoEl.textContent=ammo;scoreEl.textContent=score;}
function flash(id){const el=document.getElementById(id);el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}
function hurt(){const now=performance.now();if(now<invulnerableUntil)return;invulnerableUntil=now+1200;lives--;flash('damage-flash');updateHUD();if(lives<=0){gameActive=false;controls.unlock();document.getElementById('final-score').textContent=score;document.getElementById('game-over').classList.add('open');return;}spawnErling();}
function submitAnswer(){if(!problem||!answer)return;if(Number(answer)===problem.result){ammo++;feedbackEl.textContent='KORREKT! +1 BLYANT ✎';feedbackEl.className='feedback good';updateHUD();setTimeout(()=>{if(gameActive)newProblem();},420);}else{feedbackEl.textContent='Forkert. Prøv igen.';feedbackEl.className='feedback bad';answer='';answerEl.textContent='_';}}
function shoot(){if(!gameActive||!controls.isLocked||ammo<=0||!enemy)return;ammo--;updateHUD();flash('shot-flash');raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hits=raycaster.intersectObject(enemy.body,false);if(hits.length){score++;updateHUD();spawnErling();}}

addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'&&onGround&&gameActive){vy=6.4;onGround=false;e.preventDefault();}if(/^Digit\d$/.test(e.code)&&gameActive){if(answer.length<3){answer+=e.key;answerEl.textContent=answer;}}if(e.code==='Backspace'&&gameActive){answer=answer.slice(0,-1);answerEl.textContent=answer||'_';}if(e.code==='Enter'&&gameActive)submitAnswer();});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{if(e.button===0)shoot();});
canvas.addEventListener('click',()=>{if(gameActive&&!controls.isLocked)controls.lock();});
controls.addEventListener('lock',()=>document.getElementById('pointer-note').classList.remove('show'));
controls.addEventListener('unlock',()=>{if(gameActive)document.getElementById('pointer-note').classList.add('show');});

document.getElementById('start-button').addEventListener('click',()=>{document.getElementById('start-overlay').classList.remove('open');gameActive=true;spawnErling();controls.lock();});
document.getElementById('restart-button').addEventListener('click',()=>{document.getElementById('game-over').classList.remove('open');lives=5;ammo=0;score=0;camera.position.set(0,EYE,18);updateHUD();gameActive=true;spawnErling();controls.lock();});

function update(dt,time){if(!gameActive)return;
 const old=camera.position.clone();const speed=5.4;let dx=0,dz=0;if(keys.KeyW)dz-=1;if(keys.KeyS)dz+=1;if(keys.KeyA)dx-=1;if(keys.KeyD)dx+=1;if(dx||dz){const len=Math.hypot(dx,dz);dx/=len;dz/=len;const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();const move=forward.multiplyScalar(-dz*speed*dt).add(right.multiplyScalar(dx*speed*dt));const nx=old.clone().add(new THREE.Vector3(move.x,0,0));if(!playerBlocked(nx))camera.position.x=nx.x;const nz=camera.position.clone().add(new THREE.Vector3(0,0,move.z));if(!playerBlocked(nz))camera.position.z=nz.z;}
 vy-=17*dt;camera.position.y+=vy*dt;if(camera.position.y<=EYE){camera.position.y=EYE;vy=0;onGround=true;}
 if(enemy){const ep=enemy.group.position;const toPlayer=new THREE.Vector3(camera.position.x-ep.x,0,camera.position.z-ep.z);const dist=toPlayer.length();if(dist>.01){toPlayer.normalize();const step=toPlayer.multiplyScalar(1.35*dt);const nx=ep.clone().add(new THREE.Vector3(step.x,0,0));const nz=ep.clone().add(new THREE.Vector3(0,0,step.z));if(!enemyBlocked(nx))ep.x=nx.x;if(!enemyBlocked(nz))ep.z=nz.z;}enemy.body.position.y=1.72+Math.sin(time*.004)*.045;enemy.group.lookAt(camera.position.x,0,camera.position.z);if(dist<1.15)hurt();}
}
function loop(t){const dt=Math.min((t-last)/1000,.04);last=t;update(dt,t);renderer.render(scene,camera);requestAnimationFrame(loop);}requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
updateHUD();
