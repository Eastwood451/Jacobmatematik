const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('three');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const {createEnemyNavigator}=vm.runInNewContext(read('fps-navigation.js').replaceAll('export ','')+'\n({createEnemyNavigator})');

// Execute the production room/desk/locker definitions and window/duct masonry.
// Decorative window scenery and rendering are omitted; every solid box is captured.
function school() {
  const boxes=[];
  const box=(x,y,z,w,h,d,material,solid=true)=>{
    if(solid)boxes.push({min:{x:x-w/2,y:y-h/2,z:z-d/2},max:{x:x+w/2,y:y+h/2,z:z+d/2}});
    return {};
  };
  const ducts=vm.runInNewContext(read('fps-ducts.js').replaceAll('export ','')+'\n({createDuctBuilder})');
  const windows=read('fps-windows.js');
  const windowMasonry=windows.slice(windows.indexOf('export function createSchoolWindows'),windows.indexOf('  const exterior =')).replace('export ','')+'\nreturn {}; }\ncreateSchoolWindows';
  const createSchoolWindows=vm.runInNewContext(windowMasonry,{THREE});
  const code=read('fps.js');
  vm.runInNewContext(code.slice(code.indexOf('box(0, -.12'),code.indexOf('const fixtureMat')),
    {box,WORLD:54,WALL_H:4.2,scene:{},renderer:{},floorMat:{},wallMat:{},trimMat:{},deskMat:{},lockerMat:{},interiorMaterials:{ceiling:{}},mat:()=>({}),createSchoolWindows,...ducts});
  const blocked=(x,z)=>boxes.some(c=>c.min.y<1.8&&c.max.y>.05&&x+.5>=c.min.x&&x-.5<=c.max.x&&z+.5>=c.min.z&&z-.5<=c.max.z);
  return {boxes,blocked,navigator:createEnemyNavigator({blocked})};
}
function travel(navigator,blocked,start,target,position={...start}) {
  for(let step=0;step<1800;step++) {
    if(Math.hypot(position.x-target.x,position.z-target.z)<.16)return step;
    navigator.move(position,target,.135);
    assert.equal(blocked(position.x,position.z),false,'Enemy crossed a solid obstacle');
  }
  assert.fail(`Enemy stuck from ${JSON.stringify(start)} to ${JSON.stringify(target)} at ${JSON.stringify(position)}`);
}

test('route leaves a U-shaped dead end and cannot cut through corners',()=>{
  const blocked=(x,z)=>(x>=-4&&x<=4&&z>=-4&&z<=-3)||(Math.abs(x)>=3&&Math.abs(x)<=4&&z>=-4&&z<=4);
  const nav=createEnemyNavigator({blocked,min:-8,max:8});
  travel(nav,blocked,{x:0,z:0},{x:0,z:-7});
});

test('school rooms, wall corners and all spawn regions connect to the central corridor',()=>{
  const {blocked,navigator}=school(),center={x:0,z:18};
  let checks=0;
  for(let z=-25;z<=25;z+=2)for(let x=-25;x<=25;x+=2)if(!blocked(x,z)){
    assert.equal(navigator.reachable({x,z},center),true,`Disconnected room/corner at ${x},${z}`);
    travel(navigator,blocked,{x,z},center);checks++;
  }
  const regions=[[-21,-22],[20,-22],[-20,22],[20,22],[0,-23],[0,23],[-23,0],[23,0],[-7,-22],[8,22]];
  for(const [x,z] of regions){
    const safe=navigator.spawnNear({x,z},center);
    assert.ok(safe);assert.equal(blocked(safe.x,safe.z),false);
    travel(navigator,blocked,safe,center);
  }
  console.log(`Checked ${checks} free school positions and ${regions.length} spawn routes.`);
});

test('Erling navigates between classrooms, around desks and lockers, and follows a moving target',()=>{
  const {blocked,navigator}=school();
  const rooms=[[-23,-24],[23,-24],[-23,24],[23,24],[-23,0],[23,0],[-7,-22],[8,22],[0,-23],[0,23]];
  for(let i=0;i<rooms.length;i++){
    const target={x:rooms[(i+3)%rooms.length][0],z:rooms[(i+3)%rooms.length][1]};
    const start=navigator.spawnNear({x:rooms[i][0],z:rooms[i][1]},target);
    assert.equal(blocked(target.x,target.z),false);
    travel(navigator,blocked,start,target);
  }
  const p={x:0,z:18};navigator.move(p,{x:-23,z:-24},.135);
  travel(navigator,blocked,{...p},{x:23,z:24},p);
});

test('Erling stays at a target between grid points and resumes when it moves',()=>{
  const blocked=()=>false,navigator=createEnemyNavigator({blocked,min:-4,max:4});
  const p={x:-2,z:-2},target={x:1.17,z:1.13};
  for(let i=0;i<200;i++)navigator.move(p,target,.135);
  assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.0001);
  for(let i=0;i<20;i++){
    navigator.move(p,target,.135);
    assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.0001,'Enemy oscillates near target');
  }
  travel(navigator,blocked,{...p},{x:-2.3,z:2.17},p);
});
