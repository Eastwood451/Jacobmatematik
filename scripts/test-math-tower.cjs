const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const context = vm.createContext({});
// Exercise the production helpers without starting authentication or the app.
const names = ['matrixDrillIsGreen', 'matrixDrillCellStyle', 'tableDrillSessions', 'additionPairStats', 'subtractionDrillPairStats', 'subtractionDrillExactPairStats', 'subtractionDrillLevelProgress', 'subtractionDrillLevelIndex', 'subtractionDrillTroubleFacts', 'syncSubtractionDrillTroubles', 'numberValueStats', 'drillMastery', 'numberMastery', 'mathTowerBestHeatmap', 'mathTowerNumberStones', 'mathTowerAdditionBricks', 'mathTowerSubtractionStones', 'mathTowerFloorArt', 'renderAdditionExerciseHeatmap', 'renderSubtractionDrillHeatmap', 'additionColumnTokenPresentation', 'additionColumnCurrent', 'additionColumnSlot', 'renderColumnAdditionFigure'];
const functions = names.map(name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end);
});
vm.runInContext(`${source.match(/  const TABLE_DRILL_VALUES = .+;/)[0]}\n${source.match(/  const SINGLE_DIGITS = .+;/)[0]}\nconst state = {subtractionDrillTroubles:null, answered:false};\nconst escapeHtml = value => String(value);\nconst SUBTRACTION_DRILL_SINGLE_FACTS = SINGLE_DIGITS.flatMap(minuend => Array.from({length:minuend + 1}, (_, subtrahend) => ({ minuend, subtrahend, group:0 })));
const SUBTRACTION_DRILL_BRIDGE_FACTS = Array.from({length:9}, (_, index) => index + 10).flatMap(minuend => SINGLE_DIGITS.slice(Math.max(0, minuend - 9), Math.min(9, minuend) + 1).map(subtrahend => ({ minuend, subtrahend, group:0 })));
const SUBTRACTION_DRILL_LEVELS = [
  { name:"Étcifrede minusstykker", hint:"Træk et etcifret tal fra et etcifret tal.", facts:SUBTRACTION_DRILL_SINGLE_FACTS },
  { name:"Til étcifret facit", hint:"Træk et etcifret tal fra 10–18. Svaret skal være etcifret.", facts:SUBTRACTION_DRILL_BRIDGE_FACTS },
  { name:"Blandede minusstykker", hint:"Træk fra uden at gå under nul.", facts:null },
];
const SUBTRACTION_DRILL_ONES_PATTERNS = SINGLE_DIGITS.flatMap(ones => SINGLE_DIGITS.map(subtrahend => ({ones,subtrahend})));\nconst SUBTRACTION_DRILL_TWO_DIGIT_FACTS = Array.from({length:9}, (_, tens) => tens + 1).flatMap(tens => SINGLE_DIGITS.flatMap(ones => SINGLE_DIGITS.map(subtrahend => ({ minuend:tens * 10 + ones, subtrahend, group:tens }))));\n${source.match(/  const recordedTime = .+;/)[0]}\n${source.match(/  const responseTimeColor = \(seconds\) => \{[\s\S]*?\n  \};/)[0]}\n${functions.join('\n')}`, context);
const { matrixDrillIsGreen: green, matrixDrillCellStyle: style, mathTowerBestHeatmap: best, mathTowerNumberStones: numberStones, mathTowerAdditionBricks: additionBricks, mathTowerSubtractionStones: subtractionStones, mathTowerFloorArt: art, renderAdditionExerciseHeatmap: additionHeatmap, renderSubtractionDrillHeatmap: subtractionHeatmap, subtractionDrillTroubleFacts: subtractionTroubles, subtractionDrillLevelProgress: subtractionLevelProgress, subtractionDrillLevelIndex: subtractionLevelIndex, syncSubtractionDrillTroubles: syncTroubles } = context;
const additionTokenPresentation = context.additionColumnTokenPresentation;
const renderAdditionFigure = context.renderColumnAdditionFigure;
const result = (id, row, column, correct = true, responseTime = 3, day = 1) => ({
  topic:'tableDrill', drillSessionId:id, drillRow:row, drillColumn:column,
  correct, responseTime, timestamp:`2026-09-${String(day).padStart(2, '0')}T12:00:00Z`,
});
for (const [attempt, expected] of [[null,false], [{correct:false,responseTime:1},false], [{correct:true,responseTime:4},true], [{correct:true,responseTime:4.001},false], [{correct:true,responseTime:10},false]]) {
  assert.equal(green(attempt), expected);
  assert.equal(style(attempt).includes('138 55% 72%'), expected, 'same green threshold as the heatmap');
}
assert.equal(best({results:[]}).session, null);
assert.equal((art('heatmap', 3, best({results:[]})).match(/class="math-tower-hole"/g) || []).length, 81);
const user = {results:[
  result('older-best',1,1), result('older-best',2,3,true,4), result('older-best',9,9),
  result('older-best',4,4,false,1), result('older-best',5,5,true,4.01),
  result('newer-weaker',1,2,true,2,2),
  {...result('other-topic',1,3,true,1,3), topic:'divisionDrill'},
]};
let selected = best(user);
assert.equal(selected.session.id, 'older-best', 'choose most green cells, not newest or most answers');
assert.equal(selected.bricks, 3);
const svg = art('heatmap', 3, selected);
assert.equal((svg.match(/class="math-tower-brick"/g) || []).length, 3);
assert.equal((svg.match(/class="math-tower-hole"/g) || []).length, 78);
assert.match(svg, /class="math-tower-brick" data-cell="2-3"/);
assert.match(svg, /class="math-tower-hole" data-cell="1-2"/, 'never merge sessions');
assert.match(svg, /class="math-tower-hole" data-cell="4-4"/);
assert.match(svg, /class="math-tower-hole" data-cell="5-5"/);
user.results.push(result('newer-tie',3,1,true,2,3), result('newer-tie',3,2,true,2,3), result('newer-tie',3,3,true,2,3));
assert.equal(best(user).session.id, 'newer-tie', 'newest session wins a tie');
const full = {results:Array.from({length:81}, (_,i) => result('complete',Math.floor(i/9)+1,i%9+1))};
assert.equal(best(full).bricks, 81);
assert.equal((art('heatmap',3,best(full)).match(/class="math-tower-brick"/g) || []).length,81);
assert.equal((art('heatmap',3,best(full)).match(/class="math-tower-hole"/g) || []).length,0);
const numberResult = (number, correct=true, responseTime=5, sequence=1) => ({ topic:'numbers', problem:`Antal ${number}`, correct, responseTime, timestamp:`2026-09-20T12:00:${String(sequence).padStart(2,'0')}Z` });
const numberUser = {results:[
  ...[1,2,3].map(sequence => numberResult(0, true, 4, sequence)),
  ...[4,5,6].map(sequence => numberResult(10, true, 5, sequence)),
  ...[7,8].map(sequence => numberResult(4, true, 4, sequence)),
]};
const towerNumbers = numberStones(numberUser);
assert.equal(towerNumbers.stones.length, 11);
assert.equal(towerNumbers.built, 2, 'a number becomes a stone after three quick correct answers');
assert.equal(towerNumbers.stones[0].stage, 'silver');
assert.equal(towerNumbers.stones[10].stage, 'silver');
assert.equal(towerNumbers.stones[4].stage, 'none');
const numberSvg = art('number-stones', 6, null, towerNumbers);
assert.equal((numberSvg.match(/class="math-tower-number-stone"/g) || []).length, 2);
assert.equal((numberSvg.match(/class="math-tower-number-hole"/g) || []).length, 9);
assert.match(numberSvg, /data-number="0"/);
assert.match(numberSvg, /data-number="10"/);
assert.match(numberSvg, />10<\/text>/);
const additionResult = (left, right, correct=true, responseTime=4, sequence=1) => ({ topic:'addition', problem:`${left} + ${right}`, correct, responseTime, timestamp:`2026-09-21T12:00:${String(sequence).padStart(2,'0')}Z` });
const additionUser = {results:[
  ...[1,2,3].map(sequence => additionResult(0, 1, true, 4, sequence)),
  ...[4,5,6].map(sequence => additionResult(9, 5, true, 4, sequence)),
  ...[7,8].map(sequence => additionResult(5, 9, true, 4, sequence)),
  additionResult(2, 2, false, 2, 9),
]};
const towerAddition = additionBricks(additionUser);
assert.equal(towerAddition.built, 2);
const additionSvg = art('addition-bricks', 5, null, null, towerAddition);
assert.equal((additionSvg.match(/class="math-tower-addition-brick"/g) || []).length, 2);
assert.equal((additionSvg.match(/class="math-tower-addition-hole"/g) || []).length, 98);
assert.match(additionSvg, /data-pair="0\+1"/);
assert.match(additionSvg, /data-pair="9\+5"/);
assert.match(additionSvg, /data-pair="5\+9"/);
const additionMap = additionHeatmap(additionUser);
assert.match(additionMap, /Alle étcifrede pluspar/);
assert.match(additionMap, /2\/100/);
assert.match(additionMap, /0 \+ 1: lært/);
assert.match(additionMap, /2 \+ 2: senest forkert/);
const subtractionResult = (minuend, subtrahend, correct=true, responseTime=4, sequence=1) => ({ topic:'subtractionDrill', problem:`${minuend} − ${subtrahend}`, correct, responseTime, timestamp:`2026-09-22T12:00:${String(sequence).padStart(2,'0')}Z` });
const bridgeFacts = vm.runInContext('SUBTRACTION_DRILL_BRIDGE_FACTS', context);
assert.equal(bridgeFacts.length,45, 'niveau 2 contains every teen subtraction with a one-digit answer');
assert.ok(bridgeFacts.every(({minuend,subtrahend}) => minuend >= 10 && minuend <= 18 && subtrahend <= 9 && minuend >= subtrahend && minuend - subtrahend <= 9), 'niveau 2 has no negative or two-digit answers');
const learningUser={results:[]};
assert.equal(subtractionLevelIndex(learningUser),0);
assert.equal(subtractionLevelProgress(learningUser,0).total,55);
const teachFacts=facts=>facts.forEach(fact=>Array.from({length:3},()=>{
  const sequence=learningUser.results.length;
  learningUser.results.push({topic:'subtractionDrill',problem:`${fact.minuend} − ${fact.subtrahend}`,correct:true,responseTime:4,timestamp:new Date(Date.UTC(2026,8,23,12,0,sequence)).toISOString()});
}));
teachFacts(vm.runInContext('SUBTRACTION_DRILL_SINGLE_FACTS', context));
assert.equal(subtractionLevelIndex(learningUser),1, 'mastering all one-digit facts opens level 2');
assert.equal(subtractionLevelProgress(learningUser,1).total,45);
teachFacts(bridgeFacts);
assert.equal(subtractionLevelIndex(learningUser),2, 'mastering all bridge facts opens the existing mixed drill');
const subtractionUser = {results:[
  ...[1,2,3].map(sequence => subtractionResult(9, 5, true, 4, sequence)),
  ...[4,5,6].map(sequence => subtractionResult(10, 0, true, 4, sequence)),
  ...[7,8].map(sequence => subtractionResult(19, 9, true, 4, sequence)),
  subtractionResult(5, 9, true, 1, 9),
]};
const towerSubtraction = subtractionStones(subtractionUser);
assert.equal(towerSubtraction.stones.length, 2);
assert.equal(towerSubtraction.built, 0, 'a group stone requires every valid fact in its group');
assert.equal(towerSubtraction.learnedFacts, 2);
const subtractionSvg = art('subtraction-stones', 4, null, null, null, towerSubtraction);
assert.equal((subtractionSvg.match(/class="math-tower-subtraction-hole"/g) || []).length, 2);
assert.match(subtractionSvg, /data-range="0–9"/);
assert.match(subtractionSvg, /data-range="Ét-mønstre"/);
const subtractionMap = subtractionHeatmap(subtractionUser);
assert.match(subtractionMap, /Minus uden negative svar/);
assert.match(subtractionMap, /2\/155/);
assert.match(subtractionMap, /9 − 5: lært/);
assert.match(subtractionMap, /5 − 9 giver et negativt tal og øves ikke/);
assert.match(subtractionMap, /Ét-mønstre/);
const troubleUser={results:[
  subtractionResult(8,3,false,2,1), subtractionResult(8,3,true,3,2),
  subtractionResult(52,7,false,2,3),
  subtractionResult(4,1,false,8,4),
  subtractionResult(7,2,false,6,5),
  subtractionResult(5,0,false,7,6),
  subtractionResult(6,2,false,2,4), subtractionResult(6,2,true,3,5), subtractionResult(6,2,true,3,6), subtractionResult(6,2,true,3,7),
]};
const allTroubles=subtractionTroubles(troubleUser);
assert.equal(allTroubles.length,5);
assert.equal(new Set(allTroubles.slice(0,3).map(fact=>fact.key)).size,3, 'the trouble round starts with three unique facts');
assert.ok(allTroubles[0].severity >= allTroubles[1].severity, 'worst facts are sorted first');
vm.runInContext(`state.subtractionDrillTroubles=${JSON.stringify(allTroubles.slice(0,3).map(fact=>fact.key))}`, context);
const retired=allTroubles[0];
const retiredMinuend=retired.type === 'ones' ? 10 + retired.ones : retired.minuend;
for (const sequence of [20,21,22]) troubleUser.results.push(subtractionResult(retiredMinuend, retired.subtrahend, true, 3, sequence));
const nextTroubles=syncTroubles(troubleUser);
assert.equal(nextTroubles.length,3, 'the active round stays capped at three');
assert.ok(!nextTroubles.some(fact=>fact.key === retired.key), 'a learned trouble leaves the active round');
assert.ok(nextTroubles.some(fact=>fact.key === allTroubles[3].key || fact.key === allTroubles[4].key), 'the next trouble enters after one is learned');
vm.runInContext('state.subtractionDrillTroubles=null', context);
assert.match(subtractionHeatmap(troubleUser),/Øv drillere \(3\)/);
assert.match(subtractionHeatmap(troubleUser),/tidligere er besvaret forkert/);
const exampleTask = { a:26, b:15 };
const onesToken = additionTokenPresentation({ id:'result-ones', value:1 }, { total:11, bottom:5 }, exampleTask);
assert.equal(onesToken.caption, 'ener');
assert.equal(onesToken.heading, 'Hvor skal ener-cifret fra 11 hen?');
assert.equal(onesToken.instruction, 'Træk ener-cifret 1 ned under 5.');
const tensCarryToken = additionTokenPresentation({ id:'carry-tens', value:1 }, { total:11, bottom:5 }, exampleTask);
assert.equal(tensCarryToken.caption, '10');
assert.equal(tensCarryToken.heading, 'Hvor skal 10-eren hen?');
assert.equal(tensCarryToken.instruction, 'Træk tierens 1-tal op over 2.');
const hundredsCarryToken = additionTokenPresentation({ id:'result-hundreds', value:1 }, { total:11, bottom:8 }, { a:18, b:22 });
assert.equal(hundredsCarryToken.caption, '100');
assert.equal(hundredsCarryToken.instruction, 'Træk 1-tallet til 100-pladsen i resultatet.');
const placementFigure = renderAdditionFigure({
  a:26, b:15, answer:41, columnIndex:0, carries:[], placed:{}, phase:'place-result',
  tokens:[{id:'result-ones',value:1,kind:'result'},{id:'carry-tens',value:1,kind:'carry'}],
  activeTokenIndex:0, pendingDestination:'result-ones',
});
assert.match(placementFigure, /aria-label="1 som ener-ciffer"/);
assert.match(placementFigure, /<small class="column-addition-token-place">ener<\/small>/);
assert.match(placementFigure, /<small class="column-addition-token-place">10<\/small>/);
assert.match(placementFigure, /data-addition-drop="result-ones"/);
const carryTokenMarkup = placementFigure.match(/<button[^>]*data-addition-token="carry-tens"[^>]*>/)?.[0] || "";
const onesTokenMarkup = placementFigure.match(/<button[^>]*data-addition-token="result-ones"[^>]*>/)?.[0] || "";
assert.ok(carryTokenMarkup && onesTokenMarkup && placementFigure.indexOf(carryTokenMarkup) < placementFigure.indexOf(onesTokenMarkup), 'tier-brikken står til venstre for ener-brikken');
assert.match(carryTokenMarkup, / disabled>/, 'tier-brikken forbliver inaktiv, mens ener-brikken trækkes');
assert.match(onesTokenMarkup, /class="column-addition-token ready "/, 'ener-brikken forbliver aktiv');
console.log('PASS: heatmaps, tower floors and rendered guided addition tokens.');
