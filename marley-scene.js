/* Marley: a real-time, fully posed 3D character. Three.js r158 (MIT). */
(() => {
  "use strict";
  function create(host,onChange=()=>{}) {
    const T=window.THREE;
    const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.35;
    renderer.domElement.setAttribute("aria-label","Animeret 3D-Marley");
    renderer.domElement.setAttribute("role","img");
    host.append(renderer.domElement);
    const scene=new T.Scene();
    const camera=new T.PerspectiveCamera(34,1,.1,60);
    camera.position.set(4.5,3.2,6.5);camera.lookAt(0,.8,0);
    scene.add(new T.HemisphereLight(0xfff1d5,0x796799,2.4));
    const light=new T.DirectionalLight(0xffe6c4,3);
    light.position.set(-3,7,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);
    light.shadow.camera.left=-4;light.shadow.camera.right=4;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;
    light.shadow.bias=-.001;scene.add(light);
    const rim=new T.DirectionalLight(0xc9b8ff,1.8);rim.position.set(4,3,-4);scene.add(rim);
    const mat=(color,roughness=.86)=>new T.MeshStandardMaterial({color,roughness});
    const copper=mat(0xb95820),gold=mat(0xd87d32),lightFur=mat(0xf3b873),darkFur=mat(0x8f3919);
    const black=mat(0x241c19,.3),pink=mat(0xf08791,.55),purple=mat(0x563da2),orange=mat(0xffb13c),cream=mat(0xf1d9af),wicker=mat(0xa76a35);
    const sphereGeo=new T.SphereGeometry(1,20,14);
    const curlGeo=new T.TorusGeometry(1,.38,4,7);
    let seed=19;
    const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    function ellipsoid(parent,material,position,scale) {
      const m=new T.Mesh(sphereGeo,material);m.position.set(...position);m.scale.set(...scale);
      m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
    }
    function fur(parent,position,scale,count=90,material=gold) {
      const group=new T.Group();group.position.set(...position);parent.add(group);
      ellipsoid(group,material,[0,0,0],scale);
      const curls=new T.InstancedMesh(curlGeo,material,count);
      const dummy=new T.Object3D(),normal=new T.Vector3(),zaxis=new T.Vector3(0,0,1);
      for(let i=0;i<count;i++){
        const u=rnd()*2-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-u*u);
        normal.set(r*Math.cos(a),u,r*Math.sin(a));
        dummy.position.set(normal.x*scale[0],normal.y*scale[1],normal.z*scale[2]);
        dummy.quaternion.setFromUnitVectors(zaxis,normal);
        dummy.rotateZ(rnd()*6.28);
        const size=.028+rnd()*.028;dummy.scale.set(size,size,size*.7);dummy.updateMatrix();curls.setMatrixAt(i,dummy.matrix);
      }
      curls.castShadow=true;group.add(curls);return group;
    }
    function tube(parent,points,radius,material) {
      const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,radius,7,false),material);
      m.castShadow=true;parent.add(m);return m;
    }
    // A continuous torso, overlapping joint volumes and a coordinated gait.
    const dog=new T.Group();scene.add(dog);
    const torso=new T.Group();dog.add(torso);
    fur(torso,[0,1.03,-.04],[.39,.43,.72],260,copper);
    fur(torso,[0,1.12,.43],[.39,.43,.37],100,gold);
    fur(torso,[0,1.07,-.52],[.38,.37,.33],90,gold);
    fur(torso,[0,1.04,.7],[.18,.23,.08],28,cream);
    const neck=new T.Group();neck.position.set(0,1.37,.54);torso.add(neck);
    fur(neck,[0,0,0],[.25,.28,.25],70,gold);
    const head=new T.Group();head.position.set(0,.27,.07);neck.add(head);
    fur(head,[0,0,0],[.39,.37,.35],170,gold);
    fur(head,[0,.27,-.015],[.31,.2,.28],60,copper);
    const ears=[];
    for(const side of [-1,1]){
      const ear=new T.Group();ear.position.set(side*.34,.1,-.04);head.add(ear);
      fur(ear,[side*.065,-.27,-.015],[.14,.38,.17],80,copper);ears.push(ear);
    }
    const eyes=[];
    for(const side of [-1,1]){
      const eye=new T.Group();eye.position.set(side*.155,.04,.299);head.add(eye);
      ellipsoid(eye,black,[0,0,0],[.075,.093,.047]);
      ellipsoid(eye,mat(0xfff7ee,.2),[-.02,.028,.041],[.024,.025,.011]);eyes.push(eye);
      fur(head,[side*.14,-.11,.33],[.15,.12,.12],24,lightFur);
      tube(head,[[side*.08,.17,.33],[side*.17,.19,.32],[side*.24,.15,.29]],.02,darkFur);
    }
    const mouth=new T.Group();mouth.position.set(0,-.17,.31);head.add(mouth);
    const mouthDark=ellipsoid(mouth,black,[0,-.04,.01],[.125,.077,.073]);
    const tongue=ellipsoid(mouth,pink,[0,-.072,.077],[.077,.095,.018]);
    const jaw=fur(mouth,[0,-.105,.016],[.15,.067,.074],20,lightFur);
    ellipsoid(head,black,[0,-.07,.45],[.08,.061,.063]);
    ellipsoid(head,mat(0x68605a,.2),[-.023,-.052,.498],[.022,.009,.006]);
    // Bandana fabric, orange hem and knot.
    const scarf=new T.BufferGeometry();
    scarf.setAttribute("position",new T.Float32BufferAttribute([-.25,1.39,.77,.25,1.39,.77,0,1.02,.83],3));
    scarf.computeVertexNormals();const cloth=new T.Mesh(scarf,new T.MeshStandardMaterial({color:0xd92339,side:T.DoubleSide,roughness:.9}));torso.add(cloth);
    tube(torso,[[-.25,1.39,.78],[0,1.02,.84],[.25,1.39,.78]],.017,orange);
    ellipsoid(torso,mat(0xd92339),[.28,1.39,.62],[.08,.07,.08]);
    const legs=[];
    for(const front of [true,false])for(const side of [-1,1]){
      const hip=new T.Group();hip.position.set(side*.28,.815,front?.48:-.52);torso.add(hip);
      fur(hip,[0,-.14,0],[.13,.23,.14],36,gold);
      const shin=new T.Group();shin.position.set(0,-.37,0);hip.add(shin);
      fur(shin,[0,-.17,.01],[.105,.21,.12],30,copper);
      const foot=fur(shin,[0,-.34,.07],[.15,.105,.2],30,gold);
      legs.push({hip,shin,foot,front,side});
    }
    const tailRoot=new T.Group();tailRoot.position.set(0,1.13,-.65);torso.add(tailRoot);
    const tails=[];let tailParent=tailRoot;
    for(let i=0;i<5;i++){
      const segment=new T.Group();segment.position.set(0,i?.16:0,i?-.06:0);tailParent.add(segment);
      fur(segment,[0,.085,-.015],[i===4?.14:.085,.14,i===4?.14:.09],i===4?35:16,gold);
      tails.push(segment);tailParent=segment;
    }
    const partyHat=new T.Group();head.add(partyHat);partyHat.visible=false;
    const hatCone=new T.Mesh(new T.ConeGeometry(.22,.5,24),purple);hatCone.position.set(0,.54,0);hatCone.castShadow=true;partyHat.add(hatCone);
    ellipsoid(partyHat,orange,[0,.8,0],[.065,.065,.065]);
    const cap=new T.Group();head.add(cap);cap.visible=false;
    ellipsoid(cap,purple,[0,.32,0],[.34,.14,.29]);
    ellipsoid(cap,purple,[0,.32,.3],[.3,.025,.2]);
    const glasses=new T.Group();head.add(glasses);glasses.visible=false;
    for(const side of [-1,1]){
      const ring=new T.Mesh(new T.TorusGeometry(.09,.019,8,24),black);
      ring.position.set(side*.15,.04,.354);glasses.add(ring);
      ellipsoid(glasses,mat(0x4b3f72,.15),[side*.15,.04,.354],[.08,.08,.01]);
    }
    tube(glasses,[[-.07,.045,.355],[0,.075,.36],[.07,.045,.355]],.015,black);
    const bee=new T.Group();torso.add(bee);bee.visible=false;
    ellipsoid(bee,orange,[0,1.04,-.04],[.407,.445,.67]);
    for(const z of [-.4,0,.4]){
      const band=new T.Mesh(new T.TorusGeometry(.42,.052,8,28),black);
      band.position.set(0,1.04,z);band.scale.set(.99,1.06,1);bee.add(band);
    }
    for(const side of [-1,1])ellipsoid(bee,new T.MeshStandardMaterial({color:0xece3ff,transparent:true,opacity:.65,roughness:.3}),[side*.4,1.45,-.2],[.29,.06,.4]);
    const shoeMaterial=mat(0x6c59c1),shoes=[];
    legs.forEach(leg=>{const shoe=ellipsoid(leg.foot,shoeMaterial,[0,-.025,.01],[.163,.115,.22]);shoe.visible=false;shoes.push(shoe);});
    const skateboard=new T.Group();dog.add(skateboard);skateboard.visible=false;
    ellipsoid(skateboard,purple,[0,.055,0],[.46,.05,.95]);
    for(const x of [-.35,.35])for(const z of [-.62,.62]){
      const wheel=new T.Mesh(new T.CylinderGeometry(.07,.07,.09,12),orange);wheel.rotation.z=Math.PI/2;wheel.position.set(x,0,z);skateboard.add(wheel);
    }
    const ball=new T.Group();scene.add(ball);ball.position.set(-1.7,.14,.8);ball.visible=false;
    ellipsoid(ball,mat(0x8cba35),[0,0,0],[.14,.14,.14]);
    const bone=new T.Group();scene.add(bone);bone.position.set(-1.55,.07,1.05);bone.visible=false;
    ellipsoid(bone,cream,[0,0,0],[.23,.06,.075]);
    for(const x of [-.2,.2])for(const z of [-.05,.05])ellipsoid(bone,cream,[x,0,z],[.075,.065,.065]);
    let equipped={};
    function setEquipment(value){
      equipped=value||{};
      partyHat.visible=equipped.head==="hat";cap.visible=equipped.head==="cap";glasses.visible=!!equipped.eyes;bee.visible=!!equipped.body;
      shoes.forEach(shoe=>shoe.visible=!!equipped.feet);skateboard.visible=!!equipped.board;ball.visible=equipped.toy==="ball";bone.visible=equipped.toy==="bone";
    }
    // Cozy basket on the same ground plane.
    const basket=new T.Group();basket.position.set(1.25,0,-.85);scene.add(basket);
    ellipsoid(basket,wicker,[0,.16,0],[1.04,.2,.75]);
    ellipsoid(basket,cream,[0,.25,0],[.91,.12,.63]);
    const torusGeo=new T.TorusGeometry(.82,.075,8,64);
    for(let y=.14;y<.39;y+=.07){
      const hoop=new T.Mesh(torusGeo,wicker);hoop.rotation.x=Math.PI/2;hoop.scale.set(1.23,.87,1);hoop.position.y=y;hoop.castShadow=true;basket.add(hoop);
    }
    for(let i=0;i<36;i++){
      const a=i/36*Math.PI*2;
      tube(basket,[[Math.cos(a)*1.02,.12,Math.sin(a)*.72],[Math.cos(a)*1.02,.3,Math.sin(a)*.72],[Math.cos(a)*.96,.4,Math.sin(a)*.66]],.018,lightFur);
    }
    const biscuit=new T.Group();scene.add(biscuit);
    const biscuitMat=mat(0xb97836);
    ellipsoid(biscuit,biscuitMat,[0,0,0],[.13,.043,.075]);
    for(const x of [-.1,.1])for(const z of [-.05,.05])ellipsoid(biscuit,biscuitMat,[x,0,z],[.066,.044,.06]);
    biscuit.visible=false;
    const heartShape=new T.Shape();
    heartShape.moveTo(0,0);heartShape.bezierCurveTo(-.22,.16,-.2,.36,0,.23);heartShape.bezierCurveTo(.2,.36,.22,.16,0,0);
    const heartGeo=new T.ShapeGeometry(heartShape);
    const hearts=Array.from({length:5},()=>{const m=new T.Mesh(heartGeo,new T.MeshBasicMaterial({color:0xf52f6d,side:T.DoubleSide,transparent:true}));scene.add(m);m.visible=false;return m;});
    const floor=new T.Mesh(new T.CircleGeometry(4,64),mat(0xe6be8e));
    floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
    // A soft vignette grounds the scene without relying on CSS movement.
    const groundRing=new T.Mesh(new T.RingGeometry(3.85,4.02,64),mat(0xcf9f74));
    groundRing.rotation.x=-Math.PI/2;groundRing.position.y=.001;scene.add(groundRing);
    let state="wag",start=performance.now(),raf=0,disposed=false,paused=false,pausedAt=0;
    const smooth=(a,b,x)=>{const t=T.MathUtils.clamp(x,0,1);return a+(b-a)*t*t*(3-2*t);};
    function play(name){
      state=name;start=performance.now();paused=false;
      biscuit.visible=false;
      host.dataset.action=name;onChange(name);
      renderer.domElement.setAttribute("aria-label",({wag:"Marley logrer",smile:"Marley smiler",run:"Marley løber i cirkler",eat:"Marley spiser en godbid",bed:"Marley lægger sig i kurven",sleep:"Marley hviler i kurven"})[name]||"Marley");
    }
    function resize(){
      const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    }
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
    const worldPoint=new T.Vector3();
    function tick(now){
      if(disposed)return;
      raf=requestAnimationFrame(tick);
      if(paused){renderer.render(scene,camera);return;}
      const time=now*.001,elapsed=(now-start)*.001;
      dog.position.set(-.45,0,.1);dog.rotation.set(0,.12,0);
      torso.position.set(0,0,0);torso.rotation.set(0,0,0);
      neck.rotation.set(0,0,0);head.rotation.set(0,0,0);
      let run=0,lie=0,eating=0,happy=state==="smile"?1:.45;
      if(state==="run"){
        const enter=smooth(0,1,elapsed/.45);
        const angle=elapsed*1.9;
        dog.position.set(Math.sin(angle)*1.65,0,Math.cos(angle)*1.12-.18);
        dog.rotation.y=angle+Math.PI/2;run=enter;
        if(elapsed>7){play("wag");}
      }else if(state==="bed"||state==="sleep"){
        const step=state==="sleep"?1:T.MathUtils.clamp(elapsed/2,0,1);
        dog.position.x=smooth(-.45,1.25,step);dog.position.z=smooth(.1,-.85,step);
        dog.rotation.y=smooth(.12,-.35,step);
        run=step<1?Math.sin(step*Math.PI)*.55:0;
        lie=state==="sleep"?1:smooth(0,1,(elapsed-1.8)/1.3);
        if(state==="bed"&&elapsed>3.5){play("sleep");}
      }else if(state==="eat"){
        eating=smooth(0,1,elapsed/.8)*(1-smooth(0,1,(elapsed-3.2)/.75));
        biscuit.visible=elapsed<2.25;
        biscuit.position.set(-.4,.07,1.04);biscuit.scale.setScalar(1);
        if(elapsed>1.2){
          head.getWorldPosition(worldPoint);
          worldPoint.add(new T.Vector3(0,-.19,.25).applyAxisAngle(new T.Vector3(0,1,0),dog.rotation.y));
          biscuit.position.copy(worldPoint);biscuit.scale.setScalar(smooth(1,0,(elapsed-1.3)/1.0));
        }
        happy=.85;
        if(elapsed>4.1){biscuit.visible=false;play("wag");}
      }else {
        biscuit.visible=false;
        if(state==="smile"&&elapsed>2.6)play("wag");
      }
      // All joints share one gait phase; the spine, neck, ears and weight shift respond.
      const gait=time*10;
      const bounce=Math.abs(Math.sin(gait))*.09*run;
      if(equipped.board&&lie<.1)dog.position.y+=.12;
      torso.position.y=Math.sin(time*2.2)*.012+bounce-lie*.43-eating*.16;
      torso.rotation.x=Math.sin(gait*2)*.045*run+eating*.2;
      torso.rotation.z=Math.sin(time*5)*.018*(1-lie);
      neck.rotation.x=eating*.98+lie*.44;
      neck.position.y=1.37-lie*.17-eating*.6;
      neck.position.z=.54+eating*.22;
      head.rotation.x=Math.sin(gait)*.04*run+(eating>.75?Math.sin(time*14)*.04:0);
      head.rotation.z=Math.sin(time*2.8)*.035*(1-lie)+(state==="smile"?.12:0);
      for(const leg of legs){
        const phase=gait+(leg.side===1?Math.PI:0)+(leg.front?0:Math.PI);
        leg.hip.rotation.x=Math.sin(phase)*.72*run+lie*(leg.front?-1.6:1.6)+eating*(leg.front?-.3:.15);
        leg.shin.rotation.x=Math.max(0,-Math.sin(phase))*.9*run+lie*(leg.front?2.8:-2.8)+eating*(leg.front?.45:0);
        leg.hip.position.y=.815-lie*.04;
      }
      const wagSpeed=state==="smile"?11:7;
      tailRoot.rotation.set(-.22-lie*.35,Math.sin(time*wagSpeed)*.65*(1-lie*.8),Math.sin(time*wagSpeed)*.12);
      tails.forEach((part,i)=>{part.rotation.x=-.22+Math.sin(time*wagSpeed-i*.4)*.07;part.rotation.z=Math.sin(time*wagSpeed-i*.3)*.15*(1-lie*.7);});
      ears.forEach((ear,i)=>{ear.rotation.z=(i?1:-1)*(.06+Math.sin(gait-.5)*.13*run)+Math.sin(time*3+i)*.025;ear.rotation.x=-.05+run*Math.sin(gait)*.15+eating*.12;});
      const blink=(time%4.7)>4.52;
      eyes.forEach(eye=>eye.scale.y=lie>.9?.13:blink?.12:1);
      const chew=state==="eat"&&elapsed>1.2&&elapsed<3.2?Math.max(0,Math.sin(time*15)):.45+.15*Math.sin(time*3);
      mouth.scale.y=.65+happy*.45+chew*.55;
      mouthDark.scale.x=.125+happy*.024;
      tongue.visible=state!=="eat"&&lie<.6;
      jaw.position.y=-.105-chew*.022;
      if(lie>.6){mouth.scale.y=.25;tongue.visible=false;}
      head.getWorldPosition(worldPoint);
      hearts.forEach((heart,i)=>{
        const life=elapsed-2.1-i*.21;
        heart.visible=state==="eat"&&life>0&&life<1.8;
        if(heart.visible){heart.position.copy(worldPoint).add(new T.Vector3((i-2)*.24,life*.65+.2,.18));heart.quaternion.copy(camera.quaternion);heart.scale.setScalar(.8);heart.material.opacity=1-life/1.8;}
      });
      renderer.render(scene,camera);
    }
    raf=requestAnimationFrame(tick);
    return {
      play,
      setEquipment,
      pause(){if(paused){start+=performance.now()-pausedAt;paused=false;}else{pausedAt=performance.now();paused=true;}return paused;},
      getState(){return state;},
      destroy(){
        disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();
        const geometries=new Set(),materials=new Set();
        scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
        geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
        renderer.dispose();renderer.domElement.remove();
      }
    };
  }
  window.MarleyScene={create};
})();
