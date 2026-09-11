// Shared indoor navigation. One distance field serves every enemy chasing a player.
export function createEnemyNavigator({blocked,min=-26,max=26,cellSize=.5}) {
  const size=Math.round((max-min)/cellSize)+1, count=size*size;
  const open=new Uint8Array(count),links=Array.from({length:count},()=>[]);
  const point=i=>({x:min+(i%size)*cellSize,z:min+Math.floor(i/size)*cellSize});
  function clear(a,b) {
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.2));
    for(let j=0;j<=steps;j++) if(blocked(a.x+(b.x-a.x)*j/steps,a.z+(b.z-a.z)*j/steps))return false;
    return true;
  }
  for(let i=0;i<count;i++){const p=point(i);open[i]=!blocked(p.x,p.z);}
  for(let i=0;i<count;i++) if(open[i]) {
    for(const n of [i%size<size-1?i+1:-1,i+size<count?i+size:-1]) {
      if(n>=0&&open[n]&&clear(point(i),point(n))){links[i].push(n);links[n].push(i);}
    }
  }
  const fields=new Map();
  function nearest(p,distances=null,visible=false) {
    let best=-1,bestDistance=Infinity;
    for(let i=0;i<count;i++)if(open[i]&&(!distances||distances[i]>=0)){
      const q=point(i),distance=(q.x-p.x)**2+(q.z-p.z)**2;
      if(distance<bestDistance&&(!visible||clear(p,q))){best=i;bestDistance=distance;}
    }
    return best;
  }
  function field(target) {
    const key=`${Math.round((target.x-min)/cellSize)},${Math.round((target.z-min)/cellSize)}`;
    if(fields.has(key))return fields.get(key);
    const goal=nearest(target),distance=new Int32Array(count).fill(-1),next=new Int32Array(count).fill(-1);
    if(goal>=0){
      const queue=new Int32Array(count);let head=0,tail=1;queue[0]=goal;distance[goal]=0;
      while(head<tail){const i=queue[head++];for(const n of links[i])if(distance[n]<0){distance[n]=distance[i]+1;next[n]=i;queue[tail++]=n;}}
    }
    const result={distance,next};
    if(fields.size>=8)fields.delete(fields.keys().next().value);
    fields.set(key,result);return result;
  }
  function localNode(p,distance) {
    const cx=Math.round((p.x-min)/cellSize),cz=Math.round((p.z-min)/cellSize);
    let best=-1,bestDistance=Infinity;
    for(let z=Math.max(0,cz-2);z<=Math.min(size-1,cz+2);z++)for(let x=Math.max(0,cx-2);x<=Math.min(size-1,cx+2);x++){
      const i=z*size+x;if(distance[i]<0)continue;
      const q=point(i),d=(q.x-p.x)**2+(q.z-p.z)**2;
      if(d<bestDistance&&clear(p,q)){best=i;bestDistance=d;}
    }
    return best;
  }
  const routes=new WeakMap();
  function move(position,target,amount) {
    if(amount<=0)return;
    const f=field(target);
    let node=routes.get(position);
    if(node===undefined||f.distance[node]<0||!clear(position,point(node)))node=localNode(position,f.distance);
    if(node<0)return; // Never push an enemy through a wall to recover a route.
    // Keep the current waypoint until reached. Re-selecting the nearest grid
    // point every frame can send an enemy back and forth at a corner.
    while(amount>0){
      let waypoint=point(node);
      const atNode=Math.hypot(waypoint.x-position.x,waypoint.z-position.z)<.0001;
      if(f.distance[node]===0&&clear(position,target))waypoint=target;
      else if(atNode){
        if(f.next[node]>=0){node=f.next[node];waypoint=point(node);}
        else break;
      }
      const length=Math.hypot(waypoint.x-position.x,waypoint.z-position.z);
      if(length<.0001)break;
      const step=Math.min(amount,length),scale=step/length;
      const next={x:position.x+(waypoint.x-position.x)*scale,z:position.z+(waypoint.z-position.z)*scale};
      if(!clear(position,next))break;
      position.x=next.x;position.z=next.z;amount-=step;
      if(f.next[node]<0&&waypoint===target)break;
    }
    routes.set(position,node);
  }
  function reachable(position,target){return !blocked(position.x,position.z)&&localNode(position,field(target).distance)>=0;}
  function spawnNear(position,target){const i=nearest(position,field(target).distance);return i<0?null:point(i);}
  return {move,reachable,spawnNear};
}
