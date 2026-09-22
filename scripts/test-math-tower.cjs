const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const context = vm.createContext({});
// Exercise the production helpers without starting authentication or the app.
const names = ['matrixDrillIsGreen', 'matrixDrillCellStyle', 'tableDrillSessions', 'additionPairStats', 'subtractionDrillPairStats', 'numberValueStats', 'drillMastery', 'numberMastery', 'mathTowerBestHeatmap', 'mathTowerNumberStones', 'mathTowerAdditionBricks', 'mathTowerSubtractionStones', 'mathTowerFloorArt', 'renderAdditionExerciseHeatmap', 'renderSubtractionDrillHeatmap'];
const functions = names.map(name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end);
});
vm.runInContext(`${source.match(/  const TABLE_DRILL_VALUES = .+;/)[0]}\n${source.match(/  const SINGLE_DIGITS = .+;/)[0]}\nconst SUBTRACTION_DRILL_SINGLE_FACTS = SINGLE_DIGITS.flatMap(minuend => Array.from({length:minuend + 1}, (_, subtrahend) => ({ minuend, subtrahend, group:0 })));\nconst SUBTRACTION_DRILL_TWO_DIGIT_FACTS = Array.from({length:9}, (_, tens) => tens + 1).flatMap(tens => SINGLE_DIGITS.flatMap(ones => SINGLE_DIGITS.map(subtrahend => ({ minuend:tens * 10 + ones, subtrahend, group:tens }))));\n${source.match(/  const recordedTime = .+;/)[0]}\n${source.match(/  const responseTimeColor = \(seconds\) => \{[\s\S]*?\n  \};/)[0]}\n${functions.join('\n')}`, context);
const { matrixDrillIsGreen: green, matrixDrillCellStyle: style, mathTowerBestHeatmap: best, mathTowerNumberStones: numberStones, mathTowerAdditionBricks: additionBricks, mathTowerSubtractionStones: subtractionStones, mathTowerFloorArt: art, renderAdditionExerciseHeatmap: additionHeatmap, renderSubtractionDrillHeatmap: subtractionHeatmap } = context;
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
const subtractionUser = {results:[
  ...[1,2,3].map(sequence => subtractionResult(9, 5, true, 4, sequence)),
  ...[4,5,6].map(sequence => subtractionResult(10, 0, true, 4, sequence)),
  ...[7,8].map(sequence => subtractionResult(19, 9, true, 4, sequence)),
  subtractionResult(5, 9, true, 1, 9),
]};
const towerSubtraction = subtractionStones(subtractionUser);
assert.equal(towerSubtraction.stones.length, 10);
assert.equal(towerSubtraction.built, 0, 'a tens stone requires every valid fact in its group');
assert.equal(towerSubtraction.learnedFacts, 2);
const subtractionSvg = art('subtraction-stones', 4, null, null, null, towerSubtraction);
assert.equal((subtractionSvg.match(/class="math-tower-subtraction-hole"/g) || []).length, 10);
assert.match(subtractionSvg, /data-range="0–9"/);
assert.match(subtractionSvg, /data-range="10–19"/);
const subtractionMap = subtractionHeatmap(subtractionUser);
assert.match(subtractionMap, /Minus uden negative svar/);
assert.match(subtractionMap, /2\/955/);
assert.match(subtractionMap, /9 − 5: lært/);
assert.match(subtractionMap, /5 − 9 giver et negativt tal og øves ikke/);
assert.match(subtractionMap, /10–19/);
console.log('PASS: heatmap, number, addition and subtraction tower floors: ordered facts, mastery thresholds, no negative subtraction, holes and exact cells.');
