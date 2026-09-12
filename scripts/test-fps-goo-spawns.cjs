const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const {createGunnarProjectiles}=vm.runInNewContext(read('fps-gunnar-projectiles.js').replaceAll('export ','')+'\n({createGunnarProjectiles})');
const player=(x=3,y=0)=>({hp:5,bounds:{min:{x:x-.48,y:y+.025,z:-.48},max:{x:x+.48,y:y+1.95,z:.48}}});
const options=players=>({players,blocked:()=>false,onHit:p=>p.hp--});

test('Gunnar emits exactly five evenly spaced horizontal shots at camera height',()=>{
  const goo=createGunnarProjectiles();goo.burst({x:0,z:0},{x:5,y:2.3,z:0});
  assert.equal(goo.shots.length,5);
  for(let i=0;i<5;i++){
    const shot=goo.shots[i];assert.equal(shot.y,2.3);
    assert.ok(Math.abs(shot.dx-7*Math.cos(i*Math.PI*2/5))<1e-9);
    assert.ok(Math.abs(shot.dz-7*Math.sin(i*Math.PI*2/5))<1e-9);
  }
  goo.update(.4,options([]));assert.ok(goo.shots.every(s=>s.y===2.3));
  goo.update(8,options([]));assert.equal(goo.shots.length,0);
});
test('a hit costs exactly one life, consumes its shot and cannot tunnel through the player',()=>{
  const goo=createGunnarProjectiles(),p=player();
  goo.burst({x:0,z:0},{x:3,y:1.7,z:0});goo.update(1,options([p]));
  assert.equal(p.hp,4);assert.equal(goo.shots.length,4);
  goo.update(1,options([p]));assert.equal(p.hp,4);
  goo.clear();assert.equal(goo.shots.length,0);
});
test('walls stop goo before a player; crouching below its fixed height avoids a hit',()=>{
  const goo=createGunnarProjectiles(),p=player();
  goo.burst({x:0,z:0},{x:3,y:1.7,z:0});
  goo.update(1,{...options([p]),blocked:s=>s.x+s.radius>=1.45&&s.x-s.radius<=1.55});
  assert.equal(p.hp,5);
  goo.clear();p.bounds.max.y=1.05;
  goo.burst({x:0,z:0},{x:3,y:1.7,z:0});goo.update(1,options([p]));assert.equal(p.hp,5);
});
test('solo starts with one Erling, adds one every ten seconds, and caps at 25',()=>{
  const code=read('fps.js');
  const context={enemies:[],erlingSpawnElapsed:0,schoolyardDoorOpen:false,schoolyardEntered:false,divisionChallenge:null,
    erlingTexture:null,createErlingRig:()=>({group:{position:{copy(){}}}}),pickSpawnPosition(){},scene:{add(){}},speakSpawn(){}};
  const create=code.slice(code.indexOf('function createErling()'),code.indexOf('function createGunnar()'));
  const spawn=code.slice(code.indexOf('function spawnWave('),code.indexOf('function ensureMusic()'));
  const api=vm.runInNewContext(create+spawn+'\n({spawnWave,createErling,updateErlingSpawns})',context);
  api.spawnWave();assert.equal(context.enemies.length,1);
  api.updateErlingSpawns(9);assert.equal(context.enemies.length,1);
  api.updateErlingSpawns(1);assert.equal(context.enemies.length,2);
  for(let i=0;i<40;i++)api.updateErlingSpawns(10);
  assert.equal(context.enemies.length,25);assert.equal(api.createErling(),null);
  context.enemies.pop();api.updateErlingSpawns(9);assert.equal(context.enemies.length,24);
  api.updateErlingSpawns(1);assert.equal(context.enemies.length,25);
  context.enemies.pop();context.schoolyardDoorOpen=true;api.updateErlingSpawns(10);assert.equal(context.enemies.length,24);
  context.schoolyardDoorOpen=false;context.divisionChallenge={active:true};api.updateErlingSpawns(10);assert.equal(context.enemies.length,24);
});
