import * as THREE from 'three';

const WIDTH = 2.1, HEIGHT = 3.6;
const smooth = THREE.MathUtils.smoothstep;

// A small skeletal rig keeps the original drawing: the head and limbs pivot
// around joints, with blending only at the neck, shoulders and hips.
export function createErlingRig(texture, phase = Math.random() * Math.PI * 2) {
  const geometry = new THREE.PlaneGeometry(WIDTH, HEIGHT, 40, 64);
  const indices = [], weights = [], uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    let bone = 0, weight = 0;
    if (v > .59) {
      bone = 1; weight = smooth(v, .59, .67);
    } else if (v < .34) {
      bone = u < .49 ? 4 : 5;
      weight = (1 - smooth(v, .26, .34)) * smooth(Math.abs(u - .49), 0, .035);
    } else if (v > .40 && v < .62) {
      // Follow the arm/vest outlines, keeping the belly out of the arm weights.
      const leftEdge = .325 + Math.max(0, v - .45) * .26;
      const shoulder = 1 - smooth(v, .58, .62);
      if (u < leftEdge) {
        bone = 2;
        weight = (1 - smooth(u, leftEdge - .018, leftEdge)) * smooth(v, .415, .44) * shoulder;
      }
      const rightEdge = v < .50 ? .57 + Math.abs(v - .477) * 1.4 : .62;
      if (u > rightEdge && v > .445) {
        bone = 3;
        weight = smooth(u, rightEdge, rightEdge + .018) * smooth(v, .445, .47) * shoulder;
      }
    }
    indices.push(0, bone, 0, 0);
    weights.push(1 - weight, weight, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, alphaTest: .08, side: THREE.DoubleSide,
    toneMapped: false,
  });
  const body = new THREE.SkinnedMesh(geometry, material);
  const root = new THREE.Bone();
  const joint = (u, v) => {
    const bone = new THREE.Bone();
    bone.position.set((u - .5) * WIDTH, (v - .5) * HEIGHT, 0);
    root.add(bone);
    return bone;
  };
  const head = joint(.49, .62), leftArm = joint(.37, .59), rightArm = joint(.62, .59);
  const leftLeg = joint(.42, .30), rightLeg = joint(.55, .30);
  body.add(root);
  body.bind(new THREE.Skeleton([root, head, leftArm, rightArm, leftLeg, rightLeg]));
  body.position.y = 1.39; // The illustration includes blank space below the shoes.
  body.frustumCulled = false;
  const group = new THREE.Group();
  group.add(body);
  return { group, body, head, leftArm, rightArm, leftLeg, rightLeg, phase, stride: 0 };
}

export function animateErling(enemy, dt, time, distanceMoved) {
  // Feet stop marching when a wall blocks him. Head and arms remain restless.
  enemy.stride += distanceMoved * 6;
  const walking = Math.min(1, distanceMoved / Math.max(dt * 1.1, .001));
  const step = Math.sin(enemy.stride + enemy.phase) * walking;
  const idle = Math.sin(time * .0018 + enemy.phase);
  enemy.leftLeg.rotation.z = step * .17;
  enemy.rightLeg.rotation.z = -step * .17;
  enemy.leftLeg.position.y = -.72 + Math.max(0, step) * .10;
  enemy.rightLeg.position.y = -.72 + Math.max(0, -step) * .10;
  enemy.leftArm.rotation.z = -.03 + step * .16 + idle * .04;
  enemy.rightArm.rotation.z = .03 - step * .14 - idle * .04;
  enemy.head.rotation.z = idle * .075 + step * .025;
  enemy.head.rotation.y = Math.sin(time * .0013 + enemy.phase) * .12;
  enemy.body.position.y = 1.39 + Math.abs(step) * .025;
}

export function disposeErlingRig(enemy) {
  enemy.body.geometry.dispose();
  enemy.body.material.dispose();
  enemy.body.skeleton.dispose();
  // The image texture is shared by every enemy and remains alive for respawns.
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}

function lettering(ctx, text, x, y, size, color, maxWidth) {
  ctx.font = `900 ${size}px Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y, maxWidth);
}

export function addSchoolWallArt(scene, renderer) {
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x182a30, roughness: .8 });
  function mount(texture, name, x, y, z, width, height, yaw) {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const group = new THREE.Group();
    group.name = name;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width + .10, height + .10, .065), frameMaterial);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    print.position.z = .036;
    group.add(frame, print);
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    scene.add(group);
  }

  const brand = canvasTexture(1536, 384, (ctx, w, h) => {
    ctx.fillStyle = '#182a30'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#edba50'; ctx.fillRect(0, 0, 22, h); ctx.fillRect(w - 22, 0, 22, h);
    lettering(ctx, 'jacobmatematik.dk', w / 2, 183, 120, '#fff1d1', w - 120);
    lettering(ctx, 'MATEMATIK PÅ SOLIDT FUNDAMENT', w / 2, 280, 38, '#edba50', w - 120);
  });
  // Each surface faces into a corridor or classroom, just clear of the wall.
  [
    [0, 2.65, -26.74, 0], [0, 2.65, 26.74, Math.PI],
    [-4.79, 2.65, -10, Math.PI / 2], [9.79, 2.65, -10, -Math.PI / 2],
    [-13, 2.75, 1.21, 0], [13, 2.75, 12.79, Math.PI],
  ].forEach(([x, y, z, yaw]) => mount(brand.texture, 'jacobmatematik.dk', x, y, z, 5.2, 1.3, yaw));

  const heroes = [
    { name: 'LUIGI LÆKKERMAT', file: 'luigi-laekkermat.webp', color: '#bf5738', motto: 'EN BID AD GANGEN', number: '01' },
    { name: 'DIVISIONS-DENNIS', file: 'divisions-dennis.webp', color: '#277d7d', motto: 'DEL OG HERSK', number: '02' },
    { name: 'KAPTAJN KVADRATROD', file: 'kaptajn-kvadratrod.webp', color: '#335c7d', motto: 'STYR PÅ RØDDERNE', number: '03' },
  ];
  heroes.forEach((hero, i) => {
    const draw = (ctx, w, h, image) => {
      ctx.fillStyle = '#f3e8ce'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = hero.color; ctx.fillRect(0, 0, w, 160);
      lettering(ctx, `MATEMATIKENS HELTE / ${hero.number}`, w / 2, 46, 23, '#fff1d1', w - 42);
      lettering(ctx, hero.name, w / 2, 111, 44, '#ffffff', w - 42);
      if (image) {
        const scale = Math.min((w - 48) / image.width, 660 / image.height);
        const iw = image.width * scale, ih = image.height * scale;
        ctx.drawImage(image, (w - iw) / 2, 177 + (660 - ih) / 2, iw, ih);
      } else {
        lettering(ctx, ['×', '÷', '√'][i], w / 2, 575, 250, hero.color, w - 80);
      }
      ctx.fillStyle = '#182a30'; ctx.fillRect(0, 859, w, h - 859);
      lettering(ctx, hero.motto, w / 2, 913, 34, '#edba50', w - 42);
      lettering(ctx, 'jacobmatematik.dk', w / 2, 969, 29, '#fff1d1', w - 42);
    };
    const poster = canvasTexture(640, 1024, draw);
    new THREE.TextureLoader().load(`assets/figurer/${hero.file}`, source => {
      draw(poster.ctx, 640, 1024, source.image);
      poster.texture.needsUpdate = true;
      source.dispose();
    }, undefined, () => console.warn(`Plakaten med ${hero.name} kunne ikke indlæses.`));
    [
      [8.79, 2.0, 6.6 + i * 3.4, -Math.PI / 2],
      [-5.79, 2.0, 6 + i * 4, Math.PI / 2],
      [-17 + i * 4, 2.0, -17.21, Math.PI],
      [14 + i * 4, 2.0, 13.21, 0],
    ].forEach(([x, y, z, yaw]) => mount(poster.texture, hero.name, x, y, z, 1.35, 2.16, yaw));
  });
}
