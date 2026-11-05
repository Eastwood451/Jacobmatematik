/* Brøk-løb: spørgsmålsbank, niveauer og bunke. */
const assert = require("node:assert/strict"); const fs = require("node:fs"); const vm = require("node:vm");
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync("brok-loeb-core.js", "utf8"), ctx);
const C = ctx.window.JacobBrokLoebCore;
assert.ok(C, "core eksporteret");
assert.ok(C.BANK.length >= 40, "mindst 40 spørgsmål (" + C.BANK.length + ")");
const ids = new Set();
for (const q of C.BANK) {
  assert.ok(!ids.has(q.id), "unikt id " + q.id); ids.add(q.id);
  assert.ok(q.q && q.a, "tekst + svar " + q.id);
  assert.ok(Array.isArray(q.d) && q.d.length >= 2 && q.d.length <= 3, "2–3 distraktorer " + q.id);
  assert.ok(!q.d.includes(q.a) && new Set(q.d).size === q.d.length, "distraktorer forskellige fra svaret " + q.id);
  assert.ok(C.RULES[q.rule], "regel findes " + q.id);
  assert.ok([1, 2, 3, 4].includes(q.level), "niveau " + q.id);
}
for (const r of Object.values(C.RULES)) assert.ok(r.title && r.rule && r.ex, "regel har titel, regel og eksempel");
for (const lvl of [1, 2, 3, 4]) assert.ok(C.BANK.filter((q) => q.level === lvl).length >= 6, "niveau " + lvl + " har nok spørgsmål");
assert.equal(C.levelFor(0), 1); assert.equal(C.levelFor(4), 2); assert.equal(C.levelFor(99), 4);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const deck = C.createDeck(rnd);
const seen = new Set();
for (let i = 0; i < 30; i++) {
  const lvl = C.levelFor(i);
  const q = deck.next(lvl);
  assert.ok(q.level <= lvl, "aldrig sværere end niveauet");
  assert.ok(!seen.has(q.id), "ingen gentagelser inden banken er brugt"); seen.add(q.id);
  assert.ok(q.options.length >= 3 && q.options.length <= 4);
  assert.equal(q.options[q.correctIndex], q.a);
}
assert.match(C.fracHtml("3/4 <b>"), /bl-frac/); assert.doesNotMatch(C.fracHtml("<b>"), /<b>/, "escaper HTML");
console.log("brok-loeb core checks passed (" + C.BANK.length + " spørgsmål)");
