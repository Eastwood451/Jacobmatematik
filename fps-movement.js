import * as THREE from 'three';

export const PLAYER_RADIUS = .48;
export const STANDING_EYE = 1.7;
export const CROUCH_EYE = .78;
export const STANDING_HEIGHT = 1.95;
export const CROUCH_HEIGHT = 1.05;
export const WALK_SPEED = 5.4;
export const SPRINT_SPEED = 8.6;
export const CROUCH_SPEED = 2.5;

export function playerBodyBounds(x,feetY,z,height) {
  return new THREE.Box3(
    new THREE.Vector3(x-PLAYER_RADIUS,feetY+.025,z-PLAYER_RADIUS),
    new THREE.Vector3(x+PLAYER_RADIUS,feetY+height,z+PLAYER_RADIUS)
  );
}

export function createPlayerMovement({camera,colliders,keys}) {
  let feetY=0,velocityY=0,grounded=true,crouching=false;
  const standingBlocked=()=>blocked(camera.position.x,feetY,camera.position.z,STANDING_HEIGHT);
  function blocked(x,y,z,height=crouching?CROUCH_HEIGHT:STANDING_HEIGHT) {
    const bounds=playerBodyBounds(x,y,z,height);
    return colliders.some(box=>box.intersectsBox(bounds));
  }
  function updatePosture() {
    crouching=!!(keys.ControlLeft||keys.ControlRight)||standingBlocked();
  }
  function syncCamera() {camera.position.y=feetY+(crouching?CROUCH_EYE:STANDING_EYE);}
  function reset(x,z) {
    for(const key of Object.keys(keys))delete keys[key];
    feetY=velocityY=0;grounded=true;crouching=false;
    camera.position.set(x,STANDING_EYE,z);
  }
  function jump() {
    updatePosture();syncCamera();
    if(grounded&&!crouching){velocityY=6.4;grounded=false;}
  }
  function update(dt) {
    updatePosture();
    const startX=camera.position.x,startZ=camera.position.z;
    let dx=Number(!!keys.KeyD)-Number(!!keys.KeyA),dz=Number(!!keys.KeyS)-Number(!!keys.KeyW);
    if(dx||dz){
      const length=Math.hypot(dx,dz);dx/=length;dz/=length;
      const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
      const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));
      const speed=crouching?CROUCH_SPEED:(keys.ShiftLeft||keys.ShiftRight)?SPRINT_SPEED:WALK_SPEED;
      const move=forward.multiplyScalar(-dz*speed*dt).addScaledVector(right,dx*speed*dt);
      // Small steps prevent sprinting diagonally through thin walls and vent rims.
      const steps=Math.max(1,Math.ceil(move.length()/.1));
      for(let i=0;i<steps;i++){
        const x=camera.position.x+move.x/steps;
        if(!blocked(x,feetY,camera.position.z))camera.position.x=x;
        const z=camera.position.z+move.z/steps;
        if(!blocked(camera.position.x,feetY,z))camera.position.z=z;
      }
    }
    velocityY-=17*dt;
    const delta=velocityY*dt,steps=Math.max(1,Math.ceil(Math.abs(delta)/.1));
    grounded=false;
    for(let i=0;i<steps;i++){
      const next=feetY+delta/steps;
      if(next<=0){feetY=0;velocityY=0;grounded=true;break;}
      if(blocked(camera.position.x,next,camera.position.z)){
        grounded=delta<0;velocityY=0;break;
      }
      feetY=next;
    }
    updatePosture();syncCamera();
    return Math.hypot(camera.position.x-startX,camera.position.z-startZ)>.012;
  }
  return {
    update,jump,reset,
    get crouching(){return crouching;},
    get bounds(){return playerBodyBounds(camera.position.x,feetY,camera.position.z,crouching?CROUCH_HEIGHT:STANDING_HEIGHT);}
  };
}
