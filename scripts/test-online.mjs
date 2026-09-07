import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, MAX_PLAYERS, validCode } from '../fps-match.js';

function game(mode='deathmatch',blocked) {
  const m=new Match(mode,blocked,()=>.2);m.join('a','Anna');m.join('b','Bo');m.start();return m;
}
function action(m,id,values) {
  const p=m.players.get(id);m.input(id,{epoch:p.epoch,actions:[{seq:p.ack+1,...values}]});
}
test('room syntax, capacity, start requirement and late joins',()=>{
  assert.equal(validCode('ABCD2345'),true);assert.equal(validCode('abcd2345'),false);assert.equal(validCode('ABCD234!'),false);
  const m=new Match('coop');m.join('a','<Anna>');assert.equal(m.players.get('a').name,'Anna');assert.equal(m.start(),false);
  for(let i=1;i<MAX_PLAYERS;i++) assert.equal(m.join(String(i),'Elev'),true);
  assert.equal(m.join('overflow','Elev'),false);assert.equal(m.start(),true);assert.equal(m.join('late','Elev'),false);
});
test('answers earn one pencil, repeated and old problems cannot mint ammunition',()=>{
  const m=game(),p=m.players.get('a'),problem=p.problem;
  action(m,'a',{type:'answer',problem:problem.id,value:'999'});assert.equal(p.ammo,0);
  const input={epoch:p.epoch,actions:[{seq:p.ack+1,type:'answer',problem:problem.id,value:String(problem.a*problem.b)}]};
  m.input('a',input);m.input('a',input);assert.equal(p.ammo,1);
  action(m,'a',{type:'answer',problem:problem.id,value:String(problem.a*problem.b)});assert.equal(p.ammo,1);
});
test('movement rejects teleports, non-finite coordinates and crossing thin walls',()=>{
  const m=game('deathmatch',(x,z)=>Math.abs(x-1)<.15),p=m.players.get('a');
  Object.assign(p,{x:0,z:0,poseAt:0});m.clock=.5;
  for(const x of [20,Infinity,2]) m.input('a',{epoch:p.epoch,pose:{x,y:1.7,z:0,yaw:0}});
  assert.equal(p.x,0);
  m.input('a',{epoch:p.epoch,pose:{x:-1,y:1.7,z:0,yaw:0}});assert.equal(p.x,-1);
});
test('deathmatch projectiles damage opponents, award a point and respawn safely',()=>{
  const m=game(),a=m.players.get('a'),b=m.players.get('b');
  Object.assign(a,{x:0,y:1.7,z:0,ammo:1});Object.assign(b,{x:0,y:1.7,z:-2,hp:1,safeUntil:0});
  action(m,'a',{type:'shoot',dir:{x:0,y:0,z:-1}});
  for(let i=0;i<10;i++)m.tick(.02);
  assert.equal(b.hp,0);assert.equal(a.score,1);assert.equal(a.ammo,0);
  const epoch=b.epoch;for(let i=0;i<160;i++)m.tick(.02);
  assert.equal(b.hp,5);assert.equal(b.epoch,epoch+1);assert.ok(b.safeUntil>m.clock);
});
test('projectiles cannot penetrate walls',()=>{
  const m=game('deathmatch',(x,z)=>Math.abs(z+1)<.1),a=m.players.get('a'),b=m.players.get('b');
  Object.assign(a,{x:0,z:0,ammo:1});Object.assign(b,{x:0,z:-2,hp:1,safeUntil:0});
  action(m,'a',{type:'shoot',dir:{x:0,y:0,z:-1}});m.tick(.2);assert.equal(b.hp,1);
});
test('co-op disables friendly fire and synchronizes enemy kills',()=>{
  const m=game('coop'),a=m.players.get('a'),b=m.players.get('b');
  Object.assign(a,{x:0,z:0,ammo:1});Object.assign(b,{x:0,z:-1,hp:1,safeUntil:0});
  m.enemies=[{id:'target',type:'erling',x:0,z:-3,hp:1},{id:'other',type:'erling',x:20,z:20,hp:1}];
  action(m,'a',{type:'shoot',dir:{x:0,y:0,z:-1}});for(let i=0;i<10;i++)m.tick(.02);
  assert.equal(b.hp,1);assert.equal(m.kills,1);assert.equal(a.score,1);assert.equal(m.enemies.length,1);
});
test('co-op revives fallen teammates between waves, wins at five waves and loses if all fall',()=>{
  const m=game('coop'),b=m.players.get('b');b.hp=0;m.enemies=[];m.tick(.05);assert.equal(b.hp,5);assert.equal(m.wave,2);
  for(let i=0;i<4;i++){m.enemies=[];m.tick(.05);}assert.equal(m.phase,'finished');assert.match(m.result,/I vandt/);
  const lost=game('coop');for(const p of lost.players.values())p.hp=0;lost.tick(.05);assert.match(lost.result,/overmandet/);
});
test('deathmatch ends at ten points and rematch resets scores',()=>{
  const m=game(),a=m.players.get('a'),b=m.players.get('b');a.score=9;b.hp=1;b.safeUntil=0;m.damage(b,a);
  assert.equal(m.phase,'finished');assert.match(m.result,/Anna vandt/);assert.equal(m.start(),true);assert.equal(a.score,0);assert.equal(b.hp,5);
});
test('leaving deathmatch ends a match that no longer has two players',()=>{
  const m=game();m.leave('b');assert.equal(m.phase,'finished');
});
test('sprint allowance and crouched body height preserve shared movement rules',()=>{
  const m=game('deathmatch',(x,z,r,y=0,height=1.95)=>Math.abs(x-1)<.2 && y+height>1.2);
  const p=m.players.get('a');Object.assign(p,{x:0,z:0,poseAt:0});m.clock=.5;
  m.input('a',{epoch:p.epoch,pose:{x:1,y:.78,z:0,yaw:0,crouching:true}});
  assert.equal(p.x,1);assert.equal(p.crouching,true);
  m.input('a',{epoch:p.epoch,pose:{x:1,y:1.7,z:0,yaw:0}});assert.equal(p.crouching,true);
  m.clock=1;Object.assign(p,{x:0,z:10,poseAt:.5});
  m.input('a',{epoch:p.epoch,pose:{x:4,y:1.7,z:10,yaw:0,sprinting:true}});
  // Use an unobstructed direction; the lintel still blocks standing movement.
  assert.equal(p.x,0);
  m.input('a',{epoch:p.epoch,pose:{x:-4,y:1.7,z:10,yaw:0,sprinting:true}});assert.equal(p.x,-4);
});
