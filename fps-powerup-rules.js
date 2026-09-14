export const MINIGUN_PICKUP={x:17,y:1.3,z:24.8};
export const MINIGUN_SECONDS=10;
export const MINIGUN_RATE=10;

export function createMinigunPowerup(random=Math.random) {
  let phase='pickup',correct=0,question=null,elapsed=0,shotsFired=0,serial=0;
  const asked=new Set();
  function nextQuestion(){
    let a=10+Math.floor(random()*90),b=1+Math.floor(random()*9);
    while(asked.has(`${a}:${b}`))a=a===99?10:a+1;
    asked.add(`${a}:${b}`);
    question={id:`minigun:${++serial}`,kind:'subtract',a,b,answer:a-b,expression:`${a} − ${b}`};
  }
  function collect(position){
    if(phase!=='pickup'||Math.hypot(position.x-MINIGUN_PICKUP.x,position.z-MINIGUN_PICKUP.z)>1.55||Math.abs(position.y-MINIGUN_PICKUP.y)>1.5)return false;
    phase='challenge';nextQuestion();return true;
  }
  function submit(id,value){
    if(phase!=='challenge'||id!==question.id||!/^\d{1,2}$/.test(String(value))||Number(value)!==question.answer)return false;
    correct++;
    if(correct===5){phase='active';elapsed=0;shotsFired=0;question=null;}
    else nextQuestion();
    return true;
  }
  function advance(dt){
    if(phase!=='active')return 0;
    elapsed=Math.min(MINIGUN_SECONDS,elapsed+Math.max(0,dt));
    const due=Math.min(MINIGUN_SECONDS*MINIGUN_RATE,Math.floor(elapsed*MINIGUN_RATE+1e-8)+1);
    const shots=due-shotsFired;shotsFired=due;
    if(elapsed>=MINIGUN_SECONDS-1e-8){elapsed=MINIGUN_SECONDS;phase='spent';}
    return shots;
  }
  function reset(){phase='pickup';correct=0;question=null;elapsed=0;shotsFired=0;asked.clear();}
  return {collect,submit,advance,reset,get phase(){return phase;},get question(){return question;},
    snapshot:()=>({phase,correct,remaining:phase==='active'?MINIGUN_SECONDS-elapsed:0,shotsFired})};
}

// Check above table height, but never let an arm/pickup reach through masonry.
export function clearReach(from,to,blocked){
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)/.08));
  for(let i=0;i<=steps;i++)if(blocked(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps,from.z+(to.z-from.z)*i/steps))return false;
  return true;
}
export function updateErlingSwipe(enemy,target,dt,blocked,onHit){
  const origin=enemy.group?.position||enemy;
  const canReach=()=>target.feet>=.45&&target.feet<=1.4&&Math.hypot(target.x-origin.x,target.z-origin.z)<=2.3&&
    clearReach({x:origin.x,y:1.65,z:origin.z},{x:target.x,y:target.feet+.7,z:target.z},blocked);
  enemy.swipeCooldown=Math.max(0,(enemy.swipeCooldown||0)-dt);
  if(enemy.swipeAge==null&&enemy.swipeCooldown===0&&canReach()){
    enemy.swipeAge=0;enemy.swipeHit=false;enemy.swipeCooldown=1.2;
  }
  if(enemy.swipeAge!=null){
    enemy.swipeAge+=dt;enemy.swipe=Math.sin(Math.min(1,enemy.swipeAge/.55)*Math.PI);
    if(!enemy.swipeHit&&enemy.swipeAge>=.22){enemy.swipeHit=true;if(canReach())onHit();}
    if(enemy.swipeAge>=.55){enemy.swipeAge=null;enemy.swipe=0;}
  }else enemy.swipe=0;
}
