/* Browser integration tests use fake profiles only; no Supabase calls or passwords. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {chromium} = require('playwright');
const {completeFinish} = require('./fraction-finish-support.cjs');
const source = ['fraction-simplify.js','fraction-lesson.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const sandbox = {window:{}};
vm.runInNewContext(source,sandbox);
const lesson=sandbox.window.JacobFractionLesson;
const JACOB='c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
assert.equal(lesson.isEnabled({id:JACOB,role:'teacher'}),true);
for (const user of [null,{}, {id:JACOB,role:'student'}, {id:'s1',name:'Jacob',username:'Jacob',role:'student'}, {id:'other-teacher',username:'Jacob',role:'teacher'}]) assert.equal(lesson.isEnabled(user),false);
for (let i=0;i<2000;i++) {
  const p=lesson.createProblem(i);
  for (const n of [p.a,p.b,p.c,p.d]) assert.ok(Number.isInteger(n) && n>0);
  assert.equal(p.notation,i%2 ? 'colon':'stacked');
  assert.notEqual(p.a*p.d,p.c*p.b);
}
assert.deepEqual(JSON.parse(JSON.stringify(lesson.createProblem(0))),{a:1,b:2,c:3,d:4,notation:'stacked'});
assert.equal(lesson.expressionHTML(lesson.createProblem(0)).includes('fl-compound'),true);
const app=fs.readFileSync('app.js','utf8');
assert.match(app,/Jacob fraction pilot: view state is not an authorization role/);
const css=['styles.css','fraction-lesson.css','fraction-multiply.css','fraction-simplify.css'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const out='test-results/fraction-pilot';
fs.mkdirSync(out,{recursive:true});
const summary=[];
function pass(label) { summary.push(label); console.log('PASS',label); }
pass('Only the verified Jacob teacher profile is enabled; 2,000 valid problems alternate notation.');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined,args:['--no-sandbox']});
 const errors=[];
 async function mountAs(kind='jacob',width=1280) {
   const page=await browser.newPage({viewport:{width,height:900}});
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>route.abort());
   await page.setContent(`<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main id="app" class="app-shell"></main></body></html>`);
   await page.addScriptTag({content:`(()=>{
     const kind=${JSON.stringify(kind)};
     const teacher={id:${JSON.stringify(JACOB)},role:'teacher',username:'Jacob',name:'Jacob',results:[]};
     const student={id:'s1',role:'student',username:'student-test',name:'Testelev',classId:'c1',results:[]};
     const second={id:'s2',role:'student',username:'second-test',name:'Anden testelev',classId:'c2',results:[]};
     const other={id:'other-teacher',role:'teacher',username:'other',name:'Anden lærer',results:[]};
     const guest={id:'guest-test',role:'guest',username:'guest',name:'Gæst',results:[]};
     const own=kind==='jacob'?teacher:kind==='student'?student:kind==='other'?other:kind==='guest'?guest:null;
     const school={classes:[{id:'c1',name:'Testklasse 1'},{id:'c2',name:'Testklasse 2'}],users:[teacher,student,second,other,guest]};
     window.__authProfile=own;window.__resultWrites=[];window.__schoolWrites=[];
     window.JacobBackend={configured:true,
       async loadDatabase(){if(!window.__authProfile)throw Error('Signed out');return {database:JSON.parse(JSON.stringify(school)),currentUserId:own.id}},
       async loadSchoolState(){return JSON.parse(JSON.stringify(school))},async loadResults(){return []},
       async saveSchoolState(data,id){window.__schoolWrites.push({id,role:data.users.find(u=>u.id===id)?.role})},
       async appendResult(id,result){window.__resultWrites.push({id,result});return 'fake-result'},
       async signOut(){window.__authProfile=null}
     };
   })();`});
   await page.addScriptTag({content:source});
   await page.addScriptTag({content:app});
   await page.waitForSelector(kind==='out'?'.login-wrap':'.topbar');
   return page;
 }
 try {
   const page=await mountAs();
   await page.locator('[data-class="c2"]').click();
   const selected=await page.locator('[data-class="c2"]').getAttribute('class');
   assert.ok(selected.includes('active'));
   assert.equal(await page.locator('[data-action="toggle-jacob-view"]').getAttribute('aria-checked'),'false');
   await page.locator('[data-action="toggle-jacob-view"]').click();
   await page.waitForSelector('.student-home-layout');
   assert.equal(await page.locator('[data-action="learn-fractions"]').count(),1);
   await page.waitForTimeout(2200);
   assert.equal(await page.locator('.student-home-layout').count(),1);
   await page.locator('[data-action="learn-fractions"]').click();
   await page.waitForSelector('.fl-compound');
   assert.equal(await page.locator('.fl-expression .fl-numerator').allTextContents().then(x=>x.join(',')),'1,3');
   for(const op of ['+','-','*']) {
     await page.locator(`[data-fl-operation="${op}"]`).click();
     assert.match(await page.locator('.fl-feedback').innerText(),/Nej/);
     assert.equal(await page.locator('[data-fl-rule]').count(),0);
   }
   await page.locator('[data-fl-notation]').click();
   assert.equal(await page.locator('.fl-expression .fl-operator').innerText(),':');
   await page.locator('[data-fl-notation]').click();
   await page.locator('[data-fl-operation=":"]').evaluate(el=>{for(let i=0;i<25;i++)el.click()});
   await page.waitForSelector('[data-fl-rule]');
   assert.equal(await page.locator('[data-fl-rule]').count(),3);
   await page.mouse.move(0,0);
   await page.screenshot({path:path.join(out,'desktop-rules.png'),fullPage:true});
   for(const rule of ['add','multiply']) {
     await page.locator(`[data-fl-rule="${rule}"]`).click();
     assert.match(await page.locator('.fl-feedback').innerText(),/Nej/);
   }
   await page.locator('[data-fl-rule="reciprocal"]').evaluate(el=>{for(let i=0;i<25;i++)el.click()});
   assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
   assert.equal(await page.locator('.fl-flip-explanation').count(),0);
   assert.equal(await page.locator('[data-fl-slot]').count(),2);
   assert.equal(await page.locator('[data-fl-next]').isDisabled(),true);
   await page.locator('[data-fl-token="c"]').click();
   await page.locator('[data-fl-slot="numerator"]').click();
   assert.equal(await page.locator('.fl-slot.is-filled').count(),0);
   await page.locator('[data-fl-token="d"]').click();
   await page.locator('[data-fl-slot="numerator"]').click();
   assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
   await page.locator('[data-fl-token="c"]').click();
   await page.locator('[data-fl-slot="denominator"]').click();
   assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
   assert.equal(await page.locator('[data-fl-slot="numerator"]').innerText(),'4');
   assert.equal(await page.locator('[data-fl-slot="denominator"]').innerText(),'3');
   assert.equal(await page.locator('#fl-question').innerText(),'Hvordan ganger du en brøk med en brøk?');
   assert.equal(await page.locator('[data-fl-next]').isDisabled(),true);
   for(const rule of ['add','reciprocal']) {
     await page.locator(`[data-fl-rule="${rule}"]`).click();
     assert.equal(await page.locator('[data-fl-answer]').count(),0);
   }
   await page.locator('[data-fl-rule="multiply"]').click();
   assert.equal(await page.locator('[data-fl-answer]').count(),2);
   await page.locator('[data-fl-answer="numerator"]').fill('4');
   await page.locator('[data-fl-answer="denominator"]').fill('6');
   await page.locator('[data-fl-check-answer]').evaluate(el=>{for(let i=0;i<25;i++)el.click()});
   assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
   await completeFinish(page);
   assert.equal(await page.locator('.fl-count').innerText(),'1 gennemført');
   await page.waitForTimeout(650);
   await page.locator('[data-fl-next]').click();
   assert.equal(await page.locator('.fl-expression .fl-operator').innerText(),':');
   pass('All stages, both rule questions, numerator/denominator entry, simplification, final submission and double-click protection.');
   await page.locator('[data-fl-operation=":"]').click();
   await page.locator('[data-action="toggle-jacob-view"]').click();
   await page.waitForTimeout(1100);
   assert.equal(await page.locator('.fl-page').count(),0);
   assert.equal(await page.locator('.teacher-layout').count(),1);
   assert.ok((await page.locator('[data-class="c2"]').getAttribute('class')).includes('active'));
   assert.equal(await page.evaluate(()=>window.__authProfile.role),'teacher');
   assert.equal(await page.evaluate(()=>window.__resultWrites.length),0);
   assert.ok(await page.evaluate(()=>window.__schoolWrites.every(w=>w.role==='teacher')));
   pass('Toggle preserves teacher permissions and selected class, cancels pending lesson timers, and writes no student results.');
   await page.locator('[data-action="learn-fractions"]').click();
   await page.locator('[data-fl-exit]').click();
   await page.waitForSelector('.student-home-layout');
   await page.locator('.topic-card[data-topic="addition"]').click();
   await page.locator('[data-action="toggle-jacob-view"]').click();
   await page.waitForSelector('.teacher-layout');
   await page.locator('[data-action="learn-fractions"]').click();
   await page.locator('[data-fl-operation=":"]').click();
   await page.locator('[data-action="logout"]').click();
   await page.waitForTimeout(1100);
   assert.equal(await page.locator('.login-wrap').count(),1);
   assert.equal(await page.locator('[data-action="toggle-jacob-view"]').count(),0);
   pass('Exit, ordinary-exercise navigation, and logout leave no stale lesson UI.');
   await page.close();
   for(const width of [320,390,768]) {
     const mobile=await mountAs('jacob',width);
     await mobile.locator('[data-action="learn-fractions"]').click();
     assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     await mobile.locator('[data-fl-operation=":"]').click();
     await mobile.waitForSelector('[data-fl-rule]');
     assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     await mobile.mouse.move(0,0);
     await mobile.screenshot({path:path.join(out,`rules-${width}.png`),fullPage:true});
     await mobile.locator('[data-fl-rule="reciprocal"]').click();
     for(const [token,slot] of [['d','numerator'],['c','denominator']]) {
       await mobile.locator(`[data-fl-token="${token}"]`).click();
       await mobile.locator(`[data-fl-slot="${slot}"]`).click();
     }
     await mobile.locator('[data-fl-rule="multiply"]').click();
     assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     await mobile.screenshot({path:path.join(out,`answer-${width}.png`),fullPage:true});
     await mobile.locator('[data-fl-answer="numerator"]').fill('4');
     await mobile.locator('[data-fl-answer="denominator"]').fill('6');
     await mobile.locator('[data-fl-check-answer]').click();
     await mobile.locator('[data-ff-choice="reduce"]').click();
     await mobile.locator('[data-ff-choice="divideBoth"]').click();
     await mobile.locator('[data-ff-divisor="2"]').click();
     await mobile.locator('[data-ff-answer="numerator"]').fill('2');
     await mobile.locator('[data-action="toggle-jacob-view"]').click();
     assert.equal(await mobile.locator('.fl-page').count(),0);
     assert.equal(await mobile.evaluate(()=>window.__authProfile.role),'teacher');
     await mobile.close();
   }
   pass('No overflow at 320px, 390px and 768px; switching out of simplification preserves teacher permissions.');
   for(const kind of ['student','other','guest','out']) {
     const p=await mountAs(kind);
     assert.equal(await p.locator('[data-action="learn-fractions"]').count(),0);
     assert.equal(await p.locator('[data-action="toggle-jacob-view"]').count(),0);
     for(const action of ['learn-fractions','toggle-jacob-view']) {
       await p.evaluate(action=>{const b=document.createElement('button');b.dataset.action=action;document.getElementById('app').append(b);b.click();b.remove()},action);
       assert.equal(await p.locator('.fl-page').count(),0);
     }
     await p.close();
   }
   pass('No pilot entry or toggle for students, other teachers, guests or signed-out users; forged UI actions are ignored.');
   assert.deepEqual(errors,[]);
   pass('No uncaught browser errors.');
   fs.writeFileSync(path.join(out,'summary.txt'),summary.join('\n')+'\n');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
