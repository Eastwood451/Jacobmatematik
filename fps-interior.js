import * as THREE from 'three';

// Seamless, locally generated surfaces: no image downloads during gameplay.
export function createSchoolInteriorMaterials(renderer) {
  let seed=1974;
  const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  function texture(width,height,draw) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    draw(canvas.getContext('2d'),width,height);
    const map=new THREE.CanvasTexture(canvas);
    map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  function bump(map) {
    const relief=map.clone();relief.colorSpace=THREE.NoColorSpace;relief.needsUpdate=true;
    return relief;
  }
  const bricks=texture(512,256,(ctx,w,h)=>{
    ctx.fillStyle='#8f8b7b';ctx.fillRect(0,0,w,h);
    for(let row=0;row<4;row++)for(let col=-1;col<4;col++){
      const x=col*128+(row%2)*64,y=row*64;
      const value=Math.floor(random()*23);
      ctx.fillStyle=`rgb(${179+value},${156+value},${109+value})`;
      ctx.fillRect(x+4,y+4,120,56);
      ctx.fillStyle='rgba(248,233,181,.28)';ctx.fillRect(x+5,y+4,118,2);
      ctx.fillStyle='rgba(62,52,31,.25)';ctx.fillRect(x+4,y+58,120,2);
      for(let i=0;i<190;i++){
        ctx.fillStyle=random()>.5?'rgba(65,54,35,.16)':'rgba(255,236,185,.2)';
        ctx.fillRect(x+6+random()*115,y+7+random()*47,1+random()*5,1+random()*2);
      }
    }
  });
  // Preserve every brick, joint and grain while neutralising the old ochre colour.
  const paintedBricks=texture(512,256,(ctx,w,h)=>{
    ctx.drawImage(bricks.image,0,0);
    const pixels=ctx.getImageData(0,0,w,h);
    for(let i=0;i<pixels.data.length;i+=4){
      const grey=110+.55*(.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2]);
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=grey;
    }
    ctx.putImageData(pixels,0,0);
  });
  const linoleum=texture(768,768,(ctx,w,h)=>{
    ctx.fillStyle='#7d887c';ctx.fillRect(0,0,w,h);
    // Pigment flecks and fine, stretched marbling, rather than floor tiles.
    for(let i=0;i<23000;i++){
      const x=random()*w,y=random()*h;
      ctx.fillStyle=['rgba(202,207,179,.23)','rgba(43,63,54,.18)','rgba(228,224,190,.17)'][i%3];
      ctx.beginPath();ctx.ellipse(x,y,.5+random()*2,.4+random()*5,-.45,0,Math.PI*2);ctx.fill();
    }
    for(let i=0;i<90;i++){
      const x=random()*w,y=random()*h;
      ctx.strokeStyle='rgba(48,60,51,.1)';ctx.lineWidth=.6+random();
      ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+4,y+14,x-8,y+23,x-10,y+45);ctx.stroke();
    }
    // One understated welded seam between broad sheets of linoleum.
    ctx.fillStyle='rgba(42,58,48,.28)';ctx.fillRect(0,0,2,h);
    ctx.fillStyle='rgba(207,212,187,.12)';ctx.fillRect(2,0,1,h);
  });
  const acoustic=texture(512,512,(ctx,w,h)=>{
    ctx.fillStyle='#d9d6c7';ctx.fillRect(0,0,w,h);
    for(let i=0;i<12500;i++){
      ctx.fillStyle=random()>.5?'rgba(255,255,242,.18)':'rgba(92,91,79,.08)';
      ctx.fillRect(random()*w,random()*h,1,1);
    }
    // Four 60 × 60 cm perforated acoustic panels per texture tile.
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){
      const x=col*256,y=row*256;
      ctx.fillStyle='rgba(255,252,231,.11)';ctx.fillRect(x+4,y+4,248,248);
      for(let hy=18;hy<248;hy+=18)for(let hx=18;hx<248;hx+=18){
        ctx.fillStyle='#aaa89b';ctx.beginPath();ctx.arc(x+hx,y+hy,2.2,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#797b72';ctx.beginPath();ctx.arc(x+hx,y+hy-1,1.15,0,Math.PI*2);ctx.fill();
      }
      // Recessed joints and slim painted suspension grid.
      ctx.fillStyle='#888d87';ctx.fillRect(x,y,256,3);ctx.fillRect(x,y,3,256);
      ctx.fillStyle='#ece9db';ctx.fillRect(x+3,y+3,253,3);ctx.fillRect(x+3,y+3,3,253);
    }
  });
  const wall=new THREE.MeshStandardMaterial({map:paintedBricks,bumpMap:bump(bricks),bumpScale:.028,roughness:.94});
  const floor=new THREE.MeshStandardMaterial({map:linoleum,bumpMap:bump(linoleum),bumpScale:.006,roughness:.66});
  const ceiling=new THREE.MeshStandardMaterial({map:acoustic,bumpMap:bump(acoustic),bumpScale:.012,roughness:.95,emissive:0x8b897c,emissiveIntensity:.12});
  wall.userData.tileSize=[1.2,.6];
  floor.userData.tileSize=[3,3];
  ceiling.userData.tileSize=[1.2,1.2];
  const wallColours=[0xf4dbc7,0xd9ebfa,0xddefcc,0xf4e9b5,0xe6dcf4,0xd5eeee];
  const paintedWalls=wallColours.map(colour=>{const material=wall.clone();material.color.setHex(colour);return material;});
  const wallFor=(x,z)=>paintedWalls[(x < -8 ? 0 : x > 8 ? 2 : 1)+(z>0?3:0)];
  return {wall,floor,ceiling,wallFor};
}

// Map each box face in metres. A short partition and a long corridor wall
// therefore have identical brick sizes, including their end faces.
export function applySchoolSurfaceUV(geometry,material,origin) {
  const size=material.userData.tileSize;
  if(!size)return;
  const position=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i)+origin.x,y=position.getY(i)+origin.y,z=position.getZ(i)+origin.z;
    const horizontal=Math.abs(normal.getY(i))>.5;
    const u=Math.abs(normal.getX(i))>.5?z:x;
    uv.setXY(i,u/size[0],(horizontal?z:y)/size[1]);
  }
  uv.needsUpdate=true;
}
