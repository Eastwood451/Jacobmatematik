const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Exercise the production handlers with rendering/audio replaced by small stubs.
const source = fs.readFileSync(path.join(__dirname, '..', 'fps.js'), 'utf8');
function declaration(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, `Missing end of ${name}`);
  return source.slice(start, end + 2);
}
function setup() {
  const noop = () => {};
  const state = {
    score: 0, erlingKills: 0, schoolyardPoints: 0, schoolyardKillTarget: 50,
    schoolyardDoorOpen: false, magicCircleTriggered: false,
    opened: 0, waves: 0, gunnars: 0, enemies: [], projectiles: [],
    removeEnemy: noop, updateHUD: noop, updateBossHud: noop, showVictory: noop,
    spawnWave: noop,
    createGunnar: noop, spawnMagicCircle: noop,
    feedbackEl: {}, setTimeout: noop,
    gameVoice: {stop: noop}, elseAttacks: {clear: noop}, clearStompWaves: noop,
    removeProjectile: noop, setSchoolyardLighting: noop, gameNow: () => 0,
    removeMagicCircle: noop, removeSchoolyardArrows: noop, schoolyardDoor: null,
    playerMovement: {reset: noop}, camera: {rotation: {set: noop}},
    clearEnemies: noop, newProblem: noop,
  };
  state.openSchoolyardDoor = () => { state.schoolyardDoorOpen = true; state.opened++; };
  state.spawnWave = () => state.waves++;
  state.createGunnar = () => state.gunnars++;
  vm.createContext(state);
  vm.runInContext(['onEnemyDefeated', 'hitEnemy', 'resetGame'].map(declaration).join('\n'), state);
  state.kill = type => state.onEnemyDefeated({type});
  return state;
}

test('49 Erlings leave the door closed; the 50th opens it', () => {
  const s = setup();
  for (let i = 0; i < 49; i++) s.kill('erling');
  assert.equal(s.schoolyardPoints, 49);
  assert.equal(s.opened, 0);
  s.kill('erling');
  assert.equal(s.schoolyardPoints, 50);
  assert.equal(s.opened, 1);
  assert.equal(s.waves, 49); // No replacement wave after the door opens.
});

test('40 Erlings and two Gunnars open the door without changing Erling spawn cadence', () => {
  const s = setup();
  for (let i = 0; i < 40; i++) s.kill('erling');
  s.kill('gunnar');
  assert.equal(s.schoolyardPoints, 45);
  assert.equal(s.opened, 0);
  s.kill('gunnar');
  assert.equal(s.schoolyardPoints, 50);
  assert.equal(s.opened, 1);
  assert.equal(s.erlingKills, 40);
  assert.equal(s.gunnars, 8);
  assert.equal(s.score, 42); // The existing 'Ramt' counter remains enemy count.
});

test('a Gunnar awards five only on his third hit, including crossing 50', () => {
  const s = setup();
  for (let i = 0; i < 48; i++) s.kill('erling');
  const gunnar = {type: 'gunnar', hp: 3, body: {material: {color: {set() {}}}}};
  s.hitEnemy(gunnar);
  s.hitEnemy(gunnar);
  assert.equal(s.schoolyardPoints, 48);
  assert.equal(s.opened, 0);
  s.hitEnemy(gunnar);
  assert.equal(s.schoolyardPoints, 53);
  assert.equal(s.opened, 1);
  s.kill('gunnar');
  assert.equal(s.opened, 1);
});

test('restarting clears accumulated schoolyard points', () => {
  const s = setup();
  s.kill('erling');
  s.kill('gunnar');
  s.resetGame();
  assert.equal(s.schoolyardPoints, 0);
  assert.equal(s.erlingKills, 0);
  assert.equal(s.schoolyardDoorOpen, false);
});

test('existing free-access profile and online reset behavior are preserved', () => {
  const s = setup();
  s.schoolyardKillTarget = 0;
  s.resetGame();
  assert.equal(s.schoolyardDoorOpen, true);
  s.resetGame(true);
  assert.equal(s.schoolyardDoorOpen, false);
});
