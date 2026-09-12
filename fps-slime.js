import * as THREE from 'three';

// One instanced draw per burst keeps the splat inexpensive on phones.
export function createGunnarSlime(scene, random = Math.random) {
  const bursts = [];
  const flying = new Map();
  const dummy = new THREE.Object3D();
  const colours = [0x8cdb28, 0x50a51e, 0xb4ed42, 0x347518];
  function remove(burst) {
    scene.remove(burst.mesh);
    burst.mesh.geometry.dispose();
    burst.mesh.material.dispose();
    burst.mesh.dispose();
    bursts.splice(bursts.indexOf(burst),1);
  }
  function paint(burst) {
    burst.drops.forEach((drop,i) => {
      dummy.position.copy(drop.position);
      dummy.rotation.set(drop.spin*burst.age,drop.spin*.7*burst.age,0);
      if (drop.landed) {
        dummy.rotation.set(0,drop.spin,0);
        dummy.scale.set(drop.size*2.5,.035,drop.size*2);
      } else dummy.scale.set(drop.size,drop.size*1.25,drop.size);
      dummy.updateMatrix();
      burst.mesh.setMatrixAt(i,dummy.matrix);
    });
    burst.mesh.instanceMatrix.needsUpdate = true;
  }
  function burst(position) {
    if (bursts.length >= 6) remove(bursts[0]);
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1,1),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,depthWrite:false}),
      48,
    );
    mesh.name = 'gunnar-green-snask';
    mesh.frustumCulled = false;
    const drops = Array.from({length:48},(_,i) => {
      const angle = random()*Math.PI*2, speed = 1.8+random()*4;
      mesh.setColorAt(i,new THREE.Color(colours[i%colours.length]));
      return {
        position:new THREE.Vector3(position.x,position.y+1.8,position.z),
        velocity:new THREE.Vector3(Math.cos(angle)*speed,2+random()*5,Math.sin(angle)*speed),
        size:.08+random()*.18,spin:random()*8-4,landed:false,
      };
    });
    const entry = {mesh,drops,age:0};
    paint(entry);
    bursts.push(entry);scene.add(mesh);
  }
  function update(dt) {
    for (const entry of [...bursts]) {
      entry.age += dt;
      if (entry.age >= 2.8) { remove(entry);continue; }
      for (const drop of entry.drops) if (!drop.landed) {
        drop.velocity.y -= 12*dt;
        drop.position.addScaledVector(drop.velocity,dt);
        if (drop.position.y <= .05) {drop.position.y=.05;drop.landed=true;}
      }
      entry.mesh.material.opacity = Math.min(1,(2.8-entry.age)/.8);
      paint(entry);
    }
  }
  function syncProjectiles(shots) {
    const active=new Set(shots.map(s=>s.id));
    for(const [id,mesh] of flying)if(!active.has(id)){
      scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();flying.delete(id);
    }
    for(const shot of shots){
      let mesh=flying.get(shot.id);
      if(!mesh){
        mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(shot.radius,1),
          new THREE.MeshBasicMaterial({color:0x80e522}));
        mesh.name='gunnar-flying-goo';flying.set(shot.id,mesh);scene.add(mesh);
      }
      mesh.position.set(shot.x,shot.y,shot.z);
      mesh.rotation.set(shot.life*3,shot.life*5,0);
    }
  }
  function clear() { for (const entry of [...bursts]) remove(entry);syncProjectiles([]); }
  return {burst,update,clear,syncProjectiles};
}
