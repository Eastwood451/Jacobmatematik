import { createSpriteRig, animateErling, disposeErlingRig } from './fps-visuals.js?v=20260907-sprites1';

export function createElseRig(texture, phase = Math.random() * Math.PI * 2) {
  const enemy = createSpriteRig(texture, {
    width: 8.8,
    height: 13.2,
    bodyY: 6.05,
    phase,
    joints: {
      head: [.50, .61],
      leftArm: [.33, .64],
      rightArm: [.67, .64],
      leftLeg: [.42, .10],
      rightLeg: [.58, .10],
    },
    segmentsX: 64,
    segmentsY: 104,
    skinWeights(u, v, ease) {
      if (v > .59) return { bone: 1, weight: ease(v, .59, .67) };

      // Her raised marker arm and ruler arm sit outside the dress silhouette.
      if (v > .48 && v < .75) {
        const vertical = ease(v, .48, .53) * (1 - ease(v, .70, .75));
        if (u < .47) {
          return {
            bone: 2,
            weight: vertical * ease(u, .04, .11) * (1 - ease(u, .41, .47)),
          };
        }
        if (u > .53) {
          return {
            bone: 3,
            weight: vertical * ease(u, .53, .59) * (1 - ease(u, .91, .98)),
          };
        }
      }

      if (v < .14) {
        return {
          bone: u < .50 ? 4 : 5,
          weight: (1 - ease(v, .10, .14)) * ease(Math.abs(u - .50), .01, .06),
        };
      }
      return null;
    },
    motion: {
      strideRate: 1.9,
      walkingDivisor: .5,
      legSwing: .055,
      legLift: .045,
      leftArmBase: -.055,
      rightArmBase: .055,
      leftArmSwing: .11,
      rightArmSwing: .11,
      armIdle: .065,
      headTilt: .05,
      headStep: .012,
      headTurn: .10,
      bodyBob: .07,
      idleRate: .0011,
    },
  });
  enemy.type = 'else';
  enemy.hp = 25;
  enemy.maxHp = 25;
  enemy.speed = .82;
  enemy.lastStompAt = 0;
  return enemy;
}

// Eksamens-Else shares Erling's articulated walk cycle and adds her boss stomp.
export function animateElse(enemy, dt, time, distanceMoved, onStomp) {
  animateErling(enemy, dt, time, distanceMoved);
  const walking = Math.min(1, distanceMoved / Math.max(dt * .5, .001));
  const stompPhase = Math.sin(enemy.stride + enemy.phase);
  if (walking > .45 && stompPhase > .92 && time - enemy.lastStompAt > 520) {
    enemy.lastStompAt = time;
    if (onStomp) onStomp();
  }
}

export function disposeElseRig(enemy) {
  disposeErlingRig(enemy);
}
