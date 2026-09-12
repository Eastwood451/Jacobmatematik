// Shared solo/co-op rules. Rendering never decides whether a player is hit.
export function createGunnarProjectiles() {
  let shots=[],serial=0;
  function burst(origin,target) {
    const angle=Math.atan2(target.z-origin.z,target.x-origin.x);
    for(let i=0;i<5;i++){
      const direction=angle+i*Math.PI*2/5;
      shots.push({id:`goo${++serial}`,x:origin.x,y:target.y,z:origin.z,
        dx:Math.cos(direction)*7,dz:Math.sin(direction)*7,radius:.22,life:8});
    }
  }
  function update(dt,{blocked,players,onHit}) {
    const steps=Math.max(1,Math.ceil(dt/.01)),step=dt/steps;
    for(const shot of shots)for(let i=0;i<steps&&shot.life>0;i++){
      shot.life-=step;
      shot.x+=shot.dx*step;shot.z+=shot.dz*step;
      if(shot.life<=0||blocked(shot)){shot.life=0;break;}
      for(const player of players){
        if(player.hp<=0)continue;
        const b=player.bounds,r=shot.radius;
        const x=Math.max(b.min.x,Math.min(b.max.x,shot.x));
        const y=Math.max(b.min.y,Math.min(b.max.y,shot.y));
        const z=Math.max(b.min.z,Math.min(b.max.z,shot.z));
        if((shot.x-x)**2+(shot.y-y)**2+(shot.z-z)**2<=r*r){
          shot.life=0;onHit(player);break;
        }
      }
    }
    shots=shots.filter(s=>s.life>0);
  }
  return {burst,update,clear(){shots=[];},get shots(){return shots;}};
}
