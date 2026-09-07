import * as THREE from 'three';

const WIDTH = 2.1, HEIGHT = 3.6;
const smooth = THREE.MathUtils.smoothstep;

// Every illustrated enemy uses the same small skeletal rig. Character modules
// only describe where their head and limbs are located in their own artwork.
export function createSpriteRig(texture, options) {
  const {
    width, height, bodyY, joints, skinWeights, motion = {},
    phase = Math.random() * Math.PI * 2,
    segmentsX = 48, segmentsY = 72,
  } = options;
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const indices = [], weights = [], uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const influence = skinWeights(u, v, smooth) || { bone: 0, weight: 0 };
    const bone = influence.bone || 0;
    const weight = THREE.MathUtils.clamp(influence.weight || 0, 0, 1);
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
  const joint = ([u, v]) => {
    const bone = new THREE.Bone();
    bone.position.set((u - .5) * width, (v - .5) * height, 0);
    root.add(bone);
    return bone;
  };
  const head = joint(joints.head), leftArm = joint(joints.leftArm), rightArm = joint(joints.rightArm);
  const leftLeg = joint(joints.leftLeg), rightLeg = joint(joints.rightLeg);
  body.add(root);
  body.bind(new THREE.Skeleton([root, head, leftArm, rightArm, leftLeg, rightLeg]));
  body.position.y = bodyY;
  body.frustumCulled = false;
  const group = new THREE.Group();
  group.add(body);
  return {
    group, body, head, leftArm, rightArm, leftLeg, rightLeg, phase, stride: 0,
    bodyBaseY: bodyY,
    leftLegRestY: leftLeg.position.y,
    rightLegRestY: rightLeg.position.y,
    motion,
  };
}

// Erlings weight map follows his vest, arms and shoes. The same animator below
// is shared by Gunnar Gider-ik and Eksamens-Else.
export function createErlingRig(texture, phase = Math.random() * Math.PI * 2) {
  return createSpriteRig(texture, {
    width: WIDTH,
    height: HEIGHT,
    bodyY: 1.39,
    phase,
    joints: {
      head: [.49, .62], leftArm: [.37, .59], rightArm: [.62, .59],
      leftLeg: [.42, .30], rightLeg: [.55, .30],
    },
    skinWeights(u, v, ease) {
      if (v > .59) return { bone: 1, weight: ease(v, .59, .67) };
      if (v < .34) {
        return {
          bone: u < .49 ? 4 : 5,
          weight: (1 - ease(v, .26, .34)) * ease(Math.abs(u - .49), 0, .035),
        };
      }
      if (v > .40 && v < .62) {
        // Follow the arm/vest outlines, keeping the belly out of the arm weights.
        const leftEdge = .325 + Math.max(0, v - .45) * .26;
        const shoulder = 1 - ease(v, .58, .62);
        if (u < leftEdge) {
          return {
            bone: 2,
            weight: (1 - ease(u, leftEdge - .018, leftEdge)) * ease(v, .415, .44) * shoulder,
          };
        }
        const rightEdge = v < .50 ? .57 + Math.abs(v - .477) * 1.4 : .62;
        if (u > rightEdge && v > .445) {
          return {
            bone: 3,
            weight: ease(u, rightEdge, rightEdge + .018) * ease(v, .445, .47) * shoulder,
          };
        }
      }
      return null;
    },
  });
}

export function animateErling(enemy, dt, time, distanceMoved) {
  // Feet stop marching when a wall blocks him. Head and arms remain restless.
  const motion = enemy.motion || {};
  enemy.stride += distanceMoved * (motion.strideRate ?? 6);
  const walking = Math.min(1, distanceMoved / Math.max(dt * (motion.walkingDivisor ?? 1.1), .001));
  const step = Math.sin(enemy.stride + enemy.phase) * walking;
  const idle = Math.sin(time * (motion.idleRate ?? .0018) + enemy.phase);
  enemy.leftLeg.rotation.z = step * (motion.legSwing ?? .17);
  enemy.rightLeg.rotation.z = -step * (motion.legSwing ?? .17);
  enemy.leftLeg.position.y = enemy.leftLegRestY + Math.max(0, step) * (motion.legLift ?? .10);
  enemy.rightLeg.position.y = enemy.rightLegRestY + Math.max(0, -step) * (motion.legLift ?? .10);
  enemy.leftArm.rotation.z = (motion.leftArmBase ?? -.03) + step * (motion.leftArmSwing ?? .16) + idle * (motion.armIdle ?? .04);
  enemy.rightArm.rotation.z = (motion.rightArmBase ?? .03) - step * (motion.rightArmSwing ?? .14) - idle * (motion.armIdle ?? .04);
  enemy.head.rotation.z = idle * (motion.headTilt ?? .075) + step * (motion.headStep ?? .025);
  enemy.head.rotation.y = Math.sin(time * (motion.headTurnRate ?? .0013) + enemy.phase) * (motion.headTurn ?? .12);
  enemy.body.position.y = enemy.bodyBaseY + Math.abs(step) * (motion.bodyBob ?? .025);
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
