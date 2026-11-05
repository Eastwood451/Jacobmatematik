/* Vinkler-gating: kun Jacobs profiler ser modulet (spejler Skak #50). */
const assert = require("assert"); const fs = require("fs"); const vm = require("vm");
const app = fs.readFileSync("app.js", "utf8");
const gate = app.match(/const ANGLES_PROFILE_IDS = [^\n]+\n\s*const canLearnAngles = [^\n]+/)[0];
const gateFn = vm.runInNewContext(`(state => { ${gate}; return canLearnAngles; })`, {});
const can = user => gateFn({ user })();
assert.equal(can({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "teacher" }), true, "jacob (lærer) ser vinkler");
assert.equal(can({ id: "3af639de-b0e0-496a-a5b7-b732e49d1fa7", role: "student" }), true, "jacob (elev) ser vinkler");
assert.equal(can({ id: "11111111-2222-3333-4444-555555555555", role: "student" }), false, "anden elev");
assert.equal(can({ id: "99999999-2222-3333-4444-555555555555", role: "teacher" }), false, "anden lærer");
assert.equal(can({ id: "guest-1", role: "guest" }), false, "gæst");
assert.equal(can({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "guest" }), false, "gæst-rolle");
assert.equal(can(null), false, "ikke logget ind");
assert.match(app, /return canLearnAngles\(\) \? `<button[^`]*data-action="angles"/, "kortet er gated");
assert.match(app, /if \(!canLearnAngles\(\)\) \{ state\.view=/, "renderAngles er gated");
assert.match(app, /action === "angles" \? canLearnAngles/, "action er gated");
assert.match(app, /angles:'\[data-action="angles"\]'/, "deeplink klikker kun kortet (findes ikke for andre → normal start)");
console.log("angles gating checks passed");
