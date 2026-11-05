/* Games are reached only via gated Vinkler hub (canLearnAngles). */
const assert = require("assert");
const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const ml = fs.readFileSync("module-loader.js", "utf8");
const angles = fs.readFileSync("angles.js", "utf8");

assert.match(app, /ANGLES_PROFILE_IDS/);
assert.match(app, /canLearnAngles/);
assert.match(app, /data-action="angles"/);
assert.match(ml, /"angle-battleship"/);
assert.match(ml, /"angle-dennis"/);
assert.match(ml, /"angle-ninja"/);
assert.match(ml, /"angle-words"/);
assert.match(ml, /"angle-stop"/);
assert.match(angles, /data-ang-hub="battleship"/);
assert.match(angles, /data-ang-hub="dennis"/);
assert.match(angles, /data-ang-hub="ninja"/);
assert.match(angles, /data-ang-hub="words"/);
assert.match(angles, /data-ang-hub="stop"/);
assert.match(angles, /loadGameModule/);
// No ungated topic cards for the three games
assert.doesNotMatch(app, /data-action="angle-battleship"/);
assert.doesNotMatch(app, /data-action="angle-ninja"/);
assert.doesNotMatch(app, /data-action="dennis_blindfold"/);

const bs = fs.readFileSync("angle-battleship.js", "utf8");
const den = fs.readFileSync("angle-dennis.js", "utf8");
const nin = fs.readFileSync("angle-ninja.js", "utf8");
const words = fs.readFileSync("angle-words.js", "utf8");
const stop = fs.readFileSync("angle-stop.js", "utf8");
assert.match(bs, /exercise_id: EX_ID|exercise_id: "angle_battleship"/);
assert.match(bs, /angle_battleship/);
assert.match(den, /dennis_blindfold/);
assert.match(nin, /angle_ninja/);
assert.match(words, /angle_words/);
assert.match(stop, /angle_stop/);
assert.match(stop, /exercise_id: EX_ID|exercise_id: "angle_stop"/);
assert.match(bs, /jmTrack/);
assert.match(den, /jmTrack/);
assert.match(nin, /jmTrack/);
assert.match(words, /jmTrack/);
assert.match(stop, /jmTrack/);
assert.match(stop, /jm_angle_stop_best/);
assert.match(stop, /STOP!/);

console.log("angle games gating checks passed");
