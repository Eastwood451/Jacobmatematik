import * as THREE from 'three';

// Built once on entry. Repeated details share geometry/materials and are instanced.
export function createSchoolyard({ scene, box, renderer }) {
  let seed = 731;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness:.88 });
  const steel = material(0x596b70), dark = material(0x20292c), wood = material(0x99704e);
  const cream = material(0xede5cf), grass = material(0x687e43);
  const batches = new Map();
  const cube = new THREE.BoxGeometry(1,1,1);
  const cylinder = new THREE.CylinderGeometry(1,1,1,8);
  function instance(geometry, mat, position, scale, quaternion = new THREE.Quaternion()) {
    if (!batches.has(geometry)) batches.set(geometry,new Map());
    const byMaterial = batches.get(geometry);
    if (!byMaterial.has(mat)) byMaterial.set(mat,[]);
    byMaterial.get(mat).push(new THREE.Matrix4().compose(new THREE.Vector3(...position),quaternion,new THREE.Vector3(...scale)));
  }
  function block(x,y,z,w,h,d,mat) { instance(cube,mat,[x,y,z],[w,h,d]); }
  function tube(a,b,r,mat) {
    const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), delta=end.clone().sub(start);
    instance(cylinder,mat,start.add(end).multiplyScalar(.5).toArray(),[r,delta.length(),r],new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
  }
  function texture(size, draw, repeatX=1, repeatY=1) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    draw(canvas.getContext('2d'),size);
    const map=new THREE.CanvasTexture(canvas);
    map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeatX,repeatY);
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const asphaltMap=texture(512,(ctx,s)=>{
    ctx.fillStyle='#535a5c';ctx.fillRect(0,0,s,s);
    for(let i=0;i<27000;i++) {
      const value=55+Math.floor(random()*65);
      ctx.fillStyle=`rgba(${value},${value+3},${value+4},.45)`;
      ctx.fillRect(random()*s,random()*s,1+random()*2,1+random()*2);
    }
    ctx.strokeStyle='#42494a';ctx.lineWidth=1;
    for(let j=0;j<4;j++) {
      let x=random()*s,y=random()*s;ctx.beginPath();ctx.moveTo(x,y);
      for(let i=0;i<6;i++){x+=(random()-.5)*32;y+=12;ctx.lineTo(x,y);}ctx.stroke();
    }
  },8,8);
  box(0,-.1,52,40,.2,40,new THREE.MeshStandardMaterial({map:asphaltMap,roughness:1}),false);
  box(0,-.24,60,105,.2,80,grass,false);
  // Continuous collision boundaries remain even through the open fence mesh.
  const invisible=new THREE.MeshBasicMaterial({visible:false});
  box(-20,1.3,52,.3,2.6,40,invisible,true);
  box(20,1.3,52,.3,2.6,40,invisible,true);
  box(0,1.3,72,40,2.6,.3,invisible,true);
  [-19.8,19.8].forEach(x=>block(x,.08,52,.32,.16,40,cream));
  block(0,.08,71.8,40,.16,.32,cream);
  const meshMap=texture(64,(ctx,s)=>{
    ctx.strokeStyle='#829397';ctx.lineWidth=2.4;
    ctx.beginPath();ctx.moveTo(0,s/2);ctx.lineTo(s/2,0);ctx.lineTo(s,s/2);ctx.lineTo(s/2,s);ctx.closePath();ctx.stroke();
  },100,6);
  const meshMat=new THREE.MeshStandardMaterial({map:meshMap,alphaTest:.35,side:THREE.DoubleSide,roughness:.65,metalness:.35});
  [-20,20].forEach(x=>{
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(40,2.4),meshMat);
    panel.position.set(x,1.35,52);panel.rotation.y=Math.PI/2;scene.add(panel);
    for(let z=32;z<=72;z+=4)tube([x,0,z],[x,2.75,z],.055,steel);
    [.25,2.55].forEach(y=>tube([x,y,32],[x,y,72],.035,steel));
  });
  // Weathered rear timber fence, staggered tops and visible horizontal rails.
  const plankMats=[0x99704e,0x896247,0xa47b57,0x805c43].map(material);
  for(let x=-19.9;x<20;x+=.24)block(x,1.22,72,.22,2.4+random()*.12,.12,plankMats[Math.floor(random()*4)]);
  [.55,1.9].forEach(y=>block(0,y,71.88,40,.15,.14,wood));
  for(let x=-20;x<=20;x+=4)block(x,1.35,71.82,.15,2.7,.2,wood);

  // Brick school facade and blue-green window frames on the arrival side.
  const brickMap=texture(512,(ctx,s)=>{
    ctx.fillStyle='#ccb99b';ctx.fillRect(0,0,s,s);
    for(let row=0;row<8;row++)for(let col=-1;col<4;col++){
      ctx.fillStyle=['#95604c','#a26c53','#ae795c'][Math.floor(random()*3)];
      ctx.fillRect(col*128+(row%2)*64+3,row*64+3,122,58);
    }
  },10,1.5);
  box(0,2.2,32,40,4.4,.4,new THREE.MeshStandardMaterial({map:brickMap,roughness:1}),true);
  block(0,4.4,32,40,.18,.75,cream);
  const windowMat=new THREE.MeshStandardMaterial({color:0x426b7d,roughness:.28,metalness:.3});
  for(const x of [-16,-10,10,16]) {
    block(x,2.65,32.25,3.5,2,.14,cream);block(x,2.65,32.35,3.25,1.75,.1,windowMat);
    block(x,2.65,32.42,.08,1.8,.06,cream);block(x,2.65,32.42,3.3,.08,.06,cream);
    block(x,1.62,32.48,3.7,.12,.5,cream);
  }
  block(0,1.65,32.25,3.4,3.3,.15,steel);
  block(0,2.05,32.36,2.9,1.75,.1,windowMat);block(0,1.65,32.44,.08,3.3,.08,cream);
  block(.25,1.25,32.52,.08,.4,.12,cream);

  // Worn playground paint: a ball court, centre circle and hopscotch.
  const paintMap=texture(1024,(ctx,s)=>{
    const p=(x,z)=>[(x+20)/40*s,(z-32)/40*s];
    ctx.strokeStyle='rgba(242,230,184,.8)';ctx.lineWidth=3;
    const a=p(-9,42),b=p(9,65);ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
    ctx.beginPath();ctx.moveTo(...p(-9,53.5));ctx.lineTo(...p(9,53.5));ctx.stroke();
    ctx.beginPath();ctx.arc(...p(0,53.5),3/40*s,0,Math.PI*2);ctx.stroke();
    for(const z of [42,61]){const q=p(-3,z);ctx.strokeRect(q[0],q[1],6/40*s,4/40*s);}
    ctx.font='bold 21px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    for(let i=0;i<8;i++){
      const x=-15+(i%3===1?.55:0),z=48+i*1.1,q=p(x,z);
      ctx.fillStyle=['rgba(218,177,81,.2)','rgba(107,170,173,.2)'][i%2];ctx.fillRect(q[0],q[1],25,25);ctx.strokeRect(q[0],q[1],25,25);
      ctx.fillStyle='#f1e4ba';ctx.fillText(String(i+1),q[0]+12.5,q[1]+12.5);
    }
  });
  const paint=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({map:paintMap,transparent:true,depthWrite:false,roughness:1}));
  paint.rotation.x=-Math.PI/2;paint.position.set(0,.012,52);paint.receiveShadow=true;scene.add(paint);
  // Seats keep their original collision footprint; slats and backrests add detail.
  [[-13,44],[13,44],[-13,61],[13,61]].forEach(([x,z])=>{
    box(x,.45,z,3.6,.18,.65,invisible,true);
    for(let i=0;i<3;i++)block(x,.46,z-.23+i*.23,3.6,.12,.18,wood);
    for(const dx of [-1.45,1.45]){tube([x+dx,0,z],[x+dx,.5,z],.06,steel);tube([x+dx,.15,z+.3],[x+dx,1.05,z+.3],.04,steel);}
    [.78,1].forEach(y=>block(x,y,z+.3,3.6,.16,.1,wood));
  });
  [-12,12].forEach(x=>{
    box(x,2.2,69,.18,4.4,.18,steel,true);
    block(x,3.25,68.85,2.1,1.3,.12,cream);
    const red=material(0xb74e37);
    block(x,3.1,68.77,.65,.035,.025,red);block(x,3.65,68.77,.65,.035,.025,red);
    [-.325,.325].forEach(dx=>block(x+dx,3.375,68.77,.035,.55,.025,red));
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.42,.045,8,24),red);rim.rotation.x=Math.PI/2;rim.position.set(x,2.75,68.35);scene.add(rim);
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;tube([x+Math.cos(angle)*.41,2.75,68.35+Math.sin(angle)*.41],[x+Math.cos(angle+.2)*.25,2.2,68.35+Math.sin(angle+.2)*.25],.009,cream);}
  });

  // Bicycles live against the school facade, outside the open combat lanes.
  const tyreGeometry=new THREE.TorusGeometry(.4,.044,6,20), rimGeometry=new THREE.TorusGeometry(.35,.014,4,20);
  const spokes=[];
  [0x427f89,0xb9573e,0xc79a3c,0x53644b,0x727695].map(material).forEach((frameMat,i)=>{
    const x=6+i*2.4,z=34.15;
    const point=(dx,y,dz=0)=>[x+dx,y,z+dz];
    for(const dx of [-.7,.7]){
      instance(tyreGeometry,dark,point(dx,.43),[1,1,1]);instance(rimGeometry,steel,point(dx,.43),[1,1,1]);
      for(let j=0;j<10;j++){const t=j*Math.PI/5;spokes.push(...point(dx,.43),...point(dx+Math.cos(t)*.34,.43+Math.sin(t)*.34));}
    }
    const rear=point(-.7,.43),front=point(.7,.43),crank=point(-.05,.4),seat=point(-.25,1.06),head=point(.5,1.04);
    [[rear,crank],[rear,seat],[crank,seat],[seat,head],[head,crank],[head,front]].forEach(([a,b])=>tube(a,b,.025,frameMat));
    tube(seat,point(-.28,1.2),.023,steel);block(x-.28,1.21,z,.31,.075,.18,dark);
    tube(head,point(.48,1.25),.025,steel);tube(point(.48,1.25,-.25),point(.48,1.25,.25),.023,steel);
    [-.26,.26].forEach(dz=>block(x+.48,1.25,z+dz,.1,.045,.13,dark));
    tube(point(-.05,.4,-.15),point(-.05,.4,.15),.024,steel);
    block(x-.05,.4,z+.17,.18,.045,.08,dark);tube(point(-.1,.5,.02),point(-.3,.04,.25),.015,steel);
    // Low wheel rack, with matching collision for the parked bike.
    tube(point(.9,.02,-.35),point(.9,.55,-.35),.035,steel);tube(point(.9,.55,-.35),point(.9,.55,.35),.035,steel);tube(point(.9,.55,.35),point(.9,.02,.35),.035,steel);
    box(x,.65,z,2.3,1.3,.8,invisible,true);
  });
  const spokeGeo=new THREE.BufferGeometry();spokeGeo.setAttribute('position',new THREE.Float32BufferAttribute(spokes,3));scene.add(new THREE.LineSegments(spokeGeo,new THREE.LineBasicMaterial({color:0xa5b1af})));

  const leafGeometry=new THREE.IcosahedronGeometry(1,1), trunk=material(0x68533d);
  const leafMats=[0x4e743c,0x648349,0x789550,0x43663a].map(material);
  const trees=[[-25,38],[-26,48],[-24,59],[-26,70],[25,39],[27,50],[25,62],[27,74],[-17,78],[-6,80],[7,78],[18,80]];
  trees.forEach(([x,z])=>{
    const h=5+random()*2,s=2+random()*.7;
    tube([x,-.2,z],[x+.2,h,z],.22,trunk);
    for(let i=0;i<5;i++){
      const angle=i*2.4,dx=Math.cos(angle)*s*.7,dz=Math.sin(angle)*s*.7,y=h+(i%2)*1.2;
      tube([x,h*.6,z],[x+dx,y,z+dz],.1,trunk);
      instance(leafGeometry,leafMats[i%4],[x+dx,y,z+dz],[s,s*.95,s]);
    }
    instance(leafGeometry,leafMats[2],[x,h+2,z],[s*.85,s,s*.85]);
  });
  // A sky dome has no collision/shadow cost and is only shown in the yard.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(115,24,12),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w;}',
    fragmentShader:'varying vec3 direction; void main(){float h=max(normalize(direction).y,0.0);vec3 c=mix(vec3(.79,.86,.86),vec3(.19,.46,.66),pow(h,.55));gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
  }));
  sky.position.set(0,0,52);sky.renderOrder=-1;scene.add(sky);
  const cloudGroup=new THREE.Group();scene.add(cloudGroup);
  const cloudMat=new THREE.MeshBasicMaterial({color:0xf5eee0,fog:false});
  const cloudGeo=new THREE.IcosahedronGeometry(1,2);
  [[-38,28,77],[25,32,92],[42,25,45],[-30,26,24],[0,34,110]].forEach(([x,y,z])=>{
    for(let i=0;i<4;i++){const cloud=new THREE.Mesh(cloudGeo,cloudMat);cloud.position.set(x+i*3,y+(i%2),z);cloud.scale.set(4,1.8+(i%2),2.6);cloudGroup.add(cloud);}
  });
  for(const [geometry,byMaterial] of batches)for(const [mat,matrices] of byMaterial){
    const mesh=new THREE.InstancedMesh(geometry,mat,matrices.length);
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
  return { setActive(active) { sky.visible=cloudGroup.visible=active; } };
}
