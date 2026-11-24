'use strict';
const assert=require('node:assert/strict');
const {parseAngle,direction,angleAt,segmentHit,createGame}=require('../incoming-core.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const [input,expected] of [['0',0],['360',360],[' 90 ',90],['27.5',27.5],['82,5',82.5],['.5',.5]])assert.equal(parseAngle(input),expected);
for(const invalid of ['', ' ', '-1', '361', '90°', '1e2', 'Infinity', 'NaN', '1 80', '0x10'])assert.equal(parseAngle(invalid),null);
for(const [angle,x,y] of [[0,1,0],[90,0,1],[180,-1,0],[270,0,-1],[360,1,0]]) {const d=direction(angle);close(d.x,x);close(d.y,y);}
for(const angle of [5,27,45,82,139,225,315,359.9]) {const d=direction(angle);close(angleAt(d.x,d.y),angle);}
assert.equal(segmentHit(0,0,10,0,5,0,.1),true,'fast projectiles must not tunnel through a target');
assert.equal(segmentHit(0,0,1,0,5,0,.1),false,'infinite ray must not score before the shot arrives');
assert.equal(segmentHit(0,0,0,0,0,0,.1),true);
const advance=(game,seconds)=>{for(let n=0;n<Math.ceil(seconds*60);n++)game.update(1/60);};
for(const angle of [0,90,180,270,360,27,82,315]) {
 const g=createGame({random:()=>0});assert.equal(g.fire(angle),false);g.start();advance(g,.6);
 const e=g.state.enemies[0],d=direction(angle);Object.assign(e,{angle:angle%360,x:d.x*5,y:d.y*5});
 assert.equal(g.fire(angle),true);assert.equal(g.fire(angle),false,'cooldown prevents repeated key events from stacking shots');advance(g,.5);
 assert.equal(g.state.hits,1,`target hit at ${angle} degrees`);assert.equal(g.state.score,100);assert.equal(g.state.lives,5);
}
{
 const g=createGame();g.start();advance(g,.6);g.fire(90);advance(g,1.6);assert.equal(g.state.score,0,'a miss must not award points');assert.ok(g.drainEvents().some(e=>e.type==='miss'));
 g.pause();const frozen=JSON.stringify(g.state);advance(g,20);assert.equal(JSON.stringify(g.state),frozen);assert.equal(g.fire(0),false);g.resume();advance(g,1);assert.notEqual(JSON.stringify(g.state),frozen);
}
{
 const g=createGame();g.start();advance(g,.6);const e=g.state.enemies[0];Object.assign(e,{x:2,y:0,angle:0});g.state.enemies.push({...e,id:999,x:4});g.fire(0);advance(g,.17);assert.equal(g.state.hits,1);assert.equal(g.state.enemies[0].id,999,'nearest enemy intercepts the shot');
}
for(const difficulty of ['directions','diagonals','expert']) {
 const g=createGame({difficulty,random:()=>.1234}),kinds=new Set();g.start();
 for(let n=0;n<60*65&&g.state.phase==='playing';n++) {
  const e=g.state.enemies[0];if(e){kinds.add(e.kind);if(!g.state.shots.length)g.fire(e.angle);}
  g.update(1/60);
 }
 assert.equal(g.state.phase,'between');assert.equal(g.state.hits,8);assert.equal(g.state.lives,5);assert.equal(kinds.size,5,'all five enemy types appear');
 assert.equal(g.fire(0),false);g.nextWave();assert.equal(g.state.wave,2);assert.equal(g.state.phase,'playing');assert.equal(g.state.score,800);
}
{
 const g=createGame({random:()=>0});g.start();advance(g,160);assert.equal(g.state.phase,'over');assert.equal(g.state.lives,0);assert.equal(g.fire(0),false);const snapshot=JSON.stringify(g.state);advance(g,2);assert.equal(JSON.stringify(g.state),snapshot);
}
console.log('PASS Incoming core: angle convention, validation, swept collisions, cooldown, misses, pause, all enemy types, waves and game over.');
