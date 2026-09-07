import * as THREE from 'three';
import { createPlayerMovement } from './fps-movement.js?v=20260907-ducts1';
import { createDuctBuilder } from './fps-ducts.js?v=20260907-ducts1';
import { createSchoolInteriorMaterials, applySchoolSurfaceUV } from './fps-interior.js?v=20260907-interior1';
import { createElseAttacks, ELSE_THROW_INTERVAL } from './fps-else-attacks.js?v=20260907-ducts1';
import { createOnlineGame } from './fps-online.js?v=20260907-online1';
let multiplayer = null;
import { createSchoolyard } from './fps-schoolyard.js?v=20260907-courtyard1';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createErlingRig, animateErling, disposeErlingRig, addSchoolWallArt } from './fps-visuals.js?v=20260907-sprites1';
import { createGunnarRig, animateGunnar, disposeGunnarRig } from './fps-gunnar.js?v=20260907-sprites1';
import { createElseRig, animateElse, disposeElseRig } from './fps-else.js?v=20260907-sprites1';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8eb5c4);
scene.fog = new THREE.Fog(0xc8c6b7, 36, 96);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .08, 130);
camera.position.set(0, 1.7, 18);
const controls = new PointerLockControls(camera, document.body);
scene.add(camera);

const hemisphere = new THREE.HemisphereLight(0xf4f1dc, 0xa4a29a, 2.2);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xfff1cf, .45);
sun.position.set(-18, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
scene.add(sun);

const WORLD = 54;
const WALL_H = 4.2;
const colliders = [];
const elseAttacks = createElseAttacks({ scene, colliders, onPlayerHit: () => {
  hurt(null, true);
  return gameActive;
} });

let erlingTexture = null;
let gunnarTexture = null;
let elseTexture = null;
let schoolyardKillTarget = 50;
let currentUsername = '';
let charactersReady = false;
let playerRulesReady = false;
let characterLoadFailed = false;

function makeTransparentErlingTexture(image) {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth || image.width;
  c.height = image.naturalHeight || image.height;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(image, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const data = img.data;
  const w = c.width;
  const h = c.height;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const nearWhite = i => {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    return r > 215 && g > 207 && b > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
  };
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i] || !nearWhite(i)) return;
    seen[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  push(Math.floor(w * .30), Math.floor(h * .49));
  push(Math.floor(w * .68), Math.floor(h * .46));
  push(Math.floor(w * .47), Math.floor(h * .81));
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    data[i * 4 + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const startButton = document.getElementById('start-button');

function refreshStartButton() {
  if (characterLoadFailed) {
    startButton.disabled = false;
    startButton.textContent = 'HENT FIGURERNE IGEN';
    return;
  }
  if (!charactersReady) {
    startButton.disabled = true;
    startButton.textContent = 'FIGURERNE ER PÅ VEJ…';
    return;
  }
  if (!playerRulesReady) {
    startButton.disabled = true;
    startButton.textContent = 'HENTER SPILLER…';
    return;
  }
  startButton.disabled = false;
  startButton.textContent = 'IND PÅ SKOLEN';
}

function loadTexture(path) {
  return new Promise((resolve, reject) => new THREE.TextureLoader().load(path, resolve, undefined, reject));
}

function prepareSpriteTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

async function loadCharacters() {
  characterLoadFailed = false;
  charactersReady = false;
  refreshStartButton();
  try {
    const [erlingSource, gunnarSource, elseSource] = await Promise.all([
      loadTexture('assets/figurer/erling-aergerlig.webp'),
      loadTexture('assets/figurer/gunnar-gider-ik.webp'),
      loadTexture('assets/figurer/eksamens-else.webp'),
    ]);
    erlingTexture = prepareSpriteTexture(makeTransparentErlingTexture(erlingSource.image));
    erlingSource.dispose();
    gunnarTexture = prepareSpriteTexture(gunnarSource);
    elseTexture = prepareSpriteTexture(elseSource);
    charactersReady = true;
  } catch (error) {
    console.error('Figurerne kunne ikke indlæses.', error);
    characterLoadFailed = true;
  }
  refreshStartButton();
}

async function loadPlayerRules() {
  let username = new URLSearchParams(location.search).get('user') || '';
  try {
    if (window.JacobBackend?.configured) {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Spilleropslag timeout')), 3000));
      const session = await Promise.race([window.JacobBackend.loadDatabase(), timeout]);
      const current = session?.database?.users?.find(user => user.id === session.currentUserId);
      if (current?.username) username = current.username;
    }
  } catch (error) {
    console.info('Spillerprofil kunne ikke hentes. Standardregler bruges.', error);
  }
  currentUsername = String(username || '').trim();
  schoolyardKillTarget = currentUsername.toLowerCase() === 'jacobe' ? 3 : 50;
  playerRulesReady = true;
  refreshStartButton();
}

loadCharacters();
loadPlayerRules();

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness:.82, metalness:.02 });
}
const interiorMaterials = createSchoolInteriorMaterials(renderer);
const floorMat = interiorMaterials.floor;
const wallMat = interiorMaterials.wall;
const trimMat = mat(0x375d67);
const deskMat = mat(0x9a633e);
const lockerMat = mat(0x66838a);

function box(x, y, z, w, h, d, material = wallMat, solid = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  applySchoolSurfaceUV(mesh.geometry, material, mesh.position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (solid) colliders.push(new THREE.Box3().setFromObject(mesh));
  return mesh;
}

box(0, -.12, 0, WORLD, .24, WORLD, floorMat, false);
// Closed roof over the indoor school only; also stops fired pencils.
box(0, WALL_H + .1, 0, WORLD + .45, .2, WORLD + .45, interiorMaterials.ceiling, true);
box(0, WALL_H / 2, -WORLD / 2, WORLD, WALL_H, .45);
box(0, WALL_H / 2, WORLD / 2, WORLD, WALL_H, .45);
box(-WORLD / 2, WALL_H / 2, 0, .45, WALL_H, WORLD);
box(WORLD / 2, WALL_H / 2, 0, .45, WALL_H, WORLD);
const schoolPartition = createDuctBuilder({ box, wallMaterial:wallMat, wallHeight:WALL_H, renderer });
[
  [-13,-17,18,.35,true],[-13,1,18,.35],[-13,20,14,.35],
  [13,-20,13,.35],[13,-4,13,.35,true],[13,13,18,.35],
  [-20,-10,.35,13],[-5,-10,.35,13],[10,-10,.35,11],[22,-10,.35,9],
  [-21,10,.35,14],[-6,10,.35,12,true],[9,10,.35,10,true],[21,10,.35,11],
].forEach(([x,z,w,d,hasDuct]) => schoolPartition(x,z,w,d,hasDuct));
box(-26, 1.15, -2, .08, 1.25, 8, trimMat, false);
box(26, 1.15, 5, .08, 1.25, 9, trimMat, false);
box(-19, 1.65, -26.7, 8, 1.55, .08, mat(0x29483e), false);
box(19, 1.65, 26.7, 8, 1.55, .08, mat(0x29483e), false);
[
  [-20,-19],[-16,-19],[-20,-15],[-16,-15],
  [18,-18],[22,-18],[18,-14],[22,-14],
  [-20,18],[-16,18],[-20,22],[-16,22],
  [18,17],[22,17],[18,21],[22,21],
].forEach(([x,z]) => {
  box(x, .55, z, 2.3, .12, 1.25, deskMat, true);
  box(x - .85, .27, z, .12, .55, 1, deskMat, true);
  box(x + .85, .27, z, .12, .55, 1, deskMat, true);
});
for (let z = -20; z <= 20; z += 2.2) box(-25.4, 1, z, .8, 2, 1.7, lockerMat, true);
const fixtureMat = mat(0xbabeb5);
const tubeMat = new THREE.MeshStandardMaterial({ color:0xfff4d5, emissive:0xffedc2, emissiveIntensity:1.2, roughness:.45 });
function ceilingFixture(x,z) {
  box(x,WALL_H-.09,z,2.8,.16,.62,fixtureMat,false);
  for(const offset of [-.17,.17]) box(x,WALL_H-.19,z+offset,2.5,.08,.095,tubeMat,false);
}
for (let z = -21; z <= 21; z += 7) {
  ceilingFixture(0,z);
  const light = new THREE.PointLight(0xffefd0,14,17);
  light.position.set(0,WALL_H-.35,z);
  scene.add(light);
}
for(const x of [-17,17])for(const z of [-18,0,18])ceilingFixture(x,z);

addSchoolWallArt(scene, renderer);

const keys = {};
const playerMovement = createPlayerMovement({camera,colliders,keys});
let last = performance.now();
let lives = 5;
let ammo = 0;
let score = 0;
let erlingKills = 0;
let answer = '';
let gameActive = false;
let problem = null;
let invulnerableUntil = 0;
let enemies = [];
let projectiles = [];
let spawnVoiceIndex = 0;
let moveVoiceIndex = 0;
let gunnarVoiceIndex = 0;
let lastMoveVoiceAt = 0;
let lastElseVoiceAt = 0;
let musicMuted = false;
let audioCtx = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let campBoost = false;
let lastPlayerMoveAt = performance.now();
let campMovementStartedAt = 0;
let magicCircle = null;
let magicCircleTriggered = false;
let divisionChallenge = null;
let schoolyardDoor = null;
let schoolyardDoorOpen = false;
let schoolyardEntered = false;
let schoolyardBuilt = false;
let schoolyardArrows = null;
let elseBoss = null;
let stompWaves = [];
let stompShakeUntil = 0;

const livesEl = document.getElementById('lives');
const ammoEl = document.getElementById('ammo');
const scoreEl = document.getElementById('score');
const problemEl = document.getElementById('problem');
const answerEl = document.getElementById('answer');
const feedbackEl = document.getElementById('feedback');
const mathKickerEl = document.querySelector('.math-kicker');
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function ensureBossHud() {
  let hud = document.getElementById('else-boss-hud');
  if (hud) return hud;
  hud = document.createElement('div');
  hud.id = 'else-boss-hud';
  hud.style.cssText = 'position:fixed;z-index:15;top:86px;left:50%;transform:translateX(-50%);width:min(560px,calc(100vw - 36px));display:none;background:#171c22;color:#fff1d1;border:4px solid #171c22;border-radius:13px;box-shadow:6px 6px 0 #8f3d7a;padding:8px 12px;font:900 12px Inter,system-ui,sans-serif;letter-spacing:.08em';
  hud.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong>EKSAMENS-ELSE</strong><span id="else-hp-text">25 / 25 blyanter</span></div><div style="height:14px;background:#f3e8ce;border:2px solid #080b0f;border-radius:7px;overflow:hidden"><div id="else-hp-fill" style="height:100%;width:100%;background:#c84b7f"></div></div>';
  document.body.appendChild(hud);
  return hud;
}

function updateBossHud() {
  const hud = ensureBossHud();
  if (!elseBoss) {
    hud.style.display = 'none';
    return;
  }
  hud.style.display = 'block';
  const hp = Math.max(0, elseBoss.hp);
  document.getElementById('else-hp-text').textContent = `${hp} / 25 blyanter`;
  document.getElementById('else-hp-fill').style.width = `${hp / 25 * 100}%`;
}

function showVictory() {
  elseAttacks.clear();
  gameActive = false;
  controls.unlock();
  updateBossHud();
  let overlay = document.getElementById('victory-overlay');
  if (!overlay) {
    overlay = document.createElement('section');
    overlay.id = 'victory-overlay';
    overlay.className = 'overlay open';
    overlay.innerHTML = '<div class="overlay-card"><span class="eyebrow">EKSAMEN OVERLEVEDE</span><h2>Eksamens-Else er besejret.</h2><p>25 blyanter. Én meget lang skoledag.</p><button id="victory-restart" class="start-button" type="button">SPIL IGEN</button></div>';
    document.body.appendChild(overlay);
    document.getElementById('victory-restart').addEventListener('click', () => {
      overlay.classList.remove('open');
      gameActive = true;
      resetGame();
      controls.lock();
    });
  } else {
    overlay.classList.add('open');
  }
}

function normalProblem() {
  const a = rand(1, 9), b = rand(1, 9);
  return { kind:'multiply', expression:`${a} × ${b}`, answer:a * b };
}
function divisionProblem() {
  const divisor = rand(1, 9), quotient = rand(1, 9);
  return { kind:'division', expression:`${divisor * quotient} ÷ ${divisor}`, answer:quotient };
}
function newProblem() {
  if (divisionChallenge?.active) return;
  problem = schoolyardEntered ? divisionProblem() : normalProblem();
  if (schoolyardEntered) problem.expression = problem.expression.replace(' ÷ ', ' : ');
  mathKickerEl.textContent = schoolyardEntered ? 'EKSAMENS AMMUNITION · DIVISION' : 'ERLINGS GANGESTYKKE';
  problemEl.textContent = problem.expression;
  answer = '';
  answerEl.textContent = '_';
  feedbackEl.textContent = 'Svar rigtigt for at få en blyant. · M = musik';
  feedbackEl.className = 'feedback';
}

function pickSpawnPosition() {
  const candidates = [[-21,-22],[20,-22],[-20,22],[20,22],[0,-23],[0,23],[-23,0],[23,0],[-7,-22],[8,22]];
  const valid = candidates.filter(p => new THREE.Vector2(p[0] - camera.position.x, p[1] - camera.position.z).length() > 11);
  const pool = valid.length ? valid : candidates;
  const p = pool[Math.floor(Math.random() * pool.length)];
  return new THREE.Vector3(p[0] + (Math.random() - .5) * 2.4, 0, p[1] + (Math.random() - .5) * 2.4);
}
function createErling() {
  const enemy = createErlingRig(erlingTexture);
  enemy.type = 'erling';
  enemy.hp = 1;
  enemy.maxHp = 1;
  enemy.speed = 1.35;
  enemy.group.position.copy(pickSpawnPosition());
  scene.add(enemy.group);
  enemies.push(enemy);
  return enemy;
}
function createGunnar() {
  const enemy = createGunnarRig(gunnarTexture);
  enemy.group.position.copy(pickSpawnPosition());
  scene.add(enemy.group);
  enemies.push(enemy);
  speakGunnar();
  return enemy;
}
function createElse() {
  const enemy = createElseRig(elseTexture);
  enemy.throwCooldown = 2;
  enemy.group.position.set(0, 0, 60);
  scene.add(enemy.group);
  enemies.push(enemy);
  elseBoss = enemy;
  updateBossHud();
  speakElse(true);
  return enemy;
}
function removeEnemy(enemy) {
  const i = enemies.indexOf(enemy);
  if (i >= 0) enemies.splice(i, 1);
  if (enemy.type === 'gunnar') disposeGunnarRig(enemy);
  else if (enemy.type === 'else') disposeElseRig(enemy);
  else disposeErlingRig(enemy);
  scene.remove(enemy.group);
  if (enemy === elseBoss) {
    elseBoss = null;
    updateBossHud();
  }
}
function clearEnemies() {
  [...enemies].forEach(removeEnemy);
}

function speakLine(text, opts = {}) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'da-DK';
  u.rate = opts.rate || .86;
  u.pitch = opts.pitch || .68;
  u.volume = opts.volume || .92;
  const voices = speechSynthesis.getVoices();
  const danish = voices.find(v => /^da(-|_)/i.test(v.lang)) || voices.find(v => /danish/i.test(v.name));
  if (danish) u.voice = danish;
  speechSynthesis.speak(u);
}
function speakSpawn() {
  const lines = ['Nu kommer Erling!', 'Ned med de dygtige!'];
  speakLine(lines[spawnVoiceIndex++ % lines.length], { rate:.82, pitch:.64, volume:.96 });
}
function speakGunnar() {
  const lines = ['Jeg er den seje!', 'Giv mig din madpakke!', 'Gunnar in the house!'];
  speakLine(lines[gunnarVoiceIndex++ % lines.length], { rate:.92, pitch:.76, volume:.98 });
}
function speakElse(force = false) {
  const now = performance.now();
  if (!force && now - lastElseVoiceAt < 6000) return;
  lastElseVoiceAt = now;
  speakLine('Tid til eksamen!', { rate:.68, pitch:.58, volume:1 });
}
function maybeSpeakWhileMoving(now) {
  if (divisionChallenge?.active || now - lastMoveVoiceAt < 5600 || !('speechSynthesis' in window) || speechSynthesis.speaking) return;
  lastMoveVoiceAt = now;
  if (enemies.some(e => e.type === 'else')) { speakElse(); return; }
  if (enemies.some(e => e.type === 'gunnar')) { speakGunnar(); return; }
  if (enemies.some(e => e.type === 'erling')) {
    const lines = ['Nu har jeg dig!', 'Jeg slapper din matematik-eksamen!', 'Du skal være et nul ligesom mig!'];
    speakLine(lines[moveVoiceIndex++ % lines.length], { rate:.88, pitch:.67, volume:.9 });
  }
}
function spawnWave(count = 1, announce = true) {
  if (schoolyardDoorOpen || schoolyardEntered) return;
  for (let i = 0; i < count; i++) createErling();
  if (announce) speakSpawn();
}

function ensureMusic() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = musicMuted ? 0 : .12;
  musicGain.connect(audioCtx.destination);
  const bass = [55,55,65.41,55,73.42,65.41,55,49];
  const lead = [220,261.63,293.66,329.63,293.66,261.63,220,196];
  musicTimer = setInterval(() => {
    if ((!gameActive && !multiplayer?.active) || musicMuted || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    const hit = (freq, duration, type, gainValue) => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(gainValue, now);
      g.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(g); g.connect(musicGain);
      osc.start(now); osc.stop(now + duration);
    };
    hit(bass[musicStep % bass.length], .19, 'sawtooth', .5);
    if (musicStep % 2 === 0) hit(lead[musicStep % lead.length], .11, 'square', .18);
    musicStep++;
  }, 170);
}
function toggleMusic() {
  musicMuted = !musicMuted;
  if (musicGain) musicGain.gain.setTargetAtTime(musicMuted ? 0 : .12, audioCtx.currentTime, .03);
  feedbackEl.textContent = musicMuted ? 'Musik: SLUKKET (M)' : 'Musik: TÆNDT (M)';
  feedbackEl.className = 'feedback';
}
function playStompSound() {
  if (!audioCtx || musicMuted) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(52, now);
  osc.frequency.exponentialRampToValueAtTime(27, now + .22);
  g.gain.setValueAtTime(.32, now);
  g.gain.exponentialRampToValueAtTime(.0001, now + .28);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(now); osc.stop(now + .3);
}

function makePencil() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color:0xf4b522, roughness:.6 });
  const graphite = new THREE.MeshStandardMaterial({ color:0x292929, roughness:.8 });
  const pink = new THREE.MeshStandardMaterial({ color:0xdb7f8e, roughness:.65 });
  const metal = new THREE.MeshStandardMaterial({ color:0xb7a986, roughness:.4, metalness:.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.9,8), wood); body.rotation.z = Math.PI / 2; group.add(body);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(.062,.062,.14,10), metal); ferrule.rotation.z = Math.PI / 2; ferrule.position.x = -.51; group.add(ferrule);
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.16,10), pink); eraser.rotation.z = Math.PI / 2; eraser.position.x = -.66; group.add(eraser);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.08,.24,10), wood); tip.rotation.z = -Math.PI / 2; tip.position.x = .57; group.add(tip);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(.032,.09,8), graphite); lead.rotation.z = -Math.PI / 2; lead.position.x = .72; group.add(lead);
  group.scale.setScalar(1.35);
  return group;
}
function firePencil() {
  if (multiplayer?.active) { multiplayer.fire(); return; }
  if (!gameActive || !controls.isLocked || ammo <= 0 || divisionChallenge?.active) return;
  ammo--;
  updateHUD();
  flash('shot-flash');
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.normalize();
  const mesh = makePencil();
  mesh.position.copy(camera.position).add(dir.clone().multiplyScalar(.8)).add(new THREE.Vector3(0,-.12,0));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0), dir);
  scene.add(mesh);
  projectiles.push({ mesh, velocity:dir.multiplyScalar(24), life:2.6 });
}
function removeProjectile(p) {
  const i = projectiles.indexOf(p);
  if (i >= 0) projectiles.splice(i, 1);
  p.mesh.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  scene.remove(p.mesh);
}
function onEnemyDefeated(enemy) {
  const type = enemy.type;
  removeEnemy(enemy);
  score++;
  if (type === 'else') {
    updateHUD();
    showVictory();
    return;
  }
  if (type === 'erling') {
    erlingKills++;
    if (erlingKills >= schoolyardKillTarget && !schoolyardDoorOpen) {
      openSchoolyardDoor();
      updateHUD();
      return;
    }
    spawnWave(2, true);
    if (erlingKills % 5 === 0) createGunnar();
    if (erlingKills >= 50 && !magicCircleTriggered) {
      magicCircleTriggered = true;
      spawnMagicCircle();
    }
  }
  updateHUD();
}
function hitEnemy(enemy) {
  enemy.hp--;
  if (enemy.hp <= 0) {
    onEnemyDefeated(enemy);
    return;
  }
  if (enemy.type === 'gunnar') {
    feedbackEl.textContent = `GUNNAR GIDER-IK: ${enemy.hp} af 3 træffere tilbage!`;
    feedbackEl.className = 'feedback bad';
    enemy.body.material.color.set(0xff9d8f);
    setTimeout(() => { if (enemies.includes(enemy)) enemy.body.material.color.set(0xffffff); }, 120);
  } else if (enemy.type === 'else') {
    feedbackEl.textContent = `EKSAMENS-ELSE: ${enemy.hp} blyanter tilbage!`;
    feedbackEl.className = 'feedback bad';
    updateBossHud();
    enemy.body.material.color.set(0xffb2c9);
    setTimeout(() => { if (enemies.includes(enemy)) enemy.body.material.color.set(0xffffff); }, 130);
  }
}
function projectileHitsEnemy(p, enemy) {
  if (enemy.type === 'else') {
    const dx = p.mesh.position.x - enemy.group.position.x;
    const dz = p.mesh.position.z - enemy.group.position.z;
    return Math.hypot(dx,dz) < 3.35 && p.mesh.position.y > .15 && p.mesh.position.y < 14.3;
  }
  const pos = enemy.group.position.clone();
  pos.y = 1.65;
  const radius = enemy.type === 'gunnar' ? 1.28 : 1.05;
  return p.mesh.position.distanceTo(pos) < radius;
}
function updateProjectiles(dt) {
  for (const p of [...projectiles]) {
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.life -= dt;
    const sphere = new THREE.Sphere(p.mesh.position, .32);
    if (colliders.some(c => c.intersectsSphere(sphere)) || p.life <= 0) {
      removeProjectile(p);
      continue;
    }
    let hit = null;
    for (const enemy of enemies) {
      if (projectileHitsEnemy(p, enemy)) { hit = enemy; break; }
    }
    if (hit) {
      removeProjectile(p);
      hitEnemy(hit);
    }
  }
}

function spawnMagicCircle() {
  const group = new THREE.Group();
  group.position.set(0,.035,0);
  const glow = new THREE.MeshBasicMaterial({ color:0x66e7ff, transparent:true, opacity:.82, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.55,2.35,64), glow);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.22,.055,12,64), new THREE.MeshBasicMaterial({ color:0xffe86a, transparent:true, opacity:.95, depthWrite:false, blending:THREE.AdditiveBlending }));
  inner.rotation.x = Math.PI / 2;
  group.add(inner);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(.16,20), new THREE.MeshBasicMaterial({ color:i % 2 ? 0x8ef4ff : 0xffdf68, transparent:true, opacity:.9, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(Math.cos(a) * 1.88, .02, Math.sin(a) * 1.88);
    group.add(dot);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.45,2.2,4.7,48,1,true), new THREE.MeshBasicMaterial({ color:0x73eaff, transparent:true, opacity:.085, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending }));
  beam.position.y = 2.35;
  group.add(beam);
  const light = new THREE.PointLight(0x79eaff,3.1,9);
  light.position.y = 1.5;
  group.add(light);
  scene.add(group);
  magicCircle = { group, ring, inner, light };
  feedbackEl.textContent = 'EN MAGISK CIRKEL ER OPSTÅET! Gå ind i den.';
  feedbackEl.className = 'feedback good';
}
function removeMagicCircle() {
  if (!magicCircle) return;
  magicCircle.group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  scene.remove(magicCircle.group);
  magicCircle = null;
}
function startDivisionChallenge(now) {
  if (!magicCircle || divisionChallenge?.active) return;
  campBoost = false;
  campMovementStartedAt = 0;
  divisionChallenge = { active:true, index:0, correct:0, endsAt:now + 10000 };
  mathKickerEl.textContent = 'MAGISK DIVISION · 1/3';
  problem = divisionProblem();
  problemEl.textContent = problem.expression;
  answer = '';
  answerEl.textContent = '_';
  feedbackEl.textContent = '10,0 sekunder · Alle fjender er frosset!';
  feedbackEl.className = 'feedback good';
}
function nextDivisionProblem() {
  divisionChallenge.index++;
  if (divisionChallenge.correct >= 3) {
    finishDivisionChallenge(true);
    return;
  }
  problem = divisionProblem();
  mathKickerEl.textContent = `MAGISK DIVISION · ${divisionChallenge.index + 1}/3`;
  problemEl.textContent = problem.expression;
  answer = '';
  answerEl.textContent = '_';
}
function finishDivisionChallenge(success) {
  if (!divisionChallenge?.active) return;
  divisionChallenge.active = false;
  removeMagicCircle();
  lastPlayerMoveAt = performance.now();
  if (success) {
    lives++;
    updateHUD();
    mathKickerEl.textContent = 'EKSTRA LIV!';
    problemEl.textContent = '+1 ♥';
    feedbackEl.textContent = 'Tre divisioner på under 10 sekunder!';
    feedbackEl.className = 'feedback good';
  } else {
    mathKickerEl.textContent = 'TIDEN GIK';
    problemEl.textContent = '0 ♥';
    feedbackEl.textContent = 'Fjenderne bevæger sig igen.';
    feedbackEl.className = 'feedback bad';
  }
  setTimeout(() => { if (gameActive) newProblem(); }, 850);
}
function submitDivisionAnswer() {
  if (!divisionChallenge?.active || !answer) return;
  if (Number(answer) === problem.answer) {
    divisionChallenge.correct++;
    answer = '';
    answerEl.textContent = '_';
    nextDivisionProblem();
  } else {
    feedbackEl.textContent = 'Forkert. Samme stykke igen · tiden løber!';
    feedbackEl.className = 'feedback bad';
    answer = '';
    answerEl.textContent = '_';
  }
}

function createSchoolyardDoor() {
  if (schoolyardDoor) return schoolyardDoor;
  const group = new THREE.Group();
  group.position.set(0,0,26.69);
  group.visible = false;
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(3.3,3.35), new THREE.MeshBasicMaterial({ color:0x101820 }));
  dark.position.y = 1.68;
  dark.rotation.y = Math.PI;
  group.add(dark);
  const frameMat = new THREE.MeshStandardMaterial({ color:0xedba50, emissive:0x5b4210, emissiveIntensity:.45 });
  const sideGeo = new THREE.BoxGeometry(.18,3.55,.18);
  const topGeo = new THREE.BoxGeometry(3.65,.18,.18);
  const left = new THREE.Mesh(sideGeo, frameMat); left.position.set(-1.75,1.75,-.03);
  const right = left.clone(); right.position.x = 1.75;
  const top = new THREE.Mesh(topGeo, frameMat); top.position.set(0,3.45,-.03);
  group.add(left,right,top);
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512; signCanvas.height = 128;
  const ctx = signCanvas.getContext('2d');
  ctx.fillStyle = '#182a30'; ctx.fillRect(0,0,512,128);
  ctx.fillStyle = '#fff1d1'; ctx.font = '900 54px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SKOLEGÅRD',256,64);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8,.7), new THREE.MeshBasicMaterial({ map:signTex, toneMapped:false }));
  sign.position.set(0,4.05,-.08);
  sign.rotation.y = Math.PI;
  group.add(sign);
  scene.add(group);
  schoolyardDoor = group;
  return group;
}

function createSchoolyardArrows() {
  removeSchoolyardArrows();
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-.38,-1.05);
  shape.lineTo(.38,-1.05);
  shape.lineTo(.38,.25);
  shape.lineTo(.82,.25);
  shape.lineTo(0,1.28);
  shape.lineTo(-.82,.25);
  shape.lineTo(-.38,.25);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const outlineMaterial = new THREE.MeshBasicMaterial({ color:0x101317, transparent:true, opacity:.9, side:THREE.DoubleSide, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 });
  const arrowMaterial = new THREE.MeshBasicMaterial({ color:0xffd348, transparent:true, opacity:.92, side:THREE.DoubleSide, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4 });
  const placements = [
    [0,-20,0,1.0],[0,-14,0,1.0],[0,-8,0,1.0],[0,-2,0,1.0],
    [0,4,0,1.0],[0,10,0,1.0],[0,16,0,1.0],[0,21.5,0,1.1],
    [-16,15,Math.atan2(16,7),.9],[-9,18,Math.atan2(9,4),.9],
    [16,15,Math.atan2(-16,7),.9],[9,18,Math.atan2(-9,4),.9],
  ];
  placements.forEach(([x,z,yaw,scale]) => {
    const holder = new THREE.Group();
    holder.position.set(x,.028,z);
    holder.rotation.y = yaw;
    holder.scale.setScalar(scale);
    const outline = new THREE.Mesh(geometry, outlineMaterial);
    outline.rotation.x = Math.PI / 2;
    outline.scale.setScalar(1.16);
    const arrow = new THREE.Mesh(geometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.y = .012;
    holder.add(outline, arrow);
    group.add(holder);
  });
  scene.add(group);
  schoolyardArrows = { group, geometry, arrowMaterial, outlineMaterial };
}

function removeSchoolyardArrows() {
  if (!schoolyardArrows) return;
  scene.remove(schoolyardArrows.group);
  schoolyardArrows.geometry.dispose();
  schoolyardArrows.arrowMaterial.dispose();
  schoolyardArrows.outlineMaterial.dispose();
  schoolyardArrows = null;
}

function updateSchoolyardArrows(time) {
  if (!schoolyardArrows) return;
  const pulse = .72 + .22 * (.5 + .5 * Math.sin(time * .007));
  schoolyardArrows.arrowMaterial.opacity = pulse;
}

function openSchoolyardDoor() {
  schoolyardDoorOpen = true;
  campBoost = false;
  campMovementStartedAt = 0;
  removeMagicCircle();
  clearEnemies();
  const door = createSchoolyardDoor();
  door.visible = true;
  createSchoolyardArrows();
  mathKickerEl.textContent = `${schoolyardKillTarget} ERLINGER!`;
  problemEl.textContent = 'DØREN ER ÅBEN';
  feedbackEl.textContent = 'Følg pilene på gulvet til skolegården!';
  feedbackEl.className = 'feedback good';
}

let schoolyardScenery = null;
function buildSchoolyard() {
  if (schoolyardBuilt) return;
  schoolyardBuilt = true;
  schoolyardScenery = createSchoolyard({ scene, box, renderer });
}

function setSchoolyardLighting(active) {
  schoolyardScenery?.setActive(active);
  sun.intensity = active ? 2.6 : .45;
  hemisphere.color.set(active ? 0xdcefff : 0xf4f1dc);
  hemisphere.groundColor.set(active ? 0x62594c : 0xa4a29a);
  hemisphere.intensity = active ? 2.4 : 2.2;
  sun.position.set(-18,28,active ? 64 : 12);
  sun.target.position.set(0,0,active ? 52 : 0);
  sun.target.updateMatrixWorld();
  scene.fog.color.set(active ? 0xc9dadb : 0xc8c6b7);
  scene.fog.near = active ? 55 : 36;
  scene.fog.far = active ? 125 : 96;
}

function enterSchoolyard() {
  if (schoolyardEntered) return;
  schoolyardEntered = true;
  schoolyardDoorOpen = false;
  removeSchoolyardArrows();
  elseAttacks.clear();
  [...projectiles].forEach(removeProjectile);
  buildSchoolyard();
  setSchoolyardLighting(true);
  clearEnemies();
  removeMagicCircle();
  playerMovement.reset(0,38);
  camera.rotation.set(0,Math.PI,0);
  campBoost = false;
  campMovementStartedAt = 0;
  lastPlayerMoveAt = performance.now();
  newProblem();
  createElse();
  feedbackEl.textContent = 'Løs divisioner. Undvig Elses linealer og røde tuscher!';
  feedbackEl.className = 'feedback bad';
}

function spawnStompWave(enemy) {
  const matWave = new THREE.MeshBasicMaterial({ color:0xffd26f, transparent:true, opacity:.72, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(1.3,1.7,48), matWave);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(enemy.group.position.x,.05,enemy.group.position.z);
  scene.add(mesh);
  stompWaves.push({ mesh, age:0 });
  stompShakeUntil = performance.now() + 260;
  playStompSound();
}
function updateStompWaves(dt, time) {
  for (const wave of [...stompWaves]) {
    wave.age += dt;
    const s = 1 + wave.age * 7;
    wave.mesh.scale.setScalar(s);
    wave.mesh.material.opacity = Math.max(0,.72 - wave.age * 1.8);
    if (wave.age > .42) {
      scene.remove(wave.mesh);
      wave.mesh.geometry.dispose();
      wave.mesh.material.dispose();
      stompWaves.splice(stompWaves.indexOf(wave),1);
    }
  }
  if (time < stompShakeUntil) {
    const amount = 4;
    canvas.style.transform = `translate(${(Math.random()-.5)*amount}px,${(Math.random()-.5)*amount}px)`;
  } else {
    canvas.style.transform = '';
  }
}

function enemyBlocked(next) {
  const radius = schoolyardEntered ? 1.2 : .5;
  const sphere = new THREE.Sphere(new THREE.Vector3(next.x,1,next.z), radius);
  return colliders.some(c => c.intersectsSphere(sphere));
}
function updateHUD() {
  livesEl.textContent = '♥ '.repeat(lives).trim() || '0';
  ammoEl.textContent = ammo;
  scoreEl.textContent = score;
  updateBossHud();
}
function flash(id) {
  const el = document.getElementById(id);
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
function hurt(enemy, projectileHit = false) {
  const now = performance.now();
  if (!gameActive || divisionChallenge?.active || (!projectileHit && now < invulnerableUntil)) return;
  invulnerableUntil = now + 1200;
  lives--;
  flash('damage-flash');
  updateHUD();
  if (enemy?.type === 'gunnar') enemy.group.position.copy(pickSpawnPosition());
  else if (enemy?.type === 'else') enemy.group.position.set(0,0,60);
  else if (enemy) removeEnemy(enemy);
  if (lives <= 0) {
    gameActive = false;
    controls.unlock();
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over').classList.add('open');
    elseAttacks.clear();
    return;
  }
  if (!schoolyardEntered && enemies.length === 0 && !schoolyardDoorOpen) spawnWave(1,true);
}
function submitAnswer() {
  if (divisionChallenge?.active) {
    submitDivisionAnswer();
    return;
  }
  if (!problem || !answer) return;
  if (Number(answer) === problem.answer) {
    ammo++;
    feedbackEl.textContent = 'KORREKT! +1 BLYANT ✎';
    feedbackEl.className = 'feedback good';
    updateHUD();
    setTimeout(() => { if (gameActive && !divisionChallenge?.active) newProblem(); },420);
  } else {
    feedbackEl.textContent = 'Forkert. Prøv igen.';
    feedbackEl.className = 'feedback bad';
    answer = '';
    answerEl.textContent = '_';
  }
}
function updateCamping(now, moved) {
  if (divisionChallenge?.active || schoolyardEntered || schoolyardDoorOpen) {
    lastPlayerMoveAt = now;
    campMovementStartedAt = 0;
    return;
  }
  if (moved) {
    lastPlayerMoveAt = now;
    if (campBoost) {
      if (!campMovementStartedAt) campMovementStartedAt = now;
      if (now - campMovementStartedAt >= 2000) {
        campBoost = false;
        campMovementStartedAt = 0;
        feedbackEl.textContent = 'Du slap væk fra camping-straffen.';
        feedbackEl.className = 'feedback good';
      }
    }
    return;
  }
  campMovementStartedAt = 0;
  if (!campBoost && enemies.some(e => e.type === 'erling') && now - lastPlayerMoveAt >= 5000) {
    campBoost = true;
    speakLine('Du CAMPER! Jeg HAR dig!', { rate:.9, pitch:.62, volume:1 });
    feedbackEl.textContent = 'CAMPING! Erling løber nu 3× hurtigere. Bevæg dig i 2 sekunder!';
    feedbackEl.className = 'feedback bad';
  }
}

addEventListener('keydown', e => {
  if (multiplayer?.active) {
    if (e.code === 'KeyM' && !e.repeat && !/INPUT|TEXTAREA/.test(e.target?.tagName)) toggleMusic();
    multiplayer.keydown(e);
    return;
  }
  if (/INPUT|TEXTAREA/.test(e.target?.tagName)) return;
  keys[e.code] = true;
  if (gameActive && /^(Control|Shift|Key[WASD]|Space|Digit|Numpad|Enter|Backspace)/.test(e.code)) e.preventDefault();
  if (e.code === 'KeyM' && !e.repeat) {
    toggleMusic();
    return;
  }
  if (e.code === 'Space' && !e.repeat && gameActive) {
    playerMovement.jump();
    e.preventDefault();
  }
  if (/^Digit\d$/.test(e.code) && gameActive) {
    if (answer.length < 3) {
      answer += e.code.slice(-1);
      answerEl.textContent = answer;
    }
  }
  if (e.code === 'Backspace' && gameActive) {
    answer = answer.slice(0,-1);
    answerEl.textContent = answer || '_';
  }
  if (e.code === 'Enter' && gameActive) submitAnswer();
});
addEventListener('keyup', e => keys[e.code] = false);
function clearMovementKeys() { for (const key of Object.keys(keys)) delete keys[key]; }
addEventListener('blur', clearMovementKeys);
addEventListener('mousedown', e => { if (e.button === 0) firePencil(); });
canvas.addEventListener('click', () => { if (gameActive && !controls.isLocked) controls.lock(); });
controls.addEventListener('lock', () => document.getElementById('pointer-note').classList.remove('show'));
controls.addEventListener('unlock', () => { clearMovementKeys(); if (gameActive) document.getElementById('pointer-note').classList.add('show'); });

function resetGame(online = false) {
  elseAttacks.clear();
  [...projectiles].forEach(removeProjectile);
  invulnerableUntil = 0;
  setSchoolyardLighting(false);
  lives = 5;
  ammo = 0;
  score = 0;
  erlingKills = 0;
  campBoost = false;
  campMovementStartedAt = 0;
  lastPlayerMoveAt = performance.now();
  magicCircleTriggered = false;
  divisionChallenge = null;
  schoolyardDoorOpen = false;
  schoolyardEntered = false;
  elseBoss = null;
  lastElseVoiceAt = 0;
  removeMagicCircle();
  removeSchoolyardArrows();
  if (schoolyardDoor) schoolyardDoor.visible = false;
  playerMovement.reset(0,18);
  camera.rotation.set(0,0,0);
  updateHUD();
  clearEnemies();
  newProblem();
  if (!online) spawnWave(1,true);
}

startButton.addEventListener('click', () => {
  if (!erlingTexture || !gunnarTexture || !elseTexture) {
    loadCharacters();
    return;
  }
  if (!playerRulesReady) return;
  document.getElementById('start-overlay').classList.remove('open');
  gameActive = true;
  ensureMusic();
  audioCtx?.resume();
  resetGame();
  controls.lock();
});

document.getElementById('restart-button').addEventListener('click', () => {
  document.getElementById('game-over').classList.remove('open');
  gameActive = true;
  ensureMusic();
  audioCtx?.resume();
  resetGame();
  controls.lock();
});

function update(dt, time) {
  if (multiplayer?.active) { multiplayer.update(dt,time); return; }
  if (!gameActive) return;
  const moved = playerMovement.update(dt);
  updateCamping(time,moved);
  updateSchoolyardArrows(time);

  if (schoolyardDoorOpen && !schoolyardEntered && Math.abs(camera.position.x) < 1.9 && camera.position.z > 24.45) enterSchoolyard();

  if (magicCircle) {
    magicCircle.group.rotation.y += dt * .75;
    magicCircle.inner.rotation.z -= dt * 1.4;
    magicCircle.light.intensity = 2.7 + Math.sin(time * .006) * .7;
    if (!divisionChallenge?.active && new THREE.Vector2(camera.position.x - magicCircle.group.position.x, camera.position.z - magicCircle.group.position.z).length() < 2.05) startDivisionChallenge(time);
  }

  if (divisionChallenge?.active) {
    const left = Math.max(0, divisionChallenge.endsAt - time);
    feedbackEl.textContent = `${(left/1000).toFixed(1).replace('.',',')} sekunder · ${divisionChallenge.correct}/3 korrekte`;
    feedbackEl.className = 'feedback good';
    if (left <= 0) finishDivisionChallenge(false);
  } else {
    for (const enemy of [...enemies]) {
      if (!enemies.includes(enemy)) continue;
      const ep = enemy.group.position;
      const previousX = ep.x, previousZ = ep.z;
      const toPlayer = new THREE.Vector3(camera.position.x - ep.x, 0, camera.position.z - ep.z);
      const dist = toPlayer.length();
      if (dist > .01) {
        toPlayer.normalize();
        let enemySpeed = enemy.speed || 1.35;
        if (enemy.type === 'erling' && campBoost) enemySpeed *= 3;
        const step = toPlayer.multiplyScalar(enemySpeed * dt);
        const nx = ep.clone().add(new THREE.Vector3(step.x,0,0));
        const nz = ep.clone().add(new THREE.Vector3(0,0,step.z));
        if (!enemyBlocked(nx)) ep.x = nx.x;
        if (!enemyBlocked(nz)) ep.z = nz.z;
      }
      const distanceMoved = Math.hypot(ep.x - previousX, ep.z - previousZ);
      if (enemy.type === 'gunnar') animateGunnar(enemy,dt,time,distanceMoved);
      else if (enemy.type === 'else') animateElse(enemy,dt,time,distanceMoved,() => spawnStompWave(enemy));
      else animateErling(enemy,dt,time,distanceMoved);
      enemy.group.lookAt(camera.position.x,0,camera.position.z);
      if (enemy.type === 'else' && schoolyardEntered && gameActive) {
        enemy.throwCooldown -= dt;
        if (enemy.throwCooldown <= 0) {
          elseAttacks.throwAt(enemy, camera.position);
          enemy.throwCooldown = ELSE_THROW_INTERVAL;
        }
      }
      const hitDistance = enemy.type === 'else' ? 3.25 : 1.15;
      if (dist < hitDistance) hurt(enemy);
    }
    maybeSpeakWhileMoving(time);
  }

  if (!gameActive) return;
  updateProjectiles(dt);
  if (gameActive && schoolyardEntered) elseAttacks.update(dt,camera.position,playerMovement.bounds);
  updateStompWaves(dt,time);
}

function loop(t) {
  const dt = Math.min((t - last) / 1000, .04);
  last = t;
  update(dt,t);
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

createSchoolyardDoor();
updateHUD();

multiplayer = createOnlineGame({
  scene, camera, controls, colliders, makePencil, flash,
  prepare: () => { gameActive = false; resetGame(true); },
  ready: () => charactersReady && playerRulesReady,
  textures: () => ({ erling:erlingTexture, gunnar:gunnarTexture }),
  startAudio: () => { ensureMusic(); audioCtx?.resume(); },
});
