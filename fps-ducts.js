import * as THREE from 'three';

export const DUCT_WIDTH=1.6;
export const DUCT_HEIGHT=1.2;
export const DUCT_LENGTH=3.5;

export function createDuctBuilder({box,wallMaterial,wallHeight,renderer}) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#7e9398';ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=4){ctx.fillStyle=y%8===0?'rgba(218,235,231,.09)':'rgba(22,44,52,.07)';ctx.fillRect(0,y,256,1);}
  ctx.strokeStyle='#a7b8b7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(256,256);ctx.moveTo(256,0);ctx.lineTo(0,256);ctx.stroke();
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const metal=new THREE.MeshStandardMaterial({map,color:0xb8c6c5,metalness:.35,roughness:.65,emissive:0x56666b,emissiveIntensity:.17});
  const rim=new THREE.MeshStandardMaterial({color:0x536b74,metalness:.45,roughness:.6});
  // A modest fill in the material keeps tunnels readable without extra lights.
  function partition(x,z,w,d,hasDuct=false) {
    if(!hasDuct){box(x,wallHeight/2,z,w,wallHeight,d,wallMaterial,true);return;}
    const alongX=w>d,span=alongX?w:d,side=(span-DUCT_WIDTH)/2;
    function part(u,y,v,width,height,depth,material,solid=true){
      return box(x+(alongX?u:v),y,z+(alongX?v:u),alongX?width:depth,height,alongX?depth:width,material,solid);
    }
    const thickness=alongX?d:w;
    // Build the masonry around a real opening; no invisible wall remains inside.
    for(const sign of [-1,1])part(sign*(DUCT_WIDTH+side)/2,wallHeight/2,0,side,wallHeight,thickness,wallMaterial);
    part(0,(wallHeight+DUCT_HEIGHT)/2,0,DUCT_WIDTH,wallHeight-DUCT_HEIGHT,thickness,wallMaterial);
    for(const sign of [-1,1])part(sign*(DUCT_WIDTH/2+.06),DUCT_HEIGHT/2,0,.12,DUCT_HEIGHT,DUCT_LENGTH,metal);
    part(0,DUCT_HEIGHT+.06,0,DUCT_WIDTH+.24,.12,DUCT_LENGTH,metal);
    part(0,.008,0,DUCT_WIDTH,.016,DUCT_LENGTH,metal,false);
    // Open flanged mouths and reinforcing ribs make the low passage legible.
    for(const v of [-DUCT_LENGTH/2,-.6,.6,DUCT_LENGTH/2]){
      for(const sign of [-1,1])part(sign*(DUCT_WIDTH/2+.03),DUCT_HEIGHT/2,v,.06,DUCT_HEIGHT,.09,rim);
      part(0,DUCT_HEIGHT+.035,v,DUCT_WIDTH+.12,.07,.09,rim);
    }
    // Small yellow Ctrl signs on both mouths, without blocking the opening.
    const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=64;
    const labelCtx=labelCanvas.getContext('2d');labelCtx.fillStyle='#e7c86b';labelCtx.fillRect(0,0,256,64);
    labelCtx.fillStyle='#20303a';labelCtx.font='bold 38px sans-serif';labelCtx.textAlign='center';labelCtx.textBaseline='middle';labelCtx.fillText('CTRL  ↓',128,32);
    const labelMap=new THREE.CanvasTexture(labelCanvas);labelMap.colorSpace=THREE.SRGBColorSpace;
    const labelMat=new THREE.MeshBasicMaterial({map:labelMap});
    for(const sign of [-1,1]){
      const signMesh=part(0,DUCT_HEIGHT+.2,sign*(DUCT_LENGTH/2+.05),.65,.17,.015,labelMat,false);
      // Box-face UVs show a readable label from either end of either wall axis.
      signMesh.castShadow=false;
    }
  }
  return partition;
}
