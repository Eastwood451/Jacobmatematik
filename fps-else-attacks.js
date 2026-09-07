import * as THREE from 'three';

export const ELSE_PROJECTILE_SPEED_MULTIPLIER = 5;
export const ELSE_THROW_INTERVAL = 2.8;
const PROJECTILE_RADIUS = .22;

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

export function createElseAttacks({ scene, colliders, onPlayerHit }) {
  const shots = [];
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
  function block(group,x,y,z,w,h,d,material) {
    const mesh=new THREE.Mesh(unitBox,material);
    mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);
  }
  function makeRuler() {
    const group=new THREE.Group();
    block(group,0,0,0,1.55,.24,.055,wood);
    for(let i=0;i<=20;i++)block(group,-.7+i*.07,.065, .033,.012,i%5===0?.1:.055,.009,ink);
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
  function clear() { for(const shot of [...shots])remove(shot); }
  function throwAt(enemy, target) {
    const ruler=enemy.nextThrowIsRuler !== false;
    enemy.nextThrowIsRuler=!ruler;
    const mesh=ruler ? makeRuler() : makeMarker();
    // Her artwork is 13.2 units high: launch from the raised tool hand.
    const start=new THREE.Vector3(ruler ? -3.1 : 3.1,8.1,.45)
      .applyQuaternion(enemy.group.quaternion).add(enemy.group.position);
    const aim=target.clone().add(new THREE.Vector3(0,-.55,0));
    const velocity=aim.sub(start).normalize().multiplyScalar(enemy.speed*ELSE_PROJECTILE_SPEED_MULTIPLIER);
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),velocity.clone().normalize());
    scene.add(mesh);
    shots.push({mesh,velocity,life:18,kind:ruler?'ruler':'marker'});
  }
  function update(dt, playerPosition) {
    // The body follows the camera while jumping; ground-level tools can be jumped over.
    const playerBox=new THREE.Box3(
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
        // Stop immediately on game over, including other shots in this frame.
        if(onPlayerHit()===false) {clear();return;}
        continue;
      }
      if(shot.life<=0 || end.y<.05){remove(shot);continue;}
      shot.mesh.position.copy(end);
      shot.mesh.rotateZ(dt*(shot.kind==='ruler'?5:8));
    }
  }
  return {throwAt,update,clear};
}
