const assert = require('node:assert/strict');
const fs = require('node:fs');
const clock = require('../clock-core.js');

for (let h=1; h<=12; h++) for(let m=1; m<=59; m++) {
  const t=clock.describe(h,m);
  assert.equal(t.namedHour, m>=30 ? h===12?1:h+1 : h);
  assert.equal(t.count, m>30 ? 60-m : m);
  assert.equal(t.hourAngle,(h%12)*30+m/2);
  assert.equal(t.minuteAngle,m*6);
  for(const mode of ['minutes','hour','both']) {
    assert(clock.validate(t,mode,{minutes:t.count,hour:t.namedHour}).correct);
    assert(!clock.validate(t,mode,{}).correct);
    for(const field of clock.fields(t,mode)) {
      const answer={minutes:t.count,hour:t.namedHour};answer[field]++;
      assert(!clock.validate(t,mode,answer).correct);
      answer[field]='';assert(clock.validate(t,mode,answer).missing.includes(field));
      answer[field]='1e1';assert(!clock.validate(t,mode,answer).correct);
    }
  }
}
assert.equal(clock.describe(5,40).phrase,'20 minutter i 6');
assert.equal(clock.describe(5,20).phrase,'20 minutter over 5');
assert.equal(clock.describe(5,30).phrase,'halv 6');
assert.equal(clock.describe(5,15).phrase,'kvart over 5');
assert.equal(clock.describe(5,45).phrase,'kvart i 6');
assert.equal(clock.describe(12,30).phrase,'halv 1');
assert.equal(clock.describe(12,59).phrase,'1 minut i 1');
assert.equal(clock.describe(1,1).phrase,'1 minut over 1');
for(const type of ['mixed',...clock.TYPES]) for(const step of [1,5]) {
  const deck=clock.makeDeck(type,step,()=>0.5);
  assert(deck.length>0);
  assert.equal(new Set(deck.map(t=>`${t.hour}:${t.minute}`)).size,deck.length);
  for(const t of deck) {assert.equal(t.minute%step,0);if(type!=='mixed')assert.equal(t.type,type);}
}
assert.equal(clock.makeDeck('mixed',1).length,708);
assert.equal(clock.makeDeck('mixed',5).length,132);
assert.throws(()=>clock.describe(0,20));
assert.throws(()=>clock.describe(1,40,'over'));
assert.throws(()=>clock.describe(1,15,'half'));
assert.throws(()=>clock.makeDeck('mixed',2));
const app=fs.readFileSync('app.js','utf8'),loader=fs.readFileSync('module-loader.js','utf8');
assert.match(app,/if \(key === "clock"\) return clockCard\(\)/);
assert.match(app,/ensureModule\("clock", "clock"\)/);
assert.match(app,/state.view !== "clock"\) leaveClock/);
assert.match(loader,/clock-core\.js.*clock1", "clock\.js/);
console.log('PASS: all 708 clock times, answer modes, five phrase families, hour rollover and module wiring.');
