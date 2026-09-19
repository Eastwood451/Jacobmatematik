import * as THREE from 'three';

const DEFAULT_ERLING_SPEED = 1.35;
const SPEED_MULTIPLIER = 3;
const MAX_SHOTS = 18;
const SHOT_RADIUS = .26;

function segmentBoxDistance(start,end,box,radius=SHOT_RADIUS){
  const expanded=box.clone().expandByScalar(radius);
  if(expanded.containsPoint(start))return 0;
  const delta=end.clone().sub(start);
  const length=delta.length();
  if(!length)return Infinity;
  const hit=new THREE.Ray(start,delta.divideScalar(length)).intersectBox(expanded,new THREE.Vector3());
  if(!hit)return Infinity;
  const distance=hit.distanceTo(start);
  return distance<=length?distance:Infinity;
}

function makeRemouladeMad(){
  const group=new THREE.Group();
  const breadMat=new THREE.MeshStandardMaterial({color:0x5d3924,roughness:.95});
  const crustMat=new THREE.MeshStandardMaterial({color:0x3d2518,roughness:1});
  const remouladeMat=new THREE.MeshStandardMaterial({color:0xe5cb42,roughness:.7});
  const greenMat=new THREE.MeshStandardMaterial({color:0x83943a,roughness:.8});

  const crust=new THREE.Mesh(new THREE.BoxGeometry(.88,.16,.58),crustMat);
  group.add(crust);
  const bread=new THREE.Mesh(new THREE.BoxGeometry(.78,.18,.49),breadMat);
  bread.position.y=.04;
  group.add(bread);

  const blobs=[[-.24,.15,-.13],[-.05,.16,.11],[.20,.15,-.08],[.28,.16,.15],[-.28,.16,.15]];
  for(const [x,y,z] of blobs){
    const dollop=new THREE.Mesh(new THREE.SphereGeometry(.10,10,7),remouladeMat);
    dollop.scale.set(1.35,.45,.8);
    dollop.position.set(x,y,z);
    group.add(dollop);
  }
  for(const [x,z] of [[-.12,-.04],[.12,.05],[.02,-.16]]){
    const pickle=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),greenMat);
    pickle.scale.set(1.3,.35,.8);
    pickle.position.set(x,.205,z);
    group.add(pickle);
  }
  group.rotation.x=.08;
  return group;
}

export function createErlingFoodProjectiles({scene,colliders,onPlayerHit}){
  const shots=[];

  function disposeObject(object){
    object.traverse(child=>{
      if(child.geometry)child.geometry.dispose();
      if(child.material)child.material.dispose();
    });
  }

  function remove(shot){
    const index=shots.indexOf(shot);
    if(index!==-1)shots.splice(index,1);
    scene.remove(shot.mesh);
    disposeObject(shot.mesh);
  }

  function clear(){
    for(const shot of [...shots])remove(shot);
  }

  function throwAt(enemy,target){
    if(!enemy||shots.length>=MAX_SHOTS)return false;
    const start=enemy.group.position.clone().add(new THREE.Vector3(0,1.25,0));
    const aim=new THREE.Vector3(target.x,target.y-.45,target.z);
    const direction=aim.sub(start);
    if(direction.lengthSq()<.001)return false;
    direction.normalize();

    const mesh=makeRemouladeMad();
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
    scene.add(mesh);

    const speed=(enemy.speed||DEFAULT_ERLING_SPEED)*SPEED_MULTIPLIER;
    shots.push({mesh,velocity:direction.multiplyScalar(speed),life:14});
    return true;
  }

  function update(dt,playerBounds){
    for(const shot of [...shots]){
      const start=shot.mesh.position.clone();
      const end=start.clone().addScaledVector(shot.velocity,dt);

      const playerDistance=playerBounds?segmentBoxDistance(start,end,playerBounds):Infinity;
      let wallDistance=Infinity;
      for(const box of colliders)wallDistance=Math.min(wallDistance,segmentBoxDistance(start,end,box));

      shot.life-=dt;
      if(wallDistance<=playerDistance&&wallDistance!==Infinity){
        remove(shot);
        continue;
      }
      if(playerDistance!==Infinity){
        remove(shot);
        if(onPlayerHit?.()===false){clear();return;}
        continue;
      }
      if(shot.life<=0){
        remove(shot);
        continue;
      }

      shot.mesh.position.copy(end);
      shot.mesh.rotateZ(dt*7.5);
      shot.mesh.rotateX(dt*2.2);
    }
  }

  return {shots,throwAt,update,clear};
}
