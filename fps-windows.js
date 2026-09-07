import * as THREE from 'three';
import { createSpriteRig } from './fps-visuals.js?v=20260907-sprites1';

// Decorative exterior, isolated from the game and multiplayer rules.
export function createSchoolWindows({ scene, box, wallMaterial, wallHeight = 3.7 }) {
  const x = 27, width = 7, sill = .65, top = 3.35;
  const centers = [-16, 0, 16];
  const frameMaterial = new THREE.MeshStandardMaterial({ color:0x375d67, roughness:.55 });
  const sillMaterial = new THREE.MeshStandardMaterial({ color:0xf7ecd2, roughness:.75 });
  const glassMaterial = new THREE.MeshBasicMaterial({
    color:0xc5edff, transparent:true, opacity:.045, depthWrite:false,
  });
  let edge = -27;
  for (const z of centers) {
    const start = z - width/2, end = z + width/2;
    box(x,wallHeight/2,(edge+start)/2,.45,wallHeight,start-edge,wallMaterial);
    box(x,sill/2,z,.45,sill,width,wallMaterial);
    box(x,(top+wallHeight)/2,z,.45,wallHeight-top,width,wallMaterial);
    // Glass retains the original solid boundary, including for pencils/enemies.
    const glass = box(x,(sill+top)/2,z,.025,top-sill,width,glassMaterial);
    glass.castShadow = false;
    for (const side of [-1,1]) box(x-.04,(sill+top)/2,z+side*width/2,.57,top-sill+.16,.12,frameMaterial,false);
    for (const y of [sill,top]) box(x-.04,y,z,.57,.12,width+.12,frameMaterial,false);
    // Narrow side panes leave an uninterrupted view of each character.
    for (const side of [-1,1]) box(x-.06,(sill+top)/2,z+side*2.35,.13,top-sill,.07,frameMaterial,false);
    box(x-.16,sill-.04,z,.92,.14,width+.28,sillMaterial,false);
    edge = end;
  }
  box(x,wallHeight/2,(edge+27)/2,.45,wallHeight,27-edge,wallMaterial);

  const exterior = new THREE.Group();
  exterior.name = 'Vinduesudsigt med træer og matematikhelte';
  scene.add(exterior);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(44,100),new THREE.MeshStandardMaterial({color:0x709856,roughness:1}));
  lawn.rotation.x = -Math.PI/2;
  lawn.position.set(49,-.03,0);
  lawn.receiveShadow = true;
  exterior.add(lawn);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3.5,62),new THREE.MeshStandardMaterial({color:0xd4c2a1,roughness:1}));
  path.rotation.x = -Math.PI/2;
  path.position.set(30,.005,0);
  exterior.add(path);
  const trunkMaterial = new THREE.MeshStandardMaterial({color:0x78533b,roughness:1});
  const leafMaterials = [0x507c40,0x649044,0x3d6b3d].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  const trunkGeometry = new THREE.CylinderGeometry(.18,.3,3.3,7);
  const crownGeometry = new THREE.IcosahedronGeometry(1.8,1);
  const crowns = [];
  for (let i=0;i<18;i++) {
    const tree = new THREE.Group();
    tree.position.set(36+(i%3)*6,0,-33+i*4);
    tree.scale.setScalar(.8+(i%4)*.13);
    const trunk = new THREE.Mesh(trunkGeometry,trunkMaterial);
    trunk.position.y = 1.65; trunk.castShadow = true;
    tree.add(trunk);
    const crown = new THREE.Mesh(crownGeometry,leafMaterials[i%3]);
    crown.position.y = 3.8; crown.scale.set(1,1.3,.9); crown.castShadow = true;
    tree.add(crown); crowns.push(crown);
    exterior.add(tree);
  }

  const heroes = [];
  const ready = Promise.allSettled([
    addHero('kaptajn-vindue-flex.png',-16,'Kaptajn Kvadratrod',true),
    addHero('luigi-vindue-54-63.png',16,'Luigi · 54 og 63',false),
  ]);
  async function addHero(file,z,name,flex) {
    try {
      const source = await new THREE.TextureLoader().loadAsync(`assets/figurer/${file}`);
      const texture = spriteTexture(source.image);
      source.dispose();
      const rig = createSpriteRig(texture,{
        width:2.6,height:3.9,bodyY:1.95,
        joints:{head:[.5,.88],leftArm:[.35,.80],rightArm:[.65,.80],leftLeg:[.42,.30],rightLeg:[.58,.30]},
        skinWeights(u,v,ease) {
          if (!flex) return null;
          if (v>.74 && u<.39) return {bone:2,weight:(1-ease(u,.30,.39))*ease(v,.74,.82)};
          if (v>.74 && u>.61) return {bone:3,weight:ease(u,.61,.70)*ease(v,.74,.82)};
          return null;
        },
      });
      rig.group.name = name;
      rig.group.position.set(31,0,z);
      rig.group.rotation.y = -Math.PI/2;
      exterior.add(rig.group);
      heroes.push({rig,flex});
    } catch (error) {
      console.warn(`Figuren ved vinduet kunne ikke indlæses: ${name}`,error);
      throw error;
    }
  }
  return {
    ready,
    update(time) {
      const t = time*.001;
      for (const {rig,flex} of heroes) {
        if (flex) {
          const squeeze = .5+.5*Math.sin(t*2.7);
          rig.leftArm.rotation.z = -.08-squeeze*.10;
          rig.rightArm.rotation.z = .08+squeeze*.10;
          rig.body.scale.x = 1+squeeze*.025;
        } else rig.group.rotation.z = Math.sin(t*1.5)*.012;
      }
      crowns.forEach((c,i)=>c.rotation.z=Math.sin(t*.8+i)*.025);
    },
  };
}

function spriteTexture(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0);
  const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
  const data = pixels.data, w = canvas.width, h = canvas.height;
  // Some source sprites include an opaque light checkerboard. Remove only
  // edge-connected neutral background, preserving enclosed whites in clothing.
  const seen = new Uint8Array(w*h), queue = new Int32Array(w*h);
  let head = 0, tail = 0;
  function push(i) {
    if (seen[i]) return;
    const p=i*4, lo=Math.min(data[p],data[p+1],data[p+2]), hi=Math.max(data[p],data[p+1],data[p+2]);
    if (data[p+3]>0 && (lo<211 || hi-lo>25)) return;
    seen[i]=1; queue[tail++]=i;
  }
  for (let xx=0;xx<w;xx++) { push(xx); push((h-1)*w+xx); }
  for (let yy=0;yy<h;yy++) { push(yy*w); push(yy*w+w-1); }
  while (head<tail) {
    const i=queue[head++], xx=i%w;
    data[i*4+3]=0;
    if(xx>0) push(i-1); if(xx<w-1) push(i+1);
    if(i>=w) push(i-w); if(i<w*(h-1)) push(i+w);
  }
  ctx.putImageData(pixels,0,0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
