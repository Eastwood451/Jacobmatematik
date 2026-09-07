import * as THREE from 'three';

const WIDTH=8.4,HEIGHT=14.4;
const smooth=THREE.MathUtils.smoothstep;

function ellipse(ctx,x,y,rx,ry,fill,stroke='#111820',line=8){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=line;ctx.strokeStyle=stroke;ctx.stroke();}
function line(ctx,points,width=8,color='#111820'){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.stroke();}
function text(ctx,t,x,y,size,color='#111820'){ctx.font=`900 ${size}px Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(t,x,y);}

export function createElseTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=1536;const ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  // Hair cloud and bun, directly inspired by the supplied sketch.
  const hair='#b8c1c6',skin='#e3aa86',dress='#8f3d7a',dress2='#c45d9f',blue='#111820';
  ellipse(ctx,512,180,122,86,hair,blue,10);ellipse(ctx,512,86,72,58,hair,blue,10);
  ellipse(ctx,424,196,64,52,hair,blue,10);ellipse(ctx,600,196,64,52,hair,blue,10);
  // Head, cheeks and neck.
  ellipse(ctx,512,330,176,190,skin,blue,11);ellipse(ctx,395,366,52,66,skin,blue,9);ellipse(ctx,629,366,52,66,skin,blue,9);
  // Glasses.
  ctx.fillStyle='rgba(230,246,255,.28)';ctx.strokeStyle=blue;ctx.lineWidth=10;
  ctx.beginPath();ctx.roundRect(365,258,130,96,32);ctx.fill();ctx.stroke();ctx.beginPath();ctx.roundRect(529,258,130,96,32);ctx.fill();ctx.stroke();line(ctx,[[495,303],[529,303]],10,blue);
  ellipse(ctx,435,305,14,18,'#111820','#111820',2);ellipse(ctx,590,305,14,18,'#111820','#111820',2);
  // Lashes and stern eyebrows.
  line(ctx,[[382,257],[360,239]],7,blue);line(ctx,[[390,250],[374,226]],7,blue);line(ctx,[[637,255],[660,236]],7,blue);line(ctx,[[631,248],[646,223]],7,blue);
  line(ctx,[[405,236],[470,246]],10,blue);line(ctx,[[555,246],[620,236]],10,blue);
  // Nose and mouth.
  line(ctx,[[512,316],[500,384],[526,382]],9,blue);line(ctx,[[470,425],[505,441],[548,424]],10,blue);
  // Necklace/ruff.
  for(let i=0;i<7;i++)ellipse(ctx,425+i*29,507,29,24,'#f3e8ce',blue,7);
  // Arms, ruler and red pen.
  line(ctx,[[382,522],[282,668],[226,752]],44,skin);line(ctx,[[642,522],[740,646],[806,714]],44,skin);
  // pen left
  line(ctx,[[190,780],[270,716]],26,'#d84836');line(ctx,[[183,786],[207,806]],10,blue);line(ctx,[[267,713],[289,692]],10,blue);
  // ruler right
  ctx.save();ctx.translate(808,651);ctx.rotate(-.45);ctx.fillStyle='#e5cf79';ctx.strokeStyle=blue;ctx.lineWidth=10;ctx.fillRect(-30,-150,60,300);ctx.strokeRect(-30,-150,60,300);for(let y=-125;y<130;y+=38){line(ctx,[[-28,y],[4,y]],5,blue);}ctx.restore();
  // Huge floral dress.
  ctx.beginPath();ctx.moveTo(380,520);ctx.bezierCurveTo(300,650,242,990,205,1330);ctx.quadraticCurveTo(512,1445,819,1330);ctx.bezierCurveTo(780,970,720,650,644,520);ctx.closePath();ctx.fillStyle=dress;ctx.fill();ctx.strokeStyle=blue;ctx.lineWidth=12;ctx.stroke();
  // Apron bib.
  ctx.beginPath();ctx.moveTo(400,540);ctx.quadraticCurveTo(512,630,624,540);ctx.lineTo(605,725);ctx.quadraticCurveTo(512,780,419,725);ctx.closePath();ctx.fillStyle='#f3e8ce';ctx.fill();ctx.strokeStyle=blue;ctx.lineWidth=9;ctx.stroke();
  // Dress dots/flowers.
  [[330,820],[530,800],[690,860],[410,1010],[620,1050],[300,1180],[520,1205],[720,1210]].forEach(([x,y],i)=>{ellipse(ctx,x,y,34,34,i%2?dress2:'#f0c75e',blue,6);ellipse(ctx,x,y,11,11,'#f3e8ce',blue,4);});
  // Tiny shoes under the enormous dress.
  ellipse(ctx,420,1395,92,34,'#342c2a',blue,9);ellipse(ctx,604,1395,92,34,'#342c2a',blue,9);
  // Boss title, tucked into the art without floating above her in play.
  text(ctx,'EKSAMENS ELSE',512,1490,40,'#f3e8ce');
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}

export function createElseRig(texture,phase=Math.random()*Math.PI*2){
  const geometry=new THREE.PlaneGeometry(WIDTH,HEIGHT,48,80),indices=[],weights=[],uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++){
    const u=uv.getX(i),v=uv.getY(i);let bone=0,w=0;
    if(v>.67){bone=1;w=smooth(v,.67,.76);}else if(v>.45&&v<.69){if(u<.38){bone=2;w=(1-smooth(u,.28,.39))*smooth(v,.46,.53);}else if(u>.62){bone=3;w=smooth(u,.61,.73)*smooth(v,.46,.53);}}else if(v<.17){bone=u<.5?4:5;w=1-smooth(v,.12,.19);}indices.push(0,bone,0,0);weights.push(1-w,w,0,0);
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.03,side:THREE.DoubleSide,toneMapped:false});
  const body=new THREE.SkinnedMesh(geometry,material),root=new THREE.Bone();
  const joint=(u,v)=>{const b=new THREE.Bone();b.position.set((u-.5)*WIDTH,(v-.5)*HEIGHT,0);root.add(b);return b;};
  const head=joint(.5,.72),leftArm=joint(.35,.63),rightArm=joint(.65,.63),leftLeg=joint(.43,.10),rightLeg=joint(.57,.10);
  body.add(root);body.bind(new THREE.Skeleton([root,head,leftArm,rightArm,leftLeg,rightLeg]));body.position.y=7.05;body.frustumCulled=false;
  const group=new THREE.Group();group.add(body);return {type:'else',group,body,head,leftArm,rightArm,leftLeg,rightLeg,phase,stride:0,hp:25,maxHp:25,speed:.82,lastStompAt:0};
}

export function animateElse(enemy,dt,time,distanceMoved,onStomp){
  enemy.stride+=distanceMoved*1.6;const walking=Math.min(1,distanceMoved/Math.max(dt*.5,.001));const step=Math.sin(enemy.stride+enemy.phase)*walking;const sway=Math.sin(time*.0011+enemy.phase);
  enemy.leftLeg.rotation.z=step*.055;enemy.rightLeg.rotation.z=-step*.055;enemy.leftArm.rotation.z=-.06-step*.08+sway*.025;enemy.rightArm.rotation.z=.06+step*.08-sway*.025;enemy.head.rotation.z=sway*.028;enemy.body.position.y=7.05+Math.abs(step)*.08;
  const stompPhase=Math.sin(enemy.stride+enemy.phase);if(walking>.45&&stompPhase>.92&&time-enemy.lastStompAt>520){enemy.lastStompAt=time;if(onStomp)onStomp();}
}

export function disposeElseRig(enemy){enemy.body.geometry.dispose();enemy.body.material.dispose();enemy.body.skeleton.dispose();}
