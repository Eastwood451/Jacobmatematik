/* Browser checks use fake learners and intercepted assets; no database writes. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
const app=fs.readFileSync('app.js','utf8').replace(/  start\(\);\s*\}\)\(\);/,'  window.__clockTest={state,render};\n})();');
assert(app.includes('window.__clockTest='));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{
   if(r.request().url()==='https://clock-test.invalid/')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="da"><head></head><body><main id="app"></main></body></html>'});
   const asset=path.resolve('.'+new URL(r.request().url()).pathname);
   if(asset.startsWith(path.resolve('assets')+path.sep)&&fs.existsSync(asset))return r.fulfill({path:asset});
   return r.abort();
  });
  await page.goto('https://clock-test.invalid/');
  for(const p of ['styles.css','cinematic-theme.css','clock.css'])await page.addStyleTag({content:fs.readFileSync(p,'utf8')});
  await page.addScriptTag({content:fs.readFileSync('clock-core.js','utf8')});
  await page.evaluate(()=>{
   window.JacobBackend={configured:false};window.__records=[];
   const original=window.JacobClockCore;
   window.JacobClockCore={...original,makeDeck(type){const m={'mixed':40,'over':20,'to':40,'half':30,'quarter-over':15,'quarter-to':45,'whole':0}[type];return [original.describe(12,m,type==='mixed'?undefined:type)];},lessonDeck(id,random,solved=0){const lesson=original.LESSONS.find(x=>x.id===id);if(lesson.hands==='minute'){const deck=original.lessonDeck(id,random,solved),pop=deck.pop;deck.pop=function(){window.__courseTask=pop.call(this);return window.__courseTask;};return deck;}const m=lesson.type==='whole'?0:lesson.type==='over'?20:40;window.__courseTask=original.describe(12,m,lesson.type);return [window.__courseTask];}};
  });
  await page.addScriptTag({content:fs.readFileSync('clock-course.js','utf8')});
  await page.addScriptTag({content:fs.readFileSync('clock.js','utf8')});
  await page.addScriptTag({content:app});
  const user=async role=>page.evaluate(role=>{const t=window.__clockTest;t.state.user={id:'clock-fake',role,name:'Test',username:'test',results:[],assignedLetters:[],assignedNumbers:[],assignedTables:[],assignedAddends:[],assignedAddendSeconds:[]};t.state.view=role==='teacher'?'teacher':'student';t.render();},role);
  await user('guest');await page.locator('[data-action="clock"]').click();
  fs.mkdirSync('test-results/clock',{recursive:true});
  assert.equal(await page.locator('.cl-course').getAttribute('data-lesson'),'hours');
  assert.equal(await page.locator('.cl-hour-hand').count(),1);
  assert.equal(await page.locator('.cl-minute-hand').count(),0);
  assert.equal(await page.locator('.cl-guide-sectors').count(),0);
  const courseIds=['hours','minutes-over','minutes-to','both-over','both-to','whole'];
  const courseDigits=async n=>{for(const d of String(n))await page.locator(`[data-course-key="${d}"]`).click();};
  const checkCoupledHands=async hour=>{
   const minuteAngle=Number(await page.locator('[data-clock-drag]').getAttribute('aria-valuenow'));
   const hourAngle=await page.locator('.cl-hour-hand').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return (Math.atan2(m.b,m.a)*180/Math.PI+360)%360;});
   assert(Math.abs(hourAngle-((hour%12)*30+minuteAngle/12))<0.1,'hour hand must follow the minute hand at a 1:12 ratio');
  };
  for(const id of courseIds){
   assert.equal(await page.locator('.cl-course').getAttribute('data-lesson'),id);
   assert.equal(await page.locator('.cl-course').getAttribute('data-phase'),'intro');
   await page.locator('[data-course="start"]').click();
   if(id==='both-over'){
    assert.equal(await page.locator('.cl-course').getAttribute('data-phase'),'explore');
    const continuation=page.locator('[data-course="explore-next"]');
    assert(await continuation.isEnabled());
    const point=async angle=>{const box=await page.locator('.cl-clock').boundingBox(),r=angle*Math.PI/180;return {x:box.x+(240+Math.sin(r)*100)*box.width/480,y:box.y+(240-Math.cos(r)*100)*box.height/480};};
    const move=async angle=>{const p=await point(angle);await page.mouse.move(p.x,p.y,{steps:10});};
    const ring=page.locator('.cl-explore-hour-ring');
    const marked=async(hour,color)=>{assert.equal(await ring.getAttribute('data-highlight-hour'),String(hour));assert.equal(await ring.getAttribute('stroke'),color);};
    await marked(3,'#c85540');
    await checkCoupledHands(3);
    await page.screenshot({path:'test-results/clock/drag-3-red.png',fullPage:true});
    await move(120);await page.mouse.down();
    // Crossing the boundary never starts the scored tasks automatically.
    for(const angle of [179,181,179,181,170])await move(angle);
    for(const hour of [3,10]){
     for(let n=0;n<5;n++){
      await move(240);await marked(hour+1,'#356bc3');
      await checkCoupledHands(hour);
      if(n===0){await page.screenshot({path:`test-results/clock/drag-${hour}-blue.png`,fullPage:true});}
      await move(120);await marked(hour,'#c85540');
      await checkCoupledHands(hour);
      assert(await continuation.isEnabled());
     }
     await page.mouse.up();
     assert.equal(await page.locator('.cl-course').getAttribute('data-phase'),'explore');
     assert.equal(await page.locator('.cl-explore').getAttribute('data-hour'),String(hour),'hour changes only when the learner chooses');
     if(hour===3){
      await page.locator('[data-course="explore-hour"]').click();
      assert.equal(await page.locator('.cl-explore').getAttribute('data-hour'),'10');
      await marked(10,'#c85540');
      await page.locator('.cl-hour-hand').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
      await checkCoupledHands(10);
      await page.screenshot({path:'test-results/clock/drag-10-red.png',fullPage:true});
      await move(Number(await page.locator('[data-clock-drag]').getAttribute('aria-valuenow')));await page.mouse.down();
     }
    }
    assert(await continuation.isEnabled());
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'drag tutorial must fit on mobile');
    await page.screenshot({path:'test-results/clock/drag-mobile.png',fullPage:true});
    await continuation.click();
    assert.equal(await page.locator('.cl-course').getAttribute('data-phase'),'exercise');
    await page.setViewportSize({width:1280,height:900});
   }
   const lesson=await page.evaluate(id=>window.JacobClockCore.LESSONS.find(x=>x.id===id),id);
   assert.equal(await page.locator('.cl-hour-hand').count(),lesson.hands==='minute'?0:1);
   assert.equal(await page.locator('.cl-minute-hand').count(),lesson.hands==='hour'?0:1);
   assert.equal(await page.locator('.cl-halves').count(),lesson.type==='whole'?0:1);
   if(lesson.hands==='hour'||lesson.type==='whole')assert.equal(await page.locator('.cl-hour-guide-arc').count(),0);
   if(lesson.type==='whole'&&lesson.hands==='both')assert.equal(await page.locator('.cl-minute-hand').getAttribute('transform'),'rotate(0 200 200)');
   await page.setViewportSize({width:390,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id} must fit on mobile`);
   await page.screenshot({path:`test-results/clock/course-${id}-mobile.png`,fullPage:true});
   await page.setViewportSize({width:1280,height:900});
   for(let n=0;n<10;n++){
    if(id.startsWith('minutes-')&&n===4){
     await page.locator('[data-course="exit"]').click();
     await page.locator('[data-action="clock"]').click();
     assert.equal(await page.locator('.cl-course').getAttribute('data-lesson'),id);
     await page.locator('[data-course="start"]').click();
    }
    if(id.startsWith('minutes-')){
     const count=await page.evaluate(()=>window.__courseTask.count);
     assert.equal(count%5===0,n<5,'only the first five questions use whole fives');
     if(n>=5)assert.match(await page.locator('.cl-coach').textContent(),/Hver lille streg er 1 minut/);
     if(n===5)await page.screenshot({path:'test-results/clock/'+id+'-single-minutes.png',fullPage:true});
    }
    const keys=await page.locator('[data-course-field]').evaluateAll(elements=>elements.map(el=>el.dataset.courseField));
    const expectedMode=await page.evaluate(({id,n})=>window.JacobClockCore.lessonMode(id,n),{id,n});
    assert.deepEqual(keys,expectedMode==='both'?['minutes','hour']:[expectedMode]);
    if(id==='hours'&&n===0){await courseDigits(11);await page.locator('[data-course="check"]').click();assert.match(await page.locator('.cl-feedback').textContent(),/Prøv igen/);assert.match(await page.locator('.cl-progress').textContent(),/0 af 10/);await page.locator('[data-course-key="clear"]').click();}
    const expected=await page.evaluate(()=>({hour:window.__courseTask.namedHour,minutes:window.__courseTask.count}));
    for(const key of keys){await page.locator(`[data-course-field="${key}"]`).click();await courseDigits(expected[key]);}
    await page.keyboard.press('Enter');await page.locator('.cl-feedback.is-good').waitFor();
    assert.match(await page.locator('.cl-progress').textContent(),new RegExp(`${n+1} af 10`));
    assert.deepEqual(await page.locator('[data-course-field]').evaluateAll(elements=>elements.map(el=>el.dataset.courseField)),keys,'correct feedback must retain the answer fields for the completed task');
    await page.locator('[data-course="check"]').click();
   }
   if(id==='hours'){await page.locator('[data-course="exit"]').click();await page.locator('[data-action="clock"]').click();assert.equal(await page.locator('.cl-course').getAttribute('data-lesson'),'minutes-over');}
  }
  await page.locator('.cl-course-finish').waitFor();
  assert.equal(await page.evaluate(()=>window.__clockTest.state.user.results.length),60);
  assert.equal(await page.evaluate(()=>window.__clockTest.state.user.results[0].correct),false);
  await page.locator('[data-course="exit"]').click();
  await page.locator('[data-action="clock"]').click();
  await page.locator('.cl-course-finish').waitFor();
  await page.locator('[data-course="practice"]').first().click();
  const beforeFree=await page.evaluate(()=>window.__clockTest.state.user.results.length);

  assert.equal(await page.locator('.cl-clock').count(),1);
  assert.equal(await page.locator('.cl-guide-ray').count(),3);
  assert.equal(await page.locator('.cl-hour-guide-arc, .cl-clock marker').count(),0);
  assert.match(await page.locator('.cl-direction-rule').textContent(),/venstre halvdel.*EFTER/);
  assert.equal(await page.locator('.cl-hint').isVisible(),false,'numeric explanation should not reveal the minute answer before an attempt');
  await page.locator('[data-cl="help"]').click();
  assert.equal(await page.locator('.cl-guide-ray').count(),0);
  assert.equal(await page.locator('.cl-direction').isVisible(),false);
  await page.locator('[data-cl="help"]').click();
  assert.equal(await page.locator('.cl-guide-ray').count(),3);
  assert.equal(await page.locator('[data-cl-field="minutes"]').count(),1);
  assert.equal(await page.locator('[data-cl-field="hour"]').count(),0);
  const digits=async n=>{for(const d of String(n))await page.locator(`[data-cl-key="${d}"]`).click();};
  await page.locator('[data-cl="check"]').click();assert.match(await page.locator('.cl-feedback').textContent(),/tomme felt/);
  await digits(25);await page.locator('[data-cl="check"]').click();assert.match(await page.locator('.cl-feedback').textContent(),/Prøv/);
  await page.locator('[data-cl-key="clear"]').click();await digits(20);await page.keyboard.press('Enter');
  await page.locator('.cl-feedback.is-good').waitFor();
  assert.equal(await page.evaluate(()=>window.__clockTest.state.user.results.length),beforeFree+1);
  assert.equal(await page.evaluate(()=>window.__clockTest.state.user.results.at(-1).correct),false);
  await page.locator('[data-cl="check"]').click();
  await page.locator('[data-cl-setting="mode"]').selectOption('both');
  for(const [type,minute,hour] of [['to',20,1],['over',20,12],['half',null,1],['quarter-over',null,12],['quarter-to',null,1]]) {
   await page.locator('[data-cl-setting="type"]').selectOption(type);
   assert.equal(await page.locator('.cl-hour-guide-arc, .cl-clock marker').count(),0);
   assert.match(await page.locator('.cl-direction-title').textContent(),type==='over'||type==='quarter-over'?/FØR/:/EFTER/);
   if(type==='half')assert.match(await page.locator('.cl-direction-rule').textContent(),/Stor viser på 6.*EFTER/);
   assert.equal(await page.locator('[data-cl-field]').count(),minute===null?1:2);
   if(minute!==null){await digits(minute);await page.locator('[data-cl-field="hour"]').click();}
   await digits(hour);await page.locator('[data-cl="check"]').click();await page.locator('.cl-feedback.is-good').waitFor();
  }
  await page.locator('[data-cl-setting="mode"]').selectOption('hour');
  for(let i=0;i<10;i++){await digits(1);await page.locator('[data-cl="check"]').click();await page.locator('.cl-feedback.is-good').waitFor();await page.locator('[data-cl="check"]').click();}
  await page.locator('.cl-finish').waitFor();assert.match(await page.locator('.cl-finish').textContent(),/10 rigtige/);
  await page.locator('[data-cl="restart"]').click();
  for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow at ${width}px`);}
  fs.mkdirSync('test-results/clock',{recursive:true});await page.screenshot({path:'test-results/clock/mobile.png',fullPage:true});
  await page.locator('[data-cl="exit"]').click();await page.locator('[data-course="exit"]').click();await page.locator('.student-home-layout').waitFor();
  await user('teacher');await page.locator('.teacher-practice summary').click();await page.locator('.teacher-practice [data-action="clock"]').click();await page.locator('[data-course="exit"]').click();await page.locator('.teacher-page').waitFor();
  const startExploration=async()=>{
   await page.evaluate(()=>{
    window.__disposeExploration?.();
    const results=window.JacobClockCore.LESSONS.slice(0,3).flatMap(l=>Array.from({length:10},()=>({topic:'clock',problem:`Urkursus [${l.id}] saved`})));
    window.__explorationRecords=0;
    window.__disposeExploration=window.JacobClockCourse.mount(document.getElementById('app'),{user:{results},onResult:()=>{window.__explorationRecords++;}});
   });
   await page.locator('[data-course="start"]').click();
  };
  await startExploration();
  assert(await page.locator('[data-course="explore-next"]').isEnabled(),'the learner may start without a minimum number of trips');
  await page.locator('[data-course="explore-next"]').click();
  assert.equal(await page.locator('.cl-course').getAttribute('data-phase'),'exercise');
  await startExploration();
  const slider=page.locator('[data-clock-drag]');await slider.focus();
  // More than three trips stay interactive at each hour pair, including with keys.
  for(const hour of [3,10]){
   for(let n=0;n<5;n++){
    for(let i=0;i<8;i++)await slider.press('ArrowRight');
    assert.equal(await page.locator('.cl-explore-hour-ring').getAttribute('data-highlight-hour'),String(hour+1));
    await checkCoupledHands(hour);
    for(let i=0;i<8;i++)await slider.press('ArrowLeft');
   }
   assert.equal(await page.locator('.cl-explore').getAttribute('data-hour'),String(hour));
   if(hour===3)await page.locator('[data-course="explore-hour"]').click();
  }
  assert(await page.locator('[data-course="explore-next"]').isEnabled());
  assert.equal(await page.evaluate(()=>window.__explorationRecords),0,'exploration must not count as scored answers');
  // Track the physical hour angle through many full turns in both directions,
  // including 12 -> 1, 1 -> 12, negative time and release/re-grab boundaries.
  await startExploration();
  let elapsedMinutes=200;
  const checkContinuousClock=async()=>{
   const actual=await page.evaluate(()=>({
    rotation:parseFloat(document.querySelector('.cl-hour-hand').style.transform.slice(7)),
    hour:Number(document.querySelector('.cl-explore').dataset.hour),
    namedHour:Number(document.querySelector('.cl-explore-hour-ring').dataset.highlightHour),
    color:document.querySelector('.cl-explore-hour-ring').getAttribute('stroke'),
    phase:document.querySelector('.cl-course').dataset.phase
   }));
   const hour=((Math.floor(elapsedMinutes/60)-1)%12+12)%12+1;
   const minute=(elapsedMinutes%60+60)%60,to=minute>=30;
   assert(Math.abs(actual.rotation-elapsedMinutes/2)<0.001,'hour rotation must accumulate without jumping back at 12');
   assert.equal(actual.hour,hour);
   assert.equal(actual.namedHour,to?hour===12?1:hour+1:hour);
   assert.equal(actual.color,to?'#356bc3':'#c85540');
   assert.equal(actual.phase,'explore');
  };
  for(const [direction,turns] of [[1,14],[-1,28]]){
   for(let turn=0;turn<turns;turn++)for(let quarter=0;quarter<4;quarter++){
    for(let step=0;step<6;step++){await slider.press(direction===1?'ArrowRight':'ArrowLeft');elapsedMinutes+=direction*2.5;}
    await checkContinuousClock();
   }
  }
  assert(await page.locator('[data-course="explore-next"]').isEnabled());
  await startExploration();await page.locator('.cl-clock').scrollIntoViewIfNeeded();
  elapsedMinutes=200;
  const mouseMove=async angle=>{
   const b=await page.locator('.cl-clock').boundingBox(),a=angle*Math.PI/180;
   await page.mouse.move(b.x+(240+Math.sin(a)*100)*b.width/480,b.y+(240-Math.cos(a)*100)*b.height/480,{steps:8});
  };
  for(const direction of [1,-1]){
   await mouseMove(120);await page.mouse.down();
   for(let step=1;step<=8;step++){
    await mouseMove((120+direction*step*90+720)%360);elapsedMinutes+=direction*15;
    await checkContinuousClock();
   }
   await page.mouse.up();
  }
  // The clock accepts touch input without scrolling the page during the drag.
  await startExploration();await page.setViewportSize({width:390,height:844});
  await page.locator('.cl-clock').scrollIntoViewIfNeeded();
  const touch=await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const touchPoint=async angle=>{const b=await page.locator('.cl-clock').boundingBox(),a=angle*Math.PI/180;return {x:b.x+(240+Math.sin(a)*100)*b.width/480,y:b.y+(240-Math.cos(a)*100)*b.height/480,id:1};};
  const touchMove=async(angle,verify=true)=>{
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[await touchPoint(angle)]});
   if(verify)await page.waitForFunction(angle=>Number(document.querySelector('[data-clock-drag]').getAttribute('aria-valuenow'))===angle,angle);
  };
  for(const hour of [3,10]){
   await page.locator('.cl-clock').scrollIntoViewIfNeeded();
   const scrollBefore=await page.evaluate(()=>scrollY);
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await touchPoint(Number(await slider.getAttribute('aria-valuenow')))]});
   for(let n=0;n<5;n++){
    await touchMove(240);
    assert.equal(await page.locator('.cl-explore-hour-ring').getAttribute('data-highlight-hour'),String(hour+1));
    if(hour===3&&n===0)await page.screenshot({path:'test-results/clock/drag-mobile-touch.png'});
    await touchMove(120);
   }
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.equal(await page.evaluate(()=>scrollY),scrollBefore);
   assert.equal(await page.locator('.cl-explore').getAttribute('data-hour'),String(hour));
   assert.equal(await page.locator('.cl-course').getAttribute('data-phase'),'explore');
   if(hour===3)await page.locator('[data-course="explore-hour"]').click();
  }
  assert(await page.locator('[data-course="explore-next"]').isEnabled());
  assert.equal(await page.evaluate(()=>window.__explorationRecords),0);
  await startExploration();await page.locator('.cl-clock').scrollIntoViewIfNeeded();
  elapsedMinutes=200;
  for(const direction of [1,-1]){
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await touchPoint(120)]});
   for(let step=1;step<=8;step++){
    await touchMove((120+direction*step*90+720)%360);elapsedMinutes+=direction*15;
    await checkContinuousClock();
   }
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  // Disposing a grabbed hand must release capture and remove its listeners.
  await startExploration();await page.locator('.cl-clock').scrollIntoViewIfNeeded();
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await touchPoint(120)]});
  await page.evaluate(()=>window.__disposeExploration());
  await touchMove(240,false);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('.cl-explore-hour-ring').getAttribute('data-highlight-hour'),'3');
  await touch.detach();
  assert.deepEqual(errors,[]);console.log('PASS: all 60 course tasks, mouse/touch/keyboard exploration, hour rotation, boundary jitter, unlimited dragging and manual continuation, disposal, saved results, navigation and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
