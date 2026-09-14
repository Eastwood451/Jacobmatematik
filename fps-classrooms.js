import * as THREE from 'three';

// Face is the direction pupils look along Z. Keep the existing masonry/ducts.
export const CLASSROOMS = [
  {name:'Talværkstedet',xs:[-22,-18.3,-14.6,-10.9,-7.2],zs:[-21.7],face:-1,board:[-16,-26.65],teacher:[-16,-25],shelves:[[-24, -26.25,0]],papers:[[-20,-24],[-12,-20.8]]},
  {name:'Gangeklubben',xs:[-17,-13,-9],zs:[-14,-10.5,-7,-3.5],face:1,board:[-13,.78],teacher:[-13,-1.3],shelves:[[-19.5,-11,Math.PI/2],[-19.5,-7,Math.PI/2]],papers:[[-15,-8.5],[-10,-1.5]]},
  {name:'Brøklaboratoriet',xs:[12.7,16,19.3],zs:[-17,-13.5,-10],face:1,board:[15,-4.23],teacher:[15,-6],shelves:[[21.5,-10,-Math.PI/2],[21.5,-13,-Math.PI/2]],papers:[[14,-15],[18,-7.5]]},
  {name:'Geometrirummet',xs:[-18,-13.5,-9],zs:[6.5,10,13.5,17],face:-1,board:[-13.5,1.23],teacher:[-13.5,3.1],shelves:[[-20.5,8,Math.PI/2],[-20.5,12,Math.PI/2]],papers:[[-16,8],[-11,15.5]]},
  {name:'Regnedetektiverne',xs:[11.6,15,18.4],zs:[0,3.5,7],face:1,board:[15,12.78],teacher:[15,10.7],shelves:[[20.5,8,-Math.PI/2]],papers:[[13,5],[17,9]]},
  {name:'Matematik 5',xs:[8,12,16,20,24],zs:[18,21.5],face:1,board:[17,26.65],teacher:[17,24.8],shelves:[[7,26.25,Math.PI],[24,26.25,Math.PI]],papers:[[10,20],[21.5,24]]},
  {name:'Matematik 7',xs:[8,12,16,20,24],zs:[-23.1],face:-1,board:[17,-26.65],teacher:[17,-25.5],shelves:[[7,-26.25,0],[24,-26.25,0]],papers:[[14,-24],[22,-21]]},
  {name:'Øverummet',xs:[-22,-18,-14,-10],zs:[23.2],face:1,board:[-16,26.65],teacher:[-16,25.5],shelves:[[-24,26.25,Math.PI]],papers:[[-20,24.4],[-12,21.2]]},
];

// Simple, full furniture footprints avoid enemies entering the spaces under seats.
// The same footprints are used by solo, co-op, player movement and route tests.
export function classroomObstacles() {
  const result=[];
  const add=(x,z,w,d,h,kind)=>result.push({min:{x:x-w/2,y:0,z:z-d/2},max:{x:x+w/2,y:h,z:z+d/2},kind});
  for(const room of CLASSROOMS){
    for(const x of room.xs)for(const z of room.zs){
      add(x,z,1.8,1.05,.88,'desk');
      add(x,z-room.face*1.05,.62,.65,1.02,'chair');
    }
    add(...room.teacher,2.6,1.15,.94,'teacher');
    for(const [x,z,rotation] of room.shelves){
      const side=Math.abs(Math.sin(rotation))>.5;
      add(x,z,side?.48:2.4,side?2.4:.48,2.35,'shelf');
    }
  }
  return result;
}

export function buildClassrooms({scene,colliders,renderer}) {
  const group=new THREE.Group();group.name='Indrettede klasseværelser';scene.add(group);
  const batches=new Map(),dummy=new THREE.Object3D();
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:.78});
  const wood=material(0xd6af76),edge=material(0x997345),steel=material(0x546368);
  const seats=[material(0x387c88),material(0xbb8b33),material(0x6f8c64)];
  const shelfWood=material(0xb89362),paper=material(0xfffaf0),ink=material(0x26353e);
  const books=[0xc44843,0x318196,0xe2b73f,0x567953,0x7f66a3,0xe6d6b5].map(material);
  const red=material(0xdd2526),stem=material(0x62452d),leaf=material(0x4c8d38);
  const boxGeometry=new THREE.BoxGeometry(1,1,1),sphereGeometry=new THREE.SphereGeometry(1,12,8);
  function part(x,y,z,w,h,d,mat,rotation=0,sphere=false){
    const key=mat.uuid+(sphere?'sphere':'box');
    if(!batches.has(key))batches.set(key,{mat,sphere,matrices:[]});
    dummy.position.set(x,y,z);dummy.rotation.set(0,rotation,0);dummy.scale.set(w,h,d);dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function texture(width,height,draw){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    draw(canvas.getContext('2d'),width,height);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return map;
  }
  const noteMap=texture(384,512,(ctx,w,h)=>{
    ctx.fillStyle='#fffdf1';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#cbd8e6';ctx.lineWidth=2;
    for(let y=85;y<h;y+=37){ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(w-20,y);ctx.stroke();}
    ctx.strokeStyle='#e5a8a8';ctx.beginPath();ctx.moveTo(49,0);ctx.lineTo(49,h);ctx.stroke();
    ctx.fillStyle='#36517a';ctx.font='bold 27px sans-serif';ctx.fillText('Mine noter',65,54);
    ctx.font='25px cursive';['7 × 8 = 56','56 : 7 = 8','1/2 + 1/4 = 3/4','A = længde × bredde'].forEach((line,i)=>ctx.fillText(line,65,114+i*74));
    ctx.strokeStyle='#36517a';ctx.strokeRect(89,369,157,85);
    ctx.fillStyle='#bf5652';ctx.font='23px cursive';ctx.fillText('Husk enheder!',70,494);
  });
  const noteMaterial=new THREE.MeshStandardMaterial({map:noteMap,roughness:1,side:THREE.DoubleSide});
  function note(x,y,z,rotation=0,scale=1){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.42*scale,.56*scale),noteMaterial);
    mesh.rotation.set(-Math.PI/2,0,rotation);mesh.position.set(x,y,z);mesh.name='Løst noteark';group.add(mesh);
  }
  function desk(x,z,face,seatMat){
    part(x,.835,z,1.8,.09,1.05,wood);part(x,.77,z,1.84,.035,1.08,edge);
    for(const dx of [-.74,.74])for(const dz of [-.39,.39])part(x+dx,.38,z+dz,.055,.76,.055,steel);
    for(const dx of [-.74,.74])part(x+dx,.7,z,.055,.07,.85,steel);
    const cz=z-face*1.05;
    part(x,.465,cz,.62,.07,.59,seatMat);
    for(const dx of [-.25,.25])for(const dz of [-.24,.24])part(x+dx,.23,cz+dz,.045,.46,.045,steel);
    for(const dx of [-.25,.25])part(x+dx,.72,cz-face*.27,.045,.54,.045,steel);
    part(x,.85,cz-face*.28,.62,.3,.07,seatMat);
  }
  function shelf(x,z,rotation,seed){
    const local=(u,y,v,w,h,d,mat)=>part(x+Math.cos(rotation)*u+Math.sin(rotation)*v,y,z-Math.sin(rotation)*u+Math.cos(rotation)*v,w,h,d,mat,rotation);
    local(0,1.175,-.215,2.4,2.35,.05,shelfWood);
    for(const u of [-1.15,1.15])local(u,1.175,0,.1,2.35,.48,shelfWood);
    for(const y of [.08,.63,1.18,1.73,2.3])local(0,y,0,2.4,.075,.48,shelfWood);
    for(let row=0;row<4;row++)for(let i=0;i<10;i++){
      const binder=(i+seed+row)%3===0,u=-1.015+i*.218,h=binder?.43:.31+((i*7+row+seed)%4)*.035;
      const y=.12+row*.55+h/2;
      local(u,y,.005,.17,h,.34,books[(i+row+seed)%books.length]);
      if(binder){
        local(u,y+.055,.181,.105,.16,.009,paper);
        local(u,y+.06,.188,.065,.012,.008,ink);
        local(u,y-.12,.183,.043,.043,.009,ink);
      }else local(u,y+h*.3,.181,.14,.015,.008,paper);
    }
  }
  function board(room,index){
    const map=texture(1536,640,(ctx,w,h)=>{
      ctx.fillStyle='#fafcf7';ctx.fillRect(0,0,w,h);
      // Faint rubbed-out marker strokes give the board a used surface.
      ctx.strokeStyle='rgba(110,125,113,.055)';ctx.lineWidth=24;
      for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(90,140+i*64);ctx.lineTo(1390,125+i*64);ctx.stroke();}
      ctx.fillStyle='#245a68';ctx.font='bold 60px sans-serif';ctx.fillText(room.name,64,85);
      ctx.strokeStyle='#d19b30';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(62,111);ctx.lineTo(1460,111);ctx.stroke();
      ctx.fillStyle='#243955';ctx.font='45px cursive';
      const sets=[['Dagens plan','1. Opvarmning: den lille tabel','2. Vis din udregning','3. Forklar det til din makker'],['Brøker og hele','1/2 + 1/4 = 3/4','3/4 af 20 = 15','Tegn først. Regn bagefter.'],['Areal og omkreds','A = længde × bredde','O = 2 × længde + 2 × bredde','Husk: cm eller cm²?']];
      sets[index%3].forEach((line,i)=>ctx.fillText(line,66,184+i*99));
      ctx.strokeStyle='#347e68';ctx.lineWidth=6;ctx.strokeRect(1030,199,345,209);
      ctx.beginPath();ctx.moveTo(1202,199);ctx.lineTo(1202,408);ctx.moveTo(1030,303);ctx.lineTo(1375,303);ctx.stroke();
      ctx.fillStyle='#add2b8';ctx.fillRect(1035,204,162,94);ctx.fillRect(1207,204,162,94);ctx.fillRect(1035,308,162,94);
      ctx.fillStyle='#b54c44';ctx.font='48px cursive';ctx.fillText('3/4',1152,474);
      ctx.font='32px cursive';ctx.fillText('Alle kan lære matematik!',66,586);
    });
    const [x,z]=room.board,rotation=room.face===1?Math.PI:0;
    part(x,2.12,z,5.5,2.32,.08,steel);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(5.32,2.15),new THREE.MeshStandardMaterial({map,roughness:.55}));
    mesh.name=`Whiteboard · ${room.name}`;mesh.position.set(x,2.12,z-room.face*.047);mesh.rotation.y=rotation;group.add(mesh);
    part(x,.93,z-room.face*.15,5.45,.06,.25,steel);
    for(let i=0;i<3;i++)part(x-1+i*.4,.98,z-room.face*.13,.25,.035,.04,books[i]);
  }
  CLASSROOMS.forEach((room,index)=>{
    for(const x of room.xs)for(const z of room.zs)desk(x,z,room.face,seats[index%seats.length]);
    board(room,index);
    const [x,z]=room.teacher;
    part(x,.895,z,2.6,.09,1.15,wood);
    for(const dx of [-1.13,1.13])for(const dz of [-.43,.43])part(x+dx,.435,z+dz,.075,.87,.075,steel);
    part(x,.56,z+room.face*.4,2.35,.53,.065,wood);
    // Red apple, stem and green leaf on every teacher's desk.
    part(x+.82,1.115,z,.165,.185,.165,red,0,true);
    part(x+.82,1.3,z,.028,.09,.028,stem);
    part(x+.88,1.307,z,.09,.018,.04,leaf,.5,true);
    note(x-.5,.946,z,.16);
    for(const [sx,sz,rotation] of room.shelves)shelf(sx,sz,rotation,index);
    room.papers.forEach(([px,pz],i)=>note(px,.012+i*.001,pz,(index+i)*.64,1.35));
    note(room.xs[0],.886,room.zs[0],-.2);
  });
  // Hundreds of chair legs and book spines use a small number of draw calls.
  for(const {mat,sphere,matrices} of batches.values()){
    const mesh=new THREE.InstancedMesh(sphere?sphereGeometry:boxGeometry,mat,matrices.length);
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.computeBoundingSphere();group.add(mesh);
  }
  for(const b of classroomObstacles())colliders.push(new THREE.Box3(new THREE.Vector3(b.min.x,b.min.y,b.min.z),new THREE.Vector3(b.max.x,b.max.y,b.max.z)));
  return group;
}
