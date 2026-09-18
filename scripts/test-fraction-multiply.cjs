/* Offline direct-multiplication regressions. All profiles are fake; no real accounts or writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const logicOnly=process.argv.includes('--logic-only');
const scripts=['fraction-simplify.js','fraction-lesson.js','fraction-add-subtract.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));
const css=logicOnly ? '' : ['styles.css','fraction-lesson.css','fraction-multiply.css','fraction-simplify.css','fraction-add-subtract.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const JACOB='c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
const out=path.join(root,'test-results/fraction-multiply');fs.mkdirSync(out,{recursive:true});
const reports=[],errors=[];
const pass=s=>{reports.push(s);console.log('PASS',s);};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined,args:['--no-sandbox']});
 async function open(width=1280,full=false) {
  const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width<900,isMobile:width<600});
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.abort());
  await page.setContent('<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app" class="app-shell"></main></body></html>');
  if(css)await page.addStyleTag({content:css});
  await page.addScriptTag({content:scripts[0]});await page.addScriptTag({content:scripts[1]});
  await page.evaluate(()=>{window.__core=JacobFractionLesson;});
  await page.addScriptTag({content:scripts[2]});
  if(full) {
   await page.evaluate(id=>{
    const teacher={id,role:'teacher',username:'Jacob',name:'Jacob',results:[]};
    const db={classes:[{id:'c1',name:'Testklasse'}],users:[teacher]};
    window.__profile=teacher;window.__writes=[];
    window.JacobBackend={configured:true,
     async loadDatabase(){return{database:JSON.parse(JSON.stringify(db)),currentUserId:id}},
     async loadSchoolState(){return JSON.parse(JSON.stringify(db))},async loadResults(){return[]},
     async saveSchoolState(data,id){window.__writes.push(data.users.find(u=>u.id===id)?.role)},
     async appendResult(){throw Error('Unexpected real result write')},async signOut(){window.__profile=null}
    };
   },JACOB);
   await page.addScriptTag({content:fs.readFileSync(path.join(root,'app.js'),'utf8')});
   await page.waitForSelector('.topbar');await page.locator('[data-action="learn-fractions"]').click();
  } else await page.evaluate(id=>{
   window.cleanup=JacobFractionLesson.mount(document.querySelector('#app'),{user:{id,role:'teacher'},onExit:()=>{window.cleanup();document.querySelector('#app').textContent='Afsluttet';}});
  },JACOB);
  return page;
 }
 const state=page=>page.locator('.fl-page').getAttribute('data-fl-phase');
 async function unchanged(page) {
  assert.equal(await page.locator('[data-fl-token],[data-fl-slot],[data-fl-notation],.fl-compound').count(),0);
  assert.equal(await page.locator('.fl-expression .fl-operator').innerText(),'·');
  assert.equal(await page.locator('.fl-page').getAttribute('data-fl-mode'),'multiply');
 }
 async function layout(page) {
  if(logicOnly)return;
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(const input of await page.locator('[data-fl-answer],[data-ff-answer]').all()) {
   const b=await input.boundingBox(),eq=await input.locator('xpath=ancestor::*[contains(@class,"fl-solution-equation")]').boundingBox();
   assert.ok(b.x>=eq.x-1 && b.x+b.width<=eq.x+eq.width+1,'Answer box clipped');
  }
 }
 async function toAnswer(page,wrong=false) {
  await unchanged(page);await layout(page);
  const [a,b,c,d]=(await page.locator('.fl-expression .fl-numerator,.fl-expression .fl-denominator').allTextContents()).map(Number);
  if(wrong) for(const value of ['+','-',':']) {
   await page.locator(`[data-fl-operation="${value}"]`).click();assert.equal(await state(page),'operation');
   assert.match(await page.locator('#fl-feedback').innerText(),/betyder gange/);
  }
  await page.locator('[data-fl-operation="*"]').evaluate(el=>{for(let i=0;i<25;i++)el.click();});
  await page.waitForSelector('[data-fl-phase="multiplyRule"]');await unchanged(page);
  assert.equal(await page.locator('#fl-question').innerText(),'Hvordan ganger du en brøk med en brøk?');
  assert.equal(await page.locator('[data-fl-rule]').count(),3);
  assert.equal(await page.locator('.fl-steps>span').count(),4);
  if(wrong) for(const value of ['add','reciprocal']) {
   await page.locator(`[data-fl-rule="${value}"]`).click();assert.equal(await state(page),'multiplyRule');
   assert.equal(await page.locator('[data-fl-answer]').count(),0);
  }
  await layout(page);await page.locator('[data-fl-rule="multiply"]').click();await unchanged(page);
  assert.deepEqual(await page.locator('.fl-solution-equation .fl-numerator,.fl-solution-equation .fl-denominator').allTextContents(),[a,b,c,d].map(String));
  assert.deepEqual(await page.locator('[data-fl-answer]').evaluateAll(els=>els.map(e=>e.value)),['','']);
  assert.equal(await page.locator('[data-fl-answer]').evaluateAll(els=>els.some(e=>e.closest('[aria-hidden="true"]'))),false);
  await layout(page);return {n:a*c,d:b*d};
 }
 async function product(page,n,d) {
  await page.locator('[data-fl-answer="numerator"]').fill(String(n));
  await page.locator('[data-fl-answer="denominator"]').fill(String(d));
  await page.locator('[data-fl-check-answer]').click();
 }
 async function reduce(page,divisor,n,d) {
  await page.locator('[data-ff-choice="reduce"]').click();await page.locator('[data-ff-choice="divideBoth"]').click();
  await page.locator(`[data-ff-divisor="${divisor}"]`).click();
  assert.deepEqual(await page.locator('.ff-term small').allTextContents(),[`÷ ${divisor}`,`÷ ${divisor}`]);
  assert.deepEqual(await page.locator('[data-ff-answer]').evaluateAll(els=>els.map(e=>e.value)),['','']);
  await page.locator('[data-ff-answer="numerator"]').fill(String(n));await page.locator('[data-ff-answer="denominator"]').fill(String(d));
  await page.locator('[data-ff-check]').click();
 }
 async function ready(page,answer,count) {
  assert.equal(await page.locator('#fl-question').innerText(),'Er du klar til at aflevere?');
  assert.equal(await page.locator('.fl-count').innerText(),`${count-1} gennemført`);
  await page.locator(`[data-ff-choice="${answer}"]`).evaluate(el=>{for(let i=0;i<30;i++)el.click();});
  assert.equal(await page.locator('.fl-count').innerText(),`${count} gennemført`);
  assert.equal(await page.locator('#fl-question').innerText(),answer==='yes'?'FLOT! Du cooker de brøker!':'JO, champ! Brøken kan ikke forkortes yderligere! Du har gjort det godt!');
  await layout(page);
 }
 try {
  const page=await open();await page.locator('[data-fa-mode="multiply"]').click();
  assert.equal(await page.locator('[data-fa-mode="multiply"]').getAttribute('aria-pressed'),'true');
  const q=await toAnswer(page,true);assert.deepEqual(q,{n:3,d:8});
  for(const [n,d] of [['',''],['4','6'],['3','0'],['3','9'],['6','16'],['<img','8']]) {
   await product(page,n,d);assert.equal(await state(page),'multiplyAnswer');
   assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
  }
  assert.equal(await page.locator('.fl-answer-fraction img').count(),0);
  await page.locator('[data-fl-answer="numerator"]').fill('3');await page.locator('[data-fl-answer="numerator"]').press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.flAnswer),'denominator');
  await page.locator('[data-fl-answer="denominator"]').fill('8');await page.locator('[data-fl-answer="denominator"]').press('Enter');
  assert.equal(await page.locator('.ff-equation .fl-numerator').innerText(),'3');assert.equal(await page.locator('.ff-equation .fl-denominator').innerText(),'8');
  await page.locator('[data-ff-choice="fine"]').click();await ready(page,'yes',1);
  await page.waitForTimeout(650);
  await page.evaluate(()=>{let i=0;Math.random=()=>[2.1/12,1.1/11][i++%2];});
  await page.locator('[data-fl-next]').click();assert.deepEqual(await toAnswer(page),{n:6,d:12});
  await product(page,6,12);
  await reduce(page,2,3,6);assert.equal(await page.locator('[data-ff-stage="assess"]').count(),1);
  await reduce(page,3,1,2);await ready(page,'no',2);
  pass('Direct products stay unflipped; operation/rule errors, empty/zero/partial/equivalent/escaped inputs, Enter, partial reductions, both praise messages and one-time completion.');
  await page.locator('[data-fa-mode="division"]').click();
  await page.locator('[data-fl-operation=":"]').click();await page.locator('[data-fl-rule="reciprocal"]').click();
  for(const [token,slot] of [['d','numerator'],['c','denominator']]) {await page.locator(`[data-fl-token="${token}"]`).click();await page.locator(`[data-fl-slot="${slot}"]`).click();}
  await page.locator('[data-fl-rule="multiply"]').click();await product(page,3,8);assert.equal(await state(page),'multiplyAnswer');
  await product(page,4,6);assert.equal(await page.locator('.ff-equation .fl-numerator').innerText(),'4');
  for(const mode of ['plus','minus']) {await page.locator(`[data-fa-mode="${mode}"]`).click();assert.equal(await page.locator('[data-fa-phase="operation"]').count(),1);}
  await page.locator('[data-fa-mode="multiply"]').click();await page.locator('[data-fl-operation="*"]').click();
  await page.locator('[data-fa-mode="plus"]').click();await page.waitForTimeout(950);assert.equal(await page.locator('[data-fa-phase="operation"]').count(),1);
  await page.locator('[data-fa-mode="multiply"]').click();await page.locator('[data-fl-operation="*"]').click();
  await page.locator('[data-fl-exit]').click();await page.waitForTimeout(950);assert.equal(await page.locator('#app').innerText(),'Afsluttet');
  pass('Division still uses 4/6, multiplication uses 3/8; four-mode switching and exit cancel delayed transitions.');
  for(const user of [null,{}, {id:JACOB,role:'student'},{id:'other',role:'teacher',name:'Jacob'}]) {
   const html=await page.evaluate(user=>{const el=document.createElement('div');window.__core.mount(el,{user,operation:'multiply'});return el.innerHTML;},user);assert.equal(html,'');
  }
  await page.close();
  pass('Multiplication remains restricted to the exact Jacob teacher profile.');
  if(!logicOnly) {
   for(const width of [1280,320,390,768]) {
    const p=await open(width);await p.locator('[data-fa-mode="multiply"]').click();await toAnswer(p);
    await p.screenshot({path:path.join(out,`answer-${width}.png`),fullPage:true});
    await product(p,3,8);await p.locator('[data-ff-choice="fine"]').click();await ready(p,'yes',1);
    await p.screenshot({path:path.join(out,`complete-${width}.png`),fullPage:true});await p.close();
   }
   pass('Desktop, 320/390px phones and 768px tablet: four buttons, original fractions, answer boxes and final prompt stay within viewport.');
   const p=await open(1280,true);await p.locator('[data-fa-mode="multiply"]').click();await toAnswer(p);await product(p,3,8);
   await p.locator('[data-action="toggle-jacob-view"]').click();await p.waitForSelector('.teacher-layout');
   assert.equal(await p.locator('.fl-page').count(),0);assert.equal(await p.evaluate(()=>window.__profile.role),'teacher');
   assert.ok(await p.evaluate(()=>window.__writes.every(role=>role==='teacher')));
   await p.locator('[data-action="learn-fractions"]').click();await p.locator('[data-fa-mode="multiply"]').click();
   await p.locator('[data-fl-operation="*"]').click();await p.locator('[data-action="logout"]').click();await p.waitForTimeout(950);
   assert.equal(await p.locator('.login-wrap').count(),1);assert.equal(await p.locator('[data-fa-mode]').count(),0);await p.close();
   pass('Actual app teacher toggle and logout during multiplication keep authorization intact and leave no stale lesson or student writes.');
  }
  assert.deepEqual(errors,[]);pass('No uncaught browser errors.');
  fs.writeFileSync(path.join(out,'summary.txt'),reports.join('\n')+'\n');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
