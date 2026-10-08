/* Marley wardrobe study. All clothing and fur occupy the same 3D scene. */
(() => {
  'use strict';
  const host=document.getElementById('stage'),T=window.THREE;
  let renderer;
  try { renderer=new T.WebGLRenderer({antialias:true,alpha:true}); }
  catch(error){
    document.getElementById('loading').remove();
    const still=document.createElement('img');still.src='assets/figurer/marley-3d-study.webp';still.alt='Render af 3D-prøven: Marley med kasket';still.style.cssText='width:100%;height:100%;object-fit:contain';host.prepend(still);
    host.querySelector('.status').textContent='Stillbillede af 3D-prøven';
    document.querySelectorAll('.controls button').forEach(b=>b.disabled=true);
    document.getElementById('error').textContent='3D kan ikke starte i denne browser. Her vises en render af modellen.';return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.domElement.setAttribute('aria-label','3D-Marley med en kasket, der følger hovedet');renderer.domElement.setAttribute('role','img');
  host.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,30);
  scene.add(new T.HemisphereLight(0xffeed8,0x756689,1.6));
  const key=new T.DirectionalLight(0xffddb1,3.1);key.position.set(-3.4,5.5,4);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-2.5,near:.1,far:12});key.shadow.normalBias=.018;key.shadow.bias=-.00015;key.shadow.radius=3;scene.add(key);
  const fill=new T.DirectionalLight(0xc9c0ff,1.2);fill.position.set(3,3,1);scene.add(fill);
  const rim=new T.DirectionalLight(0xffc37d,2.1);rim.position.set(1,4,-3);scene.add(rim);
  const material=(color,roughness=.83)=>new T.MeshStandardMaterial({color,roughness});
  const fur=material(0xc98447),furLight=material(0xe6ad6e),earFur=material(0xb8773c),cream=material(0xf5d5aa);
  const dark=material(0x281811,.34),white=material(0xfff3df,.3),iris=material(0x713f20,.25),pink=material(0xdf7483,.52);
  const cloth=material(0x526bc1,.98),hatMat=material(0x376ca8,.88),hatSeam=material(0x6797c4,.93),hatInside=material(0x193e67,.94);
  const sphere=new T.SphereGeometry(1,32,24);
  const curlPoints=Array.from({length:20},(_,i)=>{const a=i/19*7.1,r=.66-i/19*.37;return new T.Vector3(Math.cos(a)*r,.06*Math.sin(a*.65),Math.sin(a)*r);});
  const curlGeo=new T.TubeGeometry(new T.CatmullRomCurve3(curlPoints),22,.26,6,false);
  function ellipsoid(parent,mat,pos,size){const m=new T.Mesh(sphere,mat);m.position.set(...pos);m.scale.set(...size);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function tube(parent,points,radius,mat){const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),40,radius,8,false),mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  let seed=817;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Surface curls are stable geometry; only the skeleton moves.
  function fluffy(parent,pos,size,count,mat,filter=()=>true){
    const group=new T.Group();group.position.set(...pos);parent.add(group);ellipsoid(group,mat,[0,0,0],size);
    const tuft=new T.InstancedMesh(curlGeo,mat,count),dummy=new T.Object3D(),up=new T.Vector3(0,1,0),normal=new T.Vector3();
    let n=0;
    for(let i=0;i<count;i++){
      const y=1-2*(i+.5)/count,a=i*2.3999632297,r=Math.sqrt(1-y*y);normal.set(r*Math.cos(a),y,r*Math.sin(a));
      if(!filter(normal))continue;
      const thickness=.032+random()*.013;
      dummy.position.set(normal.x*size[0]*.995,normal.y*size[1]*.995,normal.z*size[2]*.995);
      dummy.quaternion.setFromUnitVectors(up,normal);dummy.rotateY(random()*6.283);
      dummy.scale.set(thickness*1.4,thickness*.7,thickness);dummy.updateMatrix();tuft.setMatrixAt(n,dummy.matrix);
      tuft.setColorAt(n,new T.Color(mat.color).multiplyScalar(.92+random()*.12));n++;
    }
    tuft.count=n;tuft.castShadow=tuft.receiveShadow=true;group.add(tuft);return group;
  }
  const dog=new T.Group();scene.add(dog);
  const body=new T.Group();dog.add(body);
  fluffy(body,[0,.92,-.15],[.47,.64,.46],620,fur);
  fluffy(body,[0,1.19,.16],[.4,.43,.3],330,furLight);
  fluffy(body,[0,1.1,.36],[.17,.28,.065],100,cream);
  // Seated hindquarters and front legs connect inside overlapping body volumes.
  for(const side of [-1,1]){
    fluffy(body,[side*.38,.39,-.2],[.28,.35,.36],220,fur);
    fluffy(body,[side*.36,.145,.12],[.23,.135,.32],140,furLight);
    fluffy(body,[side*.235,.57,.3],[.14,.45,.145],240,fur);
    fluffy(body,[side*.235,.14,.4],[.18,.135,.24],150,furLight);
    for(const dx of [-.065,0,.065])tube(body,[[side*.235+dx,.15,.61],[side*.235+dx,.19,.595]],.006,earFur);
  }
  const headPivot=new T.Group();headPivot.position.set(0,1.63,.06);body.add(headPivot);
  const head=new T.Group();head.position.y=.28;headPivot.add(head);
  fluffy(head,[0,0,0],[.53,.49,.435],1100,furLight,n=>n.y<.4&&!(n.z>.77&&n.y<.37&&n.y>-.36));
  const crown=fluffy(head,[0,.27,-.035],[.43,.265,.35],360,furLight);
  const ears=[];
  for(const side of [-1,1]){
    const pivot=new T.Group();pivot.position.set(side*.46,.17,-.045);head.add(pivot);
    const ear=fluffy(pivot,[side*.11,-.37,-.018],[.205,.47,.225],480,earFur);ear.rotation.z=side*.12;
    fluffy(pivot,[side*.15,-.59,.09],[.145,.24,.105],130,fur);ears.push(pivot);
  }
  const eyes=[];
  for(const side of [-1,1]){
    const eye=new T.Group();eye.position.set(side*.208,.05,.383);eye.rotation.y=side*.17;head.add(eye);
    ellipsoid(eye,earFur,[0,0,-.004],[.131,.149,.052]);
    ellipsoid(eye,white,[0,0,.029],[.107,.126,.057]);
    ellipsoid(eye,iris,[side*-.009,-.008,.079],[.082,.105,.029]);
    ellipsoid(eye,dark,[side*-.009,-.005,.102],[.055,.075,.018]);
    ellipsoid(eye,white,[-.026,.037,.12],[.024,.029,.008]);ellipsoid(eye,white,[.025,-.036,.12],[.01,.013,.006]);
    tube(head,[[side*.11,.205,.391],[side*.22,.229,.384],[side*.3,.201,.352]],.018,earFur);eyes.push(eye);
  }
  const jaw=new T.Group();jaw.position.set(0,-.255,.343);head.add(jaw);
  ellipsoid(jaw,dark,[0,-.008,.06],[.174,.104,.074]);
  fluffy(jaw,[0,-.071,.048],[.185,.065,.081],70,furLight);
  const tongue=ellipsoid(jaw,pink,[0,-.074,.133],[.065,.094,.018]);
  tube(jaw,[[0,-.071,.151],[0,-.119,.151]],.003,earFur);
  for(const side of [-1,1])fluffy(head,[side*.12,-.15,.41],[.178,.132,.147],105,cream);
  const nose=ellipsoid(head,dark,[0,-.08,.565],[.112,.077,.077]);
  ellipsoid(head,material(0xa98265,.28),[-.031,-.052,.627],[.031,.012,.005]);
  tube(head,[[0,-.131,.569],[0,-.218,.553]],.009,dark);
  // Bandana has volume, thickness and the same shadows as the character.
  const scarfBand=new T.Mesh(new T.TorusGeometry(.31,.055,12,48),cloth);scarfBand.rotation.x=Math.PI/2;scarfBand.position.set(0,1.5,.06);body.add(scarfBand);
  const scarfShape=new T.Shape();scarfShape.moveTo(-.27,0);scarfShape.quadraticCurveTo(0,-.04,.27,0);scarfShape.lineTo(.07,-.3);scarfShape.quadraticCurveTo(0,-.37,-.07,-.3);scarfShape.closePath();
  const scarf=new T.Mesh(new T.ExtrudeGeometry(scarfShape,{depth:.035,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,steps:1}),cloth);scarf.position.set(0,1.49,.39);scarf.castShadow=scarf.receiveShadow=true;body.add(scarf);
  tube(body,[[-.265,1.49,.436],[0,1.145,.438],[.265,1.49,.436]],.009,material(0xd1a564));
  const tail=new T.Group();tail.position.set(.37,.52,-.41);body.add(tail);tail.rotation.z=-.55;
  tube(tail,[[0,0,0],[.2,.1,-.11],[.44,.31,-.15],[.48,.54,-.09]],.09,fur);
  fluffy(tail,[.47,.51,-.1],[.2,.28,.19],270,furLight);
  // The cap is a fitted dome, not a camera-facing plane.
  const cap=new T.Group();cap.name='cap';head.add(cap);cap.position.set(0,.275,-.025);cap.rotation.z=-.055;
  const domeGeo=new T.SphereGeometry(1,64,32,0,Math.PI*2,0,Math.PI/2);
  const dome=new T.Mesh(domeGeo,hatMat);dome.scale.set(.49,.31,.395);dome.castShadow=dome.receiveShadow=true;cap.add(dome);
  const hemPoints=Array.from({length:81},(_,i)=>{const a=i/80*Math.PI*2;return [Math.cos(a)*.49,.006,Math.sin(a)*.395];});tube(cap,hemPoints,.014,hatInside);
  // Curved brim has a top, underside and curved edge in 3D.
  const positions=[],uv=[],indices=[],nx=40,nz=12;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=(i/nx*2-1)*.47,t=j/nz;
    const back=.11+.22*Math.sqrt(Math.max(0,1-(x/.49)**2));
    const front=.34+.36*Math.sqrt(Math.max(0,1-(x/.49)**2));
    positions.push(x,-.015-.045*(x/.47)**2-.035*t,back+(front-back)*t);uv.push(i/nx,t);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+nx+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const brimGeo=new T.BufferGeometry();brimGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));brimGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));brimGeo.setIndex(indices);brimGeo.computeVertexNormals();
  const brimMat=hatMat.clone();brimMat.side=T.DoubleSide;const brim=new T.Mesh(brimGeo,brimMat);brim.castShadow=brim.receiveShadow=true;cap.add(brim);
  const underside=new T.Mesh(brimGeo,hatInside);underside.material=hatInside.clone();underside.material.side=T.DoubleSide;underside.position.y=-.012;cap.add(underside);
  const edge=[];for(let i=0;i<=nx;i++){const x=(i/nx*2-1)*.47;edge.push([x,-.05-.045*(x/.47)**2,.34+.36*Math.sqrt(Math.max(0,1-(x/.49)**2))]);}tube(cap,edge,.008,hatSeam);
  for(let panel=0;panel<6;panel++){
    const a=panel/6*Math.PI*2,pts=[];
    for(let i=0;i<=20;i++){const b=i/20*Math.PI/2;pts.push([Math.sin(b)*Math.cos(a)*.492,Math.cos(b)*.312,Math.sin(b)*Math.sin(a)*.397]);}tube(cap,pts,.004,hatSeam);
  }
  ellipsoid(cap,hatMat,[0,.317,0],[.035,.018,.035]);
  // Raised embroidered paw on the front of the crown.
  const badge=new T.Group();badge.position.set(0,.145,.356);badge.rotation.x=.3;cap.add(badge);
  const gold=material(0xf3c56f,.97);ellipsoid(badge,gold,[0,-.017,.012],[.037,.027,.008]);
  for(const [x,y] of [[-.033,.022],[-.012,.039],[.013,.038],[.035,.019]])ellipsoid(badge,gold,[x,y,.012],[.012,.016,.008]);
  crown.visible=false;
  const floor=new T.Mesh(new T.CircleGeometry(3.5,96),material(0x8b6b76));floor.rotation.x=-Math.PI/2;floor.position.y=-.013;floor.receiveShadow=true;scene.add(floor);
  const rug=new T.Mesh(new T.CylinderGeometry(1.45,1.45,.025,96),material(0x695080));rug.position.y=-.002;rug.receiveShadow=true;scene.add(rug);
  const ring=new T.Mesh(new T.TorusGeometry(1.4,.015,8,96),material(0xac8ba6));ring.rotation.x=Math.PI/2;ring.position.y=.013;scene.add(ring);
  let orbit=.24,targetOrbit=.24,paused=false,last=performance.now(),time=0,lookStart=-100,wagStart=-100,raf=0,drag=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cameraPose(){camera.position.set(Math.sin(orbit)*6.25,2.95,Math.cos(orbit)*6.25);camera.lookAt(0,1.35,0);}
  function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
  function pose(t){
    const breathing=reduced?0:Math.sin(t*1.5)*.006;body.scale.y=1+breathing;body.position.y=0;
    const l=t-lookStart,looking=l>=0&&l<8?Math.sin(l*Math.PI/4)*.45:0;
    headPivot.rotation.y=looking;
    headPivot.rotation.z=reduced?0:.022*Math.sin(t*.6);headPivot.rotation.x=.02+(reduced?0:.012*Math.sin(t*.7));
    const happy=t-wagStart<4,pace=happy?5.2:2.4,amp=happy?.33:.14;
    tail.rotation.y=reduced?0:Math.sin(t*pace)*amp;
    const blinkPhase=t%6.4;const blink=blinkPhase>5.9&&blinkPhase<6.16?Math.sin((blinkPhase-5.9)/.26*Math.PI):0;
    eyes.forEach(e=>e.scale.y=1-blink*.91);
    ears.forEach((e,i)=>{e.rotation.z=(i?1:-1)*.012*Math.sin(t*.8);});
    tongue.rotation.x=reduced?0:.025*Math.sin(t*1.2);
  }
  function frame(now){raf=requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(!paused&&!document.hidden)time+=dt;
    orbit+=(targetOrbit-orbit)*Math.min(1,dt*7);cameraPose();pose(time);renderer.render(scene,camera);}
  raf=requestAnimationFrame(frame);document.getElementById('loading').remove();
  document.getElementById('cap').addEventListener('click',e=>{cap.visible=!cap.visible;crown.visible=!cap.visible;e.currentTarget.setAttribute('aria-pressed',String(cap.visible));e.currentTarget.textContent=cap.visible?'Tag kasketten af':'Tag kasketten på';});
  document.getElementById('look').addEventListener('click',()=>{lookStart=time;});
  document.getElementById('wag').addEventListener('click',()=>{wagStart=time;});
  document.getElementById('front').addEventListener('click',()=>{targetOrbit=0;});
  document.getElementById('pause').addEventListener('click',e=>{paused=!paused;e.currentTarget.textContent=paused?'Fortsæt':'Pause';e.currentTarget.setAttribute('aria-pressed',String(paused));});
  host.addEventListener('pointerdown',e=>{if(e.target!==renderer.domElement)return;drag={x:e.clientX,angle:targetOrbit,id:e.pointerId};host.setPointerCapture(e.pointerId);});
  host.addEventListener('pointermove',e=>{if(drag)targetOrbit=drag.angle+(e.clientX-drag.x)*.008;});
  const endDrag=()=>{drag=null;};host.addEventListener('pointerup',endDrag);host.addEventListener('pointercancel',endDrag);
  // Release GPU resources when the preview closes.
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);resizeObserver.disconnect();const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();},{once:true});
})();
