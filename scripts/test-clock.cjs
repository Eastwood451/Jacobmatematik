const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const clock = require('../clock-core.js');
const svgContext={window:{JacobClockCore:clock}};
vm.runInNewContext(fs.readFileSync('clock.js','utf8'),svgContext);

for (let h=1; h<=12; h++) for(let m=0; m<=59; m++) {
  const t=clock.describe(h,m);
  assert.equal(t.namedHour, m>=30 ? h===12?1:h+1 : h);
  assert.equal(t.count, m>30 ? 60-m : m);
  assert.equal(t.hourAngle,(h%12)*30+m/2);
  assert.equal(t.minuteAngle,m*6);
  const guide=clock.hourGuide(t);
  assert.equal(guide.direction,m===0?'exact':m<30?'before':'after');
  assert.equal(guide.side,m===0?'whole':m<30?'right':m===30?'half':'left');
  assert.equal(guide.namedHour,t.namedHour);
  assert.equal(((guide.endAngle%360)+360)%360,(t.namedHour%12)*30);
  assert(m===0?guide.endAngle===guide.startAngle:m<30?guide.endAngle<guide.startAngle:guide.endAngle>guide.startAngle);
  const svg=svgContext.window.JacobClock.clockSvg(t,true);
  if(m!==0){
    assert(svg.includes(`data-target-hour="${t.namedHour}"`));
    assert(svg.includes(`data-direction="${guide.direction}"`));
    assert(svg.includes('cl-minute-ray'));
    assert(svg.includes('cl-hour-ray'));
    assert(svg.includes('stroke-dasharray="5 6"'));
  }
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
assert.equal(clock.makeDeck('mixed',1).length,720);
assert.equal(clock.makeDeck('mixed',5).length,144);
assert.throws(()=>clock.describe(0,20));
assert.throws(()=>clock.describe(1,40,'over'));
assert.throws(()=>clock.describe(1,15,'half'));
assert.throws(()=>clock.makeDeck('mixed',2));
const app=fs.readFileSync('app.js','utf8'),loader=fs.readFileSync('module-loader.js','utf8');
assert.match(app,/if \(key === "clock"\) return clockCard\(\)/);
assert.match(app,/ensureModule\("clock", "clock"\)/);
assert.match(app,/state.view !== "clock"\) leaveClock/);
assert.match(loader,/clock-core\.js.*clock-course\.js.*clock\.js/);
console.log('PASS: all 720 clock times, hour-guide directions and targets, dashed rays, answer modes, hour rollover and module wiring.');

for(const lesson of clock.LESSONS){
 const deck=clock.lessonDeck(lesson.id,()=>0.5);
 assert(deck.length>=5);
 for(const t of deck){
  assert.equal(t.type,lesson.type);
  if(lesson.type==='whole')assert.equal(t.minute,0);
  const svg=svgContext.window.JacobClock.clockSvg(t,true,{hands:lesson.hands,sectors:lesson.type!=='whole'});
  assert.equal(svg.includes('class="cl-hour-hand"'),lesson.hands!=='minute');
  assert.equal(svg.includes('class="cl-minute-hand"'),lesson.hands!=='hour');
  if(lesson.hands==='hour')assert(!svg.includes('cl-guide-sectors'));
 }
 for(let n=0;n<10;n++){
  const mode=clock.lessonMode(lesson.id,n);
  assert.equal(mode,lesson.hands==='minute'?'minutes':lesson.hands==='hour'||lesson.type==='whole'?'hour':n<3?'minutes':n<6?'hour':'both');
 }
}
assert.equal(clock.LESSONS.length,6);
assert.deepEqual(clock.LESSONS.map(x=>x.chapter),[1,2,2,3,3,4]);
assert.equal(clock.describe(12,0).phrase,'12');
assert.equal(clock.describe(6,0).phrase,'6');
assert.throws(()=>clock.describe(6,0,'over'));
console.log('PASS: six ordered lesson phases, isolated hands, 10-answer scaffolding and whole hours.');

for(const id of ['minutes-over','minutes-to']){
 for(let solved=0;solved<10;solved++){
  const deck=clock.lessonDeck(id,()=>0.5,solved);
  assert.equal(deck.length,solved<5?5:24);
  assert.equal(new Set(deck.map(t=>t.count)).size,deck.length);
  for(const task of deck){
   assert.equal(task.hour,12);
   assert.equal(task.count%5===0,solved<5);
   assert(task.count>=1&&task.count<=29);
  }
 }
 assert.deepEqual(clock.lessonDeck(id,()=>0.5,4).map(t=>t.count).sort((a,b)=>a-b),[5,10,15,20,25]);
}
console.log('PASS: first five minute questions use whole fives; last five use individual minutes, including resumed lessons.');
