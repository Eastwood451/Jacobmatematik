/* The Quest: bælteberegning, gating og én-gang-ceremoni. Ingen browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const Q = require(path.join(root, 'quest.js'));
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'module-loader.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'quest.css'), 'utf8');
const questSrc = fs.readFileSync(path.join(root, 'quest.js'), 'utf8');

// 1) Otte bælter i striben – men kun hvidt → blåt kan opnås nu.
assert.deepEqual(Q.BELTS.map(b => b.key), ['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black']);
assert.equal(Q.ATTAINABLE, 5, 'blåt er loftet');
assert.deepEqual(Q.BELTS.slice(0, 5).map(b => b.floor), ['Tælle', 'Plus', '10’er-venner', 'Minus', 'Gange']);
const towerLabels = [...app.slice(app.indexOf('const MATH_TOWER_LEVELS'), app.indexOf('function mathTowerStage')).matchAll(/label:"([^"]+)"/g)].map(m => m[1]).reverse();
assert.deepEqual(Q.BELTS.slice(0, 5).map(b => b.floor), towerLabels.slice(0, 5), 'opnåelige bælter følger tårnets nederste fem etager');
assert.ok(Q.BELTS.slice(5).every(b => b.locked && b.floor === null), 'lilla, brunt og sort er låst og knyttet til ingen etage');
assert.equal(Q.THRESHOLD, 60, 'bælte ved Bindingsværk');
assert.match(app, /if \(score >= 60\) return \{ key:"timber", name:"Bindingsværk" \}/);
assert.equal(new Set(Q.BELTS.map(b => b.line.da)).size, 8);
assert.equal(new Set(Q.BELTS.map(b => b.line.en)).size, 8);
assert.ok(Q.BELTS.every(b => b.reply.da && b.reply.en && b.en.endsWith('belt')));
assert.match(Q.BELTS[0].line.da, /tommelfinger-tælling er hermed pensioneret/);
assert.match(Q.BELTS[4].reply.da, /kommer flere prøver/, 'blå-replikken antyder mere');
assert.match(questSrc, /Sort bælte: Du kan alt, hvad 9\. klasses afgangsprøve kræver/);
assert.match(questSrc, /Black belt: you master everything the Danish 9th-grade final exam requires/);
assert.match(questSrc, /Kommer, når flere emner er bygget/);
assert.match(questSrc, /Du har det højeste bælte lige nu\. Flere prøver er på vej\./);
assert.doesNotMatch(questSrc + css, /kill ?bill|yoda|skywalker|star wars|jedi|tarantino|hattori/i);

// 2) Beregning.
const floor = (score, units = null) => ({ score, units });
const empty = Array.from({ length: 8 }, () => floor(0));
let q = Q.computeQuest(empty, 0);
assert.equal(q.earnedNow, 0); assert.equal(q.held, 0); assert.equal(q.current, -1); assert.equal(q.next, 0); assert.equal(q.top, false);
const counting = (built) => floor(built / 11 * 100, { built, total: 11, kind: 'stones' });
q = Q.computeQuest([counting(2), ...empty.slice(1)], 0);
assert.deepEqual([q.missing.kind, q.missing.n, q.missing.needed], ['stones', 5, 7], '7 af 11 sten = 60 %');
assert.equal(Q.missingText(q, 'da'), '5 sten mere i Tælle');
assert.equal(Q.missingText(q, 'en'), '5 more stones in Counting');
q = Q.computeQuest([counting(7), floor(48, { built: 48, total: 100, kind: 'bricks' }), ...empty.slice(2)], 0);
assert.equal(q.earnedNow, 1, 'Tælle på 7/11 giver hvidt bælte');
assert.equal(Q.missingText(q, 'da'), '12 mursten mere i Plus');
q = Q.computeQuest([counting(11), floor(60, { built: 60, total: 100, kind: 'bricks' }), floor(59.6), ...empty.slice(3)], 0);
assert.equal(q.earnedNow, 2);
assert.equal(Q.missingText(q, 'da'), '1 procentpoint mere i 10’er-venner (nu 59 %)');
q = Q.computeQuest([floor(10), floor(100), floor(100), floor(100), floor(100), floor(100), floor(100), floor(100)], 0);
assert.equal(q.earnedNow, 0, 'rækkefølge nedefra');
q = Q.computeQuest([floor(100), floor(100), floor(100), floor(100), floor(48 / 81 * 100, { built: 48, total: 81, kind: 'bricks' }), ...empty.slice(5)], 0);
assert.equal(q.next, 4); assert.equal(q.missing.n, 1, '49/81 til blåt');
// Blåt er loft: 100 % på alle etager giver ikke lilla, brunt eller sort.
q = Q.computeQuest(Array.from({ length: 8 }, () => floor(100)), 0);
assert.equal(q.earnedNow, 5); assert.equal(q.held, 5); assert.equal(q.current, 4); assert.equal(q.next, -1); assert.equal(q.missing, null); assert.equal(q.top, true);
q = Q.computeQuest(Array.from({ length: 8 }, () => floor(100)), 8);
assert.equal(q.held, 5, 'et gammelt gemt tal over blåt giver ikke låste bælter');
// Division/Regnehierarki/Negative tal giver intet bælte, selv ved 100 %.
q = Q.computeQuest([floor(100), floor(100), floor(100), floor(100), floor(0), floor(100), floor(100), floor(100)], 0);
assert.equal(q.held, 4); assert.equal(q.next, 4);
// Et bælte, man har fået, beholder man.
q = Q.computeQuest([counting(11), floor(10), ...empty.slice(2)], 3);
assert.equal(q.earnedNow, 1); assert.equal(q.held, 3); assert.equal(q.next, 3);

// 3) Én gang pr. bælte pr. bruger, ingen kaskade.
function memory() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; }
let s = memory();
assert.equal(Q.pendingCeremony(s, 'u1', 0), -1, 'ny bruger uden bælte: ingen ceremoni');
assert.equal(s.getItem(Q.STORAGE_PREFIX + 'u1'), '0');
assert.equal(Q.pendingCeremony(s, 'u1', 1), 0, 'hvidt bælte fejres');
assert.equal(Q.pendingCeremony(s, 'u1', 1), -1, 'kun én gang');
assert.equal(Q.pendingCeremony(s, 'u1', 3), 2, 'to nye bælter på én gang: kun det højeste vises');
assert.equal(Q.pendingCeremony(s, 'u1', 3), -1);
assert.equal(Q.pendingCeremony(s, 'u1', 2), -1, 'faldende score giver ingen ny ceremoni');
assert.equal(Q.readSeen(s, 'u1'), 3, 'bæltet beholdes');
assert.equal(Q.pendingCeremony(s, 'u2', 1), 0, 'nøglet på bruger-id');
s = memory();
assert.equal(Q.pendingCeremony(s, 'u3', 5), 4, 'første visning med eksisterende bælter: kun det højeste (blåt)');
assert.equal(Q.readSeen(s, 'u3'), 5);
assert.equal(Q.pendingCeremony(s, 'u3', 5), -1);
assert.equal(Q.pendingCeremony(s, 'u3', 8), -1, 'ingen ceremoni over blåt');
s = memory();
assert.equal(Q.pendingCeremony(s, 'u5', 8), 4, 'selv 8 etager giver højst blå-ceremonien');
s.setItem(Q.STORAGE_PREFIX + 'u6', '8');
assert.equal(Q.readSeen(s, 'u6'), 5);
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
assert.equal(Q.pendingCeremony(broken, 'u4', 1), 0, 'blokeret localStorage må ikke crashe');

// Låste ceremonier kan ikke udløses (ingen DOM nødvendig: afvises før dokumentet bruges).
for (const i of [5, 6, 7, 99]) assert.equal(Q.showCeremony(i), null, `ceremoni ${i} er utilgængelig`);

// 4) Bælte-SVG.
assert.match(Q.beltSvg(Q.BELTS[1]), /#ffd23f/);
assert.match(Q.beltSvg(null), /stroke-dasharray/);
assert.match(Q.beltSvg(Q.BELTS[7]), /#d4a017/, 'sort bælte har guldmærker');

// 5) Gating og hook i app.js.
const ids = app.match(/const QUEST_PROFILE_IDS = new Set\((\[[^\]]+\])\)/);
assert.ok(ids, 'QUEST_PROFILE_IDS findes');
const anglesIds = app.match(/const ANGLES_PROFILE_IDS = new Set\((\[[^\]]+\])\)/);
assert.deepEqual(JSON.parse(ids[1]).sort(), JSON.parse(anglesIds[1]).sort(), 'samme to profiler som Vinkler-betaen');
assert.equal(JSON.parse(ids[1]).length, 2);
const gateSrc = app.match(/const canSeeQuest = (user => [^;]+);/)[1];
const canSeeQuest = new Function('QUEST_PROFILE_IDS', `return ${gateSrc};`)(new Set(JSON.parse(ids[1])));
assert.equal(canSeeQuest({ id: 'c8b8e1c4-3264-40e9-a43d-0eb6214a0183', role: 'student' }), true);
assert.equal(canSeeQuest({ id: '3af639de-b0e0-496a-a5b7-b732e49d1fa7', role: 'teacher' }), true);
assert.equal(canSeeQuest({ id: 'someone-else', role: 'student' }), false);
assert.equal(canSeeQuest({ id: 'c8b8e1c4-3264-40e9-a43d-0eb6214a0183', role: 'guest' }), false);
assert.equal(canSeeQuest(null), false);
assert.match(app, /\$\{canSeeQuest\(state\.user\) \? `<section id="quest-root"/, 'slot kun for gatede profiler');
const towerStart = app.indexOf('function renderMathTower(');
assert.ok(app.indexOf('id="quest-root"', towerStart) < app.indexOf('Byg din viden', towerStart), 'Quest-kortet står over BYG DIN VIDEN');
assert.match(app, /mountQuest\(availableTopics\);/);
assert.match(loader, /quest: \{ css: \["quest\.css\?v=[^"]+"\], js: \["quest\.js\?v=[^"]+"\], ready: \(\) => !!window\.JacobQuest \}/);
// Beskyttede gates er uændrede.
assert.match(app, /const canLearnAngles = \(\) => gameModuleEnabled\(state\.user\);/);
assert.match(app, /const gameModuleEnabled = user => Boolean\(user\?\.id && \["student","teacher","guest"\]\.includes\(user\.role\)\);/);
// Tilgængelighed.
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(questSrc, /aria-modal/);
assert.match(questSrc, /Jeg er klar til næste prøve/);

console.log('test-quest: ok');
