const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const context = vm.createContext({});
// Exercise the production helpers without starting authentication or the app.
const names = ['matrixDrillIsGreen', 'matrixDrillCellStyle', 'tableDrillSessions', 'mathTowerBestHeatmap', 'mathTowerFloorArt'];
const functions = names.map(name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end);
});
vm.runInContext(`${source.match(/  const TABLE_DRILL_VALUES = .+;/)[0]}\n${source.match(/  const recordedTime = .+;/)[0]}\n${functions.join('\n')}`, context);
const { matrixDrillIsGreen: green, matrixDrillCellStyle: style, mathTowerBestHeatmap: best, mathTowerFloorArt: art } = context;
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
console.log('PASS: heatmap green boundary, empty/full floors, best-session selection, ties, wrong/slow answers, exact cell positions and no merging across sessions.');
