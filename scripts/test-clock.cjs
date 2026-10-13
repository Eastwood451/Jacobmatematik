const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const clock = require('../clock-core.js');
const svgContext={window:{JacobClockCore:clock}};
vm.runInNewContext(fs.readFileSync('clock.js','utf8'),svgContext);

for (let h=1; h<=12; h++) for(let m=1; m<=59; m++) {
  const t=clock.describe(h,m);
  assert.equal(t.namedHour, m>=30 ? h===12?1:h+1 : h);
  assert.equal(t.count, m>30 ? 60-m : m);
  assert.equal(t.hourAngle,(h%12)*30+m/2);
  assert.equal(t.minuteAngle,m*6);
  const guide=clock.hourGuide(t);
  assert.equal(guide.direction,m<30?'before':'after');
  assert.equal(guide.side,m<30?'right':m===30?'half':'left');
  assert.equal(guide.namedHour,t.namedHour);
  assert.equal(((guide.endAngle%360)+360)%360,(t.namedHour%12)*30);
  assert(m<30?guide.endAngle<guide.startAngle:guide.endAngle>guide.startAngle);
  const svg=svgContext.window.JacobClock.clockSvg(t,true);
  assert(svg.includes(`data-target-hour="${t.namedHour}"`));
  assert(svg.includes(`data-direction="${guide.direction}"`));
  assert(svg.includes('cl-minute-ray'));
  assert(svg.includes('cl-hour-ray'));
  assert(svg.includes('stroke-dasharray="5 6"'));
  assert(!svgContext.window.JacobClock.clockSvg(t,false).includes('cl-guide-ray'));
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
assert.match(loader,/clock-core\.js.*clock-guides2", "clock\.js/);
console.log('PASS: all 708 clock times, hour-guide directions and targets, dashed rays, answer modes, hour rollover and module wiring.');
