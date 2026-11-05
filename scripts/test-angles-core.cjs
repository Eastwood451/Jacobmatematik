/* Pure helpers for the Vinkler module. */
const assert = require('node:assert/strict');
const C = require('../angles-core.js');

assert.equal(C.normalizeDeg(370), 10);
assert.equal(C.normalizeDeg(-10), 350);
assert.equal(C.withinTolerance(58, 60, 2), true);
assert.equal(C.withinTolerance(57, 60, 2), false);
assert.equal(C.withinTolerance(52, 45, 8), true);
assert.equal(C.hintDirection(30, 60), 'more');
assert.equal(C.hintDirection(70, 60), 'less');
assert.equal(C.hintDirection(60, 60), 'ok');
assert.deepEqual(C.PRECISE_TASKS, [60, 45, 15]);
assert.deepEqual(C.FEEL_TASKS, [45, 90, 60]);
assert.equal(C.PIPE_TARGET, 60);

// angleFromPoint: east of centre → 0; north → 90; west → 180
assert.equal(C.angleFromPoint(100, 100, 200, 100), 0);
assert.equal(C.angleFromPoint(100, 100, 100, 0), 90);
assert.equal(C.angleFromPoint(100, 100, 0, 100), 180);
assert.ok(C.angleFromPoint(100, 100, 170, 30) > 40 && C.angleFromPoint(100, 100, 170, 30) < 80);

console.log('angles-core checks passed');
