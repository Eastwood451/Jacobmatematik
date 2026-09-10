// NODE_PATH must contain the same Three.js version used by the game (0.180.0).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('three');
const root=path.resolve(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
const {createGunnarSlime}=vm.runInNewContext(source('fps-slime.js')
  .replace("import * as THREE from 'three';",'').replaceAll('export ','')+'\n({createGunnarSlime})',{THREE});

test('Gunnar survives four hits, splats on hit five and retains his five courtyard points',()=>{
  const rigSource=source('fps-gunnar.js').replace(/^import .*;\n/m,'').replaceAll('export ','');
  const rigApi=vm.runInNewContext(rigSource+'\n({createGunnarRig})',{
    createSpriteRig:()=>({body:{material:{color:new THREE.Color()}},group:new THREE.Group()}),
  });
  const enemy=rigApi.createGunnarRig(null),scene=new THREE.Scene();
  const code=source('fps.js');let removed=0;
  const context={enemy,enemies:[enemy],score:0,erlingKills:0,schoolyardPoints:0,
    schoolyardKillTarget:50,schoolyardDoorOpen:false,gunnarSlime:createGunnarSlime(scene,()=>.5),
    feedbackEl:{},removeEnemy:()=>removed++,updateHUD(){},setTimeout(){},
  };
  const api=vm.runInNewContext(code.slice(code.indexOf('function onEnemyDefeated('),code.indexOf('function projectileHitsEnemy('))+'\n({hitEnemy})',context);
  assert.equal(enemy.hp,5);assert.equal(enemy.maxHp,5);
  for(let i=1;i<=4;i++) {
    api.hitEnemy(enemy);assert.equal(enemy.hp,5-i);
    assert.equal(removed,0);assert.equal(scene.children.length,0);
  }
  api.hitEnemy(enemy);assert.equal(removed,1);assert.equal(scene.children.length,1);
  assert.equal(context.score,1);assert.equal(context.schoolyardPoints,5);
  assert.equal(context.erlingKills,0);
  api.hitEnemy(enemy);assert.equal(removed,1);assert.equal(scene.children.length,1);
  context.gunnarSlime.clear();
});

test('green chunks fall, flatten on the ground, fade and dispose their resources',()=>{
  const scene=new THREE.Scene(),slime=createGunnarSlime(scene,()=>.5);
  slime.burst(new THREE.Vector3(4,0,8));
  const mesh=scene.children[0];assert.equal(mesh.count,48);
  let disposed=0;
  for(const item of [mesh,mesh.geometry,mesh.material])item.addEventListener('dispose',()=>disposed++);
  const colour=new THREE.Color();mesh.getColorAt(0,colour);assert.ok(colour.g>colour.r && colour.g>colour.b);
  for(let i=0;i<130;i++)slime.update(1/60);
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
  const pos=new THREE.Vector3(),scale=new THREE.Vector3();matrix.decompose(pos,new THREE.Quaternion(),scale);
  assert.ok(Math.abs(pos.y-.05)<1e-5);assert.ok(scale.y<scale.x);
  assert.ok(mesh.material.opacity<1);
  slime.update(1);assert.equal(scene.children.length,0);assert.equal(disposed,3);
});

test('rapid splats stay bounded and reset removes all effects',()=>{
  const scene=new THREE.Scene(),slime=createGunnarSlime(scene,()=>.5);
  for(let i=0;i<20;i++)slime.burst(new THREE.Vector3());
  assert.equal(scene.children.length,6);
  slime.clear();assert.equal(scene.children.length,0);
  slime.burst(new THREE.Vector3());assert.equal(scene.children.length,1);
  slime.clear();
});
