/* Browser checks use fake learners and intercepted assets; no database writes. */
const fs=require('node:fs'),assert=require('node:assert/strict');
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
   const asset=require('node:path').resolve('.'+new URL(r.request().url()).pathname);
   if(asset.startsWith(process.cwd()+'/assets/')&&fs.existsSync(asset))return r.fulfill({path:asset});
   return r.abort();
  });
  await page.goto('https://clock-test.invalid/');
  for(const p of ['styles.css','cinematic-theme.css','clock.css'])await page.addStyleTag({content:fs.readFileSync(p,'utf8')});
  await page.addScriptTag({content:fs.readFileSync('clock-core.js','utf8')});
  await page.evaluate(()=>{
   window.JacobBackend={configured:false};window.__records=[];
   const original=window.JacobClockCore;
   window.JacobClockCore={...original,makeDeck(type){const m={'mixed':40,'over':20,'to':40,'half':30,'quarter-over':15,'quarter-to':45,'whole':0}[type];return [original.describe(12,m,type==='mixed'?undefined:type)];},lessonDeck(id){const lesson=original.LESSONS.find(x=>x.id===id),m=lesson.type==='whole'?0:lesson.type==='over'?20:40;window.__courseTask=original.describe(12,m,lesson.type);return [window.__courseTask];}};
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
  for(const id of courseIds){
   assert.equal(await page.locator('.cl-course').getAttribute('data-lesson'),id);
   assert.equal(await page.locator('.cl-course').getAttribute('data-phase'),'intro');
   await page.locator('[data-course="start"]').click();
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
  assert.equal(await page.locator('.cl-hour-guide-arc').getAttribute('data-direction'),'after');
  assert.equal(await page.locator('.cl-hour-guide-arc').getAttribute('data-target-hour'),'1');
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
   assert.equal(await page.locator('.cl-hour-guide-arc').getAttribute('data-direction'),type==='over'||type==='quarter-over'?'before':'after');
   assert.equal(await page.locator('.cl-hour-guide-arc').getAttribute('data-target-hour'),String(hour));
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
  assert.deepEqual(errors,[]);console.log('PASS: all 60 course tasks, isolated hands, corrections, resume, guest/teacher navigation, all phrase families, correction, saved results, round completion, keyboard and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
