import * as THREE from 'three';
import { createErlingRig, animateErling, disposeErlingRig } from './fps-visuals.js?v=20260905-art1';

function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.stroke();}
function line(ctx,points){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}

export function createGunnarTexture(){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=960;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,640,960);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#17263a';ctx.lineWidth=10;
  const skin='#d49a68',shadow='#b97550',ink='#17263a',shorts='#626b78',belt='#b88f5b';
  // Gunnar follows the user's sketch: flat head, V fringe, sleepy eyes, huge shoulders, belt and torn shorts.
  ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(216,325);ctx.bezierCurveTo(145,313,99,356,86,438);ctx.bezierCurveTo(72,531,112,595,181,584);ctx.bezierCurveTo(200,654,245,694,320,696);ctx.bezierCurveTo(396,694,442,653,460,584);ctx.bezierCurveTo(529,596,568,530,553,438);ctx.bezierCurveTo(540,355,494,313,423,325);ctx.bezierCurveTo(407,296,380,279,352,275);ctx.lineTo(286,275);ctx.bezierCurveTo(256,281,231,298,216,325);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(224,112);ctx.lineTo(416,112);ctx.lineTo(407,312);ctx.bezierCurveTo(391,348,353,369,320,370);ctx.bezierCurveTo(281,368,246,346,232,311);ctx.closePath();ctx.fillStyle=skin;ctx.fill();ctx.stroke();
  ctx.strokeStyle=ink;ctx.lineWidth=13;for(let i=0;i<9;i++){const x=230+i*22;ctx.beginPath();ctx.moveTo(x,114);ctx.quadraticCurveTo(x+12,83-(i%3)*5,x+24,114);ctx.stroke();}ctx.lineWidth=15;line(ctx,[[282,148],[320,190],[368,143]]);
  ctx.lineWidth=9;ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(231,205);ctx.bezierCurveTo(188,184,187,257,227,268);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(409,205);ctx.bezierCurveTo(453,183,454,256,413,268);ctx.fill();ctx.stroke();
  ellipse(ctx,278,229,47,54,'#eee3c8');ellipse(ctx,364,229,47,54,'#eee3c8');ctx.lineWidth=8;line(ctx,[[237,226],[313,224]]);line(ctx,[[329,224],[404,226]]);ellipse(ctx,291,238,8,12,ink);ellipse(ctx,351,238,8,12,ink);line(ctx,[[242,201],[306,197]]);line(ctx,[[335,198],[399,202]]);
  ellipse(ctx,320,282,31,23,shadow);ctx.lineWidth=6;for(let i=0;i<7;i++){const x=288+i*10;line(ctx,[[x,307],[x+5,316],[x+10,307]]);}ctx.fillStyle='#6a3040';ctx.beginPath();ctx.moveTo(280,331);ctx.bezierCurveTo(305,314,347,315,374,336);ctx.bezierCurveTo(347,371,307,371,280,331);ctx.fill();ctx.stroke();
  ctx.lineWidth=7;ctx.beginPath();ctx.arc(320,548,46,.12,Math.PI-.1);ctx.stroke();
  for(let i=0;i<7;i++)ellipse(ctx,220+i*33,651,19,23,belt);
  ctx.fillStyle=shorts;ctx.beginPath();ctx.moveTo(183,680);ctx.lineTo(457,680);ctx.lineTo(440,840);ctx.lineTo(349,840);ctx.lineTo(320,760);ctx.lineTo(291,840);ctx.lineTo(199,840);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#d8c99e';ctx.fillRect(391,726,42,47);ctx.strokeRect(391,726,42,47);line(ctx,[[394,735],[428,765],[402,769],[426,734]]);
  ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(172,558);ctx.bezierCurveTo(135,618,153,684,215,714);ctx.lineTo(277,742);ctx.bezierCurveTo(302,750,315,718,290,703);ctx.lineTo(229,666);ctx.bezierCurveTo(213,624,207,589,205,565);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(469,558);ctx.bezierCurveTo(505,619,489,685,427,714);ctx.lineTo(363,742);ctx.bezierCurveTo(339,750,327,718,351,702);ctx.lineTo(414,665);ctx.bezierCurveTo(429,625,436,589,437,564);ctx.closePath();ctx.fill();ctx.stroke();ellipse(ctx,285,716,30,31,shadow);ellipse(ctx,355,716,30,31,shadow);
  ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(188,834);ctx.lineTo(296,834);ctx.lineTo(289,895);ctx.bezierCurveTo(248,902,213,899,177,888);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(344,834);ctx.lineTo(452,834);ctx.lineTo(463,888);ctx.bezierCurveTo(424,901,382,901,350,895);ctx.closePath();ctx.fill();ctx.stroke();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}

export function createGunnarRig(texture){const g=createErlingRig(texture,Math.random()*Math.PI*2);g.group.scale.set(1.22,1.06,1);g.type='gunnar';g.hp=3;g.maxHp=3;g.speed=2.7;return g;}
export function animateGunnar(gunnar,dt,time,distanceMoved){animateErling(gunnar,dt,time*1.08,distanceMoved*1.25);const pulse=Math.sin(time*.004+gunnar.phase);gunnar.leftArm.rotation.z-=.08+pulse*.04;gunnar.rightArm.rotation.z+=.08-pulse*.04;gunnar.head.rotation.z+=pulse*.035;}
export function disposeGunnarRig(gunnar){disposeErlingRig(gunnar);}
