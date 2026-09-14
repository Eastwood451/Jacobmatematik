import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createMinigunPowerup, MINIGUN_PICKUP, updateErlingSwipe } from '../fps-powerup-rules.js';
import { Match } from '../fps-match.js';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const collectPoint={...MINIGUN_PICKUP,y:1.7,z:MINIGUN_PICKUP.z-1.3};
function earn(power){
  assert.equal(power.collect(collectPoint),true);
  for(let i=0;i<5;i++){const q=power.question;assert.equal(power.submit(q.id,String(q.answer)),true);}
}
function action(m,id,values){const p=m.players.get(id);m.input(id,{epoch:p.epoch,actions:[{seq:p.ack+1,...values}]});}

test('the single pickup sits above an existing teacher desk and requires proximity',()=>{
  const {CLASSROOMS}=vm.runInNewContext(read('fps-classrooms.js').replace("import * as THREE from 'three';",'').replaceAll('export ','')+'\n({CLASSROOMS})');
  assert.equal(CLASSROOMS.filter(r=>r.teacher[0]===MINIGUN_PICKUP.x&&r.teacher[1]===MINIGUN_PICKUP.z).length,1);
  assert.ok(MINIGUN_PICKUP.y>.94);
  const power=createMinigunPowerup();assert.equal(power.collect({x:0,y:1.7,z:18}),false);
  assert.equal(power.collect(collectPoint),true);assert.equal(power.collect(collectPoint),false);
});
test('five distinct subtraction questions require five correct answers; repeats cannot skip questions',()=>{
  const power=createMinigunPowerup(()=>.5);power.collect(collectPoint);
  const questions=new Set();
  for(let i=0;i<5;i++){
    const q=power.question;
    questions.add(`${q.a}:${q.b}`);
    assert.ok(q.a>=10&&q.a<=99&&q.b>=1&&q.b<=9);assert.equal(q.answer,q.a-q.b);
    assert.equal(power.submit(q.id,'99'),false);assert.equal(power.snapshot().correct,i);
    assert.equal(power.submit(q.id,String(q.answer)),true);
    assert.equal(power.submit(q.id,String(q.answer)),false);
    assert.equal(power.snapshot().correct,i+1);assert.equal(power.phase,i===4?'active':'challenge');
  }
  assert.equal(questions.size,5);
});
test('autofire has a 100 ms cadence, exactly 100 shots and a ten-second lifetime at different frame rates',()=>{
  const first=createMinigunPowerup();earn(first);
  assert.equal(first.advance(0),1);assert.equal(first.advance(.099),0);assert.equal(first.advance(.001),1);
  for(const dt of [1/30,1/60,.04,.017]){
    const power=createMinigunPowerup();earn(power);let shots=0;
    for(let elapsed=0;elapsed<10.1;elapsed+=dt)shots+=power.advance(dt);
    assert.equal(shots,100);assert.equal(power.phase,'spent');assert.equal(power.snapshot().remaining,0);
    assert.equal(power.advance(10),0);assert.equal(power.collect(collectPoint),false);
  }
});
test('solo autofire pauses with controls, resumes without a backlog, and resets cleanly',()=>{
  const power=createMinigunPowerup();earn(power);let ready=false,shots=0;
  const code=read('fps.js'),start=code.indexOf('function reachBlocked('),end=code.indexOf('function updateCamping(',start);
  const ctx={minigun:power,MINIGUN_PICKUP,colliders:[],camera:{position:collectPoint},divisionChallenge:null,schoolyardEntered:false,
    gameActive:true,inputReady:()=>ready,firePencil:powered=>{assert.equal(powered,true);shots++;},minigunView:{sync(){}},newProblem(){}};
  const api=vm.runInNewContext(code.slice(start,end)+'\n({updateMinigun})',ctx);
  for(let i=0;i<250;i++)api.updateMinigun(.04);
  assert.equal(shots,0);assert.equal(power.snapshot().remaining,10);
  ready=true;for(let i=0;i<250;i++)api.updateMinigun(.04);
  assert.equal(shots,100);assert.equal(power.phase,'spent');
  power.reset();assert.equal(power.phase,'pickup');assert.equal(power.snapshot().shotsFired,0);
});
test('Erling winds up and strikes a table camper repeatedly over the tabletop, not through a wall',()=>{
  const enemy={x:1.6,z:0},target={x:0,z:0,feet:.88};let hits=0;
  const table=(x,y,z)=>Math.abs(x)<=.9&&Math.abs(z)<=.525&&y<=.88;
  updateErlingSwipe(enemy,target,.1,table,()=>hits++);assert.ok(enemy.swipe>0);assert.equal(hits,0);
  updateErlingSwipe(enemy,target,.13,table,()=>hits++);assert.equal(hits,1);
  for(let i=0;i<100;i++)updateErlingSwipe(enemy,target,.02,table,()=>hits++);
  assert.equal(hits,2);
  const behindWall={x:1.6,z:0};hits=0;
  for(let i=0;i<100;i++)updateErlingSwipe(behindWall,target,.02,(x,y)=>x>.7&&x<.9&&y<4.2,()=>hits++);
  assert.equal(hits,0);assert.equal(behindWall.swipe,0);
});
test('moving out of range or jumping above the arm before contact avoids the swipe',()=>{
  for(const escape of [{x:4,z:0,feet:.88},{x:0,z:0,feet:2}]){
    const e={x:1.6,z:0};let hits=0;
    updateErlingSwipe(e,{x:0,z:0,feet:.88},.1,()=>false,()=>hits++);
    updateErlingSwipe(e,escape,.2,()=>false,()=>hits++);assert.equal(hits,0);
  }
});
test('the host awards one pickup, validates minus answers, fires without ammo and resets on rematch',()=>{
  const m=new Match('deathmatch',()=>false,()=>.4);m.join('a','Anna');m.join('b','Bo');m.start();
  const a=m.players.get('a'),b=m.players.get('b');Object.assign(a,collectPoint,{ammo:7});Object.assign(b,collectPoint);
  m.tick(.01);assert.equal(m.pickupAvailable,false);assert.equal(a.problem.kind,'subtract');assert.notEqual(b.problem.kind,'subtract');
  Object.assign(b,{x:-20,z:20});
  for(let i=0;i<5;i++){
    const q=a.problem;action(m,'a',{type:'answer',problem:q.id,value:String(q.a-q.b)});
    action(m,'a',{type:'answer',problem:q.id,value:String(q.a-q.b)});
    assert.equal(m.powerups.get('a').snapshot().correct,i+1);
  }
  const power=m.powerups.get('a');assert.equal(power.phase,'active');
  action(m,'a',{type:'shoot',dir:{x:0,y:0,z:-1}});assert.equal(a.ammo,7);assert.equal(m.shots.length,0);
  a.aim={x:1,y:0,z:0};m.tick(.01);
  assert.equal(m.shots.length,1);assert.equal(m.shots[0].dx,1);assert.equal(m.shots[0].minigun,true);
  for(let i=0;i<200;i++)m.tick(.05);
  assert.equal(power.snapshot().shotsFired,100);assert.equal(power.phase,'spent');assert.equal(a.ammo,7);
  m.finish('test');m.start();assert.equal(m.pickupAvailable,true);assert.equal(power.phase,'pickup');
});
test('co-op applies the table swipe on the host and keeps Erling alive to strike again',()=>{
  const blocked=(x,z,r=.48,y=0,h=1.95)=>x+r>-.9&&x-r<.9&&z+r>-.525&&z-r<.525&&y<.88&&y+h>0;
  const m=new Match('coop',blocked);m.join('a','Anna');m.join('b','Bo');m.start();
  const a=m.players.get('a');Object.assign(a,{x:0,z:0,y:2.58,safeUntil:0});
  const e={id:'table-erling',type:'erling',x:1.6,z:0,hp:1};m.enemies=[e];
  for(let i=0;i<25;i++)m.tick(.02);
  assert.equal(a.hp,4);assert.equal(e.hp,1);assert.equal(m.snapshot().enemies.length,1);
});
