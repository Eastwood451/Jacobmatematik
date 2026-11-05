const assert = require("assert");
const core = require("../angles-core.js");

assert.equal(core.normalizeDeg(-90), 270);
assert.equal(core.wedgeBetween(0, 90), 90);
assert.equal(core.wedgeBetween(10, 350), 20);
assert.equal(core.swipeAngleVsReference(0, 0, 10, 0, 0), 0);
assert.ok(core.withinTolerance(58, 60, 2));
assert.equal(core.hintDirection(50, 60), "more");

const a45 = core.anglesForIncrement(45, 16);
assert.equal(a45.length, 16);
assert.ok(a45.every((d) => d % 45 === 0 || d === 180));

const tiles = core.makeAngleTiles(30, 16, true);
assert.equal(tiles.length, 16);
assert.ok(tiles.every((t) => typeof t.baseDeg === "number"));

const few = core.anglesForIncrement(90, 16);
assert.equal(few.length, 16); // pads with repeats
assert.deepEqual(core.ROUND_INCREMENTS, [45, 30, 15, 10, 5]);
assert.equal(core.SHIP_COUNT, 5);

console.log("angles-core checks passed");
