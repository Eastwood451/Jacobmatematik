import { createEnemyNavigator } from './fps-navigation.js?v=20260911-path1';
import { normalizeAvatar } from './fps-avatars.js?v=20260907-avatar1';
// Host-owned rules, independent of Three.js and the transport.
export const MAX_PLAYERS = 4;
export const TARGET_SCORE = 10;
export const TOTAL_WAVES = 5;
export const validCode = code => /^[A-HJ-NP-Z2-9]{8}$/.test(code);
export const cleanName = name => String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18) || 'Elev';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (...values) => values.every(Number.isFinite);
const starts = [[0,18],[0,-23],[-23,0],[23,0]];

export class Match {
  constructor(mode, blocked = () => false, random = Math.random) {
    if (!['deathmatch', 'coop'].includes(mode)) throw new Error('Ukendt spilform.');
    this.mode = mode;
    this.blocked = blocked;
    this.random = random;
    this.players = new Map();
    this.navigator=null;
    this.enemies = [];
    this.shots = [];
    this.splats = [];
    this.phase = 'lobby';
    this.wave = 0;
    this.kills = 0;
    this.clock = 0;
    this.serial = 0;
    this.result = '';
  }
  problem(p) {
    p.problem = { id:++this.serial, a:1 + Math.floor(this.random()*9), b:1 + Math.floor(this.random()*9) };
  }
  spawn(p) {
    const choices = starts.filter(([x,z]) => !this.blocked(x,z,.5));
    choices.sort((a,b) => {
      const others = [...this.players.values()].filter(q => q !== p && q.hp > 0);
      const nearest = v => Math.min(100, ...others.map(q => distance({x:v[0],z:v[1]},q)));
      return nearest(b) - nearest(a);
    });
    [p.x,p.z] = choices[0] || [0,18];
    p.y = 1.7; p.yaw = p.z < 0 ? Math.PI : 0; p.crouching=false;
    p.hp = 5; p.ammo = 0; p.epoch++;
    p.safeUntil = this.clock + 3;
    p.poseAt = this.clock;
    p.respawnAt = 0;
    this.problem(p);
  }
  join(id, name, avatar) {
    if (this.players.has(id)) return true;
    if (this.phase !== 'lobby' || this.players.size >= MAX_PLAYERS) return false;
    const p = { id, name:cleanName(name), avatar:normalizeAvatar(avatar), score:0, deaths:0, epoch:0, ack:0, shotAt:-1, note:'' };
    this.players.set(id,p);
    this.spawn(p);
    return true;
  }
  leave(id) {
    this.players.delete(id);
    if (this.phase === 'playing' && this.mode === 'deathmatch' && this.players.size < 2) {
      this.finish('Kampen sluttede: der er ikke længere to spillere.');
    }
  }
  start() {
    if (this.players.size < 2 || this.phase === 'playing') return false;
    this.phase = 'playing'; this.wave = 0; this.kills = 0; this.result = '';
    this.enemies = []; this.shots = []; this.splats = [];
    for (const p of this.players.values()) { p.score = 0; p.deaths = 0; this.spawn(p); }
    if (this.mode === 'coop') this.nextWave();
    return true;
  }
  getNavigator() {
    if(!this.navigator)this.navigator=createEnemyNavigator({blocked:(x,z)=>this.blocked(x,z,.5,0,1.8)});
    return this.navigator;
  }
  nextWave() {
    if (++this.wave > TOTAL_WAVES) { this.finish('I vandt! Alle fem bølger er besejret.'); return; }
    for (const p of this.players.values()) {
      if (p.hp <= 0) this.spawn(p);
      else p.hp = Math.min(5,p.hp+1);
    }
    const count = 2 + this.wave * 2;
    for (let i=0;i<count;i++) {
      const pos = starts[i % starts.length];
      const type = this.wave >= 2 && i === count-1 ? 'gunnar' : 'erling';
      const target=[...this.players.values()].find(p=>p.hp>0);
      const safe=this.getNavigator().spawnNear({x:pos[0],z:pos[1]},target);
      if(safe)this.enemies.push({id:`e${++this.serial}`,type,x:safe.x,z:safe.z,hp:type==='gunnar'?5:1});
    }
  }
  finish(message) { this.phase = 'finished'; this.result = message; this.shots = []; }
  input(id, data) {
    const p = this.players.get(id);
    if (!p || this.phase !== 'playing' || !data || data.epoch !== p.epoch) return;
    const v = data.pose;
    const eye=v?.crouching ? .78 : 1.7;
    const height=v?.crouching ? 1.05 : 1.95;
    if (p.hp > 0 && v && finite(v.x,v.y,v.z,v.yaw) && Math.abs(v.x)<26.5 && Math.abs(v.z)<26.5 && v.y>=eye && v.y<3.5) {
      const length = distance(p,v);
      const speed=v.crouching?2.5:v.sprinting?8.6:5.4;
      const allowance = speed*Math.min(.8,Math.max(0,this.clock-p.poseAt))+.15;
      // Sweep the movement so a packet cannot cross a thin classroom wall.
      const steps = Math.max(1,Math.ceil(length/.15));
      let clear = length <= allowance;
      for (let i=1;clear && i<=steps;i++) clear = !this.blocked(p.x+(v.x-p.x)*i/steps,p.z+(v.z-p.z)*i/steps,.48,v.y-eye,height);
      if (clear) { p.x=v.x; p.y=v.y; p.z=v.z; p.yaw=v.yaw; p.crouching=Boolean(v.crouching); p.poseAt=this.clock; }
    }
    if (!Array.isArray(data.actions)) return;
    for (const a of data.actions.slice(0,12)) {
      if (!a || !Number.isSafeInteger(a.seq) || a.seq <= p.ack || a.seq > p.ack+100) continue;
      p.ack = a.seq;
      if (p.hp<=0) continue;
      if (a.type === 'answer' && a.problem === p.problem.id && /^\d{1,3}$/.test(a.value)) {
        if (Number(a.value) === p.problem.a*p.problem.b) {
          p.ammo = Math.min(30,p.ammo+1); p.note = 'Korrekt! +1 blyant'; this.problem(p);
        } else p.note = 'Forkert. Prøv igen.';
      }
      if (a.type === 'shoot' && p.ammo>0 && this.clock-p.shotAt>=.25 && a.dir && finite(a.dir.x,a.dir.y,a.dir.z)) {
        const len = Math.hypot(a.dir.x,a.dir.y,a.dir.z);
        if (len<.9 || len>1.1) continue;
        p.ammo--; p.shotAt=this.clock;
        this.shots.push({id:`s${++this.serial}`,owner:id,x:p.x,y:p.y-.12,z:p.z,dx:a.dir.x/len,dy:a.dir.y/len,dz:a.dir.z/len,life:2.6});
      }
    }
  }
  damage(p, attacker) {
    if (p.hp<=0 || this.clock<p.safeUntil) return;
    p.hp--; p.safeUntil=this.clock+1.2;
    if (p.hp===0) {
      p.deaths++;
      if (this.mode==='deathmatch') {
        p.respawnAt=this.clock+3;
        if (attacker && attacker!==p) {
          attacker.score++;
          if (attacker.score>=TARGET_SCORE) this.finish(`${attacker.name} vandt med ${TARGET_SCORE} point!`);
        }
      }
    }
  }
  tick(dt) {
    this.clock+=dt;
    this.splats=this.splats.filter(s=>this.clock-s.at<3);
    if (this.phase!=='playing') return;
    for (const p of this.players.values()) if (p.respawnAt && this.clock>=p.respawnAt) this.spawn(p);
    // Small substeps prevent fast pencils from passing through walls or targets.
    for (const s of this.shots) {
      const steps=Math.ceil(dt/.01);
      for (let i=0;i<steps && s.life>0 && this.phase==='playing';i++) {
        const step=dt/steps; s.life-=step;
        s.x+=s.dx*24*step; s.y+=s.dy*24*step; s.z+=s.dz*24*step;
        if (s.y<0 || s.y>4.2 || this.blocked(s.x,s.z,.1,s.y-.1,.2)) { s.life=0; break; }
        if (this.mode==='deathmatch') {
          for (const p of this.players.values()) if (p.id!==s.owner && p.hp>0 && distance(s,p)<.55 && s.y>p.y-(p.crouching?.78:1.7) && s.y<p.y+.25) {
            this.damage(p,this.players.get(s.owner)); s.life=0; break;
          }
        } else {
          for (const e of this.enemies) if (e.hp>0 && distance(s,e)<.85 && s.y<3.3) {
            if (--e.hp===0) {
              this.kills++; const owner=this.players.get(s.owner); if(owner) owner.score++;
              if(e.type==='gunnar') this.splats.push({id:`splat:${e.id}`,x:e.x,y:0,z:e.z,at:this.clock});
            }
            s.life=0; break;
          }
        }
      }
    }
    this.shots=this.shots.filter(s=>s.life>0);
    if (this.phase!=='playing' || this.mode!=='coop') return;
    const alive=[...this.players.values()].filter(p=>p.hp>0);
    if (!alive.length) { this.finish('Holdet blev overmandet. Prøv igen sammen!'); return; }
    this.enemies=this.enemies.filter(e=>e.hp>0);
    if (!this.enemies.length) { this.nextWave(); return; }
    for (const e of this.enemies) {
      const p=alive.reduce((a,b)=>distance(e,a)<distance(e,b)?a:b);
      const d=distance(e,p), speed=e.type==='gunnar'?1.7:1.35;
      if (d>.01) {
        this.getNavigator().move(e,p,speed*dt);
      }
      if (d<1.15) this.damage(p);
    }
  }
  snapshot() {
    return {mode:this.mode,phase:this.phase,wave:this.wave,kills:this.kills,clock:this.clock,result:this.result,
      splats:this.splats.map(s=>({...s})),players:[...this.players.values()].map(p=>({...p})),enemies:this.enemies.map(e=>({...e})),shots:this.shots.map(s=>({...s}))};
  }
}
