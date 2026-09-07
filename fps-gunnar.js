import { createSpriteRig, animateErling, disposeErlingRig } from './fps-visuals.js?v=20260907-sprites1';

export function createGunnarRig(texture) {
  const gunnar = createSpriteRig(texture, {
    width: 2.6,
    height: 3.9,
    bodyY: 1.78,
    joints: {
      head: [.50, .51],
      leftArm: [.25, .50],
      rightArm: [.75, .50],
      leftLeg: [.40, .27],
      rightLeg: [.60, .27],
    },
    segmentsX: 64,
    segmentsY: 96,
    skinWeights(u, v, ease) {
      // The large head and cheeks end at the necklace.
      if (v > .49) return { bone: 1, weight: ease(v, .49, .57) };

      // Gunnar's forearms are crossed. Keeping the hands pinned at the centre
      // lets the elbows and shoulders flex without tearing the crossed pose.
      if (v > .30 && v < .50 && u > .14 && u < .86) {
        const vertical = ease(v, .30, .35) * (1 - ease(v, .46, .50));
        const outside = ease(Math.abs(u - .50), .015, .075);
        const silhouette = ease(u, .14, .22) * (1 - ease(u, .78, .86));
        return {
          bone: u < .50 ? 2 : 3,
          weight: vertical * outside * silhouette,
        };
      }

      if (v < .31) {
        return {
          bone: u < .50 ? 4 : 5,
          weight: (1 - ease(v, .23, .31)) * ease(Math.abs(u - .50), .01, .07),
        };
      }
      return null;
    },
    motion: {
      legSwing: .13,
      legLift: .075,
      leftArmSwing: .17,
      rightArmSwing: .17,
      armIdle: .10,
      headTilt: .085,
      headStep: .02,
      headTurn: .13,
      bodyBob: .03,
    },
  });
  gunnar.type = 'gunnar';
  gunnar.hp = 3;
  gunnar.maxHp = 3;
  gunnar.speed = 2.7;
  return gunnar;
}

// Gunnar uses the very same walk cycle as Erling. His custom weight map makes
// the crossed arms flex at the elbows while his head turns and nods.
export function animateGunnar(gunnar, dt, time, distanceMoved) {
  animateErling(gunnar, dt, time, distanceMoved);
}

export function disposeGunnarRig(gunnar) {
  disposeErlingRig(gunnar);
}
