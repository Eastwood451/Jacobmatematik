import { Match, MAX_PLAYERS, validCode, cleanName } from './fps-match.js?v=20260907-online1';

const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode() {
  return [...crypto.getRandomValues(new Uint8Array(8))].map(n=>alphabet[n%32]).join('');
}

// Only ephemeral aliases and match data use this public, code-addressed channel.
// School profiles/results never enter the channel. This is a trusted classroom
// host, not an authenticated, cheat-proof dedicated game server.
export class GameRoom {
  constructor(client, {blocked,onState,onError}) {
    this.client=client; this.blocked=blocked; this.onState=onState; this.onError=onError;
    this.id=crypto.randomUUID(); this.channel=null; this.timers=[]; this.seq=0; this.actions=[];
    this.seen=new Map(); this.active=false; this.connected=false;
  }
  async open({code,mode,name,host=false}) {
    if (!this.client) throw new Error('Onlineforbindelsen er ikke tilgængelig. Genindlæs siden.');
    code=String(code||'').trim().toUpperCase();
    if (!validCode(code)) throw new Error('Skriv rummets kode på 8 tegn.');
    this.code=code; this.host=host; this.name=cleanName(name); this.active=true;
    this.lastState=performance.now(); this.openedAt=performance.now();
    if (host) { this.hostId=this.id; this.match=new Match(mode,this.blocked); this.match.join(this.id,this.name); }
    const ch=this.channel=this.client.channel(`erling-v1:${code}`,{config:{broadcast:{self:false},presence:{key:this.id}}});
    ch.on('broadcast',{event:'packet'},({payload})=>this.receive(payload));
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Forbindelsen tog for lang tid. Prøv igen.')),10000);
      this.openReject=reject;
      ch.subscribe((status)=>{
        if (!this.active) return;
        if (status==='SUBSCRIBED') { clearTimeout(timeout); this.openReject=null; this.connected=true; resolve(); }
        else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
          clearTimeout(timeout);
          const error=new Error('Forbindelsen til spilrummet blev afbrudt. Opret eller join et rum igen.');
          if(this.openReject) { this.openReject=null; reject(error); } else this.fail(error.message);
        }
      });
    }).catch(async error=>{ await this.close(); throw error; });
    if (!this.active) return;
    // Presence is updated only once; positions are carried by Broadcast.
    await ch.track({id:this.id,role:host?'host':'player'});
    this.timers.push(setInterval(()=>this.networkTick(),200));
    if (host) {
      let previous=performance.now();
      this.timers.push(setInterval(()=>{
        const now=performance.now();
        this.match.tick(Math.min((now-previous)/1000,.1)); previous=now;
      },50));
    }
    this.networkTick();
  }
  send(body) {
    if (!this.active || !this.connected) return;
    void this.channel.send({type:'broadcast',event:'packet',payload:{v:1,from:this.id,...body}}).then(result=>{
      if(result!=='ok' && this.active) this.fail('Netværket svarer ikke. Prøv at joine igen.');
    }).catch(()=>this.fail('Forbindelsen blev afbrudt. Prøv at joine igen.'));
  }
  receive(m) {
    if (!this.active || !m || m.v!==1 || typeof m.from!=='string' || m.from.length>64 || m.from===this.id) return;
    if (this.host) {
      if (m.type==='hello') {
        if (!this.match.join(m.from,m.name)) {
          this.send({type:'reject',to:m.from,message:this.match.phase==='lobby'?`Rummet er fyldt (${MAX_PLAYERS} spillere).`:'Kampen er startet. Join næste kamp.'});
        } else this.seen.set(m.from,performance.now());
      } else if (m.type==='input' && this.match.players.has(m.from)) {
        this.seen.set(m.from,performance.now()); this.match.input(m.from,m.data);
      } else if(m.type==='leave') { this.match.leave(m.from); this.seen.delete(m.from); }
    } else {
      if (m.type==='reject' && m.to===this.id && (!this.hostId || this.hostId===m.from)) { this.fail(m.message); return; }
      if (m.type==='closed' && m.from===this.hostId) { this.fail('Værten har lukket serveren.'); return; }
      if (m.type!=='state' || (this.hostId && this.hostId!==m.from)) return;
      const s=m.state;
      if (!s || !['coop','deathmatch'].includes(s.mode) || !['lobby','playing','finished'].includes(s.phase) || !Array.isArray(s.players) || s.players.length>MAX_PLAYERS || !Array.isArray(s.enemies) || s.enemies.length>20 || !Array.isArray(s.shots) || s.shots.length>80) return;
      const me=s.players.find(p=>p.id===this.id);
      if(!me) return;
      this.hostId=m.from; this.lastState=performance.now(); this.accept(s);
    }
  }
  accept(state) {
    this.state=state;
    const me=state.players.find(p=>p.id===this.id);
    if(me) this.actions=this.actions.filter(a=>a.seq>me.ack);
    this.onState(state,me);
  }
  networkTick() {
    if(!this.active) return;
    const now=performance.now();
    if(this.host) {
      for(const [id,at] of this.seen) if(now-at>8000) {this.match.leave(id);this.seen.delete(id);}
      this.match.input(this.id,{pose:this.pose,epoch:this.epoch,actions:this.actions});
      const state=this.match.snapshot(); this.accept(state);
      this.send({type:'state',state});
    } else if(!this.hostId) {
      if(now-this.openedAt>10000) {this.fail('Ingen server fundet. Kontrollér koden og at værten har rummet åbent.');return;}
      if(!this.helloAt || now-this.helloAt>1000) {this.send({type:'hello',name:this.name});this.helloAt=now;}
    } else {
      if(now-this.lastState>10000) {this.fail('Serveren svarer ikke. Værten kan have lukket eller mistet forbindelsen.');return;}
      this.send({type:'input',data:{pose:this.pose,epoch:this.epoch,actions:this.actions}});
    }
  }
  action(action) { if(this.actions.length<12) this.actions.push({...action,seq:++this.seq}); }
  start() { if(this.host) this.match.start(); }
  fail(message) {
    if(!this.active) return;
    void this.close(); this.onError(String(message).slice(0,180));
  }
  async close() {
    if(this.active && this.connected) this.send({type:this.host?'closed':'leave'});
    this.active=false; this.connected=false;
    for(const t of this.timers) clearInterval(t);
    this.timers=[];
    if(this.channel) {const ch=this.channel;this.channel=null;await this.client.removeChannel(ch);}
  }
}
