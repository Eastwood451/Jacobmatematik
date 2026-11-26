/* Screen-space mathematical angles: positive y points upwards. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JacobIncomingCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const RAD = Math.PI / 180;
  function parseAngle(value) {
    const text = String(value).trim().replace(',', '.');
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return null;
    const angle = Number(text);
    return Number.isFinite(angle) && angle >= 0 && angle <= 360 ? angle : null;
  }
  function direction(angle) { return {x: Math.cos(angle * RAD), y: Math.sin(angle * RAD)}; }
  function angleAt(x, y) { return ((Math.atan2(y, x) / RAD) + 360) % 360; }
  function segmentHit(ax, ay, bx, by, x, y, radius) {
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((x-ax)*dx+(y-ay)*dy)/length)) : 0;
    return Math.hypot(ax + t*dx - x, ay + t*dy - y) <= radius;
  }
  function normalizeWave(wave) {
    const n = Math.floor(Number(wave));
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }
  // Wave 1: 0/90/180/270. Wave 2: 45°. Wave 3: 5°. Wave 4+: every whole degree.
  function angleStepForWave(wave) {
    const n = normalizeWave(wave);
    if (n <= 1) return 90;
    if (n === 2) return 45;
    if (n === 3) return 5;
    return 1;
  }
  function spawnAngleForWave(wave, random = Math.random, {lastAngle = null, occupied = [], spawned = 0} = {}) {
    const n = normalizeWave(wave);
    const step = angleStepForWave(n);
    const count = 360 / step;
    const tutorial = [0, 90, 180, 270];
    let angle = n === 1 && spawned < 4 ? tutorial[spawned] : Math.floor(random() * count) * step;
    if (lastAngle != null && angle === lastAngle) angle = (angle + step) % 360;
    const minSep = step * .8;
    for (let i = 0; i < count; i++) {
      if (!occupied.some(other => Math.abs(((other - angle + 540) % 360) - 180) < minSep)) break;
      angle = (angle + step) % 360;
    }
    return angle;
  }
  function createGame({random = Math.random, difficulty = 'directions', wave = 1} = {}) {
    const config = {directions:{speed:.26,delay:6.5,limit:2}, diagonals:{speed:.32,delay:5.5,limit:3}, expert:{speed:.40,delay:4.5,limit:4}}[difficulty] || {speed:.26,delay:6.5,limit:2};
    const state = {phase:'ready', enemies:[], shots:[], score:0, hits:0, fired:0, lives:5, wave:normalizeWave(wave), spawned:0, clock:0, nextSpawn:1, cooldown:0, serial:0};
    const events = [];
    let lastAngle = null;
    function emit(type, data={}) { events.push({type,...data}); }
    function spawn() {
      const angle = spawnAngleForWave(state.wave, random, {
        lastAngle,
        occupied: state.enemies.map(e => e.angle),
        spawned: state.spawned
      });
      lastAngle = angle;
      const d = direction(angle), id=++state.serial;
      const enemy = {id, angle, x:d.x*7.7, y:d.y*7.7, radius:.55, speed:config.speed+Math.min(.20,(state.wave-1)*.025), kind:['dummert','erling','paper','spitball','sandwich'][(state.spawned+state.wave-1)%5]};
      state.enemies.push(enemy); state.spawned++; emit('spawn',{enemy:{...enemy}});
    }
    function start() {
      if(state.phase === 'ready' || state.phase === 'between') { state.phase='playing'; state.nextSpawn=.5; emit('start'); }
    }
    function fire(value) {
      const angle = parseAngle(value);
      if (angle === null || state.phase !== 'playing' || state.cooldown>0) return false;
      const d=direction(angle);
      state.shots.push({id:++state.serial,x:0,y:0,dx:d.x,dy:d.y,life:1.5,angle});
      state.fired++; state.cooldown=.30; emit('fire',{angle,id:state.serial}); return true;
    }
    function pause() { if(state.phase==='playing') {state.phase='paused';emit('pause');} }
    function resume() { if(state.phase==='paused') {state.phase='playing';emit('resume');} }
    function nextWave() {
      if(state.phase!=='between') return;
      state.wave++;state.spawned=0;state.enemies=[];state.shots=[];start();
    }
    function update(delta) {
      if(state.phase!=='playing') return;
      // Bound resumed/background frames. Caller uses a real-time frame clock.
      const dt=Math.min(.05,Math.max(0,delta));
      state.clock+=dt;state.cooldown=Math.max(0,state.cooldown-dt);state.nextSpawn-=dt;
      if(state.spawned<8 && state.nextSpawn<=0 && state.enemies.length<config.limit) {spawn();state.nextSpawn=config.delay;}
      for(const enemy of state.enemies) {
        const d=direction(enemy.angle);enemy.x-=d.x*enemy.speed*dt;enemy.y-=d.y*enemy.speed*dt;
      }
      for(const shot of state.shots) {
        const ax=shot.x,ay=shot.y;shot.x+=shot.dx*15*dt;shot.y+=shot.dy*15*dt;shot.life-=dt;
        // Nearest intercepted enemy wins even when one frame crosses several targets.
        const target=state.enemies.filter(e=>!e.dead&&segmentHit(ax,ay,shot.x,shot.y,e.x,e.y,e.radius+.16)).sort((a,b)=>Math.hypot(a.x-ax,a.y-ay)-Math.hypot(b.x-ax,b.y-ay))[0];
        if(target) {
          target.dead=true;shot.life=0;state.hits++;state.score+=100;emit('hit',{enemy:{...target},score:state.score});
        } else if(shot.life<=0) emit('miss',{angle:shot.angle});
      }
      state.shots=state.shots.filter(s=>s.life>0);
      for(const enemy of state.enemies) {
        if(!enemy.dead&&Math.hypot(enemy.x,enemy.y)<1.05) {
          enemy.dead=true;state.lives--;emit('damage',{angle:enemy.angle,kind:enemy.kind});
          if(state.lives<=0) {state.phase='over';state.shots=[];emit('over');break;}
        }
      }
      state.enemies=state.enemies.filter(e=>!e.dead);
      if(state.phase==='playing' && state.spawned===8 && state.enemies.length===0) {
        state.phase='between';state.shots=[];emit('waveComplete');
      }
    }
    return {state,start,fire,pause,resume,nextWave,update,drainEvents:()=>events.splice(0)};
  }
  return {parseAngle,direction,angleAt,segmentHit,angleStepForWave,spawnAngleForWave,createGame};
});
