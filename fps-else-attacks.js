import * as THREE from 'three';

export const ELSE_PROJECTILE_SPEED_MULTIPLIER = 5;
export const ELSE_THROW_INTERVAL = 2.8;
export const ELSE_EXAM_INTERVAL = 4.8;
const PROJECTILE_RADIUS = .22;
const EXAM_RADIUS = 1.9;
const EXAM_DURATION = 2.35;

// Sweep the whole travelled segment, so a fast object cannot skip a thin fence
// or the player between frames. Return the nearest contact along that segment.
export function segmentBoxDistance(start, end, box, radius = PROJECTILE_RADIUS) {
  const expanded = box.clone().expandByScalar(radius);
  if (expanded.containsPoint(start)) return 0;
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length === 0) return Infinity;
  const point = new THREE.Ray(start, direction.divideScalar(length)).intersectBox(expanded, new THREE.Vector3());
  if (!point) return Infinity;
  const distance = point.distanceTo(start);
  return distance <= length ? distance : Infinity;
}

function makeExamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffdf4';
  ctx.fillRect(0,0,512,700);
  ctx.strokeStyle = '#b71d25';
  ctx.lineWidth = 18;
  ctx.strokeRect(18,18,476,664);
  ctx.fillStyle = '#222831';
  ctx.font = '900 44px Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EKSAMEN',256,92);
  ctx.fillStyle = '#c71925';
  ctx.font = '900 360px Arial Black,Arial,sans-serif';
  ctx.fillText('F',256,455);
  ctx.fillStyle = '#3d4248';
  ctx.font = '700 27px Arial,sans-serif';
  ctx.fillText('RESULTAT',256,615);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function speakDumpedFallback() {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance('DUMPET!');
  utterance.lang = 'da-DK';
  utterance.rate = .72;
  utterance.pitch = .55;
  utterance.volume = 1;
  const voices = speechSynthesis.getVoices();
  const danish = voices.find(v => /^da(-|_)/i.test(v.lang)) || voices.find(v => /danish/i.test(v.name));
  if (danish) utterance.voice = danish;
  speechSynthesis.speak(utterance);
}

export function createElseAttacks({ scene, colliders, onPlayerHit, onDumped }) {
  const shots = [];
  const examDrops = [];
  const wood = new THREE.MeshStandardMaterial({ color:0xe4b964, roughness:.8 });
  const ink = new THREE.MeshStandardMaterial({ color:0x30271d });
  const red = new THREE.MeshStandardMaterial({ color:0xd92130, roughness:.4 });
  const cap = new THREE.MeshStandardMaterial({ color:0x861722, roughness:.4 });
  const label = new THREE.MeshStandardMaterial({ color:0xffead7 });
  const unitBox = new THREE.BoxGeometry(1,1,1);
  const barrel = new THREE.CylinderGeometry(.09,.09,1.15,10);
  barrel.rotateZ(Math.PI/2);
  const capGeometry = new THREE.CylinderGeometry(.11,.11,.24,10);
  capGeometry.rotateZ(Math.PI/2);

  const examTexture = makeExamTexture();
  const examGeometry = new THREE.PlaneGeometry(1.55,2.12);
  const examMaterial = new THREE.MeshBasicMaterial({ map:examTexture, side:THREE.DoubleSide, toneMapped:false });
  const dangerFillMaterial = new THREE.MeshBasicMaterial({ color:0xe01926, transparent:true, opacity:.18, side:THREE.DoubleSide, depthWrite:false });
  const dangerRingMaterial = new THREE.MeshBasicMaterial({ color:0xff2535, transparent:true, opacity:.9, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending });
  const dangerFillGeometry = new THREE.CircleGeometry(EXAM_RADIUS,64);
  const dangerRingGeometry = new THREE.RingGeometry(EXAM_RADIUS*.76,EXAM_RADIUS,64);

  function block(group,x,y,z,w,h,d,material) {
    const mesh=new THREE.Mesh(unitBox,material);
    mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);
  }
  function makeRuler() {
    const group=new THREE.Group();
    block(group,0,0,0,1.55,.24,.055,wood);
    for(let i=0;i<=20;i++)block(group,-.7+i*.07,.065,.033,.012,i%5===0?.1:.055,.009,ink);
    return group;
  }
  function makeMarker() {
    const group=new THREE.Group();
    group.add(new THREE.Mesh(barrel,red));
    const lid=new THREE.Mesh(capGeometry,cap);lid.position.x=.55;group.add(lid);
    block(group,0,0,.09,.52,.1,.016,label);
    block(group,.47,.115,0,.32,.035,.045,cap);
    return group;
  }
  function remove(shot) {
    scene.remove(shot.mesh);
    const index=shots.indexOf(shot);
    if(index!==-1)shots.splice(index,1);
  }
  function removeExam(drop) {
    scene.remove(drop.marker,drop.paper);
    drop.fill.material.dispose();
    drop.ring.material.dispose();
    const index=examDrops.indexOf(drop);
    if(index!==-1)examDrops.splice(index,1);
  }
  function clear() {
    for(const shot of [...shots])remove(shot);
    for(const drop of [...examDrops])removeExam(drop);
  }

  function throwAt(enemy, target) {
    // Every second normal throw also launches an exam paper into the air.
    enemy.examThrowCounter=(enemy.examThrowCounter||0)+1;
    if(enemy.examThrowCounter%2===0) dropExamAt(enemy,target);

    const ruler=enemy.nextThrowIsRuler !== false;
    enemy.nextThrowIsRuler=!ruler;
    const mesh=ruler ? makeRuler() : makeMarker();
    const start=new THREE.Vector3(ruler ? -3.1 : 3.1,8.1,.45)
      .applyQuaternion(enemy.group.quaternion).add(enemy.group.position);
    const aim=target.clone().add(new THREE.Vector3(0,-.55,0));
    const velocity=aim.sub(start).normalize().multiplyScalar(enemy.speed*ELSE_PROJECTILE_SPEED_MULTIPLIER);
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),velocity.clone().normalize());
    scene.add(mesh);
    shots.push({mesh,velocity,life:18,kind:ruler?'ruler':'marker'});
  }

  function dropExamAt(enemy,target) {
    const impact = new THREE.Vector3(
      THREE.MathUtils.clamp(target.x,-17.5,17.5),
      .035,
      THREE.MathUtils.clamp(target.z,34.5,69.5)
    );

    const marker = new THREE.Group();
    marker.position.copy(impact);
    const fill = new THREE.Mesh(dangerFillGeometry,dangerFillMaterial.clone());
    fill.rotation.x=-Math.PI/2;
    const ring = new THREE.Mesh(dangerRingGeometry,dangerRingMaterial.clone());
    ring.rotation.x=-Math.PI/2;
    ring.position.y=.012;
    marker.add(fill,ring);

    const paper = new THREE.Mesh(examGeometry,examMaterial);
    const start = new THREE.Vector3(0,8.6,.3).applyQuaternion(enemy.group.quaternion).add(enemy.group.position);
    paper.position.copy(start);
    paper.rotation.set(-.2,enemy.group.rotation.y,.15);

    scene.add(marker,paper);
    examDrops.push({marker,fill,ring,paper,start,impact,age:0,duration:EXAM_DURATION,hit:false});
    if(onDumped) onDumped();
    else speakDumpedFallback();
  }

  function update(dt, playerPosition, bodyBounds = null) {
    const playerBox=bodyBounds || new THREE.Box3(
      new THREE.Vector3(playerPosition.x-.48,playerPosition.y-1.7,playerPosition.z-.48),
      new THREE.Vector3(playerPosition.x+.48,playerPosition.y+.12,playerPosition.z+.48)
    );

    for(const shot of [...shots]) {
      const start=shot.mesh.position.clone();
      const end=start.clone().addScaledVector(shot.velocity,dt);
      const playerDistance=segmentBoxDistance(start,end,playerBox);
      let wallDistance=Infinity;
      for(const box of colliders)wallDistance=Math.min(wallDistance,segmentBoxDistance(start,end,box));
      shot.life-=dt;
      if(wallDistance<=playerDistance && wallDistance!==Infinity) {remove(shot);continue;}
      if(playerDistance!==Infinity) {
        remove(shot);
        if(onPlayerHit()===false) {clear();return;}
        continue;
      }
      if(shot.life<=0 || end.y<.05){remove(shot);continue;}
      shot.mesh.position.copy(end);
      shot.mesh.rotateZ(dt*(shot.kind==='ruler'?5:8));
    }

    for(const drop of [...examDrops]) {
      drop.age += dt;
      const t = Math.min(1,drop.age/drop.duration);
      const pulse = .78 + Math.sin(drop.age*13)*.12;
      drop.marker.scale.setScalar(pulse);
      drop.fill.material.opacity = .12 + t*.20;
      drop.ring.material.opacity = .55 + .4*(.5+.5*Math.sin(drop.age*14));

      let horizontalT,y;
      if(t<.34){
        const u=t/.34;
        horizontalT=u*.28;
        y=drop.start.y+(15.5-drop.start.y)*Math.sin(u*Math.PI/2);
      }else{
        const u=(t-.34)/.66;
        horizontalT=.28+.72*u;
        y=15.5-(15.35*u*u);
      }
      drop.paper.position.x=THREE.MathUtils.lerp(drop.start.x,drop.impact.x,horizontalT);
      drop.paper.position.z=THREE.MathUtils.lerp(drop.start.z,drop.impact.z,horizontalT);
      drop.paper.position.y=y;
      drop.paper.rotation.x+=dt*2.4;
      drop.paper.rotation.z+=dt*4.8;

      if(t>=1){
        const playerDistance=Math.hypot(playerPosition.x-drop.impact.x,playerPosition.z-drop.impact.z);
        removeExam(drop);
        if(playerDistance<=EXAM_RADIUS && onPlayerHit()===false){clear();return;}
      }
    }
  }

  return {throwAt,dropExamAt,update,clear};
}
