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
  await page.route('**/*',r=>r.request().url()==='https://clock-test.invalid/'?r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="da"><head></head><body><main id="app"></main></body></html>'}):r.abort());
  await page.goto('https://clock-test.invalid/');
  for(const p of ['styles.css','cinematic-theme.css','clock.css'])await page.addStyleTag({content:fs.readFileSync(p,'utf8')});
  await page.addScriptTag({content:fs.readFileSync('clock-core.js','utf8')});
  await page.evaluate(()=>{
   window.JacobBackend={configured:false};window.__records=[];
   const original=window.JacobClockCore;
   window.JacobClockCore={...original,makeDeck(type){const m={'mixed':40,'over':20,'to':40,'half':30,'quarter-over':15,'quarter-to':45}[type];return [original.describe(12,m,type==='mixed'?undefined:type)];}};
  });
  await page.addScriptTag({content:fs.readFileSync('clock.js','utf8')});
  await page.addScriptTag({content:app});
  const user=async role=>page.evaluate(role=>{const t=window.__clockTest;t.state.user={id:'clock-fake',role,name:'Test',username:'test',results:[],assignedLetters:[],assignedNumbers:[],assignedTables:[],assignedAddends:[],assignedAddendSeconds:[]};t.state.view=role==='teacher'?'teacher':'student';t.render();},role);
  await user('guest');await page.locator('[data-action="clock"]').click();
  assert.equal(await page.locator('.cl-clock').count(),1);
  assert.equal(await page.locator('[data-cl-field="minutes"]').count(),1);
  assert.equal(await page.locator('[data-cl-field="hour"]').count(),0);
  const digits=async n=>{for(const d of String(n))await page.locator(`[data-cl-key="${d}"]`).click();};
  await page.locator('[data-cl="check"]').click();assert.match(await page.locator('.cl-feedback').textContent(),/tomme felt/);
  await digits(25);await page.locator('[data-cl="check"]').click();assert.match(await page.locator('.cl-feedback').textContent(),/Prøv/);
  await page.locator('[data-cl-key="clear"]').click();await digits(20);await page.keyboard.press('Enter');
  await page.locator('.cl-feedback.is-good').waitFor();
  assert.equal(await page.evaluate(()=>window.__clockTest.state.user.results.length),1);
  assert.equal(await page.evaluate(()=>window.__clockTest.state.user.results[0].correct),false);
  await page.locator('[data-cl="check"]').click();
  await page.locator('[data-cl-setting="mode"]').selectOption('both');
  for(const [type,minute,hour] of [['to',20,1],['over',20,12],['half',null,1],['quarter-over',null,12],['quarter-to',null,1]]) {
   await page.locator('[data-cl-setting="type"]').selectOption(type);
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
  await page.locator('[data-cl="exit"]').click();await page.locator('.student-home-layout').waitFor();
  await user('teacher');await page.locator('.teacher-practice summary').click();await page.locator('.teacher-practice [data-action="clock"]').click();await page.locator('[data-cl="exit"]').click();await page.locator('.teacher-page').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: guest/teacher navigation, all phrase families, correction, saved results, round completion, keyboard and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
